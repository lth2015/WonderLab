import { describe, expect, it } from 'vitest';
import { initialState, parseSave, reduceGame, type Action } from './game';
import { ROLL_MAX, ROLL_MIN } from './layout';
import { MAP_ROWS, MAP_ROW_UNITS, MAP_WIDTH, mapDestination, mapMarks, mapView, toMap, type LostMapHint } from './townMap';
import { createStudy, observeProgress } from './study';
const run=(actions:Action[],state=initialState())=>actions.reduce(reduceGame,state);
const paper:Action[]=[{type:'PRESS_PAPER'},{type:'SKETCH',view:'hands'}];
describe('折叠长卷与实际视野',()=>{
  it('四段完整覆盖24000单位，最上是卷首、最下是静巷；端点与每个折口都有归属',()=>{
    expect(MAP_ROWS[0].start+MAP_ROW_UNITS).toBe(ROLL_MAX);expect(MAP_ROWS.at(-1)!.start).toBe(ROLL_MIN);
    for(let i=1;i<4;i++)expect(MAP_ROWS[i].start+MAP_ROW_UNITS).toBe(MAP_ROWS[i-1].start);
    expect(toMap(ROLL_MAX,800)).toMatchObject({row:0,px:MAP_WIDTH});expect(toMap(ROLL_MIN,800)).toMatchObject({row:3,px:0});
    for(const [row,r] of MAP_ROWS.entries()){expect(toMap(r.start,800)).toMatchObject({row,px:0});expect(mapDestination(row)).toBe(r.start+3000);}
    expect(toMap(ROLL_MIN-10,-500)).toMatchObject({row:3,px:0,py:24});expect(toMap(ROLL_MAX+10,2000)).toMatchObject({row:0,px:800,py:136});
  });
  it('点击坐标与键盘中点共用映射，越过边框时只前往该段端点',()=>{
    expect(mapDestination(1,0)).toBe(1200);expect(mapDestination(1,1)).toBe(7200);expect(mapDestination(1,-1)).toBe(1200);expect(mapDestination(1,2)).toBe(7200);
    expect(()=>mapDestination(4)).toThrow();expect(()=>mapDestination(0,NaN)).toThrow();
  });
  it('跨折口视野分别显示两处，不把当前请求的中心当成实际视野',()=>{
    const view={from:6900,to:7500,center:7200};expect(mapView(0,view)).toEqual({x:0,width:40});expect(mapView(1,view)).toEqual({x:760,width:40});expect(mapView(2,view)).toBeNull();expect(mapView(0,null)).toBeNull();
  });
});
describe('等待的人与听过的线索',()=>{
  it('最初只标三段明确请求，不把六位人物全部变成待办，也不暴露未遇见的远端故事',()=>{
    const marks=mapMarks(initialState());expect(marks.map(m=>m.id)).toEqual(['person-liu','person-he','person-zhou']);expect(marks.some(m=>['gate','harbor','countryside','person-shen'].includes(m.id))).toBe(false);
  });
  it('纸铺完结移除旧请求、开放两段新相遇；重逢时同一人物的邀请合并显示',()=>{
    let s=run(paper);let marks=mapMarks(s);expect(marks.find(m=>m.id==='person-liu')?.label).toContain('借一阵风');expect(marks.find(m=>m.id==='person-liu')?.label).not.toContain('一纸春风');expect(marks.find(m=>m.id==='person-shen')?.label).toContain('柳下初笔');
    s=reduceGame(s,{type:'REPLAY',quest:'paper'});marks=mapMarks(s);expect(marks.filter(m=>m.id==='person-liu')).toHaveLength(1);expect(marks.find(m=>m.id==='person-liu')?.label).toMatch(/一纸春风.*借一阵风/);
  });
  it('香囊根据已听线索指向另一位；线索齐备后只引向陈生',()=>{
    let s=run([{type:'FIND_PURSE'},{type:'EXAMINE_PURSE'}]);expect(mapMarks(s).some(m=>m.id==='person-he')).toBe(true);
    s=reduceGame(s,{type:'ASK',who:'he'});expect(mapMarks(s).find(m=>m.id==='person-cheng')?.label).toContain('打听一条线索');
    s=reduceGame(s,{type:'ASK',who:'cheng'});expect(mapMarks(s).find(m=>m.id==='person-chen')?.label).toContain('归还');expect(mapMarks(s).some(m=>m.id==='person-he')).toBe(false);
    s=reduceGame(s,{type:'RETURN_PURSE',who:'chen'});expect(mapMarks(s).some(m=>m.id==='person-chen')).toBe(false);
  });
  it('理绳后指向认货签，认货签后指向阿成，渡口被看见才出现在地图',()=>{
    let s=run([0,1,2].map(rope=>({type:'ROPE',rope,target:rope})));expect(mapMarks(s).find(m=>m.id==='person-zhou')?.label).toContain('货签');s=reduceGame(s,{type:'TAG',tag:'tea'});expect(mapMarks(s).some(m=>m.id==='person-zhou')).toBe(false);expect(mapMarks(s).find(m=>m.id==='person-cheng')?.label).toContain('接过新茶');
    s=reduceGame(s,{type:'OBSERVE',id:'ferry'});expect(mapMarks(s).find(m=>m.id==='countryside')?.label).toContain('田伯');
    for(const a of [{type:'COUNTRYSIDE_TALK'},{type:'COUNTRYSIDE_SIGNAL',signal:'wave'},{type:'COUNTRYSIDE_BOARD',plan:'steady'},{type:'COUNTRYSIDE_SKETCH'}] as const)s=reduceGame(s,a);expect(mapMarks(s).some(m=>m.id==='countryside')).toBe(false);
  });
  it('C5接口只显示已听说且尚未拾取的线索，不重复标记、不接受无效坐标',()=>{
    const base:LostMapHint={id:'fixture',label:'测试线索',x:9000,y:800,heard:true,found:false};const hints=[{...base,id:'unheard',heard:false},{...base,id:'found',found:true},base,base,{...base,id:'nan',x:NaN},{...base,id:'outside',x:ROLL_MAX+1}];expect(mapMarks(initialState(),hints).filter(m=>m.kind==='lost')).toEqual([{id:'lost-fixture',kind:'lost',x:9000,y:800,label:'测试线索'}]);expect(mapMarks(initialState()).some(m=>m.kind==='lost')).toBe(false);
  });
});
describe('旧进度与地图提醒',()=>{
  it('旧v5只补地图标记，不改变故事、钱、画页与原始输入；损坏标记拒绝导入',()=>{
    const legacy=run(paper) as any;delete legacy.progress.map;const raw=JSON.stringify(legacy),restored=parseSave(raw);expect(restored.progress.map).toEqual({opened:false,hinted:false});const {map:_,...progress}=restored.progress;expect({...restored,progress}).toEqual(legacy);expect(JSON.stringify(legacy)).toBe(raw);
    expect(()=>parseSave(JSON.stringify({...restored,progress:{...restored.progress,map:{opened:'yes',hinted:false}}}))).toThrow();
  });
  it('查看与提示只记地图状态，打开后不再记提示，不改变既有统计或伪造首次有效操作',()=>{
    const s=run(paper),record=createStudy('test','map');let next=reduceGame(s,{type:'MAP_HINT'});expect(next.progress.map).toEqual({opened:false,hinted:true});next=reduceGame(next,{type:'MAP_OPEN'});const before=structuredClone(next);next=reduceGame(next,{type:'MAP_HINT'});expect(next.progress).toEqual(before.progress);expect(next.wallet).toBe(s.wallet);expect(next.journal).toEqual(s.journal);expect(next.claimed).toEqual(s.claimed);observeProgress(s,next,record);expect(record.snapshot().events).toHaveLength(0);expect(parseSave(JSON.stringify(next))).toEqual(next);
    expect(record.emit('play_detail',{what:'map',outcome:'opened',x:1234,label:'private-marker'} as never)).toBe(true);expect(JSON.stringify(record.snapshot())).not.toMatch(/private-marker|"x"/);
  });
});
