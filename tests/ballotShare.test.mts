// Share links and the printable ballot. Run: npm run test:data
import assert from 'node:assert/strict';
import { encodeSharedBallot, decodeSharedBallot, sharedToEntries, buildPrintableBallot, ballotAsText } from '../services/ballotShare.ts';

const entries: any[] = [
  { itemType: 'candidate', candidateId: 76065, officeId: 7 },
  { itemType: 'candidate', candidateId: 100001, officeId: 2, district: 'District 67' },
  { itemType: 'measure', measureId: 9001, vote: 'oppose' },
];
const payload = encodeSharedBallot('2027-10-09', entries);
assert.match(payload, /^[A-Za-z0-9_-]+$/, 'URL-safe');
assert.ok(payload.length < 120, `short enough for a text message (${payload.length} chars)`);
assert.deepEqual(decodeSharedBallot(payload), {
  electionDate: '2027-10-09', candidateIds: [76065, 100001], measures: [{ measureId: 9001, vote: 'oppose' }],
});
for (const bad of ['', 'not-base64!!', encodeURIComponent('{"v":2}'), payload.slice(0, 10)]) assert.equal(decodeSharedBallot(bad), null, `rejects "${bad}"`);
console.log('share links OK');

const offices: any[] = [
  { id: 7, name: 'US Senator', districtType: 'statewide' },
  { id: 2, name: 'State Representative', districtType: 'state-house' },
  { id: 4, name: 'Metro Council', districtType: 'parish-council' },
];
const candidates: any[] = [
  { id: 76065, firstName: 'Julia', lastName: 'Letlow', party: 'Republican', officeId: 7, cycleIds: [5], ballotOrder: 0 },
  { id: 73448, firstName: 'Jamie', lastName: 'Davis', party: 'Democratic', officeId: 7, cycleIds: [5], ballotOrder: 0 },
  { id: 100001, firstName: 'Pat', lastName: 'Poe', party: 'No Party', officeId: 2, district: 'District 67', cycleIds: [5], ballotOrder: 0 },
  { id: 100002, firstName: 'Sam', lastName: 'Soe', party: 'Republican', officeId: 2, district: 'District 61', cycleIds: [5], ballotOrder: 0 },
  { id: 100003, firstName: 'Cy', lastName: 'Coe', party: '', officeId: 4, district: 'District 10', cycleIds: [5], ballotOrder: 0 },
];
const measures: any[] = [{ id: 9001, title: 'Amendment 1', electionDate: '2027-10-09' }, { id: 9002, title: 'Amendment 2', electionDate: '2027-10-09' }];
const base = { electionId: 5, electionDate: '2027-10-09', entries, candidates, races: [], offices, measures };

// No address: every race shows.
const all = buildPrintableBallot({ ...base, voterKeys: null });
assert.deepEqual(all.races.map((r) => r.title).sort(), ['Metro Council, District 10', 'State Representative, District 61', 'State Representative, District 67', 'US Senator']);
assert.equal(all.undecided, 2);

// Baton Rouge voter in House 67: House 61 drops out; council is shown but flagged uncertain.
const mine = buildPrintableBallot({ ...base, voterKeys: new Set(['la', 'la-house-67']) });
assert.deepEqual(mine.races.map((r) => r.title), ['US Senator', 'State Representative, District 67', 'Metro Council, District 10'].filter((t) => mine.races.some((r) => r.title === t)));
assert.ok(!mine.races.some((r) => r.title.includes('District 61')), 'race not on ballot is left off');
assert.equal(mine.races.find((r) => r.title.startsWith('Metro'))!.uncertain, true);
assert.deepEqual(mine.races.find((r) => r.title === 'US Senator')!.choices, [{ name: 'Julia Letlow', party: 'Republican' }]);
assert.deepEqual(mine.measures, [{ title: 'Amendment 1', vote: 'NO' }, { title: 'Amendment 2', vote: null }]);

// A pick in a race the address rules out is still printed (never silently drop a choice).
const odd = buildPrintableBallot({ ...base, entries: [{ itemType: 'candidate', candidateId: 100002, officeId: 2, district: 'District 61' }], voterKeys: new Set(['la', 'la-house-67']) });
assert.ok(odd.races.some((r) => r.title.includes('District 61')));

// Shared entries round-trip; unknown candidate ids are skipped.
const back = sharedToEntries({ electionDate: '2027-10-09', candidateIds: [76065, 999999], measures: [{ measureId: 9001, vote: 'support' }] }, candidates);
assert.equal(back.length, 2);
assert.match(ballotAsText('2027 Primary', mine), /US Senator: Julia Letlow \(Republican\)/);
console.log('printable ballot OK');
