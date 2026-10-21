# WonderLab · 万象生

> 一念起，万象生。

AI 驱动的互动数字艺术创作平台。当前阶段：PoC-001「万象初生」——阶段 A（纯本地原型）开发中。

![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg) ![Stewarded by the NETX community](https://img.shields.io/badge/stewarded%20by-NETX%20community-ff6a3d.svg)

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
cp .env.example .env   # 填入 TokenStars 等配置（变量名与 yuha 一致）；.env 不提交
npm run dev            # 前端；同一局域网的手机可用终端显示的 Network 地址打开
npm run server         # 另开一个终端：API 服务（一句成境的 AI），前端 /api 自动转发到这里
npm test               # 全部测试
npm run typecheck      # 前端 + 服务端类型检查
npm run build          # 生产构建
```

AI 只对受邀测试者开放：在 `.env` 的 `INVITE_TOKENS` 里写一个令牌，用 `?invite=<令牌>` 打开一次页面即可。没有令牌或服务端没配 TokenStars 时，「一句成境」只用本地规则，体验完整可用。

### 美术素材（一次性）

```bash
npm run art              # 预览要生成的图片和预估费用（不花钱）
npm run art -- --yes     # 通过 TokenStars 生成 7 条锦鲤和月面，写入 public/art/
npm run art -- --prompts # 或者打印提示词，在 ChatGPT 里手动生成，存成 art-raw/<名字>.png 后：
npm run art -- --process-only
```

生成后打开页面检查每条鱼的头是否朝右（朝左的在 `public/art/manifest.json` 里设 `"flip": true`），满意就提交 `public/art/`。没有这些文件时，鱼和月亮用程序化渲染。

`npm run fonts`：句库（`src/poems.ts`）或诗意文案改了之后，重新生成霞鹜文楷子集。

## 账户与支付（移植自 yuha）

Google 登录、员工两步验证、Stripe 卡支付、JPYC/USDC 稳定币支付和额度账本，代码来自 [yuha](https://github.com/lth2015/yuha)（Apache-2.0，见 `NOTICE`），保留了它的校验和幂等规则，去掉了曲目、市场授权、邮件通知等 yuha 专属部分。

- 都依赖 MySQL：不设 `DATABASE_URL` 时，服务端照常提供「一句成境」，账户和支付关闭，画布完全不受影响。
- **卖什么还没定**：商品由 `.env` 的 `CATALOGUE_JSON` 配置（价格、额度、有效期），Stripe 价格 id 按 `STRIPE_PRICE_ID_<商品键>` 读取；不配置就什么都不卖。
- 本地试用：`npm run db:up`（Docker 起 MySQL），`.env` 里设 `DATABASE_URL`、`DEV_AUTH_SECRET` 和一个 `CATALOGUE_JSON`，`npm run server`。演示模式（`RUN_MODE=demo`）下登录和付款都是模拟的。入口在「更多 → 账户」。
- 员工两步验证（TOTP）：角色为 support/admin 的账户在开启两步验证之前进不了 `/v1/admin/*`；在「更多 → 账户」里扫码开启，之后登录（开发登录或 Google）都要再输入验证器里的 6 位码，或一个一次性恢复码。连续输错会锁定这个账户几分钟。相关配置见 `.env.example` 的 `MFA_*`、`ADMIN_MFA_REQUIRED`（生产环境不能关）。
- `npm run test:db`：支付、退款、争议、订阅对账、稳定币报价/扫链/结算、账本、两步验证等 271 项数据库测试（需要 `npm run db:up`）。
- 上线前要配置的服务器路由：`/auth/google/callback`、`/checkout/complete`、`/checkout/simulate`、`/pricing` 都返回 `index.html`（开发服务器已经这样做）。

## 测试主持

事件日志只保存在测试设备的内存里，不上传，也不记录用户写的句子（见 [02 §8](docs/02-product-design.md)）。

| 快捷键 | 作用 |
|---|---|
| `Alt`+`Shift`+`E` | 导出本次会话的事件日志（JSON） |
| `Alt`+`Shift`+`P` | 切换引导段 / 自由段（记入日志） |
| `Alt`+`Shift`+`R` | 重置为全新世界（`?fresh`），换下一位测试者时用 |

`?tier=light` 或 `?tier=standard` 可以固定画质档位，用于在不同设备上比对。

**笔迹采集：** 打开 `?collect`，按提示把 [02 §4](docs/02-product-design.md) 的 9 种形状各画 5 次，导出的 JSON 放进 [strokes/](strokes/README.md)，`npm test` 就会用真实笔迹检验判定表。

## 开发辅助

项目内置的 Claude Code skills 位于 [.claude/skills/](.claude/skills/README.md)，克隆仓库后在本目录中自动启用。

## 捐赠给 NETX 技术社区

和 [yuha](https://github.com/lth2015/yuha) 一样，WonderLab 的代码捐赠给 **NETX 技术社区**（<https://www.netx.world/>），由它作为上游管理者：持有正式代码仓库，决定合并和发布什么。

**服务不等于代码。** 谁部署 WonderLab 对外提供服务，谁就是这份部署的运营者：Stripe 账户、收款钱包、特定商取引法披露、隐私政策、退款和客服都归运营者，不随代码转移。管理者不是任何顾客交易的当事人，仓库里也不写任何运营者的身份信息。完整的边界，以及捐赠还没定下来的事，见 [`GOVERNANCE.md`](GOVERNANCE.md)。

## 许可证

**Apache License 2.0**，见 [`LICENSE`](LICENSE)。字体（SIL OFL 1.1）等例外，以及移植自 yuha 的部分，见 [`NOTICE`](NOTICE)。
