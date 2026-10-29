import * as THREE from 'three';
import { ribbonVert, strokeFrag } from './shaders/ink';
import type { Palette } from './palette';

export interface StrokePoint {
  x: number;
  y: number;
  t: number;        // ms
  pressure: number; // 0..1, 0.5 when unknown
}

const MAX_POINTS = 1024;

// A brush stroke rendered as a ribbon whose width follows speed and pressure.
export class Stroke {
  points: StrokePoint[] = [];
  length = 0;
  opacity = 1;
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly baseWidth: number;
  private finished = false;
  /** Where the pointer is predicted to go next: drawn, never kept (docs/03 §6.1). */
  private preview: StrokePoint[] = [];

  constructor(palette: Palette, minDim: number, readonly isPen: boolean) {
    this.baseWidth = THREE.MathUtils.clamp(minDim * 0.011, 5, 13);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 2 * 3), 3));
    this.geometry.setAttribute('aSV', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 2 * 2), 2));
    const index: number[] = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: ribbonVert,
      fragmentShader: strokeFrag,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uColor: { value: palette.brush },
        uLen: { value: 1 },
        uOpacity: { value: 1 },
        uSeed: { value: Math.random() * 100 },
        uDot: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  add(p: StrokePoint): void {
    const last = this.points[this.points.length - 1];
    if (last) {
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 1.5) return;
      this.length += d;
    }
    if (this.points.length < MAX_POINTS) this.points.push(p);
    this.rebuild();
  }

  finish(): void {
    this.finished = true;
    this.preview = [];
    this.rebuild();
  }

  /** Draw the predicted points ahead of the real ones until the next move. */
  setPreview(points: StrokePoint[]): void {
    if (this.finished || (!points.length && !this.preview.length)) return;
    const room = MAX_POINTS - this.points.length;
    const kept: StrokePoint[] = [];
    let last = this.points[this.points.length - 1];
    for (const p of points) {
      if (kept.length >= room) break;
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1.5) continue;
      kept.push(p);
      last = p;
    }
    this.preview = kept;
    this.rebuild();
  }

  get duration(): number {
    const n = this.points.length;
    return n > 1 ? this.points[n - 1].t - this.points[0].t : 0;
  }

  get centroid(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const p of this.points) {
      x += p.x;
      y += p.y;
    }
    const n = Math.max(this.points.length, 1);
    return { x: x / n, y: y / n };
  }

  /** Draw in this colour from now on (a branch on the bank: the bough's ink, not the brush's). */
  useColor(c: THREE.Vector3): void {
    this.material.uniforms.uColor.value = c;
  }

  setOpacity(o: number): void {
    this.opacity = o;
    this.material.uniforms.uOpacity.value = o;
  }

  private rebuild(): void {
    const pts = this.preview.length ? [...this.points, ...this.preview] : this.points;
    const n = pts.length;
    let total = this.length;
    for (let i = this.points.length; i < n; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const sv = this.geometry.getAttribute('aSV') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const SV = sv.array as Float32Array;

    if (n === 1) {
      // A single dab: a round ink dot, so the ink appears the moment the
      // brush touches down (docs/02 §5.4).
      const p = pts[0];
      const r = this.baseWidth * 0.7;
      this.material.uniforms.uDot.value = 1;
      P.set([p.x - r, p.y - r, 0, p.x - r, p.y + r, 0, p.x + r, p.y - r, 0, p.x + r, p.y + r, 0]);
      SV.set([0, -1, 0, 1, r * 2, -1, r * 2, 1]);
      this.material.uniforms.uLen.value = r * 2;
      this.geometry.setDrawRange(0, 6);
      pos.needsUpdate = true;
      sv.needsUpdate = true;
      return;
    }

    this.material.uniforms.uDot.value = 0;
    let arc = 0;
    let smoothedW = this.baseWidth;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[Math.max(i - 1, 0)];
      const b = pts[Math.min(i + 1, n - 1)];
      let tx = b.x - a.x;
      let ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      if (i > 0) arc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);

      // Faster strokes are thinner; pen pressure widens.
      const dt = Math.max(b.t - a.t, 1);
      const speed = tl / dt; // px per ms
      let w = this.baseWidth * (0.5 + 0.5 * (1 - Math.min(speed / 2.2, 1)));
      if (this.isPen) w *= 0.35 + p.pressure * 1.2;
      smoothedW += (w - smoothedW) * 0.35;
      const taperIn = Math.min(arc / 14, 1);
      const taperOut = this.finished ? Math.min((total - arc) / 26, 1) : Math.min((total - arc) / 6 + 0.4, 1);
      const half = smoothedW * (0.25 + 0.75 * taperIn) * (0.15 + 0.85 * taperOut);

      const nx = -ty * half;
      const ny = tx * half;
      P[i * 6 + 0] = p.x + nx;
      P[i * 6 + 1] = p.y + ny;
      P[i * 6 + 2] = 0;
      P[i * 6 + 3] = p.x - nx;
      P[i * 6 + 4] = p.y - ny;
      P[i * 6 + 5] = 0;
      SV[i * 4 + 0] = arc;
      SV[i * 4 + 1] = 1;
      SV[i * 4 + 2] = arc;
      SV[i * 4 + 3] = -1;
    }
    this.material.uniforms.uLen.value = total;
    this.geometry.setDrawRange(0, (n - 1) * 6);
    pos.needsUpdate = true;
    sv.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
