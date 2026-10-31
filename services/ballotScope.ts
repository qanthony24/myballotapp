/**
 * Which races and candidates are on a particular voter's ballot. Pure
 * functions (tested in tests/districts.test.mts).
 *
 * A race's district key comes from, in order:
 *   1. the race's saved `districtKey` (Admin → Races), or
 *   2. its office's district type + district number:
 *        statewide              → "la"
 *        congressional, District 6  → "la-cd-6"
 *        state-senate,  District 15 → "la-sen-15"
 *        state-house,   District 61 → "la-house-61"
 *   Anything else (parishwide, council, school board, judicial, …) needs an
 *   explicit districtKey, because the app can't infer which parish/council it is.
 *
 * Status for a voter: 'yes' (on their ballot), 'no' (not on it), or
 * 'unknown' (we can't tell yet — shown separately, never silently hidden).
 */
import type { Candidate, Office, Race } from '../types';

export type BallotStatus = 'yes' | 'no' | 'unknown';

export function districtNumberFromLabel(label?: string): number | undefined {
  const m = (label || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}

export function derivedDistrictKey(office: Office | undefined, district?: string): string | undefined {
  if (!office?.districtType) return undefined;
  const n = districtNumberFromLabel(district);
  switch (office.districtType) {
    case 'statewide':
      return 'la';
    case 'congressional':
      return n ? `la-cd-${n}` : undefined;
    case 'state-senate':
      return n ? `la-sen-${n}` : undefined;
    case 'state-house':
      return n ? `la-house-${n}` : undefined;
    default:
      return undefined;
  }
}

export function raceDistrictKey(race: Pick<Race, 'districtKey' | 'officeId' | 'district'>, offices: Office[]): string | undefined {
  if (race.districtKey?.trim()) return race.districtKey.trim().toLowerCase();
  return derivedDistrictKey(offices.find((o) => o.id === race.officeId), race.district);
}

export function statusForKey(key: string | undefined, voterKeys: Set<string>): BallotStatus {
  if (!key) return 'unknown';
  return voterKeys.has(key) ? 'yes' : 'no';
}

export function raceBallotStatus(race: Pick<Race, 'districtKey' | 'officeId' | 'district'>, offices: Office[], voterKeys: Set<string>): BallotStatus {
  return statusForKey(raceDistrictKey(race, offices), voterKeys);
}

/**
 * A candidate's status uses their saved race (same office + district) if it
 * has a district key; otherwise the key is derived from office + district.
 */
export function candidateBallotStatus(candidate: Candidate, races: Race[], offices: Office[], voterKeys: Set<string>): BallotStatus {
  const sameDistrict = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  const race = races.find(
    (r) => !r._deleted && r.officeId === candidate.officeId && sameDistrict(r.district, candidate.district) && r.districtKey,
  );
  if (race) return raceBallotStatus(race, offices, voterKeys);
  return statusForKey(derivedDistrictKey(offices.find((o) => o.id === candidate.officeId), candidate.district), voterKeys);
}
