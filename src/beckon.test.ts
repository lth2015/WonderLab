import { describe, expect, it } from 'vitest';
import { BECKONS, pickBeckon } from './beckon';
import { interpret } from './engine/intent';

describe('beckon', () => {
  it('offers lines that bring the scene they promise', () => {
    for (const b of BECKONS) expect(interpret(b.text).command.weather, b.text).toBe(b.weather);
  });

  it('never offers a scene already seen or the one now', () => {
    const seen = new Set(BECKONS.slice(1).map((b) => b.weather));
    expect(pickBeckon(seen, 'clear')?.weather).toBe(BECKONS[0].weather);
    expect(pickBeckon(seen, BECKONS[0].weather)).toBeNull();
    for (let i = 0; i < 50; i++) expect(pickBeckon(new Set(['galaxy']), 'storm')?.weather).not.toMatch(/galaxy|storm/);
  });
});
