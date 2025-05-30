export interface Office {
  id: number;
  name: string;
  slug: string;
}

/**
 * Represents an Election Event (formerly Cycle).
 * The 'id' is a numerical identifier, while 'electionDate' is the string representation of the date.
 */
export interface Cycle {
  id: number; // Numeric ID for the election event
  name: string; // Original name like "2026 General", will be used as a base for formatted name
  slug: string;
  electionDate: string; // Date string, e.g., "2026-11-06", used as key for ballot archive
  evStart: string;
  evEnd: string;
}

export interface SurveyQuestion {
  key: string;
  question: string;
}

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
}

export interface Candidate {
  id: number;
  firstName: string;
  lastName: string;
  slug: string;
  photoUrl: string;
  party: string;
  officeId: number;
  runningMateName?: string; // Added for presidential candidates
  district?: string; // Added for jurisdictional specificity
  cycleId: number; // Refers to Cycle.id (the election event's numeric ID)
  website?: string;
  email?: string;
  phone?: string;
  socialLinks?: SocialLinks;
  bio: string;
  mailingAddress?: string;
  surveyResponses: Record<string, string>; // key from SurveyQuestion.key
  ballotOrder: number;
  isIncumbent?: boolean;
}

/**
 * Represents a ballot measure or proposition.
 */
export interface BallotMeasure {
  id: number;
  slug: string;
  title: string;
  electionDate: string; // Links to a Cycle's electionDate
  ballotLanguage: string;
  laymansExplanation: string;
  yesVoteMeans: string;
  noVoteMeans: string;
}


// --- Ballot Entry Types ---
export interface CandidateSelection {
  itemType: 'candidate';
  candidateId: number;
  officeId: number;
  district?: string; // Added for jurisdictional specificity
  // electionDate is the key in BallotArchive, not stored per item here
}

export interface MeasureStance {
  itemType: 'measure';
  measureId: number;
  vote: 'support' | 'oppose';
  // electionDate is the key in BallotArchive, not stored per item here
}

export type BallotEntry = CandidateSelection | MeasureStance;

/**
 * Stores all user ballot selections (candidates and measure stances), keyed by electionDate.
 * Example: { "2026-11-06": [ {itemType: 'candidate', candidateId: 1, officeId: 1, district: "District A"}, {itemType: 'measure', measureId: 101, vote: 'support'} ], ... }
 */
export type BallotArchive = Record<string, BallotEntry[]>;


// For Gemini Q&A
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// Grounding metadata for Gemini search results
export interface WebGroundingChunk {
  uri: string;
  title: string;
}
export interface GroundingChunk {
 web?: WebGroundingChunk;
}
export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

// For API interactions (simplified)
export interface APIResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// --- Election Results ---
/**
 * Represents the result for a single candidate in an office for a specific election.
 */
export interface ElectionResultCandidate {
  candidateId: number;
  candidateName: string; // For easier display, may include running mate for president
  party: string; // For easier display
  votes: number;
  percentage: number; // e.g., 55.5 for 55.5%
  isWinner: boolean;
  photoUrl?: string;
}

/**
 * Groups all candidate results for a single office in a specific election.
 */
export interface OfficeElectionResults {
  electionDate: string;
  office: Office; // The office these results are for
  district?: string; // Display district if results are district-specific
  results: ElectionResultCandidate[];
  totalVotesInOffice: number;
}

// --- Reminder System ---
export type ReminderType = 'earlyVote' | 'electionDay';
export type NotificationMethod = 'text' | 'email' | 'app'; // 'app' is conceptual for UI

export interface EarlyVotingLocation {
  id: string;
  name: string;
  address: string;
}

export interface ReminderSettings {
  electionDate: string; // The original election date string (YYYY-MM-DD)
  reminderType: ReminderType;
  reminderDateTime: string; // ISO string for the reminder
  notificationMethods: NotificationMethod[];
  phoneNumber?: string;
  emailAddress?: string;
  earlyVotingLocationName?: string;
  earlyVotingLocationAddress?: string;
}

// --- Private Notes ---
export interface NoteEntry {
  id: string; // Unique identifier for the note, e.g., timestamp of creation
  date: string; // ISO string for the date of creation/last update
  text: string; // The content of the note
}

export interface NoteSummaryItem {
  candidateId: number;
  candidateName: string;
  candidateProfileLink: string;
  officeName: string;
  electionName: string;
  notesCount: number;
  latestNote: NoteEntry | null;
}

// --- User Account System ---
export type AuthProviderType = 'email' | 'phone' | 'google' | 'facebook' | 'x' | 'twitter';

export interface UserDemographics {
  ageRange?: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | '';
  genderIdentity?: 'male' | 'female' | 'non-binary' | 'self-describe' | 'prefer-not-to-say' | '';
  genderSelfDescribe?: string;
  zipCode?: string;
  educationLevel?: 'high-school' | 'some-college' | 'associates' | 'bachelors' | 'masters' | 'doctorate' | 'prefer-not-to-say' | '';
  raceEthnicity?: 
    | 'american-indian-alaska-native' 
    | 'asian' 
    | 'black-african-american' 
    | 'hispanic-latino' 
    | 'native-hawaiian-pacific-islander' 
    | 'white' 
    | 'two-or-more-races' 
    | 'self-describe-race' 
    | 'prefer-not-to-say-race' 
    | ''; // Added
  religion?: 
    | 'agnostic'
    | 'atheist'
    | 'buddhist'
    | 'christian'
    | 'hindu'
    | 'jewish'
    | 'muslim'
    | 'spiritual-not-religious'
    | 'other-religion'
    | 'self-describe-religion'
    | 'prefer-not-to-say-religion'
    | ''; // Added
  incomeRange?: '<$25k' | '$25k-$50k' | '$50k-$75k' | '$75k-$100k' | '$100k-$150k' | '$150k-$200k' | '>$200k' | 'prefer-not-to-say' | ''; // Added
}

export interface UserPoliticalKeyIssue {
  id: string;
  label: string;
}

export interface UserPoliticalProfile {
  partyAffiliation?: 'democrat' | 'republican' | 'independent' | 'green' | 'libertarian' | 'other' | 'prefer-not-to-say' | '';
  partyOther?: string;
  politicalSpectrum?: 'very-liberal' | 'liberal' | 'moderate' | 'conservative' | 'very-conservative' | 'prefer-not-to-say' | '';
  keyIssues?: string[]; // Array of issue IDs from POLITICAL_KEY_ISSUES_LIST (defined in constants.ts now)
}

export interface UserCivicEngagement {
  votingFrequency?: 'every' | 'most' | 'some' | 'rarely' | 'first-time' | 'prefer-not-to-say' | '';
  infoSources?: string[]; // Array of info source IDs (defined in constants.ts now)
}

export interface UserProfileData {
  demographics: UserDemographics;
  politicalProfile: UserPoliticalProfile;
  civicEngagement: UserCivicEngagement;
  onboardingCompleted: boolean;
}

export interface User {
  id: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string; // Can be derived from email or set by user
  photoURL?: string; // For social logins or user upload
  authProvider: AuthProviderType;
  profileData: UserProfileData;
}

// Moved from constants.ts
export interface RawElectionResult {
  officeId: number;
  district?: string;
  candidateResults: {
    candidateId: number;
    votes: number;
    isWinner: boolean;
  }[];
}

export interface RawElectionResultsByDate {
  [electionDate: string]: RawElectionResult[];
}
