// Note: This file, when loaded by the browser via importmap, will be parsed as JavaScript.
// Type imports have been removed to prevent issues if './types.ts' is fetched and parsed by a JS engine.

import type { Candidate, BallotMeasure, OfficeElectionResults, Office } from './types';
import pipelineCandidatesJson from './data/app/candidates.json';
import pipelineMeasuresJson from './data/app/ballot-measures.json';

// Type the pipeline output explicitly. Otherwise TypeScript infers types from whatever happens to be in the
// JSON right now, and fields like `district` disappear from the type when no current candidate has one.
const pipelineCandidates = pipelineCandidatesJson as unknown as Candidate[];
const pipelineMeasures = pipelineMeasuresJson as unknown as BallotMeasure[];

// Moved from types.ts
export const ViewMode = {
  GRID: 'grid',
  LIST: 'list',
};

export const POLITICAL_KEY_ISSUES_LIST = [
  { id: 'economy', label: 'Economy & Jobs' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'education', label: 'Education' },
  { id: 'environment', label: 'Environment & Climate Change' },
  { id: 'social_justice', label: 'Social Justice & Equality' },
  { id: 'public_safety', label: 'Public Safety & Crime' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'taxation', label: 'Taxation & Government Spending' },
  { id: 'foreign_policy', label: 'Foreign Policy & National Security' },
  { id: 'immigration', label: 'Immigration' },
];

export const CIVIC_INFO_SOURCES_LIST = [
    { id: 'news_websites', label: 'News Websites/Apps' },
    { id: 'social_media', label: 'Social Media' },
    { id: 'friends_family', label: 'Friends & Family' },
    { id: 'official_voter_guides', label: 'Official Voter Guides/Mailers' },
    { id: 'candidate_websites', label: 'Candidate Websites/Materials' },
    { id: 'tv_news', label: 'Television News' },
    { id: 'radio_podcasts', label: 'Radio/Podcasts' },
    { id: 'this_app', label: 'This App (MyBallot)' },
    { id: 'other', label: 'Other' },
];


