import * as THREE from 'three';
import type { Stroke } from './stroke';

// 近岸 (docs/02 §「世界往哪里长」, docs/世界观落地.md second batch; Codex's
// value/09 §十三): a sloping bank along the bottom of the picture, where the
// visitor stands. A stroke on the bank is a branch: the ink line itself is
// the bough, and begonia blossoms (垂丝海棠, chosen and painted by Codex)
// open along it from the base out. Now and then a petal falls onto the
// water and a fish comes to it; by day and in the evening a white butterfly
// comes and rests on a flower; at night the butterflies are gone and
// fireflies rise from among the blossoms. A prototype behind ?shore.

/** Atlas cells (scripts/gen-art.mjs packShore): 3 across, 2 down. */
const CELL = { open: 0, side: 1, bud: 2, petal: 3, flyOpen: 4, flyClosed: 5 } as const;
const MAX_SPRITES = 160;
const MAX_FLIES = 32;

export interface ShoreView {
  width: number;
  height: number;
  horizonY: number;
  S: number;
}

/** The top of the bank at x, in px from the bottom (y up): higher on the left, a soft uneven line. */
export function bankTop(x: number, view: ShoreView): number {
  const u = x / Math.max(view.width, 1);
  const wave = 0.012 * Math.sin(u * 9.1 + 1.3) + 0.007 * Math.sin(u * 23.0 + 0.4);
  // High enough to rise above the words box at the bottom, so there is room to draw on it.
  return view.S * (0.29 - 0.04 * u + wave);
}

interface Blossom {
  x: number;
  y: number;
  cell: number;
  size: number;
  angle: number;
  /** When it opens, seconds of engine time. */
  at: number;
}

interface Branch {
  id: number;
  stroke: Stroke;
  blossoms: Blossom[];
  nextPetal: number;
}

interface Butterfly {
  x: number;
  y: number;
  phase: number;
  /** Where it is heading: a blossom to rest on, or off the screen. */
  tx: number;
  ty: number;
  resting: number; // seconds left resting, < 0 while flying
  leaving: boolean;
  /** Seconds left of the small circle it makes before settling (value/12 §三、§四). */
  circling: number;
  /** Flowers it has rested on this visit: it may look in on one more before leaving. */
  visits: number;
}

const vert = /* glsl */ `
attribute vec4 aSprite; // cell, size (px), angle, alpha
attribute float aFlap;  // 1 still, toward 0 as the wings fold (butterflies)
uniform float uPR;
varying vec4 vSprite;
varying float vFlap;
void main() {
  vSprite = aSprite;
  vFlap = aFlap;
  gl_PointSize = aSprite.w > 0.002 ? aSprite.y * uPR : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uLight;
varying vec4 vSprite;
varying float vFlap;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float c = cos(vSprite.z), s = sin(vSprite.z);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  q.x /= max(vFlap, 0.12);
  vec2 uv = q + 0.5;
  if (uv.x < 0.004 || uv.x > 0.996 || uv.y < 0.004 || uv.y > 0.996) discard;
  float col = mod(vSprite.x, 3.0);
  float row = floor(vSprite.x / 3.0);
  vec4 t = texture2D(uTex, vec2((col + uv.x) / 3.0, 1.0 - (row + uv.y) / 2.0));
  float a = t.a * vSprite.w;
  if (a < 0.004) discard;
  gl_FragColor = vec4(t.rgb * uLight * a, a);
}
`;

