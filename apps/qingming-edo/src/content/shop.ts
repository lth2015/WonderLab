import type { Condition } from '../contract';
import type { Line } from './types';
import { ITEMS, SLIPS_FOR_SALE } from './world';

// 買い物 (spec §11 仮設定: 茶と菓子 6文, 記念の題箋 12文). Money earned in the stories is
// spent on two small things: a rest at 喜助's tea house, and a commemorative title slip from
// 青葉屋. Neither is needed for any story (spec: 物語に必要な品は無償で渡す); neither pays
// back, and nothing can be bought with real money.

const price = (id: string) => ITEMS.find((i) => i.id === id)!.priceMinor;
export const TEA_PRICE = price('tea-sweet');
export const SLIP_PRICE = price('title-slip');

export { SLIPS_FOR_SALE };
export const slipFlag = (id: string) => `slip_${id}`;

/**
 * 一服: what the player sees from the tea-house bench. The first moment that holds and has
 * not been seen comes first (the people the player helped, going on with their day: R1 4.);
 * once all are seen, a quiet one for the time of day. Seen ones are not seen again.
 */
export interface Moment {
  id: string;
  when?: Condition;
  lines: Line[];
}
const done = (q: string): Condition => ({ quest: q, is: 'complete' });
export const MOMENTS: Moment[] = [
  { id: 'kaze', when: done('kaze'), lines: [{ by: 'narration', text: '向かいの青葉屋の店先。清太が、今日は並べた紙を文鎮でしっかり押さえている。風が吹いても、もう一枚も飛ばない。' }] },
  {
    id: 'kinji',
    when: done('dougu'),
    lines: [
      { by: 'narration', text: '売り声が遠くから近づいてきて、茶店の前で天秤棒が下りた。' },
      { by: 'kinji', text: '喜助さん、一杯！ ……おっ、あんたも一服かい。いい顔してるぜ。' },
    ],
  },
  {
    id: 'oharu',
    when: done('tenugui'),
    lines: [
      { by: 'narration', text: 'お使いの途中のお春が、足を止めて小声で教えてくれた。' },
      { by: 'oharu', text: 'ご隠居さま、今日もあの手拭いでした。……それだけ、お伝えしたくて。' },
    ],
  },
  { id: 'kame', when: done('kashi'), lines: [{ by: 'narration', text: '河岸のほうから亀吉が駆けてきて、喜助に団子を一本ねだり、また舟のほうへ駆けていった。' }] },
  { id: 'ihei', when: done('fumi'), lines: [{ by: 'narration', text: '伊兵衛が通りかかる。懐の文を確かめるように胸に手を当てて、飛脚屋のほうへ歩いていった。' }] },
  { id: 'neko', when: done('neko'), lines: [{ by: 'narration', text: 'こはくが縁台に飛びのって、膝のそばで丸くなった。茶が冷めるまで、動けなくなった。' }] },
  {
    id: 'inkyo',
    when: done('inkyo'),
    lines: [
      { by: 'narration', text: 'ご隠居が縁台の端に腰をおろし、杖を膝に立てかけた。' },
      { by: 'inkyo', text: '今日もな、川端まで行ってきたよ。……あんたと歩いた道だ。' },
    ],
  },
  { id: 'yube', when: { all: [done('yube'), { time: 'evening' }] }, lines: [{ by: 'narration', text: '日が傾くと、喜助が自分で提灯に火を入れはじめた。「今日は自分で点けるよ」と笑っている。' }] },
  { id: 'ame', when: { all: [done('ame'), { rain: true }] }, lines: [{ by: 'narration', text: '軒先で雨宿りの人たちが、喜助の貸した傘の話をしている。あの日の三本は、ちゃんと戻ってきたらしい。' }] },
  { id: 'ai', when: { all: [done('ai'), { time: 'morning' }] }, lines: [{ by: 'narration', text: '通りの先、紺屋の干し場で、染めたての藍が朝の風にゆっくり揺れている。' }] },
  { id: 'hashi', when: done('hashi'), lines: [{ by: 'narration', text: '通りの向こうで宗吉が足を止めた。こちらに気づいて、小さくうなずき、また歩いていった。' }] },
];
/** When every moment has been seen: the time of day, quietly. */
export const QUIET: Record<'morning' | 'noon' | 'evening' | 'rain', Line[]> = {
  morning: [{ by: 'narration', text: '朝の茶は熱い。荷を背負った人たちが、足早に通りを過ぎていく。' }],
  noon: [{ by: 'narration', text: '昼の日差しが縁台を温めている。団子の甘さが、歩きどおしの足にしみる。' }],
  evening: [{ by: 'narration', text: '夕方の風が、湯気を横へ流していく。通りの影が長い。' }],
  rain: [{ by: 'narration', text: '雨の音を聞きながら、熱い茶をすする。軒から落ちるしずくが、ひとつずつ光る。' }],
};
export const momentFlag = (id: string) => `ippuku_${id}`;
