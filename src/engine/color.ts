import * as THREE from 'three';

// sRGB <-> OKLCH, so palette transitions do not pass through grey
// (docs/03 §3.2). Colours stay as raw sRGB values in THREE.Vector3.

export interface Oklch {
  l: number;
  c: number;
  h: number; // radians
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function toOklch(c: THREE.Vector3): Oklch {
  const r = toLinear(c.x);
  const g = toLinear(c.y);
  const b = toLinear(c.z);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

export function fromOklch(o: Oklch, out = new THREE.Vector3()): THREE.Vector3 {
  const A = o.c * Math.cos(o.h);
  const B = o.c * Math.sin(o.h);
  const l = (o.l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (o.l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (o.l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const clamp = (v: number) => Math.min(Math.max(toSrgb(v), 0), 1);
  return out.set(
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
}

export function mixOklch(a: Oklch, b: Oklch, t: number): Oklch {
  // Near-grey colours have no meaningful hue; borrow the other one's.
  const ha = a.c < 0.01 ? b.h : a.h;
  const hb = b.c < 0.01 ? a.h : b.h;
  let dh = hb - ha;
  if (dh > Math.PI) dh -= Math.PI * 2;
  if (dh < -Math.PI) dh += Math.PI * 2;
  return { l: a.l + (b.l - a.l) * t, c: a.c + (b.c - a.c) * t, h: ha + dh * t };
}

/** Straight-line mix in OKLab: no hue swing, for tints such as dusk. */
export function mixOklab(a: Oklch, b: Oklch, t: number): Oklch {
  const ax = a.c * Math.cos(a.h);
  const ay = a.c * Math.sin(a.h);
  const x = ax + (b.c * Math.cos(b.h) - ax) * t;
  const y = ay + (b.c * Math.sin(b.h) - ay) * t;
  return { l: a.l + (b.l - a.l) * t, c: Math.hypot(x, y), h: Math.atan2(y, x) };
}
