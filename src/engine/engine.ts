import * as THREE from 'three';
import { fullscreenVert } from './shaders/common';
import { landscapeFrag } from './shaders/landscape';
import { MAX_RIPPLES, worldFrag } from './shaders/world';
import { serene, type Palette } from './palette';
import { Stroke, type StrokePoint } from './stroke';
import { Fish } from './fish';

// Thresholds mirror docs/03-ux-ui-design.md §6.2.
const TAP_MOVE = 8;
const LONG_PRESS_MS = 500;
const SHORT_STROKE = 0.06;   // of the short screen edge
const EDGE_GUARD = 16;
const MAX_FISH = 12;

export interface EngineEvents {
  onFirstStroke?: () => void;
  onFishCreated?: (count: number) => void;
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

  private spawnFish(stroke: Stroke, ghost: boolean): void {
    const fish = new Fish(stroke.points, stroke.length, stroke.duration, this.minDim, this.palette, ghost);
    this.fishes.push(fish);
    this.scene.add(fish.group);
    // The line lingers briefly, then the fish's body takes over.
    this.fadeStroke(stroke, 0.25, 0.6);
    const real = this.fishes.filter((f) => !f.ghost && f.state !== 'leaving');
    if (real.length > MAX_FISH) real[0].leave();
    if (!ghost) this.events.onFishCreated?.(real.length);
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
    const c = stroke.centroid;
    if (stroke.length < this.minDim * SHORT_STROKE) {
      this.fadeStroke(stroke, 0.1, 0.6);
      this.addRipple(c.x, c.y, 0.5);
      return;
    }
    if (c.y < this.horizonY) {
      this.spawnFish(stroke, false);
    } else {
      // Sky strokes are out of this spike's scope: they drift away like mist.
      this.fadeStroke(stroke, 0.4, 1.6);
    }
  };

  private onCancel = (e: PointerEvent): void => {
    if (this.input && e.pointerId === this.input.id) this.cancelInput();
  };

  private cancelInput(): void {
    if (this.input?.stroke) this.fadeStroke(this.input.stroke, 0, 0.3);
    this.input = null;
  }

  private tap(x: number, y: number, fish: Fish | null): void {
    if (fish) {
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
    this.addRipple(x, y, 0.5);
    for (const f of this.fishes) f.lure(x, y, this.time);
  }

  private pickFish(x: number, y: number): Fish | null {
    let best: Fish | null = null;
    let bestD = Infinity;
    for (const f of this.fishes) {
      if (f.ghost) continue;
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

    if (hadSize) for (const f of this.fishes) f.scale(sx, sy);

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
