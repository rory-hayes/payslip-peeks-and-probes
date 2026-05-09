# Architecture

## App Architecture
This is a Vite React single-page app. `src/main.tsx` mounts `src/App.tsx`, which wires TanStack Query, shadcn/Radix UI providers, auth context, demo context, React Router routes, toasts, and cookie consent.

The frontend talks directly to Supabase for user-owned database rows and storage, and invokes Supabase Edge Functions for AI extraction and payment actions.

## Frontend Routing
Routes live in `src/App.tsx`.

Public routes:
- `/`
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/reset-password`
- `/pricing`
- `/privacy`
- `/terms`
- `/guides`
- `/guides/*`
- `/calculator`
- `/calculator/:country`

Protected routes:
- `/onboarding`
- `/dashboard`
- `/vault`
- `/payslip/:id`
- `/compare`
- `/anomalies`
- `/draft/:id`
- `/settings`
- `/checkout`
- `/checkout/return`

`src/components/ProtectedRoute.tsx` enforces client-side routing rules and redirects users without a session to `/sign-in`. Supabase RLS and function ownership checks are still required because client route protection is not a security boundary.

## Backend, API, And Server Actions
There are no Next.js API routes or server actions. Backend logic is in Supabase Edge Functions:
- `process-payslip`: authenticated payslip extraction, quota checks, rate limiting, AI call, DB updates, anomaly detection.
- `demo-extract-payslip`: anonymous demo extraction with IP rate limiting and no DB writes.
- `create-checkout`: authenticated embedded Stripe checkout session creation.
- `get-stripe-price`: lookup-key to Stripe price resolution.
- `payments-webhook`: Stripe webhook handler.
- `create-portal-session`: authenticated billing portal session.
- `cancel-subscription-on-delete`: cancels active Stripe subscriptions during account deletion.

Several functions have `verify_jwt = false` in `supabase/config.toml`, but most manually parse the auth bearer token. This needs production review.

## Auth And Session Architecture
- Email/password auth uses Supabase Auth through `src/contexts/AuthContext.tsx`.
- Google OAuth uses the Lovable wrapper in `src/integrations/lovable/index.ts`, then writes tokens into Supabase auth.
- Sessions persist in `localStorage` via `src/integrations/supabase/client.ts`.
- Signup should trigger `public.handle_new_user()` in Supabase to create a profile.
- Onboarding completion is stored on `profiles.onboarding_complete`.

## Database And Storage Architecture
Supabase Postgres tables are defined in `supabase/migrations` and represented in `src/integrations/supabase/types.ts`.

Core tables:
- `profiles`
- `employers`
- `payslips`
- `payslip_extractions`
- `anomaly_results`
- `issue_drafts`
- `user_notes`
- `billing_subscriptions`
- `subscriptions`
- `audit_events`
- `rate_limits`

Storage:
- Private Supabase Storage bucket `payslips`.
- Storage object policies expect paths to start with the authenticated user's UUID.

## Third-Party Integrations
- Supabase Auth, Postgres, Storage, and Edge Functions.
- Lovable cloud auth wrapper for OAuth.
- Lovable AI gateway for Gemini extraction.
- Lovable Stripe connector gateway and Stripe SDK for payments.
- Static SEO guide pre-rendering through a custom Vite plugin.

## AI And Model Usage
`process-payslip` and `demo-extract-payslip` call `google/gemini-2.5-flash` via `https://ai.gateway.lovable.dev/v1/chat/completions`.

AI output is expected to be JSON. The current code strips markdown fences and parses JSON, then persists raw and normalized extraction payloads. There is no Zod schema validation at the function boundary yet.

## Deployment Architecture
Target deployment is a static Vite frontend plus Supabase backend:
- Build static assets with `npm run build`.
- Host `dist/` on a static provider.
- Apply Supabase migrations.
- Deploy Supabase Edge Functions.
- Configure Supabase secrets and storage bucket.
- Configure Stripe prices, webhook endpoints, and billing portal.
- Configure canonical production domain and SEO metadata.

## Known Architecture Gaps
- No documented deployment provider or CI.
- No Supabase local reset verification was run during this audit.
- `package-lock.json`, `bun.lock`, and `bun.lockb` all exist; npm should be canonicalized.
- `src/pages/Index.tsx` is an unused Lovable placeholder.
- Brand/domain references are inconsistent across app metadata, sitemap, settings comments, and UI.
- US support is inconsistent across frontend, schema, extraction prompt, and product copy.
- Edge Function auth and rate limiting need security review.
- AI extraction lacks strict runtime schema validation.
- Payments need end-to-end sandbox verification and webhook replay tests.

## Recommended Target Architecture
- Keep Vite SPA for MVP, but add CI for install, lint, typecheck, test, and build.
- Canonicalize npm and remove stale duplicate lockfiles after agreement.
- Introduce shared schema validation for AI extraction, function request bodies, and payment payloads.
- Generate Supabase types from the target schema after every migration.
- Add an end-to-end test harness with a seeded Supabase test project or local Supabase stack.
- Replace or explicitly vendor-govern Lovable gateway dependencies before production launch.
