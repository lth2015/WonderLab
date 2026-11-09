import { CHARACTERS, type CharacterId } from './content';
import type { GameState, QuestId } from './game';
import type { LostMapHint } from './townMap';

// 汴河拾遗 (C5, owner's demo feedback 2026-11-04: 「寻宝」). Five small things lost along the
// roll. They lie in the painting from the first finished story on, glinting now and then, so a
// sharp eye can find one before any word. Its owner speaks of it only after their own story's
// thanks has been heard (the first visit after it), then it is in 附近 and on the map as ？.
// Found, it is carried in 行囊 until given back; the thanks is the reward, never money.

export interface LostThing {
  id: 'brush' | 'knot' | 'whistle' | 'comb' | 'seal';
  owner: CharacterId;
  /** The owner's story, finished first. */
  needs: QuestId;
  /** Where it lies (scroll units: x along the roll, y the foot of the thing). */
  x: number;
  y: number;
  /** Drawn width and height in scroll units (a person is about 154 tall). */
  w: number;
  h: number;
  name: string;
  /** Where it is, as the owner tells it. */
  place: string;
  hint: string;
  find: string;
  back: string;
}

export const LOST: readonly LostThing[] = [
  {
    id: 'brush', owner: 'liu', needs: 'paper', x: 3770, y: 790, w: 20, h: 34.8,
    name: '竹管小笔', place: '水埠石阶',
    hint: '对了，我那支竹管小笔不见了。早上去水埠洗笔，回来就只剩笔洗了……',
    find: '水埠的石阶缝里，夹着一支竹管小笔，笔头还是湿的。',
    back: '就是它！笔杆上这道刻痕，是我第一次削笔时留下的。谢谢你，往后画纸借你随便用。',
  },
  {
    id: 'knot', owner: 'zhou', needs: 'boat', x: 5300, y: 630, w: 18, h: 19.2,
    name: '红丝绳结', place: '货港码头',
    hint: '前日去货港帮人卸粮，系在腰间的红绳结就松了。老伴打的，图个行船平安。',
    find: '货港的石板上，一团褪了色的红丝绳结，被往来的脚步踢到了墙根。',
    back: '哎，是它。系回腰上，心就定了。行船的人，总得有个念想。多谢你。',
  },
  {
    id: 'whistle', owner: 'cheng', needs: 'boat', x: -4380, y: 850, w: 26, h: 32.4,
    name: '竹哨', place: '城外大道',
    hint: '我那只竹哨也丢了。前天替人推牛车，一路推到城外大道，回来腰上就空了。',
    find: '城外大道的车辙边，躺着一只系着细绳的竹哨。',
    back: '我的哨子！船靠岸时一吹，周伯就知道我到了。这下又能唤船了，谢谢你。',
  },
  {
    id: 'comb', owner: 'he', needs: 'purse', x: -7720, y: 880, w: 28, h: 16.4,
    name: '木梳', place: '城里井台',
    hint: '说来好笑，我自己也丢了东西。去城里井台打水，把木梳搁在井沿上，就忘了拿。',
    find: '井台边的石板地上，躺着一把磨得光滑的木梳，大约是从井沿上滑落的。',
    back: '这梳子用了十几年，齿都磨圆了，换一把倒不惯。来，这碗茶算我的心意——不收钱。',
  },
  {
    id: 'seal', owner: 'shen', needs: 'trace', x: 8640, y: 600, w: 18, h: 18.4,
    name: '小石印', place: '水磨旁的小路',
    hint: '我年轻时刻的一方小印，前些日子去城东看水磨，回来就找不着了。',
    find: '水磨旁的土路边，卧着一方小石印，印钮是一只伏着的小兽。',
    back: '……多少年了，还以为再见不着。画上落款的印，也是你帮我找回来的。',
  },
];

export type LostId = LostThing['id'];
export const LOST_IDS = LOST.map((t) => t.id);
const byId = (id: string) => LOST.find((t) => t.id === id);

/** Things lie in the painting from the first finished story (一纸春风) on. */
export const lostOpen = (g: GameState) => g.claimed.includes('paper');

/** Not yet picked up, and visible in the painting. */
export const lyingThings = (g: GameState) => (lostOpen(g) ? LOST.filter((t) => !g.progress.lost.found.includes(t.id)) : []);

/** Picked up, not yet given back: in 行囊. */
export const carriedThings = (g: GameState) => LOST.filter((t) => g.progress.lost.found.includes(t.id) && !g.progress.lost.returned.includes(t.id));

/** Heard of and still lying: in 附近 and on the map. */
export const heardThings = (g: GameState) => LOST.filter((t) => g.progress.lost.heard.includes(t.id) && !g.progress.lost.found.includes(t.id));

/**
 * What visiting a person does about their lost thing, decided as the panel opens:
 * - 'seen': their story is done and this is the first visit since: the thanks comes first;
 * - 'hint': the next visit: they speak of the loss (once);
 * - 'back': the player carries it: it can be given back;
 * - null: nothing.
 */
export function lostOnVisit(g: GameState, who: CharacterId): { kind: 'seen' | 'hint' | 'back'; thing: LostThing } | null {
  const thing = LOST.find((t) => t.owner === who);
  if (!thing || !lostOpen(g)) return null;
  const l = g.progress.lost;
  if (l.found.includes(thing.id)) return l.returned.includes(thing.id) ? null : { kind: 'back', thing };
  if (!g.claimed.includes(thing.needs)) return null;
  if (!l.seen.includes(who)) return { kind: 'seen', thing };
  if (!l.heard.includes(thing.id)) return { kind: 'hint', thing };
  return null;
}

/** For the map (C4 townMap.ts LostMapHint): the area, drawn a little off the thing itself. */
export function lostMapHints(g: GameState): LostMapHint[] {
  return LOST.map((t) => ({
    id: t.id,
    x: t.x + (t.id.length % 2 ? 90 : -90),
    y: t.y - 40,
    label: `${CHARACTERS[t.owner].name}的${t.name} · ${t.place}一带`,
    heard: g.progress.lost.heard.includes(t.id),
    found: g.progress.lost.found.includes(t.id),
  }));
}

export const isLostId = (id: string): id is LostId => !!byId(id);
