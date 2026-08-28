/**
 * Public browser configuration for the production Payslip Insights project.
 *
 * Supabase publishable/legacy anon keys are deliberately public identifiers:
 * browser access is protected by Auth and Row Level Security, not by hiding
 * this value. Never add a secret or service-role key here.
 */
export const PUBLIC_SUPABASE_CONFIG = Object.freeze({
  projectId: 'shvivlhawhczbljzhvmr',
  url: 'https://shvivlhawhczbljzhvmr.supabase.co',
  publishableKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNodml2bGhhd2hjemJsanpodm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQ4NTUsImV4cCI6MjA5MTQwMDg1NX0.QE9wtBdtxw9bxRbF5PNIIRtqxpVdgOfClK6ILWvuUA4',
});

type PublicEnvironment = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY', string>>;

export function resolvePublicSupabaseConfig(environment: PublicEnvironment) {
  const explicitUrl = environment.VITE_SUPABASE_URL?.trim() || '';
  const explicitPublishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

  if (explicitUrl || explicitPublishableKey) {
    if (!explicitUrl || !explicitPublishableKey) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be provided together.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(explicitUrl);
    } catch {
      throw new Error('VITE_SUPABASE_URL must be a valid HTTPS URL.');
    }

    if (parsedUrl.protocol !== 'https:' || /service[_-]?role|secret|^sb_secret_/i.test(explicitPublishableKey)) {
      throw new Error('Only an HTTPS URL and a low-privilege Supabase publishable key may be used in the browser.');
    }

    return { url: explicitUrl, publishableKey: explicitPublishableKey };
  }

  return {
    url: PUBLIC_SUPABASE_CONFIG.url,
    publishableKey: PUBLIC_SUPABASE_CONFIG.publishableKey,
  };
}
