#!/usr/bin/env node
/**
 * Pipeline runner: extract → transform → diff → write
 *
 * Usage:
 *   # Louisiana manual seed data (primary path)
 *   npx tsx data-pipeline/src/runner.ts --source manual
 *
 *   # Google Civic API (when LA data becomes available)
 *   GOOGLE_CIVIC_API_KEY=... npx tsx data-pipeline/src/runner.ts \
 *     --source google-civic --address "..." --election-id ...
 *
 *   # List elections from either source
 *   npx tsx data-pipeline/src/runner.ts --source manual --list-elections
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleCivicExtractor } from './extractors/google-civic.js';
import { ManualExtractor } from './extractors/manual.js';
import { transformGoogleCivicContests } from './transform.js';
import { transformManualContests } from './transform-manual.js';
import { diffContests, applyDiff } from './diff.js';
import { ContestV1, RawExtractionResult } from './types.js';

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

interface CliArgs {
  source: 'manual' | 'google-civic';
  address: string;
  electionId?: string;
  electionDate?: string;
  seedFile?: string;
  listElections: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let source: 'manual' | 'google-civic' = 'manual';
  let address = '';
  let electionId: string | undefined;
  let electionDate: string | undefined;
  let seedFile: string | undefined;
  let listElections = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
        source = args[++i] as 'manual' | 'google-civic';
        break;
      case '--address':
        address = args[++i];
        break;
      case '--election-id':
        electionId = args[++i];
        break;
      case '--election-date':
        electionDate = args[++i];
        break;
      case '--seed-file':
        seedFile = args[++i];
        break;
      case '--list-elections':
        listElections = true;
        break;
    }
  }

  return { source, address, electionId, electionDate, seedFile, listElections };
}

async function runManual(cli: CliArgs): Promise<void> {
  const extractor = new ManualExtractor();

  if (cli.listElections) {
    console.log('\n📋 Available Louisiana seed elections:\n');
    const elections = await extractor.listElections();
    for (const e of elections) {
      console.log(`  ${e.id.padEnd(18)} ${e.date}  ${e.name}`);
    }
    console.log(`\nTotal: ${elections.length} seed files.\n`);
    return;
  }

  const elections = await extractor.listElections();
  if (elections.length === 0) {
    console.error('Error: No seed files found in data/seed/.');
    process.exit(1);
  }

  console.log(`\n🗳️  MyBallot Data Pipeline — Louisiana`);
  console.log(`   Source: Manual Entry (Seed Data)`);
  console.log('');

  for (const election of elections) {
    console.log(`📥 Processing: ${election.name} (${election.date})…`);
    const raw = await extractor.fetch(election.date, {
      seedFile: undefined,
    });

    await processExtraction(raw, transformManualContests);
  }

  console.log('✅ All Louisiana seed data processed.\n');
}

async function runGoogleCivic(cli: CliArgs): Promise<void> {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) {
    console.error('Error: GOOGLE_CIVIC_API_KEY environment variable is required.');
    console.error('Set it via: export GOOGLE_CIVIC_API_KEY=...');
    process.exit(1);
  }

  const extractor = new GoogleCivicExtractor(apiKey);

  if (cli.listElections) {
    console.log('\n📋 Available Google Civic elections:\n');
    const elections = await extractor.listElections();
    for (const e of elections) {
      console.log(`  ${e.id.padEnd(8)} ${e.date}  ${e.name}`);
    }
    console.log(`\nTotal: ${elections.length} elections.\n`);
    return;
  }

  if (!cli.address) {
    console.error('Error: --address is required for Google Civic source.');
    process.exit(1);
  }

  console.log(`\n🗳️  MyBallot Data Pipeline`);
  console.log(`   Source:   Google Civic Information API`);
  console.log(`   Address:  ${cli.address}`);
  if (cli.electionId) console.log(`   Election: ${cli.electionId}`);
  console.log('');

  console.log('📥 Extracting…');
  const raw = await extractor.fetch(cli.electionDate ?? '', {
    address: cli.address,
    electionId: cli.electionId,
  });

  if (raw.meta.rawContestCount === 0) {
    console.log('\n⚠️  No contests returned for this address/election.');
    console.log('   Louisiana is not yet available in Google Civic API.');
    console.log('   Use --source manual to load Louisiana seed data instead.\n');
    return;
  }

  await processExtraction(raw, transformGoogleCivicContests);
  console.log('✅ Pipeline complete.\n');
}

async function processExtraction(
  raw: RawExtractionResult,
  transformFn: (rawContests: unknown[], meta: typeof raw.meta) => ContestV1[],
): Promise<void> {
  console.log(`   Found ${raw.meta.rawContestCount} raw contests`);
  console.log(`   Election: ${raw.meta.electionName} (${raw.meta.electionDate})`);

  // Transform
  console.log('🔄 Transforming…');
  const contests = transformFn(raw.rawContests, raw.meta);
  console.log(`   Produced ${contests.length} normalized contest records`);

  // Diff
  await fs.mkdir(DATA_DIR, { recursive: true });
  const outFile = path.join(DATA_DIR, `${raw.meta.electionId}.json`);
  const existing = await loadExisting(outFile);

  console.log('📊 Diffing…');
  const diff = diffContests(contests, existing);
  console.log(`   Added: ${diff.added.length}  Updated: ${diff.updated.length}  Deleted: ${diff.deleted.length}  Unchanged: ${diff.unchanged}`);

  // Write
  const merged = applyDiff(existing, diff, contests);
  await fs.writeFile(outFile, JSON.stringify(merged, null, 2));
  console.log(`💾 Wrote ${merged.length} contests → ${path.relative(process.cwd(), outFile)}`);

  // Write manifest
  const manifest = {
    lastUpdated: new Date().toISOString(),
    electionId: raw.meta.electionId,
    electionName: raw.meta.electionName,
    electionDate: raw.meta.electionDate,
    address: raw.meta.address,
    source: raw.meta.source,
    totalContests: merged.filter((c) => !c.deleted).length,
    totalCandidates: merged
      .filter((c) => !c.deleted)
      .reduce((sum, c) => sum + c.candidates.length, 0),
  };
  const manifestPath = path.join(DATA_DIR, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   Manifest → ${path.relative(process.cwd(), manifestPath)}\n`);
}

async function main(): Promise<void> {
  const cli = parseArgs();

  if (cli.source === 'manual') {
    await runManual(cli);
  } else {
    await runGoogleCivic(cli);
  }
}

main().catch((err) => {
  console.error('\n❌ Pipeline failed:', err.message);
  process.exit(1);
});
