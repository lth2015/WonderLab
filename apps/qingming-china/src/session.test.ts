import { describe, expect, it } from 'vitest';
import { createStudy } from './study';
import { clearSessionKeys, NORMAL_SAVE_KEY, SESSION_SAVE_KEY, SESSION_STUDY_KEY } from './session';
const memory = () => {
  const data = new Map<string,string>();
  return { data, getItem: (k:string) => data.get(k) ?? null, setItem: (k:string,v:string) => { data.set(k,v); }, removeItem: (k:string) => { data.delete(k); } };
};
const make = (store: ReturnType<typeof memory>, wall:()=>number=()=>1000) => createStudy('playtest-session','test-build',undefined,{store,key:SESSION_STUDY_KEY},wall,()=>0);

describe('facilitated playtest sessions',()=>{
  it('refresh resumes the same player, wall elapsed time and once keys',()=>{
    const store=memory();let wall=1000;
    const a=make(store,()=>wall);a.emit('world_entered',{source:'direct'},'world-entered');
    const sid=a.snapshot().session_id;wall=4500;
    const b=make(store,()=>wall);expect(b.snapshot().session_id).toBe(sid);expect(b.elapsed()).toBe(3500);
    expect(b.emit('world_entered',{source:'direct'},'world-entered')).toBe(false);
    b.emit('story_started',{story_id:'paper'});
    expect(b.snapshot().events).toHaveLength(2);expect(b.snapshot().events[1].elapsed_ms).toBe(3500);
    const raw=JSON.parse(store.getItem(SESSION_STUDY_KEY)!);expect(Object.keys(raw).sort()).toEqual(['session_id','started_wall','dropped','seen','events'].sort());expect(raw.started_wall).toBe(1000);
  });
  it('corrupt or missing kept data starts a new player without affecting ordinary progress',()=>{
    const store=memory();store.setItem(NORMAL_SAVE_KEY,'ordinary-progress');
    for(const raw of ['{broken',JSON.stringify({session_id:'broken',started_wall:null,events:[],seen:[]}),JSON.stringify({session_id:'broken',started_wall:Infinity,events:[],seen:[]})]){
      store.setItem(SESSION_STUDY_KEY,raw);const r=make(store);expect(r.snapshot().session_id).not.toBe('broken');expect(r.snapshot().events).toEqual([]);expect(store.getItem(NORMAL_SAVE_KEY)).toBe('ordinary-progress');
    }
  });
  it('restores only this player/world/schema and revalidates fixed event fields',()=>{
    const store=memory(),r=make(store);r.emit('world_entered',{source:'direct'},'world-entered');
    const raw=JSON.parse(store.getItem(SESSION_STUDY_KEY)!),event=raw.events[0];
    raw.events=[{...event,email:'private-address',dialogue:'private words'},{...event,session_id:'another-player'},{...event,world_id:'qingming-edo'},{...event,type:'constructor'},{...event,schema_version:9}];
    store.setItem(SESSION_STUDY_KEY,JSON.stringify(raw));const restored=make(store).snapshot();
    expect(restored.events).toHaveLength(1);expect(restored.events[0].environment).toBe('playtest-session');expect(JSON.stringify(restored)).not.toMatch(/private|another-player|qingming-edo|constructor/);
  });
  it('bounds restored logs to 1000 and carries the dropped count forward',()=>{
    const store=memory(),r=make(store);r.emit('world_entered',{source:'direct'});
    const raw=JSON.parse(store.getItem(SESSION_STUDY_KEY)!);raw.dropped=7;raw.events=Array.from({length:1003},(_,i)=>({...raw.events[0],event_id:'event-'+i}));store.setItem(SESSION_STUDY_KEY,JSON.stringify(raw));
    const restored=make(store).snapshot();expect(restored.events).toHaveLength(1000);expect(restored.dropped).toBe(10);expect(restored.events[0].event_id).toBe('event-3');
  });
  it('blocked writes retain a usable in-memory record',()=>{
    const store=memory();store.setItem=()=>{throw new Error('blocked');};
    const r=make(store);expect(()=>r.emit('world_entered',{source:'direct'})).not.toThrow();expect(r.snapshot().events).toHaveLength(1);
  });
  it('next player clears only the two session keys and rejects a silent failed removal',()=>{
    const store=memory();for(const key of [NORMAL_SAVE_KEY,SESSION_SAVE_KEY,SESSION_STUDY_KEY,'another-world'])store.setItem(key,'kept');
    clearSessionKeys(store);expect(store.getItem(NORMAL_SAVE_KEY)).toBe('kept');expect(store.getItem('another-world')).toBe('kept');expect(store.getItem(SESSION_SAVE_KEY)).toBeNull();expect(store.getItem(SESSION_STUDY_KEY)).toBeNull();
    store.setItem(SESSION_SAVE_KEY,'not-removed');store.removeItem=()=>{};expect(()=>clearSessionKeys(store)).toThrow();expect(store.getItem(NORMAL_SAVE_KEY)).toBe('kept');
  });
});
