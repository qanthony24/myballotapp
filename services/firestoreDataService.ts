/**
 * Firestore-backed data service.
 *
 * Reads candidates, elections, offices, and ballot measures from Firestore.
 * Falls back to constants.tsx for any data not yet in Firestore.
 *
 * Firestore collections:
 *   candidates/{id}   — candidate records (editable via admin UI)
 *   elections/{id}     — election/cycle records
 *   offices/{id}       — office records
 *   ballotMeasures/{id} — ballot measure records
 *   surveyQuestions/{key} — survey question definitions
 *   config/admin       — { adminEmails: string[] }
 */
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { Candidate, Office, Cycle, BallotMeasure, SurveyQuestion } from '../types';
import {
  CANDIDATES_DATA,
  OFFICES_DATA,
  CYCLES_DATA,
  BALLOT_MEASURES_DATA,
  SURVEY_QUESTIONS_DATA,
} from '../constants';

// ---- Cache layer (avoid repeated Firestore reads) ----

let candidateCache: Candidate[] | null = null;
let candidateCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateCandidateCache(): void {
  candidateCache = null;
  candidateCacheTime = 0;
}

// ---- Candidate reads ----

export async function getFirestoreCandidates(): Promise<Candidate[]> {
  if (candidateCache && Date.now() - candidateCacheTime < CACHE_TTL) {
    return candidateCache;
  }

  try {
    const snap = await getDocs(collection(db, 'candidates'));
    if (snap.empty) return CANDIDATES_DATA;

    const firestoreCandidates = new Map<number, Candidate>();
    snap.forEach((d) => {
      const data = d.data() as Candidate;
      firestoreCandidates.set(data.id, data);
    });

    // Merge: Firestore overrides constants.tsx per candidate ID
    const merged = CANDIDATES_DATA.map((c) => {
      const override = firestoreCandidates.get(c.id);
      return override ? { ...c, ...override } : c;
    });

    // Add any Firestore-only candidates not in constants
    for (const [id, fc] of firestoreCandidates) {
      if (!CANDIDATES_DATA.find((c) => c.id === id)) {
        merged.push(fc);
      }
    }

    candidateCache = merged;
    candidateCacheTime = Date.now();
    return merged;
  } catch (err) {
    console.warn('Firestore read failed, using local data:', err);
    return CANDIDATES_DATA;
  }
}

export async function getFirestoreCandidateById(
  id: number,
): Promise<Candidate | undefined> {
  try {
    const docSnap = await getDoc(doc(db, 'candidates', String(id)));
    if (docSnap.exists()) {
      const local = CANDIDATES_DATA.find((c) => c.id === id);
      return local
        ? { ...local, ...(docSnap.data() as Candidate) }
        : (docSnap.data() as Candidate);
    }
  } catch {
    // fall through to local
  }
  return CANDIDATES_DATA.find((c) => c.id === id);
}

// ---- Candidate writes (admin) ----

export async function saveCandidate(candidate: Candidate): Promise<void> {
  const docRef = doc(db, 'candidates', String(candidate.id));
  await setDoc(docRef, {
    ...candidate,
    _updatedAt: new Date().toISOString(),
  });
  invalidateCandidateCache();
}

export async function updateCandidateFields(
  id: number,
  fields: Partial<Candidate>,
): Promise<void> {
  const docRef = doc(db, 'candidates', String(id));
  await updateDoc(docRef, {
    ...fields,
    _updatedAt: new Date().toISOString(),
  });
  invalidateCandidateCache();
}

// ---- Seed: bulk-import constants into Firestore ----

export async function seedCandidatesToFirestore(
  candidates?: Candidate[],
): Promise<number> {
  const data = candidates ?? CANDIDATES_DATA;
  const batchSize = 400; // Firestore limit is 500 per batch
  let count = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = data.slice(i, i + batchSize);
    for (const c of chunk) {
      batch.set(doc(db, 'candidates', String(c.id)), {
        ...c,
        _updatedAt: new Date().toISOString(),
        _seededFromConstants: true,
      });
      count++;
    }
    await batch.commit();
  }

  invalidateCandidateCache();
  return count;
}

export async function seedElectionsToFirestore(): Promise<number> {
  const batch = writeBatch(db);
  for (const cycle of CYCLES_DATA) {
    batch.set(doc(db, 'elections', String(cycle.id)), {
      ...cycle,
      _updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  return CYCLES_DATA.length;
}

export async function seedOfficesToFirestore(): Promise<number> {
  const batch = writeBatch(db);
  for (const office of OFFICES_DATA) {
    batch.set(doc(db, 'offices', String(office.id)), {
      ...office,
      _updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  return OFFICES_DATA.length;
}

export async function seedSurveyQuestionsToFirestore(): Promise<number> {
  const batch = writeBatch(db);
  for (const q of SURVEY_QUESTIONS_DATA) {
    batch.set(doc(db, 'surveyQuestions', q.key), {
      ...q,
      _updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  return SURVEY_QUESTIONS_DATA.length;
}

export async function seedAllToFirestore(): Promise<string> {
  const candidates = await seedCandidatesToFirestore();
  const elections = await seedElectionsToFirestore();
  const offices = await seedOfficesToFirestore();
  const questions = await seedSurveyQuestionsToFirestore();
  return `Seeded: ${candidates} candidates, ${elections} elections, ${offices} offices, ${questions} survey questions`;
}

// ---- Admin auth ----

export async function isUserAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  try {
    const configDoc = await getDoc(doc(db, 'config', 'admin'));
    if (configDoc.exists()) {
      const data = configDoc.data() as { adminEmails?: string[] };
      return data.adminEmails?.includes(email.toLowerCase()) ?? false;
    }
  } catch {
    // config doc may not exist yet
  }
  return false;
}

export async function setAdminEmails(emails: string[]): Promise<void> {
  await setDoc(doc(db, 'config', 'admin'), {
    adminEmails: emails.map((e) => e.toLowerCase()),
    _updatedAt: new Date().toISOString(),
  });
}

// ---- Passthrough reads (these stay local for now, can migrate later) ----

export function getLocalOffices(): Office[] {
  return OFFICES_DATA;
}

export function getLocalCycles(): Cycle[] {
  return CYCLES_DATA;
}

export function getLocalSurveyQuestions(): SurveyQuestion[] {
  return SURVEY_QUESTIONS_DATA;
}

export function getLocalBallotMeasures(): BallotMeasure[] {
  return BALLOT_MEASURES_DATA;
}
