# Linear Sync Summary

## Status
- Linear updated: Partial
- Linear workspace/team: TallyRec
- Linear team ID: a8449c74-73fb-406b-9df3-26042598d103
- Linear project URL: https://linear.app/tallyrec/project/paycheck-2f7b58286b26
- Linear project ID: fa531699-47a0-46cc-9ff1-083b6653df63
- Milestones created: 6
- Labels created: 0
- Labels already present: 22
- Issues created: 0
- Issues updated: 0
- Duplicates skipped: 0
- Issues kept local only: 50
- Failures: 49 issue creates blocked by Linear workspace issue limit.

## Failure Detail
Linear accepted the PayCheck project and six milestones, but every attempted issue create returned:

```
Usage limit exceeded - You've exceeded the free issue limit for this workspace. Please upgrade or contact sales@linear.app for a free trial.
```

No existing PayCheck project or PayCheck issues were found before the push attempt. Existing team labels already included all requested `area/*`, `priority/*`, `risk/*`, `mvp-required`, `plan-first`, and `codex-ready` labels.

## Export Counts
- Total local issues: 50
- Issues intended for Linear after limit is lifted: 49
- Local-only by design: 1
- Local-only because Linear issue creation is blocked: 49
- Priority counts: {"P0":19,"P1":17,"P2":13,"P3":1}
- Effort counts: {"M":26,"XS":6,"S":18}
- Status counts: {"Ready for Plan":10,"Backlog":35,"Needs Refinement":5}

## Recommended First 10 Issues To Move To Ready For Plan
1. PPP-SEC-001 - Remove tracked local env files and document credential rotation
2. PPP-SEC-002 - Create credential rotation audit trail
3. PPP-SEC-003 - Upgrade high-risk production dependency advisories
4. PPP-QA-001 - Fix simple lint failures without behavior changes
5. PPP-QA-002 - Replace unsafe frontend any usage in data hooks
6. PPP-QA-003 - Resolve Supabase Edge Function lint baseline
7. PPP-DATA-001 - Verify Supabase migrations on a fresh project
8. PPP-DATA-002 - Regenerate Supabase TypeScript types after schema verification
9. PPP-SEC-004 - Verify RLS and storage isolation policies
10. PPP-AUTH-001 - Add protected route smoke tests

## Risks Before Implementation
- Sensitive payroll data increases the impact of auth, RLS, storage, logging, and deletion mistakes.
- Lovable gateway dependencies for AI and Stripe need explicit production ownership.
- Client route protection is present but is not a security boundary.
- AI output is parsed and persisted without strict runtime schema validation.
- There is no verified E2E coverage for signup through upload, anomaly review, billing, export, and deletion.

## Next Command Or Prompt
After the Linear workspace limit is lifted, rerun the issue sync from `linear-export/issues.json` and avoid duplicates by matching each `Task ID`.

Use this first Codex planning prompt once tickets can be worked:

```
Plan PPP-SEC-001: Remove tracked local env files and document credential rotation. Read AGENTS.md, ROADMAP.md, and the relevant docs first. Produce a decision-complete plan that limits scope to: Remove tracked env files from the index, confirm local ignored files still work, document rotation owners and verification steps.. Include non-goals, acceptance tests, and validation commands: git ls-files .env .env.development .env.production, npm run build.
```
