# ROADMAP.md

Last updated: 2026-05-09

## 1. Product Summary

PayCheck is a Vite React SaaS application for employees who want to upload payslips, extract pay and tax figures, compare pay over time, detect anomalies, and draft payroll questions. The repository presents a self-serve payslip vault with authentication, onboarding, payslip upload, AI-assisted extraction, dashboards, anomaly review, draft payroll queries, subscription limits, settings, export, and account deletion.

The core intended journey is:

1. A user signs up or signs in.
2. They complete onboarding with country, employer, currency, and notification preferences.
3. They upload payslip files.
4. The app stores the files and calls a Supabase Edge Function to extract structured pay data.
5. The user reviews extracted figures, trends, anomalies, and draft payroll queries.
6. Usage limits and subscription state control premium capabilities.
7. The user can export data or delete their account.

The repo is beyond a static prototype, but it is not yet a credible production MVP. Several core flows exist in code, but security, validation, test coverage, dependency health, RLS verification, country support consistency, deployment, and production ownership of Lovable/Stripe/AI integrations still need focused work.

## 2. Current Implementation Status

### Authentication

Status: Partially Implemented

Supabase email/password auth is implemented through `src/contexts/AuthContext.tsx`, with sign up, sign in, sign out, password reset, session loading, and auth state subscription. `src/components/ProtectedRoute.tsx` gates app routes client-side and redirects unauthenticated users to `/sign-in`. Demo mode is also supported.

Remaining gaps:

- Client-side route protection is not a security boundary.
- Server-side ownership/RLS coverage needs verification.
- Auth smoke tests are missing for protected routes and onboarding redirects.
- OAuth is present through generated Lovable integration code, but production ownership and provider behavior are unclear.

### Core User Flows

Status: Partially Implemented

Implemented routes include landing, sign in, sign up, password reset, onboarding, dashboard, vault, payslip detail, compare, anomalies, draft query, settings, pricing, checkout, and checkout return. `src/components/PayslipUpload.tsx` uploads files to Supabase Storage, inserts payslip records, creates extraction records, and invokes the `process-payslip` Edge Function.

Remaining gaps:

- Upload failure states can be misleading: extraction invocation failures are surfaced as "upload complete" and may show success even when processing did not start or failed.
- End-to-end signup, onboarding, upload, extraction, review, billing, export, and delete flows have not been proven locally.
- Some routes rely on live Supabase, Lovable, Stripe, or AI gateway behavior that is not covered by tests.

### UI / UX

Status: Partially Implemented

The app uses Tailwind, shadcn/Radix components, lucide icons, dense dashboard layouts, public guides/calculators, and multiple empty/loading/error states. The product surface is substantial for a Lovable-migrated SaaS app.

Remaining gaps:

- There are likely inconsistent empty/error states across upload, extraction, billing, and account deletion flows.
- Some Lovable starter artifacts remain, including unused placeholder files.
- Accessibility and responsive behavior are not covered by automated or documented manual tests.
- Country support messaging is inconsistent, especially around United States support.

### Data Model

Status: Partially Implemented

Supabase migrations and generated types define users/profiles, payslips, payslip extractions, anomalies, subscription/billing tables, usage events, and deletion/export-related structures. The frontend data layer uses hooks under `src/hooks/`, especially `use-payslip-data`, `use-profile`, `use-subscription`, `use-usage`, and `use-anomaly-status`.

Remaining gaps:

- Fresh migration application has not been verified in this audit.
- Generated Supabase types need to be confirmed against the actual schema.
- RLS and storage policies need tests for cross-user access denial.
- Several frontend hooks and functions still use `any`, weakening data safety.
- Database country constraints and extraction support do not fully match public UI country claims.

### API / Backend

Status: Partially Implemented

The backend is mainly Supabase Edge Functions:

- `process-payslip`
- `demo-extract-payslip`
- `create-checkout`
- `create-portal-session`
- `get-stripe-price`
- `payments-webhook`
- `cancel-subscription-on-delete`

Several functions perform manual auth checks, rate limiting, storage access, Stripe connector calls, Lovable AI gateway calls, and database updates.

Remaining gaps:

- Several functions have `verify_jwt = false` and rely on manual checks. This can be valid, but must be tested carefully.
- AI extraction responses are parsed from generated JSON but are not guarded by a shared strict runtime schema.
- Edge Function lint/type quality is not production-grade.
- Error envelopes and retry behavior are inconsistent.

### Integrations

Status: Partially Implemented

Supabase, Lovable AI gateway, Lovable Stripe connector, Stripe webhook verification, generated Lovable auth integration, PostHog environment placeholders, and Google command-centre export support are present.

Remaining gaps:

- Production ownership of Lovable gateway/connector services is unclear.
- Stripe sandbox and live webhook flows need manual verification.
- AI provider cost, latency, retries, schema validation, and observability are not mature.
- Command-centre and Linear exports exist locally, but Linear issue creation was blocked by workspace issue limits.

### Testing

Status: Partially Implemented

Vitest is configured. Current tests cover a placeholder example, account deletion ordering, checkout return success behavior, and draft query insertion behavior.

Known validation status from `project-status.json`:

- `npm install`: passed, but refreshed `package-lock.json` and found vulnerabilities.
- `npm run lint`: failed with existing lint errors and warnings.
- `npx tsc --noEmit`: passed.
- `npm test`: passed, 4 files and 5 tests.
- `npm run build`: passed with bundle and Browserslist warnings.
- `npm audit --omit=dev --json`: failed due to production vulnerabilities.
- Dev server smoke: passed on a fallback port.

