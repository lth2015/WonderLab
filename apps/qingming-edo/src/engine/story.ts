import type { HotspotDef, SaveData } from '../contract';
import { ENTRIES, NODES } from '../content/script';
import { HOTSPOTS, PAGE_SLOTS, questById, SKETCHES, sketchPageId } from '../content/world';
import { hasFlag, questState, test } from './state';
import { timeOf } from './time';

/** The node a person (or prop) opens with now. */
export function entryFor(targetId: string, s: SaveData): string | null {
  const rules = ENTRIES[targetId];
  if (!rules) return null;
  const node = rules.find((r) => test(s, r.when))?.node ?? null;
  // 朝・昼・夕: an everyday word may have its own version for the time shown (content/script.ts AT_TIME)
  const timed = node && `${node}@${timeOf(s)}`;
  return timed && NODES[timed] ? timed : node;
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
const OFFERS = new Set(['dougu', 'tenugui', 'fumi', 'kashi', 'yube', 'ai', 'hashi', 'neko', 'inkyo']);

/**
 * `here`: the scene x at the middle of the view. With five stories there are more
 * offers than the three places in the list, so the ones nearest to the player come
 * first; what is already under way always stays at the top.
 */
/** 橋のたもと: whom 宗吉 asks the player to invite, and the story that made each a friend. */
const HASHI_PEOPLE = [
  { id: 'okon', name: 'お紺', spot: 'h-okon', quest: 'dougu' },
  { id: 'kisuke', name: '喜助', spot: 'h-kisuke', quest: 'tenugui' },
  { id: 'ihei', name: '伊兵衛', spot: 'h-ihei', quest: 'fumi' },
  { id: 'omatsu', name: 'おまつ', spot: 'h-omatsu', quest: 'kashi' },
] as const;

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
  // 朝の藍: in the morning; then the indigo things not yet found
  const ai = questState(s, 'ai');
  const morning = timeOf(s) === 'morning';
  if (ai !== 'complete' && questState(s, 'kaze') === 'complete') {
    const left = [1, 2, 3].filter((n) => !hasFlag(s, `ai_seen${n}`));
    if (hasFlag(s, 'ai_look') && left.length === 0) out.push({ id: 'ai-done', text: '見つけた藍のことを、宗吉に話す', spotId: 'h-sokichi' });
    else if (hasFlag(s, 'ai_look')) out.push({ id: 'ai-find', text: morning ? `町の藍を探す（あと${left.length}つ）。暖簾、甕、干した布` : '朝になったら、町の藍を探す', spotId: morning ? `h-ai${left[0]}` : 'h-sokichi' });
    else if (morning) out.push({ id: 'ai', text: '宗吉が、朝の光の話をしたそうにしている', spotId: 'h-sokichi' });
    else out.push({ id: 'ai', text: '朝の宗吉が、何か教えたそうにしていた（上の時刻で「朝」に）', spotId: 'h-sokichi' });
  }
  // 夕暮れの灯: in the evening; then the lamps not yet lit, nearest first
  const yube = questState(s, 'yube');
  const evening = timeOf(s) === 'evening';
  if (yube !== 'complete' && questState(s, 'dougu') === 'complete' && questState(s, 'tenugui') === 'complete') {
    const left = [1, 2, 3].filter((n) => !hasFlag(s, `yube_lit${n}`));
    if (hasFlag(s, 'yube_fire') && left.length === 0) out.push({ id: 'yube-done', text: '三つの灯がともった。茶店の喜助に知らせる', spotId: 'h-kisuke' });
    else if (hasFlag(s, 'yube_fire')) out.push({ id: 'yube-light', text: evening ? `提灯に火を入れて回る（あと${left.length}つ）` : '夕方になったら、提灯に火を入れて回る', spotId: evening ? `h-lamp${left[0]}` : 'h-kisuke' });
    else if (evening) out.push({ id: 'yube', text: '茶店の喜助が、暗くなる通りを気にしている', spotId: 'h-kisuke' });
    else out.push({ id: 'yube', text: '夕方の茶店で、喜助が何か頼みたそうにしている（上の時刻で「夕」に）', spotId: 'h-kisuke' });
  }
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
  // ご隠居の散歩: at noon, the old man of the towel; then the bench he is walking to
  if (questState(s, 'tenugui') === 'complete' && questState(s, 'inkyo') !== 'complete') {
    if (hasFlag(s, 'inkyo_arrived')) out.push({ id: 'inkyo-bench', text: 'ご隠居と、川端の縁台に着いた', spotId: 'h-inkyo-bench' });
    else if (hasFlag(s, 'inkyo_walk')) out.push({ id: 'inkyo-walk', text: '町はずれの川端の縁台へ。ご隠居は、ゆっくりついてくる（急ぐと置いていってしまう）', spotId: 'a-bench' });
    else if (timeOf(s) === 'noon') out.push({ id: 'inkyo', text: '杖をついたご隠居が、町はずれのほうを眺めている', spotId: 'h-inkyo' });
    else out.push({ id: 'inkyo', text: '昼の通りで、手拭いのご隠居が何か言いたそうにしていた（上の時刻で「昼」に）', spotId: 'a-flowers' });
  }
  // 茶店の猫: where the cat went last (the hint says which way it ran)
  if (hasFlag(s, 'kisuke_seen_done') && questState(s, 'neko') !== 'complete') {
    if (hasFlag(s, 'neko_caught')) out.push({ id: 'neko-back', text: 'こはくを、茶店の喜助のところへ連れて帰る', spotId: 'h-kisuke' });
    else if (hasFlag(s, 'neko_hop2')) out.push({ id: 'neko-3', text: '三毛猫は、堀の河岸のほうへ駆けていった', spotId: 'h-neko3' });
    else if (hasFlag(s, 'neko_hop1')) out.push({ id: 'neko-2', text: '三毛猫は、米屋のほうへ駆けていった', spotId: 'h-neko2' });
    else if (hasFlag(s, 'neko_look')) out.push({ id: 'neko-1', text: '喜助の三毛猫を探す。井戸のほうで、鳴き声がした', spotId: 'h-neko1' });
    else out.push({ id: 'neko', text: '茶店の喜助が、縁台の下をのぞきこんでいる', spotId: 'h-kisuke' });
  }
  // 橋のたもと: once the four have their pages; then the people not yet invited, nearest first
  const hashi = questState(s, 'hashi');
  if (hashi !== 'complete' && HASHI_PEOPLE.every((p) => questState(s, p.quest) === 'complete')) {
    const xAt = (spot: string) => HOTSPOTS.find((h) => h.id === spot)?.anchor.x ?? 0;
    const left = HASHI_PEOPLE.filter((p) => !hasFlag(s, `hashi_${p.id}`));
    if (here !== undefined) left.sort((p, q) => Math.abs(xAt(p.spot) - here) - Math.abs(xAt(q.spot) - here));
    if (hasFlag(s, 'hashi_ask') && left.length === 0) out.push({ id: 'hashi-done', text: '皆に声をかけ終えた。橋のたもとの宗吉のところへ', spotId: 'h-sokichi' });
    else if (hasFlag(s, 'hashi_ask')) out.push({ id: 'hashi-invite', text: `橋のたもとへ来てもらうよう声をかける（あと${left.length}人）。${left.map((p) => p.name).join('、')}`, spotId: left[0].spot });
    else out.push({ id: 'hashi', text: '宗吉が、絵巻帳をめくりながら何か考えている', spotId: 'h-sokichi' });
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
