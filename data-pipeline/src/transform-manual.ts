import {
  ContestV1,
  ContestCandidate,
  ContestDistrict,
  ContestType,
  DistrictScope,
  ExtractionMeta,
} from './types.js';
import { slugify, computeHash } from './transform.js';
import { SeedContest } from './extractors/manual.js';

/**
 * Transform manual seed contests into normalized ContestV1 records.
 */
export function transformManualContests(
  rawContests: unknown[],
  meta: ExtractionMeta,
): ContestV1[] {
  const contests: ContestV1[] = [];

  for (const raw of rawContests) {
    const seed = raw as SeedContest;
    const isReferendum = seed.type === 'Referendum';
    const office = isReferendum
      ? seed.referendumInfo?.title ?? 'Unknown Referendum'
      : seed.office;

    const slug = slugify(office);
    const district: ContestDistrict = seed.district
      ? {
          name: seed.district.name,
          scope: (seed.district.scope as DistrictScope) ?? null,
          ocdDivisionId: seed.district.ocdDivisionId ?? null,
        }
      : {
          name: 'East Baton Rouge Parish',
          scope: 'countywide',
          ocdDivisionId: 'ocd-division/country:us/state:la/parish:east_baton_rouge',
        };

    const candidates: ContestCandidate[] = isReferendum
      ? []
      : (seed.candidates ?? []).map((c, i) => ({
          name: c.name,
          party: c.party ?? null,
          candidateUrl: c.candidateUrl ?? null,
          photoUrl: c.photoUrl ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          channels: c.channels ?? [],
          orderOnBallot: c.orderOnBallot ?? i + 1,
        }));

    const record: ContestV1 = {
      id: `${meta.electionId}:${district.ocdDivisionId ?? slugify(district.name)}:${slug}`,
      type: seed.type as ContestType,
      office,
      officeSlug: slug,
      ballotTitle: null,
      electionId: meta.electionId,
      electionDate: meta.electionDate,
      electionName: meta.electionName,
      district,
      numberElected: seed.numberElected ?? 1,
      candidates,
      referendumInfo: isReferendum && seed.referendumInfo
        ? {
            title: seed.referendumInfo.title,
            subtitle: seed.referendumInfo.subtitle ?? null,
            brief: seed.referendumInfo.brief ?? null,
            fullText: seed.referendumInfo.fullText ?? null,
            url: seed.referendumInfo.url ?? null,
            ballotResponses: seed.referendumInfo.ballotResponses ?? [],
            proStatement: seed.referendumInfo.proStatement ?? null,
            conStatement: seed.referendumInfo.conStatement ?? null,
          }
        : null,
      source: 'manual',
      sourceMetadata: {
        jurisdiction: 'East Baton Rouge Parish, LA',
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
