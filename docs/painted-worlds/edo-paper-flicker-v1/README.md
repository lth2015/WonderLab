# 江户初始纸铺：白纸闪入闪出修复

用户反馈：`/edo/?session=1` 初次打开，画卷不动也有白色物体反复闪现。基于 `main@6100b36` 在本地 Chromium 复现。线上浏览器访问受会话网络代理限制（ERR_TUNNEL_CONNECTION_FAILED / CONNECT 403），未声称独立看过线上。

原因是 `LooseSheets` 的同一个 SVG `<g>` 同时承载场景定位 `translate(9940 10)` 和 `.flap` 的 CSS transform 动画。动画只写 skew/scale 终态，浏览器便把定位平移也插值到零：纸片大部分时间飞出纸铺，回到动画起点时短暂出现。普通和试玩会模式都受影响。

修复将场景定位放在外层 `<g>`，飘动放在内层 `<g class="flap">`。保留原纸形、轻微飘动、压纸后消失及减少动态设置；没有改存档、剧情、声音或素材。

## 浏览器证据

旧版 390px 视口，暂停动画并取不同相位的第一张纸片边界（`evidence/before-matrices.json`）：

| 相位 | 屏幕 x | 状态 |
| --- | ---: | --- |
| 0 ms | 89.64 | 在清太身旁 |
| 450 ms | -5422.54 | 飞出视口 |
| 900 ms | -10934.73 | 飞出视口 |
| 1790 ms | 87.05 | 回来短暂出现 |

修复后，在标题和入场后分别检查 360 / 390 / 1280px 的普通与试玩会模式；每种状态按 75ms 步长采样两轮完整动画，共 49 个相位。所有普通视图纸片始终在画面内，横向位置变化为 0px、纵向轻飘约 4.7–5px。放大视图约 10px 轻飘，纸片保持原位置，边缘随放大自然裁切而没有飞离。截图 `after-rest.png` 与 `after-peak.png` 分别为起点和最大飘动。

- 原设置「動きを減らす」关闭动画；系统减少动态在页面载入时生效。
- 实际进入清太对话、选「文鎮で押さえる」后，纸片仍正确移除。
- 采样期间浏览器存储逐字不变；试玩会流程不写日常存档；无页面异常。
- `/edo/?session=1` 的生产构建另采样 49 个相位：横向变化 0px，纵向约 4.99px，无 4xx 或页面异常（`production-result.json`）。
- `npm run edo:test`：82 项通过。`npm run edo:build`、`npm run edo:site` 和 `git diff --check` 通过。

以上为无头 Chromium 的手机触屏模拟与桌面视口检查；实际线上及手机 Safari 复验由 Claude 统筹。

复跑：先用 `npm run edo:dev` 提供 5180，再运行：

```sh
python docs/painted-worlds/edo-paper-flicker-v1/browser-check.py
```

需 Python Playwright 和 `/usr/lib/chromium/chromium`；也可用 `--url` 指定本地预览地址，运行会更新 evidence。
