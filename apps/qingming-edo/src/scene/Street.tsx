import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { HotspotDef } from '../contract';
import { SCENE, SCENE_H, SCENE_W } from '../content/world';
import { clampCamera, isDrag, resolveTap } from '../engine/hit';
import { FAR, PaintedStreet, type Poses } from './painted';

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
  onTap(hits: HotspotDef[]): void;
  onActivity(): void;
}

const START_X = 2560;
/** The painting's top is empty sky (where the far layer shows); this much is left off-screen. */
const TOP = 130;
const NEAR_H = SCENE_H + 600; // the road goes on below the picture on tall screens

export function Street({ apiRef, spots, poses, reacting, reduceMotion, interactive, talking, onTap, onActivity }: StreetProps) {
  const box = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const cam = useRef<number | null>(null); // left edge, scene units
  const size = useRef({ w: 0, h: 0, scale: 1 });
  const anim = useRef(0);
  const [scale, setScale] = useState(1);

  const paint = useCallback(() => {
    const s = size.current.scale;
    const x = cam.current ?? 0;
    if (box.current) box.current.dataset.cam = x.toFixed(1); // read by the browser checks
    SCENE.layers.forEach((l, i) => {
      const el = layers.current[i];
      if (el) el.style.transform = `translate3d(${-x * l.depth * s}px,${-TOP * s}px,0) scale(${s})`;
    });
  }, []);

  const setCam = useCallback(
    (x: number) => {
      cam.current = clampCamera(x, size.current.w / size.current.scale, SCENE_W);
      paint();
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
      const s = Math.max(0.5, Math.min(h / (SCENE_H - TOP), w / 340));
      size.current = { w, h, scale: s };
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

  useImperativeHandle(
    apiRef,
    () => ({
      focus(x: number) {
        cancelAnimationFrame(anim.current);
        const target = clampCamera(x - size.current.w / size.current.scale / 2, size.current.w / size.current.scale, SCENE_W);
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
    return { x: (cam.current ?? 0) + (clientX - r.left) / s, y: TOP + (clientY - r.top) / s };
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
      {/* far: the painted distant view (its own layer, style decision #6) */}
      <div className="layer" ref={(el) => void (layers.current[0] = el)} style={layerStyle(FAR.w * 2)}>
        <svg width={FAR.w * 2} height={SCENE_H} viewBox={`0 0 ${FAR.w * 2} ${SCENE_H}`} aria-hidden="true">
          <rect width={FAR.w * 2} height={SCENE_H} fill="#e1cfa6" />
          {/* raised so the distant roofs show just above the street's rooftops */}
          <image href={FAR.href} x={0} y={-110} width={FAR.w} height={FAR.h} preserveAspectRatio="none" />
          <image href={FAR.href} x={-FAR.w} y={-110} width={FAR.w} height={FAR.h} preserveAspectRatio="none" transform="scale(-1 1)" />
        </svg>
      </div>

      {/* mid: the street itself — hotspots are in this layer's units */}
      <div className="layer" ref={(el) => void (layers.current[1] = el)} style={layerStyle(SCENE_W)}>
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true">
          <PaintedStreet
            poses={poses}
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
              <stop offset="0" stopColor="#bba683" stopOpacity={0} />
              <stop offset="1" stopColor="#bba683" stopOpacity={1} />
            </linearGradient>
          </defs>
          <rect x={0} y={SCENE_H - 60} width={SCENE_W + 400} height={60} fill="url(#road-on)" />
          <rect x={0} y={SCENE_H - 1} width={SCENE_W + 400} height={NEAR_H - SCENE_H + 1} fill="#bba683" />
        </svg>
      </div>
      </div>
    </div>
  );
}
