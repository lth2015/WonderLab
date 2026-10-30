import * as THREE from 'three';

// 春风拂柳 (sketch for the shore's redesign, ?shore=willow; see
// docs/handoff/codex-shore-redesign.md on the collab branch). The owner:
// not the whole tree and never a lone branch, only the image and mood of
// willow in the spring wind. So the willow stands outside the picture, on
// the near bank; what we see is its strands hanging in from above, as if
// we stood under it by the water: near ones dark and full, far ones pale
// and fine, longer toward the side, the middle of the lake left open. The
// wind passes along them strand after strand, and a little catkin fluff
// drifts across. A stroke on the bank lets another spray hang down there.

const SEGS = 18;
const MAX_STRANDS = 220;
const MAX_LEAVES = MAX_STRANDS * SEGS;
const MAX_FLUFF = 18;

interface Strand {
  ax: number;
  /** Anchor above the top edge, so the strands come in from out of the picture. */
  ay: number;
  len: number;
  phase: number;
  give: number;
  /** 0 far (pale, fine, slow), 1 near (dark, full). */
  depth: number;
  spray: number;
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
varying vec2 vTD;
void main() {
  vec3 col = mix(vec3(0.17, 0.22, 0.14), vec3(0.38, 0.47, 0.26), vTD.x);
  // Far strands sink into the air's colour, like distance in ink painting.
  col = mix(uAir, col, 0.35 + 0.65 * vTD.y) * uLight;
  float a = (0.25 + 0.45 * vTD.y) * (1.0 - 0.4 * vTD.x);
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
varying vec4 vLeaf;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float c = cos(vLeaf.y), s = sin(vLeaf.y);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  // A willow leaf: long and narrow, a soft wash rather than a cut-out.
  float w = 0.17 * pow(max(1.0 - q.y * q.y, 0.0), 0.9);
  float a = smoothstep(w + 0.05, w - 0.04, abs(q.x)) * step(abs(q.y), 1.0);
  a *= 0.3 + 0.55 * vLeaf.w;
  if (a < 0.01) discard;
  vec3 col = mix(vec3(0.2, 0.29, 0.15), vec3(0.6, 0.68, 0.3), vLeaf.z * vLeaf.z);
  col = mix(uAir, col, 0.3 + 0.7 * vLeaf.w) * uLight;
  gl_FragColor = vec4(col * a, a);
}
`;

const fluffVert = /* glsl */ `
attribute float aA;
uniform float uPR;
uniform float uSize;
varying float vA;
void main() {
  vA = aA;
  gl_PointSize = uSize * uPR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fluffFrag = /* glsl */ `
precision mediump float;
uniform vec3 uLight;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (exp(-r * r * 5.0) * 0.7 + exp(-r * r * 30.0) * 0.3) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.97, 0.96, 0.9) * uLight * a, a);
}
`;

function rng(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

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
  private readonly fluffA = new Float32Array(MAX_FLUFF);
  private readonly fluffMat: THREE.ShaderMaterial;
  private strands: Strand[] = [];
  private sprays: { id: number; strands: Strand[] }[] = [];
  private fluff: { x: number; y: number; vx: number; vy: number; age: number; life: number }[] = [];
  private nextId = 1;
  private readonly light = new THREE.Vector3(1, 1, 1);
  private readonly air = new THREE.Vector3(0.7, 0.75, 0.78);
  private view = { width: 1, height: 1, S: 1 };
  private seeded = false;

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
    const shared = { uLight: { value: this.light }, uAir: { value: this.air } };
    this.ribbonMat = new THREE.ShaderMaterial({ vertexShader: ribbonVert, fragmentShader: ribbonFrag, uniforms: shared, side: THREE.DoubleSide, ...blend });
    const ribbons = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    ribbons.frustumCulled = false;
    ribbons.renderOrder = 3.05; // the nearest thing in the picture, in front of all but the brush
    this.leafGeo.setAttribute('position', new THREE.BufferAttribute(this.leafPos, 3));
    this.leafGeo.setAttribute('aLeaf', new THREE.BufferAttribute(this.leafAttr, 4));
    this.leafMat = new THREE.ShaderMaterial({ vertexShader: leafVert, fragmentShader: leafFrag, uniforms: { ...shared, uPR: { value: 1 } }, ...blend });
    const leaves = new THREE.Points(this.leafGeo, this.leafMat);
    leaves.frustumCulled = false;
    leaves.renderOrder = 3.06;
    this.fluffGeo.setAttribute('position', new THREE.BufferAttribute(this.fluffPos, 3));
    this.fluffGeo.setAttribute('aA', new THREE.BufferAttribute(this.fluffA, 1));
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

  /** The air's colour (the sky low down), for far strands to fade into. */
  setAir(c: THREE.Vector3): void {
    this.air.copy(c);
  }

  resize(width: number, height: number, S: number): void {
    const sx = width / this.view.width;
    const sy = height / this.view.height;
    if (this.seeded && (sx !== 1 || sy !== 1)) {
      for (const s of [...this.strands, ...this.sprays.flatMap((p) => p.strands)]) {
        s.ax *= sx;
        s.ay = height + (s.ay - this.view.height) * sy;
      }
    }
    this.view = { width, height, S };
    this.fluffMat.uniforms.uSize.value = S * 0.018;
    if (!this.seeded && width > 1) {
      this.seeded = true;
      this.strands = this.curtain(width * 0.62, width * 1.04, 1, rng(11));
    }
  }

  /**
   * Strands hanging in from above the frame between x0 and x1, thicker and
   * longer toward the side where the tree stands (`side` 1: right).
   */
  private curtain(x0: number, x1: number, side: number, random: () => number, count = 90): Strand[] {
    const { height, S } = this.view;
    const out: Strand[] = [];
    for (let i = 0; i < count; i++) {
      // More of them toward the tree's side, thinning toward the open middle.
      const u = Math.pow(random(), 0.6);
      const x = side > 0 ? x0 + (x1 - x0) * u : x1 - (x1 - x0) * u;
      const depth = random();
      out.push({
        ax: x + (random() - 0.5) * S * 0.04,
        ay: height + S * (0.02 + 0.08 * random()),
        // A few of the longest reach down past the far shore, toward the water.
        len: S * (0.35 + (random() < 0.12 ? 1.35 : 0.9) * u * (0.55 + 0.45 * random())) * (0.75 + 0.35 * depth),
        phase: random() * 6.28,
        give: 0.75 + 0.5 * random(),
        depth,
        spray: 0,
        leaf: Array.from({ length: SEGS }, () => random()),
      });
    }
    // Far ones first, so the near ones are drawn over them.
    return out.sort((a, b) => a.depth - b.depth);
  }

  /** A stroke on the bank: another spray of strands hangs down above it. */
  addSpray(x: number, seed: number): number {
    const { width, S } = this.view;
    const id = this.nextId++;
    const random = rng(seed);
    const side = x > width / 2 ? 1 : -1;
    const strands = this.curtain(x - S * 0.12, x + S * 0.12, side, random, 26);
    strands.forEach((s) => (s.spray = id));
    this.sprays.push({ id, strands });
    return id;
  }

  removeSpray(id: number): void {
    this.sprays = this.sprays.filter((s) => s.id !== id);
  }

  clear(): void {
    this.sprays = [];
  }

  update(time: number, dt: number, wind: number, light: { day: number; dusk: number }, calm: boolean): void {
    const { width, height, S } = this.view;
    const night = Math.max(1 - light.day - light.dusk, 0);
    this.light.set(0.45 + 0.55 * (1 - night), 0.48 + 0.52 * (1 - night), 0.6 + 0.4 * (1 - night)).lerp(new THREE.Vector3(1.05, 0.9, 0.76), light.dusk * 0.6);
    const all = [...this.strands, ...this.sprays.flatMap((s) => s.strands)].slice(0, MAX_STRANDS).sort((a, b) => a.depth - b.depth);
    let leafN = 0;
    all.forEach((s, si) => {
      const seg = s.len / SEGS;
      // 春风拂柳: a breath of wind runs across the willow, each strand lifting a
      // moment after its neighbour, the near ones swinging wider; the tips trail.
      const sway = calm ? 0.03 : (0.1 + 0.18 * Math.abs(wind)) * (0.6 + 0.5 * s.depth);
      const lean = wind * 0.22;
      const breath = 0.6 + 0.4 * Math.sin(time * 0.23 + 1.3);
      let x = s.ax;
      let y = s.ay;
      const xs = [x];
      const ys = [y];
      for (let k = 1; k <= SEGS; k++) {
        const u = k / SEGS;
        const a =
          (Math.sin(time * 0.75 - s.ax / (S * 0.3) - u * 1.6) * sway * breath + Math.sin(time * 1.4 * s.give + s.phase - u * 2.0) * sway * 0.3 + lean) *
          Math.pow(u, 1.5);
        x += Math.sin(a) * seg;
        y -= Math.cos(a) * seg;
        xs.push(x);
        ys.push(y);
      }
      const width0 = Math.max(S * (0.0012 + 0.0022 * s.depth), 0.7);
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
      for (let k = 2; k <= SEGS && leafN < MAX_LEAVES; k++) {
        const r = s.leaf[k - 1];
        // Not every joint has a leaf: the strands stay airy.
        if (r < 0.25) continue;
        const dir = Math.atan2(xs[k] - xs[k - 1], ys[k - 1] - ys[k]);
        this.leafPos.set([xs[k], ys[k], 0], leafN * 3);
        this.leafAttr.set([S * (0.012 + 0.016 * s.depth) * (0.8 + 0.4 * r), -dir + (k % 2 ? 0.45 : -0.45) + (r - 0.5) * 0.4, r, s.depth], leafN * 4);
        leafN++;
      }
    });
    this.ribbonGeo.setDrawRange(0, all.length * SEGS * 6);
    this.leafGeo.setDrawRange(0, leafN);
    this.ribbonGeo.attributes.position.needsUpdate = true;
    this.ribbonGeo.attributes.aTD.needsUpdate = true;
    this.leafGeo.attributes.position.needsUpdate = true;
    (this.leafGeo.attributes.aLeaf as THREE.BufferAttribute).needsUpdate = true;

    // 柳絮: a few wisps of catkin fluff drifting on the wind, by day.
    if (!calm && night < 0.5 && this.fluff.length < MAX_FLUFF && Math.random() < dt * 0.8) {
      this.fluff.push({ x: width * (0.55 + 0.45 * Math.random()), y: height * (0.55 + 0.4 * Math.random()), vx: -S * (0.02 + 0.03 * Math.random()), vy: -S * 0.006, age: 0, life: 10 + Math.random() * 8 });
    }
    this.fluff = this.fluff.filter((f) => f.age < f.life && f.x > -S * 0.1);
    this.fluff.forEach((f, i) => {
      f.age += dt;
      f.x += (f.vx + wind * S * 0.03) * dt + Math.sin(time * 1.1 + i) * S * 0.006 * dt;
      f.y += f.vy * dt + Math.sin(time * 0.7 + i * 2.1) * S * 0.01 * dt;
      this.fluffPos.set([f.x, f.y, 0], i * 3);
      this.fluffA[i] = Math.min(f.age / 2, 1) * Math.min((f.life - f.age) / 3, 1) * 0.8;
    });
    this.fluffGeo.setDrawRange(0, this.fluff.length);
    this.fluffGeo.attributes.position.needsUpdate = true;
    (this.fluffGeo.attributes.aA as THREE.BufferAttribute).needsUpdate = true;
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
