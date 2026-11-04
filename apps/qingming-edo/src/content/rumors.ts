import type { Line } from './types';

// 町のうわさ (Codex R1 #4: 「熟人再见时的细小差异」, not more pages). What the player did in
// one place reaches people elsewhere: once their own story with the player is done, they
// mention it the next time they are spoken to — once, lightly, without summing anything up.
// They come after every request and before the person's everyday word (RUMOR_RANK), so they
// never stand in the way of a story.

export interface Rumor {
  id: string;
  /** Who says it. */
  who: string;
  /** Their own story, done first (so a request of theirs is never pushed aside). */
  needs: string;
  /** What the player did elsewhere that they have heard about. */
  after: string;
  lines: Line[];
}

/**
 * Where a person's rumors go among their opening rules (content/script.ts ENTRIES): after
 * their requests, before their everyday word. 宗吉: after his lessons (≤351), before the full
 * book (400). People of the stories in their own files: after the gathering's invitation (50),
 * before their story's own rules (100). The first stories' people: before their words (1000+).
 */
export const RUMOR_RANK: Record<string, number> = { sokichi: 380, omatsu: 60, kamekichi: 60, ihei: 60, okon: 900, kisuke: 900, oharu: 900, kinji: 900, seita: 900 };

export const RUMORS: Rumor[] = [
  { id: 'okon-neko', who: 'okon', needs: 'dougu', after: 'neko', lines: [{ by: 'okon', text: 'こはくが帰ってきたんだってね。喜助さん、朝からずっと猫に話しかけてるよ。' }] },
  { id: 'okon-ame', who: 'okon', needs: 'dougu', after: 'ame', lines: [{ by: 'okon', text: 'この前の雨の日、傘を配って回ったんだって？ 呉服屋の旦那が、えらく感心してたよ。' }] },
  { id: 'kisuke-kashi', who: 'kisuke', needs: 'tenugui', after: 'kashi', lines: [{ by: 'kisuke', text: 'おまつさんとこの亀吉が、さっき橋の上から舟を数えてたよ。あんたが見つけてくれたって、得意そうに話してた。' }] },
  { id: 'kisuke-inkyo', who: 'kisuke', needs: 'tenugui', after: 'inkyo', lines: [{ by: 'kisuke', text: 'ご隠居さん、川端まで歩いたそうだね。今朝は杖の音が、いつもより軽かったよ。' }] },
  { id: 'oharu-fumi', who: 'oharu', needs: 'tenugui', after: 'fumi', lines: [{ by: 'oharu', text: '飛脚屋さんの前で、伊兵衛さんにお会いしました。お母さまへの文を出したところだって、少し笑ってらっしゃいました。' }] },
  { id: 'oharu-yube', who: 'oharu', needs: 'tenugui', after: 'yube', lines: [{ by: 'oharu', text: '夕方の提灯、あなたが点けて回ったって聞きました。お使いの帰り道が明るくて、助かりました。' }] },
  { id: 'kinji-ame', who: 'kinji', needs: 'dougu', after: 'ame', lines: [{ by: 'kinji', text: '雨宿りしてた魚売り、あいつはおいらの仲間でさ。借りた傘、ちゃんと茶店に返しに行くってよ。' }] },
  { id: 'kinji-ugoki', who: 'kinji', needs: 'dougu', after: 'ugoki', lines: [{ by: 'kinji', text: 'あんた、歩いてる人を描いてるんだって？ 宗吉さんに聞いたよ。……おいらも、描かれたかったなあ。' }] },
  { id: 'seita-ai', who: 'seita', needs: 'kaze', after: 'ai', lines: [{ by: 'seita', text: '紺屋の藍を描かれたんですか。うちの紙にも、藍で刷った柄のものがあるんですよ。今度、見てください。' }] },
  { id: 'seita-hashi', who: 'seita', needs: 'kaze', after: 'hashi', lines: [{ by: 'seita', text: '橋のたもとの絵、ちらっと見せてもらいました。……わたし、ちゃんと紙を押さえてる顔をしてましたね。' }] },
  { id: 'omatsu-neko', who: 'omatsu', needs: 'kashi', after: 'neko', lines: [{ by: 'omatsu', text: '茶店の猫が、堀で舟を見てたんだって？ 舟の好きな猫は、魚の好きな猫さ。うちにも寄ればいいのにね。' }] },
  { id: 'omatsu-fumi', who: 'omatsu', needs: 'kashi', after: 'fumi', lines: [{ by: 'omatsu', text: '両替屋の若い手代さん、郷のおっかさんに文を出したんだってね。いい息子じゃないか。' }] },
  { id: 'kame-neko', who: 'kamekichi', needs: 'kashi', after: 'neko', lines: [{ by: 'kamekichi', text: 'ねえ、茶店の猫、舟が好きなんだって！ おいらと同じだ！' }] },
  { id: 'ihei-kashi', who: 'ihei', needs: 'fumi', after: 'kashi', lines: [{ by: 'ihei', text: '河岸のおまつさんのお孫さんを、橋で見かけました。元気な子ですね。舟に手を振っていました。' }] },
  { id: 'ihei-ame', who: 'ihei', needs: 'fumi', after: 'ame', lines: [{ by: 'ihei', text: 'あの雨の日、わたしは運よく店の中でした。……傘を配っていたのは、あなたでしたか。' }] },
  { id: 'sokichi-neko', who: 'sokichi', needs: 'kaze', after: 'neko', lines: [{ by: 'sokichi', text: '茶店の猫を描いたそうだな。猫は、待つ者のところへ来る。描くのも同じだ。' }] },
  { id: 'sokichi-inkyo', who: 'sokichi', needs: 'kaze', after: 'inkyo', lines: [{ by: 'sokichi', text: 'ご隠居と川端まで歩いたか。急がない足に合わせるのは、案外むずかしい。' }] },
];
