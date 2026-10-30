// Data-merge rules: Firestore over the bundled snapshot (services/mergeRecords.ts),
// the release snapshot export, and placeholder-photo tagging. Run: npm run test:data
import assert from 'node:assert/strict';
import { mergeById } from '../services/mergeRecords.ts';
import { effectiveRecords, clean } from '../data-pipeline/src/snapshot-from-firestore.ts';
const key = (x: any) => String(x.id);
const base = [
  { id: 1, firstName: 'Bill', lastName: 'Cassidy', photoUrl: 'https://real/p1.png', bio: '', cycleIds: [2] },
  { id: 2, firstName: 'Jamie', lastName: 'Davis', photoUrl: '', cycleIds: [2, 1] },
  { id: 3, firstName: 'Mark', lastName: 'Spencer', cycleIds: [2] },
  { id: 4, firstName: 'Gone', lastName: 'Soon', cycleIds: [2] },
];
const docs = new Map<string, any>([
  ['1', { id: 1, photoUrl: '', cycleId: 2, _updatedAt: 't' }],            // Finding 1: admin cleared the photo; legacy cycleId only
  ['2', { id: 2, bio: 'New bio', surveyResponses: { why_running: 'x' } }], // Finding 2: partial doc (only edited fields)
  ['4', { id: 4, _deleted: true }],                                        // tombstone
  ['9', { id: 9, firstName: 'House', lastName: 'Only' }],                  // Firestore-only, no elections
]);
const m = mergeById(base, docs, key) as any[];
// Finding 1 — explicit clear wins over bundled value
assert.equal(m.find(c => c.id === 1).photoUrl, '', 'cleared photo must stay cleared');
assert.deepEqual(m.find(c => c.id === 1).cycleIds, [2], 'absent field keeps snapshot value');
// partial doc keeps bundled fields and adds edits
const davis = m.find(c => c.id === 2);
assert.equal(davis.firstName, 'Jamie'); assert.deepEqual(davis.cycleIds, [2, 1]); assert.equal(davis.bio, 'New bio');
assert.ok(m.find(c => c.id === 3), 'bundle-only record kept');
assert.ok(!m.find(c => c.id === 4), 'tombstoned record hidden');
assert.ok(m.find(c => c.id === 9), 'firestore-only record added');
console.log('merge rules OK');

// Finding 2 — snapshot export = effective merged data, cleaned, assigned only
const out = clean(effectiveRecords(base, docs)).filter((c: any) => Array.isArray(c.cycleIds) && c.cycleIds.length > 0);
assert.deepEqual(out.map((c: any) => c.id), [1, 2, 3], 'partial (2) and bundle-only (3) survive; deleted (4) and unassigned (9) dropped');
assert.equal((out[1] as any).firstName, 'Jamie');
assert.ok(!('_updatedAt' in out[0]), 'internal fields stripped');
console.log('snapshot export OK');

// Placeholder photo: store marks it, and it must never be persisted
const store = await import('../services/electionDataStore.ts');
const spencer = store.getCandidatesData().find((c: any) => c.lastName === 'Spencer') as any;
assert.equal(spencer._photoIsPlaceholder, true); assert.match(spencer.photoUrl, /ui-avatars/);
const letlow = store.getCandidatesData().find((c: any) => c.lastName === 'Letlow') as any;
assert.equal(letlow._photoIsPlaceholder, false);
console.log('placeholder tagging OK');
