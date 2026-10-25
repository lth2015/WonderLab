# 公网测试入口：静态托管（最简方案）

> 2026-10-25 · 为 [验证路线图](验证路线图.md) 的日记式测试和送鱼实验准备，里程碑 **11/6 前**。不强制 GCP；需要后端时仍可用 [deploy.md](deploy.md) 的 Cloud Run 方案。

## 为什么静态托管就够

日记式测试（C 组）和送鱼实验（D 组）走的路径都不需要服务器：画鱼、成长、回访、送鱼和收鱼、导出测试记录，全部在浏览器里完成。打包产物 `dist/` 是一组静态文件，任何能提供 HTTPS 的静态托管都能用。

代价：没有服务器，就没有 `/api/scene`，「一句成境」只用本地规则（和 iOS 首发一致）。礼物链接、测试记录本来就不经过服务器，不受影响。

## 两个站点，两个构建

| 站点（建议） | 构建 | 用途 |
|---|---|---|
| `r1.want.world` | `npm run build:r1` → `poc-r1` | 日记式测试；主持测试也可以用它 |
| `gift.want.world` | `npm run build:gift` → `poc-gift-r1` | 送鱼实验（送鱼人和收鱼人都用这个） |

- 两个站点地址不同，浏览器存储互不相通：在 `r1` 上画的世界，不会出现在 `gift` 上；送鱼人要在 `gift` 站点上画要送的鱼。
- 构建前确认工作区干净（`git status` 无改动），否则版本号会带 `-dirty`。冻结后从 `poc-r1` 标签构建。
- 用独立的测试子域名，和将来的正式产品分开。两个站点都返回 `X-Robots-Tag: noindex`，要求搜索引擎不收录。这是对守规矩的搜索引擎的请求，**不是保证**：站点地址仍然只发给参与者，不公开发布。

## 推荐：Cloudflare Pages 直接上传

免费、自带 HTTPS、支持自定义子域名，并且会读取构建产物里的 `_headers` 文件（`npm run build:r1` / `build:gift` 已经把 `deploy/static/_headers` 复制进 `dist/`）。

```bash
git checkout poc-r1                 # 冻结后；之前用当前 main
npm ci
npm run build:r1
npx wrangler pages deploy dist --project-name wonderful-world-r1

npm run build:gift
npx wrangler pages deploy dist --project-name wonderful-world-gift
```

第一次运行 `wrangler` 会要求在浏览器里登录 Cloudflare 账号。然后在 Cloudflare 后台给两个项目绑定 `r1.want.world`、`gift.want.world`；如果 `want.world` 的域名解析不在 Cloudflare，在原来的 DNS 服务商处加一条 CNAME 即可。

**必须关闭：** Cloudflare 后台的 Web Analytics（网页分析）对 Pages 项目默认不开，保持关闭。开了会在页面里注入第三方脚本，违反隐私边界。

其他静态托管（Netlify 也读 `_headers`；Firebase Hosting、GitHub Pages 等需要另配响应头）同样可用，验收标准一样。

## `_headers` 设了什么

| 响应头 | 作用 |
|---|---|
| `Referrer-Policy: strict-origin-when-cross-origin` | 跳出站点时只带域名，不带路径 |
| `X-Content-Type-Options: nosniff` | 基本安全 |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | 从浏览器层面禁止摄像头、麦克风、定位（P8） |
| `X-Robots-Tag: noindex, nofollow` | 请搜索引擎不收录测试站点（不是保证） |
| `/assets/*` 一年缓存 | 带哈希的文件，更新时文件名会变 |

## 部署后验收（每个站点各做一遍）

- [ ] `https://` 打开，地址栏无警告；手机（iOS Safari、Android Chrome）上能画鱼、能保存
- [ ] 打开 `/?study`：页面底部显示的版本是 `poc-r1`（或 `poc-gift-r1`）和预期的提交号，**没有 `-dirty`**
- [ ] 浏览器开发者工具的「网络」里，所有请求都只发往本站点：没有分析、统计、字体或其他第三方域名
- [ ] 响应头里有上表的几项（开发者工具 → 网络 → 任意请求 → 响应头）
- [ ] `r1` 站点：打开一个礼物链接，什么也不发生；长按鱼没有「送给朋友」
- [ ] `gift` 站点：两台设备完成一次送鱼、收鱼；收鱼人的 `/?study` 能看到「收下的鱼 1 条」并能导出
- [ ] 导出的测试记录里没有画的内容、写的字、名字和链接；每条记录带着 `sha`、`exp`，文件里的 `builds` 只有预期的版本
- [ ] iPhone Safari 上打开 `/?study`：刷新、返回后计数不变；「导出并发给研究人员」弹出系统分享面板，能存到「文件」或用信息、邮件发出
