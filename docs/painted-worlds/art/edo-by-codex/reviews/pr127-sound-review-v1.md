# PR127 声音双轴复审 · 2026-11-01

固定比较：`git diff 56724a564b1193eced4bb6d8ec76cba467342146...3856eddf5fe43607540416c89176dfd68cdd9f57`。仅复审，没有修改江户声音实现。两轴独立报告，不将一轴通过视为另一轴通过。

## Standards

发现两项 P2：

1. `engine/sound.ts:87–95,415`：创建总线的 GainNode 默认增益1，`buildBeds`已经启动声音，之后才以 `setTargetAtTime(0,t,.05)`渐消。存档三音轨全部「切」时也不是从0开始。应先把总线设为保存音量平方，再连接和启动，运行中的音量调整才渐变。[W3C GainNode](https://www.w3.org/TR/webaudio/#GainNode)、[MDN setTargetAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime)。
2. `engine/sound.ts:61–63`：中断后若 Context 保持 `interrupted`，后续手势只检查 `suspended`，不会调用 resume，而 cue 又拒绝非running。应补中断态恢复并处理恢复失败。[MDN iOS中断态恢复](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state#resuming_interrupted_play_states_in_ios_safari)。假context可证当前控制分支不恢复，但不等于已在具体机型复现系统中断。

首次交互前不创建Context，隐藏页有暂停路径，故事与奖励不依赖声音成功。真机听感与旧Safari仍待验。

## Spec

发现一项 P2：保存全静音后首次操作存在短促漏声风险，原因同增益初始化问题，不符合「切」的静音语义。

iOS `ambient`方向符合[WebKit工程师对默认环境音会受静音开关控制的说明](https://bugs.webkit.org/show_bug.cgi?id=237322#c6)，没有发现代码主动绕过静音开关。必须保留真机验证边界，不能把API存在等同硬件已验。

另有未确认风险：App.tsx仅监听pointerdown和keydown，而[WebKit用户激活说明](https://webkit.org/blog/13862/the-user-activation-api/)对触屏列pointerup/touchend；首次触屏能否立即解锁需要真机核查。此项未列为确定缺陷。无声时故事动作、画面反馈和奖励仍可完成。

Standards 2项、最高P2；Spec 1项、最高P2。共同问题分别保留在两轴，不重复计算成两次实际修复。

## 可重复验证

在仓库根执行（需本仓库已有 esbuild 依赖）：

```sh
node docs/painted-worlds/art/edo-by-codex/reviews/pr127-repro.cjs
```

或指定 `WONDERLAB_REVIEW_REPO` 到包含固定SHA和依赖的仓库。脚本直接 `git show` 固定版本，在内存转译后用假AudioContext执行，不读取.env或密钥。

实际输出（退出0）：

```text
PASS: before unlock, AudioContext count = 0
CONFIRMED BUG: first bed start bus gains = [1,1,1]
CONFIRMED BUG: bus value/set/target operations before first bed start = 0
CONFIRMED BUG: only later apply() schedules 3 gain targets at 0 with timeConstant = 0.05s
ENVELOPE: muted bus at 20ms = 0.670320
CONFIRMED BUG: unlock() with state=interrupted leaves resumeCalls = 0
```

这验证控制流和参数包络，未渲染音频、未测实际响度、未做iOS真机测试。它不证明每台设备都一定听到同样长度/响度，也不证明每种Safari版本都会停在interrupted。缺陷及修法已先发共享信箱，请Claude认领声音修正。
