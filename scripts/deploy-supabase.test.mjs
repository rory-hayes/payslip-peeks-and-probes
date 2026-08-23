import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommands,
  formatCommand,
  parseArgs,
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
    projectRef: null,
  });
  assert.deepEqual(parseArgs(['--confirm', '--functions-only', '--project-ref', 'exampleproject']), {
    confirm: true,
    functionsOnly: true,
    help: false,
    projectRef: 'exampleproject',
  });

  const full = buildCommands({ projectRef: 'exampleproject', dbPassword: 'secret' });
  assert.equal(full.length, 3);
  assert.deepEqual(full[0].args.slice(0, 5), ['--yes', 'supabase', 'db', 'push', '--project-ref']);
  assert.ok(full[1].args.includes('functions'));
  assert.equal(full[2].command, 'npm');

  const functionsOnly = buildCommands({ projectRef: 'exampleproject', functionsOnly: true });
  assert.equal(functionsOnly.length, 2);
  assert.ok(functionsOnly[0].args.includes('functions'));
});

test('redacts the database password from the printed command', () => {
  const command = buildCommands({ projectRef: 'exampleproject', dbPassword: 'secret' })[0];
  const formatted = formatCommand(command);
  assert.ok(!formatted.includes('secret'));
  assert.ok(formatted.includes('<redacted-db-password>'));
});
