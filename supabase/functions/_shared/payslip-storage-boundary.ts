/**
 * Server-owned boundary for every payslip object path. Storage is accessed
 * with service credentials in several flows, so a record must never be able
 * to point outside its authenticated owner's single-object namespace.
 */
export const PAYSLIP_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PAYSLIP_OBJECT_PATH_MAX_LENGTH = 512;

export function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Accept exactly one leaf object below the authenticated user's UUID prefix.
 * Reject separators, NUL bytes and dot leaves even though object storage does
 * not normally normalise paths: every downstream service-role read shares
 * this conservative check.
 */
export function isOwnedPayslipObjectPath(value: unknown, userId: string): value is string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > PAYSLIP_OBJECT_PATH_MAX_LENGTH
    || !isUuid(userId)
  ) {
    return false;
  }

  const prefix = `${userId}/`;
  if (!value.startsWith(prefix)) return false;
  const leaf = value.slice(prefix.length);
  return leaf.length > 0
    && leaf !== "."
    && leaf !== ".."
    && !leaf.includes("/")
    && !leaf.includes("\\")
    && !leaf.includes("\0");
}
