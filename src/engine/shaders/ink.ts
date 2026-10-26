import { noiseGLSL } from './common';

// Ribbon geometry carries aSV = (arc length in px | body coordinate s, side v in [-1, 1]).
export const ribbonVert = /* glsl */ `
attribute vec2 aSV;
varying vec2 vSV;
varying vec2 vPos;                // world position in px, for light on the water
void main() {
  vSV = aSV;
  vPos = (modelMatrix * vec4(position, 1.0)).xy;
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
uniform float uDot;               // 1 while the stroke is a single dab
varying vec2 vSV;

${noiseGLSL}

void main() {
  float s = vSV.x;
  float v = vSV.y;
  float av = abs(v);
  if (uDot > 0.5) {
    // A dab of ink where the brush touched down: round, its edge bleeding a
    // little unevenly into the paper, denser at the heart.
    vec2 q = vec2(s / max(uLen, 1.0) * 2.0 - 1.0, v);
    float r = length(q);
    float ang = atan(q.y, q.x);
    float bleed = (noise(vec2(ang * 1.8 + uSeed, uSeed)) - 0.5) * 0.3;
    float dab = 1.0 - smoothstep(0.62, 1.0, r + bleed);
    vec3 dc = mix(uColor * 0.82, uColor, smoothstep(0.0, 0.9, r));
    gl_FragColor = vec4(dc, dab * uOpacity * 0.92);
    return;
  }
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
uniform float uDepth;      // 0 at the surface .. 1 deep: how much water lies over the fish
uniform float uTime;
uniform float uGlow;       // > 0: a meteor's fish, pale gold and lit from within
uniform float uMark;       // 1: the first fish (本命鱼), a small cinnabar mark at a pectoral fin's root
uniform float uAge;        // 0..1, grown up: colours settle a shade deeper
varying vec2 vSV;                 // (s, side offset in maxW units scaled by growth)
varying vec2 vPos;

${noiseGLSL}
${fishProfileGLSL}

// The 本命鱼 mark: a small soft cinnabar dot where one pectoral fin meets the
// body, painted only where the fish itself is (side is in maxW units).
float honmeiMark(float s, float side) {
  vec2 d = vec2((s - 0.29) * uL, (side - 1.0) * uMaxW);
  return uMark * (1.0 - smoothstep(uMaxW * 0.12, uMaxW * 0.22, length(d)));
}

void main() {
  float s = vSV.x;
  if (uSkinOn > 0.5) {
    // Painted koi: the texture follows the bending spine.
    float gws = max(smoothstep(0.0, 1.0, uGrow), 1e-3) * uSpread;
    float tv = 0.5 + 0.5 * vSV.y / (gws * uSkinHalf);
    vec2 uv = vec2(uSkinFlip > 0.5 ? s : 1.0 - s, tv);
    float reveal = smoothstep(0.0, 0.08, uGrow * 1.15 - s);
    float loose = 1.0 - smoothstep(0.0, 0.35, (uSpread - 1.0) * 1.6 - fbm(vec2(s * 6.0, tv * 4.0) + uSeed) + 0.25);
    if (uShadow > 0.5) {
      // A soft shadow on the lake bed: the texture's alpha from a coarse mip
      // level, so it is blurred, and fainter the deeper the water above it.
      float sa = texture2D(uSkin, uv, 4.5).a * reveal * loose;
      gl_FragColor = vec4(0.0, 0.01, 0.03, sa * 0.2 * (1.0 - 0.4 * uDepth) * uOpacity);
      return;
    }
    vec4 tex = texture2D(uSkin, uv);
    // Edges a touch softer than the cut-out: water blurs a submerged outline.
    float ta = mix(tex.a, texture2D(uSkin, uv, 1.5).a, 0.5) * reveal * loose;
    // Fins (out from the body, and the tail) are thin membranes: let the water through.
    float fin = max(smoothstep(0.4, 0.7, abs(2.0 * tv - 1.0)), smoothstep(0.78, 0.9, s));
    ta *= mix(1.0, 0.5, fin);

    vec3 c = tex.rgb;
    float mark = honmeiMark(s, vSV.y / gws) * step(0.3, tex.a);
    c *= 1.0 - 0.08 * uAge;
    // Night, and under water: less saturated, darker, and tinted by the water
    // column above, more so the deeper the fish swims.
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(lum), c, 0.78) * uPaper * 0.78;
    float depth = clamp(uDepth + fin * 0.15, 0.0, 1.0);
    vec3 waterTint = uWater * 1.8 + vec3(0.015, 0.03, 0.045);
    c = mix(c, waterTint, 0.18 + 0.42 * depth);
    // Rounded body: the back catches the light, the flanks fall into the water.
    float side = abs(2.0 * tv - 1.0) / 0.45;
    c *= 1.0 - 0.22 * smoothstep(0.4, 1.0, side) * (1.0 - fin);
    // Light through the rippled surface: drifting caustic threads over the back.
    float n1 = noise(vPos / 22.0 + vec2(uTime * 0.31, uTime * 0.17));
    float n2 = noise(vPos / 15.0 - vec2(uTime * 0.23, -uTime * 0.29) + 7.3);
    float caustic = pow(1.0 - abs(n1 - n2), 10.0);
    c += vec3(0.85, 0.9, 1.0) * caustic * 0.1 * (1.0 - 0.7 * depth) * (1.0 - fin * 0.5);
    c = mix(c, uCinnabar * 0.9, mark * 0.85);
    gl_FragColor = vec4(c, max(ta, mark * 0.8 * reveal * loose) * uOpacity);
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
  // Warmed toward pale gold, lightly, so the painted koi still shows through.
  if (uGlow > 0.0) col = mix(col, vec3(1.0, 0.86, 0.56), 0.25 * uGlow) * (1.0 + 0.25 * uGlow);
  col *= 1.0 - 0.08 * uAge;
  float mark = honmeiMark(s, vSV.y / gw) * step(abs(vSV.y) / gw, env);
  col = mix(col, uCinnabar, mark * 0.85);
  a = max(a, mark * 0.8 * smoothstep(0.0, 0.08, uGrow * 1.15 - s));

  if (uShadow > 0.5) {
    // Under a glowing fish the water is lit, not shadowed.
    if (uGlow > 0.0) gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * 0.7, a * 0.4 * uGlow * uOpacity);
    else gl_FragColor = vec4(0.0, 0.01, 0.03, a * 0.32 * uOpacity);
  } else {
    gl_FragColor = vec4(col, a * uOpacity);
  }
}
`;
