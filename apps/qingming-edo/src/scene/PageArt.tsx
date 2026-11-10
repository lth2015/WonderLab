import type React from 'react';
import { INK, MINCHO, PAPER, VText, WASH } from './art';
import { wrapNote } from '../content/gift';

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

const SLIP: Record<string, { fill: string; text: string; dots?: string }> = {
  plain: { fill: '#f8f3e6', text: INK },
  indigo: { fill: WASH.indigo, text: PAPER },
  vermilion: { fill: WASH.vermilion, text: PAPER },
  // 記念の題箋 (bought at 青葉屋)
  kinsunago: { fill: '#e6cf8e', text: INK, dots: '#b8902f' },
  wakakusa: { fill: '#b7c48d', text: INK },
  sakura: { fill: '#efd2d2', text: INK, dots: '#d79a9e' },
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
  /** 贈る画: a word for a friend, in place of the place line (content/gift.ts). */
  note?: string;
}

export function PageArt({ scene, titleStyle, title, place, credit, idPrefix = 'pg', note }: PageArtProps) {
  title = title ?? '';
  place = place ?? '';
  const slip = SLIP[titleStyle] ?? SLIP.plain;
  const clip = `${idPrefix}-clip`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} width={PAGE_W} height={PAGE_H} role="img" aria-label={note ? `${title}　${note}` : `${title}　${place}`}>
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
      {slip.dots &&
        // 金砂子 / 花びら: a fixed scatter (the same on every page and in every export)
        Array.from({ length: Math.round(([...title].length * 34 + 30) / 7) }, (_, i) => (
          <circle key={i} cx={PAGE_W - 104 + ((i * 37) % 44)} cy={60 + ((i * 53) % ([...title].length * 34 + 22))} r={0.9 + ((i * 7) % 3) * 0.6} fill={slip.dots} opacity={0.75} />
        ))}
      <VText x={PAGE_W - 82} y={66} text={title} size={28} fill={slip.text} gap={1.2} />
      {note ? (
        wrapNote(note).map((line, i, all) => (
          <text key={i} x={60} y={PAGE_H - (all.length > 1 ? 82 : 66) + i * 26} fontSize={18} fill={INK} fontFamily={MINCHO} letterSpacing={1}>
            {line}
          </text>
        ))
      ) : (
        <text x={60} y={PAGE_H - 64} fontSize={20} fill={INK} fontFamily={MINCHO} letterSpacing={2}>
          {place}
        </text>
      )}
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
export async function inlineImages(svg: SVGSVGElement, cache?: Map<string, Promise<string>>): Promise<SVGSVGElement> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const toDataUrl = async (href: string) => {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`image ${res.status}`);
    const blob = await res.blob();
    return new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fail(r.error);
      r.readAsDataURL(blob);
    });
  };
  await Promise.all(
    [...copy.querySelectorAll('image')].map(async (img) => {
      const href = img.getAttribute('href') ?? img.getAttribute('xlink:href');
      if (!href || href.startsWith('data:')) return;
      let url = cache?.get(href);
      if (!url) {
        url = toDataUrl(href);
        cache?.set(href, url);
      }
      img.setAttribute('href', await url);
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
