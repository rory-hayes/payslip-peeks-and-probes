import { describe, expect, it } from 'vitest';
import {
  buildTaxReviewDocumentList,
  buildTaxReviewPlanText,
  CURRENT_TAX_STEPS,
  isDateInTaxYear,
  OFFICIAL_TAX_STEPS,
  TAX_REVIEW_TOPICS,
  taxReviewTiming,
  taxYearWindow,
} from './tax-helper';

describe('tax year helper', () => {
  it('uses a calendar year for Ireland', () => {
    const window = taxYearWindow('Ireland', new Date('2026-08-28T12:00:00Z'));
    expect(window.label).toBe('2026');
    expect(isDateInTaxYear('2026-01-01', window)).toBe(true);
    expect(isDateInTaxYear('2025-12-31', window)).toBe(false);
  });

  it('uses the 6 April boundary for the UK', () => {
    const current = taxYearWindow('UK', new Date('2026-08-28T12:00:00Z'));
    expect(current.label).toBe('2026/27');
    expect(isDateInTaxYear('2026-04-06', current)).toBe(true);
    expect(isDateInTaxYear('2026-04-05', current)).toBe(false);

    const previous = taxYearWindow('UK', new Date('2026-02-01T12:00:00Z'));
    expect(previous.label).toBe('2025/26');
  });

  it('can select the last completed tax year', () => {
    expect(taxYearWindow('Ireland', new Date('2026-08-28T12:00:00Z'), -1).label).toBe('2025');
    const uk = taxYearWindow('UK', new Date('2026-08-28T12:00:00Z'), -1);
    expect(uk.label).toBe('2025/26');
    expect(isDateInTaxYear('2026-03-31', uk)).toBe(true);
  });

  it('rejects missing and invalid dates', () => {
    const window = taxYearWindow('Ireland', new Date('2026-08-28T12:00:00Z'));
    expect(isDateInTaxYear(null, window)).toBe(false);
    expect(isDateInTaxYear('not-a-date', window)).toBe(false);
  });

  it('keeps the relief scan short and routes every topic to its official source', () => {
    expect(TAX_REVIEW_TOPICS.Ireland).toHaveLength(4);
    expect(TAX_REVIEW_TOPICS.UK).toHaveLength(4);

    for (const topic of TAX_REVIEW_TOPICS.Ireland) {
      expect(new URL(topic.href).hostname).toBe('www.revenue.ie');
      expect(topic.source).toBe('Revenue');
    }

    for (const topic of TAX_REVIEW_TOPICS.UK) {
      expect(new URL(topic.href).hostname).toBe('www.gov.uk');
      expect(topic.source).toBe('GOV.UK');
    }
  });

  it('only marks pension topics as having a payslip-derived signal', () => {
    const signalled = Object.values(TAX_REVIEW_TOPICS).flat().filter((topic) => topic.payslipSignal);
    expect(signalled.map((topic) => topic.id)).toEqual(['ie-pension', 'uk-pension']);
  });

  it('separates completed-year checks from current-year corrections', () => {
    expect(OFFICIAL_TAX_STEPS.UK.map((step) => step.href)).toContain('https://www.gov.uk/check-income-tax-last-year');
    expect(OFFICIAL_TAX_STEPS.UK.map((step) => step.href)).not.toContain('https://www.gov.uk/check-income-tax-current-year');
    expect(CURRENT_TAX_STEPS.UK.map((step) => step.href)).toContain('https://www.gov.uk/check-income-tax-current-year');
    expect(CURRENT_TAX_STEPS.Ireland.map((step) => step.href)).toContain(
      'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/real-time-credits/index.aspx',
    );
  });

  it('derives cautious official-source timing guidance for each period', () => {
    const irelandCompleted = taxReviewTiming(
      'Ireland',
      taxYearWindow('Ireland', new Date('2026-08-28T12:00:00Z'), -1),
      'completed',
    );
    expect(irelandCompleted.title).toBe('Review before 31 December 2029');
    expect(irelandCompleted.href).toContain('revenue.ie');

    const ukCompleted = taxReviewTiming(
      'UK',
      taxYearWindow('UK', new Date('2026-08-28T12:00:00Z'), -1),
      'completed',
    );
    expect(ukCompleted.title).toBe('Check the right route before 5 April 2030');
    expect(ukCompleted.description).toMatch(/route and deadline can differ/i);

    expect(taxReviewTiming(
      'UK',
      taxYearWindow('UK', new Date('2026-08-28T12:00:00Z')),
      'current',
    ).title).toBe('Fix current-year details before year-end');
  });

  it('builds a deduplicated records list and a portable guidance-only plan', () => {
    const topics = [TAX_REVIEW_TOPICS.UK[0], TAX_REVIEW_TOPICS.UK[1]];
    const documents = buildTaxReviewDocumentList('UK', topics);

    expect(documents).toContain('P60 and any relevant P45 or P11D');
    expect(documents).toContain('Receipts or other proof of payment');
    expect(new Set(documents).size).toBe(documents.length);

    const plan = buildTaxReviewPlanText({
      country: 'UK',
      documents,
      period: 'completed',
      steps: OFFICIAL_TAX_STEPS.UK,
      taxYearLabel: '2025/26',
      topics,
    });
    expect(plan).toContain('Job costs you paid yourself');
    expect(plan).toContain('Official-source steps');
    expect(plan).toContain('Guidance only.');
    expect(plan).not.toMatch(/[£€]\d/);
  });
});
