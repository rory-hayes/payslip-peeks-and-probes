/**
 * Single source of truth for guide SEO metadata.
 *
 * Used at runtime by GuideLayout (client-side updates) AND at build time by the
 * `prerender-guides` Vite plugin (bakes meta tags + JSON-LD Article schema into
 * the static HTML so Googlebot and AI crawlers see them on first byte).
 */

export interface GuideSeo {
  /** URL path, no leading site, no trailing slash, e.g. "/guides/uk-payslip-guide" */
  path: string;
  title: string;
  description: string;
  /** ISO date the guide was first published. */
  datePublished: string;
  /** ISO date the guide was last updated. Falls back to datePublished. */
  dateModified?: string;
}

export const SITE_ORIGIN = 'https://payslipinsights.com';
export const ORG_NAME = 'Payslip Insights';
export const TITLE_SUFFIX = ' | Payslip Insights';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-default.png`;

export const GUIDES_SEO: GuideSeo[] = [
  {
    path: '/guides/how-to-check-your-payslip',
    title: 'How to Check Your Payslip',
    description:
      "A plain-English walk-through of every line on your payslip, what to compare each month, and the red flags worth checking with payroll.",
    datePublished: '2025-01-10',
  },
  {
    path: '/guides/why-did-my-net-pay-go-down',
    title: 'Why Did My Net Pay Go Down?',
    description:
      "The common reasons your take-home pay changes month to month, when it's normal, and when it's worth checking.",
    datePublished: '2025-01-12',
  },
  {
    path: '/guides/common-payslip-mistakes',
    title: 'Common Payslip Mistakes to Watch For',
    description:
      'The most common payslip issues we see across UK and Ireland employees, with what to check for each one before contacting payroll.',
    datePublished: '2025-01-14',
  },
  {
    path: '/guides/compare-two-payslips',
    title: 'How to Compare Two Payslips Properly',
    description:
      "A line-by-line approach to comparing this month's payslip with last month, and how Payslip Insights makes it automatic.",
    datePublished: '2025-01-16',
  },
  {
    path: '/guides/uk-payslip-guide',
    title: 'UK Payslip Guide',
    description:
      'Tax codes, National Insurance, pension and the parts of a UK payslip every employee should understand.',
    datePublished: '2025-02-01',
  },
  {
    path: '/guides/ireland-payslip-guide',
    title: 'Ireland Payslip Guide',
    description:
      'PAYE, PRSI and USC explained in plain English for Ireland-based employees, with the issues most often worth checking.',
    datePublished: '2025-02-08',
  },
  {
    path: '/guides/germany-payslip-guide',
    title: 'Germany Payslip Guide',
    description:
      'Lohnsteuer, Sozialversicherung and Solidaritätszuschlag explained in plain English for Germany-based employees, with the issues most often worth checking.',
    datePublished: '2025-02-15',
  },
  {
    path: '/guides/france-payslip-guide',
    title: 'France Payslip Guide',
    description:
      'Prélèvement à la source, cotisations sociales and AGIRC-ARRCO explained in plain English for France-based employees, with the issues most often worth checking.',
    datePublished: '2025-02-22',
  },
  {
    path: '/guides/netherlands-payslip-guide',
    title: 'Netherlands Payslip Guide',
    description:
      'Loonheffing, heffingskorting and vakantiegeld explained in plain English for Netherlands-based employees, with the issues most often worth checking.',
    datePublished: '2025-03-01',
  },
  {
    path: '/guides/spain-payslip-guide',
    title: 'Spain Payslip Guide',
    description:
      'IRPF, Seguridad Social and bases de cotización explained in plain English for Spain-based employees, with the issues most often worth checking.',
    datePublished: '2025-03-08',
  },
  {
    path: '/guides/italy-payslip-guide',
    title: 'Italy Payslip Guide',
    description:
      'IRPEF, INPS, addizionali and TFR explained in plain English for Italy-based employees, with the issues most often worth checking.',
    datePublished: '2025-03-15',
  },
  {
    path: '/guides/belgium-payslip-guide',
    title: 'Belgium Payslip Guide',
    description:
      'Précompte professionnel, ONSS / RSZ and pécule de vacances explained in plain English for Belgium-based employees, with the issues most often worth checking.',
    datePublished: '2025-03-22',
  },
  {
    path: '/guides/portugal-payslip-guide',
    title: 'Portugal Payslip Guide',
    description:
      'IRS, Segurança Social and subsídios explained in plain English for Portugal-based employees, with the issues most often worth checking.',
    datePublished: '2025-04-01',
  },
  {
    path: '/guides/us-payslip-guide',
    title: 'US Payslip Guide',
    description:
      'Federal Withholding, FICA (OASDI + Medicare), state tax and pre-tax 401(k)/HSA/FSA explained for US employees on ADP, Gusto and Paychex.',
    datePublished: '2025-04-15',
  },
];

export function buildArticleJsonLd(g: GuideSeo): Record<string, unknown> {
  const url = SITE_ORIGIN + g.path;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    datePublished: g.datePublished,
    dateModified: g.dateModified ?? g.datePublished,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: ORG_NAME, url: SITE_ORIGIN },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: SITE_ORIGIN,
    },
    inLanguage: 'en',
  };
}
