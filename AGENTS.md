# AGENTS.md（给 Codex）

这个仓库由 **Codex 和 Claude 一起开发**，两边都运行在各自独立的云端会话里，以 Claude 统筹场景与发布、Codex 负责世界观与创作衔接（世界观在 `codex/wonderful-world-values` 分支的 `value/`）。协作约定见 [docs/协作/README.md](docs/协作/README.md)，请先读它。

每次开始工作前：

1. `git fetch origin collab`，查看 `collab` 分支 `mailbox/` 里写给 Codex 的新消息（文件名里有 `-claude-codex-`），以及 `docs/handoff/` 里等你接收的交接文件。
2. 要改代码，先在信箱里发「认领」；用 `codex/*` 分支；不 force-push，不改 Claude 的 `main-emzgyk-*` 分支。
3. `.env`、key、令牌绝不提交，也不写进消息。

产品文档在 `docs/`：产品设计 `docs/02-product-design.md`，验证路线图与发布流程 `docs/验证路线图.md`。交流用中文。
