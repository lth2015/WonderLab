import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { HotspotDef } from '../contract';
import { AMBIENT_REACTION, SCENE, SCENE_H, SCENE_W } from '../content/world';
import { clampCamera, isDrag, resolveTap } from '../engine/hit';
import { InkyoSprite, PaintedStreet, SCENE_X0, SECTIONS, type Poses } from './painted';

export interface StreetApi {
  /** Brings scene x to the middle of the view (≤300 ms, instant when motion is reduced). */
  focus(x: number): void;
}

export interface StreetProps {
  apiRef: Ref<StreetApi>;
  spots: HotspotDef[];
  poses: Poses;
  reacting: ReadonlySet<string>;
  reduceMotion: boolean;
  /** False while a dialogue, game or panel holds the screen (spec §7 遊びの途中). */
  interactive: boolean;
  /** A conversation is open: lift the street so the people stay above the sheet (spec §7 会話). */
  talking: boolean;
  /** 詳しく見る (spec §7): twice as close; leaving it returns to where the player was. */
  zoomed: boolean;
  onTap(hits: HotspotDef[]): void;
  onActivity(): void;
  /** 様子を見る: a soft ink ring under one spot for a moment (spec §7: never a standing marker). */
  cue?: { spotId: string; key: number } | null;
  /** A new player: show once that the street moves, until the first drag (roadmap #158 1A). */
  dragHint?: boolean;
  /** The scene x at the middle of the view, whenever it moves (for the sound). */
  onCamera?(x: number): void;
  /**
   * ご隠居の散歩: someone walking with the player, from `from` leftwards to `to`, at their own
   * slow pace. They walk while the view is with them or ahead (to the left); if the player goes
   * back past them, they wait. At each stop they pause and say something; at `to` they arrive.
   */
  companion?: { from: number; to: number; stops: { x: number; say: string }[] } | null;
  onCompanion?(e: { say: string } | { arrived: true }): void;
}

/** Scene units a second: the passers-by's pace (about a minute and a half to the bench). */
export const COMPANION_SPEED = 22;

const START_X = 12505;
/** The painting's top is empty sky (where the far layer shows); this much is left off-screen. */
const TOP = 40;
const NEAR_H = SCENE_H + 600; // the road goes on below the picture on tall screens

/** The scene y at the top of the view: the empty sky is cut at zoom 1; close up, the street stays in the middle. */
function topFor(zoom: number, s: number, h: number): number {
  if (zoom === 1) return TOP;
  const viewH = h / s;
  return Math.max(0, Math.min(SCENE_H - viewH, ZOOM_FOCUS_Y - viewH * 0.55));
}

/** Close-up: how much nearer, and the height (scene units) kept near the middle of the view. */
const ZOOM = 2;
const ZOOM_FOCUS_Y = 470;

