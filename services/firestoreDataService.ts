/**
 * Firestore data service: admin writes, imports, and publishing.
 *
 * READS go through services/electionDataStore.ts, which keeps a live,
 * offline-capable copy of Firestore merged over the bundled snapshot. The
 * async read functions below are kept for the admin pages' existing API and
 * simply return the store's current data.
 *
 * Firestore collections:
 *   candidates/{id}        — candidate records
 *   elections/{id}         — election/cycle records
 *   offices/{id}           — office records
 *   ballotMeasures/{id}    — ballot measure records
 *   surveyQuestions/{key}  — survey question definitions
 *   config/admin           — { adminEmails: string[] }
 *
 * Deleting sets `_deleted: true` (a "tombstone") instead of removing the
 * document, so the bundled snapshot can't bring a deleted record back.
 */
import { db, storage } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Candidate, Office, Cycle, BallotMeasure, SurveyQuestion } from '../types';
import {
  SNAPSHOT_CANDIDATES,
  SNAPSHOT_BALLOT_MEASURES,
  PREDEFINED_CYCLES,
  PREDEFINED_OFFICES,
  PREDEFINED_SURVEY_QUESTIONS,
} from '../constants';
import {
  getCandidatesData,
  getCyclesData,
  getOfficesData,
  getBallotMeasuresData,
  getSurveyQuestionsData,
  whenElectionDataReady,
} from './electionDataStore';

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

/**
 * For publishing bundled data with merge: drop empty strings and empty
 * objects so they never overwrite real values an admin entered (photos,
 * bios, survey answers).
 */
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const inner = stripEmpty(value as Record<string, unknown>);
      if (Object.keys(inner).length === 0) continue;
      clean[key] = inner;
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const now = () => new Date().toISOString();

/** Kept for compatibility: the live store updates itself after writes. */
export function invalidateCandidateCache(): void {}

// ---- Candidate reads (from the live store) ----

export async function getFirestoreCandidates(): Promise<Candidate[]> {
  await whenElectionDataReady();
  return getCandidatesData();
}

export async function getFirestoreCandidateById(
  id: number,
): Promise<Candidate | undefined> {
  await whenElectionDataReady();
  return getCandidatesData().find((c) => c.id === id);
}

// ---- Candidate writes (admin) ----

export async function saveCandidate(candidate: Candidate): Promise<void> {
  const docRef = doc(db, 'candidates', String(candidate.id));
  // Full replace (also clears any `_deleted` tombstone).
  await setDoc(docRef, stripUndefined({
    ...candidate,
    _updatedAt: now(),
  } as Record<string, unknown>));
}

export async function updateCandidateFields(
  id: number,
  fields: Partial<Candidate>,
): Promise<void> {
  // merge: works whether or not the candidate already has a Firestore doc
  // (a candidate may so far exist only in the bundled snapshot).
  const docRef = doc(db, 'candidates', String(id));
  await setDoc(docRef, stripUndefined({
    ...fields,
    id,
    _updatedAt: now(),
  } as Record<string, unknown>), { merge: true });
}

// ---- Candidate delete (tombstone) ----

export async function deleteCandidate(candidateId: number): Promise<void> {
  await setDoc(doc(db, 'candidates', String(candidateId)), {
    id: candidateId,
    _deleted: true,
    _updatedAt: now(),
  }, { merge: true });
}

export async function deleteCandidatesBulk(candidateIds: number[]): Promise<number> {
  const batchSize = 400;
  let count = 0;
  for (let i = 0; i < candidateIds.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = candidateIds.slice(i, i + batchSize);
    for (const id of chunk) {
      batch.set(doc(db, 'candidates', String(id)), { id, _deleted: true, _updatedAt: now() }, { merge: true });
      count++;
    }
    await batch.commit();
  }
  return count;
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

// ---- Publish: push the bundled snapshot into Firestore (non-destructive) ----
//
// Uses merge writes with empty values stripped, so anything an admin entered
// in Firestore (photos, focal points, bios, survey answers, deletions) is kept.
// Fields that ARE present in the bundled data (names, offices, elections,
// dates) overwrite Firestore — that's how pipeline corrections reach the app.

async function publishDocs(
  collectionName: string,
  items: Record<string, unknown>[],
  idOf: (item: Record<string, unknown>) => string,
): Promise<number> {
  const batchSize = 400;
  let count = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + batchSize)) {
      batch.set(
        doc(db, collectionName, idOf(item)),
        { ...stripEmpty(item), _updatedAt: now(), _publishedFromSnapshot: true },
        { merge: true },
      );
      count++;
    }
    await batch.commit();
  }
  return count;
}

export async function seedCandidatesToFirestore(
  candidates?: Candidate[],
): Promise<number> {
  const data = (candidates ?? SNAPSHOT_CANDIDATES) as unknown as Record<string, unknown>[];
  return publishDocs('candidates', data, (c) => String(c.id));
}

export async function seedElectionsToFirestore(): Promise<number> {
  return publishDocs('elections', PREDEFINED_CYCLES as unknown as Record<string, unknown>[], (c) => String(c.id));
}

export async function seedOfficesToFirestore(): Promise<number> {
  return publishDocs('offices', PREDEFINED_OFFICES as unknown as Record<string, unknown>[], (o) => String(o.id));
}

export async function seedSurveyQuestionsToFirestore(): Promise<number> {
  return publishDocs('surveyQuestions', PREDEFINED_SURVEY_QUESTIONS as unknown as Record<string, unknown>[], (q) => String(q.key));
}

