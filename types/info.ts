/** Types for the Info section: News Feed + Election Results */

// ---------------------------------------------------------------------------
// News Feed
// ---------------------------------------------------------------------------

export interface NewsArticle {
  id: string;
  source: string;
  sourceSlug: string;
  title: string;
  summary?: string;
  url: string;
  imageUrl?: string;
  author?: string;
  publishedAt: string;
  categories?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NewsFeedResponse {
  items: NewsArticle[];
  lastRefreshedAt: string;
}

// ---------------------------------------------------------------------------
// Election Results
// ---------------------------------------------------------------------------

export type ElectionType =
  | 'municipal'
  | 'state'
  | 'federal'
  | 'special'
  | 'primary'
  | 'general';

export interface TurnoutData {
  ballotsCast?: number;
  registeredVoters?: number;
  turnoutPercent?: number;
}

export interface ResultItem {
  id: string;
  name: string;
  party?: string;
  votes: number;
  votePercent: number;
  isWinner?: boolean;
  incumbent?: boolean;
}

export interface ContestResult {
  contestId: string;
  title: string;
  officeName?: string;
  district?: string;
  contestType: 'candidate' | 'measure';
  totalVotes?: number;
  called: boolean;
  winnerId?: string;
  resultItems: ResultItem[];
}

export interface ElectionResultSummary {
  electionId: string;
  electionName: string;
  electionDate: string;
  electionType: ElectionType;
  jurisdiction: string;
  turnout?: TurnoutData;
  contests: ContestResult[];
}
