# Payslip Insights: research decision and launch thesis

Last reviewed: 23 August 2026

## Decision

Finish and sell Payslip Insights as a narrow **personal pay evidence ledger** for
employees in the UK and Ireland:

`upload a payslip -> review the figures -> confirm what is true -> see what changed -> decide what to ask payroll -> plan to the next payday`

This is an adjacent copy of a proven product pattern, not a copy of another
company's code, brand, or protected content. The pattern being copied is the
small, repeatable utility: start from a document the customer already owns,
return an immediately understandable result, and charge for the retained
workflow around that result.

The product deliberately does **not** claim to be an official payroll record,
tax adviser, employer payslip portal, bank aggregator, or proof that payroll is
wrong. An extracted value remains provisional until the customer reviews and
confirms it.

## Why this one survived the screen

| Criterion | Evidence-led judgement | Decision |
| --- | --- | --- |
| Buyer and job | Employees receive payslips every pay period and are expected to review gross pay, deductions, and net pay. GOV.UK says payslips can be used as proof of earnings and tax paid, and tells employees to check tax-code and deduction details. | Strong recurring job, but individual willingness to pay remains unproven. |
| Pain | People still compare line items manually. A recent UK personal-finance thread describes comparing each salary, bonus, unpaid leave, tax, pension, and other deduction line by line. | Real pain signal, not a revenue proof. |
| Gap | Employer systems mainly deliver current and historical documents. They do not own a person's cross-employer comparison, confirmed-change log, or payroll-question workflow. | Clear product boundary. |
| Competition | Free calculators and one-off checkers exist, including PayslipIQ and MyIrishWages. Employer portals such as ePayslips and myESS validate document access but are employer-led. | Competition confirms the job; differentiation must be the retained, confirmed history and conservative review loop. |
| Distribution | UK/Ireland payslip guides, tax-code questions, salary/payslip communities, and search-led “why did my net pay change?” intent are reachable without sales calls. | Plausible self-serve path; needs real sign-ups and paid checkout. |
| Build fit | The core is a finite document workflow with a review boundary, owner-scoped storage, deterministic comparisons, and a small mobile companion. | Strong fit for a side-project release if external provider, legal, billing, and device gates are completed. |
| Defensibility | Localized field mapping, confirmed-history data, conservative anomaly language, privacy boundaries, and a trusted workflow are more durable than an AI prompt. | Modest but credible; retention and trust are the moat, not OCR alone. |

## Source review

### Starter Story

Starter Story Build's *7 More Micro-SaaS Ideas You Can Build in 2025* covers
narrow products such as a golf tracker, Airtable plugin, mobile-app data tool,
sports-facility tool, music-data tool, and JavaScript-framework tool. Its
*They Copied a $100M SaaS and Got Rich* episode explicitly frames copying as
rebuilding a narrow, already-understood job for a more specific market.

The useful lesson is not that a named case-study product will automatically
work. It is that the offer should be explainable in one sentence, immediately
demonstrable, and attached to an existing job. The case-study revenue and view
counts are directional signals, not audited demand for this product.

### r/microsaas and r/SaaS

The most useful threads were not idea lists. They repeatedly warned that a
good pain point normally has competitors, that a generic AI wrapper fails the
“why not ChatGPT?” test, and that distribution and revealed payment behavior
matter more than novelty.

The recurring patterns that informed this build were:

- a manual workflow repeated weekly or each pay period;
- data or documents the general chat interface cannot safely or reliably own;
- a result that leads to a concrete next action;
- a narrow niche where the customer can find the product without a sales call.

The threads are community-generated and some posts may be promotional or
unverified. They are signal generation only. They do not prove that an
employee will pay Payslip Insights.

### Other sources

- GOV.UK says an employee's payslip should show earnings before and after
  deductions, variable deductions, and hours where pay varies, and tells the
  employee to check the tax code and deductions.
- Revenue says Irish PAYE customers can view pay and statutory deductions in
  myAccount, while non-statutory deductions are not reported there. That leaves
  room for a personal record that includes the full document and the customer's
  own confirmed history without pretending to replace Revenue.
- ePayslips and myESS show that employer-led payslip access/history is an
  established category. They are not direct substitutes for an independent
  review and comparison layer.
