import * as THREE from 'three';
import { fishFrag, ribbonVert } from './shaders/ink';
import type { Palette } from './palette';
import type { StrokePoint } from './stroke';
import type { KoiSkin } from './art';
import { RING_MARGIN, slotPoint, type Orbit } from './relations';
import { patchFor, totalTurn, type Family } from './koi-style';

const N = 32;
export const FORM_TIME = 0.9; // s, mirrors docs/03 §6.3 (creation 1.2–1.8 s incl. ink bleed)
const CALM_FADE = 0.6; // s, reduced motion: fade in instead of growing (docs/03 §8)

// Mirrors fishProfileGLSL in shaders/ink.ts.
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const bodyW = (s: number) => Math.sqrt(Math.min(Math.max(s / 0.1, 0), 1)) * (1 - 0.86 * smooth(0.2, 0.88, s));
const pectW = (s: number, k: number) => k * 0.75 * Math.exp(-(((s - 0.27) / 0.07) ** 2));
const tailW = (s: number) => 1.5 * smooth(0.8, 1, s);
const envW = (s: number, k: number) => Math.max(bodyW(s) + pectW(s, k), tailW(s), 0.02);

/** How a fish looks, kept so a saved fish comes back the same. */
export interface FishLook {
  seed: number;
  /** Cinnabar for the procedural koi; chosen from the variety when absent. */
  patch?: number;
  /** A fish a meteor turned into (docs/02 §5.5): a small golden koi (ogon) that lights the water under it. */
  glow?: boolean;
  /** The koi variety its stroke leaned toward (koi-style.ts); absent in older saves. */
  variety?: string;
  /** The world's first fish, the user's own (本命鱼, docs/02 §5.1). */
  honmei?: boolean;
}

/** Where a fish came from (docs/02 §5.1): kept so the stroke behind it can be shown again one day. */
export interface FishOrigin {
  /** The stroke in drawing order: x / width, y / height (from the bottom), ms from its first point. */
  stroke: [number, number, number][];
  /** Short screen edges per second. */
  speed: number;
  /** Total turn over π. */
  curviness: number;
  family: Family;
  /** mouse, touch, pen or keyboard. */
  pointer: string;
  /** 1 for the world's first fish, counting up. */
  born: number;
}

export interface FishOptions {
  ghost?: boolean;
  /** Reduced motion: no growth, half speed. */
  calm?: boolean;
  look?: FishLook;
  /** 0..1 from the stroke's normalised speed; without it, from the raw drawing speed. */
  lively?: number;
  origin?: FishOrigin;
  /** When it was born (ms since the epoch); now when absent. */
  bornAt?: number;
  /** How far it has grown up, 0..1 (time.ts): sets its size and deepens its colours a shade. */
  maturity?: number;
  /** Size multiplier for its age (time.ts growthFor), applied to the length it is given. */
  growth?: number;
  /** The size multiplier it has once made (time.ts regrow): saved with it, so coming back does not count growth twice. */
  size?: number;
  /** A restored fish: its spine is already its body, so its length is kept as it is (no limits, no rescale). */
  restored?: boolean;
  /** A fish someone sent (送一条鱼): the gift it came in, and the sender's optional seal. */
  gift?: FishGift;
  /** Still at the lake's edge, not yet taken in: never saved. */
  guest?: boolean;
}

export interface FishGift {
  /** The gift link's id (gift/codec.ts), so the same link is not taken in twice. */
  id: string;
  seal?: string;
}

let nextFishId = 1;

