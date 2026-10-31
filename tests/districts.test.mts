// Address → districts (Census responses captured Oct 31, 2026) and ballot matching. Run: npm run test:data
import assert from 'node:assert/strict';
import { parseCensusGeographies, DistrictLookupError } from '../services/districtLookup.ts';
import { raceBallotStatus, candidateBallotStatus, derivedDistrictKey } from '../services/ballotScope.ts';

// Real Census geographies for 400 Clyde Fant Memorial Pkwy, Shreveport (trimmed to the fields we use).
const shreveport = {
  States: [{ GEOID: '22', NAME: 'Louisiana', BASENAME: 'Louisiana', STATE: '22' }],
  'County Subdivisions': [{ GEOID: '2201794402', NAME: 'District 3', BASENAME: '3', STATE: '22', COUNTY: '017', COUSUB: '94402' }],
  'Incorporated Places': [{ GEOID: '2270000', NAME: 'Shreveport city', BASENAME: 'Shreveport', STATE: '22', PLACE: '70000' }],
  Counties: [{ GEOID: '22017', NAME: 'Caddo Parish', BASENAME: 'Caddo', STATE: '22', COUNTY: '017' }],
  '2026 State Legislative Districts - Upper': [{ GEOID: '22039', NAME: 'State Senate District 39', BASENAME: '39', STATE: '22', SLDU: '039' }],
  '120th Congressional Districts': [{ GEOID: '2204', NAME: 'Congressional District 4', BASENAME: '4', STATE: '22', CD120: '04' }],
  '2026 State Legislative Districts - Lower': [{ GEOID: '22002', NAME: 'State House District 2', BASENAME: '2', STATE: '22', SLDL: '002' }],
};
const d = parseCensusGeographies(shreveport as any);
assert.deepEqual(d.map((x) => x.key), ['la', 'la-cd-4', 'la-sen-39', 'la-house-2', 'parish-caddo', 'city-shreveport']);
assert.equal(d.find((x) => x.type === 'state-house')!.label, 'State House District 2');

// Baton Rouge City Hall (222 St Louis St): CD 2, Senate 14, House 67, East Baton Rouge.
const br = {
  States: [{ NAME: 'Louisiana', STATE: '22' }],
  Counties: [{ NAME: 'East Baton Rouge Parish', BASENAME: 'East Baton Rouge', STATE: '22' }],
  'Incorporated Places': [{ NAME: 'Baton Rouge city', BASENAME: 'Baton Rouge' }],
  '120th Congressional Districts': [{ BASENAME: '2', CD120: '02' }],
  '2026 State Legislative Districts - Upper': [{ BASENAME: '14', SLDU: '014' }],
  '2026 State Legislative Districts - Lower': [{ BASENAME: '67', SLDL: '067' }],
};
const brKeys = parseCensusGeographies(br as any).map((x) => x.key);
assert.deepEqual(brKeys, ['la', 'la-cd-2', 'la-sen-14', 'la-house-67', 'parish-east-baton-rouge', 'city-baton-rouge']);

// Future vintages rename layers (e.g. "121st Congressional Districts" with CD121) — still parsed.
const future = parseCensusGeographies({ ...br, '120th Congressional Districts': undefined, '121st Congressional Districts': [{ BASENAME: '5', CD121: '05' }] } as any);
assert.ok(future.some((x) => x.key === 'la-cd-5'));

// Unincorporated address: no city entry, no crash.
assert.ok(!parseCensusGeographies({ ...br, 'Incorporated Places': [] } as any).some((x) => x.type === 'municipal'));

// Outside Louisiana is a clear error.
assert.throws(() => parseCensusGeographies({ States: [{ NAME: 'Texas', STATE: '48' }] } as any), (e: unknown) => e instanceof DistrictLookupError && (e as DistrictLookupError).code === 'outside-louisiana');
console.log('district parsing OK');

// ---- Ballot matching ----
const offices: any[] = [
  { id: 7, name: 'US Senator', districtType: 'statewide' },
  { id: 8, name: 'US Representative', districtType: 'congressional' },
  { id: 2, name: 'State Representative', districtType: 'state-house' },
  { id: 4, name: 'Metro Council', districtType: 'parish-council' },
  { id: 99, name: 'Mystery Office' },
];
const voter = new Set(brKeys);
assert.equal(raceBallotStatus({ officeId: 7 } as any, offices, voter), 'yes', 'statewide race is on everyone’s ballot');
assert.equal(raceBallotStatus({ officeId: 8, district: 'District 2' } as any, offices, voter), 'yes');
assert.equal(raceBallotStatus({ officeId: 8, district: 'District 6' } as any, offices, voter), 'no');
assert.equal(raceBallotStatus({ officeId: 2, district: 'District 67' } as any, offices, voter), 'yes');
assert.equal(raceBallotStatus({ officeId: 2, district: 'District 61' } as any, offices, voter), 'no');
assert.equal(raceBallotStatus({ officeId: 4, district: 'District 10' } as any, offices, voter), 'unknown', 'council needs an explicit key');
assert.equal(raceBallotStatus({ officeId: 4, district: 'District 10', districtKey: 'parish-east-baton-rouge' } as any, offices, voter), 'yes', 'explicit key wins');
assert.equal(raceBallotStatus({ officeId: 99 } as any, offices, voter), 'unknown', 'office without district type');
assert.equal(raceBallotStatus({ officeId: 8 } as any, offices, voter), 'unknown', 'congressional race with no district number');
assert.equal(derivedDistrictKey(offices[1], 'U.S. House, 6th District'), 'la-cd-6', 'number read from free-text labels');

// Candidate uses their saved race's key when there is one.
const races: any[] = [{ id: 'x', officeId: 4, district: 'District 10', districtKey: 'ebr-council-10' }];
assert.equal(candidateBallotStatus({ officeId: 4, district: 'district 10' } as any, races, offices, voter), 'unknown', 'council map not looked up yet');
assert.equal(candidateBallotStatus({ officeId: 4, district: 'district 10' } as any, races, offices, new Set([...voter, 'checked:ebr-council'])), 'no');
assert.equal(candidateBallotStatus({ officeId: 4, district: 'district 10' } as any, races, offices, new Set(['ebr-council-10'])), 'yes');
assert.equal(candidateBallotStatus({ officeId: 7 } as any, [], offices, voter), 'yes');
console.log('ballot matching OK');
