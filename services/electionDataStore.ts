/**
 * Election data store — the single source the app reads election data from.
 *
 * How it works:
 *   1. On load it starts from the BUNDLED SNAPSHOT (data/app/*.json + the
 *      election/office lists in constants.tsx) so the app always has
 *      something to show — even on a first launch with no connection.
 *   2. startElectionDataSync() subscribes to Firestore (candidates, elections,
 *      offices, ballotMeasures, surveyQuestions). Firestore is the source of
 *      truth: its documents override the snapshot field-by-field, documents
 *      that exist only in Firestore are added, and documents marked
 *      `_deleted: true` are hidden.
 *   3. Firestore's persistent local cache (see firebase.ts) keeps the last
 *      synced data on the device, so later launches work offline too.
 *
 * Admin edits therefore reach every screen within seconds, with no app
 * release. Components re-render via useElectionData().
 */
import { useSyncExternalStore } from 'react';
import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Candidate, Cycle, Office, BallotMeasure, SurveyQuestion } from '../types';
import {
  SNAPSHOT_CANDIDATES,
  SNAPSHOT_BALLOT_MEASURES,
  PREDEFINED_CYCLES,
  PREDEFINED_OFFICES,
  PREDEFINED_SURVEY_QUESTIONS,
  sortCycles,
  candidatePhotoFallback,
} from '../constants';

export type DataStatus =
  | 'snapshot' // only bundled data so far
  | 'cache' // showing Firestore data from the on-device cache (offline or still connecting)
  | 'live' // in sync with the server
  | 'error'; // Firestore unavailable; showing bundled/cached data

interface StoreState {
  candidates: Candidate[];
  cycles: Cycle[];
  offices: Office[];
  ballotMeasures: BallotMeasure[];
  surveyQuestions: SurveyQuestion[];
  status: DataStatus;
  version: number;
}

type Doc = Record<string, unknown>;

// Raw Firestore documents per collection, keyed by document id.
const remote: Record<string, Map<string, Doc>> = {
  candidates: new Map(),
  elections: new Map(),
  offices: new Map(),
  ballotMeasures: new Map(),
  surveyQuestions: new Map(),
};
const collectionStatus: Record<string, 'pending' | 'cache' | 'live' | 'error'> = {
  candidates: 'pending',
  elections: 'pending',
  offices: 'pending',
  ballotMeasures: 'pending',
  surveyQuestions: 'pending',
};

/** Drop empty values so a blank field in Firestore doesn't erase a real one from the snapshot. */
function meaningful(doc: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

/**
 * Merge snapshot records with Firestore documents.
 * - Firestore fields win over snapshot fields.
 * - Firestore-only documents are added.
 * - `_deleted: true` hides the record (snapshot copies included).
 */
export function mergeById<T extends Doc>(base: T[], docs: Map<string, Doc>, keyOf: (item: T) => string): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const item of base) {
    const key = keyOf(item);
    seen.add(key);
    const override = docs.get(key);
    if (override?._deleted) continue;
    result.push(override ? ({ ...item, ...meaningful(override) } as T) : item);
  }
  for (const [key, d] of docs) {
    if (seen.has(key) || d._deleted) continue;
    result.push(d as T);
  }
  return result;
}

function normalizeCandidate(c: Candidate): Candidate {
  return {
    ...c,
    // Legacy docs (pre-March 2026) only had `cycleId`. They are NOT placed on
    // a ballot automatically: an unassigned candidate stays hidden until an
    // admin ticks an election in the dashboard.
    cycleIds: Array.isArray(c.cycleIds) ? c.cycleIds.map(Number) : [],
    photoUrl: c.photoUrl || candidatePhotoFallback(c.firstName, c.lastName),
    isIncumbent: c.isIncumbent || false,
    bio: c.bio || '',
    surveyResponses: c.surveyResponses || {},
  };
}

