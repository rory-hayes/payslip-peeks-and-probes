# Payslip Insights mobile + web app

This is the mobile-first Expo / React Native client for the focused UK and Ireland product loop:

`upload payslip → review the extracted figures → see what changed → plan until next payday`

It deliberately does not link bank accounts, offer tax advice, handle investments, or pretend an extraction is a verified result.

## Local setup

1. Copy `.env.example` to a local, ignored `.env` file.
2. Set only the public Supabase project URL and publishable key:

   ```text
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

   Never put a service-role key, Stripe secret, or AI-provider key in an `EXPO_PUBLIC_*` variable.
3. Run `npm run web` for a browser preview, or `npm run ios` / `npm run android` for a device or simulator.

## Checks

```text
npx tsc --noEmit
npx expo config --type public
npx expo export --platform web
```

The Expo SDK 57 packages are aligned to the current compatible patch train
(`expo` 57.0.15, `@expo/metro-runtime` 57.0.12, `expo-file-system` 57.0.5,
and `expo-image-picker` 57.0.12), but `npm audit --omit=dev` still reports four
high-severity findings in the Metro/image-size build chain pulled through React
Native 0.86.2. `npm audit fix --dry-run` has no safe package change available;
the remaining advisories require an upstream Expo/React Native train update or
vendor remediation rather than an unsafe override. Treat this as a native
release gate: the companion is locally typechecked, tested, and web-exported,
but it is not a production device binary until the dependency chain is
resolved and a signed device build is verified.

## Auth redirect configuration

The mobile client sends signup-confirmation links to `payslipinsights://auth/callback` and password-recovery links to `payslipinsights://reset-password`, both matching the public `scheme` in `app.json`. The native Supabase client uses PKCE, and the parser rejects implicit-flow access or refresh tokens from the custom scheme; an intercepted URL therefore contains only a one-time code that cannot be exchanged without the verifier held in this app's SecureStore. Before sending real emails, add both URLs (or the constrained `payslipinsights://**` pattern) to the Supabase Auth redirect allow-list. A release build is required for a stable native app scheme; Expo Go URLs are not suitable for production links. A later store release should add verified HTTPS Universal Links/App Links for phishing-resistant routing and denial-of-service resistance.

## Required server-side release work

Before treating the app as live, apply the repo migrations and deploy the authenticated Edge Functions that power extraction and account deletion. Payslip originals use a server-issued upload session: the app receives one exact, two-hour signed upload token, then asks the server to validate and finalise the document. The app does not generate object paths, create direct Storage read links, or remove originals itself.

Roll this out in order:

1. Apply `20260804114000_server_owned_payslip_upload_sessions.sql` and `20260804114500_harden_payslip_upload_token_lifecycle.sql`, deploy the new upload/original/deletion functions, and ship this client version.
2. Configure the server-only `PAYSLIP_UPLOAD_CLEANUP_SECRET` and run the expiry-cleanup function on a protected schedule. Invalid or explicitly removed uploads remain tracked until their non-revocable two-hour upload token expires, and account deletion is safely deferred during that same window. Verify the job in the real Supabase project.
3. Require this (or a later) mobile version before applying `20260804115000_lock_down_direct_payslip_storage.sql`. That final migration removes the legacy browser/mobile Storage policies and will deliberately break older binaries.
4. Apply `20260804120000_durable_account_deletion_workflow.sql`, `20260804121000_complete_account_deletion_reconciliation.sql`, `20260804122000_fail_closed_payslip_link_cleanup.sql`, and `20260804123000_durable_deletion_billing_reconciliation.sql`, set the server-only `ACCOUNT_DELETION_WORKER_SECRET`, and run protected `POST` calls to `delete-account` with that header and `{ "runDue": true }` on a frequent schedule. Prove that a pending deletion resumes after the upload-token window, waits for a recently issued 60-second original link, rejects a new link after failed-upload cleanup starts, blocks a seeded deletion-billing review before Auth deletion, and surfaces a manual-review state to support. Follow the service-only resolution-and-approval procedure in `docs/BILLING_DELETION_RECONCILIATION_RUNBOOK.md` rather than editing deletion records directly.
5. Test two real accounts: own upload and original-link access work; cross-account session finalisation, original links, failed-document deletion, and raw Storage access are denied. In Stripe sandbox, prove a payment that settles during deletion becomes a support/reconciliation case rather than a new entitlement. Test both a newly created and resumed Checkout Session after deletion starts (no client secret), then replay lifetime and subscription events after Auth deletion to prove each becomes one durable review record, resolve and separately approve it, and confirm the known Auth-removal receipt seals without a second Auth deletion.

Also verify the full upload/review/confirm/plan flow, billing entitlements if enabled, account-deletion recovery, the configured document-extraction provider, and the retention/anonymisation policy for the durable deletion receipts. The client will show an honest setup state until its public Supabase configuration is supplied.
