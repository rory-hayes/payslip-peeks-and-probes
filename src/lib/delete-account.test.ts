import { describe, expect, it, vi } from "vitest";
import { deleteCurrentUserAccount } from "@/lib/delete-account";
import {
  isSecureOwnedPayslipPath,
  partitionSecureOwnedPayslipPaths,
} from "../../supabase/functions/_shared/account-deletion.ts";

describe("deleteCurrentUserAccount", () => {
  it("uses the server-side deletion function without sending a user, plan, or storage path", async () => {
    const invoke = vi.fn(async () => ({ data: { success: true }, error: null }));

    await deleteCurrentUserAccount({ functions: { invoke } });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("delete-account", { body: {} });
  });

  it("does not treat an unconfirmed function response as a successful deletion", async () => {
    await expect(deleteCurrentUserAccount({
      functions: { invoke: vi.fn(async () => ({ data: { success: false }, error: null })) },
    })).rejects.toThrow("server did not confirm deletion");
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
  });
});
