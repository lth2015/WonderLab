# WonderLab · 万象生

> 一念起，万象生。

AI 驱动的互动数字艺术创作平台。当前阶段：PoC-001「万象初生」——阶段 A（纯本地原型）开发中。

## 文档

| 文档 | 内容 |
|---|---|
| [charter.md](charter.md) | 立项纲要：为什么做、做什么、第一步 |
| [docs/01-product-principles.md](docs/01-product-principles.md) | 产品原则：九条可检验的决策规则与冲突优先级 |
| [docs/02-product-design.md](docs/02-product-design.md) | 产品设计：PoC-001 的假设、输入判定、四个核心互动、度量与阶段计划 |
| [docs/03-ux-ui-design.md](docs/03-ux-ui-design.md) | UI/UX 设计规范：美学方向、色彩、字体、控件、交互、动效、无障碍（所有数值的唯一来源） |
| [docs/04-self-review.md](docs/04-self-review.md) | 自省记录：v0.1 → v0.2 的审稿意见、处理方式与遗留风险 |

## 本地运行

```bash
npm install
npm run dev      # 开发服务器；同一局域网的手机可用终端显示的 Network 地址打开
npm test         # 输入判定与「一句成境」本地规则的测试
npm run build    # 类型检查 + 生产构建
```

## 开发辅助

项目内置的 Claude Code skills 位于 [.claude/skills/](.claude/skills/README.md)，克隆仓库后在本目录中自动启用。
