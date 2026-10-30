# 公网测试入口：AWS

> 2026-10-29 更新：所有者没有 Cloudflare 账号，部署统一走 AWS（东京区域，`want.world` 的域名解析在 Route 53）。为 [验证路线图](验证路线图.md) 的主持测试、日记式测试和送鱼实验准备，里程碑 **11/6 前**。

## 现状：`want.world` 已经在 AWS 上

| 项 | 内容 |
|---|---|
| 运行 | EKS 集群 `qa-web3-netx-tokyo-eks`，命名空间 `wonder-lab`，一个容器同时提供网页和 API（[deploy.md](deploy.md)） |
| 入口 | ALB（`deploy/k8s/qa/resources.yaml` 的 Ingress），HTTPS 证书在 ACM，`want.world` 指向这个 ALB |
| 构建 | GitHub Actions「Artifact Build」：以 `WW_EXPERIMENT=poc-r1` 打包，推送镜像到 ECR |
| 部署 | GitHub Actions「Deploy QA」：Artifact Build 在 `main` 上成功后自动部署；验收某个分支时，对该分支手动运行 Artifact Build，再用它的提交号手动运行 Deploy QA（路线图 §2） |

所以 R1 的主持测试和日记式测试直接用 `https://want.world`，不需要另开托管。

## 响应头

页面由服务端（`server/src/web.ts`）返回，下面几项在那里设置，和静态托管用的 `deploy/static/_headers` 保持一致：

| 响应头 | 作用 | 状态 |
|---|---|---|
| `Referrer-Policy: strict-origin-when-cross-origin` | 跳出站点时只带域名，不带路径 | ✓ |
| `X-Content-Type-Options: nosniff` | 基本安全 | ✓ |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | 从浏览器层面禁止摄像头、麦克风、定位（P8） | ✓（2026-10-29 加入） |
| `/assets/*` 一年缓存 | 带哈希的文件，更新时文件名会变 | ✓ |
| `X-Robots-Tag` | 搜索引擎收录 | **不加**（2026-10-29 所有者决定：Wonderful World 是开放的，`want.world` 允许收录） |

## 送鱼实验的站点 `gift.want.world`（11/16 前需要）

送鱼实验要一个单独的构建（`WW_EXPERIMENT=poc-gift-r1`），和 R1 的数据、浏览器存储分开，所以要第二个地址。沿用现有流水线，和 `want.world` 共用同一个 ALB，不另开负载均衡：

| 步骤 | 内容 | 状态 |
|---|---|---|
| 构建 | Artifact Build 多打一个镜像 `shared-wonderlab/api:<标签>-gift`，以 `poc-gift-r1` 打包 | ✓ |
| 部署 | Deploy QA 在 R1 站点上线后应用 `deploy/k8s/qa/gift.yaml`（只有网页，不连数据库、不挂密钥、账户关闭）；没有 gift 镜像的旧提交照常部署，只是不动送鱼站点 | ✓ |
| 域名 | Route 53：`gift.want.world` 别名指向同一个 ALB | ✓（2026-10-29） |
| 证书 | ACM（ap-northeast-1）`*.want.world`：`65f9abd4…`（2026-10-30）。原证书 `6ab53b30…` 只含 `want.world`，仍作为默认证书 | ✓ |
| 入口 | `resources.yaml` 的 Ingress 带上两张证书，并有一条 `host: gift.want.world` → `wonderlab-gift` 的规则 | ✓ |

## 部署后验收（每个站点各做一遍）

- [ ] `https://` 打开，地址栏无警告；手机（iOS Safari、Android Chrome）上能画鱼、能保存
- [ ] 打开 `/?study`：页面底部显示的版本是 `poc-r1`（或 `poc-gift-r1`）和预期的提交号，**没有 `-dirty`**
- [ ] 浏览器开发者工具的「网络」里，所有请求都只发往本站点：没有分析、统计、字体或其他第三方域名
- [ ] 写一句话（即使地址里带了 `#invite=`）：网络面板里**没有** `/api/scene` 请求
- [ ] 响应头里有上表标 ✓ 的几项（开发者工具 → 网络 → 任意请求 → 响应头）
- [ ] `want.world`（R1）：打开一个礼物链接，什么也不发生；长按鱼没有「送给朋友」
- [ ] `gift.want.world`：两台设备完成一次送鱼、收鱼；收鱼人的 `/?study` 能看到「收下的鱼 1 条」并能导出
- [ ] 导出的测试记录里没有画的内容、写的字、名字和链接；每条记录带着 `sha`、`exp`，文件里的 `builds` 只有预期的版本
- [ ] iPhone Safari 上打开 `/?study`：刷新、返回后计数不变；「导出并发给研究人员」弹出系统分享面板，能存到「文件」或用信息、邮件发出
