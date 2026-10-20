# 项目内置 Skills

放在 `.claude/skills/` 下的 skills 会在本仓库中被 Claude Code 自动发现并默认启用。

| Skill | 用途 | 来源 | 许可 |
|---|---|---|---|
| threejs-* (13 个) | Three.js 场景、着色器、动画、交互、性能、后期 | [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills) @ `0e18186` | MIT（见 `THREEJS-SKILLS-LICENSE`） |
| frontend-design | 有辨识度的视觉方向与排版 | [anthropics/skills](https://github.com/anthropics/skills) @ `dbd4588` | Apache-2.0 |
| algorithmic-art | p5/程序化生成艺术的方法论 | anthropics/skills @ `dbd4588` | Apache-2.0 |
| webapp-testing | 用 Playwright 驱动并验证本地 Web 应用 | anthropics/skills @ `dbd4588` | Apache-2.0 |
| react-best-practices | React 性能与写法规范 | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) @ `063bee9` | MIT |
| composition-patterns | React 组件组合模式 | vercel-labs/agent-skills @ `063bee9` | MIT |
| web-design-guidelines | Web 界面规范审查 | vercel-labs/agent-skills @ `063bee9` | MIT |

全局已安装的 `ui-ux-pro-max` 用于所有 UI/UX 决策。

更新方式：重新拉取上游仓库，覆盖对应目录，并更新本表中的提交号。
