import * as THREE from 'three';

// 明月别枝惊鹊 (?shore=willow), after Codex's direction
// (docs/handoff/codex-mingyue-biezhi.md, art-incoming/mingyue/ on the collab
// branch): a magpie lives in the willow's crown above the picture, out of
// sight. Something nearby — a sun or moon newly drawn, a hand among the
// strands, lightning, a gust — makes it look up, and a moment later it
// leaves: a few wingbeats out of the strands at the upper right, then a long
// glide across the upper sky, into the distance or out of the picture. The
// strands it left shiver and let a leaf or two fall. A while later it comes
// back the other way and goes in among the strands again. Never more than
// one, never on a thin strand; by moonlight it is a blue-ink shape.

/** Its three poses side by side in public/art/magpie.webp: wings up, wings down, gliding. Head to the left. */
const POSE = { up: 0, down: 1, glide: 2 } as const;
/** Codex's README: the body's middle is at about (0.37, 0.51) of each frame; the frame turns about it. */
const BODY = { x: 0.37, y: 0.51 };

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision mediump float;
uniform sampler2D uTex;
uniform float uPose;
uniform float uFlip;
uniform vec3 uLight;
uniform vec3 uAir;
uniform float uNight;
uniform float uFar;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 uv = vec2(uFlip > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
  vec4 t = texture2D(uTex, vec2((uv.x + uPose) / 3.0, uv.y));
  // White feathers warm-grey, black with a little blue; by moonlight all of it toward blue ink.
  vec3 col = t.rgb * vec3(0.95, 0.94, 0.92);
  // The white still catches the moon (明月惊鹊 must be seen), the black sinks into the blue.
  float white = dot(t.rgb, vec3(0.33));
  col = mix(col, vec3(0.5, 0.58, 0.72) * white + vec3(0.06, 0.08, 0.12), uNight * 0.7);
  // Going away it sinks into the air, a stroke of ink rather than a bird.
  col = mix(col * mix(uLight, vec3(1.0), uNight * 0.6), uAir * 0.55, uFar * 0.6);
  float a = t.a * uAlpha * (1.0 - 0.35 * uFar);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * a, a);
}
`;

type Phase = 'perched' | 'alert' | 'leaving' | 'away' | 'returning';

interface Flight {
  start: number;
  dur: number;
  /** Cubic Bézier, in view pixels. */
  p: [number, number][];
  /** Size at the start and the end (share of S). */
  size: [number, number];
  far: [number, number];
  /** Wingbeats: the share of the flight to flap at the start (and the end, coming in). */
  flapStart: number;
  flapEnd: number;
}

function bezier(p: [number, number][], u: number): [number, number] {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}

export class Magpie {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private phase: Phase = 'perched';
  /** When the current phase ends (alert, away, perched: when it next leaves of itself). */
  private until = -1;
  private flight: Flight | null = null;
  private view = { width: 1, height: 1, horizonY: 1, S: 1 };
  private now = 0;
  /** Called as it bursts out of the strands (x, y), and as it goes back in. */
  onTakeoff: (x: number, y: number) => void = () => {};
  onLand: (x: number, y: number) => void = () => {};

  constructor(light: THREE.Vector3, air: THREE.Vector3) {
    const geo = new THREE.PlaneGeometry(1, 1);
    // Turn and scale about the body, not the middle of the frame.
    geo.translate(0.5 - BODY.x, 0.5 - BODY.y, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTex: { value: null as THREE.Texture | null },
        uPose: { value: 0 },
        uFlip: { value: 0 },
        uLight: { value: light },
        uAir: { value: air },
        uNight: { value: 0 },
        uFar: { value: 0 },
        uAlpha: { value: 1 },
      },
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    // Just behind the near strands, so it comes out from among them.
    this.mesh.renderOrder = 3.04;
    this.mesh.visible = false;
  }

  setTexture(tex: THREE.Texture): void {
    this.mat.uniforms.uTex.value = tex;
  }

  resize(width: number, height: number, horizonY: number, S: number): void {
    this.view = { width, height, horizonY, S };
    // A flight under way would cross a different picture now: let it finish out of sight.
    if (this.phase === 'leaving') this.settleAway(this.now);
    if (this.phase === 'returning') this.phase = 'perched';
    this.flight = null;
    this.mesh.visible = false;
  }

  /** Something near startled it: if it is in the crown it looks up, and after `delay` seconds it goes. */
  startle(time: number, delay: number): boolean {
    if (this.phase !== 'perched') return false;
    this.phase = 'alert';
    this.until = time + delay;
    return true;
  }

  get home(): boolean {
    return this.phase === 'perched' || this.phase === 'alert';
  }

  update(time: number, night: number, calm: boolean, random = Math.random): void {
    const { width, height, horizonY, S } = this.view;
    this.now = time;
    if (width <= 1) return;
    if (this.until < 0) this.until = time + 70 + random() * 60;
    switch (this.phase) {
      case 'perched':
        // Now and then it goes of its own accord, to the far wood and back.
        if (!calm && time >= this.until) {
          this.phase = 'alert';
          this.until = time + 0.6;
        }
        break;
      case 'alert':
        if (calm) {
          this.phase = 'perched';
          this.until = time + 60;
        } else if (time >= this.until) this.leave(time, random);
        break;
      case 'away':
        if (!calm && time >= this.until) this.come(time, random);
        break;
      default:
        break;
    }
    const f = this.flight;
    if (!f) {
      this.mesh.visible = false;
      return;
    }
    const u = Math.min((time - f.start) / f.dur, 1);
    if (u >= 1) {
      this.flight = null;
      this.mesh.visible = false;
      if (this.phase === 'leaving') this.settleAway(time, random);
      else {
        const [x, y] = f.p[3];
        this.onLand(x, y);
        this.phase = 'perched';
        this.until = time + 90 + random() * 90;
      }
      return;
    }
    // Ease out of the strands, glide most of the way, slower toward the end.
    const e = 1 - Math.pow(1 - u, 1.6);
    const [x, y] = bezier(f.p, e);
    const [x2, y2] = bezier(f.p, Math.min(e + 0.02, 1));
    const size = S * (f.size[0] + (f.size[1] - f.size[0]) * u);
    const flip = this.phase === 'returning';
    // Wings: a few quick beats, then held for the glide; a beat or two again now and then, and coming in.
    const flapping = u < f.flapStart || u > 1 - f.flapEnd || Math.sin(time * 0.9 + f.start) > 0.93;
    const beat = Math.floor((time - f.start) * 9) % 4;
    this.mat.uniforms.uPose.value = flapping ? [POSE.up, POSE.glide, POSE.down, POSE.glide][beat] : POSE.glide;
    this.mat.uniforms.uFlip.value = flip ? 1 : 0;
    this.mat.uniforms.uNight.value = night;
    this.mat.uniforms.uFar.value = f.far[0] + (f.far[1] - f.far[0]) * u;
    // In and out softly at the ends that are not the crown (the crown is off the picture).
    const fadeIn = this.phase === 'returning' ? Math.min(u / 0.12, 1) : 1;
    const fadeOut = this.phase === 'leaving' ? Math.min((1 - u) / 0.15, 1) : 1;
    this.mat.uniforms.uAlpha.value = fadeIn * fadeOut;
    // Bank a little with the path; the image's head is to the left.
    const heading = Math.atan2(y2 - y, x2 - x);
    const tilt = flip ? heading : heading - Math.PI;
    this.mesh.rotation.z = THREE.MathUtils.clamp(Math.atan2(Math.sin(tilt), Math.cos(tilt)), -0.35, 0.35);
    this.mesh.position.set(x, y, 0);
    this.mesh.scale.set(size, size, 1);
    this.mesh.visible = y < height + S * 0.2 && y > horizonY - S * 0.05;
  }

  private leave(time: number, random: () => number): void {
    const { width, height, horizonY, S } = this.view;
    // Heights as shares of the sky, so a tall phone and a wide screen both see it among the strands.
    const sky = height - horizonY;
    const x0 = width + S * 0.06;
    const y0 = height - sky * (0.25 + 0.08 * random());
    const toWood = random() < 0.5;
    // Over the upper sky, either out at the left or down into the far wood, smaller and paler.
    const p: [number, number][] = toWood
      ? [
          [x0, y0],
          [width * 0.78, height - sky * 0.15],
          [width * 0.45, horizonY + sky * 0.5],
          [width * (0.12 + 0.15 * random()), horizonY + S * 0.06],
        ]
      : [
          [x0, y0],
          [width * 0.75, height - sky * 0.15],
          [width * 0.35, height - sky * 0.38],
          [-S * 0.15, height - sky * (0.35 + 0.15 * random())],
        ];
    this.flight = { start: time, dur: toWood ? 9 + random() * 2 : 7 + random() * 2, p, size: [0.11, toWood ? 0.03 : 0.08], far: [0, toWood ? 1 : 0.3], flapStart: 0.2, flapEnd: 0 };
    this.phase = 'leaving';
    this.onTakeoff(width - S * 0.04, y0);
  }

  private come(time: number, random: () => number): void {
    const { width, height, horizonY, S } = this.view;
    const sky = height - horizonY;
    // Back from the far wood (a speck growing) into the strands at the upper right.
    const p: [number, number][] = [
      [width * (0.1 + 0.2 * random()), horizonY + S * 0.08],
      [width * 0.4, horizonY + sky * 0.5],
      [width * 0.8, height - sky * 0.12],
      [width + S * 0.06, height - sky * (0.22 + 0.08 * random())],
    ];
    this.flight = { start: time, dur: 9 + random() * 2, p, size: [0.03, 0.11], far: [1, 0], flapStart: 0.08, flapEnd: 0.15 };
    this.phase = 'returning';
  }

  private settleAway(time: number, random = Math.random): void {
    this.phase = 'away';
    this.until = time + 45 + random() * 45;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
