# Security Notes

## Current Security Posture
The app handles sensitive payroll documents and extracted salary data. Supabase RLS, private storage, auth-gated routes, and server-side ownership checks are present, but security is not production-complete.

## Immediate Risks
- Local `.env*` files are tracked in repository history. Rotate any real values and remove tracked env files in a dedicated security cleanup.
- `npm audit --omit=dev` reports high-severity production dependency vulnerabilities.
- Several Supabase Edge Functions have `verify_jwt = false`; public functions must be signature or rate-limit protected, and authenticated functions must manually validate bearer tokens.
- AI extraction persists raw model output. Retention and redaction rules are not formalized.
- Payments depend on Lovable connector gateway secrets and Stripe webhook secrets that must stay server-side.

## Rules For Future Changes
- Never commit secrets or paste real env values into docs, tests, or issues.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret keys, webhook secrets, and `LOVABLE_API_KEY` out of the Vite frontend.
- Prefer server-side validation for request bodies, AI responses, and payment payloads.
- Verify RLS for every new table before exposing it to the browser.
- Do not log payslip file contents, raw OCR text, or full AI extraction JSON in production logs.

## Required Security Checks Before MVP
- Remove tracked env files and rotate credentials.
- Resolve high production dependency vulnerabilities.
- Verify RLS and storage policies in a fresh Supabase project.
- Test unauthorized and cross-user access for every protected data path.
- Verify Stripe webhook signature failure and success paths.
- Document retention for files, extraction JSON, exports, and account deletion.
