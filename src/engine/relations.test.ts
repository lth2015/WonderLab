import { describe, expect, it } from 'vitest';
import { meteorDive, perimeter, slotPoint, RELATIONS, Relations, RING_MARGIN, ringFor, ringOffset, type Orbit, type RelationEffects, type RelationWorld, type Swimmer } from './relations';

class FakeFish implements Swimmer {
  L = 60;
  canLeap = true;
  leaps = 0;
  lured: { x: number; y: number } | null = null;
  weather: [number, number] = [0, 0];
  orbit: Orbit | null = null;
  constructor(
    public headX: number,
    public headY: number,
  ) {}
  leap() {
    this.leaps++;
  }
  lure(x: number, y: number) {
    this.lured = { x, y };
  }
  setWeather(rise: number, mist: number) {
    this.weather = [rise, mist];
  }
  slot = -1;
  setOrbit(o: Orbit | null, slot = 0) {
    this.orbit = o;
    this.slot = slot;
  }
}

function effects() {
  const log = { pulses: 0, ripples: 0, sounds: 0, emerged: [] as string[] };
  const fx: RelationEffects = {
    pulseMoon: () => log.pulses++,
    ripple: () => log.ripples++,
    sound: () => log.sounds++,
    emerged: (w) => log.emerged.push(w),
  };
  return { fx, log };
}

const lake = { minX: 0, maxX: 1280, minY: 0, maxY: 360 };
const world = (over: Partial<RelationWorld>): RelationWorld => ({
  time: 0,
  calm: false,
  idle: 0,
  fish: [],
  moonReflection: null,
  rain: 0,
  mist: 0,
  lake,
  minDim: 800,
  ...over,
});
/** Deterministic: always the low end of every range, always "yes" to a chance. */
const low = () => 0;

describe('relations', () => {
  it('passes the weather to every fish', () => {
    const fish = [new FakeFish(100, 100), new FakeFish(300, 100)];
    const { fx } = effects();
    new Relations(low).update(world({ fish, rain: 0.8, mist: 0.3 }), fx);
    expect(fish.map((f) => f.weather)).toEqual([
      [0.8, 0.3],
      [0.8, 0.3],
    ]);
  });

  it('sends a fish to the moon’s reflection, and it leaps once it arrives', () => {
    const f = new FakeFish(100, 100);
    const r = new Relations(low);
    const { fx, log } = effects();
    const moonReflection = { x: 600, y: 200 };
    r.update(world({ time: RELATIONS.moonVisitEvery[0], fish: [f], moonReflection }), fx);
    expect(f.lured).toEqual(moonReflection);
    expect(f.leaps).toBe(0);
    f.headX = 590;
    f.headY = 205;
    r.update(world({ time: RELATIONS.moonVisitEvery[0] + 1, fish: [f], moonReflection }), fx);
    expect(f.leaps).toBe(1);
    expect(log.pulses).toBe(1);
    expect(log.emerged).toEqual(['moon_leap']);
  });

  it('does not leap under reduced motion, nor without a moon', () => {
    const f = new FakeFish(590, 205);
    const r = new Relations(low);
    const { fx } = effects();
    const moonReflection = { x: 600, y: 200 };
    r.update(world({ time: 10, fish: [f], moonReflection, calm: true }), fx);
    r.update(world({ time: 11, fish: [f], moonReflection, calm: true }), fx);
    expect(f.leaps).toBe(0);
    const g = new FakeFish(590, 205);
    const r2 = new Relations(low);
    r2.update(world({ time: 10, fish: [g] }), fx);
    expect(g.lured).toBeNull();
  });

  it('makes rings on the surface in the rain, not in clear weather', () => {
    const fish = [new FakeFish(100, 100)];
    const r = new Relations(low);
    const { fx, log } = effects();
    for (let t = 0; t < 20; t += 0.5) r.update(world({ time: t, fish }), fx);
    expect(log.ripples).toBe(0);
    for (let t = 20; t < 40; t += 0.5) r.update(world({ time: t, fish, rain: 1 }), fx);
    expect(log.ripples).toBeGreaterThan(3);
  });

  it('forms a ring when there are enough fish and the hand is at rest; a touch breaks it', () => {
    const fish = [0, 1, 2, 3].map((i) => new FakeFish(200 + i * 200, 150));
    const r = new Relations(low);
    const { fx, log } = effects();
    const t0 = RELATIONS.ringEvery[0];
    r.update(world({ time: t0, fish, idle: 1 }), fx);
    expect(r.ringing).toBe(false);
    r.update(world({ time: t0, fish, idle: RELATIONS.ringIdle }), fx);
    expect(r.ringing).toBe(true);
    const o = fish[0].orbit!;
    expect(fish.every((f) => f.orbit === o)).toBe(true);
    // One slot each.
    expect(fish.map((f) => f.slot).sort()).toEqual([0, 1, 2, 3]);
    // Everyone on the circle: the ring has formed.
    fish.forEach((f, i) => {
      f.headX = o.cx + o.rx * Math.cos((i * Math.PI) / 2);
      f.headY = o.cy + o.ry * Math.sin((i * Math.PI) / 2);
    });
    r.update(world({ time: t0 + 3, fish, idle: 20 }), fx);
    expect(log.emerged).toEqual(['ring']);
    r.interrupt();
    expect(r.ringing).toBe(false);
    expect(fish.every((f) => f.orbit === null)).toBe(true);
  });

  it('needs four fish for a ring, and none under reduced motion', () => {
    const three = [0, 1, 2].map((i) => new FakeFish(200 + i * 200, 150));
    const four = [...three, new FakeFish(900, 150)];
    const { fx } = effects();
    const t = RELATIONS.ringEvery[0];
    const a = new Relations(low);
    a.update(world({ time: t, fish: three, idle: 30 }), fx);
    expect(a.ringing).toBe(false);
    const b = new Relations(low);
    b.update(world({ time: t, fish: four, idle: 30, calm: true }), fx);
    expect(b.ringing).toBe(false);
  });

  it('ends the ring when its time is up', () => {
    const fish = [0, 1, 2, 3].map((i) => new FakeFish(200 + i * 200, 150));
    const r = new Relations(low);
    const { fx } = effects();
    const t = RELATIONS.ringEvery[0];
    r.update(world({ time: t, fish, idle: 30 }), fx);
    r.update(world({ time: t + RELATIONS.ringTime + 0.1, fish, idle: 30 }), fx);
    expect(r.ringing).toBe(false);
  });
});

