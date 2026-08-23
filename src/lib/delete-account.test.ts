import { describe, expect, it, vi } from "vitest";
import { deleteCurrentUserAccount } from "@/lib/delete-account";
import {
  AccountDeletionStorageEnumerationError,
  AccountDeletionStoragePathVerificationError,
  enumerateSecureOwnedPayslipStoragePaths,
  isSecureOwnedPayslipPath,
  partitionSecureOwnedPayslipPaths,
  requireSecureOwnedPayslipPathsForAccountDeletion,
} from "../../supabase/functions/_shared/account-deletion.ts";

describe("deleteCurrentUserAccount", () => {
  it("uses the server-side deletion function without sending a user, plan, or storage path", async () => {
    const invoke = vi.fn(async () => ({ data: { success: true }, error: null }));

    await expect(deleteCurrentUserAccount({ functions: { invoke } })).resolves.toEqual({ billingReviewRequired: false });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("delete-account", { body: {} });
  });

  it("confirms deletion when the server says data was removed but billing needs a follow-up", async () => {
    await expect(deleteCurrentUserAccount({
      functions: {
        invoke: vi.fn(async () => ({
          data: {
            success: true,
            billingReviewRequired: true,
            code: "billing_needs_review",
          },
          error: null,
        })),
      },
    })).resolves.toEqual({ billingReviewRequired: true });
  });

  it("does not treat an unconfirmed function response as a successful deletion", async () => {
    await expect(deleteCurrentUserAccount({
      functions: { invoke: vi.fn(async () => ({ data: { success: false }, error: null })) },
    })).rejects.toThrow("server did not confirm deletion");
  });

  it("preserves only an allowlisted safe deletion block from the server", async () => {
    await expect(deleteCurrentUserAccount({
      functions: {
        invoke: vi.fn(async () => ({
          data: null,
          error: {
            message: "raw storage provider detail must not reach the customer",
            context: new Response(JSON.stringify({
              code: "payslip_cleanup_needs_review",
              error: "raw storage provider detail must not reach the customer",
            })),
          },
        })),
      },
    })).rejects.toEqual(expect.objectContaining({
      code: "payslip_cleanup_needs_review",
      message: "We need to safely confirm removal of a stored payslip before deleting this account. Please contact support.",
    }));
  });

  it("keeps deletion paused while a non-revocable upload token is still active", async () => {
    await expect(deleteCurrentUserAccount({
      functions: {
        invoke: vi.fn(async () => ({
          data: { code: "upload_token_pending" },
          error: null,
        })),
      },
    })).rejects.toEqual(expect.objectContaining({
      code: "upload_token_pending",
      message: "A recent secure upload is still protected by a short upload window. Please try deleting this account again shortly.",
    }));
  });

  it("treats a durable deletion job as pending rather than a completed deletion", async () => {
    await expect(deleteCurrentUserAccount({
      functions: {
        invoke: vi.fn(async () => ({
          data: { pending: true, code: "account_deletion_pending" },
          error: null,
        })),
      },
    })).rejects.toEqual(expect.objectContaining({
      code: "account_deletion_pending",
      message: "Your account deletion is safely queued and will continue automatically. You can close the app while it finishes.",
    }));
  });

  it("does not expose an unknown function error", async () => {
    await expect(deleteCurrentUserAccount({
      functions: { invoke: vi.fn(async () => ({ data: null, error: { message: "private provider diagnostic" } })) },
    })).rejects.toThrow("deletion could not be completed");
  });
});

