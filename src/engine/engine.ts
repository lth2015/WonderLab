import * as THREE from 'three';
import { fullscreenVert } from './shaders/common';
import { landscapeFrag } from './shaders/landscape';
import { MAX_RIPPLES, worldFrag } from './shaders/world';
import type { Palette } from './palette';
import { Atmosphere } from './atmosphere';
import type { SceneCommand, Weather } from './intent';
import { weatherFrag } from './shaders/weather';
import { Snow } from './snow';
import { Leaves } from './leaves';
import { Lanterns } from './lanterns';
import { Lotus } from './lotus';
import { Shore, bankTop } from './shore';
import { BELL, moonPathAt, offFramePathPoint, sunPathAt } from './moonlight';
import { flashLevel, MAX_BOLT, packSegment, strike, strikeAlong, type Segment } from './storm';
import { panFor, type AmbientLevels, type SoundKind } from '../sound';
import { Stroke, type StrokePoint } from './stroke';
import { FORM_TIME, Fish, type FishOrigin } from './fish';
import { awayEvent, growthFor, maturity, regrow, type AwayEvent } from './time';
import type { GiftFish } from '../gift/codec';
import { overflowing, pickVariety, resampleTimed, STYLE, strokeStyle, VARIETIES } from './koi-style';
import { MOON_RISE, Sky, type MoonSpec } from './sky';
import { classify, spineFromOutline, type Classification, type Pt } from './classify';
import { FrameMonitor, TIERS, type Tier } from './quality';
import { INITIAL, type AtmosphereState } from './atmosphere';
import { logEvent, prompted } from '../telemetry';
import { AWAY_MAX, SAVE_VERSION, type SavedFish, type WorldSave } from './persist';
import type { Art } from './art';
import { EchoLayer } from './echo-layer';
import { between, meteorDive, meteorPath, Relations, type RelationEffects, type RelationWorld } from './relations';

// Thresholds mirror docs/03-ux-ui-design.md §6.2.
const TAP_MOVE = 8;
const LONG_PRESS_MS = 500;
const EDGE_GUARD = 16;
const UNDO_DEPTH = 20;
const RESTART_UNDO_MS = 5000;
/** A released fish swims off this long (s) before it fades: the window for 留下它. */
export const RELEASE_GRACE_S = 4;
const DOUBLE_TAP_S = 1.5;

export type CreationKind = 'fish' | 'moon' | 'planet' | 'star' | 'meteor' | 'cloud' | 'branch' | 'atmosphere';

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
  /** 近岸 prototype (?shore): a bank along the bottom where a stroke becomes a flowering branch. */
  shore?: boolean;
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
  /** Right after each render, while the drawing buffer is still readable. */
  onFrame?: (canvas: HTMLCanvasElement) => void;
  /** A fish was long-pressed (its stroke replays): where it is, in CSS pixels from the top left. */
  onFishHeld?: (h: { fishId: number; x: number; y: number; received: boolean; canGift: boolean; canRelease: boolean }) => void;
  /** A replayed stroke ended on a sender's seal: show it there, like the 落款 on a painting. */
  onSeal?: (s: { char: string; x: number; y: number }) => void;
  /** A sent fish arrived at the lake's edge (送一条鱼). */
  onGiftShown?: () => void;
  /** The user tapped the water and took the fish in. */
  onGiftAccepted?: (giftId: string) => void;
}

/** Where the engine sends its sounds (src/sound.ts); absent means silence. */
export interface SoundSink {
  play(kind: SoundKind, opts?: { pan?: number; strength?: number }): void;
  ambient(levels: AmbientLevels): void;
}

/*
 * One lead animation at a time (docs/03 §7): a fish forming, the moon rising
 * or a planet appearing. One triggered while another plays waits its turn,
 * starting at least LEAD_GAP after it ends. Input never waits: the stroke's
 * ink stays where it was drawn until its animation begins.
 */
const LEAD_GAP = 0.3;
const PLANET_LEAD = MOON_RISE * 0.8;

interface QueuedLead {
  stroke: Stroke;
  /** Runs the animation's start and says how long it leads for, in seconds. */
  start: () => number;
}

interface PendingRestart {
  fishes: Fish[];
  away: SavedFish[];
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
  /** Engine time at pointer down. */
  downAt: number;
  moved: number;
  fish: Fish | null;
  pointer: string;
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
  private readonly snow = new Snow();
  private leaves!: Leaves;
  /** 落花: spring petals, the leaves' gentler cousin. */
  private petals!: Leaves;
  /** 近岸 (prototype, ?shore). */
  private shore: Shore | null = null;
  /** 荷塘: lotus pads and flowers on the near water. */
  private lotus!: Lotus;
  /** Engine time of the next frog among the lotus. */
  private nextFrog = -1;
  /** 叶下更静: when each fish may next rest in a leaf's shade. */
  private shadeRest = new WeakMap<Fish, number>();
  /** 同行: a fish from the sky keeping company with one the visitor drew, for a while. */
  private companions: { sky: Fish; drawn: Fish; until: number; side: number }[] = [];
  private lanterns!: Lanterns;
  private readonly sky = new Sky();
  private history: HistoryEntry[] = [];
  private nextHistoryId = 1;
  private waveT = 0;
  /** The last two varieties born, so none comes three times running. */
  private recentVarieties: string[] = [];
  /** How much snow lies on the mountains, 0..1; eased toward the weather. */
  private snowCap = 0;
  /** Engine time of the next far bell on a moonlit night; -1 until the night is moonlit. */
  private nextBell = -1;
  /** 雷雨: when the next lightning strikes, the last one (time, x), and the thunder on its way. */
  private nextFlash = -1;
  /** 流星雨: when the next meteor falls into the lake. */
  private nextDive = -1;
  private flash = { at: -100, x: 0 };
  /** 接雪: where a finger is held still in the snow, and how far the flakes have gathered. */
  private catchAt = { x: 0, y: 0 };
  private catchK = 0;
  /** 秋风: a gust the visitor drew, its direction (-1 left, 1 right) and how much is left of it. */
  private gust = { dir: 1, k: 0 };
  /** The last star the visitor placed, for 星河's constellation lines. */
  private lastStar: { id: number; x: number; y: number; time: number } | null = null;
  private thunder: { at: number; x: number; strength: number } | null = null;
  /** 孤舟渔火 on a moonlit night: drifting slowly along the far water. */
  private boat = { x: 0, presence: 0, placed: false };
  /** 飞鸟掠月: one or two birds crossing the sky now and then. */
  private birds: { x: number; y: number; size: number; phase: number; vx: number }[] = [];
  private nextBirds = -1;
  private readonly relations = new Relations();
  /** Engine time of the last pointer down or key creation, for the relations' idle wait. */
  private lastInput = 0;
  /** Whether this world has its first fish (本命鱼); cleared if that fish is undone or the world restarts. */
  private honmeiTaken = false;
  /** Fish born in this world so far, for each fish's birth order. */
  private births = 0;
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
  /** A fish's first stroke drawing itself again (docs/02 §5.6), or a sent fish's stroke arriving (§5.7). */
  private replay: { points: StrokePoint[]; stroke: Stroke; start: number; seal?: string; then?: () => void } | null = null;
  /** A sent fish swimming at the lake's edge, not yet taken in. */
  private guestLureAt = 0;
  /** Released fish swim off, then fade. */
  private leaving: { fish: Fish; at: number }[] = [];
  /** Fish that swam off when the lake was full (docs/02 §11 decision 12): still this world's, longest away first. */
  private away: SavedFish[] = [];
  private hadFirstStroke = false;
  private tierHeld = false;
  private sound: SoundSink | null = null;
  private leadUntil = 0;
  private leadQueue: QueuedLead[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: EngineEvents = {},
    options: EngineOptions = {},
  ) {
    this.monitor = new FrameMonitor(options.tier ?? 'standard');
    this.pinnedTier = !!options.tier;
    this.calm = !!options.reducedMotion;
    this.sky.calm = this.calm;
    const withShore = !!options.shore;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // colours are already sRGB values
    this.renderer.setClearColor(0x121826, 1);

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
        uSnowCap: { value: 0 },
        uMoonRim: { value: 0 },
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
        uInk: { value: p.ink },
        uWaveT: { value: 0 },
        uWind: { value: this.atmosphere.wind },
        uDusk: { value: 0 },
        uDay: { value: 0 },
        uRainbow: { value: 0 },
        uSnow: { value: 0 },
        uMoonlit: { value: 0 },
        uFlash: { value: new THREE.Vector2() },
        uBolt: { value: Array.from({ length: MAX_BOLT }, () => new THREE.Vector4()) },
        uBoltCount: { value: 0 },
        uBoltBox: { value: new THREE.Vector4() },
        uShower: { value: 0 },
        uGalaxy: { value: 0 },
        uBoat: { value: new THREE.Vector4() },
        uBirds: { value: [new THREE.Vector4(), new THREE.Vector4()] },
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
        uSnow: { value: 0 },
        uSnowDensity: { value: 0 },
        uFlashLevel: { value: 0 },
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
    this.snow.setCalm(this.calm);
    this.scene.add(this.snow.points);
    this.leaves = new Leaves(p.ink);
    this.scene.add(this.leaves.points);
    this.petals = new Leaves(p.ink, true);
    this.scene.add(this.petals.points);
    if (withShore) {
      this.shore = new Shore(p);
      this.scene.add(this.shore.group);
    }
    this.lotus = new Lotus(p.ink);
    this.scene.add(this.lotus.points);
    this.lanterns = new Lanterns(p.ink);
    this.scene.add(this.lanterns.points);
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
    if (art.lotus) this.lotus.setTexture(art.lotus);
    if (art.shore) this.shore?.setTexture(art.shore);
  }

