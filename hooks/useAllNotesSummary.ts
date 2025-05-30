
import { useState, useEffect } from 'react';
import { NoteEntry, NoteSummaryItem, Candidate, Office, Cycle } from '../types';
import { getCandidateById, getOfficeById, getCycleById, getFormattedElectionName, getFormattedCandidateOfficeName } from '../services/dataService';

/**
 * Custom hook to scan localStorage for all candidate notes and summarize them.
 * @returns An array of NoteSummaryItem objects.
 */
export function useAllNotesSummary(): NoteSummaryItem[] {
  const [notesSummary, setNotesSummary] = useState<NoteSummaryItem[]>([]);

  useEffect(() => {
    const fetchAllNotes = () => {
      const summary: NoteSummaryItem[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('notes_')) {
          const candidateIdStr = key.substring('notes_'.length);
          const candidateIdNum = parseInt(candidateIdStr, 10);

          if (!isNaN(candidateIdNum)) {
            try {
              const storedNotesRaw = localStorage.getItem(key);
              if (storedNotesRaw) {
                const candidateNotes: NoteEntry[] = JSON.parse(storedNotesRaw);
                if (candidateNotes.length > 0) {
                  const candidate = getCandidateById(candidateIdNum);
                  if (candidate) {
                    const office = getOfficeById(candidate.officeId);
                    const cycle = getCycleById(candidate.cycleId);
                    
                    let candidateDisplayName = `${candidate.firstName} ${candidate.lastName}`;
                    if (candidate.officeId === 5 && candidate.runningMateName) { // Office ID 5 for US President
                        candidateDisplayName += ` / ${candidate.runningMateName}`;
                    }

                    summary.push({
                      candidateId: candidate.id,
                      candidateName: candidateDisplayName,
                      candidateProfileLink: `/candidate/${candidate.id}`,
                      officeName: getFormattedCandidateOfficeName(candidate),
                      electionName: getFormattedElectionName(cycle),
                      notesCount: candidateNotes.length,
                      latestNote: candidateNotes.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null,
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Error processing notes for key ${key}:`, error);
            }
          }
        }
      }
      // Sort summary by candidate name for consistent display
      summary.sort((a, b) => a.candidateName.localeCompare(b.candidateName));
      setNotesSummary(summary);
    };

    fetchAllNotes();
    
    // Optional: Listen to storage events to update if notes change in another tab
    // This might be overly complex for this app's scope but is good practice for robustness.
    // const handleStorageChange = (event: StorageEvent) => {
    //   if (event.key && event.key.startsWith('notes_')) {
    //     fetchAllNotes();
    //   }
    // };
    // window.addEventListener('storage', handleStorageChange);
    // return () => {
    //   window.removeEventListener('storage', handleStorageChange);
    // };

  }, []);

  return notesSummary;
}
