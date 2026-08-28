import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BRAND_MARK_PATH } from '@/lib/brand-assets';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

/**
 * A private-document product should fail closed to a calm recovery screen,
 * rather than a blank page or a framework stack trace. We deliberately do not
 * display the error message because it can contain provider or document data.
 */
export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Keep the thrown error and its component stack out of telemetry: either
    // can contain private document or provider details. The generic event is
    // still useful for an authenticated user's support and operations trail.
    // Importing the logger only after an error keeps its Supabase dependency
    // out of the critical public route bundle. Failure reporting is best
    // effort, so an unavailable module must not disturb the recovery screen.
    void import('@/lib/logger')
      .then(({ logError }) => logError('app_render_error', 'A page failed to render'))
      .catch(() => {});
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-center">
        <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
          <img alt="Payslip Insights" className="mx-auto h-10 w-10" src={BRAND_MARK_PATH} />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">Let&apos;s get you back on track.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This page did not load as expected. Your payslip details have not been shown here. Refresh the page, or return home and try again.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            If it keeps happening, <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:support@payslipinsights.com">contact support</a> — please do not attach or paste your payslip into an email.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => window.location.reload()} type="button">
              Refresh page
            </button>
            <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href="/">
              Return home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
