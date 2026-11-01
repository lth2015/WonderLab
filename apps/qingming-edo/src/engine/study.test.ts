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
});
