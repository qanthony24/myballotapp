/**
 * Louisiana Secretary of State election results → MyBallot results format.
 * Pure functions (no network), used by scripts/build-results.mts and tested in
 * tests/sosResults.test.mts.
 *
 * Source: the SoS "Graphical" results site (voterportal.sos.la.gov/graphical),
 * which serves JSON per election date:
 *   ElectionDates.htm                                 every election (back to 1982)
 *   {yyyymmdd}/RacesCandidates_Multiparish.htm        statewide / multi-parish races + candidates
 *   {yyyymmdd}/Votes_Multiparish.htm                  their totals and outcomes
 *   {yyyymmdd}/ParishesInElection.htm                 parishes with local races
 *   {yyyymmdd}/RacesCandidates/ByParish_{NN}.htm      a parish's local races
 *   {yyyymmdd}/VotesParish/Votes_{NN}.htm             their totals
 * The same files update live on election night.
 */
import type { ContestResult, ElectionResultSummary, ElectionType, ResultItem } from '../types/info';

/** SoS parish codes are 01–64 in alphabetical order. */
export const PARISHES = [
  'Acadia', 'Allen', 'Ascension', 'Assumption', 'Avoyelles', 'Beauregard', 'Bienville', 'Bossier', 'Caddo', 'Calcasieu',
  'Caldwell', 'Cameron', 'Catahoula', 'Claiborne', 'Concordia', 'De Soto', 'East Baton Rouge', 'East Carroll', 'East Feliciana', 'Evangeline',
  'Franklin', 'Grant', 'Iberia', 'Iberville', 'Jackson', 'Jefferson', 'Jefferson Davis', 'Lafayette', 'Lafourche', 'LaSalle',
  'Lincoln', 'Livingston', 'Madison', 'Morehouse', 'Natchitoches', 'Orleans', 'Ouachita', 'Plaquemines', 'Pointe Coupee', 'Rapides',
  'Red River', 'Richland', 'Sabine', 'St. Bernard', 'St. Charles', 'St. Helena', 'St. James', 'St. John the Baptist', 'St. Landry', 'St. Martin',
  'St. Mary', 'St. Tammany', 'Tangipahoa', 'Tensas', 'Terrebonne', 'Union', 'Vermilion', 'Vernon', 'Washington', 'Webster',
  'West Baton Rouge', 'West Carroll', 'West Feliciana', 'Winn',
] as const;

export const parishName = (code: string) => PARISHES[parseInt(code, 10) - 1] ?? `Parish ${code}`;
export const parishCode = (name: string) => {
  const i = PARISHES.findIndex((p) => p.toLowerCase() === name.toLowerCase());
  return i < 0 ? undefined : String(i + 1).padStart(2, '0');
};

const PARTY: Record<string, string> = {
  REP: 'Republican', DEM: 'Democratic', IND: 'Independent', LBT: 'Libertarian', LIB: 'Libertarian', GRN: 'Green',
  NOPTY: 'No Party', NP: 'No Party', OTHER: 'Other', CON: 'Constitution', REF: 'Reform', AMER: 'American',
};

/** `"Jeff" Landry (REP)` → { name: '"Jeff" Landry', party: 'Republican' }. */
export function parseChoice(desc: string): { name: string; party?: string } {
  const m = desc.trim().match(/^(.*?)\s*\(([A-Za-z]{1,6})\)$/);
  if (!m) return { name: desc.trim() };
  return { name: m[1].trim(), party: PARTY[m[2].toUpperCase()] ?? m[2].toUpperCase() };
}

export interface SosRace {
  ID: string;
  SpecificTitle: string;
  GeneralTitle: string;
  OfficeLevel: string;
  IsMultiParish?: string;
  NumberToBeElected?: string;
  SummaryText?: string | null;
  IsClosedParty?: string;
  CanHaveRunoff?: string;
  Choice: { ID: string; Desc: string }[];
}
export interface SosVotes {
  ID: string;
  PrecinctsReporting?: string;
  PrecinctsExpected?: string;
  VoterCountQualified?: string;
  VoterCountVoted?: string;
  Choice: { ID: string; VoteTotal: string; Outcome?: string }[];
}

export interface Contest extends ContestResult {
  /** Parish name for local races; undefined for statewide / multi-parish. */
  parish?: string;
  /** SoS office level code: 0xx federal, 1xx statewide, 2xx legislative/judicial/parish, 998 amendment, 999 proposition. */
  level: number;
  generalTitle: string;
  numberToBeElected: number;
  runoff?: boolean;
  summary?: string;
  precinctsReporting?: number;
  precinctsExpected?: number;
  registeredVoters?: number;
  ballotsCast?: number;
}

