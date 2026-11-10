# PR147独立复验

实际审查头：refs/pull/147/head = cee4295ef7fae50cc4df86ff5809916375e5115f，测试后重新fetch仍一致；没有读取旧主线当修复结果。独立codex/review-edo-147分支，仅检查，不改Claude代码。Edo66测试与独立构建通过。

原复现已复验：
- F01真实导入unknown-page/unknown-composition的同版本文件被拒绝，原档完全不变，开画册不白屏。
- F02新增备份键抛QuotaExceededError、写入成功但读回mismatch两种情形均保留原键；改设置仍不覆盖；原文本主动导出内容一致；明确选择覆盖后才开始新档。
- F03设置打开主动移焦，35次Tab及5次Shift+Tab不出面板，Escape关闭、返回触发设置按钮。
- F04能力探测抛异常后仍调用仅链接分享，URL不带存档，无未处理pageerror。
- V04写入失败时提醒可继续玩并主动导出，通过。

剩余P2：V04当window.localStorage本身的getter抛SecurityError（可见于存储被阻止）时，storage()返回null，setSave走memoryStore，persist(no-op)返回true，于是没有未保存提醒。实际合成浏览器复现见result.json的V04_getter_notice=false与storage-getter.png；游戏可玩，不是再次丢失已存在原档的P1。建议Claude在storage不可用时同样只提醒一次，不能把内存no-op当持久化成功。

菜单Escape与小游戏显式按钮的界限可接受当前修复：原P2针对菜单的焦点；未把小游戏自带退出按钮当缺失。后续统一Escape和对话.sheet焦点可另列无障碍完善，当前测试不冒称覆盖全部读屏或真机。

所有模拟原档为合成字符串，无用户资料。脚本、结果、截图在本目录。此为本地Chromium复验，不代表线上部署或硬件分享验收。
