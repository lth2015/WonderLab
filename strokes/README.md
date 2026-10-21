# 笔迹测试数据

用 `?collect` 采集的真实笔迹（[02 §4](../docs/02-product-design.md) 的测试用例集），用来校准 [03 §6.2](../docs/03-ux-ui-design.md) 的判定阈值。

1. `npm run dev`，在桌面或手机上打开 `http://<地址>/?collect`。
2. 填测试者编号（不要填真名），按提示画完 45 笔，最后点「导出 JSON」。
3. 把导出的 `strokes-*.json` 放进本目录。
4. `npm test`：`src/collect/dataset.test.ts` 会用全部文件检验判定表，并打印每种形状的判定结果。

文件只包含坐标、时间、画布尺寸和指针类型，不含任何个人信息。
