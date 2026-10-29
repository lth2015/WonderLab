import * as THREE from 'three';
import type { PaletteName } from './intent';

// Colours are passed to shaders as raw sRGB values (no colour management).
// The sky, mountain and water values started from docs/03-ux-ui-design.md
// §3.2 and were darkened during the visual spike; warm and melancholy take
// the same adjustment. 2026-10-29: lifted a step again, the owner found
// the night too deep.
function rgb(hex: string): THREE.Vector3 {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface Palette {
  zenith: THREE.Vector3;
  skyLow: THREE.Vector3;
  mountain: THREE.Vector3;
  water: THREE.Vector3;
  accent: THREE.Vector3;
  ink: THREE.Vector3;
  paper: THREE.Vector3;
  cinnabar: THREE.Vector3;
  brush: THREE.Vector3;
}

export type PaletteKey = keyof Palette;
export const PALETTE_KEYS: PaletteKey[] = ['zenith', 'skyLow', 'mountain', 'water', 'accent', 'ink', 'paper', 'cinnabar', 'brush'];

export const serene: Palette = {
  zenith: rgb('#141C2C'),
  skyLow: rgb('#2E405E'),
  mountain: rgb('#283446'),
  water: rgb('#111A26'),
  accent: rgb('#E9D9A6'),
  ink: rgb('#0A0D13'),
  paper: rgb('#EFE8D8'),
  cinnabar: rgb('#C8553D'),
  brush: rgb('#E6E0D2'),
};

export const melancholy: Palette = {
  zenith: rgb('#181B23'),
  skyLow: rgb('#3B4252'),
  mountain: rgb('#343843'),
  water: rgb('#151920'),
  accent: rgb('#9FB3C8'),
  ink: rgb('#0C0D10'),
  paper: rgb('#E4E2DC'),
  cinnabar: rgb('#B0604E'),
  brush: rgb('#DAD8D2'),
};

export const warm: Palette = {
  zenith: rgb('#2C1C21'),
  skyLow: rgb('#84523F'),
  mountain: rgb('#3E2D2A'),
  water: rgb('#21181A'),
  accent: rgb('#F0B46A'),
  ink: rgb('#140D0B'),
  paper: rgb('#F2E4CF'),
  cinnabar: rgb('#C8553D'),
  brush: rgb('#EAD9C2'),
};

export const PALETTES: Record<PaletteName, Palette> = { serene, warm, melancholy };

/** Dusk lifts and warms the horizon (docs/03 §3.2): target colour and weight. */
export const DUSK: Partial<Record<PaletteKey, [THREE.Vector3, number]>> = {
  zenith: [rgb('#2A2236'), 0.35],
  skyLow: [rgb('#A0603F'), 0.7],
  mountain: [rgb('#3A2A2C'), 0.2],
  water: [rgb('#1E1A22'), 0.3],
  accent: [rgb('#F2B37A'), 0.5],
};

/**
 * 白天 (2026-10-29): ink on rice paper. A pale sky warming toward the
 * horizon, blue-grey hills, bright water, and the brush turned to dark ink.
 * Nearly a full replacement: target colour and weight.
 */
export const DAY: Partial<Record<PaletteKey, [THREE.Vector3, number]>> = {
  zenith: [rgb('#A9BFCF'), 0.95],
  skyLow: [rgb('#E9E3D3'), 0.95],
  mountain: [rgb('#748694'), 0.9],
  water: [rgb('#9FB1BA'), 0.95],
  accent: [rgb('#FFF6DC'), 0.8],
  brush: [rgb('#262A31'), 1],
};

export function clonePalette(p: Palette): Palette {
  const out = {} as Palette;
  for (const k of PALETTE_KEYS) out[k] = p[k].clone();
  return out;
}
