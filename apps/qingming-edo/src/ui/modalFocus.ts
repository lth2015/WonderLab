import { useEffect } from 'react';

// 面板の焦点 (spec §17 キーボード; Codex review F03): while a panel is open, focus
// moves into it, Tab stays inside it, Escape closes it where closing is safe,
// and focus returns to whatever opened it. The panel is looked up on each key,
// because a panel can swap its contents (the journal's book and page views).
// a[href] only: a page picture's SVG <image href> must not count as a focus stop
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function currentPanel(): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>('.panel[role="dialog"]');
  return all.length ? all[all.length - 1] : null;
}
function focusables(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x instanceof HTMLElement && !x.hidden && x.getClientRects().length > 0);
}

/** `key` changes whenever a different panel opens; null when none is open. */
export function useModalFocus(key: string | null, onEscape: (() => void) | null): void {
  useEffect(() => {
    if (!key) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = () => {
      const el = currentPanel();
      if (!el) return;
      const f = focusables(el);
      if (f.length) f[0].focus({ preventScroll: true });
      else {
        el.tabIndex = -1;
        el.focus({ preventScroll: true });
      }
    };
    const t = setTimeout(first, 0); // after the panel has rendered
    const onKey = (e: KeyboardEvent) => {
      const el = currentPanel();
      if (!el) return;
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables(el);
      if (!f.length) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !el.contains(active)) {
        e.preventDefault();
        f[0].focus();
      } else if (e.shiftKey && active === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && active === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    // onEscape is read fresh through the key; a new panel means a new key
  }, [key]);
}