Remaining gaps:

- Lint does not pass.
- There is no meaningful E2E coverage.
- Auth, route protection, upload, extraction, anomaly, billing, export, and delete flows need tests.
- Supabase RLS/storage policies are not verified by automated tests.

### Deployment

Status: Missing

The app is deployable in principle as a Vite static frontend with Supabase backend functions, but there is no committed production deployment target, CI/CD workflow, preview deployment process, environment setup checklist, or production runbook.

Remaining gaps:

- No GitHub Actions workflow.
- No Vercel/Netlify/Render deployment config.
- No verified production environment variable process.
- No migration/function deployment checklist proven against a clean environment.

### Observability / Logging

Status: Partially Implemented

There is a `src/lib/logging.ts` helper and console/error logging in some frontend and Edge Function code. PostHog environment variables are documented as optional.

Remaining gaps:

- No configured error tracking.
- No structured production logs across frontend and Edge Functions.
- No AI extraction latency/cost/failure metrics.
- No alerts, health checks, or incident/debug runbook.
- PII redaction needs verification.

### Security

Status: Partially Implemented

The repo includes Supabase auth, intended RLS, manual Edge Function auth checks, Stripe webhook signature verification, upload file validation, rate limits in AI functions, and account deletion support.

Remaining gaps:

- `.env`, `.env.development`, and `.env.production` are tracked in git history.
- Production dependency audit reports high-severity vulnerabilities.
- RLS/storage/function authorization needs targeted verification.
- Public webhook and checkout functions require stronger regression coverage.
- AI extraction stores sensitive payslip data and needs strict PII handling, retention, and logging rules.

## 3. Repository Architecture

### Frontend Framework

The app is a Vite + React + TypeScript SPA. Routing is centralized in `src/App.tsx` with `react-router-dom`. UI components use Tailwind CSS, shadcn/Radix primitives under `src/components/ui`, lucide-react icons, Recharts, and custom page/components modules.

### Backend / API Structure

There is no traditional Node server in the repo. Backend behavior lives in Supabase:

- Browser client: `src/integrations/supabase/client.ts`
- Generated database types: `src/integrations/supabase/types.ts`
- Migrations: `supabase/migrations`
- Edge Functions: `supabase/functions`
- Shared function helpers: `supabase/functions/_shared`

### State Management

The app uses:

- React context for auth in `src/contexts/AuthContext.tsx`
- React context for demo mode in `src/contexts/DemoContext.tsx`
- TanStack Query for server/cache state
- Local component state for route-level interactions

There is no global Redux/Zustand-style store.

### Auth Approach

Supabase Auth is the primary auth provider. Sessions are persisted by the Supabase browser client. `ProtectedRoute` guards authenticated routes and onboarding completion. Generated Lovable OAuth glue code exists in `src/integrations/lovable/index.ts`.

### Database / Storage Approach

Supabase Postgres and Storage are the intended database and object storage layer. Payslip files are uploaded to Supabase Storage, metadata is written to the `payslips` table, and extraction lifecycle data is written to `payslip_extractions` and related tables.

### Test Setup

Vitest with jsdom is configured through `vitest.config.ts` and `src/test/setup.ts`. Existing tests are focused and limited. There is no Playwright or Cypress E2E setup.

### Deployment Setup

Deployment setup is unclear. The repo has Vite build scripts and Supabase config, but no committed CI/CD or hosting provider config. `docs/DEPLOYMENT.md` documents gaps rather than a verified deployment process.

### Important Architectural Patterns

- Browser data access should go through Supabase hooks and generated types.
- Edge Functions handle privileged work, AI extraction, and Stripe connector calls.
- Server-only secrets belong in Supabase function secrets, not Vite environment variables.
- Lovable-generated code should be treated as a boundary and not casually rewritten.
- Supabase migrations and generated types must remain synchronized.

## 4. Production Readiness Assessment

Current rating: MVP In Progress

PayCheck has a real product shape and many MVP screens/flows exist, but it is not MVP-ready or production-ready yet. The current codebase can build and tests pass, but lint fails, dependency audit has high-severity production vulnerabilities, tracked environment files require remediation and credential rotation, and the highest-risk flows are not verified end to end.

The biggest production readiness gaps are:

- Reliability: upload/extraction/billing/delete flows are not proven through repeatable tests.
- Security: tracked env files, dependency vulnerabilities, and unverified RLS/storage/function auth remain open.
- Data validation: AI extraction output is not validated by a strict shared schema before persistence.
- Error handling: upload and extraction failures can be presented as success or background processing.
- Loading/empty/error states: present in places, but not consistently verified across core flows.
- Test coverage: basic Vitest coverage exists, but no route smoke, E2E, RLS, storage, or integration coverage.
- Deployment confidence: no CI/CD, hosting target, preview flow, or verified production runbook.
- Monitoring/logging: no error tracking, structured logs, alerts, or AI extraction telemetry.
- User onboarding: implemented, but not covered by tests against real auth/profile persistence.
- Billing/subscriptions: code exists, but Stripe sandbox/webhook/entitlement behavior needs verification.
- Admin/support workflows: no visible support/admin tooling for account recovery, failed extractions, webhook failures, or billing disputes.

## 5. Critical Gaps

