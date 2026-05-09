# Codex Runbook

## Before Starting
1. Read `AGENTS.md`, `README.md`, `ROADMAP.md`, and the docs in `docs/`.
2. Check `git status --short --branch`.
3. Keep work on a `codex/*` branch unless the user asks otherwise.
4. Do not touch local env values except to update `.env.example`.

## Standard Validation
Run the strongest relevant set before handing off:
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

If lint still fails, update the relevant roadmap task rather than claiming the repo is green.

## Updating The Roadmap
When a task is completed:
- Move its status to `Done`.
- Add a short note with the validation run.
- Keep the command-centre export in sync if the user asks for a sheet/export update.

When a new gap is found:
- Add a roadmap row with priority, MVP requirement, acceptance tests, likely files, and a concrete Codex prompt.

## Command Centre
Google Sheet credentials were not available during the bootstrap audit. Use the local fallback files:
- `command-centre/payslip-peeks-and-probes-roadmap.csv`
- `command-centre/payslip-peeks-and-probes-roadmap.json`
- `command-centre/payslip-peeks-and-probes-summary.json`

Do not store Google credentials in the repo.