export interface ResultsElection extends ElectionResultSummary {
  contests: Contest[];
  source: string;
  official: boolean;
  parishesWithLocalRaces: string[];
}

export interface ResultsIndexEntry {
  electionId: string;
  electionDate: string;
  electionName: string;
  electionType: ElectionType;
  highlights: string[];
  contestCount: number;
  statewideCount: number;
  parishes: string[];
  turnout?: { ballotsCast?: number; registeredVoters?: number; turnoutPercent?: number };
  official: boolean;
}

const num = (s?: string | null) => {
  const n = parseInt(String(s ?? ''), 10);
  return Number.isFinite(n) ? n : undefined;
};
/** Counts the SoS didn't record come through as -1 (most elections before ~2010). */
const count = (s?: string | null) => {
  const n = num(s);
  return n != null && n > 0 ? n : undefined;
};

/**
 * Office groups by SoS office level. Federal codes sit among state ones:
 * Presidential Electors 10, U.S. Senator 140, U.S. Representative 145.
 */
export function officeGroup(level: number | undefined): string {
  const l = level ?? 500;
  if (l < 100 || l === 140 || l === 145) return 'Federal';
  if (l < 140) return 'Statewide offices';
  if (l >= 160 && l < 200) return 'State boards and commissions';
  if (l === 200 || l === 205) return 'Legislature';
  if ((l >= 150 && l < 160) || (l >= 210 && l < 230)) return 'Judges and district attorneys';
  if (l === 998) return 'Constitutional amendments';
  if (l === 999) return 'Propositions';
  return 'Other offices';
}
export const OFFICE_GROUP_ORDER = ['Federal', 'Statewide offices', 'State boards and commissions', 'Legislature', 'Judges and district attorneys', 'Other offices', 'Constitutional amendments', 'Propositions'];

/** Turnout only when both counts were recorded and make sense. */
export function cleanTurnout(t?: { registeredVoters?: number; ballotsCast?: number; turnoutPercent?: number }) {
  if (!t || !t.registeredVoters || t.registeredVoters <= 0 || !t.ballotsCast || t.ballotsCast <= 0 || t.ballotsCast > t.registeredVoters) return undefined;
  return { registeredVoters: t.registeredVoters, ballotsCast: t.ballotsCast, turnoutPercent: Math.round((t.ballotsCast / t.registeredVoters) * 1000) / 10 };
}

/**
 * The SoS feed sends a single object instead of a one-item list (one parish,
 * one race, one candidate). Always work with arrays.
 */
export function asArray<T>(x: T | T[] | null | undefined): T[] {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

const isMeasure = (r: SosRace) =>
  Number(r.OfficeLevel) >= 998 || r.Choice.every((c) => /^(yes|no|for|against)\b/i.test(c.Desc.trim()));

export function convertRaces(races: SosRace[], votes: SosVotes[], parish?: string): Contest[] {
  const byId = new Map(asArray(votes).map((v) => [v.ID, { ...v, Choice: asArray(v.Choice) }]));
  const out: Contest[] = [];
  for (const raw of asArray(races)) {
    const r = { ...raw, Choice: asArray(raw.Choice) };
    const v = byId.get(r.ID);
    if (!v) continue;
    const totals = new Map(v.Choice.map((c) => [c.ID, c]));
    const measure = isMeasure(r);
    const items: ResultItem[] = r.Choice.map((c) => {
      const t = totals.get(c.ID);
      const p = measure ? { name: c.Desc.trim() } : parseChoice(c.Desc);
      const outcome = t?.Outcome ?? '';
      return {
        id: c.ID,
        name: p.name,
        ...(p.party ? { party: p.party } : {}),
        votes: num(t?.VoteTotal) ?? 0,
        votePercent: 0,
        ...(outcome === 'Elected' || outcome === 'Approved' ? { isWinner: true } : {}),
        ...(outcome ? { outcome } : {}),
      } as ResultItem;
    });
    const total = items.reduce((s, i) => s + i.votes, 0);
    items.forEach((i) => (i.votePercent = total ? Math.round((i.votes / total) * 1000) / 10 : 0));
    items.sort((a, b) => b.votes - a.votes);
    const reporting = num(v.PrecinctsReporting);
    const expected = num(v.PrecinctsExpected);
    const anyOutcome = v.Choice.some((c) => c.Outcome);
    out.push({
      contestId: r.ID,
      title: r.SpecificTitle.trim(),
      officeName: r.GeneralTitle.trim(),
      contestType: measure ? 'measure' : 'candidate',
      totalVotes: total,
      called: anyOutcome || (expected != null && reporting === expected && expected > 0),
      winnerId: items.find((i) => i.isWinner)?.id,
      resultItems: items,
      ...(parish ? { parish } : {}),
      level: Number(r.OfficeLevel) || 0,
      generalTitle: r.GeneralTitle.trim(),
      numberToBeElected: num(r.NumberToBeElected) ?? 1,
      ...(v.Choice.some((c) => c.Outcome === 'Runoff') ? { runoff: true } : {}),
      ...(measure && r.SummaryText ? { summary: r.SummaryText.trim().slice(0, 1200) } : {}),
      ...(reporting != null ? { precinctsReporting: reporting } : {}),
      ...(expected != null ? { precinctsExpected: expected } : {}),
      ...(count(v.VoterCountQualified) ? { registeredVoters: count(v.VoterCountQualified) } : {}),
      ...(count(v.VoterCountVoted) ? { ballotsCast: count(v.VoterCountVoted) } : {}),
    });
  }
  return out.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, undefined, { numeric: true }));
}

