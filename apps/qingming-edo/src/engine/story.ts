import type { HotspotDef, SaveData } from '../contract';
import { ENTRIES, NODES } from '../content/script';
import { HOTSPOTS, PAGE_SLOTS, questById, SKETCHES, sketchPageId } from '../content/world';
import { hasFlag, questState, test } from './state';
import { questOpen } from './chapters';
import { STORIES } from '../content/stories';
import type { NearbyCtx } from '../content/stories/types';
import { RECALL_START } from '../content/script';
import { rainOpen, raining, timeOf } from './time';

/** The node a person (or prop) opens with now. */
export function entryFor(targetId: string, s: SaveData): string | null {
  const rules = ENTRIES[targetId];
  if (!rules) return null;
  // a story's first step waits for its chapter (engine/chapters.ts)
  const node = rules.find((r) => test(s, r.when) && !(STARTS[r.node] && !questOpen(s, STARTS[r.node])))?.node ?? null;
  // 朝・昼・夕: an everyday word may have its own version for the time shown (content/script.ts AT_TIME)
  const timed = node && `${node}@${timeOf(s)}`;
  return timed && NODES[timed] ? timed : node;
}

/** The node each story begins with → the story (from 回想's starting points). */
const STARTS: Record<string, string> = Object.fromEntries(Object.entries(RECALL_START).map(([q, n]) => [n, q]));

export function visibleSpots(s: SaveData): HotspotDef[] {
  // a thing that would only start a story not yet open (the dropped letter, the elder's ask) is not there yet
  return HOTSPOTS.filter((h) => test(s, h.visibleWhen) && (h.kind === 'ambient' || entryFor(h.targetId, s) !== null));
}

/** 回想可能 (spec §9): derived, never stored. */
export function replayable(quest: string, s: SaveData): boolean {
  const q = questById.get(quest);
  return !!q && q.replayPolicy !== 'none' && questState(s, quest) === 'complete';
}

export type { Nearby } from '../content/stories/types';
import type { Nearby } from '../content/stories/types';

/**
 * 「近くのこと」 (spec §7): at most three things that can be done now. It
 * only points; choosing one shows the place, it never does the task.
 */
const GREETINGS = new Set(['okon', 'kisuke', 'oharu', 'kinji']);

/** The stories someone is waiting to ask about (not yet under way). */
const OFFERS = new Set(['dougu', 'tenugui', ...STORIES.map((st) => st.quest.id)]);

/**
 * `here`: the scene x at the middle of the view. With five stories there are more
 * offers than the three places in the list, so the ones nearest to the player come
 * first; what is already under way always stays at the top.
 */
export function nearby(s: SaveData, here?: number): Nearby[] {
  return nearbyAll(s, here).slice(0, 3);
}

/**
 * Everything 「近くのこと」 could point to, most pressing first: the first three are the list,
 * the rest wait folded under 「ほかの頼みごと」 (with ten stories, offers no longer fit in three).
 */
