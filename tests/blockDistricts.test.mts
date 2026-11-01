// BESE / PSC / Supreme Court by census block. Run: npm run test:data
import assert from 'node:assert/strict';
import { parseBlockEquivalency, buildParishTables, districtForBlock, districtsFromBlockFile, addBlockDistricts } from '../services/blockDistricts.ts';

// The Legislature's format: block, spaces, district (CRLF). Some exports use commas.
const bese = parseBlockEquivalency(
  ['220330051003010   8', '220330051003011   8', '220330051003012   6', '220330043013030   6', '220050304042037   6', '"220330039142001",8', 'junk line', ''].join('\r\n'),
);
assert.equal(bese.size, 6);
assert.equal(bese.get('220330039142001'), 8);
const psc = parseBlockEquivalency('220330051003010 3\n220330051003011 3\n220330051003012 3\n220330043013030 2\n220050304042037 2\n220330039142001 3\n');

const parishes = buildParishTables({ bese, psc });
assert.deepEqual([...parishes.keys()].sort(), ['005', '033']);
const ebr = parishes.get('033')!;
// Tract 005100 is split for BESE (two 8s, one 6) → default 8 with one exception; whole for PSC.
assert.deepEqual(ebr.bese!['005100'], [8, { '3012': 6 }]);
assert.equal(ebr.psc!['005100'], 3);
assert.equal(districtForBlock(ebr.bese, '220330051003010'), 8);
assert.equal(districtForBlock(ebr.bese, '220330051003012'), 6);
assert.equal(districtForBlock(ebr.bese, '220330051003099'), 8, 'block missing from a split tract falls back to the tract default');
assert.equal(districtForBlock(ebr.bese, '220330999999999'), undefined, 'unknown tract');
console.log('block tables OK');

const file = { v: 1 as const, parish: '033', plans: ebr, sources: {} };
const census: any[] = [{ type: 'statewide', key: 'la', label: 'Louisiana' }, { type: 'parishwide', key: 'parish-east-baton-rouge', label: 'EBR' }];
const r = districtsFromBlockFile(file, '220330051003012', census);
assert.deepEqual(r.checked, ['la-bese', 'la-psc'], 'no Supreme Court table in this file → not checked');
assert.ok(r.districts.some((d) => d.key === 'la-bese-6' && d.label === 'BESE District 6'));
assert.ok(r.districts.some((d) => d.key === 'la-psc-3'));
// Parish GIS said BESE 8 for this block; the enacted plan's answer replaces it.
const fromGis = districtsFromBlockFile(file, '220330051003012', [...census, { type: 'bese', key: 'la-bese-8', label: 'BESE District 8' }]);
assert.deepEqual(fromGis.districts.filter((d) => d.key.startsWith('la-bese')).map((d) => d.key), ['la-bese-6']);
// Same answer from both sources → one entry.
assert.equal(districtsFromBlockFile(file, '220330051003010', [...census, { type: 'bese', key: 'la-bese-8', label: 'x' } as any]).districts.filter((d) => d.key.startsWith('la-bese')).length, 1);
// Block from another parish → nothing.
assert.deepEqual(districtsFromBlockFile(file, '220050304042037', census).checked, []);

// No block / bad block → unchanged, no network.
assert.deepEqual(await addBlockDistricts(census, undefined), { districts: census, checked: [] });
assert.deepEqual(await addBlockDistricts(census, 'nope'), { districts: census, checked: [] });
console.log('block lookup OK');
