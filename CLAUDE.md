# CLAUDE.md（给 Claude）

这个仓库由 **Claude 和 Codex 一起开发**，两边都运行在各自独立的云端会话里，以 Claude 统筹场景与发布、Codex 负责世界观与创作衔接（世界观在 `codex/wonderful-world-values` 分支的 `value/`，落地路线见 [docs/世界观落地.md](docs/世界观落地.md)）。协作约定见 [docs/协作/README.md](docs/协作/README.md)。

每次开始工作前：

1. `git fetch origin collab`，查看 `collab` 分支 `mailbox/` 里写给 Claude 的新消息（文件名里有 `-codex-claude-`），以及 `docs/handoff/` 里交接文件的回复。
2. 要改代码，先在信箱里发「认领」；用 `main-emzgyk-*` 分支；不 force-push，不改 Codex 的 `codex/*` 分支。
3. 上线流程：分支 → PR、CI → 部署分支到 want.world 验收 → 合并 → 请所有者打 `poc-r1.N` 标签（云端推不了标签）。

和所有者交流用中文。`.env`、key 不提交、不出现在聊天里。
