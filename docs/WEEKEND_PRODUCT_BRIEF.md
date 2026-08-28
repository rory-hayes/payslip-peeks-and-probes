# Payslip Insights weekend product brief

Last updated: 28 August 2026

## Product promise

Payslip Insights is the private payday companion for employees in Ireland and
the United Kingdom:

`scan -> confirm -> understand -> compare -> act`

Within 60 seconds of confirming a payslip, a customer should understand their
take-home pay, see the changes that matter, and know what to ask payroll next.

The product does not certify that payroll or tax is correct. It preserves the
source document, asks the customer to confirm extracted figures, highlights
factual changes, and points to official services when a tax question requires
an authoritative answer.

## Primary customer

An employed PAYE worker in Ireland or the UK who receives a digital payslip
and has asked at least once, "Why is my take-home different this payday?"

The product is broad enough for employees across both countries. Initial
acquisition campaigns may target a specific occupation, such as nurses or
shift workers, without limiting the underlying product to that occupation.

## Core experience

1. **Scan** a PDF, screenshot, photo, or file.
2. **Confirm** every important extracted figure against the original.
3. **Understand** gross pay, take-home pay, deductions, and unfamiliar labels.
4. **Compare** the current confirmed payslip with the previous comparable one.
5. **Act** by reviewing a change, preparing a payroll question, or opening the
   correct official tax service.

## Weekend release scope

### Must feel exceptional

- Upload and processing states, including retry and manual review.
- Original-document and extracted-figure review.
- First-payslip explanation that gives value before comparison exists.
- Current-versus-previous comparison with clear monetary changes.
- Conservative "worth checking" cards with evidence and next actions.
- A payroll-question draft built from confirmed figures.
- Confirmed pay history.
- A country-aware end-of-year tax checklist linked only to official Revenue or
  HMRC services.
- Mobile return loop around the next expected payday.

### Deliberately outside the release

- Bank connections or live balances.
- Budgeting, spending allocation, or a payday budget planner.
- Refund estimates or promises.
- A verdict that a payslip is correct or incorrect.
- Tax, legal, payroll, or financial advice.
- A general AI chatbot.
- Rota management or salary forecasting.
- Employer accounts, payroll integrations, or international payslips.

## Information architecture

The web product uses:

- **Payday** — the current confirmed result and the next action.
- **Payslips** — upload, review, history, and detailed comparisons.
- **Tax year** — official-source checklist for Ireland or the UK.
- **You** — profile, privacy, billing, export, and account deletion.

"Things to check" remains a contextual destination from Payday and individual
payslips, not a separate mental model the customer must learn.

The iPhone app uses the same language and prioritises camera/file import,
payday reminders, fast review, history, and the tax-year checklist. The website
remains the acquisition, SEO, and account-management surface.

## Tax helper safety boundary

The helper is a guided checklist, not a tax calculator or filing service.

- Ireland guidance links to Revenue's PAYE Income Tax Return, Employment Detail
  Summary, Preliminary End of Year Statement, Statement of Liability, and
  published credit/relief pages.
- UK guidance links to GOV.UK/HMRC's Personal Tax Account and tax-refund route.
- The app never asks for Revenue or HMRC credentials.
- The app never files, claims, or submits information on the customer's behalf.
- Completion means the customer has reviewed the official steps; it does not
  mean a refund is due.

## Commercial model to validate

The free experience must include enough value to demonstrate the core promise:
the first two lifetime automatic checks and the first real comparison.

Plus is the continuing payday record: additional automatic checks, retained
history, change detection, payroll-question drafts, exports, and the tax-year
readiness view. Candidate pricing remains EUR 19.99 / GBP 17.99 annually, with
a monthly option, until live checkout behaviour provides evidence.

Do not describe the pricing model as validated until unrelated customers pay
and return with a later payslip.

## Acceptance and validation

The release candidate is not complete until:

- Three unrelated people complete scan -> confirm -> result without help.
- Five safely redacted Ireland/UK payslip pairs produce usable comparisons.
- A user can recover from failed extraction by entering figures manually.
- The tax helper sends users only to current official sources.
- Small-screen, large-text, VoiceOver, reduced-motion, and offline/error states
  have been checked on the release build.
- StoreKit purchase, restore, cancellation, and web-entitlement reconciliation
  are verified through TestFlight when native paid access is enabled.
- The live domain serves the exact reviewed revision and the production backend
  passes the separate provider, storage, billing, and deletion checks.

The first commercial continuation gate is one unrelated paid customer and at
least three customers who confirm a later payslip within 30 days. Compliments,
downloads, and free first checks are not sufficient evidence.
