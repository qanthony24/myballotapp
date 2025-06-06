import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBallot } from '../hooks/useBallot';
import { 
    getCandidateById, 
    getOfficeById, 
    getFormattedElectionNameFromDate, 
    getResultsForElection,
    getBallotMeasuresByElectionDate,
    getCycleByElectionDate,
    getAllCandidates,
    getFormattedCandidateOfficeName,
    isElectionPast // Import directly from dataService
} from '../services/dataService';
import { Candidate, Office, /* BallotEntry, */ OfficeElectionResults, BallotMeasure, CandidateSelection, /* MeasureStance, */ Cycle, ReminderSettings } from '../types'; // Removed unused imports
import { TrashIcon, UserCircleIcon, ArrowPathIcon, CheckBadgeIcon, ArrowDownTrayIcon, CalendarDaysIcon, LockClosedIcon, ChartBarIcon, InformationCircleIcon, DocumentCheckIcon, HandThumbUpIcon, HandThumbDownIcon, NoSymbolIcon, BellAlertIcon, PencilSquareIcon, CheckCircleIcon as SolidCheckCircleIcon } from '@heroicons/react/24/outline';
import SwipeableBallotItem from '../components/SwipeableBallotItem';
import Confetti from 'react-confetti';
import ElectionResultsDisplay from '../components/election/ElectionResultsDisplay'; 
import { ReminderSetupModal } from '../components/reminders/ReminderSetupModal';

interface PopulatedCandidateEntry {
  candidate: Candidate; // Full candidate object needed for getFormattedCandidateOfficeName
  office: Office; // Base office
  district?: string; // District from CandidateSelection
}

interface PopulatedMeasureEntry {
  measure: BallotMeasure;
  userStance: 'support' | 'oppose' | null;
}

