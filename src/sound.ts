// Sound (docs/02 §6.4, docs/03 §12), synthesised in the browser: no audio
// files, so nothing to license and nothing to download. Two layers:
//
// Levels were set by rendering offline and measuring: the night ambience
// sits near −28 LUFS (docs/03 §12), rain near −25, and each interaction
// peaks roughly 8–12 dB above the ambience.
//
//   ambient      the lake at night — low water, distant insects — plus rain
//                that follows the weather, so 雨声渐入 is the same smooth
//                change the picture makes. Snow hushes it all: water and
//                insects fall away and only a little wind is left.
//   interaction  paper under the brush, a water drop when a fish is born,
//                soft water for a touch, a 磬 when the moon rises, a high
//                note for a star; on a moonlit night, now and then, a far
//                temple bell (夜半钟声). Pitched notes come from the pentatonic
//                scale (宫商角徵羽), so any mix of them stays consonant.
//
// Sound is ornament, not feedback: it fades in after the first stroke, one
// sound of a kind plays at most every 200 ms, and with sound off everything
// still works. The switch is remembered on this device.

const STORE_KEY = 'wonderlab.sound';
const SAME_KIND_GAP_MS = 200;
const FADE_IN_S = 4;

// D 宫: D E F♯ A B. Step 0 is D3; five steps are an octave.
const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_HZ = 146.83;

export function pentatonicHz(step: number): number {
  const octave = Math.floor(step / 5);
  const degree = PENTATONIC[((step % 5) + 5) % 5];
  return BASE_HZ * 2 ** (octave + degree / 12);
}

/** Pan from a horizontal position in CSS pixels, kept well inside the field. */
export function panFor(x: number, width: number): number {
  if (!(width > 0)) return 0;
  return Math.max(-0.6, Math.min(0.6, (x / width) * 1.2 - 0.6));
}

export type SoundKind = 'stroke' | 'drop' | 'ripple' | 'chime' | 'star' | 'meteor' | 'bell' | 'thunder' | 'frog' | 'wings' | 'cicada';

export interface AmbientLevels {
  rain: number;
  wind: number;
  fireflies: number;
  /** Optional so older callers stay valid; 0 when absent. */
  snow?: number;
  /** 秋风, 0..1: the wind is heard. */
  autumn?: number;
  /** 0 at night, 1 at dusk. */
  dusk: number;
  /** 0 at night, 1 by day; optional so older callers stay valid. */
  day?: number;
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  // Pink-ish noise (Paul Kellet's economy filter): softer than white, closer to water.
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  // Cross-fade the ends so the loop has no click.
  const fade = Math.min(len >> 3, Math.floor(ctx.sampleRate * 0.05));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
  }
  return buf;
}

/**
 * The synthesis graph. Works on any BaseAudioContext, so it can be rendered
 * offline to check levels without speakers.
 */
export class Voices {
  readonly out: GainNode;
  private readonly noise: AudioBuffer;
  private readonly rainGain: GainNode;
  private readonly waterGain: GainNode;
  private readonly insectGain: GainNode;
  private readonly windGain: GainNode;
  private insectsAt = 0;

  constructor(private readonly ctx: BaseAudioContext) {
    this.out = ctx.createGain();
    this.noise = noiseBuffer(ctx, 4);

    // Water: low, slowly breathing.
    const water = this.loop();
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 420;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0.115;
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 0.03;
    breath.connect(depth).connect(this.waterGain.gain);
    water.connect(low).connect(this.waterGain).connect(this.out);
    breath.start();

    // Rain: brighter noise whose level follows the weather.
    const rain = this.loop(1.3);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(hp).connect(lp).connect(this.rainGain).connect(this.out);

    // Wind over snow: low, hollow noise that swells and falls very slowly.
    const wind = this.loop(2.6);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 380;
    band.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.045;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 120;
    gust.connect(gustDepth).connect(band.frequency);
    gust.start();
    wind.connect(band).connect(this.windGain).connect(this.out);

    this.insectGain = ctx.createGain();
    this.insectGain.gain.value = 1;
    this.insectGain.connect(this.out);
  }

