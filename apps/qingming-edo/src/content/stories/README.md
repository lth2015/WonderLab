# 物語ごとのファイル（江戸編 E2）

四頁目以降の故事は、ここに一つずつファイルがある（`kashi.ts` … `ame.ts`）。一つのファイルに、その故事が足すものが全部入っている：任務（`quest`）、台本（`nodes`）、人物と役（`characters`/`roles`）、点けられる所（`hotspots`）、頁と題（`pages`/`titles`）、頁の絵（`view`）、場所と宗吉のことば（`place`/`comment`）、回想（`recallStart`/`recallNote`）、人ごとの最初のことばの規則（`entries`、`rank` で他の故事の規則と並ぶ）、朝・夕の言い換え（`atTime`）、「少し話す」（`talk`）、「近くのこと」（`nearby`/`nearbyRank`）。形は `types.ts`。

## 新しい故事を足すには

1. `content/stories/<id>.ts` を作る（似た故事のファイルを写すのが早い）。
2. `index.ts` の `STORIES` に一行足す。
3. `content/world.ts` の `CHAPTERS` に、開く章を決めて足す。
4. `npm run edo:test`：`stories.test.ts` が足りないもの（章、頁の絵、規則の先の台本など）を知らせる。

ほかの故事にない描き方（跳ぶ猫、灯る提灯、ついてくる人）が要るときだけ、`scene/painted.tsx` か `scene/Street.tsx` にも手を入れる。

## 規則の rank

同じ人の規則は rank の小さい順に試される。いまの並び（喜助の例）：橋のたもとの声かけ 50 → 雨宿り 100 → 夕暮れの灯 200 → 茶店の猫 300 → 喜助自身の言葉（`content/script.ts` の `BASE_ENTRIES`、rank なし＝1000 以降）。宗吉は 朝の藍 100、橋のたもと 200、動く人を描く 300、一冊になった絵巻帳 400・410、その後の言葉 500・510。

最初の三つの故事（風のいたずら・いつもの道具・あの人の手拭い）と、人びとのふだんの言葉は `content/script.ts` にある。
