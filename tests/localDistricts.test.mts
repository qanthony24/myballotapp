// Local district maps (East Baton Rouge City-Parish GIS). Attributes below are
// real answers for the State Capitol area, captured Oct 31, 2026. Run: npm run test:data
import assert from 'node:assert/strict';
import { mergeLocalDistricts, EBR_LAYERS, type LayerResult } from '../services/localDistricts.ts';
import { statusForKey, derivedDistrictKey, raceBallotStatus, LOCAL_KEY_PREFIXES, districtToken } from '../services/ballotScope.ts';
import { voterKeySet } from '../hooks/useVoterDistricts.ts';

const census: any[] = [
  { type: 'statewide', key: 'la', label: 'Louisiana (statewide)' },
  { type: 'congressional', key: 'la-cd-2', label: 'U.S. House District 2', number: 2 },
  { type: 'state-house', key: 'la-house-67', label: 'State House District 67', number: 67 },
  { type: 'parishwide', key: 'parish-east-baton-rouge', label: 'East Baton Rouge Parish' },
  { type: 'municipal', key: 'city-baton-rouge', label: 'Baton Rouge city' },
];
const ok = (service: string, features: any[]): LayerResult => ({ service, ok: true, features });
const capitol: LayerResult[] = [
  ok('BESE_District', [{ ID: 2, DISTRICT_NUM: 8, COMMISSIONER: 'Preston Castille' }]),
  ok('Public_Service_Commission', [{ ID: 2, DISTRICT_NUM: 3, COMMISSIONER: 'Davante Lewis' }]),
  ok('LA_Supreme_Court', [{ ID: 1, DISTRICT_NUMBER: 2, JUDGE_NAME: 'John Michael Guidry' }]),
  ok('Council_District', [{ ID: 10, COUNCIL_PERSON: 'Carolyn Coleman', DISTRICT_NUM: 10 }]),
  ok('Council_District_Baker', []),
  ok('Council_District_Central', []),
  ok('Council_District_Zachary', []),
  ok('School_District', [{ ID: 13, SCHOOL_SYSTEM: 'EAST BATON ROUGE PARISH', DISTRICT_NO: 'EBR-5', SCHOOL_BOARD_MEM: 'Cliff Lewis' }]),
  ok('Judicial_Court_Sections', [{ ID: 2, SECTION: 1, DIVISIONS: 'A, B, D, J, K, L, M, O' }]),
  ok('City_Court_Section', [{ ID: 1, SECTION_NO: 1, DIVISION: 'B, C, D' }]),
  ok('Voting_Precinct', [{ VOTING_PRECINCT_NAME: '1-086', WARD: '1', PRECINCT: '86' }]),
  ok('City_Limit', [{ ID: 4, CITY_LIMITS_NAME: 'BATON ROUGE' }]),
];

const m = mergeLocalDistricts(census, capitol);
const keys = voterKeySet(m);
for (const k of ['la-bese-8', 'la-psc-3', 'la-supreme-2', 'ebr-council-10', 'ebr-school-5', 'jdc-19-section-1', 'jdc-19-div-d', 'jdc-19-div-o', 'br-city-court-div-c', 'ebr-precinct-1-086', 'city-baton-rouge']) {
  assert.ok(keys.has(k), `has ${k}`);
}
assert.equal(m.districts.filter((d) => d.type === 'municipal').length, 1, 'city not duplicated');
assert.equal(m.districts.find((d) => d.key === 'ebr-council-10')!.label, 'Metro Council District 10');
assert.equal(m.districts.find((d) => d.key === 'ebr-school-5')!.label, 'EBR School Board District 5');
console.log('EBR map parsing OK');

// Status: in the voter's districts → yes; same map, other district → no.
assert.equal(statusForKey('ebr-council-10', keys), 'yes');
assert.equal(statusForKey('ebr-council-7', keys), 'no');
assert.equal(statusForKey('jdc-19-div-c', keys), 'no', 'Division C is Section 2 only');
assert.equal(statusForKey('city-central-council-3', keys), 'no', 'Baton Rouge voter has no Central council race');
assert.equal(statusForKey('central-school-3', keys), 'no');
assert.equal(statusForKey('la-bese-6', keys), 'no');

// St. George: parish city limits replace the Census city.
const stg = mergeLocalDistricts(census, [ok('City_Limit', [{ CITY_LIMITS_NAME: 'SAINT GEORGE' }])]);
assert.deepEqual(stg.districts.filter((d) => d.type === 'municipal').map((d) => d.key), ['city-st-george']);
// Unincorporated: the Census city is dropped.
assert.ok(!mergeLocalDistricts(census, [ok('City_Limit', [])]).districts.some((d) => d.type === 'municipal'));

