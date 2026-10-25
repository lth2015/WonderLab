// Which build is running (docs/验证路线图.md §2). Written in at build time by
// vite.config.ts: the commit, the experiment the build is for, and how it
// reads a sentence. Every
// exported log carries it, so data from different builds is never pooled.

/** Version of the exported log format. 2: build info, field-build event store, study export. */
export const LOG_SCHEMA = 2;

export const BUILD = {
  sha: __BUILD__.sha,
  experiment: __BUILD__.experiment,
  /** How 一句成境 reads a sentence: experiment builds are always 'local' (build-info.ts). */
  scene: __BUILD__.scene,
  schema: LOG_SCHEMA,
} as const;

/** A build handed to testers outside the office: events are kept on the device until they choose to export them. */
export const FIELD_BUILD = BUILD.experiment !== 'dev';

/**
 * 送一条鱼 is part of the poc-gift-r1 build only, so no poc-r1 tester can
 * reach it; in development it stays behind ?giftlab.
 */
export function giftEnabled(params: URLSearchParams, dev = import.meta.env.DEV): boolean {
  return BUILD.experiment === 'poc-gift-r1' || (dev && params.has('giftlab'));
}
