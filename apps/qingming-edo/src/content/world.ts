import type { CharacterDef, HotspotDef, ItemDef, PageDef, QuestDef, SceneDef, WorldDef } from '../contract';
import { SCHEMA_VERSION, WORLD_ID } from '../contract';

// 日本橋北詰付近の創作街区 (spec §5, §8). Every shop, name, relation and event
// here is fiction; none is presented as a shop seen in『熈代勝覧』.
//
// Scene units: the street is 14000 × 700 (fourteen sections of 1000), shop floors near y = 540.
// It reads right to left like a scroll (spec §7): play starts at the bridge
// on the right, and the street goes on to the left.

export const SCENE_W = 14000;
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
  // people (feet at scene/painted.tsx SPOTS)
  { id: 'h-sokichi', targetId: 'sokichi', kind: 'character', anchor: { x: 12640, y: 525 }, hitArea: { x: 12622, y: 486, w: 36, h: 94 }, priority: 5 },
  { id: 'h-seita', targetId: 'seita', kind: 'character', anchor: { x: 12480, y: 500 }, hitArea: { x: 12410, y: 486, w: 170, h: 108 }, priority: 5 },
  { id: 'h-okon', targetId: 'okon', kind: 'character', anchor: { x: 12150, y: 505 }, hitArea: { x: 12133, y: 468, w: 34, h: 94 }, priority: 5 },
  { id: 'h-kisuke', targetId: 'kisuke', kind: 'character', anchor: { x: 11650, y: 500 }, hitArea: { x: 11628, y: 452, w: 44, h: 94 }, priority: 5 },
  { id: 'h-oharu', targetId: 'oharu', kind: 'character', anchor: { x: 11400, y: 535 }, hitArea: { x: 11380, y: 488, w: 40, h: 94 }, priority: 5 },
  { id: 'h-kinji', targetId: 'kinji', kind: 'character', anchor: { x: 7480, y: 525 }, hitArea: { x: 7452, y: 480, w: 56, h: 92 }, priority: 5 },
  // the first help: one tap on the blowing papers (spec §9 一頁目)
  { id: 'h-papers', targetId: 'papers', kind: 'prop', anchor: { x: 12420, y: 522 }, hitArea: { x: 12378, y: 504, w: 90, h: 40 }, priority: 8, visibleWhen: notPressed },
  // ambient reactions on things in the painting (spec §5: 8 or more)
  { id: 'a-willow', targetId: 'willow', kind: 'ambient', anchor: { x: 13160, y: 225 }, hitArea: { x: 13060, y: 60, w: 200, h: 330 }, priority: 1 },
  { id: 'a-boat', targetId: 'boat', kind: 'ambient', anchor: { x: 13350, y: 575 }, hitArea: { x: 13190, y: 500, w: 320, h: 150 }, priority: 2 },
  { id: 'a-giboshi', targetId: 'giboshi', kind: 'ambient', anchor: { x: 13530, y: 286 }, hitArea: { x: 13512, y: 262, w: 36, h: 48 }, priority: 2 },
  { id: 'a-noren-aoba', targetId: 'noren-aoba', kind: 'ambient', anchor: { x: 12490, y: 387 }, hitArea: { x: 12290, y: 360, w: 400, h: 55 }, priority: 1 },
  { id: 'a-noren-kure', targetId: 'noren-kure', kind: 'ambient', anchor: { x: 12140, y: 387 }, hitArea: { x: 12000, y: 360, w: 280, h: 55 }, priority: 1 },
  { id: 'a-lantern', targetId: 'lantern', kind: 'ambient', anchor: { x: 12745, y: 415 }, hitArea: { x: 12722, y: 350, w: 46, h: 130 }, priority: 2 },
  { id: 'a-steam', targetId: 'steam', kind: 'ambient', anchor: { x: 11571, y: 396 }, hitArea: { x: 11542, y: 372, w: 58, h: 48 }, priority: 2 },
  { id: 'a-barrel', targetId: 'barrel', kind: 'ambient', anchor: { x: 11400, y: 462 }, hitArea: { x: 11378, y: 440, w: 44, h: 44 }, priority: 2 },
  { id: 'a-plum', targetId: 'plum', kind: 'ambient', anchor: { x: 10660, y: 270 }, hitArea: { x: 10560, y: 170, w: 200, h: 200 }, priority: 1 },
  { id: 'a-well', targetId: 'well', kind: 'ambient', anchor: { x: 10475, y: 435 }, hitArea: { x: 10400, y: 380, w: 150, h: 110 }, priority: 2 },
  { id: 'a-cart', targetId: 'cart', kind: 'ambient', anchor: { x: 10165, y: 440 }, hitArea: { x: 10100, y: 400, w: 130, h: 80 }, priority: 2 },
  { id: 'a-cloth-banner', targetId: 'cloth-banner', kind: 'ambient', anchor: { x: 9030, y: 340 }, hitArea: { x: 9000, y: 250, w: 60, h: 180 }, priority: 2 },
  { id: 'a-cloth-shop', targetId: 'cloth-shop', kind: 'ambient', anchor: { x: 9300, y: 455 }, hitArea: { x: 9150, y: 400, w: 300, h: 110 }, priority: 1 },
  { id: 'a-timber', targetId: 'timber', kind: 'ambient', anchor: { x: 8450, y: 455 }, hitArea: { x: 8300, y: 380, w: 300, h: 150 }, priority: 1 },
  { id: 'a-banner', targetId: 'banner', kind: 'ambient', anchor: { x: 8800, y: 360 }, hitArea: { x: 8770, y: 290, w: 60, h: 140 }, priority: 2 },
  { id: 'a-ricebales', targetId: 'ricebales', kind: 'ambient', anchor: { x: 7670, y: 425 }, hitArea: { x: 7580, y: 370, w: 180, h: 110 }, priority: 2 },
  { id: 'a-river', targetId: 'river', kind: 'ambient', anchor: { x: 6250, y: 390 }, hitArea: { x: 6100, y: 330, w: 300, h: 120 }, priority: 1 },
  { id: 'a-cargo', targetId: 'cargo', kind: 'ambient', anchor: { x: 6660, y: 425 }, hitArea: { x: 6600, y: 390, w: 120, h: 70 }, priority: 2 },
  { id: 'a-jetty', targetId: 'jetty', kind: 'ambient', anchor: { x: 5250, y: 430 }, hitArea: { x: 5150, y: 390, w: 200, h: 80 }, priority: 2 },
  { id: 'a-willow2', targetId: 'willow2', kind: 'ambient', anchor: { x: 5620, y: 275 }, hitArea: { x: 5560, y: 150, w: 120, h: 250 }, priority: 1 },
  { id: 'a-pottery', targetId: 'pottery', kind: 'ambient', anchor: { x: 4605, y: 425 }, hitArea: { x: 4480, y: 350, w: 250, h: 150 }, priority: 2 },
  { id: 'a-cooper', targetId: 'cooper', kind: 'ambient', anchor: { x: 4230, y: 440 }, hitArea: { x: 4130, y: 380, w: 200, h: 120 }, priority: 2 },
  { id: 'a-dye-vats', targetId: 'dye-vats', kind: 'ambient', anchor: { x: 3285, y: 435 }, hitArea: { x: 3200, y: 390, w: 170, h: 90 }, priority: 2 },
  { id: 'a-dye-cloth', targetId: 'dye-cloth', kind: 'ambient', anchor: { x: 3225, y: 320 }, hitArea: { x: 3050, y: 240, w: 350, h: 160 }, priority: 1 },
  { id: 'a-garden', targetId: 'garden', kind: 'ambient', anchor: { x: 2775, y: 470 }, hitArea: { x: 2650, y: 420, w: 250, h: 100 }, priority: 2 },
  { id: 'a-flowers', targetId: 'flowers', kind: 'ambient', anchor: { x: 2400, y: 450 }, hitArea: { x: 2350, y: 390, w: 100, h: 120 }, priority: 2 },
  { id: 'a-willow-end', targetId: 'willow-end', kind: 'ambient', anchor: { x: 475, y: 260 }, hitArea: { x: 300, y: 40, w: 350, h: 440 }, priority: 1 },
  { id: 'a-bench', targetId: 'bench', kind: 'ambient', anchor: { x: 452, y: 510 }, hitArea: { x: 370, y: 488, w: 165, h: 45 }, priority: 2 },
  { id: 'a-plum2', targetId: 'plum2', kind: 'ambient', anchor: { x: 1910, y: 350 }, hitArea: { x: 1830, y: 280, w: 160, h: 140 }, priority: 2 },
  { id: 'a-pond', targetId: 'pond', kind: 'ambient', anchor: { x: 1125, y: 375 }, hitArea: { x: 1000, y: 300, w: 250, h: 150 }, priority: 1 },
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
  sections: Array.from({ length: 14 }, (_, i) => ({ id: `s${13 - i}`, x0: (13 - i) * 1000, x1: (14 - i) * 1000 })),
};

