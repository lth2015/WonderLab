import { CHARACTERS } from './content';
import type { GameState, QuestId } from './game';
import { ENVIRONMENT } from './content';
import { personPosition, ROLL_MIN, ROLL_MAX, type ScrollViewport } from './layout';

export const MAP_WIDTH=800;
export const MAP_ROW_UNITS=6000;
export const MAP_ROW_HEIGHT=160;
export const MAP_SCALE=MAP_WIDTH/MAP_ROW_UNITS;
/** Top to bottom: the beginning of the roll to the city's quiet end. */
export const MAP_ROWS=[
  {start:7200,name:'卷首野渡 · 乡野 · 水磨'},
  {start:1200,name:'虹桥东岸 · 纸铺 · 货港'},
  {start:-4800,name:'虹桥西岸 · 正店 · 染坊'},
  {start:-10800,name:'城门 · 市肆 · 卷尾静巷'},
] as const;
export type MapMark={id:string;kind:'ask'|'lost';x:number;y:number;label:string};
/** C5 supplies known hints; unmentioned and already found objects stay off the map. */
export type LostMapHint={id:string;x:number;y:number;label:string;heard:boolean;found:boolean};
export function toMap(x:number,y:number) {
  const bounded=Math.min(ROLL_MAX,Math.max(ROLL_MIN,x));
  const row=Math.max(0,MAP_ROWS.findIndex(r=>bounded>=r.start));
  return {row,px:(bounded-MAP_ROWS[row].start)*MAP_SCALE,py:Math.min(MAP_ROW_HEIGHT-24,Math.max(24,y*MAP_SCALE))};
}
export function mapDestination(row:number,fraction=.5):number {
  const r=MAP_ROWS[row];
  if(!r || !Number.isFinite(fraction))throw new Error('这段地图尚未收录。');
  return r.start+Math.min(1,Math.max(0,fraction))*MAP_ROW_UNITS;
}
/** The camera can straddle a fold: clip its actual viewport into every row it intersects. */
export function mapView(row:number,view:ScrollViewport|null):{x:number;width:number}|null {
  if(!view || !MAP_ROWS[row])return null;
  const from=Math.max(view.from,MAP_ROWS[row].start),to=Math.min(view.to,MAP_ROWS[row].start+MAP_ROW_UNITS);
  return to>from?{x:(from-MAP_ROWS[row].start)*MAP_SCALE,width:(to-from)*MAP_SCALE}:null;
}
export function mapMarks(game:GameState,lostHints:readonly LostMapHint[]=[]):MapMark[] {
  const q=game.progress.quests,marks:MapMark[]=[];
  const waiting=(quest:QuestId)=>q[quest].status!=='complete';
  const person=(id:keyof typeof CHARACTERS,label:string)=>{
    const existing=marks.find(m=>m.id===`person-${id}`);
    if(existing){existing.label+=`；${label}`;return;}
    const p=personPosition(id,game);marks.push({id:`person-${id}`,kind:'ask',x:p.x,y:p.y,label:`${CHARACTERS[id].name} · ${label}`});
  };
  if(waiting('paper'))person('liu',q.paper.step===0?'一纸春风，替他压住画纸':'一纸春风，选一处细节落笔');
  if(waiting('boat'))person(q.boat.step===2?'cheng':'zhou',q.boat.step===0?'这一船日常，理好绳索':q.boat.step===1?'这一船日常，辨认新茶货签':'这一船日常，接过新茶');
  if(waiting('purse')){
    if(q.purse.step<2)person('he',q.purse.step===0?'谁的香囊，看看凳边的小物':'谁的香囊，记住绣纹');
    else if(q.purse.step===2)person(game.progress.clues.includes('he')?'cheng':'he','谁的香囊，打听一条线索');
    else person('chen','谁的香囊，归还这份牵挂');
  }
  if(game.claimed.includes('paper')){
    if(waiting('trace'))person('shen',q.trace.step===3?'柳下初笔，收好已描完的画':'柳下初笔，描一枝柳');
    if(waiting('breeze'))person('liu',q.breeze.step===4?'借一阵风，收好已晾好的画':'借一阵风，陪小柳晾画');
  }
  for(const [quest,env,label] of [['harbor','grain','杜叔 · 半步相让'],['gate','camels','阿芦 · 认得归路'],['countryside','ferry','田伯 · 这一程，不催']] as const){
    if(!waiting(quest) || (q[quest].status==='unseen'&&!game.progress.observations.includes(env)))continue;
    const p=ENVIRONMENT.find(e=>e.id===env)!;marks.push({id:quest,kind:'ask',x:p.x,y:p.y,label});
  }
  const seen=new Set<string>();
  for(const hint of lostHints){
    if(!hint.heard||hint.found||seen.has(hint.id)||!Number.isFinite(hint.x)||!Number.isFinite(hint.y)||hint.x<ROLL_MIN||hint.x>ROLL_MAX)continue;
    seen.add(hint.id);marks.push({id:`lost-${hint.id}`,kind:'lost',x:hint.x,y:hint.y,label:hint.label});
  }
  return marks.sort((a,b)=>b.x-a.x);
}
