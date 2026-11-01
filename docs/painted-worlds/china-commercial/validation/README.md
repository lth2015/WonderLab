# 本轮验证记录

基线 main 6b6e88c（含141/142），合入独立城门故事452ced2，代码分支 codex/china-commercial-study。截图和JSON都是自动化的独立测试浏览器所产，不是真人研究结果；测试替身只用于系统能力结果分支，不代表系统面板或接收者实测。

通过：

- 中国篇59项（含城门6项、商业边界7项、纪念品6项），江户63项。
- 根站488项通过，4项笔迹数据集因缺样本跳过。数据库与Docker未执行，本轮未改这些组件。
- typecheck、完整build（含主站/edo/qingming）和中国独立build均通过。
- browser.py：从新存档入画，文字探索到小柳，压纸并选桥上人间/近景/河上清风，完成第一条故事。保存实际1440×1800 PNG，见postcard-bridge.png；它是独立排版，非界面截图。
- 系统share/canShare和clipboard替身：带PNG分享的调用、取消、复制成功；取消前后存档一致。另一路不支持系统分享且拒绝剪贴板，给出保存与手动复制回退。
- 实际将canvas.toBlob回调设null使图片生成失败，显示重试且画页未丢；恢复真实toBlob后重试成功。初次脚本因Playwright把返回的原生函数当调用而报Illegal invocation，修正测试脚本为不返回赋值结果后重跑完整流程成功，此为测试辅助脚本问题。
- 夜归内部试样：错选、改选、完成与回放均走通，未改变免费存档/文钱。兴趣点击两次只一条事件；试样回放first_completion依次true/false。
- 进入周伯理绳，正确系第一根；鼠标拖动画卷不会打开人物，刷新后绳索进度保留，读档不补记故事完成。
- 390×844、150%大字下无整页横向溢出；Chromium移动/触摸模拟通过CDP触摸拖卷，未误开面板，面板上的触摸不带动背景。
- session-events.json中world_entered/first_interaction/interest各一次，重复分享/回放按真实尝试保留；pageerror=0，无第三方请求。环境为development，不能用作真实用户漏斗。
- 两个生产静态构建：子路径/qingming/和独立根路径页面、资源、14页画册与v3存档通过；night-return/souvenirs两种研究查询均不显示研究内容，商品标题也不进入生产JS。最新见keepsakes/production.json，旧production-paths.json为早期烟测记录。

未验证：

- 真实iOS/Android设备、硬件系统分享、相册落盘、系统取消差异、实际微信内置浏览器、跨origin真设备存档转移。
- 新域名DNS、线上发布、真实购买/退款/恢复、付费资源保护、经营地区/定价适配。
- 续篇正式新美术、30–60分钟体验时长、15–20位真人观察、任何销售或付费意愿证据。

复跑浏览器验证：先在仓库根启动npm run dev:qingming，再在已有Python Playwright与/usr/lib/chromium/chromium的Linux云环境运行本目录browser.py。输出写/workspace/.cloud-setup/china-commercial，不自动覆盖本目录交付物。普通npm test不依赖这套浏览器环境。

2026-11-01纪念品补充：keepsakes/browser.py以实际设置导出JSON读取同一应用的记录，避免Vite HMR版本化模块造成测试读取另一个内存实例。三款各导出自用/赠友PNG，文件/链接分享、取消、手动复制、朋友新浏览器与真实canvas失败重试通过；兴趣重复点击只有一条，无购买事件、无免费存档变化。结果与截图见keepsakes/。gate-regression.py是合入商业化后再次验证城门的脚本，键盘保存前等待异步预生成按钮可用。
