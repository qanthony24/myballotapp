
import React, { useState, useEffect, useCallback, useMemo, useContext, createContext } from 'react';
import { BallotEntry, BallotArchive, CandidateSelection, MeasureStance, Cycle, ReminderSettings, Candidate } from '../types';
import { getAllCycles, isElectionPast } from '../services/dataService'; // To determine default election & use centralized isElectionPast

interface BallotContextType {
  currentElectionEntries: BallotEntry[];
  selectedElectionDate: string | null;
  setSelectedElectionDate: (electionDate: string | null) => void;
  archivedElectionDates: string[]; 
  definedElectionEventDates: Cycle[]; 
  
  addCandidateSelection: (candidate: Candidate, electionDate: string) => void;
  removeCandidateSelection: (officeId: number, district: string | undefined, electionDate: string) => void;
  isCandidateSelected: (candidateId: number, electionDate: string) => boolean;
  
  setMeasureStance: (measureId: number, vote: 'support' | 'oppose', electionDate: string) => void;
  removeMeasureStance: (measureId: number, electionDate: string) => void;
  getSelectedMeasureStance: (measureId: number, electionDate: string) => 'support' | 'oppose' | null;

  clearBallotForElection: (electionDate: string) => void;
  isElectionPast: (electionDate: string) => boolean; // Still exposed for components that use the hook

  // Reminder System
  setElectionReminder: (electionDate: string, settings: ReminderSettings | null) => void;
  getElectionReminder: (electionDate: string) => ReminderSettings | null;
}

const BallotContext = createContext<BallotContextType | undefined>(undefined);
const BALLOT_ARCHIVE_LOCAL_STORAGE_KEY = 'brVotesBallotArchive';
const REMINDERS_ARCHIVE_LOCAL_STORAGE_KEY = 'brVotesRemindersArchive';

const getDefaultElectionDate = (allCycles: Cycle[], archivedBallotDates: string[], archivedReminderDates: string[]): string | null => {
  // isElectionPast (from dataService) is used here implicitly by getAllCycles and then by filtering
  const allKnownDates = Array.from(new Set([
    ...allCycles.map(c => c.electionDate), 
    ...archivedBallotDates,
    ...archivedReminderDates
  ]));

  if (allKnownDates.length === 0) return null;

  // Sort: upcoming first (chronological), then past (most recent first)
  const sortedUniqueDates = allKnownDates.sort((a, b) => {
    const dateA = new Date(a + 'T00:00:00');
    const dateB = new Date(b + 'T00:00:00');
    const aIsPastCycle = isElectionPast(a);
    const bIsPastCycle = isElectionPast(b);

    if (!aIsPastCycle && !bIsPastCycle) return dateA.getTime() - dateB.getTime(); // Both upcoming: sort ascending
    if (aIsPastCycle && bIsPastCycle) return dateB.getTime() - dateA.getTime();   // Both past: sort descending
    if (!aIsPastCycle && bIsPastCycle) return -1; // Upcoming before past
    if (aIsPastCycle && !bIsPastCycle) return 1;  // Past after upcoming
    return 0;
  });
  
  // Prefer the first upcoming/current date if available
  const firstUpcomingOrCurrent = sortedUniqueDates.find(dateStr => !isElectionPast(dateStr));
  if (firstUpcomingOrCurrent) return firstUpcomingOrCurrent;
  
  // If all are past, return the most recent past (which will be the first in the sorted list now)
  return sortedUniqueDates.length > 0 ? sortedUniqueDates[0] : null;
};

