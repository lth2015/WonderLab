// Two quality tiers and the rule for switching between them
// (docs/03-ux-ui-design.md §10). Pure, so it can be tested with made-up
// frame timings.

export type Tier = 'standard' | 'light';

export interface TierSettings {
  maxDpr: number;
  maxFish: number;
  /** Share of weather particles drawn (fireflies, the second rain layer). */
  particles: number;
  /** Paper grain and vignette. */
  post: boolean;
}

export const TIERS: Record<Tier, TierSettings> = {
  standard: { maxDpr: 1.5, maxFish: 8, particles: 1, post: true },
  light: { maxDpr: 1, maxFish: 5, particles: 0.4, post: false },
};

const WINDOW_MS = 3000;
const SETTLE_MS = 2000;
const RECOVER_MS = 30000;
const MAX_UPGRADES = 1;

/**
 * Judges frame cost from frame intervals, against the cadence the display
 * actually runs at. A display locked to 30 Hz (iOS low power mode) gives
 * steady 33 ms frames, which is its normal pace, not a slow frame; a
 * struggling GPU on a 60 Hz display gives irregular long frames.
 */
export class FrameMonitor {
  private samples: { t: number; slow: boolean }[] = [];
  private recent: number[] = [];
  private ignoreUntil = 0;
  private calmSince = -1;
  private upgrades = 0;
  /** The display's natural frame interval, learnt from the fastest frames. */
  cadence = 1000 / 60;

  constructor(public tier: Tier = 'standard') {}

  /** Skip the next couple of seconds (after resize, or returning from the background). */
  settle(now: number): void {
    this.ignoreUntil = now + SETTLE_MS;
    this.samples = [];
    this.calmSince = -1;
  }

  /** Feed one frame. Returns the new tier when it should change. */
  frame(now: number, intervalMs: number): Tier | null {
    if (now < this.ignoreUntil || intervalMs <= 0 || intervalMs > 250) return null;

    this.recent.push(intervalMs);
    if (this.recent.length > 120) this.recent.shift();
    if (this.recent.length >= 20) {
      const sorted = [...this.recent].sort((a, b) => a - b);
      this.cadence = Math.max(sorted[Math.floor(sorted.length * 0.1)], 4);
    }

    const slow = intervalMs > this.cadence * 1.5 && intervalMs > 20;
    this.samples.push({ t: now, slow });
    while (this.samples.length && this.samples[0].t < now - WINDOW_MS) this.samples.shift();
    const span = this.samples.length ? now - this.samples[0].t : 0;
    const slowShare = this.samples.filter((s) => s.slow).length / Math.max(this.samples.length, 1);

    if (this.tier === 'standard') {
      if (span >= WINDOW_MS * 0.9 && slowShare > 0.5) return this.change('light', now);
      return null;
    }

    // Light: climb back once after a long calm stretch.
    if (this.upgrades >= MAX_UPGRADES) return null;
    if (slowShare > 0.02) {
      this.calmSince = -1;
      return null;
    }
    if (this.calmSince < 0) this.calmSince = now;
    if (now - this.calmSince >= RECOVER_MS) {
      this.upgrades++;
      return this.change('standard', now);
    }
    return null;
  }

  private change(tier: Tier, now: number): Tier {
    this.tier = tier;
    this.settle(now);
    return tier;
  }
}
