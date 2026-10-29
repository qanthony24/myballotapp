/**
 * Refresh the bundled snapshot (data/app/*.json) from the live Firestore data.
 *
 *   npm run data:snapshot
 *
 * Why: the app always shows Firestore data when it can, but a brand-new
 * install with no connection falls back to the snapshot bundled in the build.
 * Run this before building a release (especially App Store builds) so that
 * fallback is current, then commit the updated JSON.
 *
 * Reads through the public Firestore REST API (election data is publicly
 * readable under firestore.rules), so no credentials are needed. Records
 * marked `_deleted: true` are left out. Internal fields (_updatedAt, etc.)
 * are dropped except _pipeline* provenance fields.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ID = 'myballot-app';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OUT_DIR = path.resolve(process.cwd(), 'data/app');

type FirestoreValue = Record<string, unknown>;

/** Convert a Firestore REST typed value into plain JSON. */
export function decodeValue(v: FirestoreValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) {
    const values = ((v.arrayValue as { values?: FirestoreValue[] }).values ?? []);
    return values.map(decodeValue);
  }
  if ('mapValue' in v) {
    return decodeFields(((v.mapValue as { fields?: Record<string, FirestoreValue> }).fields) ?? {});
  }
  return null;
}

export function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

async function fetchCollection(name: string): Promise<Record<string, unknown>[]> {
  const docs: Record<string, unknown>[] = [];
  let pageToken = '';
  do {
    const url = `${BASE}/${name}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      documents?: { fields?: Record<string, FirestoreValue> }[];
      nextPageToken?: string;
    };
    for (const d of json.documents ?? []) docs.push(decodeFields(d.fields ?? {}));
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

/** Keep public data fields; drop deleted records and internal bookkeeping. */
export function clean(records: Record<string, unknown>[]): Record<string, unknown>[] {
  return records
    .filter((r) => !r._deleted)
    .map((r) =>
      Object.fromEntries(
        Object.entries(r).filter(([k]) => !k.startsWith('_') || k.startsWith('_pipeline')),
      ),
    );
}

async function main(): Promise<void> {
  console.log('📸 Refreshing bundled snapshot from Firestore…');
  const candidates = clean(await fetchCollection('candidates'))
    // Only candidates assigned to at least one election belong in the app snapshot.
    .filter((c) => Array.isArray(c.cycleIds) && (c.cycleIds as unknown[]).length > 0)
    .sort((a, b) => Number(a.id) - Number(b.id));
  const measures = clean(await fetchCollection('ballotMeasures')).sort((a, b) => Number(a.id) - Number(b.id));

  await fs.writeFile(path.join(OUT_DIR, 'candidates.json'), JSON.stringify(candidates, null, 2) + '\n');
  await fs.writeFile(path.join(OUT_DIR, 'ballot-measures.json'), JSON.stringify(measures, null, 2) + '\n');
  console.log(`   ${candidates.length} candidates → data/app/candidates.json`);
  console.log(`   ${measures.length} ballot measures → data/app/ballot-measures.json`);
  console.log('✅ Done. Review the diff, then commit.');
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && process.argv[1].includes('snapshot-from-firestore')) {
  main().catch((err) => {
    console.error('❌ Snapshot failed:', err);
    process.exit(1);
  });
}
