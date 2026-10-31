import type { SoundLevels, TimeOfDay } from '../contract';

// 音 (spec: 音と音楽). Everything is made here with WebAudio, from noise and
// simple tones: no recorded sound, so nothing to license. Footsteps, the
// street's murmur, water, birds, paper and tools come first; the music is a few
// plucked notes now and then, with long silence between (余白).
//
// - Nothing sounds until the player has touched the page (browsers require it,
//   and the spec asks for it); `unlock()` is called from the first gesture.
// - On iOS, WebAudio follows the silent switch; `audioSession.type = 'ambient'`
//   asks for that explicitly where Safari offers it, and lets other audio mix.
// - Three levels (ambient, UI, music) set in 設定; 0 means silent. Every sound
//   accompanies something shown on screen, so the game is whole without sound.
// - When the tab is hidden the context is suspended.

export const DEFAULT_LEVELS: SoundLevels = { ambient: 0.6, ui: 0.6, music: 0.35 };
export const LEVEL_STEPS = [0, 0.35, 0.6, 1] as const;

export type Cue = 'tap' | 'turn' | 'react' | 'page' | 'coin' | 'open' | 'close';

/** Where water can be heard, in scene units: centre, reach, loudness. */
const WATER = [
  { x: 13300, r: 1100, g: 1 }, // the river under the bridge
  { x: 6000, r: 1300, g: 0.8 }, // the canal bank and jetty
  { x: 1125, r: 600, g: 0.35 }, // the garden pond
];
/** How busy the street is, by scene x (shops on the right, the quiet garden on the left). */
function busyAt(x: number): number {
  if (x > 12600) return 0.55; // the bridge foot, open to the river
  if (x > 7000) return 1;
  if (x > 3000) return 0.7;
  return 0.25;
}
function waterAt(x: number): number {
  return Math.min(1, WATER.reduce((a, w) => a + w.g * Math.max(0, 1 - Math.abs(x - w.x) / w.r), 0));
}

// 陽音階 on D: D E G A B, two octaves
const YO = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99];

type Ctx = AudioContext;

class SoundEngine {
  private ctx: Ctx | null = null;
  private bus: { ambient: GainNode; ui: GainNode; music: GainNode } | null = null;
  private murmur: GainNode | null = null;
  private water: GainNode | null = null;
  private wind: GainNode | null = null;
  private levels: SoundLevels = DEFAULT_LEVELS;
  private x = 12505;
  private tod: TimeOfDay = 'morning';
  private timers: number[] = [];
  private noiseBuf: AudioBuffer | null = null;

