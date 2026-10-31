import { describe, expect, it } from 'vitest';
import { targetsAt, type TargetBounds } from './hit-targets';

// Independent screen-space fixtures for the reported overlaps at scale1.
const chen:TargetBounds={target:{kind:'person',id:'chen',label:'与陈生交谈'},left:2430.6,right:2529.4,top:652.8,bottom:807.1};
const cat:TargetBounds={target:{kind:'environment',id:'cat',label:'摸摸猫'},left:2501,right:2549,top:750,bottom:798};
const he:TargetBounds={target:{kind:'person',id:'he',label:'与何娘交谈'},left:2160.6,right:2259.4,top:605.8,bottom:760.1};
const brazier:TargetBounds={target:{kind:'environment',id:'brazier',label:'看看茶炉'},left:2166,right:2214,top:731,bottom:779};

describe('画中邻近目标消歧',()=>{
  it('猫中心保留猫和陈生两种意图，猫排在前面',()=>{
    expect(targetsAt(2525,774,[chen,cat]).map(t=>t.id)).toEqual(['cat','chen']);
  });
  it('茶炉中心不会丢掉环境目标',()=>{
    expect(targetsAt(2190,755,[he,brazier]).map(t=>t.id)).toEqual(['brazier','he']);
  });
  it('小屏48px触控区重叠时仍保留两种目标',()=>{
    const small:TargetBounds[]=[{...chen,left:100,right:148,top:100,bottom:148},{...cat,left:124,right:172,top:120,bottom:168}];
    expect(targetsAt(140,140,small).map(t=>t.id)).toEqual(['cat','chen']);
  });
  it('最多给出三个选择，离触点最近的先显示',()=>{
    const bounds:TargetBounds[]=Array.from({length:5},(_,i)=>({target:{kind:'environment',id:String(i),label:'可选小物'},left:i,right:50+i,top:0,bottom:50}));
    expect(targetsAt(29,25,bounds).map(t=>t.id)).toEqual(['4','3','2']);
  });
  it('空白处没有目标，未重叠区域只保留真正命中的人物',()=>{
    expect(targetsAt(0,0,[chen,cat])).toEqual([]);
    expect(targetsAt(2480,700,[chen,cat]).map(t=>t.id)).toEqual(['chen']);
  });
});
