import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { loadEnv } from "vite";

const paidLaunch = process.argv.includes("--paid");
const blockers = [];
const notes = [];
const releaseEnv = loadEnv("production", process.cwd(), "");

function environmentValue(name) {
  return (process.env[name] ?? releaseEnv[name] ?? "").trim();
}

function hasValidHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function isPlaceholder(value) {
  return /placeholder|example|your[-_ ]|replace[-_ ]|changeme/i.test(value);
}

function gitOutput(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function sourceHas(path, text) {
  return existsSync(path) && readFileSync(path, "utf8").includes(text);
}

const REQUIRED_MIGRATION = "20260804124000_bound_payday_check_in_to_active_cycle.sql";
const REQUIRED_EDGE_FUNCTIONS = [
  "start-payslip-upload",
  "finish-payslip-upload",
  "get-payslip-original-url",
  "delete-failed-payslip",
  "cleanup-expired-payslip-uploads",
  "process-payslip",
  "create-checkout",
  "verify-checkout-return",
  "payments-webhook",
  "create-portal-session",
  "delete-account",
];
const SENSITIVE_NO_STORE_FUNCTIONS = [
  "create-checkout",
  "create-portal-session",
  "create-issue-draft",
  "delete-account",
  "get-stripe-price",
  "process-payslip",
  "verify-checkout-return",
];

const supabaseUrl = environmentValue("VITE_SUPABASE_URL");
if (!hasValidHttpsUrl(supabaseUrl) || isPlaceholder(supabaseUrl)) {
  blockers.push("Set VITE_SUPABASE_URL to the HTTPS URL of the intended production Supabase project.");
}

const supabaseProjectId = environmentValue("VITE_SUPABASE_PROJECT_ID");
if (!supabaseProjectId || isPlaceholder(supabaseProjectId)) {
  blockers.push("Set VITE_SUPABASE_PROJECT_ID to identify the intended production Supabase project.");
} else if (hasValidHttpsUrl(supabaseUrl)) {
  const hostname = new URL(supabaseUrl).hostname;
  if (hostname.endsWith(".supabase.co") && hostname !== `${supabaseProjectId}.supabase.co`) {
    blockers.push("VITE_SUPABASE_PROJECT_ID must match the project reference in VITE_SUPABASE_URL.");
  }
}

const publishableKey = environmentValue("VITE_SUPABASE_PUBLISHABLE_KEY");
if (!publishableKey || isPlaceholder(publishableKey) || /service[_-]?role|secret/i.test(publishableKey)) {
  blockers.push("Set VITE_SUPABASE_PUBLISHABLE_KEY to a non-secret browser key for the intended production project.");
}

if (paidLaunch) {
  const stripeKey = environmentValue("VITE_PAYMENTS_CLIENT_TOKEN");
  if (!stripeKey.startsWith("pk_live_") || isPlaceholder(stripeKey)) {
    blockers.push("A paid launch needs VITE_PAYMENTS_CLIENT_TOKEN to be a live Stripe publishable key (pk_live_...).");
  }
} else if (!environmentValue("VITE_PAYMENTS_CLIENT_TOKEN")) {
  notes.push("Checkout is intentionally disabled because VITE_PAYMENTS_CLIENT_TOKEN is not set.");
}

try {
  const trackedEnvironmentFiles = gitOutput("ls-files", "--", ".env", ".env.*")
    .split("\n")
    .filter((path) => path && path !== ".env.example")
    .join("\n");
  if (trackedEnvironmentFiles) {
    blockers.push("Remove tracked environment files and rotate any credentials they contained before release.");
  }

  if (gitOutput("status", "--porcelain")) {
    blockers.push("Commit the exact release artifact or use a clean release worktree before deployment.");
  }
} catch {
  blockers.push("Run this preflight from a Git worktree so the release artifact can be identified.");
}

if (sourceHas("src/pages/Privacy.tsx", "Before a public paid launch, we will publish")
  || sourceHas("src/pages/Privacy.tsx", "Before public launch, we will publish")) {
  blockers.push("Finish the provider, retention, analytics, and cookie disclosures in the Privacy Policy.");
}

if (sourceHas("src/pages/Terms.tsx", "Before a public paid launch, we will publish")) {
  blockers.push("Finish the operating-entity, contact, and governing-law details in the Terms of Service.");
}

if (!existsSync(`supabase/migrations/${REQUIRED_MIGRATION}`)) {
  blockers.push(`The required release migration ${REQUIRED_MIGRATION} is missing from this artifact.`);
}

for (const functionName of REQUIRED_EDGE_FUNCTIONS) {
  if (!existsSync(`supabase/functions/${functionName}/index.ts`)) {
    blockers.push(`The required Edge Function ${functionName} is missing from this artifact.`);
  }
}

for (const functionName of SENSITIVE_NO_STORE_FUNCTIONS) {
  const path = `supabase/functions/${functionName}/index.ts`;
  if (!sourceHas(path, "Cache-Control") || !sourceHas(path, "no-store")) {
    blockers.push(`The sensitive ${functionName} response policy must include Cache-Control: no-store.`);
  }
}

const manualChecks = [
  "Apply the intended Supabase migrations through 20260804124000_bound_payday_check_in_to_active_cycle.sql and deploy the exact Edge Function revisions, including server-owned payslip upload, original-link, checkout-return verification, payment-webhook, and account-deletion functions.",
  "Roll out 20260804114000_server_owned_payslip_upload_sessions and 20260804114500_harden_payslip_upload_token_lifecycle before 20260804115000_lock_down_direct_payslip_storage; block or upgrade old mobile builds before the final policy lock-down.",
  "Set the server-only PAYSLIP_UPLOAD_CLEANUP_SECRET and verify a protected scheduled cleanup of expired upload sessions in the target Supabase project. Confirm invalid and deletion-requested files remain queued until their signed upload token expires, rather than being untracked early.",
  "Set the server-only ACCOUNT_DELETION_WORKER_SECRET and verify a protected frequent POST worker for delete-account with { runDue: true }. Prove queued deletion resumes after an upload-token wait, waits for a recent original-link lease, and a seeded deletion-time billing review blocks deleteUser before Auth is removed. Delay a worker between Auth preparation and confirmation, deliver a verified billing event, and confirm Auth is not called.",
  "Verify the deployed delete-account function cannot continue for 300 seconds after its final Auth confirmation (or reduce the lease to the platform-enforced bound). The lease reservation protects the external Auth call only while that bound is real in the target runtime.",
  "Use two real test accounts to prove storage, payslip, plan, and buffer-goal isolation. After policy lock-down, raw browser Storage create/list/read/delete must be denied while an owner-scoped signed upload and 60-second original link still work. In separate tabs, start failed-upload cleanup between original-link reservation and activation: the response must contain no URL, and a previously issued link must delay protected cleanup until expiry. Start deletion immediately after a link is issued and prove no new link can be minted.",
  "Test sign-up, email confirmation, password reset, upload -> review -> confirm -> plan, failed-upload removal, and account deletion recovery against the deployed app.",
  "For a paid launch, test Stripe checkout creation and resume, exact-session return verification, webhook, entitlement, portal, cancellation, and refund handling in the matching mode. Start deletion between Checkout Session creation and binding: neither path may return a client secret. Replay a paid lifetime event and an active subscription event after Auth deletion; each must create one durable review record and no entitlement. Resolve each event, then use the separate service-only approval to prove a known Auth-removal receipt seals without a second Auth deletion. Confirm the final deletion guard and webhook do not deadlock.",
  "Document the support decision and retention policy for deletion-billing reviews (including Stripe identifiers), original-document retention, provider retention, cost limits, error monitoring, legal disclosures, and live headers before accepting customer payslips.",
  "Build the release candidate with npm run build, then verify the public deployment serves /release.json with the reviewed commit SHA, worktree: clean, and a web surface value. This file is non-secret provenance only; it does not prove external services are configured.",
];

console.log("\nPayslip Insights web release preflight\n");

if (notes.length > 0) {
  console.log("Notes:");
  notes.forEach((note) => console.log(`- ${note}`));
  console.log("");
}

if (blockers.length > 0) {
  console.error("Blocking checks:");
  blockers.forEach((blocker) => console.error(`- ${blocker}`));
  console.error("\nManual release proof still required:");
  manualChecks.forEach((check) => console.error(`- ${check}`));
  process.exitCode = 1;
} else {
  console.log("Automated configuration checks passed.");
  console.log("\nManual release proof still required:");
  manualChecks.forEach((check) => console.log(`- ${check}`));
}
