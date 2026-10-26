import { describe, expect, it } from 'vitest';
import { inscriptionDate, outputSize, pickFormat } from './recorder';

describe('recording output', () => {
  it('caps the long edge at 1080 and keeps even sizes', () => {
    expect(outputSize(2880, 1800)).toEqual({ width: 1080, height: 676 });
    expect(outputSize(1170, 2532)).toEqual({ width: 500, height: 1080 });
    expect(outputSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(outputSize(801, 601)).toEqual({ width: 802, height: 602 });
  });

  it('prefers MP4, then WebM, else nothing', () => {
    expect(pickFormat(() => true)?.ext).toBe('mp4');
    expect(pickFormat((t) => t.startsWith('video/webm'))?.type).toBe('video/webm;codecs=vp9');
    expect(pickFormat(() => false)).toBeNull();
  });

  it('names an audio codec when there is sound, and records silently when it cannot', () => {
    expect(pickFormat(() => true, true)).toMatchObject({ ext: 'mp4', audio: true });
    expect(pickFormat((t) => t.startsWith('video/webm'), true)).toMatchObject({ type: 'video/webm;codecs=vp9,opus', audio: true });
    // Safari-like: MP4 video only, no audio codec on offer.
    expect(pickFormat((t) => t === 'video/mp4', true)).toMatchObject({ type: 'video/mp4', audio: false });
    expect(pickFormat(() => true)).toMatchObject({ audio: false });
  });
});

describe('the date in an inscription (题款)', () => {
  it('is written in characters, the way a painting is dated', () => {
    expect(inscriptionDate(new Date(2026, 9, 26))).toBe('二〇二六年十月廿六日');
    expect(inscriptionDate(new Date(2026, 0, 1))).toBe('二〇二六年一月一日');
    expect(inscriptionDate(new Date(2027, 11, 20))).toBe('二〇二七年十二月二十日');
    expect(inscriptionDate(new Date(2026, 4, 31))).toBe('二〇二六年五月三十一日');
    expect(inscriptionDate(new Date(2026, 1, 15))).toBe('二〇二六年二月十五日');
  });
});
