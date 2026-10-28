import * as THREE from 'three';

// 河灯与孔明灯: on the lake, small lotus lamps set afloat near the shore
// drift slowly out toward the hills, each with its light trembling on the
// water below; now and then a paper lantern lifts off the water and rises
// into the night, swaying, growing small and faint. Warm points in the ink
// night, kept on the CPU: few, and each must know where it is.

const MAX = 24;

interface Lamp {
  kind: 0 | 1; // 0 river lamp, 1 sky lantern
  x: number;
  y: number;
  /** Size at the near shore (px); shrinks with distance. */
  size: number;
  phase: number;
  age: number;
  life: number;
}

const vert = /* glsl */ `
attribute vec4 aLamp;  // kind (0 lamp, 1 lantern, 2 reflection), size (px), flicker, alpha
uniform float uPR;
varying vec4 vLamp;
void main() {
  vLamp = aLamp;
  gl_PointSize = aLamp.w > 0.002 ? aLamp.y * uPR : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision mediump float;
uniform vec3 uInk;
varying vec4 vLamp;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float kind = vLamp.x;
  float fl = vLamp.z;
  vec3 warm = vec3(1.0, 0.72, 0.36);
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (kind > 1.5) {
    // The lamp's light on the water: a soft column, broken across.
    vec2 r = vec2(q.x / 0.22, (q.y + 0.1) / 0.9);
    float streak = exp(-dot(r, r) * 2.0) * (0.7 + 0.3 * sin(q.y * 18.0 + fl * 6.0));
    col = warm * streak * 0.55;
    a = streak * 0.45;
  } else if (kind > 0.5) {
    // 孔明灯: a rounded paper lantern lit from inside, a soft halo round it.
    vec2 b = vec2(q.x / 0.32, (q.y - 0.02) / 0.42);
    float body = smoothstep(1.05, 0.9, length(b * vec2(1.0, 0.95 + 0.1 * b.y)));
    float halo = exp(-dot(q, q) * 3.0) * 0.5;
    vec3 paper = mix(warm, vec3(1.0, 0.9, 0.65), smoothstep(0.6, -0.2, b.y));
    col = paper * body * (0.85 + 0.15 * fl) + warm * halo * 0.6;
    a = max(body, halo * 0.7);
  } else {
    // 河灯: a small lotus cup with a flame, a glow round it.
    vec2 b = vec2(q.x / 0.42, (q.y + 0.18) / 0.16);
    float cup = smoothstep(1.05, 0.85, length(b)) * step(q.y, -0.12);
    float petals = smoothstep(0.06, 0.0, abs(abs(q.x) - 0.24 - 0.1 * (q.y + 0.12) / 0.2)) * step(-0.12, q.y) * step(q.y, 0.06);
    vec2 f = vec2(q.x / 0.07, (q.y - 0.02) / 0.14);
    float flame = exp(-dot(f, f) * 1.5);
    float halo = exp(-dot(q, q) * 4.0) * 0.55;
    col = mix(uInk * 1.4, vec3(0.9, 0.7, 0.55), 0.35) * max(cup, petals * 0.8) + vec3(1.0, 0.85, 0.55) * flame * (0.8 + 0.2 * fl) + warm * halo * 0.7;
    a = max(max(cup, petals * 0.8), max(flame, halo * 0.75));
  }
  a *= vLamp.w;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col * vLamp.w, a);
}
`;

export class Lanterns {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(MAX * 2 * 3);
  private readonly attr = new Float32Array(MAX * 2 * 4);
  private lamps: Lamp[] = [];
  private nextLamp = 0;
  private nextLantern = 0;

  constructor(ink: THREE.Vector3) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aLamp', new THREE.BufferAttribute(this.attr, 4));
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
    this.points.renderOrder = 2.55;
  }

  setPixelRatio(pr: number): void {
    this.material.uniforms.uPR.value = pr;
  }

  update(dt: number, time: number, amount: number, view: { width: number; height: number; horizonY: number; S: number }, calm: boolean): void {
    const { width, height, horizonY, S } = view;
    const on = amount > 0.4;
    const count = (k: 0 | 1) => this.lamps.filter((l) => l.kind === k).length;
    if (on && time >= this.nextLamp && count(0) < 14) {
      this.nextLamp = time + 1.1 + Math.random() * 1.4;
      this.lamps.push({ kind: 0, x: width * (0.1 + 0.8 * Math.random()), y: horizonY * (0.2 + 0.3 * Math.random()), size: S * (0.11 + 0.03 * Math.random()), phase: Math.random() * 6.28, age: 0, life: 30 + Math.random() * 12 });
    }
    if (on && !calm && time >= this.nextLantern && count(1) < 6) {
      this.nextLantern = time + 3 + Math.random() * 3;
      this.lamps.push({ kind: 1, x: width * (0.15 + 0.7 * Math.random()), y: horizonY * (0.25 + 0.3 * Math.random()), size: S * (0.13 + 0.03 * Math.random()), phase: Math.random() * 6.28, age: 0, life: 26 + Math.random() * 8 });
    }
    for (const l of this.lamps) {
      l.age += dt;
      if (l.kind === 0) {
        // Out toward the hills, slowing as it goes, wandering a little.
        const dn = (horizonY - l.y) / S;
        l.y += S * 0.022 * Math.min(dn * 3 + 0.2, 1) * dt;
        l.x += Math.sin(time * 0.3 + l.phase) * S * 0.004 * dt;
      } else {
        l.y += S * 0.045 * dt;
        l.x += Math.sin(time * 0.6 + l.phase) * S * 0.01 * dt;
      }
    }
    this.lamps = this.lamps.filter((l) => l.age < l.life && (l.kind === 1 ? l.y < height + S * 0.1 : l.y < horizonY - S * 0.01));
    this.attr.fill(0);
    let n = 0;
    for (const l of this.lamps) {
      const fadeIn = Math.min(l.age / 2, 1);
      const fadeOut = Math.min((l.life - l.age) / 4, 1);
      const flicker = 0.5 + 0.5 * Math.sin(time * 9 + l.phase) * Math.sin(time * 5.3 + l.phase * 2);
      let size = l.size;
      let alpha = fadeIn * fadeOut * (on ? 1 : Math.max(amount / 0.4, 0));
      if (l.kind === 0) {
        // Perspective: smaller toward the horizon.
        const dn = Math.max((horizonY - l.y) / S, 0);
        size *= 0.25 + 0.75 * Math.min(dn / 0.6, 1);
        alpha *= Math.min(dn / 0.04, 1);
        this.pos.set([l.x, l.y - size * 0.35, 0], n * 3);
        this.attr.set([2, size * 1.1, flicker, alpha], n * 4);
        n++;
      } else {
        // Smaller and fainter as it rises away.
        const up = Math.max((l.y - horizonY) / (height - horizonY), 0);
        size *= 1 - 0.65 * up;
        alpha *= 1 - 0.6 * up;
      }
      this.pos.set([l.x, l.y, 0], n * 3);
      this.attr.set([l.kind, size, flicker, alpha], n * 4);
      n++;
    }
    this.geometry.setDrawRange(0, n);
    this.geometry.attributes.position.needsUpdate = true;
    (this.geometry.attributes.aLamp as THREE.BufferAttribute).needsUpdate = true;
    this.points.visible = n > 0;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
