-- Checkout Sessions are externally stateful. Keep one durable, server-owned
-- intent per user and billing environment so a double click, refresh, or a
-- second tab can only recover the same Stripe session.

CREATE TABLE public.checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  price_lookup_key text NOT NULL,
  checkout_mode text NOT NULL CHECK (checkout_mode IN ('payment', 'subscription')),
  stripe_price_id text NOT NULL,
  customer_email text,
  stripe_checkout_session_id text UNIQUE,
  state text NOT NULL DEFAULT 'creating' CHECK (
    state IN (
      'creating',
      'open',
      'awaiting_payment',
      'succeeded',
      'expired',
      'failed',
      'requires_review'
    )
  ),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '31 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The unresolved row is the checkout mutex. `requires_review` deliberately
-- remains unresolved: a charged, ambiguous payment must not unlock another
-- checkout until it has been reconciled.
CREATE UNIQUE INDEX checkout_intents_one_unresolved_user_environment
  ON public.checkout_intents (user_id, environment)
  WHERE state IN ('creating', 'open', 'awaiting_payment', 'requires_review');

-- A lifetime product is one entitlement per account/environment. Historical
-- subscription rows remain unconstrained so renewals and cancelled history are
-- not broken by this hardening migration.
CREATE UNIQUE INDEX checkout_intents_one_succeeded_lifetime_user_environment
  ON public.checkout_intents (user_id, environment)
  WHERE checkout_mode = 'payment' AND state = 'succeeded';

CREATE INDEX checkout_intents_user_environment_state_idx
  ON public.checkout_intents (user_id, environment, state, created_at DESC);

ALTER TABLE public.checkout_intents ENABLE ROW LEVEL SECURITY;

-- Browser clients never read or mutate Stripe Checkout state. Edge Functions
-- use the service role and the narrowly-scoped RPCs below.

CREATE OR REPLACE FUNCTION public.acquire_checkout_intent(
  p_user_id uuid,
  p_environment text,
  p_price_lookup_key text,
  p_checkout_mode text,
  p_stripe_price_id text,
  p_customer_email text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  environment text,
  price_lookup_key text,
  checkout_mode text,
  stripe_price_id text,
  customer_email text,
  stripe_checkout_session_id text,
  state text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.checkout_intents%ROWTYPE;
BEGIN
  IF p_user_id IS NULL
    OR p_environment NOT IN ('sandbox', 'live')
    OR p_checkout_mode NOT IN ('payment', 'subscription')
    OR p_price_lookup_key IS NULL
    OR length(p_price_lookup_key) = 0
    OR p_stripe_price_id IS NULL
    OR length(p_stripe_price_id) = 0 THEN
    RAISE EXCEPTION 'Invalid checkout intent';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = p_user_id) THEN
    RAISE EXCEPTION 'Checkout user no longer exists';
  END IF;

  -- A collision only serialises two unrelated requests; it never grants data
  -- access. It prevents check-then-insert races before the partial index is
  -- consulted.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || p_environment)::bigint
  );

  -- An open Stripe Checkout Session cannot charge after its expiry. A
  -- `creating` row is recoverable with its deterministic Stripe idempotency
  -- key. Once its intended Checkout Session lifetime has elapsed, a Stripe
  -- session under that key can no longer charge and a fresh intent is safe.
  UPDATE public.checkout_intents
  SET state = 'expired', updated_at = now()
  WHERE user_id = p_user_id
    AND environment = p_environment
    AND state IN ('creating', 'open')
    AND expires_at <= now();

  SELECT * INTO v_intent
  FROM public.checkout_intents
  WHERE checkout_intents.user_id = p_user_id
    AND checkout_intents.environment = p_environment
    AND checkout_intents.state IN ('creating', 'open', 'awaiting_payment', 'requires_review')
  ORDER BY checkout_intents.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_intent.id,
      v_intent.user_id,
      v_intent.environment,
      v_intent.price_lookup_key,
      v_intent.checkout_mode,
      v_intent.stripe_price_id,
      v_intent.customer_email,
      v_intent.stripe_checkout_session_id,
      v_intent.state,
      v_intent.expires_at;
    RETURN;
  END IF;

  INSERT INTO public.checkout_intents (
    user_id,
    environment,
    price_lookup_key,
    checkout_mode,
    stripe_price_id,
    customer_email,
    state
  )
  VALUES (
    p_user_id,
    p_environment,
    p_price_lookup_key,
    p_checkout_mode,
    p_stripe_price_id,
    nullif(trim(p_customer_email), ''),
    'creating'
  )
  RETURNING * INTO v_intent;

  RETURN QUERY
  SELECT
    v_intent.id,
    v_intent.user_id,
    v_intent.environment,
    v_intent.price_lookup_key,
    v_intent.checkout_mode,
    v_intent.stripe_price_id,
    v_intent.customer_email,
    v_intent.stripe_checkout_session_id,
    v_intent.state,
    v_intent.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_checkout_intent(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_checkout_intent(uuid, text, text, text, text, text) TO service_role;

-- The webhook has already verified the Checkout Session with Stripe before it
-- calls this function. Keeping the entitlement insert and success transition in
-- one transaction prevents two paid lifetime sessions becoming two rows.
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

  IF p_intent_id IS NOT NULL THEN
    SELECT * INTO v_intent
    FROM public.checkout_intents
    WHERE checkout_intents.id = p_intent_id
      AND checkout_intents.user_id = p_user_id
      AND checkout_intents.environment = p_environment
    FOR UPDATE;

    IF NOT FOUND
      OR v_intent.checkout_mode <> 'payment'
      OR v_intent.price_lookup_key <> p_price_id
      OR (
        v_intent.stripe_checkout_session_id IS NOT NULL
        AND v_intent.stripe_checkout_session_id <> p_session_id
      ) THEN
      RETURN 'requires_review';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.checkout_intents ci
    WHERE ci.user_id = p_user_id
      AND ci.environment = p_environment
      AND ci.checkout_mode = 'payment'
      AND ci.state = 'succeeded'
      AND (p_intent_id IS NULL OR ci.id <> p_intent_id)
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
    IF p_intent_id IS NOT NULL THEN
      UPDATE public.checkout_intents
      SET
        stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_session_id),
        state = 'requires_review',
        updated_at = now()
      WHERE id = p_intent_id;
    END IF;
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

  IF p_intent_id IS NOT NULL THEN
    UPDATE public.checkout_intents
    SET
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_session_id),
      state = 'succeeded',
      updated_at = now()
    WHERE id = p_intent_id;
  END IF;

  RETURN 'granted';
END;
$$;

REVOKE ALL ON FUNCTION public.grant_lifetime_entitlement(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_entitlement(uuid, uuid, text, text, text, text, text) TO service_role;
