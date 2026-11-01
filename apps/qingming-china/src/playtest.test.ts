import { describe, expect, it } from 'vitest';
import { initialState, parseSave, reduceGame, type Action } from './game';
import { reachedTimes, timeOf } from './time';
import { createStudy, hasPlayableProgress, observeProgress } from './study';
const paper: Action[] = [{type:'PRESS_PAPER'},{type:'SKETCH',view:'hands'}];
const gate: Action[] = [{type:'GATE_TALK'},{type:'GATE_LANDMARK',landmark:'silk'},{type:'GATE_WAIT',place:'eaves'},{type:'GATE_SKETCH'}];
const harbor: Action[] = [{type:'HARBOR_TALK'},{type:'HARBOR_PLACE',place:'eaves'},{type:'HARBOR_CLEAR',move:'basket'},{type:'HARBOR_SKETCH'}];
const run = (actions: Action[], state=initialState()) => actions.reduce(reduceGame,state);

describe('reached spring times and old saves',()=>{
  it('never opens a future time through a setting or import, and replay keeps reached times',()=>{
    let s=run([{type:'SETTINGS',settings:{timeChoice:'evening'}}]);
    expect(timeOf(parseSave(JSON.stringify(s))).id).toBe('morning');
    s=run([...paper,...gate,...harbor,{type:'REPLAY',quest:'paper'}],s);
    expect(reachedTimes(s)).toEqual(['morning','noon','evening']);
    const before=structuredClone(s);
    s=run([{type:'SETTINGS',settings:{timeChoice:'morning'}}],s);
    expect(timeOf(s).id).toBe('morning');expect(s.wallet).toBe(before.wallet);expect(s.claimed).toEqual(before.claimed);expect(s.journal).toEqual(before.journal);
    expect(timeOf(run([{type:'SETTINGS',settings:{timeChoice:'auto'}}],s)).id).toBe('evening');
  });
  it('loads v3 without the optional setting and preserves old progress; rejects unknown choices',()=>{
    const legacy=run(paper);delete legacy.settings.timeChoice;
    const restored=parseSave(JSON.stringify(legacy));
    expect(restored.settings.timeChoice).toBe('auto');expect(restored.journal).toEqual(legacy.journal);expect(restored.wallet).toBe(72);
    expect(()=>parseSave(JSON.stringify({...restored,settings:{...restored.settings,timeChoice:'midnight'}}))).toThrow();
  });
});

describe('local playtest records',()=>{
  it('records a story start only at the first valid boat rope and one completion per real transition',()=>{
    const recorder=createStudy('test','test-build');let s=initialState();
    const actions:Action[]=[{type:'ROPE',rope:0,target:1},{type:'ROPE',rope:0,target:0},{type:'ROPE',rope:0,target:0},{type:'ROPE',rope:1,target:1},{type:'ROPE',rope:2,target:2},{type:'TAG',tag:'tea'},{type:'BOAT_END',route:'deliver'},{type:'BOAT_END',route:'deliver'},{type:'REPLAY',quest:'boat'},{type:'ROPE',rope:0,target:0}];
    for(const a of actions){const next=reduceGame(s,a);observeProgress(s,next,recorder);s=next;}
    const events=recorder.snapshot().events;
    expect(events.filter(e=>e.type==='story_started')).toHaveLength(2);
    expect(events.filter(e=>e.type==='story_completed')).toHaveLength(1);
    expect(events.filter(e=>e.type==='first_interaction_completed')).toHaveLength(1);
    expect(s.wallet).toBe(84);
  });
  it('labels replay completions without changing money or emitting duplicate initial interaction',()=>{
    const recorder=createStudy('test','test-build');let s=initialState();
    for(const a of [...paper,{type:'REPLAY',quest:'paper'} as const,...paper]){const next=reduceGame(s,a);observeProgress(s,next,recorder);s=next;}
    expect(recorder.snapshot().events.filter(e=>e.type==='story_completed').map(e=>e.first_completion)).toEqual([true,false]);
    expect(s.wallet).toBe(72);expect(s.journal).toEqual(['paper-hands']);
    expect(hasPlayableProgress(initialState())).toBe(false);expect(hasPlayableProgress(s)).toBe(true);
  });
  it('keeps only fixed fields and error codes, without identities, raw errors or private links',()=>{
    const recorder=createStudy('test','test-build',event=>{event.type='error';throw new Error('debug');});
    expect(recorder.emit('world_entered',{source:'direct',email:'private',url:'https://private/'} as {source:'direct'})).toBe(true);
    expect(recorder.emit('error',{code:'save_import_failed',message:'private raw error'} as {code:'save_import_failed'})).toBe(true);
    expect(recorder.emit('error',{code:'private stack' as 'save_import_failed'})).toBe(false);
    const snapshot=recorder.snapshot();expect(snapshot.events[0].type).toBe('world_entered');expect(JSON.stringify(snapshot)).not.toMatch(/private|email|message|url/);
  });
  it('has ephemeral session IDs, bounded copies and explicit truncation',()=>{
    const a=createStudy('test','test-build'),b=createStudy('test','test-build');
    expect(a.snapshot().session_id).not.toBe(b.snapshot().session_id);
    for(let i=0;i<1002;i++)a.emit('journal_opened',{page_count:0});
    const snap=a.snapshot();expect(snap.events).toHaveLength(1000);expect(snap.dropped).toBe(2);
    expect(new Set(snap.events.map(e=>e.session_id))).toEqual(new Set([snap.session_id]));
    snap.events.length=0;expect(a.snapshot().events).toHaveLength(1000);
  });
});
