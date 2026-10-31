import type { CharacterDef, HotspotDef, ItemDef, PageDef, QuestDef, SceneDef, WorldDef } from '../contract';
import { SCHEMA_VERSION, WORLD_ID } from '../contract';

// 日本橋北詰付近の創作街区 (spec §5, §8). Every shop, name, relation and event
// here is fiction; none is presented as a shop seen in『熈代勝覧』.
//
// Scene units: the street is 3000 × 700, ground line at y = 540.
// It reads right to left like a scroll (spec §7): play starts at the bridge
// on the right, and the street goes on to the left.

export const SCENE_W = 3000;
export const SCENE_H = 700;
export const GROUND_Y = 540;

const fictionChar = () => ({ evidenceType: 'fiction' as const, sourceRefs: [], reviewStatus: 'reviewed' as const, knowledgeIds: [], isChild: false });

export const CHARACTERS: CharacterDef[] = [
  { ...fictionChar(), id: 'sokichi', sceneId: 'nihonbashi-kita', displayName: '宗吉', scriptId: 'sokichi' },
  { ...fictionChar(), id: 'seita', sceneId: 'nihonbashi-kita', displayName: '清太', scriptId: 'seita' },
  { ...fictionChar(), id: 'okon', sceneId: 'nihonbashi-kita', displayName: 'お紺', scriptId: 'okon' },
  { ...fictionChar(), id: 'kisuke', sceneId: 'nihonbashi-kita', displayName: '喜助', scriptId: 'kisuke' },
  { ...fictionChar(), id: 'kinji', sceneId: 'nihonbashi-kita', displayName: '金次', scriptId: 'kinji' },
  { ...fictionChar(), id: 'oharu', sceneId: 'nihonbashi-kita', displayName: 'お春', scriptId: 'oharu' },
];
export const characterById = new Map(CHARACTERS.map((c) => [c.id, c]));

/** Who each person is, for the dialogue header (spec §8). */
export const ROLES: Record<string, string> = {
  sokichi: '師匠・絵師',
  seita: '紙屋「青葉屋」の手代',
  okon: '道具屋「くれ竹」のおかみ',
  kisuke: '茶店「喜の字」の主人',
  kinji: '振売り',
  oharu: '町の使い',
};

const notPressed = { not: { flag: 'paper_pressed' } };

export const HOTSPOTS: HotspotDef[] = [
  // people
  { id: 'h-sokichi', targetId: 'sokichi', kind: 'character', anchor: { x: 2604, y: 470 }, hitArea: { x: 2574, y: 394, w: 64, h: 146 }, priority: 5 },
  { id: 'h-seita', targetId: 'seita', kind: 'character', anchor: { x: 2440, y: 460 }, hitArea: { x: 2406, y: 380, w: 70, h: 160 }, priority: 5 },
  { id: 'h-okon', targetId: 'okon', kind: 'character', anchor: { x: 1960, y: 460 }, hitArea: { x: 1928, y: 384, w: 64, h: 156 }, priority: 5 },
  { id: 'h-kisuke', targetId: 'kisuke', kind: 'character', anchor: { x: 1360, y: 460 }, hitArea: { x: 1328, y: 384, w: 64, h: 156 }, priority: 5 },
  { id: 'h-oharu', targetId: 'oharu', kind: 'character', anchor: { x: 1130, y: 460 }, hitArea: { x: 1100, y: 392, w: 60, h: 148 }, priority: 5 },
  { id: 'h-kinji', targetId: 'kinji', kind: 'character', anchor: { x: 760, y: 460 }, hitArea: { x: 700, y: 380, w: 120, h: 160 }, priority: 5 },
  // the first help: one tap on the blowing papers (spec §9 一頁目)
  { id: 'h-papers', targetId: 'papers', kind: 'prop', anchor: { x: 2300, y: 440 }, hitArea: { x: 2230, y: 410, w: 150, h: 60 }, priority: 8, visibleWhen: notPressed },
  // ambient reactions (spec §5: 8 or more)
  { id: 'a-noren-aoba', targetId: 'noren-aoba', kind: 'ambient', anchor: { x: 2330, y: 300 }, hitArea: { x: 2190, y: 262, w: 300, h: 70 }, priority: 1 },
  { id: 'a-noren-kure', targetId: 'noren-kure', kind: 'ambient', anchor: { x: 1880, y: 300 }, hitArea: { x: 1740, y: 262, w: 300, h: 70 }, priority: 1 },
  { id: 'a-sparrows', targetId: 'sparrows', kind: 'ambient', anchor: { x: 2076, y: 168 }, hitArea: { x: 2030, y: 148, w: 92, h: 40 }, priority: 2 },
  { id: 'a-dog', targetId: 'dog', kind: 'ambient', anchor: { x: 1590, y: 520 }, hitArea: { x: 1550, y: 490, w: 80, h: 50 }, priority: 2 },
  { id: 'a-steam', targetId: 'steam', kind: 'ambient', anchor: { x: 1250, y: 380 }, hitArea: { x: 1210, y: 330, w: 80, h: 110 }, priority: 2 },
  { id: 'a-barrel', targetId: 'barrel', kind: 'ambient', anchor: { x: 2120, y: 500 }, hitArea: { x: 2090, y: 460, w: 60, h: 80 }, priority: 2 },
  { id: 'a-giboshi', targetId: 'giboshi', kind: 'ambient', anchor: { x: 2790, y: 410 }, hitArea: { x: 2770, y: 380, w: 40, h: 50 }, priority: 2 },
  { id: 'a-willow', targetId: 'willow', kind: 'ambient', anchor: { x: 2550, y: 260 }, hitArea: { x: 2500, y: 160, w: 60, h: 200 }, priority: 1 },
  { id: 'a-boat', targetId: 'boat', kind: 'ambient', anchor: { x: 2880, y: 600 }, hitArea: { x: 2820, y: 570, w: 140, h: 60 }, priority: 2 },
];