  private loop(offset = 0): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(0, offset % this.noise.duration);
    return src;
  }

  /** A short burst of the noise buffer, from a random place in it. */
  private burst(at: number, seconds: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(at, Math.random() * (this.noise.duration - seconds - 0.1), seconds + 0.05);
    return src;
  }

  private panner(pan: number): AudioNode {
    if (typeof this.ctx.createStereoPanner !== 'function') return this.out;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.out);
    return p;
  }

  /** One decaying sine: the building block of every pitched sound here. */
  private tone(at: number, hz: number, peak: number, decay: number, dest: AudioNode, attack = 0.004): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = hz;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setTargetAtTime(0, at + attack, decay / 4);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + attack + decay * 1.5);
  }

  /** Follow the atmosphere. Smooth by construction: it only sets targets. */
  ambient(levels: AmbientLevels, at = this.ctx.currentTime): void {
    const snow = levels.snow ?? 0;
    this.rainGain.gain.setTargetAtTime(0.13 * levels.rain, at, 1.2);
    // Rain covers the lake; wind roughens it a little; snow muffles it.
    this.waterGain.gain.setTargetAtTime(0.115 * (1 - 0.5 * levels.rain) * (1 - 0.6 * snow) * (0.85 + 0.3 * levels.wind), at, 1.2);
    this.windGain.gain.setTargetAtTime(0.07 * Math.max(snow, 0.9 * (levels.autumn ?? 0)) * (0.5 + levels.wind), at, 2.5);
    // Insects at night and with fireflies, quieter in rain, gone in snow.
    // SOUND-1: the night's crickets are almost gone by day.
    const insects = (1 - levels.dusk * 0.7) * (1 - 0.85 * (levels.day ?? 0)) * (1 - levels.rain) * (1 - snow) * (0.6 + 0.4 * levels.fireflies);
    this.insectGain.gain.setTargetAtTime(insects, at, 1.5);
    if (at >= this.insectsAt) {
      this.insectsAt = at + 2 + Math.random() * 5;
      if (insects > 0.05) this.chirp(at + Math.random());
    }
  }

  /** A distant cricket: a few quick pulses of a high tone. */
  private chirp(at: number): void {
    const hz = 4200 + Math.random() * 900;
    const pan = this.ctx.createStereoPanner?.();
    const dest = pan ?? this.insectGain;
    if (pan) {
      pan.pan.value = Math.random() * 1.4 - 0.7;
      pan.connect(this.insectGain);
    }
    const pulses = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) this.tone(at + i * 0.045, hz, 0.006, 0.03, dest, 0.004);
  }

  play(kind: SoundKind, opts: { pan?: number; strength?: number } = {}, at = this.ctx.currentTime): void {
    const pan = opts.pan ?? 0;
    const strength = Math.max(0.2, Math.min(1.5, opts.strength ?? 1));
    switch (kind) {
      case 'stroke': {
        // Paper under the brush: a breath of bright noise.
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2600;
        bp.Q.value = 0.7;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.1, at + 0.015);
        g.gain.setTargetAtTime(0, at + 0.03, 0.05);
        this.burst(at, 0.3).connect(bp).connect(g).connect(this.panner(pan));
        return;
      }
      case 'drop': {
        // A water drop: a sine that falls a fifth in a few milliseconds.
        const hz = pentatonicHz(10 + Math.floor(Math.random() * 4));
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(hz * 1.5, at);
        osc.frequency.exponentialRampToValueAtTime(hz, at + 0.05);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.12, at + 0.003);
        g.gain.setTargetAtTime(0, at + 0.01, 0.06);
        osc.connect(g).connect(this.panner(pan));
        osc.start(at);
        osc.stop(at + 0.5);
        return;
      }
      case 'ripple': {
        // Soft water: a low swell of noise under a quiet low note.
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.1 * strength, at + 0.06);
        g.gain.setTargetAtTime(0, at + 0.08, 0.18);
        const dest = this.panner(pan);
        this.burst(at, 1).connect(lp).connect(g).connect(dest);
        this.tone(at, pentatonicHz(5 + Math.floor(Math.random() * 5)), 0.025 * strength, 1.2, dest, 0.02);
        return;
      }
      case 'chime': {
        // 磬: a struck stone. Inharmonic partials over a low fundamental,
        // the higher ones dying first. `strength` below 1 is a touch on the
        // moon rather than its rising.
        const f = pentatonicHz(Math.floor(Math.random() * 2));
        const partials: [number, number, number][] = [
          [1, 1, 6],
          [2.76, 0.45, 3.5],
          [5.4, 0.22, 2],
          [8.93, 0.1, 1.1],
        ];
        const dest = this.panner(pan);
        for (const [ratio, gain, decay] of partials) this.tone(at, f * ratio, 0.07 * gain * strength, decay, dest);
        return;
      }
      case 'star':
        this.tone(at, pentatonicHz(15 + Math.floor(Math.random() * 5)), 0.07, 0.9, this.panner(pan));
        return;
      case 'thunder': {
        // Thunder over the hills: low noise that swells and rolls (a few
        // slow surges), the highs gone with distance. `strength` is
        // nearness: nearer is louder and starts with a short crack.
        const low = this.ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 160 + 160 * Math.min(strength, 1);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.45 * strength, at + 0.25);
        let when = at + 0.25;
        for (let i = 0; i < 3; i++) {
          when += 0.5 + Math.random() * 0.6;
          g.gain.linearRampToValueAtTime((0.18 + Math.random() * 0.22) * strength, when);
        }
        g.gain.setTargetAtTime(0, when, 0.9);
        this.burst(at, Math.min(this.noise.duration - 0.2, 3.6)).connect(low).connect(g).connect(this.panner(pan));
        if (strength > 0.9) {
          const crack = this.ctx.createBiquadFilter();
          crack.type = 'bandpass';
          crack.frequency.value = 900;
          const cg = this.ctx.createGain();
          cg.gain.setValueAtTime(0, at);
          cg.gain.linearRampToValueAtTime(0.07, at + 0.01);
          cg.gain.setTargetAtTime(0, at + 0.02, 0.12);
          this.burst(at, 0.5).connect(crack).connect(cg).connect(this.panner(pan));
        }
        return;
      }
      case 'bell': {
        // 夜半钟声: a temple bell far across the water. A low hum with a
        // slow beat (two partials a hair apart), a few inharmonic overtones
        // that die first, a soft onset, and the highs taken off by the
        // distance. Quiet: about the level of the night itself.
        // D3, not lower: a phone's speaker cannot play the octave below.
        const f = pentatonicHz(0);
        const far = this.ctx.createBiquadFilter();
        far.type = 'lowpass';
        far.frequency.value = 1800;
        far.connect(this.panner(pan));
        const partials: [number, number, number][] = [
          [1, 1, 9],
          [1.004, 0.7, 9],
          [2, 0.4, 6],
          [2.76, 0.25, 4],
          [3.6, 0.14, 3],
          [5.4, 0.07, 2],
        ];
        for (const [ratio, gain, decay] of partials) this.tone(at, f * ratio, 0.065 * gain * strength, decay, far, 0.03);
        return;
      }
      case 'frog': {
        // 蛙声: a frog among the lotus, two or three quick low croaks, each
        // a short burst of pulses through a low, nasal resonance.
        const croaks = 2 + Math.floor(Math.random() * 2);
        const f = 150 + Math.random() * 60;
        const res = this.ctx.createBiquadFilter();
        res.type = 'bandpass';
        res.frequency.value = 520 + Math.random() * 160;
        res.Q.value = 3;
        res.connect(this.panner(pan));
        for (let c = 0; c < croaks; c++) {
          const t0 = at + c * (0.28 + Math.random() * 0.08);
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f * 1.1, t0);
          osc.frequency.linearRampToValueAtTime(f, t0 + 0.14);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0, t0);
          for (let k = 0; k < 6; k++) {
            g.gain.linearRampToValueAtTime(0.09 * strength, t0 + k * 0.025 + 0.006);
            g.gain.linearRampToValueAtTime(0.01, t0 + k * 0.025 + 0.02);
          }
          g.gain.linearRampToValueAtTime(0, t0 + 0.17);
          osc.connect(g).connect(res);
          osc.start(t0);
          osc.stop(t0 + 0.2);
        }
        return;
      }
      case 'wings': {
        // 惊鹊: a magpie leaving the willow, four soft beats of air, each a
        // little fainter, no call (Codex: the wings alone say it has gone).
        const band = this.ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 620;
        band.Q.value = 0.7;
        band.connect(this.panner(pan));
        for (let i = 0; i < 4; i++) {
          const t0 = at + i * (0.12 + Math.random() * 0.02);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.07 * strength * (1 - i * 0.18), t0 + 0.018);
          g.gain.setTargetAtTime(0, t0 + 0.02, 0.03);
          this.burst(t0, 0.12).connect(g).connect(band);
        }
        return;
      }
      case 'cicada': {
        // 鸣蝉: from deep in the trees' shade, a thin, slightly rough long
        // note: a narrow band of noise, its grain a fast flutter, that comes
        // up gently, holds two or three seconds, and fades. Kept behind the
        // picture's other sounds; a far one (low strength) is duller.
        const hold = 2 + Math.random() * 1.2;
        const band = this.ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.setValueAtTime(4800 + Math.random() * 500, at);
        band.frequency.linearRampToValueAtTime(5400 + Math.random() * 400, at + 1 + hold * 0.5);
        band.frequency.linearRampToValueAtTime(4700, at + hold + 2);
        band.Q.value = 5;
        const grain = this.ctx.createGain();
        grain.gain.value = 0.55;
        const flutter = this.ctx.createOscillator();
        flutter.frequency.value = 120 + Math.random() * 40;
        const depth = this.ctx.createGain();
        depth.gain.value = 0.45;
        flutter.connect(depth).connect(grain.gain);
        const far = this.ctx.createBiquadFilter();
        far.type = 'lowpass';
        far.frequency.value = 3000 + 4000 * Math.min(strength, 1);
        const g = this.ctx.createGain();
        const peak = 0.05 * strength;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + 0.9);
        g.gain.linearRampToValueAtTime(peak * 0.85, at + 0.9 + hold);
        g.gain.setTargetAtTime(0, at + 0.9 + hold, 0.5);
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        src.start(at, Math.random() * this.noise.duration);
        src.stop(at + hold + 3.5);
        src.connect(band).connect(grain).connect(far).connect(g).connect(this.panner(pan));
        flutter.start(at);
        flutter.stop(at + hold + 3.5);
        return;
      }
      case 'meteor': {
        // A high glissando that falls away, like the light.
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(pentatonicHz(20), at);
        osc.frequency.exponentialRampToValueAtTime(pentatonicHz(12), at + 0.7);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.05, at + 0.05);
        g.gain.setTargetAtTime(0, at + 0.3, 0.2);
        osc.connect(g).connect(this.panner(pan));
        osc.start(at);
        osc.stop(at + 1.6);
        return;
      }
    }
  }
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * The live sound: one AudioContext, made on the first stroke (a user
 * gesture, which browsers require before audio may play).
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private voices: Voices | null = null;
  private master: GainNode | null = null;
  private tap: MediaStreamAudioDestinationNode | null = null;
  private lastPlayed = new Map<SoundKind, number>();
  private ambientAt = 0;
  private listeners = new Set<(on: boolean) => void>();
  private woken = false;
  enabled = readEnabled();

  get supported(): boolean {
    return typeof window !== 'undefined' && typeof window.AudioContext === 'function';
  }

  /** Start the ambient layer, fading in. Call from a user gesture. */
  wake(): void {
    this.woken = true;
    if (!this.enabled || !this.supported) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.voices = new Voices(this.ctx);
      this.voices.out.connect(this.master);
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    void this.ctx.resume().catch(() => undefined);
    const now = this.ctx.currentTime;
    this.master!.gain.cancelScheduledValues(now);
    this.master!.gain.setValueAtTime(this.master!.gain.value, now);
    this.master!.gain.linearRampToValueAtTime(1, now + FADE_IN_S);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(STORE_KEY, on ? 'on' : 'off');
    } catch {
      // Private mode: the choice lasts for this visit.
    }
    if (on) {
      // The switch itself is a gesture; if the world has been drawn in, start now.
      if (this.woken) this.wake();
    } else if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.3);
      window.setTimeout(() => {
        if (!this.enabled) void this.ctx?.suspend();
      }, 400);
    }
    for (const l of this.listeners) l(on);
  }

  subscribe(fn: (on: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  play(kind: SoundKind, opts?: { pan?: number; strength?: number }): void {
    if (!this.enabled || !this.voices || this.ctx?.state !== 'running') return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(kind) ?? -Infinity) < SAME_KIND_GAP_MS) return;
    this.lastPlayed.set(kind, now);
    this.voices.play(kind, opts);
  }

  /** Called every frame; passed on a few times a second, which is plenty for targets with second-long glides. */
  ambient(levels: AmbientLevels): void {
    if (!this.enabled || !this.voices || this.ctx?.state !== 'running') return;
    const now = performance.now();
    if (now - this.ambientAt < 250) return;
    this.ambientAt = now;
    this.voices.ambient(levels);
  }

  /** What is playing, as a stream a recording can include. Null with sound off. */
  stream(): MediaStream | null {
    if (!this.enabled || !this.ctx || !this.master) return null;
    if (!this.tap) {
      this.tap = this.ctx.createMediaStreamDestination();
      this.master.connect(this.tap);
    }
    return this.tap.stream;
  }

  private onVisibility = (): void => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else if (this.enabled) void this.ctx.resume();
  };

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.ctx?.close();
    this.ctx = null;
    this.voices = null;
    this.master = null;
    this.tap = null;
  }
}

export const sound = new Sound();
