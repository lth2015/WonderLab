import { noiseGLSL } from './common';

export const MAX_RIPPLES = 16;

// Per-frame layer: stars, drifting mist, the lake with reflections and
// ripples, then paper grain and vignette over everything.
export const worldFrag = /* glsl */ `
precision highp float;
#define MAX_RIPPLES ${MAX_RIPPLES}
uniform sampler2D uLandscape;
uniform vec2 uRes;
uniform float uTime;
uniform float uHorizon;
uniform vec3 uSkyLow;
uniform vec3 uWater;
uniform vec3 uAccent;
uniform vec4 uRipples[MAX_RIPPLES];   // x, y (px), start time, strength
uniform int uRippleCount;
varying vec2 vUv;

${noiseGLSL}

float starLayer(vec2 p, float cellSize, float density, float size) {
  vec2 cell = floor(p / cellSize);
  vec2 f = fract(p / cellSize);
  float r = hash(cell);
  vec2 sp = vec2(hash(cell + 7.1), hash(cell + 3.3)) * 0.8 + 0.1;
  float d = length(f - sp) * cellSize;
  float tw = 0.65 + 0.35 * sin(uTime * (0.6 + r * 2.4) + r * 40.0);
  return step(1.0 - density, r) * smoothstep(size, 0.0, d) * tw * (0.35 + 0.65 * hash(cell + 1.7));
}

vec4 skyAt(vec2 p, float hpx, float S) {
  vec4 land = texture2D(uLandscape, p / uRes);
  vec3 c = land.rgb;
  float t = clamp((p.y - hpx) / (uRes.y - hpx), 0.0, 1.0);
  float stars = starLayer(p, 46.0, 0.32, 1.6) + 0.6 * starLayer(p + 13.0, 19.0, 0.18, 0.9);
  stars *= smoothstep(0.04, 0.4, t) * land.a;
  c += vec3(0.96, 0.93, 0.86) * stars;
  // Slow ink-wash cloud drifting across the upper sky.
  vec2 q = vec2(p.x / S * 1.2 + uTime * 0.006, p.y / S * 3.2);
  float cl = fbm(q + fbm(q * 0.7 + uTime * 0.003));
  c = mix(c, uSkyLow * 1.35, smoothstep(0.55, 0.82, cl) * 0.22 * smoothstep(0.1, 0.5, t));
  return vec4(c, land.a);
}

void main() {
  vec2 p = vUv * uRes;
  float S = min(uRes.x, uRes.y);
  float hpx = uHorizon * uRes.y;
  vec3 col;

  if (p.y >= hpx) {
    col = skyAt(p, hpx, S).rgb;
  } else {
    float d = hpx - p.y;
    float dn = d / S;
    // Waves: compressed near the horizon, larger toward the viewer.
    float z = 1.0 / (dn + 0.06);
    vec2 wq = vec2(p.x / S * 0.9 * z, z * 1.6 - uTime * 0.22);
    float wave = fbm(wq) - 0.5;
    float wave2 = noise(vec2(p.x / S * 2.0 * z, z * 6.0 - uTime * 0.5)) - 0.5;
    vec2 disp = vec2(wave * 0.6 + wave2 * 0.25, wave * 0.25) * S * (0.004 + dn * 0.03);

    // Ripples: squashed rings for a sense of perspective.
    float sheen = 0.0;
    for (int i = 0; i < MAX_RIPPLES; i++) {
      if (i >= uRippleCount) break;
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      vec2 dv = p - r.xy;
      dv.y *= 2.4;
      float dist = length(dv);
      float rad = age * S * 0.11;
      float w = S * 0.01 + age * S * 0.006;
      float env = exp(-age * 0.9) * r.w * smoothstep(0.0, 0.08, age);
      float k = (dist - rad) / w;
      float ring = exp(-k * k) * env;
      float ring2 = exp(-pow((dist - rad * 0.62) / (w * 0.8), 2.0)) * env * 0.5;
      float wavefront = sin(k * 3.1416) * ring + sin(k * 3.1416) * ring2;
      disp += normalize(dv + 1e-4) * wavefront * S * 0.006;
      sheen += (ring + ring2) * max(0.0, sin(k * 3.1416 + 1.2));
    }

    vec2 rp = vec2(p.x + disp.x, hpx + d + disp.y);
    rp.y = min(rp.y, uRes.y - 1.0);
    vec3 refl = skyAt(rp, hpx, S).rgb;
    float fresnel = mix(0.82, 0.32, smoothstep(0.0, 0.45, dn));
    col = mix(uWater, refl * 0.92, fresnel);
    // Thin moonlit glints on the wave crests.
    float glint = smoothstep(0.78, 1.0, noise(vec2(p.x / S * 26.0 * z * 0.25, p.y / S * 160.0 + uTime * 0.4)));
    col += uAccent * glint * 0.035 * (1.0 - smoothstep(0.0, 0.5, dn));
    col += uAccent * sheen * 0.10;
    col *= 1.0 - smoothstep(0.0, 0.6, dn) * 0.35;
  }

  // Mist hugging the horizon line.
  float hd = abs(p.y - hpx) / S;
  col = mix(col, uSkyLow * 1.1, exp(-hd * 45.0) * 0.45);

  // Rice-paper grain and a soft vignette.
  float grain = hash(floor(p)) - 0.5;
  float fibre = fbm(p * vec2(0.02, 0.09)) - 0.5;
  col += grain * 0.028 + fibre * 0.02;
  vec2 vq = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= mix(1.0, 0.72, smoothstep(0.45, 1.15, length(vq)));

  gl_FragColor = vec4(col, 1.0);
}
`;
