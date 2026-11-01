import { describe, expect, it } from 'vitest';
import { boatSummary, initialState, parseSave, reduceGame, type Action, type GameState } from './game';
import { PERSON_HEIGHT, personPosition, pickHotspot } from './layout';
import { PAGES } from './content';
import { isSaveEnvelope } from '../../../packages/scroll-contracts';

const run=(actions:Action[],state=initialState())=>actions.reduce(reduceGame,state);
const paper:Action[]=[{type:'PRESS_PAPER'},{type:'SKETCH',view:'hands'}];
const rope:Action[]=[0,1,2].map(n=>({type:'ROPE',rope:n,target:n}));
const boat:Action[]=[...rope,{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'deliver'}];
const purse:Action[]=[{type:'FIND_PURSE'},{type:'EXAMINE_PURSE'},{type:'ASK',who:'he'},{type:'ASK',who:'cheng'},{type:'RETURN_PURSE',who:'chen'}];

describe('故事与奖励',()=>{
  it('三条故事可以独立完成，初始 60 文合计奖励 54 文',()=>{const s=run([...paper,...boat,...purse]);expect(s.wallet).toBe(114);expect(s.claimed).toEqual(['paper','boat','purse']);expect(s.journal).toEqual(['paper-hands','river-delivery','purse']);});
  it('未压住画纸时不能直接完成写生',()=>{expect(run([{type:'SKETCH',view:'hands'}]).journal).toEqual([]);});
  it('重复操作不能重复发奖或重复记页',()=>{const s=run([...paper,...paper,...boat,...boat,...purse,...purse]);expect(s.wallet).toBe(114);expect(s.journal).toHaveLength(3);});
  it('回放可补齐不同纸铺构图，文钱保持不变',()=>{const s=run([...paper,{type:'REPLAY',quest:'paper'},{type:'PRESS_PAPER'},{type:'SKETCH',view:'boats'}]);expect(s.wallet).toBe(72);expect(s.journal).toEqual(['paper-hands','paper-boats']);expect(s.claimed).toEqual(['paper']);});
  it('回放船运另一分支只增加新画页',()=>{const s=run([...boat,{type:'REPLAY',quest:'boat'},...rope,{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'observe'}]);expect(s.wallet).toBe(84);expect(s.journal).toEqual(['river-delivery','river-team']);});
  it('未完成的故事不能回放绕过步骤',()=>{expect(run([{type:'REPLAY',quest:'boat'}]).progress.quests.boat.status).toBe('unseen');});
  it('错误绳结与重复绳索不能推进靠岸',()=>{const s=run([{type:'ROPE',rope:0,target:1},{type:'ROPE',rope:1,target:1},{type:'ROPE',rope:1,target:1},{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'observe'}]);expect(s.progress.ropes).toEqual([1]);expect(s.progress.quests.boat.step).toBe(0);expect(s.wallet).toBe(60);});
  it('错误货签不能推进',()=>{const s=run([...rope,{type:'TAG',tag:'rice'},{type:'BOAT_END',route:'deliver'}]);expect(s.progress.quests.boat.step).toBe(1);expect(s.wallet).toBe(60);});
  it('香囊需要观察和两条不同线索',()=>{const s=run([{type:'FIND_PURSE'},{type:'ASK',who:'he'},{type:'RETURN_PURSE',who:'chen'},{type:'EXAMINE_PURSE'},{type:'ASK',who:'he'},{type:'ASK',who:'he'},{type:'RETURN_PURSE',who:'chen'}]);expect(s.progress.clues).toEqual(['he']);expect(s.progress.quests.purse.step).toBe(2);expect(s.wallet).toBe(60);});
  it('归错人无损失，仍然可以归还陈生',()=>{const s=run([...purse.slice(0,-1),{type:'RETURN_PURSE',who:'liu'}]);expect(s.progress.quests.purse.step).toBe(3);expect(s.wallet).toBe(60);expect(reduceGame(s,{type:'RETURN_PURSE',who:'chen'}).wallet).toBe(78);});
  it('配席失败不会解锁；正确配席可以重复玩而不刷文钱',()=>{const s=run([{type:'TEA',selections:[2,0]}]);expect(s.progress.tea).toBe(false);const next=run([{type:'TEA',selections:[0,2]},{type:'TEA',selections:[0,2]}],s);expect(next.journal).toEqual(['tea-seat']);expect(next.wallet).toBe(60);});
  it('师父只能评价实际拥有的画页；未相遇时不能凭空写小结',()=>{expect(run([{type:'FAVORITE',page:'purse'},{type:'DEPART'}]).journal).toEqual([]);expect(run([...paper,{type:'FAVORITE',page:'paper-hands'},{type:'DEPART'}]).journal).toEqual(['paper-hands','master','departure']);});
  it('十二页都能通过真实事件解锁',()=>{const s=run([...paper,{type:'SKETCH',view:'boats'},{type:'SKETCH',view:'bridge'},...boat,{type:'REPLAY',quest:'boat'},...rope,{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'observe'},...purse,{type:'TEA',selections:[0,2]},{type:'OBSERVE',id:'bell',page:'bridge'},{type:'OBSERVE',id:'willow',page:'willow'},{type:'OBSERVE',id:'brazier',page:'market'},{type:'FAVORITE',page:'purse'},{type:'DEPART'}]);expect(new Set(s.journal)).toEqual(new Set(PAGES.map(p=>p.id)));});
});
describe('钱包与存档边界',()=>{
  it('只能以整数文消费，余额不会低于零',()=>{const s=run(Array.from({length:20},()=>({type:'BUY',item:'tea'})));expect(s.wallet).toBe(0);expect(s.progress.purchases).toHaveLength(10);});
  it('每个有效中间步骤都能持久化并恢复',()=>{let state=initialState();for(const a of [...paper,...boat,...purse]){state=reduceGame(state,a);expect(parseSave(JSON.stringify(state))).toEqual(state);}});
  it('恢复回放中间步骤时保留已领取奖励',()=>{let state=run([...boat,{type:'REPLAY',quest:'boat'},...rope]);state=parseSave(JSON.stringify(state));const s=run([{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'observe'}],state);expect(s.wallet).toBe(84);});
  it('拒绝另一作存档以及未知未来版本',()=>{expect(()=>parseSave(JSON.stringify({...initialState(),worldId:'qingming-edo'}))).toThrow();expect(()=>parseSave(JSON.stringify({...initialState(),saveVersion:10}))).toThrow();expect(isSaveEnvelope(initialState(),'qingming-edo')).toBe(false);});
  it('迁移旧版音量设置',()=>{const s=initialState() as unknown as Record<string,unknown>;s.saveVersion=0;expect(parseSave(JSON.stringify(s)).settings.ambience).toBe(.3);});
  it.each([-1,1.5,Number.MAX_SAFE_INTEGER+1])('拒绝非法钱包 %s',wallet=>{expect(()=>parseSave(JSON.stringify({...initialState(),wallet}))).toThrow();});
  it('拒绝损坏数据、未知页面、重复线索和不一致的领奖账本',()=>{
    const change=(f:(s:GameState)=>void)=>{const s=initialState();f(s);expect(()=>parseSave(JSON.stringify(s))).toThrow();};
    expect(()=>parseSave('{broken')).toThrow();change(s=>{s.journal=['unknown' as never];});change(s=>{s.progress.clues=['he','he'];});change(s=>{s.progress.quests.paper={status:'complete',step:2};});change(s=>{s.settings.effects=2;});change(s=>{s.progress.quests.boat.step=99;});
  });
  it('状态转换保持输入不可变',()=>{const s=initialState();const copy=structuredClone(s);reduceGame(s,{type:'PRESS_PAPER'});expect(s).toEqual(copy);});
});

