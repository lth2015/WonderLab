# 中国篇：时段回看与本机试玩记录

基线 main e4af02a；按collab1010分工，独立于商业化PR138，不包含商品、研究样品、真实支付或分享UI。新增主界面“春日”按钮，可回看已达晨光/日和/暮色，默认“随故事流转”。仍按已完成故事数0/1/3解锁，已完成账本在重逢时不变，因此回放不丢时段，也不重复发钱。未达时段禁用，导入未达时段设置时显示实际已达时段。

可选设置timeChoice加入现有v3存档：旧档缺此项补auto，既有v0→v1→v2→v3迁移及ID/画页/奖励不变，未知时段拒绝导入。时段没有倒计时、关店或错过惩罚。

## 试玩记录

设置→本次试玩记录与隐私→导出本次试玩记录。仅本机内存、最多1000事件，超出丢最早项并报告dropped；不写分析存储、不上传、不生成持久访客ID，不记私聊、身份、存档内容、原URL或异常文本。session_id是每次页面加载随机的会期标识，刷新换新；不是跨访问追踪。主动导出是下载请求，不代表已上传给组织者。

基础字段沿用138的event_id、schema_version=1、occurred_at、environment、world_id、build_id、type，增加临时session_id与事件elapsed_ms便于两作汇总。环境来自MODE，build_id来自可选VITE_QINGMING_BUILD_ID（默认unversioned，不可把未标版本的样本混算）。本次没有合并138的商业事件，后续138需保留这些基础字段并合并其DEV扩展。

| 事件 | 固定字段与口径 |
| --- | --- |
| world_entered | source=direct/journal；作品App挂载一次，计时从记录器本次初始化开始，不是玩家按入画按钮的耗时，正式30秒口径须两作统一 |
| first_interaction_completed | interaction_id=故事ID/tea/observation，elapsed_ms；首个有效步骤/正确绳索/配茶/唯一环境观察，每会期一次，打开普通菜单不算 |
| story_started | story_id；首个有效故事步骤，船是第一条正确绳索；重复绳索不再记，重逢重新开始会再记 |
| story_completed | story_id、first_completion；实际完成状态转换，重逢false；载入/导入/重置不补记开始或完成 |
| journal_opened | page_count；每次主动打开画册（包括从画页返回）记一次，锁定页提示不算 |
| journal_export_attempted | page_id白名单、export_type=png；主动保存画页 |
| journal_export_completed | 同上、stage=download_requested；生成成功且请求下载，不声称已落相册 |
| revisit | has_progress=true；本次启动读到有效已入画/实际进度的旧档时一次，不在导入时记；可判断带档回访，不能识别唯一真人或跨设备留存 |
| error | code固定为save_read_failed/save_write_failed/save_import_failed/postcard_export_failed/audio_failed/unexpected_error；不带原异常、路径、文件名或堆栈；启动/写入/音频/意外错误每会期各一次，主动导入/导出失败按尝试记 |
| share_attempted / share_result | 与138保留同名及system/system_link/link结果枚举；当前main没有分享按钮，本分支不伪造分享事件、不扩大138范围 |

记录器接收副本，可选调试接收器抛错不影响游戏；生产没有外部接收器。确定性行动在React状态更新器外提交并观察，避免StrictMode重复执行更新器导致事件重复；替换存档只替换，不观察故事进度。

## 验证

China52项通过（原46+6项，覆盖时段越权/旧档/回放/真实转换/隐私/截断）；typecheck、全量build、根站488通过/4缺样本跳过。浏览器脚本与实际从设置导出的JSON见evidence/：

- 新会期入场/首次互动各一次，纸铺首通与重逢first_completion=true/false，钱包仍72文。
- 两次画册打开、真实PNG成功请求/实际canvas失败、固定错误码；刷新新会期并记录revisit，不补完成；导入已完成v3缺新设置的旧档也不补开始/完成。
- 时段晨→自动暮→回晨，刷新保留；未达暮禁用；时段选择/导入/重逢不改变奖励与画册。
- 360/390宽、150%大字、键盘选择，无整页/面板横溢；不新增localStorage键，无外部请求/页面异常。
- 写存储失败与坏文件导入固定码，不把合成私密字符串带入导出记录。

未替代真机、真人试玩或硬件相册验收。部署与PR由Claude统筹；后续乡野第15页另分支交付。
