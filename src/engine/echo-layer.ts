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
  async show(text: string, author: string, x: number, y: number, width: number, small: boolean): Promise<void> {
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
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
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
    this.mesh.position.set(x, y, 0);
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
