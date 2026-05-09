# AGENTS.md

## Project Summary
PayCheck is a Vite React SaaS app for employees who upload payslips, extract key pay figures, compare pay over time, flag anomalies, and draft payroll queries. The intended MVP is a secure self-serve payslip vault with auth, onboarding, AI extraction, review, anomaly tracking, basic billing, and clear export/deletion paths.

## Required Reading Before Code Changes
- README.md
- ROADMAP.md
- docs/ARCHITECTURE.md
- docs/PRODUCT.md
- docs/DATA_MODEL.md
- docs/DESIGN_SYSTEM.md
- docs/QA_CHECKLIST.md
- docs/HANDOFF_ANALYSIS.md

## Setup Commands
- Install: `npm install`
- Local dev: `npm run dev`
- Production build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Tests: `npm test`
- Preview build: `npm run preview`

## Development Rules
- Keep changes small, scoped, and verifiable.
- Do not introduce fake production plumbing or demo flows that look real.
- Do not commit secrets. Use `.env.example` for names only.
- Prefer typed, validated data paths for payslip extraction, billing, and profile updates.
- Protect authenticated routes in the UI and rely on Supabase RLS or explicit server-side ownership checks for data.
- Keep UX consistent with docs/DESIGN_SYSTEM.md.
- Update ROADMAP.md when tasks are completed or new gaps are found.
- Add tests for meaningful logic changes where Vitest can cover the behavior.

## Architecture Rules
- The app is a Vite + React + TypeScript SPA using `react-router-dom` routes in `src/App.tsx`.
- Supabase is the auth, database, storage, and Edge Functions backend.
- Browser data access should go through `src/integrations/supabase/client.ts` and hooks under `src/hooks/`.
- Server-only secrets belong in Supabase function secrets. Never expose service-role, Stripe secret, webhook, or Lovable API keys to Vite.
- Lovable-generated files are present. Treat `src/integrations/lovable/index.ts` and generated Supabase types as generated boundaries.
- Keep Supabase migrations and `src/integrations/supabase/types.ts` in sync after schema changes.

## UI Rules
- Use Tailwind tokens from `src/index.css` and shadcn/Radix components from `src/components/ui`.
- Use lucide-react icons for app UI actions.
- Keep dashboard and workspace screens dense, scannable, and task-focused.
- Preserve existing empty, loading, and error state patterns unless replacing them intentionally across the app.
- Avoid introducing a second visual language or one-off inline styles.

## Testing And Validation
Before handing off code changes, run:
- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`

If a command fails, record the command, failure, likely cause, and whether it blocks MVP in ROADMAP.md or the handoff notes.

## Known Risks
- Lint currently fails on existing `any`, shadcn template, Tailwind config, and Supabase function issues.
- Production dependency audit reports high-severity vulnerabilities, including React Router advisories.
- Local `.env*` files are tracked in the repository history. Do not add values to them; plan a dedicated removal and credential rotation.
- Marketing and schema disagree on US support: UI advertises/includes US, but database checks and extraction types do not fully support it.
- Payments and AI extraction depend on Lovable connector/gateway services that need explicit production ownership.
- There is no verified end-to-end test for signup, upload, extraction, anomaly review, billing, or account deletion.
