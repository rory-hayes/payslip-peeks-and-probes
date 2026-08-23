import { describe, expect, it } from 'vitest';
import { getReleaseProvenance } from '../../vite-plugins/release-manifest';

const RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';

describe('release manifest provenance', () => {
  it('marks a Git revision as clean only when Git reports no working-tree changes', () => {
    const provenance = getReleaseProvenance(undefined, (args) => {
      if (args[0] === 'rev-parse') return RELEASE_SHA;
      if (args[0] === 'status') return '';
      throw new Error('unexpected Git command');
    });

    expect(provenance).toEqual({
      revision: RELEASE_SHA,
      revisionSource: 'git',
      worktree: 'clean',
    });
  });

  it('keeps a matching configured revision but surfaces an unclean artifact', () => {
    const provenance = getReleaseProvenance(RELEASE_SHA, (args) => {
      if (args[0] === 'rev-parse') return RELEASE_SHA;
      if (args[0] === 'status') return ' M src/pages/Dashboard.tsx';
      throw new Error('unexpected Git command');
    });

    expect(provenance).toEqual({
      revision: RELEASE_SHA,
      revisionSource: 'configured',
      worktree: 'dirty',
    });
  });

  it('rejects a configured revision that does not match the checked-out source', () => {
    expect(() => getReleaseProvenance('fedcba9876543210fedcba9876543210fedcba98', (args) => {
      if (args[0] === 'rev-parse') return RELEASE_SHA;
      throw new Error('status should not run after a provenance mismatch');
    })).toThrow(/does not match the checked-out Git revision/);
  });

  it('keeps an explicit archive revision visible when Git is unavailable', () => {
    const provenance = getReleaseProvenance(RELEASE_SHA, () => {
      throw new Error('Git is unavailable');
    });

    expect(provenance).toEqual({
      revision: RELEASE_SHA,
      revisionSource: 'configured',
      worktree: 'unknown',
    });
  });

  it('does not invent provenance when Git is unavailable', () => {
    const provenance = getReleaseProvenance(undefined, () => {
      throw new Error('Git is unavailable');
    });

    expect(provenance).toEqual({
      revision: 'unknown',
      revisionSource: 'unknown',
      worktree: 'unknown',
    });
  });

  it('rejects shortened, uppercase, and arbitrary configured revisions before build output exists', () => {
    for (const revision of ['short-sha', RELEASE_SHA.toUpperCase(), 'f'.repeat(39)]) {
      expect(() => getReleaseProvenance(revision, () => {
        throw new Error('Git should not be consulted for an invalid configured revision');
      })).toThrow(/full 40-character lowercase Git commit SHA/);
    }
  });
});
