import { useEffect, useRef, useState } from 'react';
import { Engine } from './engine/engine';

// Timings mirror docs/03-ux-ui-design.md §6.3.
const DEMO_IDLE_MS = 4000;
const DEMO_MAX = 2;
const DEMO_GAP_MS = 9000;
const HINT_MS = 6000;
const FISH_HINT_DELAY_MS = 2500;

type Hint = { text: string; key: number } | null;

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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState<Hint>(null);

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
    };
    const clearTimers = () => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };

    let drawn = false;
    let fishHintShown = false;
    let demos = 0;
    let hintKey = 0;
    const show = (text: string) => {
      const key = ++hintKey;
      setHint({ text, key });
      later(() => setHint((h) => (h?.key === key ? null : h)), HINT_MS);
    };

    const engine = new Engine(canvas, {
      onFirstStroke: () => {
        drawn = true;
        clearTimers();
        setHint(null);
      },
      onFishCreated: () => {
        if (fishHintShown) return;
        fishHintShown = true;
        later(() => show('点一点小鱼'), FISH_HINT_DELAY_MS);
      },
    });
    engine.start();
    requestAnimationFrame(() => setReady(true));

    const scheduleDemo = (ms: number) =>
      later(() => {
        if (drawn || demos >= DEMO_MAX) return;
        demos++;
        engine.playDemo();
        scheduleDemo(DEMO_GAP_MS);
      }, ms);
    later(() => show('在湖面上画一笔'), 600);
    scheduleDemo(DEMO_IDLE_MS);

    return () => {
      clearTimers();
      engine.dispose();
    };
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
      <canvas ref={canvasRef} className="world" aria-label="夜湖画布：在湖面上画一笔，线会化成游鱼" />
      <div className={`veil${ready ? ' gone' : ''}`} aria-hidden="true">
        <div className="drop" />
      </div>
      <p className={`hint${hint ? ' on' : ''}`} aria-live="polite">
        {hint?.text ?? ''}
      </p>
    </>
  );
}
