# 江戸編：通して遊ぶ自動の確認（手動で回す）

CI では回さない。江戸のふるまいを変えたあと、本番前に一度回す。

```sh
npm run edo:build && npm run edo:preview          # 別の端末で。http://localhost:4173/edo/
node apps/qingming-edo/e2e/full-play.cjs http://localhost:4173/edo/ /tmp/edo-all.json   # 約 2 分半
node apps/qingming-edo/e2e/recall.cjs   http://localhost:4173/edo/ /tmp/edo-all.json   # 約 1 分
node apps/qingming-edo/e2e/talk.cjs     http://localhost:4173/edo/ /tmp/edo-all.json   # 約 1 分
node apps/qingming-edo/e2e/lost.cjs     http://localhost:4173/edo/ /tmp/edo-all.json   # 約 1 分（三つ目に絵図の画面写しの置き場を渡せる）
```

- `full-play.cjs`：新しい存档から十二の故事を章の順に終える。通りには触れず、一覧・対話のボタン・上の時刻と晴雨・矢印キーだけ（＝キーボードで遊べることの確認）。橋のたもとを一度「またにする」で断り、ほかの頼みが先に来ることも見る。最後の存档を書き出せる。
- `recall.cjs`：その存档から、四頁目以降の九つの故事を「この場面を回想する」でたどり、もう一つの結末で「もう一枚」の頁が残ること、回想で文が増えないことを見る。七つの写生も（なぞらずに）描く。
- `talk.cjs`：その存档から、話せる八人それぞれと「少し話す」で町の人のことを四人ぶん聞き、立ち絵が出ること、締めのひとことで終わることを見る。
- `lost.cjs`：その存档から、六つの探し物をたどる。持ち主に話しかけて落とし物の話を聞き、町の絵図に「？」が六つ出ること、一覧から拾えること、拾うと「？」が消えること、持ち主に返せること、六つとも返すと宗吉にひと言あることを見る。

本番（https://edo.want.world/ や https://want.world/edo/）に向けても回せる。存档はそのブラウザの中だけで、ほかの人には影響しない。
