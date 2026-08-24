import type {
  Payslip,
  PayslipFieldEvidence,
  PayslipLineItem,
  PayslipYearToDate,
} from './types';

type ExtractionDetails = Pick<
  Payslip,
  | 'currency'
  | 'extraction_confidence'
  | 'extraction_line_items'
  | 'extraction_field_evidence'
  | 'year_to_date'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && Math.abs(numericValue) <= 10_000_000 ? numericValue : null;
}

function extractionConfidence(value: unknown): Payslip['extraction_confidence'] {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  const score = Number(value);
  if (!Number.isFinite(score)) return undefined;
  return score >= 0.85 ? 'high' : score >= 0.6 ? 'medium' : 'low';
}

function parseYearToDate(value: unknown): PayslipYearToDate | undefined {
  if (!isRecord(value)) return undefined;
  return {
    gross_pay: boundedMoney(value.gross_pay),
    tax: boundedMoney(value.tax),
    ni: boundedMoney(value.ni),
    pension: boundedMoney(value.pension),
  };
}

function parseLineItems(value: unknown): PayslipLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): PayslipLineItem[] => {
    if (!isRecord(candidate) || typeof candidate.label !== 'string') return [];
    const kind = candidate.kind;
    if (kind !== 'earning' && kind !== 'deduction' && kind !== 'employer_contribution' && kind !== 'information') return [];
    const label = candidate.label.trim();
    if (!label || label.length > 120) return [];
    const evidence = typeof candidate.evidence === 'string' ? candidate.evidence.trim().slice(0, 300) : null;
    return [{
      label,
      kind,
      amount: boundedMoney(candidate.amount),
      year_to_date_amount: boundedMoney(candidate.year_to_date_amount),
      evidence: evidence || null,
      confidence: candidate.confidence === 'high' || candidate.confidence === 'medium' || candidate.confidence === 'low'
        ? candidate.confidence
        : 'low',
    }];
  }).slice(0, 60);
}

function parseFieldEvidence(value: unknown): PayslipFieldEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): PayslipFieldEvidence[] => {
    if (!isRecord(candidate) || typeof candidate.field !== 'string') return [];
    const field = candidate.field.trim();
    if (!field || field.length > 80) return [];
    const evidence = typeof candidate.evidence === 'string' ? candidate.evidence.trim().slice(0, 300) : null;
    return [{
      field,
      evidence: evidence || null,
      confidence: candidate.confidence === 'high' || candidate.confidence === 'medium' || candidate.confidence === 'low'
        ? candidate.confidence
        : 'low',
    }];
  }).slice(0, 40);
}

/**
 * Hydrates the optional extraction transcript at the client boundary. The
 * detail view and the initial review use the same bounded representation so
 * a provider response cannot turn into arbitrary UI content.
 */
export function normalizeExtractionDetails(extraction: unknown): ExtractionDetails {
  const row = isRecord(extraction) ? extraction : {};
  const normalized = isRecord(row.normalized_json) ? row.normalized_json : {};

  return {
    currency: normalized.currency === 'GBP' || normalized.currency === 'EUR' ? normalized.currency : undefined,
    extraction_confidence: extractionConfidence(normalized.confidence ?? row.confidence_score),
    extraction_line_items: parseLineItems(normalized.line_items),
    extraction_field_evidence: parseFieldEvidence(normalized.field_evidence),
    year_to_date: parseYearToDate(row.year_to_date_json ?? normalized.year_to_date),
  };
}
