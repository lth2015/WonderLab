import type { QuestDef } from '../../contract';
import { CROWD, walkOf } from '../crowd';
import type { DialogueNode } from '../types';
import type { Nearby, StoryModule } from './types';

// 十一頁目：動く人を描く. After the morning indigo, 宗吉's second lesson: a frame on each
// passer-by's way; tap one while they are inside it (App: the live place of the tap decides).

/**
 * 動く人を描く (eleventh story; demo feedback 「交互太少、人不能动」): 宗吉 draws a frame on
 * the middle of each passer-by's stretch; the player taps the person in the moment they are
 * inside it. The page shows who was caught, where they were.
 */
export const UGOKI_PEOPLE: Record<string, { walker: string; who: string; word: string }> = {
  samurai: { walker: 'crowd2-samurai', who: '通りがかりの武士', word: '刀の重さで、肩が少し下がっている。歩く武士の癖まで描けた。' },
  elder: { walker: 'crowd2-elder', who: '杖をついたご隠居', word: '杖と足が、三つで一歩だ。ゆっくりした拍子が、線に出ている。' },
  monk: { walker: 'crowd1-monk', who: '托鉢の僧', word: '衣の裾が揺れている。歩みの静けさが、よく出た。' },
  fishmonger: { walker: 'crowd2-fishmonger', who: '魚売り', word: '荷の重さで、体が前に出ている。急ぐ足の勢いがある。' },
  apprentice: { walker: 'crowd2-apprentice', who: '使いの丁稚', word: '小走りの足が、地面から浮いている。いい一瞬を捕まえたな。' },
  parasol: { walker: 'crowd1-parasol', who: '日傘の娘', word: '傘の傾きで、風と日差しの向きまで分かる。' },
  porter: { walker: 'crowd1-porter', who: '荷を運ぶ人足', word: '担いだ荷の重さが、膝に出ている。働く体を、よく見た。' },
};

/** The frame on a passer-by's stretch: the middle third of where they walk (scene x). */
export function frameOf(walker: string): { lo: number; hi: number; y: number } | null {
  const i = CROWD.findIndex((c) => c.id === walker);
  if (i < 0) return null;
  const c = CROWD[i];
  const end = c.x + walkOf(c, i).dx;
  const a = Math.min(c.x, end);
  const b = Math.max(c.x, end);
  return { lo: Math.round(a + (b - a) * 0.35), hi: Math.round(a + (b - a) * 0.65), y: c.y };
}

/** `ugoki-parasol-10642`: who was caught, and at what scene x (inside their frame). */
export function parseUgoki(compositionId: string): { key: string; x: number; walker: (typeof CROWD)[number] } | null {
  const m = /^ugoki-([a-z]+)-(\d+)$/.exec(compositionId);
  if (!m || !Object.hasOwn(UGOKI_PEOPLE, m[1])) return null;
  const f = frameOf(UGOKI_PEOPLE[m[1]].walker);
  const x = Number(m[2]);
  if (!f || x < f.lo - 10 || x > f.hi + 10) return null;
  return { key: m[1], x, walker: CROWD.find((c) => c.id === UGOKI_PEOPLE[m[1]].walker)! };
}

