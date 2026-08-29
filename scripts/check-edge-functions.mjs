import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const functionsRoot = path.resolve('supabase/functions');
const migrationsRoot = path.resolve('supabase/migrations');
const servicePrivilegeMigrationPath = path.join(
  migrationsRoot,
  '20260829110000_lock_service_rpc_privileges.sql',
);
const criticalNoStoreFunctions = [
  'create-checkout',
  'create-portal-session',
  'create-issue-draft',
  'delete-account',
  'get-stripe-price',
  'process-payslip',
  'verify-checkout-return',
];

const entries = readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => ({
    name: entry.name,
    path: path.join(functionsRoot, entry.name, 'index.ts'),
  }))
  .filter((entry) => {
    try {
      return statSync(entry.path).isFile();
    } catch {
      return false;
    }
  })
  .sort((left, right) => left.name.localeCompare(right.name));

if (entries.length === 0) {
  throw new Error('No Supabase Edge Function entrypoints were found.');
}

const errors = [];
for (const entry of entries) {
  const source = readFileSync(entry.path, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: entry.path,
    reportDiagnostics: true,
  });

  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    const position = diagnostic.start === undefined
      ? ''
      : `:${ts.getLineAndCharacterOfPosition(ts.createSourceFile(entry.path, source, ts.ScriptTarget.ES2022), diagnostic.start).line + 1}`;
    errors.push(`${path.relative(process.cwd(), entry.path)}${position} ${message}`);
  }
}

for (const functionName of criticalNoStoreFunctions) {
  const entry = entries.find((candidate) => candidate.name === functionName);
  if (!entry) {
    errors.push(`Missing critical Edge Function: ${functionName}.`);
    continue;
  }

  const source = readFileSync(entry.path, 'utf8');
  if (!source.includes('Cache-Control') || !source.includes('no-store')) {
    errors.push(`${path.relative(process.cwd(), entry.path)} must return Cache-Control: no-store for sensitive responses.`);
  }
}

const migrationSources = readdirSync(migrationsRoot)
  .filter((name) => /^\d{14}_.*\.sql$/.test(name))
  .sort()
  .map((name) => readFileSync(path.join(migrationsRoot, name), 'utf8'));
const serviceOnlyFunctionNames = new Set();
const authenticatedFunctionNames = new Set();
const serviceRoleGrantPattern = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\([^;]*?\)\s+TO\s+service_role\s*;/gim;
const authenticatedGrantPattern = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\([^;]*?\)\s+TO\s+authenticated\s*;/gim;

for (const source of migrationSources) {
  for (const match of source.matchAll(serviceRoleGrantPattern)) {
    serviceOnlyFunctionNames.add(match[1]);
  }
  for (const match of source.matchAll(authenticatedGrantPattern)) {
    authenticatedFunctionNames.add(match[1]);
  }
}

const servicePrivilegeMigration = readFileSync(servicePrivilegeMigrationPath, 'utf8');
for (const functionName of [...serviceOnlyFunctionNames].sort()) {
  if (!servicePrivilegeMigration.includes(`'${functionName}'`)) {
    errors.push(`Service-only RPC ${functionName} is missing from the final browser-role privilege lock.`);
  }
}
for (const functionName of [...authenticatedFunctionNames].sort()) {
  const retiredBrowserRpcPattern = new RegExp(
    `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${functionName}\\s*\\([^;]*?\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
    'im',
  );
  if (
    !servicePrivilegeMigration.includes(`'${functionName}'`)
    && !retiredBrowserRpcPattern.test(servicePrivilegeMigration)
  ) {
    errors.push(`Signed-in RPC ${functionName} is missing from the anonymous-role privilege lock.`);
  }
}

if (!servicePrivilegeMigration.includes('FROM PUBLIC, anon, authenticated')) {
  errors.push('The service RPC privilege lock must explicitly revoke PUBLIC, anon, and authenticated grants.');
}
if (!servicePrivilegeMigration.includes('ALTER DEFAULT PRIVILEGES FOR ROLE postgres')) {
  errors.push('The service RPC privilege lock must remove permissive future function defaults.');
}
if (!servicePrivilegeMigration.includes('FROM PUBLIC, anon')) {
  errors.push('The signed-in RPC privilege lock must explicitly revoke PUBLIC and anon grants.');
}

if (errors.length > 0) {
  console.error('Edge Function release contract failed:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Edge Function release contract passed for ${entries.length} entrypoints.`);
