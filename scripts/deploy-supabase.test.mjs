import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCKDOWN_MIGRATION,
  buildCommands,
  formatCommand,
  parseArgs,
  pendingKnownMigrationVersions,
  readProjectRef,
  validateProjectRef,
} from './deploy-supabase.mjs';

test('reads and validates the project ref from Supabase config', () => {
  assert.equal(readProjectRef('project_id = "shvivlhawhczbljzhvmr"\n'), 'shvivlhawhczbljzhvmr');
  assert.equal(validateProjectRef('shvivlhawhczbljzhvmr'), 'shvivlhawhczbljzhvmr');
  assert.throws(() => readProjectRef('project_id = ""\n'), /valid project_id/);
  assert.throws(() => validateProjectRef('not a ref'), /Invalid Supabase project ref/);
});

test('defaults to a non-mutating deployment plan and supports explicit function-only mode', () => {
  assert.deepEqual(parseArgs([]), {
    confirm: false,
    functionsOnly: false,
    help: false,
    phase: 'prepare',
    projectRef: null,
    publicUrl: null,
    revision: null,
  });
  assert.deepEqual(parseArgs(['--confirm', '--functions-only', '--project-ref', 'exampleproject']), {
    confirm: true,
    functionsOnly: true,
    help: false,
    phase: 'functions',
    projectRef: 'exampleproject',
    publicUrl: null,
    revision: null,
  });
  assert.throws(() => parseArgs(['--phase', 'everything']), /Invalid deployment phase/);
  assert.throws(
    () => parseArgs(['--functions-only', '--phase', 'lockdown']),
    /cannot be combined/,
  );

  const full = buildCommands({ projectRef: 'exampleproject', dbPassword: 'secret' });
  assert.equal(full.length, 3);
  assert.deepEqual(full[0].args.slice(0, 5), ['--yes', 'supabase', 'db', 'push', '--project-ref']);
  assert.ok(full[0].args.includes('--include-all'));
  assert.equal(full[0].deferMigration, LOCKDOWN_MIGRATION);
  assert.ok(full[1].args.includes('functions'));
  assert.equal(full[2].command, 'npm');

  const functionsOnly = buildCommands({ projectRef: 'exampleproject', phase: 'functions' });
  assert.equal(functionsOnly.length, 2);
  assert.ok(functionsOnly[0].args.includes('functions'));

  const lockdown = buildCommands({
    projectRef: 'exampleproject',
    dbPassword: 'secret',
    phase: 'lockdown',
    publicUrl: 'https://payslipinsights.com',
    revision: 'a'.repeat(40),
  });
  assert.equal(lockdown.length, 4);
  assert.ok(lockdown[0].args.includes('https://payslipinsights.com'));
  assert.ok(lockdown[0].args.includes('a'.repeat(40)));
  assert.deepEqual(lockdown[0].args.slice(-2), ['--scope', 'cutover']);
  assert.equal(lockdown[2].lockdownOnly, true);
});

test('redacts the database password from the printed command', () => {
  const command = buildCommands({ projectRef: 'exampleproject', dbPassword: 'secret' })[0];
  const formatted = formatCommand(command);
  assert.ok(!formatted.includes('secret'));
  assert.ok(formatted.includes('<redacted-db-password>'));
});

test('recognises only known pending migration versions from a CLI dry run', () => {
  const migrations = [
    '20260804114500_harden_payslip_upload_token_lifecycle.sql',
    LOCKDOWN_MIGRATION,
    'not-a-migration.txt',
  ];
  const output = `Would push migrations:\n • ${LOCKDOWN_MIGRATION}\n • 20990101000000_unknown.sql\n`;

  assert.deepEqual(pendingKnownMigrationVersions(output, migrations), ['20260804115000']);
});
