# Ireland-first tax demo audit — 29 August 2026

## Product decision

- Ireland is the public tax-helper default, matching the landing page and EUR-first pricing.
- The tax helper has fictional, country-filtered sample payslips for Ireland and the UK in both the last completed and current tax years.
- The payday dashboard keeps its original UK/GBP-only sample. Tax-helper records are held in separate exports so dashboard totals can never combine EUR and GBP.
- The sample remains an organisational guide. It does not calculate tax liability, decide eligibility, submit a claim, or promise a refund.

## Journeys accepted

1. Open the public landing page and choose **Explore the tax-year planner**.
2. Confirm the sample opens on **Ireland → Last completed → Calendar year 2025** with three sample payslips and Revenue guidance.
3. Switch to **Current year** and confirm **Calendar year 2026** has three sample payslips and Revenue's current-year route.
4. Switch to **United Kingdom** and confirm both **2025/26** and **2026/27** have three sample payslips and HMRC guidance.
5. Confirm the screen works at 1280 × 900 and 390 × 844, with no browser console warnings or errors from the product.

## Evidence

- `01-ireland-completed-desktop.jpg`
- `02-ireland-completed-mobile.jpg`
- `03-ireland-current-mobile.jpg`

## Automated coverage

- Dashboard sample remains exactly three UK/GBP payslips.
- Ireland tax samples reconcile net pay to gross pay less deductions and include pension evidence for both 2025 and 2026.
- UK current-year tax samples reconcile and remain isolated from the dashboard.
- Tax-helper interaction tests cover the Ireland default, completed/current-year switching, the UK switch, official-source links, selection persistence, and checklist progress.
