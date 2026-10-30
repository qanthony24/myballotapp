/**
 * How Firestore documents combine with the bundled snapshot. Shared by the app
 * (services/electionDataStore.ts) and the release snapshot script
 * (data-pipeline/src/snapshot-from-firestore.ts) so both always agree.
 *
 * Rules:
 *   - Firestore is authoritative: every field present in a Firestore document
 *     overrides the snapshot, INCLUDING empty values ('' / null / []). An admin
 *     who clears a photo or bio in the dashboard means it.
 *   - Fields absent from the Firestore document keep their snapshot value, so a
 *     partial document (e.g. only edited fields) still yields a full record.
 *   - Documents that exist only in Firestore are added.
 *   - `_deleted: true` hides the record, snapshot copy included.
 *
 * (Publishing the bundle never writes empty values — see stripEmpty in
 * firestoreDataService — so an empty value in Firestore is always deliberate.)
 */
export type MergeDoc = Record<string, unknown>;

export function mergeById<T extends MergeDoc>(
  base: T[],
  docs: Map<string, MergeDoc>,
  keyOf: (item: MergeDoc) => string,
): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const item of base) {
    const key = keyOf(item);
    seen.add(key);
    const override = docs.get(key);
    if (override?._deleted) continue;
    result.push(override ? ({ ...item, ...definedOnly(override) } as T) : item);
  }
  for (const [key, d] of docs) {
    if (seen.has(key) || d._deleted) continue;
    result.push(d as T);
  }
  return result;
}

/** Drop only `undefined` (Firestore never stores it); keep '' / null / [] as real values. */
function definedOnly(doc: MergeDoc): MergeDoc {
  const out: MergeDoc = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