### GAP-001: Tracked environment files and credential rotation are unresolved

Priority: P0  
Area: Security  
Status: Open

#### Gap

`.env`, `.env.development`, and `.env.production` are tracked in git. Even if current values are placeholders or expired, this creates a secret-management and trust problem.

#### Impact

Production cannot be considered safe until committed environment values are removed from the tracked tree and any exposed credentials are rotated.

#### Evidence

`git ls-files .env .env.development .env.production .env.example` returns tracked `.env`, `.env.development`, and `.env.production`.

#### Recommended Fix

Remove tracked local environment files, keep only `.env.example`, update `.gitignore`, document rotation steps, and rotate any potentially exposed Supabase, Stripe, Lovable, analytics, or deployment credentials.

### GAP-002: Production dependency vulnerabilities are open

Priority: P0  
Area: Security  
Status: Open

#### Gap

The production dependency audit reports high-severity vulnerabilities.

#### Impact

Known vulnerable packages block a credible production release and may affect routing, runtime safety, or transitive package behavior.

#### Evidence

`project-status.json` records `npm audit --omit=dev --json` failing with 9 production vulnerabilities, including 6 high-severity issues.

#### Recommended Fix

Run a focused dependency remediation task, update only necessary packages, verify React Router behavior, and rerun lint, typecheck, tests, build, and production audit.

### GAP-003: Lint and type-safety baseline is not clean

Priority: P0  
Area: Testing  
Status: Open

#### Gap

Lint currently fails due to existing `any`, shadcn template, Tailwind config, and Supabase function issues.

#### Impact

Future Codex-driven changes will be harder to review safely, and regressions may hide in existing noise.

#### Evidence

`project-status.json` records `npm run lint` failing with 25 errors and 9 warnings. Source inspection found multiple `any` uses in frontend hooks, pages, and Edge Functions.

#### Recommended Fix

Split lint remediation into mechanical config/template fixes, frontend typed-data fixes, and Edge Function type fixes. Do not mix with feature work.

### GAP-004: Supabase schema, RLS, and storage isolation are not verified

Priority: P0  
Area: Data  
Status: Open

#### Gap

The app relies on Supabase migrations, RLS, and storage paths for sensitive payslip data, but fresh migration application and cross-user isolation tests are not present.

#### Impact

Users could see incorrect data, lose data, or have cross-account access vulnerabilities if policies or migrations are wrong.

#### Evidence

Migrations and generated types exist, upload paths include `user.id`, and hooks query user-sensitive tables. There are no RLS/storage policy tests or documented clean-environment migration verification.

#### Recommended Fix

Apply migrations to a clean local/staging Supabase project, regenerate types, add RLS/storage isolation checks, and document migration verification.

### GAP-005: Country support claims and schema/extraction support disagree

Priority: P0  
Area: Product  
Status: Open

#### Gap

Public UI and library files include United States support, but database constraints and extraction types primarily support UK/Ireland plus selected European countries. US support is not consistently represented.

#### Impact

Users may choose or expect unsupported payslip formats, causing failed extraction, invalid stored data, or misleading marketing.

#### Evidence

The repo includes US guide/calculator files, but migrations and extraction prompts do not fully align with US support. `use-payslip-data` casts countries to a narrower set.

#### Recommended Fix

Make a product decision: either remove/hide US from MVP surfaces or fully add US support across schema, types, extraction prompt, validation, guides, and tests.

### GAP-006: Core MVP runtime flows are not end-to-end verified

Priority: P0  
Area: Testing  
Status: Open

#### Gap

Signup, onboarding, upload, extraction, anomaly review, billing, export, and account deletion are not covered by a reliable smoke or E2E suite.

#### Impact

The app can build while still failing the actual customer journey.

#### Evidence

Vitest has 5 tests across 4 files. No Playwright/Cypress tests or documented sandbox runtime checklist exists for the full MVP journey.

#### Recommended Fix

Add route smoke tests first, then targeted integration/E2E coverage for the highest-risk flows using stable fixtures and sandbox credentials.

### GAP-007: AI extraction is not schema-hardened enough for production

Priority: P1  
Area: API  
Status: Open

#### Gap

The `process-payslip` function prompts an AI model for JSON and strips markdown fences before parsing, but it does not use a shared strict schema to validate all fields before persistence.

#### Impact

Malformed or hallucinated AI output could corrupt extracted payslip records, produce false anomaly warnings, or break downstream UI.

#### Evidence

`supabase/functions/process-payslip/index.ts` performs manual parsing and persistence. Strict shared runtime validation was not found.

#### Recommended Fix

Introduce a shared extraction schema, validate AI output before writes, return structured failure reasons, and add tests for malformed, missing, and unsupported-country outputs.

### GAP-008: Billing and entitlement behavior is not production-proven

Priority: P1  
Area: Security  
Status: Open

#### Gap

Stripe checkout, webhook handling, subscription reads, usage limits, and entitlements exist but are not verified through sandbox integration tests.

#### Impact

Users could be charged without access, gain access without payment, or hit incorrect limits.

#### Evidence

Payment Edge Functions and `use-subscription` exist. Several payment functions use `verify_jwt = false` with manual checks, and `CheckoutReturn` has only narrow frontend test coverage.

#### Recommended Fix

Verify sandbox checkout, webhook signature handling, subscription table writes, usage limits, portal access, cancellation behavior, and entitlement guards.

### GAP-009: CI/CD and deployment process are missing

