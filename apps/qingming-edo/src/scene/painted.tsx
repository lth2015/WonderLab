// 精絵（AI 生成、参考素材）— the whole street drawn as a painting, at the scale
// agreed with the China edition (docs/handoff/painted-worlds-style-decision-v1.md:
// main people 90 of 700 units, no passers-by baked in, a separate far layer,
// a long scroll loaded by section). Scene units: nine sections of 1000 × 700 at
// x 0–9000, read right to left from the bridge; the sky in them is transparent so
// the far layer shows. Art and scripts: docs/painted-worlds/art/edo/.
//
// People are separate transparent images: a pose changes with the story
// without repainting the street, and passers-by are placed, not painted in.

import type { SaveData } from '../contract';
import { hasFlag, questState } from '../engine/state';
import SIZES from '../assets/art/sizes.json';

const URLS = import.meta.glob('../assets/art/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const url = (name: string) => {
  const u = URLS[`../assets/art/${name}.webp`];
  if (!u) throw new Error(`missing art: ${name}`);
  return u;
};

export const SECTIONS = 9;
export const STREET = Array.from({ length: SECTIONS }, (_, k) => url(`street-${k}`));
/** The far layer: 8704 × 1024 px → 5950 × 700 units. */
export const FAR = { href: url('far'), w: 5950, h: 700 };

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
  seitaKneel: { x: 8500, y: 528 }, // on the paper shop's raised floor
  seitaStand: { x: 8520, y: 576 }, // in the street before the shop
  sokichi: { x: 8645, y: 562 }, // at the bridge foot
  okon: { x: 8205, y: 548 }, // before the tools shop
  kisuke: { x: 7660, y: 546 }, // at the tea house front
  oharu: { x: 7520, y: 572 }, // in the street before the tea house
  kinji: { x: 6680, y: 578 }, // resting before the rice shop
};

/**
 * Passers-by along the whole scroll (style decision #7): placed, never baked
 * into the street, and kept clear of the people the story is about. A fixed
 * pattern, so the street looks the same on every visit.
 */
const CROWD_IDS: SpriteId[] = [
  'crowd1-merchant', 'crowd2-samurai', 'crowd1-parasol', 'crowd2-apprentice',
  'crowd1-porter', 'crowd2-fishmonger', 'crowd1-monk', 'crowd2-elder',
];
export const CROWD = (() => {
  const out: { id: SpriteId; x: number; y: number; flip: boolean }[] = [];
  const keepClear = Object.values(SPOTS).map((p) => p.x);
  for (let i = 0; i < 34; i++) {
    const x = 180 + i * 262 + ((i * 137) % 110);
    if (x > 8960 || keepClear.some((k) => Math.abs(k - x) < 85)) continue;
    out.push({ id: CROWD_IDS[(i * 3) % CROWD_IDS.length], x, y: 588 + ((i * 53) % 62), flip: i % 3 === 0 });
  }
  return out;
})();

/** Each person's pose follows the story (spec §8 五状態). */
export interface Poses {
  seita: 'press' | 'bow' | 'stand';
  sokichi: SpriteId;
  okon: SpriteId;
  kisuke: SpriteId;
  oharu: SpriteId;
  kinji: SpriteId;
}

export function posesFor(s: SaveData): Poses {
  const pressed = hasFlag(s, 'paper_pressed');
  const kazeDone = questState(s, 'kaze') === 'complete';
  const dougu = questState(s, 'dougu');
  return {
    seita: kazeDone ? 'stand' : pressed ? 'bow' : 'press',
    sokichi: kazeDone ? 'sokichi-nod' : pressed ? 'sokichi-point' : 'sokichi-hold',
    // wiping lacquer until the errand; holding the bundle while it waits; a bow once it is home
    okon: dougu === 'complete' ? 'okon-bow' : hasFlag(s, 'dougu_wrapped') && !hasFlag(s, 'dougu_carry') ? 'okon-hold' : 'okon-wipe',
    kisuke: 'kisuke-teapot',
    oharu: hasFlag(s, 'dougu_entrusted') ? 'oharu-ask' : 'oharu-search',
    kinji: hasFlag(s, 'dougu_by_hand') ? 'kinji-nod' : 'kinji-rest',
  };
}

