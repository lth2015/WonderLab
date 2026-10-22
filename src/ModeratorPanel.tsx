import { useEffect, useRef, useState } from 'react';
import { moderatorMode, resetForNext } from './moderator';
import { currentPhase, exportLog, togglePhase } from './telemetry';

// The moderator panel (docs/02 §8): switch the test phase, export the log,
// reset for the next tester. Opened by five quick taps in the top-left
// corner, only on a ?mod link. Those taps never reach the canvas, so they
// leave nothing in the tester's log.

const CORNER_PX = 64;
const TAPS = 5;
const WITHIN_MS = 2500;

export function ModeratorPanel() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(currentPhase);
  const [status, setStatus] = useState('');
  const taps = useRef<number[]>([]);
  const openedAt = useRef(0);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moderatorMode) return;
    const onDown = (e: PointerEvent) => {
      if (e.clientX > CORNER_PX || e.clientY > CORNER_PX) return;
      if ((e.target as Element).closest?.('.sheet')) return;
      e.stopPropagation();
      e.preventDefault();
      const now = performance.now();
      taps.current = [...taps.current.filter((t) => now - t < WITHIN_MS), now];
      if (taps.current.length >= TAPS) {
        taps.current = [];
        setPhase(currentPhase());
        setStatus('');
        openedAt.current = now;
        setOpen(true);
      }
    };
    window.addEventListener('pointerdown', onDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!moderatorMode || !open) return null;

  const switchPhase = () => {
    const next = togglePhase();
    setPhase(next);
    // Starting the free phase is the moment to hand over and leave: close at once.
    if (next === 'free') setOpen(false);
    else setStatus('已回到引导段');
  };
  const doExport = async () => {
    const how = await exportLog();
    setStatus(how === 'cancelled' ? '没有导出' : '日志已导出');
  };

  return (
    <>
      {/* The fifth tap's own click lands here a moment after opening; ignore it. */}
      <div className="scrim" onClick={() => performance.now() - openedAt.current > 600 && setOpen(false)} />
      <div className="sheet moderator" role="dialog" aria-modal="true" aria-labelledby="moderator-title">
        <h2 id="moderator-title">主持人</h2>
        <p className="note">当前：{phase === 'free' ? '自由段' : '引导段'}</p>
        <div className="stack">
          <button ref={first} type="button" className="text-btn primary" onClick={switchPhase}>
            {phase === 'free' ? '回到引导段' : '开始自由段'}
          </button>
          <button type="button" className="text-btn" onClick={() => void doExport()}>
            导出日志
          </button>
          <button type="button" className="text-btn" onClick={() => resetForNext()}>
            换下一位（重置）
          </button>
          <button type="button" className="link-btn" onClick={() => setOpen(false)}>
            关闭
          </button>
        </div>
        {status && (
          <p className="note" role="status">
            {status}
          </p>
        )}
      </div>
    </>
  );
}
