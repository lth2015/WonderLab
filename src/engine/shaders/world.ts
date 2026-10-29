import { noiseGLSL } from './common';
import { MAX_CLOUDS, MAX_METEORS, MAX_STARS, PLANET_SLOTS } from '../sky';
import { MAX_BOLT } from '../storm';

export const MAX_RIPPLES = 16;

// Per-frame layer: stars, drifting mist, the user's moon, stars, meteors and
// clouds, the lake with reflections and ripples, then paper grain and
// vignette over everything.
export const worldFrag = /* glsl */ `
precision highp float;
#define MAX_RIPPLES ${MAX_RIPPLES}
#define MAX_STARS ${MAX_STARS}
#define MAX_METEORS ${MAX_METEORS}
#define MAX_BOLT ${MAX_BOLT}
#define MAX_CLOUDS ${MAX_CLOUDS}
#define PLANET_SLOTS ${PLANET_SLOTS}
uniform sampler2D uLandscape;
uniform vec2 uRes;
uniform float uTime;
uniform float uHorizon;
uniform vec3 uSkyLow;
uniform vec3 uWater;
uniform vec3 uAccent;
uniform vec4 uRipples[MAX_RIPPLES];   // x, y (px), start time, strength
uniform int uRippleCount;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec4 uMoon;                   // x, y, radius (px), presence
uniform vec3 uMoonShade;              // direction to the dark side, shadow disc offset in radii
uniform float uMoonLight;             // 0..1, how much the moon lifts the night
uniform float uMoonPulse;             // 0..1, brief brightening when the moon is touched
uniform sampler2D uMoonTex;           // generated moon face (public/art), when present
uniform float uMoonTexOn;
uniform vec4 uStars[MAX_STARS];       // x, y, brightness, flash
uniform int uStarCount;
uniform vec4 uMeteors[MAX_METEORS];   // from x, y, to x, y
uniform float uMeteorT[MAX_METEORS];  // progress 0..1, 0 = inactive
uniform vec4 uClouds[MAX_CLOUDS];     // x, y, half width, presence
uniform vec4 uPlanets[PLANET_SLOTS];     // x, y, radius, presence
uniform vec4 uPlanetLook[PLANET_SLOTS];  // direction to the dark side, tint index, seed
uniform float uWaveT;                 // wave phase, advances faster with wind
uniform float uWind;
uniform float uDusk;
uniform float uGalaxy;                // 星河, 0..1 (also how far it has risen)
uniform float uShower;                // 流星雨, 0..1
uniform vec4 uBolt[MAX_BOLT];         // 雷雨: the bolt's segments (a, b), px
uniform int uBoltCount;               // 0 for a far strike: only the clouds light
uniform vec2 uFlash;                  // 雷雨: lightning brightness 0..1, and where along the sky (px)
uniform vec4 uBoat;                   // 孤舟: x, waterline y, length unit (px), presence
uniform vec4 uBirds[2];               // 飞鸟: x, y, size (px), wing phase; size 0 = none
uniform float uMoonlit;               // 0..1: 月夜, the light of the moon (or of one beyond the frame)
uniform float uSnow;                  // 0..1: snow clouds veil the stars; the lake goes dark and still
uniform float uSkyVeil;               // 0..1, fades all user sky items (restart)
uniform float uPost;                  // 1 = paper grain (standard tier)
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

const vec3 MOONLIGHT = vec3(0.78, 0.83, 0.92);

// 孤舟蓑笠翁: a small fishing boat in ink, in its own units (length 2,
// waterline at y = 0): a shallow hull, a rounded mat canopy, a figure in a
// straw hat at the stern, and a rod with its line.
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float boatShape(vec2 q) {
  float e = 0.025;
  float yt = 0.07 * q.x * q.x;
  float yb = yt - 0.15 * max(1.0 - q.x * q.x, 0.0);
  float hull = smoothstep(1.0 + e, 1.0 - e, abs(q.x)) * smoothstep(yb - e, yb + e, q.y) * smoothstep(yt + e, yt - e, q.y);
  vec2 c = vec2((q.x - 0.15) / 0.36, (q.y - yt) / 0.21);
  float canopy = smoothstep(1.08, 0.92, length(c)) * smoothstep(-0.02, 0.01, q.y - yt);
  vec2 m = q - vec2(-0.55, 0.0);
  float body = smoothstep(0.055, 0.035, abs(m.x)) * smoothstep(-0.02, 0.0, m.y) * smoothstep(0.19, 0.17, m.y);
  float hat = smoothstep(0.015, -0.015, abs(m.x) - 0.13 * (0.28 - m.y) / 0.1) * smoothstep(0.165, 0.18, m.y);
  float rod = smoothstep(0.024, 0.01, segDist(q, vec2(-0.5, 0.14), vec2(-1.45, 0.52)));
  float line = smoothstep(0.012, 0.004, segDist(q, vec2(-1.45, 0.52), vec2(-1.5, -0.02)));
  return max(max(max(hull, canopy), max(body, hat)), max(rod, line * 0.7));
}

// 飞鸟: a small bird in two strokes, wings rising and falling with the phase.
float birdShape(vec2 q, float phase) {
  float flap = sin(phase);
  float ax = abs(q.x);
  float yw = 0.05 + flap * 0.45 * ax - 0.22 * ax * ax;
  float th = 0.1 * (1.0 - ax) + 0.025;
  float wing = smoothstep(th, th * 0.35, abs(q.y - yw)) * smoothstep(1.0, 0.82, ax);
  float body = smoothstep(0.17, 0.1, length(q * vec2(1.0, 1.9)));
  return max(wing, body);
}

vec3 moonLayer(vec2 p, vec3 c, float open) {
  if (uMoon.w <= 0.0) return c;
  float r = uMoon.z;
  vec2 d = p - uMoon.xy;
  float dist = length(d);
  float lit = clamp(uMoonShade.z / 2.4, 0.3, 1.0);
  // A true circle with a one-pixel soft edge: the wobbled, ink-soaked rim
  // read as lumpy and fuzzy at the moon's usual size.
  float disc = 1.0 - smoothstep(r - 0.8, r + 0.8, dist);
  vec2 sc = uMoon.xy + uMoonShade.xy * uMoonShade.z * r;
  float shade = 1.0 - smoothstep(r * 0.9, r * 1.06, length(p - sc));
  // The glow comes from the lit limb, not from the dark part of the disc.
  float halo = (exp(-max(dist - r, 0.0) / (r * 0.8)) * 0.2 + exp(-max(dist - r, 0.0) / (r * 3.0)) * 0.05) * (1.0 + 1.8 * uMoonPulse * (1.0 - 0.6 * uMoonlit));
  halo *= 1.0 + 0.45 * uMoonlit;
  // 月晕: a faint wide ring on a moonlit night.
  halo += exp(-pow((dist - r * 2.4) / (r * 0.5), 2.0)) * 0.04 * uMoonlit;
  c += mix(uAccent, MOONLIGHT, 0.5 * uMoonlit) * halo * lit * uMoon.w * mix(0.5, 1.0, open) * (1.0 - disc * shade * 0.6);
  vec2 q = d / r;
  float z = sqrt(max(1.0 - dot(q, q), 0.0));
  vec3 tone = mix(uPaper, uAccent, 0.5);
  vec3 face;
  if (uMoonTexOn > 0.5) {
    face = texture2D(uMoonTex, q * 0.5 + 0.5).rgb;
    face = mix(face, face * tone * 1.2, 0.35);
  } else {
    // Maria, highland grain and a scatter of craters.
    float maria = smoothstep(0.47, 0.66, fbm(q * 1.7 + 4.3));
    float grain = fbm(q * 7.0 + 1.1) - 0.5;
    float crater = 0.0;
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 3.2 : 7.5;
      vec2 g = q * sc + float(k) * 13.1;
      vec2 id = floor(g);
      vec2 f = fract(g);
      float h = hash(id + 3.7);
      vec2 cc = vec2(hash(id + 1.3), hash(id + 8.1)) * 0.4 + 0.3;
      float rc = 0.06 + 0.16 * hash(id + 5.9);
      float cd = length(f - cc);
      float w = 0.03 + 0.03 * hash(id + 2.2);
      crater += step(0.72, h) * (exp(-pow((cd - rc) / w, 2.0)) * 0.12 - smoothstep(rc, rc * 0.4, cd) * 0.06) * (k == 0 ? 1.0 : 0.6);
    }
    face = tone * (0.97 - maria * 0.3 + grain * 0.12 + crater);
  }
  face *= (0.8 + 0.2 * z) * (1.0 + 0.12 * uMoonPulse);
  c = mix(c, c + uAccent * 0.02, disc * shade * uMoon.w * open);    // faint earthshine
  return mix(c, face, disc * (1.0 - shade) * uMoon.w * open);
}

// Small planets (docs/02 §5.2), painted rather than lit: a pale wash of
// diluted pigment — 石青, 赭石, 藤黄, mostly paper — whose edge bleeds
// unevenly into the sky, with pigment pooled into a slightly darker rim the
// way a wet wash dries, faint granulation inside, and a little more wash on
// the side away from the moon.
vec3 planetTint(float k) {
  vec3 t = k < 0.5 ? vec3(0.45, 0.58, 0.66) : k < 1.5 ? vec3(0.70, 0.52, 0.38) : vec3(0.84, 0.76, 0.54);
  return mix(t, uPaper, 0.55);
}

vec3 planetLayer(vec2 p, vec3 c, float open) {
  for (int i = 0; i < PLANET_SLOTS; i++) {
    vec4 pl = uPlanets[i];
    if (pl.w <= 0.0 || pl.z <= 0.0) continue;
    vec4 look = uPlanetLook[i];
    float r = pl.z;
    vec2 d = p - pl.xy;
    float dist = length(d);
    if (dist > r * 3.0) continue;
    vec3 tint = planetTint(look.z);
    vec2 q = d / r;
    float seed = look.w * 31.0;
    // The edge wanders as the ink spreads: a noisy radius, a soft falloff.
    float ang = atan(q.y, q.x);
    float bleed = (fbm(vec2(ang * 1.6 + seed, seed)) - 0.5) * 0.16 + (noise(vec2(ang * 9.0, seed)) - 0.5) * 0.05;
    float edge = dist / r - bleed;
    float wash = 1.0 - smoothstep(0.86, 1.04, edge);
    if (wash <= 0.0) {
      c += tint * exp(-max(dist - r, 0.0) / (r * 0.9)) * 0.035 * pl.w * open;
      continue;
    }
    // Pigment pools at the rim and thins toward the middle.
    float rim = smoothstep(0.62, 0.95, edge) * (1.0 - smoothstep(0.95, 1.04, edge));
    float grain = fbm(q * 5.5 + seed) - 0.5;
    float body = 0.55 + grain * 0.22 + rim * 0.3;
    // The side away from the moon takes a second, cooler wash.
    float away = smoothstep(-0.2, 0.9, dot(q, look.xy));
    vec3 face = mix(tint, mix(tint, uSkyLow * 1.6, 0.55), away * 0.6);
    c = mix(c, face, clamp(body, 0.0, 1.0) * wash * pl.w * open);
  }
  return c;
}

vec3 userSky(vec2 p, vec3 c, float open) {
  vec3 base = c;
  // Clouds sit in front of the mountains, the rest behind them.
  for (int i = 0; i < MAX_CLOUDS; i++) {
    vec4 cl = uClouds[i];
    if (cl.w <= 0.0) continue;
    vec2 q = (p - cl.xy) / vec2(cl.z, cl.z * 0.24);
    float n = fbm(q * vec2(1.4, 0.9) + vec2(uTime * 0.03 + float(i) * 7.0, float(i) * 3.0));
    float m = smoothstep(1.0, 0.25, length(q) + (n - 0.5) * 0.9) * cl.w;
    c = mix(c, uSkyLow * 1.55 + uAccent * 0.06 * uMoonLight + MOONLIGHT * 0.1 * uMoonlit, m * 0.5);
  }
  c = planetLayer(p, c, open);
  c = moonLayer(p, c, open);
  for (int i = 0; i < 2; i++) {
    vec4 b = uBirds[i];
    if (b.z <= 0.0) continue;
    c = mix(c, uInk * 0.4, birdShape((p - b.xy) / b.z, b.w) * 0.9);
  }
  vec3 starCol = vec3(0.98, 0.95, 0.86);
  for (int i = 0; i < MAX_STARS; i++) {
    if (i >= uStarCount) break;
    vec4 s = uStars[i];
    vec2 d = p - s.xy;
    float r2 = dot(d, d);
    float glow = exp(-r2 / 4.0) + exp(-sqrt(r2) / 5.0) * 0.22;
    float tw = 0.82 + 0.18 * sin(uTime * 2.1 + float(i) * 1.7);
    if (s.w > 0.5) {
      // Twinkle: a soft four-point glint.
      glow += (exp(-abs(d.x) / 1.1 - abs(d.y) / 13.0) + exp(-abs(d.y) / 1.1 - abs(d.x) / 13.0)) * 0.7;
      tw = 1.0;
    }
    c += starCol * glow * s.z * tw * open * (1.0 - 0.5 * uDusk);
  }
  for (int i = 0; i < MAX_METEORS; i++) {
    float t = uMeteorT[i];
    if (t <= 0.0) continue;
    vec2 a = uMeteors[i].xy;
    vec2 b = uMeteors[i].zw;
    float k = 1.0 - pow(1.0 - t, 2.0);
    vec2 head = mix(a, b, k);
    vec2 tail = mix(a, b, max(k - 0.4, 0.0));
    vec2 ab = head - tail;
    float h = clamp(dot(p - tail, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
    float dist = length(p - tail - ab * h);
    float w = 0.8 + 1.4 * h;
    float fade = 1.0 - smoothstep(0.7, 1.0, t);
    float trail = exp(-dist * dist / (w * w)) * h * h;
    float spark = exp(-length(p - head) / 4.0);
    c += starCol * (trail * 0.9 + spark * 0.7) * fade * open;
  }
  return mix(base, c, uSkyVeil);
}

vec4 skyAt(vec2 p, float hpx, float S) {
  vec4 land = texture2D(uLandscape, p / uRes);
  vec3 c = land.rgb;
  float t = clamp((p.y - hpx) / (uRes.y - hpx), 0.0, 1.0);
  float stars = starLayer(p, 46.0, 0.32, 1.6) + 0.6 * starLayer(p + 13.0, 19.0, 0.18, 0.9);
  // 月明星稀: a moonlit night has fewer stars, fewer still with the moon up.
  stars *= smoothstep(0.04, 0.4, t) * land.a * (1.0 - 0.75 * uDusk) * (1.0 - 0.6 * uSnow) * (1.0 - uMoonlit * mix(0.35, 0.6, uMoon.w));
  c += vec3(0.96, 0.93, 0.86) * stars;
  if (uGalaxy > 0.001) {
    // 星河: a band of light rising from behind the hills at the lower left
    // and across the sky, clumped, split by dark dust, thick with small
    // stars. It rises as it comes, and the lake holds it too.
    vec2 dir = normalize(vec2(0.55, 1.0));
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 d = p - vec2(uRes.x * 0.22, hpx);
    float along = dot(d, dir) / S;
    float wave = 0.06 * sin(along * 2.2 + 1.0);
    float across = dot(d, nrm) / S - wave;
    float band = exp(-pow(across / (0.15 + 0.05 * max(along, 0.0)), 2.0));
    float clump = fbm(vec2(along * 3.0, across * 6.0) + 3.7);
    float rift = smoothstep(0.55, 0.8, fbm(vec2(along * 5.0 + 9.0, across * 14.0)));
    float reveal = 1.0 - smoothstep(uGalaxy * 2.8 - 0.25, uGalaxy * 2.8, along);
    float shown = band * reveal * uGalaxy * land.a;
    vec3 gc = mix(vec3(0.70, 0.75, 0.90), vec3(0.93, 0.87, 0.74), smoothstep(0.55, 1.0, band) * clump);
    c += gc * shown * (0.45 + 0.75 * clump) * (1.0 - 0.65 * rift * band) * 0.32;
    float dense = starLayer(p + 31.0, 7.0, 0.55, 0.9) + 0.6 * starLayer(p + 77.0, 4.0, 0.35, 0.6);
    c += vec3(0.96, 0.95, 0.9) * dense * shown * (1.0 - 0.5 * rift);
  }
  if (uShower > 0.001) {
    // 流星雨: meteors streaming from one radiant beyond the upper right,
    // each a short bright streak; a few at a time, in the lake too.
    vec2 radiant = vec2(uRes.x * 1.2, uRes.y * 1.3);
    for (int i = 0; i < 11; i++) {
      float fi = float(i);
      float period = 1.5 + hash(vec2(fi, 3.1)) * 2.5;
      float ph = uTime / period + hash(vec2(fi, 7.7)) * 10.0;
      float id = floor(ph);
      float u = fract(ph);
      if (u > 0.4 || hash(vec2(id, fi)) > uShower * 0.85) continue;
      vec2 a = vec2(hash(vec2(id, fi + 1.3)) * uRes.x * 1.1, hpx + (uRes.y - hpx) * (0.35 + 0.65 * hash(vec2(id, fi + 2.9))));
      vec2 dir = normalize(a - radiant);
      float len = S * (0.16 + 0.26 * hash(vec2(id, fi + 5.2)));
      float k = u / 0.4;
      float kk = 1.0 - pow(1.0 - k, 2.0);
      vec2 head = a + dir * len * kk;
      vec2 tail = a + dir * len * max(kk - 0.45, 0.0);
      vec2 ab = head - tail;
      float h = clamp(dot(p - tail, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      float dist = length(p - tail - ab * h);
      float w = 0.6 + 1.1 * h;
      float fade = 1.0 - smoothstep(0.65, 1.0, k);
      float trail = exp(-dist * dist / (w * w)) * h * h;
      float spark = exp(-length(p - head) / 3.0);
      c += vec3(0.96, 0.93, 0.86) * (trail * 1.0 + spark * 0.7) * fade * land.a * uShower;
    }
  }
  // Slow ink-wash cloud drifting across the upper sky.
  vec2 q = vec2(p.x / S * 1.2 + uTime * 0.006, p.y / S * 3.2);
  float cl = fbm(q + fbm(q * 0.7 + uTime * 0.003));
  float cloud = smoothstep(0.55, 0.82, cl) * 0.22 * smoothstep(0.1, 0.5, t);
  c = mix(c, uSkyLow * 1.35 + MOONLIGHT * 0.12 * uMoonlit, cloud);
  if (uMoonlit > 0.001) {
    // The whole night turns silver-blue; with no moon drawn yet, the light
    // comes from beyond the upper left of the frame.
    c += MOONLIGHT * 0.09 * uMoonlit * (0.5 + 0.5 * t);
    float far = length(p - vec2(-0.12 * uRes.x, uRes.y * 1.02)) / S;
    float beyond = exp(-far / 0.55) * 0.75 + exp(-far / 1.4) * 0.3;
    c += MOONLIGHT * beyond * uMoonlit * (1.0 - uMoon.w) * land.a;
  }
  c *= 1.0 + 0.08 * uMoonLight * uSkyVeil;
  if (uFlash.x > 0.001) {
    // Lightning behind the far hills: the sky and the clouds light up, most
    // near where it struck; the mountains stay dark against it.
    vec2 d = (p - vec2(uFlash.y, uRes.y * 0.95)) / S;
    float near = exp(-length(d) * 1.2);
    float lit = uFlash.x * (0.3 + 0.9 * near + 0.6 * cloud * 4.0 * near);
    // The hills go black against it.
    c += vec3(0.8, 0.84, 0.95) * lit * mix(0.06, 1.0, land.a);
    if (uBoltCount > 0) {
      // The bolt itself: a white-hot core and a blue-white glow, hidden where it passes behind the hills.
      float dist = 1e5;
      for (int i = 0; i < MAX_BOLT; i++) {
        if (i >= uBoltCount) break;
        dist = min(dist, segDist(p, uBolt[i].xy, uBolt[i].zw));
      }
      float core = exp(-dist * dist / 1.6);
      float glow = exp(-dist / (S * 0.012)) * 0.45 + exp(-dist / (S * 0.06)) * 0.2;
      c += vec3(0.9, 0.93, 1.0) * uFlash.x * (core * 1.4 * land.a + glow * mix(0.3, 1.0, land.a));
    }
  }
  c = userSky(p, c, land.a);
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
    vec2 wq = vec2(p.x / S * 0.9 * z, z * 1.6 - uWaveT * 0.22);
    float wave = fbm(wq) - 0.5;
    float wave2 = noise(vec2(p.x / S * 2.0 * z, z * 6.0 - uWaveT * 0.5)) - 0.5;
    vec2 disp = vec2(wave * 0.6 + wave2 * 0.25, wave * 0.25) * S * (0.004 + dn * 0.03) * (0.5 + uWind * 1.5);

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

    // The moon's reflection is not a mirror image but a column of light that
    // the waves break up: shred the reflected disc inside that column.
    float moonCol = 0.0;
    float discDim = 0.0;
    if (uMoon.w > 0.0) {
      float dxm = p.x - uMoon.x;
      float cw = uMoon.z * (0.75 + dn * 5.0) * (1.0 + 0.9 * uMoonlit);
      moonCol = exp(-dxm * dxm / (cw * cw)) * uMoon.w * uSkyVeil;
      disp += vec2(wave2 * cw * 1.4, wave * S * 0.08) * moonCol;
      // Fade the mirrored disc itself, leaving the mountains' reflection alone.
      float dy = (p.y - (2.0 * hpx - uMoon.y)) / (uMoon.z * 1.8);
      discDim = moonCol * exp(-dy * dy);
    }

    vec2 rp = vec2(p.x + disp.x, hpx + d + disp.y);
    rp.y = min(rp.y, uRes.y - 1.0);
    vec3 refl = skyAt(rp, hpx, S).rgb;
    float fresnel = mix(0.82, 0.32, smoothstep(0.0, 0.45, dn));
    // Snow does not lie on the water: the lake turns dark and still, and
    // holds the white mountains more clearly.
    fresnel = mix(fresnel, min(fresnel + 0.12, 0.9), uSnow);
    refl = mix(refl, min(refl, uSkyLow * 0.95), discDim);
    col = mix(uWater, refl * 0.92, fresnel);
    // Thin moonlit glints on the wave crests.
    float glint = smoothstep(0.78, 1.0, noise(vec2(p.x / S * 26.0 * z * 0.25, p.y / S * 160.0 + uTime * 0.4)));
    col += uAccent * glint * 0.035 * (1.0 - smoothstep(0.0, 0.5, dn));
    col += uAccent * sheen * 0.10;
    // 浮光跃金: short horizontal glints along the moon's column, brightest
    // a little below the horizon and thinning out toward the viewer.
    if (moonCol > 0.001) {
      float lit = clamp(uMoonShade.z / 2.4, 0.3, 1.0);
      float zz = 1.0 / (dn + 0.04);
      float crest = noise(vec2(p.x / (S * 0.016 * (1.0 + dn * 1.2)), zz * 5.0 - uWaveT * 0.9));
      float crest2 = noise(vec2(p.x / (S * 0.007 * (1.0 + dn * 1.2)), zz * 10.0 - uWaveT * 1.4 + 7.0));
      float glit = smoothstep(0.66, 0.95, crest * 0.6 + crest2 * 0.5);
      float fade = smoothstep(0.0, 0.015, dn) * (1.0 - 0.8 * smoothstep(0.12, 0.55, dn));
      vec3 light = mix(uAccent, uPaper, 0.35);
      col += light * glit * moonCol * lit * fade * (0.5 + 0.7 * uMoonlit * (1.0 - smoothstep(0.08, 0.3, dn))) * (1.0 - 0.45 * uMoonlit * smoothstep(0.2, 0.5, dn)) * (1.0 + uMoonPulse);
      col += uAccent * moonCol * lit * fade * 0.035;
      // Rings crossing the path catch its light: a splash breaks it into bright arcs.
      col += light * sheen * moonCol * lit * (0.25 + 0.5 * uMoonlit);
    }
    if (uMoonlit > 0.001) {
      // 庭下如积水空明: a broad, faint silver on the far water, broken by the waves.
      float fine = smoothstep(0.62, 0.95, noise(vec2(p.x / (S * 0.03 * (1.0 + dn * 2.0)), p.y / (S * 0.004 * (1.0 + dn * 3.0)) - uWaveT * 0.8)));
      float far = 1.0 - smoothstep(0.0, 0.35, dn);
      float side = mix(1.0, 1.0 - 0.6 * smoothstep(0.0, 1.0, p.x / uRes.x), 1.0 - uMoon.w);
      col += MOONLIGHT * (0.07 + 0.28 * fine) * far * side * uMoonlit;
      // With the moon beyond the frame, its path comes in from the left,
      // widening toward the viewer, broken into glints by the waves.
      float px = 0.04 * uRes.x + dn * S * 0.8;
      float pw = S * (0.1 + dn * 0.45);
      float path = exp(-pow((p.x - px) / pw, 2.0)) * smoothstep(0.0, 0.02, dn) * (1.0 - 0.7 * smoothstep(0.15, 0.7, dn));
      float glints = smoothstep(0.6, 0.95, noise(vec2(p.x / (S * 0.022 * (1.0 + dn * 1.5)), p.y / (S * 0.004 * (1.0 + dn * 3.0)) - uWaveT * 1.2)));
      col += MOONLIGHT * path * (0.05 + 0.45 * glints) * uMoonlit * (1.0 - uMoon.w);
      // Rings crossing the path catch its light: a splash breaks it into bright arcs.
      col += MOONLIGHT * sheen * path * 0.6 * uMoonlit * (1.0 - uMoon.w);
    }
    col += vec3(0.8, 0.84, 0.95) * uFlash.x * 0.12;
    if (uBoat.w > 0.001) {
      vec2 q = (p - uBoat.xy) / uBoat.z;
      float ink = boatShape(q);
      // Its reflection: mirrored under the waterline, stretched a little and broken by the waves.
      vec2 qr = vec2(q.x + wave2 * 0.12, -q.y * 1.2);
      float under = boatShape(qr) * step(q.y, 0.0) * 0.4;
      col = mix(col, uInk * 0.5, max(ink, under) * uBoat.w);
      // 渔火: a small warm lamp at the canopy's mouth, and its light trembling on the water below.
      vec2 l = (q - vec2(0.52, 0.1)) * uBoat.z / S;
      float lamp = exp(-dot(l, l) / 0.000006) + exp(-length(l) / 0.012) * 0.22;
      vec2 lr = vec2((q.x - 0.52 + wave2 * 0.15) / 0.06, (q.y + 0.35) / 0.32);
      float streak = exp(-dot(lr, lr)) * step(q.y, 0.0) * (0.65 + 0.35 * sin(uTime * 3.1 + q.y * 9.0));
      col += vec3(1.0, 0.72, 0.38) * (lamp * 0.9 + streak * 0.35) * uBoat.w;
    }
    col *= 1.0 - smoothstep(0.0, 0.6, dn) * (0.25 + 0.2 * uSnow);
    col *= 1.0 + 0.05 * uMoonLight * uSkyVeil;
  }

  // Mist hugging the horizon line.
  float hd = abs(p.y - hpx) / S;
  col = mix(col, uSkyLow * 1.1, exp(-hd * 45.0) * 0.45);

  // Rice-paper grain and a soft vignette.
  if (uPost > 0.5) {
    // Per device pixel, so a high-resolution wallpaper keeps a fine grain.
    float grain = hash(floor(gl_FragCoord.xy)) - 0.5;
    float fibre = fbm(p * vec2(0.02, 0.09)) - 0.5;
    col += grain * 0.028 + fibre * 0.02;
  }
  vec2 vq = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= mix(1.0, 0.8, smoothstep(0.45, 1.15, length(vq)));

  gl_FragColor = vec4(col, 1.0);
}
`;
