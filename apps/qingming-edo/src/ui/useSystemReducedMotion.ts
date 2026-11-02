import { useSyncExternalStore } from 'react';

// The device's 「視差効果を減らす」 can change while the page is open: follow it, not
// only the value at load (Codex note, 2026-11-01).
const QUERY = '(prefers-reduced-motion: reduce)';
const media = () => (typeof matchMedia === 'function' ? matchMedia(QUERY) : null);

function subscribe(onChange: () => void): () => void {
  const m = media();
  if (!m) return () => {};
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
}
