import type { ScrollWorld } from '../../../packages/scroll-contracts';

export const WORLD: ScrollWorld = {
  schemaVersion: 1, worldId: 'qingming-china', contentVersion: '0.1.0', defaultLocale: 'zh-CN',
  scenes: [
    { id: 'tea', bounds: { x: 0, y: 0, width: 1200, height: 1000 }, layers: ['distant', 'market', 'river'], hotspots: [], ambienceId: 'tea' },
    { id: 'bridge', bounds: { x: 1200, y: 0, width: 1200, height: 1000 }, layers: ['distant', 'bridge', 'river'], hotspots: [], ambienceId: 'water' },
    { id: 'paper', bounds: { x: 2400, y: 0, width: 1200, height: 1000 }, layers: ['distant', 'shops', 'river'], hotspots: [], ambienceId: 'breeze' },
  ],
};
export const CHARACTERS = {
  liu: { name: '小柳', role: '纸铺少年', color: '#707c6a', x: 2790, y: 561, scene: 'paper', line: '哎呀，这春风又来翻我的画纸了。能替我把纸角压一压吗？', refuse: '不妨事，沿河慢慢逛。风小些，我再把它铺平。' },
  zhou: { name: '周伯', role: '汴河船工', color: '#627e7c', x: 2260, y: 655, scene: 'bridge', line: '一船茶叶，等着上岸。替我理理绳子吧，认准绳结的模样就成。', refuse: '不急，水缓。想试的时候，再来唤我。' },
  cheng: { name: '阿成', role: '岸边脚夫', color: '#ad7852', x: 2120, y: 478, scene: 'bridge', line: '何娘的茶摊还等着新茶。周伯的船靠稳了，我就接这一担。', refuse: '你先逛着，我在这儿候船。' },
  he: { name: '何娘', role: '桥西茶娘', color: '#9b5844', x: 685, y: 492, scene: 'tea', line: '歇歇脚吧。茶汤刚温好，这里总留着一张凳子。', refuse: '好，路过渴了，再来喝口茶。' },
  chen: { name: '陈生', role: '远行客人', color: '#77798b', x: 1050, y: 535, scene: 'tea', line: '方才在这里歇脚，起身才发现香囊不见了。那是家中人缝给我的……', refuse: '多谢挂念，我再沿路找找。' },
  shen: { name: '沈砚', role: '你的师父', color: '#6e7064', x: 3190, y: 498, scene: 'paper', line: '不必急着画尽一座城。先记住一个人，画便有了温度。', refuse: '去吧。我在柳荫下，等你说说今日的见闻。' },
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
  { id: 'willow', x: 3050, y: 340, label: '拂一拂柳枝', text: '柳梢拂过水面，落下一点新绿。', page: 'willow' },
  { id: 'water', x: 2520, y: 790, label: '听一听水声', text: '水纹一圈圈漾开，船影也轻轻晃了晃。' },
  { id: 'banner', x: 2640, y: 425, label: '看看招幌', text: '布幌迎风，纸铺的竹帘轻轻响。' },
  { id: 'cat', x: 450, y: 547, label: '摸摸檐下的猫', text: '猫伸了个懒腰，又蜷回暖和的檐下。' },
  { id: 'sparrow', x: 1570, y: 388, label: '看看桥头的雀', text: '两只雀儿换了根栏杆，仍旧并排站着。' },
  { id: 'wheel', x: 1970, y: 440, label: '看看独轮车', text: '木轮咯吱一声。阿成把货担挪开，给行人让路。' },
  { id: 'brazier', x: 590, y: 475, label: '看看煮茶炉', text: '壶嘴升起一缕白汽。河风里有了新茶的香气。', page: 'market' },
  { id: 'bell', x: 1460, y: 310, label: '轻触桥头风铃', text: '一声清响，飘过桥下缓缓的水。', page: 'bridge' },
] as const;
