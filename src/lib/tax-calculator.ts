/**
 * Approximate monthly tax calculators for UK and Ireland (2024/25 rates).
 * These are simplified estimates — not formal tax advice.
 */

export interface MonthlyBreakdown {
  grossMonthly: number;
  incomeTax: number;
  nationalInsurance: number; // UK NI or Ireland PRSI
  usc: number; // Ireland only
  totalDeductions: number;
  netPay: number;
}

/* ─── UK (2024/25) ─── */
function calcUKMonthlyTax(annualSalary: number): MonthlyBreakdown {
  const gross = annualSalary;

  // Income tax
  const personalAllowance = 12_570;
  // Taper: lose £1 for every £2 over £100k
  const effectivePA = gross > 100_000
    ? Math.max(0, personalAllowance - (gross - 100_000) / 2)
    : personalAllowance;
  const taxable = Math.max(0, gross - effectivePA);

  let tax = 0;
  const bands = [
    { limit: 37_700, rate: 0.20 },
    { limit: 125_140 - 50_270, rate: 0.40 }, // 50,271 to 125,140
    { limit: Infinity, rate: 0.45 },
  ];
  let remaining = taxable;
  for (const band of bands) {
    const inBand = Math.min(remaining, band.limit);
    tax += inBand * band.rate;
    remaining -= inBand;
    if (remaining <= 0) break;
  }

  // National Insurance (Class 1 employee)
  const niThreshold = 12_570;
  const niUpper = 50_270;
  let ni = 0;
  if (gross > niThreshold) {
    ni += Math.min(gross - niThreshold, niUpper - niThreshold) * 0.08;
    if (gross > niUpper) {
      ni += (gross - niUpper) * 0.02;
    }
  }

  const monthlyTax = tax / 12;
  const monthlyNI = ni / 12;
  const grossMonthly = gross / 12;
  const totalDeductions = monthlyTax + monthlyNI;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlyNI),
    usc: 0,
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

/* ─── Ireland (2024) ─── */
function calcIrelandMonthlyTax(annualSalary: number): MonthlyBreakdown {
  const gross = annualSalary;

  // Income tax (single person)
  const stdRateBand = 42_000;
  let tax = 0;
  if (gross <= stdRateBand) {
    tax = gross * 0.20;
  } else {
    tax = stdRateBand * 0.20 + (gross - stdRateBand) * 0.40;
  }
  // Personal tax credit + Employee (PAYE) credit
  const taxCredits = 1_875 + 1_875;
  tax = Math.max(0, tax - taxCredits);

  // PRSI (Class A1 employee, 4%)
  const prsiExempt = 352 * 52; // weekly threshold annualised
  const prsi = gross > prsiExempt ? gross * 0.04 : 0;

  // USC
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
  const grossMonthly = gross / 12;
  const totalDeductions = monthlyTax + monthlyPRSI + monthlyUSC;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlyPRSI),
    usc: round(monthlyUSC),
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
): MonthlyBreakdown {
  if (country === 'Ireland') return calcIrelandMonthlyTax(annualSalary);
  return calcUKMonthlyTax(annualSalary);
}
