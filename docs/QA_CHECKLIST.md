# QA Checklist

## Smoke Test Checklist
- Install dependencies with `npm install`.
- Start dev server with `npm run dev`.
- Confirm `/` returns the app shell.
- Run `npm run build`.
- Run `npm test`.
- Run `npx tsc --noEmit`.
- Run `npm run lint` and record current failures until fixed.

## Critical User Journey Tests
- Visitor can open landing, pricing, guides, calculators, privacy, and terms.
- Visitor can enter demo mode and see sample dashboard data.
- User can sign up with email/password.
- New authenticated user is redirected to onboarding.
- User can complete onboarding and land in the vault/dashboard.
- User can upload a valid payslip file.
- User can review low-confidence extraction results.
- User can open a payslip detail page and compare it with a previous payslip.
- User can review anomaly statuses.
- User can draft and copy a payroll query.
- User can export account data.
- User can delete account data.

## Auth Tests
- Protected routes redirect unauthenticated users to `/sign-in`.
- Completed onboarding users can access dashboard routes.
- Incomplete onboarding users are redirected to `/onboarding`.
- Sign out clears session and returns to public app.
- Google OAuth callback sets a Supabase session.
- Reset password flow reaches `/reset-password` and updates password.

## Data Persistence Tests
- Profile updates persist and rehydrate.
- Employer rows are created/updated consistently.
- Payslip upload creates `payslips` and `payslip_extractions` rows.
- Extraction updates status and numeric fields correctly.
- Anomaly status updates persist.
- Draft autosave persists subject/body.
- Account export includes only user-owned rows.
- Account deletion removes rows and storage files.

## Route Protection Tests
- `/dashboard`, `/vault`, `/payslip/:id`, `/compare`, `/anomalies`, `/draft/:id`, `/settings`, `/checkout`, and `/checkout/return` require auth.
- Demo mode grants dashboard only and redirects other protected routes back to dashboard.
- Supabase RLS prevents cross-user reads even if a route is guessed.

## Form Validation Tests
- Signup requires first name, email, password, and terms acceptance.
- Password minimums and reset validation work.
- Onboarding blocks required country, sub-region, filing status, frequency, employer, and threshold steps.
- Upload blocks unsupported file types and files over 10 MB.
- Review save requires pay date, gross pay, and net pay.
- Settings numeric fields handle invalid or empty values.
- Delete account requires exact confirmation string.

## Responsive Checks
- Landing hero and navigation on mobile and desktop.
- Sidebar-to-sheet navigation transition.
- Dashboard cards and charts on mobile.
- Vault list and upload panel on mobile.
- Compare grid on narrow viewports.
- Settings forms and destructive account deletion dialog.

## Accessibility Checks
- Keyboard navigation through public nav, auth forms, onboarding, upload, and settings.
- Focus ring visible on all interactive controls.
- Dialogs and sheets trap focus and have labels.
- Icon-only buttons have accessible names.
- Charts have surrounding text that communicates key results.
- Color is not the only indicator of anomaly severity.

## Deployment Checks
- Production build emits expected static assets.
- Supabase migrations apply to a fresh project.
- Supabase generated types match the deployed schema.
- Supabase Edge Functions deploy and have required secrets.
- Stripe webhooks are verified in sandbox and live routes.
- Canonical domain, sitemap, robots, and metadata are consistent.
- Storage bucket and RLS policies are present.

## Regression Checklist
- `npm install`
- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- Manual smoke through auth, onboarding, upload, anomaly, draft, billing, export, and delete flows after P0 fixes.
