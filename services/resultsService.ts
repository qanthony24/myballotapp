import type { ElectionResultSummary, ContestResult } from '../types/info';

const ELECTIONS_URL = '/data/results/elections.json';

let cachedElections: ElectionResultSummary[] | null = null;

export async function fetchAllElections(): Promise<ElectionResultSummary[]> {
  if (cachedElections) return cachedElections;

  try {
    const res = await fetch(ELECTIONS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: ElectionResultSummary[] = await res.json();

    data.sort(
      (a, b) =>
        new Date(b.electionDate).getTime() -
        new Date(a.electionDate).getTime()
    );

    cachedElections = data;
    return data;
  } catch (err) {
    console.warn('fetchAllElections failed:', err);
    return [];
  }
}

export async function fetchElectionById(
  electionId: string
): Promise<ElectionResultSummary | null> {
  const elections = await fetchAllElections();
  return elections.find((e) => e.electionId === electionId) ?? null;
}

export async function fetchContestById(
  electionId: string,
  contestId: string
): Promise<{ election: ElectionResultSummary; contest: ContestResult } | null> {
  const election = await fetchElectionById(electionId);
  if (!election) return null;

  const contest = election.contests.find((c) => c.contestId === contestId);
  if (!contest) return null;

  return { election, contest };
}
