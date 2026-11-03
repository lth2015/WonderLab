import type React from 'react';
import { useEffect, useRef, useState } from 'react';
// 精絵 — the street painted by Codex (codex/painted-worlds-art,
// docs/painted-worlds/art/edo-by-codex/), joined and mirrored by Claude so the
// bridge is on the right and the scroll reads right to left. Scene units: 14
// sections of 1000 × 700 at x 0–14000, and since roadmap #158 item 4 two more
// (14000–16000) across the bridge, painted by Claude from section 13 rightwards
// (docs/painted-worlds/art/edo/kashi-v1/); the distant town is in the painting.
//
// People are separate transparent images: a pose changes with the story
// without repainting the street, and passers-by are placed, not painted in.

import type { SaveData } from '../contract';
import { hasFlag, questState } from '../engine/state';
import { timeOf } from '../engine/time';
import SIZES from '../assets/art/sizes.json';
import { parseSketch, SCENE_W, type Reaction } from '../content/world';

const URLS = import.meta.glob('../assets/art/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const url = (name: string) => {
  const u = URLS[`../assets/art/${name}.webp`];
  if (!u) throw new Error(`missing art: ${name}`);
  return u;
};

/** Sections of 1000 units (style decision #14; 14–15 are the far bank, roadmap #158 item 4). */
export const SECTIONS = SCENE_W / 1000;
export const STREET: (string | null)[] = Array.from({ length: SECTIONS }, (_, k) => URLS[`../assets/art/street-${k}.webp`] ?? null);
/** The left end the camera may reach: the first painted section. */
export const SCENE_X0 = STREET.findIndex(Boolean) * 1000;

type SpriteId = keyof typeof SIZES;

function Sprite({ id, x, y, flip, className }: { id: SpriteId; x: number; y: number; flip?: boolean; className?: string }) {
  const s = SIZES[id];
  return (
    <g className={className}>
      <ellipse cx={x} cy={y - 1} rx={s.w * 0.38} ry={2.4} fill="#3c2d1e" opacity={0.16} />
      <image
        href={url(id)}
        x={x - s.w / 2}
        y={y - s.h}
        width={s.w}
        height={s.h}
        transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}
      />
    </g>
  );
}

/** Where people stand in the painting (their feet), read off the gridded art. */
export const SPOTS = {
  seitaKneel: { x: 12440, y: 538 }, // on the paper shop's raised floor
  seitaStand: { x: 12560, y: 590 }, // in the street before the shop
  sokichi: { x: 12640, y: 578 }, // in the street before the stone lantern, towards the bridge
  okon: { x: 12150, y: 562 }, // before the tools shop
  kisuke: { x: 11650, y: 546 }, // at the tea house front
  oharu: { x: 11400, y: 582 }, // in the street before the tea house
  kinji: { x: 7480, y: 572 }, // resting before the rice shop
  // across the bridge (河岸の朝): the quay is further back, so its people are drawn smaller
  omatsu: { x: 14700, y: 448 }, // before the first quay sheds
  kameHide: { x: 15482, y: 468 }, // crouched by the barrels at the far sheds
  kameHome: { x: 14748, y: 452 }, // beside his grandmother, once found
};

/**
 * Passers-by along the whole scroll (style decision #7): placed, never baked
 * into the street, and kept clear of the people the story is about. A fixed
 * pattern, so the street looks the same on every visit.
 */
// Each silhouette appears once in the entire roll. Curated road positions
// replace the old eight-sprite cycle (~40 copies at 300-unit intervals).
export const CROWD: { id: SpriteId; x: number; y: number; flip: boolean }[] = [
  { id: 'crowd2-samurai', x: 880, y: 612, flip: false },
  { id: 'crowd2-elder', x: 2300, y: 610, flip: true },
  { id: 'crowd1-monk', x: 3750, y: 608, flip: false },
  { id: 'crowd2-fishmonger', x: 5650, y: 610, flip: true },
  { id: 'crowd1-merchant', x: 8040, y: 610, flip: false },
  { id: 'crowd2-apprentice', x: 9550, y: 614, flip: true },
  { id: 'crowd1-parasol', x: 10780, y: 610, flip: false },
  { id: 'crowd1-porter', x: 12300, y: 624, flip: true },
];

/**
 * Roadside things in front of the painting. Some stand over a join where the
 * two paintings' curbs do not meet (docs/painted-worlds/art/edo/seams-v1).
 */
export const PROPS: { id: SpriteId; x: number; y: number; flip?: boolean }[] = [
  { id: 'props-cart', x: 3010, y: 640 }, // over the 11|12 join (unmirrored), curbs at two heights
];

/**
 * 町が動く (owner's demo feedback: 「人不能动」): each passer-by strolls back and forth
 * along their own stretch of road, first the way they face (the art faces left unless
 * flipped), turning at each end. Slow on purpose: about 22 units a second.
 */
export function walkOf(c: { x: number; flip: boolean }, i: number): { dx: number; dur: number; delay: number } {
  const length = 300 + ((i * 47) % 130); // 300–430 units
  const dx = c.flip ? length : -length;
  const dur = (2 * length) / 22; // there and back
  return { dx, dur, delay: -((i * 7.3) % dur) };
}

