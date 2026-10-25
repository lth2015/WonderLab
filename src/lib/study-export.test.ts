import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), innerWidth: 390, innerHeight: 844 });

const { clearStudy, readStudy, storeEvent } = await import('./study-log');
const { startVisit, noteCreation, clearVisits } = await import('./visits');
const { cleanParticipant, deleteStudyRecords, studyExport, studySummary } = await import('./study-export');

describe('what a field tester can export', () => {
  beforeEach(() => {
    store.clear();
    clearVisits();
  });

  it('writes events in batches, not on every event, and reads what is still waiting', async () => {
    const { flushStudy } = await import('./study-log');
    storeEvent({ t: 1, type: 'create', what: 'fish' });
    expect(store.get('wonderlab.study')).toBeUndefined();
    expect(readStudy()).toHaveLength(1);
    flushStudy();
    expect(JSON.parse(store.get('wonderlab.study')!)).toHaveLength(1);
    clearStudy();
  });

  it('keeps events across visits, by wall-clock time', () => {
    storeEvent({ t: 1000, type: 'gift_accepted' });
    storeEvent({ t: 90000000, type: 'create', what: 'fish' });
    expect(readStudy().map((e) => e.type)).toEqual(['gift_accepted', 'create']);
    clearStudy();
    expect(readStudy()).toEqual([]);
  });

  it('exports the build, events and visits, with only an optional anonymous code', () => {
    startVisit(5);
    noteCreation(6);
    storeEvent({ t: 7, type: 'gift_accepted' });
    const out = studyExport(' p01 ', new Date(0));
    expect(out.participant).toBe('P01');
    expect(out.build).toMatchObject({ experiment: 'dev', schema: 2 });
    expect(out.events).toHaveLength(1);
    expect(out.visits).toEqual([{ at: 5, ms: 1, creations: 1 }]);
    expect(Object.keys(out).sort()).toEqual(['build', 'device', 'events', 'exportedAt', 'participant', 'visits']);
    expect(studySummary()).toEqual({ visits: 1, creations: 1, events: 1, giftsTaken: 1 });
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
    storeEvent({ t: 2, type: 'create', what: 'fish' });
    deleteStudyRecords();
    expect(studySummary()).toEqual({ visits: 0, creations: 0, events: 0, giftsTaken: 0 });
  });
});
