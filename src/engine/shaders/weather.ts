import { noiseGLSL } from './common';

// Weather overlay, drawn over the fish and under the brush: rain streaks
// and splash rings, drifting mist, fireflies, falling snow. Output is premultiplied alpha.
export const weatherFrag = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uHorizon;
uniform float uRain;
uniform float uMist;
uniform float uFireflies;
uniform float uSnow;
uniform float uSnowDensity;  // 0..1: sparse 小雪 to generous 大雪
uniform float uWind;
uniform float uParticles;  // share of particles drawn, by quality tier
uniform float uCalm;       // 1 = reduced motion: slower, sparser rain
uniform vec3 uSkyLow;
uniform vec3 uAccent;
varying vec2 vUv;

${noiseGLSL}

float rainLayer(vec2 p, float S, float cell, float speed, float seed) {
  float slant = 0.08 + uWind * 0.35;
  vec2 q = vec2(p.x + p.y * slant, p.y + uTime * speed * S);
  vec2 id = floor(q / vec2(cell, cell * 6.0));
  vec2 f = fract(q / vec2(cell, cell * 6.0));
  float h = hash(id + seed);
  if (h < 0.55) return 0.0;
  float x = abs(f.x - hash(id + seed + 3.1)) * cell;
  float along = smoothstep(0.0, 0.25, f.y) * (1.0 - smoothstep(0.55, 0.85, f.y));
  return exp(-x * x / 0.6) * along * (h - 0.55) * 2.2;
}

// One depth of snow. Flakes are paper left unpainted: soft, uneven, each
// drifting on its own sway. cell and r are in S units; dens is the share
// of cells holding a flake.
float snowLayer(vec2 p, float S, float cell, float speed, float r, float soft, float dens, float seed) {
  float c = cell * S;
  float slant = 0.05 + uWind * 0.75;
  float y = p.y + uTime * speed * S;
  vec2 q = vec2(p.x + y * slant, y) / c;
  vec2 id = floor(q);
  vec2 f = fract(q);
  float h = hash(id + seed);
  if (h > dens) return 0.0;
  float h2 = hash(id + seed + 4.7);
  float h3 = hash(id + seed + 9.1);
  vec2 ctr = vec2(0.3 + 0.4 * h2, 0.3 + 0.4 * h3);
  ctr.x += sin(uTime * (0.4 + 0.5 * h2) + h * 40.0) * 0.12;
  vec2 v = (f - ctr) * c;
  float rad = r * S * (0.6 + 0.8 * hash(id + seed + 2.3));
  v.y *= 1.0 + 0.35 * (h3 - 0.5);
  float d = length(v) / rad;
  d *= 1.0 + 0.45 * (noise(v / rad * 1.6 + h * 17.0) - 0.5);
  float body = 1.0 - smoothstep(1.0 - soft, 1.0, d);
  return body * (0.55 + 0.45 * hash(id + seed + 6.6));
}

float splashes(vec2 p, float hpx, float S) {
  float d = hpx - p.y;
  if (d <= 0.0) return 0.0;
  float dn = d / S;
  // Cells shrink toward the horizon for a little perspective.
  float scale = S * (0.03 + dn * 0.12);
  vec2 q = vec2(p.x, d * 2.4) / scale;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(id + 9.0);
  float phase = fract(uTime * (0.7 + h * 0.6) + h * 7.0);
  vec2 c = vec2(hash(id + 1.3), hash(id + 2.7)) * 0.5 - 0.25;
  float r = phase * 0.45;
  float ring = exp(-pow((length(f - c) - r) / 0.035, 2.0)) * (1.0 - phase);
  return ring * step(0.6, h) * smoothstep(0.0, 0.05, dn);
}

