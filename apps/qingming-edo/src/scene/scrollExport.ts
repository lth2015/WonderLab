import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { INK, MINCHO } from './art';
import { inlineImages } from './PageArt';
import { PaintedStreet, STREET, type Poses } from './painted';

// 長巻を画にする (roadmap #158 item 2): the whole street as pictures the player keeps.
// Drawn one section at a time from the painting and the people as they are in this
// player's town, never from the screen: no UI, no counts, no money (spec §18).
// The scroll is read from the bridge (right) to the quiet end (left), so part 1 is
// the right-hand end.

export type ScrollMode = 'phone' | 'full';
export interface ScrollPart {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

const UNIT_H = 700; // scene units, one section is 1000 × 700
/** px per scene unit: the phone picture is light enough to send; full is the painting's own 1400 px per section. */
const SCALE: Record<ScrollMode, number> = { phone: 1, full: 1.4 };
/** Paper at either end (scene units): the title slip at the start, the credit at the end. */
const END = 150;
const PAPER_BG = '#efe6cf';
const TITLE = '日本橋北詰';
const SUBTITLE = '清明上河図：江戸編';
const CREDIT = '熈代勝覧に想を得て';

/** Sections from right to left, grouped into the pictures to make. */
export function plan(mode: ScrollMode): number[][] {
  const order = STREET.map((href, k) => (href ? k : -1)).filter((k) => k >= 0).reverse();
  if (mode === 'phone') return [order];
  const groups: number[][] = [];
  const sizes = [4, 4, 3, 3];
  let i = 0;
  for (const n of sizes) {
    if (i >= order.length) break;
    groups.push(order.slice(i, i + n));
    i += n;
  }
  if (i < order.length) groups[groups.length - 1].push(...order.slice(i));
  return groups.filter((g) => g.length);
}

function abortError(): Error {
  return new DOMException('cancelled', 'AbortError');
}

async function loadSvgImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const text = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('section image failed to load'));
      img.src = url;
    });
    return img;
  } finally {
    // the image keeps its decoded pixels; the blob URL can go
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** One section as an SVG element at `scale` px per unit, people included. */
function renderSection(host: HTMLElement, k: number, poses: Poses, scale: number): SVGSVGElement {
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: `${k * 1000} 0 1000 ${UNIT_H}`,
          width: 1000 * scale,
          height: UNIT_H * scale,
        },
        createElement(PaintedStreet, { poses, sections: [k, k], glints: [] }),
      ),
    ),
  );
  const svg = host.querySelector('svg')!.cloneNode(true) as SVGSVGElement;
  root.unmount();
  return svg;
}

function verticalText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = `${size}px ${MINCHO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [...text].forEach((ch, i) => ctx.fillText(ch, x, y + i * size * 1.12));
}

/** 巻首 (right end): a title slip like the album pages'. */
function drawHead(ctx: CanvasRenderingContext2D, x: number, s: number) {
  const w = END * s;
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(x, 0, w, UNIT_H * s);
  const slipW = 52 * s;
  const slipH = ([...TITLE].length * 34 + 30) * s;
  const sx = x + (w - slipW) / 2;
  const sy = 70 * s;
  ctx.fillStyle = '#f8f3e6';
  ctx.fillRect(sx, sy, slipW, slipH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2 * s;
  ctx.strokeRect(sx, sy, slipW, slipH);
  ctx.fillStyle = INK;
  verticalText(ctx, TITLE, sx + slipW / 2, sy + 15 * s, 30 * s);
  ctx.globalAlpha = 0.6;
  verticalText(ctx, SUBTITLE, x + w / 2, sy + slipH + 40 * s, 14 * s);
  ctx.globalAlpha = 1;
}

/** 巻尾 (left end): the credit, small. */
function drawTail(ctx: CanvasRenderingContext2D, x: number, s: number) {
  const w = END * s;
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(x, 0, w, UNIT_H * s);
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.55;
  verticalText(ctx, CREDIT, x + w / 2, 240 * s, 14 * s);
  verticalText(ctx, SUBTITLE, x + w / 2 - 26 * s, 240 * s, 14 * s);
  ctx.globalAlpha = 1;
}

/**
 * Makes the pictures. `onProgress(done, total)` counts sections; `signal` stops it
 * between sections. Throws AbortError when cancelled, Error when the device cannot
 * hold the picture (the caller offers the split, smaller pieces).
 */
export async function exportScroll(mode: ScrollMode, poses: Poses, onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<ScrollPart[]> {
  const s = SCALE[mode];
  const groups = plan(mode);
  const total = groups.reduce((n, g) => n + g.length, 0);
  const cache = new Map<string, Promise<string>>();
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;';
  host.setAttribute('aria-hidden', 'true');
  document.body.append(host);
  const parts: ScrollPart[] = [];
  let done = 0;
  onProgress(0, total);
  try {
    for (const [p, group] of groups.entries()) {
      const head = p === 0;
      const tail = p === groups.length - 1;
      const width = Math.round((group.length * 1000 + (head ? END : 0) + (tail ? END : 0)) * s);
      const height = Math.round(UNIT_H * s);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = PAPER_BG;
      ctx.fillRect(0, 0, width, height);
      // right to left: the first section of the group is at the right edge
      let right = width - (head ? END * s : 0);
      if (head) drawHead(ctx, right, s);
      for (const k of group) {
        if (signal?.aborted) throw abortError();
        const svg = await inlineImages(renderSection(host, k, poses, s), cache);
        const img = await loadSvgImage(svg);
        if (signal?.aborted) throw abortError();
        right -= 1000 * s;
        ctx.drawImage(img, Math.round(right), 0, Math.round(1000 * s), height);
        img.src = '';
        onProgress(++done, total);
        // let the page breathe between sections
        await new Promise((r) => setTimeout(r, 0));
      }
      if (tail) drawTail(ctx, right - END * s, s);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      canvas.width = canvas.height = 0; // free the pixels now (Safari keeps them otherwise)
      if (!blob) throw new Error('toBlob failed');
      const name = groups.length === 1 ? 'nihonbashi-emaki.jpg' : `nihonbashi-emaki-${p + 1}of${groups.length}.jpg`;
      parts.push({ name, blob, width, height });
    }
    return parts;
  } finally {
    host.remove();
  }
}
