/**
 * 2024 US state income tax data — single + married-filing-jointly only.
 * Sources: each state's Department of Revenue / tax commission, 2024 brackets.
 *
 * Notes:
 *   - 9 states have no state income tax: AK, FL, NH, NV, SD, TN, TX, WA, WY
 *     (NH does tax investment income only — payroll workers see 0%)
 *   - Where states allow itemized deductions or per-dependent credits, we apply the
 *     standard deduction + zero dependents (matches our federal assumption).
 *   - PA, IN, IL, KY, MI, NC, UT, MA, CO use a flat rate on AGI (no standard deduction
 *     in some cases — we model what the state actually does).
 *   - State-level pre-tax 401(k) treatment varies; we follow federal: 401(k) reduces
 *     state taxable income everywhere except PA and NJ where it does NOT.
 *   - "Married" = married filing jointly. MFS / HoH not modelled.
 */

export type FilingStatus = 'single' | 'married';

export interface StateBracket {
  upTo: number;
  rate: number;
}

export interface StateTaxConfig {
  code: string;
  name: string;
  /** Standard deduction per filing status (0 if state doesn't allow one) */
  standardDeduction: { single: number; married: number };
  /** Per-filer personal exemption / personal credit (subtracted from taxable income) */
  personalExemption?: { single: number; married: number };
  /** Brackets per filing status (exclusive upper bound) */
  brackets: { single: StateBracket[]; married: StateBracket[] };
  /** When true, 401(k) contributions are NOT pre-tax for state purposes (PA, NJ) */
  pretax401kNotAllowed?: boolean;
  /** Optional per-state notes for the user */
  notes?: string;
}

const FLAT = (rate: number, std?: { single: number; married: number }): StateTaxConfig['brackets'] => ({
  single: [{ upTo: Infinity, rate }],
  married: [{ upTo: Infinity, rate }],
});

const NONE: StateTaxConfig['brackets'] = {
  single: [{ upTo: Infinity, rate: 0 }],
  married: [{ upTo: Infinity, rate: 0 }],
};

