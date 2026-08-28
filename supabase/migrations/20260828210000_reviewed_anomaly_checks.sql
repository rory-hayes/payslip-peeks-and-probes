-- Issue checks are derived from a person's reviewed figures, never from the
-- provider transcript that precedes confirmation. A revision fence lets the
-- web client hide stale results while a new reviewed check is pending and
-- lets the Edge Function replace the complete result set atomically.

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS review_checks_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_checks_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_checks_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_checks_failure_code text;

ALTER TABLE public.payslips
  DROP CONSTRAINT IF EXISTS payslips_review_checks_status_check;
ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_review_checks_status_check
  CHECK (review_checks_status IN ('pending', 'complete', 'failed'));

ALTER TABLE public.payslips
  DROP CONSTRAINT IF EXISTS payslips_review_checks_revision_check;
ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_review_checks_revision_check
  CHECK (review_checks_revision >= 0);

ALTER TABLE public.anomaly_results
  ADD COLUMN IF NOT EXISTS review_checks_revision integer NOT NULL DEFAULT 0;

ALTER TABLE public.anomaly_results
  DROP CONSTRAINT IF EXISTS anomaly_results_review_checks_revision_check;
ALTER TABLE public.anomaly_results
  ADD CONSTRAINT anomaly_results_review_checks_revision_check
  CHECK (review_checks_revision >= 0);

-- A 5% default is now a product-owned guardrail instead of a technical setup
-- choice. Existing hidden custom values are normalized so the UI and service
-- cannot silently disagree about how sensitive reviewed comparisons are.
UPDATE public.profiles
SET anomaly_threshold_percent = 5
WHERE anomaly_threshold_percent IS DISTINCT FROM 5;

-- Existing completed payslips may have issue rows derived before review. Keep
-- those rows for now, but fence them off with a newer payslip revision until a
-- successful reviewed refresh atomically replaces them.
UPDATE public.payslips
SET
  review_checks_status = 'pending',
  review_checks_revision = greatest(review_checks_revision, 0) + 1,
  review_checks_updated_at = NULL,
  review_checks_failure_code = NULL
WHERE status = 'completed';

CREATE OR REPLACE FUNCTION public.prepare_reviewed_payslip_checks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.review_checks_status := 'pending';
    NEW.review_checks_revision := OLD.review_checks_revision + 1;
    NEW.review_checks_updated_at := NULL;
    NEW.review_checks_failure_code := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prepare_reviewed_payslip_checks_before_confirmation ON public.payslips;
CREATE TRIGGER prepare_reviewed_payslip_checks_before_confirmation
BEFORE UPDATE OF status ON public.payslips
FOR EACH ROW
EXECUTE FUNCTION public.prepare_reviewed_payslip_checks();

CREATE OR REPLACE FUNCTION public.replace_reviewed_payslip_anomalies(
  p_payslip_id uuid,
  p_user_id uuid,
  p_review_checks_revision integer,
  p_anomalies jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  locked_payslip_id uuid;
  candidate jsonb;
  candidate_type text;
  candidate_severity text;
  candidate_confidence text;
  candidate_title text;
  candidate_description text;
  candidate_action text;
  inserted_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the reviewed check service may replace issue results';
  END IF;

  IF p_review_checks_revision IS NULL OR p_review_checks_revision < 1 THEN
    RAISE EXCEPTION 'A valid reviewed check revision is required';
  END IF;

  IF jsonb_typeof(p_anomalies) <> 'array' OR jsonb_array_length(p_anomalies) > 40 THEN
    RAISE EXCEPTION 'Reviewed issue results must be an array of 40 items or fewer';
  END IF;

  SELECT id
  INTO locked_payslip_id
  FROM public.payslips
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'completed'
    AND review_checks_revision = p_review_checks_revision
  FOR UPDATE;

  IF locked_payslip_id IS NULL THEN
    RAISE EXCEPTION 'The reviewed payslip changed before its checks were saved';
  END IF;

  CREATE TEMP TABLE reviewed_anomaly_rows (
    anomaly_type text NOT NULL,
    severity text NOT NULL,
    confidence text NOT NULL,
    title text NOT NULL,
    description text,
    suggested_action text
  ) ON COMMIT DROP;

  FOR candidate IN SELECT value FROM jsonb_array_elements(p_anomalies)
  LOOP
    IF jsonb_typeof(candidate) <> 'object'
      OR coalesce(jsonb_typeof(candidate -> 'anomaly_type'), 'missing') <> 'string'
      OR coalesce(jsonb_typeof(candidate -> 'severity'), 'missing') <> 'string'
      OR coalesce(jsonb_typeof(candidate -> 'confidence'), 'missing') <> 'string'
      OR coalesce(jsonb_typeof(candidate -> 'title'), 'missing') <> 'string'
      OR coalesce(jsonb_typeof(candidate -> 'description'), 'missing') <> 'string'
      OR coalesce(jsonb_typeof(candidate -> 'suggested_action'), 'missing') <> 'string' THEN
      RAISE EXCEPTION 'Every reviewed issue result must use the expected fields';
    END IF;

    candidate_type := btrim(candidate ->> 'anomaly_type');
    candidate_severity := candidate ->> 'severity';
    candidate_confidence := candidate ->> 'confidence';
    candidate_title := btrim(candidate ->> 'title');
    candidate_description := btrim(candidate ->> 'description');
    candidate_action := btrim(candidate ->> 'suggested_action');

    IF candidate_type = '' OR char_length(candidate_type) > 80
      OR candidate_severity NOT IN ('low', 'medium', 'high')
      OR candidate_confidence NOT IN ('low', 'medium', 'high')
      OR candidate_title = '' OR char_length(candidate_title) > 180
      OR char_length(candidate_description) > 2400
      OR char_length(candidate_action) > 1200 THEN
      RAISE EXCEPTION 'A reviewed issue result is outside the allowed bounds';
    END IF;

    INSERT INTO reviewed_anomaly_rows (
      anomaly_type, severity, confidence, title, description, suggested_action
    ) VALUES (
      candidate_type,
      candidate_severity,
      candidate_confidence,
      candidate_title,
      nullif(candidate_description, ''),
      nullif(candidate_action, '')
    );
  END LOOP;

  -- Preserve anything the person wrote against an older derived result. The
  -- note remains attached to the payslip when its obsolete anomaly is replaced.
  UPDATE public.user_notes
  SET
    payslip_id = coalesce(payslip_id, locked_payslip_id),
    anomaly_id = NULL
  WHERE anomaly_id IN (
    SELECT id
    FROM public.anomaly_results
    WHERE payslip_id = locked_payslip_id
  );

  DELETE FROM public.anomaly_results
  WHERE payslip_id = locked_payslip_id;

  INSERT INTO public.anomaly_results (
    payslip_id,
    review_checks_revision,
    anomaly_type,
    severity,
    confidence,
    title,
    description,
    suggested_action,
    status
  )
  SELECT
    locked_payslip_id,
    p_review_checks_revision,
    anomaly_type,
    severity,
    confidence,
    title,
    description,
    suggested_action,
    'new'
  FROM reviewed_anomaly_rows;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.payslips
  SET
    review_checks_status = 'complete',
    review_checks_updated_at = now(),
    review_checks_failure_code = NULL
  WHERE id = locked_payslip_id;

  RETURN inserted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_reviewed_payslip_anomalies(uuid, uuid, integer, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_reviewed_payslip_anomalies(uuid, uuid, integer, jsonb) TO service_role;

CREATE INDEX IF NOT EXISTS anomaly_results_review_revision_idx
  ON public.anomaly_results (payslip_id, review_checks_revision);
