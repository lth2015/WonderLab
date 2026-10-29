import type { WorldSave } from './engine/persist';

// The canvas's description for screen readers (docs/03 §8): what the world
// holds right now, e.g. 「夜晚的湖面，有月亮和三条小鱼，正在下小雨」.
// Read from the same snapshot the world is saved from, so it never
// describes something the picture does not show.

const NUM = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
const count = (n: number) => (n <= 10 ? NUM[n] : String(n));

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`;
}

export function describeWorld(world: Pick<WorldSave, 'atmosphere' | 'fish' | 'moon' | 'planets' | 'stars' | 'clouds'>): string {
  const when = world.atmosphere.timeOfDay === 'dusk' ? '黄昏' : world.atmosphere.timeOfDay === 'day' ? '白天' : '夜晚';
  const things: string[] = [];
  if (world.moon) things.push('月亮');
  if (world.planets.length) things.push(`${count(world.planets.length)}颗小星球`);
  if (world.stars.length) things.push(`${count(world.stars.length)}颗星`);
  if (world.clouds.length) things.push(world.clouds.length > 1 ? '几缕流云' : '一缕流云');
  if (world.fish.length) things.push(`${count(world.fish.length)}条小鱼`);
  const weather = { rain: '正在下小雨', mist: '起了雾', fireflies: '萤火虫在飞', snow: '正在下雪', moonlit: '月光如水', autumn: '秋风吹落叶', storm: '雷雨交加', shower: '流星如雨', galaxy: '星河横过天空', lanterns: '湖上漂着河灯，天上升起孔明灯', moonsnow: '月光下飘着雪', blossom: '花瓣飘落在湖上', lotus: '近岸开着一片荷花', clear: '' }[world.atmosphere.weather];
  const parts = [`${when}的湖面`, things.length ? `有${list(things)}` : '还空着'];
  if (weather) parts.push(weather);
  return parts.join('，');
}
