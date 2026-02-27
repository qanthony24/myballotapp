/** Normalized contest record — mirrors /schemas/contest_v1.schema.json */

export type ContestType = 'General' | 'Primary' | 'Runoff' | 'Referendum' | 'Special';

export type DistrictScope =
  | 'national' | 'statewide' | 'congressional'
  | 'stateUpper' | 'stateLower' | 'countywide'
  | 'judicial' | 'schoolBoard' | 'citywide'
  | 'township' | 'countyCouncil' | 'cityCouncil'
  | 'ward' | 'special';

export type SourceId = 'google-civic' | 'manual' | 'sos-la' | 'vip-feed';

export interface CandidateChannel {
  type: string;
  id: string;
}

export interface ContestCandidate {
  name: string;
  party: string | null;
  candidateUrl: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  channels: CandidateChannel[];
  orderOnBallot: number | null;
}

export interface ContestDistrict {
  name: string;
  scope: DistrictScope | null;
  ocdDivisionId: string | null;
}

export interface ReferendumInfo {
  title: string;
  subtitle: string | null;
  brief: string | null;
  fullText: string | null;
  url: string | null;
  ballotResponses: string[];
  proStatement: string | null;
  conStatement: string | null;
}

export interface ContestV1 {
  id: string;
  type: ContestType;
  office: string;
  officeSlug: string;
  ballotTitle: string | null;
  electionId: string;
  electionDate: string;
  electionName: string;
  district: ContestDistrict;
  numberElected: number;
  candidates: ContestCandidate[];
  referendumInfo: ReferendumInfo | null;
  source: SourceId;
  sourceMetadata: Record<string, unknown>;
  fetchedAt: string;
  contentHash: string;
  deleted: boolean;
}

/** Metadata returned alongside raw extraction results. */
export interface ExtractionMeta {
  source: SourceId;
  electionId: string;
  electionDate: string;
  electionName: string;
  address: string;
  fetchedAt: string;
  durationMs: number;
  rawContestCount: number;
}

/** The envelope a raw extractor returns before transformation. */
export interface RawExtractionResult {
  meta: ExtractionMeta;
  rawContests: unknown[];
  rawResponse: unknown;
}

/** Google Civic API response shapes (subset we care about). */
export namespace GoogleCivic {
  export interface Election {
    id: string;
    name: string;
    electionDay: string;
    ocdDivisionId: string;
  }

  export interface ElectionsResponse {
    elections: Election[];
  }

  export interface Candidate {
    name: string;
    party?: string;
    candidateUrl?: string;
    photoUrl?: string;
    email?: string;
    phone?: string;
    channels?: { type: string; id: string }[];
    orderOnBallot?: string;
  }

  export interface Contest {
    type: string;
    office?: string;
    ballotTitle?: string;
    district?: {
      name?: string;
      scope?: string;
      id?: string;
    };
    numberElected?: string;
    ballotPlacement?: string;
    candidates?: Candidate[];
    referendumTitle?: string;
    referendumSubtitle?: string;
    referendumText?: string;
    referendumBrief?: string;
    referendumUrl?: string;
    referendumBallotResponses?: string[];
    referendumProStatement?: string;
    referendumConStatement?: string;
    sources?: { name: string; official: boolean }[];
    level?: string[];
    roles?: string[];
  }

  export interface VoterInfoResponse {
    election: Election;
    normalizedInput?: {
      line1: string;
      city: string;
      state: string;
      zip: string;
    };
    contests?: Contest[];
    pollingLocations?: unknown[];
    earlyVoteSites?: unknown[];
    state?: unknown[];
    kind: string;
    error?: { code: number; message: string };
  }
}

/** Diff result for incremental updates. */
export interface DiffResult {
  added: ContestV1[];
  updated: ContestV1[];
  deleted: string[];
  unchanged: number;
}
