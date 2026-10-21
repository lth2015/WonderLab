import { describe, expect, it } from 'vitest';
import { FrameMonitor, type Tier } from './quality';

/** Runs a monitor over `seconds` of frames whose intervals come from `next`. */
function run(m: FrameMonitor, start: number, seconds: number, next: (i: number) => number) {
  let t = start;
  const changes: { t: number; tier: Tier }[] = [];
  for (let i = 0; t < start + seconds * 1000; i++) {
    const dt = next(i);
    t += dt;
    const c = m.frame(t, dt);
    if (c) changes.push({ t, tier: c });
  }
  return { t, changes };
}

describe('FrameMonitor', () => {
  it('keeps the standard tier at a steady 60 fps', () => {
    const m = new FrameMonitor();
    expect(run(m, 0, 20, () => 16.7).changes).toEqual([]);
  });

  it('does not mistake a 30 Hz lock (low power mode) for slowness', () => {
    const m = new FrameMonitor();
    expect(run(m, 0, 20, () => 33.3).changes).toEqual([]);
  });

  it('drops to light when most frames overrun a 60 Hz display', () => {
    const m = new FrameMonitor();
    // Mostly fast at first so the cadence is learnt, then a heavy scene.
    let { t } = run(m, 0, 2, () => 16.7);
    const r = run(m, t, 6, (i) => (i % 5 === 0 ? 16.7 : 30 + (i % 3) * 8));
    expect(r.changes[0]?.tier).toBe('light');
    expect(r.changes[0].t - t).toBeLessThan(4500);
    t = r.t;
  });

  it('ignores a burst of slow frames right after settle()', () => {
    const m = new FrameMonitor();
    run(m, 0, 2, () => 16.7);
    m.settle(2000);
    expect(run(m, 2000, 1.8, () => 40).changes).toEqual([]);
  });

  it('climbs back once after 30 calm seconds, and only once', () => {
    const m = new FrameMonitor('light');
    const first = run(m, 0, 35, () => 16.7);
    expect(first.changes.map((c) => c.tier)).toEqual(['standard']);
    // Struggles again: drops, and stays down however calm it gets.
    const again = run(m, first.t, 6, (i) => (i % 5 === 0 ? 16.7 : 34));
    expect(again.changes.map((c) => c.tier)).toEqual(['light']);
    expect(run(m, again.t, 60, () => 16.7).changes).toEqual([]);
  });
});
