import * as THREE from 'three';
import { fullscreenVert } from './shaders/common';
import { landscapeFrag } from './shaders/landscape';
import { MAX_RIPPLES, worldFrag } from './shaders/world';
import { serene, type Palette } from './palette';
import { Stroke, type StrokePoint } from './stroke';
import { Fish } from './fish';
import { Sky, type MoonSpec } from './sky';
import { classify, spineFromOutline, type Classification, type Pt } from './classify';

// Thresholds mirror docs/03-ux-ui-design.md §6.2.
const TAP_MOVE = 8;
const LONG_PRESS_MS = 500;
const EDGE_GUARD = 16;
const MAX_FISH = 12;
const UNDO_DEPTH = 20;

export type CreationKind = 'fish' | 'moon' | 'star' | 'meteor' | 'cloud';

export interface Creation {
  kind: CreationKind;
  /** Where to put the undo button, in CSS pixels from the top left. */
  x: number;
  y: number;
}

export interface EngineEvents {
  onFirstStroke?: () => void;
  onFishCreated?: (count: number) => void;
  onCreated?: (c: Creation) => void;
  onUndo?: (remaining: number) => void;
  onFishTouched?: () => void;
}

interface HistoryEntry {
  kind: CreationKind;
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
  private readonly palette: Palette = serene;
  private readonly sky = new Sky();
  private history: HistoryEntry[] = [];
  private nextMoonLure = 6;

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
  ) {
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
        ...this.sky.uniforms,
      },
      depthTest: false,
      depthWrite: false,
    });
    const bg = new THREE.Mesh(quad, this.worldMat);
    bg.renderOrder = 0;
    bg.frustumCulled = false;
    this.scene.add(bg);

    this.resize();
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

  /** Undo the latest creation. Returns false when there is nothing to undo. */
  undo(): boolean {
    const entry = this.history.pop();
    if (!entry) return false;
    entry.undo();
    this.events.onUndo?.(this.history.length);
    return true;
  }

  dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    this.unbindInput();
    for (const f of this.fishes) f.dispose();
    for (const s of this.fading) s.stroke.dispose();
    this.landscapeTarget?.dispose();
    this.landscapeMat.dispose();
    this.worldMat.dispose();
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
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
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

    this.sky.update(dt, t, this.horizonY, this.width);
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
    const fish = new Fish(pts, length, stroke.duration, this.minDim, this.palette, ghost);
    this.fishes.push(fish);
    this.scene.add(fish.group);
    // The line lingers briefly, then the fish's body takes over.
    this.fadeStroke(stroke, 0.25, 0.6);
    const real = this.fishes.filter((f) => !f.ghost && f.state !== 'leaving');
    if (real.length > MAX_FISH) real[0].leave();
    if (ghost) return;
    this.events.onFishCreated?.(real.length);
    this.record('fish', fish.headX, fish.headY, () => {
      fish.disperse();
      this.addRipple(fish.headX, fish.headY, 0.5);
    });
  }

  private record(kind: CreationKind, x: number, y: number, undo: () => void): void {
    this.history.push({ kind, undo });
    if (this.history.length > UNDO_DEPTH) this.history.shift();
    this.events.onCreated?.({ kind, x, y: this.height - y });
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
    const c = classify(stroke.points, this.minDim);
    const { centroid } = c.features;
    const lake = centroid.y < this.horizonY;
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
    if (y >= this.horizonY && !fish) {
      this.sky.flash(x, y);
      return;
    }
    if (fish) {
      this.events.onFishTouched?.();
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
      if (f.ghost || f.undone) continue;
      const d = f.hitDistance(x, y);
      if (d < f.hitRadius && d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- sizing

  private onResize = (): void => this.resize();

  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const sx = w / this.width;
    const sy = h / this.height;
    const hadSize = this.width > 1;
    this.width = w;
    this.height = h;
    this.horizon = h > w ? 0.55 : 0.5; // portrait: lake takes 55%
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
    this.renderer.setRenderTarget(this.landscapeTarget);
    this.renderer.render(this.landscapeScene, this.quadCamera);
    this.renderer.setRenderTarget(null);

    this.worldMat.uniforms.uLandscape.value = this.landscapeTarget.texture;
    this.worldMat.uniforms.uRes.value.set(w, h);
    this.worldMat.uniforms.uHorizon.value = this.horizon;
  }
}
