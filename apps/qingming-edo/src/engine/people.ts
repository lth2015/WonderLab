import type { SaveData } from '../contract';
import { LOST } from '../content/lost';
import { PEOPLE } from '../content/people';
import { MOMENTS, momentFlag } from '../content/shop';
import { HOTSPOTS, PAGES, PAGE_TITLES } from '../content/world';
import { hasFlag } from './state';
import { visibleSpots } from './story';

export interface Acquaintance {
  id: string;
  level: 0 | 1 | 2;
  /** The stories shared with them, by title, in the order they happened. */
  shared: string[];
  /** Where they can be found now (a visible spot), if anywhere. */
  spotId: string | null;
  /** このごろの様子: what the player saw of their day from the tea-house bench (一服). */
  lately: string[];
  /** The lost things the player gave back to them. */
  returned: string[];
}

const storyTitle = (quest: string) => {
  const p = PAGES.find((x) => x.triggerId === quest && !x.id.endsWith('-b'));
  return (p && PAGE_TITLES[p.id]) ?? null;
};

/** The people the player has met (spoken to, or shared a story with), in the book's order. */
export function acquaintances(s: SaveData): Acquaintance[] {
  const spots = visibleSpots(s);
  return PEOPLE.filter((id) => id === 'sokichi' || hasFlag(s, `met_${id}`) || s.progress.familiarity[id]).map((id) => {
    const f = s.progress.familiarity[id];
    const here = spots.find((h) => h.targetId === id && h.kind === 'character');
    return {
      id,
      level: (f?.level ?? 0) as 0 | 1 | 2,
      shared: (f?.events ?? []).map(storyTitle).filter((t): t is string => !!t),
      spotId: here?.id ?? null,
      lately: MOMENTS.filter((m) => m.who === id && hasFlag(s, momentFlag(m.id))).map((m) =>
        m.lines.map((l) => (l.by === 'narration' ? l.text : `「${l.text}」`)).join(''),
      ),
      returned: LOST.filter((t) => t.owner === id && hasFlag(s, `lost_back_${t.id}`)).map((t) => t.name),
    };
  });
}

/** Every person in the book has a place on the street (some only at times). */
export const personSpots = (id: string) => HOTSPOTS.filter((h) => h.targetId === id && h.kind === 'character').map((h) => h.id);
