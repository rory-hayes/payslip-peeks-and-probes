# Payslip Insights auth layout design QA

## Comparison target

- Source visual truth: `/var/folders/cz/_dzpxrc91nj3g6nkpzhs761c0000gn/T/TemporaryItems/NSIRD_screencaptureui_x8aOG4/Screenshot 2026-08-29 at 13.47.58.png`
- Source pixels: 2530 x 1648. The source was normalized to 1265 x 824 for comparison because it is exactly double the target CSS viewport in both dimensions.
- Implementation route and state: `http://127.0.0.1:4173/sign-up`, default account-creation form, unchecked legal acknowledgement, development configuration with real-payslip account UI enabled.
- Primary implementation screenshot: `/tmp/payslip-auth-after-1265x824.png`
- Additional implementation screenshots: `/tmp/payslip-auth-after-1280x720.png`, `/tmp/payslip-auth-after-390x844.png`, `/tmp/payslip-sign-in-after-1265x824.png`
- Implementation pixels / CSS viewport / density: 1265 x 824 at a 1265 x 824 CSS viewport and device scale factor 1; additional checks at 1280 x 720 and 390 x 844, also at device scale factor 1.
- Full-view combined comparison: `/tmp/payslip-auth-source-vs-after-1265x824.png`
- Focused form comparison: `/tmp/payslip-auth-form-source-vs-after-1265x824.png`

## Full-view comparison evidence

The compact implementation preserves the source's two-column split, navy product panel, white account panel, card radius, border, shadow, brand lockup, headline wrapping, three outcome cards, illustration, form copy, controls and trust note. The deliberate difference is vertical density: outer and panel padding are reduced so the complete frame ends at y=808 inside an 824px viewport. The source frame continued below the viewport and required a 934px document height at the same CSS size.

## Focused region evidence

The side-by-side form crop confirms that typography, copy, label hierarchy, 40px input/button sizes, border treatment, legal copy, CTA, sign-in link and trust surface remain consistent. A focused crop was needed because the legal and trust copy were too small to judge reliably in the full-page pair.

## Required fidelity surfaces

- Fonts and typography: passed. The existing font family, weights, sizes, line heights, tracking and text wrapping are unchanged; only surrounding vertical space changed.
- Spacing and layout rhythm: passed. Desktop page padding is 16px at normal laptop heights and 12px below 760px. Product/form panel padding is reduced without collisions. At 1265 x 824 the frame is 792px tall and the document has no vertical or horizontal overflow.
- Colors and visual tokens: passed. Brand navy, aqua, coral, white, muted text, borders, shadow and disabled state are unchanged from the source.
- Image quality and asset fidelity: passed. The existing supplied payslip illustration and existing icon library remain intact. At 1280 x 720 only the non-essential lower illustration is intentionally hidden; no placeholder or code-drawn replacement was introduced.
- Copy and content: passed. All account promise, outcome, legal, CTA and trust copy is unchanged.
- Responsiveness and accessibility: passed. The 1280 x 720 account screen has no scroll, 40px inputs and submit button remain unchanged, and the decorative illustration is removed before content is compressed. At 390 x 844 the form remains first, has no horizontal overflow, and the mobile page keeps its expected vertical reading flow.
- Interaction and runtime: passed. Both auth pages rendered without framework overlays or console warnings/errors. From `/sign-in`, activating `Sign up` navigated to `/sign-up` and rendered the account-creation heading.

## Comparison history

1. Initial P2: at 1265 x 824 the source/current implementation produced a 934px document and clipped the bottom of the auth card. Evidence: `/tmp/payslip-auth-before-1265x824.png`. Fix: reduced desktop outer, panel and promise padding while preserving the component sizes and design system. Post-fix evidence: `/tmp/payslip-auth-after-1265x824.png`, with `documentScrollHeight = 824` and no overflow.
2. Responsive P2: the first 1280 x 720 check still measured a 822px document because responsive utility rules overrode the short-height adjustments. Fix: increased only the semantic auth selectors' specificity, then hid the non-essential illustration below 760px. Post-fix evidence: `/tmp/payslip-auth-after-1280x720.png`, with `documentScrollHeight = 720`, the full card visible and no horizontal overflow.

## Findings

No actionable P0, P1 or P2 findings remain.

## Follow-up polish

No P3 change is required for this request. The short-height illustration removal is an intentional content-priority decision rather than a fidelity defect.

final result: passed
