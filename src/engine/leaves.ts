import * as THREE from 'three';

// 秋风落叶 (prototype): a few leaves blown across the night, tumbling as
// they fall, settling on the lake with a small ring and drifting until
// they soak and fade. Painted as ink blots with a touch of rust, so they
// belong to the same picture as the koi. Few at a time, kept on the CPU:
// each leaf has to know where it lands.

const MAX = 28;

interface Leaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  spinRate: number;
  flip: number;
  flipRate: number;
  tint: number;
  landY: number;
  landed: number; // seconds afloat; < 0 while falling
}

const vert = /* glsl */ `
attribute vec4 aLeaf;   // size (px), angle, flip (0..1 visible width), tint
attribute float aAlpha;
uniform float uPR;
varying vec4 vLeaf;
varying float vAlpha;
void main() {
  vLeaf = aLeaf;
  vAlpha = aAlpha;
  gl_PointSize = aAlpha > 0.001 ? aLeaf.x * uPR : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision mediump float;
uniform vec3 uInk;
varying vec4 vLeaf;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float c = cos(vLeaf.y), s = sin(vLeaf.y);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  // Tumbling: the leaf turns edge-on and back.
  q.y /= max(vLeaf.z, 0.3);
  // A pointed leaf: widest a little toward the stem, tip at +x.
  float x = q.x * 1.1;
  float hw = 0.42 * pow(max(1.0 - x * x, 0.0), 0.75) * (1.0 + 0.15 * (-x));
  float body = smoothstep(hw + 0.05, hw - 0.05, abs(q.y)) * step(abs(x), 1.0);
  float stem = smoothstep(0.035, 0.0, abs(q.y)) * step(-1.25, x) * step(x, -0.85);
  float vein = smoothstep(0.03, 0.0, abs(q.y)) * step(abs(x), 0.85);
  float a = max(body, stem) * vAlpha;
  if (a < 0.01) discard;
  vec3 rust = vec3(0.5, 0.25, 0.12);
  vec3 col = mix(uInk * 1.6, rust, vLeaf.w);
  // Ink gathers at the edge and along the vein, as in a painted leaf.
  float edge = smoothstep(hw - 0.12, hw, abs(q.y));
  col = mix(col, uInk, 0.45 * max(edge, vein * 0.6));
  gl_FragColor = vec4(col * a, a);
}
`;

export class Leaves {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(MAX * 3);
  private readonly leaf = new Float32Array(MAX * 4);
  private readonly alpha = new Float32Array(MAX);
  private leaves: Leaf[] = [];
  private nextSpawn = 0;

  constructor(ink: THREE.Vector3) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aLeaf', new THREE.BufferAttribute(this.leaf, 4));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
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
    this.points.renderOrder = 2.55; // over the fish, under the snow and the brush
  }

  setPixelRatio(pr: number): void {
    this.material.uniforms.uPR.value = pr;
  }

  /**
   * `amount` 0..1 is how much autumn wind there is; `wind` the smoothed wind,
   * negative while a gust blows to the left.
   * `land` is called when a leaf touches the water (for a ring).
   */
  update(
    dt: number,
    time: number,
    amount: number,
    wind: number,
    view: { width: number; height: number; horizonY: number; S: number },
    land: (x: number, y: number) => void,
  ): void {
    const { width, height, horizonY, S } = view;
    if (amount > 0.4 && time >= this.nextSpawn && this.leaves.length < MAX) {
      this.nextSpawn = time + (0.35 + Math.random() * 0.6) / Math.max(amount, 0.5);
      const fromSide = Math.random() < 0.4;
      // With the wind blowing left, leaves come in from the right.
      const side = wind < 0 ? width + S * 0.05 : -S * 0.05;
      this.spawn(fromSide ? side : Math.random() * width * 0.8, fromSide ? horizonY + Math.random() * (height - horizonY) : height + S * 0.05, 0, view);
    }
    for (const l of this.leaves) {
      if (l.landed < 0) {
        // Blown by the wind, sinking slowly, swinging as it tumbles.
        const gust = 0.6 + 0.4 * Math.sin(time * 0.7 + l.tint * 9);
        l.vx += ((0.04 + wind * 0.22) * S * gust - l.vx) * Math.min(dt * 1.5, 1);
        l.vy += (-(0.17 + 0.06 * Math.sin(l.flip)) * S - l.vy) * Math.min(dt * 2, 1);
        l.x += (l.vx + Math.sin(l.flip * 0.5) * S * 0.03) * dt;
        l.y += l.vy * dt;
        l.spin += l.spinRate * dt;
        l.flip += l.flipRate * dt;
        if (l.y <= l.landY) {
          l.y = l.landY;
          l.landed = 0;
          land(l.x, l.y);
        }
      } else {
        // Afloat: drifting with the wind, slowly turning, soaking through.
        l.landed += dt;
        l.x += wind * S * 0.012 * dt;
        l.spin += l.spinRate * 0.08 * dt;
      }
    }
    this.leaves = this.leaves.filter((l) => l.landed < 14 && l.x < width + S * 0.1 && l.x > -S * 0.1);
    this.alpha.fill(0);
    this.leaves.forEach((l, i) => {
      this.pos.set([l.x, l.y, 0], i * 3);
      // Afloat the leaf lies flat on the water, seen at an angle.
      const flat = l.landed >= 0 ? 0.45 : Math.abs(Math.cos(l.flip));
      this.leaf.set([l.size, l.spin, flat, l.tint], i * 4);
      const fade = l.landed < 0 ? 1 : Math.max(1 - l.landed / 14, 0) * (0.8 + 0.2 * Math.cos(l.landed));
      this.alpha[i] = 0.9 * fade;
    });
    this.geometry.attributes.position.needsUpdate = true;
    (this.geometry.attributes.aLeaf as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    this.points.visible = this.leaves.length > 0;
  }

  /**
   * 秋风: a gust the visitor drew, `dir` -1 left or 1 right, at height `y`:
   * a handful of leaves blown in from the upwind edge, already flying.
   */
  gust(dir: number, y: number, view: { width: number; height: number; horizonY: number; S: number }): void {
    const { width, horizonY, height, S } = view;
    for (let i = 0; i < 8 && this.leaves.length < MAX; i++) {
      const ly = Math.min(Math.max(y + (Math.random() - 0.5) * S * 0.35, horizonY + S * 0.05), height - S * 0.05);
      this.spawn(dir > 0 ? -S * (0.04 + 0.08 * Math.random()) : width + S * (0.04 + 0.08 * Math.random()), ly, dir * S * (0.3 + 0.2 * Math.random()), view);
    }
  }

  private spawn(x: number, y: number, vx: number, view: { horizonY: number; S: number }): void {
    const { horizonY, S } = view;
    // Nearer leaves land lower on the screen and look larger.
    const near = Math.random();
    this.leaves.push({
      x,
      y,
      vx,
      vy: 0,
      size: S * (0.045 + 0.05 * near),
      spin: Math.random() * Math.PI * 2,
      spinRate: (Math.random() - 0.5) * 2.4,
      flip: Math.random() * Math.PI * 2,
      flipRate: 1.5 + Math.random() * 2.5,
      tint: 0.25 + Math.random() * 0.55,
      landY: horizonY * (0.62 - 0.55 * near),
      landed: -1,
    });
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
