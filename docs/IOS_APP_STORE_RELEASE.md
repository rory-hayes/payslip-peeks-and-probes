# Payslip Insights iOS v1 release decision

## Decision

Ship the first App Store version as a free companion to the UK and Ireland web service.

- A new account receives two automatic payslip checks for the lifetime of that account.
- The iOS app contains no checkout, pricing link, or prompt to buy outside the app.
- A person who already has access through the web service can use the same account, but the iOS app does not advertise or sell that access.
- Native in-app purchase is a post-launch decision, not unfinished code hidden in the first binary.

This is the narrowest credible weekend release. It preserves the app's useful core loop without rushing StoreKit products, purchase restoration, server notifications, entitlement reconciliation, refund handling, or App Store subscription testing.

Apple's current [App Review Guideline 3.1.3(f)](https://developer.apple.com/app-store/review/guidelines/#free-stand-alone-apps) allows a free companion to a paid web-based tool to omit in-app purchase when the app has neither purchasing nor calls to action for outside purchasing. If Apple decides this product belongs under the multiplatform-services rule instead, the fallback is to add reviewed in-app purchase before exposing paid native access; it is not to add a web checkout link.

## What v1 must prove

1. Create an account, confirm email, and sign back in through the production mobile deep link.
2. Upload a synthetic PDF or image payslip, wait for extraction, and review every figure before confirmation.
3. Compare the confirmed payslip with the previous confirmed payslip.
4. Use the UK or Ireland tax-year helper without presenting tax advice or a refund promise.
5. Reach the lifetime free limit after two successful automatic checks and continue with manual entry without seeing a purchase prompt.
6. Delete the account from inside the app and verify the backend finishes the documented deletion workflow.

The offline sample mode is useful for visual review but does not prove any of these production-backed flows.

## App Review notes draft

Payslip Insights helps UK and Ireland employees review figures extracted from a payslip, compare confirmed pay periods, and follow official tax-year guidance. Version 1.0 is a free companion app. It does not contain in-app purchasing, a web checkout, pricing links, or calls to action to purchase outside the app. Each new account includes two automatic payslip checks for the lifetime of the account. Please use the supplied review account and synthetic payslips; no real employee data is required. Extracted figures remain unconfirmed until the reviewer compares them with the source document.

Include the review-account credentials, exact synthetic file names, and a short route through upload, review, comparison, tax helper, and account deletion in App Store Connect. Credentials must not be committed to this repository.

## Privacy declaration source of truth

The app privacy manifest declares linked, non-tracking data used for app functionality:

- Name
- Email address
- User ID
- Purchase history, because account access and deletion may depend on an existing verified entitlement
- Other financial information, including salary and payslip figures
- Other user content, including uploaded payslip files and payroll-question content

App Store Connect privacy answers and the public privacy policy must match the real production provider, retention, deletion, and data-sharing behavior. The manifest alone is not a completed privacy submission.

## Manual release gates

- Production Supabase migrations and Edge Functions are deployed and verified from the reviewed revision.
- Public mobile Supabase configuration is supplied to the release build; no server secret is present in the client.
- Auth redirect URLs work in a signed build.
- The public privacy policy and terms are accurate and available.
- The Apple Developer Team owns `com.payslipinsights.app`; signing and distribution profiles are valid.
- Build 1 archives successfully and installs from TestFlight on a real iPhone.
- A production-backed review account and synthetic UK and Ireland payslips are available to App Review.
- App Store Connect metadata, age rating, privacy answers, support URL, screenshots, and review notes are complete.
- The binary is submitted and approved. A successful local or Simulator build is not an App Store release.

Run `npm run release:ios:preflight` from the repository root before archiving.
