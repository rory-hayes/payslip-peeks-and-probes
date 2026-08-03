/**
 * Storage is private but Edge Functions use a service-role client, so a payslip
 * row's `file_path` must never be trusted on its own. Keep the guard shared and
 * deliberately conservative: only objects in the authenticated user's own
 * namespace can be removed with elevated storage permissions.
 */
export function isSecureOwnedPayslipPath(filePath: unknown, userId: string): filePath is string {
  if (typeof filePath !== "string" || !userId || userId.includes("/")) return false;

  const prefix = `${userId}/`;
  if (!filePath.startsWith(prefix) || filePath.includes("\0") || filePath.includes("\\")) {
    return false;
  }

  const relativePath = filePath.slice(prefix.length);
  if (!relativePath) return false;

  return relativePath.split("/").every((segment) => (
    segment.length > 0 && segment !== "." && segment !== ".."
  ));
}

export function partitionSecureOwnedPayslipPaths(
  filePaths: Array<string | null | undefined>,
  userId: string,
) {
  const uniquePaths = new Set<string>();
  let rejectedPathCount = 0;

  for (const filePath of filePaths) {
    if (!isSecureOwnedPayslipPath(filePath, userId)) {
      // `null` means this payslip has no stored original. An empty string is
      // malformed data, not an absent path: count it so account deletion
      // cannot silently cascade away the only reference to a legacy object.
      if (filePath !== null && filePath !== undefined) rejectedPathCount += 1;
      continue;
    }
    uniquePaths.add(filePath);
  }

  return {
    paths: [...uniquePaths],
    rejectedPathCount,
  };
}

/**
 * Account deletion must not hard-delete the database record after dropping an
 * unverified file reference. Doing so would leave the original payslip object
 * in private storage with no customer record left to remediate it. Callers
 * therefore need an all-or-nothing preflight: every non-null path is proven
 * safe, or the deletion is handed to a human review process before any object
 * is removed.
 */
export class AccountDeletionStoragePathVerificationError extends Error {
  constructor(readonly rejectedPathCount: number) {
    super("Account deletion could not verify every referenced payslip storage path");
    this.name = "AccountDeletionStoragePathVerificationError";
  }
}

export function requireSecureOwnedPayslipPathsForAccountDeletion(
  filePaths: Array<string | null | undefined>,
  userId: string,
): string[] {
  const partition = partitionSecureOwnedPayslipPaths(filePaths, userId);
  if (partition.rejectedPathCount > 0) {
    throw new AccountDeletionStoragePathVerificationError(partition.rejectedPathCount);
  }
  return partition.paths;
}
