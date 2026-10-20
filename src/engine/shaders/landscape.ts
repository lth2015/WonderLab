import { noiseGLSL } from './common';

// Static layer: sky gradient + ink-wash mountains. Rendered once per resize
// into a render target. Alpha stores "open sky" so stars can be masked.
export const landscapeFrag = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uHorizon;   // fraction of height, from bottom
uniform float uSeed;
uniform vec3 uZenith;
uniform vec3 uSkyLow;
uniform vec3 uMountain;
uniform vec3 uInk;
varying vec2 vUv;

${noiseGLSL}

float ridge(float x, float freq, float seed) {
  float n = fbm(vec2(x * freq + seed, seed * 0.37));
  return pow(smoothstep(0.25, 0.85, n), 1.5);
}

void main() {
  vec2 p = vUv * uRes;
  float S = min(uRes.x, uRes.y);
  float hpx = uHorizon * uRes.y;
  float yn = (p.y - hpx) / S;          // height above horizon, in S units
  float xn = p.x / S;

  // Sky: zenith to a hazy band at the horizon.
  float t = clamp((p.y - hpx) / (uRes.y - hpx), 0.0, 1.0);
  vec3 col = mix(uSkyLow, uZenith, smoothstep(0.0, 1.0, pow(t, 0.55)));
  float open = 1.0;

  // Three mountain layers, far to near.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float freq = 1.1 + fi * 0.9;
    float base = 0.035 - fi * 0.02;
    float amp = 0.22 - fi * 0.06;
    float seed = uSeed + fi * 17.3;
    float h = base + amp * ridge(xn, freq, seed);
    // The nearest layer only rises in places, leaving the middle open.
    if (i == 2) {
      h *= smoothstep(0.35, 0.75, noise(vec2(xn * 0.9 + seed, 3.1)));
      h -= 0.01;
    }
    float depth = 0.25 + fi * 0.3;     // far layers dissolve into the haze
    float bleed = 0.0025 + 0.004 * noise(vec2(xn * 60.0, yn * 20.0 + fi));
    float below = h - yn;              // distance below the ridge line
    float a = smoothstep(0.0, bleed, below) * step(-0.002, yn);
    if (a <= 0.0) continue;

    // Ink gathers at the ridge and thins out downward into mist.
    float inkAtRidge = exp(-below * (22.0 + fi * 6.0));
    float texture = fbm(vec2(xn * 38.0, yn * 5.0 + fi * 4.0));
    vec3 layer = mix(uMountain, uInk, depth);
    layer = mix(layer, uInk, inkAtRidge * (0.35 + 0.25 * fi) * (0.7 + 0.6 * texture));
    float mist = exp(-max(yn, 0.0) * (14.0 - fi * 3.0));
    layer = mix(layer, uSkyLow * 1.08, mist * (0.85 - fi * 0.2));
    col = mix(col, layer, a);
    open *= 1.0 - a;
  }

  gl_FragColor = vec4(col, open);
}
`;
