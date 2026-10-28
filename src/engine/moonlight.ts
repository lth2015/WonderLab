// 月夜 on the lake (docs/02 §5.5): where the moonlight lies on the water,
// so the fish can find it and catch it on their backs. The same geometry as
// the light path in shaders/world.ts, kept in step by hand: with a moon
// drawn, a column under it that widens toward the viewer; with none, the
// path of a moon beyond the upper left of the frame, coming in from the left.

export interface LakeView {
  width: number;
  horizonY: number;
  /** Short screen edge, px. */
  S: number;
}

/** How much of the light path lies at (x, y) on the lake, 0..1 (y up; 0 above the horizon). */
export function moonPathAt(x: number, y: number, view: LakeView, moon: { x: number; r: number } | null, moonlit: number): number {
  const dn = (view.horizonY - y) / view.S;
  if (dn <= 0) return 0;
  if (moon) {
    const cw = moon.r * (0.75 + dn * 5) * (1 + 0.9 * moonlit);
    const dx = x - moon.x;
    return Math.exp(-(dx * dx) / (cw * cw));
  }
  if (moonlit <= 0) return 0;
  const px = 0.04 * view.width + dn * view.S * 0.8;
  const pw = view.S * (0.1 + dn * 0.45);
  const fade = 1 - 0.7 * smoothstep(0.15, 0.7, dn);
  return Math.exp(-(((x - px) / pw) ** 2)) * smoothstep(0, 0.02, dn) * fade;
}

/** Where a fish goes to meet the light of a moon beyond the frame: on its path, a little out from the far shore. */
export function offFramePathPoint(view: LakeView): { x: number; y: number } {
  const dn = 0.16;
  return { x: 0.04 * view.width + dn * view.S * 0.8, y: view.horizonY - dn * view.S };
}

/**
 * 夜半钟声: a far bell now and then on a moonlit night, seconds until the
 * next one. The first comes a little after the light, then rarely.
 */
export const BELL = {
  /** Moonlight above which the bell may ring. */
  threshold: 0.6,
  first: [8, 16] as [number, number],
  every: [55, 110] as [number, number],
};

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
