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

/**
 * Storage's list API returns direct children of a prefix. File entries have a
 * non-null id; virtual folder entries have a null id and null metadata. Keep
 * this deliberately small structural type so the traversal is testable from
 * the web test suite without bringing the Edge Runtime client into it.
 */
export interface AccountDeletionStorageListEntry {
  name?: unknown;
  id?: unknown;
  metadata?: unknown;
}

export interface AccountDeletionStorageListOptions {
  limit: number;
  offset: number;
}

export interface AccountDeletionStorageListResult {
  data: unknown;
  error: unknown;
}

export type AccountDeletionStoragePageLister = (
  prefix: string,
  options: AccountDeletionStorageListOptions,
) => Promise<AccountDeletionStorageListResult>;

export class AccountDeletionStorageEnumerationError extends Error {
  constructor() {
    super("Account deletion could not enumerate every payslip storage object");
    this.name = "AccountDeletionStorageEnumerationError";
  }
}

const ACCOUNT_DELETION_STORAGE_LIST_PAGE_SIZE = 100;
// A customer with more than 100,000 stored objects needs a manual deletion
// review. This keeps an attacker from turning a self-service deletion request
// into unbounded service-role storage work while still far exceeding the
// product's expected payslip history.
const MAX_ACCOUNT_DELETION_STORAGE_LIST_PAGES = 1_000;

function isSafeStoragePathSegment(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value !== "."
    && value !== ".."
    && !value.includes("/")
    && !value.includes("\\")
    && !value.includes("\0");
}

function getSecureOwnedStorageListEntry(
  entry: unknown,
  parentPrefix: string,
  userId: string,
): { kind: "file" | "folder"; path: string } {
  if (!entry || typeof entry !== "object") {
    throw new AccountDeletionStorageEnumerationError();
  }

  const storageEntry = entry as AccountDeletionStorageListEntry;
  if (!isSafeStoragePathSegment(storageEntry.name)) {
    throw new AccountDeletionStorageEnumerationError();
  }

  const path = `${parentPrefix}/${storageEntry.name}`;
  if (!isSecureOwnedPayslipPath(path, userId)) {
    throw new AccountDeletionStorageEnumerationError();
  }

  if (typeof storageEntry.id === "string" && storageEntry.id.length > 0) {
    return { kind: "file", path };
  }

  if (storageEntry.id === null && storageEntry.metadata === null) {
    return { kind: "folder", path };
  }

  // A list result with an unsupported shape must block account deletion. It
  // would be unsafe to silently skip an object and then cascade away the only
  // remaining account record that could be used to remediate it.
  throw new AccountDeletionStorageEnumerationError();
}

/**
 * Enumerate every object below exactly one authenticated user's prefix. The
 * service-role Edge Function cannot trust paths returned from storage more
 * than it can trust legacy database paths, so this traversal validates each
 * returned name, recursively visits only confirmed folders, and fails closed
 * on list errors or unexpected response shapes.
 */
export async function enumerateSecureOwnedPayslipStoragePaths(
  listPage: AccountDeletionStoragePageLister,
  userId: string,
  options: { pageSize?: number } = {},
): Promise<string[]> {
  const pageSize = options.pageSize ?? ACCOUNT_DELETION_STORAGE_LIST_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1_000) {
    throw new AccountDeletionStorageEnumerationError();
  }

  if (!isSafeStoragePathSegment(userId)) {
    throw new AccountDeletionStorageEnumerationError();
  }

  const pendingPrefixes = [userId];
  const visitedPrefixes = new Set<string>();
  const paths = new Set<string>();
  let pageRequests = 0;

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.shift();
    if (!prefix || visitedPrefixes.has(prefix)) continue;
    visitedPrefixes.add(prefix);

    let offset = 0;
    while (true) {
      if (pageRequests >= MAX_ACCOUNT_DELETION_STORAGE_LIST_PAGES) {
        throw new AccountDeletionStorageEnumerationError();
      }
      pageRequests += 1;

      let result: AccountDeletionStorageListResult;
      try {
        result = await listPage(prefix, { limit: pageSize, offset });
      } catch {
        throw new AccountDeletionStorageEnumerationError();
      }

      if (!result || typeof result !== "object" || result.error !== null) {
        throw new AccountDeletionStorageEnumerationError();
      }
      if (!Array.isArray(result.data)) {
        throw new AccountDeletionStorageEnumerationError();
      }

      for (const entry of result.data) {
        const secureEntry = getSecureOwnedStorageListEntry(entry, prefix, userId);
        if (secureEntry.kind === "file") {
          paths.add(secureEntry.path);
        } else if (!visitedPrefixes.has(secureEntry.path)) {
          pendingPrefixes.push(secureEntry.path);
        }
      }

      if (result.data.length < pageSize) break;
      offset += result.data.length;
    }
  }

  return [...paths];
}
