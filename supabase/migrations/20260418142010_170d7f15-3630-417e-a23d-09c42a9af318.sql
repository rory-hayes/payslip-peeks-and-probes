-- Restrict has_active_subscription to self-checks only
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and user_uuid = auth.uid()
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon;

-- Add explicit service-role INSERT policy on anomaly_results to make intent clear
CREATE POLICY "Service role can insert anomalies"
ON public.anomaly_results
FOR INSERT
WITH CHECK (auth.role() = 'service_role');