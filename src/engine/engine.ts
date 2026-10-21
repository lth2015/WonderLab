import * as THREE from 'three';
import { fullscreenVert } from './shaders/common';
import { landscapeFrag } from './shaders/landscape';
import { MAX_RIPPLES, worldFrag } from './shaders/world';
import type { Palette } from './palette';
import { Atmosphere } from './atmosphere';
import type { SceneCommand } from './intent';
import { weatherFrag } from './shaders/weather';
import { Stroke, type StrokePoint } from './stroke';
import { Fish } from './fish';
import { Sky, type MoonSpec } from './sky';
import { classify, spineFromOutline, type Classification, type Pt } from './classify';
import { FrameMonitor, TIERS, type Tier } from './quality';
import { INITIAL, type AtmosphereState } from './atmosphere';
import { logEvent, prompted } from '../telemetry';
import { SAVE_VERSION, type WorldSave } from './persist';
import type { Art } from './art';
import { EchoLayer } from './echo-layer';

// Thresholds mirror docs/03-ux-ui-design.md §6.2.
const TAP_MOVE = 8;
const LONG_PRESS_MS = 500;
const EDGE_GUARD = 16;
const UNDO_DEPTH = 20;
const RESTART_UNDO_MS = 5000;
const DOUBLE_TAP_S = 1.5;

export type CreationKind = 'fish' | 'moon' | 'star' | 'meteor' | 'cloud' | 'atmosphere';

export interface Creation {
  id: number;
  kind: CreationKind;
  /** Where to put the undo button, in CSS pixels from the top left. */
  x: number;
  y: number;
}

export interface EngineOptions {
  /** Pin a tier (e.g. from ?tier=light) instead of choosing by frame time. */
  tier?: Tier;
  reducedMotion?: boolean;
}

export interface EngineEvents {
  onFirstStroke?: () => void;
  onFishCreated?: (count: number) => void;
  onCreated?: (c: Creation) => void;
  onUndo?: (remaining: number) => void;
  onFishTouched?: () => void;
  onTierChange?: (tier: Tier) => void;
  /** The pending restart became final (or was taken back: `undone`). */
  onRestartSettled?: (undone: boolean) => void;
}

interface PendingRestart {
  fishes: Fish[];
  atmosphere: AtmosphereState;
  history: HistoryEntry[];
  timer: number;
}

interface HistoryEntry {
  id: number;
  kind: CreationKind;
  time: number;
  undo: () => void;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
  strength: number;
}

interface FadingStroke {
  stroke: Stroke;
  fadeFrom: number;
  duration: number;
}

interface ActiveInput {
  id: number;
  stroke: Stroke | null;
  downX: number;
  downY: number;
  downT: number;
  moved: number;
  fish: Fish | null;
}

