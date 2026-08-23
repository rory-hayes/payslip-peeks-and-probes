-- A verified Stripe webhook is still not enough to grant access: it must
-- correspond to the exact Checkout Session previously reserved by this app.
-- This replaces the earlier compatibility path that allowed a null intent or
-- an unbound session to create a lifetime entitlement.

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
AS $$
DECLARE
  v_intent public.checkout_intents%ROWTYPE;
  v_other_lifetime boolean;
BEGIN
  -- A missing intent is an external or legacy session, not an entitlement.
  -- Return a durable review state so the signed Stripe event is acknowledged
  -- without creating an endless retry loop.
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
  FROM public.checkout_intents
  WHERE checkout_intents.id = p_intent_id
    AND checkout_intents.user_id = p_user_id
    AND checkout_intents.environment = p_environment
  FOR UPDATE;

  IF NOT FOUND
    OR v_intent.checkout_mode <> 'payment'
    OR v_intent.price_lookup_key <> p_price_id
    OR v_intent.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN
    RETURN 'requires_review';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.checkout_intents ci
    WHERE ci.user_id = p_user_id
      AND ci.environment = p_environment
      AND ci.checkout_mode = 'payment'
      AND ci.state = 'succeeded'
      AND ci.id <> p_intent_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.subscriptions s
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
$$;

REVOKE ALL ON FUNCTION public.grant_lifetime_entitlement(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_entitlement(uuid, uuid, text, text, text, text, text) TO service_role;
