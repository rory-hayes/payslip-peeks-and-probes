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

## Auth redirect configuration

The mobile client sends signup-confirmation links to `payslipinsights://auth/callback` and password-recovery links to `payslipinsights://reset-password`, both matching the public `scheme` in `app.json`. Before sending real emails, add both URLs (or the constrained `payslipinsights://**` pattern) to the Supabase Auth redirect allow-list. A release build is required for a stable native app scheme; Expo Go URLs are not suitable for production links.

## Required server-side release work

Before treating the app as live, apply the repo migrations and deploy the authenticated Edge Functions that power extraction and account deletion. Verify a real two-user isolation test, an upload/review/confirm/plan flow, billing entitlements if enabled, and the configured document-extraction provider. The client will show an honest setup state until its public Supabase configuration is supplied.
