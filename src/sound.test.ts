import { describe, expect, it } from 'vitest';
import { panFor, pentatonicHz } from './sound';

describe('pentatonicHz', () => {
  it('walks D E F♯ A B and repeats an octave up every five steps', () => {
    const semis = [0, 1, 2, 3, 4].map((s) => Math.round(12 * Math.log2(pentatonicHz(s) / pentatonicHz(0))));
    expect(semis).toEqual([0, 2, 4, 7, 9]);
    expect(pentatonicHz(5)).toBeCloseTo(pentatonicHz(0) * 2, 6);
    expect(pentatonicHz(-5)).toBeCloseTo(pentatonicHz(0) / 2, 6);
    expect(pentatonicHz(0)).toBeCloseTo(146.83, 2);
  });
});

describe('panFor', () => {
  it('keeps sounds inside the field', () => {
    expect(panFor(0, 1000)).toBeCloseTo(-0.6);
    expect(panFor(500, 1000)).toBeCloseTo(0);
    expect(panFor(1000, 1000)).toBeCloseTo(0.6);
    expect(panFor(-50, 1000)).toBeCloseTo(-0.6);
    expect(panFor(10, 0)).toBe(0);
  });
});
