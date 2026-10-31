import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { HotspotDef } from '../contract';
import { SCENE, SCENE_H, SCENE_W } from '../content/world';
import { clampCamera, isDrag, resolveTap } from '../engine/hit';
import { PaintedStreet, SCENE_X0, SECTIONS, type Poses } from './painted';

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
}

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

export function Street({ apiRef, spots, poses, reacting, reduceMotion, interactive, talking, zoomed, onTap, onActivity }: StreetProps) {
  const box = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const cam = useRef<number | null>(null); // left edge, scene units
  const size = useRef({ w: 0, h: 0, scale: 1 });
  const anim = useRef(0);
  const [scale, setScale] = useState(1);
  const base = useRef(1); // scale at zoom 1
  const top = useRef(TOP); // scene y at the top of the view
  const zoomNow = useRef(1);
  const savedCenter = useRef<number | null>(null);
  // sections drawn: the ones in view and one either side (loaded by section, decision #14)
  const [sections, setSections] = useState<[number, number]>([SECTIONS - 3, SECTIONS - 1]);

  const paint = useCallback(() => {
    const s = size.current.scale;
    const x = cam.current ?? 0;
    if (box.current) {
      box.current.dataset.cam = x.toFixed(1); // read by the browser checks
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
    cancelAnimationFrame(anim.current);
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
      if (k < 1) anim.current = requestAnimationFrame(step);
      else setScale(s1);
    };
    anim.current = requestAnimationFrame(step);
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
  const drag = useRef<{ id: number; x0: number; y0: number; cam0: number; dragging: boolean } | null>(null);

  const toScene = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    const s = size.current.scale;
    return { x: (cam.current ?? 0) + (clientX - r.left) / s, y: top.current + (clientY - r.top) / s };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    onActivity();
    if (!interactive || drag.current) return;
    cancelAnimationFrame(anim.current);
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cam0: cam.current ?? 0, dragging: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.dragging && isDrag(dx, e.clientY - d.y0)) d.dragging = true;
    // The finger and the street move together, in the same direction (spec §7).
    if (d.dragging) setCam(d.cam0 - dx / size.current.scale);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.dragging || !interactive) return;
    const p = toScene(e.clientX, e.clientY);
    onTap(resolveTap(spots, p.x, p.y, size.current.scale));
  };
  const onPointerCancel = () => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    onActivity();
    setCam((cam.current ?? 0) + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / size.current.scale);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      onActivity();
      e.preventDefault();
      setCam((cam.current ?? 0) + (e.key === 'ArrowLeft' ? -160 : 160));
    }
  };

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

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
              .filter((h) => h.kind === 'ambient' && reacting.has(h.targetId))
              .map((h) => ({ id: h.id, ...h.hitArea }))}
          />
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
    </div>
  );
}
