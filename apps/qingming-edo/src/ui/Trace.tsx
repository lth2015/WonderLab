import { useMemo, useRef, useState } from 'react';
import { SKETCHES, TRACES } from '../content/world';
import { PaintedPageScene } from '../scene/painted';
import { study } from '../engine/study';

// なぞり描き (demo feedback 「交互太少」): the apprentice draws. Faint dotted lines lie over
// the place; the finger (or mouse) goes along them and ink stays where it went. Most of
// each line covered is enough — nobody fails. 「なぞらずに描く」 finishes it at once, for a
// keyboard, a switch, or simply not wanting to.

const PIC = { x: 40, y: 40, w: 520, h: 660 }; // the page picture area (PageArt)
const STEP = 7; // svg units between the points that must be inked
const REACH = 20; // how near the finger must pass, in svg units (generous on purpose)
export const ENOUGH = 0.8;

/** The guide lines in page (svg) units, and the points along them that count. */
export function traceTargets(sketchId: string) {
  const k = SKETCHES.find((s) => s.id === sketchId)!;
  const scale = PIC.w / k.view.w;
  const lines = (TRACES[sketchId] ?? []).map((l) => l.map((p) => ({ x: PIC.x + (p.x - k.view.x0) * scale, y: PIC.y + (p.y - k.view.y0) * scale })));
  const points: { x: number; y: number }[] = [];
  for (const l of lines)
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1];
      const b = l[i];
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / STEP));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) points.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
    }
  return { lines, points };
}

/** Which target points a stroke from a to b passes near. */
export function inkedBy(points: { x: number; y: number }[], a: { x: number; y: number }, b: { x: number; y: number }): number[] {
  const out: number[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  points.forEach((p, i) => {
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    if (Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y) <= REACH) out.push(i);
  });
  return out;
}

export function Trace({ sketchId, tod, onDone, onCancel }: { sketchId: string; tod: string; onDone(): void; onCancel(): void }) {
  const k = SKETCHES.find((s) => s.id === sketchId)!;
  const { lines, points } = useMemo(() => traceTargets(sketchId), [sketchId]);
  const inked = useRef(new Set<number>());
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const [done, setDone] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const share = points.length ? count / points.length : 1;

  const at = (e: React.PointerEvent) => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  };
  const finish = (how: 'traced' | 'skipped') => {
    if (doneRef.current) return;
    doneRef.current = true;
    study.emit('play_detail', { what: 'trace', outcome: how });
    setDone(true);
    setTimeout(onDone, 900);
  };
  const add = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const hit = inkedBy(points, a, b);
    if (!hit.length) return;
    hit.forEach((i) => inked.current.add(i));
    setCount(inked.current.size);
    if (inked.current.size / points.length >= ENOUGH) finish('traced');
  };
  const down = (e: React.PointerEvent) => {
    if (done) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = at(e);
    last.current = p;
    setStrokes((s) => [...s, [p]]);
    add(p, p);
  };
  const move = (e: React.PointerEvent) => {
    if (!last.current || done) return;
    const p = at(e);
    if (Math.hypot(p.x - last.current.x, p.y - last.current.y) < 2) return;
    add(last.current, p);
    last.current = p;
    setStrokes((s) => [...s.slice(0, -1), [...s[s.length - 1], p]]);
  };
  const up = () => {
    last.current = null;
  };
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="panel trace" role="dialog" aria-labelledby="trace-h">
      <h2 id="trace-h">{k.title}を写す</h2>
      <p className="wrap-note" aria-live="polite">
        {done ? 'よし、線がつながった。' : share > 0.4 ? 'その調子。点線の残りも、なぞってみよう。' : '点線を、指でなぞってみよう。'}
      </p>
      <svg
        ref={svg}
        className={done ? 'trace-paper done' : 'trace-paper'}
        viewBox={`${PIC.x} ${PIC.y} ${PIC.w} ${PIC.h}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label={`${k.title}。点線をなぞって描く`}
      >
        <PaintedPageScene composition={`sketch-${sketchId}-${tod}`} />
        <rect x={PIC.x} y={PIC.y} width={PIC.w} height={PIC.h} fill="#f6efdc" opacity={done ? 0.15 : 0.35} />
        {lines.map((l, i) => (
          <path key={`g${i}`} className="trace-guide" d={path(l)} />
        ))}
        {strokes.map((s, i) => (
          <path key={`s${i}`} className="trace-ink" d={path(s)} />
        ))}
        {done && lines.map((l, i) => <path key={`d${i}`} className="trace-ink final" d={path(l)} />)}
      </svg>
      <div className="trace-meter" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (share / ENOUGH) * 100)}%` }} />
      </div>
      <div className="trace-actions">
        <button type="button" onClick={() => finish('skipped')} disabled={done}>
          なぞらずに描く
        </button>
        <button type="button" className="ghost" onClick={() => (study.emit('play_detail', { what: 'trace', outcome: 'left' }), onCancel())} disabled={done}>
          町に戻る（あとで描く）
        </button>
      </div>
    </div>
  );
}