const LEAP_TIME = 1.1;     // s in the air
const LEAP_COOLDOWN = 6;   // s before the same fish leaps again

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
  private readonly cx = new Float32Array(N);
  private readonly cy = new Float32Array(N);
  private readonly nx = new Float32Array(N);
  private readonly ny = new Float32Array(N);
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
  readonly seed: number;
  readonly patch: number;
  readonly ghost: boolean;
  readonly glow: boolean;
  readonly honmei: boolean;
  readonly variety: string | null;
  readonly origin: FishOrigin | null;
  readonly bornAt: number;
  /** How much it has grown past what was drawn (time.ts growthFor); 1 for a newborn. */
  readonly size: number;
  /** Stable for this page, for pointing at a fish from the UI. */
  readonly id = nextFishId++;
  readonly gift: FishGift | null;
  /** At the lake's edge, not yet taken in (送一条鱼): swims, but is never saved. */
  guest: boolean;
  private readonly calm: boolean;
  /** Stroke length over drawing time, px/ms: sets how lively the fish is. */
  readonly drawSpeed: number;
  private leapT = -1;
  /** Ribbon half width in maxW units when a painted skin is on; 0 for procedural. */
  private skinHalf = 0;
  /** How far under the surface this fish swims, 0..1; each fish has its own. */
  private readonly depth: number;
  /** How much this fish likes company, 0..1; about one in five keeps to itself. */
  private readonly sociability: number;
  private leapCooldown = 0;
  private heading: number;
  private speed = 0;
  private phase = 0;
  private age = 0;
  private grow = 0;
  private startle = 0;
  private startleDir = 0;
  private attract: { x: number; y: number; until: number; eager: boolean } | null = null;
  private orbit: Orbit | null = null;
  private slot = 0;
  /** Rain brings fish up, mist lets them sink a little (docs/02 §5.5); eased toward the targets. */
  private rise = 0;
  private mist = 0;
  private riseTarget = 0;
  private mistTarget = 0;
  /** Snow: slower and a little deeper, heavier in the cold water. */
  private chill = 0;
  private chillTarget = 0;
  /** 月夜: how much of the moon's light path the fish is in, eased. */
  private silver = 0;
  private silverTarget = 0;
  /** Asked to rest (一句成境): slow and near the surface until then. */
  private restUntil = -1;
  private rest = 0;
  private nextWake = 2 + Math.random() * 2;
  private fadeTime: number;
  private spread = 1;
  private fadeIn = 1;
  private veil = 1;
  private veilTarget = 1;
  private dispersing = false;
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
    options: FishOptions = {},
  ) {
    const ghost = (this.ghost = !!options.ghost);
    const calm = (this.calm = !!options.calm);
    this.seed = options.look?.seed ?? Math.random() * 100;
    this.glow = !!options.look?.glow;
    this.honmei = !!options.look?.honmei && !ghost && !this.glow;
    this.variety = this.glow ? null : (options.look?.variety ?? null);
    this.origin = options.origin ?? null;
    this.bornAt = options.bornAt ?? Date.now();
    this.size = options.size ?? 1;
    this.gift = options.gift ?? null;
    this.guest = !!options.guest;
    this.depth = 0.2 + 0.4 * ((this.seed * 0.7548777) % 1);
    this.sociability = (this.seed * 0.3819) % 1 < 0.2 ? 0.1 : 0.6 + 0.4 * ((this.seed * 1.618) % 1);
    this.patch = this.glow
      ? 0
      : (options.look?.patch ?? (this.variety ? patchFor(this.variety, Math.random) : Math.random() < 0.65 ? 0.5 + Math.random() * 0.5 : 0));
    this.opacity = ghost ? 0.38 : 1;
    this.fadeTime = ghost ? 1.2 : 2.2;
    // Length follows the stroke, within limits; an older fish has grown a little past it.
    const drawn = options.restored ? strokeLength : THREE.MathUtils.clamp(strokeLength, minDim * 0.1, minDim * 0.26);
    this.L = drawn * (options.growth ?? 1);
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
    // Each fish also has a temperament of its own (from its seed), so its
    // character follows the stroke without being fixed by it or by its colours.
    const drawSpeed = (this.drawSpeed = strokeLength / Math.max(strokeDuration, 16));
    const fromStroke = options.lively ?? THREE.MathUtils.clamp(drawSpeed / 1.6, 0, 1);
    const temper = (this.seed * 0.5772157) % 1;
    const lively = THREE.MathUtils.clamp(0.65 * fromStroke + 0.35 * temper, 0, 1);
    this.baseSpeed = this.L * (0.3 + 0.75 * lively) * (calm ? 0.5 : 1);
    if (calm) this.grow = 1;
    const curviness = THREE.MathUtils.clamp(totalTurn(spine) / Math.PI, 0, 1);
    this.amp = this.L * (0.03 + 0.05 * curviness);

    const uniforms = (shadow: number) => ({
      uPaper: { value: palette.paper },
      uInk: { value: palette.ink },
      uCinnabar: { value: palette.cinnabar },
      uWater: { value: palette.water },
      uSeed: { value: this.seed },
      uPatch: { value: this.patch },
      uGrow: { value: 0 },
      uOpacity: { value: this.opacity },
      uPect: { value: 1 },
      uL: { value: this.L },
      uMaxW: { value: this.maxW },
      uShadow: { value: shadow },
      uSpread: { value: 1 },
      uSkin: { value: null as THREE.Texture | null },
      uSkinOn: { value: 0 },
      uSkinHalf: { value: 1 },
      uSkinFlip: { value: 0 },
      uDepth: { value: this.depth },
      uTime: { value: 0 },
      uGlow: { value: this.glow ? 1 : 0 },
      uMark: { value: this.honmei && !shadow ? 1 : 0 },
      uAge: { value: options.maturity ?? 0 },
      uSilver: { value: 0 },
      uSheen: { value: new THREE.Vector3(0.78, 0.83, 0.92) },
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
    // A glowing fish lights the water under it instead of casting a shadow.
    if (!this.glow) this.shadowMesh.position.set(this.L * 0.05, -this.L * 0.08, 0);
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

  /** Swim over to a point for a while; an eager fish hurries. */
  lure(x: number, y: number, now: number, opts: { duration?: number; eager?: boolean } = {}): void {
    if (this.state !== 'swimming' || this.ghost || this.orbit) return;
    this.attract = { x, y, until: now + (opts.duration ?? 2.5), eager: !!opts.eager };
  }

  leave(): void {
    if (this.state !== 'leaving') this.state = 'leaving';
  }

  /** Stop heading where it was lured: 留下它, while a released fish is still swimming off. */
  stopLure(): void {
    this.attract = null;
  }

  /** Undo: the ink loosens and dissolves into the water. */
  disperse(): void {
    this.state = 'leaving';
    this.dispersing = true;
    this.fadeTime = 0.8;
  }

  /** Pick a painted koi from the generated set (by seed, so a saved fish keeps it), or none. */
  setSkins(skins: KoiSkin[]): void {
    // A meteor's fish wears the golden koi like the rest of the lake; its light, not a different style, sets it apart.
    const name = this.glow ? 'ogon' : this.variety;
    const named = name ? skins.find((k) => k.name === name) : undefined;
    const skin = !skins.length ? null : (named ?? skins[Math.floor(((this.seed * 0.618034) % 1) * skins.length)]);
    this.skinHalf = skin ? skin.halfWidth / 0.12 : 0; // maxW is 0.12 of the length
    for (const m of [this.material, this.shadowMaterial]) {
      m.uniforms.uSkin.value = skin?.texture ?? null;
      m.uniforms.uSkinOn.value = skin ? 1 : 0;
      m.uniforms.uSkinHalf.value = this.skinHalf || 1;
      m.uniforms.uSkinFlip.value = skin?.flip ? 1 : 0;
    }
  }

  /** Weather levels, 0..1 (docs/02 §5.5). */
  setWeather(rise: number, mist: number, chill = 0): void {
    this.riseTarget = rise;
    this.mistTarget = mist;
    this.chillTarget = chill;
  }

  /**
   * How much light lies on the water where the fish is swimming, 0..1: the
   * moon's path (月夜), or with `gold` the setting sun's (落日), which the
   * back catches as gold.
   */
  setMoonlight(level: number, gold = false): void {
    this.silverTarget = level;
    const c = this.material.uniforms.uSheen.value as THREE.Vector3;
    const t = gold ? [1.0, 0.72, 0.38] : [0.78, 0.83, 0.92];
    if (level > 0.02) c.lerp(new THREE.Vector3(t[0], t[1], t[2]), 0.1);
  }

  /** 各自的偏爱: where in a light path this fish likes to be, -1..1 (0 the middle, ±1 the edges). Its own, from its seed. */
  get lightPref(): number {
    return Math.sin(this.seed * 12.9898);
  }

  setRest(until: number): void {
    this.restUntil = until;
  }

  /** Put the fish, body and all, with its head at a point (it was found there on return). */
  moveHeadTo(x: number, y: number): void {
    const dx = x - this.xs[0];
    const dy = y - this.ys[0];
    for (let i = 0; i < N; i++) {
      this.xs[i] += dx;
      this.ys[i] += dy;
    }
    this.rebuild();
  }

  get orbiting(): boolean {
    return !!this.orbit;
  }

  /** Swim round with the others (群鱼成圆), or stop when null. */
  setOrbit(o: Orbit | null, slot = 0): void {
    this.orbit = o;
    this.slot = slot;
    if (o) this.attract = null;
  }

  get canLeap(): boolean {
    return this.state === 'swimming' && !this.ghost && this.leapT < 0 && this.leapCooldown <= 0;
  }

  /** Touched twice in quick succession: jump clear of the water (P1). */
  leap(): void {
    if (!this.canLeap) return;
    this.leapT = 0;
    this.startle = Math.min(1, this.startle + 0.6);
    this.startleDir = this.heading;
  }

  /** Spine from tail to head, the order a stroke is drawn in. */
  spineFromTail(): { x: number; y: number }[] {
    const out = [];
    for (let i = N - 1; i >= 0; i--) out.push({ x: this.xs[i], y: this.ys[i] });
    return out;
  }

  /** Restart: fade out but stay, so the restart can be taken back. */
  hide(): void {
    this.veilTarget = 0;
  }

  show(): void {
    this.veilTarget = 1;
  }

  get hidden(): boolean {
    return this.veilTarget === 0;
  }

  get undone(): boolean {
    return this.dispersing;
  }

  update(dt: number, ctx: SwimContext): void {
    this.age += dt;
    if (this.state === 'forming') {
      this.grow = this.calm ? 1 : Math.min(this.age / FORM_TIME, 1);
      this.fadeIn = this.calm ? Math.min(this.age / CALM_FADE, 1) : 1;
      this.phase += dt * 2.5;
      if (this.grow >= 1 && this.fadeIn >= 1) {
        this.state = 'swimming';
        ctx.ripple(this.headX, this.headY, this.ghost ? 0.4 : 0.9);
      }
    } else {
      this.swim(dt, ctx);
    }

    this.updateLeap(dt, ctx);
    if (this.ghost && this.age > 4) this.leave();
    if (this.state === 'leaving') {
      this.opacity -= dt / this.fadeTime;
      if (this.dispersing) this.spread += dt * 0.6;
      if (this.opacity <= 0) this.dead = true;
    }
    this.material.uniforms.uGrow.value = this.grow;
    this.veil += Math.sign(this.veilTarget - this.veil) * Math.min(Math.abs(this.veilTarget - this.veil), dt / 0.6);
    const shown = Math.max(this.opacity, 0) * this.fadeIn * this.veil;
    this.material.uniforms.uOpacity.value = shown;
    this.material.uniforms.uPect.value = 1 + 0.25 * Math.sin(this.phase * 0.5);
    this.shadowMaterial.uniforms.uGrow.value = this.grow;
    this.shadowMaterial.uniforms.uOpacity.value = shown;
    this.shadowMaterial.uniforms.uPect.value = this.material.uniforms.uPect.value;
    this.material.uniforms.uSpread.value = this.spread;
    this.shadowMaterial.uniforms.uSpread.value = this.spread;
    // Drifts a little up and down; a leap brings it to the surface. Rain
    // brings it up, mist lets it sink and blurs its shadow.
    const ease = Math.min(dt / 2.5, 1);
    this.rest += ((ctx.time < this.restUntil ? 1 : 0) - this.rest) * ease;
    this.rise += (Math.max(this.riseTarget, 0.6 * this.rest) - this.rise) * ease;
    this.mist += (this.mistTarget - this.mist) * ease;
    this.chill += (this.chillTarget - this.chill) * ease * 0.5;
    this.silver += (this.silverTarget - this.silver) * Math.min(dt * 5, 1);
    this.material.uniforms.uSilver.value = this.silver;
    const leapH = this.leapT >= 0 ? Math.sin(Math.PI * this.leapT) : 0;
    const swimDepth = this.depth * (1 - 0.7 * this.rise) + 0.2 * this.mist + 0.12 * this.chill;
    const depth = Math.min(Math.max(0, swimDepth + 0.08 * Math.sin(ctx.time * 0.13 + this.seed) - leapH), 1);
    for (const m of [this.material, this.shadowMaterial]) {
      m.uniforms.uDepth.value = depth;
      m.uniforms.uTime.value = ctx.time;
    }
    if (!this.glow) this.shadowMaterial.uniforms.uOpacity.value = shown * (1 - 0.65 * this.mist);
    else {
      const pulse = 0.85 + 0.15 * Math.sin(ctx.time * 1.7 + this.seed);
      this.material.uniforms.uGlow.value = pulse;
      this.shadowMaterial.uniforms.uGlow.value = pulse;
    }
    this.rebuild();
  }

  private updateLeap(dt: number, ctx: SwimContext): void {
    this.leapCooldown -= dt;
    if (this.leapT < 0) return;
    this.leapT += dt / LEAP_TIME;
    const done = this.leapT >= 1;
    const h = done ? 0 : Math.sin(Math.PI * this.leapT);
    // Seen from above, a fish in the air looks larger and its shadow falls away.
    const s = 1 + 0.3 * h;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < N; i++) {
      cx += this.xs[i];
      cy += this.ys[i];
    }
    cx /= N;
    cy /= N;
    this.group.scale.set(s, s, 1);
    this.group.position.set(cx * (1 - s), cy * (1 - s), 0);
    this.shadowMesh.position.set(this.L * (0.05 + 0.25 * h), -this.L * (0.08 + 0.45 * h), 0);
    if (done) {
      this.leapT = -1;
      this.leapCooldown = LEAP_COOLDOWN;
      ctx.ripple(this.headX, this.headY, 1.4);
      ctx.ripple(cx, cy, 0.9);
    }
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
    let target = this.baseSpeed * (1 + this.startle * 3);
    // In a ring: chase this fish's slot, quicker the further behind it is.
    let chase: { x: number; y: number } | null = null;
    if (this.orbit && time > this.orbit.until) this.orbit = null;
    if (this.orbit) {
      chase = slotPoint(this.orbit, this.slot, time);
      const gap = Math.hypot(chase.x - this.headX, chase.y - this.headY);
      target = Math.max(target, this.L * 0.65) * (1 + 0.9 * Math.min(gap / (this.L * 1.5), 1));
    } else if (this.attract?.eager) target *= 1.35;
    target *= (1 - 0.6 * this.rest) * (1 - 0.4 * this.chill);
    this.speed += (target - this.speed) * Math.min(dt * 1.8, 1);

    // Gentle wandering.
    let turn = (Math.sin(time * 0.37 + this.seed) * 0.6 + Math.sin(time * 0.13 + this.seed * 2.3) * 0.45) * 0.7;

    // Steering forces, accumulated as a desired direction.
    let sx = 0;
    let sy = 0;
    // Swimming the ring may take a fish closer to the edge (relations.ts).
    const m = this.L * (this.orbit ? RING_MARGIN * 0.8 : 0.9);
    const x = this.headX;
    const y = this.headY;
    if (x < bounds.minX + m) sx += (bounds.minX + m - x) / m;
    if (x > bounds.maxX - m) sx -= (x - bounds.maxX + m) / m;
    if (y < bounds.minY + m) sy += (bounds.minY + m - y) / m;
    if (y > bounds.maxY - m) sy -= (y - bounds.maxY + m) / m;
    // Swimming together (docs/02 §5.1, P1): a neighbour a few lengths away
    // draws this fish alongside, matching its heading, while closer than
    // that they give each other room. How sociable a fish is comes from its
    // seed, and the wish for company rises and falls slowly, so pairs and
    // small groups form, swim a while and drift apart again.
    const social = this.ghost || this.orbit ? 0 : this.sociability * (0.5 + 0.5 * Math.sin(time * 0.045 + this.seed * 3.1));
    let ax = 0;
    let ay = 0;
    let gx = 0;
    let gy = 0;
    let weight = 0;
    let pace = 0;
    for (const o of ctx.others) {
      if (o === this || o.state !== 'swimming' || o.hidden) continue;
      const dx = x - o.headX;
      const dy = y - o.headY;
      const d = Math.hypot(dx, dy);
      // Koi give each other room rather than swimming through one another.
      const r = (this.L + o.L) * 0.7;
      if (d < r && d > 0) {
        sx += (dx / d) * (1 - d / r) * 1.4;
        sy += (dy / d) * (1 - d / r) * 1.4;
      } else if (!o.ghost && d < r * 3.2) {
        // The first fish draws company more than the rest (本命鱼).
        const w = (1 - (d - r) / (r * 2.2)) * (o.honmei ? 1.8 : 1);
        ax += Math.cos(o.heading) * w;
        ay += Math.sin(o.heading) * w;
        gx += o.headX * w;
        gy += o.headY * w;
        pace += o.speed * w;
        weight += w;
      }
    }
    if (weight > 0 && social > 0.05) {
      const al = Math.hypot(ax, ay);
      if (al > 1e-3) {
        sx += (ax / al) * 0.55 * social;
        sy += (ay / al) * 0.55 * social;
      }
      const tx = gx / weight - x;
      const ty = gy / weight - y;
      const td = Math.hypot(tx, ty);
      if (td > 1e-3) {
        sx += (tx / td) * 0.35 * social;
        sy += (ty / td) * 0.35 * social;
      }
      // Keep pace a little with the company, without losing its own character.
      this.speed += (pace / weight - this.speed) * Math.min(dt * 0.4 * social, 1);
    }
    if (chase) {
      const dx = chase.x - x;
      const dy = chase.y - y;
      const d = Math.hypot(dx, dy) || 1;
      sx += (dx / d) * 1.6;
      sy += (dy / d) * 1.6;
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

    // Centre line first (spine plus the travelling wave), then the edges.
    const cxs = this.cx;
    const cys = this.cy;
    const nxs = this.nx;
    const nys = this.ny;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const a = Math.max(i - 1, 0);
      const b = Math.min(i + 1, N - 1);
      let tx = this.xs[a] - this.xs[b];
      let ty = this.ys[a] - this.ys[b];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      nxs[i] = -ty;
      nys[i] = tx;
      // Travelling wave, stronger toward the tail.
      const lateral = swimAmp * Math.sin(this.phase - s * 5.5) * (0.12 + Math.pow(s, 1.3));
      cxs[i] = this.xs[i] + nxs[i] * lateral;
      cys[i] = this.ys[i] + nys[i] * lateral;
    }
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      let halfU = (this.skinHalf || envW(s, pect)) * growW * this.spread; // in maxW units
      if (this.skinHalf && i > 0 && i < N - 1) {
        // A wide painted ribbon folds over itself on the inside of a tight
        // bend. Keep each edge inside the local radius of curvature; this only
        // trims fin tips in the sharpest turns.
        const a1 = Math.atan2(cys[i] - cys[i - 1], cxs[i] - cxs[i - 1]);
        const a2 = Math.atan2(cys[i + 1] - cys[i], cxs[i + 1] - cxs[i]);
        let turn = Math.abs(a2 - a1);
        if (turn > Math.PI) turn = Math.PI * 2 - turn;
        const seg = Math.hypot(cxs[i + 1] - cxs[i], cys[i + 1] - cys[i]) || 1;
        if (turn > 1e-4) halfU = Math.min(halfU, ((seg / turn) * 0.85) / this.maxW);
      }
      const half = halfU * this.maxW;
      P[i * 6 + 0] = cxs[i] + nxs[i] * half;
      P[i * 6 + 1] = cys[i] + nys[i] * half;
      P[i * 6 + 2] = 0;
      P[i * 6 + 3] = cxs[i] - nxs[i] * half;
      P[i * 6 + 4] = cys[i] - nys[i] * half;
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
  // Rounding can leave the last step just short: end on the stroke's own end, or a body saved before it swims comes back a step shorter.
  if (out.length < n) out.push({ x: rev[rev.length - 1].x, y: rev[rev.length - 1].y });
  while (out.length < n) out.push({ ...out[out.length - 1] });
  return out;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