describe('审查修复',()=>{
  it('重逢后小结仍按画册的实际历史讲述送茶',()=>{
    const s=run([...boat,{type:'REPLAY',quest:'boat'}]);
    expect(s.progress.route).toBeNull();
    expect(boatSummary(s.journal)).toContain('送到了何娘手里');
    const both=run([...rope,{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'observe'}],s);
    expect(boatSummary(both.journal)).toContain('一回随阿成');
    expect(boatSummary(run([...rope,{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'observe'}]).journal)).toContain('站在岸边');
  });
  it('猫与茶炉的中心点按邻近归给环境，人物身上仍归人物',()=>{
    const g=run([{type:'START'}]);
    for(const scale of [.35,.6,1]){
      expect(pickHotspot(2525,774,g,scale)).toEqual({kind:'environment',id:'cat'});
      expect(pickHotspot(2190,755,g,scale)).toEqual({kind:'environment',id:'brazier'});
      const chen=personPosition('chen',g);
      expect(pickHotspot(chen.x,chen.y-PERSON_HEIGHT*.48,g,scale)).toEqual({kind:'person',id:'chen'});
      const he=personPosition('he',g);
      expect(pickHotspot(he.x,he.y-PERSON_HEIGHT*.48,g,scale)).toEqual({kind:'person',id:'he'});
    }
    expect(pickHotspot(10,10,g,1)).toBeNull();
  });
});
