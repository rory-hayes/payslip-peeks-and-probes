export type TaxHelperCountry = 'Ireland' | 'UK';

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
      title: 'Check your HMRC employment record',
      description: 'Use your Personal Tax Account to review the pay, employer and tax-code information HMRC holds for you.',
      action: 'Open your official account',
      href: 'https://www.gov.uk/personal-tax-account',
      source: 'GOV.UK',
    },
    {
      id: 'uk-tax-code',
      title: 'Review your tax code and current-year estimate',
      description: 'Compare the tax code on your payslip with HMRC’s current record, especially after a job, benefit or pension change.',
      action: 'Check your Income Tax',
      href: 'https://www.gov.uk/check-income-tax-current-year',
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
      action: 'Check Rent Tax Credit rules',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/rent-credit/index.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-health',
      title: 'Health costs not repaid',
      prompt: 'Did you pay qualifying health or dental costs that insurance, the HSE or another source did not repay?',
      description: 'Revenue says qualifying unreimbursed costs may be claimable, subject to its rules and the four-year limit.',
      action: 'Check health-expense rules',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/health-expenses/index.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-work-costs',
      title: 'Work costs you covered',
      prompt: 'Does your occupation require you to cover tools, uniforms or registration fees yourself?',
      description: 'Revenue lists the occupations and conditions covered by Flat Rate Expense allowances.',
      action: 'Check Flat Rate Expenses',
      href: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/flat-rate-expenses/index.aspx',
      source: 'Revenue',
    },
    {
      id: 'ie-pension',
      title: 'Pension or AVC contributions',
      prompt: 'Did you make pension, PRSA or AVC contributions without receiving all relief through payroll?',
      description: 'Revenue explains when PAYE workers need to claim separately and what evidence is required. Contribution limits apply.',
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
      action: 'Check employee-expense rules',
      href: 'https://www.gov.uk/tax-relief-for-employees',
      source: 'GOV.UK',
    },
    {
      id: 'uk-pension',
      title: 'Pension contributions',
      prompt: 'Did you pay above 20% Income Tax or contribute without receiving automatic pension tax relief?',
      description: 'HMRC says some people need to claim additional relief themselves; the route depends on the pension scheme and tax rate.',
      action: 'Check pension-relief rules',
      href: 'https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief',
      source: 'GOV.UK',
      payslipSignal: 'pension',
    },
    {
      id: 'uk-marriage',
      title: 'Marriage Allowance',
      prompt: 'Are you married or in a civil partnership where one partner has income below their Personal Allowance?',
      description: 'HMRC sets income, tax-rate and relationship conditions. Its official checker shows whether a transfer could help as a couple.',
      action: 'Check Marriage Allowance',
      href: 'https://www.gov.uk/marriage-allowance',
      source: 'GOV.UK',
    },
    {
      id: 'uk-gift-aid',
      title: 'Gift Aid donations',
      prompt: 'Did you use Gift Aid while paying Income Tax above the basic rate?',
      description: 'HMRC explains when higher- or additional-rate taxpayers can claim the difference and what donation records to keep.',
      action: 'Check Gift Aid relief',
      href: 'https://www.gov.uk/donating-to-charity/gift-aid',
      source: 'GOV.UK',
    },
  ],
};

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
