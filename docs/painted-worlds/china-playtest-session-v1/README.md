# 汴河拾光：主持试玩会模式

状态：代码与本地验证完成，待 Claude 代开 PR、部署和线上复验。基线 `main@cdaf3a9`，按江户 PR #154 的共享约定接入；不改变故事、15 页画册、奖励或 saveVersion 4。

入口：`/qingming/?session=1`（联合站）或 `/?session=1`（独立构建）。仅 `session=1` 启用，`session=0` 和无参数仍为普通模式。

## 主持流程

画卷左上角显示「试玩会」。设置顶部「试玩会·本位玩家」可导出本位记录，文件名包含 session_id 前八位。结束后按「下一位」并确认；只清除本作两项试玩数据，再用 `location.replace(pathname + '?session=1')` 返回标题页。取消继续本位。最后一位结束也先导出再清理。

普通存档 `ww:qingming-china:save:v1` 保留，退出试玩网址即可继续。试玩期间不要并行操作多个标签页。

## 与江户一致的数据约定

| 项目 | 中国篇 |
| --- | --- |
| 试玩进度 | `ww:qingming-china:save:v1:session` |
| 试玩记录 | `ww:qingming-china:study:session` |
| 持久化结构 | `{session_id, started_wall, dropped, seen[], events[]}` |
| 导出环境 | `playtest-session` |
| 事件口径 | 同一玩家刷新沿用 session_id、首次入场与首次有效操作的 once 标记，不计 revisit |
| 计时 | 从首次载入的墙上时间开始，刷新、后台停留继续计时 |
| 上限 | 最近 1000 条事件，累计 dropped；普通模式仍只在内存中记录 |

恢复时只收相同 session_id、相同作品、schema_version 1 的有效事件，并按现有固定字段白名单重新构造；其他作品、其他玩家、未知事件及额外自由字段不进入导出。坏记录另开一位，不改变日常进度。存储受限时记录仍可留在内存并导出，但无法保证刷新续接；清理失败会提示，避免未经清理就交给下一位。

不上传记录，不收网址参数、名字、用户存档或自由文本。主持人主动导出的 JSON 按试玩工具包保管；本目录 exports 是自动脚本产生的测试记录，不是真人样本。

## 验证结果

- 中国篇 65 测试通过（新增 6 项覆盖刷新、坏记录、跨作品过滤、上限、写入失败和清理范围）。根应用 488 通过、4 项既有跳过；类型检查与三作联合构建通过。
- 360 / 390px 触屏视口、150% 文字：真实纸铺流程及重逢、刷新续接、只计一次首次操作、导出文件名、取消/确认下一位、普通进度逐字保留、参数 0、坏记录恢复均通过。无额外存储键、外部请求或页面异常。见 `evidence/result.json` 与两张主持面板截图。
- 生产构建独立 `/` 和联合 `/qingming/` 都完成纸铺中途恢复：从人物热点开始触屏拖动不误开对话；故事中画卷锁定；390↔844 旋转、切换标签页再返回保持当前选项；新分页重新进入仍可续接中途步骤与相同玩家，完成后为 72 文。见 `evidence/production-quality.json`。
- 普通模式既有浏览器回归通过：无新记录存储键、正常 revisit、导入不补记故事、回看时段和钱包保留、导出成功/失败记录。
- 两位自动导出可直接用共享 `summarize.mjs` 汇总：第一位完成纸铺并重逢，第二位只入场；正确按两个 session 统计，重逢不当成首通。其 1/2 数字仅验证工具，不能用来评价真人指标。

浏览器检查用无头 Chromium 触屏模拟，**不代表真实手机、Safari 或真人观察验收**。线上可达性在本会话受限，部署与线上复验由 Claude 统筹；目前未声称中国试玩会模式已上线。

## 复现

```sh
npm run test:qingming
npm run typecheck
npm run build
npm test
node docs/painted-worlds/playtest/summarize.mjs docs/painted-worlds/china-playtest-session-v1/evidence/exports
```

`browser-check.py` 要求中国开发服务器在 5175；`production-check.py` 要求 `apps/qingming-china/dist` 由 5176 提供、根 `dist` 由 5177 提供。两脚本需 Python Playwright 与 `/usr/lib/chromium/chromium`，重新运行会更新 evidence 文件。

后续顺序保持：先部署及复验此模式，再做中国画页 J02、图集瘦身。没有引入付费、礼赠服务或商城。