  /**
   * Render the current world at high resolution and return it as a PNG
   * (保存为壁纸). Local and free: the same frame, drawn with more pixels, so
   * the long edge reaches about `longEdge`. The echo line in the sky is part
   * of the frame; the page's buttons and hints are not.
   */
  async captureWallpaper(longEdge = 3840): Promise<Blob | null> {
    const base = this.renderer.getPixelRatio();
    const ratio = Math.min(longEdge / Math.max(this.width, this.height), 4);
    this.renderer.setPixelRatio(ratio);
    this.resize(ratio);
    this.renderer.render(this.scene, this.camera);
    // Read back in the same task as the render (the drawing buffer is not preserved).
    const blob = await new Promise<Blob | null>((resolve) => this.canvas.toBlob(resolve, 'image/png'));
    this.renderer.setPixelRatio(base);
    this.resize();
    return blob;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  setSound(sink: SoundSink | null): void {
    this.sound = sink;
  }

  private sfx(kind: SoundKind, x: number, strength = 1): void {
    this.sound?.play(kind, { pan: panFor(x, this.width), strength });
  }

  /** Keep the current quality tier, e.g. while recording (docs/03 §10). */
  holdTier(on: boolean): void {
    this.tierHeld = on;
    if (!on) this.monitor.settle(performance.now());
  }

  get tier(): Tier {
    return this.monitor.tier;
  }

  setReducedMotion(on: boolean): void {
    this.calm = on;
    this.sky.calm = on;
    this.weatherMat.uniforms.uCalm.value = on ? 1 : 0;
    this.snow.setCalm(on);
  }

  /** Keyboard creation (docs/03 §8): a fish or a moon at a random spot, or a tap on the lake. */
  keyAction(action: 'fish' | 'moon' | 'tap'): void {
    this.noteInput();
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
    this.resolveStroke(stroke, 'keyboard');
  }

  /** The world as it stands, for saving (docs/02 §6.3). */
  serialize(): WorldSave {
    const W = this.width;
    const H = this.height;
    const S = this.minDim;
    const fish = this.fishes.filter((f) => !f.ghost && !f.guest && !f.undone && !f.hidden && f.state !== 'leaving').map((f) => this.saveFish(f));
    const sky = this.sky.snapshot();
    const m = sky.moon;
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      atmosphere: this.restartPending ? { ...INITIAL } : { ...this.atmosphere.state },
      fish,
      ...(this.away.length && !this.restartPending ? { away: this.away.map((f) => ({ ...f })) } : {}),
      moon: m ? { x: m.x / W, y: m.y / H, r: m.r / S, phase: m.phase, dark: [m.dark.x, m.dark.y] } : null,
      planets: sky.planets.map((p): [number, number, number, number] => [p.x / W, p.y / H, p.r / S, p.tint]),
      stars: sky.stars.map((st): [number, number] => [st.x / W, st.y / H]),
      clouds: sky.clouds.map((c): [number, number, number] => [c.x / W, c.y / H, c.w / S]),
    };
  }

  private saveFish(f: Fish): SavedFish {
    return {
      spine: f.spineFromTail().map((p): [number, number] => [round4(p.x / this.width), round4(p.y / this.height)]),
      drawSpeed: f.drawSpeed,
      seed: f.seed,
      patch: f.patch,
      ...(f.glow ? { glow: true } : {}),
      ...(f.variety ? { variety: f.variety } : {}),
      ...(f.honmei ? { honmei: true } : {}),
      ...(f.origin ? { origin: f.origin } : {}),
      bornAt: f.bornAt,
      size: f.size,
      ...(f.gift ? { gift: { ...f.gift } } : {}),
    };
  }

  /**
   * Bring a saved world back. Not undoable, and nothing is announced as a new
   * creation. Fish have grown with the days since they were born, and if the
   * user was away a while, one small thing happened meanwhile (docs/02 §5.6).
   */
  restore(save: WorldSave, now = Date.now()): void {
    const W = this.width;
    const H = this.height;
    const S = this.minDim;
    this.atmosphere.set(save.atmosphere);
    for (const f of save.fish) this.bringBack(f, now, save.savedAt ?? now);
    // Fish from afar come back while the lake has room (after an undo, or on a device that shows more): longest away first.
    this.away = [...(save.away ?? [])];
    const room = TIERS[this.monitor.tier].maxFish - this.fishes.filter((f) => !f.ghost && !f.guest).length;
    for (const f of this.away.splice(0, Math.max(room, 0))) this.bringBack(f, now, save.savedAt ?? now);
    if (save.moon) {
      const m = save.moon;
      this.sky.setMoon({ x: m.x * W, y: m.y * H, r: m.r * S, phase: m.phase, dark: { x: m.dark[0], y: m.dark[1] }, rise: false });
    }
    for (const [x, y, r, tint] of save.planets) this.sky.addPlanet(x * W, y * H, r * S, tint);
    for (const [x, y] of save.stars) this.sky.addStar(x * W, y * H);
    for (const [x, y, w] of save.clouds) this.sky.addCloud(x * W, y * H, w * S);
    // A restored world was already drawn in: its first fish, if any, is still the one.
    this.honmeiTaken = save.fish.length > 0 || (save.away?.length ?? 0) > 0;
    if (save.savedAt) this.whileAway(now - save.savedAt);
  }

  /** One saved fish back in the lake, grown by the days since it was saved. */
  private bringBack(f: SavedFish, now: number, savedAt: number): void {
    const W = this.width;
    const H = this.height;
    const S = this.minDim;
    const pts: StrokePoint[] = [];
    let length = 0;
    f.spine.forEach(([nx, ny], i) => {
      const p = { x: nx * W, y: ny * H, t: 0, pressure: 0.5 };
      if (i > 0) length += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      pts.push(p);
    });
    if (length < 1) return;
    // An older save has no birth time: the fish starts growing from now.
    const bornAt = f.bornAt ?? now;
    // The saved spine is the fish as it was last made: it grows only by the rest (an older save without size: as of savedAt).
    const { size, ratio } = regrow(f.size ?? growthFor(maturity(bornAt, savedAt), !!f.honmei), bornAt, now, !!f.honmei);
    const fish = new Fish(pts, length, length / f.drawSpeed, S, this.palette, {
      calm: this.calm,
      look: { seed: f.seed, patch: f.patch, glow: f.glow, variety: f.variety, honmei: f.honmei },
      origin: f.origin,
      lively: f.origin ? this.livelyFrom(f.origin.speed, f.origin.pointer) : undefined,
      bornAt,
      maturity: maturity(bornAt, now),
      growth: ratio,
      size,
      restored: true,
      gift: f.gift,
    });
    this.births = Math.max(this.births, f.origin?.born ?? 0);
    if (this.art) fish.setSkins(this.art.koi);
    this.fishes.push(fish);
    this.scene.add(fish.group);
  }

  /** The one small thing that happened while the user was away, if any (time.ts). */
  private whileAway(awayMs: number): void {
    const honmei = this.fishes.find((f) => f.honmei && f.origin && !f.hidden && f.state !== 'leaving');
    const what: AwayEvent | null = awayEvent(awayMs, { raining: this.atmosphere.state.weather === 'rain', honmeiWithHome: !!honmei });
    if (!what) return;
    const W = this.width;
    if (what === 'rain_stopped') {
      // The rain is still falling as the world opens, then eases off; the water keeps its rings a while.
      this.atmosphere.apply({ weather: 'clear' });
      for (let i = 0; i < 6; i++) this.addRipple(W * (0.15 + 0.7 * Math.random()), this.horizonY * (0.15 + 0.7 * Math.random()), 0.4);
    } else if (what === 'honmei_home' && honmei) {
      const [nx, ny] = honmei.origin!.stroke[honmei.origin!.stroke.length - 1];
      const m = this.minDim * 0.06;
      honmei.moveHeadTo(THREE.MathUtils.clamp(nx * W, m, W - m), THREE.MathUtils.clamp(ny * this.height, m, this.horizonY - this.minDim * 0.05 - m));
    } else {
      const y = this.horizonY + (this.height - this.horizonY) * (0.35 + 0.55 * Math.random());
      this.sky.addStar(W * (0.08 + 0.84 * Math.random()), y);
    }
    logEvent('return', { awayMin: Math.round(awayMs / 60000), what });
  }