describe('ringFor', () => {
  const inside = (at: NonNullable<ReturnType<typeof ringFor>>, L: number, l = lake) => {
    const m = L * RING_MARGIN;
    expect(at.cx - at.rx - m).toBeGreaterThanOrEqual(l.minX - 1e-6);
    expect(at.cx + at.rx + m).toBeLessThanOrEqual(l.maxX + 1e-6);
    expect(at.cy - at.ry - m).toBeGreaterThanOrEqual(l.minY - 1e-6);
    expect(at.cy + at.ry + m).toBeLessThanOrEqual(l.maxY + 1e-6);
  };

  it('fits a ring with room for every fish in a wide, shallow landscape lake', () => {
    // 960×600: the lake is 270 px tall and the fish about 120 px long.
    const shallow = { minX: 0, maxX: 960, minY: 0, maxY: 270 };
    const at = ringFor(5, 120, shallow, 600, null)!;
    expect(at).not.toBeNull();
    inside(at, 120, shallow);
    expect(perimeter(at.rx, at.ry)).toBeGreaterThanOrEqual(5 * 120 * 1.25);
    expect(at.rx).toBeGreaterThan(at.ry);
  });

  it('fits in a phone’s tall lake too', () => {
    const tall = { minX: 0, maxX: 390, minY: 0, maxY: 440 };
    const at = ringFor(5, 60, tall, 390, null)!;
    inside(at, 60, tall);
  });

  it('centres under the moon’s reflection when it can', () => {
    const at = ringFor(4, 60, lake, 800, { x: 900, y: 180 })!;
    expect(at.cx).toBe(900);
  });

  it('gives up when the lake is too small', () => {
    expect(ringFor(8, 120, { minX: 0, maxX: 300, minY: 0, maxY: 200 }, 300, null)).toBeNull();
  });

  it('spaces the slots evenly round the ring and moves them along it', () => {
    const o: Orbit = { cx: 0, cy: 0, rx: 200, ry: 100, dir: 1, until: 99, start: 0, phase: 0, omega: 0.5, slots: 4 };
    const at0 = [0, 1, 2, 3].map((i) => slotPoint(o, i, 0, 0));
    expect(at0[0].x).toBeCloseTo(200);
    expect(at0[1].y).toBeCloseTo(100);
    expect(at0[2].x).toBeCloseTo(-200);
    for (const p of at0) expect(ringOffset(o, p.x, p.y)).toBeCloseTo(0);
    const later = slotPoint(o, 0, 1, 0);
    expect(later.y).toBeGreaterThan(0);
  });

  it('measures how far a point is from the ring', () => {
    const o = { cx: 0, cy: 0, rx: 200, ry: 100 };
    expect(ringOffset(o, 200, 0)).toBeCloseTo(0);
    expect(ringOffset(o, 0, 100)).toBeCloseTo(0);
    expect(ringOffset(o, 0, 0)).toBeCloseTo(1);
  });
});

describe('meteorDive', () => {
  it('falls into the lake when it heads down and ends near the horizon', () => {
    expect(meteorDive({ y: 700 }, { y: 430 }, 400, 800)).toBe(true);
  });
  it('stays in the sky when it ends high or heads up', () => {
    expect(meteorDive({ y: 700 }, { y: 600 }, 400, 800)).toBe(false);
    expect(meteorDive({ y: 420 }, { y: 450 }, 400, 800)).toBe(false);
  });
});
