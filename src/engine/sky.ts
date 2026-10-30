import * as THREE from 'three';
import type { MoonPhase } from './classify';

// Sky entities. They are drawn inside the world shader (shaders/world.ts),
// so the lake reflects them for free; this class only keeps their state and
// animates the uniforms.

export const MAX_STARS = 24;
/** 星河: most lines joining the visitor's stars into a constellation. */
export const MAX_LINKS = 12;
export const MAX_METEORS = 3;
export const MAX_CLOUDS = 4;
/** Circles after the moon become small planets (docs/02 §5.2, P1); the oldest gives way. */
export const MAX_PLANETS = 3;
/** Mineral pigments for planets: 石青, 赭石, 藤黄 (shaders/world.ts). */
export const PLANET_TINTS = 3;
/** Shader slots: one more than the cap, so the planet giving way can fade out. */
export const PLANET_SLOTS = MAX_PLANETS + 1;

export const MOON_RISE = 1.5;   // s, --dur-create
const MOON_FADE = 0.45;  // s, when a moon is replaced or undone
const METEOR_TIME = 0.9;
const FLASH_LIFE = 1.6;
const CLOUD_DRIFT = 6;   // px/s

/** Offset of the shadow disc, in radii: 2+ leaves the disc fully lit. */
const SHADE: Record<MoonPhase, number> = { full: 2.4, gibbous: 1.4, crescent: 0.55 };

export interface SkySnapshot {
  moon: MoonSpec | null;
  planets: { x: number; y: number; r: number; tint: number }[];
  stars: { x: number; y: number }[];
  clouds: { x: number; y: number; w: number }[];
}

export interface MoonSpec {
  x: number;
  y: number;
  r: number;
  phase: MoonPhase;
  /** Unit vector toward the dark side. */
  dark: { x: number; y: number };
  /** Rise from the horizon (drawn on the lake) instead of blooming in place. */
  rise: boolean;
}

interface Moon {
  spec: MoonSpec;
  born: number;
  presence: number;
  leaving: boolean;
}

interface Star {
  id: number;
  x: number;
  y: number;
  born: number;
  flash: boolean;  // a brief twinkle that leaves nothing behind
  fading: number;  // time the fade-out started, or -1
}

interface Meteor {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  born: number;
  onDone: () => void;
}

interface Planet {
  id: number;
  x: number;
  y: number;
  r: number;
  tint: number;
  born: number;
  fading: number;
}

interface Cloud {
  id: number;
  x: number;
  y: number;
  w: number;
  born: number;
  fading: number;
}

export class Sky {
  readonly uniforms = {
    uSkyVeil: { value: 1 },
    uMoon: { value: new THREE.Vector4() },        // x, y, radius, presence
    uMoonShade: { value: new THREE.Vector3(1, 0, SHADE.full) },
    uMoonLight: { value: 0 },
    uMoonPulse: { value: 0 },
    uStars: { value: Array.from({ length: MAX_STARS }, () => new THREE.Vector4()) }, // x, y, brightness, flash
    uStarCount: { value: 0 },
    uLinks: { value: Array.from({ length: MAX_LINKS }, () => new THREE.Vector4()) }, // ax, ay, bx, by
    uLinkLook: { value: Array.from({ length: MAX_LINKS }, () => new THREE.Vector2()) }, // drawn 0..1, brightness
    uMeteors: { value: Array.from({ length: MAX_METEORS }, () => new THREE.Vector4()) }, // ax, ay, bx, by
    uMeteorT: { value: Array.from({ length: MAX_METEORS }, () => 0) }, // progress 0..1, 0 = inactive
    uClouds: { value: Array.from({ length: MAX_CLOUDS }, () => new THREE.Vector4()) }, // x, y, halfWidth, presence
    uPlanets: { value: Array.from({ length: PLANET_SLOTS }, () => new THREE.Vector4()) }, // x, y, radius, presence
    uPlanetLook: { value: Array.from({ length: PLANET_SLOTS }, () => new THREE.Vector4()) }, // dark side x, y, tint, seed
  };

  private moon: Moon | null = null;
  private veilTarget = 1;
  /** Reduced motion: moons fade in place over 0.6 s (docs/03 §8). */
  calm = false;
  private pendingMoon: Moon | null = null;
  private stars: Star[] = [];
  /** 星河: lines between the visitor's stars, by star id. */
  private links: { a: number; b: number; born: number }[] = [];
  /** How much the constellation lines show (the Milky Way's level). */
  linkLevel = 0;
  private meteors: Meteor[] = [];
  private clouds: Cloud[] = [];
  private planets: Planet[] = [];
  private nextId = 1;
  private time = 0;

