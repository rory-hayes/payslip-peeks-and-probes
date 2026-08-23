-- A lifetime refund must be bound to the exact, app-created Checkout Session
-- that granted it. Store the Stripe PaymentIntent only after the server has
-- verified that relationship; this is not browser-writable entitlement state.
ALTER TABLE public.checkout_intents
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE UNIQUE INDEX IF NOT EXISTS checkout_intents_one_payment_intent_per_environment
  ON public.checkout_intents (environment, stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- `refunded` is terminal. It intentionally releases the one-succeeded-
-- lifetime guard only after the exact entitlement row has been cancelled, so
-- a fully refunded customer can make a new purchase without a charged,
-- permanently-blocked checkout.
ALTER TABLE public.checkout_intents
  DROP CONSTRAINT IF EXISTS checkout_intents_state_check;

ALTER TABLE public.checkout_intents
  ADD CONSTRAINT checkout_intents_state_check CHECK (
    state IN (
      'creating',
      'open',
      'awaiting_payment',
      'succeeded',
      'expired',
      'failed',
      'requires_review',
      'refunded'
    )
  );

-- Bind the PaymentIntent before the entitlement is granted. Keeping this in a
-- private RPC makes the checkout/refund ordering safe: if a fully-refunded
-- event wins the completion event, the later grant sees the terminal state.
CREATE OR REPLACE FUNCTION public.record_lifetime_payment_intent(
  p_intent_id uuid,
  p_user_id uuid,
  p_environment text,
  p_session_id text,
  p_payment_intent_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_intent public.checkout_intents%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_intent_id IS NULL
    OR p_user_id IS NULL
    OR p_environment NOT IN ('sandbox', 'live')
    OR length(trim(coalesce(p_session_id, ''))) = 0
    OR length(trim(coalesce(p_payment_intent_id, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid lifetime payment binding';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || p_environment)::bigint
  );

  SELECT * INTO v_intent
  FROM public.checkout_intents AS ci
  WHERE ci.id = p_intent_id
    AND ci.user_id = p_user_id
    AND ci.environment = p_environment
  FOR UPDATE;

  IF NOT FOUND
    OR v_intent.checkout_mode <> 'payment'
    OR v_intent.stripe_checkout_session_id IS DISTINCT FROM p_session_id
    OR (
      v_intent.stripe_payment_intent_id IS NOT NULL
      AND v_intent.stripe_payment_intent_id <> p_payment_intent_id
    ) THEN
    RETURN 'requires_review';
  END IF;

  UPDATE public.checkout_intents
  SET
    stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
    updated_at = now()
  WHERE id = v_intent.id;

  IF v_intent.state = 'refunded' THEN
    RETURN 'refunded';
  END IF;
  IF v_intent.state IN ('expired', 'failed', 'requires_review') THEN
    RETURN 'requires_review';
  END IF;

  RETURN 'recorded';
END;
$function$;

REVOKE ALL ON FUNCTION public.record_lifetime_payment_intent(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_lifetime_payment_intent(uuid, uuid, text, text, text) TO service_role;

-- Preserve the original RPC signature for zero-downtime function deployment.
-- The webhook records a verified PaymentIntent first; this function then
-- refuses to re-grant an entitlement that a refund webhook already closed.
CREATE OR REPLACE FUNCTION public.grant_lifetime_entitlement(
  p_intent_id uuid,
  p_user_id uuid,
  p_environment text,
  p_session_id text,
  p_customer_id text,
  p_product_id text,
  p_price_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_intent public.checkout_intents%ROWTYPE;
  v_other_lifetime boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  -- A missing intent is an external or legacy session, not an entitlement.
  IF p_intent_id IS NULL THEN
    RETURN 'requires_review';
  END IF;

  IF p_user_id IS NULL
    OR p_environment NOT IN ('sandbox', 'live')
    OR p_session_id IS NULL
    OR length(p_session_id) = 0
    OR p_product_id IS NULL
    OR length(p_product_id) = 0
    OR p_price_id IS NULL
    OR length(p_price_id) = 0 THEN
    RAISE EXCEPTION 'Invalid lifetime entitlement';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = p_user_id) THEN
    RETURN 'user_missing';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || p_environment)::bigint
  );

  SELECT * INTO v_intent
  FROM public.checkout_intents AS ci
  WHERE ci.id = p_intent_id
    AND ci.user_id = p_user_id
    AND ci.environment = p_environment
  FOR UPDATE;

  IF NOT FOUND
    OR v_intent.checkout_mode <> 'payment'
    OR v_intent.price_lookup_key <> p_price_id
    OR v_intent.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN
    RETURN 'requires_review';
  END IF;

  IF v_intent.state = 'refunded' THEN
    RETURN 'refunded';
  END IF;
  IF v_intent.state IN ('expired', 'failed', 'requires_review') THEN
    RETURN 'requires_review';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.checkout_intents AS ci
    WHERE ci.user_id = p_user_id
      AND ci.environment = p_environment
      AND ci.checkout_mode = 'payment'
      AND ci.state = 'succeeded'
      AND ci.id <> p_intent_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.subscriptions AS s
    WHERE s.user_id = p_user_id
      AND s.environment = p_environment
      AND s.stripe_subscription_id <> ('lifetime_' || p_session_id)
      AND s.status IN ('active', 'trialing')
      AND (
        s.price_id IN ('lifetime_once', 'lifetime_once_gbp')
        OR s.product_id IN ('lifetime', 'lifetime_plan')
      )
  )
  INTO v_other_lifetime;

  IF v_other_lifetime THEN
    UPDATE public.checkout_intents
    SET
      stripe_checkout_session_id = p_session_id,
      state = 'requires_review',
      updated_at = now()
    WHERE id = p_intent_id;
    RETURN 'requires_review';
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    product_id,
    price_id,
    status,
    current_period_start,
    current_period_end,
    environment,
    updated_at
  )
  VALUES (
    p_user_id,
    'lifetime_' || p_session_id,
    coalesce(p_customer_id, ''),
    p_product_id,
    p_price_id,
    'active',
    now(),
    NULL,
    p_environment,
    now()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE
  SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    product_id = EXCLUDED.product_id,
    price_id = EXCLUDED.price_id,
    status = 'active',
    current_period_start = coalesce(subscriptions.current_period_start, EXCLUDED.current_period_start),
    current_period_end = NULL,
    updated_at = EXCLUDED.updated_at;

  UPDATE public.checkout_intents
  SET
    stripe_checkout_session_id = p_session_id,
    state = 'succeeded',
    updated_at = now()
  WHERE id = p_intent_id;

  RETURN 'granted';
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_lifetime_entitlement(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_entitlement(uuid, uuid, text, text, text, text, text) TO service_role;

-- Only a complete, settled refund from the exact original PaymentIntent can
-- remove access. Recurring subscriptions never match the synthetic lifetime
-- ID and are therefore unaffected by this function.
CREATE OR REPLACE FUNCTION public.revoke_lifetime_entitlement(
  p_intent_id uuid,
  p_user_id uuid,
  p_environment text,
  p_session_id text,
  p_payment_intent_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_intent public.checkout_intents%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_subscription_found boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF p_intent_id IS NULL
    OR p_user_id IS NULL
    OR p_environment NOT IN ('sandbox', 'live')
    OR length(trim(coalesce(p_session_id, ''))) = 0
    OR length(trim(coalesce(p_payment_intent_id, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid lifetime refund';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || p_environment)::bigint
  );

  SELECT * INTO v_intent
  FROM public.checkout_intents AS ci
  WHERE ci.id = p_intent_id
    AND ci.user_id = p_user_id
    AND ci.environment = p_environment
  FOR UPDATE;

  IF NOT FOUND
    OR v_intent.checkout_mode <> 'payment'
    OR v_intent.stripe_checkout_session_id IS DISTINCT FROM p_session_id
    OR (
      v_intent.stripe_payment_intent_id IS NOT NULL
      AND v_intent.stripe_payment_intent_id <> p_payment_intent_id
    ) THEN
    RETURN 'requires_review';
  END IF;

  IF v_intent.state = 'refunded' THEN
    RETURN 'already_revoked';
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions AS s
  WHERE s.user_id = p_user_id
    AND s.environment = p_environment
    AND s.stripe_subscription_id = ('lifetime_' || p_session_id)
  FOR UPDATE;
  v_subscription_found := FOUND;

  IF v_subscription_found
    AND (
      v_subscription.price_id <> v_intent.price_lookup_key
      OR v_subscription.product_id NOT IN ('lifetime', 'lifetime_plan')
    ) THEN
    RETURN 'requires_review';
  END IF;

  IF v_subscription_found THEN
    UPDATE public.subscriptions
    SET
      status = 'canceled',
      current_period_end = now(),
      cancel_at_period_end = false,
      updated_at = now()
    WHERE stripe_subscription_id = v_subscription.stripe_subscription_id;
  END IF;

  UPDATE public.checkout_intents
  SET
    stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
    state = 'refunded',
    updated_at = now()
  WHERE id = v_intent.id;

  RETURN 'revoked';
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_lifetime_entitlement(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_lifetime_entitlement(uuid, uuid, text, text, text) TO service_role;
