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
  /** Seconds to fade in: slow for the world's own, quick for the visitor's. */
  rise: number;
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
    // 孔明灯: a paper lantern, wider at the shoulder, round on top, open
    // below where the flame burns. Brightest low down by the flame, deeper
    // orange toward the top; thin bamboo ribs show through the paper.
    float t = (q.y + 0.42) / 0.84;                 // 0 at the mouth, 1 at the top
    float w = mix(0.19, 0.29, smoothstep(0.0, 0.75, t));
    w *= t > 0.82 ? sqrt(max(1.0 - pow((t - 0.82) / 0.18, 2.0), 0.0)) : 1.0;
    float body = smoothstep(w + 0.025, w - 0.015, abs(q.x)) * smoothstep(-0.02, 0.02, t) * step(t, 1.0);
    float rib = 0.0;
    for (int i = -1; i <= 1; i++) rib = max(rib, smoothstep(0.016, 0.004, abs(q.x - float(i) * w * 0.55)));
    float rim = smoothstep(0.07, 0.0, t) * body;
    vec3 paper = mix(vec3(1.0, 0.88, 0.62), vec3(0.93, 0.5, 0.22), smoothstep(0.0, 1.0, t));
    float glow = exp(-(pow(q.x / 0.16, 2.0) + pow((t - 0.15) / 0.3, 2.0)));
    paper *= (0.75 + 0.35 * glow) * (0.88 + 0.12 * fl);
    paper *= 1.0 - 0.3 * rib - 0.35 * rim;
    vec2 f = vec2(q.x / 0.045, (q.y + 0.36) / 0.06);
    float flame = exp(-dot(f, f));
    vec2 hq = q - vec2(0.0, -0.15);
    float halo = exp(-dot(hq, hq) * 5.0) * 0.35;
    col = paper * body + vec3(1.0, 0.95, 0.75) * flame + warm * halo * 0.6 * (1.0 - body);
    a = max(max(body, flame), halo * 0.6);
  } else {
    // 河灯: a paper lotus, five petals fanning up from a shallow cup, lit
    // from the candle inside; the outer petals a little dimmer.
    vec2 base = vec2(0.0, -0.22);
    float petals = 0.0;
    vec3 pcol = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float ang = radians(-64.0 + 32.0 * float(i));
      vec2 d = q - base;
      float u = d.x * sin(ang) + d.y * cos(ang);
      float v = d.x * cos(ang) - d.y * sin(ang);
      float L = 0.34 - 0.05 * abs(float(i) - 2.0);
      float shape = smoothstep(0.012, -0.012, abs(v) - 0.1 * pow(max(sin(3.1416 * clamp(u / L, 0.0, 1.0)), 0.0), 0.8)) * step(0.0, u) * step(u, L);
      float lit = (1.0 - 0.18 * abs(float(i) - 2.0)) * (0.7 + 0.3 * u / L);
      pcol = mix(pcol, mix(vec3(0.95, 0.72, 0.58), vec3(1.0, 0.9, 0.74), u / L) * lit, shape);
      petals = max(petals, shape);
    }
    vec2 c = vec2(q.x / 0.36, (q.y + 0.24) / 0.09);
    float cup = smoothstep(1.05, 0.85, length(c)) * step(q.y, -0.2);
    vec2 f = vec2(q.x / 0.05, (q.y + 0.06) / 0.12);
    float flame = exp(-dot(f, f) * 1.5);
    float halo = exp(-dot(q - vec2(0.0, -0.1), q - vec2(0.0, -0.1)) * 4.5) * 0.5;
    col = pcol * (0.8 + 0.2 * fl) + vec3(0.85, 0.6, 0.45) * cup * (1.0 - petals) + vec3(1.0, 0.9, 0.62) * flame * (0.8 + 0.2 * fl) + warm * halo * 0.6 * (1.0 - petals);
    a = max(max(petals, cup), max(flame, halo * 0.7));
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

  /** The visitor touched the water: a lamp set afloat right there. */
  release(x: number, y: number, S: number, time: number): void {
    this.add({ kind: 0, x, y, size: S * (0.11 + 0.03 * Math.random()), phase: time * 3.1, age: 0, life: 34 + Math.random() * 8, rise: 0.35 });
  }

  /** The visitor drew a line up into the sky: a lantern lifting from where it began. */
  launch(x: number, y: number, S: number, time: number): void {
    this.add({ kind: 1, x, y, size: S * (0.08 + 0.015 * Math.random()), phase: time * 2.3, age: 0, life: 30 + Math.random() * 6, rise: 0.5 });
  }

  /** Room for the visitor's lamp: the oldest of the world's goes first. */
  private add(l: Lamp): void {
    if (this.lamps.length >= MAX) {
      const i = this.lamps.findIndex((o) => o.rise > 1);
      this.lamps.splice(Math.max(i, 0), 1);
    }
    this.lamps.push(l);
  }

  update(dt: number, time: number, amount: number, view: { width: number; height: number; horizonY: number; S: number }, calm: boolean): void {
    const { width, height, horizonY, S } = view;
    const on = amount > 0.4;
    const count = (k: 0 | 1) => this.lamps.filter((l) => l.kind === k).length;
    if (on && time >= this.nextLamp && count(0) < 14) {
      this.nextLamp = time + 1.1 + Math.random() * 1.4;
      this.lamps.push({ kind: 0, x: width * (0.1 + 0.8 * Math.random()), y: horizonY * (0.2 + 0.3 * Math.random()), size: S * (0.11 + 0.03 * Math.random()), phase: Math.random() * 6.28, age: 0, life: 30 + Math.random() * 12, rise: 2 });
    }
    if (on && !calm && time >= this.nextLantern && count(1) < 6) {
      this.nextLantern = time + 3 + Math.random() * 3;
      this.lamps.push({ kind: 1, x: width * (0.15 + 0.7 * Math.random()), y: horizonY * (0.25 + 0.3 * Math.random()), size: S * (0.075 + 0.02 * Math.random()), phase: Math.random() * 6.28, age: 0, life: 26 + Math.random() * 8, rise: 2 });
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
      const fadeIn = Math.min(l.age / l.rise, 1);
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