function build(prevVersion: number): StoreState {
  const candidates = mergeById(SNAPSHOT_CANDIDATES as unknown as Doc[], remote.candidates, (c) => String(c.id))
    .map((c) => normalizeCandidate(c as unknown as Candidate));
  const cycles = sortCycles(
    mergeById(PREDEFINED_CYCLES as unknown as Doc[], remote.elections, (c) => String(c.id)).map(
      (c) => ({ ...c, id: Number(c.id) }) as unknown as Cycle,
    ),
  );
  const offices = mergeById(PREDEFINED_OFFICES as unknown as Doc[], remote.offices, (o) => String(o.id))
    .map((o) => ({ ...o, id: Number(o.id) }) as unknown as Office)
    .sort((a, b) => a.id - b.id);
  const ballotMeasures = mergeById(SNAPSHOT_BALLOT_MEASURES as unknown as Doc[], remote.ballotMeasures, (m) =>
    String(m.id),
  ).map((m) => ({ ...m, id: Number(m.id) }) as unknown as BallotMeasure);
  const surveyQuestions = mergeById(
    PREDEFINED_SURVEY_QUESTIONS as unknown as Doc[],
    remote.surveyQuestions,
    (q) => String(q.key),
  ) as unknown as SurveyQuestion[];

  const statuses = Object.values(collectionStatus);
  let status: DataStatus = 'snapshot';
  if (statuses.every((s) => s === 'live')) status = 'live';
  else if (statuses.some((s) => s === 'error')) status = 'error';
  else if (statuses.some((s) => s === 'live' || s === 'cache')) status = 'cache';

  return { candidates, cycles, offices, ballotMeasures, surveyQuestions, status, version: prevVersion + 1 };
}

let state: StoreState = build(0);
const listeners = new Set<() => void>();

function recompute(): void {
  state = build(state.version);
  listeners.forEach((l) => l());
}

let unsubscribers: Unsubscribe[] = [];

/** Start listening to Firestore. Safe to call more than once. */
export function startElectionDataSync(): void {
  if (unsubscribers.length > 0) return;
  for (const name of Object.keys(remote)) {
    const unsub = onSnapshot(
      collection(db, name),
      { includeMetadataChanges: true },
      (snap) => {
        const map = new Map<string, Doc>();
        snap.forEach((d) => map.set(d.id, d.data() as Doc));
        remote[name] = map;
        collectionStatus[name] = snap.metadata.fromCache ? 'cache' : 'live';
        recompute();
      },
      (err) => {
        console.warn(`[electionData] ${name} sync failed; using saved data.`, err);
        collectionStatus[name] = 'error';
        recompute();
      },
    );
    unsubscribers.push(unsub);
  }
}

export function stopElectionDataSync(): void {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
}

// ---- Accessors (synchronous; always return current data) ----

export const getStoreState = (): StoreState => state;
export const getCandidatesData = (): Candidate[] => state.candidates;
export const getCyclesData = (): Cycle[] => state.cycles;
export const getOfficesData = (): Office[] => state.offices;
export const getBallotMeasuresData = (): BallotMeasure[] => state.ballotMeasures;
export const getSurveyQuestionsData = (): SurveyQuestion[] => state.surveyQuestions;
export const getDataStatus = (): DataStatus => state.status;

/** Raw Firestore doc (no snapshot merge). Used by admin screens to see what's actually stored. */
export const getRemoteDoc = (collectionName: string, id: string): Doc | undefined =>
  remote[collectionName]?.get(id);

/** Resolves once every collection has delivered data (from cache or server), or after `timeoutMs`. */
export function whenElectionDataReady(timeoutMs = 8000): Promise<void> {
  const ready = () => Object.values(collectionStatus).every((s) => s !== 'pending');
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      listeners.delete(check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (ready()) done();
    };
    const timer = setTimeout(done, timeoutMs);
    listeners.add(check);
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * React hook: re-renders the component whenever election data changes.
 * Returns the current store state; use `version` in useMemo/useEffect deps.
 */
export function useElectionData(): StoreState {
  return useSyncExternalStore(subscribe, getStoreState, getStoreState);
}
