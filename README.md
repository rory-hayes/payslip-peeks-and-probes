# PayCheck

PayCheck is a payslip-checking SaaS app. Employees can sign up, complete a pay profile, upload payslips, extract key figures, compare month-to-month changes, review anomalies, and draft payroll query emails.

## Current Status
This is a Lovable-migrated Vite React app with meaningful product code already present, but it is not production-ready. The app builds and tests pass, but lint fails, dependency audit reports vulnerabilities, local env files are currently tracked in repo history, and several product claims need verification against the Supabase schema and Edge Functions.

## Tech Stack
- Framework: Vite + React 18 SPA
- Language: TypeScript
- Package manager: npm is the canonical path because `package-lock.json` is present and `npm install` works
- Routing: `react-router-dom`
- Styling: Tailwind CSS with CSS variables in `src/index.css`
- Component library: shadcn-style Radix UI components in `src/components/ui`
- State/data: TanStack Query and React context
- Backend: Supabase Auth, Postgres, Storage, and Edge Functions
- Payments: Stripe embedded checkout through Lovable connector gateway helpers
- AI: Gemini 2.5 Flash via Lovable AI gateway inside Supabase Edge Functions

## Main User Flows
- Public landing, pricing, legal pages, guides, and country calculators.
- Email/password signup and sign-in through Supabase.
- Google OAuth via Lovable cloud auth wrapper.
- Onboarding for country, pay frequency, salary, employer, benefits, and anomaly threshold.
- Protected dashboard with charts, expected-vs-actual pay, and free-tier usage.
- Payslip vault upload, storage, AI extraction, manual review, and retry.
- Anomaly review, status changes, and issue drafting.
- Settings for profile, billing portal, data export, and account deletion.

## Local Setup
1. Copy `.env.example` to a local `.env` file outside version control.
2. Fill in Supabase browser values for the frontend.
3. For Edge Functions and payments, set server-side secrets in Supabase rather than the frontend bundle.
4. Install dependencies:

```bash
npm install
```

5. Run locally:

```bash
npm run dev
```

The Vite config defaults to port `8080`; if busy, Vite will choose another port.

## Environment Variables
See `.env.example` for the complete variable list. Do not commit real values. Server-only values such as `SUPABASE_SERVICE_ROLE_KEY`, Stripe API keys, webhook secrets, and `LOVABLE_API_KEY` must be configured as Supabase secrets.

## Scripts
- `npm run dev`: start Vite locally.
- `npm run build`: production build.
- `npm run build:dev`: development-mode build.
- `npm run lint`: ESLint check. Currently fails on existing issues.
- `npm test`: Vitest suite.
- `npm run test:watch`: interactive Vitest.
- `npm run preview`: preview built assets.

## Deployment Notes
The app is a static Vite frontend plus Supabase backend. A production deployment needs:
- Static hosting for `dist/`.
- Supabase migrations applied to the target project.
- Supabase Storage bucket `payslips` with RLS policies.
- Supabase Edge Functions deployed with server-side secrets.
- Stripe products/prices, webhooks, and portal configured.
- A decision on canonical domain. Current files mention both `paycheckinsights.com` and `payslipinsights.com`.

## Known Limitations
- Lint is not passing.
- Dependency audit reports production vulnerabilities.
- Country support is inconsistent: US appears in UI/calculators but is not fully supported in migrations/extraction.
- AI extraction and Stripe use Lovable connector gateways that need production ownership validation.
- There are no end-to-end tests for the core SaaS flow.
- Existing tracked `.env*` files should be removed from git history or rotated through a dedicated security cleanup.

## Documentation
Start with:
- `AGENTS.md`
- `ROADMAP.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/QA_CHECKLIST.md`
- `docs/HANDOFF_ANALYSIS.md`

## Roadmap
The productionisation plan is in `ROADMAP.md`. Command-centre exports are under `command-centre/` because Google Sheet credentials were not available during this audit.
