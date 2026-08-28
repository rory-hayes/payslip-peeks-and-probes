import type { Extraction } from "./payslip-extraction.ts";

export interface ReviewedLineItemForChecks {
  label: string;
  kind: "earning" | "deduction" | "employer_contribution" | "information";
  amount: number | null;
}

export interface ReviewedLineItemAnomaly {
  anomaly_type: string;
  severity: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  title: string;
  description: string;
  suggested_action: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedDeductionKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isStandardDeduction(key: string): boolean {
  return [
    "tax",
    "paye",
    "income tax",
    "national insurance",
    "ni",
    "prsi",
    "usc",
    "pension",
    "workplace pension",
    "student loan",
  ].some((standard) => key === standard || key.startsWith(`${standard} `));
}

function formatDeductionList(
  entries: Array<{ label: string; amount: number }>,
  symbol: string,
): string {
  const visible = entries.slice(0, 5).map(({ label, amount }) => `${label} (${symbol}${amount.toFixed(2)})`);
  const remaining = entries.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")}, plus ${remaining} more` : visible.join(", ");
}

export function runReviewedLineItemChecks(
  currentItems: ReviewedLineItemForChecks[] | null,
  previousItems: ReviewedLineItemForChecks[] | null,
  country: string | null,
  threshold: number,
): ReviewedLineItemAnomaly[] {
  if (!currentItems || !previousItems) return [];

  const symbol = country?.toLowerCase() === "ireland" ? "€" : "£";
  const deductionMap = (items: ReviewedLineItemForChecks[]) => {
    const deductions = new Map<string, { label: string; amount: number }>();
    for (const item of items) {
      if (item.kind !== "deduction" || item.amount == null || item.amount <= 0) continue;
      const key = normalizedDeductionKey(item.label);
      if (!key || isStandardDeduction(key)) continue;
      const existing = deductions.get(key);
      deductions.set(key, {
        label: existing?.label ?? item.label,
        amount: (existing?.amount ?? 0) + item.amount,
      });
    }
    return deductions;
  };

  const current = deductionMap(currentItems);
  const previous = deductionMap(previousItems);
  const added: Array<{ label: string; amount: number }> = [];
  const removed: Array<{ label: string; amount: number }> = [];
  const changed: Array<{ label: string; amount: number; previousAmount: number; percent: number }> = [];

  current.forEach((item, key) => {
    const prior = previous.get(key);
    if (!prior) {
      added.push(item);
      return;
    }
    const percent = prior.amount === 0
      ? 100
      : ((item.amount - prior.amount) / Math.abs(prior.amount)) * 100;
    if (Math.abs(item.amount - prior.amount) > 1 && Math.abs(percent) > threshold) {
      changed.push({ ...item, previousAmount: prior.amount, percent });
    }
  });
  previous.forEach((item, key) => {
    if (!current.has(key)) removed.push(item);
  });

  const anomalies: ReviewedLineItemAnomaly[] = [];
  if (added.length > 0) {
    anomalies.push({
      anomaly_type: "reviewed_deductions_added",
      severity: "medium",
      confidence: "high",
      title: added.length === 1 ? "A new deduction appeared" : "New deductions appeared",
      description: `What changed: ${formatDeductionList(added, symbol)} ${added.length === 1 ? "was" : "were"} on this reviewed payslip but not the previous one.\n\nWhy it matters: A new non-statutory deduction can be expected, such as a benefit or workplace scheme, but it should match something you agreed to.`,
      suggested_action: "Check the deduction label and amount against any benefit, salary-sacrifice, attachment, or workplace-scheme agreement. Ask payroll for the calculation if you do not recognise it.",
    });
  }
  if (removed.length > 0) {
    anomalies.push({
      anomaly_type: "reviewed_deductions_removed",
      severity: "low",
      confidence: "high",
      title: removed.length === 1 ? "A previous deduction disappeared" : "Previous deductions disappeared",
      description: `What changed: ${formatDeductionList(removed, symbol)} ${removed.length === 1 ? "was" : "were"} on the previous reviewed payslip but not this one.\n\nWhy it matters: A deduction ending may be correct, but it can also mean a benefit, repayment, or workplace contribution stopped unexpectedly.`,
      suggested_action: "Check whether the deduction was meant to end this pay period. If not, ask payroll whether the related benefit, repayment, or contribution is still active.",
    });
  }
  if (changed.length > 0) {
    const visibleChanges = changed.slice(0, 5).map((item) => (
      `${item.label} changed from ${symbol}${item.previousAmount.toFixed(2)} to ${symbol}${item.amount.toFixed(2)} (${Math.abs(item.percent).toFixed(1)}%)`
    ));
    const remaining = changed.length - visibleChanges.length;
    const summary = remaining > 0 ? `${visibleChanges.join("; ")}; plus ${remaining} more` : visibleChanges.join("; ");
    anomalies.push({
      anomaly_type: "reviewed_deductions_changed",
      severity: changed.some((item) => Math.abs(item.percent) > 25) ? "medium" : "low",
      confidence: "high",
      title: changed.length === 1 ? "A deduction changed noticeably" : "Deductions changed noticeably",
      description: `What changed: ${summary}.\n\nWhy it matters: A sizeable change in a non-statutory deduction should usually match a known change to a benefit, repayment, or workplace scheme.`,
      suggested_action: "Compare the changed deduction with your agreement or previous payroll notice. Ask payroll for the calculation if the reason is not clear.",
    });
  }

  return anomalies;
}

export function storedReviewedLineItems(value: unknown): ReviewedLineItemForChecks[] | null {
  if (!isPlainObject(value) || !isPlainObject(value.normalized_json)) return null;
  const candidateItems = value.normalized_json.line_items;
  if (!Array.isArray(candidateItems) || candidateItems.length > 60) return null;

  const items: ReviewedLineItemForChecks[] = [];
  for (const candidate of candidateItems) {
    if (!isPlainObject(candidate) || candidate.reviewed !== true) return null;
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const kind = candidate.kind;
    const amount = candidate.amount == null || candidate.amount === ""
      ? null
      : typeof candidate.amount === "number"
        ? candidate.amount
        : Number(candidate.amount);
    if (
      !label
      || label.length > 120
      || (kind !== "earning" && kind !== "deduction" && kind !== "employer_contribution" && kind !== "information")
      || (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000))
    ) {
      return null;
    }
    items.push({ label, kind, amount });
  }
  return items;
}

function sumReviewedLineItems(
  items: ReviewedLineItemForChecks[] | null,
  kind: ReviewedLineItemForChecks["kind"],
  labelPattern: RegExp,
): number | null {
  if (!items) return null;
  const matches = items.filter((item) => item.kind === kind && item.amount != null && labelPattern.test(item.label));
  return matches.length > 0
    ? matches.reduce((sum, item) => sum + (item.amount ?? 0), 0)
    : null;
}

export function withReviewedDerivedAmounts(
  extraction: Extraction,
  items: ReviewedLineItemForChecks[] | null,
): Extraction {
  return {
    ...extraction,
    bonus_amount: sumReviewedLineItems(items, "earning", /\bbonus\b/i),
    overtime_amount: sumReviewedLineItems(items, "earning", /\bovertime\b/i),
    student_loan_amount: sumReviewedLineItems(items, "deduction", /\bstudent\s+loan\b/i),
  };
}