Priority: P1  
Area: Deployment  
Status: Open

#### Gap

There is no committed CI workflow, hosting config, preview deployment strategy, or proven production release checklist.

#### Impact

Releases will be manual and fragile, and future PRs will not have consistent automated gates.

#### Evidence

No GitHub Actions, Vercel, Netlify, Render, or Docker deployment config was found. `docs/DEPLOYMENT.md` documents gaps rather than a working deployment.

#### Recommended Fix

Choose a hosting target, add CI for install/lint/typecheck/test/build/audit, configure previews, and document Supabase migration/function deployment.

### GAP-010: Privacy, retention, export, and deletion flows need verification

Priority: P1  
Area: Security  
Status: Open

#### Gap

Settings, export, and account deletion code exist, but privacy guarantees are not proven across database records, storage objects, billing cancellation, and retained logs.

#### Impact

Payslips contain sensitive personal and financial data. Incomplete deletion/export behavior creates user trust and compliance risk.

#### Evidence

Settings and deletion-related tests exist, and there is a `cancel-subscription-on-delete` function. Full data lifecycle verification was not found.

#### Recommended Fix

Define the retention policy, add deletion/export tests, verify storage cleanup, verify subscription cancellation path, and document any retained operational logs.

## 6. Ordered Delivery Plan

### Phase 0: Stabilisation

Goal: Make the repo safe and predictable before feature expansion.

Tasks:

- Remove tracked environment files and complete credential rotation.
- Remediate production dependency vulnerabilities.
- Fix lint/type-safety baseline in small slices.
- Verify Supabase migrations on a clean environment.
- Regenerate Supabase types from the verified schema.
- Add RLS/storage authorization checks.
- Add protected-route and onboarding redirect smoke tests.

Acceptance criteria:

- No real environment values are tracked.
- `npm audit --omit=dev` has no high-severity production findings or documented exceptions.
- `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` pass.
- Fresh Supabase migration application is documented and repeatable.
- Cross-user data and storage access denial is tested.

Suggested validation commands:

