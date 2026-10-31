/**
 * Printable / shareable ballot helpers (pure functions; tested in
 * tests/ballotShare.test.mts).
 *
 * Share links carry the voter's picks in the URL itself (nothing is uploaded):
 *   /#/ballot/shared/<payload>
 * where payload is base64url JSON: { v: 1, e: "2026-11-03", c: [candidateIds], m: [[measureId, "s"|"o"]] }.
 */
import type { BallotEntry, BallotMeasure, Candidate, Office, Race } from '../types';
import { racesForElection, sameDistrict } from './races';
import { raceBallotStatus } from './ballotScope';

export interface SharedBallot {
  electionDate: string;
  candidateIds: number[];
  measures: { measureId: number; vote: 'support' | 'oppose' }[];
}

function toBase64Url(s: string): string {
  const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf-8');
}

export function encodeSharedBallot(electionDate: string, entries: BallotEntry[]): string {
  const c = entries.filter((e) => e.itemType === 'candidate').map((e) => (e as { candidateId: number }).candidateId);
  const m = entries
    .filter((e) => e.itemType === 'measure')
    .map((e) => {
      const ms = e as { measureId: number; vote: 'support' | 'oppose' };
      return [ms.measureId, ms.vote === 'support' ? 's' : 'o'];
    });
  return toBase64Url(JSON.stringify({ v: 1, e: electionDate, c, m }));
}

/** Returns null for anything malformed (links get mangled in texts/emails). */
export function decodeSharedBallot(payload: string): SharedBallot | null {
  try {
    const d = JSON.parse(fromBase64Url(payload));
    if (d?.v !== 1 || typeof d.e !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.e)) return null;
    const candidateIds = (Array.isArray(d.c) ? d.c : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0);
    const measures = (Array.isArray(d.m) ? d.m : [])
      .filter((x: unknown) => Array.isArray(x) && Number.isInteger(Number(x[0])) && (x[1] === 's' || x[1] === 'o'))
      .map((x: [number, string]) => ({ measureId: Number(x[0]), vote: x[1] === 's' ? 'support' : 'oppose' }) as const);
    return { electionDate: d.e, candidateIds, measures };
  } catch {
    return null;
  }
}

/** Turn a shared ballot back into ballot entries (candidates not found are skipped). */
export function sharedToEntries(shared: SharedBallot, candidates: Candidate[]): BallotEntry[] {
  const out: BallotEntry[] = [];
  for (const id of shared.candidateIds) {
    const c = candidates.find((x) => x.id === id);
    if (c) out.push({ itemType: 'candidate', candidateId: c.id, officeId: c.officeId, district: c.district });
  }
  for (const m of shared.measures) out.push({ itemType: 'measure', measureId: m.measureId, vote: m.vote });
  return out;
}

export interface PrintableRace {
  key: string;
  title: string;
  seats: number;
  choices: { name: string; party?: string }[];
  /** True when we couldn't confirm from the voter's address that this race is on their ballot. */
  uncertain: boolean;
}

export interface PrintableBallot {
  races: PrintableRace[];
  measures: { title: string; vote: 'YES' | 'NO' | null }[];
  /** Races the voter hasn't picked anyone in yet. */
  undecided: number;
}

function officeName(offices: Office[], id: number) {
  return offices.find((o) => o.id === id)?.name ?? 'Office';
}

/**
 * Build the printable ballot: every race on the voter's ballot (or, without an
 * address, every race in the election), in ballot order, with their picks.
 * Races ruled out by the voter's address are dropped unless they picked
 * someone in them.
 */
export function buildPrintableBallot(args: {
  electionId: number;
  electionDate: string;
  entries: BallotEntry[];
  candidates: Candidate[];
  races: Race[];
  offices: Office[];
  measures: BallotMeasure[];
  voterKeys: Set<string> | null;
}): PrintableBallot {
  const { electionId, electionDate, entries, candidates, races, offices, measures, voterKeys } = args;
  const picks = entries
    .filter((e) => e.itemType === 'candidate')
    .map((e) => candidates.find((c) => c.id === (e as { candidateId: number }).candidateId))
    .filter((c): c is Candidate => !!c);

  const out: PrintableRace[] = [];
  for (const race of racesForElection(electionId, races, candidates, offices)) {
    const chosen = picks.filter((c) => c.officeId === race.officeId && sameDistrict(c.district, race.district));
    const status = voterKeys ? raceBallotStatus(race, offices, voterKeys) : 'unknown';
    if (status === 'no' && chosen.length === 0) continue;
    out.push({
      key: race.id,
      title: race.district ? `${officeName(offices, race.officeId)}, ${race.district}` : officeName(offices, race.officeId),
      seats: race.seats ?? 1,
      choices: chosen.map((c) => ({ name: `${c.firstName} ${c.lastName}`.trim(), party: c.party || undefined })),
      uncertain: !!voterKeys && status === 'unknown',
    });
  }
  const measureRows = measures
    .filter((m) => m.electionDate === electionDate)
    .map((m) => {
      const stance = entries.find((e) => e.itemType === 'measure' && (e as { measureId: number }).measureId === m.id) as
        | { vote: 'support' | 'oppose' }
        | undefined;
      return { title: m.title, vote: stance ? (stance.vote === 'support' ? 'YES' : 'NO') : null } as const;
    });
  return {
    races: out,
    measures: measureRows.map((m) => ({ ...m })),
    undecided: out.filter((r) => r.choices.length === 0).length,
  };
}

/** Plain-text version for sharing by text message / email. */
export function ballotAsText(electionName: string, b: PrintableBallot): string {
  const lines = [`My ballot: ${electionName}`, ''];
  for (const r of b.races) {
    lines.push(`${r.title}: ${r.choices.length ? r.choices.map((c) => c.name + (c.party ? ` (${c.party})` : '')).join(', ') : '(no choice yet)'}`);
  }
  for (const m of b.measures) lines.push(`${m.title}: ${m.vote ?? '(no choice yet)'}`);
  return lines.join('\n');
}
