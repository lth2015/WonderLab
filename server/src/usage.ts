import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Spend counters for the three caps (docs/02 §5.3): per invite per day,
// site per day, project total. Kept in a small JSON file so a restart does
// not reset the budget; each check-and-charge is synchronous, so two
// requests cannot both pass the last unit of budget.

export interface Caps {
  dailyPerInvite: number;
  dailyBudget: number;
  totalBudget: number;
  costPerCall: number;
}

interface State {
  day: string;
  perInvite: Record<string, number>;
  spentToday: number;
  spentTotal: number;
}

// Costs are fractional yen (0.2 per call), and 0.2 + 0.2 + 0.2 is
// 0.6000000000000001 in floating point, which would refuse the last call a
// budget pays for. Keep sums to a millionth of a yen and compare with that slack.
const money = (n: number) => Math.round(n * 1e6) / 1e6;
const fits = (spent: number, budget: number) => money(spent) <= budget + 1e-9;

export type Charge = { ok: true } | { ok: false; reason: 'invite_daily' | 'site_daily' | 'total_budget' };

export class Usage {
  private state: State;

  constructor(
    private readonly caps: Caps,
    private readonly file: string | null,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {
    this.state = this.read() ?? { day: this.today(), perInvite: {}, spentToday: 0, spentTotal: 0 };
  }

  /** Reserve one model call for this invite, or say which cap stops it. */
  charge(invite: string): Charge {
    this.roll();
    const s = this.state;
    const c = this.caps;
    if ((s.perInvite[invite] ?? 0) >= c.dailyPerInvite) return { ok: false, reason: 'invite_daily' };
    if (!fits(s.spentToday + c.costPerCall, c.dailyBudget)) return { ok: false, reason: 'site_daily' };
    if (!fits(s.spentTotal + c.costPerCall, c.totalBudget)) return { ok: false, reason: 'total_budget' };
    s.perInvite[invite] = (s.perInvite[invite] ?? 0) + 1;
    s.spentToday = money(s.spentToday + c.costPerCall);
    s.spentTotal = money(s.spentTotal + c.costPerCall);
    this.write();
    return { ok: true };
  }

  snapshot(): Readonly<State> {
    this.roll();
    return this.state;
  }

  private roll(): void {
    const day = this.today();
    if (this.state.day !== day) this.state = { ...this.state, day, perInvite: {}, spentToday: 0 };
  }

  private read(): State | null {
    if (!this.file) return null;
    try {
      const s = JSON.parse(readFileSync(this.file, 'utf8')) as State;
      return typeof s.spentTotal === 'number' ? s : null;
    } catch {
      return null;
    }
  }

  private write(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.state));
  }
}
