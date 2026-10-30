# 四时册页 · 插画与文字

Claude 交接 docs/handoff/codex-entrance.md；Codex 2026-10-30 接收制作。

每张为 480×640、3:4 的 webp。原始 PNG 保留在 source/，生成后仅作机械尺寸归一与格式转换；完整大图仍有源文件，未把压缩图当作生成原件。delivery-check.json 记录尺寸与校验值。

十四页已齐：willow、blossom、rainbow、lotus、storm、magpie、cicada、fireflies、galaxy、autumn、moonlit、lanterns、shower、moonsnow。每页对应一个同名 webp，完整原件在 source/。

鸣蝉页已把第一轮偏暖的晚霞改成深蓝夜色，避免“半夜”配成黄昏。惊鹊使用同一只黑白长尾鹊的体态参考；小画强调相遇，实际引擎飞行尺度仍以此前运行验收为准。

共同画风：清淡真实的近景细节、宋画留白的湖山、极轻纸感。中央有水与空气，各页通过近岸风物和光阴改变性情。插画不放文字、边框、人物或预制游鱼；晴日与月色尽量让光从画外来，留下给来者亲手画日月的位置。

pages.json 是十四页的名字、诗行、时辰与建议排序。lines-check.json 是对 main29a6ad1 的真实 interpret 检查：十四页天气相符、时辰无冲突，固定十句未用于改稿。

这些是册页索引插画，不是产品引擎截图。场景里的惊鹊、蝉鸣、声音、光影仍以 Claude 实现和实际运行验收为准。

index.html 是整套排版预览，点击小画可看成品；contact-sheet.png 是它的整套检查图，mobile-gallery-check.png 为窄屏排版检查。browser-check.json 记录十四张成品均解码为480×640、无页面错误、390px视口无横向溢出。它检查本目录的画廊，不冒称已检查 Claude 的实际 Book 接入。

十四张 webp 合计约1.14MB，原始 PNG 不用于产品页面下载。实际册页建议只接入 webp，具体加载与显示方式由 Claude 统筹。