export const BallotProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [ballotArchive, setBallotArchive] = useState<BallotArchive>(() => {
    try {
      const archive = window.localStorage.getItem(BALLOT_ARCHIVE_LOCAL_STORAGE_KEY);
      return archive ? JSON.parse(archive) : {};
    } catch (error) {
      console.error("Error reading ballot archive from localStorage", error);
      return {};
    }
  });

  const [remindersArchive, setRemindersArchive] = useState<Record<string, ReminderSettings>>(() => {
    try {
      const archive = window.localStorage.getItem(REMINDERS_ARCHIVE_LOCAL_STORAGE_KEY);
      return archive ? JSON.parse(archive) : {};
    } catch (error) {
      console.error("Error reading reminders archive from localStorage", error);
      return {};
    }
  });

  const definedElectionEvents = getAllCycles(); // This gets ALL cycles initially for context
  const [selectedElectionDate, setSelectedElectionDateState] = useState<string | null>(() => 
    getDefaultElectionDate(definedElectionEvents, Object.keys(ballotArchive), Object.keys(remindersArchive))
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(BALLOT_ARCHIVE_LOCAL_STORAGE_KEY, JSON.stringify(ballotArchive));
    } catch (error) {
      console.error("Error saving ballot archive to localStorage", error);
    }
  }, [ballotArchive]);

  useEffect(() => {
    try {
      window.localStorage.setItem(REMINDERS_ARCHIVE_LOCAL_STORAGE_KEY, JSON.stringify(remindersArchive));
    } catch (error) { 
      console.error("Error saving reminders archive to localStorage", error);
    }
  }, [remindersArchive]);

  const setSelectedElectionDate = (electionDate: string | null) => {
    setSelectedElectionDateState(electionDate);
  };
  
  const currentElectionEntries = useMemo(() => {
    return selectedElectionDate ? ballotArchive[selectedElectionDate] || [] : [];
  }, [ballotArchive, selectedElectionDate]);

  const archivedElectionDates = useMemo(() => {
    const ballotDates = Object.keys(ballotArchive).filter(dateKey => ballotArchive[dateKey] && ballotArchive[dateKey].length > 0);
    const reminderDates = Object.keys(remindersArchive).filter(dateKey => remindersArchive[dateKey]);
    return Array.from(new Set([...ballotDates, ...reminderDates]));
  }, [ballotArchive, remindersArchive]);

  // --- Candidate Functions ---
  const addCandidateSelection = useCallback((candidate: Candidate, electionDate: string) => {
    setBallotArchive(prevArchive => {
      const entriesForDate = prevArchive[electionDate] ? [...prevArchive[electionDate]] : [];
      // Remove any existing selection for the same office and district (or office if no district)
      const otherEntries = entriesForDate.filter(
        entry => entry.itemType !== 'candidate' || 
                 (entry.itemType === 'candidate' && (entry.officeId !== candidate.officeId || entry.district !== candidate.district))
      );
      const newSelection: CandidateSelection = { 
        itemType: 'candidate', 
        candidateId: candidate.id, 
        officeId: candidate.officeId,
        district: candidate.district 
      };
      return {
        ...prevArchive,
        [electionDate]: [...otherEntries, newSelection]
      };
    });
  }, [setBallotArchive]);

  const removeCandidateSelection = useCallback((officeId: number, district: string | undefined, electionDate: string) => {
    setBallotArchive(prevArchive => {
      const entriesForDate = prevArchive[electionDate];
      if (!entriesForDate) return prevArchive;
      // Keep entries that are not candidates OR are candidates but for a different office/district combo
      const updatedEntries = entriesForDate.filter(
        entry => entry.itemType === 'measure' || 
                 (entry.itemType === 'candidate' && (entry.officeId !== officeId || entry.district !== district))
      );
      if (updatedEntries.length === 0 && entriesForDate.length > 0 && !remindersArchive[electionDate]) { 
        const { [electionDate]: _, ...restOfArchive } = prevArchive;
        return restOfArchive;
      }
      return { ...prevArchive, [electionDate]: updatedEntries };
    });
  }, [remindersArchive, setBallotArchive]); 

  const isCandidateSelected = useCallback((candidateId: number, electionDate: string): boolean => {
    const entriesForDate = ballotArchive[electionDate];
    if (!entriesForDate) return false;
    return entriesForDate.some(entry => 
      entry.itemType === 'candidate' && 
      entry.candidateId === candidateId
    );
  }, [ballotArchive]);

  // --- Measure Functions ---
  const setMeasureStance = useCallback((measureId: number, vote: 'support' | 'oppose', electionDate: string) => {
    setBallotArchive(prevArchive => {
      const entriesForDate = prevArchive[electionDate] ? [...prevArchive[electionDate]] : [];
      const otherEntries = entriesForDate.filter(
        entry => entry.itemType !== 'measure' || (entry.itemType === 'measure' && entry.measureId !== measureId)
      );
      const newStance: MeasureStance = { itemType: 'measure', measureId, vote };
      return {
        ...prevArchive,
        [electionDate]: [...otherEntries, newStance]
      };
    });
  }, [setBallotArchive]);

  const removeMeasureStance = useCallback((measureId: number, electionDate: string) => {
    setBallotArchive(prevArchive => {
      const entriesForDate = prevArchive[electionDate];
      if (!entriesForDate) return prevArchive;
      const updatedEntries = entriesForDate.filter(
        entry => entry.itemType === 'candidate' || (entry.itemType === 'measure' && entry.measureId !== measureId)
      );
       if (updatedEntries.length === 0 && entriesForDate.length > 0 && !remindersArchive[electionDate]) { 
        const { [electionDate]: _, ...restOfArchive } = prevArchive;
        return restOfArchive;
      }
      return { ...prevArchive, [electionDate]: updatedEntries };
    });
  }, [remindersArchive, setBallotArchive]); 

  const getSelectedMeasureStance = useCallback((measureId: number, electionDate: string): 'support' | 'oppose' | null => {
    const entriesForDate = ballotArchive[electionDate];
    if (!entriesForDate) return null;
    const measureEntry = entriesForDate.find(entry => entry.itemType === 'measure' && entry.measureId === measureId) as MeasureStance | undefined;
    return measureEntry ? measureEntry.vote : null;
  }, [ballotArchive]);

  // --- General Ballot Functions ---
  const clearBallotForElection = useCallback((electionDate: string) => {
    setBallotArchive(prevArchive => {
      const { [electionDate]: _, ...restOfArchive } = prevArchive;
      return restOfArchive;
    });
    // If clearing the currently selected election and no reminder exists for it, try to pick a new default
    if (selectedElectionDate === electionDate && !remindersArchive[electionDate]) {
        const newBallotArchiveKeys = Object.keys(ballotArchive).filter(key => key !== electionDate);
        setSelectedElectionDateState(getDefaultElectionDate(definedElectionEvents, newBallotArchiveKeys, Object.keys(remindersArchive)));
    }
  }, [selectedElectionDate, ballotArchive, definedElectionEvents, remindersArchive, setBallotArchive, setSelectedElectionDateState]);

  // Expose isElectionPast from dataService through the context
  const isElectionPastFromService = useCallback((electionDate: string): boolean => {
    return isElectionPast(electionDate);
  }, []);


  // --- Reminder Functions ---
  const setElectionReminder = useCallback((electionDate: string, settings: ReminderSettings | null) => {
    setRemindersArchive(prevArchive => {
      const newArchive = { ...prevArchive };
      if (settings === null) {
        delete newArchive[electionDate];
         // If we delete a reminder for an election date that also has no ballot entries, ensure it's removed from default selection pool
        if (selectedElectionDate === electionDate && (!ballotArchive[electionDate] || ballotArchive[electionDate].length === 0)) {
            const newReminderArchiveKeys = Object.keys(newArchive);
            setSelectedElectionDateState(getDefaultElectionDate(definedElectionEvents, Object.keys(ballotArchive), newReminderArchiveKeys));
        }
      } else {
        newArchive[electionDate] = settings;
      }
      return newArchive;
    });
  }, [selectedElectionDate, ballotArchive, definedElectionEvents, remindersArchive, setRemindersArchive, setSelectedElectionDateState]);


  const getElectionReminder = useCallback((electionDate: string): ReminderSettings | null => {
    return remindersArchive[electionDate] || null;
  }, [remindersArchive]);

  const contextValue: BallotContextType = { 
    currentElectionEntries,
    selectedElectionDate,
    setSelectedElectionDate,
    archivedElectionDates,
    definedElectionEventDates: definedElectionEvents,
    addCandidateSelection, 
    removeCandidateSelection, 
    isCandidateSelected,
    setMeasureStance,
    removeMeasureStance,
    getSelectedMeasureStance,
    clearBallotForElection,
    isElectionPast: isElectionPastFromService,
    setElectionReminder,
    getElectionReminder
  };

  return (
    <BallotContext.Provider value={contextValue}>
      {children}
    </BallotContext.Provider>
  );
};

export const useBallot = (): BallotContextType => {
  const context = useContext<BallotContextType | undefined>(BallotContext);
  if (context === undefined) {
    throw new Error('useBallot must be used within a BallotProvider');
  }
  return context;
};
