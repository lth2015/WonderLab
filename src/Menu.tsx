import { useEffect, useRef, useState } from 'react';

// The 更多 menu and the About panel (docs/03 §5.1, §5.4).

interface MenuProps {
  canUndo: () => boolean;
  onUndo: () => void;
  onRestart: () => void;
  onAccount: () => void;
  onWallpaper: () => void;
  dim: boolean;
}

export function Menu({ canUndo, onUndo, onRestart, onAccount, onWallpaper, dim }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const [undoable, setUndoable] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <div className={`chrome${dim ? ' dim' : ''}`}>
        <button
          ref={trigger}
          type="button"
          className="icon-btn"
          aria-label="更多"
          aria-haspopup="menu"
          aria-expanded={open}
          title="更多"
          onClick={() => {
            setUndoable(canUndo());
            setOpen((o) => !o);
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>
      {open && (
        <>
          <div className="scrim clear" onClick={close} />
          <div className="menu" role="menu" aria-label="更多">
            <button ref={undoable ? first : undefined} type="button" role="menuitem" disabled={!undoable} onClick={pick(onUndo)}>
              撤销
            </button>
            <button ref={undoable ? undefined : first} type="button" role="menuitem" onClick={pick(onRestart)}>
              重新开始
            </button>
            <button type="button" role="menuitem" onClick={pick(onWallpaper)}>
              保存为壁纸
            </button>
            <button type="button" role="menuitem" onClick={pick(onAccount)}>
              账户
            </button>
            <button type="button" role="menuitem" onClick={pick(() => setAbout(true))}>
              关于
            </button>
          </div>
        </>
      )}
      {about && <About onClose={() => { setAbout(false); trigger.current?.focus(); }} />}
    </>
  );
}

function About({ onClose }: { onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <h2 id="about-title">万象生 · WonderLab</h2>
        <p className="motto">一念起，万象生</p>
        <ul>
          <li>在湖面上画一笔，线会化成游鱼</li>
          <li>画一个圆，月亮升起</li>
          <li>在天上随手一点、一划，是星与流星</li>
          <li>写一句话，世界会听见</li>
        </ul>
        <p className="keys">
          画布获得焦点时：<kbd>F</kbd> 画一条鱼，<kbd>M</kbd> 生一轮月，<kbd>Enter</kbd> 点一下湖面。<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Z</kbd> 撤销。
        </p>
        <p className="note">你画的内容只留在这台设备上。</p>
        <button ref={closeBtn} type="button" className="text-btn" onClick={onClose}>
          回到湖边
        </button>
      </div>
    </>
  );
}
