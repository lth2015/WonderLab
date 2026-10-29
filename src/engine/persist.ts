// World saving (docs/02 §6.3, P1): the world goes to localStorage and comes
// back after a refresh. Positions are stored normalised (docs/03 §2) so a
// world survives a window resize; the format is versioned with the future
// "world seed" in mind. Nothing here leaves the device.

import type { AtmosphereState } from './atmosphere';
import type { MoonPhase } from './classify';
import type { FishOrigin } from './fish';
import { FAMILIES, type Family } from './koi-style';
import { WEATHERS } from './intent';

export const SAVE_VERSION = 1;
const KEY = 'wonderlab.world';
const LIMITS = { fish: 12, stars: 24, clouds: 4, planets: 3, spine: 64, origin: 48 };
/**
 * Fish kept 「在远处」 (docs/02 §11 decision 12): when the lake is full, the
 * oldest fish swims off but stays in the world. None is ever let go: once
 * this many are away, the lake keeps its extra fish instead. A fish saves to
 * about 2 KB, so this is about 1 MB of the browser's 5; at a fish a day it
 * is well over a year of drawing.
 */
export const AWAY_MAX = 500;

export interface SavedFish {
  /** Tail to head, normalised to the view (x / width, y / height, from the bottom). */
  spine: [number, number][];
  drawSpeed: number;
  seed: number;
  patch: number;
  /** A meteor's glowing fish. Absent for drawn fish. */
  glow?: boolean;
  /** Koi variety (koi-style.ts). Absent in older saves. */
  variety?: string;
  /** The world's first fish (本命鱼). */
  honmei?: boolean;
  /** The stroke and readings it came from (docs/02 §5.1). Absent in older saves and for meteor fish. */
  origin?: FishOrigin;
  /** When it was born, ms since the epoch (docs/02 §5.6: it grows with real time). Absent in older saves. */
  bornAt?: number;
  /** How much it had grown past what was drawn when this body was saved (time.ts regrow). Absent in older saves. */
  size?: number;
  /** Someone sent it (送一条鱼): the gift's id and the sender's optional one-character seal. */
  gift?: { id: string; seal?: string };
}

export interface WorldSave {
  version: typeof SAVE_VERSION;
  /** When the world was last saved, ms since the epoch: how long the user was away. Absent in older saves. */
  savedAt?: number;
  atmosphere: AtmosphereState;
  fish: SavedFish[];
  /** Fish that swam off when the lake was full: still part of the world, longest away first. Absent in older saves. */
  away?: SavedFish[];
  /** x, y normalised; r as a share of the short screen edge. */
  moon: { x: number; y: number; r: number; phase: MoonPhase; dark: [number, number] } | null;
  /** x, y normalised; r as a share of the short screen edge; pigment index. Absent in older saves. */
  planets: [number, number, number, number][];
  stars: [number, number][];
  /** x, y normalised; w as a share of the short screen edge. */
  clouds: [number, number, number][];
}

export function saveWorld(world: WorldSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(world));
  } catch {
    // Private mode or storage full: the world simply is not kept.
  }
}

