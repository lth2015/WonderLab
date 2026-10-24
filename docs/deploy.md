# 部署测试版（阶段 D 用）

目标：给主持测试一个**手机和电脑都能直接打开的网址**（[首轮执行单](testkit/README.md) 里的「测试页面 URL」）。PoC 只需要画布和「一句成境」，账户与支付保持关闭，不需要数据库。

## 是什么

一个容器、一个进程：API 服务器同时提供打包好的网页（`WEB_DIST_DIR`）和 `/api/scene`。网页和 API 同源，不用配置 CORS，也不用在打包时指定 API 地址。

```
浏览器 ──https──▶ 容器 :8080
                   ├─ /            网页（dist/）
                   ├─ /assets/*    带哈希的静态文件，缓存一年
                   ├─ /api/scene   一句成境 → TokenStars
                   └─ /api/health  健康检查
```

## 构建与本地试跑

```bash
docker build -t wonderlab .
docker run --rm -p 8080:8080 --env-file deploy.env wonderlab
# 打开 http://localhost:8080/?fresh
```

不用 Docker 也可以：`npm run build`，然后

```bash
WEB_DIST_DIR=dist HOST=0.0.0.0 PORT=8080 npm run server:start
```

## 环境变量（测试版最少需要这些）

`deploy.env` 和 `.env` 一样，**不要提交到仓库**；在托管平台上用它们的「环境变量 / Secret」功能填写。

| 变量 | 值 | 说明 |
|---|---|---|
| `PUBLIC_WEB_URL` | `https://<测试网址>` | **必须和浏览器地址一致**：`/api/scene` 只接受来自这个来源的请求 |
| `PUBLIC_API_URL` | 同上 | 同源部署时两者相同 |
| `TOKENSTARS_API_KEY` | 你的 key | 放在平台的 Secret 里 |
| `TOKENSTARS_MODEL_ID` | 例如 `gpt-5.4-nano` | 和 TokenStars 后台的名称完全一致 |
| `INVITE_TOKENS` | 逗号分隔，每个 ≥ 8 位 | 测试链接末尾带 `#invite=<令牌>` 才会用 AI（放在 `#` 后，不会出现在 Cloud Run 等平台的请求日志里）；删掉某个令牌即可吊销 |
| `SCENE_DAILY_PER_INVITE` / `SCENE_DAILY_BUDGET_JPY` / `SCENE_TOTAL_BUDGET_JPY` | 默认 60 / 300 / 5000 | 三层封顶（[02 §5.3](02-product-design.md)），按预算调整 |
| `SCENE_CACHE_SALT` | 随机长字符串 | 固定下来，重启后缓存键不变 |

镜像里已经设好：`NODE_ENV=production`、`RUN_MODE=production`、`HOST=0.0.0.0`、`PORT=8080`、`WEB_DIST_DIR=/app/dist`。不设 `DATABASE_URL`，账户和支付就是关闭的，「账户」面板会显示「账户功能尚未开启」。

## 托管平台的要求

任何能跑容器、给 HTTPS 地址的平台都可以（例如 Google Cloud Run、Fly.io、Render）。有三点要求：

1. **只开一个实例**（最大实例数 = 1）。AI 的三层封顶计数在进程内存里，多个实例会各算各的，重启也会清零。PoC 的流量一个实例足够。
2. **HTTPS**。手机上保存作品、分享面板都需要安全来源。
3. **请求日志不记录请求体**。服务器自己只记方法、路径和状态码，不记录测试者写的句子（[01 P9](01-product-principles.md)）；平台层也不要开启记录请求体的功能。

## 用 Cloud Run 部署（一条命令）

在**你自己的电脑**上、仓库根目录运行（`gcloud` 已用 `gcloud auth login` 登录，`.env` 里填好了 TokenStars 和 `INVITE_TOKENS`）：

```bash
scripts/deploy-cloudrun.sh <项目ID> --dry-run   # 先看一遍会执行哪些命令，什么都不改
scripts/deploy-cloudrun.sh <项目ID>             # 真正部署（默认东京 asia-northeast1）
```

脚本会：

1. 打开 Cloud Run、Cloud Build、Artifact Registry、Secret Manager 这几个 API；
2. 把 `TOKENSTARS_API_KEY`、`INVITE_TOKENS` 和一个随机生成的缓存盐存进 Secret Manager（值从管道传入，不出现在命令行和输出里），并允许服务读取；
3. 用 Cloud Build 按 `Dockerfile` 构建并部署，**最多 1 个实例**、可缩到 0；模型名和 `.env` 里设了的封顶额度作为普通环境变量；
4. 读出服务的网址，设好 `PUBLIC_WEB_URL` / `PUBLIC_API_URL`，另一个 Cloud Run 网址放进 `ALLOWED_ORIGINS`；
5. 访问 `/api/health` 确认服务在线，并打印测试链接。

再次运行就是重新部署当前代码，已有的设置会保留。上传给 Cloud Build 的文件见 `.gcloudignore`：`.env` 不会被上传。

**注意：** 实例缩到 0 后重启，内存里的 AI 封顶计数会清零。正式测试期间，请在 TokenStars 后台另外设一个额度上限，作为最后一道保险。

## CI

`.github/workflows/ci.yml` 在每个 PR 和每次推送到 main 时运行：类型检查、单元测试、打包、数据库测试（MySQL 服务），以及 Docker 镜像构建。

## 开测前检查

- [ ] 打开 `https://<测试网址>/?fresh`：世界正常出现，能画鱼
- [ ] 用 `?fresh#invite=<令牌>` 打开，写「今夜下一场小雨」：开始下雨，并出现一句古诗
- [ ] `https://<测试网址>/api/health` 返回 `{"ok":true,...}`
- [ ] 手机上用 `?fresh&mod` 打开，左上角点 5 下能打开主持人面板
- [ ] 部署的 commit 和配置记到首轮执行单上
