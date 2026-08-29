export type TaxHelperCountry = 'Ireland' | 'UK';
export type TaxReviewPeriod = 'completed' | 'current';

export interface OfficialTaxStep {
  id: string;
  title: string;
  description: string;
  action: string;
  href: string;
  source: 'Revenue' | 'GOV.UK';
}

export interface TaxReviewTopic {
  id: string;
  title: string;
  prompt: string;
  description: string;
  documents: readonly string[];
  action: string;
  href: string;
  source: 'Revenue' | 'GOV.UK';
  payslipSignal?: 'pension';
}

export interface TaxYearWindow {
  label: string;
  start: Date;
  end: Date;
}

export interface TaxReviewTiming {
  action: string;
  description: string;
  eyebrow: string;
  href: string;
  title: string;
}

export const OFFICIAL_TAX_STEPS: Record<TaxHelperCountry, OfficialTaxStep[]> = {
  Ireland: [
    {
      id: 'ie-gather',
      title: 'Bring your confirmed pay together',
      description: 'Check that your saved payslips cover each employer and pay period you expect for the calendar year.',
      action: 'Review your payslip history',
      href: '/vault',
      source: 'Revenue',
    },
    {
      id: 'ie-employment-summary',
      title: 'Check your Employment Detail Summary',
      description: 'Compare Revenue’s employer-reported pay and deductions with the figures you confirmed from your own payslips.',
      action: 'Open Revenue guidance',
      href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/employment-detail-summary.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-preliminary-statement',
      title: 'Read your Preliminary End of Year Statement',
      description: 'Use Revenue’s statement to understand its preliminary calculation before completing your return.',
      action: 'Open Revenue guidance',
      href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/preliminary-end-year-statement.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-return',
      title: 'Complete your PAYE Income Tax Return',
      description: 'Review relevant credits and reliefs, declare any additional income, and submit through Revenue myAccount.',
      action: 'See Revenue’s return steps',
      href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/paye-income-tax-return.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-liability',
      title: 'Review your Statement of Liability',
      description: 'Revenue’s final statement shows whether its calculation results in a refund, a balanced position, or an underpayment.',
      action: 'Open Revenue guidance',
      href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/statement-of-liability.aspx',
      source: 'Revenue',
    },
  ],
  UK: [
    {
      id: 'uk-gather',
      title: 'Bring your confirmed pay together',
      description: 'Check that your saved payslips cover the employers and pay periods you expect for the UK tax year.',
      action: 'Review your payslip history',
      href: '/vault',
      source: 'GOV.UK',
    },
    {
      id: 'uk-account',
      title: 'Check last year’s HMRC calculation',
      description: 'Use HMRC’s previous-year service to review the Income Tax result it holds for the completed tax year.',
      action: 'Check last year’s Income Tax',
      href: 'https://www.gov.uk/check-income-tax-last-year',
      source: 'GOV.UK',
    },
    {
      id: 'uk-tax-code',
      title: 'Compare your P60, P45 and saved payslips',
      description: 'Check the pay and Income Tax totals for each employment against the records you kept for the year.',
      action: 'Check what a P60 should show',
      href: 'https://www.gov.uk/paye-forms-p45-p60-p11d/p60',
      source: 'GOV.UK',
    },
    {
      id: 'uk-refund-route',
      title: 'Find the correct refund route',
      description: 'HMRC uses different routes for employment pay, work expenses, pensions and Self Assessment. Start with its official checker.',
      action: 'Check how to claim',
      href: 'https://www.gov.uk/claim-tax-refund',
      source: 'GOV.UK',
    },
    {
      id: 'uk-result',
      title: 'Keep HMRC’s outcome with your records',
      description: 'Save the official calculation or response with the payslips and documents you used. Payslip Insights does not file a claim for you.',
      action: 'View HMRC response times',
      href: 'https://www.gov.uk/guidance/check-when-you-can-expect-a-reply-from-hmrc',
      source: 'GOV.UK',
    },
  ],
};

