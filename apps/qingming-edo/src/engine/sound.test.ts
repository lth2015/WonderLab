import { afterEach, describe, expect, it, vi } from 'vitest';

let sourceStarts = 0;

// A fake WebAudio, enough for unlock(): records bus gains and resume() calls.
class Param {
  value = 1;
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  pan = new Param();
  detune = new Param();
  threshold = new Param();
  ratio = new Param();
  type = '';
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  connect<T>(d: T) {
    return d;
  }
  start() { sourceStarts++; }
  stop() {}
}
class FakeContext {
  static made: FakeContext[] = [];
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = new Node();
  gains: Node[] = [];
  resumeCalls = 0;
  onstatechange: (() => void) | null = null;
  constructor() {
    FakeContext.made.push(this);
  }
  createGain() {
    const g = new Node();
    this.gains.push(g);
    return g;
  }
  createDynamicsCompressor = () => new Node();
  createBiquadFilter = () => new Node();
  createOscillator = () => new Node();
  createBufferSource = () => new Node();
  createStereoPanner = () => new Node();
  createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) });
  resume() {
    this.resumeCalls++;
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
}

async function freshSound() {
  vi.resetModules();
  FakeContext.made = [];
  sourceStarts = 0;
  vi.stubGlobal('window', { AudioContext: FakeContext, setTimeout: vi.fn(() => 0) });
  vi.stubGlobal('document', { hidden: false, addEventListener() {} });
  vi.stubGlobal('navigator', {});
  return (await import('./sound')).sound;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('音 (review fixes from Codex, PR127)', () => {
  it('a save set to 切 is silent from the first moment: the buses start at 0', async () => {
    const sound = await freshSound();
    sound.setLevels({ ambient: 0, ui: 0, music: 0 });
    expect(FakeContext.made).toHaveLength(0); // nothing before the first gesture
    sound.unlock();
    const ctx = FakeContext.made[0];
    // master is the first gain; the three buses follow
    expect(ctx.gains.slice(1, 4).map((g) => g.gain.value)).toEqual([0, 0, 0]);
  });
  it('the saved levels are the buses’ starting gains (squared for loudness)', async () => {
    const sound = await freshSound();
    sound.setLevels({ ambient: 1, ui: 0.6, music: 0 });
    sound.unlock();
    expect(FakeContext.made[0].gains.slice(1, 4).map((g) => +g.gain.value.toFixed(2))).toEqual([1, 0.36, 0]);
  });
  it('an interrupted context (iOS) is resumed on the next gesture and when its state changes', async () => {
    const sound = await freshSound();
    sound.unlock();
    const ctx = FakeContext.made[0];
    ctx.state = 'interrupted';
    sound.unlock();
    expect(ctx.resumeCalls).toBe(1);
    ctx.onstatechange?.();
    expect(ctx.resumeCalls).toBe(2);
    ctx.state = 'running';
    sound.unlock();
    expect(ctx.resumeCalls).toBe(2);
  });
});

describe('時の鐘', () => {
  it('rings only when the street sound is on and the context runs', async () => {
    const sound = await freshSound();
    expect(sound.timeBell()).toBe(false); // nothing before the first gesture
    sound.setLevels({ ambient: 0, ui: 0.6, music: 0.35 });
    sound.unlock();
    expect(sound.timeBell()).toBe(false);
    sound.setLevels({ ambient: 0.6, ui: 0.6, music: 0.35 });
    expect(sound.timeBell()).toBe(true);
    FakeContext.made[0].state = 'suspended';
    expect(sound.timeBell()).toBe(false);
  });
});

describe('quiet ambient mix', () => {
  it('starts occasional ambience no sooner than 6.5 seconds and mutes active buses immediately', async () => {
    const sound = await freshSound();
    sound.unlock();
    const ctx = FakeContext.made[0];
    const delays = vi.mocked(window.setTimeout).mock.calls.map(call => call[1] as number);
    expect(delays).toHaveLength(3);
    expect(delays.every(delay => delay >= 6500)).toBe(true);
    sound.setLevels({ ambient: 0, ui: 0, music: 0 });
    expect(ctx.gains.slice(1, 4).map(g => g.gain.value)).toEqual([0, 0, 0]);
  });
  it('leaves a quiet gap between occasional sounds and skips them in a hidden tab', async () => {
    const sound = await freshSound();
    sound.unlock();
    const ctx = FakeContext.made[0];
    const timers = vi.mocked(window.setTimeout).mock.calls.slice(0, 3);
    const fire = (index: number) => (timers[index][0] as () => void)();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    ctx.currentTime = 10;
    const beds = sourceStarts;
    fire(0);
    expect(sourceStarts).toBeGreaterThan(beds);
    const footsteps = sourceStarts;
    fire(1);
    expect(sourceStarts).toBe(footsteps);
    ctx.currentTime = 19;
    fire(1);
    expect(sourceStarts).toBeGreaterThan(footsteps);
    const birds = sourceStarts;
    Object.assign(document, { hidden: true });
    ctx.currentTime = 40;
    fire(0);
    expect(sourceStarts).toBe(birds);
  });
});
