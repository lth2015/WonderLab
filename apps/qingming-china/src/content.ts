import type { ScrollWorld } from '../../../packages/scroll-contracts';

export const WORLD: ScrollWorld = {
  schemaVersion: 1, worldId: 'qingming-china', contentVersion: '0.2.0', defaultLocale: 'zh-CN',
  scenes: [
    { id: 'bridge', bounds: { x: 0, y: 0, width: 1800, height: 1200 }, layers: ['painting', 'boats', 'characters', 'foreground'], hotspots: [], ambienceId: 'water' },
    { id: 'tea', bounds: { x: 1800, y: 0, width: 850, height: 1200 }, layers: ['painting', 'boats', 'characters', 'foreground'], hotspots: [], ambienceId: 'tea' },
    { id: 'paper', bounds: { x: 2650, y: 0, width: 950, height: 1200 }, layers: ['painting', 'boats', 'characters', 'foreground'], hotspots: [], ambienceId: 'breeze' },
  ],
};
export const CHARACTERS = {
  liu: { name: '小柳', role: '纸铺少年', color: '#707c6a', x: 2880, y: 850, scene: 'paper', line: '哎呀，这春风又来翻我的画纸了。能替我把纸角压一压吗？', refuse: '不妨事，沿河慢慢逛。风小些，我再把它铺平。' },
  zhou: { name: '周伯', role: '汴河船工', color: '#627e7c', x: 1550, y: 682, scene: 'bridge', line: '一船茶叶，等着上岸。替我理理绳子吧，认准绳结的模样就成。', refuse: '不急，水缓。想试的时候，再来唤我。' },
  cheng: { name: '阿成', role: '岸边脚夫', color: '#ad7852', x: 1785, y: 673, scene: 'bridge', line: '何娘的茶摊还等着新茶。周伯的船靠稳了，我就接这一担。', refuse: '你先逛着，我在这儿候船。' },
  he: { name: '何娘', role: '桥畔茶娘', color: '#9b5844', x: 2210, y: 757, scene: 'tea', line: '歇歇脚吧。茶汤刚温好，这里总留着一张凳子。', refuse: '好，路过渴了，再来喝口茶。' },
  chen: { name: '陈生', role: '远行客人', color: '#77798b', x: 2480, y: 804, scene: 'tea', line: '方才在这里歇脚，起身才发现香囊不见了。那是家中人缝给我的……', refuse: '多谢挂念，我再沿路找找。' },
  shen: { name: '沈砚', role: '你的师父', color: '#6e7064', x: 3330, y: 884, scene: 'paper', line: '不必急着画尽一座城。先记住一个人，画便有了温度。', refuse: '去吧。我在柳荫下，等你说说今日的见闻。' },
} as const;
export type CharacterId = keyof typeof CHARACTERS;
export type PageId = typeof PAGES[number]['id'];
export const PAGES = [
  { id: 'paper-hands', title: '执纸的手', subtitle: '一纸春风', caption: '我替小柳压住了画纸。他铺平纸角，笑着邀我记下摊前忙碌的手。', art: 'hands', color: '#8b7553' },
  { id: 'paper-boats', title: '春水行舟', subtitle: '一纸春风', caption: '小柳借我一页素纸。我选了河上的船，让一段来往停在笔端。', art: 'boat', color: '#657f7a' },
  { id: 'paper-bridge', title: '桥上人间', subtitle: '一纸春风', caption: '我在小柳的纸上留下虹桥。桥上的人各有去处，脚步交织成春日。', art: 'bridge-crowd', color: '#9d7652' },
  { id: 'river-team', title: '众人相成', subtitle: '这一船日常', caption: '绳索理好，货签认清。周伯稳船，阿成接担，我站在岸边看日常继续。', art: 'rope', color: '#75877c' },
  { id: 'river-delivery', title: '新茶到岸', subtitle: '这一船日常', caption: '我随阿成把新茶送到茶摊。何娘掀开竹篓，留出两只刚擦好的茶盏。', art: 'cargo', color: '#7b8863' },
  { id: 'tea-seat', title: '一席知味', subtitle: '茶摊小憩', caption: '一位爱清茶，一位偏甜。我依着客人的口味配好茶点，他们都坐定了。', art: 'tea', color: '#8d8263' },
  { id: 'purse', title: '针脚里的牵挂', subtitle: '谁的香囊', caption: '两枝并生的柳，内衬一个「安」字。陈生接过香囊，说这是阿姊送他的平安。', art: 'purse', color: '#9c6256' },
  { id: 'bridge', title: '虹桥一望', subtitle: '桥边细看', caption: '我在桥边停了一会儿，望见木梁相承，也望见桥上桥下各自忙碌的人。', art: 'bridge', color: '#998363' },
  { id: 'willow', title: '柳色新', subtitle: '河畔偶得', caption: '轻触河边的柳枝，春风掠过。细细的新叶，把水面也染绿了。', art: 'willow', color: '#7a8863' },
  { id: 'market', title: '檐下一缕香', subtitle: '街巷偶得', caption: '炭火正红，壶口生烟。市井的热闹，也藏在一盏茶还没喝完的工夫里。', art: 'market', color: '#a27b55' },
  { id: 'master', title: '画里有故人', subtitle: '与师父谈画', caption: '我把亲历的一页递给师父。他说：先记住一个人，画便有了温度。', art: 'brush', color: '#727665' },
  { id: 'departure', title: '今日汴河', subtitle: '留一页给自己', caption: '走过这段河岸，我把实际发生的相遇收进画册。繁华很远，也很近。', art: 'landscape', color: '#7d8b81' },
] as const;
export const ENVIRONMENT = [
  { id: 'willow', x: 3400, y: 250, label: '拂一拂柳枝', text: '柳梢拂过水面，落下一点新绿。', page: 'willow' },
  { id: 'water', x: 1900, y: 1010, label: '听一听水声', text: '水纹一圈圈漾开，船影也轻轻晃了晃。' },
  { id: 'banner', x: 2685, y: 520, label: '看看招幌', text: '布幌迎风，纸铺的竹帘轻轻响。' },
  { id: 'cat', x: 2525, y: 774, label: '摸摸檐下的猫', text: '猫伸了个懒腰，又蜷回暖和的檐下。' },
  { id: 'sparrow', x: 1130, y: 400, label: '看看桥头的雀', text: '两只雀儿换了根栏杆，仍旧并排站着。' },
  { id: 'wheel', x: 1865, y: 680, label: '看看独轮车', text: '木轮咯吱一声。阿成把货担挪开，给行人让路。' },
  { id: 'brazier', x: 2190, y: 755, label: '看看煮茶炉', text: '壶嘴升起一缕白汽。河风里有了新茶的香气。', page: 'market' },
  { id: 'bell', x: 1340, y: 515, label: '轻触桥头风铃', text: '一声清响，飘过桥下缓缓的水。', page: 'bridge' },
  // 长卷两端（x 为原画段的局部坐标；负数在虹桥以西、城内方向）
  { id: 'well', x: -7875, y: 785, label: '看看井台', text: '辘轳吱呀一转，一桶清水提上了井台。旁边的剃头匠正替客人修面。' },
  { id: 'silk', x: -6545, y: 610, label: '看看绸缎铺', text: '一匹匹素绢叠得齐整，掌柜拿着尺子，正替客人量布。' },
  { id: 'camels', x: -5620, y: 640, label: '看看入城的驼队', text: '驼铃一声一声，驼队驮着货，从城门洞里慢慢走出来。' },
  { id: 'oxcart', x: -4450, y: 790, label: '看看牛车', text: '牛车吱呀前行，满载的麻袋把车辕压得微微下沉。' },
  { id: 'dye', x: -3350, y: 560, label: '看看染坊晾布', text: '靛青与赭色的长布垂在竿上，风一过，像一道道水波。' },
  { id: 'restaurant', x: -1765, y: 450, label: '看看正店楼上', text: '楼上的客人推杯换盏，跑堂托着菜，在栏边穿来穿去。' },
  { id: 'washing', x: 3880, y: 840, label: '看看浣衣的妇人', text: '石阶上，妇人把衣裳在水里摆了又摆，水纹一圈圈荡开。' },
  { id: 'grain', x: 5350, y: 560, label: '看看扛粮的脚夫', text: '脚夫弓着背，把一袋袋粮食从船上扛进仓里，账房在一旁记数。' },
  { id: 'boatyard', x: 6500, y: 480, label: '看看船坞', text: '新船的骨架立在木架上，木匠敲着木钉，刨花落了一地。' },
  { id: 'inn', x: 7850, y: 620, label: '看看临水的客店', text: '客人倚着栏杆喝茶，门口拴着的骡子甩了甩尾巴。' },
  { id: 'mill', x: 9050, y: 800, label: '看看水磨', text: '水车慢慢转着，水从叶片上哗哗落下，磨房里传出石磨的声响。' },
  { id: 'farmers', x: 11555, y: 490, label: '看看田里的农人', text: '两位农人弯腰锄地，麦苗刚刚没过脚背。' },
  { id: 'ferry', x: 11610, y: 805, label: '看看渡船', text: '小小的渡船载着一位客人，慢慢划向对岸。' },
] as const;
