import { describe, expect, it, vi } from "vitest";
import { deleteUserAccountData } from "@/lib/delete-account";

function createDeleteChain(table: string, calls: string[]) {
  return {
    eq: vi.fn(async (_column: string, _value: string) => {
      calls.push(`delete:${table}`);
      return { error: null };
    }),
  };
}

function createSelectChain(calls: string[]) {
  return {
    eq: vi.fn(async (_column: string, _value: string) => {
      calls.push("select:payslips");
      return { data: [{ file_path: "user/file.pdf" }], error: null };
    }),
  };
}

describe("deleteUserAccountData", () => {
  it("deletes payslips before employers to avoid foreign-key failures", async () => {
    const calls: string[] = [];
    const supabase = {
      functions: {
        invoke: vi.fn(async () => {
          calls.push("function:cancel-subscription-on-delete");
          return { error: null };
        }),
      },
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(async (_paths: string[]) => {
            calls.push("storage:remove");
            return { error: null };
          }),
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "payslips") {
          return {
            select: vi.fn(() => createSelectChain(calls)),
            delete: vi.fn(() => createDeleteChain(table, calls)),
          };
        }

        return {
          delete: vi.fn(() => createDeleteChain(table, calls)),
        };
      }),
    };

    await deleteUserAccountData(supabase as never, {
      userId: "user-123",
      isPremium: true,
      plan: "plus",
      environment: "sandbox",
    });

    expect(calls).toEqual([
      "function:cancel-subscription-on-delete",
      "select:payslips",
      "storage:remove",
      "delete:user_notes",
      "delete:issue_drafts",
      "delete:audit_events",
      "delete:billing_subscriptions",
      "delete:payslips",
      "delete:employers",
      "delete:profiles",
    ]);
  });
});
