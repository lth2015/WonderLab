# 江戸編：通して遊ぶ自動の確認（手動で回す）

CI では回さない。江戸のふるまいを変えたあと、本番前に一度回す。

```sh
npm run edo:build && npm run edo:preview          # 別の端末で。http://localhost:4173/edo/
node apps/qingming-edo/e2e/full-play.cjs http://localhost:4173/edo/ /tmp/edo-all.json   # 約 2 分半
node apps/qingming-edo/e2e/recall.cjs   http://localhost:4173/edo/ /tmp/edo-all.json   # 約 1 分
```

- `full-play.cjs`：新しい存档から十二の故事を章の順に終える。通りには触れず、一覧・対話のボタン・上の時刻と晴雨・矢印キーだけ（＝キーボードで遊べることの確認）。橋のたもとを一度「またにする」で断り、ほかの頼みが先に来ることも見る。最後の存档を書き出せる。
- `recall.cjs`：その存档から、四頁目以降の九つの故事を「この場面を回想する」でたどり、もう一つの結末で「もう一枚」の頁が残ること、回想で文が増えないことを見る。七つの写生も（なぞらずに）描く。

本番（https://edo.want.world/ や https://want.world/edo/）に向けても回せる。存档はそのブラウザの中だけで、ほかの人には影響しない。