  get moonSpec(): MoonSpec | null {
    const m = this.pendingMoon ?? this.moon;
    return m && !m.leaving ? m.spec : null;
  }

  /** Current on-screen moon centre, if a moon is shown. */
  /** What is in the sky, for the world's rules (world-rules.ts audit). */
  seen(): { stars: number; planets: number; meteors: number } {
    return { stars: this.stars.length, planets: this.planets.filter((p) => p.fading < 0).length, meteors: this.meteors.length };
  }

  /** The moon brightens for a moment (touched, P1). */
  pulseMoon(): void {
    this.uniforms.uMoonPulse.value = 1;
  }

  /** What to save: the moon, settled stars and clouds (not flashes or meteors in flight). */
  snapshot(): SkySnapshot {
    const hidden = this.veilTarget === 0;
    return {
      moon: hidden ? null : this.moonSpec,
      planets: hidden ? [] : this.planets.filter((p) => p.fading < 0).map((p) => ({ x: p.x, y: p.y, r: p.r, tint: p.tint })),
      stars: hidden ? [] : this.stars.filter((s) => !s.flash && s.fading < 0).map((s) => ({ x: s.x, y: s.y })),
      clouds: hidden ? [] : this.clouds.filter((c) => c.fading < 0).map((c) => ({ x: c.x, y: c.y, w: c.w })),
    };
  }

  get moonPos(): { x: number; y: number; r: number } | null {
    if (!this.moon || this.moon.leaving) return null;
    const v = this.uniforms.uMoon.value;
    return { x: v.x, y: v.y, r: v.z };
  }

  /** Show a moon (replacing any current one). Pass null to remove it. */
  setMoon(spec: MoonSpec | null): void {
    const next = spec ? { spec, born: this.time, presence: 0, leaving: false } : null;
    if (this.moon && !this.moon.leaving) {
      this.moon.leaving = true;
      this.pendingMoon = next;
    } else if (this.moon) {
      this.pendingMoon = next;
    } else {
      this.moon = next;
    }
  }

  /** Live planets, for keeping a new one clear of them. */
  get planetDiscs(): { x: number; y: number; r: number }[] {
    return this.planets.filter((p) => p.fading < 0).map((p) => ({ x: p.x, y: p.y, r: p.r }));
  }

  addPlanet(x: number, y: number, r: number, tint: number): number {
    const id = this.nextId++;
    const live = this.planets.filter((p) => p.fading < 0);
    if (live.length >= MAX_PLANETS) live[0].fading = this.time;
    this.planets.push({ id, x, y, r, tint: ((tint % PLANET_TINTS) + PLANET_TINTS) % PLANET_TINTS, born: this.time, fading: -1 });
    return id;
  }

  removePlanet(id: number): void {
    const p = this.planets.find((pl) => pl.id === id);
    if (p && p.fading < 0) p.fading = this.time;
  }

  addStar(x: number, y: number): number {
    const id = this.nextId++;
    const permanent = this.stars.filter((s) => !s.flash && s.fading < 0);
    if (permanent.length >= MAX_STARS - 4) permanent[0].fading = this.time;
    this.stars.push({ id, x, y, born: this.time, flash: false, fading: -1 });
    return id;
  }

  flash(x: number, y: number): void {
    const flashes = this.stars.filter((s) => s.flash);
    if (flashes.length >= 4) this.stars.splice(this.stars.indexOf(flashes[0]), 1);
    this.stars.push({ id: this.nextId++, x, y, born: this.time, flash: true, fading: -1 });
  }

  /** Join two of the visitor's stars with a faint line, drawn out from the first. */
  link(a: number, b: number): void {
    if (this.links.length >= MAX_LINKS) this.links.shift();
    this.links.push({ a, b, born: this.time });
  }

  removeStar(id: number): void {
    const s = this.stars.find((st) => st.id === id);
    if (s && s.fading < 0) s.fading = this.time;
  }

  meteor(ax: number, ay: number, bx: number, by: number, onDone: () => void): void {
    if (this.meteors.length >= MAX_METEORS) this.meteors.shift()!.onDone();
    this.meteors.push({ ax, ay, bx, by, born: this.time, onDone });
  }

