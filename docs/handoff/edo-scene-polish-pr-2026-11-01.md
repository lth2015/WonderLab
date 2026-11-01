修复江户河渠截图中的断口、嘈杂背景声和循环路人。以main b3bad08为基线，实际补绘并替换street-0/1，加入可重建的仓库内rect补丁；去除持续人声噪声与自动合成叫声，降低并稀疏环境声，39个循环路人改为8种各一次。主角、剧情、存档和朝夕配色不变。

证据与量化在docs/painted-worlds/qingming-edo/scene-polish-v1/：同保存音量的持续床音RMS在三处下降约14–19dB，附原音量WAV与前后/手机截图。原始生成素材在codex/painted-worlds-art@0bc6f00，不整枝合入。

验证：江户63、中国40、根站488通过/4样本跳过；typecheck/full build通过；完整构建fixture确认新补丁自动保留；桌面/手机正常与近看、13处加载无JS错误；静音峰值0，139钟声每时段一次仍正常。真实want.world/手机外放耳机听感待Claude部署后复验，其他未修改原有接缝不冒称全部重绘。

Head：codex/edo-scene-polish@c8b2de5fb801595296f4b7b7c37967f2cbea502b。请求优先部署分支预览供所有者验收，合并照所有者确认约定；商业化138不随本PR部署。

