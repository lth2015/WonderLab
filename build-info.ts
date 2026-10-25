import { execSync } from 'node:child_process';

// Which build this is, written into the app at build time (docs/验证路线图.md
// §4) by vite.config.ts, and into the tests by vitest.config.ts: the commit,
// and the experiment the build is for. A tester's log carries both, so data
// from different builds is never pooled by mistake.

export const EXPERIMENTS = ['dev', 'poc-r1', 'poc-gift-r1'] as const;

function commit(): string {
  if (process.env.WW_BUILD_SHA) return process.env.WW_BUILD_SHA;
  try {
    const sha = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    // Uncommitted changes: this build is not exactly the commit it names.
    const dirty = execSync('git status --porcelain --untracked-files=no', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

/** The `define` entry both configs use. Fails the build on an unknown experiment name. */
export function buildDefine(): { __BUILD__: string } {
  const experiment = process.env.WW_EXPERIMENT ?? 'dev';
  if (!(EXPERIMENTS as readonly string[]).includes(experiment)) {
    throw new Error(`WW_EXPERIMENT must be one of ${EXPERIMENTS.join(', ')}; got "${experiment}"`);
  }
  return { __BUILD__: JSON.stringify({ sha: commit(), experiment }) };
}