void main() {
  vec2 p = vUv * uRes;
  float S = min(uRes.x, uRes.y);
  float hpx = uHorizon * uRes.y;
  vec3 col = vec3(0.0);
  float a = 0.0;

  if (uMist > 0.001) {
    float drift = uTime * (0.01 + uWind * 0.04);
    float m = fbm(vec2(p.x / S * 1.3 - drift, p.y / S * 3.5) + fbm(vec2(p.x / S * 0.6 + drift * 0.5, p.y / S * 1.5)));
    float band = exp(-abs(p.y - hpx) / S * 2.6) * 0.8 + 0.25;
    float m1 = (smoothstep(0.35, 0.8, m) * 0.75 + 0.18) * band * uMist;
    vec3 mc = uSkyLow * 1.35 + vec3(0.03);
    col = mc * m1;
    a = m1;
  }

  if (uRain > 0.001) {
    // A little gloom first, then streaks and rings.
    float gloom = 0.12 * uRain;
    col = col * (1.0 - gloom);
    a = a + gloom * (1.0 - a);
    float speed = mix(1.0, 0.35, uCalm);
    float streaks = rainLayer(p, S, mix(9.0, 16.0, uCalm), 1.4 * speed, 0.0);
    if (uParticles > 0.5 && uCalm < 0.5) streaks += 0.6 * rainLayer(p, S, 5.0, 1.0 * speed, 17.0);
    vec3 rc = mix(uSkyLow * 2.2, vec3(0.8, 0.82, 0.86), 0.4);
    col += rc * streaks * 0.28 * uRain;
    col += rc * splashes(p, hpx, S) * 0.22 * uRain;
  }

  if (uSnow > 0.001) {
    // How much snow: sparse for 小雪, generous for 大雪.
    float dens = uSnowDensity * smoothstep(0.0, 0.6, uSnow);
    float on = smoothstep(0.0, 0.3, uSnow);
    float slow = mix(1.0, 0.5, uCalm);
    vec3 paper = vec3(0.84, 0.85, 0.86);
    // A pale hush over everything, thickest at the horizon where the far
    // snow blurs together.
    float hush = on * (0.03 + 0.09 * dens) * (0.6 + 0.8 * exp(-abs(p.y - hpx) / S * 3.0));
    vec3 hc = mix(uSkyLow * 1.6, paper, 0.3);
    col = hc * hush + col * (1.0 - hush);
    a = hush + a * (1.0 - hush);
    // Far to near: small, slow and faint, then larger, faster and softer.
    float far = snowLayer(p, S, 0.030, 0.035 * slow, 0.0035, 0.5, 0.7 * dens * dens, 0.0);
    float mid = snowLayer(p, S, 0.055, 0.055 * slow, 0.0060, 0.45, 0.55 * dens, 11.0);
    float near = snowLayer(p, S, 0.10, 0.085 * slow, 0.0105, 0.6, 0.36 * dens, 23.0);
    float big = 0.0;
    if (uParticles > 0.5 && uCalm < 0.5) big = snowLayer(p, S, 0.19, 0.13, 0.017, 0.85, 0.22 * dens * dens, 37.0);
    vec3 farC = mix(paper, uSkyLow * 1.5, 0.45);
    float layers[4];
    layers[0] = far * 0.45; layers[1] = mid * 0.7; layers[2] = near * 0.85; layers[3] = big * 0.6;
    for (int i = 0; i < 4; i++) {
      float al = layers[i] * on;
      vec3 fc = i == 0 ? farC : paper;
      col = fc * al + col * (1.0 - al);
      a = al + a * (1.0 - al);
    }
  }

  if (uFireflies > 0.001) {
    vec3 fc = mix(vec3(0.92, 0.95, 0.6), uAccent, 0.3);
    int count = int(28.0 * uParticles);
    for (int i = 0; i < 28; i++) {
      if (i >= count) break;
      float fi = float(i);
      float h1 = hash(vec2(fi, 1.7));
      float h2 = hash(vec2(fi, 8.3));
      float h3 = hash(vec2(fi, 4.1));
      vec2 pos = vec2(
        h1 * uRes.x + sin(uTime * (0.2 + h2 * 0.3) + fi) * S * 0.06,
        hpx + (h2 - 0.65) * S * 0.6 + sin(uTime * (0.3 + h3 * 0.4) + fi * 2.0) * S * 0.04
      );
      float blink = smoothstep(0.2, 1.0, sin(uTime * (0.8 + h3 * 1.2) + fi * 7.0));
      float d = length(p - pos);
      float glow = exp(-d * d / 8.0) + exp(-d / 14.0) * 0.35;
      col += fc * glow * blink * uFireflies;
    }
  }

  gl_FragColor = vec4(col, a);
}
`;
