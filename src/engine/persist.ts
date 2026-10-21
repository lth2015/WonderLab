// World saving (docs/02 §6.3, P1): the world goes to localStorage and comes
// back after a refresh. Positions are stored normalised (docs/03 §2) so a
// world survives a window resize; the format is versioned with the future
// "world seed" in mind. Nothing here leaves the device.

import type { AtmosphereState } from './atmosphere';
import type { MoonPhase } from './classify';

export const SAVE_VERSION = 1;
const KEY = 'wonderlab.world';
const LIMITS = { fish: 12, stars: 24, clouds: 4, spine: 64 };

export interface SavedFish {
  /** Tail to head, normalised to the view (x / width, y / height, from the bottom). */
  spine: [number, number][];
  drawSpeed: number;
  seed: number;
  patch: number;
}

export interface WorldSave {
  version: typeof SAVE_VERSION;
  atmosphere: AtmosphereState;
  fish: SavedFish[];
  /** x, y normalised; r as a share of the short screen edge. */
  moon: { x: number; y: number; r: number; phase: MoonPhase; dark: [number, number] } | null;
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
    timeOfDay: oneOf(a.timeOfDay, ['night', 'dusk'], 'night'),
    weather: oneOf(a.weather, ['clear', 'rain', 'mist', 'fireflies'], 'clear'),
    palette: oneOf(a.palette, ['serene', 'warm', 'melancholy'], 'serene'),
    wind: unit(a.wind, 0.25),
    intensity: unit(a.intensity, 0.5),
  };

  const fish: SavedFish[] = [];
  for (const f of arr(data.fish).slice(0, LIMITS.fish)) {
    if (!isObj(f)) continue;
    const spine = arr(f.spine)
      .slice(0, LIMITS.spine)
      .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every(isUnitish));
    if (spine.length < 2 || !isPos(f.drawSpeed) || !isNum(f.seed) || !isNum(f.patch)) continue;
    fish.push({ spine, drawSpeed: Math.min(f.drawSpeed, 10), seed: f.seed, patch: unit(f.patch, 0) });
  }

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

  const stars = arr(data.stars)
    .slice(0, LIMITS.stars)
    .filter((s): s is [number, number] => Array.isArray(s) && s.length === 2 && s.every(isUnitish));
  const clouds = arr(data.clouds)
    .slice(0, LIMITS.clouds)
    .filter((c): c is [number, number, number] => Array.isArray(c) && c.length === 3 && isUnitish(c[0]) && isUnitish(c[1]) && isPos(c[2]));

  return { version: SAVE_VERSION, atmosphere, fish, moon, stars, clouds };
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
function oneOf<T extends string>(v: unknown, options: T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}
