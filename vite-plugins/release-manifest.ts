import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

type GitRunner = (args: string[]) => string;
const FULL_GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export interface ReleaseProvenance {
  revision: string;
  revisionSource: 'configured' | 'git' | 'unknown';
  worktree: 'clean' | 'dirty' | 'unknown';
}

function runGit(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/**
 * Records whether a release artifact was built from the reviewed Git state.
 * This is intentionally provenance only: it contains no configuration or
 * customer data and it cannot substitute for the paid-launch preflight.
 */
export function getReleaseProvenance(
  configuredRevision = process.env.VITE_RELEASE_SHA,
  gitRunner: GitRunner = runGit,
): ReleaseProvenance {
  const configured = configuredRevision?.trim();
  if (configured && !FULL_GIT_SHA_PATTERN.test(configured)) {
    throw new Error('VITE_RELEASE_SHA must be the full 40-character lowercase Git commit SHA.');
  }

  let gitRevision: string | null = null;

  try {
    const candidate = gitRunner(['rev-parse', 'HEAD']);
    gitRevision = candidate || null;
  } catch {
    // A build created from an exported source archive can still identify its
    // source with VITE_RELEASE_SHA. Its worktree state remains unknown.
  }

  if (gitRevision && !FULL_GIT_SHA_PATTERN.test(gitRevision)) {
    throw new Error('Git did not return a full 40-character lowercase commit SHA.');
  }

  if (configured && gitRevision && configured !== gitRevision) {
    throw new Error(
      `VITE_RELEASE_SHA (${configured}) does not match the checked-out Git revision (${gitRevision}).`,
    );
  }

  const revision = configured || gitRevision || 'unknown';
  const revisionSource: ReleaseProvenance['revisionSource'] = configured
    ? 'configured'
    : gitRevision
      ? 'git'
      : 'unknown';

  try {
    return {
      revision,
      revisionSource,
      worktree: gitRunner(['status', '--porcelain']) ? 'dirty' : 'clean',
    };
  } catch {
    return { revision, revisionSource, worktree: 'unknown' };
  }
}

/**
 * Emits a non-secret artifact that lets a deploy check prove which reviewed
 * source revision is actually being served. It deliberately contains no
 * configuration values, account data, or credentials.
 */
export function releaseManifest(mode: string, configuredRevision?: string): Plugin {
  const provenance = getReleaseProvenance(configuredRevision);
  const builtAt = new Date().toISOString();

  return {
    name: 'release-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'release.json',
        source: JSON.stringify({
          builtAt,
          mode,
          ...provenance,
          schemaVersion: 2,
          surface: 'web',
        }, null, 2),
      });
    },
  };
}
