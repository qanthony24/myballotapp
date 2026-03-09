#!/usr/bin/env node
/**
 * Pipeline → App adapter.
 *
 * Reads normalized ContestV1 records from data/contests/ and produces
 * app-ready JSON files (candidates, ballot measures) that constants.tsx
 * imports directly.
 *
 * Usage:
 *   npx tsx data-pipeline/src/seed-app.ts
 *
 * Output:
 *   data/app/candidates.json      — Candidate[]  (app format)
 *   data/app/ballot-measures.json  — BallotMeasure[] (app format)
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ContestV1, ContestCandidate } from './types.js';

const CONTESTS_DIR = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '../../data/contests',
);
const APP_DIR = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '../../data/app',
);

// ---------------------------------------------------------------------------
// Office mapping: pipeline office string → app officeId
// ---------------------------------------------------------------------------

interface OfficeMatcher {
  pattern: RegExp;
  officeId: number;
  extractDistrict: boolean;
}

const OFFICE_MATCHERS: OfficeMatcher[] = [
  { pattern: /\bmayor[- ]president\b/i,       officeId: 1,  extractDistrict: false },
  { pattern: /\bstate\s+representative\b/i,    officeId: 2,  extractDistrict: true },
  { pattern: /\b(?:city|family)\s+court\s+judge\b/i, officeId: 3, extractDistrict: false },
  { pattern: /\bmetro\s+council\b/i,           officeId: 4,  extractDistrict: true },
  { pattern: /\bu\.?s\.?\s*president\b/i,      officeId: 5,  extractDistrict: false },
  { pattern: /\bu\.?s\.?\s*senat/i,            officeId: 7,  extractDistrict: false },
  { pattern: /\bu\.?s\.?\s*(?:representative|rep)\b/i, officeId: 8, extractDistrict: true },
  { pattern: /\bgovernor\b/i,                  officeId: 9,  extractDistrict: false },
  { pattern: /\blieutenant\s+governor\b/i,     officeId: 10, extractDistrict: false },
  { pattern: /\battorney\s+general\b/i,        officeId: 11, extractDistrict: false },
  { pattern: /\bsecretary\s+of\s+state\b/i,    officeId: 12, extractDistrict: false },
  { pattern: /\bstate\s+treasurer\b/i,         officeId: 13, extractDistrict: false },
  { pattern: /\bschool\s+board\b/i,            officeId: 14, extractDistrict: true },
  { pattern: /\bparish\s+sheriff\b/i,          officeId: 15, extractDistrict: false },
  { pattern: /\bjustice\s+of\s+the\s+peace\b/i, officeId: 3, extractDistrict: true },
];

function matchOffice(officeStr: string): { officeId: number; district?: string } {
  for (const m of OFFICE_MATCHERS) {
    if (m.pattern.test(officeStr)) {
      let district: string | undefined;
      if (m.extractDistrict) {
        const distMatch = officeStr.match(/(?:district|dist\.?)\s*(\d+)/i);
        if (distMatch) {
          district = `District ${distMatch[1]}`;
        }
        const ordinalMatch = officeStr.match(/(\d+)(?:st|nd|rd|th)\s+district/i);
        if (!district && ordinalMatch) {
          district = `District ${ordinalMatch[1]}`;
        }
      }
      return { officeId: m.officeId, district };
    }
  }
  return { officeId: 0, district: undefined };
}

// ---------------------------------------------------------------------------
// Cycle mapping: electionDate → cycleId
// ---------------------------------------------------------------------------

const KNOWN_CYCLES: Array<{ id: number; electionDate: string }> = [
  { id: 1, electionDate: '2026-11-03' },
  { id: 2, electionDate: '2026-05-16' },
  { id: 3, electionDate: '2024-03-23' },
  { id: 4, electionDate: '2028-11-07' },
  { id: 5, electionDate: '2027-11-13' },
  { id: 6, electionDate: '2022-11-08' },
  { id: 7, electionDate: '2023-10-14' },
];

function findCycleId(electionDate: string): number {
  const match = KNOWN_CYCLES.find((c) => c.electionDate === electionDate);
  return match ? match.id : 0;
}

// ---------------------------------------------------------------------------
// Name parsing
// ---------------------------------------------------------------------------

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName = parts.pop()!;
  const firstName = parts.join(' ');
  return { firstName, lastName };
}

// ---------------------------------------------------------------------------
// Stable numeric ID from string key
// ---------------------------------------------------------------------------

function stableHash(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

function assignStableId(key: string, usedIds: Set<number>, min = 10000, range = 80000): number {
  let id = (stableHash(key) % range) + min;
  while (usedIds.has(id)) id++;
  usedIds.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Channel → SocialLinks
// ---------------------------------------------------------------------------

interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
}

function channelsToSocialLinks(channels: Array<{ type: string; id: string }>): SocialLinks | undefined {
  if (!channels || channels.length === 0) return undefined;
  const links: SocialLinks = {};
  for (const ch of channels) {
    const t = ch.type.toLowerCase();
    if (t.includes('facebook')) links.facebook = ch.id;
    else if (t.includes('twitter') || t === 'x') links.twitter = ch.id;
    else if (t.includes('instagram')) links.instagram = ch.id;
    else if (t.includes('youtube')) links.youtube = ch.id;
    else if (t.includes('tiktok')) links.tiktok = ch.id;
  }
  return Object.keys(links).length > 0 ? links : undefined;
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function normalizePartyValue(raw: string | null | undefined): string {
  if (!raw) return 'Nonpartisan';
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith('dem')) return 'Democratic';
  if (lower.startsWith('rep')) return 'Republican';
  if (lower.startsWith('lib')) return 'Libertarian';
  if (lower.startsWith('gre')) return 'Green';
  if (lower.startsWith('ind')) return 'Independent';
  if (lower === 'nonpartisan' || lower === 'non-partisan' || lower === 'no party' || lower === 'none') return 'Nonpartisan';
  return 'Other';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// App types (mirroring types.tsx)
// ---------------------------------------------------------------------------

interface AppCandidate {
  id: number;
  firstName: string;
  lastName: string;
  slug: string;
  photoUrl: string;
  party: string;
  officeId: number;
  runningMateName?: string;
  district?: string;
  cycleId: number;
  website?: string;
  email?: string;
  phone?: string;
  socialLinks?: SocialLinks;
  bio: string;
  mailingAddress?: string;
  surveyResponses: Record<string, string>;
  ballotOrder: number;
  isIncumbent: boolean;
  _pipelineContestId?: string;
  _pipelineSource?: string;
}

interface AppBallotMeasure {
  id: number;
  slug: string;
  title: string;
  electionDate: string;
  ballotLanguage: string;
  laymansExplanation: string;
  yesVoteMeans: string;
  noVoteMeans: string;
  _pipelineContestId?: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function loadAllContests(): Promise<ContestV1[]> {
  const files = await fs.readdir(CONTESTS_DIR);
  const all: ContestV1[] = [];
  for (const f of files) {
    if (!f.endsWith('.json') || f === 'manifest.json') continue;
    const raw = await fs.readFile(path.join(CONTESTS_DIR, f), 'utf-8');
    const contests: ContestV1[] = JSON.parse(raw);
    all.push(...contests);
  }
  return all;
}

function contestToCandidates(
  contest: ContestV1,
  usedIds: Set<number>,
): AppCandidate[] {
  if (contest.deleted) return [];
  if (contest.type === 'Referendum' || contest.candidates.length === 0) return [];

  const { officeId, district: mappedDistrict } = matchOffice(contest.office);
  const cycleId = findCycleId(contest.electionDate);
  const district = mappedDistrict ?? (contest.district.scope === 'statewide' || contest.district.scope === 'national' ? undefined : undefined);

  return contest.candidates.map((c: ContestCandidate) => {
    const { firstName, lastName } = parseName(c.name);
    const compositeKey = `${contest.id}:${c.name}`;
    const id = assignStableId(compositeKey, usedIds);

    return {
      id,
      firstName,
      lastName,
      slug: slugify(`${firstName}-${lastName}`),
      photoUrl: c.photoUrl ?? '',
      party: normalizePartyValue(c.party),
      officeId,
      district: district ?? (mappedDistrict ? undefined : extractDistrictFallback(contest)),
      cycleId,
      website: c.candidateUrl ?? undefined,
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      socialLinks: channelsToSocialLinks(c.channels),
      bio: '',
      surveyResponses: {},
      ballotOrder: c.orderOnBallot ?? 0,
      isIncumbent: c.isIncumbent ?? false,
      _pipelineContestId: contest.id,
      _pipelineSource: contest.source,
    };
  });
}

function extractDistrictFallback(contest: ContestV1): string | undefined {
  const distMatch = contest.office.match(/(?:district|dist\.?)\s*(\d+)/i);
  if (distMatch) return `District ${distMatch[1]}`;
  const ordinalMatch = contest.office.match(/(\d+)(?:st|nd|rd|th)\s+district/i);
  if (ordinalMatch) return `District ${ordinalMatch[1]}`;
  return undefined;
}

function contestToMeasure(
  contest: ContestV1,
  usedIds: Set<number>,
): AppBallotMeasure | null {
  if (contest.deleted) return null;
  if (contest.type !== 'Referendum' || !contest.referendumInfo) return null;

  const ref = contest.referendumInfo;
  const id = assignStableId(contest.id, usedIds, 1000, 9000);

  return {
    id,
    slug: slugify(ref.title || contest.office),
    title: ref.title || contest.office,
    electionDate: contest.electionDate,
    ballotLanguage: ref.fullText ?? '',
    laymansExplanation: ref.brief ?? '',
    yesVoteMeans: ref.proStatement ?? '',
    noVoteMeans: ref.conStatement ?? '',
    _pipelineContestId: contest.id,
  };
}

async function main(): Promise<void> {
  console.log('\n🔗 MyBallot — Pipeline → App Adapter\n');

  const contests = await loadAllContests();
  console.log(`   Loaded ${contests.length} contest records from data/contests/`);

  const active = contests.filter((c) => !c.deleted);
  console.log(`   Active: ${active.length} (${contests.length - active.length} deleted)`);

  // Build candidates
  const candidateIds = new Set<number>();
  const candidates: AppCandidate[] = [];
  for (const contest of active) {
    candidates.push(...contestToCandidates(contest, candidateIds));
  }
  console.log(`\n👤 Candidates: ${candidates.length}`);

  // Build ballot measures
  const measureIds = new Set<number>();
  const measures: AppBallotMeasure[] = [];
  for (const contest of active) {
    const m = contestToMeasure(contest, measureIds);
    if (m) measures.push(m);
  }
  console.log(`📋 Ballot measures: ${measures.length}`);

  // Group summary by election
  const byElection = new Map<string, { candidates: number; measures: number; contests: number }>();
  for (const c of active) {
    const key = `${c.electionName} (${c.electionDate})`;
    const entry = byElection.get(key) ?? { candidates: 0, measures: 0, contests: 0 };
    entry.contests++;
    entry.candidates += c.candidates.length;
    if (c.type === 'Referendum') entry.measures++;
    byElection.set(key, entry);
  }
  console.log('\n📊 Summary by election:');
  for (const [name, stats] of byElection) {
    console.log(`   ${name}: ${stats.contests} contests, ${stats.candidates} candidates, ${stats.measures} measures`);
  }

  // Show unmapped offices
  const unmapped = candidates.filter((c) => c.officeId === 0);
  if (unmapped.length > 0) {
    console.log(`\n⚠️  ${unmapped.length} candidates with unmapped office (officeId=0):`);
    const offices = [...new Set(unmapped.map((c) => c._pipelineContestId))];
    for (const o of offices) console.log(`   - ${o}`);
  }

  const unmappedCycles = candidates.filter((c) => c.cycleId === 0);
  if (unmappedCycles.length > 0) {
    console.log(`\n⚠️  ${unmappedCycles.length} candidates with unmapped cycle (cycleId=0)`);
  }

  // Show fields requiring manual entry
  const emptyBios = candidates.filter((c) => !c.bio);
  const emptyPhotos = candidates.filter((c) => !c.photoUrl);
  console.log(`\n📝 Fields requiring manual entry:`);
  console.log(`   Bios: ${emptyBios.length}/${candidates.length} empty (use admin UI or CSV import)`);
  console.log(`   Photos: ${emptyPhotos.length}/${candidates.length} empty`);
  console.log(`   Survey responses: ${candidates.length}/${candidates.length} empty`);

  const emptyLaymans = measures.filter((m) => !m.laymansExplanation);
  if (measures.length > 0) {
    console.log(`   Measure explanations: ${emptyLaymans.length}/${measures.length} empty`);
  }

  // Write output
  await fs.mkdir(APP_DIR, { recursive: true });

  const candidatesPath = path.join(APP_DIR, 'candidates.json');
  await fs.writeFile(candidatesPath, JSON.stringify(candidates, null, 2));
  console.log(`\n💾 Wrote ${candidates.length} candidates → ${path.relative(process.cwd(), candidatesPath)}`);

  const measuresPath = path.join(APP_DIR, 'ballot-measures.json');
  await fs.writeFile(measuresPath, JSON.stringify(measures, null, 2));
  console.log(`   Wrote ${measures.length} ballot measures → ${path.relative(process.cwd(), measuresPath)}`);

  console.log('\n✅ Adapter complete. Run `npm run dev` to see real data in the app.\n');
}

main().catch((err) => {
  console.error('\n❌ Adapter failed:', err.message);
  process.exit(1);
});