  /** True once a context exists (after the first gesture, where WebAudio is available). */
  get started(): boolean {
    return !!this.ctx;
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'ambient';
    } catch {
      /* not offered */
    }
    let ctx: Ctx;
    try {
      ctx = new AC();
    } catch {
      return;
    }
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.8;
    // a gentle limiter so stacked cues never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    const mk = () => {
      const g = ctx.createGain();
      g.connect(master);
      return g;
    };
    this.bus = { ambient: mk(), ui: mk(), music: mk() };
    this.noiseBuf = this.makeNoise(ctx);
    this.buildBeds(ctx);
    this.apply();
    this.place(this.x, true);
    this.schedule();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setLevels(l: SoundLevels): void {
    this.levels = l;
    this.apply();
  }

  setTime(t: TimeOfDay): void {
    this.tod = t;
    this.place(this.x);
  }

  /** The camera's centre moved: water and murmur follow it. */
  place(x: number, now = false): void {
    this.x = x;
    const ctx = this.ctx;
    if (!ctx || !this.murmur || !this.water || !this.wind) return;
    const t = ctx.currentTime;
    const eve = this.tod === 'evening' ? 0.6 : this.tod === 'noon' ? 1.1 : 0.85;
    const k = now ? 0.01 : 0.6;
    this.murmur.gain.setTargetAtTime(0.34 * busyAt(x) * eve, t, k);
    this.water.gain.setTargetAtTime(0.45 * waterAt(x), t, k);
    this.wind.gain.setTargetAtTime(x < 3000 ? 0.09 : 0.05, t, k);
  }

  cue(c: Cue): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.levels.ui <= 0 || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.005;
    const out = this.bus.ui;
    switch (c) {
      case 'tap': // a soft touch of paper
        this.burst(out, t, 0.06, 2600, 1.2, 0.18);
        break;
      case 'turn': // a dialogue line turned, quieter still
        this.burst(out, t, 0.05, 3400, 1.5, 0.08);
        break;
      case 'open': // a sheet lifted
        this.sweep(out, t, 0.22, 900, 3200, 0.14);
        break;
      case 'close':
        this.sweep(out, t, 0.18, 2800, 800, 0.1);
        break;
      case 'react': // a wooden knock
        this.knock(out, t, 520, 0.22);
        this.knock(out, t + 0.09, 470, 0.12);
        break;
      case 'page': // a brush drawn across paper, then the page laid down
        this.sweep(out, t, 0.6, 600, 2400, 0.16);
        this.burst(out, t + 0.62, 0.12, 1400, 0.9, 0.2);
        break;
      case 'coin': // two coins meeting
        this.bell(out, t, 2310, 0.12, 0.5);
        this.bell(out, t + 0.11, 2650, 0.1, 0.45);
        break;
    }
  }

  // ------------------------------------------------------------- the beds

  private buildBeds(ctx: Ctx): void {
    const bus = this.bus!.ambient;
    // the street's murmur: brown-ish noise, voice band, slowly breathing
    this.murmur = ctx.createGain();
    this.murmur.gain.value = 0;
    const m = this.loop(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    m.connect(bp).connect(lp).connect(this.lfo(ctx, 0.07, 0.35)).connect(this.murmur).connect(bus);
    // water: low noise with a slow lap
    this.water = ctx.createGain();
    this.water.gain.value = 0;
    const w = this.loop(ctx);
    const wl = ctx.createBiquadFilter();
    wl.type = 'lowpass';
    wl.frequency.value = 700;
    const wh = ctx.createBiquadFilter();
    wh.type = 'highpass';
    wh.frequency.value = 120;
    w.connect(wl).connect(wh).connect(this.lfo(ctx, 0.23, 0.5)).connect(this.water).connect(bus);
    // wind, very faint, high and moving
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    const n = this.loop(ctx);
    const nb = ctx.createBiquadFilter();
    nb.type = 'bandpass';
    nb.Q.value = 1.4;
    nb.frequency.value = 1500;
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.05;
    const depth = ctx.createGain();
    depth.gain.value = 700;
    sweep.connect(depth).connect(nb.frequency);
    sweep.start();
    n.connect(nb).connect(this.lfo(ctx, 0.11, 0.6)).connect(this.wind).connect(bus);
  }

  /** Occasional things: footsteps, birds, a phrase of music. */
  private schedule(): void {
    const every = (min: number, max: number, fn: () => void) => {
      const go = () => {
        this.timers.push(window.setTimeout(() => {
          if (this.ctx?.state === 'running') fn();
          go();
        }, min + Math.random() * (max - min)));
      };
      go();
    };
    // geta on the street: a pair of steps, more where it is busy
    every(900, 2600, () => {
      if (this.levels.ambient <= 0 || Math.random() > busyAt(this.x)) return;
      const t = this.ctx!.currentTime;
      const pan = Math.random() * 1.6 - 0.8;
      const steps = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < steps; i++) this.step(t + i * (0.32 + Math.random() * 0.06), pan, 0.05 + Math.random() * 0.04);
    });
    // sparrows: mostly in the morning, near trees and the garden
    every(3000, 9000, () => {
      if (this.levels.ambient <= 0) return;
      const chance = (this.tod === 'morning' ? 0.8 : this.tod === 'noon' ? 0.4 : 0.15) * (this.x < 3000 || this.x > 12800 ? 1 : 0.6);
      if (Math.random() > chance) return;
      const t = this.ctx!.currentTime;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.chirp(t + i * 0.13, 3800 + Math.random() * 900);
    });
    // music: a few notes, then a long rest
    every(18000, 42000, () => {
      if (this.levels.music <= 0) return;
      this.phrase();
    });
  }

  private phrase(): void {
    const ctx = this.ctx!;
    const n = 3 + Math.floor(Math.random() * 3);
    let i = 2 + Math.floor(Math.random() * 4);
    let t = ctx.currentTime + 0.1;
    for (let k = 0; k < n; k++) {
      this.pluck(this.bus!.music, t, YO[i], 0.16 - k * 0.015);
      i = Math.max(0, Math.min(YO.length - 1, i + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      t += [0.45, 0.6, 0.9, 1.2][Math.floor(Math.random() * 4)];
    }
  }

  // ------------------------------------------------------------- voices

  private makeNoise(ctx: Ctx): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    // pinkish: white noise through a one-pole lowpass
    let y = 0;
    for (let i = 0; i < len; i++) {
      y = 0.97 * y + 0.03 * (Math.random() * 2 - 1);
      d[i] = y * 6 + (Math.random() * 2 - 1) * 0.15;
    }
    return b;
  }

  private loop(ctx: Ctx): AudioBufferSourceNode {
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 2);
    return s;
  }

  /** A gain that breathes between (1 − depth) and 1 at `hz`. */
  private lfo(ctx: Ctx, hz: number, depth: number): GainNode {
    const g = ctx.createGain();
    g.gain.value = 1 - depth / 2;
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const d = ctx.createGain();
    d.gain.value = depth / 2;
    o.connect(d).connect(g.gain);
    o.start();
    return g;
  }

  private burst(out: AudioNode, t: number, dur: number, freq: number, q: number, vol: number, pan = 0): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    s.connect(f).connect(g).connect(p).connect(out);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  private sweep(out: AudioNode, t: number, dur: number, f0: number, f1: number, vol: number): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 1.2, dur + 0.05);
  }

  private step(t: number, pan: number, vol: number): void {
    this.burst(this.bus!.ambient, t, 0.045, 1800 + Math.random() * 600, 4, vol, pan);
    this.knock(this.bus!.ambient, t, 300 + Math.random() * 80, vol * 0.6, pan);
  }

  private knock(out: AudioNode, t: number, freq: number, vol: number, pan = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(out);
    o.start(t);
    o.stop(t + 0.1);
  }

  private bell(out: AudioNode, t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!;
    for (const [mul, v] of [
      [1, 1],
      [2.76, 0.4],
      [5.4, 0.2],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / mul);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur);
    }
  }

  private chirp(t: number, f: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.04);
    o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.4 - 0.7;
    o.connect(g).connect(p).connect(this.bus!.ambient);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** A koto-like pluck: two slightly detuned partials and a fast decay. */
  private pluck(out: AudioNode, t: number, f: number, vol: number): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 1.2);
    lp.connect(out);
    for (const [type, mul, v, det] of [
      ['triangle', 1, 1, 0],
      ['sine', 2, 0.35, 4],
      ['sine', 3, 0.12, -3],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2 / mul);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + 2.3);
    }
  }

  // ------------------------------------------------------------- state

  private apply(): void {
    if (!this.ctx || !this.bus) return;
    const t = this.ctx.currentTime;
    // perceived loudness: square the slider
    for (const k of ['ambient', 'ui', 'music'] as const) this.bus[k].gain.setTargetAtTime(this.levels[k] ** 2, t, 0.05);
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };
}

export const sound = new SoundEngine();

/** The saved levels, or the defaults for a save made before sound existed. */
export function levelsOf(s: { sound?: SoundLevels }): SoundLevels {
  const l = s.sound;
  const ok = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 1;
  return l && ok(l.ambient) && ok(l.ui) && ok(l.music) ? l : DEFAULT_LEVELS;
}