export const CURRENT_TAX_STEPS: Record<TaxHelperCountry, OfficialTaxStep[]> = {
  Ireland: [
    {
      id: 'ie-current-gather',
      title: 'Keep confirmed payslips together',
      description: 'Confirm each payslip while the figures and any payroll questions are still easy to check.',
      action: 'Review your payslip history',
      href: '/vault',
      source: 'Revenue',
    },
    {
      id: 'ie-current-pay-record',
      title: 'Check what your employer reported',
      description: 'Compare each employer’s Revenue pay and statutory-deduction record with the payslip you received.',
      action: 'View Revenue’s instructions',
      href: 'https://www.revenue.ie/en/jobs-and-pensions/calculating-your-income-tax/view-pay-tax-details.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-current-credits',
      title: 'Review current credits and rate bands',
      description: 'Use myAccount to check the credits, rate bands, jobs and pensions Revenue is applying this year.',
      action: 'Check how tax credits work',
      href: 'https://www.revenue.ie/en/jobs-and-pensions/calculating-your-income-tax/tax-credits.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-current-reliefs',
      title: 'Check current-year claim options',
      description: 'Revenue allows certain qualifying expenses to be claimed during the year. Eligibility and the route depend on the expense.',
      action: 'Check Real Time Credits',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/real-time-credits/index.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-current-recheck',
      title: 'Recheck the next payslip after an update',
      description: 'If Revenue or payroll changes a credit, rate band or record, confirm the next payslip reflects what you expected.',
      action: 'Open your payslip history',
      href: '/vault',
      source: 'Revenue',
    },
  ],
  UK: [
    {
      id: 'uk-current-gather',
      title: 'Keep confirmed payslips together',
      description: 'Confirm each payslip while the figures and any payroll questions are still easy to check.',
      action: 'Review your payslip history',
      href: '/vault',
      source: 'GOV.UK',
    },
    {
      id: 'uk-current-account',
      title: 'Check your current HMRC record',
      description: 'Review the employers, pensions, estimated income, tax code and Personal Allowance HMRC is using this year.',
      action: 'Check your current Income Tax',
      href: 'https://www.gov.uk/check-income-tax-current-year',
      source: 'GOV.UK',
    },
    {
      id: 'uk-current-tax-code',
      title: 'Correct missing or outdated details',
      description: 'If HMRC’s employment, benefit, pension or income details are wrong, use its official service to update them.',
      action: 'See how to update a tax code',
      href: 'https://www.gov.uk/tax-codes/how-to-update-your-tax-code',
      source: 'GOV.UK',
    },
    {
      id: 'uk-current-reliefs',
      title: 'Check current-year relief routes',
      description: 'Some eligible employment expenses can change your tax code during the year; the route depends on what you paid and whether you were reimbursed.',
      action: 'Check employee-expense rules',
      href: 'https://www.gov.uk/tax-relief-for-employees',
      source: 'GOV.UK',
    },
    {
      id: 'uk-current-recheck',
      title: 'Recheck the next payslip after an update',
      description: 'If HMRC or payroll changes a tax code or record, confirm the change appears on a later payslip.',
      action: 'Open your payslip history',
      href: '/vault',
      source: 'GOV.UK',
    },
  ],
};

/**
 * A deliberately short discovery scan. These prompts never infer eligibility
 * or estimate a refund; they route a user to the current official rules for
 * areas PAYE employees commonly need to remember themselves.
 */
