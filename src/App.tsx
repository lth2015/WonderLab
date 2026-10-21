import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Engine, type Creation, type CreationKind } from './engine/engine';
import { interpret, type SceneCommand } from './engine/intent';
import type { Tier } from './engine/quality';
import { Menu } from './Menu';
import { deviceType, exportLog, hintShown, logEvent, prompted, togglePhase } from './telemetry';
import { clearWorld, loadWorld, saveWorld } from './engine/persist';

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
const TOAST_MS = 5000;
const params = new URLSearchParams(location.search);
const forcedTier = params.get('tier');
const SAVE_EVERY_MS = 3000;
// ?fresh starts from an empty world (docs/02 §3.1), then drops out of the
// address so a refresh mid-session keeps the tester's world.
const fresh = params.has('fresh');
if (fresh) {
  clearWorld();
  params.delete('fresh');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
}
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

type HintPlace = 'lake' | 'sky' | 'input';
type Hint = { text: string; place: HintPlace; key: number } | null;
type HintId = 'draw_lake' | 'touch_fish' | 'draw_circle' | 'write_words';
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
  const [toast, setToast] = useState(false);
  const [tier, setTier] = useState<Tier>('standard');
  const [staticDemo, setStaticDemo] = useState(0);
  const [hostNote, setHostNote] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!hasWebGL()) {
      setFailed(true);
      return;
    }
    // Timers run on visible time only: a link opened in a background tab must
    // not use up the first-run hints and demos before anyone sees the world.
    interface Timer {
      fn: () => void;
      left: number;
      armedAt: number;
      handle: number;
    }
    const timers = new Map<number, Timer>();
    let nextTimer = 1;
    const arm = (id: number, t: Timer) => {
      t.armedAt = performance.now();
      t.handle = window.setTimeout(() => {
        timers.delete(id);
        t.fn();
      }, t.left);
    };
    const later = (fn: () => void, ms: number) => {
      const id = nextTimer++;
      const t: Timer = { fn, left: ms, armedAt: 0, handle: 0 };
      timers.set(id, t);
      if (!document.hidden) arm(id, t);
      return id;
    };
    const cancel = (id: number) => {
      const t = timers.get(id);
      if (!t) return;
      clearTimeout(t.handle);
      timers.delete(id);
    };
    const onTimerVisibility = () => {
      for (const [id, t] of timers) {
        if (document.hidden) {
          clearTimeout(t.handle);
          t.left = Math.max(0, t.left - (performance.now() - t.armedAt));
        } else arm(id, t);
      }
    };
    document.addEventListener('visibilitychange', onTimerVisibility);

    let drawn = false;
    let drawing = false;
    let demos = 0;
    let hintKey = 0;
    let undoTimer = 0;
    let demoTimer = 0;
    let chromeTimer = 0;
    let fishHint = false;
    const shownHints = new Set<string>();
    let pendingHint: { id: HintId; text: string; place: HintPlace } | null = null;
    let hasMoon = false;
    let wordsUsed = false;

    // Hints only appear between strokes; one that arrives mid-stroke waits.
    const show = (id: HintId, text: string, place: HintPlace) => {
      if (drawing) {
        pendingHint = { id, text, place };
        return;
      }
      hintShown(id);
      const key = ++hintKey;
      setHint({ text, place, key });
      later(() => setHint((h) => (h?.key === key ? null : h)), HINT_MS);
    };
    const once = (id: HintId, text: string, place: HintPlace, when: () => boolean = () => true) => {
      if (shownHints.has(id) || !when()) return;
      shownHints.add(id);
      show(id, text, place);
    };
    const moonHint = () => once('draw_circle', '在天上画一个圆', 'sky', () => !hasMoon);
    const wordsHint = () => once('write_words', '写一句话，世界会听见', 'input', () => !wordsUsed);
    wordsUsedRef.current = () => {
      wordsUsed = true;
      setHint((h) => (h?.place === 'input' ? null : h));
    };

    const readyAt = performance.now();
    const engine = new Engine(
      canvas,
      {
        onFirstStroke: () => {
          logEvent('first_stroke', { after: Math.round(performance.now() - readyAt) });
          drawn = true;
          cancel(demoTimer);
          setHint(null);
        },
        onFishCreated: (count) => {
          if (!fishHint) {
            fishHint = true;
            later(() => once('touch_fish', '点一点小鱼', 'lake'), FISH_HINT_DELAY_MS);
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
        onTierChange: setTier,
        onRestartSettled: () => setToast(false),
      },
      {
        tier: forcedTier === 'light' || forcedTier === 'standard' ? forcedTier : undefined,
        reducedMotion: reducedQuery.matches,
      },
    );
    engineRef.current = engine;
    setTier(engine.tier);
    const saved = fresh ? null : loadWorld();
    if (saved) {
      engine.restore(saved);
      hasMoon = !!saved.moon;
    }
    let resetting = false;
    const save = () => {
      if (!resetting) saveWorld(engine.serialize());
    };
    const saveTimer = window.setInterval(save, SAVE_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    engine.start();
    requestAnimationFrame(() => {
      setReady(true);
      logEvent('world_ready', { ms: Math.round(performance.now()), device: deviceType(), tier: engine.tier });
    });
    const onReduced = () => engine.setReducedMotion(reducedQuery.matches);
    reducedQuery.addEventListener('change', onReduced);

    const scheduleDemo = (ms: number) => {
      demoTimer = later(() => {
        if (drawn || demos >= DEMO_MAX) return;
        demos++;
        // Reduced motion: a still, dashed line instead of the animated ghost.
        if (reducedQuery.matches) setStaticDemo((n) => n + 1);
        else engine.playDemo();
        scheduleDemo(DEMO_GAP_MS);
      }, ms);
    };
    // A restored world with fish in it has already been drawn in: skip the first-stroke invitation.
    if (saved?.fish.length) {
      drawn = true;
    } else {
      later(() => show('draw_lake', '在湖面上画一笔', 'lake'), 600);
      scheduleDemo(DEMO_IDLE_MS);
    }
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
          show(h.id, h.text, h.place);
        }
      }, CHROME_RESTORE_MS);
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    const note = (text: string) => {
      setHostNote(text);
      later(() => setHostNote(''), 1500);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (!typing && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        engine.undo();
        return;
      }
      // Moderator shortcuts (docs/02 §8, §3.1): export the log, switch test phase, reset.
      if (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (e.code === 'KeyE') {
          e.preventDefault();
          exportLog();
          note('日志已导出');
        } else if (e.code === 'KeyP') {
          e.preventDefault();
          note(togglePhase() === 'free' ? '自由段' : '引导段');
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          resetting = true;
          clearWorld();
          location.replace(`${location.pathname}?fresh${forcedTier ? `&tier=${forcedTier}` : ''}`);
        }
        return;
      }
      // Single-key creation only while the canvas has focus (WCAG 2.1.4, docs/03 §8).
      if (e.target === canvas && !e.altKey && !e.metaKey && !e.ctrlKey) {
        const action = e.key === 'f' || e.key === 'F' ? 'fish' : e.key === 'm' || e.key === 'M' ? 'moon' : e.key === 'Enter' ? 'tap' : null;
        if (action) {
          e.preventDefault();
          if (!drawn) {
            drawn = true;
            cancel(demoTimer);
            setHint(null);
          }
          engine.keyAction(action);
        }
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
      for (const t of timers.values()) clearTimeout(t.handle);
      document.removeEventListener('visibilitychange', onTimerVisibility);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      reducedQuery.removeEventListener('change', onReduced);
      clearInterval(saveTimer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
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
  const canUndo = useCallback(() => !!engineRef.current?.canUndo, []);
  const restart = useCallback(() => {
    engineRef.current?.restart();
    setUndoBtn(null);
    setToast(true);
    setAnnounce('世界已重置');
  }, []);
  const undoRestart = useCallback(() => {
    engineRef.current?.undoRestart();
    setToast(false);
    setAnnounce('世界回来了');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tier = tier;
  }, [tier]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(false), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const value = text.trim();
      const engine = engineRef.current;
      if (!value || !engine) return;
      const { command, source } = interpret(value);
      logEvent('text_submit', { source: 'local', rule: source, prompted: prompted('text_submit') });
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
      <canvas ref={canvasRef} className="world" role="img" tabIndex={0} aria-label="夜湖画布：在湖面上画一笔，线会化成游鱼。获得焦点时按 F 画鱼，M 生月" />
      {staticDemo > 0 && (
        <svg key={staticDemo} className="static-demo" viewBox="0 0 260 60" aria-hidden="true">
          <path d="M6 40 C 70 6, 150 6, 254 34" />
        </svg>
      )}
      <div className={`veil${ready ? ' gone' : ''}`} aria-hidden="true">
        <div className="drop" />
      </div>
      <p className={`hint ${hint?.place ?? 'lake'}${hint && !toast ? ' on' : ''}`} aria-live="polite">
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
      <Menu canUndo={canUndo} onUndo={() => undo()} onRestart={restart} dim={dim} />
      <div className={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">
        {toast && (
          <>
            世界已重置 ·{' '}
            <button type="button" onClick={undoRestart}>
              撤回
            </button>
          </>
        )}
      </div>
      {hostNote && <div className="host-note">{hostNote}</div>}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}
