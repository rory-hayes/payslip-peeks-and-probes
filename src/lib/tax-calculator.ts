/**
 * Approximate monthly tax calculators for UK and Ireland (2024/25 rates).
 * These are simplified estimates — not formal tax advice.
 */

export interface DeductionOptions {
  pensionPercent?: number;       // e.g. 5 for 5% employee contribution
  hasStudentLoan?: boolean;      // UK Plan 2 or Ireland equivalent
  studentLoanPlan?: 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
}

export interface MonthlyBreakdown {
  grossMonthly: number;
  incomeTax: number;
  nationalInsurance: number;
  usc: number;
  pension: number;
  studentLoan: number;
  totalDeductions: number;
  netPay: number;
}

/* ─── UK (2024/25) ─── */
function calcUKMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  // Pension (salary sacrifice reduces gross for tax/NI; standard doesn't — we use relief-at-source model)
  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // Taxable pay after pension relief
  const taxableGross = gross - annualPension;

  // Income tax
  const personalAllowance = 12_570;
  const effectivePA = taxableGross > 100_000
    ? Math.max(0, personalAllowance - (taxableGross - 100_000) / 2)
    : personalAllowance;
  const taxable = Math.max(0, taxableGross - effectivePA);

  let tax = 0;
  const bands = [
    { limit: 37_700, rate: 0.20 },
    { limit: 125_140 - 50_270, rate: 0.40 },
    { limit: Infinity, rate: 0.45 },
  ];
  let remaining = taxable;
  for (const band of bands) {
    const inBand = Math.min(remaining, band.limit);
    tax += inBand * band.rate;
    remaining -= inBand;
    if (remaining <= 0) break;
  }

  // National Insurance
  const niThreshold = 12_570;
  const niUpper = 50_270;
  let ni = 0;
  const niGross = taxableGross; // pension salary sacrifice would reduce this too
  if (niGross > niThreshold) {
    ni += Math.min(niGross - niThreshold, niUpper - niThreshold) * 0.08;
    if (niGross > niUpper) {
      ni += (niGross - niUpper) * 0.02;
    }
  }

  // Student loan
  let studentLoan = 0;
  if (opts.hasStudentLoan) {
    const plan = opts.studentLoanPlan ?? 'plan2';
    const slConfig: Record<string, { threshold: number; rate: number }> = {
      plan1: { threshold: 22_015, rate: 0.09 },
      plan2: { threshold: 27_295, rate: 0.09 },
      plan4: { threshold: 27_660, rate: 0.09 },
      plan5: { threshold: 25_000, rate: 0.09 },
      postgrad: { threshold: 21_000, rate: 0.06 },
    };
    const cfg = slConfig[plan];
    if (gross > cfg.threshold) {
      studentLoan = (gross - cfg.threshold) * cfg.rate;
    }
  }

  const monthlyTax = tax / 12;
  const monthlyNI = ni / 12;
  const monthlyPension = annualPension / 12;
  const monthlyStudentLoan = studentLoan / 12;
  const grossMonthly = gross / 12;
  const totalDeductions = monthlyTax + monthlyNI + monthlyPension + monthlyStudentLoan;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlyNI),
    usc: 0,
    pension: round(monthlyPension),
    studentLoan: round(monthlyStudentLoan),
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

/* ─── Ireland (2024) ─── */
function calcIrelandMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;
  const taxableGross = gross - annualPension; // pension is tax-deductible in Ireland

  // Income tax (single person)
  const stdRateBand = 42_000;
  let tax = 0;
  if (taxableGross <= stdRateBand) {
    tax = taxableGross * 0.20;
  } else {
    tax = stdRateBand * 0.20 + (taxableGross - stdRateBand) * 0.40;
  }
  const taxCredits = 1_875 + 1_875;
  tax = Math.max(0, tax - taxCredits);

  // PRSI (Class A1, 4% — on full gross, pension doesn't reduce PRSI)
  const prsiExempt = 352 * 52;
  const prsi = gross > prsiExempt ? gross * 0.04 : 0;

  // USC (on full gross)
  let usc = 0;
  const uscBands = [
    { limit: 12_012, rate: 0.005 },
    { limit: 25_760 - 12_012, rate: 0.02 },
    { limit: 70_044 - 25_760, rate: 0.04 },
    { limit: Infinity, rate: 0.08 },
  ];
  let rem = gross;
  for (const band of uscBands) {
    const inBand = Math.min(rem, band.limit);
    usc += inBand * band.rate;
    rem -= inBand;
    if (rem <= 0) break;
  }

  const monthlyTax = tax / 12;
  const monthlyPRSI = prsi / 12;
  const monthlyUSC = usc / 12;
  const monthlyPension = annualPension / 12;
  const grossMonthly = gross / 12;
  const totalDeductions = monthlyTax + monthlyPRSI + monthlyUSC + monthlyPension;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlyPRSI),
    usc: round(monthlyUSC),
    pension: round(monthlyPension),
    studentLoan: 0, // no equivalent in Ireland
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function calculateExpectedMonthly(
  annualSalary: number,
  country: 'UK' | 'Ireland' | null,
  opts: DeductionOptions = {},
): MonthlyBreakdown {
  if (country === 'Ireland') return calcIrelandMonthlyTax(annualSalary, opts);
  return calcUKMonthlyTax(annualSalary, opts);
}
