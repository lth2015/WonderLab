// Relations between the things in the world (docs/02 §5.5, P5): what the
// user has made does not just sit side by side, it notices the rest.
//
//  - 月下跃鲤  a fish that swims over to the moon's reflection now and then
//              leaps toward the moon, which brightens for a moment;
//  - 雨与雾    in rain the fish rise and kiss the surface; in mist they sink
//              a little and their shadows fade;
//  - 群鱼成圆  with four or more fish and the hand at rest, they sometimes
//              swim round together in a ring, and then go their own ways.
//              The ring is an ellipse, wide and flat like the lake itself
//              (a landscape lake is far too shallow for a round one);
//  - 记得出生地 when the hand has rested a while, the first fish (本命鱼)
//              now and then swims back to where it was drawn;
//  - 流星入湖  a meteor drawn down to the horizon falls into the lake and
//              becomes a small glowing fish (decided in the engine; the
//              geometry lives here as `meteorDive`).
//
// Nothing here creates an undo step or counts as a creation: these are the
// world's answers, not the user's acts. Reduced motion keeps the weather
// relations and drops leaps and rings. Values mirror docs/03 §7.1.

export const RELATIONS = {
  /** Seconds between fish visiting the moon's reflection. */
  moonVisitEvery: [7, 13] as [number, number],
  /** Chance a visiting fish leaps once it arrives. */
  moonLeapChance: 0.45,
  /** Seconds at least between two moon leaps. */
  moonLeapGap: 18,
  /** Rain level above which fish kiss the surface. */
  rainKiss: 0.45,
  /** Seconds between surface kisses in full rain. */
  rainKissEvery: [2.5, 6] as [number, number],
  /** Fish needed for a ring. */
  ringMinFish: 4,
  /** Seconds without input before a ring may start. */
  ringIdle: 8,
  /** Seconds between rings (the first comes after the first gap too). */
  ringEvery: [40, 80] as [number, number],
  /** How long a ring lasts, seconds. */
  ringTime: 14,
  /** Share of the fish within this fraction of the radius for the ring to count as formed. */
  ringTolerance: 0.3,
  ringFormedShare: 0.7,
  /** Seconds without input before the first fish may visit where it was drawn. */
  homeIdle: 20,
  /** Seconds between chances of a visit, and the chance at each. */
  homeEvery: [45, 90] as [number, number],
  homeChance: 0.5,
  /** How long the visit's pull lasts, seconds. */
  homeStay: 8,
  /** A meteor ending within this share of the sky's height above the horizon falls into the lake. */
  meteorDive: 0.2,
};

export interface Orbit {
  cx: number;
  cy: number;
  /** Half axes of the ellipse. */
  rx: number;
  ry: number;
  /** 1 counter-clockwise, -1 clockwise. */
  dir: number;
  until: number;
  /** Evenly spaced slots travel round the ellipse; each fish chases its own. */
  start: number;
  /** Angle of slot 0 at `start`, radians on the unit circle. */
  phase: number;
  /** Radians per second. */
  omega: number;
  slots: number;
}

/** Where slot `i` of a ring is at `time`, a little ahead of it so a fish swims along rather than at it. */
export function slotPoint(o: Orbit, i: number, time: number, lead = 0.35): { x: number; y: number } {
  const a = o.phase + o.dir * (o.omega * (time - o.start) + (2 * Math.PI * i) / o.slots + lead);
  return { x: o.cx + o.rx * Math.cos(a), y: o.cy + o.ry * Math.sin(a) };
}

/** The part of a fish the relations steer. */
export interface Swimmer {
  readonly headX: number;
  readonly headY: number;
  readonly L: number;
  readonly canLeap: boolean;
  leap(): void;
  lure(x: number, y: number, now: number, opts?: { duration?: number; eager?: boolean }): void;
  setWeather(rise: number, mist: number): void;
  setOrbit(o: Orbit | null, slot?: number): void;
}

export interface RelationWorld {
  time: number;
  /** Reduced motion. */
  calm: boolean;
  /** Seconds since the last pointer went down. */
  idle: number;
  /** Real fish that are swimming (not forming, leaving, hidden or ghosts). */
  fish: Swimmer[];
  /** Where the moon's reflection lies on the lake, if there is a moon. */
  moonReflection: { x: number; y: number } | null;
  rain: number;
  mist: number;
  /** Where fish may swim. */
  lake: { minX: number; maxX: number; minY: number; maxY: number };
  minDim: number;
  /** The first fish and where it was drawn, while it swims. */
  home?: { fish: Swimmer; x: number; y: number } | null;
}

