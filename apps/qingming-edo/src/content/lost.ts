import type { Condition } from '../contract';
import type { Line } from './types';

// 探し物 (owner's demo feedback 2026-11-04: 「寻宝」): six small things lost along the roll.
// Their owner mentions the loss once, the next time they are spoken to after their own story;
// the town map then marks the area with a ？. Found (with or without the hint), the thing is
// carried in 持ち物 until it is given back. Nothing is paid: the thanks is the reward.
// Each thing has a faint glint now and then, so a sharp eye can find it before any word.

export interface LostThing {
  id: string;
  /** Sprite (assets/art) and where it lies (scene units, the thing's bottom centre). */
  sprite: string;
  at: { x: number; y: number };
  /** Its name in 持ち物 and in the lists. */
  name: string;
  /** Where it lies, as the lists say once the hint is heard. */
  place: string;
  /** Who it belongs to (the person spoken to), and their story, done first. */
  owner: string;
  needs: string;
  /** A flag set once the owner's own thanks has been read, so the loss never cuts in front of it. */
  seen?: string;
  hint: Line[];
  find: string;
  back: Line[];
}

export const LOST: LostThing[] = [
  {
    id: 'netsuke', sprite: 'lost-netsuke', at: { x: 5610, y: 498 }, name: '亀の根付', place: '堀の河岸の草むら', owner: 'kinji', needs: 'dougu', seen: 'kinji_seen_done',
    hint: [{ by: 'kinji', text: 'そういや、亀の根付をなくしちまってさ。堀の河岸でひと休みしたときかなあ。' }],
    find: '堀の河岸の草の陰に、小さな亀の根付が落ちていた。金次さんのものかもしれない。',
    back: [{ by: 'kinji', text: 'おっ、おいらの亀！ 親父がくれたもんでさ。……ありがとよ。' }],
  },
  {
    id: 'kanzashi', sprite: 'lost-kanzashi', at: { x: 10440, y: 503 }, name: '赤い花の簪', place: '小路の井戸の石の間', owner: 'oharu', needs: 'tenugui', seen: 'oharu_seen_done',
    hint: [{ by: 'oharu', text: 'お使いの帰りに、簪をなくしてしまって……。小路の井戸でお水をいただいたときかしら。' }],
    find: '井戸の石の間に、赤い花の簪が光っていた。',
    back: [{ by: 'oharu', text: 'わたしの簪！ おっかさんにもらったものなんです。……本当に、ありがとうございます。' }],
  },
  {
    id: 'sensu', sprite: 'lost-sensu', at: { x: 13060, y: 480 }, name: '閉じた扇子', place: '橋のたもとの柳の根もと', owner: 'seita', needs: 'kaze', seen: 'seita_seen_done',
    hint: [{ by: 'seita', text: '番頭さんの扇子を、どこかに置き忘れてしまいました……。橋のたもとの柳の下で、ひと息ついたときかもしれません。' }],
    find: '柳の根もとに、扇子が落ちていた。',
    back: [{ by: 'seita', text: 'それです！ これで番頭さんに叱られずにすみます。……助かりました。' }],
  },
  {
    id: 'koma', sprite: 'lost-koma', at: { x: 14262, y: 505 }, name: '赤と藍の独楽', place: '向こう岸の石段', owner: 'kamekichi', needs: 'kashi', seen: 'kame_seen_done',
    hint: [{ by: 'kamekichi', text: 'おいらの独楽、どっかいっちまった。向こう岸の石段で回してたんだけど……。' }],
    find: '石段の下に、赤と藍の独楽が転がっていた。',
    back: [{ by: 'kamekichi', text: 'おいらの独楽だ！ 見てて、いま回すから！' }],
  },
  {
    id: 'kiseru', sprite: 'lost-kiseru', at: { x: 455, y: 547 }, name: '真鍮の煙管', place: '町はずれの縁台の下', owner: 'kisuke', needs: 'inkyo', seen: 'kisuke_seen_done',
    hint: [{ by: 'kisuke', text: 'ご隠居さん、川端まで歩いた日に煙管をなくしたらしい。縁台のあたりかねえ。' }],
    find: '縁台の下に、真鍮の吸い口の煙管が落ちていた。ご隠居さんのものだろう。',
    back: [{ by: 'kisuke', text: 'ご隠居さんの煙管だ。あとで届けておくよ。……あの人、きっと喜ぶ。' }],
  },
  {
    id: 'suzu', sprite: 'lost-suzu', at: { x: 3470, y: 492 }, name: '赤い紐の鈴', place: '紺屋の干し場の前', owner: 'kisuke', needs: 'neko', seen: 'kisuke_seen_done',
    hint: [{ by: 'kisuke', text: 'こはくの首の鈴がなくなっててね。紺屋のほうをうろついてたって話だから、そのあたりかな。' }],
    find: '藍甕のそばに、赤い紐のついた小さな鈴が落ちていた。',
    back: [
      { by: 'kisuke', text: 'こはくの鈴だ。……ほら、こはく。' },
      { by: 'narration', text: '茶店の前で、ちりん、と小さく鳴った。' },
    ],
  },
];

/** The things can be found once the town is open to the player (after the first page). */
export const LOST_OPEN: Condition = { quest: 'kaze', is: 'complete' };

/** 宗吉, once every thing is back with its owner. */
export const LOST_ALL_BACK: Line[] = [{ by: 'sokichi', text: '落とし物を拾って回っているそうだな。下を見て歩く者は、町の細かいところまで描ける。' }];
