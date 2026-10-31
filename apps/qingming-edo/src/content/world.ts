import type { CharacterDef, HotspotDef, ItemDef, PageDef, QuestDef, SceneDef, WorldDef } from '../contract';
import { SCHEMA_VERSION, WORLD_ID } from '../contract';

// 日本橋北詰付近の創作街区 (spec §5, §8). Every shop, name, relation and event
// here is fiction; none is presented as a shop seen in『熈代勝覧』.
//
// Scene units: the street is 9000 × 700 (nine sections of 1000), ground line at y = 540.
// It reads right to left like a scroll (spec §7): play starts at the bridge
// on the right, and the street goes on to the left.

export const SCENE_W = 9000;
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

// Read off the gridded painting (docs/painted-worlds/art/edo/README.md); people
// stand where scene/painted.tsx SPOTS puts their feet.
export const HOTSPOTS: HotspotDef[] = [
  // people
  { id: 'h-sokichi', targetId: 'sokichi', kind: 'character', anchor: { x: 8645, y: 500 }, hitArea: { x: 8628, y: 470, w: 36, h: 94 }, priority: 5 },
  { id: 'h-seita', targetId: 'seita', kind: 'character', anchor: { x: 8530, y: 486 }, hitArea: { x: 8474, y: 478, w: 66, h: 100 }, priority: 5 },
  { id: 'h-okon', targetId: 'okon', kind: 'character', anchor: { x: 8205, y: 490 }, hitArea: { x: 8188, y: 456, w: 34, h: 94 }, priority: 5 },
  { id: 'h-kisuke', targetId: 'kisuke', kind: 'character', anchor: { x: 7660, y: 490 }, hitArea: { x: 7638, y: 454, w: 44, h: 94 }, priority: 5 },
  { id: 'h-oharu', targetId: 'oharu', kind: 'character', anchor: { x: 7520, y: 520 }, hitArea: { x: 7500, y: 480, w: 40, h: 94 }, priority: 5 },
  { id: 'h-kinji', targetId: 'kinji', kind: 'character', anchor: { x: 6680, y: 530 }, hitArea: { x: 6650, y: 490, w: 60, h: 90 }, priority: 5 },
  // the first help: one tap on the blowing papers (spec §9 一頁目)
  { id: 'h-papers', targetId: 'papers', kind: 'prop', anchor: { x: 8480, y: 516 }, hitArea: { x: 8444, y: 500, w: 76, h: 32 }, priority: 8, visibleWhen: notPressed },
  // ambient reactions (spec §5: 8 or more) — all on things in the painting
  { id: 'a-noren-aoba', targetId: 'noren-aoba', kind: 'ambient', anchor: { x: 8517, y: 428 }, hitArea: { x: 8415, y: 405, w: 205, h: 45 }, priority: 1 },
  { id: 'a-noren-kure', targetId: 'noren-kure', kind: 'ambient', anchor: { x: 8205, y: 410 }, hitArea: { x: 8070, y: 392, w: 270, h: 36 }, priority: 1 },
  { id: 'a-lantern', targetId: 'lantern', kind: 'ambient', anchor: { x: 8388, y: 476 }, hitArea: { x: 8374, y: 448, w: 28, h: 58 }, priority: 2 },
  { id: 'a-brooms', targetId: 'brooms', kind: 'ambient', anchor: { x: 7077, y: 446 }, hitArea: { x: 7050, y: 400, w: 55, h: 92 }, priority: 2 },
  { id: 'a-steam', targetId: 'steam', kind: 'ambient', anchor: { x: 7577, y: 437 }, hitArea: { x: 7556, y: 415, w: 42, h: 45 }, priority: 2 },
  { id: 'a-barrel', targetId: 'barrel', kind: 'ambient', anchor: { x: 7414, y: 434 }, hitArea: { x: 7398, y: 410, w: 32, h: 48 }, priority: 2 },
  { id: 'a-giboshi', targetId: 'giboshi', kind: 'ambient', anchor: { x: 8874, y: 443 }, hitArea: { x: 8860, y: 425, w: 28, h: 36 }, priority: 2 },
  { id: 'a-willow', targetId: 'willow', kind: 'ambient', anchor: { x: 8740, y: 350 }, hitArea: { x: 8685, y: 215, w: 110, h: 270 }, priority: 1 },
  { id: 'a-boat', targetId: 'boat', kind: 'ambient', anchor: { x: 8822, y: 617 }, hitArea: { x: 8655, y: 566, w: 335, h: 104 }, priority: 2 },
  { id: 'a-ladder', targetId: 'ladder', kind: 'ambient', anchor: { x: 6468, y: 370 }, hitArea: { x: 6418, y: 210, w: 100, h: 320 }, priority: 1 },
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
  // right to left, as the scroll reads: the bridge end first
  sections: Array.from({ length: 9 }, (_, i) => ({ id: `s${8 - i}`, x0: (8 - i) * 1000, x1: (9 - i) * 1000 })),
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
  lantern: '辻行灯。夜になれば、この灯りが通りを照らす。',
  brooms: '竹箒が束になって、軒先に立てかけてある。',
  steam: '茶店の釜から、白い湯気が立ちのぼる。',
  barrel: '路地の天水桶に、空が映っている。',
  giboshi: '欄干の擬宝珠が、朝の光を返している。',
  willow: '川風に、柳の枝がそよいだ。',
  boat: '荷を積んだ舟が、岸につながれている。',
  ladder: '屋根に長い梯子が掛けてある。火の用心のためだろうか。',
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
  {
    // 二頁目：いつもの道具 (spec §9). Either ending completes it, for the same reward.
    id: 'dougu',
    prerequisites: [{ quest: 'kaze', is: 'complete' }],
    steps: [
      { id: 'wrap', doneWhen: { flag: 'dougu_wrapped' } },
      { id: 'hand-over', doneWhen: { any: [{ flag: 'dougu_by_hand' }, { flag: 'dougu_entrusted' }] } },
    ],
    completionEffects: [
      { type: 'grant', rewardId: 'dougu', amountMinor: 24 },
      { type: 'familiarity', characterId: 'okon', eventId: 'dougu' },
      { type: 'questState', quest: 'dougu', state: 'complete' },
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
  { id: 'p02-dougu', triggerId: 'dougu', compositionId: 'dougu-{deliver|entrust}', captionId: 'dougu', sourceRefs: [] },
];

export const PAGE_TITLES: Record<string, string> = {
  'p01-kaze': '風のいたずら',
  'p02-dougu': 'いつもの道具',
};

/** 包みを整える (spec §10): three goods, each matched to the cloth with its mark. Fiction. */
export const WRAP_ITEMS = [
  { id: 'bento', label: '塗り直した弁当箱', mark: 'wave', markLabel: '波の印' },
  { id: 'hashi', label: '箸箱', mark: 'diamond', markLabel: '菱の印' },
  { id: 'toishi', label: '砥石', mark: 'circle', markLabel: '丸の印' },
] as const;
export type WrapMark = (typeof WRAP_ITEMS)[number]['mark'];

export function kazeComposition(subject: Subject, framing: Framing): string {
  return `kaze-${subject}-${framing}`;
}
export function parseKaze(compositionId: string): { subject: Subject; framing: Framing } | null {
  const m = /^kaze-(hands|shopfront|street)-(near|wide)$/.exec(compositionId);
  return m ? { subject: m[1] as Subject, framing: m[2] as Framing } : null;
}
