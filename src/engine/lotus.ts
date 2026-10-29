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
/** Leaves standing up out of the water: only with the photographed lotus. */
const STANDING = 4;
const MAX = PADS + FLOWERS + BUDS + STANDING;

interface Item {
  kind: 0 | 1 | 2 | 3; // pad, flower, bud, standing leaf
  /** Which picture in the photographed atlas (3 across, 2 down). */
  cell: number;
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
attribute float aCell;
uniform float uPR;
varying vec4 vItem;
varying float vCell;
void main() {
  vItem = aItem;
  vCell = aCell;
  gl_PointSize = aItem.w > 0.002 ? aItem.y * uPR : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision mediump float;
uniform vec3 uInk;
uniform sampler2D uTex;
uniform float uTexOn;
uniform vec3 uLight;
varying vec4 vItem;
varying float vCell;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float kind = vItem.x;
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (uTexOn > 0.5) {
    // The photographed lotus. A flat leaf is seen from above, turned, then
    // squashed into the lake's perspective; the standing ones are drawn upright.
    vec2 uv = gl_PointCoord;
    if (kind < 0.5) {
      vec2 f = vec2(q.x, q.y / 0.42);
      if (abs(f.y) > 1.0) discard;
      float c = cos(vItem.z), s = sin(vItem.z);
      f = vec2(c * f.x - s * f.y, s * f.x + c * f.y);
      // The leaf is round: keep inside its circle, and a hair inside the
      // cell so the neighbouring picture never bleeds in at the edge.
      if (dot(f, f) > 1.0) discard;
      uv = vec2(f.x, -f.y) * 0.485 + 0.5;
    } else {
      uv.x = clamp(uv.x, 0.006, 0.994);
    }
    float col3 = mod(vCell, 3.0);
    float row = floor(vCell / 3.0);
    vec4 t = texture2D(uTex, vec2((col3 + uv.x) / 3.0, 1.0 - (row + uv.y) / 2.0));
    a = t.a * vItem.w;
    if (a < 0.004) discard;
    // A flat leaf sits in the water: its rim a little darker, as if wet and shaded.
    float rimShade = kind < 0.5 ? 1.0 - 0.22 * smoothstep(0.55, 1.0, length(vec2(q.x, q.y / 0.42))) : 1.0;
    gl_FragColor = vec4(t.rgb * uLight * rimShade * a, a);
    return;
  }
  if (kind > 2.5) discard;
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
    items.push({ kind: 0, cell: i % 2, u, d, size: 0.11 + r() * 0.06, angle: r() * Math.PI * 2, delay: r() * 0.5, phase: r() * 6.28, bob: 0 });
  }
  for (let i = 0; i < FLOWERS + BUDS; i++) {
    // On the nearer pads, where they can be seen.
    const near = items.filter((it) => it.d > 0.06 && it.d < 0.45);
    const pad = near[(i * 3 + 1) % near.length];
    items.push({ kind: i < FLOWERS ? 1 : 2, cell: i < FLOWERS ? 3 + (i % 2) : 5, u: pad.u + (r() - 0.5) * 0.04, d: pad.d + 0.01, size: i < FLOWERS ? 0.2 + r() * 0.04 : 0.14 + r() * 0.03, angle: 0, delay: 0.45 + r() * 0.4, phase: r() * 6.28, bob: 0 });
  }
  for (let i = 0; i < STANDING; i++) {
    const pad = items[(i * 7 + 2) % PADS];
    items.push({ kind: 3, cell: 2, u: pad.u + (r() - 0.5) * 0.05, d: pad.d + 0.015, size: 0.19 + r() * 0.05, angle: 0, delay: 0.3 + r() * 0.4, phase: r() * 6.28, bob: 0 });
  }
  return items;
}

export class Lotus {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(MAX * 3);
  private readonly attr = new Float32Array(MAX * 4);
  private readonly cells = new Float32Array(MAX);
  private readonly items = lotusLayout();
  /** How far the pond has grown in, 0..1. */
  private presence = 0;
  private view = { width: 1, horizonY: 1, S: 1 };

  constructor(ink: THREE.Vector3) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aItem', new THREE.BufferAttribute(this.attr, 4));
    this.geometry.setAttribute('aCell', new THREE.BufferAttribute(this.cells, 1));
    this.items.forEach((it, i) => (this.cells[i] = it.cell));
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uPR: { value: 1 }, uInk: { value: ink }, uTex: { value: null as THREE.Texture | null }, uTexOn: { value: 0 }, uLight: { value: new THREE.Vector3(1, 1, 1) } },
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

  /** The photographed lotus atlas (scripts/gen-art.mjs), in place of the painted ones. */
  setTexture(tex: THREE.Texture): void {
    this.material.uniforms.uTex.value = tex;
    this.material.uniforms.uTexOn.value = 1;
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

  /** 叶下: whether (x, y) on the lake lies under a flat leaf, in its shade. */
  shadeAt(x: number, y: number): boolean {
    if (this.presence < 0.6) return false;
    for (const it of this.items) {
      if (it.kind !== 0) continue;
      const p = this.place(it);
      if (Math.hypot((x - p.x) / (p.size * 0.5), (y - p.y) / (p.size * 0.21)) < 1) return true;
    }
    return false;
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

  update(dt: number, time: number, amount: number, wind: number, view: { width: number; horizonY: number; S: number }, calm: boolean, day = 1, dusk = 0): void {
    this.view = view;
    // The photographs are lit by day; at night they sink into the dark blue;
    // in the evening the sunset warms them (Codex's review of #91: the lotus read cold at dusk).
    const light = this.material.uniforms.uLight.value as THREE.Vector3;
    const lit = Math.max(day, dusk * 0.85);
    light.set(0.42 + 0.58 * lit, 0.46 + 0.54 * lit, 0.58 + 0.42 * lit);
    light.lerp(new THREE.Vector3(1.05, 0.86, 0.72), dusk * 0.6);
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
      const photo = this.material.uniforms.uTexOn.value > 0.5;
      const lift = it.kind === 0 ? 0 : p.size * (photo ? 0.5 : 0.42);
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
