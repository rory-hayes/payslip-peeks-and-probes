# Payslip Insights

Payslip Insights is a focused UK and Ireland payday product:

`upload payslip → review the extracted figures → see what changed → plan until next payday`

It helps a person understand a payslip and make a clear plan from confirmed pay. It does not link bank accounts, make a tax/payroll verdict, provide tax or financial advice, manage investments, or handle shared accounts.

## Apps in this repository

- `apps/mobile` — the Option 1 Expo / React Native companion build. It is not yet a paid native release surface: it has no native checkout or subscription-management path, so it must not be marketed as one until those flows are built and verified.
- The repository root — the current web release candidate. It owns the reviewed browser checkout and billing-entitlement path, subject to the external release gates below.

## Run locally

The root web app uses the public browser configuration in `.env.example`.

```text
npm install
npm run dev
```

The mobile app has its own setup and public configuration requirements:

```text
cd apps/mobile
npm install
cp .env.example .env
npm run web
```

See [`apps/mobile/README.md`](apps/mobile/README.md) for the Expo setup, auth redirect URLs, and safe handling of public versus server-side keys.

## Product decision and launch accompaniment

The source review and commercial boundary are recorded in
[`docs/RESEARCH_AND_GO_TO_MARKET.md`](docs/RESEARCH_AND_GO_TO_MARKET.md). The
usable launch copy, demo script, acquisition tests, support macros, and release
checklist are in [`docs/LAUNCH_KIT.md`](docs/LAUNCH_KIT.md).

## Optional Plausible analytics

Set `VITE_PLAUSIBLE_DOMAIN=payslipinsights.com` in the production web environment only after adding that site in Plausible. This is a public site hostname, not a secret or API key.

The web app keeps Plausible behind the optional-analytics choice. It uses Plausible's manual pageview mode so the app sends only a small allowlist of public marketing routes (`/`, pricing, sign-in/sign-up, guides, and calculator pages), plus four fixed funnel events with no properties: `marketing_cta_clicked`, `demo_started`, `pricing_cta_clicked`, and `sign_up_started`. It omits query strings and URL fragments, does not send custom event properties, and never identifies a user. Private product routes, payslip or draft IDs, uploaded-file names, extracted data, tokens, emails, plan values, and payment data are excluded by design.

To verify after deployment, use a fresh browser session, accept non-essential cookies, visit `/` then `/pricing`, and confirm the Plausible script plus only those safe pageview requests in the browser network panel. Confirm the same traffic in Plausible's site-installation verifier. Do not test this using a real payslip, customer account, password-reset link, or checkout session.

## Before a public launch

Local builds and type checks are not a production release. Before deployment:

