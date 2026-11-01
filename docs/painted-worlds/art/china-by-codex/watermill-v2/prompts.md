# v2生成来源

生成工具：内置 image_gen.imagegen。参考图均为本仓库已有原创素材，运行资源的处理与哈希见 materials.json。生成原始PNG单独保存到美术分支，未作为额外运行资源。

## 轮面

输入：原始 scroll-16.webp、上一版 rotor-v1.webp。transparent_background=true。

Create a replacement isolated waterwheel SIDE-FACE sprite matching the FIRST image's old Chinese handscroll exactly: subdued gray olive/umber ink, delicate irregular outlines and restrained pale watercolor, softly weathered damp timber, no photorealistic gloss or strong contrast. The SECOND image is the old sprite being replaced and shows mistakes: thick cartwheel hub, straight beams protruding beyond the rim. FIX THESE. Output a TRUE CIRCLE viewed exactly front-on, centered on an otherwise genuinely transparent square, complete circle with only 3% transparent margin. It is one side-frame of an overshot wooden mill wheel, NOT a wagon wheel. Thin DOUBLE CONCENTRIC WOODEN RINGS near the perimeter, twenty evenly spaced narrow radial spokes joining the inner ring to a very SMALL plain wooden hub (hub diameter only 7% of total wheel diameter). All spokes end INSIDE the rings, nothing sticks outside the outer circle. Jointed segmented curved boards with subtle pegs, uneven ink grain and gray-brown worn edges. Twenty spokes and two narrow hoops with large fully transparent spaces between spokes. Keep the rings narrow (outer ring band about 5% of radius); not a solid disk, no tire. There must be NO protruding paddles, no rectangular extensions, no mounting legs or fixed support, no axle projecting in depth, no water, no shadows outside wheel, no scene, no lettering, no background. We will build the true barrel depth and wooden water-buckets separately between two copies of this face at runtime, so do NOT paint any perspective depth: this side-face must be an exact circle, same width and height, and its center must be exact. Uniform soft diffuse lighting only, original small scale ink-wash timber detail, not a sharp vector diagram or a shiny 3D icon.

输出提示是生成约束，不把生成结果的辐条数量或考据准确性当成史实。实际图像已目视检查，用于本作虚构磨房。

## 细碎落水

输入：原始 scroll-16.webp。transparent_background=true。

Create a small original game texture cutout on true transparent alpha: the FINE FALLING WATER from this traditional Chinese ink-and-wash watermill, WITHOUT any scenery. One tall narrow vertical swath of delicate, irregular, gravity-driven trickles and tiny wet sparkles; numerous very thin broken pale gray-green and warm off-white fibers of water, with lacy transparent gaps and little uneven flecks, some faint translucent watercolor wash between fibers. It must look like the reference's painted water, at exactly its modest gray-olive subdued contrast, NOT a bright white waterfall and NOT opaque. No solid background at all, no wheel, wood, stone, bamboo, ground or pool. No smooth plastic sheet, no parallel road stripes, no dashed lines, no broad white ribbons, no outlines, no cartoon swooshes. Fine natural turbulent streaks taper and branch gently downwards, a diffuse but detailed transparent texture with no hard outer edge; all directions predominantly DOWN. For a repeating downward-flow particle layer: distribute the detail evenly over the entire central swath, no large splash at the base or cap at top, and avoid any horizontal seams. A tall portrait composition with a single centered narrow swath, genuinely transparent alpha outside and between its fibers. It should blend softly into an aged painted landscape; preserve fine texture, not a photorealistic studio water splash.

## 处理

轮面按原画的像素密度缩到272×320，并校色；木纹小样取自同一轮圈。水纹裁取中间部分缩为56×192，通过程序遮罩和两层不同节奏移动。木斗的几何、阴影、纹理投影与带水轨迹为原创代码，生成42帧图集。未使用第三方水纹、音频或外部图片。
