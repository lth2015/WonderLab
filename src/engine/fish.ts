import * as THREE from 'three';
import { fishFrag, ribbonVert } from './shaders/ink';
import type { Palette } from './palette';
import type { StrokePoint } from './stroke';

const N = 32;
const FORM_TIME = 0.9; // s, mirrors docs/03 §6.3 (creation 1.2–1.8 s incl. ink bleed)

// Mirrors fishProfileGLSL in shaders/ink.ts.
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const bodyW = (s: number) => Math.sqrt(Math.min(Math.max(s / 0.1, 0), 1)) * (1 - 0.86 * smooth(0.2, 0.88, s));
const pectW = (s: number, k: number) => k * 0.75 * Math.exp(-(((s - 0.27) / 0.07) ** 2));
const tailW = (s: number) => 1.5 * smooth(0.8, 1, s);
const envW = (s: number, k: number) => Math.max(bodyW(s) + pectW(s, k), tailW(s), 0.02);

export interface WaterBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SwimContext {
  time: number;
  bounds: WaterBounds;
  others: Fish[];
  ripple: (x: number, y: number, strength: number) => void;
}

type State = 'forming' | 'swimming' | 'leaving';

export class Fish {
  readonly xs = new Float32Array(N);
  readonly ys = new Float32Array(N);
  readonly L: number;
  readonly maxW: number;
  readonly group = new THREE.Group();
  state: State = 'forming';
  opacity: number;
  dead = false;

  private readonly seg: number;
  private readonly baseSpeed: number;
  private readonly amp: number;
  private readonly seed = Math.random() * 100;
  private heading: number;
  private speed = 0;
  private phase = 0;
  private age = 0;
  private grow = 0;
  private startle = 0;
  private startleDir = 0;
  private attract: { x: number; y: number; until: number } | null = null;
  private nextWake = 2 + Math.random() * 2;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly shadowMaterial: THREE.ShaderMaterial;
  private readonly shadowMesh: THREE.Mesh;