1. Rotate any historical secrets that were ever committed or shared outside the server.
2. Log the Supabase CLI into the account that owns the intended project, set the database password only in the local shell, and use `npm run deploy:supabase -- --confirm`. The guarded command applies migrations through `20260804124000_bound_payday_check_in_to_active_cycle.sql` without a destructive reset, deploys every local Edge Function without pruning remote functions, and runs the non-mutating route verifier. Deploy `start-payslip-upload`, `finish-payslip-upload`, `get-payslip-original-url`, `delete-failed-payslip`, `cleanup-expired-payslip-uploads`, `process-payslip`, `create-checkout`, `verify-checkout-return`, `payments-webhook`, `create-portal-session`, and `delete-account` from the same reviewed revision. Use `--functions-only` only for diagnostics; it does not make the release ready because migrations still need to be applied.
3. From the same clean worktree, run `npm run verify:supabase-deployment`. This uses non-mutating `OPTIONS` requests to prove every required Edge Function route exists; it must pass before any authenticated flow is counted.
4. Treat the web app as the only paid candidate for now. The Expo companion can use public Supabase configuration for authenticated product testing, but do not market a shared paid mobile/web plan until native billing, subscription management, and release-device flows are built and verified.
5. Add a matching public Stripe key as `VITE_PAYMENTS_CLIENT_TOKEN` and verify the server-side Stripe environment and all six active price lookup keys in the same Stripe mode. Checkout performs a fail-closed browser/server mode handshake before a client secret is returned, so deploy the web bundle and `create-checkout` function from the same reviewed revision. The web app intentionally disables checkout when that browser key is absent or malformed.
6. Configure Supabase Auth redirects for the native scheme, then test sign-up and password recovery on a release device build. Native auth uses PKCE and rejects bearer tokens from custom-scheme callbacks; add verified HTTPS Universal Links/App Links before a store release.
7. Roll out the secure document flow in stages: first apply `20260804114000_server_owned_payslip_upload_sessions.sql` and `20260804114500_harden_payslip_upload_token_lifecycle.sql`, then deploy the new functions and clients; verify the new web build and a minimum supported native build; only then apply `20260804115000_lock_down_direct_payslip_storage.sql`. The final migration deliberately removes broad browser Storage permissions, so applying it before old mobile binaries are blocked or upgraded will break their uploads.
8. Set `PAYSLIP_UPLOAD_CLEANUP_SECRET` as a server-only secret and schedule authenticated calls to `cleanup-expired-payslip-uploads` after signed-upload sessions expire. A malformed upload or requested failed-upload removal remains tracked until its non-revocable signed upload token expires (currently about two hours); account deletion is deliberately blocked during that window. The cleanup job must be observed in the target project before accepting real payslips.
9. Apply `20260804120000_durable_account_deletion_workflow.sql`, `20260804121000_complete_account_deletion_reconciliation.sql`, `20260804122000_fail_closed_payslip_link_cleanup.sql`, and `20260804123000_durable_deletion_billing_reconciliation.sql` with that server revision. Set `ACCOUNT_DELETION_WORKER_SECRET` as a server-only secret and schedule protected `POST` calls to `delete-account` with `x-account-deletion-worker-secret` and `{ "runDue": true }` at least once per minute. The cleanup worker also prunes short-lived original-link leases; deletion must wait for a still-valid upload or original-link credential rather than delete while it can still be used. Observe a queued deletion completing after an upload-token wait, plus the manual-review path. Keep the deletion-billing reviews and approval receipts service-only, follow the support resolution-and-approval procedure in `docs/BILLING_DELETION_RECONCILIATION_RUNBOOK.md`, and retain or anonymise all deletion receipts on a documented schedule.
10. Prove the document boundary with two real test accounts: each account can complete its own upload, view its own original through a fresh 60-second server-issued link, and remove its own failed upload; neither can create, list, read, delete, or request a link for the other account's document. In separate tabs, start a failed-upload removal between original-link reservation and response: it must return no URL after the removal fence commits, and the protected worker must wait for a previously issued link to expire before removing the object. Start deletion immediately after issuing an original link and prove that deletion waits until the link expires. Repeat the raw browser Storage checks after the final policy-lockdown migration.
11. Verify the real document-provider boundary. The current source sends base64-encoded customer payslips through Lovable's AI gateway using server-only `LOVABLE_API_KEY` and the configured Gemini model. Agree the provider/DPA, region, retention, deletion, and public disclosure before accepting customer payslips. Do not publish a retention promise until the actual cleanup policy and provider terms are agreed.
12. Test checkout, its exact-session return confirmation, webhook, entitlement, portal, cancellation, refund handling, and deletion-time payment reconciliation in Stripe’s sandbox before enabling paid access. A payment that settles after deletion begins must enter durable manual review for refund/reconciliation; it must never grant access and then be silently cascaded away. Test both a newly created and a resumed Checkout Session after deletion starts (neither may return a client secret), delay a deletion worker between its Auth preparation and final confirmation, then deliver a verified billing event and prove Auth is not called. Replay lifetime and subscription events after Auth deletion, then resolve and separately approve each review to prove the known Auth-removal receipt seals correctly. Also prove the final deletion guard refuses a seeded review without deadlocking a concurrent webhook.
13. Choose and verify the production hosting/domain path for Expo web before pointing `payslipinsights.com` at it.

For the root web app, run the automated baseline from a clean release worktree:

```text
npm run verify
npm run release:web:preflight -- --paid
```

Configure the selected production host to build the paid web release with:

```text
npm run release:web:build:paid
```

That command runs the paid launch gate before Vite creates the browser bundle. The plain `npm run build` command also prepares the Cloudflare/Sites worker archive for local and CI verification, but it does not deploy or prove that the external backend, provider, billing, or legal gates are complete. `npm run preview` reconstructs a temporary Vite preview from the prepared bundle; the Sites artifact keeps route documents under `dist/client/__pages` so the Worker can add response headers before serving them.

The checked-in `.openai/hosting.json`, `worker/index.js`, and
`scripts/prepare-sites-build.mjs` make the exact web artifact deployable to the
owner-controlled Sites project without changing the app's Supabase boundary.
Sites serves matching static assets before its Worker, so the build moves
prerendered route documents into `__pages`; the Worker maps public routes back
to those documents and adds the SPA fallback and production response headers.

The preflight deliberately never prints environment values. It checks that the browser configuration is production-shaped, no release environment file is tracked, the artifact is clean, and the public legal pages no longer contain launch placeholders. It cannot replace the staged Storage rollout, cleanup scheduling, real-provider, payment, or customer-flow checks listed above.

Every production web build also emits a non-secret `release.json` at the site root. It writes route-specific static metadata for the indexable marketing pages and UK/Ireland guide pages, including canonical URLs, JSON-LD, and the shared social card at `/og-default.png`. It separately emits static `noindex, nofollow` shells for literal account, recovery, checkout, and calculator-holding routes so they do not inherit the homepage canonical before JavaScript starts. After deployment, compare the manifest `revision` to the reviewed clean release commit, confirm `worktree` is `clean`, and confirm `surface` is `web`. That establishes what build is live; it does not prove Stripe, Supabase, legal, or provider configuration.

Run the post-deploy shell check from the same clean release worktree, checked out at the exact commit supplied to `--revision`:

```text
npm run release:web:verify-public -- --url https://payslipinsights.com --revision <clean-release-commit>
```

It verifies the live `release.json`, title, production surface, clean-worktree receipt, cache revalidation, the built application module, basic protective headers, and absence of the known Lovable badge or host-injected analytics. It also confirms that `/guides`, one guide, and `/pricing` serve their own pre-hydration canonical, social, and structured-data metadata rather than the homepage shell, while `/sign-in` and `/dashboard` serve static noindex HTML. It deliberately does not upload a document, sign in, or exercise Stripe; complete the staged provider and two-account checks above separately.
