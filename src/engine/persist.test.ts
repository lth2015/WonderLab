import { describe, expect, it } from 'vitest';
import { AWAY_MAX, parseWorld, SAVE_VERSION, type WorldSave } from './persist';

const valid: WorldSave = {
  version: SAVE_VERSION,
  atmosphere: { timeOfDay: 'dusk', weather: 'rain', palette: 'warm', wind: 0.4, intensity: 0.7 },
  fish: [{ spine: [[0.2, 0.3], [0.25, 0.32], [0.3, 0.31]], drawSpeed: 0.8, seed: 12.5, patch: 0.7 }],
  moon: { x: 0.7, y: 0.8, r: 0.05, phase: 'crescent', dark: [1, 0] },
  planets: [[0.3, 0.85, 0.02, 1]],
  stars: [[0.1, 0.9]],
  clouds: [[0.5, 0.75, 0.2]],
};

describe('parseWorld', () => {
  it('round-trips a valid save', () => {
    expect(parseWorld(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it('keeps a meteor fish glowing, and nothing else', () => {
    const fish = [
      { ...valid.fish[0], glow: true },
      { ...valid.fish[0], glow: 'yes' },
    ];
    const w = parseWorld(JSON.parse(JSON.stringify({ ...valid, fish })));
    expect(w!.fish[0].glow).toBe(true);
    expect('glow' in w!.fish[1]).toBe(false);
  });

  it('keeps each fish’s variety, its being the first, and where it came from', () => {
    const origin = { stroke: [[0.2, 0.3, 0], [0.25, 0.32, 120], [0.3, 0.31, 260]], speed: 1.4, curviness: 0.3, family: 'brisk', pointer: 'touch', born: 1 };
    const fish = [{ ...valid.fish[0], variety: 'kohaku', honmei: true, origin }];
    const w = parseWorld(JSON.parse(JSON.stringify({ ...valid, fish })));
    expect(w!.fish[0]).toEqual(fish[0]);
  });

  it('drops a malformed origin or variety, keeping the fish', () => {
    const bad = [
      { stroke: [[0.2, 0.3, 0]], speed: 1, curviness: 0, family: 'brisk', pointer: 'mouse', born: 1 },
      { stroke: [[0.2, 0.3, 0], [0.3, 0.3, 10]], speed: 1, curviness: 0, family: 'gold', pointer: 'mouse', born: 1 },
      { stroke: [[0.2, 0.3, 0], [0.3, 0.3, 10]], speed: -1, curviness: 0, family: 'calm', pointer: 'mouse', born: 1 },
      { stroke: [[0.2, 0.3, 0], [0.3, 0.3, 10]], speed: 1, curviness: 0, family: 'calm', pointer: 'mouse', born: 0 },
    ];
    for (const origin of bad) {
      const w = parseWorld(JSON.parse(JSON.stringify({ ...valid, fish: [{ ...valid.fish[0], origin, variety: '<b>' }] })));
      expect(w!.fish).toHaveLength(1);
      expect('origin' in w!.fish[0]).toBe(false);
      expect('variety' in w!.fish[0]).toBe(false);
    }
  });

  it('keeps when the world was saved and when each fish was born, and drops nonsense', () => {
    const w = parseWorld(JSON.parse(JSON.stringify({ ...valid, savedAt: 1761300000000, fish: [{ ...valid.fish[0], bornAt: 1761200000000 }] })));
    expect(w!.savedAt).toBe(1761300000000);
    expect(w!.fish[0].bornAt).toBe(1761200000000);
    const bad = parseWorld(JSON.parse(JSON.stringify({ ...valid, savedAt: 'yesterday', fish: [{ ...valid.fish[0], bornAt: -5 }] })));
    expect('savedAt' in bad!).toBe(false);
    expect('bornAt' in bad!.fish[0]).toBe(false);
  });

  it('keeps a received fish’s gift id and seal, and drops a malformed one', () => {
    const ok = parseWorld(JSON.parse(JSON.stringify({ ...valid, fish: [{ ...valid.fish[0], gift: { id: 'kgwurf', seal: '月' } }] })));
    expect(ok!.fish[0].gift).toEqual({ id: 'kgwurf', seal: '月' });
    const badSeal = parseWorld(JSON.parse(JSON.stringify({ ...valid, fish: [{ ...valid.fish[0], gift: { id: 'kgwurf', seal: '<b>' } }] })));
    expect(badSeal!.fish[0].gift).toEqual({ id: 'kgwurf' });
    const badId = parseWorld(JSON.parse(JSON.stringify({ ...valid, fish: [{ ...valid.fish[0], gift: { id: '../../x' } }] })));
    expect('gift' in badId!.fish[0]).toBe(false);
  });

  it('rejects other versions and non-objects', () => {
    expect(parseWorld({ ...valid, version: 2 })).toBeNull();
    expect(parseWorld(null)).toBeNull();
    expect(parseWorld('world')).toBeNull();
    expect(parseWorld([])).toBeNull();
  });

  it('drops malformed entries and repairs enums and ranges', () => {
    const w = parseWorld({
      ...valid,
      atmosphere: { timeOfDay: 'noon', weather: 'hail', palette: 'neon', wind: 7, intensity: 'x' },
      fish: [{ spine: [[0.1, 0.1]], drawSpeed: 1, seed: 1, patch: 0 }, { spine: 'no' }, valid.fish[0]],
      moon: { x: 0.5, y: 0.5, r: -1, phase: 'full', dark: [0, 1] },
      stars: [[0.1, 0.2], [NaN, 0.3], [0.1], [9, 9]],
      clouds: [[0.5, 0.5, 0.1], [0.5, 0.5, -1]],
    });
    expect(w!.atmosphere).toEqual({ timeOfDay: 'night', weather: 'clear', palette: 'serene', wind: 1, intensity: 0.5 });
    expect(w!.fish).toHaveLength(1);
    expect(w!.moon).toBeNull();
    expect(w!.stars).toEqual([[0.1, 0.2]]);
    expect(w!.clouds).toEqual([[0.5, 0.5, 0.1]]);
  });

  it('caps how much it restores', () => {
    const many = { ...valid, fish: Array(50).fill(valid.fish[0]), stars: Array(100).fill([0.5, 0.9]) };
    const w = parseWorld(many)!;
    expect(w.fish.length).toBeLessThanOrEqual(12);
    expect(w.stars.length).toBeLessThanOrEqual(24);
  });

  it('keeps the fish that swam off when the lake was full (在远处), validated like the rest', () => {
    const far = { ...valid.fish[0], seed: 3, honmei: undefined, bornAt: 1000, origin: undefined };
    const w = parseWorld({ ...valid, away: [far, { spine: 'nope' }, 'fish'] })!;
    expect(w.away).toEqual([{ spine: far.spine, drawSpeed: 0.8, seed: 3, patch: 0.7, bornAt: 1000 }]);
    expect(w.fish).toHaveLength(1);
  });

  it('keeps how much a fish had grown when saved, within range', () => {
    const fish = [1.06, 0.5, 5, 'big'].map((size) => ({ ...valid.fish[0], size }));
    expect(parseWorld({ ...valid, fish })!.fish.map((f) => f.size)).toEqual([1.06, undefined, undefined, undefined]);
  });

  it('reads saves from before 在远处 as having none, and keeps at most AWAY_MAX, the most recent', () => {
    expect(parseWorld(valid)!.away).toBeUndefined();
    const many = Array.from({ length: AWAY_MAX + 15 }, (_, i) => ({ ...valid.fish[0], seed: i }));
    const w = parseWorld({ ...valid, away: many })!;
    expect(w.away).toHaveLength(AWAY_MAX);
    expect(w.away![0].seed).toBe(15);
  });

  it('a full distance of fish fits the browser with room to spare', () => {
    // A fish as engine.saveFish writes it: 32 spine points and a 48-point origin, at four decimals.
    const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
    const fish = {
      spine: Array.from({ length: 32 }, (_, i): [number, number] => [r4(0.123456 + i * 0.0137), r4(0.345678 + Math.sin(i) * 0.01)]),
      drawSpeed: 0.8123,
      seed: 37.123456,
      patch: 0.71234,
      variety: 'kohaku',
      origin: {
        stroke: Array.from({ length: 48 }, (_, i): [number, number, number] => [r4(0.1234 + i * 0.0091), r4(0.4567 + Math.cos(i) * 0.02), i * 3]),
        speed: 0.61,
        curviness: 0.42,
        family: 'brisk',
        pointer: 'touch',
        born: 123,
      },
      bornAt: 1792849180122,
      size: 1.0712,
    };
    const bytes = JSON.stringify({ ...valid, away: Array(AWAY_MAX).fill(fish) }).length * 2; // UTF-16 in localStorage
    expect(bytes).toBeLessThan(2.5 * 1024 * 1024);
  });

  it('reads saves from before planets as having none, and keeps planets in range', () => {
    const { planets: _omit, ...old } = valid;
    expect(parseWorld(JSON.parse(JSON.stringify(old)))?.planets).toEqual([]);
    const w = parseWorld({
      ...valid,
      planets: [[0.3, 0.8, 0.02, 7.2], [0.3, 0.8, 0.5, 0], [0.3, 'x', 0.02, 0], [0.1, 0.9, 0.01, 2], [0.2, 0.9, 0.01, 0], [0.4, 0.9, 0.01, 1]],
    });
    // At most three are read, as with every list; malformed ones among them are dropped.
    expect(w?.planets).toEqual([[0.3, 0.8, 0.02, 1]]);
    const four = parseWorld({ ...valid, planets: [[0.1, 0.9, 0.01, 0], [0.2, 0.9, 0.01, 1], [0.3, 0.9, 0.01, 2], [0.4, 0.9, 0.01, 0]] });
    expect(four?.planets).toHaveLength(3);
  });
});

describe('branches (近岸)', () => {
  it('keeps valid branches and drops malformed ones', () => {
    const base = { version: 1, atmosphere: { timeOfDay: 'day', weather: 'clear', palette: 'serene', wind: 0.2, intensity: 0.5 }, fish: [], moon: null, planets: [], stars: [], clouds: [] };
    const w = parseWorld({
      ...base,
      branches: [
        { points: [[0.1, 0.1], [0.2, 0.15], [0.3, 0.18]], lively: 0.4, seed: 12345 },
        { points: [[0.1, 0.1]], lively: 0.4, seed: 1 },
        { points: [[0.1, 0.1], [9, 9]], lively: 0.4, seed: 2 },
        'nonsense',
      ],
    });
    expect(w?.branches).toEqual([{ points: [[0.1, 0.1], [0.2, 0.15], [0.3, 0.18]], lively: 0.4, seed: 12345 }]);
    expect(parseWorld(base)?.branches).toBeUndefined();
  });
});
