import type React from 'react';
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
  };
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
}

const near = (x: number, [from, to]: [number, number]) => x >= from * 1000 - 120 && x <= (to + 1) * 1000 + 120;

export function PaintedStreet({ poses, sections, glints }: PaintedProps) {
  return (
    <g>
      {STREET.map((href, k) =>
        !href || k < sections[0] || k > sections[1] ? null : (
          // a hair of overlap hides the seam that sub-pixel rounding would show
          <image key={k} href={href} x={k * 1000 - (k ? 0.5 : 0)} y={0} width={1000 + (k < SECTIONS - 1 ? 0.5 : 0)} height={700} preserveAspectRatio="none" />
        ),
      )}

      {glints.map((g) => (
        <g key={g.id}>
          <ellipse className="glint" cx={g.x + g.w / 2} cy={g.y + g.h / 2} rx={g.w / 2 + 4} ry={g.h / 2 + 4} fill="#fff8e0" />
          {g.reaction && <ReactionFx kind={g.reaction} {...g} />}
        </g>
      ))}

      {PROPS.filter((c) => near(c.x, sections)).map((c) => (
        <Sprite key={`${c.id}-${c.x}`} {...c} />
      ))}
      {CROWD.filter((c, i) => near(c.x, sections) || near(c.x + walkOf(c, i).dx, sections)).map((c) => {
        const w = walkOf(c, CROWD.indexOf(c));
        // placement stays in attributes; only the inner groups are animated (lesson of #157)
        return (
          <g key={`${c.id}-${c.x}`} className="walker" style={{ '--dx': `${w.dx}px`, '--dur': `${w.dur}s`, animationDelay: `${w.delay}s` } as React.CSSProperties}>
            <g className="walker-face" style={{ animationDelay: `${w.delay}s` } as React.CSSProperties}>
              <g className="walker-bob">
                <Sprite {...c} />
              </g>
            </g>
          </g>
        );
      })}
      <Sprite id={poses.kinji} {...SPOTS.kinji} />
      <Sprite id={poses.kisuke} {...SPOTS.kisuke} />
      <Sprite id={poses.oharu} {...SPOTS.oharu} />
      <Sprite id={poses.okon} {...SPOTS.okon} />
      {poses.seita === 'press' && <Sprite id="seita-press" {...SPOTS.seitaKneel} className="fret" />}
      {poses.seita === 'press' && <LooseSheets />}
      {poses.seita === 'bow' && <Sprite id="seita-bow" {...SPOTS.seitaKneel} />}
      {poses.seita === 'stand' && <Sprite id="seita-stand" {...SPOTS.seitaStand} />}
      <Sprite id={poses.sokichi} {...SPOTS.sokichi} />
      <Sprite id={poses.omatsu} {...SPOTS.omatsu} />
      {poses.kame && <Sprite id={poses.kame.id} {...(poses.kame.at === 'hide' ? SPOTS.kameHide : SPOTS.kameHome)} />}
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
  const tint = sk ? PAGE_TINT[sk.tod] : null;
  return (
    <g transform={`translate(40 40) scale(${k}) translate(${-view.x0} ${-view.y0})`} filter={tint ? `url(#page-tint-${sk!.tod})` : undefined}>
      {tint && (
        <filter id={`page-tint-${sk!.tod}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={tint} />
        </filter>
      )}
      <rect x={view.x0 - 10} y={view.y0 - 10} width={view.w + 20} height={700} fill="#e1cfa6" />
      {STREET.map((href, i) =>
        !href || i < first || i > first + 1 ? null : <image key={i} href={href!} x={i * 1000} y={0} width={1000} height={700} preserveAspectRatio="none" />,
      )}
      {view.people.map((p) => (
        <Sprite key={p.id} id={p.id} x={p.x} y={p.y} flip={p.flip} />
      ))}
    </g>
  );
}
