import type { Framing, Subject } from '../content/world';
import type React from 'react';
import { BridgeEnd, Figure, INK, MINCHO, Mist, MistDefs, PAPER, Papers, Shop, VText, WASH } from './art';

// 絵巻頁 (spec §10 写生): the player picks subject, framing and title slip;
// the page itself is composed here, so drawing skill never matters.
// Attributes only (no classes): this SVG is also turned into the saved PNG.

export const PAGE_W = 600;
export const PAGE_H = 800;
// the picture area inside the border
const PIC_X = 40;
const PIC_Y = 40;
const PIC_W = PAGE_W - 80;
const PIC_H = PAGE_H - 140;

const SLIP: Record<string, { fill: string; text: string }> = {
  plain: { fill: '#f8f3e6', text: INK },
  indigo: { fill: WASH.indigo, text: PAPER },
  vermilion: { fill: WASH.vermilion, text: PAPER },
};

function Hands() {
  // Two hands squaring a stack of paper under a paperweight, close up.
  const l = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <g>
      <rect x={40} y={430} width={520} height={200} fill={WASH.wood} {...l} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={150 - i} y={420 - i * 9} width={300 + i * 2} height={12} fill={i % 2 ? '#fbf7ec' : '#f4eedd'} {...l} strokeWidth={1.4} />
      ))}
      <rect x={250} y={350} width={110} height={22} rx={4} fill={WASH.dim} {...l} />
      {/* left hand and sleeve */}
      <path d="M -10 300 Q 70 300 120 350 L 96 400 Q 50 370 -10 380 Z" fill={WASH.indigoPale} {...l} />
      <path d="M 110 352 Q 150 350 170 372 Q 180 388 166 396 L 150 392 Q 160 404 146 410 L 104 404 Z" fill={WASH.skin} {...l} />
      {/* right hand and sleeve */}
      <path d="M 610 290 Q 530 296 486 344 L 506 396 Q 552 364 610 372 Z" fill={WASH.indigoPale} {...l} />
      <path d="M 494 346 Q 456 346 436 370 Q 428 386 442 392 L 456 388 Q 448 402 462 406 L 500 400 Z" fill={WASH.skin} {...l} />
    </g>
  );
}

/** Places the street rectangle starting at (x0, y0), w units wide, into the page's picture area. */
function Frame({ x0, y0, w, children }: { x0: number; y0: number; w: number; children: React.ReactNode }) {
  const k = PIC_W / w;
  return <g transform={`translate(${PIC_X} ${PIC_Y}) scale(${k}) translate(${-x0} ${-y0})`}>{children}</g>;
}

/** The street around the paper shop, in street units (ground at 540), shared by the wider pages. */
function Street({ pressed = true }: { pressed?: boolean }) {
  return (
    <g>
      {Array.from({ length: 16 }, (_, i) => (
        <g key={i} opacity={0.3}>
          <path d={`M ${1500 + i * 110} 452 l 12 -22 h 76 l 12 22 Z`} fill={WASH.tile} />
          <rect x={1506 + i * 110} y={452} width={88} height={60} fill={WASH.indigoPale} />
        </g>
      ))}
      <rect x={1400} y={540} width={1800} height={700} fill="#dccdae" />
      <BridgeEnd x={2640} ground={540} />
      <Shop x={2160} w={360} ground={540} noren={WASH.persimmon} norenText="紙" sign="青葉屋" signSide="紙品々">
        <Papers x={2236} y={478} pressed={pressed} />
      </Shop>
      <Shop x={1720} w={360} ground={540} noren={WASH.indigo} norenText="道具" sign="くれ竹" />
    </g>
  );
}

