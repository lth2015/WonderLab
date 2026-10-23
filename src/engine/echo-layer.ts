import * as THREE from 'three';

// The echo line, drawn into the canvas rather than the page so a recording
// keeps it (docs/03 §4). Text is laid out on a 2D canvas, then shown as a
// texture in the sky: fades in, holds 4 s, fades out (docs/03 §6.3).

const FONT = '"LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", serif';
const FADE_IN = 0.9;
const HOLD = 4;
const FADE_OUT = 1.2;

export class EchoLayer {
  readonly mesh: THREE.Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshBasicMaterial;
  private shownAt = -1;
  private time = 0;

  constructor() {
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get showing(): boolean {
    return this.shownAt >= 0;
  }

  /** Lay out and show a line with its author, centred at (x, y) in view pixels from the bottom. */
  /**
   * `avoid`: discs the lines must not be written across (the moon, planets);
   * `band`: the vertical range the panel has to stay inside. Both in the
   * same coordinates as `x` and `y`.
   */
  async show(
    text: string,
    author: string,
    x: number,
    y: number,
    width: number,
    small: boolean,
    avoid: Disc[] = [],
    band?: { min: number; max: number },
  ): Promise<void> {
    const size = small ? 22 : 28;
    try {
      await document.fonts.load(`${size}px "LXGW WenKai"`, text + author);
    } catch {
      // The system kaiti fallback is fine.
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = this.canvas.getContext('2d')!;
    const lines = wrap(ctx, text, `${size}px ${FONT}`, size * 0.15, width * 0.86);
    const lineH = size * 1.6;
    const authorSize = Math.round(size * 0.6);
    const pad = 24;
    ctx.font = `${size}px ${FONT}`;
    const textW = Math.max(...lines.map((l) => measure(ctx, l, size * 0.15)));
    const w = Math.ceil(textW + pad * 2);
    const h = Math.ceil(lines.length * lineH + authorSize * 2.2 + pad * 2);
    const cw = Math.ceil(w * dpr);
    const ch = Math.ceil(h * dpr);
    if (cw !== this.canvas.width || ch !== this.canvas.height) {
      // The GPU copy of a texture has a fixed size once uploaded: a larger
      // canvas would be written into the old storage and leave pieces of the
      // previous line behind it. Release it so the next upload starts fresh.
      this.texture.dispose();
    }
    this.canvas.width = cw;
    this.canvas.height = ch;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(239, 234, 223, 0.94)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px ${FONT}`;
    lines.forEach((line, i) => drawSpaced(ctx, line, (w - measure(ctx, line, size * 0.15)) / 2, pad + lineH * (i + 0.5), size * 0.15));
    ctx.font = `${authorSize}px ${FONT}`;
    ctx.fillStyle = 'rgba(201, 195, 182, 0.9)';
    const by = `—— ${author}`;
    drawSpaced(ctx, by, w - pad - measure(ctx, by, authorSize * 0.1), pad + lines.length * lineH + authorSize * 1.1, authorSize * 0.1);
    this.texture.needsUpdate = true;

    this.mesh.scale.set(w, h, 1);
    // Judge overlap by the lines themselves, not the transparent padding
    // that leaves room for their glow.
    this.mesh.position.set(x, placeClear(x, y, w - pad, h - pad, avoid, band), 0);
    this.mesh.visible = true;
    this.shownAt = this.time;
  }

  hide(): void {
    if (this.shownAt < 0) return;
    const age = this.time - this.shownAt;
    if (age < FADE_IN + HOLD) this.shownAt = this.time - (FADE_IN + HOLD);
  }

  update(time: number): void {
    this.time = time;
    if (this.shownAt < 0) return;
    const age = time - this.shownAt;
    let o: number;
    if (age < FADE_IN) o = age / FADE_IN;
    else if (age < FADE_IN + HOLD) o = 1;
    else o = 1 - (age - FADE_IN - HOLD) / FADE_OUT;
    if (o <= 0) {
      this.shownAt = -1;
      this.mesh.visible = false;
      return;
    }
    this.material.opacity = o * o * (3 - 2 * o);
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

function measure(ctx: CanvasRenderingContext2D, s: string, spacing: number): number {
  return ctx.measureText(s).width + spacing * Math.max([...s].length - 1, 0);
}

function drawSpaced(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, spacing: number): void {
  for (const ch of s) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
}

/** Break after punctuation so each line stays within `max` pixels. */
function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, spacing: number, max: number): string[] {
  ctx.font = font;
  if (measure(ctx, text, spacing) <= max) return [text];
  const parts = text.match(/[^，。？！、；]+[，。？！、；]?/g) ?? [text];
  const lines: string[] = [];
  let cur = '';
  for (const part of parts) {
    if (cur && measure(ctx, cur + part, spacing) > max) {
      lines.push(cur);
      cur = part;
    } else cur += part;
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface Disc {
  x: number;
  y: number;
  r: number;
}

/** How far a w×h panel centred at (x, y) reaches into a disc and its margin; 0 when clear. */
function intrusion(x: number, y: number, w: number, h: number, d: Disc, margin: number): number {
  const nx = Math.max(x - w / 2, Math.min(d.x, x + w / 2));
  const ny = Math.max(y - h / 2, Math.min(d.y, y + h / 2));
  return Math.max(0, d.r + margin - Math.hypot(d.x - nx, d.y - ny));
}

/**
 * The height nearest `y` at which the panel clears every disc and fits the
 * band: tried just above and just below each disc in turn. On a short sky
 * where nothing clears, the height inside the band that intrudes least —
 * usually tucked against the moon's edge rather than written across it.
 */
export function placeClear(x: number, y: number, w: number, h: number, avoid: Disc[], band?: { min: number; max: number }): number {
  const margin = 12;
  const lo = band ? band.min + h / 2 : -Infinity;
  const hi = band ? band.max - h / 2 : Infinity;
  const clamp = (cy: number) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(cy, lo), hi));
  const worst = (cy: number) => Math.max(0, ...avoid.map((d) => intrusion(x, cy, w, h, d, margin)));
  const start = clamp(y);
  if (worst(start) === 0) return start;
  const candidates = avoid.flatMap((d) => [d.y + d.r + margin + h / 2 + 1, d.y - d.r - margin - h / 2 - 1]);
  candidates.sort((a, b) => Math.abs(a - y) - Math.abs(b - y));
  const clear = candidates.find((cy) => cy >= lo && cy <= hi && worst(cy) === 0);
  if (clear !== undefined) return clear;
  let best = start;
  for (const cy of candidates.map(clamp)) if (worst(cy) < worst(best)) best = cy;
  return best;
}