export class Engine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  private readonly scene = new THREE.Scene();
  private readonly landscapeScene = new THREE.Scene();
  private readonly quadCamera = new THREE.Camera();
  private landscapeTarget: THREE.WebGLRenderTarget | null = null;
  private readonly landscapeMat: THREE.ShaderMaterial;
  private readonly worldMat: THREE.ShaderMaterial;
  private readonly atmosphere = new Atmosphere();
  private readonly palette: Palette = this.atmosphere.palette;
  private readonly weatherMat: THREE.ShaderMaterial;
  private readonly sky = new Sky();
  private history: HistoryEntry[] = [];
  private nextHistoryId = 1;
  private waveT = 0;
  private nextMoonLure = 6;
  private readonly monitor: FrameMonitor;
  private readonly pinnedTier: boolean;
  private calm: boolean;
  private restartPending: PendingRestart | null = null;
  private lastFishTouch: { fish: Fish; time: number } | null = null;
  private art: Art | null = null;
  private readonly echo = new EchoLayer();

  private width = 1;
  private height = 1;
  private horizon = 0.5;
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  private fishes: Fish[] = [];
  private ripples: Ripple[] = [];
  private fading: FadingStroke[] = [];
  private input: ActiveInput | null = null;
  private demo: { points: StrokePoint[]; stroke: Stroke; start: number } | null = null;
  private hadFirstStroke = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: EngineEvents = {},
    options: EngineOptions = {},
  ) {
    this.monitor = new FrameMonitor(options.tier ?? 'standard');
    this.pinnedTier = !!options.tier;
    this.calm = !!options.reducedMotion;
    this.sky.calm = this.calm;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // colours are already sRGB values
    this.renderer.setClearColor(0x0b0e13, 1);

    const quad = new THREE.PlaneGeometry(2, 2);
    const p = this.palette;
    this.landscapeMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: landscapeFrag,
      uniforms: {
        uRes: { value: new THREE.Vector2() },
        uHorizon: { value: this.horizon },
        uSeed: { value: 3.7 },
        uZenith: { value: p.zenith },
        uSkyLow: { value: p.skyLow },
        uMountain: { value: p.mountain },
        uInk: { value: p.ink },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.landscapeScene.add(new THREE.Mesh(quad, this.landscapeMat));

    this.worldMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: worldFrag,
      uniforms: {
        uLandscape: { value: null },
        uRes: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uHorizon: { value: this.horizon },
        uSkyLow: { value: p.skyLow },
        uWater: { value: p.water },
        uAccent: { value: p.accent },
        uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4()) },
        uRippleCount: { value: 0 },
        uPaper: { value: p.paper },
        uWaveT: { value: 0 },
        uWind: { value: this.atmosphere.wind },
        uDusk: { value: 0 },
        uPost: { value: 1 },
        uMoonTex: { value: null as THREE.Texture | null },
        uMoonTexOn: { value: 0 },
        ...this.sky.uniforms,
      },
      depthTest: false,
      depthWrite: false,
    });
    this.weatherMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: weatherFrag,
      uniforms: {
        uRes: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uHorizon: { value: this.horizon },
        uRain: { value: 0 },
        uMist: { value: 0 },
        uFireflies: { value: 0 },
        uWind: { value: 0 },
        uParticles: { value: 1 },
        uCalm: { value: this.calm ? 1 : 0 },
        uSkyLow: { value: p.skyLow },
        uAccent: { value: p.accent },
      },
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
    });
    const weather = new THREE.Mesh(quad, this.weatherMat);
    weather.renderOrder = 2.5; // over the fish, under the brush
    weather.frustumCulled = false;
    this.scene.add(weather);
    this.scene.add(this.echo.mesh);
    const bg = new THREE.Mesh(quad, this.worldMat);
    bg.renderOrder = 0;
    bg.frustumCulled = false;
    this.scene.add(bg);

    this.applyTier();
    this.bindInput();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Use generated koi and moon textures (scripts/gen-art.mjs) from now on, existing fish included. */
  setArt(art: Art): void {
    this.art = art;
    for (const f of this.fishes) f.setSkins(art.koi);
    this.worldMat.uniforms.uMoonTex.value = art.moon;
    this.worldMat.uniforms.uMoonTexOn.value = art.moon ? 1 : 0;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get tier(): Tier {
    return this.monitor.tier;
  }

  setReducedMotion(on: boolean): void {
    this.calm = on;
    this.sky.calm = on;
    this.weatherMat.uniforms.uCalm.value = on ? 1 : 0;
  }

  /** Keyboard creation (docs/03 §8): a fish or a moon at a random spot, or a tap on the lake. */
  keyAction(action: 'fish' | 'moon' | 'tap'): void {
    const S = this.minDim;
    const lakeY = () => this.horizonY * (0.2 + Math.random() * 0.55);
    const x0 = this.width * (0.25 + Math.random() * 0.5);
    if (action === 'tap') {
      this.tap(x0, lakeY(), null);
      return;
    }
    const pts: StrokePoint[] = [];
    if (action === 'fish') {
      const y0 = lakeY();
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push({ x: x0 + dir * u * S * 0.2, y: y0 + Math.sin(u * Math.PI) * S * 0.03, t: u * 500, pressure: 0.5 });
      }
    } else {
      const cy = this.horizonY + (this.height - this.horizonY) * (0.45 + Math.random() * 0.3);
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        pts.push({ x: x0 + Math.cos(a) * S * 0.05, y: cy + Math.sin(a) * S * 0.05, t: i * 20, pressure: 0.5 });
      }
    }
    const stroke = new Stroke(this.palette, S, false);
    for (const p of pts) stroke.add(p);
    stroke.finish();
    this.scene.add(stroke.mesh);
    this.resolveStroke(stroke);
  }

  /** The world as it stands, for saving (docs/02 §6.3). */
  serialize(): WorldSave {
    const W = this.width;
    const H = this.height;
    const S = this.minDim;
    const fish = this.fishes
      .filter((f) => !f.ghost && !f.undone && !f.hidden && f.state !== 'leaving')
      .map((f) => ({
        spine: f.spineFromTail().map((p): [number, number] => [p.x / W, p.y / H]),
        drawSpeed: f.drawSpeed,
        seed: f.seed,
        patch: f.patch,
      }));
    const sky = this.sky.snapshot();
    const m = sky.moon;
    return {
      version: SAVE_VERSION,
      atmosphere: this.restartPending ? { ...INITIAL } : { ...this.atmosphere.state },
      fish,
      moon: m ? { x: m.x / W, y: m.y / H, r: m.r / S, phase: m.phase, dark: [m.dark.x, m.dark.y] } : null,
      stars: sky.stars.map((st): [number, number] => [st.x / W, st.y / H]),
      clouds: sky.clouds.map((c): [number, number, number] => [c.x / W, c.y / H, c.w / S]),
    };
  }

  /** Bring a saved world back. Not undoable, and nothing is announced as a new creation. */
  restore(save: WorldSave): void {
    const W = this.width;
    const H = this.height;
    const S = this.minDim;
    this.atmosphere.set(save.atmosphere);
    for (const f of save.fish) {
      const pts: StrokePoint[] = [];
      let length = 0;
      f.spine.forEach(([nx, ny], i) => {
        const p = { x: nx * W, y: ny * H, t: 0, pressure: 0.5 };
        if (i > 0) length += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
        pts.push(p);
      });
      if (length < 1) continue;
      const fish = new Fish(pts, length, length / f.drawSpeed, S, this.palette, {
        calm: this.calm,
        look: { seed: f.seed, patch: f.patch },
      });
      if (this.art) fish.setSkins(this.art.koi);
      this.fishes.push(fish);
      this.scene.add(fish.group);
    }
    if (save.moon) {
      const m = save.moon;
      this.sky.setMoon({ x: m.x * W, y: m.y * H, r: m.r * S, phase: m.phase, dark: { x: m.dark[0], y: m.dark[1] }, rise: false });
    }
    for (const [x, y] of save.stars) this.sky.addStar(x * W, y * H);
    for (const [x, y, w] of save.clouds) this.sky.addCloud(x * W, y * H, w * S);
  }

  /** Clear the world, keeping it for a few seconds so the restart can be taken back. */
  restart(): void {
    this.commitRestart();
    this.cancelDemo();
    const fishes = this.fishes.filter((f) => !f.ghost && !f.undone);
    for (const f of fishes) f.hide();
    this.sky.setVeil(0);
    const atmosphere = { ...this.atmosphere.state };
    this.atmosphere.set({ ...INITIAL });
    const history = this.history;
    this.history = [];
    const timer = window.setTimeout(() => this.commitRestart(), RESTART_UNDO_MS);
    this.restartPending = { fishes, atmosphere, history, timer };
    logEvent('restart', { fish: fishes.length });
  }

  undoRestart(): void {
    const r = this.restartPending;
    if (!r) return;
    clearTimeout(r.timer);
    this.restartPending = null;
    for (const f of r.fishes) f.show();
    this.sky.setVeil(1);
    this.atmosphere.set(r.atmosphere);
    this.history = r.history;
    this.events.onRestartSettled?.(true);
  }

  private commitRestart(): void {
    const r = this.restartPending;
    if (!r) return;
    clearTimeout(r.timer);
    this.restartPending = null;
    for (const f of r.fishes) f.dead = true;
    this.sky.clear();
    this.events.onRestartSettled?.(false);
  }

  /** A ghost stroke draws itself and turns into a translucent fish, then fades. */
  playDemo(): void {
    if (this.demo || this.input) return;
    const w = this.width;
    const h = this.height;
    const y0 = h * this.horizon * 0.42;
    const pts: StrokePoint[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      pts.push({
        x: w * (0.36 + 0.26 * u),
        y: y0 + Math.sin(u * Math.PI * 1.1) * h * 0.035,
        t: u * 900,
        pressure: 0.5,
      });
    }
    const stroke = new Stroke(this.palette, this.minDim, false);
    stroke.setOpacity(0.4);
    this.scene.add(stroke.mesh);
    this.demo = { points: pts, stroke, start: this.time };
  }

  /** Change the mood of the world (一句成境). Undoable like a creation. */
  applyScene(cmd: SceneCommand): void {
    this.commitRestart();
    const prev = this.atmosphere.apply(cmd);
    this.record('atmosphere', this.width / 2, this.horizonY, () => this.atmosphere.set(prev));
  }

  /** Show an echo line from the poem library in the sky. */
  showEcho(text: string, author: string): void {
    const skyTop = this.height;
    const y = this.horizonY + (skyTop - this.horizonY) * 0.6;
    void this.echo.show(text, author, this.width / 2, y, this.width, this.width < 600);
  }

  /**
   * Fill in a scene command that arrived late (the AI), without a new undo
   * step: undoing still returns to the state before the sentence.
   */
  amendScene(cmd: SceneCommand): void {
    this.atmosphere.apply(cmd);
  }

  /** Undo the latest creation, or a given one. Returns false when there is nothing to undo. */
  undo(id?: number): boolean {
    const at = id === undefined ? this.history.length - 1 : this.history.findIndex((h) => h.id === id);
    if (at < 0) return false;
    const [entry] = this.history.splice(at, 1);
    entry.undo();
    logEvent('undo', { kind: entry.kind, after: Math.round((this.time - entry.time) * 1000) });
    this.events.onUndo?.(this.history.length);
    return true;
  }

  dispose(): void {
    this.stop();
    if (this.restartPending) clearTimeout(this.restartPending.timer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    this.unbindInput();
    for (const f of this.fishes) f.dispose();
    for (const s of this.fading) s.stroke.dispose();
    this.landscapeTarget?.dispose();
    this.landscapeMat.dispose();
    this.worldMat.dispose();
    this.weatherMat.dispose();
    this.echo.dispose();
    this.renderer.dispose();
  }

  private get minDim(): number {
    return Math.min(this.width, this.height);
  }

  private get horizonY(): number {
    return this.horizon * this.height;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const interval = now - this.last;
    const dt = Math.min(interval / 1000, 1 / 20);
    this.last = now;
    if (!this.pinnedTier) {
      const next = this.monitor.frame(now, interval);
      if (next) {
        this.applyTier();
        logEvent('tier_change', { tier: next });
        this.events.onTierChange?.(next);
      }
    }
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    const t = this.time;

    if (this.demo) this.advanceDemo();

    const bounds = {
      minX: 0,
      maxX: this.width,
      minY: 0,
      maxY: this.horizonY - this.minDim * 0.05,
    };
    const ctx = { time: t, bounds, others: this.fishes, ripple: (x: number, y: number, s: number) => this.addRipple(x, y, s) };
    for (const f of this.fishes) f.update(dt, ctx);
    const alive: Fish[] = [];
    for (const f of this.fishes) {
      if (f.dead) {
        this.scene.remove(f.group);
        f.dispose();
      } else alive.push(f);
    }
    this.fishes = alive;

    const atmos = this.atmosphere;
    const recolouring = atmos.changing;
    atmos.update(dt);
    if (recolouring) this.renderLandscape();
    this.waveT += dt * (0.6 + atmos.wind * 1.6);
    const wu = this.worldMat.uniforms;
    wu.uWaveT.value = this.waveT;
    wu.uWind.value = atmos.wind;
    wu.uDusk.value = atmos.dusk;
    const weu = this.weatherMat.uniforms;
    weu.uTime.value = t;
    weu.uRain.value = atmos.rain;
    weu.uMist.value = atmos.mist;
    weu.uFireflies.value = atmos.fireflies;
    weu.uWind.value = atmos.wind;

    this.sky.update(dt, t, this.horizonY, this.width, atmos.wind);
    this.echo.update(t);
    this.lureToMoon(dt);

    this.fading = this.fading.filter((f) => {
      const k = (t - f.fadeFrom) / f.duration;
      if (k >= 1) {
        this.scene.remove(f.stroke.mesh);
        f.stroke.dispose();
        return false;
      }
      if (k > 0) f.stroke.setOpacity(f.stroke.opacity * 0 + (1 - k) * (f.stroke.mesh.userData.baseOpacity ?? 1));
      return true;
    });

    this.ripples = this.ripples.filter((r) => t - r.t < 4.5);
    const arr = this.worldMat.uniforms.uRipples.value as THREE.Vector4[];
    this.ripples.slice(-MAX_RIPPLES).forEach((r, i) => arr[i].set(r.x, r.y, r.t, r.strength));
    this.worldMat.uniforms.uRippleCount.value = Math.min(this.ripples.length, MAX_RIPPLES);
    this.worldMat.uniforms.uTime.value = t;
  }

  private advanceDemo(): void {
    const d = this.demo!;
    const elapsed = (this.time - d.start) * 1000;
    while (d.stroke.points.length < d.points.length && d.points[d.stroke.points.length].t <= elapsed) {
      d.stroke.add(d.points[d.stroke.points.length]);
    }
    if (d.stroke.points.length >= d.points.length) {
      d.stroke.finish();
      this.demo = null;
      this.spawnFish(d.stroke, true);
    }
  }

  private cancelDemo(): void {
    if (!this.demo) return;
    this.fadeStroke(this.demo.stroke, 0, 0.3);
    this.demo = null;
  }

  private addRipple(x: number, y: number, strength: number): void {
    if (y >= this.horizonY) return;
    this.ripples.push({ x, y, t: this.time, strength });
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
  }

  private fadeStroke(stroke: Stroke, delay: number, duration: number): void {
    stroke.mesh.userData.baseOpacity = stroke.opacity;
    this.fading.push({ stroke, fadeFrom: this.time + delay, duration });
  }

  private spawnFish(stroke: Stroke, ghost: boolean, spine?: Pt[]): void {
    let pts: StrokePoint[] = stroke.points;
    let length = stroke.length;
    if (spine) {
      // A closed outline: swim along its long axis instead of its contour.
      const t0 = stroke.points[0].t;
      const dur = stroke.duration;
      pts = spine.map((p, i) => ({ x: p.x, y: p.y, t: t0 + (dur * i) / (spine.length - 1), pressure: 0.5 }));
      length = 0;
      for (let i = 1; i < spine.length; i++) length += Math.hypot(spine[i].x - spine[i - 1].x, spine[i].y - spine[i - 1].y);
    }
    const fish = new Fish(pts, length, stroke.duration, this.minDim, this.palette, { ghost, calm: this.calm });
    if (this.art) fish.setSkins(this.art.koi);
    this.fishes.push(fish);
    this.scene.add(fish.group);
    // The line lingers briefly, then the fish's body takes over.
    this.fadeStroke(stroke, 0.25, 0.6);
    const real = this.fishes.filter((f) => !f.ghost && f.state !== 'leaving' && !f.hidden);
    const maxFish = TIERS[this.monitor.tier].maxFish;
    while (real.length > maxFish) real.shift()!.leave();
    if (ghost) return;
    this.events.onFishCreated?.(real.length);
    this.record('fish', fish.headX, fish.headY, () => {
      fish.disperse();
      this.addRipple(fish.headX, fish.headY, 0.5);
    });
  }

  private record(kind: CreationKind, x: number, y: number, undo: () => void): void {
    const id = this.nextHistoryId++;
    this.history.push({ id, kind, undo, time: this.time });
    // 一句成境 is logged as text_submit by the UI, with its own prompted flag.
    if (kind !== 'atmosphere') logEvent('create', { what: kind, prompted: prompted(kind) });
    if (this.history.length > UNDO_DEPTH) this.history.shift();
    this.events.onCreated?.({ id, kind, x, y: this.height - y });
  }

  // ---------------------------------------------------------------- sky

  private placeMoon(c: Classification, stroke: Stroke, fromLake: boolean): void {
    const S = this.minDim;
    const { fit } = c.features;
    const r = THREE.MathUtils.clamp(fit.r, S * 0.035, S * 0.085);
    // Drawn on the lake: the moon rises to the mirror point, so its
    // reflection settles where the circle was drawn.
    let y = fromLake ? 2 * this.horizonY - fit.cy : fit.cy;
    y = THREE.MathUtils.clamp(y, this.horizonY + S * 0.2 + r, this.height - r - 12);
    const x = THREE.MathUtils.clamp(fit.cx, r + 12, this.width - r - 12);
    const pts = stroke.points;
    const gx = (pts[0].x + pts[pts.length - 1].x) / 2 - fit.cx;
    const gy = (pts[0].y + pts[pts.length - 1].y) / 2 - fit.cy;
    const gl = Math.hypot(gx, gy) || 1;
    const spec: MoonSpec = {
      x,
      y,
      r,
      phase: c.phase ?? 'full',
      dark: { x: gx / gl, y: gy / gl },
      rise: fromLake,
    };
    const prev = this.sky.moonSpec;
    this.sky.setMoon(spec);
    this.fadeStroke(stroke, fromLake ? 0.1 : 0.3, fromLake ? 0.7 : 1.0);
    if (fromLake) this.addRipple(fit.cx, fit.cy, 0.8);
    const anchorY = fromLake ? fit.cy : y;
    this.record('moon', x + r, anchorY - r, () => this.sky.setMoon(prev ? { ...prev, rise: false } : null));
  }

  private placeStar(x: number, y: number): void {
    const id = this.sky.addStar(x, y);
    this.record('star', x, y, () => this.sky.removeStar(id));
  }

  private launchMeteor(stroke: Stroke): void {
    const pts = stroke.points;
    const a = pts[0];
    const b = pts[pts.length - 1];
    let starId = 0;
    let cancelled = false;
    this.sky.meteor(a.x, a.y, b.x, b.y, () => {
      if (!cancelled) starId = this.sky.addStar(b.x, b.y);
    });
    this.fadeStroke(stroke, 0, 0.35);
    this.record('meteor', b.x, b.y, () => {
      cancelled = true;
      if (starId) this.sky.removeStar(starId);
    });
  }

  private placeCloud(c: Classification, stroke: Stroke): void {
    const { centroid } = c.features;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
    }
    const w = THREE.MathUtils.clamp((maxX - minX) / 2, this.minDim * 0.08, this.minDim * 0.3);
    const id = this.sky.addCloud(centroid.x, centroid.y, w);
    this.fadeStroke(stroke, 0.2, 1.2);
    this.record('cloud', centroid.x, centroid.y, () => this.sky.removeCloud(id));
  }

  /** Now and then a fish drifts over to look at the moon's reflection. */
  private lureToMoon(dt: number): void {
    const moon = this.sky.moonPos;
    if (!moon) return;
    this.nextMoonLure -= dt;
    if (this.nextMoonLure > 0) return;
    this.nextMoonLure = 7 + Math.random() * 6;
    const swimmers = this.fishes.filter((f) => !f.ghost && f.state === 'swimming');
    if (!swimmers.length) return;
    const y = Math.max(2 * this.horizonY - moon.y, this.minDim * 0.08);
    swimmers[Math.floor(Math.random() * swimmers.length)].lure(moon.x, Math.min(y, this.horizonY - this.minDim * 0.08), this.time);
  }

  // ---------------------------------------------------------------- input

  private toLocal(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: this.height - (e.clientY - r.top) };
  }

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onCancel);
  }

  private unbindInput(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.input) {
      // A second finger cancels the current stroke.
      this.cancelInput();
      return;
    }
    this.canvas.setPointerCapture(e.pointerId);
    this.cancelDemo();
    if (!this.hadFirstStroke) {
      this.hadFirstStroke = true;
      this.events.onFirstStroke?.();
    }
    const { x, y } = this.toLocal(e);
    const fish = this.pickFish(x, y);
    const canDraw = x > EDGE_GUARD && x < this.width - EDGE_GUARD;
    let stroke: Stroke | null = null;
    if (canDraw) {
      stroke = new Stroke(this.palette, this.minDim, e.pointerType === 'pen');
      stroke.add({ x, y, t: e.timeStamp, pressure: e.pressure || 0.5 });
      this.scene.add(stroke.mesh);
    }
    this.input = { id: e.pointerId, stroke, downX: x, downY: y, downT: e.timeStamp, moved: 0, fish };
  };

  private onMove = (e: PointerEvent): void => {
    const inp = this.input;
    if (!inp || e.pointerId !== inp.id) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const { x, y } = this.toLocal(ev);
      inp.moved = Math.max(inp.moved, Math.hypot(x - inp.downX, y - inp.downY));
      inp.stroke?.add({ x, y, t: ev.timeStamp, pressure: ev.pressure || 0.5 });
    }
  };

  private onUp = (e: PointerEvent): void => {
    const inp = this.input;
    if (!inp || e.pointerId !== inp.id) return;
    this.input = null;
    const held = e.timeStamp - inp.downT;
    const stroke = inp.stroke;

    if (inp.moved < TAP_MOVE) {
      if (stroke) this.fadeStroke(stroke, 0, 0.35);
      if (held >= LONG_PRESS_MS) this.longPress(inp.downX, inp.downY);
      else this.tap(inp.downX, inp.downY, inp.fish);
      return;
    }
    if (!stroke) return;
    stroke.finish();
    this.resolveStroke(stroke);
  };

  /** The docs/02 §4 table: every cell answers. */
  private resolveStroke(stroke: Stroke): void {
    this.commitRestart();
    const c = classify(stroke.points, this.minDim);
    const { centroid } = c.features;
    const lake = centroid.y < this.horizonY;
    const f = c.features;
    logEvent('stroke_classified', {
      kind: c.kind,
      region: lake ? 'lake' : 'sky',
      length: round(f.length / this.minDim),
      gap: round(f.gap),
      turn: Math.round(f.turn),
      aspect: round(f.aspect),
      residual: round(Math.min(f.fit.residual, 9)),
    });
    switch (c.kind) {
      case 'short':
        this.fadeStroke(stroke, 0.1, 0.6);
        if (lake) this.addRipple(centroid.x, centroid.y, 0.5);
        else this.placeStar(centroid.x, centroid.y);
        return;
      case 'circle':
        this.placeMoon(c, stroke, lake);
        return;
      case 'elongated':
        if (lake) this.spawnFish(stroke, false, spineFromOutline(stroke.points, c.features));
        else this.placeCloud(c, stroke);
        return;
      case 'arc':
        if (lake) this.spawnFish(stroke, false);
        else this.placeMoon(c, stroke, false);
        return;
      case 'open':
        if (lake) this.spawnFish(stroke, false);
        else this.launchMeteor(stroke);
        return;
    }
  }

  private onCancel = (e: PointerEvent): void => {
    if (this.input && e.pointerId === this.input.id) this.cancelInput();
  };

  private cancelInput(): void {
    if (this.input?.stroke) this.fadeStroke(this.input.stroke, 0, 0.3);
    this.input = null;
  }

  private tap(x: number, y: number, fish: Fish | null): void {
    const moon = this.sky.moonPos;
    const onMoon = !fish && !!moon && y >= this.horizonY && Math.hypot(x - moon.x, y - moon.y) < moon.r * 1.4;
    logEvent('touch', { object: fish ? 'fish' : onMoon ? 'moon' : y >= this.horizonY ? 'sky' : 'lake' });
    if (onMoon) {
      // Moonlight brightens for a moment and the reflection trembles.
      this.sky.pulseMoon();
      this.addRipple(moon!.x, 2 * this.horizonY - moon!.y, 0.8);
      return;
    }
    if (y >= this.horizonY && !fish) {
      this.sky.flash(x, y);
      return;
    }
    if (fish) {
      prompted('touch_fish');
      this.events.onFishTouched?.();
      const again = this.lastFishTouch?.fish === fish && this.time - this.lastFishTouch.time < DOUBLE_TAP_S;
      this.lastFishTouch = { fish, time: this.time };
      if (again && fish.canLeap) {
        fish.leap();
        this.addRipple(fish.headX, fish.headY, 1.1);
        this.lastFishTouch = null;
        return;
      }
      fish.scare(x, y, 1);
      this.addRipple(x, y, 0.6);
      return;
    }
    this.addRipple(x, y, 1);
    const r = this.minDim * 0.12;
    for (const f of this.fishes) {
      const d = Math.hypot(f.headX - x, f.headY - y);
      if (d < r) f.scare(x, y, 0.5);
      else if (d < this.minDim * 0.4) f.lure(x, y, this.time);
    }
  }

  private longPress(x: number, y: number): void {
    if (y >= this.horizonY) {
      this.sky.flash(x, y);
      return;
    }
    this.addRipple(x, y, 0.5);
    for (const f of this.fishes) f.lure(x, y, this.time);
  }

  private pickFish(x: number, y: number): Fish | null {
    let best: Fish | null = null;
    let bestD = Infinity;
    for (const f of this.fishes) {
      if (f.ghost || f.undone || f.hidden) continue;
      const d = f.hitDistance(x, y);
      if (d < f.hitRadius && d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- sizing

  private onResize = (): void => {
    this.resize();
    this.monitor.settle(performance.now());
  };

  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else {
      this.monitor.settle(performance.now());
      this.start();
    }
  };

  private applyTier(): void {
    const t = TIERS[this.monitor.tier];
    this.worldMat.uniforms.uPost.value = t.post ? 1 : 0;
    this.weatherMat.uniforms.uParticles.value = t.particles;
    this.resize();
    const real = this.fishes.filter((f) => !f.ghost && f.state !== 'leaving' && !f.hidden);
    while (real.length > t.maxFish) real.shift()!.leave();
  }

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const sx = w / this.width;
    const sy = h / this.height;
    const hadSize = this.width > 1;
    this.width = w;
    this.height = h;
    this.horizon = h > w ? 0.55 : 0.5; // portrait: lake takes 55%
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[this.monitor.tier].maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();

    if (hadSize) {
      for (const f of this.fishes) f.scale(sx, sy);
      this.sky.scale(sx, sy);
    }

    this.landscapeTarget?.dispose();
    this.landscapeTarget = new THREE.WebGLRenderTarget(Math.round(w * dpr), Math.round(h * dpr), {
      type: THREE.HalfFloatType,
    });
    this.landscapeMat.uniforms.uRes.value.set(w, h);
    this.landscapeMat.uniforms.uHorizon.value = this.horizon;
    this.renderLandscape();

    this.worldMat.uniforms.uLandscape.value = this.landscapeTarget.texture;
    this.worldMat.uniforms.uRes.value.set(w, h);
    this.worldMat.uniforms.uHorizon.value = this.horizon;
    this.weatherMat.uniforms.uRes.value.set(w, h);
    this.weatherMat.uniforms.uHorizon.value = this.horizon;
  }

  /** The static sky and mountains; redrawn only while the palette changes. */
  private renderLandscape(): void {
    if (!this.landscapeTarget) return;
    this.renderer.setRenderTarget(this.landscapeTarget);
    this.renderer.render(this.landscapeScene, this.quadCamera);
    this.renderer.setRenderTarget(null);
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
