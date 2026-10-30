/**
 * Admin writes for manual data entry: elections, offices, races, candidates
 * added from a race, and election results. All writes go to Firestore; the
 * live data store (electionDataStore) picks them up automatically.
 *
 * Deletes are tombstones (`_deleted: true`) so bundled snapshot data can't
 * bring a deleted record back.
 */
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Candidate, Cycle, Office, Race } from '../types';
import type { ElectionResultSummary } from '../types/info';
import { getCandidatesData, getCyclesData, getOfficesData } from './electionDataStore';
import { nextCandidateId, nextNumericId, raceId, slugify, splitName, sameDistrict, ParsedRaceRow } from './races';

const now = () => new Date().toISOString();

/**
 * Firestore rejects `undefined` anywhere in a document, including inside
 * arrays (e.g. a result row with no party). Strip it recursively, and drop
 * UI-only fields starting with `_` (except `_deleted`).
 */
export function clean<T extends object>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (k.startsWith('_') && k !== '_deleted') continue;
    out[k] = cleanValue(v);
  }
  return out;
}

function cleanValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.filter((x) => x !== undefined).map(cleanValue);
  if (v && typeof v === 'object') return clean(v as object);
  return v;
}

// ---- Elections ----

export function newElectionId(): number {
  return nextNumericId(getCyclesData());
}

export async function saveElection(election: Cycle): Promise<void> {
  const data = clean({ ...election, slug: election.slug || slugify(election.name) });
  await setDoc(doc(db, 'elections', String(election.id)), { ...data, _updatedAt: now() }, { merge: true });
}

export async function deleteElection(id: number): Promise<void> {
  await setDoc(doc(db, 'elections', String(id)), { id, _deleted: true, _updatedAt: now() }, { merge: true });
}

// ---- Offices ----

export function newOfficeId(): number {
  return nextNumericId(getOfficesData());
}

export async function saveOffice(office: Office): Promise<void> {
  const data = clean({ ...office, slug: office.slug || slugify(office.name) });
  await setDoc(doc(db, 'offices', String(office.id)), { ...data, _updatedAt: now() }, { merge: true });
}

export async function deleteOffice(id: number): Promise<void> {
  await setDoc(doc(db, 'offices', String(id)), { id, _deleted: true, _updatedAt: now() }, { merge: true });
}

// ---- Races ----

export async function saveRace(race: Race): Promise<void> {
  const id = race.id || raceId(race.electionId, race.officeId, race.district);
  await setDoc(
    doc(db, 'races', id),
    { ...clean({ ...race, id, district: race.district || '' }), _deleted: false, _updatedAt: now() },
    { merge: true },
  );
}

export async function deleteRace(id: string): Promise<void> {
  await setDoc(doc(db, 'races', id), { id, _deleted: true, _updatedAt: now() }, { merge: true });
}

type CandidateWrite = { id: number; reused: boolean; data: Record<string, unknown>; merge: boolean };

/**
 * Work out the write that adds `entry` to `race`. If a candidate with the same
 * name already runs for the same office + district (e.g. they made the
 * runoff), they're added to this election instead of being duplicated.
 * `pending` holds candidates planned earlier in the same import.
 */
export function planCandidate(race: Race, entry: { name: string; party: string }, taken: Set<number>, pending: Candidate[]): CandidateWrite {
  const { firstName, lastName } = splitName(entry.name);
  // Candidates planned earlier in this import come first, so their updated cycleIds win.
  const all = [...pending, ...getCandidatesData()];
  const existing = all.find(
    (c) =>
      c.officeId === race.officeId &&
      sameDistrict(c.district, race.district) &&
      `${c.firstName} ${c.lastName}`.trim().toLowerCase() === entry.name.trim().toLowerCase(),
  );
  if (existing) {
    const cycleIds = Array.from(new Set([...(existing.cycleIds || []), race.electionId]));
    pending.unshift({ ...existing, cycleIds }); // a copy: never mutate the live store's objects
    return { id: existing.id, reused: true, merge: true, data: { id: existing.id, cycleIds, _deleted: false, _updatedAt: now() } };
  }
  let id = nextCandidateId(all);
  while (taken.has(id)) id++;
  taken.add(id);
  const candidate: Candidate = {
    id,
    firstName,
    lastName,
    slug: slugify(`${firstName}-${lastName}`),
    photoUrl: '',
    party: entry.party,
    officeId: race.officeId,
    district: race.district || undefined,
    cycleIds: [race.electionId],
    bio: '',
    surveyResponses: {},
    ballotOrder: 0,
    isIncumbent: false,
  };
  pending.push(candidate);
  return { id, reused: false, merge: false, data: { ...clean(candidate), _createdInAdmin: true, _updatedAt: now() } };
}

/** Add one candidate to a race (see planCandidate for duplicate handling). */
export async function addCandidateToRace(race: Race, entry: { name: string; party: string }): Promise<{ id: number; reused: boolean }> {
  const w = planCandidate(race, entry, new Set(), []);
  await setDoc(doc(db, 'candidates', String(w.id)), w.data, { merge: w.merge });
  return { id: w.id, reused: w.reused };
}

/** Take a candidate off this election's ballot (keeps their profile and other elections). */
export async function removeCandidateFromElection(candidate: Candidate, electionId: number): Promise<void> {
  const cycleIds = (candidate.cycleIds || []).filter((id) => id !== electionId);
  await setDoc(doc(db, 'candidates', String(candidate.id)), { id: candidate.id, cycleIds, _updatedAt: now() }, { merge: true });
}

/** Import parsed CSV rows: creates/updates races and adds their candidates, in batched writes. */
export async function importRaces(
  electionId: number,
  rows: ParsedRaceRow[],
): Promise<{ races: number; candidatesAdded: number; candidatesReused: number }> {
  const writes: { path: [string, string]; data: Record<string, unknown>; merge: boolean }[] = [];
  const taken = new Set<number>();
  const pending: Candidate[] = [];
  let candidatesAdded = 0;
  let candidatesReused = 0;
  for (const r of rows) {
    const id = raceId(electionId, r.officeId, r.district);
    writes.push({
      path: ['races', id],
      merge: true,
      data: clean({
        id,
        electionId,
        officeId: r.officeId,
        district: r.district || '',
        districtKey: r.districtKey || undefined,
        seats: r.seats,
        ballotOrder: r.ballotOrder,
      }),
    });
    writes[writes.length - 1].data._deleted = false;
    writes[writes.length - 1].data._updatedAt = now();
    const race: Race = { id, electionId, officeId: r.officeId, district: r.district };
    for (const c of r.candidates) {
      const w = planCandidate(race, c, taken, pending);
      writes.push({ path: ['candidates', String(w.id)], data: w.data, merge: w.merge });
      if (w.reused) candidatesReused++;
      else candidatesAdded++;
    }
  }
  // Firestore allows 500 writes per batch.
  for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + 450)) batch.set(doc(db, w.path[0], w.path[1]), w.data, { merge: w.merge });
    await batch.commit();
  }
  return { races: rows.length, candidatesAdded, candidatesReused };
}

// ---- Results ----

export type StoredResults = ElectionResultSummary & { published?: boolean };

export async function saveResults(electionId: number, results: StoredResults): Promise<void> {
  await setDoc(doc(db, 'results', String(electionId)), { ...clean(results), _updatedAt: now() });
}
