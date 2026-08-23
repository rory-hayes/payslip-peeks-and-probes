-- Stripe and Auth cannot share one transaction. A verified billing event that
-- arrives while (or just after) Auth deletion cascades checkout rows must leave
-- a durable, pseudonymous reconciliation receipt. It deliberately has no
-- foreign key to auth.users or checkout_intents, and is service-role only.

ALTER TABLE public.account_deletion_jobs
  ADD COLUMN IF NOT EXISTS billing_reconciliation_state text NOT NULL DEFAULT 'clear'
    CHECK (billing_reconciliation_state IN ('clear', 'review_required', 'resolved')),
  -- Auth deletion is an external operation. Keep a durable, lease-bound
  -- receipt of its preparation and successful return so a late billing review
  -- cannot make an already-removed account indistinguishable from an
  -- out-of-band Auth deletion that still needs Storage recovery.
  ADD COLUMN IF NOT EXISTS auth_removal_state text NOT NULL DEFAULT 'not_started'
    CHECK (auth_removal_state IN ('not_started', 'prepared', 'removed')),
  ADD COLUMN IF NOT EXISTS auth_removal_lease_token uuid,
  ADD COLUMN IF NOT EXISTS auth_removal_prepared_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_removed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.account_deletion_billing_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deletion_job_id uuid REFERENCES public.account_deletion_jobs(id) ON DELETE SET NULL,
  subject_user_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  checkout_intent_id uuid NOT NULL,
  checkout_mode text NOT NULL CHECK (checkout_mode IN ('payment', 'subscription')),
  price_lookup_key text NOT NULL,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  stripe_customer_id text,
  last_stripe_event_id text,
  last_event_type text,
  remote_status text,
  state text NOT NULL DEFAULT 'review_required'
    CHECK (state IN ('watching', 'review_required', 'resolved')),
  resolution_code text,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (resolution_code IS NULL OR char_length(resolution_code) <= 120),
  CHECK (resolved_by IS NULL OR char_length(resolved_by) <= 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_billing_reviews_checkout_key
  ON public.account_deletion_billing_reviews (environment, checkout_intent_id);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_billing_reviews_session_key
  ON public.account_deletion_billing_reviews (environment, stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_billing_reviews_payment_intent_key
  ON public.account_deletion_billing_reviews (environment, stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_billing_reviews_subscription_key
  ON public.account_deletion_billing_reviews (environment, stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS account_deletion_billing_reviews_subject_state_idx
  ON public.account_deletion_billing_reviews (subject_user_id, state, created_at DESC);

ALTER TABLE public.account_deletion_billing_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_deletion_billing_reviews FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_deletion_billing_reviews TO service_role;

-- A resolution and a later decision to continue deletion are deliberately
-- separate. Keep the latter append-only so a support operator cannot silently
-- restart a deletion after a financial event has been reviewed.
CREATE TABLE IF NOT EXISTS public.account_deletion_billing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deletion_job_id uuid NOT NULL REFERENCES public.account_deletion_jobs(id) ON DELETE RESTRICT,
  subject_user_id uuid NOT NULL,
  approval_code text NOT NULL CHECK (char_length(approval_code) BETWEEN 1 AND 120),
  approved_by text NOT NULL CHECK (char_length(approved_by) BETWEEN 1 AND 120),
  outcome text NOT NULL CHECK (outcome IN ('queued', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletion_billing_approvals_job_created_idx
  ON public.account_deletion_billing_approvals (deletion_job_id, created_at DESC);

ALTER TABLE public.account_deletion_billing_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_deletion_billing_approvals FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE public.account_deletion_billing_approvals TO service_role;

-- This is the only webhook write path for a deletion-time payment or
-- subscription. It serializes lifecycle -> review key -> job so a duplicate
-- Stripe delivery cannot mix two accounts' reconciliation data.
CREATE OR REPLACE FUNCTION public.record_account_deletion_billing_review(
  p_subject_user_id uuid,
  p_environment text,
  p_checkout_intent_id uuid,
  p_checkout_mode text,
  p_price_lookup_key text,
  p_stripe_checkout_session_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_event_id text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_remote_status text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lifecycle_state text;
  v_has_lifecycle boolean := false;
  v_user_exists boolean := false;
  v_job public.account_deletion_jobs%ROWTYPE;
  v_has_job boolean := false;
  v_existing_subject_user_id uuid;
  v_existing_checkout_mode text;
  v_existing_price_lookup_key text;
  v_existing_state text;
  v_existing_stripe_event_id text;
  v_has_existing_review boolean := false;
  v_session_id text := nullif(trim(coalesce(p_stripe_checkout_session_id, '')), '');
  v_payment_intent_id text := nullif(trim(coalesce(p_stripe_payment_intent_id, '')), '');
  v_subscription_id text := nullif(trim(coalesce(p_stripe_subscription_id, '')), '');
  v_customer_id text := nullif(trim(coalesce(p_stripe_customer_id, '')), '');
  v_event_id text := nullif(trim(coalesce(p_stripe_event_id, '')), '');
  v_event_type text := nullif(trim(coalesce(p_event_type, '')), '');
  v_remote_status text := nullif(trim(coalesce(p_remote_status, '')), '');
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_subject_user_id IS NULL
    OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live')
    OR p_checkout_intent_id IS NULL
    OR p_checkout_mode IS NULL OR p_checkout_mode NOT IN ('payment', 'subscription')
    OR length(trim(coalesce(p_price_lookup_key, ''))) = 0
    OR (v_session_id IS NULL AND v_payment_intent_id IS NULL AND v_subscription_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid deletion billing review';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_subject_user_id::text)::bigint
  );

  SELECT lifecycle.state INTO v_lifecycle_state
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = p_subject_user_id
  FOR UPDATE;
  v_has_lifecycle := FOUND;

  SELECT EXISTS (
    SELECT 1 FROM auth.users AS auth_user WHERE auth_user.id = p_subject_user_id
  ) INTO v_user_exists;

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.subject_user_id = p_subject_user_id
  ORDER BY job.created_at DESC
  LIMIT 1
  FOR UPDATE;
  v_has_job := FOUND;

  -- A missing lifecycle row represents an active legacy account only while the
  -- Auth account is still present and no deletion receipt exists. Any lifecycle
  -- or unfinished/reopened job is a strict reconciliation fence.
  IF (v_has_lifecycle AND v_lifecycle_state = 'active' AND (NOT v_has_job OR v_job.state = 'completed'))
    OR (NOT v_has_lifecycle AND v_user_exists AND NOT v_has_job) THEN
    RETURN 'no_deletion';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('deletion-billing-review:' || p_environment || ':' || p_checkout_intent_id::text)::bigint
  );

  SELECT
    review.subject_user_id,
    review.checkout_mode,
    review.price_lookup_key,
    review.state,
    review.last_stripe_event_id
  INTO
    v_existing_subject_user_id,
    v_existing_checkout_mode,
    v_existing_price_lookup_key,
    v_existing_state,
    v_existing_stripe_event_id
  FROM public.account_deletion_billing_reviews AS review
  WHERE review.environment = p_environment
    AND review.checkout_intent_id = p_checkout_intent_id
  FOR UPDATE;
  v_has_existing_review := FOUND;

  IF v_has_existing_review AND (
    v_existing_subject_user_id IS DISTINCT FROM p_subject_user_id
    OR v_existing_checkout_mode IS DISTINCT FROM p_checkout_mode
    OR v_existing_price_lookup_key IS DISTINCT FROM p_price_lookup_key
  ) THEN
    RAISE EXCEPTION 'Checkout identity conflict during deletion reconciliation';
  END IF;

  -- Stripe can retry an already-resolved event. It is the same durable fact,
  -- not a new billing event, so preserve the completed operator decision rather
  -- than reopening account deletion forever.
  IF v_has_existing_review
    AND v_existing_state = 'resolved'
    AND v_event_id IS NOT NULL
    AND v_existing_stripe_event_id = v_event_id THEN
    RETURN 'recorded';
  END IF;

  INSERT INTO public.account_deletion_billing_reviews (
    deletion_job_id,
    subject_user_id,
    environment,
    checkout_intent_id,
    checkout_mode,
    price_lookup_key,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_subscription_id,
    stripe_customer_id,
    last_stripe_event_id,
    last_event_type,
    remote_status,
    state,
    resolution_code,
    resolved_by,
    updated_at,
    resolved_at
  )
  VALUES (
    CASE WHEN v_has_job THEN v_job.id ELSE NULL END,
    p_subject_user_id,
    p_environment,
    p_checkout_intent_id,
    p_checkout_mode,
    p_price_lookup_key,
    v_session_id,
    v_payment_intent_id,
    v_subscription_id,
    v_customer_id,
    v_event_id,
    v_event_type,
    v_remote_status,
    'review_required',
    NULL,
    NULL,
    now(),
    NULL
  )
  ON CONFLICT (environment, checkout_intent_id) DO UPDATE
  SET
    deletion_job_id = coalesce(EXCLUDED.deletion_job_id, account_deletion_billing_reviews.deletion_job_id),
    stripe_checkout_session_id = coalesce(EXCLUDED.stripe_checkout_session_id, account_deletion_billing_reviews.stripe_checkout_session_id),
    stripe_payment_intent_id = coalesce(EXCLUDED.stripe_payment_intent_id, account_deletion_billing_reviews.stripe_payment_intent_id),
    stripe_subscription_id = coalesce(EXCLUDED.stripe_subscription_id, account_deletion_billing_reviews.stripe_subscription_id),
    stripe_customer_id = coalesce(EXCLUDED.stripe_customer_id, account_deletion_billing_reviews.stripe_customer_id),
    last_stripe_event_id = coalesce(EXCLUDED.last_stripe_event_id, account_deletion_billing_reviews.last_stripe_event_id),
    last_event_type = coalesce(EXCLUDED.last_event_type, account_deletion_billing_reviews.last_event_type),
    remote_status = coalesce(EXCLUDED.remote_status, account_deletion_billing_reviews.remote_status),
    state = 'review_required',
    resolution_code = NULL,
    resolved_by = NULL,
    resolved_at = NULL,
    updated_at = now();

  IF v_has_job THEN
    -- A deletion has crossed its final database boundary only when this exact
    -- valid lease has recorded Auth removal preparation. A payment that lands
    -- in that tiny external-call window is still a durable manual review, but
    -- it must not clear the in-flight lease: the already-requested deletion
    -- will finish Auth removal and the receipt will become manual_review
    -- immediately afterwards. Every earlier (or expired) state remains a hard
    -- pre-Auth manual-review fence.
    IF v_job.state = 'running'
      AND v_job.auth_removal_state = 'prepared'
      AND v_job.lease_token IS NOT NULL
      AND v_job.lease_token = v_job.auth_removal_lease_token
      AND v_job.lease_expires_at IS NOT NULL
      AND v_job.lease_expires_at > now() THEN
      UPDATE public.account_deletion_jobs
      SET
        billing_reconciliation_state = 'review_required',
        safe_error_code = 'billing_reconciliation_needed',
        completed_at = NULL,
        updated_at = now()
      WHERE id = v_job.id;
    ELSE
      UPDATE public.account_deletion_jobs
      SET
        state = 'manual_review',
        billing_reconciliation_state = 'review_required',
        next_attempt_at = now(),
        lease_token = NULL,
        lease_expires_at = NULL,
        safe_error_code = 'billing_reconciliation_needed',
        completed_at = NULL,
        updated_at = now()
      WHERE id = v_job.id;

      IF v_job.user_id IS NOT NULL THEN
        UPDATE public.account_lifecycle
        SET state = 'manual_review', updated_at = now()
        WHERE user_id = v_job.user_id
          AND state <> 'manual_review';
      END IF;
    END IF;
  END IF;

  RETURN 'recorded';
END;
$function$;

REVOKE ALL ON FUNCTION public.record_account_deletion_billing_review(uuid, text, uuid, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_account_deletion_billing_review(uuid, text, uuid, text, text, text, text, text, text, text, text, text) TO service_role;

-- Stripe Checkout must be bound before its client secret is returned. The
-- deletion helper owns the lifecycle fence and retains a remote Session if it
-- wins the race; the browser then never receives that client secret.
CREATE OR REPLACE FUNCTION public.bind_secure_stripe_checkout_session(
  p_intent_id uuid,
  p_user_id uuid,
  p_environment text,
  p_price_lookup_key text,
  p_checkout_mode text,
  p_session_id text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_intent public.checkout_intents%ROWTYPE;
  v_review_outcome text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_intent_id IS NULL OR p_user_id IS NULL
    OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live')
    OR p_checkout_mode IS NULL OR p_checkout_mode NOT IN ('payment', 'subscription')
    OR length(trim(coalesce(p_price_lookup_key, ''))) = 0
    OR length(trim(coalesce(p_session_id, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid Stripe Checkout binding';
  END IF;

  v_review_outcome := public.record_account_deletion_billing_review(
    p_user_id,
    p_environment,
    p_intent_id,
    p_checkout_mode,
    p_price_lookup_key,
    p_session_id,
    NULL,
    NULL,
    NULL,
    NULL,
    'checkout.session.created',
    'open'
  );
  IF v_review_outcome = 'recorded' THEN
    UPDATE public.checkout_intents
    SET
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_session_id),
      expires_at = coalesce(p_expires_at, expires_at),
      state = 'requires_review',
      updated_at = now()
    WHERE id = p_intent_id
      AND user_id = p_user_id
      AND environment = p_environment;
    RETURN 'account_deletion_pending';
  END IF;
  IF v_review_outcome <> 'no_deletion' THEN
    RAISE EXCEPTION 'Could not determine account lifecycle before binding Stripe Checkout';
  END IF;

  SELECT * INTO v_intent
  FROM public.checkout_intents AS intent
  WHERE intent.id = p_intent_id
    AND intent.user_id = p_user_id
    AND intent.environment = p_environment
  FOR UPDATE;
  IF NOT FOUND
    OR v_intent.checkout_mode <> p_checkout_mode
    OR v_intent.price_lookup_key <> p_price_lookup_key THEN
    RETURN 'not_found';
  END IF;
  IF v_intent.stripe_checkout_session_id IS NOT NULL
    AND v_intent.stripe_checkout_session_id <> p_session_id THEN
    UPDATE public.checkout_intents
    SET state = 'requires_review', updated_at = now()
    WHERE id = v_intent.id
      AND state IN ('creating', 'open', 'awaiting_payment');
    RETURN 'requires_review';
  END IF;

  UPDATE public.checkout_intents
  SET
    stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_session_id),
    expires_at = coalesce(p_expires_at, expires_at),
    state = 'open',
    updated_at = now()
  WHERE id = v_intent.id
    AND state IN ('creating', 'open');

  IF NOT FOUND THEN
    RETURN 'requires_review';
  END IF;
  RETURN 'bound';
END;
$function$;

REVOKE ALL ON FUNCTION public.bind_secure_stripe_checkout_session(uuid, uuid, text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bind_secure_stripe_checkout_session(uuid, uuid, text, text, text, text, timestamptz) TO service_role;

-- New Edge code passes the Stripe-verified lookup key, allowing the durable
-- review to survive even if Auth deletion has already cascaded the local intent.
CREATE OR REPLACE FUNCTION public.record_secure_lifetime_payment_intent_with_reconciliation(
  p_intent_id uuid,
  p_user_id uuid,
  p_environment text,
  p_price_lookup_key text,
  p_session_id text,
  p_payment_intent_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_review_outcome text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_intent_id IS NULL OR p_user_id IS NULL
    OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live')
    OR length(trim(coalesce(p_price_lookup_key, ''))) = 0
    OR length(trim(coalesce(p_session_id, ''))) = 0
    OR length(trim(coalesce(p_payment_intent_id, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid lifetime payment binding';
  END IF;

  v_review_outcome := public.record_account_deletion_billing_review(
    p_user_id,
    p_environment,
    p_intent_id,
    'payment',
    p_price_lookup_key,
    p_session_id,
    p_payment_intent_id,
    NULL,
    NULL,
    NULL,
    'payment_intent.succeeded',
    'paid'
  );
  IF v_review_outcome = 'recorded' THEN
    RETURN 'account_deletion_pending';
  END IF;
  IF v_review_outcome <> 'no_deletion' THEN
    RAISE EXCEPTION 'Could not determine account lifecycle before binding a lifetime payment';
  END IF;

  RETURN public.record_lifetime_payment_intent(
    p_intent_id,
    p_user_id,
    p_environment,
    p_session_id,
    p_payment_intent_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_secure_lifetime_payment_intent_with_reconciliation(uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_secure_lifetime_payment_intent_with_reconciliation(uuid, uuid, text, text, text, text) TO service_role;

-- Keep the existing signature as a compatibility path while the new Edge
-- Function rolls out. It can protect any still-bound checkout, and fails closed
-- rather than acknowledging a payment whose binding has already cascaded away.
CREATE OR REPLACE FUNCTION public.record_secure_lifetime_payment_intent(
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
  v_price_lookup_key text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT intent.price_lookup_key INTO v_price_lookup_key
  FROM public.checkout_intents AS intent
  WHERE intent.id = p_intent_id
    AND intent.user_id = p_user_id
    AND intent.environment = p_environment
    AND intent.checkout_mode = 'payment';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A payment reconciliation-capable Edge Function is required';
  END IF;

  RETURN public.record_secure_lifetime_payment_intent_with_reconciliation(
    p_intent_id,
    p_user_id,
    p_environment,
    v_price_lookup_key,
    p_session_id,
    p_payment_intent_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_secure_lifetime_payment_intent(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_secure_lifetime_payment_intent(uuid, uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_secure_lifetime_entitlement(
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
  v_review_outcome text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_intent_id IS NULL OR p_user_id IS NULL
    OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live')
    OR length(trim(coalesce(p_session_id, ''))) = 0
    OR length(trim(coalesce(p_price_id, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid lifetime entitlement';
  END IF;

  v_review_outcome := public.record_account_deletion_billing_review(
    p_user_id,
    p_environment,
    p_intent_id,
    'payment',
    p_price_id,
    p_session_id,
    NULL,
    NULL,
    p_customer_id,
    NULL,
    'checkout.session.completed',
    'paid'
  );
  IF v_review_outcome = 'recorded' THEN
    RETURN 'account_deletion_pending';
  END IF;
  IF v_review_outcome <> 'no_deletion' THEN
    RAISE EXCEPTION 'Could not determine account lifecycle before granting a lifetime entitlement';
  END IF;

  RETURN public.grant_lifetime_entitlement(
    p_intent_id,
    p_user_id,
    p_environment,
    p_session_id,
    p_customer_id,
    p_product_id,
    p_price_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_secure_lifetime_entitlement(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_secure_lifetime_entitlement(uuid, uuid, text, text, text, text, text) TO service_role;

-- The twelve-argument API carries the already-verified Checkout Session. New
-- Edge code calls this overload; a deletion-time event can be retained without
-- ever writing a subscription entitlement after Auth cascades.
CREATE OR REPLACE FUNCTION public.upsert_secure_stripe_subscription(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_product_id text,
  p_price_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_environment text,
  p_checkout_intent_id uuid,
  p_stripe_checkout_session_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_review_outcome text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL
    OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live')
    OR p_checkout_intent_id IS NULL
    OR length(trim(coalesce(p_stripe_subscription_id, ''))) = 0
    OR length(trim(coalesce(p_stripe_customer_id, ''))) = 0
    OR length(trim(coalesce(p_product_id, ''))) = 0
    OR length(trim(coalesce(p_price_id, ''))) = 0
    OR length(trim(coalesce(p_status, ''))) = 0
    OR length(trim(coalesce(p_stripe_checkout_session_id, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid Stripe subscription entitlement';
  END IF;

  v_review_outcome := public.record_account_deletion_billing_review(
    p_user_id,
    p_environment,
    p_checkout_intent_id,
    'subscription',
    p_price_id,
    p_stripe_checkout_session_id,
    NULL,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    NULL,
    'customer.subscription.updated',
    p_status
  );
  IF v_review_outcome = 'recorded' THEN
    RETURN 'account_deletion_pending';
  END IF;
  IF v_review_outcome <> 'no_deletion' THEN
    RAISE EXCEPTION 'Could not determine account lifecycle before updating a subscription';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Subscription owner is missing without a deletion receipt';
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
    cancel_at_period_end,
    environment,
    updated_at
  )
  VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_product_id,
    p_price_id,
    p_status,
    p_current_period_start,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false),
    p_environment,
    now()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE
  SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    product_id = EXCLUDED.product_id,
    price_id = EXCLUDED.price_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    environment = EXCLUDED.environment,
    updated_at = now();

  RETURN 'upserted';
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_secure_stripe_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_secure_stripe_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, uuid, text) TO service_role;

-- Preserve the ten-argument rollout contract until the new Edge Function is
-- deployed. It forwards a still-bound intent to the reconciliation-capable
-- overload and deliberately retries rather than silently guessing a session.
CREATE OR REPLACE FUNCTION public.upsert_secure_stripe_subscription(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_product_id text,
  p_price_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_environment text
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

  SELECT * INTO v_intent
  FROM public.checkout_intents AS intent
  WHERE intent.user_id = p_user_id
    AND intent.environment = p_environment
    AND intent.checkout_mode = 'subscription'
    AND intent.price_lookup_key = p_price_id
    AND intent.stripe_checkout_session_id IS NOT NULL
  ORDER BY intent.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A subscription reconciliation-capable Edge Function is required';
  END IF;

  RETURN public.upsert_secure_stripe_subscription(
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_product_id,
    p_price_id,
    p_status,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    p_environment,
    v_intent.id,
    v_intent.stripe_checkout_session_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_secure_stripe_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_secure_stripe_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) TO service_role;

-- This is the final transaction before calling Auth. It combines the billing
-- guard with a lease-bound preparation receipt, so a late webhook can safely
-- interrupt the completion receipt without erasing evidence that this worker
-- reached the Auth boundary.
CREATE OR REPLACE FUNCTION public.prepare_account_deletion_auth_removal(
  p_job_id uuid,
  p_lease_token uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_job public.account_deletion_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Invalid account deletion Auth preparation';
  END IF;

  SELECT job.user_id INTO v_user_id
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id;
  IF NOT FOUND OR v_user_id IS NULL THEN
    RETURN 'lease_lost';
  END IF;

  -- Match reconciliation and rescheduling: lifecycle advisory lock,
  -- lifecycle row, then job row.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || v_user_id::text)::bigint
  );
  PERFORM 1
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = v_user_id
    AND lifecycle.state = 'deleting'
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN 'lease_lost';
  END IF;

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_job.user_id IS DISTINCT FROM v_user_id
    OR v_job.state <> 'running'
    OR v_job.lease_token <> p_lease_token
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at <= now()
    OR v_job.auth_removal_state = 'removed' THEN
    RETURN 'lease_lost';
  END IF;

  IF v_job.billing_reconciliation_state <> 'clear' OR EXISTS (
    SELECT 1
    FROM public.account_deletion_billing_reviews AS review
    WHERE review.state = 'review_required'
      AND (
        review.deletion_job_id = v_job.id
        OR review.subject_user_id = v_job.subject_user_id
      )
  ) THEN
    RETURN 'review_required';
  END IF;

  UPDATE public.account_deletion_jobs
  SET
    auth_removal_state = 'prepared',
    auth_removal_lease_token = p_lease_token,
    auth_removal_prepared_at = now(),
    auth_removed_at = NULL,
    updated_at = now()
  WHERE id = v_job.id;

  RETURN 'prepared';
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion_auth_removal(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion_auth_removal(uuid, uuid) TO service_role;

-- Revalidate an existing preparation immediately before the non-transactional
-- Auth call. This prevents a delayed worker from acting after its lease has
-- expired or a pre-Auth webhook has moved the job to reconciliation.
CREATE OR REPLACE FUNCTION public.confirm_account_deletion_auth_removal(
  p_job_id uuid,
  p_lease_token uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_job public.account_deletion_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Invalid account deletion Auth confirmation';
  END IF;

  SELECT job.user_id INTO v_user_id
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id;
  IF NOT FOUND OR v_user_id IS NULL THEN
    RETURN 'lease_lost';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || v_user_id::text)::bigint
  );
  PERFORM 1
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = v_user_id
    AND lifecycle.state = 'deleting'
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN 'lease_lost';
  END IF;

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_job.user_id IS DISTINCT FROM v_user_id
    OR v_job.state <> 'running'
    OR v_job.lease_token <> p_lease_token
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at <= now()
    OR v_job.auth_removal_state <> 'prepared'
    OR v_job.auth_removal_lease_token <> p_lease_token
    OR v_job.auth_removal_prepared_at IS NULL THEN
    RETURN 'lease_lost';
  END IF;

  IF v_job.billing_reconciliation_state <> 'clear' OR EXISTS (
    SELECT 1
    FROM public.account_deletion_billing_reviews AS review
    WHERE review.state = 'review_required'
      AND (
        review.deletion_job_id = v_job.id
        OR review.subject_user_id = v_job.subject_user_id
      )
  ) THEN
    RETURN 'review_required';
  END IF;

  -- Reserve a fresh bounded lease for the immediate non-transactional Auth
  -- call. The worker is itself bounded below this maximum; this prevents a
  -- valid preparation from turning into an expired pre-Auth state between the
  -- confirmation response and the external request.
  UPDATE public.account_deletion_jobs
  SET
    lease_expires_at = now() + make_interval(secs => 300),
    updated_at = now()
  WHERE id = v_job.id
    AND state = 'running'
    AND lease_token = p_lease_token
    AND auth_removal_state = 'prepared'
    AND auth_removal_lease_token = p_lease_token;
  IF NOT FOUND THEN
    RETURN 'lease_lost';
  END IF;

  RETURN 'ready';
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_account_deletion_auth_removal(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_account_deletion_auth_removal(uuid, uuid) TO service_role;

-- Auth's cascade has already removed the lifecycle row by the time this is
-- called. The retained preparation token proves that this exact deletion
-- worker was authorised before the external call; a late billing webhook
-- remains in the durable ledger and is converted to manual_review here.
CREATE OR REPLACE FUNCTION public.record_account_deletion_auth_removed(
  p_job_id uuid,
  p_lease_token uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_subject_user_id uuid;
  v_job public.account_deletion_jobs%ROWTYPE;
  v_review_required boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Invalid account deletion Auth receipt';
  END IF;

  SELECT job.subject_user_id INTO v_subject_user_id
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || v_subject_user_id::text)::bigint
  );

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_job.user_id IS NOT NULL THEN
    RETURN 'auth_still_present';
  END IF;
  IF v_job.auth_removal_state = 'removed'
    AND v_job.auth_removal_lease_token = p_lease_token THEN
    RETURN 'recorded';
  END IF;
  IF v_job.auth_removal_state <> 'prepared'
    OR v_job.auth_removal_lease_token <> p_lease_token THEN
    RETURN 'not_prepared';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.account_deletion_billing_reviews AS review
    WHERE review.state = 'review_required'
      AND (
        review.deletion_job_id = v_job.id
        OR review.subject_user_id = v_job.subject_user_id
      )
  ) INTO v_review_required;

  UPDATE public.account_deletion_jobs
  SET
    auth_removal_state = 'removed',
    auth_removed_at = now(),
    state = CASE WHEN v_review_required THEN 'manual_review' ELSE state END,
    next_attempt_at = CASE WHEN v_review_required THEN now() ELSE next_attempt_at END,
    lease_token = CASE WHEN v_review_required THEN NULL ELSE lease_token END,
    lease_expires_at = CASE WHEN v_review_required THEN NULL ELSE lease_expires_at END,
    safe_error_code = CASE WHEN v_review_required THEN 'billing_reconciliation_needed' ELSE safe_error_code END,
    completed_at = CASE WHEN v_review_required THEN NULL ELSE completed_at END,
    updated_at = now()
  WHERE id = v_job.id;

  RETURN 'recorded';
END;
$function$;

REVOKE ALL ON FUNCTION public.record_account_deletion_auth_removed(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_account_deletion_auth_removed(uuid, uuid) TO service_role;

-- Recheck the non-cascading ledger at the last safe database boundary. It
-- follows the lifecycle -> job lock order used by webhook reconciliation.
CREATE OR REPLACE FUNCTION public.assert_account_deletion_billing_ready(
  p_job_id uuid,
  p_lease_token uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_job public.account_deletion_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Invalid account deletion billing guard';
  END IF;

  SELECT job.user_id INTO v_user_id
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id;
  IF NOT FOUND OR v_user_id IS NULL THEN
    RETURN 'lease_lost';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || v_user_id::text)::bigint
  );
  PERFORM 1
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = v_user_id
    AND lifecycle.state = 'deleting'
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN 'lease_lost';
  END IF;

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_job.user_id IS DISTINCT FROM v_user_id
    OR v_job.state <> 'running'
    OR v_job.lease_token <> p_lease_token
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at <= now() THEN
    RETURN 'lease_lost';
  END IF;

  IF v_job.billing_reconciliation_state <> 'clear' OR EXISTS (
    SELECT 1
    FROM public.account_deletion_billing_reviews AS review
    WHERE review.state = 'review_required'
      AND (
        review.deletion_job_id = v_job.id
        OR review.subject_user_id = v_job.subject_user_id
      )
  ) THEN
    RETURN 'review_required';
  END IF;
  RETURN 'ready';
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_account_deletion_billing_ready(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_account_deletion_billing_ready(uuid, uuid) TO service_role;

-- A support decision is intentionally explicit: resolving a billing record does
-- not restart deletion automatically. The job remains manual_review until the
-- operator has applied the documented refund/cancellation policy.
CREATE OR REPLACE FUNCTION public.resolve_account_deletion_billing_review(
  p_review_id uuid,
  p_resolution_code text,
  p_resolved_by text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_subject_user_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_review_id IS NULL
    OR length(trim(coalesce(p_resolution_code, ''))) = 0
    OR length(trim(coalesce(p_resolution_code, ''))) > 120
    OR length(trim(coalesce(p_resolved_by, ''))) = 0
    OR length(trim(coalesce(p_resolved_by, ''))) > 120 THEN
    RAISE EXCEPTION 'Invalid billing reconciliation resolution';
  END IF;

  SELECT review.subject_user_id INTO v_subject_user_id
  FROM public.account_deletion_billing_reviews AS review
  WHERE review.id = p_review_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || v_subject_user_id::text)::bigint
  );

  UPDATE public.account_deletion_billing_reviews
  SET
    state = 'resolved',
    resolution_code = trim(p_resolution_code),
    resolved_by = trim(p_resolved_by),
    resolved_at = now(),
    updated_at = now()
  WHERE id = p_review_id
    AND subject_user_id = v_subject_user_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.account_deletion_jobs AS job
  SET
    billing_reconciliation_state = 'resolved',
    updated_at = now()
  WHERE job.subject_user_id = v_subject_user_id
    AND job.billing_reconciliation_state = 'review_required'
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_billing_reviews AS review
      WHERE review.subject_user_id = v_subject_user_id
        AND review.state = 'review_required'
    );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_account_deletion_billing_review(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_account_deletion_billing_review(uuid, text, text) TO service_role;

-- A support resolution only records the financial decision. A separate,
-- append-only approval is required before deletion can resume or an already
-- removed account's durable receipt can be sealed. This routine never calls
-- Stripe, Storage, or Auth.
CREATE OR REPLACE FUNCTION public.approve_and_resume_account_deletion_after_billing_review(
  p_job_id uuid,
  p_approval_code text,
  p_approved_by text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_subject_user_id uuid;
  v_lifecycle_state text;
  v_has_lifecycle boolean := false;
  v_job public.account_deletion_jobs%ROWTYPE;
  v_outcome text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL
    OR length(trim(coalesce(p_approval_code, ''))) = 0
    OR length(trim(coalesce(p_approval_code, ''))) > 120
    OR length(trim(coalesce(p_approved_by, ''))) = 0
    OR length(trim(coalesce(p_approved_by, ''))) > 120 THEN
    RAISE EXCEPTION 'Invalid account deletion billing approval';
  END IF;

  SELECT job.subject_user_id INTO v_subject_user_id
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Use the same lifecycle -> job ordering as a Stripe reconciliation so a
  -- new verified event can either reopen review before this approval, or wait
  -- until it can safely reopen the newly-queued job afterwards.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || v_subject_user_id::text)::bigint
  );

  SELECT lifecycle.state INTO v_lifecycle_state
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = v_subject_user_id
  FOR UPDATE;
  v_has_lifecycle := FOUND;

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_billing_reviews AS review
    WHERE review.state = 'review_required'
      AND (
        review.deletion_job_id = v_job.id
        OR review.subject_user_id = v_job.subject_user_id
      )
  ) THEN
    RETURN 'review_required';
  END IF;

  IF v_job.state <> 'manual_review'
    OR v_job.billing_reconciliation_state <> 'resolved'
    OR v_job.lease_token IS NOT NULL
    OR v_job.lease_expires_at IS NOT NULL THEN
    RETURN 'not_eligible';
  END IF;

  IF v_job.user_id IS NULL THEN
    -- A successful Auth call can time out before its follow-up database
    -- receipt. A prepared marker has already proved this worker completed all
    -- confidential-data cleanup before the external boundary; with Auth now
    -- absent, an explicit, recorded support approval may recover that
    -- acknowledgement gap. A missing/invalid marker remains fail-closed.
    IF NOT (
      (v_job.auth_removal_state = 'removed' AND v_job.auth_removed_at IS NOT NULL)
      OR (
        v_job.auth_removal_state = 'prepared'
        AND v_job.auth_removal_prepared_at IS NOT NULL
        AND v_job.auth_removal_lease_token IS NOT NULL
      )
    ) THEN
      RETURN 'auth_deleted_recovery_required';
    END IF;
    v_outcome := 'completed';
  ELSE
    IF v_job.user_id IS DISTINCT FROM v_job.subject_user_id
      OR NOT v_has_lifecycle
      OR v_lifecycle_state <> 'manual_review' THEN
      RETURN 'not_eligible';
    END IF;
    v_outcome := 'queued';
  END IF;

  INSERT INTO public.account_deletion_billing_approvals (
    deletion_job_id,
    subject_user_id,
    approval_code,
    approved_by,
    outcome
  )
  VALUES (
    v_job.id,
    v_job.subject_user_id,
    trim(p_approval_code),
    trim(p_approved_by),
    v_outcome
  );

  IF v_outcome = 'completed' THEN
    UPDATE public.account_deletion_jobs
    SET
      state = 'completed',
      billing_reconciliation_state = 'clear',
      next_attempt_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      safe_error_code = NULL,
      completed_at = now(),
      auth_removal_state = 'removed',
      auth_removed_at = coalesce(auth_removed_at, now()),
      updated_at = now()
    WHERE id = v_job.id;
    RETURN 'completed';
  END IF;

  UPDATE public.account_lifecycle
  SET state = 'deleting', updated_at = now()
  WHERE user_id = v_job.user_id
    AND state = 'manual_review';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not resume account deletion lifecycle';
  END IF;

  UPDATE public.account_deletion_jobs
  SET
    state = 'queued',
    billing_reconciliation_state = 'clear',
    next_attempt_at = now(),
    lease_token = NULL,
    lease_expires_at = NULL,
    safe_error_code = NULL,
    completed_at = NULL,
    auth_removal_state = 'not_started',
    auth_removal_lease_token = NULL,
    auth_removal_prepared_at = NULL,
    auth_removed_at = NULL,
    updated_at = now()
  WHERE id = v_job.id;

  RETURN 'queued';
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_and_resume_account_deletion_after_billing_review(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_and_resume_account_deletion_after_billing_review(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_account_deletion_job(
  p_job_id uuid,
  p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE public.account_deletion_jobs AS job
  SET
    state = 'completed',
    lease_token = NULL,
    lease_expires_at = NULL,
    safe_error_code = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE job.id = p_job_id
    AND job.state = 'running'
    AND job.lease_token = p_lease_token
    AND job.user_id IS NULL
    AND job.auth_removal_state = 'removed'
    AND job.auth_removed_at IS NOT NULL
    AND job.billing_reconciliation_state = 'clear'
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_billing_reviews AS review
      WHERE review.state = 'review_required'
        AND (
          review.deletion_job_id = job.id
          OR review.subject_user_id = job.subject_user_id
        )
    );

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_account_deletion_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_account_deletion_job(uuid, uuid) TO service_role;