  addCloud(x: number, y: number, w: number): number {
    const id = this.nextId++;
    const live = this.clouds.filter((c) => c.fading < 0);
    if (live.length >= MAX_CLOUDS) live[0].fading = this.time;
    this.clouds.push({ id, x, y, w, born: this.time, fading: -1 });
    return id;
  }

  removeCloud(id: number): void {
    const c = this.clouds.find((cl) => cl.id === id);
    if (c && c.fading < 0) c.fading = this.time;
  }

  /** Fade every user sky item toward `target` (0 hides, 1 shows), for restart and its undo. */
  setVeil(target: number): void {
    this.veilTarget = target;
  }

  /** Remove everything at once. */
  clear(): void {
    this.moon = null;
    this.pendingMoon = null;
    this.stars = [];
    this.meteors = [];
    this.clouds = [];
    this.planets = [];
    this.veilTarget = 1;
    this.uniforms.uSkyVeil.value = 1;
    this.uniforms.uMoon.value.w = 0;
    this.uniforms.uMoonLight.value = 0;
  }

  scale(sx: number, sy: number): void {
    const k = Math.sqrt(sx * sy);
    for (const m of [this.moon, this.pendingMoon]) {
      if (!m) continue;
      m.spec = { ...m.spec, x: m.spec.x * sx, y: m.spec.y * sy, r: m.spec.r * k };
    }
    for (const s of this.stars) {
      s.x *= sx;
      s.y *= sy;
    }
    for (const c of this.clouds) {
      c.x *= sx;
      c.y *= sy;
      c.w *= sx;
    }
    for (const p of this.planets) {
      p.x *= sx;
      p.y *= sy;
      p.r *= k;
    }
    for (const m of this.meteors) {
      m.ax *= sx;
      m.bx *= sx;
      m.ay *= sy;
      m.by *= sy;
    }
  }

