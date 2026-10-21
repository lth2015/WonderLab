import { describe, expect, it } from 'vitest';
import { outputSize, pickFormat } from './recorder';

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
});
