# 河渠接缝补绘原始交付

所有者截图对应运行世界x1000，基线main b3bad08。本次image_gen重绘的原生PNG、完整提示词、参考/对齐图、最小差异切线与哈希在本目录。产品修复代码c8b2de5（codex/edo-scene-polish），已经实际接入street-0/1并保存可重建rect补丁；不是只有候选。

原始PNG仅留素材分支，不能整枝合main。production patch位于代码分支docs/painted-worlds/art/edo/seams-v2/canal-x1000-v4.webp与同名.rect.json。运行坐标已镜像，不能再镜像或当源段14/13整图替换。

integrate.cjs是本轮诊断重接脚本，可从仓库根执行node /path/integrate.cjs <repo> <scratch-dir> <generated-png>；scratch需要canal-before.png和从基线b3bad08提取的street-0-before.webp、street-1-before.webp。它会写目标repo的street-0/1，仅用于复现这个固定基线，不要在未来新画面上盲目执行。日常完整重建使用代码分支cx-build.cjs，自动接回checked-in rect即可。

audio-check.py/browser-check.py保存实际运行的云内验证脚本，路径使用本轮/workspace/.cloud-setup/edo-polish和本地开发端口；需当前云的Python Playwright/Chromium。实际指标和截图在代码分支scene-polish-v1文档。原始生成尺寸不代表全卷原生2倍。