/** "2023-10-14" → "October 14, 2023". */
export function electionName(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function electionType(contests: Contest[]): ElectionType {
  const groups = contests.filter((c) => !c.parish).map((c) => officeGroup(c.level));
  if (groups.includes('Federal')) return 'federal';
  if (groups.length) return 'state';
  if (contests.some((c) => c.parish)) return 'municipal';
  return 'special';
}

/** Assemble one election from its multi-parish data and each parish's local data. */
export function buildElection(args: {
  date: string; // yyyymmdd
  official: boolean;
  multi?: { races: SosRace[]; votes: SosVotes[] };
  parishes: { code: string; races: SosRace[]; votes: SosVotes[] }[];
}): ResultsElection | null {
  const iso = `${args.date.slice(0, 4)}-${args.date.slice(4, 6)}-${args.date.slice(6, 8)}`;
  const statewide = args.multi ? convertRaces(args.multi.races, args.multi.votes) : [];
  const local = args.parishes.flatMap((p) => convertRaces(p.races, p.votes, parishName(p.code)));
  const contests = [...statewide, ...local].filter((c) => (c.totalVotes ?? 0) > 0);
  if (!contests.length) return null;
  // Turnout: the multi-parish race with the most registered voters (statewide races cover everyone).
  const widest = [...statewide].sort((a, b) => (b.registeredVoters ?? 0) - (a.registeredVoters ?? 0))[0];
  const turnout = cleanTurnout(widest);
  return {
    electionId: args.date,
    electionName: electionName(iso),
    electionDate: iso,
    electionType: electionType(contests),
    jurisdiction: 'Louisiana',
    ...(turnout ? { turnout } : {}),
    contests,
    source: 'Louisiana Secretary of State, voterportal.sos.la.gov',
    official: args.official,
    parishesWithLocalRaces: [...new Set(local.filter((c) => (c.totalVotes ?? 0) > 0).map((c) => c.parish!))].sort(),
  };
}

export function indexEntry(e: ResultsElection): ResultsIndexEntry {
  const statewide = e.contests.filter((c) => !c.parish);
  const highlights = [...new Set(statewide.filter((c) => c.level < 998).map((c) => c.generalTitle))].slice(0, 4);
  const measures = statewide.filter((c) => c.level >= 998).length;
  if (measures) highlights.push(`${measures} ${measures === 1 ? 'amendment/proposition' : 'amendments/propositions'}`);
  if (!highlights.length && e.parishesWithLocalRaces.length) highlights.push(`Local races in ${e.parishesWithLocalRaces.length} ${e.parishesWithLocalRaces.length === 1 ? 'parish' : 'parishes'}`);
  return {
    electionId: e.electionId,
    electionDate: e.electionDate,
    electionName: e.electionName,
    electionType: e.electionType,
    highlights,
    contestCount: e.contests.length,
    statewideCount: statewide.length,
    parishes: e.parishesWithLocalRaces,
    ...(e.turnout ? { turnout: e.turnout } : {}),
    official: e.official,
  };
}
