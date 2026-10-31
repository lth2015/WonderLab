// 精絵（AI 生成、仮）— the first section of the street drawn as a painting
// (docs/painted-worlds/art/edo/README.md). Scene units: the section image is
// 1000 × 700 at x 2000–3000; characters stand on their feet at (x, y).
//
// Characters are separate transparent images, so a pose can change with the
// story without repainting the street (style decision draft #7, #8).

import section from '../assets/art/section-hashizume.webp';
import seitaPress from '../assets/art/seita-press.webp';
import seitaBow from '../assets/art/seita-bow.webp';
import seitaStand from '../assets/art/seita-stand.webp';
import sokichiHold from '../assets/art/sokichi-hold.webp';
import sokichiPoint from '../assets/art/sokichi-point.webp';
import sokichiNod from '../assets/art/sokichi-nod.webp';
import okonHold from '../assets/art/okon-hold.webp';
import okonWipe from '../assets/art/okon-wipe.webp';

export const PAINTED_X0 = 2000;
export const PAINTED_W = 1000;

/** Sprite sizes in scene units (from the cut-out script; width × height). */
const SPRITES = {
  seitaPress: { href: seitaPress, w: 72.1, h: 78.6 },
  seitaBow: { href: seitaBow, w: 52.3, h: 83.1 },
  seitaStand: { href: seitaStand, w: 45.5, h: 143.6 },
  sokichiHold: { href: sokichiHold, w: 48.5, h: 143.6 },
  sokichiPoint: { href: sokichiPoint, w: 65.3, h: 140.8 },
  sokichiNod: { href: sokichiNod, w: 45.8, h: 142.9 },
  okonHold: { href: okonHold, w: 45.8, h: 143.6 },
  okonWipe: { href: okonWipe, w: 45.8, h: 142.5 },
} as const;
type SpriteId = keyof typeof SPRITES;

function Sprite({ id, x, y, className }: { id: SpriteId; x: number; y: number; className?: string }) {
  const s = SPRITES[id];
  return (
    <g className={className}>
      <ellipse cx={x} cy={y - 1} rx={s.w * 0.4} ry={3.5} fill="#3c2d1e" opacity={0.16} />
      <image href={s.href} x={x - s.w / 2} y={y - s.h} width={s.w} height={s.h} />
    </g>
  );
}

/** Where people stand in the painting (their feet). */
export const SPOTS = {
  seitaKneel: { x: 2552, y: 472 }, // on the paper shop's raised floor
  seitaStand: { x: 2560, y: 522 }, // in the street before the shop
  sokichi: { x: 2640, y: 535 }, // at the bridge foot
  okon: { x: 2215, y: 494 }, // before the tools shop
};

/** Loose sheets lifting in the wind beside 清太, until the weight is on them. */
function LooseSheets() {
  const l = { fill: '#f6efdf', stroke: '#514d3e', strokeWidth: 0.8, strokeLinejoin: 'round' as const };
  return (
    <g className="flap">
      <path d="M 2506 466 q 6 -22 26 -26 l 3 10 q -14 4 -20 18 Z" {...l} />
      <path d="M 2584 462 q 10 -24 30 -22 l -2 10 q -14 0 -22 14 Z" {...l} />
      <path d="M 2526 452 q 4 -18 18 -24 l 4 8 q -10 5 -14 16 Z" {...l} />
    </g>
  );
}

export interface PaintedProps {
  pressed: boolean;
  kazeDone: boolean;
  metOkon: boolean;
  /** Ambient reactions on the painting: a soft glint where it was touched. */
  glints: { id: string; x: number; y: number; w: number; h: number }[];
}

export function PaintedSection({ pressed, kazeDone, metOkon, glints }: PaintedProps) {
  return (
    <g>
      <defs>
        {/* the painting's left edge fades into the street still drawn in line */}
        <linearGradient id="painted-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.07" stopColor="#fff" stopOpacity={1} />
        </linearGradient>
        <mask id="painted-mask" maskUnits="userSpaceOnUse" x={PAINTED_X0} y={0} width={PAINTED_W} height={700}>
          <rect x={PAINTED_X0} y={0} width={PAINTED_W} height={700} fill="url(#painted-fade)" />
        </mask>
      </defs>
      <image href={section} x={PAINTED_X0} y={0} width={PAINTED_W} height={700} preserveAspectRatio="none" mask="url(#painted-mask)" />

      {glints.map((g) => (
        <ellipse key={g.id} className="glint" cx={g.x + g.w / 2} cy={g.y + g.h / 2} rx={g.w / 2 + 6} ry={g.h / 2 + 6} fill="#fff8e0" />
      ))}

      <Sprite id={metOkon ? 'okonHold' : 'okonWipe'} {...SPOTS.okon} />
      {!pressed && <Sprite id="seitaPress" {...SPOTS.seitaKneel} className="fret" />}
      {!pressed && <LooseSheets />}
      {pressed && !kazeDone && <Sprite id="seitaBow" {...SPOTS.seitaKneel} />}
      {kazeDone && <Sprite id="seitaStand" {...SPOTS.seitaStand} />}
      <Sprite id={kazeDone ? 'sokichiNod' : pressed ? 'sokichiPoint' : 'sokichiHold'} {...SPOTS.sokichi} />
    </g>
  );
}