- `npm install`
- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`

### Phase 1: MVP Completion

Goal: Prove the core customer value loop works safely.

Tasks:

- Decide and align MVP country support.
- Verify signup, onboarding, upload, extraction, dashboard, vault, detail, compare, anomalies, and draft query flows.
- Correct upload/extraction failure states.
- Add strict AI extraction schema validation.
- Add focused tests for upload, extraction, anomaly, draft query, and settings behavior.
- Verify export and account deletion behavior.

Acceptance criteria:

- A new user can complete the core journey in a sandbox environment.
- Unsupported countries are either hidden or fully supported.
- AI extraction failures do not present as successful processing.
- Core sensitive data flows have tests and documented manual checks.

Suggested validation commands:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- Manual sandbox smoke of signup, upload, extraction, anomaly review, export, and delete.

### Phase 2: Production Hardening

Goal: Prepare the app for real users and paid plans.

Tasks:

- Verify Stripe checkout, webhook, portal, cancellation, and entitlement flows.
- Add CI/CD with preview deployments and production gates.
- Add structured logging, error tracking, and PII redaction rules.
- Add health/readiness checks or equivalent operational smoke.
- Add deployment and incident runbooks.
- Complete accessibility and responsive QA for core routes.

Acceptance criteria:

- Every PR runs a repeatable validation pipeline.
- Stripe sandbox flows are verified end to end.
- Production errors and failed extractions can be diagnosed without leaking PII.
- Launch QA checklist passes on desktop and mobile.

Suggested validation commands:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- CI workflow run on a clean branch.

### Phase 3: Growth / Scale

Goal: Improve scale, supportability, and commercial maturity after the MVP is stable.

Tasks:

- Add richer analytics and funnel tracking with consent handling.
- Add admin/support workflows for failed extractions, billing disputes, and account recovery.
- Improve bundle splitting for PDF/charts/heavy pages.
- Add multi-workspace or employer-level abstractions only if validated by product needs.
- Expand country support one country at a time with tests and fixtures.

Acceptance criteria:

- Growth work does not weaken the verified MVP journey.
- New countries and commercial flows include schema, extraction, guide, and test coverage.
- Support workflows reduce manual database intervention.

Suggested validation commands:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- Route-level performance and responsive checks.

## 7. Backlog

### TASK-001: Remove tracked environment files and document credential rotation

Status: Ready  
Priority: P0  
Area: Security  
Depends on: None  
Linear: PPP-SEC-001 / PPP-SEC-002 local export only

#### Goal

Eliminate tracked local environment files and make credential rotation explicit.

#### Scope

Remove tracked `.env`, `.env.development`, and `.env.production` from the repository, keep `.env.example`, update ignore rules if needed, and document which credentials need rotation.

#### Acceptance Criteria

- [ ] Local environment files are no longer tracked.
- [ ] `.env.example` remains available with placeholder names only.
- [ ] Rotation checklist covers Supabase, Stripe, Lovable, analytics, and deployment credentials.
- [ ] No application code changes are included.

#### Validation

- [ ] `git ls-files .env .env.development .env.production .env.example`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

This is the highest-priority release blocker. Coordinate real credential rotation outside the repo.

### TASK-002: Remediate production dependency vulnerabilities

Status: Ready  
Priority: P0  
Area: Security  
Depends on: None  
Linear: PPP-SEC-003 local export only

#### Goal

Remove high-severity production dependency audit findings without broad dependency churn.

#### Scope

Update only the packages needed to resolve production advisories, then verify router/build/test behavior.

#### Acceptance Criteria

- [ ] `npm audit --omit=dev` reports no high-severity production vulnerabilities or documents accepted exceptions.
- [ ] React Router routes still build and run.
- [ ] Lockfile changes are limited to remediation.

#### Validation

- [ ] `npm audit --omit=dev`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

Do not combine this with feature work.

### TASK-003: Fix mechanical lint baseline issues

Status: Ready  
Priority: P0  
Area: Testing  
Depends on: None  
Linear: PPP-QA-001 local export only

#### Goal

Reduce existing lint noise by handling mechanical, low-risk issues first.

#### Scope

Address generated template leftovers, obvious unused variables/imports, and config-level lint issues without changing behavior.

#### Acceptance Criteria

- [ ] Mechanical lint errors are fixed.
- [ ] No feature behavior changes are included.
- [ ] Remaining lint failures, if any, are documented and split into typed-data tasks.

#### Validation

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

Keep this PR small. Do not attempt all `any` cleanup here.

### TASK-004: Replace unsafe frontend `any` usage in core data hooks

Status: Ready  
Priority: P0  
Area: Data  
Depends on: TASK-003  
Linear: PPP-QA-002 local export only

#### Goal

Improve type safety for payslip, profile, subscription, usage, and anomaly data paths.

#### Scope

Replace high-risk `any` usage in core frontend hooks with generated Supabase types, narrow local types, or validated transforms.

#### Acceptance Criteria

- [ ] Core hooks compile without unsafe `any` casts where generated types are available.
- [ ] Country/currency fields are typed consistently with schema decisions.
- [ ] No UI behavior changes are introduced.

#### Validation

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

This may need to wait for TASK-007 if generated types are stale.

### TASK-005: Resolve Edge Function lint and type baseline

Status: Ready  
Priority: P0  
Area: API  
Depends on: TASK-003  
Linear: PPP-QA-003 local export only

#### Goal

Make Supabase Edge Functions easier to review and safer to change.

#### Scope

Address lint/type issues in functions and shared helpers without changing external API behavior.

#### Acceptance Criteria

- [ ] Function code avoids avoidable `any` where request/response shapes are known.
- [ ] Shared helpers expose clear typed interfaces.
- [ ] Existing function behavior remains stable.

#### Validation

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

Do not change Stripe or AI business behavior in this task.

### TASK-006: Verify Supabase migrations on a clean environment

Status: Ready  
Priority: P0  
Area: Data  
Depends on: TASK-001  
Linear: PPP-DATA-001 local export only

#### Goal

Prove the schema can be rebuilt from committed migrations.

#### Scope

Run migrations against a clean local or sandbox Supabase environment, record failures, and fix only migration-order or syntax issues needed for a clean apply.

#### Acceptance Criteria

- [ ] Migrations apply from scratch.
- [ ] Required tables, policies, functions, and storage buckets exist.
- [ ] Any manual setup is documented.

#### Validation

- [ ] Supabase migration apply/reset command for the chosen environment
- [ ] `npx tsc --noEmit`
- [ ] `npm test`

#### Notes

Requires local Supabase or a sandbox project. Do not use production.

### TASK-007: Regenerate Supabase types from verified schema

Status: Ready  
Priority: P0  
Area: Data  
Depends on: TASK-006  
Linear: PPP-DATA-002 local export only

#### Goal

Align generated TypeScript database types with the verified schema.

#### Scope

Regenerate `src/integrations/supabase/types.ts` from the verified Supabase schema and update compile errors caused by legitimate type drift.

#### Acceptance Criteria

- [ ] Generated types match the verified schema.
- [ ] App typecheck passes.
- [ ] Any schema/type mismatches are documented as follow-up tasks.

#### Validation

- [ ] Supabase type generation command
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

Treat generated files as generated boundaries.

### TASK-008: Add RLS and storage isolation checks

Status: Ready  
Priority: P0  
Area: Security  
Depends on: TASK-006, TASK-007  
Linear: PPP-SEC-004 local export only

#### Goal

Prove one user cannot read or mutate another user's payslip data or files.

#### Scope

Add targeted tests or documented executable checks for payslips, extractions, anomalies, profiles, usage, subscriptions, and storage objects.

#### Acceptance Criteria

- [ ] Cross-user reads are denied for sensitive tables.
- [ ] Cross-user writes are denied for sensitive tables.
- [ ] Storage object access is constrained by owner path/policy.
- [ ] Function-level ownership checks are documented or tested.

#### Validation

- [ ] RLS/storage isolation test command or documented script
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

#### Notes

This task is security-sensitive and should be planned before implementation.

### TASK-009: Add protected route and onboarding redirect smoke tests

Status: Ready  
Priority: P0  
Area: Auth  
Depends on: TASK-003  
Linear: PPP-AUTH-001 local export only

#### Goal

Catch regressions in auth redirects and onboarding gating.

#### Scope

Add route-level tests for unauthenticated access, authenticated incomplete-onboarding access, and authenticated completed-onboarding access.

#### Acceptance Criteria

- [ ] Unauthenticated protected routes redirect to sign-in.
- [ ] Incomplete onboarding redirects to onboarding except where allowed.
- [ ] Completed onboarding can access dashboard routes.
- [ ] Demo mode behavior is covered or explicitly excluded.

#### Validation

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

#### Notes

Use existing React Testing Library/Vitest patterns.

### TASK-010: Decide MVP country support scope

Status: Ready  
Priority: P0  
Area: Product  
Depends on: None  
Linear: PPP-PROD-001 local export only

#### Goal

Resolve the mismatch between public UI, schema, and extraction support.

#### Scope

Make an explicit MVP decision on supported countries and document it in product, data, and design docs.

#### Acceptance Criteria

- [ ] Supported MVP countries are documented.
- [ ] Unsupported countries are documented as non-goals or later enhancements.
- [ ] Follow-up implementation tasks are created for UI/schema/extraction alignment.

#### Validation

- [ ] Documentation review
- [ ] `rg "United States|US|country|countries" src docs supabase`

#### Notes

This is a planning task. Do not change product behavior here.

### TASK-011: Align country UI, schema, and extraction support

Status: Needs Refinement  
Priority: P0  
Area: Data  
Depends on: TASK-010  
Linear: PPP-DATA-003 local export only

#### Goal

Make country support consistent across the product once the MVP scope is decided.

#### Scope

Either hide unsupported countries or implement full schema, type, prompt, validation, guide, and test support for selected countries.

#### Acceptance Criteria

- [ ] Onboarding, guides, calculators, database constraints, generated types, and extraction prompts agree.
- [ ] Unsupported country selections cannot create invalid records.
- [ ] Tests cover at least one supported and one unsupported country path.

#### Validation

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

This may split into separate UI, schema, and AI tasks after TASK-010.

### TASK-012: Create an executable MVP smoke test checklist

Status: Ready  
Priority: P0  
Area: Testing  
Depends on: TASK-001  
Linear: PPP-RUN-001 local export only

#### Goal

Define the repeatable manual or automated checks for the core MVP journey.

#### Scope

Create a sandbox-safe checklist covering sign up, onboarding, upload, extraction, dashboard, vault, detail, anomaly, draft query, billing state, export, and delete.

#### Acceptance Criteria

- [ ] Checklist identifies required sandbox credentials and fixtures.
- [ ] Each step has expected results and failure capture notes.
- [ ] The checklist avoids production data.

#### Validation

- [ ] Documentation review
- [ ] Run as much of the checklist as credentials allow

#### Notes

This can become an E2E test plan later.

### TASK-013: Verify upload and extraction status behavior in sandbox

Status: Ready  
Priority: P0  
Area: API  
Depends on: TASK-006, TASK-012  
Linear: PPP-AI-003 local export only

#### Goal

Prove a real payslip upload reaches the correct extraction terminal state.

#### Scope

Run sandbox upload/extraction with safe fixture files, observe database rows, storage objects, UI state, and Edge Function logs.

#### Acceptance Criteria

- [ ] Successful extraction reaches a success state with parsed figures.
- [ ] Failed extraction reaches a visible failure state.
- [ ] UI copy does not claim success when processing failed.
- [ ] Logs do not expose unnecessary PII.

#### Validation

- [ ] MVP smoke checklist upload/extraction steps
- [ ] `npm run build`

#### Notes

Implementation fixes discovered during this verification should be separate follow-up tasks unless tiny and scoped.

### TASK-014: Verify Stripe sandbox checkout, webhook, and entitlement flow

Status: Ready  
Priority: P0  
Area: Security  
Depends on: TASK-001  
Linear: PPP-PAY-001 / PPP-PAY-002 local export only

#### Goal

Prove billing state changes are correct and secure before relying on paid-plan behavior.

#### Scope

Verify checkout creation, webhook signature handling, subscription table updates, usage limits, customer portal access, and cancellation handling in sandbox.

#### Acceptance Criteria

- [ ] Checkout session can be created only for an authenticated user.
- [ ] Webhook updates the expected subscription records.
- [ ] Premium entitlements change only after verified subscription state.
- [ ] Cancellation/downgrade behavior is documented and tested.

#### Validation

- [ ] Stripe sandbox checklist
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

Requires Stripe sandbox credentials and webhook forwarding.

### TASK-015: Correct upload and extraction failure messaging

Status: Ready  
Priority: P1  
Area: UX  
Depends on: TASK-013  
Linear: PPP-REL-001 local export only

#### Goal

Stop presenting failed extraction starts as successful processing.

#### Scope

Update upload/extraction UI state handling so success, queued/processing, retryable failure, and terminal failure are distinct.

#### Acceptance Criteria

- [ ] Upload success is separate from extraction success.
- [ ] Function invocation failure produces a clear user-visible state.
- [ ] Retry guidance is present where appropriate.
- [ ] Tests cover at least success and function-error paths.

#### Validation

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

#### Notes

Keep copy concise and consistent with existing toasts.

### TASK-016: Add strict AI extraction schema validation

Status: Ready  
Priority: P1  
Area: API  
Depends on: TASK-005, TASK-010  
Linear: PPP-AI-001 / PPP-AI-002 local export only

#### Goal

Prevent malformed AI output from being persisted as trusted payslip data.

#### Scope

Introduce a shared runtime schema for extraction output and apply it before database writes in demo and authenticated extraction functions.

#### Acceptance Criteria

- [ ] AI output is validated before persistence.
- [ ] Invalid output records a structured extraction failure.
- [ ] Tests cover malformed JSON, missing required fields, unsupported countries, and valid output.
- [ ] No sensitive prompt/output data is logged unnecessarily.

#### Validation

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

#### Notes

Use the existing `zod` dependency if suitable.

### TASK-017: Add focused tests for onboarding, upload, anomaly, and settings flows

Status: Ready  
Priority: P1  
Area: Testing  
Depends on: TASK-009, TASK-015  
Linear: PPP-QA-005 local export only

#### Goal

Cover the most important frontend behavior before broader E2E work.

#### Scope

Add Vitest/React Testing Library tests for onboarding persistence behavior, upload state rendering, anomaly actions, settings export/delete affordances, and error states.

#### Acceptance Criteria

- [ ] Tests cover happy, empty, and error states where practical.
- [ ] Supabase interactions are mocked consistently.
- [ ] Tests are stable and do not require production credentials.

#### Validation

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

#### Notes

Split into smaller tasks if one PR becomes too broad.

### TASK-018: Add CI validation workflow

Status: Ready  
Priority: P1  
Area: Deployment  
Depends on: TASK-002, TASK-003  
Linear: PPP-QA-004 local export only

#### Goal

Make every PR run the basic quality gates.

#### Scope

Add a GitHub Actions workflow for install, lint, typecheck, tests, build, and production audit.

#### Acceptance Criteria

- [ ] CI runs on pull requests.
- [ ] CI does not require production secrets.
- [ ] Failing lint, tests, build, or audit block merge.

#### Validation

- [ ] GitHub Actions workflow syntax check or PR run
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`

