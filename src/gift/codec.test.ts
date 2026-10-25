import { describe, expect, it } from 'vitest';
import { syntheticStudy } from '../collect/synth';
import { resampleTimed, strokeStyle } from '../engine/koi-style';
import { cleanSeal, crc32, decodeGift, encodeGift, giftLink, MAX_PAYLOAD, type GiftFish } from './codec';

const sample: GiftFish = {
  stroke: [
    [0, 0, 0],
    [0.05, 0.012, 80],
    [0.11, 0.02, 170],
    [0.18, 0.015, 260],
    [0.24, -0.004, 360],
  ],
  variety: 'kohaku',
  seed: 42.123,
  speed: 0.83,
  curviness: 0.41,
  family: 'brisk',
  pointer: 'touch',
};

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

describe('gift codec', () => {
  it('round-trips a fish within the stored precision', () => {
    const r = decodeGift(encodeGift({ ...sample, seal: '月' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.gift;
    expect(g).toMatchObject({ variety: 'kohaku', family: 'brisk', pointer: 'touch', seal: '月' });
    expect(near(g.seed, sample.seed, 0.002)).toBe(true);
    expect(near(g.speed, sample.speed, 0.001)).toBe(true);
    expect(near(g.curviness, sample.curviness, 0.01)).toBe(true);
    g.stroke.forEach(([x, y, t], i) => {
      expect(near(x, sample.stroke[i][0], 1 / 1024)).toBe(true);
      expect(near(y, sample.stroke[i][1], 1 / 1024)).toBe(true);
      expect(near(t, sample.stroke[i][2], 8)).toBe(true);
    });
  });

  it('gives the same link the same id, so a gift is received once', () => {
    const a = decodeGift(encodeGift(sample));
    const b = decodeGift(encodeGift(sample));
    const c = decodeGift(encodeGift({ ...sample, seed: 7 }));
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(a.id).toBe(b.id);
      expect(a.id).not.toBe(c.id);
    }
  });

  it('turns away a damaged, truncated, foreign or oversized link without throwing', () => {
    const good = encodeGift(sample);
    const flip = good.slice(0, -3) + (good.at(-3) === 'A' ? 'B' : 'A') + good.slice(-2);
    expect(decodeGift(flip)).toEqual({ ok: false, reason: 'damaged' });
    expect(decodeGift(good.slice(0, 12))).toEqual({ ok: false, reason: 'damaged' });
    expect(decodeGift('v2.' + good.slice(3))).toEqual({ ok: false, reason: 'version' });
    expect(decodeGift('hello')).toEqual({ ok: false, reason: 'version' });
    expect(decodeGift('v1.<script>')).toEqual({ ok: false, reason: 'damaged' });
    expect(decodeGift('v1.' + 'A'.repeat(MAX_PAYLOAD + 1))).toEqual({ ok: false, reason: 'too_long' });
  });

  it('a valid checksum is not trust: absurd values are still refused', () => {
    // Hand-build a payload whose stroke jumps ten screens: a correct CRC, impossible content.
    const huge = encodeGift({ ...sample, stroke: [[0, 0, 0], [10, 10, 10]] });
    expect(decodeGift(huge).ok).toBe(false);
  });

  it('keeps one letter or ideograph as the seal, and nothing else', () => {
    expect(cleanSeal('李明')).toBe('李');
    expect(cleanSeal(' 月 ')).toBe('月');
    expect(cleanSeal('<')).toBeUndefined();
    expect(cleanSeal('')).toBeUndefined();
    expect(cleanSeal(undefined)).toBeUndefined();
  });

  it('puts the gift after #, so it never reaches a server', () => {
    const link = giftLink('https://want.world/', sample);
    expect(link.startsWith('https://want.world/#gift=v1.')).toBe(true);
    expect(new URL(link).search).toBe('');
  });

  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });
});

describe('how long a gift link is (docs/gift-protocol.md §2.3)', () => {
  it('fish strokes from the synthetic study stay well under the limit', () => {
    const lengths: number[] = [];
    for (const session of syntheticStudy()) {
      for (const s of session.samples.filter((x) => ['line', 's', 'u', 'half', 'fish'].includes(x.category))) {
        const pts = s.points.map(([x, y, t]) => ({ x, y: s.height - y, t }));
        const minDim = Math.min(s.width, s.height);
        const style = strokeStyle(pts, minDim, s.pointerType);
        const timed = resampleTimed(pts, Math.max(2, Math.min(pts.length, 48)));
        const stroke = timed.map((p): [number, number, number] => [(p.x - timed[0].x) / minDim, (p.y - timed[0].y) / minDim, p.t - timed[0].t]);
        const payload = encodeGift({ stroke, variety: 'showa', seed: 63.2, speed: style.speed, curviness: style.curviness, family: style.family, pointer: s.pointerType, seal: '月' });
        lengths.push(payload.length);
      }
    }
    lengths.sort((a, b) => a - b);
    const q = (p: number) => lengths[Math.round(p * (lengths.length - 1))];
    console.log(`gift payload chars over ${lengths.length} strokes: min ${q(0)}, median ${q(0.5)}, p95 ${q(0.95)}, max ${q(1)}`);
    expect(q(1)).toBeLessThan(MAX_PAYLOAD / 2);
  });
});