export function Street({ apiRef, spots, poses, reacting, reduceMotion, interactive, talking, zoomed, onTap, onActivity, onCamera, cue, dragHint, companion, onCompanion }: StreetProps) {
  // the street moves: told once, a moment after arriving, gone at the first drag
  const [dragged, setDragged] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  useEffect(() => {
    if (!dragHint || dragged) return;
    const show = setTimeout(() => setHintShown(true), 2200);
    // said once is enough: it goes by itself after a while
    const done = setTimeout(() => setDragged(true), 2200 + 8000);
    return () => {
      clearTimeout(show);
      clearTimeout(done);
    };
  }, [dragHint, dragged]);
  // a dialogue, game or panel takes the screen: the street stops where it is
  useEffect(() => {
    if (!interactive) cancelAnimationFrame(anim.current);
  }, [interactive]);
  // a mouse over something that can be opened: a pointing hand and a faint ring (never on touch)
  const [hover, setHover] = useState<string | null>(null);
  // a tap that found nothing still gets an answer: a small ink ripple where the finger was
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null);
  useEffect(() => {
    if (!ripple) return;
    const t = setTimeout(() => setRipple(null), 500);
    return () => clearTimeout(t);
  }, [ripple]);
  const onCam = useRef(onCamera);
  onCam.current = onCamera;
  const onComp = useRef(onCompanion);
  onComp.current = onCompanion;
  const live_ = useRef(interactive);
  live_.current = interactive;
  // the companion's place is kept here and drawn straight onto its group (no re-render a frame)
  const compEl = useRef<SVGGElement>(null);
  const compX = useRef<number | null>(null);
  useEffect(() => {
    if (!companion) {
      compX.current = null;
      return;
    }
    compX.current ??= companion.from;
    // stops already behind them (they walk leftwards) are not said again
    const said = new Set(companion.stops.filter((st) => st.x >= compX.current!).map((st) => st.x));
    let last = performance.now();
    let waitUntil = 0;
    let raf = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const x = compX.current!;
      const viewL = cam.current ?? 0;
      // with them or ahead of them: the left edge of the view is not past them
      const together = viewL < x + 30;
      const moving = live_.current && together && t >= waitUntil && x > companion.to;
      let nx = x;
      if (moving) {
        nx = Math.max(companion.to, x - COMPANION_SPEED * dt);
        const stop = companion.stops.find((st) => !said.has(st.x) && st.x < x && st.x >= nx);
        if (stop) {
          said.add(stop.x);
          nx = stop.x;
          waitUntil = t + 3500;
          onComp.current?.({ say: stop.say });
        }
      }
      compX.current = nx;
      const el = compEl.current;
      if (el) {
        el.setAttribute('transform', `translate(${nx.toFixed(1)} 0)`);
        el.dataset.moving = moving ? 'yes' : 'no';
      }
      if (nx <= companion.to) return onComp.current?.({ arrived: true });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [companion]);
  const box = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const cam = useRef<number | null>(null); // left edge, scene units
  const size = useRef({ w: 0, h: 0, scale: 1 });
  const anim = useRef(0);
  // the zoom has its own frame loop: a touch or a focus during it must not freeze it half way
  const zoomAnim = useRef(0);
  const [scale, setScale] = useState(1);
  const base = useRef(1); // scale at zoom 1
  const top = useRef(TOP); // scene y at the top of the view
  const zoomNow = useRef(1);
  const savedCenter = useRef<number | null>(null);
  // sections drawn: the ones in view and one either side (loaded by section, decision #14)
  // the first guess is where play starts, not the right end: the scroll grew past the
  // bridge (roadmap #158 item 4) and the far bank must not load with the first screen
  const [sections, setSections] = useState<[number, number]>(() => {
    const k = Math.floor(START_X / 1000);
    return [Math.max(0, k - 1), Math.min(SECTIONS - 1, k + 1)];
  });

  // past either end of the scroll: the street gives a little, then springs back (spec §7)
  const over = useRef(0); // scene units beyond the end, drawn only
  const overAnim = useRef(0);
  const paint = useCallback(() => {
    const s = size.current.scale;
    const x = (cam.current ?? 0) + over.current;
    if (box.current) {
      box.current.dataset.cam = (cam.current ?? 0).toFixed(1); // read by the browser checks (the real camera, not the stretch)
      box.current.dataset.top = top.current.toFixed(1);
    }
    SCENE.layers.forEach((l, i) => {
      const el = layers.current[i];
      if (el) el.style.transform = `translate3d(${-x * l.depth * s}px,${-top.current * s}px,0) scale(${s})`;
    });
  }, []);

  const setCam = useCallback(
    (x: number) => {
      const viewW = size.current.w / size.current.scale;
      cam.current = Math.max(SCENE_X0, clampCamera(x, viewW, SCENE_W));
      paint();
      const from = Math.max(0, Math.floor(cam.current / 1000) - 1);
      const to = Math.min(SECTIONS - 1, Math.floor((cam.current + viewW) / 1000) + 1);
      setSections((r) => (r[0] === from && r[1] === to ? r : [from, to]));
      onCam.current?.(cam.current + viewW / 2);
    },
    [paint],
  );

  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Fill the height on wide screens; on a phone keep about 560 units of
      // street in view (about 400 units: the painted section rewards a closer look) (the paper shop, its clerk and the master together)
      // and let the road continue below the picture.
      base.current = Math.max(0.5, Math.min(h / (SCENE_H - TOP), w / 340));
      const s = base.current * zoomNow.current;
      size.current = { w, h, scale: s };
      top.current = topFor(zoomNow.current, s, h);
      setScale(s);
      // First view: by the bridge on the right, where the scroll begins,
      // with the paper shop in sight.
      setCam(cam.current ?? START_X - w / s / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setCam]);

  // 詳しく見る: scale, top and the centre move together over ≤300 ms
  useEffect(() => {
    const target = zoomed ? ZOOM : 1;
    if (target === zoomNow.current) return;
    cancelAnimationFrame(zoomAnim.current);
    cancelAnimationFrame(anim.current); // a glide must not carry over into (or out of) the close-up
    const { w, h } = size.current;
    const s0 = size.current.scale;
    const top0 = top.current;
    const c0 = (cam.current ?? 0) + w / s0 / 2;
    if (zoomed) savedCenter.current = c0;
    const c1 = zoomed ? c0 : (savedCenter.current ?? c0);
    const s1 = base.current * target;
    const top1 = topFor(target, s1, h);
    zoomNow.current = target;
    const apply = (k: number) => {
      const e = 1 - (1 - k) ** 3;
      const s = s0 + (s1 - s0) * e;
      size.current = { ...size.current, scale: s };
      top.current = top0 + (top1 - top0) * e;
      setCam(c0 + (c1 - c0) * e - w / s / 2);
    };
    if (reduceMotion) {
      apply(1);
      setScale(s1);
      return;
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 300);
      apply(k);
      if (k < 1) zoomAnim.current = requestAnimationFrame(step);
      else setScale(s1);
    };
    zoomAnim.current = requestAnimationFrame(step);
  }, [zoomed, reduceMotion, setCam]);

  useImperativeHandle(
    apiRef,
    () => ({
      focus(x: number) {
        cancelAnimationFrame(anim.current);
        const target = Math.max(SCENE_X0, clampCamera(x - size.current.w / size.current.scale / 2, size.current.w / size.current.scale, SCENE_W));
        const from = cam.current ?? 0;
        if (reduceMotion || Math.abs(target - from) < 1) return setCam(target);
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 300);
          setCam(from + (target - from) * (1 - (1 - k) ** 3));
          if (k < 1) anim.current = requestAnimationFrame(step);
        };
        anim.current = requestAnimationFrame(step);
      },
    }),
    [reduceMotion, setCam],
  );

  // ---------------------------------------------------------------- input
  const drag = useRef<{ id: number; x0: number; y0: number; cam0: number; dragging: boolean; trail: { t: number; x: number }[] } | null>(null);

  const toScene = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    const s = size.current.scale;
    return { x: (cam.current ?? 0) + (clientX - r.left) / s, y: top.current + (clientY - r.top) / s };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    onActivity();
    if (!interactive || drag.current) return;
    cancelAnimationFrame(anim.current);
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cam0: cam.current ?? 0, dragging: false, trail: [{ t: e.timeStamp, x: e.clientX }] };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) {
      if (e.pointerType === 'mouse' && interactive) {
        const p = toScene(e.clientX, e.clientY);
        const id = resolveTap(spots.map(live), p.x, p.y, size.current.scale)[0]?.id ?? null;
        setHover((h) => (h === id ? h : id));
      }
      return;
    }
    const dx = e.clientX - d.x0;
    if (!d.dragging && isDrag(dx, e.clientY - d.y0)) {
      d.dragging = true;
      setDragged(true);
      setHover(null);
    }
    d.trail.push({ t: e.timeStamp, x: e.clientX });
    if (d.trail.length > 6) d.trail.shift();
    // The finger and the street move together, in the same direction (spec §7).
    if (d.dragging) {
      const want = d.cam0 - dx / size.current.scale;
      setCam(want);
      const beyond = want - (cam.current ?? 0);
      over.current = reduceMotion ? 0 : Math.sign(beyond) * 60 * (1 - Math.exp(-Math.abs(beyond) / 120));
      paint();
    }
  };
  /** Let go past an end: back to the edge in ~200 ms. */
  const springBack = () => {
    cancelAnimationFrame(overAnim.current);
    const from = over.current;
    if (!from) return;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 200);
      over.current = from * (1 - (1 - (1 - k) ** 3));
      paint();
      if (k < 1) overAnim.current = requestAnimationFrame(step);
    };
    overAnim.current = requestAnimationFrame(step);
  };
  /** After a flick the street glides on a little and slows (not with 動きを減らす). */
  const glide = (d: NonNullable<typeof drag.current>, t: number) => {
    const recent = d.trail.filter((p) => t - p.t < 90);
    if (reduceMotion || recent.length < 2) return;
    const a = recent[0];
    const b = recent[recent.length - 1];
    if (b.t - a.t < 8) return;
    let v = -((b.x - a.x) / (b.t - a.t)) / size.current.scale; // scene units per ms
    if (Math.abs(v) < 0.15) return;
    v = Math.max(-2.2, Math.min(2.2, v));
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const before = cam.current ?? 0;
      setCam(before + v * dt);
      v *= Math.exp(-dt / 160);
      // stop when slow, or held at either end
      if (Math.abs(v) > 0.02 && cam.current !== before) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (over.current) return springBack(); // held at an end: no glide, just back to the edge
    if (d.dragging) return glide(d, e.timeStamp);
    if (!interactive) return;
    const p = toScene(e.clientX, e.clientY);
    const hits = resolveTap(spots.map(live), p.x, p.y, size.current.scale);
    if (!hits.length) setRipple({ x: p.x, y: p.y, k: performance.now() });
    onTap(hits);
  };
  const onPointerCancel = () => {
    drag.current = null;
    springBack();
  };
  const onPointerLeave = () => setHover(null);
  /** A hotspot on a walking passer-by: its area follows the walker as drawn now. */
  const live = (h: HotspotDef): HotspotDef => {
    if (!h.walker) return h;
    const img = box.current?.querySelector(`[data-walker="${h.walker}"] image`);
    if (!img) return h;
    const r = img.getBoundingClientRect();
    const a = toScene(r.left, r.top);
    const b = toScene(r.right, r.bottom);
    return { ...h, anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, hitArea: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y } };
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    onActivity();
    setDragged(true);
    setCam((cam.current ?? 0) + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / size.current.scale);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      onActivity();
      e.preventDefault();
      setDragged(true);
      setCam((cam.current ?? 0) + (e.key === 'ArrowLeft' ? -160 : 160));
    }
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(anim.current);
      cancelAnimationFrame(zoomAnim.current);
    },
    [],
  );

  const cueSpot = cue ? spots.find((h) => h.id === cue.spotId) : undefined;
  /** Where a ring goes under a spot: under a person's feet (a wide tap area, like 清太's with his papers, is not where he stands). */
  const ringAt = (h: HotspotDef) => {
    const bottom = h.hitArea.y + h.hitArea.h - 6;
    const person = h.kind !== 'ambient';
    const r = Math.max((person ? Math.min(h.hitArea.w, 60) : h.hitArea.w) / 2 + 8, 28);
    return { cx: person ? h.anchor.x : h.hitArea.x + h.hitArea.w / 2, cy: person ? Math.min(bottom, h.anchor.y + 45) : bottom, rx: r, ry: r * 0.3 };
  };
  const hoverFound = hover && interactive && !cueSpot ? spots.find((h) => h.id === hover) : undefined;
  const hoverSpot = hoverFound && live(hoverFound);
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const layerStyle = (w: number): React.CSSProperties => ({ width: w, height: SCENE_H, transformOrigin: '0 0' });

  return (
    <div
      ref={box}
      className="street"
      tabIndex={0}
      role="application"
      aria-label="日本橋北詰の通り。左右の矢印キーで通りを動かせます。人や物の一覧は「近くのこと」にあります。"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      data-hover={hover && interactive ? 'yes' : undefined}
      data-still={interactive ? undefined : 'yes'}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      data-scale={scale.toFixed(3)}
    >
      <div className={talking ? 'pan talking' : 'pan'}>
      {/* far: the distant town is in the painting itself; this layer is the paper behind it */}
      <div className="layer" ref={(el) => void (layers.current[0] = el)} style={layerStyle(SCENE_W)}>
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true">
          <rect width={SCENE_W} height={SCENE_H} fill="#e9ddbd" />
        </svg>
      </div>

      {/* mid: the street itself — hotspots are in this layer's units */}
      <div className="layer" ref={(el) => void (layers.current[1] = el)} style={layerStyle(SCENE_W)}>
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true">
          <PaintedStreet
            poses={poses}
            sections={sections}
            glints={spots
              .filter((h) => h.kind === 'ambient' && !h.walker && reacting.has(h.targetId))
              .map((h) => ({ id: h.id, ...h.hitArea, reaction: AMBIENT_REACTION[h.targetId] }))}
            stopped={spots.filter((h) => h.walker && h.kind === 'ambient' && reacting.has(h.targetId)).map((h) => h.walker!)}
          />
          {companion && (
            <g ref={compEl} className="companion" data-walker="inkyo-walk" transform={`translate(${compX.current ?? companion.from} 0)`}>
              <InkyoSprite />
            </g>
          )}
          {cueSpot && <ellipse key={`cue-${cue!.key}`} className="cue-ring" {...ringAt(cueSpot)} />}
          {ripple && <circle key={ripple.k} className="tap-ripple" cx={ripple.x} cy={ripple.y} r={16 / scale} />}
          {hoverSpot && <ellipse className="hover-ring" {...ringAt(hoverSpot)} />}
        </svg>
      </div>

      {/* near: the edge of the road, a little in front */}
      <div className="layer" ref={(el) => void (layers.current[2] = el)} style={{ ...layerStyle(SCENE_W + 400), height: NEAR_H }}>
        <svg width={SCENE_W + 400} height={NEAR_H} viewBox={`0 0 ${SCENE_W + 400} ${NEAR_H}`} aria-hidden="true">
          {/* below the picture on tall screens: the painted road simply goes on */}
          <defs>
            <linearGradient id="road-on" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8f897b" stopOpacity={0} />
              <stop offset="1" stopColor="#8f897b" stopOpacity={1} />
            </linearGradient>
          </defs>
          <rect x={0} y={SCENE_H - 60} width={SCENE_W + 400} height={60} fill="url(#road-on)" />
          <rect x={0} y={SCENE_H - 1} width={SCENE_W + 400} height={NEAR_H - SCENE_H + 1} fill="#8f897b" />
        </svg>
      </div>
      </div>
      {dragHint && hintShown && !dragged && interactive && !cue && (
        <p className="drag-hint" aria-hidden="true">
          <span>←</span>
          {coarse ? '指で通りを左右に動かせます' : 'ドラッグや ← → キーで通りを動かせます'}
          <span>→</span>
        </p>
      )}
    </div>
  );
}