#### Notes

Do this only after current local gates are made passable.

### TASK-019: Choose deployment target and document release process

Status: Ready  
Priority: P1  
Area: Deployment  
Depends on: TASK-018  
Linear: PPP-DEP-001 local export only

#### Goal

Establish a repeatable deployment path.

#### Scope

Choose Vercel, Netlify, or another target, document environment variables, build settings, preview behavior, Supabase function deployment, rollback, and smoke checks.

#### Acceptance Criteria

- [ ] Deployment target is named.
- [ ] Preview and production release steps are documented.
- [ ] Environment variable ownership is documented without secrets.
- [ ] Rollback and post-deploy smoke checks are documented.

#### Validation

- [ ] Documentation review
- [ ] `npm run build`
- [ ] Preview deployment if credentials are available

#### Notes

Do not commit provider secrets.

### TASK-020: Verify export, deletion, and retention behavior

Status: Ready  
Priority: P1  
Area: Security  
Depends on: TASK-006, TASK-014  
Linear: PPP-DATA-004 / PPP-DATA-005 local export only

#### Goal

Prove users can export and delete sensitive payslip data according to a documented policy.

#### Scope

Verify export contents, account deletion ordering, storage cleanup, subscription cancellation, and retained operational records.

#### Acceptance Criteria

