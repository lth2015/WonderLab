import { noiseGLSL } from './common';

// Ribbon geometry carries aSV = (arc length in px | body coordinate s, side v in [-1, 1]).
export const ribbonVert = /* glsl */ `
attribute vec2 aSV;
varying vec2 vSV;
void main() {
  vSV = aSV;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// A live brush stroke: soft bleeding edges and dry-brush streaks (飞白)
// that increase toward the end of the stroke.
export const strokeFrag = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uLen;
uniform float uOpacity;
uniform float uSeed;
varying vec2 vSV;

${noiseGLSL}

void main() {
  float s = vSV.x;
  float v = vSV.y;
  float av = abs(v);
  float edgeNoise = noise(vec2(s * 0.12 + uSeed, v * 2.0)) - 0.5;
  float edge = 1.0 - smoothstep(0.55, 1.0, av + edgeNoise * 0.45);
  float streak = noise(vec2(s * 0.018 + uSeed * 3.0, v * 5.5 + uSeed));
  float dry = smoothstep(0.18, 0.55, streak + 0.3 - av * 0.25);
  float endDry = smoothstep(0.55, 1.0, s / max(uLen, 1.0));
  float a = edge * mix(1.0, dry, 0.3 + 0.55 * endDry);
  // Ink is denser in the core of the stroke.
  vec3 c = mix(uColor * 0.82, uColor, smoothstep(0.0, 0.8, av));
  gl_FragColor = vec4(c, a * uOpacity * 0.92);
}
`;

// Shared body profile, mirrored in fish.ts. s: 0 = head, 1 = tail tip.
export const fishProfileGLSL = /* glsl */ `
float bodyW(float s) {
  return sqrt(clamp(s / 0.1, 0.0, 1.0)) * (1.0 - 0.86 * smoothstep(0.2, 0.88, s));
}
float pectW(float s, float k) {
  float x = (s - 0.27) / 0.07;
  return k * 0.75 * exp(-x * x);
}
float tailW(float s) {
  return 1.5 * smoothstep(0.8, 1.0, s);
}
float envW(float s, float k) {
  return max(max(bodyW(s) + pectW(s, k), tailW(s)), 0.02);
}
`;

