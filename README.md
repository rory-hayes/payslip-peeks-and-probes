# Payslip Insights

Payslip Insights is a focused UK and Ireland payday product:

`upload payslip → review the extracted figures → see what changed → plan until next payday`

It helps a person understand a payslip and make a clear plan from confirmed pay. It does not link bank accounts, make a tax/payroll verdict, provide tax or financial advice, manage investments, or handle shared accounts.

## Apps in this repository

- `apps/mobile` — the Option 1 mobile-first Expo / React Native app, which also exports for web.
- The repository root — the pre-existing Lovable/Vite web app. It is being kept aligned on product name, country scope, pricing language, and trust copy while the mobile-first client becomes the primary experience.

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

## Before a public launch

Local builds and type checks are not a production release. Before deployment:

1. Rotate any historical secrets that were ever committed or shared outside the server.
2. Apply the Supabase migrations without a destructive reset and deploy the required Edge Functions.
3. Add the Expo public Supabase URL and publishable key; keep all service, Stripe, and extraction-provider secrets server-side.
4. Configure Supabase Auth redirects for the native scheme, then test sign-up and password recovery on a release device build.
5. Verify real document-provider handling, retention, privacy copy, and account deletion behaviour.
6. Test checkout, webhook, portal, cancellation, and any legacy subscription reconciliation in Stripe’s sandbox before enabling paid access.
7. Choose and verify the production hosting/domain path for Expo web before pointing `payslipinsights.com` at it.