- [ ] Export includes expected user-owned data and excludes other users' data.
- [ ] Delete removes or anonymizes required records.
- [ ] Storage objects are deleted.
- [ ] Billing cancellation path is verified or clearly marked manual.
- [ ] Retention exceptions are documented.

#### Validation

- [ ] `npm test`
- [ ] Sandbox deletion/export checklist
- [ ] `npx tsc --noEmit`

#### Notes

Payslips are highly sensitive. Treat this as a privacy-critical task.

### TASK-021: Add structured logging, redaction, and error tracking plan

Status: Ready  
Priority: P2  
Area: Other  
Depends on: TASK-001  
Linear: PPP-OBS-001 local export only

#### Goal

Make production failures diagnosable without leaking PII.

#### Scope

Define logging fields, redaction rules, event names, error tracking target, and AI extraction telemetry requirements.

#### Acceptance Criteria

- [ ] PII redaction rules are documented.
- [ ] AI extraction latency/failure/cost events are defined.
- [ ] Error tracking provider decision is documented.
- [ ] Follow-up implementation tasks are created.

#### Validation

- [ ] Documentation review
- [ ] Search for unsafe logs in frontend and functions

#### Notes

This is a planning task unless a provider is already selected.

### TASK-022: Clean unused Lovable starter artifacts and duplicate tooling leftovers

Status: Ready  
Priority: P2  
Area: Other  
Depends on: TASK-003  
Linear: PPP-REPO-001 local export only

#### Goal

Reduce confusion from generated or unused migration artifacts.

#### Scope

Remove or document unused starter files, placeholder routes, duplicate lockfiles, and generated Lovable artifacts that are not part of runtime behavior.

#### Acceptance Criteria

- [ ] Unused starter files are removed only if not imported.
- [ ] Generated boundaries are documented.
- [ ] Build and tests still pass.

#### Validation