const bankFrag = /* glsl */ `
precision mediump float;
uniform vec2 uRes;
uniform float uS;
uniform vec3 uInk;
uniform vec3 uMountain;
uniform vec3 uWater;
uniform float uDay;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 p = vUv * uRes;
  float u = p.x / uRes.x;
  float top = uS * (0.29 - 0.04 * u + 0.012 * sin(u * 9.1 + 1.3) + 0.007 * sin(u * 23.0 + 0.4));
  // A ragged grassy edge: short upright strokes along the top of the bank.
  float grass = noise(vec2(p.x / (uS * 0.006), 0.0)) * uS * 0.018 * noise(vec2(p.x / (uS * 0.05), 3.0));
  float d = top + grass - p.y;
  if (d < -1.0) discard;
  float a = smoothstep(-1.0, 1.5, d);
  // Ink wash: darker and denser low down and at the edge, a dry-brush grain.
  float depth = clamp(p.y / max(top, 1.0), 0.0, 1.0);
  float grain = noise(p / (uS * 0.012)) * 0.5 + noise(p / (uS * 0.004)) * 0.5;
  // By night a deep ink; by day a paler wash of the hills' grey, deeper low down.
  vec3 dark = mix(uInk * 1.6, uInk * 0.9, depth);
  vec3 lit = mix(uMountain * 1.05, uMountain * 0.55, depth * 0.8);
  vec3 col = mix(dark, lit, 0.3 + 0.65 * uDay);
  col = mix(col, uWater, 0.18 * (1.0 - depth));
  col *= 0.88 + 0.24 * grain;
  // The edge is the darkest line, like a brush run along the bank.
  col = mix(col, uInk * mix(0.8, 1.6, uDay), smoothstep(uS * 0.012, 0.0, d) * 0.6);
  gl_FragColor = vec4(col * a, a);
}
`;

export class Shore {
  readonly group = new THREE.Group();
  private readonly bank: THREE.Mesh;
  private readonly bankMat: THREE.ShaderMaterial;
  private readonly sprites: THREE.Points;
  private readonly spriteMat: THREE.ShaderMaterial;
  private readonly spriteGeo = new THREE.BufferGeometry();
  private readonly spritePos = new Float32Array(MAX_SPRITES * 3);
  private readonly spriteAttr = new Float32Array(MAX_SPRITES * 4);
  private readonly spriteFlap = new Float32Array(MAX_SPRITES);
  private readonly flies: THREE.Points;
  private readonly flyGeo = new THREE.BufferGeometry();
  private readonly flyPos = new Float32Array(MAX_FLIES * 3);
  private readonly flyAlpha = new Float32Array(MAX_FLIES);
  private readonly flyMat: THREE.ShaderMaterial;
  private branches: Branch[] = [];
  private butterflies: Butterfly[] = [];
  private nextButterfly = -1;
  private nextId = 1;
  /** When night came (for the fireflies to come up one after another), -1 by day. */
  private nightSince = -1;
  private view: ShoreView = { width: 1, height: 1, horizonY: 1, S: 1 };
  private readonly branchColor = new THREE.Vector3();

