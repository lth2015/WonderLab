# 中国篇与江户篇规格复审 · 2026-11-01

审查代码：`main@c6f0008`（含城门PR143）。本报告分支只增加文档和审查证据，不修改产品、声音、街景或部署配置。

结论：故事与画册的免费闭环已有实质交付：中国5故事/14页、江户3故事/12页，长卷分别24000×1200与14000×700。不能据此宣称全面满足规格。江户复现两项P1存档边界问题；焦点、分享异常回退、真实设备质量验收、共同契约及计测仍有缺口。PR138仍为商业研究草稿，**不属于main已完成/线上能力**。

## 依据与证据边界

1. Claude最新分派为collab的0900与0910两封信，以0910更正为准：第1项PR138收尾已完成，不重复开发；本轮只做第2项规格复审。
2. 江户依据[开发记录](../qingming-edo/README.md)中对原v1.0的逐节映射（§5–§20）、[素材台账](../qingming-edo/素材台帳.md)、实际代码和测试。中国依据[实现记录](../china-implementation.md)、[长卷复核](../china-long-review-2026-11-01.md)、[导览](../china-scroll-guide-2026-11-01.md)、[城门交付](../qingming-china/gate-story-v1/README.md)及协作已确认要求。
3. 共同长卷/13条美术取值依据collab的`docs/handoff/painted-worlds-long-scroll-requirements-v1.md`与`painted-worlds-style-decision-v1.md`末尾双方定稿。它们不在main，不把顶部旧“待确认”当最终状态。
4. **完整原始中日规格文件未在当前main/附件中找到。**中国素材台账说明原策划在所有者Downloads，江户README引用v1.0但未收录原文。本报告覆盖当前可读要求及其明确的节号，无法保证未公开原文的每一句均无遗漏。需Claude补存完整规格及版本，之后补一次差异核对；不是请所有者重讲已确认需求。
5. `want.world/edo/`与`/qingming/`在本会话均CONNECT 403，不能直接独立复验线上。Claude0900称PR143的CI/自动部署成功、线上复验进行中；这是**对方回执**。下述新实测为同一main的本地Chromium，不冒称已验证线上、真机或收到礼物。

状态：满足＝当前代码与适当证据覆盖该条；部分＝有实现但有边界缺口或验收未足；未做＝在审查范围无相应实现；不适用＝当前这份产品/本轮没有该项承诺。P1先处理进度丢失/白屏，P2近期补齐体验或验收，P3后续完善。负责人是建议分工，**不是已认领或已修复**。

## 对照清单

