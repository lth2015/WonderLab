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

/** The stories someone is waiting to ask about (not yet under way). */
const OFFERS = new Set(['dougu', 'tenugui', 'fumi', 'kashi']);

/**
 * `here`: the scene x at the middle of the view. With five stories there are more
 * offers than the three places in the list, so the ones nearest to the player come
 * first; what is already under way always stays at the top.
 */
export function nearby(s: SaveData, here?: number): Nearby[] {
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
  // 母への文: the letter, then the man walking with his abacus
  if (questState(s, 'kaze') === 'complete' && questState(s, 'fumi') !== 'complete') {
    if (hasFlag(s, 'fumi_carry')) out.push({ id: 'fumi-carry', text: '文の持ち主に追いつく。そろばんの包みを抱えて歩いている', spotId: 'h-ihei' });
    else out.push({ id: 'fumi', text: '米屋の前の道に、何か落ちている', spotId: 'h-fumi' });
  }
  // 河岸の朝: across the bridge. The search hint points at the boats, never at 亀吉 himself.
  const kashi = questState(s, 'kashi');
  if (questState(s, 'kaze') === 'complete' && kashi !== 'complete') {
    if (hasFlag(s, 'kashi_found')) out.push({ id: 'kashi-home', text: '亀吉を、おまつのところへ連れて帰る', spotId: 'h-kame-hidden' });
    else if (hasFlag(s, 'kashi_search')) out.push({ id: 'kashi-search', text: '亀吉を探す。舟の荷揚げを眺めるのが好きらしい', spotId: 'a-kashi-boats' });
    else out.push({ id: 'kashi', text: '橋の向こうの河岸で、おまつが誰かを呼んでいる', spotId: 'h-omatsu' });
  }
  // 町の写生: the next place not yet drawn, walking from the bridge
  if (questState(s, 'kaze') === 'complete') {
    const left = SKETCHES.filter((k) => !s.journal.pages.some((p) => p.pageId === sketchPageId(k.id)));
    if (left.length) out.push({ id: 'sketches', text: `町の景色を写す（あと${left.length}か所）。${left[0].title}`, spotId: `a-${left[0].spots[0]}` });
  }
  // under way first, then the offers, the sketches, and people not yet greeted
  const greeting = (n: Nearby) => GREETINGS.has(n.id);
  const offer = (n: Nearby) => OFFERS.has(n.id);
  const sketching = (n: Nearby) => n.id === 'sketches';
  const xOf = (n: Nearby) => HOTSPOTS.find((h) => h.id === n.spotId)?.anchor.x ?? 0;
  const near = (a: Nearby[]) => (here === undefined ? a : [...a].sort((p, q) => Math.abs(xOf(p) - here) - Math.abs(xOf(q) - here)));
  const going = out.filter((n) => !greeting(n) && !offer(n) && !sketching(n));
  return [...going, ...near(out.filter(offer)), ...out.filter(sketching), ...near(out.filter(greeting))].slice(0, 3);
}