export const SCENE: SceneDef = {
  id: 'nihonbashi-kita',
  bounds: { x: 0, y: 0, w: SCENE_W, h: SCENE_H },
  layers: [
    { id: 'far', depth: 0.55 },
    { id: 'mid', depth: 1 },
    { id: 'near', depth: 1.12 },
  ],
  hotspots: HOTSPOTS,
  ambienceId: 'street-morning',
  sections: [
    { id: 'hashizume', x0: 2000, x1: 3000 },
    { id: 'chamise', x0: 1000, x1: 2000 },
    { id: 'furiuri', x0: 0, x1: 1000 },
  ],
};

export const WORLD: WorldDef = {
  schemaVersion: SCHEMA_VERSION,
  worldId: WORLD_ID,
  contentVersion: '0.1.0',
  defaultLocale: 'ja',
  scenes: [SCENE],
};

/** Short captions for ambient reactions; read aloud too (sound is optional, spec §13). */
export const AMBIENT: Record<string, string> = {
  'noren-aoba': '暖簾が、ふわりと揺れた。',
  'noren-kure': '藍の暖簾の向こうで、道具を拭く音がする。',
  sparrows: '屋根の雀が、ぱっと飛び立った。',
  dog: '犬がこちらを見て、尾を一つ振った。',
  steam: '茶店の釜から、白い湯気が立ちのぼる。',
  barrel: '天水桶の水面に、空が映っている。',
  giboshi: '欄干の擬宝珠が、朝の光を返している。',
  willow: '川風に、柳の枝がそよいだ。',
  boat: '荷を積んだ舟が、ゆっくり橋の下へ入っていく。',
};

export const QUESTS: QuestDef[] = [
  {
    id: 'kaze',
    prerequisites: [],
    steps: [
      { id: 'press', doneWhen: { flag: 'paper_pressed' } },
      { id: 'sketch', doneWhen: { flag: 'kaze_page' } },
    ],
    completionEffects: [
      { type: 'grant', rewardId: 'kaze', amountMinor: 12 },
      { type: 'familiarity', characterId: 'seita', eventId: 'kaze' },
      { type: 'questState', quest: 'kaze', state: 'complete' },
    ],
    replayPolicy: 'memory-only',
  },
];
export const questById = new Map(QUESTS.map((q) => [q.id, q]));

/** Spec §11 仮設定. 'balance': game values, not 1805 prices. Not on sale yet. */
export const ITEMS: ItemDef[] = [
  { id: 'tea-sweet', displayName: '茶と菓子', currencyId: 'mon', priceMinor: 6, evidenceType: 'balance', sourceRefs: [], reviewStatus: 'reviewed' },
  { id: 'title-slip', displayName: '記念の題箋', currencyId: 'mon', priceMinor: 12, evidenceType: 'balance', sourceRefs: [], reviewStatus: 'reviewed' },
];

// ---------------------------------------------------------------- pages

export type Subject = 'hands' | 'shopfront' | 'street';
export type Framing = 'near' | 'wide';
export const SUBJECTS: { id: Subject; label: string }[] = [
  { id: 'hands', label: '働く手' },
  { id: 'shopfront', label: '店先' },
  { id: 'street', label: '通りの往来' },
];
export const FRAMINGS: { id: Framing; label: string }[] = [
  { id: 'near', label: '近景' },
  { id: 'wide', label: '全景' },
];
export const TITLE_STYLES = [
  { id: 'plain', label: '白の題箋' },
  { id: 'indigo', label: '藍の題箋' },
  { id: 'vermilion', label: '朱の題箋' },
] as const;

export const PAGE_SLOTS = 12; // spec §5: 絵巻帳12頁

export const PAGES: PageDef[] = [
  { id: 'p01-kaze', triggerId: 'kaze', compositionId: 'kaze-{subject}-{framing}', captionId: 'kaze', sourceRefs: [] },
];

export const PAGE_TITLES: Record<string, string> = {
  'p01-kaze': '風のいたずら',
};

export function kazeComposition(subject: Subject, framing: Framing): string {
  return `kaze-${subject}-${framing}`;
}
export function parseKaze(compositionId: string): { subject: Subject; framing: Framing } | null {
  const m = /^kaze-(hands|shopfront|street)-(near|wide)$/.exec(compositionId);
  return m ? { subject: m[1] as Subject, framing: m[2] as Framing } : null;
}
