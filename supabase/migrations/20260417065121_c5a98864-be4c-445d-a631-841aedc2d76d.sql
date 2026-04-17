
-- 1. Add anomaly threshold % to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS anomaly_threshold_percent numeric NOT NULL DEFAULT 5
  CHECK (anomaly_threshold_percent >= 0 AND anomaly_threshold_percent <= 100);

-- 2. Cookie consent + verify-email dismissal can live client-side; nothing needed.

-- 3. Rate limits table for edge function throttling
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_bucket_window_idx
  ON public.rate_limits (bucket_key, window_start);

CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx
  ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write rate limit data; users never see this table.
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limits;
CREATE POLICY "Service role manages rate limits"
  ON public.rate_limits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
