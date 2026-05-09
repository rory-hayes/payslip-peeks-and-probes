# Design System

## Visual Style Summary
The app uses a calm SaaS dashboard style: light neutral backgrounds, white cards, deep blue primary actions, teal accents, green success, amber/orange warning/anomaly states, and red destructive states. The tone is practical and supportive.

## Layout Patterns
- Public pages use sticky top navigation, constrained containers, feature sections, and cards.
- Auth pages use centered cards.
- App pages use `AppLayout` with a desktop sidebar and mobile sheet navigation.
- Dashboard and vault screens use compact cards, charts, and clear empty/loading states.

## Typography
- Inter is loaded from Google Fonts in `index.html`.
- Tailwind `font-sans` maps to Inter/system fonts.
- Use compact headings inside dashboard panels and larger headings only on public/marketing pages.

## Colour Usage
Tokens live in `src/index.css` and are mapped in `tailwind.config.ts`.
- Primary: deep blue for main actions and active navigation.
- Accent: teal for supportive highlights.
- Success: green for normal/healthy states.
- Warning/anomaly: amber/orange for payroll issues.
- Destructive: red for high severity and dangerous actions.
- Background/card/border/muted tokens support the shadcn component set.

## Spacing
- App pages generally use `space-y-6` or `space-y-8` with constrained widths.
- Cards use `p-4`, `p-5`, `p-6`, or `p-8` depending on density.
- Sidebar navigation uses compact `px-3 py-2.5` rows.

## Components
- Base components live in `src/components/ui`.
- Domain components include upload, charts, expected-vs-actual, anomaly explanation, upgrade prompt, cookie consent, verification banner, and layout.
- Use lucide-react icons for actions and section affordances.
- Avoid one-off custom SVG icons unless a brand/logo asset is being added.

## Empty States
Existing empty states are present for dashboard, vault, anomaly filters, compare flow, and missing payslip detail. Preserve the pattern: simple icon, short heading, helpful copy, and one direct action where relevant.

## Loading States
Loading uses shadcn `Skeleton` components for pages and a centered spinner in `ProtectedRoute`. New async screens should follow these patterns.

## Error States
Errors are mostly toast-based plus inline fallback screens for missing data. New flows should avoid silent failures and include retry paths for upload, extraction, and billing.

## Responsive Expectations
- Public pages should work on mobile and desktop.
- Auth cards should remain centered and readable.
- App navigation switches from sidebar to a mobile sheet.
- Tables and comparison grids need special attention on narrow screens.

## Accessibility Notes
- Global `:focus-visible` ring exists in `src/index.css`.
- Buttons and nav use semantic anchors/buttons in most places.
- Some icon-only buttons need consistent `aria-label` review.
- Charts need non-visual summaries for key values.
- Emoji flags and inline emoji greetings should be checked with screen readers.

## Lovable UI Cleanup Areas
- `src/pages/Index.tsx` is a leftover blank-page placeholder and is unused.
- `src/App.css` is unused Vite starter CSS.
- `src/pages/Settings.tsx` contains internal Lovable deployment comments.
- shadcn template files trigger lint warnings; decide whether to adapt lint config or split exported helpers.
- Brand assets are placeholders built from `CheckCircle`; a production logo system is still needed.
