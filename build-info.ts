import { execSync } from 'node:child_process';

// Which build this is, written into the app at build time (docs/验证路线图.md
// §4) by vite.config.ts, and into the tests by vitest.config.ts: the commit,
// and the experiment the build is for. A tester's log carries both, so data
// from different builds is never pooled by mistake.

export const EXPERIMENTS = ['dev', 'poc-r1', 'poc-gift-r1'] as const;
export const SCENE_MODES = ['local', 'ai'] as const;

/**
 * How 一句成境 reads a sentence. Every experiment build is local rules only,
 * fixed here rather than by a runtime fallback, so no tester's words ever go
 * to /api/scene and all of them meet the same world (docs/验证路线图.md §2).
 * Development keeps the invited AI unless WW_SCENE=local.
 */
export function sceneModeFor(experiment: string, requested: string | undefined): (typeof SCENE_MODES)[number] {
  if (requested !== undefined && !(SCENE_MODES as readonly string[]).includes(requested)) {
    throw new Error(`WW_SCENE must be one of ${SCENE_MODES.join(', ')}; got "${requested}"`);
  }
  if (experiment !== 'dev') {
    if (requested === 'ai') throw new Error(`the ${experiment} build is local rules only (docs/验证路线图.md §2); WW_SCENE=ai is not allowed`);
    return 'local';
  }
  return requested === 'local' ? 'local' : 'ai';
}

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
  return { __BUILD__: JSON.stringify({ sha: commit(), experiment, scene: sceneModeFor(experiment, process.env.WW_SCENE) }) };
}