const MyBallotPage: React.FC = () => {
  const { 
    currentElectionEntries, 
    selectedElectionDate, 
    setSelectedElectionDate,
    archivedElectionDates,
    definedElectionEventDates,
    removeCandidateSelection,
    removeMeasureStance,
    setMeasureStance, 
    clearBallotForElection,
    // isElectionPast, // We'll use the one from dataService directly for consistency
    getSelectedMeasureStance,
    getElectionReminder, 
    setElectionReminder  
  } = useBallot();
  
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [confettiShown, setConfettiShown] = useState(false);
  const [electionResults, setElectionResults] = useState<OfficeElectionResults[]>([]);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [currentElectionCycleDetails, setCurrentElectionCycleDetails] = useState<Cycle | null>(null);
  const [existingReminder, setExistingReminder] = useState<ReminderSettings | null>(null);


  const allKnownElectionDates = useMemo(() => {
    const datesFromDefinedEvents = definedElectionEventDates.map(c => c.electionDate);
    const uniqueDates = Array.from(new Set([...datesFromDefinedEvents, ...archivedElectionDates]));
    
    return uniqueDates.sort((a, b) => {
        const dateA = new Date(a + 'T00:00:00');
        const dateB = new Date(b + 'T00:00:00');
        const aIsPastCycle = isElectionPast(a); // Use imported isElectionPast
        const bIsPastCycle = isElectionPast(b); // Use imported isElectionPast

        if (!aIsPastCycle && !bIsPastCycle) return dateA.getTime() - dateB.getTime();
        if (aIsPastCycle && bIsPastCycle) return dateB.getTime() - dateA.getTime();
        if (!aIsPastCycle && bIsPastCycle) return -1;
        if (aIsPastCycle && !bIsPastCycle) return 1;
        return 0;
    });
  }, [definedElectionEventDates, archivedElectionDates]);

  useEffect(() => {
    if (!selectedElectionDate && allKnownElectionDates.length > 0) {
        setSelectedElectionDate(allKnownElectionDates[0]);
    }
  }, [selectedElectionDate, allKnownElectionDates, setSelectedElectionDate]);

  const currentElectionIsPastState = selectedElectionDate ? isElectionPast(selectedElectionDate) : false;

  useEffect(() => {
    if (selectedElectionDate) {
      setCurrentElectionCycleDetails(getCycleByElectionDate(selectedElectionDate));
      setExistingReminder(getElectionReminder(selectedElectionDate));
      if (currentElectionIsPastState) {
        const results = getResultsForElection(selectedElectionDate);
        setElectionResults(results);
      } else {
        setElectionResults([]);
      }
    } else {
      setCurrentElectionCycleDetails(null);
      setExistingReminder(null);
      setElectionResults([]);
    }
  }, [selectedElectionDate, currentElectionIsPastState, getElectionReminder]);


  const populatedCandidateSelections = useMemo(() => {
    if (!selectedElectionDate) return [];
    return currentElectionEntries
      .filter((entry): entry is CandidateSelection => entry.itemType === 'candidate')
      .map(item => {
        const candidate = getCandidateById(item.candidateId);
        const office = getOfficeById(item.officeId);
        return (candidate && office) ? { candidate, office, district: item.district } as PopulatedCandidateEntry : null;
      })
      .filter(entry => entry !== null) as PopulatedCandidateEntry[];
  }, [currentElectionEntries, selectedElectionDate]);

  const populatedMeasureStances = useMemo(() => {
    if (!selectedElectionDate) return [];
    const measuresForElection = getBallotMeasuresByElectionDate(selectedElectionDate);
    return measuresForElection.map(measure => {
        const userStance = getSelectedMeasureStance(measure.id, selectedElectionDate);
        return { measure, userStance } as PopulatedMeasureEntry;
    });
  }, [currentElectionEntries, selectedElectionDate, getSelectedMeasureStance, getBallotMeasuresByElectionDate]);


  const groupedBallotByOffice = useMemo(() => {
    return populatedCandidateSelections.reduce((acc, entry) => {
      // Use candidate.officeId and entry.district to create a unique key for the race
      const raceKey = `${entry.office.id}-${entry.district || 'no-district'}`;
      if (!acc[raceKey]) {
        // Store the formatted name and an array for entries under this raceKey
        acc[raceKey] = {
          // Use candidate from the first entry for its district info for formatting.
          // Assumes all candidates in this group are for the same office/district.
          formattedName: getFormattedCandidateOfficeName(entry.candidate), 
          entries: []
        };
      }
      acc[raceKey].entries.push(entry);
      return acc;
    }, {} as Record<string, { formattedName: string; entries: PopulatedCandidateEntry[] }>);
  }, [populatedCandidateSelections]);

  // Sort entries within each group by ballotOrder
  for (const raceKey in groupedBallotByOffice) {
    groupedBallotByOffice[raceKey].entries.sort((a, b) => a.candidate.ballotOrder - b.candidate.ballotOrder);
  }

  const totalRacesForElection = useMemo(() => {
    if (!selectedElectionDate) return 0;
    const cycle = getCycleByElectionDate(selectedElectionDate);
    if (!cycle) return 0;
    const candidatesForCycle = getAllCandidates().filter(c => c.cycleId === cycle.id);
    const uniqueRaces = new Set(candidatesForCycle.map(c => `${c.officeId}-${c.district || 'no-district'}`));
    return uniqueRaces.size;
  }, [selectedElectionDate]);

  const ballotIsComplete = populatedCandidateSelections.length >= totalRacesForElection && totalRacesForElection > 0;

  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (ballotIsComplete && !confettiShown) {
      setShowConfetti(true);
      setConfettiShown(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  }, [ballotIsComplete, confettiShown]);
  
  const handleSaveBallot = () => {
    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 3000);
  };
  
  const handleMeasureStanceChange = (measureId: number, vote: 'support' | 'oppose' | null) => {
    if (!selectedElectionDate || currentElectionIsPastState) return;
    if (vote === null) {
        removeMeasureStance(measureId, selectedElectionDate);
    } else {
        setMeasureStance(measureId, vote, selectedElectionDate);
    }
  }

  const handleSaveReminder = (settings: ReminderSettings | null) => {
    if (selectedElectionDate) {
      setElectionReminder(selectedElectionDate, settings);
      setExistingReminder(settings); 
    }
    setIsReminderModalOpen(false);
  };

  const reminderForEmptyCheck = getElectionReminder(""); // Store in a variable to satisfy Object.keys
  if (allKnownElectionDates.length === 0 && currentElectionEntries.length === 0 && (reminderForEmptyCheck === null || Object.keys(reminderForEmptyCheck).length === 0) ) { 
    return (
      <div className="text-center py-10">
        <UserCircleIcon className="h-24 w-24 text-slate-100/30 mx-auto mb-4" /> {/* Updated icon color */}
        <h1 className="text-3xl font-bold text-midnight-navy mb-4">My Ballot</h1>
        <p className="text-xl text-midnight-navy/70 mb-6">You haven't made any selections or set any reminders yet.</p>
        <Link
          to="/"
          className="bg-sunlight-gold hover:bg-opacity-80 hover:bg-sunlight-gold text-midnight-navy font-semibold py-3 px-6 rounded-md transition duration-150 ease-in-out text-lg"
        >
          Find Candidates
        </Link>
      </div>
    );
  }
  
  const electionDisplayName = selectedElectionDate ? getFormattedElectionNameFromDate(selectedElectionDate) : "Select an Election";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-slate-100/30">
        <h1 className="text-3xl font-bold text-midnight-navy mb-4 text-center">My Ballot</h1>
        
        <div className="mb-8">
          <label htmlFor="election-select" className="block text-sm font-medium text-midnight-navy mb-1">
            Select Election:
          </label>
          <select
            id="election-select"
            value={selectedElectionDate || ""}
            onChange={(e) => setSelectedElectionDate(e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-slate-100/30 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold sm:text-sm text-midnight-navy"
          >
            <option value="" disabled>-- Select an Election --</option>
            {allKnownElectionDates.map(dateStr => (
              <option key={dateStr} value={dateStr}>
                {getFormattedElectionNameFromDate(dateStr)} {isElectionPast(dateStr) ? "(Past)" : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedElectionDate && (
          <>
            <h2 className="text-2xl font-semibold text-midnight-navy border-b-2 border-slate-100/30 pb-2 mb-6 flex items-center justify-between">
              <span>{electionDisplayName}</span>
              {currentElectionIsPastState && <span className="text-sm text-midnight-navy/70 flex items-center"><LockClosedIcon className="h-4 w-4 mr-1"/>Archived (Read-Only)</span>}
            </h2>

            {currentElectionIsPastState && electionResults.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center text-2xl font-semibold text-midnight-navy mb-4">
                    <ChartBarIcon className="h-7 w-7 mr-2 text-civic-blue" /> {/* Updated icon color */}
                    Official Election Results
                </div>
                {electionResults.map(officeResult => (
                  <ElectionResultsDisplay key={`${officeResult.office.id}-${officeResult.district || 'no-district'}`} officeResults={officeResult} />
                ))}
              </div>
            )}
            {currentElectionIsPastState && electionResults.length === 0 && (
                <div className="mb-8 p-4 bg-slate-100 rounded-md border border-slate-100/30 text-center">
                    <InformationCircleIcon className="h-8 w-8 mx-auto mb-2 text-midnight-navy/70" />
                    <p className="text-midnight-navy/70">Official results for this past election are not available at this time.</p>
                </div>
            )}

            {/* Candidate Selections */}
            <div className="mt-4">
                <h3 className="text-xl font-semibold text-midnight-navy mb-1">
                    {currentElectionIsPastState ? "Your Archived Candidate Choices" : "Your Candidate Choices"}
                </h3>
                 <p className="text-sm text-midnight-navy/70 mb-6">
                    {currentElectionIsPastState 
                        ? "These were your candidate selections for this past election." 
                        : "Manage your candidate selections for the upcoming election below."}
                </p>
                {populatedCandidateSelections.length === 0 ? (
                    <div className="text-center py-6">
                        <UserCircleIcon className="h-16 w-16 text-slate-100/30 mx-auto mb-3" /> {/* Updated icon color */}
                        <p className="text-lg text-midnight-navy/70">
                            {currentElectionIsPastState ? "You did not save any candidate selections for this election." : "No candidate selections made yet for this election."}
                        </p>
                        {!currentElectionIsPastState && (
                            <Link
                            to="/"
                            className="mt-4 inline-block bg-sunlight-gold hover:bg-opacity-80 hover:bg-sunlight-gold text-midnight-navy font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out text-base"
                            >
                            Find Candidates
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                    {Object.entries(groupedBallotByOffice).map(([raceKey, group]) => (
                        <div key={raceKey} className="mb-2">
                            <h4 className="text-lg font-semibold text-midnight-navy mb-3">{group.formattedName}</h4>
                            {group.entries.map(({ candidate, office, district }) => {
                                let candidateDisplayName = `${candidate.firstName} ${candidate.lastName}`;
                                if (candidate.officeId === 5 && candidate.runningMateName) {
                                    candidateDisplayName += ` / ${candidate.runningMateName}`;
                                }
                                return (
                                    <SwipeableBallotItem
                                        key={`${selectedElectionDate}-candidate-${candidate.id}`}
                                        onRemove={() => removeCandidateSelection(office.id, district, selectedElectionDate)}
                                    >
                                    <div className="bg-slate-100 p-4 rounded-lg shadow-sm flex items-center justify-between transition-all hover:shadow-md border border-slate-100/30 mb-3">
                                        <div>
                                            <p className="text-md text-midnight-navy/70">
                                            {candidate.ballotOrder > 0 && <span className="font-semibold mr-1">(#{candidate.ballotOrder})</span>}
                                                {candidateDisplayName} ({candidate.party})
                                                {candidate.isIncumbent && (
                                                    <span className="ml-2 text-xs font-semibold text-white bg-civic-blue px-2 py-0.5 rounded-full inline-flex items-center">
                                                        <CheckBadgeIcon className="h-3 w-3 mr-1" />
                                                        Incumbent
                                                    </span>
                                                )}
                                            </p>
                                            <Link to={`/candidate/${candidate.id}`} className="text-sm text-civic-blue hover:underline">View Profile</Link>
                                        </div>
                                        {!currentElectionIsPastState && (
                                            <button
                                                onClick={() => removeCandidateSelection(office.id, district, selectedElectionDate)}
                                                className="p-2 text-civic-blue hover:text-opacity-80 hover:text-civic-blue hover:bg-civic-blue/10 rounded-full transition-colors"
                                                aria-label={`Remove ${candidate.firstName} ${candidate.lastName} from ballot`}
                                            >
                                                <TrashIcon className="h-6 w-6" />
                                            </button>
                                        )}
                                    </div>
                                    </SwipeableBallotItem>
                                );
                            })}
                        </div>
                    ))}
                    </div>
                )}
            </div>

            {/* Ballot Measures Stances */}
            {populatedMeasureStances.length > 0 && (
                <div className="mt-10 pt-6 border-t border-slate-100/30">
                    <h3 className="text-xl font-semibold text-midnight-navy mb-1">
                        {currentElectionIsPastState ? "Your Archived Ballot Measure Stances" : "Your Ballot Measure Stances"}
                    </h3>
                    <p className="text-sm text-midnight-navy/70 mb-6">
                        {currentElectionIsPastState 
                            ? "These were your stances on ballot measures for this past election." 
                            : "Manage your stances for the upcoming election below."}
                    </p>
                    <div className="space-y-4">
                        {populatedMeasureStances.map(({ measure, userStance }) => (
                            <div key={`${selectedElectionDate}-measure-${measure.id}`} className="bg-slate-100 p-4 rounded-lg shadow-sm border border-slate-100/30">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                    <div>
                                        <p className="font-semibold text-midnight-navy">{measure.title}</p>
                                        <Link to={`/ballot-measure/${measure.id}`} className="text-sm text-civic-blue hover:underline">View Details</Link>
                                    </div>
                                    <div className="mt-3 sm:mt-0 flex items-center space-x-2">
                                        {currentElectionIsPastState ? (
                                            <span className={`px-3 py-1 text-sm font-medium rounded-full
                                                ${userStance === 'support' ? 'bg-green-100 text-green-700' : ''}
                                                ${userStance === 'oppose' ? 'bg-red-100 text-red-700' : ''}
                                                ${!userStance ? 'bg-gray-100 text-gray-700' : ''}`}>
                                                {userStance ? userStance.charAt(0).toUpperCase() + userStance.slice(1) : 'No Stance'}
                                            </span>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleMeasureStanceChange(measure.id, 'support')}
                                                    className={`p-2 rounded-full transition-colors ${userStance === 'support' ? 'bg-green-500 text-white ring-2 ring-green-600 ring-offset-1' : 'bg-gray-200 hover:bg-green-100 text-gray-600'}`}
                                                    aria-label={`Support ${measure.title}`}
                                                    title="Support"
                                                >
                                                    <HandThumbUpIcon className="h-5 w-5"/>
                                                </button>
                                                <button
                                                    onClick={() => handleMeasureStanceChange(measure.id, 'oppose')}
                                                    className={`p-2 rounded-full transition-colors ${userStance === 'oppose' ? 'bg-red-500 text-white ring-2 ring-red-600 ring-offset-1' : 'bg-gray-200 hover:bg-red-100 text-gray-600'}`}
                                                    aria-label={`Oppose ${measure.title}`}
                                                    title="Oppose"
                                                >
                                                    <HandThumbDownIcon className="h-5 w-5"/>
                                                </button>
                                                {userStance && (
                                                     <button
                                                        onClick={() => handleMeasureStanceChange(measure.id, null)}
                                                        className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
                                                        aria-label={`Remove stance for ${measure.title}`}
                                                        title="Clear Stance"
                                                    >
                                                        <NoSymbolIcon className="h-5 w-5"/>
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </>
        )}
      </div>

      {selectedElectionDate && (
          <div className="mt-8 flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
            {!currentElectionIsPastState && (
                <button
                onClick={handleSaveBallot}
                className="w-full sm:w-auto flex items-center justify-center bg-civic-blue hover:bg-opacity-80 hover:bg-civic-blue text-white font-semibold py-3 px-6 rounded-md transition duration-150 ease-in-out text-lg"
                >
                <ArrowDownTrayIcon className="h-6 w-6 mr-2" /> Save My Ballot
                </button>
            )}
            {!currentElectionIsPastState && currentElectionCycleDetails && (
                <button
                  onClick={() => setIsReminderModalOpen(true)}
                  className={`w-full sm:w-auto flex items-center justify-center font-semibold py-3 px-6 rounded-md transition duration-150 ease-in-out text-lg
                              ${existingReminder ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-midnight-navy hover:bg-opacity-80 hover:bg-midnight-navy text-white'}`}
                >
                  {existingReminder ? <SolidCheckCircleIcon className="h-6 w-6 mr-2" /> : <BellAlertIcon className="h-6 w-6 mr-2" />}
                  {existingReminder ? 'View/Edit Reminder' : 'Set Reminder'}
                </button>
              )}
            <button
            onClick={() => {
                if (currentElectionIsPastState || !selectedElectionDate) return;
                if (window.confirm(`Are you sure you want to clear all your selections and stances for the ${electionDisplayName}? This action cannot be undone.`)) {
                    clearBallotForElection(selectedElectionDate);
                }
            }}
            className={`w-full sm:w-auto flex items-center justify-center font-semibold py-3 px-6 rounded-md transition duration-150 ease-in-out text-lg ${
                currentElectionIsPastState || (currentElectionEntries.length === 0 && populatedMeasureStances.every(m => !m.userStance))
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                : 'bg-midnight-navy/70 hover:bg-opacity-80 hover:bg-midnight-navy/70 text-white'
            }`}
            disabled={currentElectionIsPastState || (currentElectionEntries.length === 0 && populatedMeasureStances.every(m => !m.userStance))}
            >
            <ArrowPathIcon className="h-6 w-6 mr-2" /> Clear This Election's Ballot
            </button>
        </div>
      )}
      {showSaveConfirmation && (
        <div
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300 ease-in-out"
            role="alert"
        >
            Ballot for {electionDisplayName} saved successfully!
        </div>
      )}
      {showConfetti && <Confetti recycle={false} />} 
       {isReminderModalOpen && currentElectionCycleDetails && (
        <ReminderSetupModal
          isOpen={isReminderModalOpen}
          onClose={() => setIsReminderModalOpen(false)}
          electionCycle={currentElectionCycleDetails}
          electionDisplayName={electionDisplayName}
          initialReminderSettings={existingReminder}
          onSaveReminder={handleSaveReminder}
        />
      )}
    </div>
  );
};

export default MyBallotPage;