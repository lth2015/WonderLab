# Wonderful World · iOS 开发任务书（交给 Codex）

> 2026-10-25 · 状态：待实施。参照 02 §13、03 iOS 补充和 ios-acceptance.md。Web PoC 与真实笔迹采集仍是当前主线；iOS 工作不得破坏现有功能。

## 目标与技术方案

- 将现有 React + TypeScript + Three.js / Vite 应用通过 **Capacitor** 构建 iOS 应用；业务核心、世界状态、笔迹识别、AI 指令 schema 与 Web 共享。
- iOS V1：无账号首笔、一笔化鱼、画圆生月、写给鱼的话、离线本地交互、世界保存、图片保存、系统分享；视频导出以真机可行为发布门槛，失败则仅宣传图片保存。
- 未来商业化：预留权益接口与 StoreKit 集成边界；**本次不实现购买、订阅或价格**。任何数字商品支付方案需在上架前核查当时 Apple 日本区规则，不直接复用 Web Stripe Checkout。
- 发布主体：日本个人开发者账号；App Store 可能公开法定姓名。另行核实 trader 信息披露、支持联系方式、税务及隐私政策，绝不承诺家庭住址等信息一定不公开。

## Codex 任务拆分

### IOS-01 · 技术预检与依赖隔离
- 盘点 Three.js/WebGL、Canvas captureStream、MediaRecorder、Web Audio、localStorage、Pointer Events、分享/下载和权限在 iOS WKWebView 的实际支持情况，形成兼容性表。
- 选择与当前 Vite/React/Node 兼容的 Capacitor 稳定版本，记录版本锁定及升级风险；不要盲目更新所有依赖。
- 创建独立的 iOS 入口/适配层，不在渲染循环中引入原生桥调用；保留 Web 运行方式。

### IOS-02 · Capacitor 工程
- 添加 Capacitor 配置、iOS 工程、npm 脚本和 README 本地构建步骤；配置唯一 Bundle ID（正式值待 Apple 账号确认），应用名 Wonderful World。
- 支持 Xcode 签名与模拟器构建；签名证书、密钥、Provisioning Profile、Apple ID 及私有环境变量不提交仓库。
- 首屏使用打包的本地资源启动，不能依赖远端网页加载；网络不可用时核心绘画仍可用。

### IOS-03 · 原生能力适配
- 统一抽象保存与分享接口：Web 使用现有逻辑；iOS 优先系统分享/文件或相册保存，按需申请权限，取消和拒绝要有明确退路。
- 对世界状态采用可靠持久化机制，定义版本迁移、写入失败和后台/进程重启恢复策略；避免仅依赖未经验证的 WebView 存储持久性。
- 触觉反馈可关闭，尊重系统偏好；音频激活与中断遵循 iOS 生命周期。

### IOS-04 · iPhone 交互与性能
- 校验 safe area、刘海/Dynamic Island、Home Indicator、软键盘、画布尺寸、触控坐标、边缘手势、前后台切换与横竖屏行为。
- 使用真实 iPhone 验证 Pointer Events、画笔延迟、鱼群帧率、热状态、资源释放和音频；按设备记录证据。
- 确保笔性快慢仍按归一化特征判定；周一真实笔迹校准数据与 iOS 实现保持同源，不另造阈值。

### IOS-05 · 商业化与合规基础
- 预留平台无关的 entitlement / feature-gate 接口，但不引入假订阅或强制登录。
- 编制 App Store Connect 元数据清单：法定销售者姓名、支持邮箱、隐私政策 URL、支持 URL、年龄分级、内容版权、App Privacy、第三方 SDK、加密出口合规、AI 数据处理说明。
- 确认日本个人开发者在目标销售地区的 trader/联系信息展示义务；优先使用业务邮箱，必要时合法合规地安排业务联系地址，不填写虚假信息。
- 对未来 IAP/StoreKit、购买恢复、服务端交易验证、订阅管理与退款处理只做设计预留；实施前重新核对 Apple 审核规则。

### IOS-06 · 测试与交付
- 添加平台适配层单元测试；保留 npm test、npm run typecheck、npm run build 全部通过。
- 提供可重复的 Xcode 构建步骤、TestFlight 提交流程和故障排查文档；至少完成一台真实 iPhone 的端到端测试后才宣称可用。
- App Review Guideline 4.2 风险：原生体验必须提供实际价值（系统保存、分享、持久化等），不得把远程网站简单包壳后提交。
- PR 附构建结果、设备/iOS 版本、截图或录屏、已知问题、权限/隐私说明；未真机验证的功能必须标记待验证。

## 交付顺序

1. IOS-01/02：技术可行性 + 可编译 iOS 工程。
2. IOS-03/04：真实 iPhone 上完成完整创作与保存。
3. IOS-05/06：合规材料 + TestFlight + 发布候选。

## 不做

- 不重写 Three.js、不开发 Android、不接入收费、不增加账号系统、不新增未经验证的 AI 生成功能。
- 不把模拟器通过视为真机通过；不绕过隐私披露或苹果审核要求。

## Codex 执行指令

请先阅读 docs/02-product-design.md §13、docs/03-ux-ui-design.md iOS 补充、docs/ios-acceptance.md 和当前 package.json。按 IOS-01 → IOS-06 分阶段实现；先提交技术预检与最小 Capacitor 工程 PR，不要一次性大改核心渲染。所有改动保持 Web 可运行，运行现有测试与构建，清楚报告未能在真实 iPhone 验证的部分。不得提交个人笔迹数据、签名密钥或账号资料。
