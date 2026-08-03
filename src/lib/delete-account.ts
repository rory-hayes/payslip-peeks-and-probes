interface DeleteAccountFunctionClient {
  functions: {
    invoke(
      name: "delete-account",
      payload: { body: Record<string, never> },
    ): Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export async function deleteCurrentUserAccount(supabase: DeleteAccountFunctionClient) {
  const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });
  if (error) throw new Error(`delete account: ${error.message}`);

  if (!data || typeof data !== "object" || (data as { success?: unknown }).success !== true) {
    throw new Error("delete account: the server did not confirm deletion");
  }
}
