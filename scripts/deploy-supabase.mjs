import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const ROOT = process.cwd();
const SUPABASE_CONFIG_PATH = resolve(ROOT, 'supabase/config.toml');
const MIGRATIONS_DIRECTORY = resolve(ROOT, 'supabase/migrations');
export const LOCKDOWN_MIGRATION = '20260804115000_lock_down_direct_payslip_storage.sql';
const LOCKDOWN_VERSION = LOCKDOWN_MIGRATION.slice(0, 14);
const PHASES = new Set(['prepare', 'functions', 'lockdown']);

function readOption(argv, name) {
  const prefix = `--${name}=`;
  const inline = argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = argv.indexOf(`--${name}`);
  return index === -1 ? null : argv[index + 1] ?? null;
}

export function parseArgs(argv) {
  const functionsOnly = argv.includes('--functions-only');
  const explicitPhase = readOption(argv, 'phase');
  if (functionsOnly && explicitPhase && explicitPhase !== 'functions') {
    throw new Error('--functions-only cannot be combined with a non-functions --phase.');
  }

  const phase = functionsOnly ? 'functions' : explicitPhase ?? 'prepare';
  if (!PHASES.has(phase)) {
    throw new Error(`Invalid deployment phase: ${phase}. Use prepare, functions, or lockdown.`);
  }

  return {
    confirm: argv.includes('--confirm'),
    functionsOnly,
    help: argv.includes('--help') || argv.includes('-h'),
    phase,
    projectRef: readOption(argv, 'project-ref'),
    publicUrl: readOption(argv, 'public-url'),
    revision: readOption(argv, 'revision'),
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

function databasePushCommand({ projectRef, dbPassword, label, ...metadata }) {
  return {
    label,
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
      '--include-all',
      '--yes',
    ],
    ...metadata,
  };
}

function functionsCommand(projectRef) {
  return {
    label: 'Deploy all local Supabase Edge Functions from the same revision',
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
  };
}

function routeVerificationCommand(label = 'Verify every required function route') {
  return {
    label,
    command: 'npm',
    args: ['run', 'verify:supabase-deployment'],
  };
}

export function buildCommands({
  projectRef,
  dbPassword,
  phase = 'prepare',
  publicUrl = '<PUBLIC_WEB_URL>',
  revision = '<FULL_RELEASE_SHA>',
  functionsOnly = false,
}) {
  const selectedPhase = functionsOnly ? 'functions' : phase;
  if (!PHASES.has(selectedPhase)) throw new Error(`Invalid deployment phase: ${selectedPhase}.`);

  if (selectedPhase === 'prepare') {
    return [
      databasePushCommand({
        projectRef,
        dbPassword,
        label: 'Apply every reviewed migration except the final direct-storage lock',
        deferMigration: LOCKDOWN_MIGRATION,
      }),
      functionsCommand(projectRef),
      routeVerificationCommand(),
    ];
  }

  if (selectedPhase === 'lockdown') {
    return [
      {
        label: 'Verify the exact new web client is live before removing the legacy upload path',
        command: 'npm',
        args: [
          'run',
          'release:web:verify-public',
          '--',
          '--url',
          publicUrl,
          '--revision',
          revision,
          '--scope',
          'cutover',
        ],
      },
      routeVerificationCommand('Verify the secure upload and account routes before lock-down'),
      databasePushCommand({
        projectRef,
        dbPassword,
        label: 'Apply only the final direct-storage lock migration',
        lockdownOnly: true,
      }),
      routeVerificationCommand('Verify every required function route after lock-down'),
    ];
  }

  return [functionsCommand(projectRef), routeVerificationCommand()];
}

export function pendingKnownMigrationVersions(output, migrationNames) {
  return migrationNames
    .map((name) => name.match(/^(\d{14})_.*\.sql$/)?.[1] ?? null)
    .filter((version) => version && output.includes(version));
}

function validateLockdownInputs(publicUrl, revision) {
  if (!/^[0-9a-f]{40}$/.test(revision ?? '')) {
    throw new Error('The lockdown phase requires --revision with the full lowercase release SHA.');
  }

  try {
    const parsed = new URL(publicUrl);
    if (
      parsed.protocol !== 'https:'
      || !parsed.hostname
      || parsed.username
      || parsed.password
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('The lockdown phase requires --public-url with an HTTPS site origin.');
  }
}

function withDeferredMigration(migrationName, callback) {
  const migrationPath = resolve(MIGRATIONS_DIRECTORY, migrationName);
  const deferredPath = `${migrationPath}.release-deferred`;
  if (!existsSync(migrationPath)) throw new Error(`Missing staged migration: ${migrationName}`);
  if (existsSync(deferredPath)) throw new Error(`Stale deferred migration found: ${deferredPath}`);

  renameSync(migrationPath, deferredPath);
  try {
    return callback();
  } finally {
    renameSync(deferredPath, migrationPath);
  }
}

function migrationNames() {
  return readdirSync(MIGRATIONS_DIRECTORY)
    .filter((name) => /^\d{14}_.*\.sql$/.test(name))
    .sort();
}

function runCaptured(command, extraArgs = []) {
  const result = spawnSync(command.command, [...command.args, ...extraArgs], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(`${formatCommand(command)} exited with status ${result.status ?? 'unknown'}.\n${output}`);
  }
  return output;
}

function runMigrationCommand(command) {
  const execute = () => {
    const dryRunOutput = runCaptured(command, ['--dry-run']);
    process.stdout.write(dryRunOutput);

    if (command.deferMigration && dryRunOutput.includes(LOCKDOWN_VERSION)) {
      throw new Error('The prepare phase attempted to include the final storage lock.');
    }

    if (command.lockdownOnly) {
      const pending = pendingKnownMigrationVersions(dryRunOutput, migrationNames());
      if (pending.length !== 1 || pending[0] !== LOCKDOWN_VERSION) {
        throw new Error(
          `Refusing lock-down: expected only ${LOCKDOWN_VERSION} to be pending, found ${pending.join(', ') || 'none'}.`,
        );
      }
    }

    runCommand(command);
  };

  if (command.deferMigration) {
    withDeferredMigration(command.deferMigration, execute);
  } else {
    execute();
  }
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
  npm run deploy:supabase -- --phase prepare --confirm
  npm run deploy:supabase -- --phase functions --confirm
  npm run deploy:supabase -- --phase lockdown --public-url https://payslipinsights.com --revision <full-sha> --confirm

Before a confirmed migration deployment:
  1. Log the Supabase CLI into the account that owns the intended project.
  2. Set SUPABASE_DB_PASSWORD in the local shell without committing it.
  3. Keep the worktree clean and confirm the target ref in supabase/config.toml.

--phase prepare       Apply all schema except the final browser-storage lock, then deploy functions (default).
--phase functions     Redeploy and verify functions without applying migrations.
--phase lockdown      Verify the exact public client, then apply only the deferred final lock.
--public-url <url>    Required for lock-down; the exact HTTPS site origin to verify.
--revision <sha>      Required for lock-down; the full reviewed public release SHA.
--project-ref <ref>   Override the ref in supabase/config.toml.
--functions-only      Compatibility alias for --phase functions.
--confirm             Execute the deployment instead of only printing the plan.
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
  if (options.phase === 'lockdown') {
    validateLockdownInputs(options.publicUrl, options.revision);
  }
  if (options.confirm && options.phase !== 'functions' && !dbPassword) {
    throw new Error('Set SUPABASE_DB_PASSWORD in the local shell before applying migrations. The password is never read from source files.');
  }

  const commands = buildCommands({
    projectRef,
    dbPassword,
    phase: options.phase,
    functionsOnly: options.functionsOnly,
    publicUrl: options.publicUrl ?? undefined,
    revision: options.revision ?? undefined,
  });
  console.log(`\nPayslip Insights Supabase ${options.phase} deployment plan (${projectRef})\n`);
  commands.forEach(({ label, command, args }) => {
    console.log(`- ${label}`);
    console.log(`  ${formatCommand({ command, args })}`);
  });

  if (!options.confirm) {
    console.log('\nDry-run only. Re-run with --confirm after reviewing the target project and credentials.');
    return;
  }

  assertCleanWorktree();
  for (const command of commands) {
    if (command.deferMigration || command.lockdownOnly) runMigrationCommand(command);
    else runCommand(command);
  }

  if (options.phase === 'prepare') {
    console.log('\nPre-lockdown schema and functions are deployed. Publish and verify the new client before running --phase lockdown.');
  } else if (options.phase === 'lockdown') {
    console.log('\nThe exact public client was verified and the final direct-storage lock was applied.');
  } else {
    console.log('\nSupabase functions and route verification completed.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
