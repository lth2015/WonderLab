import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/engine';
import { hasWebGL } from './webgl';

// Timings mirror docs/03-ux-ui-design.md §6.3.
const DEMO_IDLE_MS = 4000;
const DEMO_REPEAT_MS = 9000;
const DEMO_MAX = 2;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported] = useState(hasWebGL);
  const [ready, setReady] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!supported || !canvas) return;

    let demos = 0;
    let timer = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const engine = new Engine(canvas, {
      onFirstStroke: () => {
        window.clearTimeout(timer);
        setDrawn(true);
      },
      onFishCreated: (count) => setAnnounce(count === 1 ? '一条小鱼游入湖中' : `湖里有 ${count} 条小鱼`),
    });

    const scheduleDemo = (delay: number) => {
      if (reducedMotion) return;
      timer = window.setTimeout(() => {
        engine.playDemo();
        if (++demos < DEMO_MAX) scheduleDemo(DEMO_REPEAT_MS);
      }, delay);
    };

    engine.start();
    // Let the first frame land before dissolving the loading ink.
    const raf = requestAnimationFrame(() => setReady(true));
    scheduleDemo(DEMO_IDLE_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      engine.dispose();
    };
  }, [supported]);

  useEffect(() => {
    if (!ready) return;
    document.getElementById('loader')?.classList.add('done');
  }, [ready]);

  if (!supported) {
    document.getElementById('loader')?.classList.add('done');
    return (
      <main className="fallback">
        <p className="fallback-title">这片湖需要 WebGL 才能流动</p>
        <p className="fallback-body">请用最新版 Chrome、Safari 或 Edge 打开</p>
      </main>
    );
  }

  return (
    <main className="stage">
      <canvas
        ref={canvasRef}
        className="world"
        tabIndex={0}
        role="img"
        aria-label="夜晚的湖面，远山静立"
      />
      <p className={`hint${ready && !drawn ? ' show' : ''}`} aria-hidden={drawn}>
        在湖面上画一笔
      </p>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </main>
  );
}