| ID / 要求 | 中国篇 | 江户篇 | 证据与剩余工作 | 优先级 / 建议负责人 |
| --- | --- | --- | --- | --- |
| S01 微故事与人物 | 满足 | 满足 | 中国paper/boat/purse/harbor/gate，6位主角+2位对话人物；江户kaze/dougu/tenugui与6人。见[C-GAME]、[C-CONTENT]、[E-WORLD]、[E-SCRIPT]，状态测试通过 | P3维持；各自内容负责人 |
| S02 温和错选、可离开与续接 | 满足 | 满足 | 中国分步状态机、理绳/线索/新故事；江户脚本入口、ON_CLOSE、单调任务状态。有效中间进度可恢复；不是每个未确认的小游戏选项都即时保存 | P3；Codex/Claude |
| S03 回放、分支补页、不重复发奖 | 满足 | 满足 | 中国REPLAY+claimed；江户recall跳过effects且addRecallPage每种备选最多一页。46/63测试含重入/回放，[C-GAME]、[E-STATE] | P3；各自维护 |
| S04 文钱初始60、原三故事12/24/18 | 满足 | 满足 | 两边原故事合计114；中国港/门各0；游戏数值声明。没有现实充值、没有分享奖励 | P3；各自维护 |
| S05 游戏内茶/纪念纸签消费 | 满足 | 未做 | 中国BUY有6/12消费；江户ITEMS定义茶菓子6/题笺12，但未被购买UI或扣款动作消费；不能把目录当已能买。[E-WORLD]223、[E-STATE]、App持ち物 | P3；Claude确认原规格是否要求此阶段接消费 |
| P01 遊び与不依赖画技 | 满足 | 满足 | 中国理绳/货签、配茶、香囊线索；江户Wrap/Tea/Tenugui及Sketch构图选择，非自由绘画评分，均可改错，不限时 | P3；各自维护 |
| P02 拖动小游戏有点按/键盘替代 | 满足 | 满足 | 中国RopeGame点击形状→目标；江户Wrap选择物件→布格，含键盘处理。[C-APP]183、[E-WRAP]；已存在状态及浏览器证据，未新跑所有小游戏×设备组合 | P3；Codex/Claude |
| J01 画册有实际解锁与收束 | 满足 | 满足 | 中国14个PAGES且测试全可达，师父/小记；江户12槽＝3故事+2回想+7写生，满册宗吉收束。README早期“未做7页”已过时 | P3；各自维护 |
| J02 每页独立构图与精绘质量 | 部分 | 部分 | 中国为独立题意SVG，复用桥/茶等基元，并非14张精绘；江户画卷裁切与人物重新组合，近景受原图分辨率限制。不能以PNG像素数代替原生画质 | P2；Codex美术、Claude接入 |
| J03 清晰PNG、无付费墙 | 满足 | 满足 | 中国1440×1800、江户1200×1600；中国当前main城门真实下载复验通过；江户pageToPng内联图片。基础导出免费。[C-EXPORT]、[E-PNG] | P3；各自维护；硬件落盘另验 |
| T01 故事节点推进朝/昼/夕，不倒计时赶人 | 满足 | 满足 | 中国按claimed数量变时段；江户reachedTimes按任务变。没有等待超时或关店惩罚。[C-APP]80、[E-TIME] | P3；各自维护 |
| T02 回看已达时段 | 未做 | 满足 | 中国只有自动time标签，没有时段菜单；纸铺“近景”只改画页，不是场景细看。江户保存timeChoice，可重返已达朝/昼/夕 | P2；Codex（时段菜单如原中国规格要求） |
| T03 时段改变画面/声音与画页 | 部分 | 满足 | 中国[data-time]滤色，声音不随位置/时段变，画页不记录独立时段；江户场景滤色、音场与写生页tod。原创时段效果，不称真实历史光照 | P2；Codex；江户维持 |
| L01 足够长、连续移动与按需加载 | 满足 | 满足 | 中国24000×1200/20瓦片、江户14000×700/14段，均20:1；[C-LAYOUT]、[C-PAINT]、[E-STREET]。不是只改总宽变量，有逐段图片 | P3；各自维护 |
| L02 定位导览、端点与文字替代 | 满足 | 部分 | 中国8站导览+章节+完整文字环境列表；江户nearby/完整文字列表能定位，但无中国式全卷8站导览。若“卷轴进度与地标定位”要求显式总进度，江户仍应补更直观入口 | P2；Claude；不直接复制中国地名 |
| L03 每段独特地标/可参与细节 | 部分 | 部分 | 多种行业/建筑与观察点已分布，但没有逐段验收表证明“每段至少一处、每2–3段一件小事”全覆盖；中国两端仍有长段纯景。江户7写生扩展参与范围；勿把全部段落截图等同内容密度验收 | P2；Codex补中国、Claude补江户分段清单 |
| L04 接缝、落脚、2×细看 | 部分 | 部分 | 原有修复与脚底/热区测试存在，江户0/1已补画、8类路人各一次。中国无场景2×模式、江户2×仍糊；两作未达到原生2×标准、未有真机全卷签收 | P2；Codex美术/Claude接入与验收 |
| V01 隔离存档、拒绝另一作/未来版本 | 满足 | 满足 | 命名空间、worldId与版本检查；China v3迁移v0/v1/v2，Edo v1且未来档只读。[C-GAME]105、[E-SAVE]28 | P3；各自维护 |
| V02 自动保存、导入失败保留现档 | 满足 | 部分 | 中国严格页/任务/账本校验、错误不替换；江户同版本未知pageId可导入，打开画册白屏，见F01。不是跨作防线失效，是同作内容校验不足 | **P1；Claude** |
| V03 损坏原档备份成功前不得覆盖 | 满足 | 部分 | 中国saveBlocked直至显式备份/有效导入；江户备份失败仍返回corrupt且允许后续persist，见F02 | **P1；Claude** |
| V04 存储不可用仍可玩且告知 | 满足 | 部分 | 中国写失败提示手动导出；江户可在内存玩，但App忽略persist=false，未给出可靠未保存状态。设置说明跨设备不自动迁移。需补写失败反馈 | P2；Claude |
| H01 系统图片/链接分享、取消可恢复 | 未做 | 部分 | 中国main仅PNG，PR138才有分享/复制与回退；江户原生分享/文件能力检查/取消分支已有，canShare抛错未兜底，见F04。不能将PR138当main | P2；Codex依138决策、Claude修江户异常 |
| H02 分享链接不带钱包/奖励/存档 | 不适用 | 满足 | 中国main未有公共链接分享；江户只作品base+scene=nihonbashi，未知scene温和回到开始，分享不发奖。[E-JOURNAL] | P3；China138在草稿单列 |
| A01 声音手势开启、后台停、静音可玩 | 满足 | 满足 | 中国默认静音+configure/pause；江户首次手势unlock、visibility、各bus0、对应文字；[C-AUDIO]、[E-SOUND]。此“满足”指实现，不代表iOS硬件开关已验收 | P3；各自维护；真机由Claude统筹 |
| A02 地点/时段音场、操作声与音乐留白 | 部分 | 满足 | 中国只有均一水声/轻铃、两个音量；江户三通道、稀疏事件、8秒空隙、钟后14秒。呼声因用户嫌嘈杂主动撤下，应尊重最新反馈，不作为必须恢复的缺口 | P2；Codex先确认中国声音范围；江户不重做 |
| A03 时钟每访问每时段一次、无声文字提示 | 不适用 | 满足 | 江户App bellRung去重、加载不响、timeBell受音量控制；PR139/142及63测试。中国无该声音承诺 | P3；Claude维持 |
| X01 大字150%与减少动态 | 满足 | 满足 | 两作均有设置+系统reduce-motion，当前360/390设置页无整页横溢；中国城门全流程新复验。未宣称全横屏/所有语言字体矩阵通过 | P3；Codex/Claude |
| X02 面板焦点、Escape与返回焦点 | 满足 | 部分 | 中国原生dialog+showModal/Escape/触发控件恢复；江户设置role=dialog但不移焦/约束焦点/Escape无效，见F03；不代表江户所有键盘玩法不可达 | P2；Claude |
| X03 屏幕阅读器、语义/对比度 | 部分 | 部分 | 文字路径与名称存在，无VoiceOver/TalkBack或完整WCAG审核证据；中国SVG装饰隐去，江户role=application仍需实际读屏检查。不能用Tab走通代替读屏验收 | P2；Claude统筹基准设备，Codex修中国发现 |
| M01 完成/导出/分享等研究计测 | 未做 | 未做 | main两应用无独立研究事件采集；根站记录器不等于子应用覆盖。PR138只有中国的本机内存研究日志且尚未合入；无江户等价接口 | P2；Codex提中国口径、Claude提江户；先明确目的再接统计 |
| M02 真人试玩、留存/购买证据 | 未做 | 未做 | 无本轮有效样本/销售数据；自动化不会变成真人完成率。不得把兴趣样品当预售 | P2；所有者安排参与者，Claude统筹记录 |
| G01 固定脚本与可选AI分离 | 满足 | 部分 | 中国明确纯本地脚本，无AI即兴承诺；江户固定选题/脚本fallback/服务端限额与清洗存在，README称生产未配置模型；本轮未读取密钥或调用生产模型 | P2；Claude/SRE确认配置和真实回退 |
| G02 AI等待/取消/不改进度 | 不适用 | 部分 | 江户UI600ms等待提示、取消、中止、只返回文字，不授予物品；客户端10s/服务端默认9s，与注释“~8s回退”不完全一致。需按原完整规格统一预算 | P2；Claude；不替中国新增AI |
| C01 共用契约/引擎与按作隔离 | 部分 | 部分 | 中国用packages/scroll-contracts但wallet:number/journal:string[]；江户自己的contract为wallet对象/journal对象、状态词不同，无适配层。隔离已满足，共同契约尚未确认，scroll-core未抽取不应为了抽象强行改任务 | P2；Codex提对照/适配、Claude确认 |
| C02 双作路由与根/子域名构建 | 满足 | 满足 | 独立Vite、相对base与服务端子应用路由，根站8条qingming-web测试；CI含EDO_BASE=/。真实子域名DNS/跨origin迁移并未因此自动完成 | P3；Claude/SRE |
| C03 素材、史料与虚构标记 | 部分 | 部分 | AI原创/合成声/系统字体、fiction/balance有台账；中国最新长卷/杜叔/阿芦来源散在多个交付目录，江户readme部分旧状态矛盾，统一台账需更新；不宣称器物逐件考据完毕 | P2台账/ P3深考据；Codex/Claude |
| C04 真实支付/数字赠礼领取 | 不适用 | 不适用 | 当前main无此销售承诺，用户新方向在PR138内部样品；没有支付/权益后端，不应为了规格复审开真收款或把计划列为已售 | P3研究；Codex方案/Claude后续统筹 |

