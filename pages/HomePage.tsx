import React, { useState, useMemo, useEffect } from 'react';
import CandidateCard from '../components/candidates/CandidateCard';
import SkeletonCard from '../components/SkeletonCard';
import FilterControls from '../components/candidates/FilterControls';
import { Candidate, Cycle } from '../types'; // Removed CandidateSelection
import { ViewMode } from '../constants'; // Changed import
import { 
  getAllCandidates, 
  getCycleById, 
  getUpcomingCycles, 
} from '../services/dataService'; // Removed getFormattedElectionNameFromDate, isElectionPast
import { useBallot } from '../hooks/useBallot';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

const HomePage: React.FC = () => {
  const { 
    addCandidateSelection, 
    removeCandidateSelection,
    isCandidateSelected,   
    selectedElectionDate: ballotSelectedElectionDate 
  } = useBallot();

  const [allCandidatesData, setAllCandidatesData] = useState<Candidate[]>([]);
  const [upcomingElections, setUpcomingElections] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOffice, setSelectedOffice] = useState(''); 
  const [selectedElectionDateForFilter, setSelectedElectionDateForFilter] = useState<string>(''); 
  const [selectedParty, setSelectedParty] = useState('');
  const [viewMode, setViewMode] = useState<string>(ViewMode.GRID); 

  useEffect(() => {
    setLoading(true);
    setAllCandidatesData(getAllCandidates());
    const cycles = getUpcomingCycles();
    setUpcomingElections(cycles);

    // Initialize selectedElectionDateForFilter
    // Check if ballotSelectedElectionDate is one of the upcoming cycles
    if (ballotSelectedElectionDate && cycles.some(c => c.electionDate === ballotSelectedElectionDate)) {
      setSelectedElectionDateForFilter(ballotSelectedElectionDate);
    } else if (cycles.length > 0) {
      // Otherwise, if there are upcoming elections, default to the first one
      setSelectedElectionDateForFilter(cycles[0].electionDate);
    } else {
      // No upcoming elections, and ballot context is past or null
      setSelectedElectionDateForFilter(''); // This will mean "All Upcoming Elections" (which will be empty)
    }
    setLoading(false);
  }, [ballotSelectedElectionDate]); // Re-run when ballot context's selected date changes

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

  const filteredCandidates = useMemo(() => {
    return allCandidatesData.filter(candidate => {
      const candidateCycle = getCycleById(candidate.cycleId);
      if (!candidateCycle) return false; 

      const electionDateMatch = selectedElectionDateForFilter 
        ? candidateCycle.electionDate === selectedElectionDateForFilter // Filter by specific selected upcoming election
        : upcomingElections.some(uc => uc.electionDate === candidateCycle.electionDate); // Or, if "All Upcoming" is chosen, candidate is in ANY upcoming election
      
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

  if (loading) {
    return (
      <div className={`grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div>
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

      {filteredCandidates.length > 0 ? (
        <div className={`grid gap-6 ${viewMode === ViewMode.GRID ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
          {filteredCandidates.map((candidate, index) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              viewMode={viewMode}
              onToggleCandidateBallotStatus={handleCandidateBallotAction}
              isCandidateSelected={isCandidateSelectedForCard}
              className={viewMode === ViewMode.LIST && index % 2 === 1 ? 'bg-slate-50' : ''}
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
