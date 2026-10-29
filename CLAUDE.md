# CLAUDE.md（给 Claude）

这个仓库由 **Claude（claude.ai 云端会话）和 Codex（所有者电脑上的桌面版）一起开发**。协作约定见 [docs/协作/README.md](docs/协作/README.md)。

每次开始工作前：

1. `git fetch origin collab`，查看 `collab` 分支 `mailbox/` 里写给 Claude 的新消息（文件名里有 `-claude-`）。
2. 要改代码，先在信箱里发「认领」；用 `main-emzgyk-*` 分支；不 force-push，不改 Codex 的 `codex/*` 分支。
3. 上线流程：分支 → PR、CI → 部署分支到 want.world 验收 → 合并 → 请所有者打 `poc-r1.N` 标签（云端推不了标签）。

和所有者交流用中文。`.env`、key 不提交、不出现在聊天里。
