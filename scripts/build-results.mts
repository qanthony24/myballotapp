/**
 * Download Louisiana election results from the Secretary of State's results
 * site and write them for the app's Results section.
 *
 *   npm run data:results                       every election in the SoS archive, all parishes
 *   npm run data:results -- --since 2015       only elections from 2015 on
 *   npm run data:results -- --region           local races only for the 9 Capital Region parishes
 *   npm run data:results -- --only 20231014    one election
 *
 * Writes public/data/results/index.json and public/data/results/{yyyymmdd}.json.
 * Raw downloads are cached in data/.cache/sos/ (official results never change,
 * so re-runs only fetch new or unofficial elections). Safe to stop and re-run.
 *
 * Polite by design: one request at a time with a short pause, identifies
 * itself, backs off when the server says to.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { asArray, buildElection, indexEntry, parishCode, type ResultsElection, type SosRace, type SosVotes } from '../services/sosResults.ts';

const BASE = 'https://voterportal.sos.la.gov/ElectionResults/ElectionResults/Data?blob=';
const CACHE = path.resolve('data/.cache/sos');
const OUT = path.resolve('public/data/results');
const REGION = ['East Baton Rouge', 'Ascension', 'Livingston', 'West Baton Rouge', 'Iberville', 'Pointe Coupee', 'East Feliciana', 'West Feliciana', 'St. Helena'];

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const since = Number(arg('--since') ?? 0);
const only = arg('--only');
const regionOnly = process.argv.includes('--region');
const regionCodes = new Set(REGION.map((p) => parishCode(p)!));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function get(blob: string, cacheable: boolean): Promise<any | null> {
  const file = path.join(CACHE, blob.replace(/[\\/]/g, '__'));
  if (cacheable) {
    try {
      return JSON.parse(await readFile(file, 'utf-8'));
    } catch {
      // not cached yet
    }
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(150);
    requests++;
    try {
      const res = await fetch(BASE + blob, { headers: { 'User-Agent': 'MyBallot results archive (+https://myballot-app.web.app)' } });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(60, Number(res.headers.get('retry-after')) || attempt * 10);
        console.warn(`  ${res.status} on ${blob}; waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = text.trim() ? JSON.parse(text) : null;
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, JSON.stringify(json));
      return json;
    } catch (e) {
      if (attempt === 4) throw new Error(`${blob}: ${(e as Error).message}`);
      await sleep(attempt * 3000);
    }
  }
  return null;
}

const races = (j: any): SosRace[] => asArray(j?.Races?.Race);
const votes = (j: any): SosVotes[] => races(j) as unknown as SosVotes[];

async function main() {
  const dates = asArray((await get('ElectionDates.htm', false))?.Dates?.Date);
  if (!dates.length) throw new Error('Could not read the list of elections from the Secretary of State.');
  const todo = dates
    .map((d: any) => {
      const [m, day, y] = String(d.ElectionDate).split('/');
      return { id: `${y}${m}${day}`, official: d.ResultsOfficial === '1' };
    })
    .filter((d: { id: string }) => (!only || d.id === only) && Number(d.id.slice(0, 4)) >= since);
  console.log(`${todo.length} elections to process${regionOnly ? ' (local races: Capital Region only)' : ''}…`);

  await mkdir(OUT, { recursive: true });
  let written = 0;
  const failed: string[] = [];
  for (const [n, d] of todo.entries()) {
    const cache = d.official; // unofficial results can still change
    try {
    const [rc, vt, pie] = [await get(`${d.id}/RacesCandidates_Multiparish.htm`, cache), await get(`${d.id}/Votes_Multiparish.htm`, cache), await get(`${d.id}/ParishesInElection.htm`, cache)];
    const codes: string[] = asArray(pie?.ParishesInElection?.Parish).map((p: any) => String(p.ParishValue).padStart(2, '0')).filter((c: string) => !regionOnly || regionCodes.has(c));
    const parishes = [];
    for (const code of codes) {
      const [prc, pvt] = [await get(`${d.id}/RacesCandidates/ByParish_${code}.htm`, cache), await get(`${d.id}/VotesParish/Votes_${code}.htm`, cache)];
      if (prc && pvt) parishes.push({ code, races: races(prc), votes: votes(pvt) });
    }
    const election: ResultsElection | null = buildElection({ date: d.id, official: d.official, multi: rc && vt ? { races: races(rc), votes: votes(vt) } : undefined, parishes });
    if (election) {
      await writeFile(path.join(OUT, `${d.id}.json`), JSON.stringify(election));
      written++;
    }
    console.log(`[${n + 1}/${todo.length}] ${d.id}: ${election ? `${election.contests.length} contests` : 'no results'}  (${requests} requests so far)`);
    } catch (e) {
      failed.push(d.id);
      console.warn(`[${n + 1}/${todo.length}] ${d.id}: SKIPPED (${(e as Error).message}). Re-run later; it will retry.`);
    }
  }

  // Rebuild the index from every election file on disk (so partial runs keep older ones).
  const files = (await readdir(OUT)).filter((f) => /^\d{8}\.json$/.test(f));
  const index = [];
  for (const f of files) index.push(indexEntry(JSON.parse(await readFile(path.join(OUT, f), 'utf-8'))));
  index.sort((a, b) => b.electionDate.localeCompare(a.electionDate));
  await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ v: 1, builtAt: new Date().toISOString(), source: 'Louisiana Secretary of State', elections: index }));
  console.log(`\nDone: wrote ${written} elections this run; index has ${index.length}. ${requests} requests.`);
  if (failed.length) console.log(`Skipped ${failed.length} (tell Claude): ${failed.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