function Scene({ subject, framing }: { subject: Subject; framing: Framing }) {
  if (subject === 'hands' && framing === 'near') return <Hands />;
  if (subject === 'hands') {
    // 清太 at the counter, squaring the paper under the weight
    return (
      <Frame x0={2210} y0={250} w={300}>
        <Street />
        <Figure x={2440} y={540} robe={WASH.indigoPale} hair="man" pose="reach" facing={-1} />
      </Frame>
    );
  }
  if (subject === 'shopfront' && framing === 'near') {
    return (
      <Frame x0={2180} y0={190} w={330}>
        <Street />
        <Figure x={2405} y={556} robe={WASH.indigoPale} hair="man" pose="bow" facing={-1} />
      </Frame>
    );
  }
  if (subject === 'shopfront') {
    return (
      <Frame x0={1700} y0={-250} w={860}>
        <Street />
        <Figure x={2440} y={540} robe={WASH.indigoPale} hair="man" pose="bow" facing={-1} />
        <Figure x={1960} y={540} robe="#5d6b7c" obi={WASH.vermilion} hair="woman" facing={-1} />
        <Figure x={2604} y={540} robe="#7b7062" hair="elder" facing={-1} />
      </Frame>
    );
  }
  if (framing === 'near') {
    // the people passing the shop, close
    return (
      <Frame x0={2150} y0={300} w={360}>
        <Street />
        <Figure x={2190} y={600} robe={WASH.green} hair="woman" pose="walk" />
        <Figure x={2440} y={540} robe={WASH.indigoPale} hair="man" pose="bow" facing={-1} scale={0.9} />
        <Figure x={2330} y={640} robe={WASH.ochre} hair="man" pose="carry" facing={-1} scale={1.1}>
          <path d="M -60 -114 L 60 -114" stroke={WASH.woodDark} strokeWidth={4} />
          <path d="M -56 -112 v 30 M 56 -112 v 30" stroke={INK} strokeWidth={1} />
          <path d="M -74 -84 h 36 l -6 30 h -24 Z M 38 -84 h 36 l -6 30 h -24 Z" fill={WASH.wood} stroke={INK} strokeWidth={1.2} />
        </Figure>
      </Frame>
    );
  }
  return (
    <Frame x0={1760} y0={-330} w={1000}>
      <Street />
      {[1800, 1980, 2160, 2340, 2560, 2720].map((x, i) => (
        <Figure key={x} x={x} y={580 + (i % 3) * 40} robe={[WASH.green, WASH.ochre, '#9c6b5a', WASH.persimmon][i % 4]} hair={i % 3 ? 'man' : 'woman'} pose="walk" facing={i % 2 ? 1 : -1} />
      ))}
      <Figure x={2440} y={540} robe={WASH.indigoPale} hair="man" facing={-1} />
    </Frame>
  );
}

export interface PageArtProps {
  subject: Subject;
  framing: Framing;
  titleStyle: string;
  title: string;
  place: string;
  /** Small work name in the corner (spec §18): never covering the picture. */
  credit?: string;
  idPrefix?: string;
}

export function PageArt({ subject, framing, titleStyle, title, place, credit, idPrefix = 'pg' }: PageArtProps) {
  const slip = SLIP[titleStyle] ?? SLIP.plain;
  const clip = `${idPrefix}-clip`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} width={PAGE_W} height={PAGE_H} role="img" aria-label={`${title}　${place}`}>
      <rect width={PAGE_W} height={PAGE_H} fill={PAPER} />
      <rect x={24} y={24} width={PAGE_W - 48} height={PAGE_H - 48} fill="none" stroke={INK} strokeWidth={1.2} opacity={0.5} />
      <MistDefs />
      <defs>
        <clipPath id={clip}>
          <rect x={PIC_X} y={PIC_Y} width={PIC_W} height={PIC_H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={PIC_X} y={PIC_Y} width={PIC_W} height={PIC_H} fill="#f3ebd9" />
        <Scene subject={subject} framing={framing} />
        <Mist x={20} y={56} w={300} h={40} opacity={0.55} />
        <Mist x={360} y={110} w={240} h={30} opacity={0.4} />
        <Mist x={-40} y={PAGE_H - 160} w={360} h={36} opacity={0.45} />
      </g>
      {/* 題箋 */}
      <rect x={PAGE_W - 108} y={56} width={52} height={[...title].length * 34 + 30} fill={slip.fill} stroke={INK} strokeWidth={1.2} />
      <VText x={PAGE_W - 82} y={66} text={title} size={28} fill={slip.text} gap={1.2} />
      <text x={60} y={PAGE_H - 64} fontSize={20} fill={INK} fontFamily={MINCHO} letterSpacing={2}>
        {place}
      </text>
      {/* 落款 */}
      <rect x={PAGE_W - 92} y={PAGE_H - 92} width={36} height={36} fill="none" stroke={WASH.vermilion} strokeWidth={3} />
      <text x={PAGE_W - 74} y={PAGE_H - 68} fontSize={16} fill={WASH.vermilion} textAnchor="middle" fontFamily={MINCHO}>
        見習
      </text>
      {credit && (
        <text x={60} y={PAGE_H - 38} fontSize={12} fill={INK} opacity={0.55} fontFamily={MINCHO}>
          {credit}
        </text>
      )}
    </svg>
  );
}

/** Turns a rendered page SVG into a PNG blob at 2× (1200 × 1600). */
export async function pageToPng(svg: SVGSVGElement): Promise<Blob> {
  const text = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('page image failed to load'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W * 2;
    canvas.height = PAGE_H * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
