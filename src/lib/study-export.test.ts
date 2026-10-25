import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), innerWidth: 390, innerHeight: 844 });

const { BUILD } = await import('../build');
const { clearStudy, flushStudy, keepFields, readStudy, storeEvent } = await import('./study-log');
const { startVisit, noteCreation, clearVisits } = await import('./visits');
const { cleanParticipant, deleteStudyRecords, studyExport, studySummary } = await import('./study-export');

describe('what a field tester can export', () => {
  beforeEach(() => {
    store.clear();
    clearStudy();
    clearVisits();
  });

  it('writes events in batches, not on every event, and reads what is still waiting', () => {
    storeEvent('create', { what: 'fish' }, 1);
    expect(store.get('wonderlab.study')).toBeUndefined();
    expect(readStudy()).toHaveLength(1);
    flushStudy();
    expect(JSON.parse(store.get('wonderlab.study')!)).toHaveLength(1);
  });

  it('keeps events across visits, by wall-clock time', () => {
    storeEvent('gift_accepted', {}, 1000);
    storeEvent('create', { what: 'fish' }, 90000000);
    expect(readStudy().map((e) => e.type)).toEqual(['gift_accepted', 'create']);
    clearStudy();
    expect(readStudy()).toEqual([]);
  });

  it('exports the events and visits, each with the build that recorded it, and only an optional anonymous code', () => {
    startVisit(5);
    noteCreation(6);
    storeEvent('gift_accepted', {}, 7);
    const out = studyExport(' p01 ', new Date(0));
    expect(out.participant).toBe('P01');
    expect(out.exportedBy).toMatchObject({ experiment: 'dev', schema: 2 });
    expect(out.events).toEqual([{ t: 7, type: 'gift_accepted', sha: BUILD.sha, exp: 'dev', schema: 2 }]);
    expect(out.visits).toEqual([{ at: 5, ms: 1, creations: 1, sha: BUILD.sha, exp: 'dev' }]);
    expect(out.builds).toEqual([{ experiment: 'dev', sha: BUILD.sha, events: 1, visits: 1, from: 5, to: 7 }]);
    expect(out.mixedBuilds).toBe(false);
    expect(Object.keys(out).sort()).toEqual(['builds', 'device', 'events', 'exportedAt', 'exportedBy', 'mixedBuilds', 'participant', 'visits']);
    expect(studySummary()).toEqual({ visits: 1, creations: 1, events: 1, giftsTaken: 1, builds: 1 });
  });

  it('refuses anything but a short code as the participant: no names', () => {
    expect(cleanParticipant('P07')).toBe('P07');
    expect(cleanParticipant('李明')).toBeUndefined();
    expect(cleanParticipant('someone@example.com')).toBeUndefined();
    expect(cleanParticipant('')).toBeUndefined();
    expect('participant' in studyExport('张三')).toBe(false);
  });

  it('the tester can delete everything this device kept for the study', () => {
    startVisit(1);
    storeEvent('create', { what: 'fish' }, 2);
    deleteStudyRecords();
    expect(studySummary()).toEqual({ visits: 0, creations: 0, events: 0, giftsTaken: 0, builds: 0 });
  });
});

describe('after the site is updated mid-study', () => {
  beforeEach(() => {
    store.clear();
    clearStudy();
    clearVisits();
  });

  it('older records keep the build that recorded them; the export lists both builds', () => {
    // What the previous deployment left on the device.
    store.set('wonderlab.study', JSON.stringify([{ t: 100, type: 'create', what: 'fish', sha: 'aaa111', exp: 'poc-r1', schema: 2 }]));
    store.set('wonderlab.visits', JSON.stringify([{ at: 90, ms: 5000, creations: 1, sha: 'aaa111', exp: 'poc-r1' }]));
    // The updated build opens and records.
    startVisit(200);
    storeEvent('create', { what: 'moon' }, 210);
    const out = studyExport('', new Date(0));
    expect(out.events.map((e) => [e.what, e.sha])).toEqual([
      ['fish', 'aaa111'],
      ['moon', BUILD.sha],
    ]);
    expect(out.visits.map((v) => v.sha)).toEqual(['aaa111', BUILD.sha]);
    expect(out.builds.map((b) => `${b.experiment}@${b.sha}`)).toEqual([`poc-r1@aaa111`, `dev@${BUILD.sha}`]);
    expect(out.builds[0]).toMatchObject({ events: 1, visits: 1, from: 90, to: 100 });
    expect(out.mixedBuilds).toBe(true);
    expect(studySummary().builds).toBe(2);
  });

  it('records from before build stamping are marked unknown, never given the current build', () => {
    store.set('wonderlab.study', JSON.stringify([{ t: 100, type: 'create', what: 'fish' }]));
    store.set('wonderlab.visits', JSON.stringify([{ at: 90, ms: 5000, creations: 1 }]));
    const out = studyExport('', new Date(0));
    expect(out.events[0]).toMatchObject({ sha: 'unknown', exp: 'unknown' });
    expect(out.visits[0]).toMatchObject({ sha: 'unknown', exp: 'unknown' });
    expect(out.builds.map((b) => b.sha)).toEqual(['unknown']);
  });
});

