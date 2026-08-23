import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import GuideLayout from './GuideLayout';

const MANAGED_SCHEMA_ID = 'paycheck-jsonld';
const STATIC_SCHEMA_ID = 'prerendered-seo-schema';

function schema() {
  const content = document.getElementById(MANAGED_SCHEMA_ID)?.textContent;
  if (!content) throw new Error('Expected guide structured data.');
  return JSON.parse(content) as Record<string, unknown>;
}

function removeGuideHeadTags() {
  [
    'description',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
    'twitter:image:alt',
    'robots',
  ].forEach((name) => document.head.querySelector(`meta[name="${name}"]`)?.remove());
  [
    'og:title',
    'og:description',
    'og:type',
    'og:url',
    'og:image',
    'og:image:width',
    'og:image:height',
    'og:image:alt',
  ].forEach((property) => document.head.querySelector(`meta[property="${property}"]`)?.remove());
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.getElementById(MANAGED_SCHEMA_ID)?.remove();
  document.getElementById(STATIC_SCHEMA_ID)?.remove();
  document.getElementById('prerendered-article-schema')?.remove();
}

const FirstGuide = () => (
  <GuideLayout
    title="Fallback title that must not win"
    description="Fallback description that must not win"
    breadcrumbLabel="How to Check Your Payslip"
  >
    <h1>How to Check Your Payslip</h1>
    <Link to="/guides/why-did-my-net-pay-go-down">Open the next guide</Link>
  </GuideLayout>
);

const SecondGuide = () => (
  <GuideLayout
    title="Second fallback title that must not win"
    description="Second fallback description that must not win"
    breadcrumbLabel="Why Did My Net Pay Go Down?"
  >
    <h1>Why Did My Net Pay Go Down?</h1>
  </GuideLayout>
);

describe('GuideLayout SEO handoff', () => {
  afterEach(() => {
    cleanup();
    removeGuideHeadTags();
  });

  it('replaces build-time schema and refreshes canonical article data after guide navigation', async () => {
    const staticSchema = document.createElement('script');
    staticSchema.id = STATIC_SCHEMA_ID;
    staticSchema.type = 'application/ld+json';
    staticSchema.textContent = '{"headline":"Stale guide"}';
    document.head.appendChild(staticSchema);

    render(
      <MemoryRouter initialEntries={['/guides/how-to-check-your-payslip']}>
        <Routes>
          <Route path="/guides/how-to-check-your-payslip" element={<FirstGuide />} />
          <Route path="/guides/why-did-my-net-pay-go-down" element={<SecondGuide />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.getElementById(STATIC_SCHEMA_ID)).toBeNull());
    expect(schema()).toMatchObject({
      headline: 'How to Check Your Payslip',
      datePublished: '2025-01-10',
      dateModified: '2025-01-10',
    });
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${window.location.origin}/guides/how-to-check-your-payslip`);

    fireEvent.click(screen.getByRole('link', { name: 'Open the next guide' }));

    await waitFor(() => expect(schema()).toMatchObject({
      headline: 'Why Did My Net Pay Go Down?',
      datePublished: '2025-01-12',
      dateModified: '2025-01-12',
    }));
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${window.location.origin}/guides/why-did-my-net-pay-go-down`);
    expect(document.getElementById(STATIC_SCHEMA_ID)).toBeNull();
  });
});