const quest: QuestDef = {
  // 十一頁目：動く人を描く. 宗吉's second lesson: catch a walking person inside a frame. No money.
  id: 'ugoki',
  prerequisites: [{ quest: 'ai', is: 'complete' }],
  steps: [
    { id: 'look', doneWhen: { flag: 'ugoki_look' } },
    { id: 'catch', doneWhen: { flag: 'ugoki_caught' } },
  ],
  completionEffects: [
    { type: 'familiarity', characterId: 'sokichi', eventId: 'ugoki' },
    { type: 'questState', quest: 'ugoki', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const nodes: Record<string, DialogueNode> = {
  'sokichi.ugoki.ask': {
    effects: [{ type: 'questState', quest: 'ugoki', state: 'discovered' }],
    lines: [
      { by: 'sokichi', text: '止まっているものは、描けるようになったな。今度は、歩いている人を描け。' },
      { by: 'sokichi', text: '通りの人の行き来に、枠を描いておく。誰でもいい。その人が枠に入った一瞬を、写し取れ。' },
    ],
    choices: [
      { label: 'やってみる', next: 'sokichi.ugoki.go' },
      { label: 'またにする', next: 'sokichi.ugoki.later' },
    ],
  },
  'sokichi.ugoki.later': {
    effects: [{ type: 'setFlag', flag: 'ugoki_declined' }],
    lines: [{ by: 'sokichi', text: 'そうか。人は毎日歩いている。いつでもいい。' }],
  },
  'sokichi.ugoki.go': {
    effects: [{ type: 'setFlag', flag: 'ugoki_look' }, { type: 'questState', quest: 'ugoki', state: 'active' }],
    recallNext: 'ugoki.caught',
    lines: [{ by: 'narration', text: '通りに、薄い枠が見える。歩く人がその中に入ったところで、その人を点けよう。' }],
  },
  'sokichi.ugoki.waiting': {
    lines: [{ by: 'sokichi', text: '追いかけるな。枠のところで待っていれば、人のほうから入ってくる。' }],
  },
  'ugoki.caught': {
    effects: [{ type: 'setFlag', flag: 'ugoki_caught' }, ...quest.completionEffects],
    page: { pageId: 'p11-ugoki', compositionId: 'ugoki-{catch}' },
    lines: [
      { by: 'narration', text: '枠の中を通り過ぎる一瞬を、急いで、しかし丁寧に写し取った。' },
      { by: 'sokichi', text: '止まった絵の中で、人が歩いている。それが描ければ、町が描ける。……絵巻帳に、十一頁目が残ったな。' },
    ],
  },
  'sokichi.ugoki.after': {
    lines: [{ by: 'sokichi', text: '動くものは、目より先に手が覚える。毎日少しずつ描け。' }],
  },
};

export const ugoki: StoryModule = {
  quest,
  nodes,
  pages: [
    { id: 'p11-ugoki', triggerId: 'ugoki', compositionId: 'ugoki-{who}-{x}', captionId: 'ugoki', sourceRefs: [] },
    { id: 'p11-ugoki-b', triggerId: 'ugoki', compositionId: 'ugoki-{who}-{x}', captionId: 'ugoki', sourceRefs: [] },
  ],
  titles: {
    'p11-ugoki': '動く人を描く',
    'p11-ugoki-b': '動く人を描く（もう一枚）',
  },
  recallStart: 'sokichi.ugoki.ask',
  place: {

  },
  comment: {

  },
  recallNote: '別の人を、別の一瞬で描けば、もう一枚の頁が残ります。',
  entries: {
    // after the morning indigo; his word after the lesson comes after the full book
    sokichi: [
      { rank: 300, when: { all: [{ flag: 'ugoki_look' }, { not: { quest: 'ugoki', is: 'complete' } }] }, node: 'sokichi.ugoki.waiting' },
      { rank: 301, when: { all: [{ quest: 'ai', is: 'complete' }, { not: { flag: 'ugoki_declined' } }, { not: { quest: 'ugoki', is: 'complete' } }, { not: { time: 'morning' } }] }, node: 'sokichi.ugoki.ask' },
      // put off once: asked again after the others
      { rank: 351, when: { all: [{ quest: 'ai', is: 'complete' }, { not: { quest: 'ugoki', is: 'complete' } }, { not: { time: 'morning' } }] }, node: 'sokichi.ugoki.ask' },
      { rank: 510, when: { quest: 'ugoki', is: 'complete' }, node: 'sokichi.ugoki.after' },
    ],
  },
  talk: ['sokichi.ugoki.after'],
  // the place line and 宗吉's word come from UGOKI_PEOPLE (ui/Journal.tsx)
  valid: (pageId, compositionId) => (pageId === 'p11-ugoki' || pageId === 'p11-ugoki-b' ? parseUgoki(compositionId) !== null : null),
  view: (composition) => {
    const u = parseUgoki(composition);
    return u ? { x0: u.x - 150, y0: u.walker.y - 300, w: 300, people: [{ id: u.walker.id, x: u.x, y: u.walker.y, flip: u.walker.flip }] } : null;
  },
  nearbyRank: 60,
  // after the morning indigo; then the frames on the street
  nearby: (c) => {
    const out: Nearby[] = [];
    if (c.questState('ai') === 'complete' && c.questState('ugoki') !== 'complete') {
      if (c.hasFlag('ugoki_look') && c.rain) out.push({ id: 'ugoki-catch', text: '雨で人が軒下にいる。晴れたら、枠の中を歩く人を描く（上の「雨」を「晴」に）', spotId: 'h-sokichi', later: true });
      else if (c.hasFlag('ugoki_look')) out.push({ id: 'ugoki-catch', text: '枠の中を歩く人を描く。枠に入った一瞬に、その人を点ける', spotId: 'a-pass-parasol' });
      else if (c.time === 'morning') out.push({ id: 'ugoki', text: '宗吉が、通りを歩く人を目で追っている（上の時刻で「昼」か「夕」に）', spotId: 'h-sokichi', later: true });
      else out.push({ id: 'ugoki', text: '宗吉が、通りを歩く人を目で追っている', spotId: 'h-sokichi' });
    }
    return out;
  },
};
