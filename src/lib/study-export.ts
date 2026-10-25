// What a field tester can choose to export (docs/验证路线图.md §5): the
// visits and the stored events on this device, with the build they came
// from. Only times, counts and event types: no drawing, no words, no names,
// no links. The participant code is optional and typed by the tester.

import { BUILD } from '../build';
import { deviceType } from '../telemetry';
import { handOver } from './hand-over';
import { buildSpans, type BuildSpan } from './record-builds';
import { clearStudy, readStudy, type StoredEvent } from './study-log';
import { clearVisits, readVisits, type Visit } from './visits';

export interface StudyExport {
  exportedAt: string;
  /** Optional anonymous code such as P01, typed by the tester. */
  participant?: string;
  device: string;
  /** Only the build doing the export. Each event and visit names the build that recorded it. */
  exportedBy: typeof BUILD;
  /** Every build the records came from, oldest first. */
  builds: BuildSpan[];
  /** More than one build: the site was updated during the study, or records predate build stamping. */
  mixedBuilds: boolean;
  events: StoredEvent[];
  visits: Visit[];
}

/** Only an anonymous code: letters, digits and a dash, a dozen at most. */
export function cleanParticipant(input: string): string | undefined {
  const v = input.trim().toUpperCase();
  return /^[A-Z0-9-]{1,12}$/.test(v) ? v : undefined;
}

export function studySummary(): { visits: number; creations: number; events: number; giftsTaken: number; builds: number } {
  const visits = readVisits();
  const events = readStudy();
  return {
    visits: visits.length,
    creations: visits.reduce((n, v) => n + v.creations, 0),
    events: events.length,
    giftsTaken: events.filter((e) => e.type === 'gift_accepted').length,
    builds: buildSpans(events, visits).length,
  };
}

export function studyExport(participantInput = '', now = new Date()): StudyExport {
  const participant = cleanParticipant(participantInput);
  const events = readStudy();
  const visits = readVisits();
  const builds = buildSpans(events, visits);
  return {
    exportedAt: now.toISOString(),
    ...(participant ? { participant } : {}),
    device: deviceType(),
    exportedBy: BUILD,
    builds,
    mixedBuilds: builds.length > 1,
    events,
    visits,
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