/**
 * The people of the stories are not cut-outs (owner's demo feedback: 「人不能动」): a slow
 * breath, each at their own pace. Only this wrapper is animated; the sprite keeps its
 * placement attributes.
 */
function Idle({ n, children }: { n: number; children: React.ReactNode }) {
  const style = { animationDuration: `${3.4 + (n % 4) * 0.45}s`, animationDelay: `${-n * 0.9}s` } as React.CSSProperties;
  return (
    <g className="idle" style={style}>
      {children}
    </g>
  );
}

/**
 * 町の気配 (owner's demo feedback 「场景简单」): small things that happen by themselves —
 * light on the water, a few sparrows crossing, steam over the tea kettle, a plum petal.
 * Quiet on purpose; drawn only for the sections in view; nothing with 動きを減らす.
 */
const WATER_ZONES = [
  { x0: 13520, x1: 13950, y0: 470, y1: 690 }, // the river under the bridge (clear of the moored boat)
  { x0: 13250, x1: 13520, y0: 655, y1: 690 }, // below the boat
  { x0: 14050, x1: 14450, y0: 480, y1: 690 }, // under the bridge, far side
  { x0: 14700, x1: 15700, y0: 615, y1: 695 }, // along the quay
  { x0: 15700, x1: 15950, y0: 400, y1: 600 }, // the open water past the quay
  { x0: 5050, x1: 5550, y0: 300, y1: 390 }, // the moat by the jetty
  { x0: 6050, x1: 6380, y0: 285, y1: 370 }, // the moat between the houses
  { x0: 1030, x1: 1220, y0: 370, y1: 440 }, // the garden pond
];
const FLOCKS = [1500, 4500, 7800, 10900, 13600, 15600]; // where a few sparrows cross, now and then
const PETALS = [{ x: 10660, y: 250 }, { x: 1910, y: 330 }];
const STEAM = { x: 11571, y: 392 };