describe("account deletion storage enumeration", () => {
  const userId = "2c9f2157-1d96-4243-946e-64ec8164524e";

  it("includes an orphaned upload, paginated files, and nested legacy files before account deletion", async () => {
    const referencedPath = `${userId}/2026-08-payslip.pdf`;
    const orphanedPath = `${userId}/upload-finished-but-db-write-failed.pdf`;
    const nestedPath = `${userId}/legacy/2026-07-payslip.pdf`;
    const paginatedNestedPath = `${userId}/legacy/2026-06-payslip.pdf`;

    const listPage = vi.fn(async (prefix: string, options: { limit: number; offset: number }) => {
      const pages: Record<string, unknown[]> = {
        [`${userId}:0`]: [
          { name: "2026-08-payslip.pdf", id: "file-1", metadata: {} },
          { name: "upload-finished-but-db-write-failed.pdf", id: "orphan-1", metadata: {} },
        ],
        [`${userId}:2`]: [
          { name: "legacy", id: null, metadata: null },
        ],
        [`${userId}/legacy:0`]: [
          { name: "2026-07-payslip.pdf", id: "file-2", metadata: {} },
          { name: "2026-06-payslip.pdf", id: "file-3", metadata: {} },
        ],
      };

      expect(options.limit).toBe(2);
      return { data: pages[`${prefix}:${options.offset}`] ?? [], error: null };
    });

    const storagePaths = await enumerateSecureOwnedPayslipStoragePaths(listPage, userId, { pageSize: 2 });

    expect(storagePaths).toEqual([
      referencedPath,
      orphanedPath,
      nestedPath,
      paginatedNestedPath,
    ]);
    expect(requireSecureOwnedPayslipPathsForAccountDeletion([
      referencedPath,
      ...storagePaths,
    ], userId)).toEqual([
      referencedPath,
      orphanedPath,
      nestedPath,
      paginatedNestedPath,
    ]);
    expect(listPage).toHaveBeenCalledWith(userId, { limit: 2, offset: 0 });
    expect(listPage).toHaveBeenCalledWith(`${userId}/legacy`, { limit: 2, offset: 0 });
  });

  it("fails closed when storage enumeration returns a traversal-looking name or an error", async () => {
    await expect(enumerateSecureOwnedPayslipStoragePaths(
      async () => ({
        data: [{ name: "../other-user/payslip.pdf", id: "file-1", metadata: {} }],
        error: null,
      }),
      userId,
    )).rejects.toThrow(AccountDeletionStorageEnumerationError);

    await expect(enumerateSecureOwnedPayslipStoragePaths(
      async () => ({ data: null, error: new Error("Storage unavailable") }),
      userId,
    )).rejects.toThrow(AccountDeletionStorageEnumerationError);
  });
});

describe("payslip storage ownership guard", () => {
  const userId = "2c9f2157-1d96-4243-946e-64ec8164524e";

  it("keeps only safe paths under the authenticated user's namespace", () => {
    const result = partitionSecureOwnedPayslipPaths([
      `${userId}/2026-08-payslip.pdf`,
      `${userId}/archive/2026-07-payslip.pdf`,
      `${userId}/2026-08-payslip.pdf`,
      "7d0c4cca-70d2-48aa-8f4d-af5f1c08ca9d/victim-payslip.pdf",
      `${userId}/../7d0c4cca-70d2-48aa-8f4d-af5f1c08ca9d/victim-payslip.pdf`,
      null,
    ], userId);

    expect(result).toEqual({
      paths: [
        `${userId}/2026-08-payslip.pdf`,
        `${userId}/archive/2026-07-payslip.pdf`,
      ],
      rejectedPathCount: 2,
    });
  });

  it("rejects empty, traversal, and foreign-user paths", () => {
    expect(isSecureOwnedPayslipPath(`${userId}/`, userId)).toBe(false);
    expect(isSecureOwnedPayslipPath(`${userId}/./payslip.pdf`, userId)).toBe(false);
    expect(isSecureOwnedPayslipPath("foreign-user/payslip.pdf", userId)).toBe(false);
    expect(partitionSecureOwnedPayslipPaths([null, ""], userId)).toEqual({
      paths: [],
      rejectedPathCount: 1,
    });
  });

  it("keeps deletion all-or-nothing when a legacy path cannot be verified", () => {
    const legitimatePath = `${userId}/1710000000000-payslip.pdf`;

    expect(() => requireSecureOwnedPayslipPathsForAccountDeletion([
      legitimatePath,
      `${userId}/../foreign-user/payslip.pdf`,
      "",
    ], userId)).toThrow(AccountDeletionStoragePathVerificationError);

    expect(requireSecureOwnedPayslipPathsForAccountDeletion([
      legitimatePath,
      `${userId}/archive/2026-07-payslip.pdf`,
      legitimatePath,
      null,
    ], userId)).toEqual([
      legitimatePath,
      `${userId}/archive/2026-07-payslip.pdf`,
    ]);
  });
});
