# Preview Journey UX Audit

Date: 2026-08-29

## Audit scope

- Public homepage at `https://payslipinsights.com`
- Exact local production build for the sample dashboard and tax-year helper
- Desktop viewport at 1440 × 900 and mobile viewport at 390 × 844
- Flow: homepage → fictional sample dashboard → sample tax-year helper

## User goal and accessibility target

A visitor should understand the value of Payslip Insights without sharing a document, know that the figures are fictional, and never be invited to create an account or upload a payslip while those production workflows are closed. The journey should remain readable, operable and honest on mobile and desktop.

## Step 1 — Public homepage

Health: **Strong**

Evidence: `ux-audit-20260829/01-home-desktop-accepted.png` and `ux-audit-20260829/04-home-mobile-accepted.png`

Strengths:

- The main promise, product illustration and sample action form a clear first screen.
- The early-access status appears directly beneath the primary actions.
- The mobile layout keeps both primary actions, the status and trust points visible without clipping.
- Semantic evidence includes a skip link, labelled primary navigation, one page heading, a status region and named controls.

Correction:

- Renamed “Explore the live demo” to “Explore the sample” while customer workflows are closed. This avoids implying that the sample represents an active customer service.

## Step 2 — Fictional sample dashboard

Health before correction: **Major trust defect**

Evidence before: `ux-audit-20260829/02-dashboard-desktop-accepted.png` and `ux-audit-20260829/05-dashboard-mobile-accepted.png`

Evidence after: `ux-audit-20260829/08-dashboard-mobile-after-accepted.png`

Finding:

- The dashboard correctly said that the figures were sample data but presented “Sign up free” and “Sign up to upload” as prominent actions. This directly contradicted the homepage disclosure that new accounts and secure uploads were not open.

Correction:

- The banner now says that the payslips are fictional and repeats the current release boundary.
- “Sign up free” is replaced with “About early access.”
- “Sign up to upload” is replaced with “About secure uploads.”
- The sample payslip dialog uses the same release-aware wording.
- The original account and upload actions return automatically only when the explicit customer-workflow release switch is enabled.

Accessibility notes:

- The sample notice remains a named region.
- The close action keeps an accessible “Exit demo” label.
- Mobile actions retain full-width, touch-sized targets.

## Step 3 — Sample tax-year helper

Health before correction: **Major trust defect**

Evidence before: `ux-audit-20260829/03-tax-helper-desktop-accepted.png` and `ux-audit-20260829/06-tax-helper-mobile-accepted.png`

Evidence after: `ux-audit-20260829/09-tax-helper-mobile-after-accepted.png`

Finding:

- Above the fold, the demo used personal language such as “Your tax year,” “3 confirmed payslips ready,” and “your personal evidence.” A visitor could mistake fictional records for their own account state.

Correction:

- The hero now opens with “Sample tax-year review” and “A tax year, organised.”
- The supporting copy explicitly calls the payslips fictional and states that sample progress resets.
- Readiness uses “sample payslips,” “fictional figures,” and “Open sample history.”
- The checklist and signal badge use “Sample” language rather than implying personal evidence.

Accessibility notes:

- Country and period selectors expose pressed state.
- The readiness card is a named region and the checklist exposes progressbar state.
- Official links remain normal external links with visible action text.

## Evidence limits

- Screenshots support visual hierarchy, responsive layout and visible-copy findings; they do not prove full WCAG compliance.
- DOM inspection confirmed semantic names and states for the captured steps, but VoiceOver, zoom, reduced-motion and full keyboard-order checks remain separate release proofs.
- No real account, document, payment, email or customer data was created for this audit.

## Highest-priority next release proof

Keep customer workflows closed until the seven missing production functions, public operator details, two-account isolation, synthetic UK/Ireland upload, deletion recovery and Stripe test-mode flows are all verified against the intended backend.
