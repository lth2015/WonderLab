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

## 水磨动态分层（2026-11-01）

| 素材/图层 | 来源 | 使用与依据 |
| --- | --- | --- |
| `public/art/china/watermill/backplate-v1.webp` | imagegen 以现有原创 `scroll-16.webp` 为参考，局部移除轮子和落水，补回磨房木墙/石基/河面；保留局部裁片并做边缘 alpha 融合 | 340×356 透明补画；只覆盖轮后局部，不替换整张长卷 |
| `public/art/china/watermill/rotor-v1.webp` | imagegen 参考原瓦片生成正面完整木轮，保留辐条间真实透明；预处理为椭圆，运行时 `S·R·S⁻¹` 旋转 | 544×640 透明轮子，轮心固定；未使用第三方素材 |
| 前架、立柱、轴承、进水槽与原落水 | 原 `scroll-16.webp` 同一像素，通过 SVG clipPath 分出固定前层 | 保留原画前后关系，不旋转支架/轴承 |
| 水纹、水花、涟漪 | `src/Watermill.tsx` 原创 SVG pattern/path/ellipse | 遮罩内向下流动；减少动态静止、离开视野暂停；没有录音、远端图片或第三方纹理 |

运行坐标、生成来源、文件哈希、裁片和预处理见 [水磨材料记录](china-watermill-v1/materials.json)，验证见 [水磨接入说明](china-watermill-v1/README.md)。新位图仅接近水磨段时加载，未加入首屏预载。