代码证据索引在文末；“满足”不覆盖下一节单列的真机条件。

## 新复现问题（未修复）

### F01 · P1 · 江户同版本未知画页导入后白屏

[E-SAVE]49–50只校验pageId/compositionId为字符串，不校验目录与配对。通过真实设置文件导入一个由newSave生成、但pages含`unknown-page/unknown-composition`的合成存档，UI显示“記録を読み込みました。”，随后开絵巻帳触发[E-PNG]50的`[...title]`，`title`是undefined，抛`title is not iterable`，React根节点清空。

证据：[browser.json](evidence/browser.json)的edo_unknown_page、[白屏](evidence/edo-unknown-page.png)、[复现脚本](evidence/browser.py)。没有使用任何真实用户记录。建议Claude在导入/加载前验证已知页ID、合法构图与组合、唯一性等内容约束，失败保持现档；渲染也加可恢复回退。需要用真实文件导入→开画册验证，不能只测JSON解析成功。

### F02 · P1 · 江户损坏存档备份失败后原键仍被覆盖

[E-SAVE]85–92备份setItem异常后，仍返回corrupt+backupKey；[E-APP]51只把newer设为不可写。合成场景：原键为损坏JSON，新增备份键抛QuotaExceededError，但更新原键可成功（对应存储不足时新增失败、较小覆盖仍可写）。打开设置→切换减少动态，就覆盖原键；本地无任何backup键，提示却说已退避。