export const TAX_REVIEW_TOPICS: Record<TaxHelperCountry, TaxReviewTopic[]> = {
  Ireland: [
    {
      id: 'ie-rent',
      title: 'Rent you paid',
      prompt: 'Did you pay rent for your home or other potentially qualifying accommodation?',
      description: 'Revenue applies conditions and calculates any Rent Tax Credit from the rent and Income Tax you paid.',
      documents: ['Rental address and Eircode', 'Landlord or letting-agent details', 'Tenancy or RTB details, if applicable', 'Rent payment record or landlord statement'],
      action: 'Check Rent Tax Credit rules',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/rent-credit/index.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-health',
      title: 'Health costs not repaid',
      prompt: 'Did you pay qualifying health or dental costs that insurance, the HSE or another source did not repay?',
      description: 'Revenue says qualifying unreimbursed costs may be claimable, subject to its rules and the four-year limit.',
      documents: ['Health or dental receipts', 'Proof of payment', 'Insurance, HSE or other reimbursement details'],
      action: 'Check health-expense rules',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/health-expenses/index.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-work-costs',
      title: 'Work costs you covered',
      prompt: 'Does your occupation require you to cover tools, uniforms or registration fees yourself?',
      description: 'Revenue lists the occupations and conditions covered by Flat Rate Expense allowances.',
      documents: ['Job title and occupation details', 'Employer details', 'Relevant fee, tool or uniform records', 'Any employer reimbursement details'],
      action: 'Check Flat Rate Expenses',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/flat-rate-expenses/index.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-pension',
      title: 'Pension or AVC contributions',
      prompt: 'Did you make pension, PRSA or AVC contributions without receiving all relief through payroll?',
      description: 'Revenue explains when PAYE workers need to claim separately and what evidence is required. Contribution limits apply.',
      documents: ['Pension, PRSA or AVC statement', 'Contribution dates and amounts', 'Evidence of any tax relief already applied'],
      action: 'Check pension-relief rules',
      href: 'https://www.revenue.ie/en/jobs-and-pensions/pension/relief/how-to-claim.aspx',
      source: 'Revenue',
      payslipSignal: 'pension',
    },
  ],
  UK: [
    {
      id: 'uk-work-costs',
      title: 'Job costs you paid yourself',
      prompt: 'Did you pay required work-only costs without being fully reimbursed by your employer?',
      description: 'HMRC covers qualifying items such as uniforms, tools, professional fees, business travel and some equipment.',
      documents: ['Receipts or other proof of payment', 'Employer reimbursement details', 'Mileage or business-travel log, if relevant', 'Employment and job-cost details'],
      action: 'Check employee-expense rules',
      href: 'https://www.gov.uk/tax-relief-for-employees',
      source: 'GOV.UK',
    },
    {
      id: 'uk-pension',
      title: 'Pension contributions',
      prompt: 'Did you pay above 20% Income Tax or contribute without receiving automatic pension tax relief?',
      description: 'HMRC says some people need to claim additional relief themselves; the route depends on the pension scheme and tax rate.',
      documents: ['Pension provider or scheme statement', 'Net and gross contribution amounts', 'Payslips or P60 showing pay and tax', 'Evidence of relief already added by the scheme or payroll'],
      action: 'Check eligibility and claim route',
      href: 'https://www.gov.uk/guidance/claim-tax-relief-on-your-private-pension-payments',
      source: 'GOV.UK',
      payslipSignal: 'pension',
    },
    {
      id: 'uk-marriage',
      title: 'Marriage Allowance',
      prompt: 'Are you married or in a civil partnership where one partner has income below their Personal Allowance?',
      description: 'HMRC sets income, tax-rate and relationship conditions. Its official checker shows whether a transfer could help as a couple.',
      documents: ['Both partners’ National Insurance numbers', 'Income details for the tax year', 'Marriage or civil-partnership date'],
      action: 'Check Marriage Allowance',
      href: 'https://www.gov.uk/marriage-allowance',
      source: 'GOV.UK',
    },
    {
      id: 'uk-gift-aid',
      title: 'Gift Aid donations',
      prompt: 'Did you use Gift Aid while paying Income Tax above the basic rate?',
      description: 'HMRC explains when higher- or additional-rate taxpayers can claim the difference and what donation records to keep.',
      documents: ['Charity donation records', 'Donation dates and amounts', 'Gift Aid declaration details'],
      action: 'Check Gift Aid relief',
      href: 'https://www.gov.uk/donating-to-charity/gift-aid',
      source: 'GOV.UK',
    },
  ],
};

export const BASE_TAX_REVIEW_DOCUMENTS: Record<TaxHelperCountry, readonly string[]> = {
  Ireland: [
    'Confirmed payslips for the period',
    'Revenue Employment Detail Summary or current pay record',
    'Access to Revenue myAccount',
  ],
  UK: [
    'Confirmed payslips for the period',
    'P60 and any relevant P45 or P11D',
    'Access to your HMRC Personal Tax Account',
    'Tax code notice or P800, if HMRC issued one',
  ],
};

