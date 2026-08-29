-- Supabase/Lovable may retain explicit EXECUTE grants for anon and
-- authenticated when a SECURITY DEFINER function is replaced. `REVOKE FROM
-- PUBLIC` does not remove those role-specific grants, so reassert the exact
-- service-only boundary after every reviewed server RPC has been created.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $migration$
DECLARE
  service_function record;
  service_function_names constant text[] := ARRAY[
    'acquire_checkout_intent',
    'acquire_secure_checkout_intent',
    'activate_secure_payslip_original_link_lease',
    'approve_and_resume_account_deletion_after_billing_review',
    'assert_account_deletion_billing_ready',
    'begin_account_deletion_request',
    'begin_payslip_upload_session',
    'begin_secure_payslip_upload_session',
    'bind_secure_stripe_checkout_session',
    'claim_account_deletion_job',
    'claim_payslip_processing',
    'complete_account_deletion_job',
    'complete_payslip_upload_session_expiry',
    'confirm_account_deletion_auth_removal',
    'consume_rate_limit',
    'create_issue_draft',
    'delete_failed_payslip_after_storage_cleanup',
    'drain_secure_account_deletion_processing',
    'fail_payslip_processing',
    'finalize_payslip_upload_session',
    'finalize_secure_payslip_upload_session',
    'grant_lifetime_entitlement',
    'grant_secure_lifetime_entitlement',
    'is_account_lifecycle_active',
    'list_expired_payslip_upload_sessions',
    'list_expired_secure_failed_payslip_cleanups_without_session',
    'list_expired_secure_payslip_upload_sessions',
    'mark_payslip_provider_started',
    'mark_secure_payslip_provider_started',
    'prepare_account_deletion_auth_removal',
    'prune_expired_payslip_original_link_leases',
    'record_account_deletion_auth_removed',
    'record_account_deletion_billing_review',
    'record_lifetime_payment_intent',
    'record_secure_lifetime_payment_intent',
    'record_secure_lifetime_payment_intent_with_reconciliation',
    'renew_account_deletion_job_lease',
    'replace_reviewed_payslip_anomalies',
    'request_failed_payslip_cleanup',
    'request_payslip_upload_session_cleanup',
    'reschedule_account_deletion_job',
    'reserve_and_claim_payslip_processing',
    'reserve_and_claim_secure_payslip_processing',
    'reserve_secure_payslip_original_link_lease',
    'resolve_account_deletion_billing_review',
    'revoke_lifetime_entitlement',
    'settle_expired_secure_payslip_upload_session',
    'upsert_secure_stripe_subscription'
  ];
BEGIN
  FOR service_function IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = ANY(service_function_names)
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      service_function.schema_name,
      service_function.function_name,
      service_function.identity_arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      service_function.schema_name,
      service_function.function_name,
      service_function.identity_arguments
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = ANY(service_function_names)
      AND (
        has_function_privilege('anon', procedure.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'A service-only Payslip Insights RPC is still callable by a browser role';
  END IF;
END
$migration$;
