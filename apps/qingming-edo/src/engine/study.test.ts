import { describe, expect, it } from 'vitest';
import { apply, newSave } from './state';
import { questById } from '../content/world';
import { createStudy, hasPlayableProgress, observeProgress } from './study';

describe('試遊の記録 (same schema as the China work)', () => {
  it('records a story start at its first real step and a completion once', () => {
    const r = createStudy('test', 'b1');
    let s = newSave();
    const step = (effects: Parameters<typeof apply>[1]) => {
      const next = apply(s, effects);
      observeProgress(s, next, r);
      s = next;
    };
    step([{ type: 'setFlag', flag: 'met_seita' }]); // greeting only: nothing
    step([{ type: 'questState', quest: 'kaze', state: 'discovered' }]);
    step([{ type: 'questState', quest: 'kaze', state: 'active' }]);
    step(questById.get('kaze')!.completionEffects);
    const types = r.snapshot().events.map((e) => [e.type, e.story_id ?? e.interaction_id ?? '', e.first_completion ?? '']);
    expect(types).toEqual([
      ['first_interaction_completed', 'kaze', ''],
      ['story_started', 'kaze', ''],
      ['story_completed', 'kaze', true],
    ]);
  });
  it('keeps only listed fields and values, and never a save or free text', () => {
    const r = createStudy('test', 'b1');
    expect(r.emit('error', { code: 'save_write_failed' })).toBe(true);
    expect(r.emit('error', { code: 'Error: /home/me/secret.json' as never })).toBe(false);
    expect(r.emit('journal_export_attempted', { page_id: 'p01-kaze', export_type: 'png', name: 'Taro' } as never)).toBe(true);
    const e = r.snapshot().events[1];
    expect(e).not.toHaveProperty('name');
    expect(e.world_id).toBe('qingming-edo');
    expect(Object.keys(e).sort()).toEqual(['build_id', 'elapsed_ms', 'environment', 'event_id', 'export_type', 'occurred_at', 'page_id', 'schema_version', 'session_id', 'type', 'world_id'].sort());
  });
  it('once-keys hold, the buffer is bounded and reports what it dropped', () => {
    const r = createStudy('test', 'b1');
    expect(r.emit('world_entered', { source: 'direct' }, 'w')).toBe(true);
    expect(r.emit('world_entered', { source: 'direct' }, 'w')).toBe(false);
    for (let i = 0; i < 1005; i++) r.emit('journal_opened', { page_count: 1 });
    const snap = r.snapshot();
    expect(snap.events).toHaveLength(1000);
    expect(snap.dropped).toBe(6);
  });
  it('a fresh save has no progress; a met person does', () => {
    expect(hasPlayableProgress(newSave())).toBe(false);
    expect(hasPlayableProgress(apply(newSave(), [{ type: 'setFlag', flag: 'met_seita' }]))).toBe(true);
  });
  it('a guide stop is recorded by its fixed id only, and is not a first interaction', () => {
    const r = createStudy('test', 'b1');
    expect(r.emit('guide_stop_selected', { stop_id: 'cooper' })).toBe(true);
    expect(r.emit('guide_stop_selected', { stop_id: 'somewhere else' })).toBe(false);
    expect(r.snapshot().events.map((e) => e.type)).toEqual(['guide_stop_selected']);
  });
});

describe('試遊会 (?session=1): the log survives a reload', () => {
  const memStore = () => {
    const m = new Map<string, string>();
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('restores the same player, events and once-keys after a reload', () => {
    const store = memStore();
    let t = 1_000;
    const wall = () => t;
    const a = createStudy('playtest-session', 'b1', () => 0, { store, key: 'k' }, wall);
    a.emit('world_entered', { source: 'direct' }, 'world-entered');
    t = 61_000;
    a.emit('journal_opened', { page_count: 1 });
    // reload: a new recorder on the same key
    t = 121_000;
    const b = createStudy('playtest-session', 'b1', () => 0, { store, key: 'k' }, wall);
    expect(b.snapshot().session_id).toBe(a.snapshot().session_id);
    expect(b.emit('world_entered', { source: 'direct' }, 'world-entered')).toBe(false); // once stays once
    b.emit('journal_opened', { page_count: 2 });
    const ev = b.snapshot().events;
    expect(ev.map((e) => e.type)).toEqual(['world_entered', 'journal_opened', 'journal_opened']);
    expect(ev.map((e) => e.elapsed_ms)).toEqual([0, 60_000, 120_000]); // from this player's start
  });

  it('starts a new player when the kept log is missing or broken', () => {
    const store = memStore();
    store.m.set('k', '{broken');
    const a = createStudy('playtest-session', 'b1', () => 0, { store, key: 'k' });
    a.emit('world_entered', { source: 'direct' });
    expect(a.snapshot().events).toHaveLength(1);
    store.m.delete('k');
    const b = createStudy('playtest-session', 'b1', () => 0, { store, key: 'k' });
    expect(b.snapshot().session_id).not.toBe(a.snapshot().session_id);
    expect(b.snapshot().events).toHaveLength(0);
  });

  it('keeps nothing in storage without 試遊会', () => {
    const r = createStudy('production', 'b1');
    r.emit('world_entered', { source: 'direct' });
    expect(r.snapshot().events).toHaveLength(1); // memory only, as before
  });

  it('drops kept events that belong to another session or work', () => {
    const store = memStore();
    const a = createStudy('playtest-session', 'b1', () => 0, { store, key: 'k' });
    a.emit('world_entered', { source: 'direct' });
    const kept = JSON.parse(store.m.get('k')!);
    kept.events.push({ ...kept.events[0], session_id: 'other' }, { ...kept.events[0], world_id: 'qingming-china' });
    store.m.set('k', JSON.stringify(kept));
    expect(createStudy('playtest-session', 'b1', () => 0, { store, key: 'k' }).snapshot().events).toHaveLength(1);
  });
});
