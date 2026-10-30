import type { ElectionResultSummary, ContestResult } from '../types/info';
import { getResultsData, whenElectionDataReady } from './electionDataStore';

// Historical results shipped with the app, served from public/data/results/elections.json.
const ELECTIONS_URL = '/data/results/elections.json';

let cachedStatic: ElectionResultSummary[] | null = null;

async function fetchStaticElections(): Promise<ElectionResultSummary[]> {
  if (cachedStatic) return cachedStatic;
  try {
    const res = await fetch(ELECTIONS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedStatic = (await res.json()) as ElectionResultSummary[];
  } catch (err) {
    console.warn('Static results unavailable:', err);
    cachedStatic = [];
  }
  return cachedStatic;
}

/**
 * All results voters can see: the static file plus results entered in
 * Admin → Results that are marked published (Firestore wins on the same
 * electionId). Live: the store updates as an admin saves, so callers that
 * re-run on useElectionData().version show new numbers within seconds.
 */
export async function fetchAllElections(): Promise<ElectionResultSummary[]> {
  const [statics] = await Promise.all([fetchStaticElections(), whenElectionDataReady(4000)]);
  const published = getResultsData()
    .filter((r) => r.published)
    .map(({ _docId: _ignored, ...r }) => r as ElectionResultSummary);
  const byId = new Map<string, ElectionResultSummary>();
  for (const e of statics) byId.set(e.electionId, e);
  for (const e of published) byId.set(e.electionId, e);
  return [...byId.values()].sort(
    (a, b) => new Date(b.electionDate).getTime() - new Date(a.electionDate).getTime(),
  );
}

export async function fetchElectionById(electionId: string): Promise<ElectionResultSummary | null> {
  const elections = await fetchAllElections();
  return elections.find((e) => e.electionId === electionId) ?? null;
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