- DoctorsVote's SlipSpector and newer UK/Ireland checker products show that
  people seek deduction explanations and checks. They also make the boundary
  clear: Payslip Insights must not compete as an official tax calculator or
  claim guaranteed correctness.

## Candidates rejected

| Candidate | Why it lost |
| --- | --- |
| Generic AI visibility tracker | Fast-changing APIs, crowded market, weak solo-founder distribution, and poor defensibility under the “why not ChatGPT?” test. |
| Generic PDF utility | Demand exists, but the category is crowded and the job is usually one-off; recurring value is weak unless a much narrower workflow is already reachable. |
| Full payroll or employer payslip portal | Employer sales, procurement, compliance, support, and integration burden violate the self-serve side-business constraint. |
| Broad budgeting app | Incumbents own bank connectivity and retention; it would dilute the evidence-led payslip wedge. |
| Contractor scheduling or review monitoring | Stronger B2B economics are possible, but the founder has no verified distribution edge and would be starting a new product surface while the current evidence-led build is already substantial. |

## Offer and pricing hypothesis

The current offer is intentionally low-friction:

- Free: 3 automatic checks and 2 payroll-message drafts per calendar month,
  with confirmed history, comparison, and export.
- Plus: €3.49/month or €19.99/year in Ireland; £2.99/month or £17.99/year in
  the UK, with higher monthly allowances.
- Lifetime: €34.99 or £29.99 once, only as an explicit early-adopter test.

The prices are a test, not a market fact. The first commercial gate is:

1. at least 20 independent visitors start the real sign-up flow;
2. at least 5 complete a document review with their own or safely redacted
   payslip;
3. at least 3 reach a working checkout;
4. at least 1 unrelated customer completes a paid sandbox/live purchase after
   the legal, provider, billing, and support gates are approved;
5. within 30 days, at least 3 customers upload or manually confirm a second
   payslip, or the product is paused and the offer is reworked.

The gates are deliberately stricter than page views, compliments, free
accounts, or a local green build. They can be run asynchronously and do not
require sales calls.

## Product acceptance boundary

The web app is the paid candidate. The Expo/React Native app in `apps/mobile`
is the companion: it shares the same user-owned Supabase data boundary and
core review/plan loop, but it must not be marketed as a paid native release
until native checkout, subscription management, signing, installation, and
device-flow evidence exist.

Before accepting real payslips, the live release still needs owner-controlled
evidence for the configured document provider, retention, legal entity/contact,
Supabase migrations and functions, two-account isolation, signed upload and
original-link lifecycle, scheduled cleanup, account deletion, Stripe sandbox
and live-mode behavior, and a clean release artifact. This document does not
turn those gates into completed evidence.

## Sources

- [Starter Story Build: 7 More Micro-SaaS Ideas You Can Build in 2025](https://www.youtube.com/watch?v=r_BDuMPip_I)
- [Starter Story Build: They Copied a $100M SaaS and Got Rich](https://www.youtube.com/watch?v=cUlharo8sPQ)
- [r/microsaas: 12 founders and how they found their ideas](https://www.reddit.com/r/microsaas/comments/1ri2rsz/talked_to_12_microsaas_founders_making_5k_to/)
- [r/microsaas: scraping 150 subreddits and the “why not ChatGPT?” test](https://www.reddit.com/r/microsaas/comments/1u9yrgz/i_scraped_150_subreddits_to_find_a_microsaas_idea/)
- [r/UKPersonalFinance: manual payslip line-by-line comparison](https://www.reddit.com/r/UKPersonalFinance/comments/1u3qlg0/payslip/)
- [GOV.UK: payslips and employee rights](https://www.gov.uk/payslips)
- [GOV.UK: check if the tax on your payslip is correct](https://www.gov.uk/guidance/check-if-the-tax-on-your-payslip-is-correct)
- [Revenue: view your pay and tax details](https://www.revenue.ie/en/jobs-and-pensions/calculating-your-income-tax/view-pay-tax-details.aspx)
- [ePayslips Mobile](https://apps.apple.com/gb/app/epayslips-mobile/id1539137458)
- [Ardbrook myESS](https://www.ardbrook.ie/myess/)
- [PayslipIQ](https://payslipiq.co.uk/)
- [MyIrishWages](https://play.google.com/store/apps/details?id=com.myirishwages.twa)
- [DoctorsVote SlipSpector discussion](https://www.reddit.com/r/doctorsUK/comments/1f49hng)
