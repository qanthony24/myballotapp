import React, { useState, useMemo, useEffect } from 'react';
import CandidateCard from '../components/candidates/CandidateCard';
import FilterControls from '../components/candidates/FilterControls';
import { Candidate, Cycle } from '../types';
import { ViewMode } from '../constants'; // Changed import
import { 
  getCycleById, 
  getUpcomingCycles, 
} from '../services/dataService';
import { useElectionData } from '../services/electionDataStore';
import FindMyBallot from '../components/ballot/FindMyBallot';
import { useVoterDistricts } from '../hooks/useVoterDistricts';
import { candidateBallotStatus } from '../services/ballotScope';
import { useBallot } from '../hooks/useBallot';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { CardGridSkeleton } from '../components/ui/PageSkeleton';

const HomePage: React.FC = () => {
  const { 
    addCandidateSelection, 
    removeCandidateSelection,
    isCandidateSelected,   
    selectedElectionDate: ballotSelectedElectionDate 
  } = useBallot();

  // Live election data (Firestore over the bundled snapshot); never empty, so no spinner needed.
  const { candidates: allCandidatesData, races, offices, version: dataVersion } = useElectionData();
  const { keys: voterKeys } = useVoterDistricts();
  const [onlyMyBallot, setOnlyMyBallot] = useState(true);
  const upcomingElections: Cycle[] = useMemo(() => getUpcomingCycles(), [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLoading = false;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOffice, setSelectedOffice] = useState(''); 
  const [selectedElectionDateForFilter, setSelectedElectionDateForFilter] = useState<string>(''); 
  const [selectedParty, setSelectedParty] = useState('');
  const [viewMode, setViewMode] = useState<string>(ViewMode.GRID); 

  // Default the election filter to the ballot's selected election (if upcoming),
  // otherwise the next upcoming election.
  useEffect(() => {
    const cycles = upcomingElections;
    if (ballotSelectedElectionDate && cycles.some(c => c.electionDate === ballotSelectedElectionDate)) {
      setSelectedElectionDateForFilter(ballotSelectedElectionDate);
    } else if (cycles.length > 0) {
      setSelectedElectionDateForFilter(cycles[0].electionDate);
    } else {
      setSelectedElectionDateForFilter(''); // "All Upcoming Elections" (empty)
    }
  }, [ballotSelectedElectionDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // If live data removes the election currently in the filter, fall back to the next upcoming one.
  useEffect(() => {
    if (selectedElectionDateForFilter && !upcomingElections.some(c => c.electionDate === selectedElectionDateForFilter)) {
      setSelectedElectionDateForFilter(upcomingElections[0]?.electionDate ?? '');
    }
  }, [upcomingElections]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCandidateBallotAction = (candidate: Candidate, electionDate: string) => {
    if (isCandidateSelected(candidate.id, electionDate)) {
      removeCandidateSelection(candidate.officeId, candidate.district, electionDate);
    } else {
      addCandidateSelection(candidate, electionDate);
    }
  };

  const isCandidateSelectedForCard = (candidateId: number, electionDate: string): boolean => {
    return isCandidateSelected(candidateId, electionDate);
  };

  // Candidates matching every filter except "only my ballot" (so we can say how many were hidden).
  const candidatesBeforeBallotFilter = useMemo(() => {
    return allCandidatesData.filter(candidate => {
      const candidateCycleIds = candidate.cycleIds || [];
      if (candidateCycleIds.length === 0) return false;

      const electionDateMatch = selectedElectionDateForFilter 
        ? candidateCycleIds.some((cid: number) => {
            const cyc = getCycleById(cid);
            return cyc && cyc.electionDate === selectedElectionDateForFilter;
          })
        : candidateCycleIds.some((cid: number) => {
            const cyc = getCycleById(cid);
            return cyc && upcomingElections.some(uc => uc.electionDate === cyc.electionDate);
          });
      
      if (!electionDateMatch) return false; 

      const officeMatch = selectedOffice ? candidate.officeId === parseInt(selectedOffice) : true;
      const partyMatch = selectedParty ? candidate.party === selectedParty : true;
      const searchTermMatch = searchTerm 
        ? `${candidate.firstName} ${candidate.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
          candidate.bio.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      
      return officeMatch && partyMatch && searchTermMatch;
    });
  }, [allCandidatesData, searchTerm, selectedOffice, selectedElectionDateForFilter, selectedParty, upcomingElections]);

  // When the voter has set their address, hide candidates whose race is definitely not on their ballot.
  // Races we can't match yet ('unknown') stay visible.
  const filteredCandidates = useMemo(() => {
    if (!voterKeys || !onlyMyBallot) return candidatesBeforeBallotFilter;
    return candidatesBeforeBallotFilter.filter((c) => candidateBallotStatus(c, races, offices, voterKeys) !== 'no');
  }, [candidatesBeforeBallotFilter, voterKeys, onlyMyBallot, races, offices]);
  const hiddenByBallot = candidatesBeforeBallotFilter.length - filteredCandidates.length;

  return (
    <div>
      <FindMyBallot />
      {voterKeys && (
        <label className="flex items-center gap-2 text-sm text-midnight-navy mb-3" data-testid="only-my-ballot">
          <input type="checkbox" className="h-4 w-4 accent-civic-blue" checked={onlyMyBallot} onChange={(e) => setOnlyMyBallot(e.target.checked)} />
          Only races on my ballot
          {onlyMyBallot && hiddenByBallot > 0 && (
            <span className="text-gray-500">(hiding {hiddenByBallot} candidate{hiddenByBallot === 1 ? '' : 's'} from other districts)</span>
          )}
        </label>
      )}
      <FilterControls
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedOffice={selectedOffice}
        setSelectedOffice={setSelectedOffice}
        selectedElectionDate={selectedElectionDateForFilter}
        setSelectedElectionDate={setSelectedElectionDateForFilter}
        selectedParty={selectedParty}
        setSelectedParty={setSelectedParty}
        viewMode={viewMode}
        setViewMode={setViewMode}
        electionEvents={upcomingElections} // Pass only upcomingElections to FilterControls
      />

      {isLoading ? (
        <CardGridSkeleton />
      ) : filteredCandidates.length > 0 ? (
        <div className={`grid gap-6 ${viewMode === ViewMode.GRID ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
          {filteredCandidates.map(candidate => (
            <CandidateCard 
              key={candidate.id} 
              candidate={candidate} 
              viewMode={viewMode}
              onToggleCandidateBallotStatus={handleCandidateBallotAction} 
              isCandidateSelected={isCandidateSelectedForCard}
              contextElectionDate={selectedElectionDateForFilter || undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <InformationCircleIcon className="h-16 w-16 text-slate-100/30 mx-auto mb-4" /> {/* Updated color to slate-100/30 for better visibility on dark backgrounds if any, or neutral on light. */}
          <p className="text-xl text-midnight-navy/70">No candidates match your current filters for upcoming elections.</p>
          <p className="text-midnight-navy/50">Try adjusting your search or filter criteria, or check back later for more upcoming election information.</p>
        </div>
      )}
    </div>
  );
};

export default HomePage;
