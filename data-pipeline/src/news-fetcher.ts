#!/usr/bin/env node
/**
 * Writes a static snapshot of the news feed to public/data/news/feed.json.
 *
 * The live feed comes from Firestore (`news`), refreshed every 30 minutes by
 * the refreshNews Cloud Function (functions/index.js). This snapshot is only
 * the fallback the app shows before that function has run or when Firestore
 * is unreachable. Same sources and parsing as the function (functions/lib/news.js).
 *
 * Usage: npx tsx data-pipeline/src/news-fetcher.ts
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SOURCES, parseFeed, normalize, isRecent, dedupe } from '../../functions/lib/news.js';

const OUTPUT_PATH = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '../../public/data/news/feed.json');
const MAX_ARTICLES = 50;

async function main() {
  const now = new Date();
  const all: ReturnType<typeof normalize>[] = [];
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { headers: { 'User-Agent': 'MyBallot news reader (+https://myballot-app.web.app)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text()).map((r) => normalize(r, s, now)).filter(Boolean).filter((a) => isRecent(a!, now));
      console.log(`${s.name}: ${items.length}`);
      all.push(...items);
    } catch (e) {
      console.warn(`${s.name}: failed (${(e as Error).message})`);
    }
  }
  const items = dedupe(all.filter(Boolean) as NonNullable<(typeof all)[number]>[])
    .slice(0, MAX_ARTICLES)
    .map((a) => ({ ...a, createdAt: now.toISOString(), updatedAt: now.toISOString() }));
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify({ items, lastRefreshedAt: now.toISOString() }, null, 2) + '\n');
  console.log(`Wrote ${items.length} articles to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
