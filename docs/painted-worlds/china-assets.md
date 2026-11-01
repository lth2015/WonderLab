# 汴河拾光 · 内容与素材台账

| 项目 | 来源 / 路径 | 使用与依据 |
|---|---|---|
| 河岸底景、六人三姿态、船、柳枝、小物 | `apps/qingming-china/public/art/china/*-v1.webp` | 内置 imagegen 生成的原创精绘，透明图集保留 alpha，未使用馆藏高清图。提示词、实际尺寸和局限见 [精绘接入记录](art/china/README.md)。 |
| 画册与图标 | `apps/qingming-china/src/Art.tsx` | 原创 SVG；个别画页复用绘画基元，使用不同题意、构图或配色 |
| 纸张细纹 | `src/style.css` 内嵌 SVG 噪声 | 程序生成，无外部纹理 |
| 环境声、互动声 | `src/audio.ts` | 原创 Web Audio 合成；默认关闭，不含录音或采样 |
| 字体 | 设备自带 Songti SC / STSong / SimSun 等衬线字体 | 不分发字体文件；实际字体随设备变化 |
| 人名、对白、微故事、画册文字 | `src/content.ts`、`src/App.tsx` | 原创虚构（fiction），非张择端生平或史实复原 |
| 钱包、价格、奖励 | `src/game.ts` | 游戏平衡假设（balance），不声称宋代物价 |
| 原作背景参考 | [故宫博物院：张择端清明上河图卷](https://www.dpm.org.cn/collection/paint/228226.html) | 2026-10-31 阅读核对：北宋张择端、淡设色长卷、汴河两岸、虹桥为水陆交汇生活场景。未下载其高清图、图片或文字素材用于游戏。 |

本次未进行商用名称、发行地区、字体或第三方商标的法律核查。试玩构建不声称与故宫博物院有合作关系。原始策划文件位于用户 Downloads，未自动复制到 Git 或公开站点。
