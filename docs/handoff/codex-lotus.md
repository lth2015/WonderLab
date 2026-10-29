# 交接：荷塘贴图（给 Codex）

> **已完成（2026-10-29），不需要再出图。** TokenStars 的图像模型在另一个云端会话里调通了，六张图已生成并拼成 `public/art/lotus.webp`。谢谢！Codex 如果已经出了图，不用推送；以后有新的美术需求，会在 `docs/handoff/` 下另开文件。

**这是 Claude（云端会话）和 Codex 之间的交接文件。** 我们通过这个分支联系：Codex 把图推上来、在本文末尾写回复；Claude 拉取、处理、接进产品。

## 背景

所有者希望荷塘里的荷花、荷叶更真实，同意用图像生成。Claude 的云端环境里 TokenStars 的图像模型调不通（模型名或权限问题），所以请 Codex 代为出图。

## 请做的事

1. 检出分支 `main-emzgyk-lotus-art`（不要动其他分支，不要 force-push，不要开 PR）。
2. 按下面 6 段提示词各出 1 张图：**1024×1024，PNG，透明背景**（模型不支持透明时，用纯白或纯色背景也行，处理脚本会抠掉与边缘相连的纯色背景）。照片写实风格，和 `public/art/koi-*.webp` 的锦鲤一致。
3. 文件按名字放进 `art-incoming/`（这个目录只用来交接，Claude 处理完会删掉）：
   `art-incoming/lotus-leaf-a.png`、`lotus-leaf-b.png`、`lotus-leaf-up.png`、`lotus-flower-a.png`、`lotus-flower-b.png`、`lotus-bud.png`
4. 自查：平铺荷叶必须是**正上方俯视的圆**；立叶、荷花、花苞必须是**侧视、茎一直伸到图片底边**、居中。不对的重出一次。
5. 提交并推送到 `main-emzgyk-lotus-art`。提交信息不要写任何模型名；不要提交任何 key 或 `.env`。
6. 在本文末尾「Codex 回复」下写几句：出了几张、用的什么工具、有没有哪张不满意。

Claude 拉到图后会运行 `npm run art -- --process-only`，把 6 张图拼成 `public/art/lotus.webp`，在引擎里验收、部署到 want.world、再合并。

## 提示词

## lotus-leaf-a (1024x1024) → 存为 art-incoming/lotus-leaf-a.png
Photorealistic photograph of a real sacred lotus (Nelumbo nucifera) in a summer pond, natural soft daylight, true colour and fine detail, not an illustration, no outlines. Isolated on a fully transparent background: no water, no reflection, no shadow, no other plants, no text, no border. A single round lotus leaf lying flat, seen from DIRECTLY ABOVE: a nearly perfect circle filling the image, blue-green and waxy with a soft bloom, fine veins radiating from a pale centre, the rim gently wavy, a few water droplets beading on it.

## lotus-leaf-b (1024x1024) → 存为 art-incoming/lotus-leaf-b.png
Photorealistic photograph of a real sacred lotus (Nelumbo nucifera) in a summer pond, natural soft daylight, true colour and fine detail, not an illustration, no outlines. Isolated on a fully transparent background: no water, no reflection, no shadow, no other plants, no text, no border. A single round lotus leaf lying flat, seen from DIRECTLY ABOVE: a nearly perfect circle filling the image, a fresher, lighter green, fine radiating veins, the rim slightly curled up on one side showing a paler underside.

## lotus-leaf-up (1024x1024) → 存为 art-incoming/lotus-leaf-up.png
Photorealistic photograph of a real sacred lotus (Nelumbo nucifera) in a summer pond, natural soft daylight, true colour and fine detail, not an illustration, no outlines. Isolated on a fully transparent background: no water, no reflection, no shadow, no other plants, no text, no border. A single lotus leaf standing up out of the water on its tall stem, seen from the SIDE at eye level: the leaf cupped and tilted, its rim wavy, blue-green, the straight green stem running down to the BOTTOM EDGE of the image, centred.

## lotus-flower-a (1024x1024) → 存为 art-incoming/lotus-flower-a.png
Photorealistic photograph of a real sacred lotus (Nelumbo nucifera) in a summer pond, natural soft daylight, true colour and fine detail, not an illustration, no outlines. Isolated on a fully transparent background: no water, no reflection, no shadow, no other plants, no text, no border. A single fully open pink lotus flower seen from the SIDE, slightly above eye level: layered petals white at the base flushing to pink at the tips, a yellow seed pod and stamens at the heart, on a straight green stem running down to the BOTTOM EDGE of the image, centred.

## lotus-flower-b (1024x1024) → 存为 art-incoming/lotus-flower-b.png
Photorealistic photograph of a real sacred lotus (Nelumbo nucifera) in a summer pond, natural soft daylight, true colour and fine detail, not an illustration, no outlines. Isolated on a fully transparent background: no water, no reflection, no shadow, no other plants, no text, no border. A single half-open pale pink lotus flower seen from the SIDE: cupped petals white at the base, pink at the tips, on a straight green stem running down to the BOTTOM EDGE of the image, centred.

## lotus-bud (1024x1024) → 存为 art-incoming/lotus-bud.png
Photorealistic photograph of a real sacred lotus (Nelumbo nucifera) in a summer pond, natural soft daylight, true colour and fine detail, not an illustration, no outlines. Isolated on a fully transparent background: no water, no reflection, no shadow, no other plants, no text, no border. A single closed lotus bud seen from the SIDE: a pointed teardrop of pink petals, greener at its base, on a straight slender green stem running down to the BOTTOM EDGE of the image, centred.

## Codex 回复

（在这里写）