证据：[browser.json](evidence/browser.json)的edo_backup_failure、[截图](evidence/edo-backup-failure.png)、同一[脚本](evidence/browser.py)。建议区分备份是否成功，失败时阻止自动覆盖并保留原文本，提供用户主动下载/恢复入口；成功前不显示“已备份”。中国现有saveBlocked可供行为参考，不直接跨作套格式。

### F03 · P2 · 江户设置没有模态焦点行为

打开设置后activeElement仍是背景header“設定”；Tab下一项到背景street，insideDialog=false；Escape后面板仍开。鼠标/街景锁定不能代替键盘焦点约束。[E-SETTINGS]58为div role=dialog，[E-APP]未实现统一焦点管理。

证据：browser.json的edo_dialog_focus、[截图](evidence/edo-dialog-focus.png)。建议Claude统一面板/对话的移焦、Tab范围、Escape关闭和触发点恢复；保留明确的文字按钮路线。读屏真机仍需另验。

### F04 · P2 · 江户文件能力探测抛异常时未退回链接

[E-JOURNAL]130的navigator.canShare调用位于try之前。已准备有效画页，令能力探测抛合成异常，点击共有する：canShare确实被调用，share没有调用，出现未处理pageerror，也没有错误回退提示。普通canShare=false仍会走链接，这不是所有设备分享均失效。

证据：[share.json](evidence/share.json)、[脚本](evidence/share.py)、[截图](evidence/edo-share-probe.png)。建议Claude把探测放在保护范围，探测失败仍尝试链接分享，真正share失败再提示保存/复制；该处理在中国PR138已有，可参考行为但不要混合两个契约。

## §19 质量验收与本轮实测

本轮重跑：China46、Edo63、根站488通过，4个笔迹样本测试按已有条件跳过；全量build通过，未运行DB、Docker或部署。代码与main的apps/server/packages无差异。

