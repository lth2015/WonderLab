// 線と淡彩の仮素材 (spec §13). Drawn in code so the first story can be played
// and judged; every piece is listed in docs/painted-worlds/qingming-edo/素材台帳.md
// as 仮素材 to be replaced by designed art before any public release.
//
// Attributes only, no CSS classes, inside anything that a journal page
// reuses: the page is serialised to a PNG, where stylesheets do not reach.

import type { ReactNode } from 'react';

export const INK = '#33291f';
export const PAPER = '#efe6d2';
export const WASH = {
  indigo: '#4d6282',
  indigoPale: '#9aa9bf',
  persimmon: '#c47a46',
  ochre: '#c9a45c',
  gold: '#d8b96a',
  green: '#7f9165',
  vermilion: '#b4483a',
  tile: '#77746c',
  wood: '#9b7a57',
  woodDark: '#6e5238',
  plaster: '#e9dfc9',
  skin: '#f0d9bb',
  hair: '#2a2420',
  water: '#8fa7ad',
  dim: '#4a3e33',
};

const line = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export const MINCHO = "'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Noto Serif CJK JP',serif";

/**
 * Vertical text, one character per line. SVG writing-mode is uneven across
 * browsers and in the saved PNG; stacking glyphs is the same everywhere.
 */
export function VText({ x, y, text, size, fill, gap = 1.18 }: { x: number; y: number; text: string; size: number; fill: string; gap?: number }) {
  return (
    <g>
      {[...text].map((ch, i) => (
        <text key={i} x={x} y={y + size + i * size * gap} fontSize={size} fill={fill} textAnchor="middle" fontFamily={MINCHO}>
          {ch === 'ー' ? '｜' : ch}
        </text>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- people

export type Pose = 'stand' | 'walk' | 'reach' | 'bow' | 'carry' | 'sit';

export interface FigureProps {
  x: number;
  y: number;
  scale?: number;
  facing?: 1 | -1;
  robe: string;
  obi?: string;
  hair: 'man' | 'woman' | 'elder';
  pose?: Pose;
  className?: string;
  /** Extra drawing in the figure's own frame (feet at 0,0; head near -130). */
  children?: ReactNode;
}

/** A standing person about 150 units tall, feet at (x, y). */
export function Figure({ x, y, scale = 1, facing = 1, robe, obi = WASH.dim, hair, pose = 'stand', className, children }: FigureProps) {
  const walk = pose === 'walk' || pose === 'carry';
  const bow = pose === 'bow';
  const sit = pose === 'sit';
  const lean = bow ? 14 : 0;
  const hemY = sit ? -44 : -34;
  return (
    // The class goes on an outer group: a CSS animation's transform would
    // otherwise replace the placement transform below.
    <g className={className}>
    <g transform={`translate(${x} ${y}) scale(${facing * scale} ${scale})`}>
      <ellipse cx={0} cy={2} rx={22} ry={4} fill={INK} opacity={0.12} />
      {/* legs and geta */}
      {sit ? (
        <path d="M -14 -44 L -18 -4 M 10 -44 L 14 -4" fill="none" {...line} />
      ) : (
        <path d={walk ? 'M -6 -40 L -16 -2 M 6 -40 L 14 -2' : 'M -6 -40 L -8 -2 M 6 -40 L 8 -2'} fill="none" {...line} />
      )}
      <path d={walk ? 'M -22 0 h 10 M 9 0 h 10' : sit ? 'M -24 -2 h 10 M 9 -2 h 10' : 'M -14 0 h 10 M 4 0 h 10'} {...line} strokeWidth={2.4} />
      <g transform={`rotate(${lean} 0 -40)`}>
        {/* robe */}
        <path
          d={`M -15 -114 Q -25 -76 -24 ${hemY} L 24 ${hemY} Q 23 -76 15 -114 Q 0 -120 -15 -114 Z`}
          fill={robe}
          {...line}
        />
        <path d="M -9 -114 L 3 -88 L 11 -114" fill="none" {...line} strokeWidth={1.2} />
        <rect x={-21} y={-86} width={43} height={9} fill={obi} {...line} strokeWidth={1.1} />
        {/* sleeves and hands */}
        {pose === 'reach' ? (
          <>
            <path d="M 12 -110 Q 34 -104 44 -92 L 38 -84 Q 26 -94 12 -94 Z" fill={robe} {...line} />
            <circle cx={46} cy={-88} r={4} fill={WASH.skin} {...line} strokeWidth={1.1} />
            <path d="M -14 -110 Q -30 -96 -28 -76 L -18 -74 Q -18 -92 -10 -100 Z" fill={robe} {...line} />
          </>
        ) : pose === 'carry' ? (
          <>
            <path d="M 10 -112 Q 22 -114 30 -118 L 30 -108 Q 20 -106 6 -102 Z" fill={robe} {...line} />
            <path d="M -14 -110 Q -26 -96 -24 -78 L -15 -76 Q -15 -92 -8 -100 Z" fill={robe} {...line} />
          </>
        ) : (
          <>
            <path d="M -14 -110 Q -28 -94 -26 -72 L -15 -70 Q -15 -90 -8 -100 Z" fill={robe} {...line} />
            <path d="M 14 -110 Q 28 -94 26 -72 L 15 -70 Q 15 -90 8 -100 Z" fill={robe} {...line} />
          </>
        )}
        {/* head */}
        <ellipse cx={0} cy={-128} rx={10.5} ry={12.5} fill={WASH.skin} {...line} />
        <path d="M 4 -128 l 4 2" {...line} strokeWidth={1.1} />
        {hair === 'woman' ? (
          <path d="M -11 -130 Q -12 -146 0 -146 Q 12 -146 11 -131 Q 6 -138 -2 -137 Q -9 -136 -11 -130 Z M -16 -134 Q -24 -146 -12 -150 Q -4 -154 -6 -144 Z" fill={WASH.hair} />
        ) : hair === 'elder' ? (
          <path d="M -11 -131 Q -10 -142 0 -142 Q 9 -142 11 -133 Q 4 -138 -3 -137 Z M -4 -142 q -6 -3 -10 -1 q 4 3 10 3 Z" fill="#8a8178" {...line} strokeWidth={0.8} />
        ) : (
          <path d="M -11 -131 Q -10 -142 0 -142 Q 9 -142 11 -133 Q 4 -138 -3 -137 Z M -6 -142 l -14 -6 l 2 6 Z" fill={WASH.hair} />
        )}
        {children}
      </g>
    </g>
    </g>
  );
}

// ---------------------------------------------------------------- buildings

export interface ShopProps {
  x: number;
  w: number;
  ground: number;
  noren: string;
  norenText?: string;
  sign?: string;
  signSide?: string;
  wall?: string;
  children?: ReactNode;
  norenClass?: string;
}

/** A two-storey shop with a deep eave, noren and a front floor (見世). */
export function Shop({ x, w, ground, noren, norenText, sign, signSide, wall = WASH.plaster, children, norenClass }: ShopProps) {
  const top = ground - 380;
  const eave = ground - 270;
  const floor = ground - 62;
  const panels = Math.max(3, Math.round((w - 60) / 60));
  const pw = (w - 60) / panels;
  return (
    <g>
      {/* upper storey */}
      <rect x={x + 14} y={top + 42} width={w - 28} height={eave - top - 40} fill={wall} {...line} />
      {Array.from({ length: Math.floor((w - 60) / 46) }, (_, i) => (
        <g key={i}>
          <rect x={x + 34 + i * 46} y={top + 66} width={30} height={34} fill={WASH.dim} opacity={0.75} />
          {[0, 1, 2, 3].map((k) => (
            <line key={k} x1={x + 38 + i * 46 + k * 7} y1={top + 66} x2={x + 38 + i * 46 + k * 7} y2={top + 100} stroke={WASH.plaster} strokeWidth={1.4} />
          ))}
        </g>
      ))}
      {/* main roof */}
      <path d={`M ${x - 8} ${top + 46} L ${x + 20} ${top} L ${x + w - 20} ${top} L ${x + w + 8} ${top + 46} Z`} fill={WASH.tile} {...line} />
      {Array.from({ length: Math.floor(w / 14) }, (_, i) => (
        <line key={i} x1={x + 4 + i * 14} y1={top + 44} x2={x + 22 + i * 13.4} y2={top + 2} stroke={INK} strokeWidth={0.6} opacity={0.5} />
      ))}
      {/* signboard on the roof */}
      {sign && (
        <g>
          <rect x={x + w / 2 - 70} y={top + 104} width={140} height={34} fill={WASH.woodDark} {...line} />
          <text x={x + w / 2} y={top + 128} textAnchor="middle" fontSize={22} fill={PAPER} fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif" letterSpacing={6}>
            {sign}
          </text>
        </g>
      )}
      {/* ground storey */}
      <rect x={x + 10} y={eave} width={w - 20} height={ground - eave} fill={WASH.dim} opacity={0.9} />
      <rect x={x + 10} y={eave} width={w - 20} height={ground - eave} fill="none" {...line} />
      <rect x={x + 4} y={eave - 4} width={14} height={ground - eave + 4} fill={WASH.wood} {...line} />
      <rect x={x + w - 18} y={eave - 4} width={14} height={ground - eave + 4} fill={WASH.wood} {...line} />
      {/* eave */}
      <path d={`M ${x - 16} ${eave + 14} L ${x} ${eave - 12} L ${x + w} ${eave - 12} L ${x + w + 16} ${eave + 14} Z`} fill={WASH.tile} {...line} />
      {/* noren */}
      <g className={norenClass}>
        {Array.from({ length: panels }, (_, i) => (
          <path
            key={i}
            d={`M ${x + 30 + i * pw + 2} ${eave + 16} h ${pw - 4} v 66 q ${-(pw - 4) / 2} 6 ${-(pw - 4)} 0 Z`}
            fill={noren}
            {...line}
            strokeWidth={1.2}
          />
        ))}
        {norenText && (
          <text
            x={x + w / 2}
            y={eave + 58}
            textAnchor="middle"
            fontSize={26}
            fill={PAPER}
            opacity={0.92}
            fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif"
          >
            {norenText}
          </text>
        )}
      </g>
      {/* front floor */}
      <rect x={x + 18} y={floor} width={w - 36} height={62} fill={WASH.wood} {...line} />
      <line x1={x + 18} y1={floor + 14} x2={x + w - 18} y2={floor + 14} {...line} strokeWidth={1} />
      {signSide && (
        <g>
          <rect x={x + w - 60} y={floor - 118} width={30} height={116} fill={PAPER} {...line} />
          <VText x={x + w - 45} y={floor - 114} text={signSide} size={20} fill={INK} gap={1.25} />
        </g>
      )}
      {children}
    </g>
  );
}

/** Stacks of paper on the front floor; flapping sheets until pressed. */
export function Papers({ x, y, pressed, flapClass }: { x: number; y: number; pressed: boolean; flapClass?: string }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x + i * 46} y={y - 10 - (i % 2) * 4} width={40} height={10 + (i % 2) * 4} fill="#f7f1e3" {...line} strokeWidth={1} />
          <line x1={x + i * 46 + 2} y1={y - 4} x2={x + i * 46 + 38} y2={y - 4} stroke={INK} strokeWidth={0.5} opacity={0.5} />
        </g>
      ))}
      {pressed ? (
        <g>
          <rect x={x + 50} y={y - 24} width={30} height={8} rx={2} fill={WASH.dim} {...line} strokeWidth={1.1} />
          <path d={`M ${x + 46} ${y - 14} h 40`} stroke={INK} strokeWidth={0.8} />
        </g>
      ) : (
        <g className={flapClass}>
          <path d={`M ${x + 48} ${y - 14} q 16 -26 40 -22 l -6 14 q -18 -2 -34 8 Z`} fill="#fbf7ec" {...line} strokeWidth={1} />
          <path d={`M ${x + 96} ${y - 18} q 12 -30 34 -30 l -2 14 q -16 2 -28 16 Z`} fill="#fbf7ec" {...line} strokeWidth={1} />
          <path d={`M ${x + 4} ${y - 14} q 4 -24 24 -30 l 4 12 q -14 6 -18 18 Z`} fill="#fbf7ec" {...line} strokeWidth={1} />
        </g>
      )}
    </g>
  );
}

