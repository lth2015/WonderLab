import { useEffect, type RefObject } from 'react';

// A sheet that opens from a choice (少し話す, 一服, 題箋) replaces the dialogue the focus was
// in, so the focus falls to the page. Whenever its content changes, if the focus is not
// inside the sheet, put it on the sheet's first thing to do (spec §7 キーボード).
export function useSheetFocus(ref: RefObject<HTMLElement | null>, deps: unknown[]): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || el.contains(document.activeElement)) return;
    // the first thing to do, not a 難語 note inside the words
    const first =
      el.querySelector<HTMLElement>('.choices button:not([disabled]), .slips button:not([disabled]), button.primary:not([disabled])') ??
      el.querySelector<HTMLElement>('button:not(.term):not([disabled])');
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
