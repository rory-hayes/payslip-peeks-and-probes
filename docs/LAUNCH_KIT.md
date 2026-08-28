# Payslip Insights launch kit

This is the commercial accompaniment for the web release and the Expo
companion. It is ready to use after the owner-controlled release gates in the
README and `RESEARCH_AND_GO_TO_MARKET.md` are complete.

## One-line offer

Payslip Insights helps UK and Ireland employees review a payslip, see what
changed from their confirmed history, decide what to ask payroll next, and
organise a tax-year review around official Revenue or HMRC steps.

## Who it is for

Start with employees who:

- receive a PDF or photo payslip rather than a simple mobile-native breakdown;
- have variable hours, overtime, bonuses, salary sacrifice, pension, student
  loan, PRSI, USC, or other changing deductions;
- have asked “why is my take-home pay different?” or manually compared two
  payslips;
- want a private personal record across jobs or payroll portals.

Do not target employers, payroll departments, accountants, or people looking
for formal tax advice in the first release.

## Demo script

Use only the built-in sample data or a redacted fixture. Never use a real
customer payslip in a marketing recording.

1. Open the public site and choose **Try the demo**.
2. Point out that the sample figures are labelled and read-only.
3. Show net pay, the “what changed?” panel, confirmed history, a sample issue
   worth checking, and the official-source tax-year checklist.
4. Open the privacy and terms links before showing the upload CTA.
5. End on **Sign up to upload** and the Free/Plus comparison.

Suggested 45-second voiceover:

> Your payslip is the source of truth, but it is not always easy to understand
> what changed. Payslip Insights lets you upload it, review the figures before
> they are saved, compare confirmed pay over time, and prepare a clear payroll
> question when something is worth checking. It also keeps an official-source
> tax-year checklist organised without calculating or promising a refund. The
> sample dashboard is read-only. Start free with the payslip you already have.

## Acquisition tests

Run these as small, attributable experiments. Record the route, message,
landing visits, demo starts, sign-up starts, completed reviews, checkout
starts, paid purchases, and second-payslip use.

| Test | Audience | Message | Stop/continue |
| --- | --- | --- | --- |
| Payslip change guide | UK/Ireland personal-finance communities | “A simple way to compare the payslip you just received with the last one.” | Continue if 5 people start a review and 1 asks to keep history. |
| Variable-pay guide | Hourly, retail, hospitality, healthcare, and agency workers | “See overtime, pension, tax, NI/PRSI, and USC changes in one review.” | Continue if 3 people use a second payslip within 30 days. |
| Payroll-question demo | Search and community readers who are already asking why pay changed | “Turn a confusing change into a question you can take to payroll.” | Continue if 3 people copy or export a draft and 1 pays. |
| Annual record/export | People changing employer or payroll portal | “Keep a personal, confirmed pay history you control.” | Continue only if people explicitly value the record, not just the free checker. |
| Tax-year review | UK PAYE and Irish PAYE employees approaching or just past year end | “Bring confirmed payslips together, then follow the right official Revenue or HMRC review steps.” | Continue if 5 people open the checklist, 2 return to it, and 1 says it materially improved their year-end process. |

Never imply that the tool proves an error, guarantees a tax result, or replaces
HMRC, Revenue, an employer, payroll, or a professional adviser.

## Community post draft

> I built a small UK/Ireland payslip tool because comparing changing deductions
> across two PDFs is surprisingly awkward. It lets you upload a payslip, review
> the extracted figures yourself, confirm what should enter your history, and
> see what changed from the last confirmed payslip. It can also draft a payroll
> question. It is not tax advice and the demo uses sample data.
>
> I’m looking for people who have actually compared payslips after overtime,
> a bonus, a new pension/student-loan deduction, or a change of job. What do
> you check first, and what would make you trust a tool like this?

Do not paste this into a community as disguised promotion. Follow each
community's rules, disclose that you built the tool, and ask for workflow
feedback before linking to the product.

## Support macros

### Extraction disagreement

> Thanks for flagging this. Payslip Insights does not treat extraction as a
> confirmed payroll result. Please compare the field with your original
> document, edit it in the review screen, and only confirm it when it matches.
> If the document is unclear, leave the field blank or enter it manually. The
> service cannot decide whether payroll or tax is correct; please contact your
> employer, HMRC, Revenue, or a qualified professional for that question.

### Deletion request

> We’ve received your deletion request. The service may briefly keep a queued
> cleanup record while a signed document-upload or original-view credential
> expires. We will not use that as an entitlement or continue processing the
> document. We’ll confirm the final state through the account-deletion workflow.

### Billing question

> Please do not submit another payment while we check this. We’ll verify the
> matching Stripe event and the account’s billing state first. A deletion-time
> payment is reconciled through the service-only review process and is never
> silently treated as new access.

## Instrumentation that is safe to measure

The web app may send only the allow-listed, consent-gated public events already
defined in `src/lib/analytics.ts`: `marketing_cta_clicked`, `demo_started`,
`pricing_cta_clicked`, and `sign_up_started`. Do not add payslip IDs, emails,
document names, extracted figures, plan values, account routes, or checkout
parameters to analytics.

## Release-day checklist

- [ ] Legal entity, contact, governing law, provider, retention, and cookie
  disclosures are final and reviewed by the owner.
- [ ] From the account that owns the intended Supabase project, set the
  database password only in the local shell and run
  `npm run deploy:supabase -- --confirm` from a clean worktree; do not use
  `--functions-only` for a release.
- [ ] Supabase migrations and Edge Functions are deployed from the same clean
  revision.
- [ ] `npm run verify:supabase-deployment` passes against the intended project;
  this is a non-mutating route-existence check, not a substitute for the
  authenticated backend acceptance tests below.
- [ ] Two-account upload, review, original-link, deletion, and isolation tests
  pass in the target project.
- [ ] Provider DPA/retention and cleanup scheduling are observed in the target
  project.
- [ ] Stripe sandbox tests pass for checkout, resume, return verification,
  webhook, portal, cancellation, refund, and deletion-time reconciliation.
- [ ] A matching paid production browser key is configured and the payment
  banner is absent in a fresh production browser.
- [ ] The web release serves the expected `release.json`, security headers,
  route metadata, and current artifact.
- [ ] The companion has been tested with a release-device build or is clearly
  labelled as a non-paid preview; do not imply native billing parity.
- [ ] The first validation cohort is tracked by explicit purchase and repeat
  use, not page views alone.
