import type { SaveData } from '../contract';
import { MOMENTS, momentFlag, QUIET, SLIP_PRICE, SLIPS_FOR_SALE, slipFlag, TEA_PRICE, type Moment } from '../content/shop';
import { TITLE_STYLES } from '../content/world';
import { hasFlag, test } from './state';
import { raining, timeOf } from './time';

/** Pay for something: the new save, or null when the purse is too light. Nothing else changes. */
function pay(s: SaveData, amount: number, flag?: string): SaveData | null {
  if (!Number.isInteger(amount) || amount < 0 || s.wallet.balanceMinor < amount) return null;
  const next = structuredClone(s);
  next.wallet.balanceMinor -= amount;
  if (flag && !next.progress.flags.includes(flag)) next.progress.flags.push(flag);
  next.updatedAt = new Date().toISOString();
  return next;
}

/** The moment a rest at the tea house shows now: the first unseen one that holds, else a quiet one. */
export function nextMoment(s: SaveData): Moment {
  const m = MOMENTS.find((x) => !hasFlag(s, momentFlag(x.id)) && (!x.when || test(s, x.when)));
  if (m) return m;
  return { id: 'quiet', lines: QUIET[raining(s) ? 'rain' : timeOf(s)] };
}

/** 一服: pay for tea and a sweet; the moment it shows is marked seen. */
export function buyTea(s: SaveData): { save: SaveData; moment: Moment } | null {
  const moment = nextMoment(s);
  const save = pay(s, TEA_PRICE, moment.id === 'quiet' ? undefined : momentFlag(moment.id));
  return save && { save, moment };
}

export const ownsSlip = (s: SaveData, id: string) => hasFlag(s, slipFlag(id));

/** A title slip from 青葉屋, once each. */
export function buySlip(s: SaveData, id: string): SaveData | null {
  if (!SLIPS_FOR_SALE.some((x) => x.id === id) || ownsSlip(s, id)) return null;
  return pay(s, SLIP_PRICE, slipFlag(id));
}

/** The title slips the player may put on a page: the three free ones and those bought. */
export function slipStyles(s: SaveData): { id: string; label: string }[] {
  return [...TITLE_STYLES, ...SLIPS_FOR_SALE.filter((x) => ownsSlip(s, x.id))];
}

/** Put another owned slip on a page that is in the book. */
export function retitle(s: SaveData, pageId: string, style: string): SaveData {
  if (!slipStyles(s).some((x) => x.id === style)) return s;
  const i = s.journal.pages.findIndex((p) => p.pageId === pageId);
  if (i < 0 || s.journal.pages[i].titleStyle === style) return s;
  const next = structuredClone(s);
  next.journal.pages[i].titleStyle = style;
  next.updatedAt = new Date().toISOString();
  return next;
}
