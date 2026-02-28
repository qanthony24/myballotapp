// Note: This file, when loaded by the browser via importmap, will be parsed as JavaScript.
// Type imports have been removed to prevent issues if './types.ts' is fetched and parsed by a JS engine.

import pipelineCandidates from './data/app/candidates.json';
import pipelineMeasures from './data/app/ballot-measures.json';

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
    const namePart = baseName ? baseName.split(' ')[1] : "Election"; // e.g. General from "2026 General"
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${namePart}`;
  } catch (e) {
    console.error("Error formatting election date:", electionDate, e);
    return baseName || electionDate; // Fallback
  }
};

// Pre-define parts of RAW_DATA to avoid initialization errors
const PREDEFINED_OFFICES_DATA = [
    { "id": 1, "name": "Mayor-President", "slug": "mayor-president" },
    { "id": 2, "name": "State Representative", "slug": "state-representative" }, // Districted
    { "id": 3, "name": "City Court Judge", "slug": "city-court-judge" },
    { "id": 4, "name": "Metro Council", "slug": "metro-council" }, // Districted
    { "id": 5, "name": "US President", "slug": "us-president" },
    // ID 6 (US Vice President) is removed.
    { "id": 7, "name": "US Senator", "slug": "us-senator" },
    { "id": 8, "name": "US Representative", "slug": "us-representative" }, // Districted
    { "id": 9, "name": "Governor", "slug": "governor" },
    { "id": 10, "name": "Lieutenant Governor", "slug": "lieutenant-governor" },
    { "id": 11, "name": "Attorney General", "slug": "attorney-general" },
    { "id": 12, "name": "Secretary of State", "slug": "secretary-of-state" },
    { "id": 13, "name": "State Treasurer", "slug": "state-treasurer" },
    { "id": 14, "name": "School Board Member", "slug": "school-board-member" }, // Districted
    { "id": 15, "name": "Parish Sheriff", "slug": "parish-sheriff" }
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
    { "id": 1, "name": "2026 Congressional General", "slug": "2026-general", "electionDate": "2026-11-03", "evStart": "2026-10-20", "evEnd": "2026-10-27", "type": [CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 2, "name": "2026 Party Primary", "slug": "2026-primary", "electionDate": "2026-05-16", "evStart": "2026-05-02", "evEnd": "2026-05-09", "type": [CycleType.PRIMARY, CycleType.MIDTERM_FEDERAL] },
    { "id": 3, "name": "2024 Presidential Primary", "slug": "2024-primary", "electionDate": "2024-03-23", "evStart": "2024-03-09", "evEnd": "2024-03-16", "type": [CycleType.PRIMARY, CycleType.PRESIDENTIAL] }, // Past
    { "id": 4, "name": "2028 Presidential General", "slug": "2028-presidential-general", "electionDate": "2028-11-07", "evStart": "2028-10-24", "evEnd": "2028-11-02", "type": [CycleType.PRESIDENTIAL, CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 5, "name": "2027 State & Local", "slug": "2027-state-local", "electionDate": "2027-11-13", "evStart": "2027-10-30", "evEnd": "2027-11-06", "type": [CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 6, "name": "2022 Midterm Election", "slug": "2022-midterm-election", "electionDate": "2022-11-08", "evStart": "2022-10-25", "evEnd": "2022-11-03", "type": [CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL], "nameOverride": "2022 Midterm" }, // Past
    { "id": 7, "name": "2023 State General", "slug": "2023-state-general", "electionDate": "2023-10-14", "evStart": "2023-09-30", "evEnd": "2023-10-07", "type": [CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL], "nameOverride": "2023 State" } // Past, LA specific
];


const PREDEFINED_SURVEY_QUESTIONS_DATA = [
    { "key": "why_running", "question": "Why are you running?" },
    { "key": "top_priority", "question": "What is your top priority if elected?" },
    { "key": "experience", "question": "What experience qualifies you for this office?" },
    { "key": "fiscal_approach", "question": "What is your approach to fiscal responsibility and budget management?" }
];

const RAW_DATA = {
  "offices": PREDEFINED_OFFICES_DATA,
  "cycles": PREDEFINED_CYCLES_DATA_RAW,
  "surveyQuestions": PREDEFINED_SURVEY_QUESTIONS_DATA,
  "candidates": pipelineCandidates,
  "ballotMeasures": pipelineMeasures
};

export const EARLY_VOTING_LOCATIONS_DATA = [
  { id: 'ev1', name: 'City Hall', address: '222 St. Louis St, Baton Rouge, LA 70802' },
  { id: 'ev2', name: 'Main Library at Goodwood', address: '7711 Goodwood Blvd, Baton Rouge, LA 70806' },
  { id: 'ev3', name: 'Baker Municipal Building', address: '3325 Groom Rd, Baker, LA 70714' },
  { id: 'ev4', name: 'Central Branch Library', address: '11260 Joor Rd, Central, LA 70818' },
  { id: 'ev5', name: 'Forest Community Park', address: '13900 S Harrells Ferry Rd, Baton Rouge, LA 70816' },
];

export const OFFICES_DATA = RAW_DATA.offices;
export const BALLOT_MEASURES_DATA = RAW_DATA.ballotMeasures;

const today = new Date();
today.setHours(0,0,0,0); 

export const CYCLES_DATA = PREDEFINED_CYCLES_DATA_RAW
  .map(typedCycle => {
    const { type: cycleTypeData, nameOverride, ...baseCycleData } = typedCycle; // cycleTypeData is unused after destructuring
    const cycle = { ...baseCycleData }; 
    if (nameOverride) {
      cycle.name = nameOverride; 
    }
    return cycle;
  })
  .sort((a, b) => {
    const dateA = new Date(a.electionDate + 'T00:00:00');
    const dateB = new Date(b.electionDate + 'T00:00:00');
    const aIsPast = dateA < today;
    const bIsPast = dateB < today;

    if (aIsPast && !bIsPast) return 1; 
    if (!aIsPast && bIsPast) return -1; 

    if (!aIsPast && !bIsPast) { 
      return dateA.getTime() - dateB.getTime();
    }
    return dateB.getTime() - dateA.getTime(); 
  });


export const SURVEY_QUESTIONS_DATA = RAW_DATA.surveyQuestions;
export const CANDIDATES_DATA = RAW_DATA.candidates.map(c => ({
    ...c,
    photoUrl: c.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.firstName + '+' + c.lastName)}&size=200&background=random`,
    isIncumbent: c.isIncumbent || false,
    bio: c.bio || '',
    surveyResponses: c.surveyResponses || {},
}));

