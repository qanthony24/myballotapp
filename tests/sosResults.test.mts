// Secretary of State results → app format. Fixtures are real SoS responses (trimmed), captured Nov 2, 2026.
import assert from 'node:assert/strict';
import { buildElection, convertRaces, indexEntry, parseChoice, parishName, parishCode, electionName } from '../services/sosResults.ts';

// Oct 14, 2023 gubernatorial primary, Governor (top 3 of 15 candidates).
const gov = { ID: '63500', SpecificTitle: 'Governor', GeneralTitle: 'Governor', OfficeLevel: '100', IsMultiParish: '1', NumberToBeElected: '1', SummaryText: null, IsClosedParty: '0', CanHaveRunoff: '1',
  Choice: [{ ID: '119808', Desc: '"Jeff" Landry (REP)' }, { ID: '119943', Desc: 'Stephen "Wags" Waguespack (REP)' }, { ID: '118959', Desc: 'Shawn D. Wilson (DEM)' }] };
const govVotes = { ID: '63500', PrecinctsReporting: '3929', PrecinctsExpected: '3929', VoterCountQualified: '2970684', VoterCountVoted: '1078689',
  Choice: [{ ID: '119808', VoteTotal: '547827', Outcome: 'Elected' }, { ID: '118959', VoteTotal: '275525', Outcome: 'Defeated' }, { ID: '119943', VoteTotal: '62287', Outcome: 'Defeated' }] };
// A local East Baton Rouge race with a runoff, and a parish proposition.
const fam = { ID: '64513', SpecificTitle: 'Judge, Family Court -- Election Section 3, Division D', GeneralTitle: 'Parish Court Judge', OfficeLevel: '220', NumberToBeElected: '1',
  Choice: [{ ID: 'a', Desc: 'Caulette "Twin" Jackson Guillard (DEM)' }, { ID: 'b', Desc: 'Jane Roe (DEM)' }, { ID: 'c', Desc: 'Joe Bloe (REP)' }] };
const famVotes = { ID: '64513', PrecinctsReporting: '122', PrecinctsExpected: '122', VoterCountQualified: '102181', VoterCountVoted: '37028',
  Choice: [{ ID: 'a', VoteTotal: '15000', Outcome: 'Runoff' }, { ID: 'b', VoteTotal: '12000', Outcome: 'Runoff' }, { ID: 'c', VoteTotal: '8000', Outcome: 'Defeated' }] };
const prop = { ID: '70000', SpecificTitle: 'Fire Protection District 6 Proposition -- 10 Mills Renewal', GeneralTitle: 'Proposition', OfficeLevel: '999', SummaryText: 'Shall the District continue to levy…',
  Choice: [{ ID: 'y', Desc: 'YES' }, { ID: 'n', Desc: 'NO' }] };
const propVotes = { ID: '70000', Choice: [{ ID: 'y', VoteTotal: '3000', Outcome: 'Approved' }, { ID: 'n', VoteTotal: '1000', Outcome: '' }] };

assert.deepEqual(parseChoice('"Jeff" Landry (REP)'), { name: '"Jeff" Landry', party: 'Republican' });
assert.deepEqual(parseChoice('Benjamin Barnes (IND)'), { name: 'Benjamin Barnes', party: 'Independent' });
assert.deepEqual(parseChoice('Write-in, no party'), { name: 'Write-in, no party' });
assert.equal(parishName('17'), 'East Baton Rouge');
assert.equal(parishName('03'), 'Ascension');
assert.equal(parishName('64'), 'Winn');
assert.equal(parishCode('St. Helena'), '46');
assert.equal(electionName('2023-10-14'), 'October 14, 2023');

const [g] = convertRaces([gov], [govVotes]);
assert.equal(g.title, 'Governor');
assert.deepEqual(g.resultItems.map((i) => [i.name, i.votes, i.votePercent, !!i.isWinner]), [
  ['"Jeff" Landry', 547827, 61.9, true], ['Shawn D. Wilson', 275525, 31.1, false], ['Stephen "Wags" Waguespack', 62287, 7, false],
], 'sorted by votes; percent of the votes in this (trimmed) race');
assert.equal(g.winnerId, '119808');
assert.equal(g.called, true);
assert.equal(g.level, 100);
assert.equal(g.parish, undefined);

