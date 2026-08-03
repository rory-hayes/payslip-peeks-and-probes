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
      if (filePath) rejectedPathCount += 1;
      continue;
    }
    uniquePaths.add(filePath);
  }

  return {
    paths: [...uniquePaths],
    rejectedPathCount,
  };
}