export function nearbyAll(s: SaveData, here?: number): Nearby[] {
  const out: Nearby[] = [];
  if (s.journal.pages.length >= PAGE_SLOTS && !hasFlag(s, 'book_full')) out.push({ id: 'book', text: '一冊になった絵巻帳を、宗吉に見せる', spotId: 'h-sokichi' });
  if (!hasFlag(s, 'paper_pressed')) {
    out.push({ id: 'papers', text: '青葉屋の店先で、紙が風にあおられている', spotId: 'h-papers' });
  } else if (questState(s, 'kaze') !== 'complete') {
    out.push({ id: 'sketch', text: '宗吉が、何を描くか待っている', spotId: 'h-sokichi' });
  }
  const dougu = questState(s, 'dougu');
  if (questState(s, 'kaze') === 'complete' && dougu !== 'complete') {
    if (hasFlag(s, 'dougu_carry')) out.push({ id: 'dougu-carry', text: 'お紺の包みを、米屋の前の金次に届ける', spotId: 'h-kinji' });
    else if (hasFlag(s, 'dougu_wrapped')) out.push({ id: 'dougu-choose', text: 'お紺が、包みの届け方を決めかねている', spotId: 'h-okon' });
    else out.push({ id: 'dougu', text: '道具屋のお紺が、包みを前に考えこんでいる', spotId: 'h-okon' });
  } else if (!hasFlag(s, 'met_okon')) out.push({ id: 'okon', text: '道具屋のお紺が、手入れを終えた道具を眺めている', spotId: 'h-okon' });
  const tenugui = questState(s, 'tenugui');
  if (questState(s, 'kaze') === 'complete' && tenugui !== 'complete') {
    if (hasFlag(s, 'tenugui_found')) out.push({ id: 'tenugui-return', text: '波の柄の手拭いを、お春に返す', spotId: 'h-oharu' });
    else if (hasFlag(s, 'tenugui_asked')) out.push({ id: 'tenugui-kisuke', text: '茶店の喜助に、忘れ物の手拭いのことを聞く', spotId: 'h-kisuke' });
    else out.push({ id: 'tenugui', text: '茶店の前で、お春が何かを探している', spotId: 'h-oharu' });
  } else {
    if (!hasFlag(s, 'met_kisuke')) out.push({ id: 'kisuke', text: '茶店の喜助が、朝の客を待っている', spotId: 'h-kisuke' });
    if (!hasFlag(s, 'met_oharu')) out.push({ id: 'oharu', text: '茶店の前で、お春が何かを探している', spotId: 'h-oharu' });
  }
  if (!hasFlag(s, 'met_kinji')) out.push({ id: 'kinji', text: '天秤棒の振売りが、商いから戻ってきた', spotId: 'h-kinji' });
  // the stories in their own files (content/stories)
  const ctx: NearbyCtx = {
    questState: (q) => questState(s, q),
    hasFlag: (f) => hasFlag(s, f),
    time: timeOf(s),
    rain: raining(s),
    rainOpen: rainOpen(s),
    here,
    xOf: (id) => HOTSPOTS.find((h) => h.id === id)?.anchor.x ?? 0,
    save: s,
  };
  for (const st of [...STORIES].sort((a, b) => a.nearbyRank - b.nearbyRank)) out.push(...st.nearby(ctx));
  // 町の写生: the next place not yet drawn, walking from the bridge
  if (questState(s, 'kaze') === 'complete') {
    const left = SKETCHES.filter((k) => !s.journal.pages.some((p) => p.pageId === sketchPageId(k.id)));
    if (left.length) out.push({ id: 'sketches', text: `町の景色を写す（あと${left.length}か所）。${left[0].title}`, spotId: `a-${left[0].spots[0]}` });
  }
  // stories whose chapter is not open yet are not offered
  for (let i = out.length - 1; i >= 0; i--) if (OFFERS.has(out[i].id) && !questOpen(s, out[i].id)) out.splice(i, 1);
  // under way first, then the offers, the sketches, and people not yet greeted
  const greeting = (n: Nearby) => GREETINGS.has(n.id);
  const offer = (n: Nearby) => OFFERS.has(n.id);
  const sketching = (n: Nearby) => n.id === 'sketches';
  const xOf = (n: Nearby) => HOTSPOTS.find((h) => h.id === n.spotId)?.anchor.x ?? 0;
  const near = (a: Nearby[]) => (here === undefined ? a : [...a].sort((p, q) => Math.abs(xOf(p) - here) - Math.abs(xOf(q) - here)));
  const now = out.filter((n) => !n.later);
  const going = now.filter((n) => !greeting(n) && !offer(n) && !sketching(n));
  // what waits for another time of day comes last: under way first, then the offers
  const later = [...out.filter((n) => n.later && !offer(n)), ...near(out.filter((n) => n.later && offer(n)))];
  return [...going, ...near(now.filter(offer)), ...now.filter(sketching), ...near(now.filter(greeting)), ...later];
}
