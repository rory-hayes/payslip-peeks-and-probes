# Payslip Insights public conversion audit — 29 August 2026

## Scope and user goal

This audit follows a first-time employee from the public homepage through the sample dashboard, the sample payslip review, the next useful action, and pricing. The user goal is to understand one pay change and leave with a concrete next step without uploading a real payslip.

The live public site was the accepted source. The implementation evidence was captured locally at the same desktop and mobile viewports before release. Local development accepts account workflows, while production remains deliberately fail-closed until the backend, legal, and security gates are complete.

## Journey health

1. **Homepage — healthy.** The promise, Ireland-first positioning, privacy boundary, and primary sample CTA are clear on desktop and mobile. The visible Lovable badge remains a host-level trust issue outside this code change.
2. **Enter the sample dashboard — needs improvement in the live source.** The real first-value action, “Review sample payslip,” was visually weaker than informational early-access and upload actions. On mobile, the secure-upload action dominated the sample review.
3. **Understand the pay change — needs improvement in the live source.** The sample modal led with extraction evidence and placed the useful anomaly later, making the experience feel like a document audit rather than a fast answer.
4. **Act on the insight — broken in the live source.** The public promise was to help users ask payroll a better question, but the sample journey did not produce that question.
5. **Continue or upgrade — healthy with an intentional launch gate.** Ireland and EUR are the default on pricing. Paid/customer workflows remain unavailable rather than pretending checkout or uploads are ready.

## Implemented fix

- Promoted “Review sample payslip” to the dashboard’s primary value action.
- Removed the duplicate closed-state “About secure uploads” action from the dashboard header; the early-access notice retains the launch explanation.
- Reordered the review so pay totals and the detected change appear before extraction evidence.
- Added a deterministic, editable payroll-question draft with a copy action and accessible success/failure status.
- In the closed public preview, the modal continues to the Ireland-first tax-year helper. When customer workflows are genuinely enabled, the existing sign-up action remains.
- Preserved the existing logo, palette, typography, data cards, dialog shell, icons, and responsive navigation.

## Fidelity ledger

| Comparison point | Accepted live source | Implemented render | Assessment |
| --- | --- | --- | --- |
| Product identity | Navy, aqua, lavender, orange; compact Payslip Insights mark | Same tokens, mark, type hierarchy, radii, and icon family | Faithful |
| Dashboard information hierarchy | Net pay and change visible; review action looked secondary | Same content and card structure; review action intentionally promoted in orange | Intentional improvement |
| Modal structure | Read-only sample dialog with sticky footer | Same dialog, header, pay summary, scroll body, and footer behaviour | Faithful |
| Value sequence | Extraction proof before the useful anomaly | Pay summary → change → payroll question → evidence | Intentional improvement |
| Responsive behaviour | Strong mobile stacking, but upload messaging dominated | Existing stacking preserved; review CTA is full width and the question/copy state stack cleanly | Improved without redesign |

The result is visually faithful to the accepted product system. The visible differences are confined to the audited action hierarchy and the missing `insight -> action` step.

## Accessibility and interaction checks

- The sample review remains a labelled dialog with a labelled close control and returns focus to the opener in the existing test coverage.
- The new copy control has an explicit accessible name; its result is announced through a polite live region.
- The primary review action retains a visible focus treatment and a minimum mobile touch height.
- Desktop (1280×720) and mobile (390×844) layouts were visually inspected.
- Browser interaction verified opening the review, reading the anomaly before evidence, copying the question, and seeing the success status without console errors.

These checks do not constitute a full WCAG audit. Screen-reader behaviour across VoiceOver/browser combinations, zoom to 200–400%, reduced-motion settings, and automated contrast analysis remain separate release checks.

## Evidence

Live source:

- `conversion-audit-20260829/01-homepage.jpg`
- `conversion-audit-20260829/02-sample-dashboard.jpg`
- `conversion-audit-20260829/03-sample-review.jpg`
- `conversion-audit-20260829/04-pricing.jpg`
- `conversion-audit-20260829/05-homepage-mobile.jpg`
- `conversion-audit-20260829/06-sample-dashboard-mobile.jpg`

Implemented render:

- `conversion-loop-evidence-20260829/01-dashboard-desktop.jpg`
- `conversion-loop-evidence-20260829/02-sample-review-desktop.jpg`
- `conversion-loop-evidence-20260829/03-payroll-question-desktop.jpg`
- `conversion-loop-evidence-20260829/04-dashboard-mobile.jpg`
- `conversion-loop-evidence-20260829/05-sample-review-mobile.jpg`
- `conversion-loop-evidence-20260829/06-payroll-question-mobile.jpg`
- `conversion-loop-evidence-20260829/07-dashboard-before-after.jpg`
- `conversion-loop-evidence-20260829/08-review-before-after.jpg`
