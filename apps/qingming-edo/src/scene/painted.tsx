// 精絵（AI 生成、参考素材）— the whole street drawn as a painting, at the scale
// agreed with the China edition (docs/handoff/painted-worlds-style-decision-v1.md:
// main people 90 of 700 units, no passers-by baked in, a separate far layer).
// Scene units: three sections of 1000 × 700 at x 0–3000; the sky in them is
// transparent so the far layer shows. Art and scripts: docs/painted-worlds/art/edo/.
//
// Characters are separate transparent images: a pose changes with the story
// without repainting the street.

import far from '../assets/art/far.webp';
import street0 from '../assets/art/street-0.webp';
import street1 from '../assets/art/street-1.webp';
import street2 from '../assets/art/street-2.webp';
import seitaPress from '../assets/art/seita-press.webp';
import seitaBow from '../assets/art/seita-bow.webp';
import seitaStand from '../assets/art/seita-stand.webp';
import sokichiHold from '../assets/art/sokichi-hold.webp';
import sokichiPoint from '../assets/art/sokichi-point.webp';
import sokichiNod from '../assets/art/sokichi-nod.webp';
import okonHold from '../assets/art/okon-hold.webp';
import okonWipe from '../assets/art/okon-wipe.webp';
import okonBow from '../assets/art/okon-bow.webp';
import kinjiNod from '../assets/art/kinji-nod.webp';
import oharuAsk from '../assets/art/oharu-ask.webp';
import type { SaveData } from '../contract';
import { hasFlag, questState } from '../engine/state';
import kisukeTeapot from '../assets/art/kisuke-teapot.webp';
import oharuSearch from '../assets/art/oharu-search.webp';
import kinjiRest from '../assets/art/kinji-rest.webp';

export const STREET = [street0, street1, street2];
/** The far layer: 3584 × 1024 px → 2450 × 700 units. */
export const FAR = { href: far, w: 2450, h: 700 };

/** Sprite sizes in scene units (from the cut-out script; width × height). */
const SPRITES = {
  seitaPress: { href: seitaPress, w: 45.1, h: 49.2 },
  seitaBow: { href: seitaBow, w: 32.8, h: 52 },
  seitaStand: { href: seitaStand, w: 28.7, h: 89.9 },
  sokichiHold: { href: sokichiHold, w: 30.4, h: 89.9 },
  sokichiPoint: { href: sokichiPoint, w: 41, h: 88.5 },
  sokichiNod: { href: sokichiNod, w: 28.7, h: 89.6 },
  okonHold: { href: okonHold, w: 28.7, h: 89.9 },
  okonWipe: { href: okonWipe, w: 28.7, h: 89.6 },
  okonBow: { href: okonBow, w: 26.7, h: 86.8 },
  kisukeTeapot: { href: kisukeTeapot, w: 41.7, h: 89.9 },
  oharuSearch: { href: oharuSearch, w: 41, h: 89.9 },
  oharuAsk: { href: oharuAsk, w: 32.1, h: 84.4 },
  kinjiRest: { href: kinjiRest, w: 55.7, h: 85.4 },
  kinjiNod: { href: kinjiNod, w: 46.1, h: 89.9 },
} as const;
type SpriteId = keyof typeof SPRITES;

function Sprite({ id, x, y, className }: { id: SpriteId; x: number; y: number; className?: string }) {
  const s = SPRITES[id];
  return (
    <g className={className}>
      <ellipse cx={x} cy={y - 1} rx={s.w * 0.38} ry={2.4} fill="#3c2d1e" opacity={0.16} />
      <image href={s.href} x={x - s.w / 2} y={y - s.h} width={s.w} height={s.h} />
    </g>
  );
}

/** Where people stand in the painting (their feet), read off the gridded art. */
export const SPOTS = {
  seitaKneel: { x: 2500, y: 528 }, // on the paper shop's raised floor
  seitaStand: { x: 2520, y: 576 }, // in the street before the shop
  sokichi: { x: 2645, y: 562 }, // at the bridge foot
  okon: { x: 2205, y: 548 }, // before the tools shop
  kisuke: { x: 1660, y: 546 }, // at the tea house front
  oharu: { x: 1520, y: 572 }, // in the street before the tea house
  kinji: { x: 680, y: 578 }, // resting before the rice shop
};

