import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { HotspotDef } from '../contract';
import { GROUND_Y, SCENE, SCENE_H, SCENE_W } from '../content/world';
import { clampCamera, isDrag, resolveTap } from '../engine/hit';
import { Barrel, Dog, Figure, Mist, MistDefs, Shop, Steam, WASH } from './art';
import { PAINTED_X0, PaintedSection } from './painted';

export interface StreetApi {
  /** Brings scene x to the middle of the view (≤300 ms, instant when motion is reduced). */
  focus(x: number): void;
}

export interface StreetProps {
  apiRef: Ref<StreetApi>;
  spots: HotspotDef[];
  pressed: boolean;
  kazeDone: boolean;
  metOkon: boolean;
  reacting: ReadonlySet<string>;
  reduceMotion: boolean;
  /** False while a dialogue, game or panel holds the screen (spec §7 遊びの途中). */
  interactive: boolean;
  /** A conversation is open: lift the street so the people stay above the sheet (spec §7 会話). */
  talking: boolean;
  onTap(hits: HotspotDef[]): void;
  onActivity(): void;
}

const G = GROUND_Y;
const START_X = 2560;
const NEAR_H = SCENE_H + 600; // the road goes on below the picture on tall screens

export function Street({ apiRef, spots, pressed, kazeDone, metOkon, reacting, reduceMotion, interactive, talking, onTap, onActivity }: StreetProps) {
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
      if (el) el.style.transform = `translate3d(${-x * l.depth * s}px,0,0) scale(${s})`;
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
      const s = Math.max(0.5, Math.min(h / SCENE_H, w / 400));
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
    return { x: (cam.current ?? 0) + (clientX - r.left) / s, y: (clientY - r.top) / s };
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

  const r = (id: string) => (reacting.has(id) ? ' react' : '');
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
      {/* far: sky, distant roofs, mist */}
      <div className="layer" ref={(el) => void (layers.current[0] = el)} style={layerStyle(SCENE_W)}>
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true">
          <MistDefs />
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e8dcc0" />
              <stop offset="1" stopColor="#f1e8d4" />
            </linearGradient>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="url(#sky)" />
          {Array.from({ length: 40 }, (_, i) => {
            // a far bank of low roofs, seen across the river and between shops
            const x = i * 78 + ((i * 37) % 30);
            const y = 430 + ((i * 53) % 24);
            const w = 70 + ((i * 29) % 30);
            return (
              <g key={i} opacity={0.32}>
                <path d={`M ${x} ${y} l 12 -22 h ${w - 24} l 12 22 Z`} fill={WASH.tile} />
                <rect x={x + 6} y={y} width={w - 12} height={60} fill={WASH.indigoPale} />
              </g>
            );
          })}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Mist key={i} x={i * 520 - 80 + (i % 2) * 120} y={40 + (i % 3) * 36} w={420} h={38} opacity={0.42} />
          ))}
        </svg>
      </div>

      {/* mid: the street itself — hotspots are in this layer's units */}
      <div className="layer" ref={(el) => void (layers.current[1] = el)} style={layerStyle(SCENE_W)}>
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true">
          <rect x={0} y={G} width={PAINTED_X0 + 80} height={SCENE_H - G} fill="#dccdae" />
          <path d={`M 0 ${G + 2} H ${PAINTED_X0 + 40}`} stroke="#33291f" strokeWidth={1.2} opacity={0.5} />

          {/* section 1, 橋詰: the painted street (scene/painted.tsx) */}
          <PaintedSection
            pressed={pressed}
            kazeDone={kazeDone}
            metOkon={metOkon}
            glints={spots
              .filter((h) => h.kind === 'ambient' && h.anchor.x >= PAINTED_X0 && reacting.has(h.targetId))
              .map((h) => ({ id: h.id, ...h.hitArea }))}
          />

          {/* sections 2 and 3 are still drawn in line (仮), for comparison */}
          <Barrel x={1928} y={G} />
          <Dog x={1560} y={G + 6} wagClass={`wag${r('dog')}`} />

          {/* 茶店 喜の字 */}
          <Shop x={1060} w={460} ground={G} noren={WASH.ochre} norenText="御休処" sign="喜の字" wall="#e3d6b8" norenClass="noren">
            <g>
              <rect x={1130} y={G - 44} width={170} height={10} fill={WASH.vermilion} stroke="#33291f" strokeWidth={1.2} />
              <path d={`M 1140 ${G - 34} v 34 M 1290 ${G - 34} v 34`} stroke="#33291f" strokeWidth={2} />
              <path d={`M 1232 ${G - 66} q 18 -14 36 0 v 18 h -36 Z`} fill={WASH.dim} stroke="#33291f" strokeWidth={1.2} />
            </g>
          </Shop>
          <Steam x={1248} y={G - 70} className={`steam${r('steam')}`} />
          <Shop x={1560} w={380} ground={G} noren={WASH.indigoPale} norenText="荒物" />

          {/* 米屋 and 太物屋: the street goes on */}
          <Shop x={540} w={400} ground={G} noren={WASH.green} norenText="米" />
          <Shop x={80} w={420} ground={G} noren={WASH.persimmon} norenText="太物" sign="" />

          {/* people of sections 2 and 3 */}
          <Figure x={1360} y={G} robe="#8c7a5a" hair="man" facing={-1} />
          <Figure x={1130} y={G} robe="#b77d6a" obi={WASH.indigo} hair="woman" pose="stand" />
          <Figure x={760} y={G} robe={WASH.ochre} hair="man" pose="carry">
            <path d="M -60 -114 L 60 -114" stroke={WASH.woodDark} strokeWidth={4} />
            <path d="M -56 -112 v 32 M 56 -112 v 32" stroke="#33291f" strokeWidth={1} />
            <path d="M -74 -80 h 36 l -6 26 h -24 Z M 38 -80 h 36 l -6 26 h -24 Z" fill={WASH.wood} stroke="#33291f" strokeWidth={1.2} />
          </Figure>

          {/* passers-by: kept out of the hotspot rows, never in the way */}
          <g className="walker w1">
            <Figure x={1700} y={G + 40} robe={WASH.green} hair="woman" pose="walk" scale={0.95} />
          </g>
          <g className="walker w2">
            <Figure x={900} y={G + 56} robe="#6e7f8f" hair="man" pose="walk" facing={-1} />
          </g>
        </svg>
      </div>

      {/* near: the edge of the road, a little in front */}
      <div className="layer" ref={(el) => void (layers.current[2] = el)} style={{ ...layerStyle(SCENE_W + 400), height: NEAR_H }}>
        <svg width={SCENE_W + 400} height={NEAR_H} viewBox={`0 0 ${SCENE_W + 400} ${NEAR_H}`} aria-hidden="true">
          {/* everything here sits below the picture (y ≥ 700), so it never covers the painted road */}
          <g transform="translate(0 46)">
          <rect x={0} y={SCENE_H - 30} width={SCENE_W + 400} height={NEAR_H - SCENE_H + 30} fill="#cbb890" />
          <path d={`M 0 ${SCENE_H - 40} Q 800 ${SCENE_H - 56} 1600 ${SCENE_H - 44} T 3400 ${SCENE_H - 48} V ${SCENE_H} H 0 Z`} fill="#cbb890" />
          {Array.from({ length: 34 }, (_, i) => (
            <ellipse key={i} cx={i * 100 + ((i * 41) % 60)} cy={SCENE_H - 22 + (i % 3) * 5} rx={10 + (i % 4) * 3} ry={5} fill="#a99673" opacity={0.7} />
          ))}
          {/* the gutter along the road, and a few things nearer than the street */}
          <path d={`M 0 ${SCENE_H - 6} H ${SCENE_W + 400}`} stroke="#8d7b5c" strokeWidth={10} />
          {Array.from({ length: 70 }, (_, i) => (
            <line key={i} x1={i * 50} y1={SCENE_H - 11} x2={i * 50} y2={SCENE_H - 1} stroke="#6f5f45" strokeWidth={1.2} />
          ))}
          {Array.from({ length: 18 }, (_, i) => (
            <path key={i} d={`M ${i * 190 + 40} ${SCENE_H - 40} q -4 -14 -10 -18 M ${i * 190 + 44} ${SCENE_H - 40} q 2 -16 8 -20`} stroke={WASH.green} strokeWidth={1.6} fill="none" />
          ))}
          </g>
        </svg>
      </div>
      </div>
    </div>
  );
}
