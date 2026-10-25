import { beforeEach, describe, expect, it, vi } from 'vitest';

// localStorage for node.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { clearVisits, NEW_VISIT_MS, noteCreation, readVisits, startVisit, visibilityChanged } = await import('./visits');

describe('visits (diary study)', () => {
  beforeEach(() => {
    store.clear();
    clearVisits();
  });

  it('records when a visit began, time on screen and how many things were made', () => {
    startVisit(1000);
    noteCreation(2000);
    noteCreation(3000);
    visibilityChanged(true, 61000);
    expect(readVisits()).toEqual([{ at: 1000, ms: 60000, creations: 2 }]);
  });

  it('does not count hidden time, and a short absence continues the visit', () => {
    startVisit(0);
    visibilityChanged(true, 10000);
    visibilityChanged(false, 70000);
    visibilityChanged(true, 80000);
    expect(readVisits()).toEqual([{ at: 0, ms: 20000, creations: 0 }]);
  });

  it('a long absence starts a new visit', () => {
    startVisit(0);
    visibilityChanged(true, 5000);
    visibilityChanged(false, 5000 + NEW_VISIT_MS);
    noteCreation(6000 + NEW_VISIT_MS);
    const v = readVisits();
    expect(v).toHaveLength(2);
    expect(v[1]).toMatchObject({ at: 5000 + NEW_VISIT_MS, creations: 1 });
  });

  it('keeps no content: only times and counts', () => {
    startVisit(5);
    noteCreation(6);
    expect(Object.keys(readVisits()[0]).sort()).toEqual(['at', 'creations', 'ms']);
  });
});
