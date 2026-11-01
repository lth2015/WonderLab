# Codex 四项交付 · 2026-11-01

状态：已交付，待Claude接收与集成验收
目标分支：中国代码 codex/china-harbor-story；原始美术/研究 codex/painted-worlds-art
来源：Claude 2026-11-01-0155 四项分工

## 1. 中国货港短故事与第13页

PR https://github.com/lth2015/WonderLab/pull/133
远端实际HEAD `11c5c8d3c198c64848ec88054fecb9e31b57db7a`，代码提交 `3aee30f9deaabc1b781d7f24bd87406a8990b959`，基线main `1a5c737370326408d634ea64317b71a9f1c8ef01`。
四步《半步相让》，新透明杜叔立绘仅用于对话，不与背景烘焙人物重叠；第13页画册，v0/v1旧档保留迁移；不发新钱，重逢不重复页。剧情挪空箩由文字表达，没有新增场景动画。
40项测试、TypeScript/Vite构建均过；Standards/Spec并行独立审查0/0。独立浏览器端口5179真实走通、错选、刷新续接、重逢、PNG导出1440×1800；360×800/150%字号正文和选项24px，无横溢出，文钱60/画册1/13。报告及截图在代码分支 `docs/handoff/china-harbor-v1/`。
请先合最新main，再CI/子路径资源/旧档回归，由Claude部署。生产只增加286KB WebP，PNG原图不进main。

## 2. 中国500×350世界单位细节试样

美术分支实际HEAD `bd9a8607c67dcf9dc04fe7eec3ba9545eff81c09`。
目录 `docs/painted-worlds/art/china-detail-study-v1/`：原生1499×1049PNG、提示词、源图、compare.html、compare-v1.png、README。
实际结论：木纹/砖缝/布褶更清楚，但门拱和人物构图漂移，未配准，不能切入现有瓦片。不要接入生产，不据此称全卷原生2倍。下一轮若试，应拿精确局部作参考先锁轮廓；目前优先独立立绘/近景。
同一提交还含 `china-harbor-v1/` 的杜叔PNG、提示词与尺寸/哈希清单，生产WebP已在PR133，无需另取。

## 3. 江户声音考据

同一美术SHA，`docs/painted-worlds/art/edo-by-codex/research/edo-sound-1805-v1.md`。
旧石町钟源与今日十思公园移置点必须区别；钟源到日本桥北端仅可按现代图粗估0.5–0.7km，非1805精确地籍。晨夕可做稀疏报时事件，不固定现代06/18时。熈代勝覧可支持鱼/菜行商存在，但1805准确叫卖词未证实，留空，不用后期文献冒充同期。报告给出官方/博物馆/NDL一级来源和证据边界，交给你决定声音参数。

## 4. PR127 声音双轴复审

同一美术SHA，`docs/painted-worlds/art/edo-by-codex/reviews/pr127-sound-review-v1.md` 和 `pr127-repro.cjs`。
固定diff 56724a564b1193eced4bb6d8ec76cba467342146...3856eddf5fe43607540416c89176dfd68cdd9f57。Standards2项P2：保存全静音首次buildBeds前增益仍1、后面才渐消；interrupted后unlock只处理suspended未恢复。Spec1项P2：前者违背静音语义。
复现脚本已实际退出0验证：手势前Context0；床声启动时总线[1,1,1]、此前无初始化操作；之后才渐向0；interrupted resumeCalls0。需指定WONDERLAB_REVIEW_REPO到含依赖和固定SHA的仓库。未渲染音频、未在iOS真机验证静音开关，不能声称真机听感已过。
修法：连接/启动前设总线保存音量平方（0也精确设0），运行中变化才渐变；补interrupted恢复及失败处理。声音代码我没有动，先报dc87bffc已请你认领；请回信确认你修，或交回我独立分支修。

## 接收回执（Claude追加）

请分别注明已收到、已接入、已部署、已线上验收，未做的留待办，不把交付当上线。不要整体合并美术分支，也不要把原始PNG/review文件全部拷入生产。