export function taxReviewTiming(
  country: TaxHelperCountry,
  window: TaxYearWindow,
  period: TaxReviewPeriod,
): TaxReviewTiming {
  if (period === 'current') {
    return country === 'Ireland'
      ? {
        action: 'Check Revenue’s current-year options',
        description: 'Revenue lets PAYE taxpayers manage current credits and claim certain qualifying expenses during the year. Other reliefs may use a different route.',
        eyebrow: 'Act as you go',
        href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/real-time-credits/index.aspx',
        title: 'Some current-year changes can reach payroll sooner',
      }
      : {
        action: 'Check your current HMRC record',
        description: 'HMRC’s current-year service lets you review and update the employment, pension, income and tax-code details it is using.',
        eyebrow: 'Act as you go',
        href: 'https://www.gov.uk/check-income-tax-current-year',
        title: 'Fix current-year details before year-end',
      };
  }

  if (country === 'Ireland') {
    const deadlineYear = window.end.getUTCFullYear() + 4;
    return {
      action: 'Check Revenue’s four-year rule',
      description: `Revenue’s general four-year rule means reviews or refund claims for ${window.label} usually need to be made by 31 December ${deadlineYear}. Specific claims can have different conditions.`,
      eyebrow: 'General claim window',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/four-year-rule/index.aspx',
      title: `Review before 31 December ${deadlineYear}`,
    };
  }

  const deadlineYear = window.end.getUTCFullYear() + 4;
  return {
    action: 'Start with HMRC’s route checker',
    description: `Many employee claims use a four-year limit after the tax year ends, which would be 5 April ${deadlineYear} for ${window.label}. The route and deadline can differ, so confirm them with HMRC.`,
    eyebrow: 'Typical claim window',
    href: 'https://www.gov.uk/claim-tax-refund',
    title: `Check the right route before 5 April ${deadlineYear}`,
  };
}

export function buildTaxReviewDocumentList(
  country: TaxHelperCountry,
  selectedTopics: readonly TaxReviewTopic[],
): string[] {
  return [...new Set([
    ...BASE_TAX_REVIEW_DOCUMENTS[country],
    ...selectedTopics.flatMap((topic) => topic.documents),
  ])];
}

export function buildTaxReviewPlanText({
  country,
  documents,
  period,
  steps,
  taxYearLabel,
  topics,
}: {
  country: TaxHelperCountry;
  documents: readonly string[];
  period: TaxReviewPeriod;
  steps: readonly OfficialTaxStep[];
  taxYearLabel: string;
  topics: readonly TaxReviewTopic[];
}): string {
  const topicLines = topics.length
    ? topics.map((topic) => `- ${topic.title}: ${topic.href}`)
    : ['- No review areas selected yet'];
  const documentLines = documents.map((document) => `- ${document}`);
  const stepLines = steps.map((step, index) => `${index + 1}. ${step.title}: ${step.href}`);

  return [
    'Payslip Insights tax-year plan',
    `${country} · ${taxYearLabel} · ${period === 'current' ? 'Current year' : 'Completed year'}`,
    '',
    'Areas to review',
    ...topicLines,
    '',
    'Helpful records to gather',
    ...documentLines,
    '',
    'Official-source steps',
    ...stepLines,
    '',
    'Guidance only. Confirm eligibility, figures, deadlines and any outcome with Revenue, HMRC or a qualified professional.',
  ].join('\n');
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

export function taxYearWindow(country: TaxHelperCountry, now = new Date(), yearOffset = 0): TaxYearWindow {
  const year = now.getUTCFullYear();
  if (country === 'Ireland') {
    const targetYear = year + yearOffset;
    return {
      label: String(targetYear),
      start: utcDate(targetYear, 0, 1),
      end: utcDate(targetYear, 11, 31),
    };
  }

  const currentYearStart = utcDate(year, 3, 6);
  const startYear = (now.getTime() >= currentYearStart.getTime() ? year : year - 1) + yearOffset;
  return {
    label: `${startYear}/${String(startYear + 1).slice(-2)}`,
    start: utcDate(startYear, 3, 6),
    end: utcDate(startYear + 1, 3, 5),
  };
}

export function isDateInTaxYear(value: string | null | undefined, window: TaxYearWindow): boolean {
  if (!value) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return false;
  return parsed.getTime() >= window.start.getTime() && parsed.getTime() <= window.end.getTime();
}