  /** Clear the world, keeping it for a few seconds so the restart can be taken back. */
  restart(): void {
    this.commitRestart();
    this.relations.interrupt();
    this.cancelDemo();
    // Whatever was still waiting to appear belongs to the old world.
    for (const q of this.leadQueue) this.fadeStroke(q.stroke, 0, 0.3);
    this.leadQueue = [];
    const fishes = this.fishes.filter((f) => !f.ghost && !f.undone);
    for (const f of fishes) f.hide();
    this.sky.setVeil(0);
    const atmosphere = { ...this.atmosphere.state };
    this.atmosphere.set({ ...INITIAL });
    const history = this.history;
    this.history = [];
    const timer = window.setTimeout(() => this.commitRestart(), RESTART_UNDO_MS);
    this.restartPending = { fishes, away: this.away, atmosphere, history, timer };
    this.away = [];
    logEvent('restart', { fish: fishes.length });
  }

  undoRestart(): void {
    const r = this.restartPending;
    if (!r) return;
    clearTimeout(r.timer);
    this.restartPending = null;
    for (const f of r.fishes) f.show();
    this.away = r.away;
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
    this.honmeiTaken = false;
    this.births = 0;
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

  /**
   * Change the mood of the world (一句成境). Undoable like a creation. Words
   * may also ask something of the fish already there (docs/02 §5.3); returns
   * how many answer.
   */
  applyScene(cmd: SceneCommand): number {
    this.commitRestart();
    const prev = this.atmosphere.apply(cmd);
    this.record('atmosphere', this.width / 2, this.horizonY, () => this.atmosphere.set(prev));
    return cmd.fish ? this.relations.ask(cmd.fish, this.relationWorld(), this.relationFx) : 0;
  }

  /** Whether an echo line is in the sky now (hints in the sky wait for it). */
  /** 白天: whether it is day, for the page's lettering. */
  get daylight(): boolean {
    return this.atmosphere.day > 0.5;
  }

  /** The weather the words last brought. */
  get weather(): Weather {
    return this.atmosphere.state.weather;
  }

  get echoShowing(): boolean {
    return this.echo.showing;
  }

  /** Show an echo line from the poem library in the sky. */
  showEcho(text: string, author: string): void {
    const skyTop = this.height;
    const y = this.horizonY + (skyTop - this.horizonY) * 0.6;
    const moon = this.sky.moonSpec;
    const avoid = [...(moon ? [{ x: moon.x, y: moon.y, r: moon.r * 1.25 }] : []), ...this.sky.planetDiscs];
    const band = { min: this.horizonY + this.minDim * 0.04, max: this.height - 8 };
    this.echo.day = this.atmosphere.state.timeOfDay === 'day';
    void this.echo.show(text, author, this.width / 2, y, this.width, this.width < 600, avoid, band);
  }

  /**
   * Fill in a scene command that arrived late (the AI), without a new undo
   * step: undoing still returns to the state before the sentence.
   */
  amendScene(cmd: SceneCommand): void {
    this.atmosphere.apply(cmd);
    if (cmd.fish) this.relations.ask(cmd.fish, this.relationWorld(), this.relationFx);
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
    this.snow.dispose();
    this.leaves.dispose();
    this.petals.dispose();
    this.shore?.dispose();
    this.lotus.dispose();
    this.lanterns.dispose();
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
    if (!this.pinnedTier && !this.tierHeld) {
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
    this.events.onFrame?.(this.canvas);
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    const t = this.time;
    if (this.leadQueue.length && t >= this.leadUntil + LEAD_GAP) {
      const next = this.leadQueue.shift()!;
      this.leadUntil = t + next.start();
    }

    if (this.demo) this.advanceDemo();
    if (this.replay) this.advanceReplay();
    this.updateGifts();

    const bounds = {
      minX: 0,
      maxX: this.width,
      minY: this.shore ? this.shore.bankHigh : 0,
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
    // Snow settles on the mountains slowly and melts more slowly still.
    const capTarget = atmos.state.weather === 'snow' || atmos.state.weather === 'moonsnow' ? 0.15 + 0.85 * atmos.state.intensity : 0;
    this.snowCap += (capTarget - this.snowCap) * Math.min(dt / (capTarget > this.snowCap ? 10 : 30), 1);
    const capMoved = Math.abs(this.snowCap - this.landscapeMat.uniforms.uSnowCap.value) > 0.004;
    if (capMoved) this.landscapeMat.uniforms.uSnowCap.value = this.snowCap;
    const rimMoved = Math.abs(atmos.moonlit - this.landscapeMat.uniforms.uMoonRim.value) > 0.004;
    if (rimMoved) this.landscapeMat.uniforms.uMoonRim.value = atmos.moonlit;
    if (recolouring || capMoved || rimMoved) this.renderLandscape();
    this.gust.k *= Math.exp(-dt / 1.4);
    const wind = Math.min(atmos.wind + this.gust.k * 0.6, 1);
    this.waveT += dt * (0.6 + wind * 1.6);
    const wu = this.worldMat.uniforms;
    wu.uWaveT.value = this.waveT;
    wu.uWind.value = wind;
    wu.uDusk.value = atmos.dusk;
    wu.uDay.value = atmos.day;
    wu.uRainbow.value = atmos.rainbow;
    wu.uSnow.value = atmos.snow;
    wu.uMoonlit.value = atmos.moonlit;
    const weu = this.weatherMat.uniforms;
    weu.uTime.value = t;
    weu.uRain.value = atmos.rain;
    weu.uMist.value = atmos.mist;
    weu.uFireflies.value = atmos.fireflies;
    weu.uSnow.value = atmos.snow;
    // Density follows the words (小雪 to 大雪), eased so a change is a slow thickening.
    const dens = 0.25 + 0.75 * Math.pow(atmos.state.intensity, 1.3);
    weu.uSnowDensity.value += (dens - weu.uSnowDensity.value) * Math.min(dt / 4, 1);
    this.snow.update(dt, t, atmos.snow, atmos.state.intensity, atmos.wind);
    this.updateCatch(dt);
    this.lanterns.update(dt, t, atmos.lanterns, { width: this.width, height: this.height, horizonY: this.horizonY, S: this.minDim }, this.calm);
    this.lotus.update(dt, t, atmos.lotus, atmos.wind, { width: this.width, horizonY: this.horizonY, S: this.minDim }, this.calm, atmos.day);
    // 蛙声: now and then a frog among the lotus.
    if (atmos.lotus < 0.5) this.nextFrog = -1;
    else if (this.nextFrog < 0) this.nextFrog = t + 5 + Math.random() * 5;
    else if (t >= this.nextFrog) {
      this.nextFrog = t + 9 + Math.random() * 14;
      this.sfx('frog', this.width * (Math.random() < 0.5 ? 0.15 : 0.85), 0.7);
    }
    const gustWind = atmos.wind * (1 - this.gust.k) + this.gust.dir * this.gust.k * 1.8;
    this.petals.update(dt, t, atmos.blossom, gustWind, { width: this.width, height: this.height, horizonY: this.horizonY, S: this.minDim }, (x, y) => this.petalLands(x, y));
    this.shore?.update(dt, t, { day: atmos.day, dusk: atmos.dusk }, this.calm, (x, y) => this.dropPetal(x, y));
    this.leaves.update(dt, t, atmos.autumn, gustWind, { width: this.width, height: this.height, horizonY: this.horizonY, S: this.minDim }, (x, y) =>
      this.addRipple(x, y, 0.3),
    );
    weu.uWind.value = wind;
    this.sound?.ambient({ rain: atmos.rain, wind, fireflies: atmos.fireflies, snow: atmos.snow, autumn: Math.max(atmos.autumn, atmos.blossom * 0.5), dusk: atmos.dusk });

    this.sky.linkLevel = Math.min(atmos.galaxy * 1.5, 1);
    this.sky.update(dt, t, this.horizonY, this.width, atmos.wind);
    this.echo.update(t);
    this.updateRelations();
    this.updateMoonlight();
    this.updateCompany();
    this.updateStorm();
    this.updateShower();
    this.updateMoonNight(dt);

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

  /**
   * Long-pressed a fish: the stroke it was born from draws itself again on
   * the water, at its own pace, while the fish swims back to where that
   * stroke ended (docs/02 §5.6). Needs only the fish's saved origin.
   */
  private replayOrigin(fish: Fish): void {
    this.cancelReplay();
    const o = fish.origin!;
    const W = this.width;
    const H = this.height;
    // At its own pace, but never longer than four seconds.
    const span = Math.max(o.stroke[o.stroke.length - 1][2], 1);
    const k = Math.min(1, 4000 / span);
    const points = o.stroke.map(([x, y, t]) => ({ x: x * W, y: y * H, t: t * k, pressure: 0.5 }));
    const stroke = new Stroke(this.palette, this.minDim, false);
    stroke.setOpacity(0.45);
    this.scene.add(stroke.mesh);
    if (this.calm) {
      // Reduced motion: the whole line at once, then it fades.
      for (const p of points) stroke.add(p);
      stroke.finish();
      this.fadeStroke(stroke, 1.2, 1.5);
      this.showSeal(fish.gift?.seal, points[points.length - 1]);
    } else this.replay = { points, stroke, start: this.time, seal: fish.gift?.seal };
    const end = points[points.length - 1];
    fish.lure(end.x, Math.min(end.y, this.horizonY - this.minDim * 0.08), this.time, { duration: (span * k) / 1000 + 2 });
    this.addRipple(fish.headX, fish.headY, 0.4);
    logEvent('replay', { born: o.born, honmei: fish.honmei, received: !!fish.gift });
    this.events.onFishHeld?.({
      fishId: fish.id,
      x: fish.headX,
      y: this.height - fish.headY,
      received: !!fish.gift,
      canGift: !fish.gift && !fish.glow,
      // 让它游向远方: a received fish, or one the user drew, but never the world's first fish (docs/02 §12).
      canRelease: !fish.honmei,
    });
  }

  /** The sender's seal at the end of their stroke, like the 落款 on a painting. */
  private showSeal(char: string | undefined, at: { x: number; y: number }): void {
    if (char) this.events.onSeal?.({ char, x: at.x, y: this.height - at.y });
  }

  private advanceReplay(): void {
    const r = this.replay!;
    const elapsed = (this.time - r.start) * 1000;
    while (r.stroke.points.length < r.points.length && r.points[r.stroke.points.length].t <= elapsed) {
      r.stroke.add(r.points[r.stroke.points.length]);
    }
    if (r.stroke.points.length >= r.points.length) {
      r.stroke.finish();
      this.replay = null;
      this.showSeal(r.seal, r.points[r.points.length - 1]);
      // The line lingers a moment, then goes back into the water.
      this.fadeStroke(r.stroke, 0.8, 1.4);
      r.then?.();
    }
  }

  // ---------------------------------------------------------------- 送一条鱼 (docs/02 §5.7)

  /** What to put in a gift link for one of the user's own fish; null when it cannot be sent. */
  giftOf(fishId: number): Omit<GiftFish, 'seal'> | null {
    const fish = this.fishes.find((f) => f.id === fishId);
    if (!fish || !fish.origin || fish.gift || fish.glow || fish.guest) return null;
    const o = fish.origin;
    const S = this.minDim;
    const [x0, y0, t0] = o.stroke[0];
    return {
      stroke: o.stroke.map(([x, y, t]): [number, number, number] => [((x - x0) * this.width) / S, ((y - y0) * this.height) / S, t - t0]),
      variety: fish.variety ?? 'kohaku',
      seed: fish.seed,
      speed: o.speed,
      curviness: o.curviness,
      family: o.family,
      pointer: o.pointer,
    };
  }

  /**
   * A sent fish arrives (docs/02 §5.7): its stroke draws itself far out on
   * the lake, ending on the sender's seal if any, then becomes a fish that
   * swims along the far edge. Nothing is saved until the user taps the
   * water to take it in; leave it, and it is gone with the page.
   */
  receiveGift(g: GiftFish, giftId: string): void {
    const S = this.minDim;
    const W = this.width;
    // Place the stroke, at its own size, far out on the lake.
    let pts = g.stroke.map(([dx, dy, t]) => ({ x: dx * S, y: dy * S, t, pressure: 0.5 }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const m = S * 0.05;
    const top = this.horizonY - S * 0.07;
    const cx = THREE.MathUtils.clamp(W * (0.3 + 0.4 * Math.random()), m + (maxX - minX) / 2, W - m - (maxX - minX) / 2);
    const cy = THREE.MathUtils.clamp(this.horizonY - S * 0.16, m + (maxY - minY) / 2, top - (maxY - minY) / 2);
    pts = pts.map((p) => ({ ...p, x: p.x - (minX + maxX) / 2 + cx, y: p.y - (minY + maxY) / 2 + cy }));
    const span = Math.max(pts[pts.length - 1].t, 1);
    const k = Math.min(1, 4000 / span);
    pts = pts.map((p) => ({ ...p, t: p.t * k }));

    this.cancelReplay();
    const stroke = new Stroke(this.palette, S, false);
    stroke.setOpacity(0.5);
    this.scene.add(stroke.mesh);
    const arrive = () => {
      let length = 0;
      for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const fish = new Fish(pts, length, Math.max(span, 16), S, this.palette, {
        calm: this.calm,
        look: { seed: g.seed, variety: g.variety },
        lively: this.livelyFrom(g.speed, g.pointer),
        gift: { id: giftId, ...(g.seal ? { seal: g.seal } : {}) },
        guest: true,
        bornAt: Date.now(),
        origin: {
          stroke: pts.map((p) => [round4(p.x / W), round4(p.y / this.height), Math.round(p.t / k)]),
          speed: g.speed,
          curviness: g.curviness,
          family: g.family,
          pointer: g.pointer,
          born: 0, // given a place in this world's births when taken in
        },
      });
      if (this.art) fish.setSkins(this.art.koi);
      this.fishes.push(fish);
      this.scene.add(fish.group);
      this.guestLureAt = this.time + 2;
      this.events.onGiftShown?.();
      logEvent('gift_shown', { seal: !!g.seal });
    };
    if (this.calm) {
      for (const p of pts) stroke.add(p);
      stroke.finish();
      this.fadeStroke(stroke, 1.2, 1.5);
      this.showSeal(g.seal, pts[pts.length - 1]);
      arrive();
    } else this.replay = { points: pts, stroke, start: this.time, seal: g.seal, then: arrive };
  }

  /** The guest swims along the far edge until taken in; released fish swim off, then fade. */
  private updateGifts(): void {
    const guest = this.fishes.find((f) => f.guest && f.state === 'swimming');
    if (guest && this.time >= this.guestLureAt) {
      this.guestLureAt = this.time + 5;
      guest.lure(this.width * (0.15 + 0.7 * Math.random()), this.horizonY - this.minDim * 0.12, this.time, { duration: 6 });
    }
    this.leaving = this.leaving.filter(({ fish, at }) => {
      if (this.time < at) return true;
      fish.leave();
      return false;
    });
  }

  /** Tapped the water with a guest at the edge: it comes in to where the tap was. */
  private acceptGuest(x: number, y: number): boolean {
    const fish = this.fishes.find((f) => f.guest && f.state !== 'leaving');
    if (!fish) return false;
    fish.guest = false;
    fish.origin!.born = ++this.births;
    fish.lure(x, y, this.time, { eager: true, duration: 4 });
    this.addRipple(x, y, 1);
    this.sfx('drop', x, 0.8);
    this.evictOverflow();
    logEvent('gift_accepted', {});
    this.events.onGiftAccepted?.(fish.gift!.id);
    return true;
  }

  /**
   * 让它游向远方: a fish the user chooses to let go (one they drew or one they
   * received, never the first fish) swims off toward the far shore and is
   * gone from this world. Their choice, not the world's (docs/02 §12).
   */
  release(fishId: number): boolean {
    const fish = this.fishes.find((f) => f.id === fishId);
    if (!fish || fish.honmei || fish.state === 'leaving' || this.leaving.some((l) => l.fish === fish)) return false;
    const toLeft = fish.headX < this.width / 2;
    fish.lure(toLeft ? this.minDim * 0.02 : this.width - this.minDim * 0.02, this.horizonY - this.minDim * 0.08, this.time, { duration: 5 });
    // It swims toward the far shore for a while before it fades: time enough to keep it after all.
    this.leaving.push({ fish, at: this.time + RELEASE_GRACE_S });
    logEvent(fish.gift ? 'gift_released' : 'fish_released', {});
    return true;
  }

  /** 留下它: a released fish still swimming off stays after all. */
  keep(fishId: number): boolean {
    const i = this.leaving.findIndex((l) => l.fish.id === fishId);
    if (i < 0) return false;
    const [{ fish }] = this.leaving.splice(i, 1);
    fish.stopLure();
    logEvent('fish_kept', { received: !!fish.gift });
    return true;
  }

  private cancelReplay(): void {
    if (!this.replay) return;
    this.fadeStroke(this.replay.stroke, 0, 0.3);
    this.replay = null;
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

  /** 0..1 liveliness from a stroke's normalised speed: the fast split sits at the middle. */
  private livelyFrom(speed: number, pointer: string): number {
    const split = STYLE.fastSplit[pointer] ?? STYLE.fastSplit.mouse;
    return THREE.MathUtils.clamp(speed / (2 * split), 0, 1);
  }

  /** Over the tier's fish limit, the oldest leave first, but never the first fish (本命鱼). */
  private evictOverflow(): void {
    // A fish still at the lake's edge (送一条鱼) does not count until it is taken in.
    const real = this.fishes.filter((f) => !f.ghost && !f.guest && f.state !== 'leaving' && !f.hidden);
    // At most two at a time: when the device slows and the lake holds fewer (quality.ts), it thins out over a few creations, not all at once.
    for (const f of overflowing(real, TIERS[this.monitor.tier].maxFish).slice(0, 2)) {
      // Swimming off is not the end: the fish stays in this world, in the distance (docs/02 §11 decision 12).
      // With the distance full, it stays in the lake: no fish is ever deleted to make room.
      if (this.away.length >= AWAY_MAX) break;
      this.away.push(this.saveFish(f));
      f.leave();
    }
  }

  private spawnFish(stroke: Stroke, ghost: boolean, spine?: Pt[], pointer = 'mouse'): void {
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
    if (ghost) {
      const fish = new Fish(pts, length, stroke.duration, this.minDim, this.palette, { ghost, calm: this.calm });
      if (this.art) fish.setSkins(this.art.koi);
      this.fishes.push(fish);
      this.scene.add(fish.group);
      this.fadeStroke(stroke, 0.25, 0.6);
      return;
    }
    // 笔性 (docs/02 §5.1): the stroke as drawn, not the outline's spine, sets the variety's leaning.
    const style = strokeStyle(stroke.points, this.minDim, pointer);
    const { variety, inFamily } = pickVariety(style.family, Math.random, this.art?.koi.map((k) => k.name) ?? VARIETIES, this.recentVarieties);
    this.recentVarieties = [...this.recentVarieties.slice(-1), variety];
    const honmei = !this.honmeiTaken;
    this.honmeiTaken = true;
    const origin: FishOrigin = {
      stroke: resampleTimed(stroke.points, Math.max(2, Math.min(stroke.points.length, 48))).map((p) => [
        round4(p.x / this.width),
        round4(p.y / this.height),
        Math.round(p.t - stroke.points[0].t),
      ]),
      speed: round4(style.speed),
      curviness: round4(style.curviness),
      family: style.family,
      pointer,
      born: ++this.births,
    };
    const fish = new Fish(pts, length, stroke.duration, this.minDim, this.palette, {
      calm: this.calm,
      look: { seed: Math.random() * 100, variety, honmei },
      origin,
      lively: this.livelyFrom(style.speed, pointer),
      bornAt: Date.now(),
    });
    if (this.art) fish.setSkins(this.art.koi);
    this.fishes.push(fish);
    this.scene.add(fish.group);
    // The line lingers briefly, then the fish's body takes over.
    this.fadeStroke(stroke, 0.25, 0.6);
    this.evictOverflow();
    this.sfx('drop', fish.headX);
    this.events.onFishCreated?.(this.fishes.filter((f) => !f.ghost && f.state !== 'leaving' && !f.hidden).length);
    this.record(
      'fish',
      fish.headX,
      fish.headY,
      () => {
        fish.disperse();
        this.addRipple(fish.headX, fish.headY, 0.5);
        // Undo the first fish and the next one drawn becomes the first.
        if (fish.honmei) this.honmeiTaken = false;
      },
      { variety, family: style.family, affinity: inFamily, honmei, speed: round(style.speed), bend: round(style.curviness), pointer },
    );
  }

  private record(kind: CreationKind, x: number, y: number, undo: () => void, fields: Record<string, string | number | boolean> = {}): void {
    const id = this.nextHistoryId++;
    this.history.push({ id, kind, undo, time: this.time });
    // 一句成境 is logged as text_submit by the UI, with its own prompted flag.
    if (kind !== 'atmosphere') logEvent('create', { what: kind, prompted: prompted(kind), ...fields });
    if (this.history.length > UNDO_DEPTH) this.history.shift();
    this.events.onCreated?.({ id, kind, x, y: this.height - y });
  }

  // ---------------------------------------------------------------- sky

  private placeMoon(c: Classification, stroke: Stroke, fromLake: boolean): void {
    // The first circle is the moon; with a moon up, circles are small planets.
    if (this.sky.moonSpec) {
      this.placePlanet(c, stroke, fromLake);
      return;
    }
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
    this.sky.setMoon(spec);
    this.sfx('chime', x);
    this.fadeStroke(stroke, fromLake ? 0.1 : 0.3, fromLake ? 0.7 : 1.0);
    if (fromLake) this.addRipple(fit.cx, fit.cy, 0.8);
    const anchorY = fromLake ? fit.cy : y;
    // There was no moon before this one (later circles are planets), so undo removes it.
    this.record('moon', x + r, anchorY - r, () => this.sky.setMoon(null));
  }

  private placePlanet(c: Classification, stroke: Stroke, fromLake: boolean): void {
    const S = this.minDim;
    const { fit } = c.features;
    const r = THREE.MathUtils.clamp(fit.r * 0.45, S * 0.014, S * 0.032);
    let x = fit.cx;
    let y = fromLake ? 2 * this.horizonY - fit.cy : fit.cy;
    // Keep clear of the moon and the other planets: nudge outward from each.
    const moon = this.sky.moonSpec;
    const others = [...(moon ? [{ x: moon.x, y: moon.y, r: moon.r * 1.3 }] : []), ...this.sky.planetDiscs];
    for (let pass = 0; pass < 3; pass++) {
      for (const o of others) {
        const dx = x - o.x;
        const dy = y - o.y;
        const d = Math.hypot(dx, dy);
        const need = o.r + r + S * 0.02;
        if (d >= need) continue;
        const ux = d > 1e-3 ? dx / d : 1;
        const uy = d > 1e-3 ? dy / d : 0;
        x = o.x + ux * need;
        y = o.y + uy * need;
      }
    }
    y = THREE.MathUtils.clamp(y, this.horizonY + S * 0.12 + r, this.height - r - 12);
    x = THREE.MathUtils.clamp(x, r + 12, this.width - r - 12);
    const id = this.sky.addPlanet(x, y, r, this.nextHistoryId);
    this.fadeStroke(stroke, fromLake ? 0.1 : 0.3, fromLake ? 0.7 : 1.0);
    if (fromLake) this.addRipple(fit.cx, fit.cy, 0.6);
    this.sfx('chime', x, 0.6);
    this.record('planet', x + r, y - r, () => this.sky.removePlanet(id));
  }

  private placeStar(x: number, y: number): void {
    const id = this.sky.addStar(x, y);
    this.sfx('star', x);
    // 星河: a star placed near the last one joins it, and the visitor's stars become a constellation.
    const last = this.lastStar;
    if (this.atmosphere.galaxy > 0.5 && last && this.time - last.time < 20 && Math.hypot(x - last.x, y - last.y) < this.minDim * 0.5) {
      this.sky.link(last.id, id);
      this.sfx('chime', x, 0.25);
    }
    this.lastStar = { id, x, y, time: this.time };
    this.record('star', x, y, () => this.sky.removeStar(id));
  }

  private launchMeteor(stroke: Stroke): void {
    const pts = stroke.points;
    const [a, end] = meteorPath(pts[0], pts[pts.length - 1]);
    let b = end;
    let starId = 0;
    let fish: Fish | null = null;
    let cancelled = false;
    // Drawn down to the horizon, the meteor falls into the lake and becomes
    // a small glowing fish (流星入湖, docs/02 §5.5); otherwise it leaves a star.
    const dive = meteorDive(a, b, this.horizonY, this.height);
    if (dive) {
      // Carry the line on to the horizon.
      const k = (a.y - this.horizonY) / Math.max(a.y - b.y, 1e-3);
      b = { ...b, x: THREE.MathUtils.clamp(a.x + (b.x - a.x) * k, 24, this.width - 24), y: this.horizonY + 1 };
    }
    this.sfx('meteor', (a.x + b.x) / 2);
    this.sky.meteor(a.x, a.y, b.x, b.y, () => {
      if (cancelled) return;
      if (dive) fish = this.meteorFish(b.x, a.x < b.x ? 1 : -1);
      else starId = this.sky.addStar(b.x, b.y);
    });
    this.fadeStroke(stroke, 0, 0.35);
    this.record('meteor', b.x, b.y, () => {
      cancelled = true;
      if (starId) this.sky.removeStar(starId);
      if (fish) fish.disperse();
    });
  }

  /** The fallen meteor's fish: a splash just below the horizon, then a small pale-gold fish swimming out of it. */
  private meteorFish(x: number, dir: number): Fish {
    const S = this.minDim;
    const y = this.horizonY - S * 0.1;
    this.addRipple(x, y, 1.3);
    this.sfx('drop', x, 0.8);
    const pts: StrokePoint[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      // Toward the viewer and a little sideways, the way the meteor was going: about 0.14 of the short edge,
      // the smallest fish in the lake but still plainly a koi.
      pts.push({ x: x + dir * u * S * 0.075, y: y - u * S * 0.12 + Math.sin(u * Math.PI) * S * 0.015, t: u * 300, pressure: 0.5 });
    }
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const fish = new Fish(pts, length, 300, S, this.palette, { calm: this.calm, look: { seed: Math.random() * 100, patch: 0, glow: true } });
    if (this.art) fish.setSkins(this.art.koi);
    this.fishes.push(fish);
    this.scene.add(fish.group);
    this.evictOverflow();
    // 同行 (世界观 09 §十): it keeps company for a while with the nearest fish the visitor drew.
    let near: Fish | null = null;
    let best = this.minDim * 0.9;
    for (const f of this.fishes) {
      if (f === fish || f.glow || f.ghost || f.guest || f.hidden || f.state !== 'swimming') continue;
      const d = Math.hypot(f.headX - x, f.headY - y);
      if (d < best) {
        best = d;
        near = f;
      }
    }
    if (near) this.companions.push({ sky: fish, drawn: near, until: this.time + 10 + Math.random() * 4, side: Math.random() < 0.5 ? -1 : 1 });
    return fish;
  }

  /**
   * 同一个生命，不同的光阴 (docs/世界观落地.md, first batch): fish rest in a
   * leaf's shade, rock the river lamps they pass under, and a fish from the
   * sky swims beside a drawn one for a while.
   */
  private updateCompany(): void {
    const t = this.time;
    const S = this.minDim;
    for (const f of this.fishes) {
      if (f.ghost || f.hidden || f.state !== 'swimming') continue;
      // 叶下更静 (09 §五): under a leaf it slows and rests a moment, not every time it passes.
      if (this.atmosphere.lotus > 0.5 && t >= (this.shadeRest.get(f) ?? 0) && this.lotus.shadeAt(f.headX, f.headY)) {
        this.shadeRest.set(f, t + 18 + Math.random() * 12);
        f.setRest(t + 2.5 + Math.random() * 2);
      }
      // 灯下鱼影 (09 §十一).
      if (this.atmosphere.lanterns > 0.3 && this.lanterns.stirAt(f.headX, f.headY, S * 0.05)) this.addRipple(f.headX, f.headY, 0.25);
    }
    this.companions = this.companions.filter((c) => t < c.until && this.fishes.includes(c.sky) && this.fishes.includes(c.drawn) && c.sky.state === 'swimming' && c.drawn.state === 'swimming');
    for (const c of this.companions) {
      // Alongside, a little to one side and behind.
      const d = c.drawn;
      c.sky.lure(d.headX + c.side * S * 0.06, d.headY + S * 0.02, t, { duration: 0.6 });
    }
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

  /** The world answering itself (docs/02 §5.5): see relations.ts. */
  private updateRelations(): void {
    this.relations.update(this.relationWorld(), this.relationFx);
  }

  private relationWorld(): RelationWorld {
    const moon = this.sky.moonPos;
    const lakeTop = this.horizonY - this.minDim * 0.08;
    const swimmers = this.fishes.filter((f) => !f.ghost && !f.guest && f.state === 'swimming' && !f.hidden);
    const atmos = this.atmosphere;
    return {
      time: this.time,
      calm: this.calm,
      idle: this.input ? 0 : this.time - this.lastInput,
      fish: swimmers,
      moonReflection: moon
        ? { x: moon.x, y: Math.min(Math.max(2 * this.horizonY - moon.y, this.minDim * 0.08), lakeTop) }
        : atmos.moonlit > 0.3
          ? offFramePathPoint(this.lakeView())
          : null,
      rain: atmos.rain,
      mist: atmos.mist,
      snow: atmos.snow,
      moonlit: atmos.moonlit,
      lake: { minX: 0, maxX: this.width, minY: this.shore ? this.shore.bankHigh : 0, maxY: this.horizonY - this.minDim * 0.05 },
      minDim: this.minDim,
      home: this.honmeiHome(swimmers),
    };
  }

  /** 接雪 (docs/02 §5.5): a finger held still in the snow gathers the flakes around it. */
  private updateCatch(dt: number): void {
    const inp = this.input;
    const holding = !!inp && inp.moved < TAP_MOVE && this.time - inp.downAt > 0.25 && this.atmosphere.snow > 0.3;
    if (holding) this.catchAt = { x: inp.downX, y: inp.downY };
    this.catchK += ((holding ? 1 : 0) - this.catchK) * Math.min(dt * (holding ? 0.8 : 1.6), 1);
    this.snow.setHold(this.catchAt.x, this.catchAt.y, this.catchK);
  }

  private lakeView(): { width: number; horizonY: number; S: number } {
    return { width: this.width, horizonY: this.horizonY, S: this.minDim };
  }

  /**
   * 流星雨: the streaks are drawn in the sky shader; now and then one of
   * them falls into the lake and becomes a small glowing fish, like a
   * drawn meteor (流星入湖), but only while the lake has room: the world
   * never pushes out a fish the visitor drew.
   */
  private updateShower(): void {
    const level = this.atmosphere.shower;
    this.worldMat.uniforms.uShower.value = level;
    this.worldMat.uniforms.uGalaxy.value = this.atmosphere.galaxy;
    if (level < 0.5) {
      this.nextDive = -1;
      return;
    }
    const t = this.time;
    if (this.nextDive < 0) this.nextDive = t + 4 + Math.random() * 2;
    if (t < this.nextDive) return;
    this.nextDive = t + 18 + Math.random() * 14;
    const room = TIERS[this.monitor.tier].maxFish - this.fishes.filter((f) => !f.ghost && !f.guest).length;
    if (room < 2 || this.calm) return;
    const S = this.minDim;
    const ax = this.width * (0.3 + 0.6 * Math.random());
    const a = { x: ax, y: this.height - S * (0.05 + 0.15 * Math.random()) };
    const b = { x: THREE.MathUtils.clamp(ax - S * (0.25 + 0.3 * Math.random()), 24, this.width - 24), y: this.horizonY + 1 };
    this.sfx('meteor', (a.x + b.x) / 2);
    this.sky.meteor(a.x, a.y, b.x, b.y, () => {
      if (this.atmosphere.state.weather === 'shower') this.meteorFish(b.x, a.x < b.x ? 1 : -1);
    });
  }

  /**
   * 雷雨: now and then lightning behind the far hills, a quick double
   * flicker, and the thunder a few seconds later (further strikes, later
   * and softer). Reduced motion keeps the thunder and drops the flicker.
   */
  private updateStorm(): void {
    const t = this.time;
    const on = this.atmosphere.storm > 0.5;
    if (!on) this.nextFlash = -1;
    else if (this.nextFlash < 0) this.nextFlash = t + 2 + Math.random() * 2;
    else if (t >= this.nextFlash) {
      this.nextFlash = t + 7 + Math.random() * 10;
      const x = this.width * (0.15 + 0.7 * Math.random());
      // Three strikes in four are near: bolts onto the hills and the thunder almost at once.
      if (Math.random() < 0.75) {
        const S = this.minDim;
        this.boltFlash(strike(x, this.height - S * 0.06, this.horizonY + S * (0.02 + 0.04 * Math.random()), this.width, S, Math.random), x);
        this.thunder = { at: t + 0.3 + Math.random() * 0.5, x, strength: 1.3 };
      } else {
        this.boltFlash([], x);
        this.thunder = { at: t + 2 + Math.random() * 2, x, strength: 0.6 };
      }
    }
    if (this.thunder && t >= this.thunder.at) {
      this.sfx('thunder', this.thunder.x, this.thunder.strength);
      this.thunder = null;
    }
    const level = this.calm ? 0 : flashLevel(t - this.flash.at);
    this.worldMat.uniforms.uFlash.value.set(level, this.flash.x);
    this.weatherMat.uniforms.uFlashLevel.value = level;
  }

  /** 月夜: a boat with its lamp on the far water, and birds crossing the moon. */
  private updateMoonNight(dt: number): void {
    const ml = this.atmosphere.moonlit;
    const S = this.minDim;
    const moon = this.sky.moonPos;
    const u = this.worldMat.uniforms;
    const on = ml > 0.5;
    const b = this.boat;
    if (on && !b.placed) {
      // Upstream of the light path, so it drifts across it.
      b.x = moon ? moon.x + S * 0.22 : this.width * 0.6;
      b.placed = true;
    }
    b.presence += ((on ? 1 : 0) - b.presence) * Math.min(dt / 3, 1);
    if (b.presence < 0.01 && !on) b.placed = false;
    b.x -= dt * S * 0.006;
    if (b.x < -S * 0.15) b.x = this.width + S * 0.15;
    u.uBoat.value.set(b.x, this.horizonY - S * 0.045, S * 0.062, b.presence);

    if (!on || this.calm) {
      this.nextBirds = -1;
    } else if (this.nextBirds < 0) this.nextBirds = this.time + 5 + Math.random() * 4;
    else if (this.time >= this.nextBirds && !this.birds.length) {
      this.nextBirds = this.time + 25 + Math.random() * 15;
      const y = moon ? moon.y + S * (Math.random() * 0.06 - 0.02) : this.height - S * 0.35;
      const size = S * 0.022;
      this.birds.push({ x: this.width + size * 2, y, size, phase: 0, vx: -S * 0.13 });
      if (Math.random() < 0.6) this.birds.push({ x: this.width + size * 5, y: y - S * 0.03, size: size * 0.8, phase: 1.7, vx: -S * 0.13 });
    }
    for (const bird of this.birds) {
      bird.x += bird.vx * dt;
      bird.y += Math.sin(this.time * 0.9 + bird.phase) * S * 0.004 * dt;
      bird.phase += dt * Math.PI * 2 * 1.9;
    }
    this.birds = this.birds.filter((bird) => bird.x > -bird.size * 3);
    u.uBirds.value.forEach((v: THREE.Vector4, i: number) => {
      const bird = this.birds[i];
      if (bird) v.set(bird.x, bird.y, bird.size, bird.phase);
      else v.set(0, 0, 0, 0);
    });
  }

  /** 月夜: each fish catches as much moonlight as lies where it swims; now and then a far bell. */
  private updateMoonlight(): void {
    const ml = this.atmosphere.moonlit;
    const moon = this.sky.moonPos;
    const view = this.lakeView();
    const dusk = this.atmosphere.dusk;
    for (const f of this.fishes) {
      const silver = ml > 0.01 ? ml * moonPathAt(f.headX, f.headY, view, moon, ml) : 0;
      // 落日: the same fish, seen again in the evening's gold (世界观 09 §三).
      const gold = dusk > 0.01 ? sunPathAt(f.headX, f.headY, view, dusk) * 2.2 : 0;
      f.setMoonlight(Math.max(silver, gold), gold > silver);
    }
    if (ml < BELL.threshold) {
      this.nextBell = -1;
      return;
    }
    if (this.nextBell < 0) this.nextBell = this.time + between(Math.random, BELL.first);
    else if (this.time >= this.nextBell) {
      this.nextBell = this.time + between(Math.random, BELL.every);
      this.sfx('bell', this.width * 0.3, 1);
    }
  }

  private readonly relationFx: RelationEffects = {
    pulseMoon: () => this.sky.pulseMoon(),
    ripple: (x, y, s) => this.addRipple(x, y, s),
    sound: (kind, x, s) => this.sfx(kind, x, s),
    emerged: (what) => logEvent('emerge', { what }),
  };

  /** Where the first fish was drawn: the pen-up end of its stroke, kept inside the lake. */
  private honmeiHome(swimmers: Fish[]): { fish: Fish; x: number; y: number } | null {
    const fish = swimmers.find((f) => f.honmei && f.origin);
    if (!fish) return null;
    const [nx, ny] = fish.origin!.stroke[fish.origin!.stroke.length - 1];
    const m = this.minDim * 0.06;
    return {
      fish,
      x: THREE.MathUtils.clamp(nx * this.width, m, this.width - m),
      y: THREE.MathUtils.clamp(ny * this.height, m, this.horizonY - this.minDim * 0.05 - m),
    };
  }

  private noteInput(): void {
    this.lastInput = this.time;
    this.relations.interrupt();
  }

  // ---------------------------------------------------------------- input

  /** With a mouse, show over a fish or the moon that it can be touched (docs/03 §6.1). */
  private hover(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    const { x, y } = this.toLocal(e);
    const target = !!this.pickFish(x, y) || this.onMoon(x, y);
    const want = target ? 'target' : '';
    if ((this.canvas.dataset.hover ?? '') !== want) this.canvas.dataset.hover = want;
  }

  private onMoon(x: number, y: number): boolean {
    const moon = this.sky.moonPos;
    return !!moon && y >= this.horizonY && Math.hypot(x - moon.x, y - moon.y) < moon.r * 1.4;
  }

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
    this.noteInput();
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
      this.sfx('stroke', x);
    }
    this.input = { id: e.pointerId, stroke, downX: x, downY: y, downT: e.timeStamp, downAt: this.time, moved: 0, fish, pointer: e.pointerType || 'mouse' };
  };

  private onMove = (e: PointerEvent): void => {
    const inp = this.input;
    if (!inp) {
      this.hover(e);
      return;
    }
    if (e.pointerId !== inp.id) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const { x, y } = this.toLocal(ev);
      inp.moved = Math.max(inp.moved, Math.hypot(x - inp.downX, y - inp.downY));
      inp.stroke?.add({ x, y, t: ev.timeStamp, pressure: ev.pressure || 0.5 });
    }
    // Ink a little ahead of the pointer where the browser predicts its path.
    if (inp.stroke && typeof e.getPredictedEvents === 'function') {
      inp.stroke.setPreview(
        e.getPredictedEvents().map((ev) => ({ ...this.toLocal(ev), t: ev.timeStamp, pressure: ev.pressure || 0.5 })),
      );
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
      if (held >= LONG_PRESS_MS && inp.fish?.origin && !inp.fish.undone) this.replayOrigin(inp.fish);
      else if (held >= LONG_PRESS_MS) this.longPress(inp.downX, inp.downY);
      else this.tap(inp.downX, inp.downY, inp.fish);
      return;
    }
    if (!stroke) return;
    stroke.finish();
    this.resolveStroke(stroke, inp.pointer);
  };

  /** The docs/02 §4 table: every cell answers. */
  private resolveStroke(stroke: Stroke, pointer: string): void {
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
    // 近岸: a stroke begun on the bank is a branch; a short one there lets a petal fall.
    if (this.shore && this.shore.onBank(stroke.points[0].x, stroke.points[0].y)) {
      if (c.kind === 'short') {
        this.fadeStroke(stroke, 0.1, 0.6);
        this.bankTap(centroid.x, centroid.y);
      } else this.placeBranch(stroke, pointer);
      return;
    }
    switch (c.kind) {
      case 'short':
        this.fadeStroke(stroke, 0.1, 0.6);
        if (lake) {
          this.addRipple(centroid.x, centroid.y, 0.5);
          this.sfx('ripple', centroid.x, 0.5);
        } else this.placeStar(centroid.x, centroid.y);
        return;
      case 'circle':
        this.leadMoon(c, stroke, lake);
        return;
      case 'elongated':
        if (lake) this.leadFish(stroke, pointer, spineFromOutline(stroke.points, c.features));
        else this.placeCloud(c, stroke);
        return;
      case 'arc':
        if (lake) this.leadFish(stroke, pointer);
        else this.leadMoon(c, stroke, false);
        return;
      case 'open':
        if (this.handInScene(stroke)) return;
        if (lake) this.leadFish(stroke, pointer);
        else this.launchMeteor(stroke);
        return;
    }
  }

  /**
   * 手进到场景里 (docs/02 §5.5): in some weathers an open stroke is not a
   * fish or a meteor but a gesture in that scene. 雷雨: a line drawn down
   * from the sky is a lightning strike along it. 河灯: a line drawn up into
   * the sky lets a paper lantern rise from where it began. 秋风: a line
   * drawn across the sky is a gust that way, carrying the leaves (or 落花's
   * petals) with it.
   */
  private handInScene(stroke: Stroke): boolean {
    const pts = stroke.points;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const top = Math.max(a.y, b.y);
    const rise = b.y - a.y;
    if (this.atmosphere.storm > 0.5 && top >= this.horizonY + this.minDim * 0.1 && Math.abs(rise) > Math.abs(b.x - a.x) * 0.5) {
      this.fadeStroke(stroke, 0, 0.25);
      this.drawnStrike(pts);
      return true;
    }
    const run = b.x - a.x;
    if (Math.max(this.atmosphere.autumn, this.atmosphere.blossom) > 0.5 && top >= this.horizonY && Math.abs(run) > this.minDim * 0.2 && Math.abs(run) > Math.abs(rise) * 1.5 && stroke.points.every((p) => p.y >= this.horizonY - this.minDim * 0.05)) {
      this.fadeStroke(stroke, 0, 0.4);
      this.gust = { dir: Math.sign(run), k: 1 };
      const view = { width: this.width, height: this.height, horizonY: this.horizonY, S: this.minDim };
      if (this.atmosphere.autumn > 0.5) this.leaves.gust(Math.sign(run), (a.y + b.y) / 2, view);
      else this.petals.gust(Math.sign(run), (a.y + b.y) / 2, view);
      return true;
    }
    if (this.atmosphere.lanterns > 0.5 && b.y >= this.horizonY && rise > this.minDim * 0.1 && rise > Math.abs(b.x - a.x)) {
      this.fadeStroke(stroke, 0.05, 0.6);
      if (a.y < this.horizonY) this.addRipple(a.x, a.y, 0.5);
      this.lanterns.launch(a.x, Math.max(a.y, this.horizonY * 0.2), this.minDim, this.time);
      this.sfx('chime', a.x, 0.3);
      return true;
    }
    return false;
  }

  /** Lightning along a line the visitor drew, onto the hills, and the thunder at once. */
  private drawnStrike(pts: Pt[]): void {
    const S = this.minDim;
    const segs = strikeAlong(pts, this.horizonY + S * 0.03, S, Math.random);
    const x = segs.length ? segs[0][0] : pts[0].x;
    this.boltFlash(segs, x);
    this.thunder = { at: this.time + 0.15 + Math.random() * 0.2, x, strength: 1.3 };
    // The sky's own lightning waits a little after the visitor's.
    this.nextFlash = Math.max(this.nextFlash, this.time + 6 + Math.random() * 4);
  }

  /** Start a flash at `x` drawing these bolts (none: only the clouds light up). */
  private boltFlash(segs: Segment[], x: number): void {
    const u = this.worldMat.uniforms;
    this.flash = { at: this.time, x };
    segs.forEach((s, i) => u.uBolt.value[i].set(...packSegment(s)));
    u.uBoltCount.value = segs.length;
    if (!segs.length) return;
    const pad = this.minDim * 0.25;
    const xs = segs.flatMap((s) => [s[0], s[2]]);
    const ys = segs.flatMap((s) => [s[1], s[3]]);
    u.uBoltBox.value.set(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad);
  }

  /** 近岸: the stroke stays as the bough and blossoms open along it. */
  private placeBranch(stroke: Stroke, pointer: string): void {
    const shore = this.shore!;
    const style = strokeStyle(stroke.points, this.minDim, pointer);
    const id = shore.addBranch(stroke, this.time, this.livelyFrom(style.speed, pointer));
    const end = stroke.points[stroke.points.length - 1];
    this.sfx('chime', end.x, 0.3);
    this.record('branch', end.x, end.y, () => {
      const s = shore.removeBranch(id);
      if (s) this.fadeStroke(s, 0, 0.8);
    });
  }

  /** 近岸: a touch on the bank: a petal from the nearest open blossom, if there is one near. */
  private bankTap(x: number, y: number): void {
    const b = this.shore?.nearestBlossom(x, y, this.minDim * 0.45, this.time);
    if (b) this.dropPetal(b.x, b.y);
  }

  /** A petal let fall from a blossom: onto the water just below, or onto the bank if the blossom is over it. */
  private dropPetal(x: number, y: number): void {
    const S = this.minDim;
    const view = { width: this.width, height: this.height, horizonY: this.horizonY, S };
    const ground = bankTop(x, view);
    const landY = y > ground + S * 0.04 ? THREE.MathUtils.clamp(y - S * (0.05 + 0.08 * Math.random()), ground + S * 0.02, this.horizonY - S * 0.03) : y - S * 0.03;
    this.petals.drop(x, y, landY, view);
  }

  /** A petal touching the water: a small ring, and a fish nearby may come to it (花影). */
  private petalLands(x: number, y: number): void {
    if (this.shore?.onBank(x, y)) return;
    this.addRipple(x, y, 0.15);
    if (!this.shore || Math.random() > 0.6) return;
    let near: Fish | null = null;
    let best = this.minDim * 0.4;
    for (const f of this.fishes) {
      if (f.ghost || f.hidden || f.state !== 'swimming') continue;
      const d = Math.hypot(f.headX - x, f.headY - y);
      if (d < best) {
        best = d;
        near = f;
      }
    }
    near?.lure(x, y, this.time, { duration: 3 });
  }

  /** Start now if nothing leads, otherwise wait for the turn (docs/03 §7). */
  private lead(stroke: Stroke, start: () => number): void {
    if (!this.leadQueue.length && this.time >= this.leadUntil) this.leadUntil = this.time + start();
    else this.leadQueue.push({ stroke, start });
  }

  private leadFish(stroke: Stroke, pointer: string, spine?: Pt[]): void {
    this.lead(stroke, () => {
      this.spawnFish(stroke, false, spine, pointer);
      return FORM_TIME;
    });
  }

  private leadMoon(c: Classification, stroke: Stroke, fromLake: boolean): void {
    this.lead(stroke, () => {
      const planet = !!this.sky.moonSpec;
      this.placeMoon(c, stroke, fromLake);
      return planet ? PLANET_LEAD : MOON_RISE;
    });
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
    const onMoon = !fish && this.onMoon(x, y);
    logEvent('touch', { object: fish ? 'fish' : onMoon ? 'moon' : y >= this.horizonY ? 'sky' : 'lake' });
    if (onMoon) {
      // Moonlight brightens for a moment and the reflection trembles.
      this.sky.pulseMoon();
      this.addRipple(moon!.x, 2 * this.horizonY - moon!.y, 0.8);
      this.sfx('chime', moon!.x, 0.4);
      return;
    }
    if (y >= this.horizonY && !fish) {
      // 星河: a touch on the sky leaves a star, to join into a constellation.
      if (this.atmosphere.galaxy > 0.5) this.placeStar(x, y);
      else {
        this.sky.flash(x, y);
        this.sfx('star', x);
      }
      return;
    }
    // 近岸: a touch on the bank lets a petal fall from the nearest blossom.
    if (this.shore && !fish && this.shore.onBank(x, y)) {
      this.bankTap(x, y);
      return;
    }
    // 荷塘: a touched pad or flower bobs, and a frog answers.
    if (y < this.horizonY && !fish && this.lotus.touch(x, y)) {
      this.addRipple(x, y, 0.4);
      this.sfx('frog', x, 1);
      return;
    }
    // A sent fish waits at the edge: touching the water takes it in (送一条鱼).
    if (y < this.horizonY && this.acceptGuest(x, y)) return;
    if (fish) {
      prompted('touch_fish');
      this.events.onFishTouched?.();
      const again = this.lastFishTouch?.fish === fish && this.time - this.lastFishTouch.time < DOUBLE_TAP_S;
      this.lastFishTouch = { fish, time: this.time };
      if (again && fish.canLeap) {
        fish.leap();
        this.addRipple(fish.headX, fish.headY, 1.1);
        this.sfx('ripple', fish.headX, 1.1);
        this.lastFishTouch = null;
        return;
      }
      fish.scare(x, y, 1);
      this.addRipple(x, y, 0.6);
      this.sfx('ripple', x, 0.6);
      return;
    }
    this.addRipple(x, y, 1);
    this.sfx('ripple', x, 1);
    // 河灯: touching the water sets a lamp afloat there.
    if (this.atmosphere.lanterns > 0.5) this.lanterns.release(x, y, this.minDim, this.time);
    const r = this.minDim * 0.12;
    for (const f of this.fishes) {
      const d = Math.hypot(f.headX - x, f.headY - y);
      if (d < r) f.scare(x, y, 0.5);
      // The first fish comes from further off and hurries, most times but not every time.
      else if (f.honmei && d < this.minDim * 0.75 && Math.random() < 0.7) f.lure(x, y, this.time, { eager: true });
      else if (d < this.minDim * 0.4) f.lure(x, y, this.time);
    }
  }

  private longPress(x: number, y: number): void {
    if (y >= this.horizonY) {
      this.sky.flash(x, y);
      this.sfx('star', x);
      return;
    }
    this.addRipple(x, y, 0.5);
    this.sfx('ripple', x, 0.5);
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

  /** When the page was hidden, ms since the epoch: a tab left open in the background is a return too. */
  private hiddenAt = 0;

  private onVisibility = (): void => {
    if (document.hidden) {
      this.stop();
      this.hiddenAt = Date.now();
    } else {
      if (this.hiddenAt) this.whileAway(Date.now() - this.hiddenAt);
      this.hiddenAt = 0;
      this.monitor.settle(performance.now());
      this.start();
    }
  };

  private applyTier(): void {
    const t = TIERS[this.monitor.tier];
    this.worldMat.uniforms.uPost.value = t.post ? 1 : 0;
    this.weatherMat.uniforms.uParticles.value = t.particles;
    this.snow.setParticles(t.particles);
    this.resize();
    this.evictOverflow();
  }

  private resize(forcedDpr?: number): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const sx = w / this.width;
    const sy = h / this.height;
    const hadSize = this.width > 1;
    this.width = w;
    this.height = h;
    this.horizon = h > w ? 0.55 : 0.5; // portrait: lake takes 55%
    const dpr = forcedDpr ?? Math.min(window.devicePixelRatio || 1, TIERS[this.monitor.tier].maxDpr);
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
    this.snow.resize(w, h, dpr);
    this.leaves?.setPixelRatio(dpr);
    this.petals?.setPixelRatio(dpr);
    this.shore?.setPixelRatio(dpr);
    this.shore?.resize({ width: w, height: h, horizonY: h * this.horizon, S: Math.min(w, h) });
    this.lotus?.setPixelRatio(dpr);
    this.lanterns?.setPixelRatio(dpr);
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

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
