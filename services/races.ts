/**
 * Race helpers (pure functions; no Firebase). Used by the admin races and
 * results screens, and covered by tests/races.test.mts.
 *
 * A candidate is in a race when: candidate.officeId === race.officeId,
 * candidate.district (or '') === race.district (or ''), and
 * candidate.cycleIds includes race.electionId.
 */
import type { Candidate, Office, Race } from '../types';

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Deterministic race id, e.g. "5-2-district-61" or "5-9-all". */
export function raceId(electionId: number, officeId: number, district?: string): string {
  return `${electionId}-${officeId}-${slugify(district || '') || 'all'}`;
}

export function sameDistrict(a?: string, b?: string): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

export function candidatesInRace(race: Pick<Race, 'electionId' | 'officeId' | 'district'>, candidates: Candidate[]): Candidate[] {
  return candidates
    .filter(
      (c) =>
        c.officeId === race.officeId &&
        sameDistrict(c.district, race.district) &&
        (c.cycleIds || []).includes(race.electionId),
    )
    .sort((a, b) => (a.ballotOrder ?? 0) - (b.ballotOrder ?? 0) || a.lastName.localeCompare(b.lastName));
}

/**
 * Races for an election: saved races, plus "inferred" races implied by
 * candidates whose office/district has no saved race yet (shown in admin so
 * nothing is invisible; saving them makes them real).
 */
export function racesForElection(electionId: number, races: Race[], candidates: Candidate[], offices: Office[]): Race[] {
  const saved = races.filter((r) => r.electionId === electionId && !r._deleted);
  const inferred: Race[] = [];
  for (const c of candidates) {
    if (!(c.cycleIds || []).includes(electionId)) continue;
    const known = [...saved, ...inferred].some((r) => r.officeId === c.officeId && sameDistrict(r.district, c.district));
    if (!known) {
      inferred.push({
        id: raceId(electionId, c.officeId, c.district),
        electionId,
        officeId: c.officeId,
        district: c.district || '',
        seats: 1,
        _inferred: true,
      });
    }
  }
  const officeOrder = (id: number) => {
    const i = offices.findIndex((o) => o.id === id);
    return i === -1 ? 9999 : i;
  };
  return [...saved, ...inferred].sort(
    (a, b) =>
      (a.ballotOrder ?? 9999) - (b.ballotOrder ?? 9999) ||
      officeOrder(a.officeId) - officeOrder(b.officeId) ||
      (a.district || '').localeCompare(b.district || '', undefined, { numeric: true }),
  );
}

/** Next id for an admin-created candidate. Kept ≥ 100000, above the pipeline's 10000–90000 hash range. */
export function nextCandidateId(candidates: Candidate[]): number {
  return Math.max(100000, ...candidates.map((c) => c.id + 1));
}

export function nextNumericId(items: { id: number }[], floor = 1): number {
  return Math.max(floor, ...items.map((i) => i.id + 1));
}

/** Split "Jane Q. Doe" → { firstName: "Jane Q.", lastName: "Doe" }. Handles "Jr."/"III" suffixes. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  const suffix = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
  let last = parts.pop() as string;
  if (suffix.test(last) && parts.length > 1) last = `${parts.pop()} ${last}`;
  return { firstName: parts.join(' '), lastName: last };
}

const PARTY_CODES: Record<string, string> = {
  r: 'Republican',
  rep: 'Republican',
  d: 'Democratic',
  dem: 'Democratic',
  i: 'Independent',
  ind: 'Independent',
  l: 'Libertarian',
  lib: 'Libertarian',
  g: 'Green',
  grn: 'Green',
  np: 'No Party',
  noparty: 'No Party',
  npt: 'Nonpartisan',
  nonpartisan: 'Nonpartisan',
  o: 'Other',
};

export function normalizeParty(p: string): string {
  const key = p.trim().toLowerCase().replace(/[^a-z]/g, '');
  return PARTY_CODES[key] ?? p.trim();
}

/** Parse "Jane Doe (R); John Roe (Dem); Pat Poe" into names + parties. */
export function parseCandidateList(cell: string): { name: string; party: string }[] {
  return cell
    .split(/;|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      return m ? { name: m[1].trim(), party: normalizeParty(m[2]) } : { name: entry, party: '' };
    });
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else current += ch;
  }
  result.push(current);
  return result;
}

export interface ParsedRaceRow {
  row: number;
  officeId: number;
  district: string;
  districtKey: string;
  seats: number;
  ballotOrder?: number;
  candidates: { name: string; party: string }[];
}

/**
 * Parse the races CSV. Columns (header names, any order, case-insensitive):
 *   office (required; office name or id), district, district_key, seats,
 *   ballot_order, candidates ("Name (Party); Name (Party)")
 */
export function parseRacesCsv(text: string, offices: Office[]): { rows: ParsedRaceRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ['The CSV needs a header row and at least one race.'] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const col = (name: string) => headers.indexOf(name);
  if (col('office') === -1) return { rows: [], errors: ['Missing required column: office'] };

  const rows: ParsedRaceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const v = parseCsvLine(lines[i]);
    const get = (name: string) => (col(name) === -1 ? '' : (v[col(name)] ?? '').trim());
    const officeCell = get('office');
    const office =
      offices.find((o) => String(o.id) === officeCell) ||
      offices.find((o) => o.name.toLowerCase() === officeCell.toLowerCase()) ||
      offices.find((o) => o.slug === slugify(officeCell));
    if (!office) {
      errors.push(`Row ${i + 1}: unknown office "${officeCell}". Add it under Admin → Offices first.`);
      continue;
    }
    const seats = parseInt(get('seats') || '1', 10);
    const order = get('ballot_order');
    rows.push({
      row: i + 1,
      officeId: office.id,
      district: get('district'),
      districtKey: get('district_key'),
      seats: Number.isFinite(seats) && seats > 0 ? seats : 1,
      ballotOrder: order ? parseInt(order, 10) : undefined,
      candidates: parseCandidateList(get('candidates')),
    });
  }
  return { rows, errors };
}

export const RACES_CSV_TEMPLATE = [
  'office,district,district_key,seats,ballot_order,candidates',
  'Governor,,,1,1,"Jane Doe (R); John Roe (D)"',
  'State Representative,District 61,la-house-61,1,20,"Pat Poe (D); Sam Soe (R)"',
].join('\n');
