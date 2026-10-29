import * as THREE from 'three';

// 荷塘 (docs/02 §5.5): the summer's day. Two loose clusters of lotus pads
// open on the near water, left and right, leaving the middle to the fish;
// a few pink flowers and buds stand above them on their stems. They grow
// in one after another, sway a little in the wind, and a touch on one
// makes it bob (and a frog answers). Ink-green, so they belong to the
// painting; the fish pass under them.

const PADS = 22;
const FLOWERS = 5;
const BUDS = 4;
const MAX = PADS + FLOWERS + BUDS;

interface Item {
  kind: 0 | 1 | 2; // pad, flower, bud
  /** Position as a share of the lake: x of the width, d of the depth (0 near, 1 the far shore). */
  u: number;
  d: number;
  size: number;
  angle: number;
  /** When it grows in, as a share of the presence 0..1. */
  delay: number;
  phase: number;
  /** Seconds left of a bob after a touch. */
  bob: number;
}

const vert = /* glsl */ `
attribute vec4 aItem;  // kind, size (px), angle, alpha
uniform float uPR;
varying vec4 vItem;
void main() {
  vItem = aItem;
  gl_PointSize = aItem.w > 0.002 ? aItem.y * uPR : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision mediump float;
uniform vec3 uInk;
varying vec4 vItem;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float kind = vItem.x;
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (kind < 0.5) {
    // A lotus leaf seen from the shore: round, so a flat ellipse, its rim a
    // little wavy and darker, faint veins running out from a pale heart.
    vec2 r = vec2(q.x, q.y / 0.4);
    float ang = atan(r.y, r.x);
    float d = length(r);
    float rim = 0.93 + 0.03 * sin(ang * 7.0 + vItem.z * 5.0);
    a = smoothstep(rim, rim - 0.06, d);
    float vein = smoothstep(0.05, 0.0, abs(sin((ang + vItem.z) * 5.5))) * smoothstep(0.12, 0.5, d) * (1.0 - smoothstep(0.7, 0.9, d));
    float tint = fract(vItem.z * 3.7);
    vec3 green = mix(vec3(0.17, 0.3, 0.22), vec3(0.27, 0.4, 0.27), smoothstep(0.9, 0.1, d));
    green = mix(green, vec3(0.24, 0.36, 0.3), tint * 0.5);
    col = mix(green, uInk, 0.35 * smoothstep(0.65, 0.93, d)) + vec3(0.05, 0.07, 0.04) * vein + vec3(0.08, 0.1, 0.06) * smoothstep(0.12, 0.0, d);
  } else if (kind < 1.5) {
    // A flower on its stem: a cup of petals, pink at the tips, pale at the heart.
    float stem = smoothstep(0.035, 0.015, abs(q.x)) * step(q.y, -0.05);
    vec2 f = vec2(q.x, q.y - 0.22);
    float petals = 0.0;
    float tip = 0.0;
    for (int i = 0; i < 5; i++) {
      float ang = radians(-60.0 + 30.0 * float(i));
      vec2 b = f - vec2(0.0, -0.12);
      float u = b.x * sin(ang) + b.y * cos(ang);
      float v = b.x * cos(ang) - b.y * sin(ang);
      float L = 0.42 - 0.06 * abs(float(i) - 2.0);
      float w = 0.13 * sin(3.1416 * clamp(u / L, 0.0, 1.0));
      float p = smoothstep(0.015, -0.015, abs(v) - w) * step(0.0, u) * step(u, L);
      petals = max(petals, p);
      tip = max(tip, p * smoothstep(0.3, 1.0, u / L));
    }
    vec3 pink = mix(vec3(0.98, 0.9, 0.9), vec3(0.93, 0.5, 0.62), tip);
    col = mix(vec3(0.18, 0.3, 0.2) * stem, pink, petals);
    a = max(petals, stem * 0.9);
  } else {
    // A bud: a pointed drop, pink above, green at its base, on its stem.
    float stem = smoothstep(0.035, 0.015, abs(q.x)) * step(q.y, -0.1);
    vec2 b = vec2(q.x / 0.17, (q.y - 0.12) / 0.32);
    float drop = smoothstep(1.0, 0.9, length(vec2(b.x / max(1.0 - max(b.y, 0.0) * 0.85, 0.05), b.y)));
    vec3 c = mix(vec3(0.3, 0.42, 0.28), vec3(0.95, 0.55, 0.66), smoothstep(-0.6, 0.4, b.y));
    col = mix(vec3(0.18, 0.3, 0.2) * stem, c, drop);
    a = max(drop, stem * 0.9);
  }
  a *= vItem.w;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col * a, a);
}
`;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** The pond's layout, the same every time: pads in two clusters, flowers and buds among them. */
export function lotusLayout(seed = 11): Item[] {
  const r = rng(seed);
  const items: Item[] = [];
  for (let i = 0; i < PADS; i++) {
    const left = i % 2 === 0;
    // Thicker near the viewer, thinning out toward the far shore.
    const d = Math.pow(r(), 1.4) * 0.85;
    // Nearer, the clusters keep to the sides; further off they may reach in.
    const reach = 0.28 + 0.12 * d;
    const u = left ? -0.02 + r() * reach : 1.02 - r() * reach;
    items.push({ kind: 0, u, d, size: 0.11 + r() * 0.06, angle: r() * Math.PI * 2, delay: r() * 0.5, phase: r() * 6.28, bob: 0 });
  }
  for (let i = 0; i < FLOWERS + BUDS; i++) {
    // On the nearer pads, where they can be seen.
    const near = items.filter((it) => it.d > 0.06 && it.d < 0.45);
    const pad = near[(i * 3 + 1) % near.length];
    items.push({ kind: i < FLOWERS ? 1 : 2, u: pad.u + (r() - 0.5) * 0.04, d: pad.d + 0.01, size: i < FLOWERS ? 0.27 + r() * 0.06 : 0.18 + r() * 0.04, angle: 0, delay: 0.45 + r() * 0.4, phase: r() * 6.28, bob: 0 });
  }
  return items;
}