/** Put once in each SVG that draws Mist. */
export function MistDefs() {
  return (
    <defs>
      <linearGradient id="mist" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={WASH.gold} stopOpacity={0} />
        <stop offset="0.18" stopColor={WASH.gold} stopOpacity={1} />
        <stop offset="0.82" stopColor={WASH.gold} stopOpacity={1} />
        <stop offset="1" stopColor={WASH.gold} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

/** 霞 — the gold mist bands that frame a scroll scene: soft ends, a wavering edge. */
export function Mist({ x, y, w, h = 34, opacity = 0.5 }: { x: number; y: number; w: number; h?: number; opacity?: number }) {
  const q = w / 4;
  return (
    <g opacity={opacity}>
      <path
        d={`M ${x} ${y + h * 0.5} Q ${x + q * 0.5} ${y} ${x + q} ${y + h * 0.15} T ${x + q * 2} ${y + h * 0.1} T ${x + q * 3} ${y + h * 0.2} T ${x + w} ${y + h * 0.5} Q ${x + q * 3.4} ${y + h} ${x + q * 2.6} ${y + h * 0.9} T ${x + q} ${y + h * 0.95} T ${x} ${y + h * 0.5} Z`}
        fill="url(#mist)"
      />
      <path d={`M ${x + q * 0.6} ${y + h * 0.2} Q ${x + q * 2} ${y - h * 0.15} ${x + q * 3.3} ${y + h * 0.25}`} fill="none" stroke={WASH.ochre} strokeWidth={1} opacity={0.6} />
    </g>
  );
}

export function Willow({ x, y, swayClass }: { x: number; y: number; swayClass?: string }) {
  return (
    <g>
      <path d={`M ${x} ${y} q -6 -120 10 -230`} fill="none" stroke={WASH.woodDark} strokeWidth={6} strokeLinecap="round" />
      <g className={swayClass}>
        {Array.from({ length: 11 }, (_, i) => {
          const sx = x - 30 + i * 9;
          return <path key={i} d={`M ${sx + 10} ${y - 226 + (i % 3) * 6} q ${-8 + (i % 4) * 4} 70 ${-4 + (i % 5) * 2} ${130 - (i % 3) * 20}`} fill="none" stroke={WASH.green} strokeWidth={1.6} opacity={0.85} />;
        })}
      </g>
    </g>
  );
}

export function Dog({ x, y, wagClass }: { x: number; y: number; wagClass?: string }) {
  return (
    <g>
      <path d={`M ${x} ${y} q 2 -22 22 -24 q 18 0 26 -4 l 6 -10 l 4 12 q 2 12 -6 16 l 0 10 M ${x + 6} ${y - 8} l -2 8 M ${x + 38} ${y - 6} l 2 6`} fill={WASH.plaster} {...line} />
      <path d={`M ${x} ${y - 16} q -10 -8 -12 -20`} fill="none" {...line} className={wagClass} />
    </g>
  );
}

export function Barrel({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y - 54} width={44} height={54} rx={6} fill={WASH.wood} {...line} />
      <line x1={x} y1={y - 40} x2={x + 44} y2={y - 40} {...line} strokeWidth={1} />
      <line x1={x} y1={y - 14} x2={x + 44} y2={y - 14} {...line} strokeWidth={1} />
      <ellipse cx={x + 22} cy={y - 54} rx={22} ry={4} fill={WASH.water} {...line} strokeWidth={1} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 6 + i * 12} y={y - 76} width={10} height={20} rx={2} fill={WASH.persimmon} {...line} strokeWidth={0.8} />
      ))}
    </g>
  );
}

