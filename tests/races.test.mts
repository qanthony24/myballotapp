// Race helpers: CSV parsing, candidate matching, inferred races, ids. Run: npm run test:data
import assert from 'node:assert/strict';
import {
  raceId, racesForElection, candidatesInRace, parseRacesCsv, parseCandidateList,
  splitName, normalizeParty, nextCandidateId, RACES_CSV_TEMPLATE,
} from '../services/races.ts';

const offices: any[] = [
  { id: 7, name: 'US Senator', slug: 'us-senator' },
  { id: 9, name: 'Governor', slug: 'governor' },
  { id: 2, name: 'State Representative', slug: 'state-representative' },
];
const cand = (id: number, first: string, last: string, officeId: number, cycleIds: number[], district?: string): any =>
  ({ id, firstName: first, lastName: last, officeId, cycleIds, district, ballotOrder: 0 });

// ids
assert.equal(raceId(5, 2, 'District 61'), '5-2-district-61');
assert.equal(raceId(5, 9), '5-9-all');

// names / parties
assert.deepEqual(splitName('Jane Q. Doe'), { firstName: 'Jane Q.', lastName: 'Doe' });
assert.deepEqual(splitName('John Roe Jr.'), { firstName: 'John', lastName: 'Roe Jr.' });
assert.equal(normalizeParty('R'), 'Republican');
assert.equal(normalizeParty('dem'), 'Democratic');
assert.equal(normalizeParty('NP'), 'No Party');
assert.equal(normalizeParty('Constitution'), 'Constitution');
assert.deepEqual(parseCandidateList('Jane Doe (R); John Roe (D);  Pat Poe '), [
  { name: 'Jane Doe', party: 'Republican' }, { name: 'John Roe', party: 'Democratic' }, { name: 'Pat Poe', party: '' },
]);
console.log('names/parties OK');

// CSV
const t = parseRacesCsv(RACES_CSV_TEMPLATE, offices);
assert.equal(t.errors.length, 0);
assert.equal(t.rows.length, 2);
assert.equal(t.rows[1].officeId, 2); assert.equal(t.rows[1].district, 'District 61'); assert.equal(t.rows[1].districtKey, 'la-house-61');
assert.equal(t.rows[0].candidates.length, 2);
const bad = parseRacesCsv('office,district\nDog Catcher,\n9,', offices);
assert.equal(bad.rows.length, 1, 'office by id works'); assert.match(bad.errors[0], /unknown office "Dog Catcher"/);
assert.match(parseRacesCsv('district\nx', offices).errors[0], /Missing required column: office/);
const quoted = parseRacesCsv('Office,District,Candidates\n"State Representative","District 7","A, B (R); C (D)"', offices);
assert.equal(quoted.rows[0].candidates[0].name, 'A, B', 'commas inside quotes are kept');
console.log('CSV parsing OK');

// matching + inference
const cs = [
  cand(1, 'Julia', 'Letlow', 7, [2, 1]),
  cand(2, 'Jamie', 'Davis', 7, [2, 1]),
  cand(3, 'Pat', 'Poe', 2, [5], 'District 61'),
  cand(4, 'Sam', 'Soe', 2, [5], 'district 61'),   // district case differs: still same race
  cand(5, 'Old', 'Timer', 2, [], 'District 61'),  // unassigned: not in any race
];
const saved: any[] = [{ id: '5-2-district-61', electionId: 5, officeId: 2, district: 'District 61', districtKey: 'la-house-61' }];
const r5 = racesForElection(5, saved, cs, offices);
assert.equal(r5.length, 1); assert.equal(r5[0]._inferred, undefined);
assert.deepEqual(candidatesInRace(r5[0], cs).map((c) => c.id), [3, 4]);
const r1 = racesForElection(1, [], cs, offices);
assert.equal(r1.length, 1); assert.equal(r1[0]._inferred, true); assert.equal(r1[0].id, '1-7-all');
assert.equal(racesForElection(5, [{ ...saved[0], _deleted: true }], cs, offices)[0]._inferred, true, 'deleted race reappears as inferred while candidates remain');
assert.ok(nextCandidateId(cs) >= 100000);
console.log('race matching OK');

// importRaces planning: duplicate names in one import reuse the same new candidate; store objects are not mutated.
// (Exercised indirectly; the Firestore write path is covered by the admin UI smoke test.)
const { planCandidate } = await import('../services/adminEntryService.ts');
const { getCandidatesData } = await import('../services/electionDataStore.ts');
const letlow = getCandidatesData().find((c: any) => c.lastName === 'Letlow') as any;
const before = JSON.stringify(letlow.cycleIds);
const taken = new Set<number>(); const pending: any[] = [];
const senate = { id: '8-7-all', electionId: 8, officeId: 7, district: '' } as any;
const w1 = planCandidate(senate, { name: 'Julia Letlow', party: 'Republican' }, taken, pending);
assert.equal(w1.reused, true, 'existing candidate is reused'); assert.deepEqual(w1.data.cycleIds, [2, 1, 8]);
assert.equal(JSON.stringify(letlow.cycleIds), before, 'live store object not mutated');
const gov = { id: '8-9-all', electionId: 8, officeId: 9, district: '' } as any;
const w2 = planCandidate(gov, { name: 'New Person', party: 'Democratic' }, taken, pending);
const w3 = planCandidate(gov, { name: 'New Person', party: 'Democratic' }, taken, pending);
assert.equal(w2.reused, false); assert.ok(w2.id >= 100000);
assert.equal(w3.reused, true, 'same name twice in one import is not duplicated'); assert.equal(w3.id, w2.id);
const w4 = planCandidate(gov, { name: 'Other Person', party: 'Republican' }, taken, pending);
assert.notEqual(w4.id, w2.id, 'distinct ids within one import');
console.log('import planning OK');
const { clean } = await import('../services/adminEntryService.ts');
assert.deepEqual(
  clean({ a: 1, b: undefined, _ui: true, _deleted: false, list: [{ x: 1, y: undefined, deep: [{ z: undefined, w: 2 }] }, undefined] }),
  { a: 1, _deleted: false, list: [{ x: 1, deep: [{ w: 2 }] }] },
  'undefined removed at every depth, including inside arrays',
);
console.log('write cleaning OK');
