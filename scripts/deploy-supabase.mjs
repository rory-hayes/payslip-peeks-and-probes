import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const ROOT = process.cwd();
const SUPABASE_CONFIG_PATH = resolve(ROOT, 'supabase/config.toml');

function readOption(argv, name) {
  const prefix = `--${name}=`;
  const inline = argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = argv.indexOf(`--${name}`);
  return index === -1 ? null : argv[index + 1] ?? null;
}

export function parseArgs(argv) {
  return {
    confirm: argv.includes('--confirm'),
    functionsOnly: argv.includes('--functions-only'),
    help: argv.includes('--help') || argv.includes('-h'),
    projectRef: readOption(argv, 'project-ref'),
  };
}

export function readProjectRef(configText) {
  const match = configText.match(/^project_id\s*=\s*"([a-z0-9]+)"\s*$/m);
  if (!match) throw new Error('supabase/config.toml does not contain a valid project_id.');
  return match[1];
}

export function validateProjectRef(projectRef) {
  if (!/^[a-z0-9]{10,32}$/.test(projectRef)) {
    throw new Error(`Invalid Supabase project ref: ${projectRef}`);
  }
  return projectRef;
}

export function buildCommands({ projectRef, dbPassword, functionsOnly = false }) {
  const commands = [];

  if (!functionsOnly) {
    commands.push({
      label: 'Apply reviewed Supabase migrations',
      command: 'npx',
      args: [
        '--yes',
        'supabase',
        'db',
        'push',
        '--project-ref',
        projectRef,
        '--password',
        dbPassword ?? '<SUPABASE_DB_PASSWORD>',
        '--yes',
      ],
    });
  }

  commands.push({
    label: functionsOnly
      ? 'Deploy all local Supabase Edge Functions'
      : 'Deploy all local Supabase Edge Functions from the same revision',
    command: 'npx',
    args: [
      '--yes',
      'supabase',
      'functions',
      'deploy',
      '--project-ref',
      projectRef,
      '--use-api',
      '--yes',
    ],
  });

  commands.push({
    label: 'Verify every required function route',
    command: 'npm',
    args: ['run', 'verify:supabase-deployment'],
  });

  return commands;
}

export function formatCommand({ command, args }) {
  const safeArgs = [...args];
  const passwordIndex = safeArgs.indexOf('--password');
  if (passwordIndex !== -1 && safeArgs[passwordIndex + 1]) {
    safeArgs[passwordIndex + 1] = '<redacted-db-password>';
  }
  return [command, ...safeArgs].join(' ');
}

function assertCleanWorktree() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Could not inspect the git worktree.');
  if (result.stdout.trim()) {
    throw new Error('The worktree must be clean before a Supabase deployment. Commit or stash local changes first.');
  }
}

function runCommand({ command, args }) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${formatCommand({ command, args })} exited with status ${result.status ?? 'unknown'}.`);
  }
}

function printHelp() {
  console.log(`
Deploy the reviewed Payslip Insights Supabase revision.

This command is a dry-run unless --confirm is supplied. It never uses --prune,
never resets the database, and never prints the database password.

Usage:
  npm run deploy:supabase
  npm run deploy:supabase -- --confirm
  npm run deploy:supabase -- --functions-only --confirm

Before a confirmed migration deployment:
  1. Log the Supabase CLI into the account that owns the intended project.
  2. Set SUPABASE_DB_PASSWORD in the local shell without committing it.
  3. Keep the worktree clean and confirm the target ref in supabase/config.toml.

--project-ref <ref>  Override the ref in supabase/config.toml.
--functions-only     Skip migrations; this does not make the release ready.
--confirm            Execute the deployment instead of only printing the plan.
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const projectRef = validateProjectRef(
    options.projectRef ?? readProjectRef(readFileSync(SUPABASE_CONFIG_PATH, 'utf8')),
  );
  const productionEnv = loadEnv('production', ROOT, '');
  const configuredProjectRef = (process.env.VITE_SUPABASE_PROJECT_ID ?? productionEnv.VITE_SUPABASE_PROJECT_ID ?? '').trim();
  if (configuredProjectRef && configuredProjectRef !== projectRef) {
    throw new Error(`Target ref ${projectRef} does not match VITE_SUPABASE_PROJECT_ID.`);
  }

  const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim() || null;
  if (options.confirm && !options.functionsOnly && !dbPassword) {
    throw new Error('Set SUPABASE_DB_PASSWORD in the local shell before applying migrations. The password is never read from source files.');
  }

  const commands = buildCommands({ projectRef, dbPassword, functionsOnly: options.functionsOnly });
  console.log(`\nPayslip Insights Supabase deployment plan (${projectRef})\n`);
  commands.forEach(({ label, command, args }) => {
    console.log(`- ${label}`);
    console.log(`  ${formatCommand({ command, args })}`);
  });

  if (!options.confirm) {
    console.log('\nDry-run only. Re-run with --confirm after reviewing the target project and credentials.');
    return;
  }

  assertCleanWorktree();
  for (const command of commands) runCommand(command);
  console.log('\nSupabase deployment and route verification completed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
