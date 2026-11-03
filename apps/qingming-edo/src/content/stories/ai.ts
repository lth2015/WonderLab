import type { Condition, QuestDef } from '../../contract';
import type { DialogueNode } from '../types';
import type { Nearby, StoryModule } from './types';

// 七頁目：朝の藍. Morning only: 宗吉 sends the player to find three indigo things.

const aiToFind = (n: number): Condition => ({ all: [{ flag: 'ai_look' }, { time: 'morning' }, { not: { flag: `ai_seen${n}` } }] });

const quest: QuestDef = {
  // 七頁目：朝の藍. In the morning only: 宗吉's lesson — find three indigo things, then paint one. No money: a lesson.
  id: 'ai',
  prerequisites: [{ quest: 'kaze', is: 'complete' }],
  steps: [
    { id: 'look', doneWhen: { flag: 'ai_look' } },
    { id: 'find', doneWhen: { all: [{ flag: 'ai_seen1' }, { flag: 'ai_seen2' }, { flag: 'ai_seen3' }] } },
    { id: 'paint', doneWhen: { any: [{ flag: 'ai_vat' }, { flag: 'ai_cloth' }] } },
  ],
  completionEffects: [
    { type: 'familiarity', characterId: 'sokichi', eventId: 'ai' },
    { type: 'questState', quest: 'ai', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const SEEN = (n: number, what: string): DialogueNode => ({
  effects: [{ type: 'setFlag', flag: `ai_seen${n}` }],
  lines: [{ by: 'narration', text: what }],
});
const nodes: Record<string, DialogueNode> = {
  'sokichi.ai.ask': {
    effects: [{ type: 'questState', quest: 'ai', state: 'discovered' }],
    lines: [
      { by: 'sokichi', text: '朝の光でしか見えない色がある。藍だ。昼になると、どれも同じ紺に沈んでしまう。' },
      { by: 'sokichi', text: '町の藍を三つ、見つけてこい。暖簾か、甕か、布か。見つけたら、どれを描くか決めろ。' },
    ],
    choices: [
      { label: '藍を探しに行く', next: 'sokichi.ai.look' },
      { label: 'またにする', next: 'sokichi.ai.later' },
    ],
  },
  'sokichi.ai.later': {
    effects: [{ type: 'setFlag', flag: 'ai_declined' }],
    lines: [{ by: 'sokichi', text: 'そうか。朝はまた来る。急ぐことはない。' }],
  },
  'sokichi.ai.look': {
    effects: [{ type: 'setFlag', flag: 'ai_look' }, { type: 'questState', quest: 'ai', state: 'active' }],
    recallNext: 'sokichi.ai.found',
    lines: [{ by: 'narration', text: '朝の通りを見渡す。藍の色は、どこにあるだろう。' }],
  },
  'sokichi.ai.waiting': {
    lines: [{ by: 'sokichi', text: '藍は、近くで見るより、少し離れて見たほうがよくわかる。' }],
  },
  'ai.seen1': SEEN(1, 'くれ竹の暖簾は、朝の光の中で、深い藍が少し紫がかって見える。一つ目の藍だ。'),
  'ai.seen2': SEEN(2, '藍甕のふちに、青い泡が浮いている。甕の底は、ほとんど黒に近い藍だ。'),
  'ai.seen3': SEEN(3, '干し場の布は、何度も浸けた濃い藍から、空のような薄い藍まで並んでいる。'),
  'sokichi.ai.found': {
    lines: [
      { by: 'sokichi', text: '三つとも見てきたか。同じ藍でも、ずいぶん違っただろう。' },
      { by: 'sokichi', text: 'では、どれを描く。深いほうか、明るいほうか。' },
    ],
    choices: [
      { label: '藍甕の深い藍を描く', next: 'ai.vat' },
      { label: '干し場の明るい藍を描く', next: 'ai.cloth' },
    ],
  },
  'ai.vat': {
    effects: [{ type: 'setFlag', flag: 'ai_vat' }, ...quest.completionEffects],
    page: { pageId: 'p07-ai', compositionId: 'ai-vat' },
    lines: [
      { by: 'narration', text: '甕のふちと、泡と、底の暗さを、何度も筆を重ねて描いた。' },
      { by: 'sokichi', text: '深い色は、急いでは出ない。……絵巻帳に、七頁目が残ったな。' },
    ],
  },
  'ai.cloth': {
    effects: [{ type: 'setFlag', flag: 'ai_cloth' }, ...quest.completionEffects],
    page: { pageId: 'p07-ai', compositionId: 'ai-cloth' },
    lines: [
      { by: 'narration', text: '風に揺れる布を、濃いものから薄いものへ、順に描いた。' },
      { by: 'sokichi', text: '明るい藍は、乾いた時間の色だ。……絵巻帳に、七頁目が残ったな。' },
    ],
  },
};

export const ai: StoryModule = {
  quest,
  nodes,
  hotspots: [
    // three indigo things along the roll (over the ambient spots, while looking)
    { id: 'h-ai1', targetId: 'ai1', kind: 'prop', anchor: { x: 12140, y: 387 }, hitArea: { x: 12000, y: 360, w: 280, h: 55 }, priority: 8, visibleWhen: aiToFind(1) },
    { id: 'h-ai2', targetId: 'ai2', kind: 'prop', anchor: { x: 3285, y: 435 }, hitArea: { x: 3200, y: 390, w: 170, h: 90 }, priority: 8, visibleWhen: aiToFind(2) },
    { id: 'h-ai3', targetId: 'ai3', kind: 'prop', anchor: { x: 3225, y: 320 }, hitArea: { x: 3050, y: 240, w: 350, h: 150 }, priority: 8, visibleWhen: aiToFind(3) },
  ],
  pages: [
    { id: 'p07-ai', triggerId: 'ai', compositionId: 'ai-{vat|cloth}', captionId: 'ai', sourceRefs: [] },
    { id: 'p07-ai-b', triggerId: 'ai', compositionId: 'ai-{vat|cloth}', captionId: 'ai', sourceRefs: [] },
  ],
  titles: {
    'p07-ai': '朝の藍',
    'p07-ai-b': '朝の藍（もう一つの藍）',
  },
  recallStart: 'sokichi.ai.ask',
  entries: {
    // 朝の藍 first: an old save may have filled the twelve-page book already
    sokichi: [
      { rank: 100, when: { all: [{ flag: 'ai_seen1' }, { flag: 'ai_seen2' }, { flag: 'ai_seen3' }, { not: { quest: 'ai', is: 'complete' } }] }, node: 'sokichi.ai.found' },
      { rank: 101, when: { all: [{ flag: 'ai_look' }, { not: { quest: 'ai', is: 'complete' } }] }, node: 'sokichi.ai.waiting' },
      { rank: 102, when: { all: [{ time: 'morning' }, { quest: 'kaze', is: 'complete' }, { not: { quest: 'ai', is: 'complete' } }] }, node: 'sokichi.ai.ask' },
    ],
    ai1: [{ rank: 100, node: 'ai.seen1' }],
    ai2: [{ rank: 100, node: 'ai.seen2' }],
    ai3: [{ rank: 100, node: 'ai.seen3' }],
  },
  place: {
    'ai-vat': '日本橋・朝　紺屋の藍甕',
    'ai-cloth': '日本橋・朝　紺屋の干し場',
  },
  comment: {
    'ai-vat': '甕の底の藍は、何度も浸けた時間の色だ。よく見たな。',
    'ai-cloth': '濃い布から薄い布へ、藍の移り変わりを捕まえた。朝の光だからこそだ。',
  },
  recallNote: 'もう一つの藍を描けば、別の頁が残ります。',
  valid: (pageId, compositionId) => (pageId === 'p07-ai' || pageId === 'p07-ai-b' ? compositionId === 'ai-vat' || compositionId === 'ai-cloth' : null),
  // always a morning page
  view: (composition) =>
    composition === 'ai-vat'
      ? { x0: 3130, y0: 205, w: 300, people: [], tod: 'morning' }
      : composition === 'ai-cloth'
        ? { x0: 2990, y0: 60, w: 420, people: [], tod: 'morning' }
        : null,
  nearbyRank: 10,
  // in the morning; then the indigo things not yet found
  nearby: (c) => {
    const out: Nearby[] = [];
    const ai = c.questState('ai');
    const morning = c.time === 'morning';
    if (ai !== 'complete' && c.questState('kaze') === 'complete') {
      const left = [1, 2, 3].filter((n) => !c.hasFlag(`ai_seen${n}`));
      if (c.hasFlag('ai_look') && left.length === 0) out.push({ id: 'ai-done', text: '見つけた藍のことを、宗吉に話す', spotId: 'h-sokichi' });
      else if (c.hasFlag('ai_look')) out.push({ id: 'ai-find', text: morning ? `町の藍を探す（あと${left.length}つ）。暖簾、甕、干した布` : '朝になったら、町の藍を探す', spotId: morning ? `h-ai${left[0]}` : 'h-sokichi', later: !morning });
      else if (morning) out.push({ id: 'ai', text: '宗吉が、朝の光の話をしたそうにしている', spotId: 'h-sokichi' });
      else out.push({ id: 'ai', text: '朝の宗吉が、何か教えたそうにしていた（上の時刻で「朝」に）', spotId: 'h-sokichi', later: true });
    }
    return out;
  },
};
