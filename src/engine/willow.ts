import * as THREE from 'three';
import type { Stroke } from './stroke';

// 春风垂柳 (technical sketch for the shore's redesign, ?shore=willow; the
// look is Codex's to set, see docs/handoff/codex-shore-redesign.md on the
// collab branch): the visitor's stroke on the bank is a willow bough, and
// from it long strands hang toward the water, swaying in the spring wind
// one after another, each lined with narrow leaves, the longest dipping
// their tips in the water now and then.

const SEGS = 14;
const MAX_STRANDS = 300;
const MAX_LEAVES = MAX_STRANDS * SEGS;

interface Strand {
  ax: number;
  ay: number;
  /** Length, px. */
  len: number;
  phase: number;
  /** A little stiffer or looser than its neighbours. */
  give: number;
  tree: number;
  nextDip: number;
  /** Leaf size and lean, one per segment. */
  leaf: number[];
}

interface Tree {
  id: number;
  stroke: Stroke;
  strands: Strand[];
}

const ribbonVert = /* glsl */ `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ribbonFrag = /* glsl */ `
precision mediump float;
uniform vec3 uLight;
varying float vT;
void main() {
  // Ink green, fresher toward the tip, thinning out.
  vec3 col = mix(vec3(0.16, 0.22, 0.14), vec3(0.42, 0.55, 0.28), vT) * uLight;
  float a = 0.6 * (1.0 - 0.5 * vT);
  gl_FragColor = vec4(col * a, a);
}
`;

const leafVert = /* glsl */ `
attribute vec4 aLeaf; // size (px), angle, tint, alpha
uniform float uPR;
varying vec4 vLeaf;
void main() {
  vLeaf = aLeaf;
  gl_PointSize = aLeaf.w > 0.002 ? aLeaf.x * uPR : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const leafFrag = /* glsl */ `
precision mediump float;
uniform vec3 uLight;
varying vec4 vLeaf;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float c = cos(vLeaf.y), s = sin(vLeaf.y);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  // A willow leaf: long and narrow, pointed at both ends.
  float w = 0.2 * pow(max(1.0 - q.y * q.y, 0.0), 0.9);
  float a = smoothstep(w + 0.03, w - 0.03, abs(q.x)) * step(abs(q.y), 1.0) * vLeaf.w;
  if (a < 0.01) discard;
  // Spring willow: from deep ink-green to a fresh yellow-green.
  vec3 col = mix(vec3(0.22, 0.32, 0.17), vec3(0.62, 0.7, 0.32), vLeaf.z * vLeaf.z) * uLight;
  // Ink gathers at the edge.
  col *= 0.85 + 0.15 * smoothstep(w, 0.0, abs(q.x));
  gl_FragColor = vec4(col * a, a);
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
  private readonly ribbonT = new Float32Array(MAX_STRANDS * (SEGS + 1) * 2);
  private readonly ribbonMat: THREE.ShaderMaterial;
  private readonly leafGeo = new THREE.BufferGeometry();
  private readonly leafPos = new Float32Array(MAX_LEAVES * 3);
  private readonly leafAttr = new Float32Array(MAX_LEAVES * 4);
  private readonly leafMat: THREE.ShaderMaterial;
  private trees: Tree[] = [];
  private nextId = 1;
  private readonly light = new THREE.Vector3(1, 1, 1);

  constructor() {
    this.ribbonGeo.setAttribute('position', new THREE.BufferAttribute(this.ribbonPos, 3));
    this.ribbonGeo.setAttribute('aT', new THREE.BufferAttribute(this.ribbonT, 1));
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
    this.ribbonMat = new THREE.ShaderMaterial({ vertexShader: ribbonVert, fragmentShader: ribbonFrag, uniforms: { uLight: { value: this.light } }, side: THREE.DoubleSide, ...blend });
    const ribbons = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    ribbons.frustumCulled = false;
    ribbons.renderOrder = 3.05;
    this.leafGeo.setAttribute('position', new THREE.BufferAttribute(this.leafPos, 3));
    this.leafGeo.setAttribute('aLeaf', new THREE.BufferAttribute(this.leafAttr, 4));
    this.leafMat = new THREE.ShaderMaterial({ vertexShader: leafVert, fragmentShader: leafFrag, uniforms: { uLight: { value: this.light }, uPR: { value: 1 } }, ...blend });
    const leaves = new THREE.Points(this.leafGeo, this.leafMat);
    leaves.frustumCulled = false;
    leaves.renderOrder = 3.06;
    this.group.add(ribbons, leaves);
  }

  setPixelRatio(pr: number): void {
    this.leafMat.uniforms.uPR.value = pr;
  }

  /** The stroke becomes a bough; strands hang from its upper part, longer toward its outer end. */
  addTree(stroke: Stroke, S: number, seed: number, time: number): number {
    const random = rng(seed);
    const pts = stroke.points;
    const ordered = pts[0].y <= pts[pts.length - 1].y ? pts : [...pts].reverse();
    const total = Math.max(stroke.length, 1);
    const strands: Strand[] = [];
    const id = this.nextId++;
    let along = 0;
    let next = total * 0.12;
    // Places to hang from, spread evenly along the bough's outer part.
    const places = Math.max(8, Math.min(46, Math.round(total / (S * 0.014))));
    const gap = (total * 0.88) / places;
    // Walk the bough by arc length (a stroke's points can be far apart), hanging strands as we go.
    for (let i = 1; i < ordered.length && strands.length < 140; i++) {
      const p0 = ordered[i - 1];
      const p1 = ordered[i];
      const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      while (next <= along + d && strands.length < 140) {
        const f = d > 0 ? (next - along) / d : 0;
        const x = p0.x + (p1.x - p0.x) * f;
        const y = p0.y + (p1.y - p0.y) * f;
        const u = next / total;
        next += gap * (0.7 + 0.6 * random());
        // 万条垂下: a curtain of strands, several from each place, long toward the bough's outer end.
        for (let k = 0; k < 2 + Math.floor(random() * 2); k++) {
          strands.push({
            ax: x + (random() - 0.5) * S * 0.02,
            ay: y + (random() - 0.5) * S * 0.01,
            len: S * (0.12 + 0.42 * Math.pow(u, 0.7) * (0.5 + 0.5 * random())),
            phase: random() * 6.28,
            give: 0.75 + 0.5 * random(),
            tree: id,
            nextDip: time + 4 + random() * 8,
            leaf: Array.from({ length: SEGS }, () => random()),
          });
        }
      }
      along += d;
    }
    this.trees.push({ id, stroke, strands });
    return id;
  }

  removeTree(id: number): Stroke | null {
    const t = this.trees.find((x) => x.id === id);
    if (!t) return null;
    this.trees = this.trees.filter((x) => x !== t);
    return t.stroke;
  }

  clear(): Stroke[] {
    const s = this.trees.map((t) => t.stroke);
    this.trees = [];
    return s;
  }

  get empty(): boolean {
    return this.trees.length === 0;
  }

  /**
   * `wind` 0..1 (signed: a gust to the left is negative). `water(x, y)` says
   * whether a tip at (x, y) is over the water; `dip` makes the ring.
   */
  update(time: number, S: number, wind: number, light: { day: number; dusk: number }, calm: boolean, water: (x: number, y: number) => boolean, dip: (x: number, y: number) => void): void {
    const night = Math.max(1 - light.day - light.dusk, 0);
    this.light.set(0.45 + 0.55 * (1 - night), 0.48 + 0.52 * (1 - night), 0.6 + 0.4 * (1 - night)).lerp(new THREE.Vector3(1.05, 0.9, 0.76), light.dusk * 0.6);
    const strands = this.trees.flatMap((t) => t.strands).slice(0, MAX_STRANDS);
    const seg = (s: Strand) => s.len / SEGS;
    let leafN = 0;
    const width = Math.max(S * 0.0022, 0.9);
    strands.forEach((s, si) => {
      // The spring wind passes along the willow: each strand swings a moment after its neighbour, more toward the tip.
      const sway = calm ? 0.04 : 0.12 + 0.2 * Math.abs(wind);
      const lean = wind * 0.35;
      let x = s.ax;
      let y = s.ay;
      const xs = [x];
      const ys = [y];
      for (let k = 1; k <= SEGS; k++) {
        const u = k / SEGS;
        // A wave of wind travelling across the curtain, each strand a little its own.
        const a = (Math.sin(time * 0.7 - s.ax / (S * 0.25) - u * 1.4) * sway + Math.sin(time * 1.3 * s.give + s.phase) * sway * 0.35 + lean) * Math.pow(u, 1.3);
        x += Math.sin(a) * seg(s);
        y -= Math.cos(a) * seg(s);
        xs.push(x);
        ys.push(y);
      }
      // The ribbon: tapering from the bough to the tip.
      for (let k = 0; k <= SEGS; k++) {
        const k0 = Math.max(k - 1, 0);
        const k1 = Math.min(k + 1, SEGS);
        let nx = -(ys[k1] - ys[k0]);
        let ny = xs[k1] - xs[k0];
        const d = Math.hypot(nx, ny) || 1;
        nx /= d;
        ny /= d;
        const w = width * (1 - 0.6 * (k / SEGS)) * 0.5;
        const o = (si * (SEGS + 1) + k) * 2;
        this.ribbonPos.set([xs[k] + nx * w, ys[k] + ny * w, 0, xs[k] - nx * w, ys[k] - ny * w, 0], o * 3);
        this.ribbonT[o] = this.ribbonT[o + 1] = k / SEGS;
      }
      // Leaves along it, leaning either way, smaller toward the tip.
      for (let k = 1; k <= SEGS && leafN < MAX_LEAVES; k++) {
        const dir = Math.atan2(xs[k] - xs[k - 1], ys[k - 1] - ys[k]);
        const r = s.leaf[k - 1];
        this.leafPos.set([xs[k], ys[k], 0], leafN * 3);
        this.leafAttr.set([S * (0.014 + 0.008 * r) * (1 - 0.3 * (k / SEGS)), -dir + (k % 2 ? 0.5 : -0.5) + (r - 0.5) * 0.4, r, 0.75], leafN * 4);
        leafN++;
      }
      // The longest dip their tips in the water now and then.
      const tx = xs[SEGS];
      const ty = ys[SEGS];
      if (!calm && time >= s.nextDip) {
        s.nextDip = time + 6 + Math.random() * 10;
        if (s.len > S * 0.25 && water(tx, ty)) dip(tx, ty);
      }
    });
    // Hide what is not used.
    this.ribbonGeo.setDrawRange(0, strands.length * SEGS * 6);
    this.leafGeo.setDrawRange(0, leafN);
    this.ribbonGeo.attributes.position.needsUpdate = true;
    this.ribbonGeo.attributes.aT.needsUpdate = true;
    this.leafGeo.attributes.position.needsUpdate = true;
    (this.leafGeo.attributes.aLeaf as THREE.BufferAttribute).needsUpdate = true;
    this.group.visible = strands.length > 0;
  }

  dispose(): void {
    this.ribbonGeo.dispose();
    this.ribbonMat.dispose();
    this.leafGeo.dispose();
    this.leafMat.dispose();
  }
}
