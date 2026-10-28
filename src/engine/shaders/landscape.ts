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
uniform float uMoonRim;   // 0..1, moonlight catching the ridges
uniform float uSnowCap;   // 0..1, how much snow lies on the mountains
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
    // Snow is left unpainted (留白): the paper shows on the upper slopes,
    // reaching further down as more falls, its lower edge broken like a
    // dry brush. A thin line of ink stays at the ridge itself.
    if (uSnowCap > 0.001) {
      float reach = (0.012 + 0.11 * uSnowCap) * (0.5 + 0.5 * smoothstep(0.0, 0.18, h)) * (1.0 - 0.15 * fi);
      float brush = fbm(vec2(xn * 22.0 + fi * 5.0, yn * 7.0));
      float streak = noise(vec2(xn * 70.0 + fi * 9.0, yn * 3.0));
      float edge = reach * (0.55 + 0.9 * brush) * (0.75 + 0.5 * streak);
      float snow = (1.0 - smoothstep(edge * 0.55, edge, below)) * smoothstep(0.0012, 0.0045 + 0.002 * fi, below);
      // Below the very top, rock and pines show through in patches.
      float patchy = fbm(vec2(xn * 30.0 + fi * 13.0, yn * 26.0 + fi));
      snow *= 1.0 - 0.7 * smoothstep(0.5, 0.72, patchy) * smoothstep(0.008, 0.03, below);
      vec3 white = mix(uSkyLow * 1.6 + vec3(0.30), vec3(0.82, 0.83, 0.84), 0.6);
      white = mix(white, uSkyLow * 1.25, 0.45 - fi * 0.2);   // far snow fades into the haze
      layer = mix(layer, white, snow * smoothstep(0.0, 0.6, uSnowCap) * (0.82 + 0.18 * texture));
    }
    if (uMoonRim > 0.001) {
      // A thin pale edge where the moonlight catches the ridge, strongest on the near hills.
      float rim = exp(-below * (240.0 - fi * 50.0)) * smoothstep(0.0, 0.001, below);
      layer = mix(layer, vec3(0.72, 0.77, 0.86), rim * uMoonRim * (0.75 + 0.15 * fi) * (0.6 + 0.6 * texture));
    }
    float mist = exp(-max(yn, 0.0) * (14.0 - fi * 3.0));
    layer = mix(layer, uSkyLow * 1.08, mist * (0.85 - fi * 0.2));
    col = mix(col, layer, a);
    open *= 1.0 - a;
  }

  gl_FragColor = vec4(col, open);
}
`;