export function clearWorld(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

export function loadWorld(): WorldSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseWorld(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Validate untrusted JSON field by field; anything malformed is dropped. */
export function parseWorld(data: unknown): WorldSave | null {
  if (!isObj(data) || data.version !== SAVE_VERSION) return null;
  const a = data.atmosphere;
  if (!isObj(a)) return null;
  const atmosphere: AtmosphereState = {
    timeOfDay: oneOf(a.timeOfDay, ['night', 'dusk', 'day'], 'night'),
    weather: oneOf(a.weather, WEATHERS, 'clear'),
    palette: oneOf(a.palette, ['serene', 'warm', 'melancholy'], 'serene'),
    wind: unit(a.wind, 0.25),
    intensity: unit(a.intensity, 0.5),
  };

  const fish = arr(data.fish)
    .slice(0, LIMITS.fish)
    .map(parseFish)
    .filter((f): f is SavedFish => f !== null);
  const away = arr(data.away)
    .slice(-AWAY_MAX)
    .map(parseFish)
    .filter((f): f is SavedFish => f !== null);

  let moon: WorldSave['moon'] = null;
  const m = data.moon;
  if (isObj(m) && isUnitish(m.x) && isUnitish(m.y) && isPos(m.r) && Array.isArray(m.dark) && m.dark.length === 2 && m.dark.every(isNum)) {
    moon = {
      x: m.x,
      y: m.y,
      r: Math.min(m.r, 0.2),
      phase: oneOf(m.phase, ['full', 'gibbous', 'crescent'], 'full'),
      dark: [m.dark[0], m.dark[1]],
    };
  }

  const planets = arr(data.planets)
    .slice(0, LIMITS.planets)
    .filter(
      (p): p is [number, number, number, number] =>
        Array.isArray(p) && p.length === 4 && isUnitish(p[0]) && isUnitish(p[1]) && isPos(p[2]) && p[2] <= 0.1 && isNum(p[3]),
    )
    .map(([x, y, r, tint]): [number, number, number, number] => [x, y, r, Math.abs(Math.round(tint)) % 3]);

  const stars = arr(data.stars)
    .slice(0, LIMITS.stars)
    .filter((s): s is [number, number] => Array.isArray(s) && s.length === 2 && s.every(isUnitish));
  const clouds = arr(data.clouds)
    .slice(0, LIMITS.clouds)
    .filter((c): c is [number, number, number] => Array.isArray(c) && c.length === 3 && isUnitish(c[0]) && isUnitish(c[1]) && isPos(c[2]));

  return {
    version: SAVE_VERSION,
    ...(isPos(data.savedAt) ? { savedAt: data.savedAt } : {}),
    atmosphere,
    fish,
    ...(away.length ? { away } : {}),
    moon,
    planets,
    stars,
    clouds,
  };
}

/** One saved fish, validated field by field; null if it cannot be a fish. */
function parseFish(f: unknown): SavedFish | null {
  if (!isObj(f)) return null;
  const spine = arr(f.spine)
    .slice(0, LIMITS.spine)
    .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every(isUnitish));
  if (spine.length < 2 || !isPos(f.drawSpeed) || !isNum(f.seed) || !isNum(f.patch)) return null;
  const origin = parseOrigin(f.origin);
  return {
    spine,
    drawSpeed: Math.min(f.drawSpeed, 10),
    seed: f.seed,
    patch: unit(f.patch, 0),
    ...(f.glow === true ? { glow: true } : {}),
    ...(typeof f.variety === 'string' && /^[a-z]{2,16}$/.test(f.variety) ? { variety: f.variety } : {}),
    ...(f.honmei === true ? { honmei: true } : {}),
    ...(origin ? { origin } : {}),
    ...(isPos(f.bornAt) ? { bornAt: f.bornAt } : {}),
    ...(isPos(f.size) && f.size >= 1 && f.size <= 2 ? { size: f.size } : {}),
    ...(isObj(f.gift) && typeof f.gift.id === 'string' && /^[0-9a-z]{1,13}$/.test(f.gift.id)
      ? { gift: { id: f.gift.id, ...(typeof f.gift.seal === 'string' && /^[\p{L}\p{N}]$/u.test(f.gift.seal) ? { seal: f.gift.seal } : {}) } }
      : {}),
  };
}


function parseOrigin(o: unknown): FishOrigin | undefined {
  if (!isObj(o)) return undefined;
  const stroke = arr(o.stroke)
    .slice(0, LIMITS.origin)
    .filter((p): p is [number, number, number] => Array.isArray(p) && p.length === 3 && isUnitish(p[0]) && isUnitish(p[1]) && isNum(p[2]) && p[2] >= 0);
  if (stroke.length < 2 || !isNum(o.speed) || o.speed < 0 || !isNum(o.curviness) || o.curviness < 0) return undefined;
  if (!(typeof o.family === 'string' && o.family in FAMILIES)) return undefined;
  if (!isNum(o.born) || o.born < 1) return undefined;
  return {
    stroke: stroke.map(([x, y, t]): [number, number, number] => [x, y, Math.min(Math.round(t), 60000)]),
    speed: Math.min(o.speed, 100),
    curviness: Math.min(o.curviness, 4),
    family: o.family as Family,
    pointer: oneOf(o.pointer, ['mouse', 'touch', 'pen', 'keyboard'], 'mouse'),
    born: Math.round(o.born),
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isPos(v: unknown): v is number {
  return isNum(v) && v > 0;
}
/** Normalised coordinates, with a little room for things near the edge. */
function isUnitish(v: unknown): v is number {
  return isNum(v) && v >= -0.5 && v <= 1.5;
}
function unit(v: unknown, fallback: number): number {
  return isNum(v) ? Math.min(Math.max(v, 0), 1) : fallback;
}
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}