export async function seedAllToFirestore(): Promise<string> {
  const candidates = await seedCandidatesToFirestore();
  const elections = await seedElectionsToFirestore();
  const offices = await seedOfficesToFirestore();
  const questions = await seedSurveyQuestionsToFirestore();
  const measures = await seedBallotMeasuresToFirestore();
  return `Published: ${candidates} candidates, ${elections} elections, ${offices} offices, ${questions} survey questions, ${measures} ballot measures`;
}

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
        cycleIds: [parseInt(row['cycleid'] || row['cycle_id'] || '0') || 0],
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

export async function getAdminEmails(): Promise<string[]> {
  const configDoc = await getDoc(doc(db, 'config', 'admin'));
  if (!configDoc.exists()) return [];
  return (configDoc.data() as { adminEmails?: string[] }).adminEmails ?? [];
}

/**
 * Replaces the admin list. Only succeeds for existing admins (enforced by
 * firestore.rules). The first admin has to be added in the Firebase console.
 */
export async function setAdminEmails(emails: string[]): Promise<void> {
  await setDoc(doc(db, 'config', 'admin'), stripUndefined({
    adminEmails: emails.map((e) => e.toLowerCase()),
    _updatedAt: new Date().toISOString(),
  } as Record<string, unknown>));
}

// ---- Synchronous reads (from the live store) ----

export function getLocalOffices(): Office[] {
  return getOfficesData();
}

export function getLocalCycles(): Cycle[] {
  return getCyclesData();
}

export function getLocalSurveyQuestions(): SurveyQuestion[] {
  return getSurveyQuestionsData();
}

// ---- Survey Question CRUD ----

export async function getFirestoreSurveyQuestions(): Promise<SurveyQuestion[]> {
  await whenElectionDataReady();
  return getSurveyQuestionsData();
}

export async function saveSurveyQuestion(question: SurveyQuestion): Promise<void> {
  await setDoc(doc(db, 'surveyQuestions', question.key), stripUndefined({
    ...question,
    _updatedAt: new Date().toISOString(),
  } as Record<string, unknown>));
}

export async function deleteSurveyQuestion(key: string): Promise<void> {
  await setDoc(doc(db, 'surveyQuestions', key), { key, _deleted: true, _updatedAt: now() }, { merge: true });
}

export async function importSurveyResponsesCsv(
  csvText: string,
): Promise<CsvImportResult> {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: ['CSV must have a header row and at least one data row'] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const result: CsvImportResult = { imported: 0, skipped: 0, errors: [] };

  const idCol = headers.findIndex((h) => h === 'candidateid' || h === 'candidate_id' || h === 'id');
  if (idCol === -1) {
    return { imported: 0, skipped: 0, errors: ['CSV must have a candidateId or id column'] };
  }

  const questionCols: { headerIdx: number; questionKey: string }[] = [];
  for (let hi = 0; hi < headers.length; hi++) {
    const h = headers[hi];
    if (h.startsWith('q_') || h.startsWith('question_')) {
      questionCols.push({ headerIdx: hi, questionKey: h.replace(/^(q_|question_)/, '') });
    }
  }

  if (questionCols.length === 0) {
    return { imported: 0, skipped: 0, errors: ['No survey question columns found. Prefix question columns with q_ (e.g. q_why_running)'] };
  }

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      const candidateId = parseInt(values[idCol]);
      if (!candidateId) {
        result.errors.push(`Row ${i + 1}: missing or invalid candidateId`);
        result.skipped++;
        continue;
      }

      const responses: Record<string, string> = {};
      for (const qc of questionCols) {
        const val = (values[qc.headerIdx] || '').trim();
        if (val) responses[qc.questionKey] = val;
      }

      if (Object.keys(responses).length === 0) {
        result.skipped++;
        continue;
      }

      const existing = getCandidatesData().find((c) => c.id === candidateId);
      const prev = (existing?.surveyResponses as Record<string, string>) || {};
      await setDoc(doc(db, 'candidates', String(candidateId)), stripUndefined({
        id: candidateId,
        surveyResponses: { ...prev, ...responses },
        _updatedAt: now(),
      } as Record<string, unknown>), { merge: true });
      result.imported++;
    } catch (err) {
      result.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      result.skipped++;
    }
  }

  invalidateCandidateCache();
  return result;
}

export function getLocalBallotMeasures(): BallotMeasure[] {
  return getBallotMeasuresData();
}

// ---- Ballot Measure CRUD ----

/** Kept for compatibility: the live store updates itself after writes. */
export function invalidateMeasureCache(): void {}

export async function getFirestoreBallotMeasures(): Promise<BallotMeasure[]> {
  await whenElectionDataReady();
  return getBallotMeasuresData();
}

export async function getFirestoreBallotMeasureById(
  id: number,
): Promise<BallotMeasure | undefined> {
  await whenElectionDataReady();
  return getBallotMeasuresData().find((m) => m.id === id);
}

export async function saveBallotMeasure(measure: BallotMeasure): Promise<void> {
  const docRef = doc(db, 'ballotMeasures', String(measure.id));
  await setDoc(docRef, stripUndefined({
    ...measure,
    _updatedAt: now(),
  } as Record<string, unknown>));
}

export async function seedBallotMeasuresToFirestore(): Promise<number> {
  return publishDocs('ballotMeasures', SNAPSHOT_BALLOT_MEASURES as unknown as Record<string, unknown>[], (m) => String(m.id));
}
