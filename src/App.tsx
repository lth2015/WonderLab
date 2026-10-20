import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, type Creation, type CreationKind } from './engine/engine';

// Timings mirror docs/03-ux-ui-design.md §6.3 and docs/02 §3.
const DEMO_IDLE_MS = 4000;
const DEMO_MAX = 2;
const DEMO_GAP_MS = 9000;
const HINT_MS = 6000;
const FISH_HINT_DELAY_MS = 2500;
const MOON_HINT_TIMEOUT_MS = 60000;
const UNDO_BUTTON_MS = 4000;

type HintPlace = 'lake' | 'sky';
type Hint = { text: string; place: HintPlace; key: number } | null;
type UndoButton = { x: number; y: number; key: number } | null;

const ANNOUNCE: Record<CreationKind, string> = {
  fish: '一条小鱼游入湖中',
  moon: '月亮升上夜空',
  star: '天上多了一颗星',
  meteor: '一颗流星划过',
  cloud: '一缕流云飘过',
};

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState<Hint>(null);
  const [undoBtn, setUndoBtn] = useState<UndoButton>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!hasWebGL()) {
      setFailed(true);
      return;
    }
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };
    const cancel = (id: number) => {
      clearTimeout(id);
      timers.delete(id);
    };

    let drawn = false;
    let demos = 0;
    let hintKey = 0;
    let undoKey = 0;
    let undoTimer = 0;
    let demoTimer = 0;
    let fishCount = 0;
    let fishHint = false;
    let moonHint = false;
    let hasMoon = false;

    const show = (text: string, place: HintPlace) => {
      const key = ++hintKey;
      setHint({ text, place, key });
      later(() => setHint((h) => (h?.key === key ? null : h)), HINT_MS);
    };
    const showMoonHint = () => {
      if (moonHint || hasMoon) return;
      moonHint = true;
      show('在天上画一个圆', 'sky');
    };

    const engine = new Engine(canvas, {
      onFirstStroke: () => {
        drawn = true;
        cancel(demoTimer);
        setHint(null);
      },
      onFishCreated: (count) => {
        fishCount = count;
        if (!fishHint) {
          fishHint = true;
          later(() => show('点一点小鱼', 'lake'), FISH_HINT_DELAY_MS);
        } else if (fishCount >= 2) later(showMoonHint, FISH_HINT_DELAY_MS);
      },
      onFishTouched: () => later(showMoonHint, 1500),
      onCreated: (c: Creation) => {
        if (c.kind === 'moon') hasMoon = true;
        setAnnounce(ANNOUNCE[c.kind]);
        const key = ++undoKey;
        setUndoBtn({ x: c.x, y: c.y, key });
        cancel(undoTimer);
        undoTimer = later(() => setUndoBtn((b) => (b?.key === key ? null : b)), UNDO_BUTTON_MS);
      },
      onUndo: () => {
        setUndoBtn(null);
        setAnnounce('已撤销');
      },
    });
    engineRef.current = engine;
    engine.start();
    requestAnimationFrame(() => setReady(true));

    const scheduleDemo = (ms: number) => {
      demoTimer = later(() => {
        if (drawn || demos >= DEMO_MAX) return;
        demos++;
        engine.playDemo();
        scheduleDemo(DEMO_GAP_MS);
      }, ms);
    };
    later(() => show('在湖面上画一笔', 'lake'), 600);
    scheduleDemo(DEMO_IDLE_MS);
    later(showMoonHint, MOON_HINT_TIMEOUT_MS);

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        engine.undo();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      for (const id of timers) clearTimeout(id);
      window.removeEventListener('keydown', onKey);
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

  const undo = useCallback(() => {
    engineRef.current?.undo();
  }, []);

  if (failed) {
    return (
      <div className="fallback" role="alert">
        <p>这里本该有一片会呼吸的夜湖。</p>
        <p className="sub">你的浏览器暂时无法显示它，请换用最新版 Chrome、Safari 或 Edge 打开。</p>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="world" role="img" aria-label="夜湖画布：在湖面上画一笔，线会化成游鱼" />
      <div className={`veil${ready ? ' gone' : ''}`} aria-hidden="true">
        <div className="drop" />
      </div>
      <p className={`hint ${hint?.place ?? 'lake'}${hint ? ' on' : ''}`} aria-live="polite">
        {hint?.text ?? ''}
      </p>
      {undoBtn && (
        <button
          key={undoBtn.key}
          type="button"
          className="undo"
          aria-label="撤销这次创造"
          title="墨散（撤销）"
          style={{
            left: `clamp(8px, ${undoBtn.x + 18}px, calc(100% - 52px))`,
            top: `clamp(8px, ${undoBtn.y - 22}px, calc(100% - 52px))`,
          }}
          onClick={undo}
        >
          <span className="undo-dot" />
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}
