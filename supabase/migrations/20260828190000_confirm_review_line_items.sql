-- A confirmed history must contain the account owner's reviewed earnings and
-- deduction rows, not an immutable provider transcript. Keep older clients
-- compatible by preserving the extracted rows when p_line_items is omitted.
DROP FUNCTION IF EXISTS public.confirm_payslip_review(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
);

CREATE OR REPLACE FUNCTION public.confirm_payslip_review(
  p_payslip_id uuid,
  p_pay_date date,
  p_gross_pay numeric,
  p_net_pay numeric,
  p_tax_amount numeric,
  p_national_insurance_amount numeric,
  p_prsi_amount numeric,
  p_usc_amount numeric,
  p_pension_amount numeric,
  p_total_deductions numeric,
  p_country text DEFAULT NULL,
  p_line_items jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  confirmed_payslip_id uuid;
  existing_normalized_json jsonb;
  sanitized_line_items jsonb := '[]'::jsonb;
  candidate_line_item jsonb;
  original_line_item jsonb;
  reviewed_label text;
  reviewed_kind text;
  reviewed_amount numeric;
  reviewed_year_to_date_amount numeric;
  original_evidence text;
  original_confidence text;
  source_index integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_country IS NOT NULL AND p_country NOT IN ('UK', 'Ireland') THEN
    RAISE EXCEPTION 'A reviewed payslip country must be UK or Ireland';
  END IF;

  IF p_pay_date IS NULL
    OR p_gross_pay IS NULL OR p_gross_pay = 'NaN'::numeric OR p_gross_pay <= 0
    OR p_net_pay IS NULL OR p_net_pay = 'NaN'::numeric OR p_net_pay <= 0 THEN
    RAISE EXCEPTION 'A pay date, gross pay, and net pay are required';
  END IF;

  IF coalesce(p_tax_amount, 0) = 'NaN'::numeric
    OR coalesce(p_national_insurance_amount, 0) = 'NaN'::numeric
    OR coalesce(p_prsi_amount, 0) = 'NaN'::numeric
    OR coalesce(p_usc_amount, 0) = 'NaN'::numeric
    OR coalesce(p_pension_amount, 0) = 'NaN'::numeric
    OR coalesce(p_total_deductions, 0) = 'NaN'::numeric
    OR coalesce(p_tax_amount, 0) < 0
    OR coalesce(p_national_insurance_amount, 0) < 0
    OR coalesce(p_prsi_amount, 0) < 0
    OR coalesce(p_usc_amount, 0) < 0
    OR coalesce(p_pension_amount, 0) < 0
    OR coalesce(p_total_deductions, 0) < 0 THEN
    RAISE EXCEPTION 'Deduction amounts must be valid, non-negative numbers';
  END IF;

  IF p_line_items IS NOT NULL THEN
    IF jsonb_typeof(p_line_items) <> 'array' THEN
      RAISE EXCEPTION 'Reviewed line items must be an array';
    END IF;
    IF jsonb_array_length(p_line_items) > 60 THEN
      RAISE EXCEPTION 'Reviewed line items must contain 60 rows or fewer';
    END IF;
  END IF;

  PERFORM set_config('payslip_insights.confirming_review', 'true', true);

  UPDATE public.payslips
  SET
    pay_date = p_pay_date,
    country = coalesce(p_country, country),
    status = 'completed'
  WHERE id = p_payslip_id
    AND user_id = auth.uid()
    AND status = 'needs_review'
  RETURNING id INTO confirmed_payslip_id;

  IF confirmed_payslip_id IS NULL THEN
    RAISE EXCEPTION 'Only your own payslip awaiting review can be confirmed';
  END IF;

  SELECT normalized_json
  INTO existing_normalized_json
  FROM public.payslip_extractions
  WHERE payslip_id = confirmed_payslip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No extraction exists for this payslip';
  END IF;

  IF p_line_items IS NOT NULL THEN
    FOR candidate_line_item IN
      SELECT value FROM jsonb_array_elements(p_line_items)
    LOOP
      IF jsonb_typeof(candidate_line_item) <> 'object'
        OR coalesce(jsonb_typeof(candidate_line_item -> 'label'), 'missing') <> 'string'
        OR coalesce(jsonb_typeof(candidate_line_item -> 'kind'), 'missing') <> 'string'
        OR coalesce(jsonb_typeof(candidate_line_item -> 'amount'), 'missing') NOT IN ('number', 'null')
        OR coalesce(jsonb_typeof(candidate_line_item -> 'year_to_date_amount'), 'missing') NOT IN ('number', 'null') THEN
        RAISE EXCEPTION 'Every reviewed line item must use the expected fields';
      END IF;

      reviewed_label := btrim(candidate_line_item ->> 'label');
      reviewed_kind := candidate_line_item ->> 'kind';
      reviewed_amount := CASE WHEN jsonb_typeof(candidate_line_item -> 'amount') = 'number'
        THEN (candidate_line_item ->> 'amount')::numeric ELSE NULL END;
      reviewed_year_to_date_amount := CASE WHEN jsonb_typeof(candidate_line_item -> 'year_to_date_amount') = 'number'
        THEN (candidate_line_item ->> 'year_to_date_amount')::numeric ELSE NULL END;

      IF reviewed_label = '' OR char_length(reviewed_label) > 120 THEN
        RAISE EXCEPTION 'A reviewed line item description must contain 1 to 120 characters';
      END IF;

      IF reviewed_kind NOT IN ('earning', 'deduction', 'employer_contribution', 'information') THEN
        RAISE EXCEPTION 'A reviewed line item type is not supported';
      END IF;

      IF (reviewed_amount IS NOT NULL AND (reviewed_amount < 0 OR reviewed_amount > 10000000))
        OR (reviewed_year_to_date_amount IS NOT NULL
          AND (reviewed_year_to_date_amount < 0 OR reviewed_year_to_date_amount > 10000000)) THEN
        RAISE EXCEPTION 'Reviewed line item amounts must be between 0 and 10,000,000';
      END IF;

      IF NOT candidate_line_item ? 'source_index'
        OR jsonb_typeof(candidate_line_item -> 'source_index') = 'null' THEN
        source_index := NULL;
      ELSIF jsonb_typeof(candidate_line_item -> 'source_index') = 'number'
        AND (candidate_line_item ->> 'source_index') ~ '^[0-9]{1,2}$'
        AND (candidate_line_item ->> 'source_index')::integer < 60 THEN
        source_index := (candidate_line_item ->> 'source_index')::integer;
      ELSE
        RAISE EXCEPTION 'A reviewed line item source reference is not valid';
      END IF;

      original_line_item := NULL;
      IF source_index IS NOT NULL
        AND jsonb_typeof(existing_normalized_json -> 'line_items') = 'array'
        AND jsonb_array_length(existing_normalized_json -> 'line_items') > source_index THEN
        original_line_item := existing_normalized_json -> 'line_items' -> source_index;
      END IF;

      original_evidence := CASE
        WHEN jsonb_typeof(original_line_item -> 'evidence') = 'string'
          AND char_length(original_line_item ->> 'evidence') <= 300
        THEN original_line_item ->> 'evidence'
        ELSE NULL
      END;
      original_confidence := CASE
        WHEN original_line_item ->> 'confidence' IN ('high', 'medium', 'low')
        THEN original_line_item ->> 'confidence'
        ELSE 'low'
      END;

      sanitized_line_items := sanitized_line_items || jsonb_build_array(jsonb_build_object(
        'label', reviewed_label,
        'kind', reviewed_kind,
        'amount', reviewed_amount,
        'year_to_date_amount', reviewed_year_to_date_amount,
        'evidence', original_evidence,
        'confidence', original_confidence,
        'reviewed', true
      ));
    END LOOP;
  END IF;

  UPDATE public.payslip_extractions
  SET
    gross_pay = p_gross_pay,
    net_pay = p_net_pay,
    tax_amount = p_tax_amount,
    national_insurance_amount = p_national_insurance_amount,
    prsi_amount = p_prsi_amount,
    usc_amount = p_usc_amount,
    pension_amount = p_pension_amount,
    total_deductions = p_total_deductions,
    normalized_json = CASE
      WHEN p_line_items IS NULL THEN normalized_json
      ELSE jsonb_set(
        CASE WHEN jsonb_typeof(normalized_json) = 'object' THEN normalized_json ELSE '{}'::jsonb END,
        '{line_items}',
        sanitized_line_items,
        true
      )
    END,
    extraction_status = 'completed'
  WHERE payslip_id = confirmed_payslip_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_payslip_review(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payslip_review(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb
) TO authenticated;