  constructor(
    stroke: StrokePoint[],
    strokeLength: number,
    strokeDuration: number,
    minDim: number,
    palette: Palette,
    readonly ghost = false,
  ) {
    this.opacity = ghost ? 0.38 : 1;
    // Length follows the stroke, within limits.
    this.L = THREE.MathUtils.clamp(strokeLength, minDim * 0.1, minDim * 0.26);
    this.maxW = this.L * 0.12;
    this.seg = this.L / (N - 1);

    // The drawn line becomes the spine; the pen-up end becomes the head.
    const spine = resample(stroke, strokeLength, N);
    const k = this.L / Math.max(strokeLength, 1);
    for (let i = 0; i < N; i++) {
      this.xs[i] = spine[0].x + (spine[i].x - spine[0].x) * k;
      this.ys[i] = spine[0].y + (spine[i].y - spine[0].y) * k;
    }
    this.heading = Math.atan2(this.ys[0] - this.ys[2], this.xs[0] - this.xs[2]);

    // Quick strokes make lively fish; curvy strokes make softer swimmers.
    const drawSpeed = strokeLength / Math.max(strokeDuration, 16); // px/ms
    const lively = THREE.MathUtils.clamp(drawSpeed / 1.6, 0, 1);
    this.baseSpeed = this.L * (0.3 + 0.75 * lively);
    const curviness = THREE.MathUtils.clamp(totalTurn(spine) / Math.PI, 0, 1);
    this.amp = this.L * (0.03 + 0.05 * curviness);

    const uniforms = (shadow: number) => ({
      uPaper: { value: palette.paper },
      uInk: { value: palette.ink },
      uCinnabar: { value: palette.cinnabar },
      uWater: { value: palette.water },
      uSeed: { value: this.seed },
      uPatch: { value: Math.random() < 0.65 ? 0.5 + Math.random() * 0.5 : 0 },
      uGrow: { value: 0 },
      uOpacity: { value: this.opacity },
      uPect: { value: 1 },
      uL: { value: this.L },
      uMaxW: { value: this.maxW },
      uShadow: { value: shadow },
    });
    const make = (shadow: number) =>
      new THREE.ShaderMaterial({
        vertexShader: ribbonVert,
        fragmentShader: fishFrag,
        // The spine runs head to tail, against the drawing direction, so the ribbon's winding flips.
        side: THREE.DoubleSide,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: uniforms(shadow),
      });
    this.material = make(0);
    this.shadowMaterial = make(1);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const sv = new Float32Array(N * 2 * 2);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      sv.set([s, 1, s, -1], i * 4);
    }
    this.geometry.setAttribute('aSV', new THREE.BufferAttribute(sv, 2));
    const index: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);

    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    this.shadowMesh = new THREE.Mesh(this.geometry, this.shadowMaterial);
    this.shadowMesh.renderOrder = 1;
    this.shadowMesh.frustumCulled = false;
    this.shadowMesh.position.set(this.L * 0.05, -this.L * 0.08, 0);
    this.group.add(this.shadowMesh, mesh);
    this.rebuild();
  }

  get headX(): number {
    return this.xs[0];
  }

  get headY(): number {
    return this.ys[0];
  }

  /** Distance from a point to the front three quarters of the body, with the motion led slightly. */
  hitDistance(x: number, y: number): number {
    const lead = 0.15 * this.speed;
    const lx = Math.cos(this.heading) * lead;
    const ly = Math.sin(this.heading) * lead;
    let best = Infinity;
    for (let i = 0; i < N * 0.75; i++) {
      best = Math.min(best, Math.hypot(x - this.xs[i] - lx, y - this.ys[i] - ly));
    }
    return best;
  }

  get hitRadius(): number {
    return Math.max(this.maxW * 1.4, 22);
  }

  scare(fromX: number, fromY: number, strength: number): void {
    if (this.state === 'forming') return;
    this.startle = Math.min(1, this.startle + strength);
    this.startleDir = Math.atan2(this.headY - fromY, this.headX - fromX) + (Math.random() - 0.5) * 0.8;
    this.phase += 1.2;
  }

  lure(x: number, y: number, now: number): void {
    if (this.state !== 'swimming' || this.ghost) return;
    this.attract = { x, y, until: now + 2.5 };
  }

  leave(): void {
    if (this.state !== 'leaving') this.state = 'leaving';
  }

  update(dt: number, ctx: SwimContext): void {
    this.age += dt;
    if (this.state === 'forming') {
      this.grow = Math.min(this.age / FORM_TIME, 1);
      this.phase += dt * 2.5;
      if (this.grow >= 1) {
        this.state = 'swimming';
        ctx.ripple(this.headX, this.headY, this.ghost ? 0.4 : 0.9);
      }
    } else {
      this.swim(dt, ctx);
    }

    if (this.ghost && this.age > 4) this.leave();
    if (this.state === 'leaving') {
      this.opacity -= dt / (this.ghost ? 1.2 : 2.2);
      if (this.opacity <= 0) this.dead = true;
    }
    this.material.uniforms.uGrow.value = this.grow;
    this.material.uniforms.uOpacity.value = Math.max(this.opacity, 0);
    this.material.uniforms.uPect.value = 1 + 0.25 * Math.sin(this.phase * 0.5);
    this.shadowMaterial.uniforms.uGrow.value = this.grow;
    this.shadowMaterial.uniforms.uOpacity.value = Math.max(this.opacity, 0);
    this.shadowMaterial.uniforms.uPect.value = this.material.uniforms.uPect.value;
    this.rebuild();
  }

  scale(sx: number, sy: number): void {
    for (let i = 0; i < N; i++) {
      this.xs[i] *= sx;
      this.ys[i] *= sy;
    }
    if (this.attract) {
      this.attract.x *= sx;
      this.attract.y *= sy;
    }
  }

  private swim(dt: number, ctx: SwimContext): void {
    const { time, bounds } = ctx;
    this.startle *= Math.exp(-dt * 1.6);
    const target = this.baseSpeed * (1 + this.startle * 3);
    this.speed += (target - this.speed) * Math.min(dt * 1.8, 1);

    // Gentle wandering.
    let turn = (Math.sin(time * 0.37 + this.seed) * 0.6 + Math.sin(time * 0.13 + this.seed * 2.3) * 0.45) * 0.7;

    // Steering forces, accumulated as a desired direction.
    let sx = 0;
    let sy = 0;
    const m = this.L * 0.9;
    const x = this.headX;
    const y = this.headY;
    if (x < bounds.minX + m) sx += (bounds.minX + m - x) / m;
    if (x > bounds.maxX - m) sx -= (x - bounds.maxX + m) / m;
    if (y < bounds.minY + m) sy += (bounds.minY + m - y) / m;
    if (y > bounds.maxY - m) sy -= (y - bounds.maxY + m) / m;
    for (const o of ctx.others) {
      if (o === this || o.state === 'forming') continue;
      const dx = x - o.headX;
      const dy = y - o.headY;
      const d = Math.hypot(dx, dy);
      const r = (this.L + o.L) * 0.4;
      if (d < r && d > 0) {
        sx += (dx / d) * (1 - d / r) * 0.8;
        sy += (dy / d) * (1 - d / r) * 0.8;
      }
    }
    if (this.attract) {
      const dx = this.attract.x - x;
      const dy = this.attract.y - y;
      const d = Math.hypot(dx, dy);
      if (time > this.attract.until || d < this.L * 0.4) this.attract = null;
      else {
        sx += (dx / d) * 0.9;
        sy += (dy / d) * 0.9;
      }
    }
    const mag = Math.hypot(sx, sy);
    if (mag > 0.01) turn += angleDiff(Math.atan2(sy, sx), this.heading) * Math.min(mag, 1.5) * 2.4;
    if (this.startle > 0.25) turn += angleDiff(this.startleDir, this.heading) * 7 * this.startle;
    const maxTurn = 2.6 + this.startle * 5;
    this.heading += THREE.MathUtils.clamp(turn, -maxTurn, maxTurn) * dt;

    // Move the head; the body follows the path it traced.
    this.xs[0] += Math.cos(this.heading) * this.speed * dt;
    this.ys[0] += Math.sin(this.heading) * this.speed * dt;
    for (let i = 1; i < N; i++) {
      const dx = this.xs[i] - this.xs[i - 1];
      const dy = this.ys[i] - this.ys[i - 1];
      const d = Math.hypot(dx, dy) || 1;
      this.xs[i] = this.xs[i - 1] + (dx / d) * this.seg;
      this.ys[i] = this.ys[i - 1] + (dy / d) * this.seg;
    }
    // Tail beat quickens with speed.
    this.phase += dt * (3 + (this.speed / this.L) * 5);

    // Now and then a faint wake ring.
    this.nextWake -= dt * (0.5 + this.speed / this.baseSpeed * 0.5);
    if (this.nextWake <= 0 && !this.ghost) {
      ctx.ripple(this.headX, this.headY, 0.22 + this.startle * 0.4);
      this.nextWake = 2.5 + Math.random() * 3;
    }
  }

  private rebuild(): void {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const sv = this.geometry.getAttribute('aSV') as THREE.BufferAttribute;
    const SV = sv.array as Float32Array;
    const growW = smooth(0, 1, this.grow);
    const swimAmp = this.amp * (this.state === 'forming' ? this.grow * 0.3 : 0.6 + Math.min(this.speed / this.baseSpeed, 2) * 0.4);
    const pect = 1 + 0.25 * Math.sin(this.phase * 0.5);

    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const a = Math.max(i - 1, 0);
      const b = Math.min(i + 1, N - 1);
      let tx = this.xs[a] - this.xs[b];
      let ty = this.ys[a] - this.ys[b];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty;
      const ny = tx;
      // Travelling wave, stronger toward the tail.
      const lateral = swimAmp * Math.sin(this.phase - s * 5.5) * (0.12 + Math.pow(s, 1.3));
      const cx = this.xs[i] + nx * lateral;
      const cy = this.ys[i] + ny * lateral;
      const halfU = envW(s, pect) * growW; // in maxW units
      const half = halfU * this.maxW;
      P[i * 6 + 0] = cx + nx * half;
      P[i * 6 + 1] = cy + ny * half;
      P[i * 6 + 2] = 0;
      P[i * 6 + 3] = cx - nx * half;
      P[i * 6 + 4] = cy - ny * half;
      P[i * 6 + 5] = 0;
      // Side offset rather than a ±1 flag: it interpolates without the
      // zigzag a flag shows across trapezoid segments.
      SV[i * 4 + 1] = halfU;
      SV[i * 4 + 3] = -halfU;
    }
    pos.needsUpdate = true;
    sv.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.shadowMaterial.dispose();
  }
}

/** Resample a stroke to n points by arc length, ordered from the last point (head) back to the first. */
function resample(points: StrokePoint[], length: number, n: number): { x: number; y: number }[] {
  const rev = [...points].reverse();
  const out: { x: number; y: number }[] = [{ x: rev[0].x, y: rev[0].y }];
  const step = length / (n - 1);
  let target = step;
  let acc = 0;
  for (let i = 1; i < rev.length && out.length < n; i++) {
    const a = rev[i - 1];
    const b = rev[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + d >= target && out.length < n) {
      const t = (target - acc) / (d || 1);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      target += step;
    }
    acc += d;
  }
  while (out.length < n) out.push({ ...out[out.length - 1] });
  return out;
}

function totalTurn(pts: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 2; i < pts.length; i++) {
    const a1 = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x);
    const a2 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    sum += Math.abs(angleDiff(a2, a1));
  }
  return sum;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