- [ ] `rg "REMOVE_THIS|Index.tsx|App.css|Lovable" src docs`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`

#### Notes

Be careful not to remove generated files that the app still imports.

### TASK-023: Improve bundle splitting for heavy routes

Status: Ready  
Priority: P2  
Area: UX  
Depends on: TASK-018  
Linear: PPP-PERF-001 local export only

#### Goal

Reduce production bundle risk from heavy PDF, chart, and guide routes.

#### Scope

Analyze build output and lazy-load appropriate heavy routes or libraries without changing user behavior.

#### Acceptance Criteria

- [ ] Build warning is understood and documented.
- [ ] Heavy modules are lazy-loaded where safe.
- [ ] Route behavior remains unchanged.

#### Validation

- [ ] `npm run build`
- [ ] Manual route smoke for lazy-loaded pages
- [ ] `npm test`

#### Notes

This is post-MVP unless bundle size blocks hosting or performance.

## 8. Recommended Immediate Sprint

### TASK-001: Remove tracked environment files and document credential rotation

Why now: Secrets hygiene blocks any serious production or collaborator workflow.  
Expected outcome: No tracked local env files and a clear rotation checklist.  
Validation: `git ls-files .env .env.development .env.production .env.example`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

### TASK-002: Remediate production dependency vulnerabilities

Why now: Known high-severity production advisories block release confidence.  
Expected outcome: Production audit no longer reports high-severity vulnerabilities.  
Validation: `npm audit --omit=dev`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

### TASK-003: Fix mechanical lint baseline issues

Why now: A noisy lint baseline makes every future PR harder to trust.  
Expected outcome: Low-risk lint issues are removed and remaining typed-data issues are isolated.  
Validation: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

### TASK-004: Replace unsafe frontend `any` usage in core data hooks

Why now: Payslip and subscription data paths need stronger typing before feature work.  
Expected outcome: Core hooks use generated or local types instead of unsafe casts.  
Validation: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

### TASK-005: Resolve Edge Function lint and type baseline

Why now: AI, billing, and deletion logic live in Edge Functions and need reviewable typed code.  
Expected outcome: Function lint/type quality improves without changing behavior.  
Validation: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

### TASK-006: Verify Supabase migrations on a clean environment

Why now: The app cannot be safely deployed unless the database can be rebuilt from migrations.  
Expected outcome: Clean schema apply is proven and documented.  
Validation: Supabase migration reset/apply, `npx tsc --noEmit`, `npm test`.

### TASK-007: Regenerate Supabase types from verified schema

Why now: Reliable typed data work depends on schema and generated types agreeing.  
Expected outcome: Generated types reflect the verified schema.  
Validation: Supabase type generation, `npx tsc --noEmit`, `npm test`, `npm run build`.

### TASK-008: Add RLS and storage isolation checks

Why now: Payslip data is sensitive, and cross-user isolation is a hard MVP gate.  
Expected outcome: Tests or executable checks prove user data and files are isolated.  
Validation: RLS/storage isolation command, `npm test`, `npx tsc --noEmit`.

## 9. Risks and Assumptions

### Technical Risks

- Generated Supabase types may be stale relative to migrations.
- Edge Functions mix auth, AI parsing, payment, and persistence logic that needs typed boundaries.
- Some public functions use `verify_jwt = false` and depend on manual request verification.
- Bundle size warnings may become a performance issue as the app grows.

### Product Risks

- MVP country support is unclear, especially around United States surfaces.
- The app may promise more payroll-country expertise than the extraction engine can reliably deliver.
- Billing/pricing behavior may not match real commercial plans yet.
- Demo mode and real mode boundaries need to remain obvious to users.

### Security Risks

- Tracked environment files require remediation and credential rotation.
- Production dependency vulnerabilities are open.
- Payslip files and extraction outputs contain sensitive PII and financial data.
- RLS/storage isolation and deletion/export guarantees are not yet proven.

### Deployment Risks

- No CI/CD workflow exists.
- No hosting provider config is committed.
- Supabase migration/function deployment has not been proven from scratch.
- Production secrets ownership and rotation process are not established.

### Assumptions

- Supabase is the intended long-term auth, database, storage, and function backend.
- Lovable gateway/connector integrations are currently required for AI and Stripe behavior.
- `project-status.json` reflects recent validation results.
- Linear issue creation did not complete because of workspace issue limits, so local `PPP-*` references are treated as planning IDs, not confirmed Linear issue keys.
- No `PLANS.md` or `SPRINT.md` file is currently required to understand this roadmap.

## 10. Definition of Done

### MVP Ready

PayCheck can be considered MVP Ready when all of the following are true:

- A new user can sign up, complete onboarding, upload a supported payslip, receive extracted data, view trends, review anomalies, draft a payroll query, export their data, and delete their account in a sandbox or staging environment.
- Supported countries are explicitly defined and consistently enforced across UI, schema, types, extraction, guides, and tests.
- Sensitive data is protected by verified RLS/storage policies and function-level ownership checks.
- Upload, extraction, billing, export, and deletion failure states are visible and accurate.
- Stripe sandbox checkout, webhook, entitlement, portal, and cancellation flows are verified if billing is included in MVP.
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, and `npm audit --omit=dev` pass or have documented accepted exceptions.
- Core auth, route protection, upload/extraction, billing, export, and delete flows have automated or executable smoke coverage.
- Tracked environment files are removed and exposed credentials are rotated.
- A deployment target and release checklist exist.

### Production Ready

PayCheck can be considered Production Ready when all MVP Ready criteria are met plus:

- CI/CD runs required validation on every pull request.
- Preview and production deployments are repeatable and documented.
- Supabase migrations, Edge Function deployments, and rollback steps are proven.
- Error tracking, structured logs, PII redaction, and operational alerts are configured.
- AI extraction has schema validation, retry/failure handling, cost/latency telemetry, and hallucination/unsupported-document safeguards.
- Accessibility and responsive QA pass on core routes.
- Privacy, retention, export, deletion, and support processes are documented and tested.
- Billing behavior has live-mode readiness checks, webhook replay handling, and entitlement regression tests.
- Admin/support or operational workflows exist for failed extractions, billing issues, account deletion problems, and security incidents.
- The team has a runbook for incident response, credential rotation, deployment rollback, and data-access requests.