/** Loose sheets lifting in the wind beside 清太, until the weight is on them. */
function LooseSheets() {
  const l = { fill: '#f6efdf', stroke: '#514d3e', strokeWidth: 0.5, strokeLinejoin: 'round' as const };
  return (
    <g className="flap">
      <path d="M 2470 526 q 4 -13 16 -16 l 2 6 q -8 3 -12 11 Z" {...l} />
      <path d="M 2520 524 q 6 -15 18 -14 l -1 6 q -9 0 -13 9 Z" {...l} />
      <path d="M 2482 516 q 3 -11 11 -14 l 2 5 q -6 3 -8 10 Z" {...l} />
    </g>
  );
}

/** Each person's pose follows the story (spec §8 五状態); null = not on the street. */
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
    sokichi: kazeDone ? 'sokichiNod' : pressed ? 'sokichiPoint' : 'sokichiHold',
    // wiping lacquer until the errand; holding the bundle while it waits; a bow once it is home
    okon: dougu === 'complete' ? 'okonBow' : hasFlag(s, 'dougu_wrapped') && !hasFlag(s, 'dougu_carry') ? 'okonHold' : 'okonWipe',
    kisuke: 'kisukeTeapot',
    oharu: hasFlag(s, 'dougu_entrusted') ? 'oharuAsk' : 'oharuSearch',
    kinji: hasFlag(s, 'dougu_by_hand') ? 'kinjiNod' : 'kinjiRest',
  };
}

export interface PaintedProps {
  poses: Poses;
  /** Ambient reactions on the painting: a soft glint where it was touched. */
  glints: { id: string; x: number; y: number; w: number; h: number }[];
}

export function PaintedStreet({ poses, glints }: PaintedProps) {
  return (
    <g>
      {STREET.map((href, k) => (
        // a hair of overlap hides the seam that sub-pixel rounding would show
        <image key={k} href={href} x={k * 1000 - (k ? 0.5 : 0)} y={0} width={1000 + (k < 2 ? 0.5 : 0)} height={700} preserveAspectRatio="none" />
      ))}

      {glints.map((g) => (
        <ellipse key={g.id} className="glint" cx={g.x + g.w / 2} cy={g.y + g.h / 2} rx={g.w / 2 + 4} ry={g.h / 2 + 4} fill="#fff8e0" />
      ))}

      <Sprite id={poses.kinji} {...SPOTS.kinji} />
      <Sprite id={poses.kisuke} {...SPOTS.kisuke} />
      <Sprite id={poses.oharu} {...SPOTS.oharu} />
      <Sprite id={poses.okon} {...SPOTS.okon} />
      {poses.seita === 'press' && <Sprite id="seitaPress" {...SPOTS.seitaKneel} className="fret" />}
      {poses.seita === 'press' && <LooseSheets />}
      {poses.seita === 'bow' && <Sprite id="seitaBow" {...SPOTS.seitaKneel} />}
      {poses.seita === 'stand' && <Sprite id="seitaStand" {...SPOTS.seitaStand} />}
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
      ? { x0: 520, y0: 230, w: 330, people: [{ id: 'kinjiNod' as SpriteId, ...SPOTS.kinji }] }
      : {
          x0: 2050,
          y0: 230,
          w: 330,
          people: [
            { id: 'okonBow' as SpriteId, ...SPOTS.okon },
            { id: 'oharuAsk' as SpriteId, x: SPOTS.okon.x + 52, y: SPOTS.okon.y + 14 },
          ],
        };
  const k = 520 / view.w;
  return (
    <g transform={`translate(40 40) scale(${k}) translate(${-view.x0} ${-view.y0})`}>
      <rect x={view.x0 - 10} y={view.y0 - 10} width={view.w + 20} height={700} fill="#e1cfa6" />
      {STREET.map((href, i) => (
        <image key={i} href={href} x={i * 1000} y={0} width={1000} height={700} preserveAspectRatio="none" />
      ))}
      {view.people.map((p) => (
        <Sprite key={p.id} id={p.id} x={p.x} y={p.y} />
      ))}
    </g>
  );
}
