-- Extend the owner-confirmation boundary to the cumulative figures and
-- non-identifying payroll context shown beside detailed pay rows. The prior
-- function becomes an internal core so its line-item checks remain the single
-- authoritative implementation.
ALTER FUNCTION public.confirm_payslip_review(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb
) RENAME TO confirm_payslip_review_core;

REVOKE ALL ON FUNCTION public.confirm_payslip_review_core(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb
) FROM PUBLIC, authenticated;

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
  p_line_items jsonb DEFAULT NULL,
  p_year_to_date jsonb DEFAULT NULL,
  p_document_context jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  reviewed_gross_ytd numeric;
  reviewed_tax_ytd numeric;
  reviewed_ni_ytd numeric;
  reviewed_pension_ytd numeric;
  reviewed_tax_code text;
  reviewed_ni_category text;
  reviewed_prsi_class text;
  reviewed_pay_frequency text;
  reviewed_pay_basis text;
  sanitized_year_to_date jsonb;
  sanitized_document_context jsonb;
  updated_normalized_json jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_year_to_date IS NOT NULL THEN
    IF jsonb_typeof(p_year_to_date) <> 'object'
      OR coalesce(jsonb_typeof(p_year_to_date -> 'gross_pay'), 'missing') NOT IN ('number', 'null')
      OR coalesce(jsonb_typeof(p_year_to_date -> 'tax'), 'missing') NOT IN ('number', 'null')
      OR coalesce(jsonb_typeof(p_year_to_date -> 'ni'), 'missing') NOT IN ('number', 'null')
      OR coalesce(jsonb_typeof(p_year_to_date -> 'pension'), 'missing') NOT IN ('number', 'null') THEN
      RAISE EXCEPTION 'Reviewed year-to-date values must use the expected fields';
    END IF;

    reviewed_gross_ytd := CASE WHEN jsonb_typeof(p_year_to_date -> 'gross_pay') = 'number'
      THEN (p_year_to_date ->> 'gross_pay')::numeric ELSE NULL END;
    reviewed_tax_ytd := CASE WHEN jsonb_typeof(p_year_to_date -> 'tax') = 'number'
      THEN (p_year_to_date ->> 'tax')::numeric ELSE NULL END;
    reviewed_ni_ytd := CASE WHEN jsonb_typeof(p_year_to_date -> 'ni') = 'number'
      THEN (p_year_to_date ->> 'ni')::numeric ELSE NULL END;
    reviewed_pension_ytd := CASE WHEN jsonb_typeof(p_year_to_date -> 'pension') = 'number'
      THEN (p_year_to_date ->> 'pension')::numeric ELSE NULL END;

    IF (reviewed_gross_ytd IS NOT NULL AND (reviewed_gross_ytd < 0 OR reviewed_gross_ytd > 10000000))
      OR (reviewed_tax_ytd IS NOT NULL AND (reviewed_tax_ytd < 0 OR reviewed_tax_ytd > 10000000))
      OR (reviewed_ni_ytd IS NOT NULL AND (reviewed_ni_ytd < 0 OR reviewed_ni_ytd > 10000000))
      OR (reviewed_pension_ytd IS NOT NULL AND (reviewed_pension_ytd < 0 OR reviewed_pension_ytd > 10000000)) THEN
      RAISE EXCEPTION 'Reviewed year-to-date amounts must be between 0 and 10,000,000';
    END IF;

    sanitized_year_to_date := jsonb_build_object(
      'gross_pay', reviewed_gross_ytd,
      'tax', reviewed_tax_ytd,
      'ni', reviewed_ni_ytd,
      'pension', reviewed_pension_ytd
    );
  END IF;

  IF p_document_context IS NOT NULL THEN
    IF jsonb_typeof(p_document_context) <> 'object'
      OR coalesce(jsonb_typeof(p_document_context -> 'tax_code'), 'missing') NOT IN ('string', 'null')
      OR coalesce(jsonb_typeof(p_document_context -> 'national_insurance_category'), 'missing') NOT IN ('string', 'null')
      OR coalesce(jsonb_typeof(p_document_context -> 'prsi_class'), 'missing') NOT IN ('string', 'null')
      OR coalesce(jsonb_typeof(p_document_context -> 'pay_frequency'), 'missing') NOT IN ('string', 'null')
      OR coalesce(jsonb_typeof(p_document_context -> 'pay_basis'), 'missing') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Reviewed payroll context must use the expected fields';
    END IF;

    reviewed_tax_code := nullif(btrim(p_document_context ->> 'tax_code'), '');
    reviewed_ni_category := nullif(btrim(p_document_context ->> 'national_insurance_category'), '');
    reviewed_prsi_class := nullif(btrim(p_document_context ->> 'prsi_class'), '');
    reviewed_pay_frequency := nullif(p_document_context ->> 'pay_frequency', '');
    reviewed_pay_basis := nullif(btrim(p_document_context ->> 'pay_basis'), '');

    IF char_length(coalesce(reviewed_tax_code, '')) > 40
      OR char_length(coalesce(reviewed_ni_category, '')) > 20
      OR char_length(coalesce(reviewed_prsi_class, '')) > 20
      OR char_length(coalesce(reviewed_pay_basis, '')) > 40 THEN
      RAISE EXCEPTION 'Reviewed payroll context contains an overlong value';
    END IF;

    IF reviewed_pay_frequency IS NOT NULL
      AND reviewed_pay_frequency NOT IN ('weekly', 'fortnightly', 'four_weekly', 'monthly', 'annual', 'other') THEN
      RAISE EXCEPTION 'Reviewed pay frequency is not supported';
    END IF;

    sanitized_document_context := jsonb_build_object(
      'tax_code', reviewed_tax_code,
      'national_insurance_category', reviewed_ni_category,
      'prsi_class', reviewed_prsi_class,
      'pay_frequency', reviewed_pay_frequency,
      'pay_basis', reviewed_pay_basis
    );
  END IF;

  PERFORM public.confirm_payslip_review_core(
    p_payslip_id,
    p_pay_date,
    p_gross_pay,
    p_net_pay,
    p_tax_amount,
    p_national_insurance_amount,
    p_prsi_amount,
    p_usc_amount,
    p_pension_amount,
    p_total_deductions,
    p_country,
    p_line_items
  );

  SELECT CASE
    WHEN jsonb_typeof(normalized_json) = 'object' THEN normalized_json
    ELSE '{}'::jsonb
  END
  INTO updated_normalized_json
  FROM public.payslip_extractions
  WHERE payslip_id = p_payslip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No extraction exists for this payslip';
  END IF;

  IF p_year_to_date IS NOT NULL THEN
    updated_normalized_json := jsonb_set(
      jsonb_set(updated_normalized_json, '{year_to_date}', sanitized_year_to_date, true),
      '{year_to_date_reviewed}',
      'true'::jsonb,
      true
    );
  END IF;

  IF p_document_context IS NOT NULL THEN
    updated_normalized_json := jsonb_set(
      jsonb_set(updated_normalized_json, '{document_context}', sanitized_document_context, true),
      '{document_context_reviewed}',
      'true'::jsonb,
      true
    );
  END IF;

  UPDATE public.payslip_extractions
  SET
    year_to_date_json = CASE
      WHEN p_year_to_date IS NULL THEN year_to_date_json
      ELSE sanitized_year_to_date
    END,
    normalized_json = updated_normalized_json
  WHERE payslip_id = p_payslip_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_payslip_review(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payslip_review(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb, jsonb
) TO authenticated;
