import type { Plan } from "@/hooks/use-subscription";

type QueryResult<T> = Promise<{ data: T; error: { message: string } | null }>;

interface StorageBucketClient {
  remove(paths: string[]): QueryResult<unknown>;
}

interface TableClient {
  select?(columns: string): {
    eq(column: string, value: string): QueryResult<{ file_path: string | null }[]>;
  };
  delete(): {
    eq(column: string, value: string): QueryResult<unknown>;
  };
}

interface SupabaseDeleteClient {
  functions: {
    invoke(name: string, payload: { body: { environment: string } }): QueryResult<unknown>;
  };
  storage: {
    from(bucket: string): StorageBucketClient;
  };
  from(table: string): TableClient;
}

interface DeleteAccountOptions {
  userId: string;
  isPremium: boolean;
  plan: Plan;
  environment: string;
}

async function assertNoError(result: { error: { message: string } | null }, action: string) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }
}

export async function deleteUserAccountData(
  supabase: SupabaseDeleteClient,
  { userId, isPremium, plan, environment }: DeleteAccountOptions,
) {
  if (isPremium && plan !== "lifetime") {
    const cancelResult = await supabase.functions.invoke("cancel-subscription-on-delete", {
      body: { environment },
    });
    await assertNoError(cancelResult, "cancel subscription");
  }

  const payslipFilesResult = await supabase
    .from("payslips")
    .select?.("file_path")
    .eq("user_id", userId);

  if (!payslipFilesResult) {
    throw new Error("load payslip files: query client missing select support");
  }

  await assertNoError(payslipFilesResult, "load payslip files");

  const paths = (payslipFilesResult.data ?? [])
    .map((payslip) => payslip.file_path)
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    const storageResult = await supabase.storage.from("payslips").remove(paths);
    await assertNoError(storageResult, "delete payslip files");
  }

  await assertNoError(await supabase.from("user_notes").delete().eq("user_id", userId), "delete user notes");
  await assertNoError(await supabase.from("issue_drafts").delete().eq("user_id", userId), "delete issue drafts");
  await assertNoError(await supabase.from("audit_events").delete().eq("user_id", userId), "delete audit events");
  await assertNoError(
    await supabase.from("billing_subscriptions").delete().eq("user_id", userId),
    "delete legacy subscriptions",
  );
  await assertNoError(await supabase.from("payslips").delete().eq("user_id", userId), "delete payslips");
  await assertNoError(await supabase.from("employers").delete().eq("user_id", userId), "delete employers");
  await assertNoError(await supabase.from("profiles").delete().eq("user_id", userId), "delete profile");
}
