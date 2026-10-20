import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Engine, type Creation, type CreationKind } from './engine/engine';
import { interpret, type SceneCommand } from './engine/intent';

// Timings mirror docs/03-ux-ui-design.md §6.3 and docs/02 §3.
const DEMO_IDLE_MS = 4000;
const DEMO_MAX = 2;
const DEMO_GAP_MS = 9000;
const HINT_MS = 6000;
const FISH_HINT_DELAY_MS = 2500;
const MOON_HINT_TIMEOUT_MS = 60000;
const WORDS_HINT_TIMEOUT_MS = 90000;
const UNDO_BUTTON_MS = 4000;
const CHROME_RESTORE_MS = 1200;
const MAX_CHARS = 50;
const COUNT_FROM = 40;
const PLACEHOLDERS = ['今夜下一场小雨', '我想念夏天', '让世界安静下来'];

type HintPlace = 'lake' | 'sky' | 'words';
type Hint = { text: string; place: HintPlace; key: number } | null;
type UndoButton = { id: number; x: number; y: number } | null;
type Flight = { key: number; chars: { ch: string; dx: number; delay: number }[]; x: number; y: number };

const ANNOUNCE: Record<Exclude<CreationKind, 'atmosphere'>, string> = {
  fish: '一条小鱼游入湖中',
  moon: '月亮升上夜空',
  star: '天上多了一颗星',
  meteor: '一颗流星划过',
  cloud: '一缕流云飘过',
};