function AmbientLife({ sections }: { sections: [number, number] }) {
  const inView = (x0: number, x1: number) => near(x0, sections) || near(x1, sections);
  const r = (i: number, a: number, b: number) => a + (((i * 61 + 17) % 97) / 97) * (b - a); // fixed spread
  return (
    <g className="life" aria-hidden="true" pointerEvents="none">
      {WATER_ZONES.filter((z) => inView(z.x0, z.x1)).map((z, zi) => {
        const n = Math.max(4, Math.round(((z.x1 - z.x0) * (z.y1 - z.y0)) / 9000));
        return (
          <g key={`w${zi}`} stroke="#ffffff" strokeLinecap="round">
            {Array.from({ length: n }, (_, i) => {
              const x = r(i + zi * 7, z.x0, z.x1 - 30);
              const y = r(i * 3 + zi, z.y0, z.y1);
              return <path key={i} className="shimmer" d={`M ${x} ${y} h ${r(i + 5, 24, 50)}`} strokeWidth={2.6} style={{ animationDelay: `${-r(i + zi, 0, 5)}s`, animationDuration: `${r(i + 2, 3.5, 6)}s` }} />;
            })}
          </g>
        );
      })}
      {FLOCKS.filter((x) => inView(x - 700, x + 700)).map((x, fi) => (
        <g key={`f${x}`} className="flock" style={{ animationDelay: `${-fi * 7}s`, animationDuration: `${24 + fi * 3}s` }}>
          {[0, 1, 2].map((i) => (
            <path key={i} className="wing" d={`M ${x + 600 + i * 16} ${110 + fi * 9 + (i % 2) * 8} q 3 -3 5 0 q 2 -3 5 0`} fill="none" stroke="#3b3326" strokeWidth={1.2} strokeLinecap="round" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </g>
      ))}
      {inView(STEAM.x - 50, STEAM.x + 50) &&
        [0, 1, 2].map((i) => <circle key={`s${i}`} className="steam-wisp" cx={STEAM.x + (i - 1) * 4} cy={STEAM.y} r={4 + i} fill="#fffdf6" style={{ animationDelay: `${i * 1.2}s` }} />)}
      {PETALS.filter((p) => inView(p.x - 100, p.x + 100)).map((p, pi) =>
        [0, 1].map((i) => <ellipse key={`p${pi}${i}`} className="petal" cx={p.x + (i ? 30 : -20)} cy={p.y} rx={2.4} ry={1.3} fill="#e7b9c2" style={{ animationDelay: `${-(pi * 3 + i * 4.5)}s` }} />),
      )}
    </g>
  );
}

/**
 * 夕暮れの灯: the stone lantern in the painting, and two street lamps (辻行灯) drawn here,
 * on posts at the road's edge. Unlit by day and until lit; lit, every evening after.
 */
export const STREET_LAMPS = [
  { x: 12745, y: 372, painted: true }, // the stone lantern's fire box
  { x: 7790, y: 604, painted: false }, // before the rice shop (foot of the post)
  { x: 5480, y: 524, painted: false }, // at the moat jetty
];
function StreetLamp({ x, y, painted, lit, glow }: { x: number; y: number; painted: boolean; lit: boolean; glow: boolean }) {
  const paper = lit ? '#ffe39a' : '#ddd5bf';
  return (
    <g aria-hidden="true">
      {!painted && (
        <>
          <ellipse cx={x} cy={y} rx={9} ry={2} fill="#3c2d1e" opacity={0.18} />
          <rect x={x - 1.6} y={y - 58} width={3.2} height={58} fill="#5a4630" />
          <rect x={x - 9} y={y - 82} width={18} height={24} fill={paper} stroke="#4a3a28" strokeWidth={1} />
          <path d={`M ${x - 9} ${y - 70} h 18 M ${x} ${y - 82} v 24`} stroke="#4a3a28" strokeWidth={0.6} />
          <path d={`M ${x - 12} ${y - 82} L ${x} ${y - 90} L ${x + 12} ${y - 82} Z`} fill="#3d3328" />
        </>
      )}
      {lit && glow && (
        <>
          <ellipse className="lamp-street" cx={x} cy={painted ? y : y - 70} rx={painted ? 34 : 48} ry={painted ? 30 : 40} fill="url(#lamp-glow-street)" />
          <ellipse cx={x} cy={painted ? y : y - 69} rx={painted ? 4 : 3} ry={painted ? 5 : 4.5} fill="#fff4cf" opacity={0.95} />
        </>
      )}
    </g>
  );
}

/** 朝 quieter, 昼 everyone, 夕 going home: who is out (the clerk of 母への文 always is). */
export function outAt(tod: 'morning' | 'noon' | 'evening', id: string, i: number): boolean {
  if (id === 'crowd1-merchant' || tod === 'noon') return true;
  return tod === 'morning' ? i % 3 !== 1 : i % 2 === 0;
}

/** 夕: lamps lit in the shop fronts and the stone lantern (scene units, read off the painting). */
const LAMPS: { x: number; y: number; r: number }[] = [
  { x: 12470, y: 430, r: 70 }, // 青葉屋
  { x: 12140, y: 430, r: 60 }, // くれ竹
  { x: 11570, y: 415, r: 60 }, // 茶店「喜の字」
  { x: 9300, y: 440, r: 70 }, // the cloth shop
  { x: 7670, y: 420, r: 55 }, // the rice shop
  { x: 4605, y: 420, r: 55 }, // the pottery
  { x: 4230, y: 430, r: 50 }, // the cooper
  { x: 14850, y: 395, r: 60 }, // the quay sheds
  { x: 15300, y: 395, r: 55 },
];
function TimeOfDayLayer({ tod, sections }: { tod: 'morning' | 'noon' | 'evening'; sections: [number, number] }) {
  if (tod === 'noon') return null;
  const inView = (x: number) => near(x, sections);
  if (tod === 'evening')
    return (
      <g className="tod-lamps" aria-hidden="true" pointerEvents="none">
        <defs>
          <radialGradient id="lamp-glow">
            <stop offset="0" stopColor="#ffd98a" stopOpacity={0.85} />
            <stop offset="0.45" stopColor="#ffbf63" stopOpacity={0.4} />
            <stop offset="1" stopColor="#ffb057" stopOpacity={0} />
          </radialGradient>
        </defs>
        {LAMPS.filter((l) => inView(l.x)).map((l, i) => (
          <ellipse key={i} className="lamp" cx={l.x} cy={l.y} rx={l.r} ry={l.r * (l.r < 20 ? 1 : 0.5)} fill="url(#lamp-glow)" style={{ animationDelay: `${-i * 0.7}s` }} />
        ))}
      </g>
    );
  // 朝: a thin mist low along the street and over the water
  const ks = Array.from({ length: sections[1] - sections[0] + 1 }, (_, i) => sections[0] + i);
  return (
    <g className="tod-mist" aria-hidden="true" pointerEvents="none">
      <defs>
        <radialGradient id="mist">
          <stop offset="0" stopColor="#f7f4ea" stopOpacity={0.75} />
          <stop offset="1" stopColor="#f7f4ea" stopOpacity={0} />
        </radialGradient>
      </defs>
      {ks.flatMap((k) => [
        <ellipse key={`a${k}`} className="mist" cx={k * 1000 + 300} cy={560} rx={620} ry={46} fill="url(#mist)" style={{ animationDelay: `${-k * 3}s` }} />,
        <ellipse key={`b${k}`} className="mist" cx={k * 1000 + 800} cy={470} rx={520} ry={34} fill="url(#mist)" style={{ animationDelay: `${-k * 3 - 8}s` }} />,
      ])}
    </g>
  );
}

/** A tap on a thing: something small and visible happens there for a moment. */
function ReactionFx({ kind, x, y, w, h }: { kind: Reaction; x: number; y: number; w: number; h: number }) {
  const cx = x + w / 2;
  const n = [0, 1, 2, 3, 4, 5];
  const many = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const v = (i: number, a: number, b: number) => a + ((i * 37) % 100) / 100 * (b - a); // fixed spread, no randomness
  const style = (vars: Record<string, string | number>) => vars as unknown as React.CSSProperties;
  switch (kind) {
    case 'leaves':
    case 'petals':
      return (
        <g className="fx" aria-hidden="true">
          {n.map((i) => (
            <ellipse key={i} className="fx-fall" cx={x + v(i, 0.15, 0.85) * w} cy={y + v(i + 3, 0.15, 0.5) * h} rx={kind === 'petals' ? 2.6 : 3.4} ry={1.5} fill={kind === 'petals' ? '#e7b9c2' : '#8f9e5e'} style={style({ '--dx': `${v(i, -26, 26)}px`, '--dy': `${v(i + 1, 50, 90)}px`, animationDelay: `${i * 0.07}s` })} />
          ))}
        </g>
      );
    case 'wind':
      return (
        <g className="fx" aria-hidden="true" fill="none" stroke="#fffaf0" strokeWidth={2} strokeLinecap="round">
          {[0.3, 0.5, 0.7].map((k, i) => (
            <path key={i} className="fx-wind" pathLength={1} d={`M ${x - 20} ${y + k * h} q ${w * 0.3} -10 ${w * 0.6} 0 t ${w * 0.6} 0`} style={style({ animationDelay: `${i * 0.12}s` })} />
          ))}
        </g>
      );
    case 'ripple':
      return (
        <g className="fx" aria-hidden="true" fill="none" stroke="#f4f1e4" strokeWidth={1.6}>
          {[0, 1, 2].map((i) => (
            <ellipse key={i} className="fx-ring" cx={cx} cy={y + h * 0.8} rx={Math.min(w, 160) * 0.25} ry={Math.min(w, 160) * 0.07} style={style({ animationDelay: `${i * 0.25}s` })} />
          ))}
        </g>
      );
    case 'steam':
      return (
        <g className="fx" aria-hidden="true" fill="#fffdf6">
          {[0, 1, 2].map((i) => (
            <circle key={i} className="fx-rise" cx={cx + (i - 1) * 6} cy={y + h * 0.3} r={6 + i * 2} style={style({ animationDelay: `${i * 0.18}s` })} />
          ))}
        </g>
      );
    case 'birds':
      return (
        <g className="fx" aria-hidden="true" fill="none" stroke="#3b3326" strokeWidth={1.4} strokeLinecap="round">
          {[0, 1, 2].map((i) => (
            <path key={i} className="fx-fly" d={`M ${cx - 5 + i * 9} ${y + h * 0.4 + i * 6} q 3 -3 5 0 q 2 -3 5 0`} style={style({ '--dx': `${(i - 1) * 30 + 15}px`, animationDelay: `${i * 0.1}s` })} />
          ))}
        </g>
      );
    case 'dust':
    case 'bubbles':
      return (
        <g className="fx" aria-hidden="true" fill={kind === 'bubbles' ? '#4d6282' : '#d9c9a3'}>
          {many.map((i) => (
            <circle key={i} className={kind === 'bubbles' ? 'fx-bubble' : 'fx-dust'} cx={cx + v(i, -0.35, 0.35) * w} cy={y + h * (kind === 'bubbles' ? 0.45 : 0.85)} r={kind === 'bubbles' ? 2.8 : 2.6} style={style({ '--dx': `${v(i, -30, 30)}px`, '--dy': `${-v(i + 2, 14, 34)}px`, animationDelay: `${i * 0.04}s` })} />
          ))}
        </g>
      );
  }
}

/** Each person's pose follows the story (spec §8 五状態). */
export interface Poses {
  seita: 'press' | 'bow' | 'stand';
  sokichi: SpriteId;
  okon: SpriteId;
  kisuke: SpriteId;
  oharu: SpriteId;
  kinji: SpriteId;
  omatsu: SpriteId;
  /** null: not in the picture (before he is looked for). */
  kame: { id: SpriteId; at: 'hide' | 'home' } | null;
  /** 母への文: the folded letter on the road, until it is picked up. */
  fumi: boolean;
  /** 朝・昼・夕: how many people are out, morning mist, lamps lit in the evening. */
  tod: 'morning' | 'noon' | 'evening';
  /** 夕暮れの灯: which of the three lamps have been lit (they stay lit every evening after). */
  lit: [boolean, boolean, boolean];
  /** 茶店の猫: where 喜助's cat is (null: away, or in the player's arms). */
  neko: NekoAt | null;
}

export function posesFor(s: SaveData): Poses {
  const pressed = hasFlag(s, 'paper_pressed');
  const kazeDone = questState(s, 'kaze') === 'complete';
  const dougu = questState(s, 'dougu');
  const kashiDone = questState(s, 'kashi') === 'complete';
  return {
    seita: kazeDone ? 'stand' : pressed ? 'bow' : 'press',
    sokichi: kazeDone ? 'sokichi-nod' : pressed ? 'sokichi-point' : 'sokichi-hold',
    // wiping lacquer until the errand; holding the bundle while it waits; a bow once it is home
    okon: dougu === 'complete' ? 'okon-bow' : hasFlag(s, 'dougu_wrapped') && !hasFlag(s, 'dougu_carry') ? 'okon-hold' : 'okon-wipe',
    kisuke: questState(s, 'tenugui') === 'complete' ? 'kisuke-bow' : hasFlag(s, 'tenugui_asked') && !hasFlag(s, 'tenugui_clue') ? 'kisuke-pour' : 'kisuke-teapot',
    oharu: questState(s, 'tenugui') === 'complete' ? 'oharu-found' : hasFlag(s, 'tenugui_asked') || hasFlag(s, 'dougu_entrusted') ? 'oharu-ask' : 'oharu-search',
    kinji: hasFlag(s, 'dougu_by_hand') ? 'kinji-nod' : 'kinji-rest',
    // sitting at her stall; looking round for 亀吉 once he is missed; smiling when he is home
    omatsu: kashiDone ? 'omatsu-smile' : kazeDone ? 'omatsu-look' : 'omatsu-sit',
    kame: kashiDone
      ? { id: hasFlag(s, 'kashi_watched') ? 'kame-point' : 'kame-shy', at: 'home' }
      : hasFlag(s, 'kashi_search')
        ? { id: 'kame-hide', at: 'hide' }
        : null,
    fumi: kazeDone && questState(s, 'fumi') !== 'complete' && !hasFlag(s, 'fumi_carry'),
    tod: timeOf(s),
    lit: [1, 2, 3].map((n) => hasFlag(s, `yube_lit${n}`)) as [boolean, boolean, boolean],
    neko:
      questState(s, 'neko') === 'complete'
        ? 'home'
        : hasFlag(s, 'neko_caught')
          ? null
          : hasFlag(s, 'neko_hop2')
            ? 3
            : hasFlag(s, 'neko_hop1')
              ? 2
              : hasFlag(s, 'neko_look')
                ? 1
                : null,
  };
}

/** 茶店の猫: on the well's rim, by the rice bales, on the moat steps; then asleep by the tea house. */
export type NekoAt = 1 | 2 | 3 | 'home';
export const NEKO_AT: Record<NekoAt, { id: SpriteId; x: number; y: number; flip?: boolean }> = {
  1: { id: 'neko-sit', x: 10610, y: 437 },
  2: { id: 'neko-loaf', x: 7640, y: 472 },
  3: { id: 'neko-sit', x: 5468, y: 484 }, // on the stone landing, looking at the boat
  home: { id: 'neko-loaf', x: 11700, y: 548 },
};

/**
 * The cat where it is; when it moves on while the player watches, it is seen leaping away
 * from where it was (towards where it went). Only this inner group is animated (lesson of #157).
 */
function Neko({ at, sections }: { at: NekoAt | null; sections: [number, number] }) {
  const prev = useRef(at);
  const [leaving, setLeaving] = useState<{ from: NekoAt; left: boolean; k: number } | null>(null);
  useEffect(() => {
    const from = prev.current;
    prev.current = at;
    // picked up at the moat (→ null) or brought home: no leap
    if (from === null || at === null || from === at || at === 'home') return;
    setLeaving({ from, left: NEKO_AT[at].x < NEKO_AT[from].x, k: Date.now() });
    const t = setTimeout(() => setLeaving(null), 1300);
    return () => clearTimeout(t);
  }, [at]);
  const here = at === null ? null : NEKO_AT[at];
  const gone = leaving && NEKO_AT[leaving.from];
  return (
    <>
      {here && near(here.x, sections) && (
        <Idle n={9}>
          <Sprite id={here.id} x={here.x} y={here.y} flip={here.flip} />
        </Idle>
      )}
      {gone && near(gone.x, sections) && (
        <g key={leaving!.k} aria-hidden="true">
          <g className="neko-leave" style={{ '--dx': `${leaving!.left ? -150 : 150}px` } as React.CSSProperties}>
            <Sprite id="neko-run" x={gone.x} y={gone.y - 4} flip={!leaving!.left} />
          </g>
        </g>
      )}
    </>
  );
}

/** 母への文: a folded letter on the road before the rice shop (drawn, attributes only). */
export const LETTER = { x: 7700, y: 612 };
function DroppedLetter() {
  const { x, y } = LETTER;
  return (
    <g aria-hidden="true">
      <ellipse cx={x} cy={y + 2} rx={13} ry={2.4} fill="#3c2d1e" opacity={0.16} />
      <path d={`M ${x - 12} ${y} L ${x + 10} ${y - 3} L ${x + 12} ${y + 2} L ${x - 10} ${y + 5} Z`} fill="#f4ecd8" stroke="#6b5a40" strokeWidth={0.6} strokeLinejoin="round" />
      <path d={`M ${x - 1} ${y - 1.5} L ${x + 1} ${y + 3.5}`} stroke="#6b5a40" strokeWidth={0.5} />
      <path d={`M ${x - 7} ${y + 1} l 4 -0.6 M ${x - 7} ${y + 2.6} l 3 -0.4`} stroke="#33291f" strokeWidth={0.45} opacity={0.7} />
    </g>
  );
}

/** Loose sheets lifting in the wind beside 清太, until the weight is on them. */
function LooseSheets() {
  const edge = { stroke: '#887957', strokeWidth: 0.55, strokeLinejoin: 'round' as const };
  return (
    <g transform={`translate(${SPOTS.seitaKneel.x - 2500} ${SPOTS.seitaKneel.y - 528})`}>
      <g fill="#66563b" opacity={0.13}>
        <ellipse cx={2483} cy={537} rx={12} ry={1.8} />
        <ellipse cx={2532} cy={536} rx={11} ry={1.6} />
      </g>
      {/* Keep scene placement outside the CSS transform animation. */}
      <g className="flap">
        {/* Broad paper faces and shaded turned corners read even without motion. */}
        <path d="M 2470 524 L 2489 517 Q 2493 523 2499 530 L 2480 538 Q 2475 532 2470 524 Z" fill="#e9dfc5" {...edge} />
        <path d="M 2470 524 Q 2476 522 2477 517 L 2483 519 Q 2479 526 2473 529 Z" fill="#d5c6a6" {...edge} />
        <path d="M 2474 524 Q 2479 523 2480 519 M 2481 535 L 2496 529" fill="none" stroke="#fbf0d8" strokeWidth={0.65} />
        <path d="M 2520 521 L 2539 517 L 2545 531 L 2525 536 Q 2524 528 2520 521 Z" fill="#e9dfc5" {...edge} />
        <path d="M 2532 519 Q 2539 518 2539 513 Q 2544 516 2545 522 L 2541 524 Q 2538 520 2532 519 Z" fill="#d5c6a6" {...edge} />
        <path d="M 2527 533 L 2542 530 M 2536 518 Q 2540 518 2541 516" fill="none" stroke="#fbf0d8" strokeWidth={0.65} />
      </g>
    </g>
  );
}

export interface PaintedProps {
  poses: Poses;
  /** Only sections in [from, to] are drawn (and so fetched): the scroll loads by section. */
  sections: [number, number];
  /** Ambient reactions on the painting: a soft glint where it was touched. */
  glints: { id: string; x: number; y: number; w: number; h: number; reaction?: Reaction }[];
  /** Passers-by who were just spoken to: they stop where they are for a moment. */
  stopped?: string[];
}

const near = (x: number, [from, to]: [number, number]) => x >= from * 1000 - 120 && x <= (to + 1) * 1000 + 120;

export function PaintedStreet({ poses, sections, glints, stopped = [] }: PaintedProps) {
  return (
    <g>
      <defs>
        <radialGradient id="lamp-glow-street">
          <stop offset="0" stopColor="#ffd98a" stopOpacity={0.9} />
          <stop offset="0.45" stopColor="#ffbf63" stopOpacity={0.45} />
          <stop offset="1" stopColor="#ffb057" stopOpacity={0} />
        </radialGradient>
      </defs>
      {STREET.map((href, k) =>
        !href || k < sections[0] || k > sections[1] ? null : (
          // a hair of overlap hides the seam that sub-pixel rounding would show
          <image key={k} href={href} x={k * 1000 - (k ? 0.5 : 0)} y={0} width={1000 + (k < SECTIONS - 1 ? 0.5 : 0)} height={700} preserveAspectRatio="none" />
        ),
      )}

      <AmbientLife sections={sections} />
      <TimeOfDayLayer tod={poses.tod} sections={sections} />
      {STREET_LAMPS.map((l, i) => (near(l.x, sections) ? <StreetLamp key={i} {...l} lit={poses.lit[i] && poses.tod === 'evening'} glow={poses.tod === 'evening'} /> : null))}
      {glints.map((g) => (
        <g key={g.id}>
          <ellipse className="glint" cx={g.x + g.w / 2} cy={g.y + g.h / 2} rx={g.w / 2 + 4} ry={g.h / 2 + 4} fill="#fff8e0" />
          {g.reaction && <ReactionFx kind={g.reaction} {...g} />}
        </g>
      ))}

      {PROPS.filter((c) => near(c.x, sections)).map((c) => (
        <Sprite key={`${c.id}-${c.x}`} {...c} />
      ))}
      {CROWD.filter((c, i) => outAt(poses.tod, c.id, i) && (near(c.x, sections) || near(c.x + walkOf(c, i).dx, sections))).map((c) => {
        const w = walkOf(c, CROWD.indexOf(c));
        // placement stays in attributes; only the inner groups are animated (lesson of #157)
        return (
          <g key={`${c.id}-${c.x}`} className={stopped.includes(c.id) ? 'walker stopped' : 'walker'} data-walker={c.id} style={{ '--dx': `${w.dx}px`, '--dur': `${w.dur}s`, animationDelay: `${w.delay}s` } as React.CSSProperties}>
            <g className="walker-face" style={{ animationDelay: `${w.delay}s` } as React.CSSProperties}>
              <g className="walker-bob">
                <Sprite {...c} />
              </g>
            </g>
          </g>
        );
      })}
      <Idle n={0}>
        <Sprite id={poses.kinji} {...SPOTS.kinji} />
      </Idle>
      <Idle n={1}>
        <Sprite id={poses.kisuke} {...SPOTS.kisuke} />
      </Idle>
      <Idle n={2}>
        <Sprite id={poses.oharu} {...SPOTS.oharu} />
      </Idle>
      <Idle n={3}>
        <Sprite id={poses.okon} {...SPOTS.okon} />
      </Idle>
      {poses.seita === 'press' && <Sprite id="seita-press" {...SPOTS.seitaKneel} className="fret" />}
      {poses.seita === 'press' && <LooseSheets />}
      {poses.fumi && <DroppedLetter />}
      <Neko at={poses.neko} sections={sections} />
      {poses.seita === 'bow' && (
        <Idle n={7}>
          <Sprite id="seita-bow" {...SPOTS.seitaKneel} />
        </Idle>
      )}
      {poses.seita === 'stand' && (
        <Idle n={8}>
          <Sprite id="seita-stand" {...SPOTS.seitaStand} />
        </Idle>
      )}
      <Idle n={4}>
        <Sprite id={poses.sokichi} {...SPOTS.sokichi} />
      </Idle>
      <Idle n={5}>
        <Sprite id={poses.omatsu} {...SPOTS.omatsu} />
      </Idle>
      {poses.kame && (
        <Idle n={6}>
          <Sprite id={poses.kame.id} {...(poses.kame.at === 'hide' ? SPOTS.kameHide : SPOTS.kameHome)} />
        </Idle>
      )}
    </g>
  );
}

// ---------------------------------------------------------------- journal pages

/** 朝 a little pale and cool, 昼 as painted, 夕 warm and lower (like the street's CSS filters). */
const PAGE_TINT: Record<'morning' | 'noon' | 'evening', string | null> = {
  morning: '1.02 0 0 0 0.01  0 1.03 0 0 0.01  0 0 1.06 0 0.015  0 0 0 1 0',
  noon: null,
  evening: '0.97 0.06 0.01 0 0.015  0.03 0.92 0.02 0 0  0.01 0.03 0.82 0 0  0 0 0 1 0',
};

type Person = { id: SpriteId; x: number; y: number; flip?: boolean };
/**
 * 一頁目 (風のいたずら): the subject × framing the player chose, at the paper
 * shop, in the moment after the papers were held down.
 */
const KAZE_VIEWS: Record<string, { x0: number; y0: number; w: number; people: Person[] }> = {
  'hands-near': { x0: 12330, y0: 330, w: 230, people: [{ id: 'seita-press', ...SPOTS.seitaKneel }] },
  'hands-wide': { x0: 12250, y0: 190, w: 360, people: [{ id: 'seita-press', ...SPOTS.seitaKneel }] },
  'shopfront-near': { x0: 12335, y0: 250, w: 290, people: [{ id: 'seita-bow', ...SPOTS.seitaStand }] },
  'shopfront-wide': { x0: 12190, y0: 110, w: 440, people: [{ id: 'seita-bow', ...SPOTS.seitaStand }] },
  'street-near': {
    x0: 12380,
    y0: 240,
    w: 330,
    people: [
      { id: 'seita-stand', ...SPOTS.seitaStand },
      { id: 'crowd1-porter', x: 12450, y: 628, flip: true },
      { id: 'sokichi-nod', ...SPOTS.sokichi },
    ],
  },
  'street-wide': {
    x0: 12120,
    y0: 40,
    w: 520,
    people: [
      { id: 'crowd2-samurai', x: 12200, y: 612 },
      { id: 'seita-stand', ...SPOTS.seitaStand },
      { id: 'crowd1-parasol', x: 12360, y: 630, flip: true },
      { id: 'crowd1-porter', x: 12470, y: 624, flip: true },
      { id: 'sokichi-nod', ...SPOTS.sokichi },
    ],
  },
};

/**
 * 八頁目 (橋のたもと): everyone the player helped, on the open ground before the bridge,
 * two rows (the back row higher up the road). 宗吉 at the end, if the player asked him in.
 */
function hashiGroup(withMaster: boolean): Person[] {
  const back: Person[] = [
    { id: 'seita-stand', x: 12720, y: 505 },
    { id: 'okon-bow', x: 12765, y: 507 },
    { id: 'kinji-nod', x: 12818, y: 505 },
    { id: 'oharu-found', x: 12872, y: 507 },
    { id: 'kisuke-teapot', x: 12928, y: 505 },
  ];
  const front: Person[] = [
    { id: 'omatsu-smile', x: 12700, y: 566 },
    { id: 'kame-shy', x: 12736, y: 568 },
    { id: 'crowd1-merchant', x: 12800, y: 566 },
    ...(withMaster ? [{ id: 'sokichi-nod' as SpriteId, x: 12862, y: 562 }] : []),
  ];
  return [...back, ...front];
}

/**
 * A page cut from the painted street: the world rectangle starting at
 * (x0, y0), w units wide, fills the page's picture area (40, 40, 520 × 660
 * in PageArt), with the people of that moment on it.
 */
export function PaintedPageScene({ composition }: { composition: string }) {
  const sk = parseSketch(composition);
  const kz = /^kaze-([a-z]+-(?:near|wide))$/.exec(composition);
  const view: { x0: number; y0: number; w: number; people: Person[] } = sk
    ? { ...sk.sketch.view, people: [] }
    : kz && KAZE_VIEWS[kz[1]]
      ? KAZE_VIEWS[kz[1]]
      : composition === 'tenugui-return'
      ? {
          x0: SPOTS.oharu.x - 60,
          y0: 240,
          w: 330,
          people: [
            { id: 'kisuke-bow' as SpriteId, ...SPOTS.kisuke },
            { id: 'oharu-found' as SpriteId, ...SPOTS.oharu },
          ],
        }
      : composition === 'hashi-with' || composition === 'hashi-side'
      ? { x0: 12620, y0: 190, w: 400, people: hashiGroup(composition === 'hashi-with') }
      : composition === 'neko-bench'
      ? {
          x0: SPOTS.kisuke.x - 170,
          y0: 250,
          w: 340,
          people: [
            { id: 'kisuke-pour' as SpriteId, ...SPOTS.kisuke },
            { ...NEKO_AT.home },
          ],
        }
      : composition === 'neko-boat'
      ? { x0: 5330, y0: 300, w: 270, people: [{ ...NEKO_AT[3] }] }
      : composition === 'ai-vat'
      ? { x0: 3130, y0: 205, w: 300, people: [] }
      : composition === 'ai-cloth'
      ? { x0: 2990, y0: 60, w: 420, people: [] }
      : composition === 'yube-tell'
      ? { x0: 12560, y0: 250, w: 360, people: [{ id: 'sokichi-nod' as SpriteId, ...SPOTS.sokichi }] }
      : composition === 'yube-watch'
      ? { x0: SPOTS.kisuke.x - 170, y0: 250, w: 340, people: [{ id: 'kisuke-pour' as SpriteId, ...SPOTS.kisuke }] }
            : composition === 'fumi-send' || composition === 'fumi-rewrite'
      ? {
          // the clerk with his letter by the rice shop; the rewrite page stands further back
          x0: composition === 'fumi-send' ? 7830 : 7740,
          y0: composition === 'fumi-send' ? 330 : 210,
          w: composition === 'fumi-send' ? 260 : 380,
          people: [{ id: 'crowd1-merchant' as SpriteId, x: 7960, y: 610, flip: composition === 'fumi-rewrite' }],
        }
            : composition === 'kashi-now'
      ? {
          x0: SPOTS.omatsu.x - 150,
          y0: 230,
          w: 300,
          people: [
            { id: 'omatsu-smile' as SpriteId, ...SPOTS.omatsu },
            { id: 'kame-shy' as SpriteId, ...SPOTS.kameHome },
          ],
        }
      : composition === 'kashi-watch'
      ? {
          // the two of them by the barrels, the boats below
          x0: SPOTS.kameHide.x - 210,
          y0: 260,
          w: 330,
          people: [{ id: 'kame-point' as SpriteId, ...SPOTS.kameHide }],
        }
      : composition === 'dougu-deliver'
      ? { x0: SPOTS.kinji.x - 165, y0: 240, w: 330, people: [{ id: 'kinji-nod' as SpriteId, ...SPOTS.kinji }] }
      : {
          x0: SPOTS.okon.x - 140,
          y0: 240,
          w: 330,
          people: [
            { id: 'okon-bow' as SpriteId, ...SPOTS.okon },
            { id: 'oharu-ask' as SpriteId, x: SPOTS.okon.x + 52, y: SPOTS.okon.y + 14 },
          ],
        };
  const k = 520 / view.w;
  const first = Math.floor(view.x0 / 1000);
  // the time it was drawn, as a colour matrix inside the SVG (so a saved PNG keeps it)
  // 夕暮れの灯 is always an evening page; sketches keep the time they were drawn
  const pageTod: 'morning' | 'noon' | 'evening' | null = sk ? sk.tod : composition.startsWith('yube-') ? 'evening' : composition.startsWith('ai-') ? 'morning' : null;
  const tint = pageTod ? PAGE_TINT[pageTod] : null;
  return (
    <g transform={`translate(40 40) scale(${k}) translate(${-view.x0} ${-view.y0})`} filter={tint ? `url(#page-tint-${pageTod})` : undefined}>
      {tint && (
        <filter id={`page-tint-${pageTod}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={tint} />
        </filter>
      )}
      {composition.startsWith('yube-') && (
        <defs>
          <radialGradient id="lamp-glow-street">
            <stop offset="0" stopColor="#ffd98a" stopOpacity={0.9} />
            <stop offset="0.45" stopColor="#ffbf63" stopOpacity={0.45} />
            <stop offset="1" stopColor="#ffb057" stopOpacity={0} />
          </radialGradient>
        </defs>
      )}
      <rect x={view.x0 - 10} y={view.y0 - 10} width={view.w + 20} height={700} fill="#e1cfa6" />
      {STREET.map((href, i) =>
        !href || i < first || i > first + 1 ? null : <image key={i} href={href!} x={i * 1000} y={0} width={1000} height={700} preserveAspectRatio="none" />,
      )}
      {composition.startsWith('yube-') && STREET_LAMPS.map((l, i) => <StreetLamp key={i} {...l} lit glow />)}
      {view.people.map((p) => (
        <Sprite key={p.id} id={p.id} x={p.x} y={p.y} flip={p.flip} />
      ))}
    </g>
  );
}
