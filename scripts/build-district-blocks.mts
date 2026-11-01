/**
 * Build per-parish BESE / PSC / Supreme Court lookup tables from the
 * Louisiana Legislature's official block equivalency files.
 *
 *   npm run data:districts                 download from redist.legis.la.gov and build
 *   npm run data:districts -- --from DIR   use files already downloaded into DIR
 *
 * Writes public/data/districts/blocks-<parish FIPS>.json (one per parish) and
 * public/data/districts/manifest.json. Re-run whenever the Legislature
 * enacts a new plan (update PLANS below), then commit the output.
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseBlockEquivalency, buildParishTables, type BlockPlan } from '../services/blockDistricts.ts';

const SITE = 'https://redist.legis.la.gov/';
const PLANS: Record<BlockPlan, { name: string; file: string }> = {
  bese: {
    name: 'BESE, Act 3 (HB3), 2022 1st Extraordinary Session',
    file: '2023_07/Adopted Plans From the 2022 1st Extraordinary Session/Block Equivalency Files/BESE - Act 3 (HB3) 1st ES (2022).txt',
  },
  psc: {
    name: 'Public Service Commission, Act 2 (HB2), 2022 1st Extraordinary Session',
    file: '2023_07/Adopted Plans From the 2022 1st Extraordinary Session/Block Equivalency Files/PSC - Act 2 (HB2) 1st ES (2022).txt',
  },
  supreme: {
    name: 'Supreme Court, Act 7 (SB255), 2024 Regular Session',
    file: '2024_Files/2024_RS/2024LASSCAct7/Block Equivalency File/Act 7 - RS (2024) - LASC.txt',
  },
};

const OUT = path.resolve('public/data/districts');
const fromIdx = process.argv.indexOf('--from');
const fromDir = fromIdx > 0 ? process.argv[fromIdx + 1] : undefined;

async function getText(plan: BlockPlan): Promise<string> {
  const { file } = PLANS[plan];
  if (fromDir) return readFile(path.join(fromDir, path.basename(file)), 'utf-8');
  const url = SITE + encodeURI(file);
  process.stdout.write(`Downloading ${plan}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const text = await res.text();
  console.log(`${(text.length / 1e6).toFixed(1)} MB`);
  return text;
}

const maps: Partial<Record<BlockPlan, Map<string, number>>> = {};
for (const plan of Object.keys(PLANS) as BlockPlan[]) {
  const m = parseBlockEquivalency(await getText(plan));
  // Sanity checks: Louisiana has ~143k 2020 blocks; districts are small positive numbers.
  if (m.size < 100_000) throw new Error(`${plan}: only ${m.size} blocks parsed. Has the file format changed?`);
  const districts = new Set(m.values());
  if ([...districts].some((d) => d < 1 || d > 20)) throw new Error(`${plan}: unexpected district numbers ${[...districts].join(',')}`);
  console.log(`  ${plan}: ${m.size} blocks, districts ${[...districts].sort((a, b) => a - b).join(', ')}`);
  maps[plan] = m;
}

const parishes = buildParishTables(maps);
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const sources = Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, `${p.name} — ${SITE}${p.file}`]));
let bytes = 0;
for (const [parish, plans] of [...parishes].sort(([a], [b]) => a.localeCompare(b))) {
  const json = JSON.stringify({ v: 1, parish, plans, sources });
  bytes += json.length;
  await writeFile(path.join(OUT, `blocks-${parish}.json`), json + '\n');
}
await writeFile(
  path.join(OUT, 'manifest.json'),
  JSON.stringify({ v: 1, builtAt: new Date().toISOString(), parishes: [...parishes.keys()].sort(), sources }, null, 2) + '\n',
);
console.log(`\nWrote ${parishes.size} parish files (${(bytes / 1024).toFixed(0)} KB total) to ${path.relative(process.cwd(), OUT)}`);
