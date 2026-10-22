# 测试会话数据（不提交）

阶段 D 每位测试者的事件日志和观察记录放在这里，用 `npm run analyze` 汇总（流程见 [docs/05](../docs/05-test-protocol.md)，判定规则见 [docs/07](../docs/07-report-template.md)）。除了这个说明，本目录的文件都不进仓库。

- `P01.json`、`P02.json` …：测试结束时按 `Alt`+`Shift`+`E` 导出的日志，改名为测试者编号。
- `notes.json`：观察员记录，只有日志里看不到的两项：

```json
[
  { "tester": "P01", "askedForHelp": false, "askedToSend": true },
  { "tester": "P02", "askedForHelp": true, "askedToSend": false }
]
```

`npm run analyze` 会打印汇总并写入 `sessions/report.md`。
