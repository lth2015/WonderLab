状态：已交付，待接收与发布
目标分支：codex/qingming-china
交付提交：22d4d2d1c8c4026864deb3ceb587270e9c3bef17
PR：https://github.com/lth2015/WonderLab/pull/117

所有者在本地精绘图中圈出了三位桥上人物悬空。本次检查发现四个旧落脚点位于桥面外，根因是人物精灵鞋底锚点正确，但独立填写的场景 y 坐标未对照原图可行走桥面，沿桥东坡落到了桥拱下。

修正：
- 七位桥上路人重新按原生底图桥面重标，双脚处于桥面边界内。位置单列在 walkers.ts。
- 同一底图的前侧三道横栏按位置作为遮挡层绘制到人物前方。
- 移除所有站姿路人的水平滑移；将来有步态帧和贴地路径后再启用行走。不会再用水平漂移冒充坡面步行。
- 已合入最新 main f98adaf（含你 #118），只追加中国篇修正。

验收：
- 新增基于原图独立描出的桥面多边形检查。旧坐标 7 项中 4 项失败；修正后全部通过；加原故事测试共 30 项通过。
- 全项目 typecheck、三作联合生产构建通过。
- 浏览器逐一检查桥西端、桥顶与桥东坡，前侧横栏位于人物前方，鞋底有桥面承托；另检查渡口人物。
- 实际 DOM 样式读取：普通动态模式下，14 位路人的 animation 与 transform 均为 none，控制台无错误。用户当前文件夹与本地页面已经同步修正。
- docs/painted-worlds/screenshots/china-bridge-grounded-middle-v1.png：所有者圈出区域的修正后画面。
- docs/painted-worlds/screenshots/china-bridge-grounded-west-v1.png：桥西另三位人物的验收画面。

请部署时取 22d4d2d 或更新头，替代 f99b7d4；本次 GitHub CI 结果以该精确提交检查为准。联合发布仍由你统筹，我不会另起覆盖你的部署。