/** Loose sheets lifting in the wind beside 清太, until the weight is on them. */
function LooseSheets() {
  const l = { fill: '#f6efdf', stroke: '#514d3e', strokeWidth: 0.5, strokeLinejoin: 'round' as const };
  return (
    <g className="flap" transform="translate(6000 0)">
      <path d="M 2470 526 q 4 -13 16 -16 l 2 6 q -8 3 -12 11 Z" {...l} />
      <path d="M 2520 524 q 6 -15 18 -14 l -1 6 q -9 0 -13 9 Z" {...l} />
      <path d="M 2482 516 q 3 -11 11 -14 l 2 5 q -6 3 -8 10 Z" {...l} />
    </g>
  );
}

export interface PaintedProps {
  poses: Poses;
  /** Only sections in [from, to] are drawn (and so fetched): the scroll loads by section. */
  sections: [number, number];
  /** Ambient reactions on the painting: a soft glint where it was touched. */
  glints: { id: string; x: number; y: number; w: number; h: number }[];
}

const near = (x: number, [from, to]: [number, number]) => x >= from * 1000 - 120 && x <= (to + 1) * 1000 + 120;

export function PaintedStreet({ poses, sections, glints }: PaintedProps) {
  return (
    <g>
      {STREET.map((href, k) =>
        k < sections[0] || k > sections[1] ? null : (
          // a hair of overlap hides the seam that sub-pixel rounding would show
          <image key={k} href={href} x={k * 1000 - (k ? 0.5 : 0)} y={0} width={1000 + (k < SECTIONS - 1 ? 0.5 : 0)} height={700} preserveAspectRatio="none" />
        ),
      )}

      {glints.map((g) => (
        <ellipse key={g.id} className="glint" cx={g.x + g.w / 2} cy={g.y + g.h / 2} rx={g.w / 2 + 4} ry={g.h / 2 + 4} fill="#fff8e0" />
      ))}

      {CROWD.filter((c) => near(c.x, sections)).map((c) => (
        <Sprite key={`${c.id}-${c.x}`} {...c} />
      ))}
      <Sprite id={poses.kinji} {...SPOTS.kinji} />
      <Sprite id={poses.kisuke} {...SPOTS.kisuke} />
      <Sprite id={poses.oharu} {...SPOTS.oharu} />
      <Sprite id={poses.okon} {...SPOTS.okon} />
      {poses.seita === 'press' && <Sprite id="seita-press" {...SPOTS.seitaKneel} className="fret" />}
      {poses.seita === 'press' && <LooseSheets />}
      {poses.seita === 'bow' && <Sprite id="seita-bow" {...SPOTS.seitaKneel} />}
      {poses.seita === 'stand' && <Sprite id="seita-stand" {...SPOTS.seitaStand} />}
      <Sprite id={poses.sokichi} {...SPOTS.sokichi} />
    </g>
  );
}

// ---------------------------------------------------------------- journal pages

/**
 * A page cut from the painted street (二頁目 onwards): the world rectangle
 * starting at (x0, y0), w units wide, fills the page's picture area
 * (40, 40, 520 × 660 in PageArt), with the people of that moment on it.
 */
export function PaintedPageScene({ composition }: { composition: string }) {
  const view =
    composition === 'dougu-deliver'
      ? { x0: 6520, y0: 230, w: 330, people: [{ id: 'kinji-nod' as SpriteId, ...SPOTS.kinji }] }
      : {
          x0: 8050,
          y0: 230,
          w: 330,
          people: [
            { id: 'okon-bow' as SpriteId, ...SPOTS.okon },
            { id: 'oharu-ask' as SpriteId, x: SPOTS.okon.x + 52, y: SPOTS.okon.y + 14 },
          ],
        };
  const k = 520 / view.w;
  const first = Math.floor(view.x0 / 1000);
  return (
    <g transform={`translate(40 40) scale(${k}) translate(${-view.x0} ${-view.y0})`}>
      <rect x={view.x0 - 10} y={view.y0 - 10} width={view.w + 20} height={700} fill="#e1cfa6" />
      {STREET.map((href, i) =>
        i < first || i > first + 1 ? null : <image key={i} href={href} x={i * 1000} y={0} width={1000} height={700} preserveAspectRatio="none" />,
      )}
      {view.people.map((p) => (
        <Sprite key={p.id} id={p.id} x={p.x} y={p.y} />
      ))}
    </g>
  );
}
