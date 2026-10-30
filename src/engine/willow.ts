import * as THREE from 'three';

// 春风拂柳 (?shore=willow), after Codex's art direction
// (art-incoming/shore-v2/ART-DIRECTION.md and its two target pictures on
// the collab branch) and the owner's word: the willow stands outside the
// picture, never a lone branch; only its strands come in from the upper
// right, in groups that share a gentle arc, near ones darker with whole
// leaves, middle ones finer, far ones a few pale lines sinking into the
// sky. Most tips stop before the far hills; two or three long ones reach
// past the far shore toward the water. The lake's middle stays open.
// A breath of wind takes six to ten seconds to pass; the tips follow half
// a beat late. A stroke on the bank lets one or two new strands come in on
// that side, with the stroke's own curve.

const SEGS = 20;
const MAX_STRANDS = 120;
const MAX_LEAVES = MAX_STRANDS * SEGS * 2;
const MAX_FLUFF = 6;

interface Strand {
  ax: number;
  ay: number;
  len: number;
  /** Lean at the root (radians from straight down; negative leans left): the group's arc. */
  a0: number;
  phase: number;
  give: number;
  /** 0 far, 1 near. */
  depth: number;
  spray: number;
  /** One of the two or three long ones that reach toward the water. */
  long?: boolean;
  /** One random per joint: leaf rhythm, size and turn. */
  leaf: number[];
}

const ribbonVert = /* glsl */ `
attribute vec2 aTD; // along 0..1, depth 0..1
varying vec2 vTD;
void main() {
  vTD = aTD;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ribbonFrag = /* glsl */ `
