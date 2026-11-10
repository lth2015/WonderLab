import { describe, expect, it } from 'vitest';
import { initialState, parseSave, reduceGame, type Action } from './game';
import { TRACE_STROKES, nextTracePoint, windIsLight } from './playStories';
import { createStudy, observeProgress } from './study';
const paper:Action[]=[{type:'PRESS_PAPER'},{type:'SKETCH',view:'hands'}];
const trace:Action[]=[{type:'TRACE_STROKE',stroke:0},{type:'TRACE_STROKE',stroke:1},{type:'TRACE_STROKE',stroke:2},{type:'TRACE_KEEP'}];
const breeze:Action[]=[{type:'BREEZE_TALK'},{type:'BREEZE_HANG'},{type:'BREEZE_RELEASE',elapsed:3000},{type:'BREEZE_KEEP'}];
const clips:Action[]=[{type:'BREEZE_TALK'},{type:'BREEZE_HANG'},{type:'BREEZE_CLIP',corner:0},{type:'BREEZE_CLIP',corner:1},{type:'BREEZE_KEEP'}];
const run=(actions:Action[],state=initialState())=>actions.reduce(reduceGame,state);
describe('中国篇两段玩法与旧档',()=>{
  it('纸铺第一幅画以后才可参与，不能越步或反复按同一笔推进',()=>{
    expect(run([...trace,...breeze,...clips]).claimed).toEqual([]);
    const s=run([...paper,{type:'TRACE_STROKE',stroke:1},{type:'TRACE_KEEP'},{type:'TRACE_STROKE',stroke:0},{type:'TRACE_STROKE',stroke:0},{type:'BREEZE_KEEP'},{type:'BREEZE_RELEASE',elapsed:3000}]);
    expect(s.progress.quests.trace.step).toBe(1);expect(s.progress.quests.breeze.step).toBe(0);expect(s.wallet).toBe(72);
  });
  for(const [name,actions,quest,page] of [
    ['描柳',trace,'trace','willow-trace'],['借风',breeze,'breeze','paper-breeze'],['竹夹',clips,'breeze','paper-breeze'],
  ] as const)it(name+'可逐步保存，重复与重逢始终只得一页',()=>{
    let s=run(paper);
    for(const a of actions){s=reduceGame(s,a);expect(parseSave(JSON.stringify(s))).toEqual(s);}
    s=run([...actions,{type:'REPLAY',quest},...actions],s);
    expect(s.wallet).toBe(72);expect(s.journal.filter(id=>id===page)).toHaveLength(1);expect(s.claimed.filter(id=>id===quest)).toHaveLength(1);expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('借风与逐个夹角同样完成；风大时松手无损失，已夹角不能越步',()=>{
    const held=run([...paper,...breeze.slice(0,2)]);
    for(const elapsed of [-1,0,2499,5500,7999,NaN,Infinity])expect(reduceGame(held,{type:'BREEZE_RELEASE',elapsed}).progress).toEqual(held.progress);
    expect(reduceGame(held,{type:'BREEZE_CLIP',corner:1}).progress).toEqual(held.progress);
    const left=reduceGame(held,{type:'BREEZE_CLIP',corner:0});expect(left.progress.quests.breeze.step).toBe(3);
    expect(reduceGame(left,{type:'BREEZE_RELEASE',elapsed:3000}).progress).toEqual(left.progress);
    const a=run(breeze,run(paper)),b=run(clips,run(paper));
    expect(a.progress).toEqual(b.progress);expect(a.journal).toEqual(b.journal);expect(a.claimed).toEqual(b.claimed);
  });
  it('真实v4只补空白玩法，保留原钱、画页、回放和设置；v0仍逐级迁移',()=>{
    const legacy=JSON.parse(JSON.stringify(run([...paper,{type:'REPLAY',quest:'paper'},{type:'SETTINGS',settings:{reduced:true,timeChoice:'morning'}}])));
    delete legacy.progress.quests.trace;delete legacy.progress.quests.breeze;legacy.saveVersion=4;
    const migrated=parseSave(JSON.stringify(legacy));
    const {trace:_,breeze:__,...quests}=migrated.progress.quests;
    expect({...migrated,saveVersion:4,progress:{...migrated.progress,quests}}).toEqual(legacy);
    expect(migrated.progress.quests.trace).toEqual({status:'unseen',step:0});expect(migrated.progress.quests.breeze).toEqual({status:'unseen',step:0});
    legacy.saveVersion=0;delete legacy.progress.quests.harbor;delete legacy.progress.quests.gate;delete legacy.progress.quests.countryside;
    expect(parseSave(JSON.stringify(legacy)).saveVersion).toBe(5);
  });
  it('拒绝缺玩法、超界、画页或领取账本不一致及未完成纸铺的伪造进度',()=>{
    for(const change of [
      (s:any)=>delete s.progress.quests.trace,(s:any)=>s.progress.quests.breeze.step=6,
      (s:any)=>s.journal.push('willow-trace'),(s:any)=>s.claimed.push('breeze'),
      (s:any)=>{s.progress.quests.trace={status:'active',step:1};},
    ]){const s=initialState();change(s);expect(()=>parseSave(JSON.stringify(s))).toThrow();}
  });
  it('固定描线只按序接近目标推进，跳过中间点不能完成；风轻窗口可重复等候',()=>{
    for(const stroke of TRACE_STROKES){
      expect(nextTracePoint(stroke.points,0,[300,190])).toBe(0);
      let n=0;for(const point of stroke.points)n=nextTracePoint(stroke.points,n,point);
      expect(n).toBe(stroke.points.length);expect(nextTracePoint(stroke.points,1,stroke.points.at(-1)!)).toBe(1);
    }
    for(const elapsed of [2500,5499,10500,13499])expect(windIsLight(elapsed)).toBe(true);
    expect(windIsLight(13500)).toBe(false);
  });
  it('首通和回放记录实际转换，玩法记录只有固定what/outcome，没有轨迹或文案',()=>{
    const record=createStudy('test','test');let state=run(paper);
    for(const a of [...trace,{type:'REPLAY',quest:'trace'} as const,...trace,...clips]){const next=reduceGame(state,a);observeProgress(state,next,record);state=next;}
    expect(record.snapshot().events.filter(e=>e.type==='story_completed').map(e=>[e.story_id,e.first_completion])).toEqual([['trace',true],['trace',false],['breeze',true]]);
    expect(record.emit('play_detail',{what:'trace',outcome:'traced',points:'private-stroke'} as never)).toBe(true);
    expect(record.emit('play_detail',{what:'private',outcome:'traced'} as never)).toBe(false);
    expect(JSON.stringify(record.snapshot())).not.toContain('private');
  });
});
