import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronRight } from 'lucide-react';
import MarketingNav from '@/components/marketing/MarketingNav';
import { applySeo } from '@/lib/seo';
import { GUIDES_SEO } from '@/lib/guide-seo-data';

interface GuideLayoutProps {
  title: string;
  description: string;
  breadcrumbLabel: string;
  /** ISO date the guide was first published, e.g. '2025-01-15'. Used in JSON-LD Article schema. */
  datePublished?: string;
  /** ISO date the guide was last updated. Falls back to datePublished. */
  dateModified?: string;
  children: ReactNode;
}

const ORG_NAME = 'Payslip Insights';
const DEFAULT_DATE_PUBLISHED = '2025-01-01';

const GuideLayout = ({
  title,
  description,
  breadcrumbLabel,
  datePublished = DEFAULT_DATE_PUBLISHED,
  dateModified,
  children,
}: GuideLayoutProps) => {
  const location = useLocation();
  const indexedGuide = GUIDES_SEO.find((guide) => guide.path === location.pathname);
  const seoTitle = indexedGuide?.title ?? title;
  const seoDescription = indexedGuide?.description ?? description;
  const seoDatePublished = indexedGuide?.datePublished ?? datePublished;
  const seoDateModified = indexedGuide?.dateModified ?? dateModified ?? seoDatePublished;

  useEffect(() => {
    const url = window.location.origin + location.pathname;
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: seoTitle,
      description: seoDescription,
      datePublished: seoDatePublished,
      dateModified: seoDateModified,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: { '@type': 'Organization', name: ORG_NAME, url: window.location.origin },
      publisher: {
        '@type': 'Organization',
        name: ORG_NAME,
        url: window.location.origin,
      },
      inLanguage: 'en',
    };

    applySeo({
      title: `${seoTitle} | Payslip Insights`,
      description: seoDescription,
      canonicalPath: location.pathname,
      jsonLd: articleSchema,
    });
  }, [location.pathname, seoTitle, seoDescription, seoDatePublished, seoDateModified]);

  return (
    <div className="min-h-screen bg-card">
      <MarketingNav active="guides" />

      {/* Breadcrumbs */}
      <div className="container pt-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/guides" className="hover:text-foreground">Guides</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{breadcrumbLabel}</span>
        </nav>
      </div>

      <main className="container max-w-3xl py-10 md:py-14">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container py-8 text-center text-xs text-muted-foreground">
          <p>
            Payslip Insights provides guidance and issue spotting, not formal tax, payroll, or legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default GuideLayout;