describe('only listed fields with safe values are ever kept', () => {
  beforeEach(() => {
    store.clear();
    clearStudy();
    clearVisits();
  });

  const leaks = ['我想你了', 'https://want.world/#gift=v1.AbC', '李明', 'someone@example.com', 'M10 20 L30 40'];

  it('drops words, links, names and strokes passed by mistake, at the store', () => {
    storeEvent('text_submit', {
      source: 'local',
      prompted: false,
      text: '我想你了',
      url: 'https://want.world/#gift=v1.AbC',
      name: '李明',
      stroke: [{ x: 1, y: 2 }],
      seal: '月',
    });
    expect(readStudy()[0]).toEqual({ t: expect.any(Number), type: 'text_submit', sha: BUILD.sha, exp: 'dev', schema: 2, source: 'local', prompted: false });
  });

  it('drops free text even in a listed field: a kept string is a code word', () => {
    for (const leak of leaks) expect(keepFields('create', { what: leak })).toEqual({});
    expect(keepFields('create', { what: 'fish', speed: 0.4, honmei: true })).toEqual({ what: 'fish', speed: 0.4, honmei: true });
    expect(keepFields('create', { speed: Number.NaN, what: { text: 'x' } })).toEqual({});
  });

  it('does not keep event types it does not know', () => {
    storeEvent('diary_entry', { what: 'fish' });
    expect(readStudy()).toEqual([]);
    expect(keepFields('diary_entry', {})).toBeNull();
  });

  it('cleans what is already on the device before exporting it', () => {
    store.set(
      'wonderlab.study',
      JSON.stringify([
        { t: 1, type: 'create', what: 'fish', sha: 'aaa111', exp: 'poc-r1', schema: 2, text: '我想你了', url: 'https://want.world/#gift=v1.AbC' },
        { t: 2, type: 'diary_entry', note: '李明' },
        { t: 3, type: 'gift_failed', reason: 'someone@example.com', sha: 'https://x', exp: 'poc-r1', schema: 2 },
      ]),
    );
    const json = JSON.stringify(studyExport('', new Date(0)));
    for (const leak of leaks) expect(json).not.toContain(leak);
    expect(json).not.toContain('https');
    const out = studyExport('', new Date(0));
    expect(out.events).toEqual([
      { t: 1, type: 'create', what: 'fish', sha: 'aaa111', exp: 'poc-r1', schema: 2 },
      { t: 3, type: 'gift_failed', sha: 'unknown', exp: 'poc-r1', schema: 2 },
    ]);
  });

  it('every field the app logs today is listed, so nothing real is lost', () => {
    // From the logEvent calls in App.tsx, engine.ts, RecordControl.tsx and telemetry.ts.
    expect(keepFields('world_ready', { ms: 900, device: 'phone', tier: 'standard', buildSha: 'abc123-dirty', experimentId: 'poc-r1', schemaVersion: 2 })).toHaveProperty('buildSha', 'abc123-dirty');
    expect(keepFields('text_submit', { source: 'ai', rule: 'keyword', prompted: true, fish: '', fishAnswered: false })).toEqual({ source: 'ai', rule: 'keyword', prompted: true, fish: '', fishAnswered: false });
    expect(Object.keys(keepFields('create', { what: 'fish', prompted: false, variety: 'kohaku', family: 'brisk', affinity: true, honmei: true, speed: 0.5, bend: 0.2, pointer: 'touch' })!)).toHaveLength(9);
    expect(keepFields('gift_sent', { how: 'shared', seal: true, chars: 160 })).toEqual({ how: 'shared', seal: true, chars: 160 });
  });
});

describe("the moderator's in-memory log uses the same list", () => {
  it('drops unlisted fields there too', async () => {
    vi.stubGlobal('performance', { now: () => 1 });
    const { logEvent, readLog } = await import('../telemetry');
    logEvent('text_submit', { source: 'local', text: '我想你了' } as never);
    expect(readLog().at(-1)).toEqual({ t: 1, type: 'text_submit', source: 'local' });
  });
});