const [f] = convertRaces([fam], [famVotes], 'East Baton Rouge');
assert.equal(f.runoff, true);
assert.equal(f.winnerId, undefined, 'runoff: nobody elected yet');
assert.deepEqual(f.resultItems.filter((i) => i.outcome === 'Runoff').map((i) => i.name), ['Caulette "Twin" Jackson Guillard', 'Jane Roe']);
const [p] = convertRaces([prop], [propVotes], 'East Baton Rouge');
assert.equal(p.contestType, 'measure');
assert.equal(p.resultItems[0].name, 'YES');
assert.equal(p.resultItems[0].isWinner, true);
assert.match(p.summary!, /^Shall the District/);
assert.equal(convertRaces([gov], []).length, 0, 'race without votes is skipped');
console.log('race conversion OK');

const e = buildElection({ date: '20231014', official: true, multi: { races: [gov], votes: [govVotes] }, parishes: [{ code: '17', races: [fam, prop], votes: [famVotes, propVotes] }] })!;
assert.equal(e.electionId, '20231014');
assert.equal(e.electionDate, '2023-10-14');
assert.equal(e.electionType, 'state');
assert.deepEqual(e.turnout, { registeredVoters: 2970684, ballotsCast: 1078689, turnoutPercent: 36.3 });
assert.deepEqual(e.parishesWithLocalRaces, ['East Baton Rouge']);
assert.equal(e.contests.length, 3);
const ix = indexEntry(e);
assert.deepEqual(ix.highlights, ['Governor']);
assert.equal(ix.statewideCount, 1);
assert.equal(buildElection({ date: '20261103', official: false, multi: { races: [gov], votes: [{ ...govVotes, Choice: govVotes.Choice.map((c) => ({ ...c, VoteTotal: '0', Outcome: '' })) }] }, parishes: [] }), null, 'future election with no votes is skipped');
const localOnly = buildElection({ date: '20250329', official: true, parishes: [{ code: '17', races: [prop], votes: [propVotes] }] })!;
assert.equal(localOnly.electionType, 'municipal');
assert.deepEqual(indexEntry(localOnly).highlights, ['Local races in 1 parish']);
console.log('election assembly OK');

// Voter deadlines (services/votingDates.ts).
import { voterDeadlines, nextElection, shiftDays } from '../services/votingDates.ts';
assert.equal(shiftDays('2027-10-09', -30), '2027-09-09');
assert.equal(shiftDays('2027-03-01', -1), '2027-02-28');
const sat = { id: 5, name: '2027 Primary', slug: 'x', electionDate: '2027-10-09', evStart: '2027-09-25', evEnd: '2027-10-02' } as any;
const dl = voterDeadlines(sat);
assert.deepEqual(dl.map((d) => [d.key, d.date, d.estimated]), [
  ['registerInPerson', '2027-09-09', true], ['registerOnline', '2027-09-19', true], ['earlyVoting', '2027-09-25', false],
  ['absenteeRequest', '2027-10-05', true], ['absenteeReturn', '2027-10-08', true], ['electionDay', '2027-10-09', false],
]);
assert.match(dl.at(-1)!.detail!, /7 a\.m\./, 'Saturday polls open at 7');
assert.match(voterDeadlines({ ...sat, electionDate: '2026-11-03' }).at(-1)!.detail!, /6 a\.m\./, 'Tuesday polls open at 6');
const official = voterDeadlines({ ...sat, registrationDeadline: '2027-09-08' });
assert.deepEqual([official[0].date, official[0].estimated], ['2027-09-08', false], 'official date wins');
assert.equal(nextElection([sat, { ...sat, electionDate: '2026-11-03' }], '2026-11-02')!.electionDate, '2026-11-03');
assert.equal(nextElection([sat], '2028-01-01'), null);
console.log('voter deadlines OK');

// Single-item shapes from the SoS feed (one parish, one race, one candidate) — crashed the Nov 2 test run.
import { asArray } from '../services/sosResults.ts';
assert.deepEqual(asArray({ a: 1 }), [{ a: 1 }]);
assert.deepEqual(asArray(undefined), []);
assert.deepEqual(asArray([1, 2]), [1, 2]);
const unopposed = convertRaces({ ...fam, Choice: { ID: 'a', Desc: 'Only One (DEM)' } } as any, { ID: '64513', Choice: { ID: 'a', VoteTotal: '10', Outcome: 'Elected' } } as any, 'East Baton Rouge');
assert.equal(unopposed.length, 1);
assert.equal(unopposed[0].resultItems[0].name, 'Only One');
assert.equal(unopposed[0].resultItems[0].votePercent, 100);
console.log('single-item shapes OK');
