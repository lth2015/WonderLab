import * as THREE from 'three';
import { fromOklch, mixOklab, mixOklch, toOklch, type Oklch } from './color';
import type { PaletteName, SceneCommand, TimeOfDay, Weather } from './intent';
import { DUSK, PALETTE_KEYS, PALETTES, clonePalette, type Palette, type PaletteKey } from './palette';

// The world's mood: palette, time of day, weather, wind. Changes are always
// interpolated (docs/02 §7), over 3–6 s depending on intensity (docs/03 §6.3).

export interface AtmosphereState {
  timeOfDay: TimeOfDay;
  weather: Weather;
  palette: PaletteName;
  wind: number;
  intensity: number;
}

export const INITIAL: AtmosphereState = { timeOfDay: 'night', weather: 'clear', palette: 'serene', wind: 0.25, intensity: 0.5 };

type Colors = Record<PaletteKey, Oklch>;

export class Atmosphere {
  /** Live colours. Materials hold these Vector3s, so updating them in place recolours everything. */
  readonly palette: Palette = clonePalette(PALETTES.serene);
  state: AtmosphereState = { ...INITIAL };
  /** Smoothed values the shaders read. */
  rain = 0;
  mist = 0;
  fireflies = 0;
  snow = 0;
  moonlit = 0;
  /** 秋风落叶, 0..1. */
  autumn = 0;
  /** 流星雨, 0..1. */
  shower = 0;
  /** 河灯与孔明灯, 0..1. */
  lanterns = 0;
  /** 星河, 0..1: rises slowly from behind the hills. */
  galaxy = 0;
  /** 雷雨: 1 while lightning may strike. */
  storm = 0;
  wind = INITIAL.wind;
  dusk = 0;

  private from: Colors = this.snapshot();
  private to: Colors = this.snapshot();
  private t = 1;
  private duration = 4;

  get changing(): boolean {
    return this.t < 1;
  }

  /** Apply a command; returns the previous state for undo. */
  apply(cmd: SceneCommand): AtmosphereState {
    const prev = { ...this.state };
    const next: AtmosphereState = { ...this.state };
    if (cmd.timeOfDay) next.timeOfDay = cmd.timeOfDay;
    if (cmd.weather) next.weather = cmd.weather;
    if (cmd.palette) next.palette = cmd.palette;
    if (cmd.wind !== undefined) next.wind = clamp01(cmd.wind);
    if (cmd.intensity !== undefined) next.intensity = clamp01(cmd.intensity);
    this.set(next);
    return prev;
  }

  set(next: AtmosphereState): void {
    this.state = { ...next };
    this.from = this.snapshot();
    this.to = target(next);
    this.t = 0;
    this.duration = 3 + 3 * next.intensity;
  }

  update(dt: number): void {
    const s = this.state;
    const k = Math.min(dt / (this.duration * 0.45), 1);
    const amount = 0.55 + 0.45 * s.intensity;
    const wet = s.weather === 'rain' || s.weather === 'storm';
    this.rain += ((wet ? amount : 0) - this.rain) * k;
    this.storm += ((s.weather === 'storm' ? 1 : 0) - this.storm) * k;
    this.shower += ((s.weather === 'shower' ? 1 : 0) - this.shower) * k;
    this.lanterns += ((s.weather === 'lanterns' ? 1 : 0) - this.lanterns) * k;
    this.galaxy += ((s.weather === 'galaxy' ? 1 : 0) - this.galaxy) * k * 0.45;
    this.mist += ((s.weather === 'mist' ? amount : 0) - this.mist) * k;
    this.fireflies += ((s.weather === 'fireflies' ? amount : 0) - this.fireflies) * k;
    // Snow comes and goes more slowly than rain.
    this.snow += ((s.weather === 'snow' || s.weather === 'moonsnow' ? amount : 0) - this.snow) * k * 0.6;
    this.autumn += ((s.weather === 'autumn' ? 1 : 0) - this.autumn) * k;
    // Moonlight answers at once: clearly there within two seconds.
    this.moonlit += ((s.weather === 'moonlit' || s.weather === 'moonsnow' ? amount : 0) - this.moonlit) * Math.min(k * 1.6, 1);
    this.wind += (s.wind - this.wind) * k;
    this.dusk += ((s.timeOfDay === 'dusk' ? 1 : 0) - this.dusk) * k;

    if (this.t >= 1) return;
    this.t = Math.min(this.t + dt / this.duration, 1);
    const e = this.t * this.t * (3 - 2 * this.t);
    for (const key of PALETTE_KEYS) fromOklch(mixOklch(this.from[key], this.to[key], e), this.palette[key]);
  }

  private snapshot(): Colors {
    const out = {} as Colors;
    for (const k of PALETTE_KEYS) out[k] = toOklch(this.palette[k]);
    return out;
  }
}

function target(s: AtmosphereState): Colors {
  const base = PALETTES[s.palette];
  const out = {} as Colors;
  const tmp = new THREE.Vector3();
  for (const k of PALETTE_KEYS) {
    let c = toOklch(base[k]);
    const d = DUSK[k];
    if (s.timeOfDay === 'dusk' && d) c = mixOklab(c, toOklch(d[0]), d[1]);
    out[k] = toOklch(fromOklch(c, tmp));
  }
  return out;
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
}