export const PARTIES = ["Democratic", "Republican", "Independent", "Green", "Other"];


const RAW_ELECTION_RESULTS_DATA = {};

export const ELECTION_RESULTS_DATA = [];

for (const electionDate in RAW_ELECTION_RESULTS_DATA) {
  const officeResultsForDate = RAW_ELECTION_RESULTS_DATA[electionDate];
  officeResultsForDate.forEach(rawOfficeResult => {
    const office = OFFICES_DATA.find(o => o.id === rawOfficeResult.officeId);
    if (!office) return;

    let totalVotesInOffice = 0;
    rawOfficeResult.candidateResults.forEach(cr => totalVotesInOffice += cr.votes);

    const processedCandidateResults = rawOfficeResult.candidateResults.map(cr => {
      const candidate = CANDIDATES_DATA.find(c => c.id === cr.candidateId);
      let candidateDisplayName = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown Candidate';
      if (candidate && candidate.officeId === 5 && candidate.runningMateName) {
        candidateDisplayName = `${candidate.firstName} ${candidate.lastName} / ${candidate.runningMateName}`;
      }
      return {
        candidateId: cr.candidateId,
        candidateName: candidateDisplayName,
        party: candidate ? candidate.party : 'N/A',
        photoUrl: candidate?.photoUrl,
        votes: cr.votes,
        percentage: totalVotesInOffice > 0 ? parseFloat(((cr.votes / totalVotesInOffice) * 100).toFixed(1)) : 0,
        isWinner: cr.isWinner,
      };
    }).sort((a,b) => b.votes - a.votes); 

    ELECTION_RESULTS_DATA.push({
      electionDate: electionDate,
      office: office,
      district: rawOfficeResult.district, 
      results: processedCandidateResults,
      totalVotesInOffice: totalVotesInOffice,
    });
  });
}
