import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const functionsRoot = path.resolve('supabase/functions');
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

if (errors.length > 0) {
  console.error('Edge Function release contract failed:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Edge Function release contract passed for ${entries.length} entrypoints.`);
