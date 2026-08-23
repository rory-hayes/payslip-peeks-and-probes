export interface MarketingPageSeo {
  path: string;
  title: string;
  description: string;
  jsonLd: Record<string, unknown>;
}

const SITE_ORIGIN = 'https://payslipinsights.com';

/**
 * The indexable public pages are deliberately kept separate from account,
 * recovery, calculator-holding, and private product routes. This data is used
 * both by the SPA and the static HTML prerender so crawlers see the same title,
 * description, canonical path, and structured data before JavaScript runs.
 */
export const INDEXABLE_MARKETING_PAGES: readonly MarketingPageSeo[] = [
  {
    path: '/',
    title: 'Payslip Insights — Understand your payslip, plan your payday',
    description: 'Upload your payslip, review its figures, spot changes worth checking, and plan to your next payday. Built for UK and Ireland employees.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Payslip Insights',
      url: 'https://payslipinsights.com/',
    },
  },
  {
    path: '/pricing',
    title: 'Pricing | Payslip Insights',
    description: 'Compare Free, Plus, and Lifetime plans for Payslip Insights. Review payslips, track confirmed pay, and plan to your next payday.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Payslip Insights pricing',
    },
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | Payslip Insights',
    description: 'How Payslip Insights handles account information, payslips, confirmed figures, and planning data for UK and Ireland employees.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Payslip Insights privacy policy',
    },
  },
  {
    path: '/terms',
    title: 'Terms of Service | Payslip Insights',
    description: 'Terms for using Payslip Insights to review payslips, track confirmed figures, and make a personal payday plan.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Payslip Insights terms of service',
    },
  },
  {
    path: '/guides',
    title: 'Payslip Guides for UK & Ireland Employees | Payslip Insights',
    description: 'Plain-English guides to help UK and Ireland employees understand payslips, compare month-to-month changes, and spot issues worth checking.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Payslip guides for UK and Ireland employees',
    },
  },
];

/**
 * Add the canonical public URL at the point where structured data is consumed.
 * Keeping this next to the route whitelist means the build-time HTML and the
 * SPA both advertise the same page identity.
 */
export function buildMarketingJsonLd(page: MarketingPageSeo): Record<string, unknown> {
  return {
    ...page.jsonLd,
    url: `${SITE_ORIGIN}${page.path}`,
  };
}

export function marketingSeoFor(path: string): Omit<MarketingPageSeo, 'path'> & { canonicalPath: string } {
  const page = INDEXABLE_MARKETING_PAGES.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`No indexable marketing SEO metadata exists for ${path}.`);

  const { path: canonicalPath, jsonLd: _jsonLd, ...seo } = page;
  return { ...seo, canonicalPath, jsonLd: buildMarketingJsonLd(page) };
}
