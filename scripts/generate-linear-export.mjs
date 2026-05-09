import fs from "node:fs";
import path from "node:path";

const generatedAt = "2026-05-06";
const repoRoot = process.cwd();
const exportDir = path.join(repoRoot, "linear-export");
const tasksDir = path.join(repoRoot, "tasks");

const project = {
  project_name: "PayCheck",
  project_slug: "payslip-peeks-and-probes",
  repo_url: "https://github.com/rory-hayes/payslip-peeks-and-probes",
  deployment_url: null,
  product_summary:
    "PayCheck is a Vite React SaaS app for employees to upload payslips, extract key pay figures, compare pay over time, flag anomalies, and draft payroll queries.",
  current_stage:
    "Audited Lovable-migrated product shell. Build, typecheck, tests, and dev smoke pass; lint, dependency security, live backend verification, and production operations remain blockers.",
  mvp_readiness_score: 5,
  production_readiness_score: 5,
  target_readiness_score: 10,
  top_blockers: [
    "Tracked local env files and repository history require cleanup and credential rotation.",
    "npm run lint fails and cannot yet be used as a CI gate.",
    "Production dependency audit reports high-severity vulnerabilities.",
    "Supabase migrations, RLS, storage policies, and Edge Functions need fresh-project verification.",
    "Country support claims and persistence/extraction support disagree, especially around US support.",
    "Stripe, AI extraction, export, delete, and full MVP runtime flows need sandbox verification."
  ],
  top_risks: [
    "Sensitive payroll data increases the impact of auth, RLS, storage, logging, and deletion mistakes.",
    "Lovable gateway dependencies for AI and Stripe need explicit production ownership.",
    "Client route protection is present but is not a security boundary.",
    "AI output is parsed and persisted without strict runtime schema validation.",
    "There is no verified E2E coverage for signup through upload, anomaly review, billing, export, and deletion."
  ],
  recommended_next_focus: [
    "Secrets and credential hygiene",
    "Security dependency updates",
    "Lint/type-safety baseline",
    "Supabase sandbox verification",
    "First E2E smoke tests"
  ],
  audit_date: generatedAt,
  linear_team: {
    workspace: "TallyRec",
    team_name: "TallyRec",
    team_id: "a8449c74-73fb-406b-9df3-26042598d103",
    issue_key_prefix: "TAL"
  },
  linear_project_url: "https://linear.app/tallyrec/project/paycheck-2f7b58286b26",
  linear_project_id: "fa531699-47a0-46cc-9ff1-083b6653df63"
};

const milestones = [
  ["00 Repo Audit & Setup", "Stabilize the repo, exports, security hygiene, lint baseline, dependency posture, and CI prerequisites.", "f26f4217-0e8b-4490-8cd8-b736651bff82"],
  ["01 MVP Foundation", "Verify auth, Supabase schema, data isolation, environment setup, and foundational route behavior.", "e3e9e331-cff2-4fad-8ac7-85529c2a2a3d"],
  ["02 Core Product Flow", "Harden upload, extraction, anomaly, draft, export, delete, and billing flows for MVP usage.", "54455c9d-67ab-4f5e-95c7-203910b35ff2"],
  ["03 Production Readiness", "Add operational, privacy, security, observability, deployment, and regression coverage.", "fc4819e7-3c6a-4fa4-8f35-81cf688bc8db"],
  ["04 Launch Candidate", "Complete final responsive, accessibility, deployment, monitoring, and beta acceptance checks.", "5c23060d-01a4-4153-af1a-8e1173c135a6"],
  ["05 Later Enhancements", "Hold non-MVP support/admin and scale enhancements until the core product is production-safe.", "8577325e-483b-4301-8cfa-479693a44c50"]
].map(([name, description, linear_milestone_id], index) => ({
  name,
  description,
  order: index + 1,
  target_date: null,
  linear_milestone_id
}));

const labelDefinitions = [
  ["area/auth", "#5E6AD2", "Authentication, session, route protection, and identity work."],
  ["area/data", "#0F766E", "Database, schema, migrations, RLS, storage, and data lifecycle work."],
  ["area/api", "#0891B2", "API contracts, Edge Function request/response behavior, and validation work."],
  ["area/frontend", "#7C3AED", "React pages, components, hooks, and client interaction work."],
  ["area/backend", "#2563EB", "Supabase Edge Functions and server-owned behavior."],
  ["area/ai", "#9333EA", "AI extraction, prompts, validation, evals, and model observability."],
  ["area/security", "#DC2626", "Secrets, authz, dependency security, privacy, and abuse controls."],
  ["area/billing", "#059669", "Stripe, subscriptions, entitlements, checkout, and portal work."],
  ["area/qa", "#EA580C", "Automated tests, manual QA, route smoke, and regression work."],
  ["area/deployment", "#475569", "CI/CD, hosting, Supabase deploy, and runbook work."],
  ["area/ux", "#DB2777", "User journeys, accessibility, responsive, empty/loading/error states, and copy."],
  ["area/docs", "#64748B", "Documentation, decisions, runbooks, and planning artifacts."],
  ["priority/P0", "#B91C1C", "Blocks MVP or production safety."],
  ["priority/P1", "#EA580C", "Important for usable MVP."],
  ["priority/P2", "#CA8A04", "Improves polish, scalability, or operations."],
  ["priority/P3", "#64748B", "Later enhancement."],
  ["mvp-required", "#16A34A", "Required for MVP."],
  ["plan-first", "#6366F1", "Requires an explicit Codex plan before implementation."],
  ["codex-ready", "#22C55E", "Small, scoped, and ready for one focused Codex branch/PR."],
  ["risk/high", "#EF4444", "High-risk auth, security, billing, data isolation, or migration work."],
  ["risk/medium", "#F97316", "Moderate-risk production or user-facing work."],
  ["risk/low", "#84CC16", "Low-risk docs, config, or isolated cleanup work."]
].map(([name, color, description]) => ({
  name,
  color,
  description,
  team_id: project.linear_team.team_id
}));

const riskDefaults = {
  "High": "risk/high",
  "Medium": "risk/medium",
  "Low": "risk/low"
};

const priorityToLinear = {
  P0: 1,
  P1: 2,
  P2: 3,
  P3: 4
};

const effortToEstimate = {
  XS: 1,
  S: 2,
  M: 3,
  L: 5
};

const areaLabels = {
  Auth: "area/auth",
  Data: "area/data",
  API: "area/api",
  Frontend: "area/frontend",
  Backend: "area/backend",
  AI: "area/ai",
  Security: "area/security",
  Billing: "area/billing",
  QA: "area/qa",
  Deployment: "area/deployment",
  UX: "area/ux",
  Docs: "area/docs",
  Product: "area/ux",
  Runtime: "area/qa",
  Performance: "area/frontend",
  Repo: "area/docs",
  Observability: "area/deployment",
  Support: "area/docs",
  Brand: "area/ux",
  Reliability: "area/backend"
};

const branchSlug = (id, title) =>
  `codex/${id.toLowerCase()}-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 46)}`;

const promptFor = (mode, issue) => {
  const validation = issue.validationCommands.join(", ");
  if (mode === "planning") {
    const scope = issue.scope.replace(/\s+/g, " ");
    return `Plan ${issue.id}: ${issue.title}. Read AGENTS.md, ROADMAP.md, and the relevant docs first. Produce a decision-complete plan that limits scope to: ${scope}. Include non-goals, acceptance tests, and validation commands: ${validation}.`;
  }
  return `Implement ${issue.id}: ${issue.title}. Follow the approved plan, keep the branch focused on ${issue.branch}, do not change unrelated behavior, update ROADMAP.md if the status or gaps change, and validate with: ${validation}.`;
};

const issue = (input) => {
  const labels = new Set([
    areaLabels[input.area] || "area/docs",
    `priority/${input.priority}`,
    riskDefaults[input.risk],
    ...(input.mvp ? ["mvp-required"] : []),
    ...(input.planFirst ? ["plan-first"] : []),
    ...(input.status === "Ready for Plan" ? ["codex-ready"] : []),
    ...(input.extraLabels || [])
  ]);
  const branch = input.branch || branchSlug(input.id, input.title);
  const normalized = {
    "Task ID": input.id,
    "Title": input.title,
    "Area": input.area,
    "Epic": input.epic,
    "Priority": input.priority,
    "MVP Required": input.mvp ? "Yes" : "No",
    "Effort": input.effort,
    "Risk Level": input.risk,
    "Status": input.status || "Backlog",
    "Milestone": input.milestone,
    "Description": input.description,
    "User Value": input.userValue,
    "Current State": input.currentState,
    "Gap / Risk": input.gapRisk,
    "Scope": input.scope,
    "Explicit Non-Goals": input.nonGoals,
    "Dependencies": input.dependencies || "None.",
    "Definition of Done": input.dod,
    "Acceptance Tests": input.acceptanceTests,
    "Validation Commands": input.validationCommands,
    "Files Likely Affected": input.files,
    "Suggested Codex Planning Prompt": "",
    "Suggested Codex Implementation Prompt": "",
    "Recommended Branch Name": branch,
    "Labels": [...labels],
    "Source": input.source,
    "Notes": input.notes || "No additional notes.",
    "Linear Push": input.localOnly ? "Local only" : "Push to Linear",
    "Linear Issue ID": null,
    "Linear Issue URL": null
  };
  normalized["Suggested Codex Planning Prompt"] = promptFor("planning", {
    id: input.id,
    title: input.title,
    scope: input.scope,
    validationCommands: input.validationCommands,
    branch
  });
  normalized["Suggested Codex Implementation Prompt"] = promptFor("implementation", {
    id: input.id,
    title: input.title,
    validationCommands: input.validationCommands,
    branch
  });
  return normalized;
};