/** The north end of a wooden arched bridge over the river, rising to the right. */
export function BridgeEnd({ x, ground, giboshiClass }: { x: number; ground: number; giboshiClass?: string }) {
  const deck = (t: number) => ground - 30 - t * 60; // rises 60 units over the span
  const span = 3000 - x + 60;
  const posts = Array.from({ length: 8 }, (_, i) => x + 40 + i * (span / 8));
  return (
    <g>
      {/* river */}
      <rect x={x - 40} y={ground + 10} width={span + 40} height={200} fill={WASH.water} opacity={0.55} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M ${x + i * 90} ${ground + 40 + i * 30} q 30 -6 60 0 t 60 0`} fill="none" stroke={INK} strokeWidth={0.8} opacity={0.4} />
      ))}
      {/* stone embankment */}
      <path d={`M ${x - 60} ${ground} L ${x - 20} ${ground + 160} L ${x - 60} ${ground + 160} Z`} fill="#b9ad97" {...line} />
      {/* piers */}
      {posts.slice(1).map((px, i) => (
        <line key={i} x1={px} y1={deck((px - x) / span) + 12} x2={px} y2={ground + 160} stroke={WASH.woodDark} strokeWidth={5} />
      ))}
      {/* deck */}
      <path d={`M ${x - 40} ${ground} Q ${x + span * 0.4} ${deck(0.5) - 10} ${x + span} ${deck(1)} L ${x + span} ${deck(1) + 16} Q ${x + span * 0.4} ${deck(0.5) + 6} ${x - 40} ${ground + 16} Z`} fill={WASH.wood} {...line} />
      {/* railing */}
      <path d={`M ${x} ${ground - 40} Q ${x + span * 0.4} ${deck(0.5) - 50} ${x + span} ${deck(1) - 40}`} fill="none" stroke={WASH.woodDark} strokeWidth={5} />
      {posts.map((px, i) => {
        const t = (px - x) / span;
        const top = ground - 44 - t * 70 + t * t * 14;
        return <line key={i} x1={px} y1={top} x2={px} y2={top + 40} stroke={WASH.woodDark} strokeWidth={4} />;
      })}
      {/* 擬宝珠 on the first post */}
      <g className={giboshiClass}>
        <rect x={x - 6} y={ground - 70} width={12} height={34} fill={WASH.woodDark} {...line} />
        <path d={`M ${x - 9} ${ground - 70} q 9 -26 18 0 Z`} fill={WASH.gold} {...line} />
        <circle cx={x} cy={ground - 86} r={3} fill={WASH.gold} {...line} strokeWidth={1} />
      </g>
    </g>
  );
}

export function Boat({ x, y, className }: { x: number; y: number; className?: string }) {
  return (
    <g className={className}>
      <path d={`M ${x} ${y} q 60 18 130 0 l -10 14 q -55 10 -110 0 Z`} fill={WASH.woodDark} {...line} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 30 + i * 26} y={y - 18} width={22} height={18} fill={WASH.ochre} {...line} strokeWidth={1} />
      ))}
      <line x1={x + 116} y1={y - 2} x2={x + 140} y2={y - 70} stroke={WASH.woodDark} strokeWidth={2.4} />
    </g>
  );
}

export function Steam({ x, y, className }: { x: number; y: number; className?: string }) {
  return (
    <g className={className} opacity={0.75}>
      <path d={`M ${x} ${y} q -10 -20 0 -40 q 10 -20 0 -40`} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
      <path d={`M ${x + 12} ${y - 6} q -8 -18 0 -36 q 8 -18 0 -36`} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

export function Sparrows({ x, y, className }: { x: number; y: number; className?: string }) {
  return (
    <g className={className}>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${x + i * 26} ${y + (i % 2) * 6})`}>
          <ellipse cx={0} cy={0} rx={8} ry={5} fill={WASH.woodDark} {...line} strokeWidth={0.8} />
          <circle cx={7} cy={-3} r={3.4} fill={WASH.woodDark} {...line} strokeWidth={0.8} />
          <path d="M -8 0 l -6 -3" {...line} strokeWidth={1} />
        </g>
      ))}
    </g>
  );
}