function describe(cmd: SceneCommand): string {
  const parts: string[] = [];
  if (cmd.weather === 'rain') parts.push('下起了小雨');
  if (cmd.weather === 'mist') parts.push('湖上起了雾');
  if (cmd.weather === 'fireflies') parts.push('萤火飞了起来');
  if (cmd.weather === 'clear') parts.push('天色放晴');
  if (cmd.timeOfDay === 'dusk') parts.push('天色转为黄昏');
  if (cmd.timeOfDay === 'night') parts.push('夜色深了');
  if (cmd.palette === 'warm') parts.push('世界变得温暖');
  if (cmd.palette === 'melancholy') parts.push('世界变得清冷');
  if (cmd.palette === 'serene') parts.push('世界安静下来');
  return parts.join('，') || '世界听见了';
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const coarse = () => window.matchMedia('(pointer: coarse)').matches;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const wordsUsedRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState<Hint>(null);
  const [undoBtn, setUndoBtn] = useState<UndoButton>(null);
  const [announce, setAnnounce] = useState('');
  const [text, setText] = useState('');
  const [placeholder, setPlaceholder] = useState(0);
  const [dim, setDim] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);

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
    let drawing = false;
    let demos = 0;
    let hintKey = 0;
    let undoTimer = 0;
    let demoTimer = 0;
    let chromeTimer = 0;
    let fishHint = false;
    const shownHints = new Set<string>();
    let pendingHint: { text: string; place: HintPlace } | null = null;
    let hasMoon = false;
    let wordsUsed = false;

    // Hints only appear between strokes; one that arrives mid-stroke waits.
    const show = (text: string, place: HintPlace) => {
      if (drawing) {
        pendingHint = { text, place };
        return;
      }
      const key = ++hintKey;
      setHint({ text, place, key });
      later(() => setHint((h) => (h?.key === key ? null : h)), HINT_MS);
    };
    const once = (text: string, place: HintPlace, when: () => boolean = () => true) => {
      if (shownHints.has(text) || !when()) return;
      shownHints.add(text);
      show(text, place);
    };
    const moonHint = () => once('在天上画一个圆', 'sky', () => !hasMoon);
    const wordsHint = () => once('写一句话，世界会听见', 'words', () => !wordsUsed);
    wordsUsedRef.current = () => {
      wordsUsed = true;
      setHint((h) => (h?.place === 'words' ? null : h));
    };

    const engine = new Engine(canvas, {
      onFirstStroke: () => {
        drawn = true;
        cancel(demoTimer);
        setHint(null);
      },
      onFishCreated: (count) => {
        if (!fishHint) {
          fishHint = true;
          later(() => once('点一点小鱼', 'lake'), FISH_HINT_DELAY_MS);
        } else if (count >= 2) later(moonHint, FISH_HINT_DELAY_MS);
      },
      onFishTouched: () => later(moonHint, 1500),
      onCreated: (c: Creation) => {
        if (c.kind === 'atmosphere') return;
        if (c.kind === 'moon' && !hasMoon) {
          hasMoon = true;
          later(wordsHint, FISH_HINT_DELAY_MS);
        }
        setAnnounce(ANNOUNCE[c.kind]);
        setUndoBtn({ id: c.id, x: c.x, y: c.y });
        cancel(undoTimer);
        undoTimer = later(() => setUndoBtn((b) => (b?.id === c.id ? null : b)), UNDO_BUTTON_MS);
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
    later(moonHint, MOON_HINT_TIMEOUT_MS);
    later(wordsHint, WORDS_HINT_TIMEOUT_MS);

    // Controls step back while drawing (docs/03 §5.2).
    const onDown = () => {
      drawing = true;
      cancel(chromeTimer);
      setDim(document.activeElement !== inputRef.current);
    };
    const onUp = () => {
      drawing = false;
      chromeTimer = later(() => {
        setDim(false);
        if (pendingHint) {
          const h = pendingHint;
          pendingHint = null;
          show(h.text, h.place);
        }
      }, CHROME_RESTORE_MS);
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (!typing && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        engine.undo();
      }
    };
    window.addEventListener('keydown', onKey);

    // Keep the input above the soft keyboard.
    const vv = window.visualViewport;
    const onViewport = () => {
      if (!vv) return;
      const kb = Math.max(window.innerHeight - vv.height - vv.offsetTop, 0);
      document.documentElement.style.setProperty('--kb', `${kb}px`);
    };
    vv?.addEventListener('resize', onViewport);
    vv?.addEventListener('scroll', onViewport);

    return () => {
      for (const id of timers) clearTimeout(id);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      vv?.removeEventListener('resize', onViewport);
      vv?.removeEventListener('scroll', onViewport);
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

  // Rotate the example placeholders while the box is empty.
  useEffect(() => {
    if (text) return;
    const id = window.setInterval(() => setPlaceholder((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(id);
  }, [text]);

  const undo = useCallback((id?: number) => {
    engineRef.current?.undo(id);
  }, []);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const value = text.trim();
      const engine = engineRef.current;
      if (!value || !engine) return;
      const { command } = interpret(value);
      engine.applyScene(command);
      wordsUsedRef.current();
      setAnnounce(describe(command));

      // The words rise into the sky as ink dots (docs/03 §5.3).
      const box = inputRef.current!.getBoundingClientRect();
      const chars = [...value].map((ch, i) => ({ ch, dx: (Math.random() - 0.5) * 120, delay: i * 35 }));
      const flight: Flight = { key: Date.now(), chars, x: box.left + 20, y: box.top + box.height / 2 };
      setFlights((f) => [...f, flight]);
      window.setTimeout(() => setFlights((f) => f.filter((x) => x !== flight)), 1600 + chars.length * 35);

      setText('');
      if (coarse()) inputRef.current?.blur();
    },
    [text],
  );

  if (failed) {
    return (
      <div className="fallback" role="alert">
        <p>这里进不去，换个浏览器试试</p>
        <p className="sub">最新版 Chrome、Safari 或 Edge 都可以</p>
      </div>
    );
  }

  const count = [...text].length;
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
          key={undoBtn.id}
          type="button"
          className="undo"
          aria-label="撤销这次创造"
          title="墨散（撤销）"
          style={{
            left: `clamp(8px, ${undoBtn.x + 18}px, calc(100% - 52px))`,
            top: `clamp(8px, ${undoBtn.y - 22}px, calc(100% - 52px))`,
          }}
          onClick={() => undo(undoBtn.id)}
        >
          <span className="undo-dot" />
        </button>
      )}
      <form className={`words${dim ? ' dim' : ''}`} onSubmit={submit}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText([...e.target.value].slice(0, MAX_CHARS).join(''))}
          placeholder={PLACEHOLDERS[placeholder]}
          aria-label="写一句话，改变世界"
          enterKeyHint="send"
          autoComplete="off"
        />
        {count >= COUNT_FROM && (
          <span className="count" aria-live="polite">
            {count}/{MAX_CHARS}
          </span>
        )}
        <button type="submit" className="send" disabled={!text.trim()} aria-label="让世界听见">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
      </form>
      {flights.map((f) => (
        <div key={f.key} className="flight" style={{ left: f.x, top: f.y }} aria-hidden="true">
          {f.chars.map((c, i) => (
            <span key={i} style={{ '--dx': `${c.dx}px`, animationDelay: `${c.delay}ms` } as React.CSSProperties}>
              {c.ch}
            </span>
          ))}
        </div>
      ))}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}