const issues = [
  issue({
    id: "PPP-SEC-001",
    title: "Remove tracked local env files and document credential rotation",
    area: "Security",
    epic: "Secrets hygiene",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Ready for Plan",
    milestone: "00 Repo Audit & Setup",
    description: "Stop tracking committed local env files, preserve a complete .env.example, and create a rotation checklist without exposing any secret values.",
    userValue: "Protects sensitive service credentials before more contributors work in the repo.",
    currentState: ".gitignore blocks future env files, but tracked .env, .env.development, and .env.production are recorded as a current risk.",
    gapRisk: "Committed values may remain in history and could be reused if not rotated.",
    scope: "Remove tracked env files from the index, confirm local ignored files still work, document rotation owners and verification steps.",
    nonGoals: "Do not print secret values, rewrite git history, or rotate credentials directly inside the repo.",
    dependencies: "Human credential owner must rotate any real exposed values.",
    dod: "git no longer tracks local env files; .env.example remains complete; SECURITY docs list every credential class needing rotation.",
    acceptanceTests: "git ls-files .env .env.development .env.production returns no files; local setup docs still explain env names without values.",
    validationCommands: ["git ls-files .env .env.development .env.production", "npm run build"],
    files: [".gitignore", ".env.example", "docs/SECURITY.md", "README.md"],
    source: "Code Audit",
    planFirst: true,
    notes: "Dedicated security PR; avoid exposing deleted secret values in review diffs."
  }),
  issue({
    id: "PPP-SEC-002",
    title: "Create credential rotation audit trail",
    area: "Security",
    epic: "Secrets hygiene",
    priority: "P0",
    mvp: true,
    effort: "XS",
    risk: "High",
    status: "Ready for Plan",
    milestone: "00 Repo Audit & Setup",
    description: "Create a local checklist that identifies which Supabase, Stripe, Lovable, Google, and deployment credentials need rotation or owner confirmation.",
    userValue: "Makes sensitive credential cleanup accountable without storing secrets.",
    currentState: "SECURITY.md notes credential rotation risk but there is no per-provider audit trail.",
    gapRisk: "Credential cleanup can be missed or assumed complete without evidence.",
    scope: "Add a no-secrets rotation checklist with owner, status, verification method, and last-reviewed fields.",
    nonGoals: "Do not include values, partial values, screenshots, or provider console exports.",
    dependencies: "PPP-SEC-001.",
    dod: "A rotation checklist exists and every referenced env var class is mapped to an owner/status.",
    acceptanceTests: "rg confirms no secret-looking values were added; checklist covers all .env.example variables.",
    validationCommands: ["rg \"(sk_|eyJ|AIza|service_role|STRIPE_)\" docs .env.example", "npm run build"],
    files: ["docs/SECURITY.md", ".env.example", "docs/CODEX_RUNBOOK.md"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-SEC-003",
    title: "Upgrade high-risk production dependency advisories",
    area: "Security",
    epic: "Dependency health",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Ready for Plan",
    milestone: "00 Repo Audit & Setup",
    description: "Resolve or document production npm audit findings, especially React Router and PostCSS advisories.",
    userValue: "Reduces known security risk before launch.",
    currentState: "npm audit --omit=dev reports 9 production vulnerabilities, including 6 high.",
    gapRisk: "Known vulnerable packages can ship to production.",
    scope: "Upgrade vulnerable production dependencies conservatively and document any accepted residual advisories.",
    nonGoals: "Do not perform broad framework rewrites or change app routing behavior unless required by a dependency upgrade.",
    dependencies: "Passing current test/build baseline.",
    dod: "No high production advisories remain, or each remaining advisory has an explicit accepted-risk note.",
    acceptanceTests: "Audit, tests, typecheck, and build pass; public and protected route smoke still behaves as before.",
    validationCommands: ["npm audit --omit=dev", "npm test", "npx tsc --noEmit", "npm run build"],
    files: ["package.json", "package-lock.json", "src/App.tsx"],
    source: "Runtime Test",
    planFirst: true
  }),
  issue({
    id: "PPP-QA-001",
    title: "Fix simple lint failures without behavior changes",
    area: "QA",
    epic: "Lint baseline",
    priority: "P0",
    mvp: true,
    effort: "S",
    risk: "Medium",
    status: "Ready for Plan",
    milestone: "00 Repo Audit & Setup",
    description: "Resolve low-risk ESLint errors such as prefer-const, no-useless-escape, and no-require-imports before tackling typed behavior changes.",
    userValue: "Moves the repo toward a trustworthy CI gate with minimal product risk.",
    currentState: "npm run lint fails with 25 errors and 9 warnings.",
    gapRisk: "Lint cannot protect future PRs while existing failures remain.",
    scope: "Fix mechanical lint errors that do not change runtime behavior.",
    nonGoals: "Do not suppress whole files, rewrite shadcn components, or touch product logic beyond mechanical fixes.",
    dependencies: "None.",
    dod: "The targeted simple lint class is gone and remaining lint failures are itemized for follow-up tickets.",
    acceptanceTests: "npm run lint shows fewer errors; typecheck, tests, and build still pass.",
    validationCommands: ["npm run lint", "npx tsc --noEmit", "npm test", "npm run build"],
    files: ["src/lib/date-utils.ts", "src/pages/*", "tailwind.config.ts", "eslint.config.js"],
    source: "Runtime Test"
  }),
  issue({
    id: "PPP-QA-002",
    title: "Replace unsafe frontend any usage in data hooks",
    area: "QA",
    epic: "Type safety",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "Medium",
    status: "Ready for Plan",
    milestone: "00 Repo Audit & Setup",
    description: "Replace the highest-risk explicit any usage in frontend data hooks with Supabase-generated or local domain types.",
    userValue: "Reduces hidden data-shape mistakes in payslip and anomaly screens.",
    currentState: "use-payslip-data and related app code use explicit any around core rows and casts.",
    gapRisk: "Country, extraction, and anomaly data can drift silently from database types.",
    scope: "Type payslip, extraction, anomaly, and profile data paths used by dashboard/vault/detail hooks.",
    nonGoals: "Do not change database schema or add new product behavior.",
    dependencies: "Current generated Supabase types.",
    dod: "Targeted frontend any usage is replaced or justified with narrow local types.",
    acceptanceTests: "Lint error count drops; TypeScript still passes; affected pages render with existing mocks/tests.",
    validationCommands: ["npm run lint", "npx tsc --noEmit", "npm test"],
    files: ["src/hooks/use-payslip-data.ts", "src/hooks/use-profile.ts", "src/lib/types.ts", "src/pages/Dashboard.tsx"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-QA-003",
    title: "Resolve Supabase Edge Function lint baseline",
    area: "QA",
    epic: "Lint baseline",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "Medium",
    status: "Ready for Plan",
    milestone: "00 Repo Audit & Setup",
    description: "Address explicit any and related lint failures in Supabase Edge Functions with narrow interfaces or scoped lint configuration.",
    userValue: "Improves confidence in security-sensitive server behavior.",
    currentState: "Supabase functions are included in npm run lint and currently contribute errors.",
    gapRisk: "Function code can drift without a passing lint gate.",
    scope: "Type request payloads, AI responses, webhook events, and helper return values enough for lint to pass or document intentional exceptions.",
    nonGoals: "Do not redesign extraction, billing, or Edge Function architecture.",
    dependencies: "None.",
    dod: "Edge Function lint failures are gone or explicitly scoped in ESLint config with rationale.",
    acceptanceTests: "npm run lint improves or passes; function behavior is unchanged by tests/manual inspection.",
    validationCommands: ["npm run lint", "npm test", "npm run build"],
    files: ["supabase/functions/*/index.ts", "supabase/functions/_shared/*.ts", "eslint.config.js"],
    source: "Runtime Test",
    planFirst: true
  }),
  issue({
    id: "PPP-QA-004",
    title: "Add CI workflow for repo quality gates",
    area: "QA",
    epic: "CI gate",
    priority: "P0",
    mvp: true,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "00 Repo Audit & Setup",
    description: "Add a GitHub Actions workflow that runs install, lint, typecheck, tests, and build on pull requests.",
    userValue: "Prevents regressions from landing unnoticed.",
    currentState: "No CI workflow is documented in the repo.",
    gapRisk: "Local-only validation is easy to skip.",
    scope: "Add one PR workflow using npm and existing scripts, with no deployment side effects.",
    nonGoals: "Do not add production deployment, Supabase deploys, or secret-dependent E2E tests.",
    dependencies: "PPP-QA-001, PPP-QA-002, PPP-QA-003.",
    dod: "Workflow exists, uses npm, and all configured checks pass on a clean branch.",
    acceptanceTests: "Workflow YAML validates and local commands match CI steps.",
    validationCommands: ["npm run lint", "npx tsc --noEmit", "npm test", "npm run build"],
    files: [".github/workflows/ci.yml", "README.md", "AGENTS.md"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-DATA-001",
    title: "Verify Supabase migrations on a fresh project",
    area: "Data",
    epic: "Supabase readiness",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Ready for Plan",
    milestone: "01 MVP Foundation",
    description: "Apply every Supabase migration to a fresh local or sandbox project and record any failures.",
    userValue: "Confirms real user data can be created on a clean backend.",
    currentState: "Migrations exist but were not applied during the audit.",
    gapRisk: "The app may build while the backend schema fails from scratch.",
    scope: "Run a fresh Supabase reset or sandbox migration, capture output, and document fixes needed without changing product behavior.",
    nonGoals: "Do not perform destructive operations against production data.",
    dependencies: "Supabase CLI and a local stack or sandbox project.",
    dod: "Fresh schema applies cleanly or every blocker is documented with file and failure details.",
    acceptanceTests: "supabase db reset or sandbox equivalent reaches a usable schema; no migration is skipped silently.",
    validationCommands: ["supabase db reset", "npx tsc --noEmit"],
    files: ["supabase/migrations/*", "docs/DATA_MODEL.md", "docs/DEPLOYMENT.md"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-DATA-002",
    title: "Regenerate Supabase TypeScript types after schema verification",
    area: "Data",
    epic: "Supabase readiness",
    priority: "P0",
    mvp: true,
    effort: "S",
    risk: "Medium",
    status: "Ready for Plan",
    milestone: "01 MVP Foundation",
    description: "Regenerate src/integrations/supabase/types.ts from the verified Supabase schema and confirm app typecheck passes.",
    userValue: "Keeps frontend and Edge Function code aligned with the database.",
    currentState: "Generated types exist but schema freshness was not verified during the audit.",
    gapRisk: "Stale types can hide missing columns, changed enums, or country constraint drift.",
    scope: "Generate types from the verified local/sandbox schema and review the diff for expected changes only.",
    nonGoals: "Do not hand-edit generated types.",
    dependencies: "PPP-DATA-001.",
    dod: "Generated types match the verified schema and TypeScript passes.",
    acceptanceTests: "Types are generated by the Supabase CLI; no manual edits appear in the generated file.",
    validationCommands: ["npx tsc --noEmit", "npm test", "npm run build"],
    files: ["src/integrations/supabase/types.ts", "supabase/migrations/*"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-SEC-004",
    title: "Verify RLS and storage isolation policies",
    area: "Security",
    epic: "Data isolation",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Ready for Plan",
    milestone: "01 MVP Foundation",
    description: "Test that user-owned tables and the payslips storage bucket deny cross-user reads and writes.",
    userValue: "Protects sensitive payroll documents and salary data from cross-account exposure.",
    currentState: "RLS and storage policies are documented, but not freshly verified during the audit.",
    gapRisk: "A policy gap could expose payslips, extractions, anomalies, notes, or billing rows.",
    scope: "Create repeatable RLS/storage policy checks for two users in local or sandbox Supabase.",
    nonGoals: "Do not redesign tenancy or add workspace support.",
    dependencies: "PPP-DATA-001.",
    dod: "Cross-user reads/writes fail for every user-owned table and storage prefix checked.",
    acceptanceTests: "Two-user test fixture proves own-data allowed and other-user data denied.",
    validationCommands: ["supabase db reset", "npm test"],
    files: ["supabase/migrations/*", "docs/SECURITY.md", "tests/*"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-AUTH-001",
    title: "Add protected route smoke tests",
    area: "Auth",
    epic: "Route protection",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Ready for Plan",
    milestone: "01 MVP Foundation",
    description: "Add smoke coverage for unauthenticated, onboarding-incomplete, demo, and authenticated route behavior.",
    userValue: "Prevents users from entering broken or unauthorized app states.",
    currentState: "ProtectedRoute handles redirects, but route behavior is not covered by route smoke tests.",
    gapRisk: "Client routing regressions can expose screens or block valid users.",
    scope: "Test core protected routes and redirects using existing React/Vitest tooling or a small route smoke harness.",
    nonGoals: "Do not replace Supabase RLS with client route protection.",
    dependencies: "Stable test setup.",
    dod: "Protected route behavior is covered for anonymous, demo, onboarding-incomplete, and completed users.",
    acceptanceTests: "Anonymous /dashboard redirects to sign-in; incomplete profile redirects to onboarding; demo is limited to dashboard.",
    validationCommands: ["npm test", "npx tsc --noEmit"],
    files: ["src/components/ProtectedRoute.tsx", "src/App.tsx", "src/test/*"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-PROD-001",
    title: "Decide MVP country support scope",
    area: "Product",
    epic: "Country support",
    priority: "P0",
    mvp: true,
    effort: "XS",
    risk: "Medium",
    status: "Needs Refinement",
    milestone: "01 MVP Foundation",
    description: "Make a product decision on whether US support is included in MVP or removed until persistence and extraction support are complete.",
    userValue: "Prevents users from selecting countries the product cannot reliably support.",
    currentState: "Marketing and calculators include US, while schema and extraction support are inconsistent.",
    gapRisk: "Onboarding/profile saves or extraction can fail for advertised countries.",
    scope: "Record the chosen MVP country list and the rationale in product/data docs.",
    nonGoals: "Do not implement country support in this decision ticket.",
    dependencies: "Product owner decision.",
    dod: "A documented MVP country list exists and follow-up implementation tickets are updated if needed.",
    acceptanceTests: "PRODUCT and DATA_MODEL docs agree on MVP country support.",
    validationCommands: ["rg \"United States|US|USA|country\" docs src supabase"],
    files: ["docs/PRODUCT.md", "docs/DATA_MODEL.md", "ROADMAP.md"],
    source: "Product Assumption",
    planFirst: true
  }),
  issue({
    id: "PPP-PROD-002",
    title: "Align frontend country options with MVP decision",
    area: "Product",
    epic: "Country support",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "01 MVP Foundation",
    description: "Update onboarding, calculators, marketing copy, guides, and country registries to expose only supported MVP countries.",
    userValue: "Keeps the app honest and prevents unsupported onboarding paths.",
    currentState: "Country references are distributed across UI, calculators, guide copy, and types.",
    gapRisk: "UI can continue to overpromise after the product decision.",
    scope: "Apply the approved country list across frontend country selectors and public claims.",
    nonGoals: "Do not modify database constraints in this frontend ticket.",
    dependencies: "PPP-PROD-001.",
    dod: "Every exposed country option is supported by the approved MVP country list.",
    acceptanceTests: "Onboarding only offers supported countries; public copy and calculators do not advertise unsupported countries.",
    validationCommands: ["rg \"United States|US|USA\" src docs public", "npm test", "npm run build"],
    files: ["src/pages/Onboarding.tsx", "src/pages/Landing.tsx", "src/lib/tax-calculator*.ts", "src/lib/types.ts"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-DATA-003",
    title: "Align database country constraints and generated types",
    area: "Data",
    epic: "Country support",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "01 MVP Foundation",
    description: "Update Supabase country constraints, enums, and generated types to match the approved MVP country list.",
    userValue: "Prevents valid UI country choices from failing persistence.",
    currentState: "Database constraints and TypeScript country support do not fully match UI claims.",
    gapRisk: "Profile or payslip rows may fail for countries presented in the app.",
    scope: "Add a migration for the approved country set and regenerate types.",
    nonGoals: "Do not alter tax calculation formulas beyond country support plumbing.",
    dependencies: "PPP-PROD-001, PPP-DATA-001.",
    dod: "Schema, generated types, and frontend country type definitions agree.",
    acceptanceTests: "A profile can be saved for every listed country in sandbox; unsupported country insert is rejected.",
    validationCommands: ["supabase db reset", "npx tsc --noEmit", "npm test"],
    files: ["supabase/migrations/*", "src/integrations/supabase/types.ts", "src/lib/types.ts"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-RUN-001",
    title: "Create sandbox MVP E2E smoke plan and fixtures",
    area: "Runtime",
    epic: "Core flow verification",
    priority: "P0",
    mvp: true,
    effort: "S",
    risk: "Medium",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Define the sandbox users, payslip fixture, Stripe test setup, and expected evidence for the full MVP smoke test.",
    userValue: "Turns runtime verification into repeatable work instead of ad hoc clicking.",
    currentState: "QA checklist exists, but no executable E2E plan or fixtures are present.",
    gapRisk: "Core flows may fail only after launch because they were not run end to end.",
    scope: "Create a smoke test plan and safe test fixture references without committing real payslips.",
    nonGoals: "Do not add Playwright automation in this planning ticket.",
    dependencies: "Sandbox Supabase and Stripe access.",
    dod: "QA docs name test accounts, fixture expectations, env requirements, and pass/fail evidence format.",
    acceptanceTests: "A future Codex session can run the smoke manually from docs without guessing.",
    validationCommands: ["npm run build"],
    files: ["docs/QA_CHECKLIST.md", "docs/CODEX_RUNBOOK.md", "tests/fixtures/README.md"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-RUN-002",
    title: "Automate signup and onboarding smoke",
    area: "Runtime",
    epic: "Core flow verification",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Add automated or scripted smoke coverage for account creation, onboarding completion, and first app navigation.",
    userValue: "Confirms new users can reach the product activation path.",
    currentState: "Auth/onboarding exists but only static build and narrow tests were verified.",
    gapRisk: "Signup or onboarding can break without being caught by current tests.",
    scope: "Cover email signup or test-auth equivalent, onboarding save, and redirect to dashboard/vault.",
    nonGoals: "Do not change the onboarding product flow or add workspace invitations.",
    dependencies: "PPP-RUN-001, test Supabase environment.",
    dod: "Signup/onboarding smoke can be run repeatedly in sandbox or local test mode.",
    acceptanceTests: "New test user completes onboarding and sees authenticated app shell.",
    validationCommands: ["npm test", "npm run build"],
    files: ["tests/e2e/*", "src/pages/SignUp.tsx", "src/pages/Onboarding.tsx", "docs/QA_CHECKLIST.md"],
    source: "Runtime Test",
    planFirst: true
  }),
  issue({
    id: "PPP-RUN-003",
    title: "Automate upload and extraction smoke",
    area: "Runtime",
    epic: "Core flow verification",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Add sandbox smoke coverage for payslip upload, storage path creation, process-payslip invocation, and extraction status.",
    userValue: "Confirms the core product action works with real backend services.",
    currentState: "Upload and process-payslip code exists, but it was not runtime verified against sandbox services.",
    gapRisk: "Users can upload sensitive files into a broken processing flow.",
    scope: "Use a safe synthetic fixture and verify DB/storage status transitions.",
    nonGoals: "Do not improve AI accuracy or redesign background processing.",
    dependencies: "PPP-DATA-001, PPP-RUN-001, Supabase/AI sandbox secrets.",
    dod: "Sandbox smoke proves valid upload creates rows and reaches completed, needs_review, or controlled failed state.",
    acceptanceTests: "Unsupported file and oversize file are rejected; valid fixture reaches a documented final status.",
    validationCommands: ["npm test", "npm run build"],
    files: ["src/components/PayslipUpload.tsx", "supabase/functions/process-payslip/index.ts", "docs/QA_CHECKLIST.md"],
    source: "Runtime Test",
    planFirst: true
  }),
  issue({
    id: "PPP-PAY-001",
    title: "Verify Stripe price lookup and embedded checkout in sandbox",
    area: "Billing",
    epic: "Billing correctness",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Run and document sandbox verification for lookup keys, price retrieval, embedded checkout, and checkout return polling.",
    userValue: "Users can upgrade only through a reliable payment path.",
    currentState: "Stripe-oriented code exists but was not verified during the audit.",
    gapRisk: "Checkout may fail or unlock incorrectly in production.",
    scope: "Verify sandbox pricing and checkout path using documented lookup keys and test credentials.",
    nonGoals: "Do not add new plans, change pricing, or redesign billing UI.",
    dependencies: "Stripe sandbox secrets and PPP-SEC-001.",
    dod: "Sandbox checkout starts, returns, and shows the correct pending/complete states.",
    acceptanceTests: "Missing/invalid price lookup fails safely; successful sandbox checkout reaches return screen.",
    validationCommands: ["npm test", "npm run build"],
    files: ["src/pages/Pricing.tsx", "src/pages/Checkout.tsx", "src/pages/CheckoutReturn.tsx", "supabase/functions/create-checkout/index.ts"],
    source: "Runtime Test",
    planFirst: true
  }),
  issue({
    id: "PPP-PAY-002",
    title: "Verify Stripe webhook signature and entitlement updates",
    area: "Billing",
    epic: "Billing correctness",
    priority: "P0",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Test webhook signature handling, subscription entitlement updates, cancellation, and replay-safe behavior in sandbox.",
    userValue: "Paid access is granted and revoked accurately.",
    currentState: "payments-webhook exists and relies on Stripe/Lovable connector behavior.",
    gapRisk: "Revenue or access control can break silently.",
    scope: "Verify webhook success/failure paths and document price/subscription state mapping.",
    nonGoals: "Do not introduce a new billing provider or price model.",
    dependencies: "PPP-PAY-001 and Stripe webhook sandbox setup.",
    dod: "Valid webhooks update subscription state; invalid signatures fail; replay behavior is understood and documented.",
    acceptanceTests: "Failed payment does not unlock premium; cancellation removes active entitlement; lifetime plan persists as intended.",
    validationCommands: ["npm test", "npm run build"],
    files: ["supabase/functions/payments-webhook/index.ts", "src/hooks/use-subscription.ts", "docs/SECURITY.md"],
    source: "Runtime Test",
    planFirst: true
  }),
  issue({
    id: "PPP-AI-001",
    title: "Define shared payslip extraction validation schema",
    area: "AI",
    epic: "Extraction reliability",
    priority: "P1",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Create a runtime validation schema for AI extraction output that works in Supabase Edge Functions.",
    userValue: "Prevents malformed model output from corrupting payslip records.",
    currentState: "AI JSON is parsed after fence stripping and then trusted.",
    gapRisk: "Wrong types or missing fields can be persisted as if valid.",
    scope: "Define the schema, supported country fields, confidence fields, and error shape without changing prompts yet.",
    nonGoals: "Do not tune prompts, add OCR, or change database schema in this ticket.",
    dependencies: "PPP-DATA-002.",
    dod: "A shared schema validates valid and invalid example extraction payloads in tests.",
    acceptanceTests: "Valid payload passes; missing required fields, wrong numeric types, and unknown shapes fail clearly.",
    validationCommands: ["npm test", "npx tsc --noEmit"],
    files: ["src/lib/types.ts", "supabase/functions/_shared/*", "supabase/functions/process-payslip/index.ts"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-AI-002",
    title: "Validate process-payslip AI output before database writes",
    area: "AI",
    epic: "Extraction reliability",
    priority: "P1",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Apply the extraction validation schema inside process-payslip before persisting normalized values.",
    userValue: "Keeps user payslip records trustworthy when AI output is malformed.",
    currentState: "process-payslip persists parsed AI output with limited structural checks.",
    gapRisk: "Bad model output can become stored user data or confusing review states.",
    scope: "Validate parsed model output, return controlled errors/review states, and avoid partial corrupt writes.",
    nonGoals: "Do not change the AI provider or add background jobs.",
    dependencies: "PPP-AI-001.",
    dod: "Malformed AI output results in a controlled failed or needs_review state and no corrupt numeric values.",
    acceptanceTests: "Tests or function harness covers valid, malformed JSON, wrong type, and missing pay fields.",
    validationCommands: ["npm test", "npm run build"],
    files: ["supabase/functions/process-payslip/index.ts", "supabase/functions/_shared/*"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-AI-003",
    title: "Validate demo extraction AI output",
    area: "AI",
    epic: "Extraction reliability",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Medium",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Apply the same extraction validation to anonymous demo extraction responses.",
    userValue: "Keeps first-impression demo behavior reliable and honest.",
    currentState: "demo-extract-payslip has a separate anonymous path and no shared strict schema boundary.",
    gapRisk: "Demo can show invalid or misleading extraction output.",
    scope: "Reuse the shared schema and return safe demo errors without writing data.",
    nonGoals: "Do not add persistence to the demo flow.",
    dependencies: "PPP-AI-001.",
    dod: "Demo extraction rejects malformed AI output with a user-safe error shape.",
    acceptanceTests: "Demo valid/invalid payload tests pass; rate limit behavior remains unchanged.",
    validationCommands: ["npm test", "npm run build"],
    files: ["supabase/functions/demo-extract-payslip/index.ts", "supabase/functions/_shared/*"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-AI-004",
    title: "Add extraction confidence and review-state tests",
    area: "AI",
    epic: "Extraction reliability",
    priority: "P1",
    mvp: true,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Add tests for confidence thresholds, needs_review states, and failed extraction recovery messages.",
    userValue: "Users get clear review guidance when AI confidence is low.",
    currentState: "Review state exists conceptually, but confidence and failure states have limited coverage.",
    gapRisk: "The app can overstate uncertain extraction or hide failures.",
    scope: "Cover state transitions and UI copy around confidence/review/failed states.",
    nonGoals: "Do not change anomaly algorithms or tax calculations.",
    dependencies: "PPP-AI-002, PPP-REL-001.",
    dod: "Tests prove low-confidence and invalid extraction states produce the intended UI/status behavior.",
    acceptanceTests: "Low confidence enters review; malformed output enters controlled failure; successful output completes.",
    validationCommands: ["npm test", "npx tsc --noEmit"],
    files: ["src/pages/PayslipDetail.tsx", "src/components/PayslipUpload.tsx", "supabase/functions/process-payslip/index.ts"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-REL-001",
    title: "Correct upload failure and success status messaging",
    area: "Reliability",
    epic: "Background processing",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Medium",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Stop showing success-style processing messages when synchronous process-payslip invocation fails.",
    userValue: "Users understand whether their payslip is processed, pending, or failed.",
    currentState: "PayslipUpload catches function errors and can show success/continue-in-background copy.",
    gapRisk: "Users may believe extraction is progressing when it failed.",
    scope: "Adjust upload status state and copy for function invocation failures.",
    nonGoals: "Do not implement a durable background job system.",
    dependencies: "None.",
    dod: "Function invocation failure results in an explicit failed or retryable UI state.",
    acceptanceTests: "Mocked function failure shows error/retry copy; successful invocation still shows completion/progress copy.",
    validationCommands: ["npm test", "npm run build"],
    files: ["src/components/PayslipUpload.tsx", "src/hooks/use-toast.ts"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-REL-002",
    title: "Add retry affordance for failed extraction state",
    area: "Reliability",
    epic: "Background processing",
    priority: "P1",
    mvp: true,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Add a focused retry path for payslips that failed extraction after upload.",
    userValue: "Users can recover from transient AI or function failures without re-uploading blindly.",
    currentState: "The app has upload and detail flows, but retry behavior is not clearly verified.",
    gapRisk: "Failed extraction can strand a payslip record.",
    scope: "Expose retry only for safe failed states and re-invoke processing with ownership checks.",
    nonGoals: "Do not add queues, cancellation, or bulk retry.",
    dependencies: "PPP-REL-001, PPP-SEC-006.",
    dod: "A failed extraction can be retried once the user owns the payslip and the UI reflects retry progress.",
    acceptanceTests: "Retry is visible only for failed owned payslips; retry success refreshes payslip queries.",
    validationCommands: ["npm test", "npm run build"],
    files: ["src/pages/PayslipDetail.tsx", "src/components/PayslipUpload.tsx", "supabase/functions/process-payslip/index.ts"],
    source: "Product Assumption",
    planFirst: true
  }),
  issue({
    id: "PPP-REL-003",
    title: "Document extraction status lifecycle",
    area: "Reliability",
    epic: "Background processing",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "02 Core Product Flow",
    description: "Document the allowed payslip and extraction statuses and how UI screens should render each state.",
    userValue: "Future changes do not invent conflicting processing states.",
    currentState: "Statuses exist across code and docs but are not centralized as a lifecycle contract.",
    gapRisk: "Upload, detail, vault, and dashboard can interpret states differently.",
    scope: "Add lifecycle documentation and link it from AGENTS/architecture docs.",
    nonGoals: "Do not change database enum values or UI behavior in this docs ticket.",
    dependencies: "PPP-REL-001.",
    dod: "Docs list each status, transition trigger, owner, UI expectation, and retry behavior.",
    acceptanceTests: "AGENTS/ARCHITECTURE point future agents to the lifecycle before editing extraction flow.",
    validationCommands: ["npm run build"],
    files: ["docs/ARCHITECTURE.md", "docs/DATA_MODEL.md", "AGENTS.md"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-QA-005",
    title: "Add upload validation tests",
    area: "QA",
    epic: "Frontend test coverage",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Add focused tests for file type, size, and missing-file validation in the payslip upload UI.",
    userValue: "Users get predictable feedback before uploading sensitive files.",
    currentState: "Upload validation exists but is not directly covered by tests.",
    gapRisk: "Regression could allow unsupported files or unclear errors.",
    scope: "Test accepted PDF/image types, rejected unsupported types, and 10 MB limit behavior.",
    nonGoals: "Do not test Supabase Storage integration here.",
    dependencies: "Stable test setup.",
    dod: "Upload validation cases pass in Vitest.",
    acceptanceTests: "PDF/PNG/JPEG/WebP accepted; unsupported file and oversize file rejected with visible feedback.",
    validationCommands: ["npm test", "npx tsc --noEmit"],
    files: ["src/components/PayslipUpload.tsx", "src/**/*.test.tsx"],
    source: "QA Checklist"
  }),
  issue({
    id: "PPP-QA-006",
    title: "Add onboarding and profile validation tests",
    area: "QA",
    epic: "Frontend test coverage",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Add tests for required onboarding fields and profile update validation.",
    userValue: "New users are less likely to get stuck with invalid profile data.",
    currentState: "Onboarding/profile logic exists with limited automated coverage.",
    gapRisk: "Country/pay-frequency/employer validation can regress silently.",
    scope: "Cover required fields, country-specific fields, threshold inputs, and successful save path with mocks.",
    nonGoals: "Do not redesign onboarding steps.",
    dependencies: "PPP-PROD-001 for final country expectations.",
    dod: "Core onboarding validation behavior is covered by tests.",
    acceptanceTests: "Missing required fields block progress; valid profile save calls expected data path.",
    validationCommands: ["npm test", "npx tsc --noEmit"],
    files: ["src/pages/Onboarding.tsx", "src/hooks/use-profile.ts", "src/**/*.test.tsx"],
    source: "QA Checklist"
  }),
  issue({
    id: "PPP-QA-007",
    title: "Add anomaly status hook tests",
    area: "QA",
    epic: "Frontend test coverage",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Cover anomaly status updates and error states in the anomaly hook/UI flow.",
    userValue: "Users can reliably mark anomalies reviewed, raised, or resolved.",
    currentState: "Anomaly status hook exists but lacks focused tests.",
    gapRisk: "Status changes can fail or show stale UI.",
    scope: "Test successful status update, failed update, and query invalidation behavior.",
    nonGoals: "Do not change anomaly detection logic.",
    dependencies: "None.",
    dod: "Anomaly status hook behavior has tests for success and failure.",
    acceptanceTests: "Mocked success updates state; mocked failure shows error feedback and does not mark success.",
    validationCommands: ["npm test", "npx tsc --noEmit"],
    files: ["src/hooks/use-anomaly-status.ts", "src/pages/Anomalies.tsx", "src/**/*.test.tsx"],
    source: "QA Checklist"
  }),
  issue({
    id: "PPP-QA-008",
    title: "Add settings export and delete tests",
    area: "QA",
    epic: "Frontend test coverage",
    priority: "P1",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Add focused tests around account export and deletion flows, including partial failure handling.",
    userValue: "Sensitive payroll data export and deletion behavior becomes safer to maintain.",
    currentState: "delete-account has some tests; settings export/delete coverage is incomplete.",
    gapRisk: "Privacy-critical flows can regress without detection.",
    scope: "Test export shape, delete confirmation, storage deletion failure, and sign-out behavior with mocks.",
    nonGoals: "Do not move deletion server-side in this ticket.",
    dependencies: "PPP-DATA-004, PPP-DATA-005 may provide sandbox findings.",
    dod: "Privacy lifecycle tests cover success and failure paths.",
    acceptanceTests: "Export contains expected user-owned rows; delete requires confirmation and handles storage errors safely.",
    validationCommands: ["npm test", "npx tsc --noEmit"],
    files: ["src/pages/Settings.tsx", "src/lib/delete-account.ts", "src/lib/delete-account.test.ts"],
    source: "QA Checklist",
    planFirst: true
  }),
  issue({
    id: "PPP-DEP-001",
    title: "Choose deployment target and environment mapping",
    area: "Deployment",
    epic: "Production deploy",
    priority: "P1",
    mvp: true,
    effort: "XS",
    risk: "Medium",
    status: "Needs Refinement",
    milestone: "03 Production Readiness",
    description: "Choose the frontend hosting target and map required frontend, Supabase, Stripe, Lovable, and command-centre environment variables.",
    userValue: "Makes staging and production deployment repeatable.",
    currentState: "Deployment docs describe generic static hosting plus Supabase, but no provider is chosen.",
    gapRisk: "Launch setup depends on memory and undocumented Lovable-era assumptions.",
    scope: "Record the chosen hosting target, environments, secrets ownership, and deployment promotion path.",
    nonGoals: "Do not deploy the app in this decision ticket.",
    dependencies: "Human hosting preference.",
    dod: "DEPLOYMENT docs name the target provider and every required environment variable by environment.",
    acceptanceTests: "A new developer can identify where each env var must be configured without asking.",
    validationCommands: ["npm run build"],
    files: ["docs/DEPLOYMENT.md", ".env.example", "README.md"],
    source: "Product Assumption",
    planFirst: true
  }),
  issue({
    id: "PPP-DEP-002",
    title: "Add deployment runbook for chosen host and Supabase",
    area: "Deployment",
    epic: "Production deploy",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Medium",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Create a step-by-step deployment runbook for frontend build, Supabase migrations/functions, secrets, Stripe webhooks, and rollback.",
    userValue: "Reduces launch and incident risk.",
    currentState: "Deployment assumptions are documented but not a provider-specific runbook.",
    gapRisk: "Production deployment can be inconsistent or incomplete.",
    scope: "Document staging/prod setup, release checklist, rollback, and verification commands.",
    nonGoals: "Do not configure live production secrets or deploy automatically.",
    dependencies: "PPP-DEP-001.",
    dod: "Runbook covers frontend, Supabase, Stripe, Lovable gateway secrets, health checks, and rollback notes.",
    acceptanceTests: "A dry-run checklist can be followed without discovering missing steps.",
    validationCommands: ["npm run build"],
    files: ["docs/DEPLOYMENT.md", "docs/CODEX_RUNBOOK.md", "README.md"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-BRAND-001",
    title: "Decide canonical brand and domain",
    area: "Brand",
    epic: "Brand and SEO",
    priority: "P1",
    mvp: true,
    effort: "XS",
    risk: "Low",
    status: "Needs Refinement",
    milestone: "03 Production Readiness",
    description: "Choose the canonical product name and domain to resolve PayCheck, Payslip Insights, paycheckinsights.com, and payslipinsights.com drift.",
    userValue: "Users see consistent product identity across auth, billing, SEO, and legal pages.",
    currentState: "Docs and code record multiple brand/domain references.",
    gapRisk: "Trust, legal, SEO, and billing identity can conflict.",
    scope: "Document the chosen canonical brand/domain and list all known old references.",
    nonGoals: "Do not update UI copy in this decision ticket.",
    dependencies: "Brand owner decision.",
    dod: "PRODUCT and DEPLOYMENT docs name the canonical brand/domain and follow-up update ticket is unblocked.",
    acceptanceTests: "Docs contain one canonical brand/domain decision and rationale.",
    validationCommands: ["rg \"PayCheck|Payslip Insights|paycheckinsights|payslipinsights\" docs src public"],
    files: ["docs/PRODUCT.md", "docs/DEPLOYMENT.md", "ROADMAP.md"],
    source: "Product Assumption"
  }),
  issue({
    id: "PPP-BRAND-002",
    title: "Update SEO and brand references after decision",
    area: "Brand",
    epic: "Brand and SEO",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Apply the canonical brand/domain across metadata, sitemap, public pages, legal copy, and in-app references.",
    userValue: "Users and search engines see one coherent product identity.",
    currentState: "Brand/domain references are inconsistent across app and docs.",
    gapRisk: "Mismatched names can weaken trust and billing/auth clarity.",
    scope: "Update text and metadata references to the approved brand/domain.",
    nonGoals: "Do not change visual design or pricing.",
    dependencies: "PPP-BRAND-001.",
    dod: "Old names/domains only remain in historical notes or redirect documentation.",
    acceptanceTests: "rg for old brand/domain terms returns only deliberate legacy notes; build passes.",
    validationCommands: ["rg \"Payslip Insights|paycheckinsights|payslipinsights\" src public docs", "npm run build"],
    files: ["index.html", "public/*", "src/lib/seo.ts", "src/lib/guide-seo-data.ts", "src/pages/*"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-SEC-005",
    title: "Map Edge Function auth and CORS requirements",
    area: "Security",
    epic: "Function hardening",
    priority: "P1",
    mvp: true,
    effort: "S",
    risk: "High",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Create an auth/CORS matrix for every Supabase Edge Function and identify which public functions require signature or rate-limit controls.",
    userValue: "Clarifies which server paths protect payroll and billing data.",
    currentState: "Several functions have verify_jwt=false and manual auth behavior varies.",
    gapRisk: "Publicly callable functions can accidentally allow unauthorized access or quota bypass.",
    scope: "Document function purpose, caller, auth method, CORS policy, secrets used, and required tests.",
    nonGoals: "Do not patch function code in this mapping ticket.",
    dependencies: "None.",
    dod: "Every Edge Function has a documented auth model and follow-up hardening tickets if needed.",
    acceptanceTests: "SECURITY/ARCHITECTURE docs include all functions from supabase/functions and config.toml.",
    validationCommands: ["rg \"verify_jwt|serve\\(|Authorization|cors\" supabase/functions supabase/config.toml"],
    files: ["docs/SECURITY.md", "docs/ARCHITECTURE.md", "supabase/config.toml", "supabase/functions/*"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-SEC-006",
    title: "Harden authenticated function ownership checks",
    area: "Security",
    epic: "Function hardening",
    priority: "P1",
    mvp: true,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Add or verify ownership and auth checks for authenticated Edge Functions that read or mutate user-owned data.",
    userValue: "Prevents cross-user payslip, profile, billing, and deletion operations.",
    currentState: "Some functions manually parse bearer tokens and perform ownership checks; consistency is unverified.",
    gapRisk: "A missed check could expose or mutate another user's payroll data.",
    scope: "Patch only authenticated function auth/ownership checks and add tests/manual verification notes.",
    nonGoals: "Do not change webhook signature handling in this ticket.",
    dependencies: "PPP-SEC-005, PPP-DATA-001.",
    dod: "Unauthorized and cross-user calls fail for each authenticated function path.",
    acceptanceTests: "Missing bearer, invalid bearer, and other-user resource IDs are denied.",
    validationCommands: ["npm test", "npm run build"],
    files: ["supabase/functions/process-payslip/index.ts", "supabase/functions/create-checkout/index.ts", "supabase/functions/create-portal-session/index.ts"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-UX-001",
    title: "Run desktop and mobile responsive audit",
    area: "UX",
    epic: "Accessibility and responsive",
    priority: "P2",
    mvp: false,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "04 Launch Candidate",
    description: "Manually inspect core pages at mobile and desktop widths and record blocking layout defects.",
    userValue: "Ensures the MVP can be used on common devices.",
    currentState: "Responsive patterns exist but were not deeply verified during audit.",
    gapRisk: "Cards, charts, nav, or settings forms may overflow or overlap.",
    scope: "Audit landing, auth, onboarding, dashboard, vault, detail, compare, anomalies, settings, and checkout.",
    nonGoals: "Do not fix layout issues in the audit ticket.",
    dependencies: "Dev server can run locally.",
    dod: "QA checklist contains pass/fail notes and follow-up tickets for each blocking issue.",
    acceptanceTests: "Screens are inspected at representative mobile and desktop widths with screenshots or notes.",
    validationCommands: ["npm run dev", "npm run build"],
    files: ["docs/QA_CHECKLIST.md", "src/pages/*", "src/components/*"],
    source: "QA Checklist"
  }),
  issue({
    id: "PPP-UX-002",
    title: "Fix blocking responsive layout issues from audit",
    area: "UX",
    epic: "Accessibility and responsive",
    priority: "P2",
    mvp: false,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "04 Launch Candidate",
    description: "Fix only the blocking mobile/desktop layout issues found in the responsive audit.",
    userValue: "Improves usability without broad visual rewrites.",
    currentState: "No responsive defect list exists yet.",
    gapRisk: "Unscoped responsive work can sprawl into redesign.",
    scope: "Patch documented blocking overlaps, overflow, or unusable controls from PPP-UX-001.",
    nonGoals: "Do not redesign the app, change copy broadly, or introduce a new visual language.",
    dependencies: "PPP-UX-001.",
    dod: "Every blocking issue from the audit is fixed or explicitly deferred with rationale.",
    acceptanceTests: "Re-check affected pages at the same viewports and confirm no text/control overlap.",
    validationCommands: ["npm run build", "npm test"],
    files: ["src/pages/*", "src/components/*", "src/index.css"],
    source: "QA Checklist"
  }),
  issue({
    id: "PPP-UX-003",
    title: "Run and fix critical keyboard accessibility gaps",
    area: "UX",
    epic: "Accessibility and responsive",
    priority: "P2",
    mvp: false,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "04 Launch Candidate",
    description: "Test keyboard navigation, focus visibility, dialog labels, icon button labels, and form error announcements across core flows.",
    userValue: "Makes the product usable for keyboard and assistive technology users.",
    currentState: "shadcn/Radix components help, but no accessibility QA pass was verified.",
    gapRisk: "Critical controls may be unreachable or unlabeled.",
    scope: "Fix critical keyboard and labeling issues found in the audit.",
    nonGoals: "Do not perform a full WCAG audit or add automated accessibility tooling unless needed for the fixes.",
    dependencies: "Core flows should be stable enough to test.",
    dod: "Critical keyboard navigation and accessible-name issues are fixed for MVP screens.",
    acceptanceTests: "Tab order reaches core controls; dialogs have names; icon-only buttons have accessible labels.",
    validationCommands: ["npm run build", "npm test"],
    files: ["src/pages/*", "src/components/*", "docs/QA_CHECKLIST.md"],
    source: "QA Checklist"
  }),
  issue({
    id: "PPP-DATA-004",
    title: "Verify account export completeness",
    area: "Data",
    epic: "Privacy lifecycle",
    priority: "P2",
    mvp: false,
    effort: "S",
    risk: "High",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Verify that account export includes all expected user-owned rows and excludes other-user data.",
    userValue: "Users can retrieve their sensitive payroll data before deletion or migration.",
    currentState: "Settings has export behavior, but completeness was not sandbox verified.",
    gapRisk: "Exports may omit important rows or include data not owned by the user.",
    scope: "Seed a user with representative rows and compare exported JSON to expected tables.",
    nonGoals: "Do not add CSV/PDF export formats.",
    dependencies: "PPP-DATA-001.",
    dod: "Export coverage is documented and missing tables are fixed or ticketed.",
    acceptanceTests: "Seeded payslips, extractions, anomalies, drafts, notes, profile, and billing state are represented as expected.",
    validationCommands: ["npm test", "npm run build"],
    files: ["src/pages/Settings.tsx", "docs/DATA_MODEL.md", "docs/QA_CHECKLIST.md"],
    source: "QA Checklist",
    planFirst: true
  }),
  issue({
    id: "PPP-DATA-005",
    title: "Verify account deletion removes rows and files",
    area: "Data",
    epic: "Privacy lifecycle",
    priority: "P2",
    mvp: false,
    effort: "M",
    risk: "High",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Verify account deletion removes user-owned database rows and storage files without touching other users.",
    userValue: "Supports privacy expectations for sensitive payroll documents.",
    currentState: "Deletion code exists but needs sandbox verification across DB and storage.",
    gapRisk: "Files or rows can remain after account deletion, or deletion can overreach.",
    scope: "Run sandbox deletion with representative data and add tests for storage/database cleanup edge cases.",
    nonGoals: "Do not build admin deletion tooling.",
    dependencies: "PPP-DATA-001, PPP-SEC-004.",
    dod: "Deletion removes expected owned data/files and fails safely on partial errors.",
    acceptanceTests: "After delete, owned rows/files are gone; another user's rows/files remain.",
    validationCommands: ["npm test", "npm run build"],
    files: ["src/lib/delete-account.ts", "src/pages/Settings.tsx", "docs/SECURITY.md"],
    source: "QA Checklist",
    planFirst: true
  }),
  issue({
    id: "PPP-DATA-006",
    title: "Document retention for raw files and AI JSON",
    area: "Data",
    epic: "Privacy lifecycle",
    priority: "P2",
    mvp: false,
    effort: "S",
    risk: "Medium",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Document retention, export, deletion, and logging rules for payslip files, raw AI output, normalized extraction data, and audit events.",
    userValue: "Clarifies how sensitive payroll data is handled over time.",
    currentState: "Raw AI JSON is persisted and retention rules are not formalized.",
    gapRisk: "Privacy claims can exceed implemented lifecycle behavior.",
    scope: "Add a retention policy to SECURITY/DATA_MODEL docs and identify implementation gaps.",
    nonGoals: "Do not implement scheduled deletion or retention jobs.",
    dependencies: "Product/legal privacy decision if retention windows are unknown.",
    dod: "Docs state what is stored, why, where, how long, and how deletion/export handles it.",
    acceptanceTests: "Security and product docs do not make unsupported retention claims.",
    validationCommands: ["npm run build"],
    files: ["docs/SECURITY.md", "docs/DATA_MODEL.md", "docs/PRODUCT.md"],
    source: "Product Assumption",
    planFirst: true
  }),
  issue({
    id: "PPP-OBS-001",
    title: "Decide analytics and error reporting providers",
    area: "Observability",
    epic: "Logging and analytics",
    priority: "P2",
    mvp: false,
    effort: "XS",
    risk: "Medium",
    status: "Needs Refinement",
    milestone: "03 Production Readiness",
    description: "Choose privacy-conscious analytics and error reporting providers for frontend and Supabase functions.",
    userValue: "Lets the team debug and improve the product without leaking payroll data.",
    currentState: "analytics.ts is a no-op and Edge Functions log to console.",
    gapRisk: "Production issues will be difficult to diagnose.",
    scope: "Record provider choices, consent behavior, redaction rules, and env variables.",
    nonGoals: "Do not implement provider SDKs in this decision ticket.",
    dependencies: "Privacy/product decision.",
    dod: "Architecture/security docs identify approved providers and privacy constraints.",
    acceptanceTests: "No provider implementation begins until redaction and consent rules are written.",
    validationCommands: ["rg \"analytics|logger|console\" src supabase/functions docs"],
    files: ["docs/ARCHITECTURE.md", "docs/SECURITY.md", ".env.example"],
    source: "Product Assumption",
    planFirst: true
  }),
  issue({
    id: "PPP-OBS-002",
    title: "Add consent-aware frontend analytics events",
    area: "Observability",
    epic: "Logging and analytics",
    priority: "P2",
    mvp: false,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Wire selected frontend analytics events through the existing consent-aware analytics boundary.",
    userValue: "Shows whether users reach activation without collecting sensitive payslip contents.",
    currentState: "Analytics layer exists as a no-op.",
    gapRisk: "No activation or funnel visibility after launch.",
    scope: "Track safe events such as signup started, onboarding completed, upload started, extraction status, and upgrade started with no PII payloads.",
    nonGoals: "Do not add session replay, raw payslip fields, salary amounts, or employer names to analytics.",
    dependencies: "PPP-OBS-001.",
    dod: "Events fire only after consent and contain no payroll content or direct identifiers.",
    acceptanceTests: "Consent declined blocks analytics; consent accepted emits redacted safe events.",
    validationCommands: ["npm test", "npm run build"],
    files: ["src/lib/analytics.ts", "src/components/CookieConsent.tsx", "src/pages/*"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-OBS-003",
    title: "Add Edge Function redacted logging conventions",
    area: "Observability",
    epic: "Logging and analytics",
    priority: "P2",
    mvp: false,
    effort: "M",
    risk: "Medium",
    status: "Backlog",
    milestone: "03 Production Readiness",
    description: "Introduce a shared logging convention for Supabase functions that redacts sensitive payroll and payment data.",
    userValue: "Improves production debugging without leaking PII.",
    currentState: "Functions use console logging with no documented redaction helper.",
    gapRisk: "Raw extraction or payment details can enter logs.",
    scope: "Add or document a minimal redaction helper and update high-risk logs.",
    nonGoals: "Do not add a full observability vendor SDK.",
    dependencies: "PPP-OBS-001.",
    dod: "High-risk functions use redacted logs and docs state what must never be logged.",
    acceptanceTests: "Tests or review fixtures show payslip text/raw AI JSON/payment secrets are not logged.",
    validationCommands: ["npm test", "npm run build"],
    files: ["supabase/functions/_shared/*", "supabase/functions/process-payslip/index.ts", "supabase/functions/payments-webhook/index.ts", "docs/SECURITY.md"],
    source: "Code Audit",
    planFirst: true
  }),
  issue({
    id: "PPP-PERF-001",
    title: "Dynamic import PDF generation path",
    area: "Performance",
    epic: "Bundle size",
    priority: "P2",
    mvp: false,
    effort: "M",
    risk: "Low",
    status: "Backlog",
    milestone: "04 Launch Candidate",
    description: "Lazy-load PDF generation dependencies so initial app load does not carry PDF export code.",
    userValue: "Improves first-load performance for dashboard users.",
    currentState: "Build warns about a large 1.83 MB minified JS chunk.",
    gapRisk: "Mobile users may experience slow initial loads.",
    scope: "Move jsPDF/autotable import path behind the user action that generates the report.",
    nonGoals: "Do not redesign dashboard charts or PDF content.",
    dependencies: "Passing current build.",
    dod: "PDF export still works and the main bundle warning is reduced or documented.",
    acceptanceTests: "Dashboard loads; PDF export action still produces a report.",
    validationCommands: ["npm run build", "npm test"],
    files: ["src/lib/generate-pay-summary-pdf.ts", "src/pages/Dashboard.tsx", "vite.config.ts"],
    source: "Runtime Test"
  }),
  issue({
    id: "PPP-PERF-002",
    title: "Split chart-heavy dashboard bundle or document exception",
    area: "Performance",
    epic: "Bundle size",
    priority: "P2",
    mvp: false,
    effort: "M",
    risk: "Low",
    status: "Backlog",
    milestone: "04 Launch Candidate",
    description: "Review chart and dashboard dependencies for manual chunking or route-level lazy loading.",
    userValue: "Keeps the authenticated app responsive as features grow.",
    currentState: "Vite build emits a large chunk warning.",
    gapRisk: "Performance can degrade as dashboard code grows.",
    scope: "Apply a small chunking/lazy-loading change or document why the current warning is acceptable for MVP.",
    nonGoals: "Do not rewrite chart components.",
    dependencies: "PPP-PERF-001 if PDF is the dominant contributor.",
    dod: "Bundle warning is eliminated, reduced, or intentionally documented with measured size.",
    acceptanceTests: "Dashboard and chart screens still render; build output is reviewed.",
    validationCommands: ["npm run build", "npm test"],
    files: ["vite.config.ts", "src/pages/Dashboard.tsx", "src/components/*Chart*.tsx"],
    source: "Runtime Test"
  }),
  issue({
    id: "PPP-REPO-001",
    title: "Remove unused Lovable placeholder page and CSS",
    area: "Repo",
    epic: "Lovable cleanup",
    priority: "P2",
    mvp: false,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "00 Repo Audit & Setup",
    description: "Remove or quarantine unused Lovable/Vite placeholder files that are not routed by the app.",
    userValue: "Future agents do not waste time editing dead code.",
    currentState: "src/pages/Index.tsx and src/App.css are present as migrated placeholders.",
    gapRisk: "Generated leftovers make code ownership unclear.",
    scope: "Remove unused placeholder files only after confirming they are not imported or routed.",
    nonGoals: "Do not remove Lovable integration files that are still used for OAuth/gateway behavior.",
    dependencies: "None.",
    dod: "Unused placeholder files are gone or documented as intentionally retained.",
    acceptanceTests: "rg confirms no imports remain; build/test pass.",
    validationCommands: ["rg \"Index|App.css|REMOVE_THIS\" src", "npm test", "npm run build"],
    files: ["src/pages/Index.tsx", "src/App.css", "docs/ARCHITECTURE.md"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-REPO-002",
    title: "Canonicalize npm and remove duplicate Bun lockfiles",
    area: "Repo",
    epic: "Lovable cleanup",
    priority: "P2",
    mvp: false,
    effort: "S",
    risk: "Low",
    status: "Backlog",
    milestone: "00 Repo Audit & Setup",
    description: "Make npm the documented package manager and remove Bun lockfiles if no tooling depends on them.",
    userValue: "Avoids inconsistent dependency installs across agents and CI.",
    currentState: "package-lock.json, bun.lock, and bun.lockb are present; docs say use npm.",
    gapRisk: "Different package managers can create lockfile churn or dependency drift.",
    scope: "Confirm npm is canonical, remove duplicate Bun locks if safe, and update docs.",
    nonGoals: "Do not migrate to a different package manager.",
    dependencies: "None.",
    dod: "Only the canonical lockfile remains and setup docs are consistent.",
    acceptanceTests: "npm install, tests, and build pass after lockfile cleanup.",
    validationCommands: ["npm install", "npm test", "npm run build"],
    files: ["package-lock.json", "bun.lock", "bun.lockb", "README.md", "AGENTS.md"],
    source: "Code Audit"
  }),
  issue({
    id: "PPP-SUPPORT-001",
    title: "Define privacy-safe support and admin requirements",
    area: "Support",
    epic: "Admin support",
    priority: "P3",
    mvp: false,
    effort: "XS",
    risk: "High",
    status: "Needs Refinement",
    milestone: "05 Later Enhancements",
    description: "Define whether MVP support needs user lookup, failed extraction triage, or billing support tooling, without exposing payroll data unnecessarily.",
    userValue: "Prevents unsafe direct database access for support after launch.",
    currentState: "No admin/internal area exists and support needs are undefined.",
    gapRisk: "Support can become ad hoc and privacy-risky.",
    scope: "Write support/admin requirements, privacy constraints, role model assumptions, and follow-up tickets.",
    nonGoals: "Do not build admin UI or support APIs in this ticket.",
    dependencies: "Post-MVP support process decision.",
    dod: "Support requirements are documented and implementation work is split into security-reviewed tickets.",
    acceptanceTests: "No admin build ticket exists without documented access-control requirements.",
    validationCommands: ["npm run build"],
    files: ["docs/PRODUCT.md", "docs/SECURITY.md", "ROADMAP.md"],
    source: "Product Assumption",
    localOnly: true,
    planFirst: true,
    notes: "Kept local only for this run because P3 support/admin tooling is not needed for MVP."
  })
];

const risks = [
  {
    id: "RISK-001",
    title: "Tracked secrets and credential history",
    severity: "High",
    owner: "Human credential owner",
    mitigation: "Complete PPP-SEC-001 and PPP-SEC-002 before adding more production integrations.",
    related_tasks: ["PPP-SEC-001", "PPP-SEC-002"]
  },
  {
    id: "RISK-002",
    title: "Sensitive payroll data isolation",
    severity: "High",
    owner: "Engineering",
    mitigation: "Verify RLS, storage policies, and function ownership checks before MVP runtime testing.",
    related_tasks: ["PPP-DATA-001", "PPP-SEC-004", "PPP-SEC-006"]
  },
  {
    id: "RISK-003",
    title: "AI output trust boundary",
    severity: "High",
    owner: "Engineering",
    mitigation: "Validate AI output and handle low-confidence/failure states before relying on extraction.",
    related_tasks: ["PPP-AI-001", "PPP-AI-002", "PPP-AI-003", "PPP-AI-004"]
  },
  {
    id: "RISK-004",
    title: "Billing entitlement correctness",
    severity: "High",
    owner: "Engineering and product",
    mitigation: "Verify Stripe sandbox checkout, webhook signatures, cancellation, and entitlement state.",
    related_tasks: ["PPP-PAY-001", "PPP-PAY-002"]
  },
  {
    id: "RISK-005",
    title: "Country support mismatch",
    severity: "Medium",
    owner: "Product",
    mitigation: "Decide and align MVP country support across UI, schema, and extraction.",
    related_tasks: ["PPP-PROD-001", "PPP-PROD-002", "PPP-DATA-003"]
  }
];

const decisions = [
  {
    id: "DEC-001",
    title: "MVP country support",
    status: "Open",
    needed_by: "Before implementing PPP-PROD-002 or PPP-DATA-003",
    options: ["Include US in MVP and add full schema/extraction support", "Remove US claims/options until post-MVP"],
    related_tasks: ["PPP-PROD-001"]
  },
  {
    id: "DEC-002",
    title: "Canonical brand and domain",
    status: "Open",
    needed_by: "Before updating SEO, legal, auth, billing, and deployment copy",
    options: ["PayCheck with a chosen production domain", "Payslip Insights with aligned domain"],
    related_tasks: ["PPP-BRAND-001"]
  },
  {
    id: "DEC-003",
    title: "Deployment target",
    status: "Open",
    needed_by: "Before CI/CD and production runbook implementation",
    options: ["Static host plus Supabase", "Vercel static deployment", "Netlify static deployment", "Other selected host"],
    related_tasks: ["PPP-DEP-001"]
  },
  {
    id: "DEC-004",
    title: "Observability providers",
    status: "Open",
    needed_by: "Before wiring analytics or server error reporting",
    options: ["PostHog/Sentry-style provider pair", "Minimal provider-free logs for MVP", "Other privacy-approved stack"],
    related_tasks: ["PPP-OBS-001"]
  }
];

const counts = (items, key) =>
  items.reduce((acc, item) => {
    const value = item[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

const priorityCounts = counts(issues, "Priority");
const effortCounts = counts(issues, "Effort");
const statusCounts = counts(issues, "Status");
const linearPushCount = issues.filter((item) => item["Linear Push"] === "Push to Linear").length;
const localOnlyCount = issues.length - linearPushCount;

const recommendedFirstTen = issues
  .filter((item) => item["Status"] === "Ready for Plan")
  .slice(0, 10)
  .map((item) => `${item["Task ID"]} - ${item["Title"]}`);

const writeJson = (file, value) => {
  fs.writeFileSync(path.join(exportDir, file), `${JSON.stringify(value, null, 2)}\n`);
};

fs.mkdirSync(exportDir, { recursive: true });
fs.mkdirSync(tasksDir, { recursive: true });

writeJson("project.json", project);
writeJson("issues.json", issues);
writeJson("milestones.json", milestones);
writeJson("labels.json", labelDefinitions);
writeJson("risks.json", risks);
writeJson("decisions.json", decisions);

fs.writeFileSync(
  path.join(exportDir, "linear-sync-summary.md"),
  `# Linear Sync Summary

## Status
- Linear updated: Pending
- Linear workspace/team: TallyRec
- Linear team ID: ${project.linear_team.team_id}
- Linear project URL: Pending
- Issues created: 0
- Issues updated: 0
- Duplicates skipped: 0
- Issues kept local only: ${localOnlyCount}
- Failures: Pending execution

## Export Counts
- Total local issues: ${issues.length}
- Issues intended for Linear: ${linearPushCount}
- Local-only issues: ${localOnlyCount}
- Priority counts: ${JSON.stringify(priorityCounts)}
- Effort counts: ${JSON.stringify(effortCounts)}
- Status counts: ${JSON.stringify(statusCounts)}

## Recommended First 10 Issues To Move To Ready For Plan
${recommendedFirstTen.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Risks Before Implementation
${project.top_risks.map((risk) => `- ${risk}`).join("\n")}

## Next Command Or Prompt
Use this first planning prompt:

\`\`\`
${issues[0]["Suggested Codex Planning Prompt"]}
\`\`\`
`
);

fs.writeFileSync(
  path.join(exportDir, "import-summary.md"),
  `# Linear Import Summary

Generated on ${generatedAt} for PayCheck in the TallyRec Linear workspace/team.

## Files
- project.json: Linear project metadata and production-readiness summary.
- issues.json: ${issues.length} scoped tickets, ${linearPushCount} intended for Linear and ${localOnlyCount} kept local only.
- milestones.json: ${milestones.length} project milestones.
- labels.json: ${labelDefinitions.length} requested team labels.
- risks.json: ${risks.length} high-level delivery risks.
- decisions.json: ${decisions.length} open product/architecture decisions.

## Quality Gate
- No XL tickets.
- No product implementation work is included.
- P3 support/admin work is kept local only for this run.
- Ready for Plan is used only for small issues with complete scope and validation.
`
);

fs.writeFileSync(
  path.join(tasksDir, "README.md"),
  `# Task Execution Workflow

This repo should move through small, ticket-driven Codex work.

## Rules
- One Linear issue equals one branch and one pull request.
- Every issue must go through plan-only first before implementation.
- Do not combine unrelated issues into one branch.
- Do not mark Linear issues Done unless the repo proves the work is complete.
- Update ROADMAP.md when a task is completed or when new gaps are discovered.
- Keep app behavior unchanged unless the issue explicitly scopes a behavior change.

## Branch Naming
Use the Recommended Branch Name from linear-export/issues.json, for example:

\`\`\`
codex/ppp-sec-001-remove-tracked-local-env-files-and-document-credi
\`\`\`

## Plan Files
When a task needs a durable plan, create:

\`\`\`
tasks/<TASK-ID>/plan.md
\`\`\`

The plan should include scope, non-goals, acceptance tests, validation commands, and rollback notes where relevant.

## Implementation Summary Files
After implementation, create or update:

\`\`\`
tasks/<TASK-ID>/implementation-summary.md
\`\`\`

Include changed files, commands run, results, remaining risks, and the Linear status update to post.

## Linear And Roadmap Updates
- Move the issue to Planning when writing a plan.
- Move it to Plan Approved only after the plan is accepted.
- Move it to In Progress only when implementation starts.
- Move it to In Review when a PR is ready.
- Move it to Done only after validation passes and the PR is merged or otherwise accepted.
- Update ROADMAP.md if the task closes a roadmap gap or reveals a new one.
`
);

console.log(JSON.stringify({
  generated_at: generatedAt,
  total_issues: issues.length,
  linear_push_count: linearPushCount,
  local_only_count: localOnlyCount,
  priority_counts: priorityCounts,
  effort_counts: effortCounts,
  status_counts: statusCounts,
  output_dir: "linear-export"
}, null, 2));
