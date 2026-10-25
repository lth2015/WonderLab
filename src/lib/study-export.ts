// What a field tester can choose to export (docs/验证路线图.md §4): the
// visits and the stored events on this device, with the build they came
// from. Only times, counts and event types: no drawing, no words, no names,
// no links. The participant code is optional and typed by the tester.

import { BUILD } from '../build';
import { deviceType } from '../telemetry';
import { handOver } from './hand-over';
import { clearStudy, readStudy, type StoredEvent } from './study-log';
import { clearVisits, readVisits, type Visit } from './visits';

export interface StudyExport {
  exportedAt: string;
  /** Optional anonymous code such as P01, typed by the tester. */
  participant?: string;
  device: string;
  build: typeof BUILD;
  events: StoredEvent[];
  visits: Visit[];
}

/** Only an anonymous code: letters, digits and a dash, a dozen at most. */
export function cleanParticipant(input: string): string | undefined {
  const v = input.trim().toUpperCase();
  return /^[A-Z0-9-]{1,12}$/.test(v) ? v : undefined;
}

export function studySummary(): { visits: number; creations: number; events: number; giftsTaken: number } {
  const visits = readVisits();
  const events = readStudy();
  return {
    visits: visits.length,
    creations: visits.reduce((n, v) => n + v.creations, 0),
    events: events.length,
    giftsTaken: events.filter((e) => e.type === 'gift_accepted').length,
  };
}

export function studyExport(participantInput = '', now = new Date()): StudyExport {
  const participant = cleanParticipant(participantInput);
  return {
    exportedAt: now.toISOString(),
    ...(participant ? { participant } : {}),
    device: deviceType(),
    build: BUILD,
    events: readStudy(),
    visits: readVisits(),
  };
}

export function handOverStudy(participantInput: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = studyExport(participantInput);
  return handOver(`wonderful-world-study-${data.participant ?? 'anon'}-${Date.now()}.json`, data);
}

/** The tester's choice to delete what this device kept for the study. */
export function deleteStudyRecords(): void {
  clearStudy();
  clearVisits();
}
