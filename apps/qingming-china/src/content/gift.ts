/** Original words for a friend. Kind ids match Edo; the Chinese lines belong to this work. */
export interface GiftKind {
  id: 'shimijimi' | 'kangaeru' | 'hotto' | 'soba';
  label: string;
  lines: string[];
}
export const GIFT_KINDS: GiftKind[] = [
  { id:'shimijimi',label:'文艺',lines:[
    '把这一岸春色，寄给此刻的你。',
    '桥上人来人往，愿你也有从容停步的时刻。',
    '折一页河上的风，放在你的窗边。',
    '远处是烟火，近处是想起你的片刻。',
  ] },
  { id:'kangaeru',label:'哲理',lines:[
    '水有来处，人有归途。',
    '走得慢些，也会遇见春天。',
    '有些路，停下来才看得清。',
    '日子里的光，常在彼此照应的地方。',
  ] },
  { id:'hotto',label:'安抚',lines:[
    '今日若有些疲惫，就在这一页歇一会儿。',
    '这一程不必赶，岸边还有一盏茶。',
    '风大时，把心事暂放在安静的檐下。',
    '不必急着回答生活，先喝一口温茶。',
  ] },
  { id:'soba',label:'陪伴',lines:[
    '不急着说些什么，陪你看一会儿河。',
    '隔着一段水，也记得彼此。',
    '你忙你的，闲下来我们再一起看春天。',
    '愿这页小小的风景，在你身边待一会儿。',
  ] },
];
export const GIFT_LINES: readonly string[] = GIFT_KINDS.flatMap(kind=>kind.lines);

/** Wrap reviewed short notes; prefer a comma when the remaining line still fits. */
export function wrapNote(text: string, max=22): string[] {
  const chars=[...text],closing=/[，。！？、」”]/;
  if(chars.length<=max||(chars.length===max+1&&closing.test(chars[max])))return[text];
  let cut=max;
  for(let i=max;i>=4;i--)if(/[，、；]/.test(chars[i-1])&&chars.length-i<=max){cut=i;break;}
  if(closing.test(chars[cut]))cut++;
  return[chars.slice(0,cut).join(''),chars.slice(cut).join('')];
}