export const WORLD: WorldDef = {
  schemaVersion: SCHEMA_VERSION,
  worldId: WORLD_ID,
  contentVersion: '0.1.0',
  defaultLocale: 'ja',
  scenes: [SCENE],
};

/** Short captions for ambient reactions; read aloud too (sound is optional, spec §13). */
export const AMBIENT_LABEL: Record<string, string> = {
  'willow': '川端の柳',
  'boat': '川の荷舟',
  'giboshi': '橋の擬宝珠',
  'noren-aoba': '青葉屋の暖簾',
  'noren-kure': 'くれ竹の暖簾',
  'lantern': '石灯籠',
  'steam': '茶店の茶釜',
  'barrel': '茶店の手桶',
  'plum': '塀ごしの梅',
  'well': '小路の井戸',
  'cart': '荷車',
  'cloth-banner': '染め布の幟',
  'cloth-shop': '布屋の反物',
  'timber': '竹と材木',
  'banner': '店先の幟',
  'ricebales': '米屋の米俵',
  'river': '堀の水面',
  'cargo': '河岸の荷車',
  'jetty': '小さな舟',
  'willow2': '水辺の柳',
  'pottery': '瀬戸物の棚',
  'cooper': '桶屋の桶',
  'dye-vats': '藍甕',
  'dye-cloth': '干された藍染',
  'garden': '小さな菜園',
  'flowers': '垣根の花',
  'willow-end': '卷尾の柳',
  'bench': '川端の縁台',
  'plum2': '庭の梅',
  'pond': '庭の池',
};
export const AMBIENT: Record<string, string> = {
  'willow': '川風に、柳の枝がそよいだ。',
  'boat': '荷を積んだ舟が、岸につながれている。',
  'giboshi': '欄干の擬宝珠が、朝の光を返している。',
  'noren-aoba': '暖簾が、ふわりと揺れた。',
  'noren-kure': '藍の暖簾の向こうで、道具を拭く音がする。',
  'lantern': '石灯籠。夜には小さな灯がともるのだろう。',
  'steam': '茶店の釜から、白い湯気が立ちのぼる。',
  'barrel': '店先の桶に、空が映っている。',
  'plum': '塀ごしに、梅が咲いている。',
  'well': '井戸の釣瓶が、きしりと鳴った。',
  'cart': '荷車が一台、出番を待っている。',
  'cloth-banner': '染め上がった布が、風にゆっくり揺れる。',
  'cloth-shop': '反物が、色ごとに積み重ねてある。',
  'timber': '竹や材木が、背丈より高く立てかけてある。木の香りがする。',
  'banner': '店先の幟が、ぱたりと鳴った。',
  'ricebales': '米俵が山と積まれている。',
  'river': '堀の水面に、向こう岸の屋根が映っている。',
  'cargo': '河岸の荷車。荷を舟へ運ぶのだろう。',
  'jetty': '小さな舟が、杭につながれている。',
  'willow2': '河岸の柳が、水面に枝先を垂らしている。',
  'pottery': '瀬戸物の棚に、皿や壺が並んでいる。',
  'cooper': '桶屋の店先に、大きな桶が並んでいる。',
  'dye-vats': '藍甕のふちに、藍の泡が浮いている。',
  'dye-cloth': '藍に染めた布が、高い竿に干してある。',
  'garden': '小さな菜園に、青菜が並んでいる。',
  'flowers': '垣根の花に、朝の光がさしている。',
  'willow-end': '大きな柳の下、川風だけが通っていく。',
  'bench': '川端の縁台。ひと休みするには、ちょうどいい。',
  'plum2': '庭先の梅が、ほころびはじめている。',
  'pond': '池の水面に、雲がゆっくり映っていく。',
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
  {
    // 三頁目：あの人の手拭い (spec §9). A wrong guess only gives another clue.
    id: 'tenugui',
    prerequisites: [{ quest: 'kaze', is: 'complete' }],
    steps: [
      { id: 'serve', doneWhen: { flag: 'tenugui_clue' } },
      { id: 'pick', doneWhen: { flag: 'tenugui_found' } },
      { id: 'return', doneWhen: { quest: 'tenugui', is: 'complete' } },
    ],
    completionEffects: [
      { type: 'grant', rewardId: 'tenugui', amountMinor: 18 },
      { type: 'familiarity', characterId: 'oharu', eventId: 'tenugui' },
      { type: 'familiarity', characterId: 'kisuke', eventId: 'tenugui' },
      { type: 'questState', quest: 'tenugui', state: 'complete' },
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
  { id: 'p03-tenugui', triggerId: 'tenugui', compositionId: 'tenugui-return', captionId: 'tenugui', sourceRefs: [] },
  // left by 回想: another composition, or the other ending (engine/state.ts addRecallPage)
  { id: 'p01-kaze-b', triggerId: 'kaze', compositionId: 'kaze-{subject}-{framing}', captionId: 'kaze', sourceRefs: [] },
  { id: 'p02-dougu-b', triggerId: 'dougu', compositionId: 'dougu-{deliver|entrust}', captionId: 'dougu', sourceRefs: [] },
];

export const PAGE_TITLES: Record<string, string> = {
  'p01-kaze': '風のいたずら',
  'p02-dougu': 'いつもの道具',
  'p03-tenugui': 'あの人の手拭い',
  'p01-kaze-b': '風のいたずら（もう一枚）',
  'p02-dougu-b': 'いつもの道具（もう一つの朝）',
};

/** The story a page belongs to, for 回想. */
export function questOfPage(pageId: string): string | null {
  return PAGES.find((p) => p.id === pageId)?.triggerId ?? null;
}

/** 包みを整える (spec §10): three goods, each matched to the cloth with its mark. Fiction. */
export const WRAP_ITEMS = [
  { id: 'bento', label: '塗り直した弁当箱', mark: 'wave', markLabel: '波の印' },
  { id: 'hashi', label: '箸箱', mark: 'diamond', markLabel: '菱の印' },
  { id: 'toishi', label: '砥石', mark: 'circle', markLabel: '丸の印' },
] as const;
export type WrapMark = (typeof WRAP_ITEMS)[number]['mark'];

/**
 * 茶店の気配り (spec §10): three tea-and-sweet sets; each regular's liking is
 * shown in words and as marks. Nothing here is a real price or a remedy.
 * 麦湯 (barley water) and 羊羹 / 団子 / 煎餅 are period-plausible but unreviewed (fiction).
 */
export const TEA_SETS = [
  { id: 'hot-yokan', label: '熱い煎茶と羊羹', temp: 'hot', sweet: true },
  { id: 'warm-senbei', label: 'ぬるめの煎茶と煎餅', temp: 'warm', sweet: false },
  { id: 'cold-dango', label: '冷たい麦湯と団子', temp: 'cold', sweet: true },
] as const;
export type TeaSetId = (typeof TEA_SETS)[number]['id'];
export const TEA_GUESTS = [
  {
    id: 'daiku',
    label: '朝の仕事帰りの大工',
    says: '暑くてかなわねえ。冷てえのがいい。腹も減ったから、甘いもんをくれ。',
    likes: { temp: 'cold', sweet: true },
    wants: 'cold-dango' as TeaSetId,
  },
  {
    id: 'shisho',
    label: '三味線の女師匠',
    says: '猫舌なのよ、熱いのはだめ。それと、甘いものは控えているの。',
    likes: { temp: 'warm', sweet: false },
    wants: 'warm-senbei' as TeaSetId,
  },
] as const;

/** あの人の手拭い: two forgotten cloths; the ご隠居's is the wave pattern, tied tight. */
export const TENUGUI = [
  { id: 'nami', pattern: 'wave', label: '藍地に白い波の柄', knot: 'tight', knotLabel: '固い本結び', owner: true },
  { id: 'asanoha', pattern: 'hemp', label: '藍地に白い麻の葉の柄', knot: 'loose', knotLabel: 'ゆるい蝶結び', owner: false },
] as const;

export function kazeComposition(subject: Subject, framing: Framing): string {
  return `kaze-${subject}-${framing}`;
}
export function parseKaze(compositionId: string): { subject: Subject; framing: Framing } | null {
  const m = /^kaze-(hands|shopfront|street)-(near|wide)$/.exec(compositionId);
  return m ? { subject: m[1] as Subject, framing: m[2] as Framing } : null;
}