  update(dt: number, time: number, horizonY: number, width: number, wind: number): void {
    this.time = time;
    const veil = this.uniforms.uSkyVeil;
    veil.value += Math.sign(this.veilTarget - veil.value) * Math.min(Math.abs(this.veilTarget - veil.value), dt / 0.6);
    this.updateMoon(dt, horizonY);
    this.updatePlanets();

    // Stars.
    this.stars = this.stars.filter((s) => {
      if (s.flash) return time - s.born < FLASH_LIFE;
      return s.fading < 0 || time - s.fading < 0.8;
    });
    const sv = this.uniforms.uStars.value;
    this.stars.slice(-MAX_STARS).forEach((s, i) => {
      const age = time - s.born;
      let b: number;
      if (s.flash) b = Math.sin(Math.min(age / FLASH_LIFE, 1) * Math.PI) ** 0.6;
      else {
        // Born with a small flare, then settles.
        b = Math.min(age / 0.35, 1) * (1 + 1.4 * Math.exp(-age * 3));
        if (s.fading >= 0) b *= Math.max(1 - (time - s.fading) / 0.8, 0);
      }
      sv[i].set(s.x, s.y, b, s.flash ? 1 : 0);
    });
    this.uniforms.uStarCount.value = Math.min(this.stars.length, MAX_STARS);

    // Constellation lines: gone with either star, fading with it.
    const byId = new Map(this.stars.map((s) => [s.id, s]));
    this.links = this.links.filter((l) => byId.has(l.a) && byId.has(l.b));
    const lv = this.uniforms.uLinks.value;
    const ll = this.uniforms.uLinkLook.value;
    for (let i = 0; i < MAX_LINKS; i++) ll[i].set(0, 0);
    this.links.forEach((l, i) => {
      const a = byId.get(l.a)!;
      const b = byId.get(l.b)!;
      const fade = Math.min(...[a, b].map((s) => (s.fading < 0 ? 1 : Math.max(1 - (time - s.fading) / 0.8, 0))));
      lv[i].set(a.x, a.y, b.x, b.y);
      ll[i].set(Math.min((time - l.born) / 0.7, 1), fade * this.linkLevel);
    });

    // Meteors.
    const mv = this.uniforms.uMeteors.value;
    const mt = this.uniforms.uMeteorT.value;
    const live: Meteor[] = [];
    for (const m of this.meteors) {
      if (time - m.born >= METEOR_TIME) m.onDone();
      else live.push(m);
    }
    this.meteors = live;
    for (let i = 0; i < MAX_METEORS; i++) {
      const m = this.meteors[i];
      if (m) {
        mv[i].set(m.ax, m.ay, m.bx, m.by);
        mt[i] = Math.max((time - m.born) / METEOR_TIME, 1e-3);
      } else mt[i] = 0;
    }

    // Clouds drift with the wind and wrap round.
    this.clouds = this.clouds.filter((c) => c.fading < 0 || time - c.fading < 1.2);
    const cv = this.uniforms.uClouds.value;
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const c = this.clouds[i];
      if (!c) {
        cv[i].set(0, 0, 0, 0);
        continue;
      }
      c.x += CLOUD_DRIFT * (0.4 + wind * 2.4) * dt;
      if (c.x - c.w > width) c.x = -c.w;
      let p = Math.min((time - c.born) / 1.5, 1);
      if (c.fading >= 0) p *= Math.max(1 - (time - c.fading) / 1.2, 0);
      cv[i].set(c.x, c.y, c.w, p);
    }
  }

  private updatePlanets(): void {
    const time = this.time;
    // Up to MAX_PLANETS settled, plus one still fading out; a burst of
    // replacements drops the faintest leaver rather than overflowing.
    this.planets = this.planets.filter((p) => p.fading < 0 || time - p.fading < MOON_FADE * 2);
    while (this.planets.length > PLANET_SLOTS) {
      const gone = this.planets.findIndex((p) => p.fading >= 0);
      this.planets.splice(gone >= 0 ? gone : 0, 1);
    }
    const moon = this.moonPos;
    const pv = this.uniforms.uPlanets.value;
    const lv = this.uniforms.uPlanetLook.value;
    for (let i = 0; i < PLANET_SLOTS; i++) {
      const p = this.planets[i];
      if (!p) {
        pv[i].set(0, 0, 0, 0);
        continue;
      }
      const age = time - p.born;
      let presence = this.calm ? Math.min(age / 0.6, 1) : easeInk(Math.min(age / (MOON_RISE * 0.8), 1));
      if (p.fading >= 0) presence *= Math.max(1 - (time - p.fading) / (MOON_FADE * 2), 0);
      const grow = this.calm ? 1 : 0.6 + 0.4 * easeInk(Math.min(age / MOON_RISE, 1));
      pv[i].set(p.x, p.y, p.r * grow, presence);
      // Lit from the moon's side when there is one, otherwise from the upper left.
      let dx = moon ? p.x - moon.x : 0.6;
      let dy = moon ? p.y - moon.y : -0.8;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      lv[i].set(dx, dy, p.tint, (p.id * 0.618) % 1);
    }
  }

  private updateMoon(dt: number, horizonY: number): void {
    const m = this.moon;
    const u = this.uniforms;
    if (!m) {
      u.uMoon.value.w = 0;
      u.uMoonLight.value = Math.max(u.uMoonLight.value - dt / 2, 0);
      return;
    }
    const age = this.time - m.born;
    const { spec } = m;
    if (m.leaving) {
      m.presence -= dt / MOON_FADE;
      if (m.presence <= 0) {
        this.moon = this.pendingMoon;
        this.pendingMoon = null;
        if (this.moon) this.moon.born = this.time;
        u.uMoon.value.w = 0;
        return;
      }
    } else if (this.calm) {
      m.presence = Math.min(age / 0.6, 1);
    } else {
      m.presence = Math.min(age / (spec.rise ? MOON_RISE * 0.6 : MOON_RISE), 1);
    }
    const k = this.calm ? 1 : easeInk(Math.min(age / MOON_RISE, 1));
    const y = spec.rise ? horizonY + (spec.y - horizonY) * k : spec.y;
    const r = spec.r * (spec.rise ? 1 : 0.6 + 0.4 * k);
    u.uMoon.value.set(spec.x, y, r, Math.max(m.presence, 0));
    u.uMoonShade.value.set(spec.dark.x, spec.dark.y, SHADE[spec.phase]);
    const target = m.leaving ? 0 : spec.phase === 'full' ? 1 : spec.phase === 'gibbous' ? 0.75 : 0.45;
    u.uMoonLight.value += (target - u.uMoonLight.value) * Math.min(dt * 1.5, 1);
    u.uMoonPulse.value *= Math.exp(-dt * 1.4);
  }
}

function easeInk(t: number): number {
  // Approximates cubic-bezier(0.22, 1, 0.36, 1): fast start, long settle.
  return 1 - Math.pow(1 - t, 3.2);
}
