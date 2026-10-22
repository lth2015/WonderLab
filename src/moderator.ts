// Moderated tests (docs/02 §8). A link with ?mod is a moderator's link: it
// keeps ?mod across resets, and on a phone, where the Alt+Shift shortcuts
// cannot be typed, five quick taps in the top-left corner open the
// moderator panel (src/ModeratorPanel.tsx). Without ?mod none of this exists.

import { hasUnexported } from './telemetry';

export const moderatorMode = new URLSearchParams(location.search).has('mod');

/** The address for the next tester: a fresh world, keeping the tier and moderator mode. */
export function freshUrl(): string {
  const q = new URLSearchParams(location.search);
  const next = new URLSearchParams();
  next.set('fresh', '');
  const tier = q.get('tier');
  if (tier) next.set('tier', tier);
  if (q.has('mod')) next.set('mod', '');
  return `${location.pathname}?${next.toString().replace(/=(&|$)/g, '$1')}`;
}

let resetHandler: (() => void) | null = null;

/** The app registers how to reset (it must stop saving first). */
export function onReset(fn: (() => void) | null): void {
  resetHandler = fn;
}

/**
 * Reset for the next tester. The log lives only in memory, so a reset with
 * events not yet exported asks first rather than losing a session.
 */
export function resetForNext(): boolean {
  if (hasUnexported() && !window.confirm('这次的日志还没导出，重置后就没有了。仍然重置？')) return false;
  resetHandler?.();
  return true;
}
