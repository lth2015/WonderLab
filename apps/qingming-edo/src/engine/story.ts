import type { HotspotDef, SaveData } from '../contract';
import { ENTRIES } from '../content/script';
import { HOTSPOTS, PAGE_SLOTS, questById, SKETCHES, sketchPageId } from '../content/world';
import { hasFlag, questState, test } from './state';

/** The node a person (or prop) opens with now. */
export function entryFor(targetId: string, s: SaveData): string | null {
  const rules = ENTRIES[targetId];
  if (!rules) return null;
  return rules.find((r) => test(s, r.when))?.node ?? null;
}

export function visibleSpots(s: SaveData): HotspotDef[] {
  return HOTSPOTS.filter((h) => test(s, h.visibleWhen));
}

/** 回想可能 (spec §9): derived, never stored. */
export function replayable(quest: string, s: SaveData): boolean {
  const q = questById.get(quest);
  return !!q && q.replayPolicy !== 'none' && questState(s, quest) === 'complete';
}

export interface Nearby {
  id: string;
  text: string;
  spotId: string;
}

/**
 * 「近くのこと」 (spec §7): at most three things that can be done now. It
 * only points; choosing one shows the place, it never does the task.
 */
const GREETINGS = new Set(['okon', 'kisuke', 'oharu', 'kinji']);

export function nearby(s: SaveData): Nearby[] {
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
  // 町の写生: the next place not yet drawn, walking from the bridge
  if (questState(s, 'kaze') === 'complete') {
    const left = SKETCHES.filter((k) => !s.journal.pages.some((p) => p.pageId === sketchPageId(k.id)));
    if (left.length) out.push({ id: 'sketches', text: `町の景色を写す（あと${left.length}か所）。${left[0].title}`, spotId: `a-${left[0].spots[0]}` });
  }
  // stories under way first, then the sketches, then people not yet greeted
  const greeting = (n: Nearby) => GREETINGS.has(n.id);
  return [...out.filter((n) => !greeting(n)), ...out.filter(greeting)].slice(0, 3);
}