export interface RelationEffects {
  pulseMoon(): void;
  ripple(x: number, y: number, strength: number): void;
  sound(kind: 'chime' | 'ripple' | 'drop', x: number, strength: number): void;
  /** For the event log: which relation showed itself. */
  emerged(what: 'moon_leap' | 'ring' | 'home'): void;
}

const between = (r: () => number, [a, b]: [number, number]) => a + (b - a) * r();

/** Where an orbiting head may come, from the lake's edge, in fish lengths (fish.ts keeps to it). */
export const RING_MARGIN = 0.5;

/** Ramanujan's approximation of an ellipse's perimeter. */
export function perimeter(rx: number, ry: number): number {
  return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
}

/** How far a point is from the ellipse, in units of its size: 0 on it, 1 at the centre or twice out. */
export function ringOffset(o: Pick<Orbit, 'cx' | 'cy' | 'rx' | 'ry'>, x: number, y: number): number {
  return Math.abs(Math.hypot((x - o.cx) / o.rx, (y - o.cy) / o.ry) - 1);
}

/**
 * Where a ring of `n` fish of the longest length `L` fits in the lake, with
 * room between them: an ellipse at most about twice as wide as it is tall,
 * centred under the moon's reflection when there is one. Null when the lake
 * is too small for it.
 */
export function ringFor(
  n: number,
  L: number,
  lake: RelationWorld['lake'],
  minDim: number,
  near: { x: number; y: number } | null,
): Pick<Orbit, 'cx' | 'cy' | 'rx' | 'ry'> | null {
  const w = lake.maxX - lake.minX;
  const h = lake.maxY - lake.minY;
  const m = L * RING_MARGIN;
  const maxRx = w / 2 - m;
  const maxRy = h / 2 - m;
  const need = n * L * 1.25;
  let rx = Math.max(minDim * 0.12, (n * L * 1.25) / (2 * Math.PI));
  let ry = Math.min(rx * 0.55, maxRy);
  while (perimeter(rx, ry) < need && rx < maxRx) {
    rx = Math.min(rx * 1.1, maxRx);
    ry = Math.min(rx * 0.55, maxRy);
  }
  if (perimeter(rx, ry) < need || ry < L * 0.4 || rx > maxRx) return null;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const cx = clamp(near?.x ?? lake.minX + w / 2, lake.minX + rx + m, lake.maxX - rx - m);
  const cy = clamp(near?.y ?? lake.minY + h / 2, lake.minY + ry + m, lake.maxY - ry - m);
  return { cx, cy, rx, ry };
}

/** Whether a meteor from a to b (y up) dives into the lake rather than ending in the sky. */
export function meteorDive(a: { y: number }, b: { y: number }, horizonY: number, height: number): boolean {
  return b.y < a.y && b.y - horizonY < (height - horizonY) * RELATIONS.meteorDive;
}

export class Relations {
  private nextVisit: number;
  private visitor: { fish: Swimmer; x: number; y: number; leap: boolean; until: number } | null = null;
  private lastLeap = -Infinity;
  private nextKiss = 0;
  private nextRing: number;
  private nextHome: number;
  private ring: { orbit: Orbit; members: Swimmer[]; formed: boolean } | null = null;

  constructor(private readonly random: () => number = Math.random) {
    this.nextVisit = between(random, RELATIONS.moonVisitEvery);
    this.nextRing = between(random, RELATIONS.ringEvery);
    this.nextHome = between(random, RELATIONS.homeEvery);
  }

  get ringing(): boolean {
    return !!this.ring;
  }

  /** The user reached in: a ring breaks up at once. */
  interrupt(): void {
    this.endRing();
  }

  update(w: RelationWorld, fx: RelationEffects): void {
    for (const f of w.fish) f.setWeather(w.rain, w.mist);
    this.moon(w, fx);
    this.rain(w, fx);
    this.rings(w, fx);
    this.homeVisit(w, fx);
  }

  private homeVisit(w: RelationWorld, fx: RelationEffects): void {
    if (!w.home || this.ring || w.time < this.nextHome || w.idle < RELATIONS.homeIdle) return;
    this.nextHome = w.time + between(this.random, RELATIONS.homeEvery);
    if (this.random() >= RELATIONS.homeChance) return;
    w.home.fish.lure(w.home.x, w.home.y, w.time, { duration: RELATIONS.homeStay });
    fx.emerged('home');
  }

