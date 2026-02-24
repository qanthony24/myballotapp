#!/usr/bin/env node
/**
 * Pipeline runner: extract → transform → diff → write
 *
 * Usage:
 *   npx tsx data-pipeline/src/runner.ts \
 *     --address "600 E Trade St Charlotte NC" \
 *     --election-id 9505
 *
 * Environment:
 *   GOOGLE_CIVIC_API_KEY  (required)
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleCivicExtractor } from './extractors/google-civic.js';
import { transformGoogleCivicContests } from './transform.js';
import { diffContests, applyDiff } from './diff.js';
import { ContestV1 } from './types.js';

const DATA_DIR = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '../../data/contests',
);

async function loadExisting(filePath: string): Promise<ContestV1[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseArgs(): {
  address: string;
  electionId?: string;
  electionDate?: string;
  listElections: boolean;
} {
  const args = process.argv.slice(2);
  let address = '';
  let electionId: string | undefined;
  let electionDate: string | undefined;
  let listElections = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--address':
        address = args[++i];
        break;
      case '--election-id':
        electionId = args[++i];
        break;
      case '--election-date':
        electionDate = args[++i];
        break;
      case '--list-elections':
        listElections = true;
        break;
    }
  }

  return { address, electionId, electionDate, listElections };
}

async function main(): Promise<void> {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) {
    console.error(
      'Error: GOOGLE_CIVIC_API_KEY environment variable is required.',
    );
    console.error(
      'Never hard-code the key. Set it via: export GOOGLE_CIVIC_API_KEY=...',
    );
    process.exit(1);
  }

  const { address, electionId, electionDate, listElections } = parseArgs();
  const extractor = new GoogleCivicExtractor(apiKey);

  if (listElections) {
    console.log('\n📋 Available elections:\n');
    const elections = await extractor.listElections();
    for (const e of elections) {
      console.log(`  ${e.id.padEnd(8)} ${e.date}  ${e.name}`);
    }
    console.log(
      `\nTotal: ${elections.length} elections.\n`,
    );
    return;
  }

  if (!address) {
    console.error('Error: --address is required (or use --list-elections).');
    console.error(
      'Example: npx tsx data-pipeline/src/runner.ts --address "600 E Trade St Charlotte NC" --election-id 9505',
    );
    process.exit(1);
  }

  console.log(`\n🗳️  MyBallot Data Pipeline`);
  console.log(`   Source:   Google Civic Information API`);
  console.log(`   Address:  ${address}`);
  if (electionId) console.log(`   Election: ${electionId}`);
  console.log('');

  // 1. Extract
  console.log('📥 Extracting…');
  const raw = await extractor.fetch(
    electionDate ?? '',
    { address, electionId },
  );
  console.log(
    `   Found ${raw.meta.rawContestCount} raw contests (${raw.meta.durationMs}ms)`,
  );
  console.log(`   Election: ${raw.meta.electionName} (${raw.meta.electionDate})`);

  if (raw.meta.rawContestCount === 0) {
    console.log('\n⚠️  No contests returned for this address/election.');
    console.log('   This is normal if Google has no VIP data for this jurisdiction.\n');
    return;
  }

  // 2. Transform
  console.log('\n🔄 Transforming…');
  const contests = transformGoogleCivicContests(raw.rawContests, raw.meta);
  console.log(`   Produced ${contests.length} normalized contest records`);

  // 3. Diff
  await fs.mkdir(DATA_DIR, { recursive: true });
  const outFile = path.join(DATA_DIR, `${raw.meta.electionId}.json`);
  const existing = await loadExisting(outFile);

  console.log('\n📊 Diffing…');
  const diff = diffContests(contests, existing);
  console.log(`   Added:     ${diff.added.length}`);
  console.log(`   Updated:   ${diff.updated.length}`);
  console.log(`   Deleted:   ${diff.deleted.length}`);
  console.log(`   Unchanged: ${diff.unchanged}`);

  // 4. Write
  const merged = applyDiff(existing, diff, contests);
  await fs.writeFile(outFile, JSON.stringify(merged, null, 2));
  console.log(`\n💾 Wrote ${merged.length} contests → ${path.relative(process.cwd(), outFile)}`);

  // Also write a summary manifest
  const manifest = {
    lastUpdated: new Date().toISOString(),
    electionId: raw.meta.electionId,
    electionName: raw.meta.electionName,
    electionDate: raw.meta.electionDate,
    address: raw.meta.address,
    source: 'google-civic',
    totalContests: merged.filter((c) => !c.deleted).length,
    totalCandidates: merged
      .filter((c) => !c.deleted)
      .reduce((sum, c) => sum + c.candidates.length, 0),
  };
  const manifestPath = path.join(DATA_DIR, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   Manifest  → ${path.relative(process.cwd(), manifestPath)}`);
  console.log('\n✅ Pipeline complete.\n');
}

main().catch((err) => {
  console.error('\n❌ Pipeline failed:', err.message);
  process.exit(1);
});
