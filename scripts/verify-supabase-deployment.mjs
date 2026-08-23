import { loadEnv } from 'vite';

export const REQUIRED_EDGE_FUNCTIONS = [
  'start-payslip-upload',
  'finish-payslip-upload',
  'get-payslip-original-url',
  'delete-failed-payslip',
  'cleanup-expired-payslip-uploads',
  'process-payslip',
  'create-checkout',
  'verify-checkout-return',
  'payments-webhook',
  'create-portal-session',
  'delete-account',
];

const DEFAULT_TIMEOUT_MS = 15_000;

function envValue(name) {
  const productionEnv = loadEnv('production', process.cwd(), '');
  return (process.env[name] ?? productionEnv[name] ?? '').trim().replace(/^"(.*)"$/, '$1');
}

function readOption(argv, name) {
  const prefix = `--${name}=`;
  const inline = argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = argv.indexOf(`--${name}`);
  return index === -1 ? null : argv[index + 1] ?? null;
}

export function classifyFunctionResponse(status, body = '') {
  if (status === 404 && /requested function was not found|function not found/i.test(body)) {
    return 'missing';
  }
  if (status >= 200 && status < 600) return 'present';
  return 'unreachable';
}

export async function probeSupabaseFunction({ baseUrl, publishableKey, functionName, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`, {
      method: 'OPTIONS',
      headers: {
        apikey: publishableKey,
        Origin: 'https://payslipinsights.com',
        'Access-Control-Request-Method': 'POST',
      },
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      functionName,
      status: response.status,
      result: classifyFunctionResponse(response.status, body),
    };
  } catch (error) {
    return {
      functionName,
      status: null,
      result: 'unreachable',
      error: error instanceof Error ? error.message : 'Unknown network error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifySupabaseDeployment({ baseUrl, publishableKey, functionNames = REQUIRED_EDGE_FUNCTIONS, fetchImpl = fetch }) {
  const results = await Promise.all(functionNames.map((functionName) => probeSupabaseFunction({
    baseUrl,
    publishableKey,
    functionName,
    fetchImpl,
  })));

  return {
    results,
    missing: results.filter((result) => result.result === 'missing').map((result) => result.functionName),
    unreachable: results.filter((result) => result.result === 'unreachable').map((result) => result.functionName),
  };
}

async function main() {
  const baseUrl = (readOption(process.argv.slice(2), 'url') ?? envValue('VITE_SUPABASE_URL')).trim();
  const publishableKey = envValue('VITE_SUPABASE_PUBLISHABLE_KEY');

  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error('Pass --url with the HTTPS URL of the intended Supabase project, or set VITE_SUPABASE_URL.');
  }
  if (!publishableKey || /service[_-]?role|secret/i.test(publishableKey)) {
    throw new Error('Set VITE_SUPABASE_PUBLISHABLE_KEY to a non-secret browser key.');
  }

  const verification = await verifySupabaseDeployment({ baseUrl, publishableKey });
  console.log('\nPayslip Insights Supabase deployment verification\n');
  verification.results.forEach((result) => {
    const status = result.status === null ? 'network error' : `HTTP ${result.status}`;
    console.log(`- ${result.functionName}: ${result.result} (${status})`);
  });

  if (verification.missing.length > 0 || verification.unreachable.length > 0) {
    console.error('\nThe intended Supabase project is not ready for the reviewed release.');
    if (verification.missing.length > 0) console.error(`Missing functions: ${verification.missing.join(', ')}`);
    if (verification.unreachable.length > 0) console.error(`Unreachable functions: ${verification.unreachable.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nAll required Edge Function routes are present. This check does not prove migrations, secrets, auth, billing, or data isolation.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
