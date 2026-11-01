# 水磨素材生成提示与处理

输入是本仓库已有原创 `scroll-16.webp`（1024×1024），已先目视检查。使用 image_gen.imagegen；未引入外部馆藏照片或素材。生成原始 PNG 留作美术源，不作为额外运行资源。

## 后景补画

Edit the attached 1024x1024 historical Chinese handscroll tile IN PLACE. Preserve the entire image's exact composition, viewpoint, bamboo, roof, miller at left, building and river, same aged warm gray olive ink and pale wash with fine irregular pen lines. This is a BACKGROUND CLEAN PLATE for animation. In the local region x=470..795,y=465..800 ONLY, REMOVE the entire large wooden waterwheel (all rims, spokes, hub and blades), the front bearing posts and cross braces directly in front of it, and the sheet of falling water at the wheel's right edge. Restore what would be behind the wheel: the existing shadowy wooden mill wall/slatted housing continuing naturally, the low stone foundation, a little existing riverside timber walkway; below y=745 restore the calm river reflection. Keep the overhead wooden trough and roof, and existing rail to the far right. Do not introduce a new wheel, circle, machinery, blank white hole or any people. Preserve all other pixels/positions and avoid changing global color. Return the same square tile canvas, no margins, no text. This is an inpainting of only the waterwheel region, NOT a new scene.

处理：按原瓦片尺寸归一到1024，取(464,456,340,356)，四边约4% alpha融合，WebP92。生成全图只用这一局部；外围原画仍由原瓦片渲染，避免生成器改变整个长卷。

## 可旋转木轮

Use the attached Chinese ink handscroll watermill solely as the exact palette, brushwork and timber texture reference. Produce ONE isolated ROTATING WATERWHEEL ROTOR as a transparent game sprite. IMPORTANT: render it geometrically FRONT ON, a true circle with equal width/height, with its exact center at the image center; we will add the original elliptical perspective at runtime. A small simple timber water wheel in an old Northern Song Chinese mill: two concentric weathered dark tawny brown wooden rims, 12 clear radial timber spokes to a small wooden axle hub, 12 modest timber paddle boards around the perimeter; irregular fine warm charcoal/ochre ink outlines, aged gray olive and muted brown wash matching this reference, modest highlights on grain. The rotor must be a complete connected circular object, with genuinely transparent open gaps between spokes and rim. Show ONLY the rotating assembly, no stationary posts, no legs, no foreframe, no diagonal structural braces, no water, no splashes, no building, no river, no landscape, no labels or border, no paper background, no shadows cast outside wheel, no perspective ellipse. Entire wheel visible with generous 8% empty alpha margin, center the hub precisely. Do not add a second wheel or dramatic 3D lighting. A single flat painted circular wheel on genuine transparent alpha.

处理：归一为544×640的椭圆源片，亮度0.82/饱和度0.75与原画木色衔接，WebP90/alpha100。显示时先去透视得到正圆，再旋转，最后恢复0.85横向透视；不是直接旋转椭圆。

前架用原瓦片SVG裁切，水流为原落水画面上的程序纹理，均保留原图对应关系。