| 要求 | 中国 / 江户状态 | 本轮证据 | 后续优先级 / 建议负责人 |
| --- | --- | --- | --- |
| 首屏必要资源≤5MB（共同定案） | 满足 / 满足（本地样本） | 冷缓存资源encoded body约3,544,813 /1,131,765 bytes；包括JS/CSS/图片，不含HTML导航体，距5MB有余量。可见段+预取段加载，不是整卷资源总和 | P2真机/CDN复核；Claude/SRE，Codex配合中国 |
| 10Mbps、100ms、CPU4×、3次，中位≤5s | 部分 / 部分 | 中国代理就绪4030/4024/4020ms，中位4.02s；江户2165/2125/2082ms，中位2.12s。**代理指标**为networkidle+入场按钮可用+两帧，不是首个可交互时刻；本地无gzip/Brotli/CDN/线上TTFB | P2；Claude统筹正式协议与设备 |
| 连续拖卷帧耗时p95≤33.3ms/顺畅 | 部分 / 部分 | 旧江户README有20s无头16.8ms记录，本轮没有在基准真机连续2分钟测量；不得将旧短样本算当前长卷正式通过 | P2；Claude统筹，两边修各自发现 |
| 360/390宽、文字150%不遮挡主操作 | 部分 / 部分 | 本轮四种设置页无document横溢出；中国城门全故事/键盘/续玩/PNG重跑无异常；[新结果](evidence/gate-regression.json)。尚未全小游戏×横屏×系统字体遍历 | P2扩矩阵；各自负责人 |
| 保存正确、错误后可恢复 | 满足 / 部分 | 中国原档保护/迁移/首通回放通过；江户F01/F02是新反例，已有63测试通过不能覆盖掉这两项 | P1；Claude |
| 最新接缝与声音的线上/真机验收 | 部分 / 部分 | 历史PNG/WAV与源码/单测可读；Claude0800称141/142所有者认可且已部署。本轮want.world访问403，未独立听线上音频 | P2；Claude/所有者真机验收 |

完整每次资源表/时间/环境见[performance.json](evidence/performance.json)，复跑脚本[performance.py](evidence/performance.py)。无头GPU禁用不模拟手机GPU、内存或温控，测试结果只用于发现回归和估计预算。首屏中国柳枝单图846,620 bytes，四类透明图集共2,245,398 bytes，高于美术定案“人物物件约1MB”的分配目标，虽总额仍≤5MB，后续可分块/压缩；不要为压缩牺牲透明边缘或先假称超出5MB。

## 13条共同美术定案复核

| # / 定案 | 中国 | 江户 | 证据 / 续项 / 优先级与建议负责人 |
| --- | --- | --- | --- |
| 1 细墨线薄淡彩、非几何主场景 | 满足 | 满足 | 实际WebP主场景；SVG图标/简笔画册不伪称精绘。P3各自维护 |
| 2 纸/墨/朱色板 | 部分 | 部分 | CSS/台账有目标色板，AI图片未做全卷定量/人工一致性签收。P3 Codex审美、Claude接入 |
| 3 斜俯视、水平长卷、可自然弯折 | 满足 | 满足 | 多段实际图与世界水平坐标；不称测绘地理。P3各自维持 |
| 4 主要人物90@700与脚底锚点 | 满足 | 满足 | China PERSON_HEIGHT=1200×90/700、atlas锚点；Edo sprite90与SPOTS。默认主角尺寸符合，真机逐脚底目视仍待。P3 |
| 5 云霞薄染、无大片实色金云 | 部分 | 部分 | 已有朝夕审阅图和薄天空，未重新逐段签收全部云边。P3 Codex审美复看 |
| 6 独立远景层 | 未做 | 未做 | 中国底图混远/中景；江户far层为纸底，远屋在主图；有layer名字不等于远景资产。P2 Codex素材/Claude接入 |
| 7 背景无路人、独立透明人群 | 部分 | 满足 | 中国新增长卷含烘焙人物，原区14路人复用6主角；江户运行路人8类各一次、主图与人物分开。不因此擅改最新明确要求保留的烘焙人物。P2 Codex提后续方案、Claude统筹 |
| 8 每人三姿态、透明同尺度 | 部分 | 满足 | 两作既有6人三姿态；中国新增杜叔/阿芦仅对话单立绘（新任务只要求所需立绘），若按全角色三姿态标准仍缺。P3 Codex评估，不阻断城门验收 |
| 9 生成图无文字、文字独立层 | 部分 | 部分 | 题签/落款/主要标签为代码文字；未逐张验全卷背景伪字/残字，不把自动生成当人工校对。P3各自美术 |
| 10 1128×700余量/2256×1400原生2×、接缝 | 部分 | 部分 | 运行中国1024瓦片/1200单位、江户1400×980/1000×700；真实源尺寸未达定案原生2×，局部修补非全卷高清重制。P2 Codex原图/Claude重生成 |
| 11 首屏≤5MB与解码记录 | 部分 | 部分 | 总下载预算本样本通过；中国图集分配超约1MB目标、两边无基准真机峰值解码内存记录。P2各自优化，Claude统筹量测 |
| 12 工具来源/互审/实际alpha | 部分 | 部分 | 来源与透明素材/补画记录存在，最新中国资产台账需汇总，未有每批完整互审签收索引。P3 Codex/Claude各补自己 |
| 13 共用风格、文化各自创作 | 满足 | 满足 | 人物/服饰/建筑/物件内容独立，原创虚构声明与史料参考分开；不据此宣称器物史实已逐件审过。P3 |

