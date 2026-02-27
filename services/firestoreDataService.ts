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
import { db, storage } from '../firebase';
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Candidate, Office, Cycle, BallotMeasure, SurveyQuestion } from '../types';

/** Recursively strip undefined values — Firestore rejects them. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = stripUndefined(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

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
  await setDoc(docRef, stripUndefined({
    ...candidate,
    _updatedAt: new Date().toISOString(),
  } as Record<string, unknown>));
  invalidateCandidateCache();
}

export async function updateCandidateFields(
  id: number,
  fields: Partial<Candidate>,
): Promise<void> {
  const docRef = doc(db, 'candidates', String(id));
  await updateDoc(docRef, stripUndefined({
    ...fields,
    _updatedAt: new Date().toISOString(),
  } as Record<string, unknown>));
  invalidateCandidateCache();
}

// ---- Photo upload ----

export async function uploadCandidatePhoto(
  candidateId: number,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `candidates/${candidateId}/photo.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateCandidateFields(candidateId, { photoUrl: url });
  return url;
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
      batch.set(doc(db, 'candidates', String(c.id)), stripUndefined({
        ...c,
        _updatedAt: new Date().toISOString(),
        _seededFromConstants: true,
      } as Record<string, unknown>));
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
    batch.set(doc(db, 'elections', String(cycle.id)), stripUndefined({
      ...cycle,
      _updatedAt: new Date().toISOString(),
    } as Record<string, unknown>));
  }
  await batch.commit();
  return CYCLES_DATA.length;
}

export async function seedOfficesToFirestore(): Promise<number> {
  const batch = writeBatch(db);
  for (const office of OFFICES_DATA) {
    batch.set(doc(db, 'offices', String(office.id)), stripUndefined({
      ...office,
      _updatedAt: new Date().toISOString(),
    } as Record<string, unknown>));
  }
  await batch.commit();
  return OFFICES_DATA.length;
}

export async function seedSurveyQuestionsToFirestore(): Promise<number> {
  const batch = writeBatch(db);
  for (const q of SURVEY_QUESTIONS_DATA) {
    batch.set(doc(db, 'surveyQuestions', q.key), stripUndefined({
      ...q,
      _updatedAt: new Date().toISOString(),
    } as Record<string, unknown>));
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

// ---- CSV import ----

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importCandidatesFromCsv(
  csvText: string,
): Promise<CsvImportResult> {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: ['CSV must have a header row and at least one data row'] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const result: CsvImportResult = { imported: 0, skipped: 0, errors: [] };

  const batchSize = 400;
  const candidates: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });

      const id = parseInt(row['id']);
      if (!id) {
        result.errors.push(`Row ${i + 1}: missing or invalid id`);
        result.skipped++;
        continue;
      }

      const candidate: Record<string, unknown> = {
        id,
        firstName: row['firstname'] || row['first_name'] || row['first name'] || '',
        lastName: row['lastname'] || row['last_name'] || row['last name'] || '',
        slug: (row['slug'] || `${row['firstname'] || ''}-${row['lastname'] || ''}`).toLowerCase().replace(/\s+/g, '-'),
        party: row['party'] || '',
        officeId: parseInt(row['officeid'] || row['office_id'] || '0') || 0,
        cycleId: parseInt(row['cycleid'] || row['cycle_id'] || '0') || 0,
        district: row['district'] || undefined,
        photoUrl: row['photourl'] || row['photo_url'] || row['photo'] || '',
        website: row['website'] || row['url'] || undefined,
        email: row['email'] || undefined,
        phone: row['phone'] || undefined,
        bio: row['bio'] || row['biography'] || '',
        ballotOrder: parseInt(row['ballotorder'] || row['ballot_order'] || '1') || 1,
        isIncumbent: row['isincumbent'] === 'true' || row['incumbent'] === 'true' || row['isincumbent'] === '1',
        runningMateName: row['runningmatename'] || row['running_mate'] || undefined,
        socialLinks: {
          facebook: row['facebook'] || undefined,
          twitter: row['twitter'] || row['x'] || undefined,
          instagram: row['instagram'] || undefined,
        },
        surveyResponses: {
          why_running: row['why_running'] || row['q_why_running'] || '',
          top_priority: row['top_priority'] || row['q_top_priority'] || '',
          experience: row['experience'] || row['q_experience'] || '',
          fiscal_approach: row['fiscal_approach'] || row['q_fiscal_approach'] || '',
        },
        _updatedAt: new Date().toISOString(),
        _importedFromCsv: true,
      };

      candidates.push(stripUndefined(candidate));
      result.imported++;
    } catch (err) {
      result.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      result.skipped++;
    }
  }

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = candidates.slice(i, i + batchSize);
    for (const c of chunk) {
      batch.set(doc(db, 'candidates', String(c.id)), c);
    }
    await batch.commit();
  }

  invalidateCandidateCache();
  return result;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
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
  await setDoc(doc(db, 'config', 'admin'), stripUndefined({
    adminEmails: emails.map((e) => e.toLowerCase()),
    _updatedAt: new Date().toISOString(),
  } as Record<string, unknown>));
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
