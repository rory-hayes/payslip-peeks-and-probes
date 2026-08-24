# Security and secrets

Payslip Insights handles sensitive personal and financial information. Production
secrets must never be committed to Git, placed in browser bundles, or copied to
client logs.

## Local configuration

Copy `.env.example` to a local `.env` file and set only public browser values
there. A `VITE_*` value is included in the client bundle, so it must never be a
service-role key, Stripe secret, OpenAI key, webhook secret, or other private
credential.

## Required secret locations

- **Supabase Edge Function secrets:** `SUPABASE_SERVICE_ROLE_KEY`,
  `AI_GATEWAY_API_KEY` for the document-extraction path,
  Stripe secret keys, webhook secrets, cleanup-worker secrets, and any other
  server-only integration tokens.
- **Hosting environment:** public `VITE_*` values only, plus no credentials that
  would grant database, storage, billing, or model-provider access.
- **CI provider:** deployment token and any non-browser deployment secret.

## Current document-provider boundary

The current `process-payslip` Edge Function reads an uploaded PDF or image,
encodes it as base64, and sends that document content to
`https://ai-gateway.vercel.sh/v1/chat/completions` using the server-only
`AI_GATEWAY_API_KEY`. PDFs use file parts and images use high-detail image
parts. The configured model identifier in source is `openai/gpt-5.4`, with a
strict JSON Schema response contract and an independent server-side parser.
The normalized result can include bounded line items, year-to-date values,
non-identifying payroll context printed on the document, and short source
snippets; see [`AI_EXTRACTION_AUDIT.md`](AI_EXTRACTION_AUDIT.md) for the
accuracy and live-provider gates.

That is a real external processor boundary. It is not an approval statement
about provider terms, region, retention, training, or subprocessors. Before
accepting customer payslips in a public paid service, the responsible owner
must verify the provider agreement/DPA, applicable data location and retention
terms, operational deletion path, and the exact public Privacy Policy wording.
Do not describe this provider as having no access to documents.

The gateway key is not a browser value and must be configured as a Supabase
Edge Function secret. Never add it to a `VITE_*` variable, a checked-in
environment file, or a client request.

## Before the first independent release

1. Rotate every credential that was ever present in a tracked environment file:
   Supabase publishable and service-role keys, Stripe keys/webhook secret,
   AI gateway credentials, analytics keys, and any hosting token.
2. Replace local values in ignored environment files and configure the rotated
   values in the appropriate provider secret managers.
3. Confirm `git ls-files -- .env .env.*` returns no tracked environment files.
4. Check build logs, browser errors, function logs, and support exports for
   accidental payslip contents or credentials.
5. Never log raw payslip bytes, full extracted payloads, email addresses, or
   access tokens. Log only a redacted request ID, status, duration, and error
   code.

Removing a secret from the current Git tree does not remove it from history.
Credential rotation is therefore a mandatory owner-controlled release gate.
