import * as THREE from 'three';

// Falling snow (docs/02 §5.5 雪夜), chosen by the owner from video
// prototypes on 2026-10-28 (option A, 写实). Each flake is a point with
// its own fall speed and sway, so it flutters rather than slides: two
// sines of different speed side to side, and a little rise and fall.
// Four depths: far flakes small, slow and faint; near ones larger and
// faster; a few very near ones big and out of focus, passing the eye.
// Thicker and thinner patches drift through. Positions are computed in
// the vertex shader from integrated fall and drift, so a change of
// strength never makes flakes jump.

interface Layer {
  n: number;
  /** Ranges in short-screen-edge units (S), per second for speed. */
  size: [number, number];
  speed: [number, number];
  sway: [number, number];
  /** Sway in radians per second. */
  freq: [number, number];
  alpha: [number, number];
  /** Edge softness, 0 sharp to 1 all blur. */
  blur: number;
}

// From the prototype (780 px short edge at 2x), divided by 780.
const LAYERS: Layer[] = [
  { n: 300, size: [0.0045, 0.0077], speed: [0.058, 0.096], sway: [0.01, 0.023], freq: [0.5, 1.2], alpha: [0.45, 0.7], blur: 0.5 },
  { n: 200, size: [0.009, 0.0154], speed: [0.109, 0.173], sway: [0.0205, 0.0487], freq: [0.45, 1.1], alpha: [0.7, 0.92], blur: 0.45 },
  { n: 90, size: [0.018, 0.028], speed: [0.192, 0.308], sway: [0.036, 0.082], freq: [0.4, 0.95], alpha: [0.75, 0.95], blur: 0.55 },
  { n: 14, size: [0.046, 0.077], speed: [0.385, 0.551], sway: [0.058, 0.122], freq: [0.35, 0.8], alpha: [0.25, 0.4], blur: 0.95 },
];

/** Most flakes relative to 中雪 (1). */
export const MAX_DENSITY = 2.4;

/**
 * How much snow the words ask for. Intensity comes from intent.ts:
 * 小雪 0.25, 下雪 0.5, 中雪 0.6, 大雪 0.95. Density is relative to the
 * prototype's 中雪; speed is a multiplier on every flake's fall.
 */
export function snowLevel(intensity: number): { density: number; speed: number } {
  const i = Math.min(Math.max(intensity, 0), 1);
  const points: [number, number, number][] = [
    [0, 0.25, 0.85],
    [0.25, 0.35, 0.9],
    [0.6, 1, 1],
    [0.95, 2.4, 1.2],
    [1, 2.4, 1.2],
  ];
  for (let k = 1; k < points.length; k++) {
    const [x1, d1, s1] = points[k];
    if (i > x1) continue;
    const [x0, d0, s0] = points[k - 1];
    const u = x1 === x0 ? 1 : (i - x0) / (x1 - x0);
    return { density: d0 + (d1 - d0) * u, speed: s0 + (s1 - s0) * u };
  }
  return { density: MAX_DENSITY, speed: 1.2 };
}

const vert = /* glsl */ `
attribute vec4 a0; // x0, y0 (0..1), speed (S/s), size (S)
attribute vec4 a1; // sway (S), freq, phase, alpha
attribute vec4 a2; // blur, rank (0..1, for density), near (1 = the out-of-focus layer), unused
uniform float uTime;
uniform float uFall;    // integral of the speed multiplier over time
uniform float uDrift;   // integral of the wind over time
uniform vec2 uRes;
uniform float uS;
uniform float uPR;
uniform float uDensity; // share of flakes shown, 0..1
uniform float uOn;
uniform float uCalm;
uniform float uParticles;
varying float vAlpha;
varying float vBlur;
void main() {
  float m = 0.08 * uS;
  float spanY = uRes.y + 2.0 * m;
  float spanX = uRes.x + 2.0 * m;
  float speed = a0.z * uS;
  float sway = a1.x * uS * mix(1.0, 0.5, uCalm);
  float t = uTime;
  float y = mod(a0.y * spanY - speed * uFall, spanY) - m;
  y += 0.18 * sway * sin(2.0 * a1.y * t + a1.z * 2.0);
  float x = a0.x * spanX + speed * uDrift + sway * (sin(a1.y * t + a1.z) + 0.45 * sin(2.3 * a1.y * t + 1.7 * a1.z));
  x = mod(x, spanX) - m;
  // Snow comes thicker and thinner in slow, drifting patches.
  float g = 0.78 + 0.22 * sin(x / uS * 2.1 + t * 0.12 + 1.3) * sin(y / uS * 1.4 - t * 0.17);
  // Flakes past the density are hidden, fading at the edge so a change thickens slowly.
  float shown = 1.0 - smoothstep(uDensity - 0.03, uDensity, a2.y);
  // Reduced motion and the lightest tier leave out the near, fast flakes.
  if (a2.z > 0.5 && (uCalm > 0.5 || uParticles < 0.5)) shown = 0.0;
  vAlpha = a1.w * g * shown * uOn;
  vBlur = a2.x;
  gl_PointSize = vAlpha > 0.001 ? a0.w * uS * uPR : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, 0.0, 1.0);
}
`;

