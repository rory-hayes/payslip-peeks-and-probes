# Product

## Product Description
PayCheck helps employees understand payslips, store them securely, spot unexpected pay changes, and draft clear payroll queries. The app combines a self-serve payslip vault, AI-assisted extraction, country-aware expected-pay calculations, anomaly detection, and lightweight billing.

## Target User
- Employees in the UK, Ireland, Germany, France, Netherlands, Spain, Italy, Belgium, Portugal, and possibly the US.
- Users who receive PDF or image payslips and want a private record plus a second pair of eyes on tax, pension, social security, and net pay changes.
- Early adopters who are willing to review extracted fields before relying on results.

## Core Pain Point
Payslips are hard to interpret, payroll errors are easy to miss, and employees often do not know what changed or how to raise a clear query with payroll.

## Value Proposition
Upload a payslip, get the important figures extracted, see what changed, and receive plain-language guidance plus a payroll email draft when something looks wrong.

## MVP Scope
- Public marketing, pricing, legal, guides, and calculators.
- Email/password auth and Google OAuth.
- Onboarding profile for country, salary, employer, pay frequency, deductions, and anomaly sensitivity.
- Authenticated dashboard and payslip vault.
- Payslip upload to Supabase Storage.
- AI extraction through Supabase Edge Functions.
- Manual review for low-confidence or inconsistent extraction.
- Month-to-month comparison and anomaly list.
- Draft payroll query generation and persistence.
- Basic free vs premium usage limits and Stripe checkout.
- Settings for profile updates, billing portal, data export, and account deletion.

## Non-Goals For MVP
- Employer/payroll team collaboration.
- Direct email sending from the app.
- Formal payroll, tax, legal, or financial advice.
- Full accounting/payroll system replacement.
- Multi-tenant employer workspaces.
- Admin console unless needed for support and abuse triage.

## Key User Journeys
- Visitor reads the landing page, tries demo mode, then signs up.
- User signs up, completes onboarding, and uploads a first payslip.
- App extracts fields, asks for manual review when needed, then stores the payslip.
- User sees latest gross/net pay, deduction trends, expected-vs-actual pay, and anomalies.
- User opens an anomaly, marks it reviewed/raised/resolved, and drafts a payroll email.
- Free user reaches monthly limits and upgrades through pricing/checkout.
- User exports their data or deletes their account from settings.

## Acceptance Criteria
- Users can create an account and access protected routes only after auth.
- New users are routed to onboarding until `profiles.onboarding_complete` is true.
- Users can upload PDF/PNG/JPEG/WebP payslips under 10 MB.
- Uploaded payslips are stored under the user's storage prefix and readable only by that user.
- Extraction saves a payslip row, extraction row, and any anomaly rows tied to that user.
- Low-confidence or inconsistent extractions move into a review state.
- Dashboard does not crash with zero payslips.
- Billing state unlocks premium usage limits only after subscription/payment is confirmed.
- Account deletion removes user-owned app data and storage files.
- All P0 roadmap tasks are complete before calling the app production-ready.

## Handoff Findings
No dedicated `/handoff` route, handoff page, or handoff markdown was found. The search covered likely route locations and keywords including `handoff`, `MVP`, `acceptance criteria`, `user flow`, `data model`, `requirements`, and `Lovable`.

Lovable artifacts found:
- `README.md` was the default Lovable placeholder before this audit.
- `src/integrations/lovable/index.ts` is auto-generated and wraps Google OAuth.
- `vite.config.ts` uses `lovable-tagger` in development.
- Supabase functions use Lovable AI and Stripe connector gateway URLs.
- `src/pages/Index.tsx` is an unused Lovable blank-page placeholder.

## Product Assumptions To Validate
- Brand naming: UI uses `PayCheck`, metadata uses `Payslip Insights`, and comments mention `paycheckinsights.com`.
- Country scope: marketing claims US support, calculators include US, but the database country constraint does not include US.
- AI extraction accuracy is good enough only with manual review and clear confidence handling.
- Users will accept copy-to-clipboard payroll drafts instead of integrated sending.
- Free limits of 3 uploads and 2 drafts per month are commercially appropriate.
- Lovable gateway dependencies are acceptable for production, or should be replaced.
