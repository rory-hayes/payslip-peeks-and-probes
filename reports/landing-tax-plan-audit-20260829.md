# Landing Tax-Plan Journey Audit

Date: 29 August 2026

## Audit scope

- Local production-shaped homepage and tax-helper handoff
- Desktop viewport and 390 × 844 mobile viewport
- User goal: understand the tax helper before creating an account, then reach the working sample planner

## Step 1 — Understand the tax helper on desktop

Health: **Strong**

Evidence: `landing-tax-plan-evidence-20260829/01-tax-plan-desktop.png`

- The section now describes both current-year and completed-year use, rather than implying it is only a year-end checklist.
- “A plan, not a refund promise” keeps the product boundary visible without weakening the value.
- The preview reflects the real product: selected areas, a private records plan, and an official route.
- The action remains visually distinct and names the planner users will open.

## Step 2 — Understand the same promise on mobile

Health: **Strong**

Evidence: `landing-tax-plan-evidence-20260829/02-tax-plan-mobile.png` and `landing-tax-plan-evidence-20260829/03-tax-plan-card-mobile.png`

- The headline, explanation and action remain legible at 390 px.
- The preview card reflows into one column without clipping or horizontal overflow.
- The private-records message and official-decision boundary remain visible in the compact layout.

## Step 3 — Enter the working sample planner

Health: **Strong**

- “Explore the tax-year planner” opens `/tax-helper` in sample mode.
- The destination shows the country/year controls and “Know what to have ready” plan.
- No browser warnings or errors appeared during the handoff.

## Accessibility notes

- The tax preview remains a named article.
- The action is a named button with a touch-sized mobile target.
- Headings retain a logical visual hierarchy.
- Screenshots and DOM inspection do not prove full screen-reader, zoom, reduced-motion or high-contrast support.

## Remaining release limits

- The public customer workflow must remain closed until the seven missing Edge Function routes are deployed and exercised end to end.
- The host-owned Lovable badge, injected script/metadata and release-manifest caching remain outside the reviewed source.
