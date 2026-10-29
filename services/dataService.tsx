// Removed type imports from '../types' to make this file more JS-friendly for direct browser parsing.
import type { Cycle } from '../types';
// Type annotations have been removed from function signatures and variable declarations.

import {
    ELECTION_RESULTS_DATA,
    EARLY_VOTING_LOCATIONS_DATA,
    formatElectionName as formatNameUtil
} from '../constants';
// Election data comes from the live store (Firestore over the bundled snapshot).
import {
    getCandidatesData,
    getCyclesData,
    getOfficesData,
    getBallotMeasuresData,
    getSurveyQuestionsData,
} from './electionDataStore';

/**
 * Checks if a given election date string is in the past.
 * @param electionDate The election date string (e.g., "YYYY-MM-DD").
 * @returns True if the election date is before today, false otherwise.
 */
export const isElectionPast = (electionDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  return new Date(electionDate + 'T00:00:00') < today;
};

export const getAllCandidates = () => {
  return getCandidatesData();
};

export const getCandidateById = (id) => {
  return getCandidatesData().find(candidate => candidate.id === id) || null;
};

/**
 * Gets candidates for a given office and election cycle, optionally filtered by district.
 * cycleId here is the numeric ID of the Cycle/ElectionEvent.
 */
export const getCandidatesByOfficeAndCycle = (officeId, cycleId, district) => {
  return getCandidatesData().filter(c => {
    const officeMatch = c.officeId === officeId;
    const cycleMatch = (c.cycleIds || []).includes(cycleId);
    const districtMatch = district ? c.district === district : true; // If district is provided, match it. Otherwise, true.
    // For offices without districts, c.district will be undefined. 
    // If a district is passed for such an office, it won't match, which is correct.
    // If no district is passed, it will match all for that office (if c.district is also undefined).
    if (district === undefined) { // If no district filter is applied, match candidates with or without a district.
        return officeMatch && cycleMatch;
    }
    return officeMatch && cycleMatch && districtMatch;
  });
};

/**
 * Gets unique district names for a given office and cycle.
 */
export const getDistrictsForOfficeAndCycle = (officeId, cycleId) => {
  const candidatesInOfficeCycle = getCandidatesData().filter(
    c => c.officeId === officeId && (c.cycleIds || []).includes(cycleId) && c.district
  );
  // FIX: Ensure correct type for uniqueDistricts by explicitly typing intermediate map and using spread syntax
  const mappedDistricts = candidatesInOfficeCycle.map(c => c.district); // c.district! removed
  const uniqueDistricts = [...new Set(mappedDistricts)];
  return uniqueDistricts.sort(); // Sort for consistent display
};


export const getAllOffices = () => {
  return getOfficesData();
};

export const getOfficeById = (id) => {
  return getOfficesData().find(office => office.id === id) || null;
};

export const getAllCycles = () => {
  // getCyclesData() is already sorted in constants.ts (upcoming first, then past)
  return getCyclesData();
};

/**
 * Gets all upcoming election cycles.
 * @returns An array of Cycle objects for elections that are not in the past.
 */
export const getUpcomingCycles = () => {
  return getCyclesData().filter(cycle => !isElectionPast(cycle.electionDate));
};

export const getCycleById = (id) => {
  // id here is the numeric ID of the Cycle/ElectionEvent
  return getCyclesData().find(cycle => cycle.id === id) || null;
};

/**
 * Picks which of a candidate's elections to show/act on. A candidate can be in
 * several elections (e.g. a party primary and the general), so "the first one
 * in the list" is not reliable. Order of preference:
 *   1. the election the user is currently looking at (preferredElectionDate)
 *   2. the soonest upcoming election
 *   3. the most recent past election
 */
export const getRelevantCycleForCandidate = (
  candidate: { cycleIds?: number[] } | null | undefined,
  preferredElectionDate?: string,
): Cycle | null => {
  const cycles = (candidate?.cycleIds || [])
    .map((cid: number) => getCycleById(cid) as Cycle | null)
    .filter((c): c is Cycle => Boolean(c));
  if (cycles.length === 0) return null;
  if (preferredElectionDate) {
    const preferred = cycles.find((c: Cycle) => c.electionDate === preferredElectionDate);
    if (preferred) return preferred;
  }
  const byDate = [...cycles].sort((a, b) => a.electionDate.localeCompare(b.electionDate));
  const upcoming = byDate.find((c) => !isElectionPast(c.electionDate));
  return upcoming ?? byDate[byDate.length - 1];
};

export const getCycleByElectionDate = (electionDate) => {
  return getCyclesData().find(cycle => cycle.electionDate === electionDate) || null;
};

export const getSurveyQuestions = () => {
  return getSurveyQuestionsData();
};

export const getSurveyQuestionByKey = (key) => {
    return getSurveyQuestionsData().find(sq => sq.key === key) || null;
};

// --- Ballot Measures ---
export const getAllBallotMeasures = () => {
  return getBallotMeasuresData();
};

export const getBallotMeasureById = (id) => {
  return getBallotMeasuresData().find(measure => measure.id === id) || null;
};

export const getBallotMeasuresByElectionDate = (electionDate) => {
  return getBallotMeasuresData().filter(measure => measure.electionDate === electionDate);
};


// Helper function to get the display name for an election, using its date and original name.
export const getFormattedElectionName = (cycle) => {
  if (!cycle) return 'N/A';
  return formatNameUtil(cycle.electionDate, cycle.name);
};

// Helper function to get the display name for an election by its date string
export const getFormattedElectionNameFromDate = (electionDate) => {
    if (!electionDate) return 'N/A';
    const cycle = getCycleByElectionDate(electionDate);
    return cycle ? formatNameUtil(cycle.electionDate, cycle.name) : formatNameUtil(electionDate, "Election");
};

/**
 * Formats the candidate's office name, including district if applicable.
 * @param candidate The candidate object.
 * @returns A string like "Mayor-President" or "State Representative, District 61".
 */
export const getFormattedCandidateOfficeName = (candidate) => {
  if (!candidate) return 'N/A';
  const office = getOfficeById(candidate.officeId);
  if (!office) return 'N/A';
  return candidate.district ? `${office.name}, ${candidate.district}` : office.name;
};


/**
 * Fetches all election results for a specific election date.
 */
export const getResultsForElection = (electionDate) => {
  return ELECTION_RESULTS_DATA.filter(result => result.electionDate === electionDate);
};

/**
 * Fetches all early voting locations.
 */
export const getEarlyVotingLocations = () => {
    return EARLY_VOTING_LOCATIONS_DATA;
};
