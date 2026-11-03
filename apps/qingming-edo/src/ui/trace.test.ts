import { describe, expect, it } from 'vitest';
import { NODES } from '../content/script';
import { SKETCHES, TRACES } from '../content/world';
import { ENOUGH, inkedBy, traceTargets } from './Trace';

describe('なぞり描き', () => {
  it('every sketch place has lines to trace, inside its picture', () => {
    for (const k of SKETCHES) {
      expect(TRACES[k.id]?.length, k.id).toBeGreaterThan(0);
      const { points } = traceTargets(k.id);
      expect(points.length, k.id).toBeGreaterThan(20);
      for (const p of points) {
        expect(p.x, k.id).toBeGreaterThanOrEqual(40);
        expect(p.x, k.id).toBeLessThanOrEqual(560);
        expect(p.y, k.id).toBeGreaterThanOrEqual(40);
        expect(p.y, k.id).toBeLessThanOrEqual(700);
      }
      // drawing a sketch goes through the tracing first
      expect(NODES[`sk.${k.id}`].choices?.[0]).toMatchObject({ game: 'trace', trace: k.id, next: `sk.${k.id}.made` });
    }
  });

  it('going along the lines inks them; a stroke far away inks nothing', () => {
    const { lines, points } = traceTargets('boat');
    const hit = new Set<number>();
    for (const l of lines) for (let i = 1; i < l.length; i++) inkedBy(points, l[i - 1], l[i]).forEach((n) => hit.add(n));
    expect(hit.size).toBe(points.length);
    expect(inkedBy(points, { x: 45, y: 45 }, { x: 60, y: 45 })).toEqual([]);
  });

  it('a little off the line still counts (fingers are wide)', () => {
    const { lines, points } = traceTargets('bench');
    const off = lines.map((l) => l.map((p) => ({ x: p.x + 12, y: p.y + 10 })));
    const hit = new Set<number>();
    for (const l of off) for (let i = 1; i < l.length; i++) inkedBy(points, l[i - 1], l[i]).forEach((n) => hit.add(n));
    expect(hit.size / points.length).toBeGreaterThanOrEqual(ENOUGH);
  });
});
