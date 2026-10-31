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
 *        bese / psc / supreme-court, District 8 → "la-bese-8", "la-psc-8", "la-supreme-8"
 *   or, for any office with a `districtKeyPrefix` (e.g. Metro Council →
 *   "ebr-council"): prefix + district number or letter → "ebr-council-10",
 *   "jdc-19-div-d". Anything else needs an explicit districtKey.
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

/** "District 10" → "10"; "Division D" → "d"; "" → undefined. */
export function districtToken(label?: string): string | undefined {
  const n = districtNumberFromLabel(label);
  if (n !== undefined) return String(n);
  const m = (label || '').trim().match(/(?:^|\s)([A-Za-z])$/);
  return m ? m[1].toLowerCase() : undefined;
}

export function derivedDistrictKey(office: Office | undefined, district?: string): string | undefined {
  if (!office) return undefined;
  const prefix = office.districtKeyPrefix?.trim().toLowerCase().replace(/-+$/, '');
  if (prefix) {
    const t = districtToken(district);
    return t ? `${prefix}-${t}` : district?.trim() ? undefined : prefix;
  }
  if (!office.districtType) return undefined;
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
    case 'bese':
      return n ? `la-bese-${n}` : undefined;
    case 'psc':
      return n ? `la-psc-${n}` : undefined;
    case 'supreme-court':
      return n ? `la-supreme-${n}` : undefined;
    default:
      return undefined;
  }
}

export function raceDistrictKey(race: Pick<Race, 'districtKey' | 'officeId' | 'district'>, offices: Office[]): string | undefined {
  if (race.districtKey?.trim()) return race.districtKey.trim().toLowerCase();
  return derivedDistrictKey(offices.find((o) => o.id === race.officeId), race.district);
}

/**
 * Districts that come from local map lookups rather than the Census, and the
 * parish they belong to (null = statewide maps we only have for some parishes).
 * Keep in sync with services/localDistricts.ts (a test checks this).
 */
export const LOCAL_KEY_PREFIXES: Record<string, string | null> = {
  'la-bese': null,
  'la-psc': null,
  'la-supreme': null,
  'ebr-council': 'parish-east-baton-rouge',
  'city-baker-council': 'parish-east-baton-rouge',
  'city-central-council': 'parish-east-baton-rouge',
  'city-zachary-council': 'parish-east-baton-rouge',
  'ebr-school': 'parish-east-baton-rouge',
  'central-school': 'parish-east-baton-rouge',
  'baker-school': 'parish-east-baton-rouge',
  'zachary-school': 'parish-east-baton-rouge',
  'jdc-19-div': 'parish-east-baton-rouge',
  'jdc-19-section': 'parish-east-baton-rouge',
  'br-city-court-div': 'parish-east-baton-rouge',
  'br-city-court-section': 'parish-east-baton-rouge',
  'ebr-precinct': 'parish-east-baton-rouge',
};

/** Local maps a fully-matched East Baton Rouge lookup always covers (used for the "couldn't reach" notice). */
export const EBR_LOCAL_PREFIXES_SHOWN = ['la-bese', 'la-psc', 'ebr-council', 'ebr-school', 'jdc-19-div'];

export function statusForKey(key: string | undefined, voterKeys: Set<string>): BallotStatus {
  if (!key) return 'unknown';
  if (voterKeys.has(key)) return 'yes';
  const prefix = Object.keys(LOCAL_KEY_PREFIXES)
    .filter((p) => key.startsWith(`${p}-`))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix && !voterKeys.has(`checked:${prefix}`)) {
    // We haven't looked this map up for the voter. Rule it out only if it
    // belongs to another parish; otherwise we can't tell.
    const owner = LOCAL_KEY_PREFIXES[prefix];
    const voterParish = [...voterKeys].find((k) => k.startsWith('parish-'));
    return owner && voterParish && voterParish !== owner ? 'no' : 'unknown';
  }
  return 'no';
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
