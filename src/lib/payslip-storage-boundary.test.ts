import { describe, expect, it } from "vitest";
import {
  isOwnedPayslipObjectPath,
  PAYSLIP_OBJECT_PATH_MAX_LENGTH,
} from "../../supabase/functions/_shared/payslip-storage-boundary.ts";

const ownerId = "5cd4d08e-a1ea-438f-a8d5-8d75c4c8bef8";

describe("server payslip storage ownership boundary", () => {
  it("accepts only one non-special object leaf in the authenticated owner's namespace", () => {
    expect(isOwnedPayslipObjectPath(`${ownerId}/upload-abc123`, ownerId)).toBe(true);
  });

  it.each([
    "2dd4d08e-a1ea-438f-a8d5-8d75c4c8bef8/upload-abc123",
    `${ownerId}/nested/upload-abc123`,
    `${ownerId}\\upload-abc123`,
    `${ownerId}/upload\0abc123`,
    `${ownerId}/.`,
    `${ownerId}/..`,
    `${ownerId}/`,
    `${ownerId}/${"a".repeat(PAYSLIP_OBJECT_PATH_MAX_LENGTH)}`,
  ])("rejects an unsafe or non-owner path: %s", (path) => {
    expect(isOwnedPayslipObjectPath(path, ownerId)).toBe(false);
  });

  it("rejects a non-UUID owner even when the prefix appears to match", () => {
    expect(isOwnedPayslipObjectPath("not-a-uuid/upload-abc123", "not-a-uuid")).toBe(false);
  });
});
