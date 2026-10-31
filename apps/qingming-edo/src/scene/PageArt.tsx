import type React from 'react';
import { INK, MINCHO, PAPER, VText, WASH } from './art';

// 絵巻頁 (spec §10 写生): the player picks subject, framing and title slip;
// the page is a composed cut from the painted street, so drawing skill never matters.
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

export interface PageArtProps {
  /** The picture: a cut from the painted street (scene/painted.tsx PaintedPageScene). */
  scene: React.ReactNode;
  titleStyle: string;
  title: string;
  place: string;
  /** Small work name in the corner (spec §18): never covering the picture. */
  credit?: string;
  idPrefix?: string;
}

export function PageArt({ scene, titleStyle, title, place, credit, idPrefix = 'pg' }: PageArtProps) {
  const slip = SLIP[titleStyle] ?? SLIP.plain;
  const clip = `${idPrefix}-clip`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} width={PAGE_W} height={PAGE_H} role="img" aria-label={`${title}　${place}`}>
      <rect width={PAGE_W} height={PAGE_H} fill={PAPER} />
      <rect x={24} y={24} width={PAGE_W - 48} height={PAGE_H - 48} fill="none" stroke={INK} strokeWidth={1.2} opacity={0.5} />
      <defs>
        <clipPath id={clip}>
          <rect x={PIC_X} y={PIC_Y} width={PIC_W} height={PIC_H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={PIC_X} y={PIC_Y} width={PIC_W} height={PIC_H} fill="#f3ebd9" />
        {scene}
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
/** An SVG drawn as an image cannot fetch what it links to: inline every <image> first. */
async function inlineImages(svg: SVGSVGElement): Promise<SVGSVGElement> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  await Promise.all(
    [...copy.querySelectorAll('image')].map(async (img) => {
      const href = img.getAttribute('href') ?? img.getAttribute('xlink:href');
      if (!href || href.startsWith('data:')) return;
      const blob = await (await fetch(href)).blob();
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
      img.setAttribute('href', url);
    }),
  );
  return copy;
}

export async function pageToPng(svg: SVGSVGElement): Promise<Blob> {
  const text = new XMLSerializer().serializeToString(await inlineImages(svg));
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