// Utility to format election date string into a user-friendly name
export const formatElectionName = (electionDate, baseName) => {
  try {
    const date = new Date(electionDate + 'T00:00:00'); // Ensure local timezone interpretation
    // Everything after the year: "2027 Spring Primary" → "Spring Primary", "2026 General" → "General".
    const namePart = (baseName ? String(baseName).replace(/^\d{4}\s+/, '').trim() : '') || "Election";
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${namePart}`;
  } catch (e) {
    console.error("Error formatting election date:", electionDate, e);
    return baseName || electionDate; // Fallback
  }
};

// Pre-define parts of RAW_DATA to avoid initialization errors
// Built-in offices. `level` and `districtType` tell address → ballot which district
// map decides who votes in each race; admins can change them under Admin → Offices.
const PREDEFINED_OFFICES_DATA: Office[] = [
    { id: 1, name: "Mayor-President", slug: "mayor-president", level: "parish", districtType: "parishwide" },
    { id: 2, name: "State Representative", slug: "state-representative", level: "state", districtType: "state-house" },
    { id: 3, name: "City Court Judge", slug: "city-court-judge", level: "judicial", districtType: "judicial", districtKeyPrefix: "br-city-court-div" },
    { id: 4, name: "Metro Council", slug: "metro-council", level: "parish", districtType: "parish-council", districtKeyPrefix: "ebr-council" },
    { id: 5, name: "US President", slug: "us-president", level: "federal", districtType: "statewide" },
    // ID 6 (US Vice President) is removed.
    { id: 7, name: "US Senator", slug: "us-senator", level: "federal", districtType: "statewide" },
    { id: 8, name: "US Representative", slug: "us-representative", level: "federal", districtType: "congressional" },
    { id: 9, name: "Governor", slug: "governor", level: "state", districtType: "statewide" },
    { id: 10, name: "Lieutenant Governor", slug: "lieutenant-governor", level: "state", districtType: "statewide" },
    { id: 11, name: "Attorney General", slug: "attorney-general", level: "state", districtType: "statewide" },
    { id: 12, name: "Secretary of State", slug: "secretary-of-state", level: "state", districtType: "statewide" },
    { id: 13, name: "State Treasurer", slug: "state-treasurer", level: "state", districtType: "statewide" },
    { id: 14, name: "School Board Member", slug: "school-board-member", level: "parish", districtType: "school-board", districtKeyPrefix: "ebr-school" },
    { id: 15, name: "Parish Sheriff", slug: "parish-sheriff", level: "parish", districtType: "parishwide" },
];

// Define Cycle Types for more realistic candidate assignment
const CycleType = {
  PRESIDENTIAL: "PRESIDENTIAL_CYCLE",
  MIDTERM_FEDERAL: "MIDTERM_FEDERAL_CYCLE", // For US Senator, US Rep in non-presidential federal years
  STATE_GENERAL: "STATE_GENERAL_CYCLE",   // For Governor, State Rep etc. in general election years
  MUNICIPAL_LOCAL: "MUNICIPAL_LOCAL_CYCLE", // For Mayor, Council, Sheriff etc.
  SPECIAL: "SPECIAL_CYCLE",
  PRIMARY: "PRIMARY_CYCLE"        // Can be for any, often presidential primaries are significant
};

const PREDEFINED_CYCLES_DATA_RAW = [
    { "id": 1, "name": "2026 Congressional General", "slug": "2026-general", "electionDate": "2026-11-03", "evStart": "2026-10-20", "evEnd": "2026-10-27", "coverageNote": "Partial ballot: only the U.S. Senate race is listed. See your full sample ballot at voterportal.sos.la.gov.", "type": [CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 2, "name": "2026 Party Primary", "slug": "2026-primary", "electionDate": "2026-05-16", "evStart": "2026-05-02", "evEnd": "2026-05-09", "type": [CycleType.PRIMARY, CycleType.MIDTERM_FEDERAL] },
    { "id": 3, "name": "2024 Presidential Primary", "slug": "2024-primary", "electionDate": "2024-03-23", "evStart": "2024-03-09", "evEnd": "2024-03-16", "type": [CycleType.PRIMARY, CycleType.PRESIDENTIAL] }, // Past
    { "id": 4, "name": "2028 Presidential General", "slug": "2028-presidential-general", "electionDate": "2028-11-07", "evStart": "2028-10-24", "evEnd": "2028-11-02", "type": [CycleType.PRESIDENTIAL, CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    // 2027 elections. Dates and deadlines from the Louisiana Secretary of State's 2027 elections calendar
    // (revised 10/2026). The legislature can still change them; Admin → Elections overrides these.
    // District-only specials (Jan 9 Senate 14; Feb 6 / Mar 13 House 77) are left out on purpose so the
    // "next election" banner doesn't show them to every voter.
    { "id": 101, "name": "2027 Spring Primary", "slug": "2027-spring-primary", "electionDate": "2027-04-17", "evStart": "2027-04-03", "evEnd": "2027-04-10", "registrationDeadline": "2027-03-17", "onlineRegistrationDeadline": "2027-03-27", "absenteeRequestDeadline": "2027-04-13", "absenteeReturnDeadline": "2027-04-16", "coverageNote": "BESE party primary and municipal primaries. Only towns holding spring elections have local races.", "type": [CycleType.PRIMARY, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 102, "name": "2027 Spring General", "slug": "2027-spring-general", "electionDate": "2027-05-29", "evStart": "2027-05-15", "evEnd": "2027-05-22", "registrationDeadline": "2027-04-28", "onlineRegistrationDeadline": "2027-05-08", "absenteeRequestDeadline": "2027-05-25", "absenteeReturnDeadline": "2027-05-28", "coverageNote": "BESE second party primary and municipal general elections, only where a race is still undecided.", "type": [CycleType.PRIMARY, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 5, "name": "2027 Primary", "slug": "2027-state-primary", "electionDate": "2027-10-09", "evStart": "2027-09-25", "evEnd": "2027-10-02", "registrationDeadline": "2027-09-08", "onlineRegistrationDeadline": "2027-09-18", "absenteeRequestDeadline": "2027-10-05", "absenteeReturnDeadline": "2027-10-08", "type": [CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 8, "name": "2027 General", "slug": "2027-state-general", "electionDate": "2027-11-20", "evStart": "2027-11-05", "evEnd": "2027-11-13", "registrationDeadline": "2027-10-20", "onlineRegistrationDeadline": "2027-10-30", "absenteeRequestDeadline": "2027-11-16", "absenteeReturnDeadline": "2027-11-19", "type": [CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 6, "name": "2022 Midterm Election", "slug": "2022-midterm-election", "electionDate": "2022-11-08", "evStart": "2022-10-25", "evEnd": "2022-11-03", "type": [CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL], "nameOverride": "2022 Midterm" }, // Past
    { "id": 7, "name": "2023 State General", "slug": "2023-state-general", "electionDate": "2023-10-14", "evStart": "2023-09-30", "evEnd": "2023-10-07", "type": [CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL], "nameOverride": "2023 State" } // Past, LA specific
];


const PREDEFINED_SURVEY_QUESTIONS_DATA = [
    { "key": "why_running", "question": "Why are you running?" },
    { "key": "top_priority", "question": "What is your top priority if elected?" },
    { "key": "experience", "question": "What experience qualifies you for this office?" },
    { "key": "fiscal_approach", "question": "What is your approach to fiscal responsibility and budget management?" }
];

export const EARLY_VOTING_LOCATIONS_DATA = [
  { id: 'ev1', name: 'City Hall', address: '222 St. Louis St, Baton Rouge, LA 70802' },
  { id: 'ev2', name: 'Main Library at Goodwood', address: '7711 Goodwood Blvd, Baton Rouge, LA 70806' },
  { id: 'ev3', name: 'Baker Municipal Building', address: '3325 Groom Rd, Baker, LA 70714' },
  { id: 'ev4', name: 'Central Branch Library', address: '11260 Joor Rd, Central, LA 70818' },
  { id: 'ev5', name: 'Forest Community Park', address: '13900 S Harrells Ferry Rd, Baton Rouge, LA 70816' },
];

// ---------------------------------------------------------------------------
// BUNDLED SNAPSHOT
// These are the data shipped inside the app. Screens do NOT read them
// directly: services/electionDataStore.ts starts from them and then applies
// Firestore (the source of truth) on top. They matter for the very first
// launch with no connection, and as the input to Admin → Setup → "Publish".
// ---------------------------------------------------------------------------

/** Candidates from the data pipeline (data/app/candidates.json), unmodified. */
export const SNAPSHOT_CANDIDATES: Candidate[] = pipelineCandidates;
/** Ballot measures from the data pipeline (data/app/ballot-measures.json), unmodified. */
export const SNAPSHOT_BALLOT_MEASURES: BallotMeasure[] = pipelineMeasures;
export const PREDEFINED_OFFICES = PREDEFINED_OFFICES_DATA;
export const PREDEFINED_SURVEY_QUESTIONS = PREDEFINED_SURVEY_QUESTIONS_DATA;
/** Election list without the internal `type`/`nameOverride` fields. */
export const PREDEFINED_CYCLES = PREDEFINED_CYCLES_DATA_RAW.map((typedCycle) => {
  const { type: _type, nameOverride, ...baseCycleData } = typedCycle as typeof typedCycle & { nameOverride?: string };
  return nameOverride ? { ...baseCycleData, name: nameOverride } : { ...baseCycleData };
});

/** Upcoming elections first (soonest first), then past elections (most recent first). */
export function sortCycles<T extends { electionDate: string }>(cycles: T[]): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [...cycles].sort((a, b) => {
    const dateA = new Date(a.electionDate + 'T00:00:00');
    const dateB = new Date(b.electionDate + 'T00:00:00');
    const aIsPast = dateA < today;
    const bIsPast = dateB < today;
    if (aIsPast && !bIsPast) return 1;
    if (!aIsPast && bIsPast) return -1;
    if (!aIsPast && !bIsPast) return dateA.getTime() - dateB.getTime();
    return dateB.getTime() - dateA.getTime();
  });
}

/** Placeholder avatar used when a candidate has no photo. Applied at display time, never saved. */
export function candidatePhotoFallback(firstName = '', lastName = ''): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(`${firstName} ${lastName}`.trim() || 'N A')}&size=200&background=random`;
}

export const PARTIES = ["Democratic", "Republican", "Independent", "Green", "Other"];


/**
 * Legacy per-office results used by the archived-ballot view. Empty: results
 * will come from Firestore once the results editor exists.
 */
export const ELECTION_RESULTS_DATA: OfficeElectionResults[] = [];
