import type { ElectionResultSummary, ContestResult } from '../types/info';
import { cleanTurnout, officeGroup, type ResultsIndexEntry, type ResultsElection } from './sosResults';
import { getResultsData, whenElectionDataReady } from './electionDataStore';

/**
 * Historical results, built from the Secretary of State's archive by
 * `npm run data:results` (scripts/build-results.mts):
 *   /data/results/index.json          one entry per election
 *   /data/results/{yyyymmdd}.json     that election's contests (statewide + every parish's local races)
 * Plus results entered in Admin → Results and marked published (Firestore),
 * which win on the same electionId and update live.
 */
const BASE = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}data/results/`;

let indexPromise: Promise<ResultsIndexEntry[]> | null = null;
const electionCache = new Map<string, Promise<ResultsElection | null>>();

/**
 * Guards for files built before Nov 3, 2026: drop "-1" turnout (not recorded by
 * the SoS) and re-derive federal elections (U.S. Senate/House use codes 140/145).
 */
function sanitizeEntry(e: ResultsIndexEntry): ResultsIndexEntry {
  const turnout = cleanTurnout(e.turnout);
  const { turnout: _t, ...rest } = e;
  const federal = e.highlights.some((h) => /^(U\. ?S\. |Presidential)/i.test(h));
  return { ...rest, ...(turnout ? { turnout } : {}), ...(federal ? { electionType: 'federal' as const } : {}) };
}

function sanitizeElection(e: ResultsElection): ResultsElection {
  const turnout = cleanTurnout(e.turnout);
  const { turnout: _t, ...rest } = e;
  const contests = e.contests.map((c) => {
    const { registeredVoters, ballotsCast, ...cr } = c;
    return { ...cr, ...(registeredVoters && registeredVoters > 0 ? { registeredVoters } : {}), ...(ballotsCast && ballotsCast > 0 ? { ballotsCast } : {}) };
  });
  const federal = contests.some((c) => !c.parish && officeGroup(c.level) === 'Federal');
  return { ...rest, contests, ...(turnout ? { turnout } : {}), ...(federal ? { electionType: 'federal' } : {}) };
}

function staticIndex(): Promise<ResultsIndexEntry[]> {
  indexPromise ??= fetch(`${BASE}index.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (Array.isArray(j?.elections) ? (j.elections as ResultsIndexEntry[]).map(sanitizeEntry) : []))
    .catch(() => []);
  return indexPromise;
}

function staticElection(id: string): Promise<ResultsElection | null> {
  if (!/^\d{8}$/.test(id)) return Promise.resolve(null);
  if (!electionCache.has(id)) {
    electionCache.set(
      id,
      fetch(`${BASE}${id}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((e: ResultsElection | null) => (e ? sanitizeElection(e) : null))
        .catch(() => null),
    );
  }
  return electionCache.get(id)!;
}

function published(): ElectionResultSummary[] {
  return getResultsData()
    .filter((r) => r.published)
    .map(({ _docId: _ignored, ...r }) => r as ElectionResultSummary);
}

function entryFromSummary(e: ElectionResultSummary): ResultsIndexEntry {
  return {
    electionId: e.electionId,
    electionDate: e.electionDate,
    electionName: e.electionName,
    electionType: e.electionType,
    highlights: [...new Set(e.contests.map((c) => c.officeName || c.title))].slice(0, 4),
    contestCount: e.contests.length,
    statewideCount: e.contests.length,
    parishes: [],
    ...(e.turnout ? { turnout: e.turnout } : {}),
    official: false,
  };
}

/** Every election with results, newest first. */
export async function fetchResultsIndex(): Promise<ResultsIndexEntry[]> {
  const [statics] = await Promise.all([staticIndex(), whenElectionDataReady(4000)]);
  const byId = new Map<string, ResultsIndexEntry>(statics.map((e) => [e.electionId, e]));
  for (const p of published()) byId.set(p.electionId, entryFromSummary(p));
  return [...byId.values()].sort((a, b) => b.electionDate.localeCompare(a.electionDate));
}

/** @deprecated use fetchResultsIndex (kept for older callers). */
export async function fetchAllElections(): Promise<ElectionResultSummary[]> {
  const index = await fetchResultsIndex();
  return index.map((e) => ({ ...e, jurisdiction: 'Louisiana', contests: [] }));
}

export async function fetchElectionById(electionId: string): Promise<(ElectionResultSummary & Partial<ResultsElection>) | null> {
  await whenElectionDataReady(4000);
  const live = published().find((e) => e.electionId === electionId);
  if (live) return live as ElectionResultSummary & Partial<ResultsElection>;
  return staticElection(electionId);
}

export async function fetchContestById(
  electionId: string,
  contestId: string,
): Promise<{ election: ElectionResultSummary; contest: ContestResult } | null> {
  const election = await fetchElectionById(electionId);
  if (!election) return null;
  const contest = election.contests.find((c) => c.contestId === contestId);
  if (!contest) return null;
  return { election, contest };
}
