# 中国篇本机会话事件 v1

来源 src/study.ts。每次页面加载是一段独立会话，刷新清空；不生成持久用户标识、不写分析localStorage、不上传。world_id 固定qingming-china，环境来自构建MODE，开发/测试/生产不得混算。测试文件环境为test；内部夜归只在development运行。

每项包含 event_id、schema_version=1、occurred_at（ISO时间）、environment、world_id、build_id、type。event_id仅标记事件，不是人物身份。事件最多1000条，超出时丢最早项并在snapshot.dropped声明；dropped>0的日志不能当完整漏斗。snapshot是副本，调试接收器异常不影响游戏。

| type | 关键字段/口径 |
| --- | --- |
| world_entered | source=direct/journal；首个可操作挂载一次，未知source折为direct；不带原URL |
| first_interaction_completed | interaction_id=paper/boat/purse/harbor/tea/observation，elapsed_ms；有效进展（如压纸、正确系一绳、唯一环境观察）一次；普通点菜单不算 |
| story_completed | story_id=paper/boat/purse/harbor/night-lantern，first_completion；从非完成到完成；载入/导入旧进度不补记，回放完成可重记但first=false |
| journal_export_attempted | page_id白名单、export_type=png；用户请求保存，每次均可计 |
| journal_export_completed | page_id、export_type=png、stage=download_requested；PNG已生成且触发下载请求，不宣称已存相册 |
| share_attempted | page_id、method=system/link；每次主动调用 |
| share_result | method、result=invoked/cancelled/copied/unavailable/failed；invoked仅系统API已完成，不等于接收者收到 |
| offer_viewed | product_id、offer_version、placement=album/summary；卡片简介至少50%可见，每会话/版本/位置一次 |
| interest_registered | product_id、offer_version；明确按兴趣按钮，每会话/版本一次，重复点击只反馈已记录 |

当前不发 checkout_started/purchase_confirmed/paid_content_started：没有真实结账或支付确认。未来purchase_confirmed须可信服务端发出，客户端成功页不发。自由文本、身份、邮箱、原URL/fragment、钱包与存档内容不在事件字段中；额外字段丢弃，非法值拒收。

设置→导出本次体验记录可把本机日志交给研究者；用户自行决定是否交付。JSON默认不含session用户ID，多份文件的“会话数”由研究者按一次完整测试文件计，不能把事件id当访客id或跨刷新追踪。

首轮指标：
- 有效互动率：有first_interaction_completed的完整会话 / world_entered的完整会话。
- 故事完成率：有免费story_completed且first_completion=true的会话 / 进入免费篇的完整会话；结合观察表标注读档/复访，日志本身不能识别同一个人或自动区分复访。
- 画册导出率：至少一次download_requested的会话 / 至少生成过画页的符合条件会话。导出次数另列，不混用人数。
- 内部续篇兴趣：同环境、同build、同offer_version，且观察表确认已完成规定免费流程并看到卡片的研究会话中，有interest_registered的会话 / 满足上述条件且有offer_viewed的会话。album/summary曝光在会话级合并去重，不把两处曝光当两人。
- 内部sample/night-lantern回放、开发自动化和人工体验分开，不把样例完成算免费故事完成或付费使用。自动化JSON只用于验证字段，不作为用户研究样本。

createStudy(environment,buildId,receiver)提供可选同步本地调试接收器，接收的是副本；默认实例不绑定网络服务。需要接外部统计时另选服务、目的/同意和留存方案，本轮未接。

