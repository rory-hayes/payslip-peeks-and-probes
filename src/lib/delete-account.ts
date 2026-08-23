type AccountDeletionBlockCode =
  | "checkout_pending"
  | "billing_needs_review"
  | "payslip_cleanup_needs_review"
  | "upload_token_pending";

type AccountDeletionPendingCode = "account_deletion_pending";

const SAFE_BLOCK_MESSAGES: Record<AccountDeletionBlockCode, string> = {
  checkout_pending: "A payment is still being confirmed. Please wait a moment and try again.",
  billing_needs_review: "A checkout needs a billing review before this account can be deleted. Please contact support.",
  payslip_cleanup_needs_review: "We need to safely confirm removal of a stored payslip before deleting this account. Please contact support.",
  upload_token_pending: "A recent secure upload is still protected by a short upload window. Please try deleting this account again shortly.",
};

export class AccountDeletionBlockedError extends Error {
  constructor(readonly code: AccountDeletionBlockCode) {
    super(SAFE_BLOCK_MESSAGES[code]);
    this.name = "AccountDeletionBlockedError";
  }
}

export class AccountDeletionPendingError extends Error {
  constructor(readonly code: AccountDeletionPendingCode) {
    super("Your account deletion is safely queued and will continue automatically. You can close the app while it finishes.");
    this.name = "AccountDeletionPendingError";
  }
}

export type AccountDeletionConfirmation = {
  /**
   * The account and app data are gone, but a provider-side billing receipt
   * still needs a support follow-up. This is intentionally a confirmation,
   * not a deletion failure.
   */
  billingReviewRequired: boolean;
};

interface DeleteAccountFunctionError {
  message: string;
  context?: unknown;
}

interface DeleteAccountFunctionClient {
  functions: {
    invoke(
      name: "delete-account",
      payload: { body: Record<string, never> },
    ): Promise<{ data: unknown; error: DeleteAccountFunctionError | null }>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeBlockedError(value: unknown): AccountDeletionBlockedError | null {
  if (!isRecord(value) || typeof value.code !== "string") return null;
  if (!(value.code in SAFE_BLOCK_MESSAGES)) return null;
  return new AccountDeletionBlockedError(value.code as AccountDeletionBlockCode);
}

function safePendingError(value: unknown): AccountDeletionPendingError | null {
  if (!isRecord(value) || value.code !== "account_deletion_pending") return null;
  return new AccountDeletionPendingError("account_deletion_pending");
}

async function functionErrorPayload(error: DeleteAccountFunctionError): Promise<unknown> {
  const context = error.context;
  if (typeof Response !== "undefined" && context instanceof Response) {
    try {
      return await context.clone().json();
    } catch {
      return null;
    }
  }
  return isRecord(context) ? context : null;
}

export async function deleteCurrentUserAccount(
  supabase: DeleteAccountFunctionClient,
): Promise<AccountDeletionConfirmation> {
  const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });

  // A 202 response can truthfully confirm that Auth and all app data have
  // already been removed while a provider-side billing record needs a manual
  // follow-up. Treat the explicit success flag as authoritative before
  // interpreting the safe `billing_needs_review` code below.
  if (isRecord(data) && data.success === true) {
    return { billingReviewRequired: data.billingReviewRequired === true };
  }

  const blockedByData = safeBlockedError(data);
  if (blockedByData) throw blockedByData;
  const pendingByData = safePendingError(data);
  if (pendingByData) throw pendingByData;

  if (error) {
    const errorPayload = await functionErrorPayload(error);
    const blockedByError = safeBlockedError(errorPayload);
    if (blockedByError) throw blockedByError;
    const pendingByError = safePendingError(errorPayload);
    if (pendingByError) throw pendingByError;
    // Never display raw function/provider text in this sensitive account flow.
    throw new Error("delete account: deletion could not be completed");
  }

  throw new Error("delete account: the server did not confirm deletion");
}