const frag = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;
varying float vBlur;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float a = (1.0 - smoothstep(1.0 - vBlur, 1.0, r)) * vAlpha;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export class Snow {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();
  private fall = 0;
  private drift = 0;
  private density = 0;
  private speed = 1;

  constructor() {
    const r = rng(7);
    const lerp = ([a, b]: [number, number]) => a + (b - a) * r();
    const a0: number[] = [];
    const a1: number[] = [];
    const a2: number[] = [];
    LAYERS.forEach((L, li) => {
      const n = Math.round(L.n * MAX_DENSITY);
      for (let i = 0; i < n; i++) {
        a0.push(r(), r(), lerp(L.speed), lerp(L.size));
        a1.push(lerp(L.sway), lerp(L.freq), r() * Math.PI * 2, lerp(L.alpha));
        // Rank spreads each layer evenly over 0..1, so any density keeps the layers in proportion.
        a2.push(L.blur, (i + r()) / n, li === LAYERS.length - 1 ? 1 : 0, 0);
      }
    });
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(a0.length / 4 * 3), 3));
    this.geometry.setAttribute('a0', new THREE.Float32BufferAttribute(a0, 4));
    this.geometry.setAttribute('a1', new THREE.Float32BufferAttribute(a1, 4));
    this.geometry.setAttribute('a2', new THREE.Float32BufferAttribute(a2, 4));
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uFall: { value: 0 },
        uDrift: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uS: { value: 1 },
        uPR: { value: 1 },
        uDensity: { value: 0 },
        uOn: { value: 0 },
        uCalm: { value: 0 },
        uParticles: { value: 1 },
        uColor: { value: new THREE.Vector3(0.92, 0.94, 0.97) },
      },
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2.6; // over the weather's hush and the fish, under the brush
    this.points.visible = false;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    const u = this.material.uniforms;
    u.uRes.value.set(width, height);
    u.uS.value = Math.min(width, height);
    u.uPR.value = pixelRatio;
  }

  setCalm(on: boolean): void {
    this.material.uniforms.uCalm.value = on ? 1 : 0;
  }

  setParticles(share: number): void {
    this.material.uniforms.uParticles.value = share;
  }

  /**
   * `amount` is the smoothed snow (0 = none), `intensity` the words'
   * strength, `wind` the smoothed wind.
   */
  update(dt: number, time: number, amount: number, intensity: number, wind: number): void {
    const level = snowLevel(intensity);
    const k = Math.min(dt / 4, 1);
    this.density += (level.density - this.density) * k;
    this.speed += (level.speed - this.speed) * k;
    const u = this.material.uniforms;
    const calm = u.uCalm.value > 0.5 ? 0.5 : 1;
    this.fall += dt * this.speed * calm;
    this.drift += dt * wind * 0.63 * calm;
    u.uTime.value = time;
    u.uFall.value = this.fall;
    u.uDrift.value = this.drift;
    u.uDensity.value = (this.density / MAX_DENSITY) * Math.min(amount / 0.5, 1);
    u.uOn.value = Math.min(amount / 0.3, 1);
    this.points.visible = amount > 0.002;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