  private moon(w: RelationWorld, fx: RelationEffects): void {
    const m = w.moonReflection;
    if (!m) {
      this.visitor = null;
      return;
    }
    const v = this.visitor;
    if (v) {
      const arrived = Math.hypot(v.fish.headX - v.x, v.fish.headY - v.y) < v.fish.L * 0.9;
      if (!w.fish.includes(v.fish) || w.time > v.until) this.visitor = null;
      else if (arrived) {
        this.visitor = null;
        if (v.leap && !w.calm && v.fish.canLeap && w.time - this.lastLeap >= RELATIONS.moonLeapGap) {
          v.fish.leap();
          this.lastLeap = w.time;
          fx.ripple(v.fish.headX, v.fish.headY, 1.1);
          fx.pulseMoon();
          fx.sound('chime', v.fish.headX, 0.35);
          fx.emerged('moon_leap');
        }
      }
    }
    if (w.time < this.nextVisit || this.ring) return;
    this.nextVisit = w.time + between(this.random, RELATIONS.moonVisitEvery);
    if (!w.fish.length) return;
    const fish = w.fish[Math.floor(this.random() * w.fish.length)];
    fish.lure(m.x, m.y, w.time);
    if (!this.visitor) this.visitor = { fish, x: m.x, y: m.y, leap: this.random() < RELATIONS.moonLeapChance, until: w.time + 2.5 };
  }

  private rain(w: RelationWorld, fx: RelationEffects): void {
    if (w.rain < RELATIONS.rainKiss || !w.fish.length) {
      this.nextKiss = w.time + between(this.random, RELATIONS.rainKissEvery);
      return;
    }
    if (w.time < this.nextKiss) return;
    // Heavier rain, more kisses.
    this.nextKiss = w.time + between(this.random, RELATIONS.rainKissEvery) / Math.max(w.rain, 0.5);
    const f = w.fish[Math.floor(this.random() * w.fish.length)];
    fx.ripple(f.headX, f.headY, 0.35);
  }

  private rings(w: RelationWorld, fx: RelationEffects): void {
    const ring = this.ring;
    if (ring) {
      // A member that left (undone, hidden, replaced) drops out; too few and the ring ends.
      ring.members = ring.members.filter((f) => w.fish.includes(f));
      if (w.time > ring.orbit.until || ring.members.length < RELATIONS.ringMinFish - 1) {
        this.endRing();
        return;
      }
      if (!ring.formed) {
        const close = ring.members.filter((f) => ringOffset(ring.orbit, f.headX, f.headY) < RELATIONS.ringTolerance);
        if (close.length >= ring.members.length * RELATIONS.ringFormedShare) {
          ring.formed = true;
          if (w.moonReflection) fx.pulseMoon();
          fx.sound('chime', ring.orbit.cx, 0.25);
          fx.emerged('ring');
        }
      }
      return;
    }
    if (w.time < this.nextRing) return;
    if (w.calm || w.idle < RELATIONS.ringIdle || w.fish.length < RELATIONS.ringMinFish) return;
    this.nextRing = w.time + RELATIONS.ringTime + between(this.random, RELATIONS.ringEvery);
    const L = Math.max(...w.fish.map((f) => f.L));
    const at = ringFor(w.fish.length, L, w.lake, w.minDim, w.moonReflection);
    if (!at) return;
    // Slots in the order the fish already lie round the centre, so no two cross paths to reach them.
    const dir = this.random() < 0.5 ? 1 : -1;
    const angle = (f: Swimmer) => Math.atan2((f.headY - at.cy) / at.ry, (f.headX - at.cx) / at.rx);
    const members = [...w.fish].sort((a, b) => dir * (angle(a) - angle(b)));
    const L0 = w.fish.reduce((s, f) => s + f.L, 0) / w.fish.length;
    const orbit: Orbit = {
      ...at,
      dir,
      until: w.time + RELATIONS.ringTime,
      start: w.time,
      phase: angle(members[0]),
      // An easy pace for a koi: about two thirds of a length a second.
      omega: (0.65 * L0 * 2 * Math.PI) / perimeter(at.rx, at.ry),
      slots: members.length,
    };
    members.forEach((f, i) => f.setOrbit(orbit, i));
    this.ring = { orbit, members, formed: false };
  }

  private endRing(): void {
    if (!this.ring) return;
    for (const f of this.ring.members) f.setOrbit(null);
    this.ring = null;
  }
}
