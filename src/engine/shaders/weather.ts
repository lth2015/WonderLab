import { noiseGLSL } from './common';

// Weather overlay, drawn over the fish and under the brush: rain streaks
// and splash rings, drifting mist, fireflies. Output is premultiplied alpha.
export const weatherFrag = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uHorizon;
uniform float uRain;
uniform float uMist;
uniform float uFireflies;
uniform float uWind;
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
    float streaks = rainLayer(p, S, 9.0, 1.4, 0.0) + 0.6 * rainLayer(p, S, 5.0, 1.0, 17.0);
    vec3 rc = mix(uSkyLow * 2.2, vec3(0.8, 0.82, 0.86), 0.4);
    col += rc * streaks * 0.28 * uRain;
    col += rc * splashes(p, hpx, S) * 0.22 * uRain;
  }

  if (uFireflies > 0.001) {
    vec3 fc = mix(vec3(0.92, 0.95, 0.6), uAccent, 0.3);
    for (int i = 0; i < 28; i++) {
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
