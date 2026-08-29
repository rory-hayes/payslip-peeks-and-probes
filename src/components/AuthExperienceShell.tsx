import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Check, FileCheck2, LockKeyhole, ScanLine } from 'lucide-react';
import { BrandLockup } from '@/components/BrandLockup';
import payslipCheckHero from '@/assets/option-one-payslip-check-hero-v1.webp';

type AuthExperienceShellProps = {
  children: ReactNode;
  mode?: 'account' | 'preview';
};

const AUTH_OUTCOMES = [
  {
    icon: ScanLine,
    title: 'Confirm the figures',
    description: 'Review what was found against the payslip you uploaded.',
  },
  {
    icon: FileCheck2,
    title: 'See what changed',
    description: 'Use your first two checks to unlock a real payday comparison.',
  },
  {
    icon: Check,
    title: 'Know what to do next',
    description: 'Keep the evidence and prepare a clear question for payroll.',
  },
] as const;

const PREVIEW_OUTCOMES = [
  {
    icon: ScanLine,
    title: 'Explore a complete sample',
    description: 'Review a UK payslip journey without sharing a document.',
  },
  {
    icon: FileCheck2,
    title: 'See the comparison clearly',
    description: 'Follow the figures from payday through year-to-date history.',
  },
  {
    icon: Check,
    title: 'Try the tax-year helper',
    description: 'Switch between the official HMRC and Revenue checklists.',
  },
] as const;

/**
 * Shared account-entry frame. The form stays first in the reading order while
 * the wider layout puts the product promise beside it on larger screens.
 */
export function AuthExperienceShell({ children, mode = 'account' }: AuthExperienceShellProps) {
  const isPreview = mode === 'preview';
  const outcomes = isPreview ? PREVIEW_OUTCOMES : AUTH_OUTCOMES;

  return (
    <main className="min-h-screen bg-[#f6f7fc] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#ebe9f6] bg-white shadow-[0_24px_80px_rgba(23,21,93,0.10)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.02fr_0.98fr]">
        <section className="order-1 flex items-center justify-center px-5 py-8 sm:px-10 lg:order-2 lg:px-14 lg:py-12">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-8 inline-flex lg:hidden" aria-label="Payslip Insights home">
              <BrandLockup />
            </Link>
            {children}
            <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-[#f6f7fc] px-4 py-3 text-xs leading-5 text-[#64658d]">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#17155d]" aria-hidden="true" />
              <p>
                {isPreview
                  ? 'The preview uses sample data. Do not upload, paste or email a real payslip while secure uploads are closed.'
                  : 'Your payslip stays private to your account. Findings are guidance and issue spotting, not tax or legal advice.'}
              </p>
            </div>
          </div>
        </section>

        <aside
          aria-label="Why people use Payslip Insights"
          className="order-2 relative overflow-hidden bg-[#17155d] px-6 py-9 text-white sm:px-10 lg:order-1 lg:px-12 lg:py-12"
        >
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#55e4e8]/25 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#8b73ff]/25 blur-3xl" aria-hidden="true" />

          <div className="relative z-10 flex h-full flex-col">
            <Link to="/" className="hidden w-fit lg:inline-flex" aria-label="Payslip Insights home">
              <BrandLockup className="[&>span]:text-white" />
            </Link>

            <div className="my-auto max-w-lg py-2 lg:py-10">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#73f0f2]">
                {isPreview ? 'Product preview' : 'Your private payday companion'}
              </p>
              <p className="max-w-md text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-5xl">
                {isPreview ? 'See the full journey. No document needed.' : 'Know what changed. Keep the evidence.'}
              </p>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/72 sm:text-base">
                {isPreview
                  ? 'The sample experience is open while real-account uploads finish their production release checks.'
                  : 'Two automatic checks are included on Free—enough to understand your first payslip and compare the next one.'}
              </p>

              <div className="mt-8 grid gap-3">
                {outcomes.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="flex gap-3 rounded-2xl border border-white/12 bg-white/[0.07] p-3.5 backdrop-blur-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#73f0f2] text-[#17155d]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-white/65">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-8 hidden min-h-36 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#e9fbfc] sm:block lg:mt-0">
              <div className="relative z-10 max-w-[58%] p-5 text-[#17155d]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6d52e6]">UK &amp; Ireland</p>
                <p className="mt-2 text-lg font-black leading-tight">Built for PAYE, PRSI, USC and NI payslips.</p>
              </div>
              <img
                src={payslipCheckHero}
                alt="Illustration of a payslip being reviewed"
                className="absolute -bottom-12 -right-3 w-48 rotate-[-2deg] lg:w-52"
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