precision mediump float;
uniform vec3 uLight;
uniform vec3 uAir;
uniform float uNight;
varying vec2 vTD;
void main() {
  vec3 col = mix(vec3(0.2, 0.25, 0.17), vec3(0.42, 0.5, 0.3), vTD.x);
  col = mix(uAir, col, 0.25 + 0.75 * vTD.y) * uLight;
  // The near layer by moonlight: blue-ink outlines (Codex's v3 review).
  col *= mix(1.0, 0.6, uNight * step(0.8, vTD.y));
  // Bare stretches of strand read as parallel lines: kept fainter (v3 review).
  float a = (0.18 + 0.5 * vTD.y) * (1.0 - 0.35 * vTD.x) * 0.65;
  gl_FragColor = vec4(col * a, a);
}
`;

const leafVert = /* glsl */ `
attribute vec4 aLeaf; // size (px), angle, tint, depth
uniform float uPR;
varying vec4 vLeaf;
void main() {
  vLeaf = aLeaf;
  gl_PointSize = aLeaf.x * uPR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const leafFrag = /* glsl */ `
precision mediump float;
uniform vec3 uLight;
uniform vec3 uAir;
uniform sampler2D uTex;
uniform float uTexOn;
uniform float uNight;
varying vec4 vLeaf;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float c = cos(vLeaf.y), s = sin(vLeaf.y);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vec3 col;
  float a;
  if (uTexOn > 0.5) {
    // Codex's leaf, upright with its stalk at the bottom: turned so it hangs from the strand.
    vec4 t = texture2D(uTex, q * 0.5 + 0.5);
    // Near leaves keep a deeper green; farther ones lift toward the air below.
    col = t.rgb * mix(0.9, 0.68, vLeaf.w);
    a = t.a;
  } else {
    // A long narrow leaf, swelling a little to one side, the tip following the curve.
    float w = 0.15 * pow(max(1.0 - q.y * q.y, 0.0), 0.85) * (1.0 + 0.25 * q.y);
    a = smoothstep(w + 0.04, w - 0.03, abs(q.x - 0.05 * q.y * q.y)) * step(abs(q.y), 1.0);
    col = mix(vec3(0.24, 0.33, 0.2), vec3(0.55, 0.64, 0.34), vLeaf.z * vLeaf.z);
  }
  // Far leaves sink into the air; near ones keep their ink.
  col = mix(uAir, col, 0.25 + 0.75 * vLeaf.w) * uLight;
  // The nearest leaves carry the weight: deeper by day, blue-ink by moonlight; the rest keep the air (v3 review).
  float near = step(0.8, vLeaf.w);
  col *= mix(1.0, mix(0.82, 0.6, uNight), near);
  a *= 0.4 + 0.6 * vLeaf.w;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * a, a);
}
`;

const fluffVert = /* glsl */ `
attribute vec2 aAK; // alpha, kind (0 catkin, 1 firefly)
uniform float uPR;
uniform float uSize;
varying vec2 vAK;
void main() {
  vAK = aAK;
  gl_PointSize = uSize * uPR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fluffFrag = /* glsl */ `
precision mediump float;
uniform vec3 uLight;
varying vec2 vAK;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (exp(-r * r * 5.0) * 0.7 + exp(-r * r * 30.0) * 0.3) * vAK.x;
  if (a < 0.004) discard;
  vec3 col = vAK.y > 0.5 ? vec3(0.85, 1.0, 0.55) : vec3(0.97, 0.96, 0.9) * uLight;
  gl_FragColor = vec4(col * a, a);
}
`;

function rng(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

interface Group {
  /** Where along the top its roots come in, as a share of the width, and how many strands. */
  x: number;
  n: number;
  depth: [number, number];
  len: [number, number];
  a0: number;
}

/** The composition, right to left: near groups by the edge, middle ones opening out, far ones behind. */
const GROUPS: Group[] = [
  { x: 1.04, n: 5, depth: [0.85, 1], len: [0.75, 1.15], a0: -0.62 },
  { x: 0.92, n: 4, depth: [0.8, 0.95], len: [0.6, 0.95], a0: -0.55 },
  { x: 0.8, n: 4, depth: [0.7, 0.88], len: [0.45, 0.8], a0: -0.5 },
  { x: 0.98, n: 4, depth: [0.45, 0.65], len: [0.55, 0.9], a0: -0.5 },
  { x: 0.7, n: 3, depth: [0.45, 0.62], len: [0.4, 0.7], a0: -0.42 },
  { x: 0.6, n: 3, depth: [0.35, 0.5], len: [0.3, 0.55], a0: -0.35 },
  { x: 0.88, n: 3, depth: [0.12, 0.28], len: [0.45, 0.75], a0: -0.45 },
  { x: 0.66, n: 3, depth: [0.08, 0.22], len: [0.3, 0.55], a0: -0.38 },
  { x: 0.5, n: 2, depth: [0.05, 0.15], len: [0.2, 0.4], a0: -0.3 },
];

export class Willow {
  readonly group = new THREE.Group();
  private readonly ribbonGeo = new THREE.BufferGeometry();
  private readonly ribbonPos = new Float32Array(MAX_STRANDS * (SEGS + 1) * 2 * 3);
  private readonly ribbonTD = new Float32Array(MAX_STRANDS * (SEGS + 1) * 2 * 2);
  private readonly ribbonMat: THREE.ShaderMaterial;
  private readonly leafGeo = new THREE.BufferGeometry();
  private readonly leafPos = new Float32Array(MAX_LEAVES * 3);
  private readonly leafAttr = new Float32Array(MAX_LEAVES * 4);
  private readonly leafMat: THREE.ShaderMaterial;
  private readonly fluffGeo = new THREE.BufferGeometry();
  private readonly fluffPos = new Float32Array(MAX_FLUFF * 3);
  private readonly fluffAK = new Float32Array(MAX_FLUFF * 2);
  private readonly fluffMat: THREE.ShaderMaterial;
  private strands: Strand[] = [];
  private sprays: { id: number; strands: Strand[] }[] = [];
  private fluff: { x: number; y: number; vx: number; vy: number; age: number; life: number }[] = [];
  private nextId = 1;
  private readonly light = new THREE.Vector3(1, 1, 1);
  private readonly air = new THREE.Vector3(0.7, 0.75, 0.78);
  private view = { width: 1, height: 1, horizonY: 1, S: 1 };
  private seeded = false;
  private readonly lastDip = new WeakMap<Strand, number>();

  constructor() {
    this.ribbonGeo.setAttribute('position', new THREE.BufferAttribute(this.ribbonPos, 3));
    this.ribbonGeo.setAttribute('aTD', new THREE.BufferAttribute(this.ribbonTD, 2));
    const index: number[] = [];
    for (let s = 0; s < MAX_STRANDS; s++) {
      const base = s * (SEGS + 1) * 2;
      for (let i = 0; i < SEGS; i++) {
        const a = base + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.ribbonGeo.setIndex(index);
    const blend = { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthTest: false, depthWrite: false } as const;
    const shared = { uLight: { value: this.light }, uAir: { value: this.air }, uNight: { value: 0 } };
    this.ribbonMat = new THREE.ShaderMaterial({ vertexShader: ribbonVert, fragmentShader: ribbonFrag, uniforms: shared, side: THREE.DoubleSide, ...blend });
    const ribbons = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    ribbons.frustumCulled = false;
    ribbons.renderOrder = 3.05; // the nearest thing in the picture, in front of all but the brush
    this.leafGeo.setAttribute('position', new THREE.BufferAttribute(this.leafPos, 3));
    this.leafGeo.setAttribute('aLeaf', new THREE.BufferAttribute(this.leafAttr, 4));
    this.leafMat = new THREE.ShaderMaterial({
      vertexShader: leafVert,
      fragmentShader: leafFrag,
      uniforms: { ...shared, uPR: { value: 1 }, uTex: { value: null as THREE.Texture | null }, uTexOn: { value: 0 } },
      ...blend,
    });
    const leaves = new THREE.Points(this.leafGeo, this.leafMat);
    leaves.frustumCulled = false;
    leaves.renderOrder = 3.06;
    this.fluffGeo.setAttribute('position', new THREE.BufferAttribute(this.fluffPos, 3));
    this.fluffGeo.setAttribute('aAK', new THREE.BufferAttribute(this.fluffAK, 2));
    this.fluffMat = new THREE.ShaderMaterial({ vertexShader: fluffVert, fragmentShader: fluffFrag, uniforms: { uLight: { value: this.light }, uPR: { value: 1 }, uSize: { value: 8 } }, ...blend });
    const fluff = new THREE.Points(this.fluffGeo, this.fluffMat);
    fluff.frustumCulled = false;
    fluff.renderOrder = 3.07;
    this.group.add(ribbons, leaves, fluff);
  }

  setPixelRatio(pr: number): void {
    this.leafMat.uniforms.uPR.value = pr;
    this.fluffMat.uniforms.uPR.value = pr;
  }

  setLeafTexture(tex: THREE.Texture): void {
    this.leafMat.uniforms.uTex.value = tex;
    this.leafMat.uniforms.uTexOn.value = 1;
  }

  /** The air's colour (the sky low down), for far strands to fade into. */
  setAir(c: THREE.Vector3): void {
    this.air.copy(c);
  }

  resize(width: number, height: number, horizonY: number, S: number): void {
    const sx = width / this.view.width;
    const sy = height / this.view.height;
    if (this.seeded && (sx !== 1 || sy !== 1)) {
      for (const s of [...this.strands, ...this.sprays.flatMap((p) => p.strands)]) {
        s.ax *= sx;
        s.ay = height + (s.ay - this.view.height) * sy;
      }
    }
    this.view = { width, height, horizonY, S };
    this.fluffMat.uniforms.uSize.value = S * 0.018;
    if (!this.seeded && width > 1) {
      this.seeded = true;
      this.strands = this.compose(rng(11));
    }
  }

  private makeStrand(x: number, depth: number, len: number, a0: number, phase: number, random: () => number, spray = 0): Strand {
    const { height, S } = this.view;
    return {
      ax: x,
      // Rooted well above the top edge, so what comes in is already curving down.
      ay: height + S * (0.08 + 0.12 * random()),
      len,
      a0,
      phase,
      give: 0.85 + 0.3 * random(),
      depth,
      spray,
      leaf: Array.from({ length: SEGS }, () => random()),
    };
  }

  /** Groups sharing an arc, strands of different lengths within each, gaps between them. */
  private compose(random: () => number): Strand[] {
    const { width, horizonY, height, S } = this.view;
    const out: Strand[] = [];
    let long = 0;
    for (const g of GROUPS) {
      const phase = random() * 6.28;
      for (let i = 0; i < g.n; i++) {
        const depth = g.depth[0] + (g.depth[1] - g.depth[0]) * random();
        let len = S * (g.len[0] + (g.len[1] - g.len[0]) * random());
        // Near strands gather a little closer within their group (v3 review: spacing about 0.75).
        let x = width * g.x + (random() - 0.5) * S * 0.05 * (depth > 0.8 ? 0.75 : 1);
        let a0 = g.a0 + (random() - 0.5) * 0.08;
        let isLong = false;
        // Two or three of the nearest reach past the far shore toward the water, kept to the right
        // (tips at about 0.89-0.95 of the width), one of them a little longer still (v3 review).
        if (depth > 0.8 && long < 3 && random() < 0.45) {
          len = height - horizonY + S * (0.12 + 0.12 * random()) + (long === 0 ? height * 0.05 : 0);
          x += width * 0.08;
          a0 *= 0.45;
          isLong = true;
          long++;
        }
        const st = this.makeStrand(x, depth, len, a0, phase + i * 0.25, random);
        st.long = isLong;
        out.push(st);
      }
    }
    return out.sort((a, b) => a.depth - b.depth);
  }

  /**
   * A stroke on the bank: one or two new strands come in on that side,
   * leaning the way the stroke curved.
   */
  addSpray(x: number, lean: number, seed: number): number {
    const { width, S } = this.view;
    const id = this.nextId++;
    const random = rng(seed);
    const right = x > width / 2;
    const edge = right ? width * (0.9 + 0.12 * random()) : width * (-0.02 + 0.1 * random());
    const strands: Strand[] = [];
    const n = 2 + Math.floor(random() * 2);
    for (let i = 0; i < n; i++) {
      const a0 = (right ? -1 : 1) * (0.2 + 0.25 * Math.min(Math.abs(lean), 1)) + (random() - 0.5) * 0.08;
      strands.push(this.makeStrand(edge + (random() - 0.5) * S * 0.05, 0.75 + 0.25 * random(), S * (0.45 + 0.4 * random()), a0, random() * 6.28, random, id));
    }
    this.sprays.push({ id, strands });
    return id;
  }

  removeSpray(id: number): void {
    this.sprays = this.sprays.filter((s) => s.id !== id);
  }

  clear(): void {
    this.sprays = [];
  }

  update(time: number, dt: number, wind: number, light: { day: number; dusk: number }, calm: boolean, dip: (x: number, y: number) => void): void {
    const { width, height, horizonY, S } = this.view;
    const night = Math.max(1 - light.day - light.dusk, 0);
    this.ribbonMat.uniforms.uNight.value = night;
    this.leafMat.uniforms.uNight.value = night;
    this.light.set(0.45 + 0.55 * (1 - night), 0.48 + 0.52 * (1 - night), 0.62 + 0.38 * (1 - night)).lerp(new THREE.Vector3(1.05, 0.9, 0.76), light.dusk * 0.6);
    const all = [...this.strands, ...this.sprays.flatMap((s) => s.strands)].slice(0, MAX_STRANDS).sort((a, b) => a.depth - b.depth);
    let leafN = 0;
    // 春风拂柳: a breath that takes six to ten seconds to pass, then a quieter pause.
    const breath = calm ? 0.25 : 0.55 + 0.45 * Math.sin(time * 0.31) * Math.sin(time * 0.11 + 0.7);
    all.forEach((s, si) => {
      const seg = s.len / SEGS;
      // Near tips move a few pixels, middle ones less, far ones barely change their pose.
      const sway = (0.035 + 0.06 * s.depth) * (0.6 + 0.8 * Math.abs(wind)) * breath;
      const lean = wind * 0.12 * (0.5 + 0.5 * s.depth);
      let x = s.ax;
      let y = s.ay;
      const xs = [x];
      const ys = [y];
      for (let k = 1; k <= SEGS; k++) {
        const u = k / SEGS;
        // The group's arc at the root, easing to hang straight; the wind from the middle to the tip, half a beat late.
        const a =
          s.a0 * Math.pow(1 - u, 1.6) +
          (Math.sin(time * 0.78 * s.give + s.phase - u * 1.8) * sway + Math.sin(time * 1.9 + s.phase * 1.7 - u * 2.6) * sway * 0.25 + lean) * Math.pow(u, 1.4);
        x += Math.sin(a) * seg;
        y -= Math.cos(a) * seg;
        xs.push(x);
        ys.push(y);
      }
      const width0 = Math.max(S * (0.001 + 0.0024 * s.depth), 0.6);
      for (let k = 0; k <= SEGS; k++) {
        const k0 = Math.max(k - 1, 0);
        const k1 = Math.min(k + 1, SEGS);
        let nx = -(ys[k1] - ys[k0]);
        let ny = xs[k1] - xs[k0];
        const d = Math.hypot(nx, ny) || 1;
        nx /= d;
        ny /= d;
        const w = width0 * (1 - 0.6 * (k / SEGS)) * 0.5;
        const o = (si * (SEGS + 1) + k) * 2;
        this.ribbonPos.set([xs[k] + nx * w, ys[k] + ny * w, 0, xs[k] - nx * w, ys[k] - ny * w, 0], o * 3);
        this.ribbonTD.set([k / SEGS, s.depth, k / SEGS, s.depth], o * 2);
      }
      // Leaves in a rhythm: two or three close together, then a stretch of bare strand; far strands fewer.
      // Each hangs along the strand, tip down, turned a little to one side or the other in turn.
      const keep = 0.45 + 0.5 * s.depth;
      for (let k = 2; k <= SEGS && leafN < MAX_LEAVES - 1; k++) {
        const r = s.leaf[k - 1];
        const cluster = Math.sin(k * 1.1 + s.phase * 3.0) > -0.35;
        if (!cluster || r > keep) continue;
        const dx = xs[k] - xs[k - 1];
        const dy = ys[k] - ys[k - 1];
        const dir = Math.atan2(dx, -dy);
        const u = k / SEGS;
        // A long strand's last quarter keeps only a few small leaves, so the hills and the waterline show through.
        if (s.long && u > 0.75 && r > keep * 0.62) continue;
        let size = S * (0.032 + 0.068 * s.depth) * (0.8 + 0.4 * r) * (1 - 0.25 * u);
        // The nearest leaves in the top quarter, a little larger: the weight sits up on the right.
        if (s.depth >= 0.8 && ys[k] > height * 0.75) size *= 1.15;
        const side = k % 2 ? 1 : -1;
        const turn = side * (0.12 + 0.22 * r);
        // The leaf's middle sits a little below its stalk, along its own lean.
        const lx = xs[k] + Math.sin(dir + turn) * size * 0.32;
        const ly = ys[k] - Math.cos(dir + turn) * size * 0.32;
        this.leafPos.set([lx, ly, 0], leafN * 3);
        this.leafAttr.set([size, -(dir + turn) + Math.PI, r, s.depth], leafN * 4);
        leafN++;
      }
      // A long tip near the water dips now and then: a small ring, and a while before it dips again.
      const tx = xs[SEGS];
      const ty = ys[SEGS];
      if (!calm && ty < horizonY - S * 0.02 && time - (this.lastDip.get(s) ?? -99) > 9 && Math.sin(time * 0.78 * s.give + s.phase - 1.8) > 0.97) {
        this.lastDip.set(s, time);
        dip(tx, ty);
      }
    });
    this.ribbonGeo.setDrawRange(0, all.length * SEGS * 6);
    this.leafGeo.setDrawRange(0, leafN);
    this.ribbonGeo.attributes.position.needsUpdate = true;
    this.ribbonGeo.attributes.aTD.needsUpdate = true;
    this.leafGeo.attributes.position.needsUpdate = true;
    (this.leafGeo.attributes.aLeaf as THREE.BufferAttribute).needsUpdate = true;

    // 柳絮 by day, rarely three at once; at night one or two fireflies low by the wet grass at the corners.
    let n = 0;
    if (night < 0.5) {
      if (!calm && this.fluff.length < 3 && Math.random() < dt * 0.25) {
        this.fluff.push({ x: width * (0.7 + 0.3 * Math.random()), y: height * (0.6 + 0.35 * Math.random()), vx: -S * (0.02 + 0.03 * Math.random()), vy: -S * 0.006, age: 0, life: 12 + Math.random() * 8 });
      }
      this.fluff = this.fluff.filter((f) => f.age < f.life && f.x > -S * 0.1);
      for (const [i, f] of this.fluff.entries()) {
        f.age += dt;
        f.x += (f.vx + wind * S * 0.03) * dt + Math.sin(time * 1.1 + i) * S * 0.006 * dt;
        f.y += f.vy * dt + Math.sin(time * 0.7 + i * 2.1) * S * 0.01 * dt;
        this.fluffPos.set([f.x, f.y, 0], n * 3);
        this.fluffAK.set([Math.min(f.age / 2, 1) * Math.min((f.life - f.age) / 3, 1) * 0.8, 0], n * 2);
        n++;
      }
    } else {
      this.fluff = [];
      for (let i = 0; i < 2; i++) {
        const cx = i === 0 ? width * 0.08 : width * 0.9;
        this.fluffPos.set([cx + Math.sin(time * 0.37 + i * 2) * S * 0.04, S * (0.2 + 0.03 * Math.sin(time * 0.29 + i * 3)), 0], n * 3);
        this.fluffAK.set([night * (0.3 + 0.7 * Math.max(Math.sin(time * 1.3 + i * 2.4), 0)), 1], n * 2);
        n++;
      }
    }
    this.fluffGeo.setDrawRange(0, n);
    this.fluffGeo.attributes.position.needsUpdate = true;
    (this.fluffGeo.attributes.aAK as THREE.BufferAttribute).needsUpdate = true;
    this.group.visible = all.length > 0;
  }

  dispose(): void {
    this.ribbonGeo.dispose();
    this.ribbonMat.dispose();
    this.leafGeo.dispose();
    this.leafMat.dispose();
    this.fluffGeo.dispose();
    this.fluffMat.dispose();
  }
}
