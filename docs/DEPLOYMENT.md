# Deployment

## Current State
No deployment provider or CI configuration is committed. The app can be built as static Vite assets and depends on Supabase for backend services.

## Frontend Build
```bash
npm install
npm run build
```

Build output is written to `dist/`.

## Backend Deployment
Production or staging needs:
- Supabase project.
- Migrations from `supabase/migrations`.
- Private Storage bucket named `payslips`.
- Edge Functions under `supabase/functions`.
- Server-side Supabase secrets from `.env.example`.

## Required Secrets
Frontend hosting needs only Vite-safe variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PAYMENTS_CLIENT_TOKEN` when payments are enabled

Supabase Edge Functions need server-side secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `STRIPE_SANDBOX_API_KEY`
- `STRIPE_LIVE_API_KEY`
- `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
- `PAYMENTS_LIVE_WEBHOOK_SECRET`

## Pre-Deploy Checklist
- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm test` passes.
- `npm run build` passes.
- Production dependency audit has no unresolved high vulnerabilities.
- Supabase migrations apply cleanly to a fresh project.
- Edge Functions have secrets configured.
- Stripe sandbox checkout and webhook are verified.
- Canonical domain, sitemap, robots, and Open Graph metadata agree.

## Known Deployment Gaps
- CI is not configured.
- Hosting provider is not selected in repo.
- Domain references are inconsistent.
- Supabase migration verification was not run during this audit.
- Edge Function deployment and Stripe webhook routing need sandbox proof.
