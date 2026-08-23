import { useEffect } from 'react';
import { Link } from "react-router";
import { applySeo } from '@/lib/seo';

const NotFound = () => {
  useEffect(() => {
    applySeo({
      title: 'Page not found | Payslip Insights',
      description: 'The page you requested is not available.',
      canonicalPath: null,
      noIndex: true,
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm" aria-labelledby="not-found-heading">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">404</p>
        <h1 id="not-found-heading" className="mt-3 text-3xl font-semibold tracking-tight text-foreground">We can&apos;t find that page.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          It may have moved, or the link may be incomplete. Your account and payslip details are unchanged.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Return home
        </Link>
      </section>
    </main>
  );
};

export default NotFound;