  constructor(palette: { ink: THREE.Vector3; mountain: THREE.Vector3; water: THREE.Vector3 }) {
    this.bankMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: bankFrag,
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uS: { value: 1 },
        uInk: { value: palette.ink },
        uMountain: { value: palette.mountain },
        uWater: { value: palette.water },
        uDay: { value: 0 },
      },
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
    });
    this.bank = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bankMat);
    this.bank.frustumCulled = false;
    this.bank.renderOrder = 2.52; // over the fish and the water's weather, under falling petals and the brush
    this.group.add(this.bank);

    this.spriteGeo.setAttribute('position', new THREE.BufferAttribute(this.spritePos, 3));
    this.spriteGeo.setAttribute('aSprite', new THREE.BufferAttribute(this.spriteAttr, 4));
    this.spriteGeo.setAttribute('aFlap', new THREE.BufferAttribute(this.spriteFlap, 1));
    this.spriteMat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uPR: { value: 1 }, uTex: { value: null as THREE.Texture | null }, uLight: { value: new THREE.Vector3(1, 1, 1) } },
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
    });
    this.sprites = new THREE.Points(this.spriteGeo, this.spriteMat);
    this.sprites.frustumCulled = false;
    this.sprites.renderOrder = 3.1; // on the branch
    this.group.add(this.sprites);

    this.flyGeo.setAttribute('position', new THREE.BufferAttribute(this.flyPos, 3));
    this.flyGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.flyAlpha, 1));
    this.flyMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `attribute float aAlpha; uniform float uPR; uniform float uSize; varying float vA;
        void main() { vA = aAlpha; gl_PointSize = aAlpha > 0.002 ? uSize * uPR : 0.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `precision mediump float; varying float vA;
        void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float g = exp(-r * r * 6.0) + 0.6 * exp(-r * r * 40.0);
          float a = g * vA; if (a < 0.003) discard; gl_FragColor = vec4(vec3(0.85, 1.0, 0.55) * a, a * 0.8); }`,
      uniforms: { uPR: { value: 1 }, uSize: { value: 10 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.flies = new THREE.Points(this.flyGeo, this.flyMat);
    this.flies.frustumCulled = false;
    this.flies.renderOrder = 3.15;
    this.group.add(this.flies);
  }

  get ready(): boolean {
    return !!this.spriteMat.uniforms.uTex.value;
  }

  setTexture(tex: THREE.Texture): void {
    this.spriteMat.uniforms.uTex.value = tex;
  }

  setPixelRatio(pr: number): void {
    this.spriteMat.uniforms.uPR.value = pr;
    this.flyMat.uniforms.uPR.value = pr;
  }

  resize(view: ShoreView): void {
    this.view = view;
    this.bank.scale.set(view.width, view.height, 1);
    this.bank.position.set(view.width / 2, view.height / 2, 0);
    this.bankMat.uniforms.uRes.value.set(view.width, view.height);
    this.bankMat.uniforms.uS.value = view.S;
    this.flyMat.uniforms.uSize.value = view.S * 0.03;
  }

  /** Whether (x, y) is on the bank (with a little of the water's edge). */
  onBank(x: number, y: number): boolean {
    return y < bankTop(x, this.view) + this.view.S * 0.045;
  }

  /** The highest the bank reaches, so the fish keep above it. */
  get bankHigh(): number {
    return this.view.S * 0.32;
  }

  /**
   * A stroke on the bank becomes a branch: the ink line is the bough, and
   * blossoms open along it from the base out. A quick stroke blooms sparse,
   * a slow, winding one blooms thick (the brush's character, as for the koi).
   */
  addBranch(stroke: Stroke, time: number, lively: number, random = Math.random): number {
    const S = this.view.S;
    const pts = stroke.points;
    // The base is the end nearer the bottom of the picture.
    const ordered = pts[0].y <= pts[pts.length - 1].y ? pts : [...pts].reverse();
    const gap = S * (0.035 + 0.045 * lively);
    const blossoms: Blossom[] = [];
    let acc = gap * 0.8;
    let along = 0;
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      acc += d;
      along += d;
      if (acc < gap) continue;
      acc = 0;
      const nx = -(b.y - a.y) / (d || 1);
      const ny = (b.x - a.x) / (d || 1);
      // A little to either side of the bough, in twos and threes.
      const cluster = 1 + Math.floor(random() * (lively > 0.6 ? 2 : 3));
      for (let k = 0; k < cluster && blossoms.length < 40; k++) {
        const off = (random() - 0.5) * S * 0.035;
        const r = random();
        const cell = r < 0.5 ? CELL.open : r < 0.8 ? CELL.side : CELL.bud;
        blossoms.push({
          x: b.x + nx * off + (random() - 0.5) * S * 0.01,
          y: b.y + ny * off + (random() - 0.5) * S * 0.01,
          cell,
          size: S * (cell === CELL.bud ? 0.034 : 0.044 + 0.016 * random()),
          angle: (random() - 0.5) * 1.6,
          at: time + 0.4 + (along / Math.max(stroke.length, 1)) * 2.2 + random() * 0.4,
        });
      }
    }
    const id = this.nextId++;
    this.branches.push({ id, stroke, blossoms, nextPetal: time + 4 + random() * 4 });
    this.nextButterfly = Math.min(this.nextButterfly < 0 ? Infinity : this.nextButterfly, time + 6);
    return id;
  }

  /** Undo: the branch and its blossoms go. Returns its stroke, for the caller to fade. */
  removeBranch(id: number): Stroke | null {
    const b = this.branches.find((x) => x.id === id);
    if (!b) return null;
    this.branches = this.branches.filter((x) => x !== b);
    return b.stroke;
  }

  /** The open blossom nearest (x, y), within `r`. */
  nearestBlossom(x: number, y: number, r: number, time: number): Blossom | null {
    let best: Blossom | null = null;
    let bd = r;
    for (const br of this.branches) {
      for (const bl of br.blossoms) {
        if (time < bl.at || bl.cell === CELL.bud) continue;
        const d = Math.hypot(bl.x - x, bl.y - y);
        if (d < bd) {
          bd = d;
          best = bl;
        }
      }
    }
    return best;
  }

  /**
   * Called each frame. `drop` lets a petal fall from (x, y) (the caller sends
   * it down as a falling petal); `day` and `dusk` say when butterflies come,
   * and night brings the fireflies.
   */
  update(dt: number, time: number, light: { day: number; dusk: number; rain?: number }, calm: boolean, drop: (x: number, y: number) => void, random = Math.random): void {
    const { S, width } = this.view;
    const night = Math.max(1 - light.day - light.dusk, 0);
    // Lit by the hour: cool and dim at night, the petals' edges warmed at dusk (value/12 §四).
    const lit = new THREE.Vector3(0.5 + 0.5 * (1 - night), 0.52 + 0.48 * (1 - night), 0.62 + 0.38 * (1 - night));
    lit.lerp(new THREE.Vector3(1.06, 0.9, 0.78), light.dusk * 0.7);
    (this.spriteMat.uniforms.uLight.value as THREE.Vector3).copy(lit);
    this.bankMat.uniforms.uDay.value = light.day;
    // The bough: dark ink by day, a paler grey-brown in the evening and at night so it still shows against the dark water.
    this.branchColor.set(0.24, 0.2, 0.18).lerp(new THREE.Vector3(0.38, 0.34, 0.31), 1 - light.day);
    for (const br of this.branches) br.stroke.useColor(this.branchColor);

    // Petals now and then, from a blossom that has opened.
    for (const br of this.branches) {
      if (time < br.nextPetal) continue;
      br.nextPetal = time + 5 + random() * 7;
      const open = br.blossoms.filter((b) => time > b.at + 1 && b.cell !== CELL.bud);
      if (open.length) {
        const b = open[Math.floor(random() * open.length)];
        drop(b.x, b.y);
      }
    }

    // Butterflies by day and in the evening; gone at night.
    const flowers = this.branches.flatMap((br) => br.blossoms.filter((b) => time > b.at && b.cell !== CELL.bud));
    // Not at night, and not in the rain: then there is only the rain (value/12 §七).
    const welcome = flowers.length > 0 && night < 0.5 && !calm && (light.rain ?? 0) < 0.3;
    // The one nearest the water first: the highest on the screen.
    const byWater = [...flowers].sort((a, b) => b.y - a.y);
    const pick = () => byWater[Math.min(Math.floor(random() * random() * byWater.length), byWater.length - 1)];
    if (welcome && this.nextButterfly >= 0 && time >= this.nextButterfly && this.butterflies.length < 2) {
      this.nextButterfly = time + 18 + random() * 22;
      const from = random() < 0.5 ? -S * 0.06 : width + S * 0.06;
      const target = pick();
      this.butterflies.push({ x: from, y: target.y + S * (0.15 + 0.2 * random()), phase: random() * 6.28, tx: target.x, ty: target.y + S * 0.012, resting: -1, leaving: false, circling: -1, visits: 0 });
    }
    if (this.nextButterfly < 0 && welcome) this.nextButterfly = time + 3;
    for (const f of this.butterflies) {
      if (!welcome && !f.leaving) {
        f.leaving = true;
        f.resting = -1;
        f.tx = f.x < width / 2 ? -S * 0.2 : width + S * 0.2;
        f.ty = f.y + S * 0.3;
      }
      if (f.resting >= 0) {
        f.resting -= dt;
        if (f.resting < 0) {
          f.visits++;
          // Sometimes it looks in on another flower before it goes (value/12 §四).
          if (f.visits < 2 && byWater.length > 1 && random() < 0.5) {
            const next = pick();
            f.tx = next.x;
            f.ty = next.y + S * 0.012;
          } else {
            f.leaving = true;
            f.tx = random() < 0.5 ? -S * 0.2 : width + S * 0.2;
            f.ty = f.y + S * (0.2 + 0.3 * random());
          }
        }
        continue;
      }
      // Near its flower it first goes half round in a small circle, then settles, wings closing.
      if (f.circling > 0) {
        f.circling -= dt;
        const a = f.phase + (1 - f.circling / 1.6) * Math.PI;
        f.x = f.tx + Math.cos(a) * S * 0.05;
        f.y = f.ty + S * 0.03 + Math.sin(a) * S * 0.035;
        if (f.circling <= 0) {
          f.x = f.tx;
          f.y = f.ty;
          f.resting = (light.dusk > 0.5 ? 3 : 6) + random() * 8;
        }
        continue;
      }
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.hypot(dx, dy);
      if (d < S * 0.06 && !f.leaving) {
        f.circling = calm ? 0.01 : 1.6;
        f.phase = Math.atan2(f.y - f.ty - S * 0.03, f.x - f.tx);
        continue;
      }
      // A butterfly's way: on toward where it is going, wavering up and down.
      const speed = S * 0.16;
      f.x += (dx / (d || 1)) * speed * dt + Math.sin(time * 2.3 + f.phase) * S * 0.03 * dt;
      f.y += (dy / (d || 1)) * speed * dt + Math.sin(time * 5.1 + f.phase) * S * 0.09 * dt;
    }
    this.butterflies = this.butterflies.filter((f) => !(f.leaving && (f.x < -S * 0.15 || f.x > width + S * 0.15)));

    // Draw: blossoms, then butterflies.
    let n = 0;
    this.spriteAttr.fill(0);
    for (const br of this.branches) {
      for (const b of br.blossoms) {
        if (n >= MAX_SPRITES - 4) break;
        const grow = THREE.MathUtils.clamp((time - b.at) / 1.2, 0, 1);
        if (grow <= 0) continue;
        const sway = calm ? 0 : Math.sin(time * 1.3 + b.x * 0.05) * 0.06;
        this.spritePos.set([b.x, b.y, 0], n * 3);
        this.spriteAttr.set([b.cell, b.size * (0.5 + 0.5 * grow), b.angle + sway, grow], n * 4);
        this.spriteFlap[n] = 1;
        n++;
      }
    }
    for (const f of this.butterflies) {
      if (n >= MAX_SPRITES) break;
      const rest = f.resting >= 0;
      // Flying: the wings beat (the picture narrows and widens); resting: wings closed, now and then a slow open.
      const flap = rest ? 1 : 0.25 + 0.75 * Math.abs(Math.sin(time * 13 + f.phase));
      const size = S * (rest ? 0.045 : 0.05);
      this.spritePos.set([f.x, f.y, 0], n * 3);
      this.spriteAttr.set([rest ? CELL.flyClosed : CELL.flyOpen, size, rest ? 0 : Math.sin(time * 2 + f.phase) * 0.25, 1], n * 4);
      this.spriteFlap[n] = flap;
      n++;
    }
    this.spriteGeo.setDrawRange(0, n);
    this.spriteGeo.attributes.position.needsUpdate = true;
    (this.spriteGeo.attributes.aSprite as THREE.BufferAttribute).needsUpdate = true;
    (this.spriteGeo.attributes.aFlap as THREE.BufferAttribute).needsUpdate = true;
    this.sprites.visible = n > 0 && this.ready;

    // Fireflies at night: first a glimmer low in the wet grass of the bank,
    // then another, each rising slowly to wander among the blossoms
    // (value/12 §五).
    let m = 0;
    if (night > 0.3 && this.nightSince < 0) this.nightSince = time;
    if (night <= 0.3) this.nightSince = -1;
    if (night > 0.3) {
      let order = 0;
      for (const br of this.branches) {
        const opened = br.blossoms.filter((b) => time > b.at);
        for (let k = 0; k < Math.min(6, opened.length) && m < MAX_FLIES; k++, order++) {
          const since = time - this.nightSince - order * 1.8;
          if (since <= 0) continue;
          const b = opened[(k * 7) % opened.length];
          const ph = k * 1.7 + br.id * 3.1;
          const ground = bankTop(b.x, this.view);
          const up = Math.min(since / 7, 1);
          const hy = b.y + S * 0.02 + Math.sin(time * 0.31 + ph * 1.3) * S * 0.04;
          const x = b.x + Math.sin(time * 0.4 + ph) * S * 0.05 * up;
          const y = ground + (hy - ground) * (up * up * (3 - 2 * up));
          this.flyPos.set([x, y, 0], m * 3);
          this.flyAlpha[m] = night * Math.min(since / 1.5, 1) * (0.35 + 0.65 * Math.max(Math.sin(time * 1.7 + ph * 2.0), 0));
          m++;
        }
      }
    }
    this.flyGeo.setDrawRange(0, m);
    this.flyGeo.attributes.position.needsUpdate = true;
    (this.flyGeo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    this.flies.visible = m > 0;
  }

  dispose(): void {
    this.bank.geometry.dispose();
    this.bankMat.dispose();
    this.spriteGeo.dispose();
    this.spriteMat.dispose();
    this.flyGeo.dispose();
    this.flyMat.dispose();
  }
}