// Central school system.
const central = mergeLocalDistricts(census, [ok('School_District', [{ SCHOOL_SYSTEM: 'CENTRAL', DISTRICT_NO: 'Central-4' }])]);
assert.ok(voterKeySet(central).has('central-school-4'));
assert.equal(statusForKey('ebr-school-4', voterKeySet(central)), 'no', 'Central residents do not vote for EBR school board');

// A layer that failed: its races are "unknown", never hidden.
const partial = mergeLocalDistricts(census, capitol.map((r) => (r.service === 'Council_District' ? { ...r, ok: false, features: [] } : r)));
assert.equal(statusForKey('ebr-council-7', voterKeySet(partial)), 'unknown');
assert.equal(statusForKey('ebr-school-1', voterKeySet(partial)), 'no', 'other layers still answer');

// Voter in another parish: EBR-only races are definitely not on their ballot; BESE (statewide map we lack there) is unknown.
const caddo = voterKeySet({ districts: [{ type: 'parishwide', key: 'parish-caddo', label: 'Caddo Parish' } as any] });
assert.equal(statusForKey('ebr-council-10', caddo), 'no');
assert.equal(statusForKey('la-bese-8', caddo), 'unknown');
// Saved before this update (no local lookup at all), in EBR: unknown.
assert.equal(statusForKey('ebr-council-10', voterKeySet({ districts: census })), 'unknown');
console.log('local ballot matching OK');

// Keys derived from offices.
assert.equal(districtToken('District 10'), '10');
assert.equal(districtToken('Division D'), 'd');
assert.equal(districtToken('Div. o'), 'o');
assert.equal(districtToken(''), undefined);
const offices: any[] = [
  { id: 4, name: 'Metro Council', districtType: 'parish-council', districtKeyPrefix: 'ebr-council' },
  { id: 20, name: 'District Judge, 19th JDC', districtType: 'judicial', districtKeyPrefix: 'jdc-19-div' },
  { id: 21, name: 'BESE Member', districtType: 'bese' },
  { id: 22, name: 'Central Mayor', districtType: 'municipal', districtKeyPrefix: 'city-central' },
  { id: 23, name: 'Cleared prefix', districtType: 'parish-council', districtKeyPrefix: '' },
];
assert.equal(derivedDistrictKey(offices[0], 'District 10'), 'ebr-council-10');
assert.equal(derivedDistrictKey(offices[1], 'Division D'), 'jdc-19-div-d');
assert.equal(derivedDistrictKey(offices[2], 'District 8'), 'la-bese-8');
assert.equal(derivedDistrictKey(offices[3], undefined), 'city-central', 'prefix alone for an office with no districts');
assert.equal(derivedDistrictKey(offices[0], 'At-large'), undefined, "unparseable district → needs an explicit key, don't guess");
assert.equal(derivedDistrictKey(offices[4], 'District 3'), undefined);
assert.equal(raceBallotStatus({ officeId: 20, district: 'Division D' } as any, offices, keys), 'yes');
assert.equal(raceBallotStatus({ officeId: 4, district: 'District 3' } as any, offices, keys), 'no');

// Every prefix a map layer answers for is registered in ballotScope (and vice versa).
const covers = new Set(EBR_LAYERS.flatMap((l) => l.covers).filter((c) => c !== 'city'));
assert.deepEqual([...covers].sort(), Object.keys(LOCAL_KEY_PREFIXES).sort());
console.log('derived keys OK');

// Live answers for a point in Central (captured Oct 31, 2026).
const centralLive = mergeLocalDistricts(census, [
  ok('Council_District', [{ DISTRICT_NUM: 4 }]),
  ok('Council_District_Central', [{ DISTRICT_NUM: 4 }]),
  ok('School_District', [{ DISTRICT_NO: 'Central-3' }]),
  ok('Judicial_Court_Sections', [{ SECTION: 2, DIVISIONS: 'B, C, E, F, G, H, I, N' }]),
  ok('City_Court_Section', []),
  ok('City_Limit', [{ CITY_LIMITS_NAME: 'CENTRAL' }]),
]);
const ck = voterKeySet(centralLive);
for (const k of ['ebr-council-4', 'city-central-council-4', 'central-school-3', 'jdc-19-div-c', 'city-central']) assert.ok(ck.has(k), `central has ${k}`);
assert.equal(statusForKey('br-city-court-div-b', ck), 'no', 'Central is outside Baton Rouge City Court');
assert.equal(statusForKey('city-baton-rouge', ck), 'no');
console.log('Central OK');