export class Lotus {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(MAX * 3);
  private readonly attr = new Float32Array(MAX * 4);
  private readonly items = lotusLayout();
  /** How far the pond has grown in, 0..1. */
  private presence = 0;
  private view = { width: 1, horizonY: 1, S: 1 };

  constructor(ink: THREE.Vector3) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aItem', new THREE.BufferAttribute(this.attr, 4));
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uPR: { value: 1 }, uInk: { value: ink } },
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2.55; // over the fish: they pass under the pads
    this.points.visible = false;
  }

  setPixelRatio(pr: number): void {
    this.material.uniforms.uPR.value = pr;
  }

  /** Where an item stands on screen and how large it is drawn. */
  private place(it: Item): { x: number; y: number; size: number } {
    const { width, horizonY, S } = this.view;
    // d 0 is the near edge of the screen, 1 the far shore.
    const y = horizonY * (0.15 + it.d * 0.78);
    const near = 1 - y / horizonY;
    const size = it.size * S * (0.35 + 0.65 * near) * (it.kind === 0 ? 1.6 : 1);
    return { x: it.u * width, y, size };
  }

  /** A touch at (x, y): the pad or flower there bobs. True if one was touched. */
  touch(x: number, y: number): boolean {
    if (this.presence < 0.5) return false;
    let hit: Item | null = null;
    let best = Infinity;
    for (const it of this.items) {
      const p = this.place(it);
      const d = Math.hypot((x - p.x) / (p.size * 0.5), (y - p.y) / (p.size * (it.kind === 0 ? 0.22 : 0.5)));
      if (d < 1 && d < best) {
        best = d;
        hit = it;
      }
    }
    if (!hit) return false;
    hit.bob = 1.2;
    return true;
  }

  update(dt: number, time: number, amount: number, wind: number, view: { width: number; horizonY: number; S: number }, calm: boolean): void {
    this.view = view;
    this.presence += ((amount > 0.4 ? 1 : 0) - this.presence) * Math.min(dt / (amount > 0.4 ? 3 : 1.5), 1);
    this.points.visible = this.presence > 0.002;
    if (!this.points.visible) return;
    this.items.forEach((it, i) => {
      const grow = Math.min(Math.max((this.presence - it.delay * 0.6) / 0.4, 0), 1);
      const g = grow * grow * (3 - 2 * grow);
      const p = this.place(it);
      it.bob = Math.max(it.bob - dt, 0);
      const sway = calm ? 0 : Math.sin(time * (0.7 + 0.3 * wind) + it.phase) * (0.004 + 0.01 * wind) * view.S;
      const bob = Math.sin(it.bob * 14) * it.bob * view.S * 0.01;
      // Flowers stand above their pad: their sprite's foot is at the water.
      const lift = it.kind === 0 ? 0 : p.size * 0.42;
      this.pos.set([p.x + sway * (it.kind === 0 ? 0.3 : 1), p.y + lift - bob, 0], i * 3);
      this.attr.set([it.kind, p.size * (0.4 + 0.6 * g), it.angle, g], i * 4);
    });
    this.geometry.attributes.position.needsUpdate = true;
    (this.geometry.attributes.aItem as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