export const US_STATES: StateTaxConfig[] = [
  // ── No-income-tax states ──
  { code: 'AK', name: 'Alaska', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No state income tax.' },
  { code: 'FL', name: 'Florida', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No state income tax.' },
  { code: 'NH', name: 'New Hampshire', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No tax on wages (5% interest/dividends only — phasing out by 2027).' },
  { code: 'NV', name: 'Nevada', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No state income tax.' },
  { code: 'SD', name: 'South Dakota', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No state income tax.' },
  { code: 'TN', name: 'Tennessee', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No state income tax.' },
  { code: 'TX', name: 'Texas', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No state income tax.' },
  { code: 'WA', name: 'Washington', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No general income tax (7% capital gains tax over $262k — not modelled).' },
  { code: 'WY', name: 'Wyoming', standardDeduction: { single: 0, married: 0 }, brackets: NONE, notes: 'No state income tax.' },

  // ── Flat-rate states ──
  { code: 'CO', name: 'Colorado', standardDeduction: { single: 14_600, married: 29_200 }, brackets: FLAT(0.044), notes: 'Flat 4.4% (2024).' },
  { code: 'IL', name: 'Illinois', standardDeduction: { single: 0, married: 0 }, personalExemption: { single: 2_775, married: 5_550 }, brackets: FLAT(0.0495), notes: 'Flat 4.95%, $2,775 personal exemption.' },
  { code: 'IN', name: 'Indiana', standardDeduction: { single: 0, married: 0 }, personalExemption: { single: 1_000, married: 2_000 }, brackets: FLAT(0.0305), notes: 'Flat 3.05% (2024). County tax not modelled.' },
  { code: 'KY', name: 'Kentucky', standardDeduction: { single: 3_160, married: 3_160 }, brackets: FLAT(0.04), notes: 'Flat 4% (2024).' },
  { code: 'MA', name: 'Massachusetts', standardDeduction: { single: 0, married: 0 }, personalExemption: { single: 4_400, married: 8_800 }, brackets: { single: [{ upTo: 1_000_000, rate: 0.05 }, { upTo: Infinity, rate: 0.09 }], married: [{ upTo: 1_000_000, rate: 0.05 }, { upTo: Infinity, rate: 0.09 }] }, notes: '5% flat + 4% surtax above $1M ("Millionaires Tax").' },
  { code: 'MI', name: 'Michigan', standardDeduction: { single: 0, married: 0 }, personalExemption: { single: 5_600, married: 11_200 }, brackets: FLAT(0.0425), notes: 'Flat 4.25%. City tax (Detroit etc.) not modelled.' },
  { code: 'NC', name: 'North Carolina', standardDeduction: { single: 12_750, married: 25_500 }, brackets: FLAT(0.045), notes: 'Flat 4.5% (2024).' },
  { code: 'PA', name: 'Pennsylvania', standardDeduction: { single: 0, married: 0 }, brackets: FLAT(0.0307), pretax401kNotAllowed: true, notes: 'Flat 3.07% on gross — no standard deduction, 401(k) NOT pre-tax for state. Local EIT 1–4% not modelled.' },
  { code: 'UT', name: 'Utah', standardDeduction: { single: 876, married: 1_752 }, brackets: FLAT(0.0465), notes: 'Flat 4.65% (2024). Modelled with the taxpayer credit phase-out simplified as a fixed deduction.' },

  // ── Progressive states ──
  {
    code: 'AL', name: 'Alabama',
    standardDeduction: { single: 3_000, married: 8_500 },
    personalExemption: { single: 1_500, married: 3_000 },
    brackets: {
      single:  [{ upTo: 500, rate: 0.02 }, { upTo: 3_000, rate: 0.04 }, { upTo: Infinity, rate: 0.05 }],
      married: [{ upTo: 1_000, rate: 0.02 }, { upTo: 6_000, rate: 0.04 }, { upTo: Infinity, rate: 0.05 }],
    },
    notes: 'Local occupational taxes 1–2% in some cities not modelled.',
  },
  {
    code: 'AZ', name: 'Arizona',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: FLAT(0.025),
    notes: 'Flat 2.5% (effective 2024).',
  },
  {
    code: 'AR', name: 'Arkansas',
    standardDeduction: { single: 2_340, married: 4_680 },
    brackets: {
      single:  [{ upTo: 5_300, rate: 0.02 }, { upTo: 10_600, rate: 0.04 }, { upTo: Infinity, rate: 0.044 }],
      married: [{ upTo: 5_300, rate: 0.02 }, { upTo: 10_600, rate: 0.04 }, { upTo: Infinity, rate: 0.044 }],
    },
  },
  {
    code: 'CA', name: 'California',
    standardDeduction: { single: 5_363, married: 10_726 },
    brackets: {
      single: [
        { upTo: 10_756, rate: 0.01 },
        { upTo: 25_499, rate: 0.02 },
        { upTo: 40_245, rate: 0.04 },
        { upTo: 55_866, rate: 0.06 },
        { upTo: 70_606, rate: 0.08 },
        { upTo: 360_659, rate: 0.093 },
        { upTo: 432_787, rate: 0.103 },
        { upTo: 721_314, rate: 0.113 },
        { upTo: Infinity, rate: 0.123 },
      ],
      married: [
        { upTo: 21_512, rate: 0.01 },
        { upTo: 50_998, rate: 0.02 },
        { upTo: 80_490, rate: 0.04 },
        { upTo: 111_732, rate: 0.06 },
        { upTo: 141_212, rate: 0.08 },
        { upTo: 721_318, rate: 0.093 },
        { upTo: 865_574, rate: 0.103 },
        { upTo: 1_442_628, rate: 0.113 },
        { upTo: Infinity, rate: 0.123 },
      ],
    },
    notes: 'Plus 1% Mental Health Services Tax above $1M and 1.1% SDI on wages up to $153,164 (not modelled).',
  },
  {
    code: 'CT', name: 'Connecticut',
    standardDeduction: { single: 0, married: 0 },
    brackets: {
      single: [
        { upTo: 10_000, rate: 0.02 },
        { upTo: 50_000, rate: 0.045 },
        { upTo: 100_000, rate: 0.055 },
        { upTo: 200_000, rate: 0.06 },
        { upTo: 250_000, rate: 0.065 },
        { upTo: 500_000, rate: 0.069 },
        { upTo: Infinity, rate: 0.0699 },
      ],
      married: [
        { upTo: 20_000, rate: 0.02 },
        { upTo: 100_000, rate: 0.045 },
        { upTo: 200_000, rate: 0.055 },
        { upTo: 400_000, rate: 0.06 },
        { upTo: 500_000, rate: 0.065 },
        { upTo: 1_000_000, rate: 0.069 },
        { upTo: Infinity, rate: 0.0699 },
      ],
    },
  },
  {
    code: 'DE', name: 'Delaware',
    standardDeduction: { single: 3_250, married: 6_500 },
    brackets: {
      single: [
        { upTo: 2_000, rate: 0 },
        { upTo: 5_000, rate: 0.022 },
        { upTo: 10_000, rate: 0.039 },
        { upTo: 20_000, rate: 0.048 },
        { upTo: 25_000, rate: 0.052 },
        { upTo: 60_000, rate: 0.0555 },
        { upTo: Infinity, rate: 0.066 },
      ],
      married: [
        { upTo: 2_000, rate: 0 },
        { upTo: 5_000, rate: 0.022 },
        { upTo: 10_000, rate: 0.039 },
        { upTo: 20_000, rate: 0.048 },
        { upTo: 25_000, rate: 0.052 },
        { upTo: 60_000, rate: 0.0555 },
        { upTo: Infinity, rate: 0.066 },
      ],
    },
  },
  {
    code: 'DC', name: 'District of Columbia',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single: [
        { upTo: 10_000, rate: 0.04 },
        { upTo: 40_000, rate: 0.06 },
        { upTo: 60_000, rate: 0.065 },
        { upTo: 250_000, rate: 0.085 },
        { upTo: 500_000, rate: 0.0925 },
        { upTo: 1_000_000, rate: 0.0975 },
        { upTo: Infinity, rate: 0.1075 },
      ],
      married: [
        { upTo: 10_000, rate: 0.04 },
        { upTo: 40_000, rate: 0.06 },
        { upTo: 60_000, rate: 0.065 },
        { upTo: 250_000, rate: 0.085 },
        { upTo: 500_000, rate: 0.0925 },
        { upTo: 1_000_000, rate: 0.0975 },
        { upTo: Infinity, rate: 0.1075 },
      ],
    },
  },
  {
    code: 'GA', name: 'Georgia',
    standardDeduction: { single: 12_000, married: 24_000 },
    brackets: FLAT(0.0539),
    notes: 'Flat 5.39% (effective 2024).',
  },
  {
    code: 'HI', name: 'Hawaii',
    standardDeduction: { single: 2_200, married: 4_400 },
    personalExemption: { single: 1_144, married: 2_288 },
    brackets: {
      single: [
        { upTo: 2_400, rate: 0.014 }, { upTo: 4_800, rate: 0.032 }, { upTo: 9_600, rate: 0.055 },
        { upTo: 14_400, rate: 0.064 }, { upTo: 19_200, rate: 0.068 }, { upTo: 24_000, rate: 0.072 },
        { upTo: 36_000, rate: 0.076 }, { upTo: 48_000, rate: 0.079 }, { upTo: 150_000, rate: 0.0825 },
        { upTo: 175_000, rate: 0.09 }, { upTo: 200_000, rate: 0.10 }, { upTo: Infinity, rate: 0.11 },
      ],
      married: [
        { upTo: 4_800, rate: 0.014 }, { upTo: 9_600, rate: 0.032 }, { upTo: 19_200, rate: 0.055 },
        { upTo: 28_800, rate: 0.064 }, { upTo: 38_400, rate: 0.068 }, { upTo: 48_000, rate: 0.072 },
        { upTo: 72_000, rate: 0.076 }, { upTo: 96_000, rate: 0.079 }, { upTo: 300_000, rate: 0.0825 },
        { upTo: 350_000, rate: 0.09 }, { upTo: 400_000, rate: 0.10 }, { upTo: Infinity, rate: 0.11 },
      ],
    },
  },
  {
    code: 'ID', name: 'Idaho',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: FLAT(0.058),
    notes: 'Flat 5.8% (2024).',
  },
  {
    code: 'IA', name: 'Iowa',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single:  [{ upTo: 6_210, rate: 0.044 }, { upTo: 31_050, rate: 0.0482 }, { upTo: Infinity, rate: 0.057 }],
      married: [{ upTo: 12_420, rate: 0.044 }, { upTo: 62_100, rate: 0.0482 }, { upTo: Infinity, rate: 0.057 }],
    },
    notes: 'Iowa moves to flat 3.8% in 2025.',
  },
  {
    code: 'KS', name: 'Kansas',
    standardDeduction: { single: 3_500, married: 8_000 },
    personalExemption: { single: 2_250, married: 4_500 },
    brackets: {
      single:  [{ upTo: 15_000, rate: 0.031 }, { upTo: 30_000, rate: 0.0525 }, { upTo: Infinity, rate: 0.057 }],
      married: [{ upTo: 30_000, rate: 0.031 }, { upTo: 60_000, rate: 0.0525 }, { upTo: Infinity, rate: 0.057 }],
    },
  },
  {
    code: 'LA', name: 'Louisiana',
    standardDeduction: { single: 4_500, married: 9_000 },
    brackets: {
      single:  [{ upTo: 12_500, rate: 0.0185 }, { upTo: 50_000, rate: 0.035 }, { upTo: Infinity, rate: 0.0425 }],
      married: [{ upTo: 25_000, rate: 0.0185 }, { upTo: 100_000, rate: 0.035 }, { upTo: Infinity, rate: 0.0425 }],
    },
  },
  {
    code: 'ME', name: 'Maine',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single:  [{ upTo: 26_050, rate: 0.058 }, { upTo: 61_600, rate: 0.0675 }, { upTo: Infinity, rate: 0.0715 }],
      married: [{ upTo: 52_100, rate: 0.058 }, { upTo: 123_250, rate: 0.0675 }, { upTo: Infinity, rate: 0.0715 }],
    },
  },
  {
    code: 'MD', name: 'Maryland',
    standardDeduction: { single: 2_550, married: 5_150 },
    personalExemption: { single: 3_200, married: 6_400 },
    brackets: {
      single: [
        { upTo: 1_000, rate: 0.02 }, { upTo: 2_000, rate: 0.03 }, { upTo: 3_000, rate: 0.04 },
        { upTo: 100_000, rate: 0.0475 }, { upTo: 125_000, rate: 0.05 }, { upTo: 150_000, rate: 0.0525 },
        { upTo: 250_000, rate: 0.055 }, { upTo: Infinity, rate: 0.0575 },
      ],
      married: [
        { upTo: 1_000, rate: 0.02 }, { upTo: 2_000, rate: 0.03 }, { upTo: 3_000, rate: 0.04 },
        { upTo: 150_000, rate: 0.0475 }, { upTo: 175_000, rate: 0.05 }, { upTo: 225_000, rate: 0.0525 },
        { upTo: 300_000, rate: 0.055 }, { upTo: Infinity, rate: 0.0575 },
      ],
    },
    notes: 'County income tax 2.25–3.20% (avg ~3%) not modelled — would add meaningful tax.',
  },
  {
    code: 'MN', name: 'Minnesota',
    standardDeduction: { single: 14_575, married: 29_150 },
    brackets: {
      single:  [{ upTo: 31_690, rate: 0.0535 }, { upTo: 104_090, rate: 0.068 }, { upTo: 193_240, rate: 0.0785 }, { upTo: Infinity, rate: 0.0985 }],
      married: [{ upTo: 46_330, rate: 0.0535 }, { upTo: 184_040, rate: 0.068 }, { upTo: 321_450, rate: 0.0785 }, { upTo: Infinity, rate: 0.0985 }],
    },
  },
  {
    code: 'MS', name: 'Mississippi',
    standardDeduction: { single: 2_300, married: 4_600 },
    personalExemption: { single: 6_000, married: 12_000 },
    brackets: {
      single:  [{ upTo: 10_000, rate: 0 }, { upTo: Infinity, rate: 0.047 }],
      married: [{ upTo: 10_000, rate: 0 }, { upTo: Infinity, rate: 0.047 }],
    },
  },
  {
    code: 'MO', name: 'Missouri',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single: [
        { upTo: 1_273, rate: 0 }, { upTo: 2_546, rate: 0.02 }, { upTo: 3_819, rate: 0.025 },
        { upTo: 5_092, rate: 0.03 }, { upTo: 6_365, rate: 0.035 }, { upTo: 7_638, rate: 0.04 },
        { upTo: 8_911, rate: 0.045 }, { upTo: Infinity, rate: 0.048 },
      ],
      married: [
        { upTo: 1_273, rate: 0 }, { upTo: 2_546, rate: 0.02 }, { upTo: 3_819, rate: 0.025 },
        { upTo: 5_092, rate: 0.03 }, { upTo: 6_365, rate: 0.035 }, { upTo: 7_638, rate: 0.04 },
        { upTo: 8_911, rate: 0.045 }, { upTo: Infinity, rate: 0.048 },
      ],
    },
  },
  {
    code: 'MT', name: 'Montana',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single:  [{ upTo: 20_500, rate: 0.047 }, { upTo: Infinity, rate: 0.059 }],
      married: [{ upTo: 41_000, rate: 0.047 }, { upTo: Infinity, rate: 0.059 }],
    },
  },
  {
    code: 'NE', name: 'Nebraska',
    standardDeduction: { single: 7_900, married: 15_800 },
    personalExemption: { single: 157, married: 314 },
    brackets: {
      single:  [{ upTo: 3_700, rate: 0.0246 }, { upTo: 22_170, rate: 0.0351 }, { upTo: 35_730, rate: 0.0501 }, { upTo: Infinity, rate: 0.0584 }],
      married: [{ upTo: 7_390, rate: 0.0246 }, { upTo: 44_350, rate: 0.0351 }, { upTo: 71_460, rate: 0.0501 }, { upTo: Infinity, rate: 0.0584 }],
    },
  },
  {
    code: 'NJ', name: 'New Jersey',
    standardDeduction: { single: 0, married: 0 },
    personalExemption: { single: 1_000, married: 2_000 },
    brackets: {
      single: [
        { upTo: 20_000, rate: 0.014 }, { upTo: 35_000, rate: 0.0175 }, { upTo: 40_000, rate: 0.035 },
        { upTo: 75_000, rate: 0.05525 }, { upTo: 500_000, rate: 0.0637 }, { upTo: 1_000_000, rate: 0.0897 },
        { upTo: Infinity, rate: 0.1075 },
      ],
      married: [
        { upTo: 20_000, rate: 0.014 }, { upTo: 50_000, rate: 0.0175 }, { upTo: 70_000, rate: 0.0245 },
        { upTo: 80_000, rate: 0.035 }, { upTo: 150_000, rate: 0.05525 }, { upTo: 500_000, rate: 0.0637 },
        { upTo: 1_000_000, rate: 0.0897 }, { upTo: Infinity, rate: 0.1075 },
      ],
    },
    pretax401kNotAllowed: true,
    notes: '401(k) NOT pre-tax for NJ state. SDI/FLI 0.06% on first ~$161k not modelled.',
  },
  {
    code: 'NM', name: 'New Mexico',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single:  [{ upTo: 5_500, rate: 0.017 }, { upTo: 16_500, rate: 0.032 }, { upTo: 33_500, rate: 0.047 }, { upTo: 210_000, rate: 0.049 }, { upTo: Infinity, rate: 0.059 }],
      married: [{ upTo: 8_000, rate: 0.017 }, { upTo: 25_000, rate: 0.032 }, { upTo: 50_000, rate: 0.047 }, { upTo: 315_000, rate: 0.049 }, { upTo: Infinity, rate: 0.059 }],
    },
  },
  {
    code: 'NY', name: 'New York',
    standardDeduction: { single: 8_000, married: 16_050 },
    brackets: {
      single: [
        { upTo: 8_500, rate: 0.04 }, { upTo: 11_700, rate: 0.045 }, { upTo: 13_900, rate: 0.0525 },
        { upTo: 80_650, rate: 0.055 }, { upTo: 215_400, rate: 0.06 }, { upTo: 1_077_550, rate: 0.0685 },
        { upTo: 5_000_000, rate: 0.0965 }, { upTo: 25_000_000, rate: 0.103 }, { upTo: Infinity, rate: 0.109 },
      ],
      married: [
        { upTo: 17_150, rate: 0.04 }, { upTo: 23_600, rate: 0.045 }, { upTo: 27_900, rate: 0.0525 },
        { upTo: 161_550, rate: 0.055 }, { upTo: 323_200, rate: 0.06 }, { upTo: 2_155_350, rate: 0.0685 },
        { upTo: 5_000_000, rate: 0.0965 }, { upTo: 25_000_000, rate: 0.103 }, { upTo: Infinity, rate: 0.109 },
      ],
    },
    notes: 'NYC residents add 3.078–3.876% city tax (not modelled). Yonkers adds ~16.75% surcharge on state tax (not modelled).',
  },
  {
    code: 'ND', name: 'North Dakota',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single:  [{ upTo: 47_150, rate: 0 }, { upTo: 238_200, rate: 0.0195 }, { upTo: Infinity, rate: 0.025 }],
      married: [{ upTo: 78_775, rate: 0 }, { upTo: 289_975, rate: 0.0195 }, { upTo: Infinity, rate: 0.025 }],
    },
  },
  {
    code: 'OH', name: 'Ohio',
    standardDeduction: { single: 0, married: 0 },
    personalExemption: { single: 2_400, married: 4_800 },
    brackets: {
      single:  [{ upTo: 26_050, rate: 0 }, { upTo: 100_000, rate: 0.0275 }, { upTo: Infinity, rate: 0.035 }],
      married: [{ upTo: 26_050, rate: 0 }, { upTo: 100_000, rate: 0.0275 }, { upTo: Infinity, rate: 0.035 }],
    },
    notes: 'Local municipal income tax 1–3% (Cleveland, Columbus, Cincinnati, etc.) not modelled.',
  },
  {
    code: 'OK', name: 'Oklahoma',
    standardDeduction: { single: 6_350, married: 12_700 },
    personalExemption: { single: 1_000, married: 2_000 },
    brackets: {
      single:  [{ upTo: 1_000, rate: 0.0025 }, { upTo: 2_500, rate: 0.0075 }, { upTo: 3_750, rate: 0.0175 }, { upTo: 4_900, rate: 0.0275 }, { upTo: 7_200, rate: 0.0375 }, { upTo: Infinity, rate: 0.0475 }],
      married: [{ upTo: 2_000, rate: 0.0025 }, { upTo: 5_000, rate: 0.0075 }, { upTo: 7_500, rate: 0.0175 }, { upTo: 9_800, rate: 0.0275 }, { upTo: 12_200, rate: 0.0375 }, { upTo: Infinity, rate: 0.0475 }],
    },
  },
  {
    code: 'OR', name: 'Oregon',
    standardDeduction: { single: 2_745, married: 5_495 },
    brackets: {
      single:  [{ upTo: 4_300, rate: 0.0475 }, { upTo: 10_750, rate: 0.0675 }, { upTo: 125_000, rate: 0.0875 }, { upTo: Infinity, rate: 0.099 }],
      married: [{ upTo: 8_600, rate: 0.0475 }, { upTo: 21_500, rate: 0.0675 }, { upTo: 250_000, rate: 0.0875 }, { upTo: Infinity, rate: 0.099 }],
    },
    notes: 'Plus 0.1% statewide transit tax and Portland/Multnomah local taxes (not modelled).',
  },
  {
    code: 'RI', name: 'Rhode Island',
    standardDeduction: { single: 10_550, married: 21_150 },
    brackets: {
      single:  [{ upTo: 77_450, rate: 0.0375 }, { upTo: 176_050, rate: 0.0475 }, { upTo: Infinity, rate: 0.0599 }],
      married: [{ upTo: 77_450, rate: 0.0375 }, { upTo: 176_050, rate: 0.0475 }, { upTo: Infinity, rate: 0.0599 }],
    },
  },
  {
    code: 'SC', name: 'South Carolina',
    standardDeduction: { single: 14_600, married: 29_200 },
    brackets: {
      single:  [{ upTo: 3_460, rate: 0 }, { upTo: 17_330, rate: 0.03 }, { upTo: Infinity, rate: 0.064 }],
      married: [{ upTo: 3_460, rate: 0 }, { upTo: 17_330, rate: 0.03 }, { upTo: Infinity, rate: 0.064 }],
    },
  },
  {
    code: 'VT', name: 'Vermont',
    standardDeduction: { single: 7_400, married: 14_800 },
    personalExemption: { single: 5_000, married: 10_000 },
    brackets: {
      single:  [{ upTo: 47_900, rate: 0.0335 }, { upTo: 116_000, rate: 0.066 }, { upTo: 242_000, rate: 0.076 }, { upTo: Infinity, rate: 0.0875 }],
      married: [{ upTo: 80_200, rate: 0.0335 }, { upTo: 194_000, rate: 0.066 }, { upTo: 295_750, rate: 0.076 }, { upTo: Infinity, rate: 0.0875 }],
    },
  },
  {
    code: 'VA', name: 'Virginia',
    standardDeduction: { single: 8_500, married: 17_000 },
    personalExemption: { single: 930, married: 1_860 },
    brackets: {
      single:  [{ upTo: 3_000, rate: 0.02 }, { upTo: 5_000, rate: 0.03 }, { upTo: 17_000, rate: 0.05 }, { upTo: Infinity, rate: 0.0575 }],
      married: [{ upTo: 3_000, rate: 0.02 }, { upTo: 5_000, rate: 0.03 }, { upTo: 17_000, rate: 0.05 }, { upTo: Infinity, rate: 0.0575 }],
    },
  },
  {
    code: 'WV', name: 'West Virginia',
    standardDeduction: { single: 0, married: 0 },
    personalExemption: { single: 2_000, married: 4_000 },
    brackets: {
      single:  [{ upTo: 10_000, rate: 0.0236 }, { upTo: 25_000, rate: 0.0315 }, { upTo: 40_000, rate: 0.0354 }, { upTo: 60_000, rate: 0.0472 }, { upTo: Infinity, rate: 0.0512 }],
      married: [{ upTo: 10_000, rate: 0.0236 }, { upTo: 25_000, rate: 0.0315 }, { upTo: 40_000, rate: 0.0354 }, { upTo: 60_000, rate: 0.0472 }, { upTo: Infinity, rate: 0.0512 }],
    },
  },
  {
    code: 'WI', name: 'Wisconsin',
    standardDeduction: { single: 13_230, married: 24_490 },
    brackets: {
      single:  [{ upTo: 14_320, rate: 0.035 }, { upTo: 28_640, rate: 0.044 }, { upTo: 315_310, rate: 0.053 }, { upTo: Infinity, rate: 0.0765 }],
      married: [{ upTo: 19_090, rate: 0.035 }, { upTo: 38_190, rate: 0.044 }, { upTo: 420_420, rate: 0.053 }, { upTo: Infinity, rate: 0.0765 }],
    },
  },
];

export const US_STATE_BY_CODE: Record<string, StateTaxConfig> = Object.fromEntries(
  US_STATES.map((s) => [s.code, s]),
);

export function calculateStateTax(
  stateCode: string,
  taxableIncomeForState: number,
  filingStatus: FilingStatus,
): number {
  const cfg = US_STATE_BY_CODE[stateCode];
  if (!cfg) return 0;

  const stdDed = cfg.standardDeduction[filingStatus] ?? 0;
  const exemption = cfg.personalExemption?.[filingStatus] ?? 0;
  const taxable = Math.max(0, taxableIncomeForState - stdDed - exemption);

  let tax = 0;
  let prevLimit = 0;
  for (const band of cfg.brackets[filingStatus]) {
    if (taxable <= prevLimit) break;
    const inBand = Math.min(taxable, band.upTo) - prevLimit;
    tax += inBand * band.rate;
    prevLimit = band.upTo;
  }
  return Math.max(0, tax);
}