// An ink-painted koi seen from above: pale wash body, a faint ink outline
// and dorsal line, optional cinnabar patches, translucent fins.
export const fishFrag = /* glsl */ `
precision highp float;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uCinnabar;
uniform vec3 uWater;
uniform float uSeed;
uniform float uPatch;      // 0..1, how much cinnabar this fish carries
uniform float uGrow;       // birth reveal, head to tail
uniform float uOpacity;
uniform float uPect;       // pectoral fin flap
uniform float uL;          // body length, px
uniform float uMaxW;       // half-width scale, px
uniform float uShadow;     // 1 = render as soft shadow on the lake bed
uniform float uSpread;     // > 1 while the fish dissolves (undo)
uniform sampler2D uSkin;   // generated koi texture, head on the right
uniform float uSkinOn;
uniform float uSkinHalf;   // ribbon half width for the texture, in maxW units
uniform float uSkinFlip;
varying vec2 vSV;                 // (s, side offset in maxW units scaled by growth)

${noiseGLSL}
${fishProfileGLSL}

void main() {
  float s = vSV.x;
  if (uSkinOn > 0.5) {
    // Painted koi: the texture follows the bending spine.
    float gws = max(smoothstep(0.0, 1.0, uGrow), 1e-3) * uSpread;
    float tv = 0.5 + 0.5 * vSV.y / (gws * uSkinHalf);
    vec4 tex = texture2D(uSkin, vec2(uSkinFlip > 0.5 ? s : 1.0 - s, tv));
    float ta = tex.a * smoothstep(0.0, 0.08, uGrow * 1.15 - s);
    float tn = noise(vec2(s * 16.0 + uSeed * 7.0, vSV.y * 4.0)) - 0.5;
    ta *= 1.0 - smoothstep(0.0, 0.35, (uSpread - 1.0) * 1.6 - fbm(vec2(s * 6.0, tv * 4.0) + uSeed) + 0.25);
    // Toned to the night's paper colour, and seen through a little water.
    vec3 tc = mix(tex.rgb, tex.rgb * uPaper * 1.06, 0.45);
    tc = mix(tc, uWater, 0.1 + tn * 0.02);
    if (uShadow > 0.5) gl_FragColor = vec4(0.0, 0.01, 0.03, ta * 0.32 * uOpacity);
    else gl_FragColor = vec4(tc, ta * uOpacity);
    return;
  }
  float env = envW(s, uPect);
  float body = bodyW(s);
  float gw = max(smoothstep(0.0, 1.0, uGrow), 1e-3) * uSpread;
  float w = abs(vSV.y) / gw;       // offset from spine, in maxW units
  float v = vSV.y / (gw * env);    // -1..1 across the outline
  float n = noise(vec2(s * 16.0 + uSeed * 7.0, v * 4.0)) - 0.5;

  vec3 col;
  float a;
  if (w < body) {
    float x = w / body;
    col = uPaper;
    // Soft roundness: the back catches the light, the flanks fall into shade.
    col *= 1.02 - 0.12 * x * x;
    // Scales: a staggered net of fine ink arcs, as in a gongbi koi.
    float sz = uMaxW * 0.3;
    vec2 sp = vec2(s * uL, v * env * uMaxW) / sz;
    sp.y += 0.5 * mod(floor(sp.x), 2.0);
    float arc = abs(length(fract(sp) - vec2(0.0, 0.5)) - 0.62);
    float net = (1.0 - smoothstep(0.03, 0.09, arc)) * smoothstep(0.1, 0.22, s) * (1.0 - smoothstep(0.72, 0.84, s)) * (1.0 - smoothstep(0.55, 0.9, x));
    col = mix(col, uInk, net * 0.16);
    // Ink contour, like a 白描 outline.
    col = mix(col, uInk, smoothstep(0.7, 0.97, x + n * 0.08) * 0.55);
    // Dorsal ink line along the spine.
    float dorsal = exp(-x * x * 26.0) * smoothstep(0.06, 0.2, s) * (1.0 - smoothstep(0.65, 0.9, s));
    col = mix(col, uInk, dorsal * 0.42);
    // Cinnabar patches.
    float pn = fbm(vec2(s * 4.5 + uSeed * 11.0, v * 1.4 + uSeed * 5.0));
    float patchMask = smoothstep(0.5, 0.56, pn) * uPatch * smoothstep(0.03, 0.12, s) * (1.0 - smoothstep(0.7, 0.85, s));
    col = mix(col, uCinnabar, patchMask * 0.9);
    // Eyes.
    vec2 eyeP = vec2(s * uL, w * uMaxW);
    vec2 eyeC = vec2(0.075 * uL, 0.55 * body * uMaxW);
    float eye = smoothstep(uMaxW * 0.16, uMaxW * 0.08, length(eyeP - eyeC));
    col = mix(col, uInk * 0.6, eye);
    float glint = smoothstep(uMaxW * 0.05, uMaxW * 0.02, length(eyeP - eyeC - vec2(uMaxW * 0.03, uMaxW * 0.03)));
    col = mix(col, uPaper, glint * 0.8);
    a = 0.94 * (1.0 - smoothstep(0.9, 1.0, x + n * 0.1));
  } else {
    float fx = (w - body) / max(env - body, 1e-3);
    // Fin rays: thin ink lines in a pale, translucent membrane.
    float rays = pow(0.5 + 0.5 * sin(v * 26.0 + s * 9.0 + uSeed), 6.0);
    float pectRays = pow(0.5 + 0.5 * sin(s * 110.0), 6.0);
    float r = mix(pectRays, rays, smoothstep(0.6, 0.8, s));
    col = mix(uPaper, uInk, 0.12 + 0.35 * r);
    a = 0.42 * pow(1.0 - clamp(fx + n * 0.15, 0.0, 1.0), 1.2) * (0.6 + 0.4 * r);
  }
  // A forked tail: the centre ends early and the two lobes reach the tip,
  // so the fin never ends in a straight cut.
  float tipS = 0.86 + 0.13 * pow(abs(v), 1.2);
  a *= 1.0 - smoothstep(tipS - 0.07, tipS, s + n * 0.05);

  // Reveal from head to tail during birth.
  a *= smoothstep(0.0, 0.08, uGrow * 1.15 - s);
  // Dissolving: the ink breaks up into blotches as it spreads.
  float loose = uSpread - 1.0;
  a *= 1.0 - smoothstep(0.0, 0.35, loose * 1.6 - fbm(vec2(s * 6.0, v * 2.0) + uSeed) + 0.25);
  // Seen through a little water.
  col = mix(col, uWater, 0.12);

  if (uShadow > 0.5) {
    gl_FragColor = vec4(0.0, 0.01, 0.03, a * 0.32 * uOpacity);
  } else {
    gl_FragColor = vec4(col, a * uOpacity);
  }
}
`;
