import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  isCorrect,
  isSession,
  OUTCOME_LABEL,
  plan,
  read,
  summarize,
  type Reading,
  type Sample,
  type Session,
} from './protocol';
import './collect.css';

const STORE = 'wonderlab.collect.v1';
const ADVANCE_MS = 900;

interface Saved {
  session: Session;
  queue: { category: string; rep: number }[];
}

function load(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null;
    return v && isSession(v.session) && Array.isArray(v.queue) ? v : null;
  } catch {
    return null;
  }
}

function save(v: Saved | null): void {
  try {
    if (v) localStorage.setItem(STORE, JSON.stringify(v));
    else localStorage.removeItem(STORE);
  } catch {
    // Private mode: the session still works, it just won't survive a reload.
  }
}

function device(): string {
  const touch = navigator.maxTouchPoints > 0 ? 'touch' : 'mouse';
  return `${touch} ${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}`;
}

function download(session: Session): void {
  const blob = new Blob([JSON.stringify(session)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = session.startedAt.replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `strokes-${session.tester || 'anon'}-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Stroke test-case collection, opened with `?collect` (docs/02 §4, docs/04 §3). */
export function Collector() {
  const [saved, setSaved] = useState<Saved | null>(load);
  const [tester, setTester] = useState('');
  const [last, setLast] = useState<{ sample: Sample; reading: Reading } | null>(null);

  useEffect(() => save(saved), [saved]);

  const start = () => {
    setSaved({
      session: { version: 1, tester: tester.trim(), device: device(), startedAt: new Date().toISOString(), samples: [] },
      queue: plan(),
    });
    setLast(null);
  };

  const reset = () => {
    setSaved(null);
    setLast(null);
    setTester('');
  };

  if (!saved) {
    return (
      <main className="collect intro">
        <h1>笔迹采集</h1>
        <p>
          会依次请你画 {CATEGORIES.length} 种形状，每种 5 次，打乱顺序，共 {CATEGORIES.length * 5} 笔，约 3 分钟。
          照平时的习惯画就好，没有画错这回事。
        </p>
        <label>
          测试者编号（不要填真名）
          <input value={tester} onChange={(e) => setTester(e.target.value)} placeholder="例如 P01" maxLength={12} />
        </label>
        <button type="button" className="primary" onClick={start}>
          开始
        </button>
      </main>
    );
  }

  const { session, queue } = saved;
  if (queue.length === 0) return <Summary session={session} onRestart={reset} />;

  const current = queue[0];
  const category = CATEGORIES.find((c) => c.id === current.category)!;
  const done = session.samples.length;
  const total = done + queue.length;

  const record = (sample: Sample) => {
    const reading = read(sample);
    setLast({ sample, reading });
    setSaved({ session: { ...session, samples: [...session.samples, sample] }, queue: queue.slice(1) });
  };

  const redo = () => {
    if (!last) return;
    const samples = session.samples.slice(0, -1);
    setSaved({ session: { ...session, samples }, queue: [{ category: last.sample.category, rep: last.sample.rep }, ...queue] });
    setLast(null);
  };

  return (
    <main className="collect drawing">
      <header className="prompt">
        <span className="progress">
          {done + 1} / {total}
        </span>
        <strong>{category.label}</strong>
        <span className="sub">{category.hint}</span>
      </header>
      <Pad key={done} category={current.category} rep={current.rep} onStroke={record} />
      <footer className="bar">
        {last && (
          <span className={`verdict ${isCorrect(last.sample, last.reading) ? 'ok' : 'miss'}`} aria-live="polite">
            上一笔读成：{OUTCOME_LABEL[last.reading.outcome]}
            {last.reading.phase ? `（${last.reading.phase}）` : ''}
          </span>
        )}
        <span className="spacer" />
        <button type="button" onClick={redo} disabled={!last}>
          重画上一笔
        </button>
        <button type="button" onClick={() => setSaved({ session, queue: [] })}>
          提前结束
        </button>
      </footer>
    </main>
  );
}

function Pad({ category, rep, onStroke }: { category: string; rep: number; onStroke: (s: Sample) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  // The parent's callback changes every render; listeners read the latest one.
  const onStrokeRef = useRef(onStroke);
  onStrokeRef.current = onStroke;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#efeadf';
      ctx.fillStyle = '#efeadf';
    };
    fit();
    window.addEventListener('resize', fit);

    let pid: number | null = null;
    let t0 = 0;
    let pts: [number, number, number][] = [];
    let timer = 0;

    const local = (e: PointerEvent): [number, number, number] => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top, Math.round(e.timeStamp - t0)];
    };

    const down = (e: PointerEvent) => {
      if (pid !== null) {
        // A second finger cancels, as in the world (docs/02 §4 #8).
        pid = null;
        pts = [];
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        return;
      }
      if (timer) return;
      canvas.setPointerCapture(e.pointerId);
      pid = e.pointerId;
      t0 = e.timeStamp;
      pts = [local(e)];
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], 3, 0, Math.PI * 2);
      ctx.fill();
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        const p = local(ev);
        const q = pts[pts.length - 1];
        pts.push(p);
        ctx.beginPath();
        ctx.moveTo(q[0], q[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pts.push(local(e));
      pid = null;
      const sample: Sample = {
        category,
        rep,
        points: pts.map(([x, y, t]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, t]),
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        pointerType: e.pointerType,
      };
      setBusy(true);
      // Leave the stroke on screen for a beat so the tester sees what was kept.
      timer = window.setTimeout(() => onStrokeRef.current(sample), ADVANCE_MS);
    };

    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = null;
      pts = [];
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', fit);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
    };
  }, [category, rep]);

  return <canvas ref={ref} className={`pad${busy ? ' busy' : ''}`} aria-label="在这里画" />;
}

function Summary({ session, onRestart }: { session: Session; onRestart: () => void }) {
  const stats = useMemo(() => summarize(session.samples), [session]);
  const total = session.samples.length;
  const correct = stats.reduce((n, s) => n + s.correct, 0);
  return (
    <main className="collect summary">
      <h1>采集完成</h1>
      <p>
        {session.tester || '匿名'} · {total} 笔 · 判对 {correct} 笔
      </p>
      <table>
        <thead>
          <tr>
            <th>形状</th>
            <th>判对</th>
            <th>实际读成</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.category.id} className={s.total && s.correct < s.total ? 'miss' : ''}>
              <td>{s.category.label}</td>
              <td>
                {s.correct} / {s.total}
              </td>
              <td>
                {Object.entries(s.outcomes)
                  .map(([k, n]) => `${OUTCOME_LABEL[k as keyof typeof OUTCOME_LABEL]} ×${n}`)
                  .join('，') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions">
        <button type="button" className="primary" onClick={() => download(session)} disabled={!total}>
          导出 JSON
        </button>
        <button type="button" onClick={onRestart}>
          下一位测试者
        </button>
      </div>
      <p className="note">导出的文件放进仓库的 strokes/ 目录，npm test 就会用它检验判定表。</p>
    </main>
  );
}
