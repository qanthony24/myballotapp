import * as crypto from 'node:crypto';
import {
  ContestV1,
  ContestCandidate,
  ContestDistrict,
  ContestType,
  DistrictScope,
  ExtractionMeta,
  GoogleCivic,
  ReferendumInfo,
} from './types.js';

/**
 * Transform raw Google Civic API contests into normalized ContestV1 records.
 */
export function transformGoogleCivicContests(
  rawContests: unknown[],
  meta: ExtractionMeta,
): ContestV1[] {
  const contests: ContestV1[] = [];
  for (const raw of rawContests) {
    const gc = raw as GoogleCivic.Contest;
    const isReferendum =
      gc.type === 'Referendum' || Boolean(gc.referendumTitle);

    const office = isReferendum
      ? gc.referendumTitle ?? 'Unknown Referendum'
      : gc.office ?? gc.ballotTitle ?? 'Unknown Office';

    const slug = slugify(office);
    const district = mapDistrict(gc.district);
    const type = mapContestType(gc.type, meta.electionName);

    const record: ContestV1 = {
      id: buildContestId(meta.electionId, district, slug, gc),
      type,
      office,
      officeSlug: slug,
      ballotTitle: gc.ballotTitle ?? null,
      electionId: meta.electionId,
      electionDate: meta.electionDate,
      electionName: meta.electionName,
      district,
      numberElected: parseInt(gc.numberElected ?? '1', 10) || 1,
      candidates: isReferendum ? [] : mapCandidates(gc.candidates),
      referendumInfo: isReferendum ? mapReferendum(gc) : null,
      source: 'google-civic',
      sourceMetadata: {
        ballotPlacement: gc.ballotPlacement ?? null,
        level: gc.level ?? null,
        roles: gc.roles ?? null,
        sources: gc.sources ?? null,
      },
      fetchedAt: meta.fetchedAt,
      contentHash: '',
      deleted: false,
    };

    record.contentHash = computeHash(record);
    contests.push(record);
  }
  return contests;
}

function mapContestType(
  raw: string | undefined,
  electionName: string,
): ContestType {
  const lower = (raw ?? '').toLowerCase();
  if (lower === 'referendum') return 'Referendum';
  if (lower.includes('primary') || electionName.toLowerCase().includes('primary'))
    return 'Primary';
  if (lower.includes('runoff')) return 'Runoff';
  if (lower.includes('special')) return 'Special';
  return 'General';
}

function mapDistrict(
  raw: GoogleCivic.Contest['district'],
): ContestDistrict {
  if (!raw) return { name: 'Unknown', scope: null, ocdDivisionId: null };
  return {
    name: raw.name ?? 'Unknown',
    scope: mapScope(raw.scope),
    ocdDivisionId: raw.id && raw.id !== '0' ? raw.id : null,
  };
}

function mapScope(raw: string | undefined): DistrictScope | null {
  if (!raw) return null;
  const map: Record<string, DistrictScope> = {
    national: 'national',
    statewide: 'statewide',
    congressional: 'congressional',
    stateupper: 'stateUpper',
    statelower: 'stateLower',
    countywide: 'countywide',
    judicial: 'judicial',
    schoolboard: 'schoolBoard',
    citywide: 'citywide',
    township: 'township',
    countycouncil: 'countyCouncil',
    citycouncil: 'cityCouncil',
    ward: 'ward',
    special: 'special',
  };
  return map[raw.toLowerCase()] ?? null;
}

function mapCandidates(
  raw: GoogleCivic.Candidate[] | undefined,
): ContestCandidate[] {
  if (!raw) return [];
  return raw.map((c, i) => ({
    name: c.name,
    party: c.party ?? null,
    candidateUrl: c.candidateUrl ?? null,
    photoUrl: c.photoUrl ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    channels: (c.channels ?? []).map((ch) => ({
      type: ch.type,
      id: ch.id,
    })),
    orderOnBallot:
      c.orderOnBallot != null ? parseInt(c.orderOnBallot, 10) : i + 1,
    isIncumbent: false,
  }));
}

function mapReferendum(gc: GoogleCivic.Contest): ReferendumInfo {
  return {
    title: gc.referendumTitle ?? '',
    subtitle: gc.referendumSubtitle ?? null,
    brief: gc.referendumBrief ?? null,
    fullText: gc.referendumText ?? null,
    url: gc.referendumUrl ?? null,
    ballotResponses: gc.referendumBallotResponses ?? [],
    proStatement: gc.referendumProStatement ?? null,
    conStatement: gc.referendumConStatement ?? null,
  };
}

function buildContestId(
  electionId: string,
  district: ContestDistrict,
  officeSlug: string,
  gc: GoogleCivic.Contest,
): string {
  const divPart = district.ocdDivisionId ?? slugify(district.name);
  const partyHint = gc.candidates?.[0]?.party
    ? `-${slugify(gc.candidates[0].party)}`
    : '';
  return `${electionId}:${divPart}:${officeSlug}${partyHint}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Compute a SHA-256 content hash of the contest record,
 * excluding volatile fields (fetchedAt, contentHash).
 */
export function computeHash(contest: ContestV1): string {
  const { fetchedAt: _, contentHash: __, ...stable } = contest;
  const json = JSON.stringify(stable, Object.keys(stable).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}