## 未验证范围（不可写成“已通过”）

- 真实iPhone/Safari、Android/Chrome、微信内置浏览器、旋转/横屏、系统字体差异、低内存与温控。
- iOS硬件静音开关、通话/后台/耳机切换后恢复、耳听的长时间音量和声场；代码ambient音频会话不是硬件验证。
- 硬件系统分享面板的用户手势、取消与接收；图片确实进入相册、朋友实际收到、跨origin真设备迁档。
- VoiceOver/TalkBack、对比度、所有面板焦点/缩放矩阵、小游戏完整读屏。
- 当前发布哈希、CDN缓存与生产可用性（本会话CONNECT403）；Claude回执与所有者试玩应另签收。
- 最新完整规格原文及基准设备定义、正式首屏就绪/帧时协议；本地近似测量不替代§19最终验收。
- 5–8位成人或15–20位商业研究样本、留存、真实支付意愿/订单。未把开发样品或自动化事件当真人。
- 新域名DNS、经营主体、定价/税务、真实支付、权益恢复/退款/赠礼并发领取：本轮不属于上线工作。

## 建议执行顺序

1. Claude优先认领F01/F02，修复江户存档保护并补覆盖真实UI触发的回归；这与声音/街景无关。
2. Claude处理F03/F04、写失败提示；Codex可按后续认领配合中国对照。无需回滚已验收声音/接缝。
3. Claude补存完整原规格、更新README过时状态；双方对齐公共契约/各世界计测口径。PR138继续draft，研究和销售另行决定。
4. 共列真机验收表与负责人，再排全卷内容密度、原生2×和远景素材。普通取舍由两边直接协作，不为报告中的每个部分项向所有者逐项求确认。

## 代码证据索引（固定于审查SHA）

- [C-GAME](../../../apps/qingming-china/src/game.ts)：状态、奖励、迁移、校验；[C-CONTENT](../../../apps/qingming-china/src/content.ts)：14页与环境；[C-APP](../../../apps/qingming-china/src/App.tsx)：面板、小游戏、时段、设置；[C-EXPORT](../../../apps/qingming-china/src/export.ts)：PNG；[C-AUDIO](../../../apps/qingming-china/src/audio.ts)。
- [C-LAYOUT](../../../apps/qingming-china/src/layout.ts)、[C-PAINT](../../../apps/qingming-china/src/PaintedArt.tsx)、[C-WALKERS](../../../apps/qingming-china/src/walkers.ts)。
- [E-WORLD](../../../apps/qingming-edo/src/content/world.ts)、[E-SCRIPT](../../../apps/qingming-edo/src/content/script.ts)、[E-STATE](../../../apps/qingming-edo/src/engine/state.ts)、[E-TIME](../../../apps/qingming-edo/src/engine/time.ts)。
- [E-APP](../../../apps/qingming-edo/src/App.tsx)、[E-STREET](../../../apps/qingming-edo/src/scene/Street.tsx)、[E-SAVE](../../../apps/qingming-edo/src/engine/save.ts)、[E-JOURNAL](../../../apps/qingming-edo/src/ui/Journal.tsx)、[E-PNG](../../../apps/qingming-edo/src/scene/PageArt.tsx)。
- [E-SETTINGS](../../../apps/qingming-edo/src/ui/Settings.tsx)、[E-WRAP](../../../apps/qingming-edo/src/ui/Wrap.tsx)、[E-SOUND](../../../apps/qingming-edo/src/engine/sound.ts)、[E-TALK](../../../apps/qingming-edo/src/ui/Talk.tsx)。
- [共同契约](../../../packages/scroll-contracts/index.ts)与[江户契约](../../../apps/qingming-edo/src/contract.ts)；[服务端即兴路由](../../../server/src/app.ts)177–195及[过滤/预算](../../../server/src/edo-talk.ts)。
- [China测试](../../../apps/qingming-china/src/game.test.ts)、[Edo测试](../../../apps/qingming-edo/src/engine/engine.test.ts)、[Edo声音测试](../../../apps/qingming-edo/src/engine/sound.test.ts)、[CI](../../../.github/workflows/ci.yml)。
