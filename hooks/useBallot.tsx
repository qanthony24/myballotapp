
import React, { useState, useEffect, useCallback, useMemo, useContext, createContext, useRef } from 'react';
import { BallotEntry, BallotArchive, CandidateSelection, MeasureStance, Cycle, ReminderSettings, Candidate } from '../types';
import { getAllCycles, getCycleByElectionDate, isElectionPast } from '../services/dataService';
import { useAuth } from './useAuth';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  isElectionPast: (electionDate: string) => boolean;

  setElectionReminder: (electionDate: string, settings: ReminderSettings | null) => void;
  getElectionReminder: (electionDate: string) => ReminderSettings | null;

  isSyncing: boolean;
}

const BallotContext = createContext<BallotContextType | undefined>(undefined);
const BALLOT_ARCHIVE_LOCAL_STORAGE_KEY = 'brVotesBallotArchive';
const REMINDERS_ARCHIVE_LOCAL_STORAGE_KEY = 'brVotesRemindersArchive';

function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage`, err);
  }
}

function mergeArchives(local: BallotArchive, remote: BallotArchive): BallotArchive {
  const merged = { ...remote };
  for (const dateKey of Object.keys(local)) {
    if (!merged[dateKey] || merged[dateKey].length === 0) {
      merged[dateKey] = local[dateKey];
    }
  }
  return merged;
}

function mergeReminders(
  local: Record<string, ReminderSettings>,
  remote: Record<string, ReminderSettings>,
): Record<string, ReminderSettings> {
  return { ...local, ...remote };
}

const getDefaultElectionDate = (allCycles: Cycle[], archivedBallotDates: string[], archivedReminderDates: string[]): string | null => {
  const allKnownDates = Array.from(new Set([
    ...allCycles.map(c => c.electionDate), 
    ...archivedBallotDates,
    ...archivedReminderDates
  ]));

  if (allKnownDates.length === 0) return null;

  const sortedUniqueDates = allKnownDates.sort((a, b) => {
    const dateA = new Date(a + 'T00:00:00');
    const dateB = new Date(b + 'T00:00:00');
    const aIsPastCycle = isElectionPast(a);
    const bIsPastCycle = isElectionPast(b);

    if (!aIsPastCycle && !bIsPastCycle) return dateA.getTime() - dateB.getTime();
    if (aIsPastCycle && bIsPastCycle) return dateB.getTime() - dateA.getTime();
    if (!aIsPastCycle && bIsPastCycle) return -1;
    if (aIsPastCycle && !bIsPastCycle) return 1;
    return 0;
  });
  
  const firstUpcomingOrCurrent = sortedUniqueDates.find(dateStr => !isElectionPast(dateStr));
  if (firstUpcomingOrCurrent) return firstUpcomingOrCurrent;
  
  return sortedUniqueDates.length > 0 ? sortedUniqueDates[0] : null;
};

export const BallotProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { currentUser } = useAuth();

  const [ballotArchive, setBallotArchive] = useState<BallotArchive>(() =>
    readLocalStorage(BALLOT_ARCHIVE_LOCAL_STORAGE_KEY, {}),
  );

  const [remindersArchive, setRemindersArchive] = useState<Record<string, ReminderSettings>>(() =>
    readLocalStorage(REMINDERS_ARCHIVE_LOCAL_STORAGE_KEY, {}),
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const firestoreSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextFirestoreSave = useRef(false);

  const definedElectionEvents = getAllCycles();
  const [selectedElectionDate, setSelectedElectionDateState] = useState<string | null>(() => 
    getDefaultElectionDate(definedElectionEvents, Object.keys(ballotArchive), Object.keys(remindersArchive))
  );

  // --- Firestore load on login ---
  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    setIsSyncing(true);

    (async () => {
      try {
        const ballotDocRef = doc(db, 'users', currentUser.id, 'appData', 'ballot');
        const snap = await getDoc(ballotDocRef);

        if (cancelled) return;

        if (snap.exists()) {
          const remote = snap.data() as { archive?: BallotArchive; reminders?: Record<string, ReminderSettings> };
          const localBallot = readLocalStorage<BallotArchive>(BALLOT_ARCHIVE_LOCAL_STORAGE_KEY, {});
          const localReminders = readLocalStorage<Record<string, ReminderSettings>>(REMINDERS_ARCHIVE_LOCAL_STORAGE_KEY, {});

          const mergedBallot = mergeArchives(localBallot, remote.archive ?? {});
          const mergedReminders = mergeReminders(localReminders, remote.reminders ?? {});

          skipNextFirestoreSave.current = true;
          setBallotArchive(mergedBallot);
          setRemindersArchive(mergedReminders);
        }
      } catch (err) {
        console.error('Failed to load ballot from Firestore:', err);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // --- Persist to localStorage (always) ---
  useEffect(() => {
    writeLocalStorage(BALLOT_ARCHIVE_LOCAL_STORAGE_KEY, ballotArchive);
  }, [ballotArchive]);

  useEffect(() => {
    writeLocalStorage(REMINDERS_ARCHIVE_LOCAL_STORAGE_KEY, remindersArchive);
  }, [remindersArchive]);

  // --- Persist to Firestore (when logged in, debounced) ---
  useEffect(() => {
    if (!currentUser) return;

    if (skipNextFirestoreSave.current) {
      skipNextFirestoreSave.current = false;
      return;
    }

    if (firestoreSaveTimer.current) clearTimeout(firestoreSaveTimer.current);

    firestoreSaveTimer.current = setTimeout(async () => {
      try {
        const ballotDocRef = doc(db, 'users', currentUser.id, 'appData', 'ballot');
        await setDoc(ballotDocRef, {
          archive: ballotArchive,
          reminders: remindersArchive,
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to save ballot to Firestore:', err);
      }
    }, 1500);

    return () => {
      if (firestoreSaveTimer.current) clearTimeout(firestoreSaveTimer.current);
    };
  }, [ballotArchive, remindersArchive, currentUser?.id]);

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
  }, []);

  const removeCandidateSelection = useCallback((officeId: number, district: string | undefined, electionDate: string) => {
    setBallotArchive(prevArchive => {
      const entriesForDate = prevArchive[electionDate];
      if (!entriesForDate) return prevArchive;
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
  }, [remindersArchive]); 

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
  }, []);

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
  }, [remindersArchive]); 

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
    if (selectedElectionDate === electionDate && !remindersArchive[electionDate]) {
        const newBallotArchiveKeys = Object.keys(ballotArchive).filter(key => key !== electionDate);
        setSelectedElectionDateState(getDefaultElectionDate(definedElectionEvents, newBallotArchiveKeys, Object.keys(remindersArchive)));
    }
  }, [selectedElectionDate, ballotArchive, definedElectionEvents, remindersArchive]);

  const isElectionPastFromService = useCallback((electionDate: string): boolean => {
    return isElectionPast(electionDate);
  }, []);

  // --- Reminder Functions ---
  const setElectionReminder = useCallback((electionDate: string, settings: ReminderSettings | null) => {
    setRemindersArchive(prevArchive => {
      const newArchive = { ...prevArchive };
      if (settings === null) {
        delete newArchive[electionDate];
        if (selectedElectionDate === electionDate && (!ballotArchive[electionDate] || ballotArchive[electionDate].length === 0)) {
            const newReminderArchiveKeys = Object.keys(newArchive);
            setSelectedElectionDateState(getDefaultElectionDate(definedElectionEvents, Object.keys(ballotArchive), newReminderArchiveKeys));
        }
      } else {
        newArchive[electionDate] = settings;
      }
      return newArchive;
    });
  }, [selectedElectionDate, ballotArchive, definedElectionEvents]);

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
    getElectionReminder,
    isSyncing,
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

export const useElection = () => {
  const { selectedElectionDate } = useBallot();
  if (!selectedElectionDate) return null;
  return getCycleByElectionDate(selectedElectionDate);
};
