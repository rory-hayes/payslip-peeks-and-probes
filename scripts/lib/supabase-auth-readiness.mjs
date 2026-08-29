const DEFAULT_TIMEOUT_MS = 15_000;

export function productionAuthSettingIssues(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return ['The production Supabase Auth settings response is invalid.'];
  }

  const issues = [];
  if (settings.disable_signup === true) {
    issues.push('Production email sign-up is disabled in Supabase Auth.');
  }
  if (settings.external?.email !== true) {
    issues.push('Production email authentication is disabled in Supabase Auth.');
  }
  if (settings.mailer_autoconfirm !== false) {
    issues.push('Disable Supabase email auto-confirm so a new account must prove control of its email address.');
  }

  return issues;
}

export async function fetchProductionAuthSettings({
  baseUrl,
  publishableKey,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { error: `Supabase Auth settings returned HTTP ${response.status}.`, settings: null };
    }

    return { error: null, settings: await response.json() };
  } catch (error) {
    return {
      error: `Supabase Auth settings could not be verified: ${error instanceof Error ? error.message : 'unknown network error'}.`,
      settings: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
