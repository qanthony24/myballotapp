import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Candidate, Office, Cycle, SurveyQuestion, NoteEntry } from '../types'; // Added NoteEntry
import { 
  getCandidateById, 
  getOfficeById, 
  getCycleById, 
  getSurveyQuestions, 
  getCandidatesByOfficeAndCycle,
  getAllOffices, 
  getAllCycles,
  getFormattedElectionName,
  getFormattedCandidateOfficeName,
  getDistrictsForOfficeAndCycle,
  getCycleByElectionDate
} from '../services/dataService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useBallot } from '../hooks/useBallot';
import { ArrowLeftIcon, UsersIcon, CheckBadgeIcon, PlusCircleIcon, MinusCircleIcon, InformationCircleIcon, ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/react/24/outline';
import { useNotes } from '../hooks/useNotes';

// NoteRow component for cleaner table structure
const NoteRow: React.FC<{ candidates: (Candidate | null)[] }> = ({ candidates }) => {
  return (
    <tr>
      <td className="py-4 px-3 text-sm font-medium text-midnight-navy sticky left-0 bg-slate-100 z-10 border-r border-midnight-navy/20">
        <div className="flex items-center">
            <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 mr-2 text-civic-blue" /> My Private Notes
        </div>
      </td>
      {candidates.map((candidate, index) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { notes: candidateNotes, getLatestNote } = candidate ? useNotes(candidate.id) : { notes: [], getLatestNote: () => null };
        const latestNote = getLatestNote();
        
        return (
          <td key={candidate ? `note-${candidate.id}` : `empty-note-${index}`} className={`py-4 px-4 text-sm text-midnight-navy/90 whitespace-pre-line compare-notes-cell ${index === 0 && candidates.length > 1 ? 'border-r border-midnight-navy/20' : ''}`}>
            {candidate ? (
              latestNote ? (
                <>
                  <p className="font-semibold text-midnight-navy">{latestNote.text}</p>
                  <p className="text-xs text-midnight-navy/60 mt-1">
                    ({new Date(latestNote.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                  </p>
                  {candidateNotes.length > 1 && (
                    <p className="text-xs text-midnight-navy/50 mt-1">(+ {candidateNotes.length - 1} more)</p>
                  )}
                </>
              ) : (
                <em className="text-midnight-navy/70">(no note)</em>
              )
            ) : ''}
          </td>
        );
      })}
    </tr>
  );
};


const CompareCandidatesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [allOfficesData, setAllOfficesData] = useState<Office[]>([]);
  const [allCyclesData, setAllCyclesData] = useState<Cycle[]>([]); 
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  const [selectedElectionDateParam, setSelectedElectionDateParam] = useState<string>(searchParams.get('electionDate') || '');
  const [selectedOfficeIdParam, setSelectedOfficeIdParam] = useState<string>(searchParams.get('officeId') || '');
  const [selectedDistrictParam, setSelectedDistrictParam] = useState<string>(searchParams.get('district') || '');
  
  const [candidate1Id, setCandidate1Id] = useState<string>(searchParams.get('candidate1Id') || '');
  const [candidate2Id, setCandidate2Id] = useState<string>(searchParams.get('candidate2Id') || '');
  
  const [candidate1, setCandidate1] = useState<Candidate | null>(null);
  const [candidate2, setCandidate2] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);

  const { 
    addCandidateSelection, 
    removeCandidateSelection, 
    isCandidateSelected, 
    isElectionPast 
  } = useBallot();

  const surveyQuestions = getSurveyQuestions();
  
  const currentOffice: Office | null = useMemo(() => selectedOfficeIdParam ? getOfficeById(parseInt(selectedOfficeIdParam)) : null, [selectedOfficeIdParam]);
  const currentCycle: Cycle | null = useMemo(() => selectedElectionDateParam ? getCycleByElectionDate(selectedElectionDateParam) : null, [selectedElectionDateParam]);
  const currentElectionIsPast: boolean = useMemo(() => selectedElectionDateParam ? isElectionPast(selectedElectionDateParam) : false, [selectedElectionDateParam, isElectionPast]);

  useEffect(() => {
    setAllOfficesData(getAllOffices());
    setAllCyclesData(getAllCycles()); 
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedElectionDateParam) params.electionDate = selectedElectionDateParam; 
    if (selectedOfficeIdParam) params.officeId = selectedOfficeIdParam;
    if (selectedDistrictParam) params.district = selectedDistrictParam;
    if (candidate1Id) params.candidate1Id = candidate1Id;
    if (candidate2Id) params.candidate2Id = candidate2Id;
    setSearchParams(params, { replace: true });
  }, [selectedElectionDateParam, selectedOfficeIdParam, selectedDistrictParam, candidate1Id, candidate2Id, setSearchParams]);

  useEffect(() => {
    setLoading(true);
    setCandidate1(candidate1Id ? getCandidateById(parseInt(candidate1Id)) : null);
    setLoading(false);
  }, [candidate1Id]);

  useEffect(() => {
    setLoading(true);
    setCandidate2(candidate2Id ? getCandidateById(parseInt(candidate2Id)) : null);
    setLoading(false);
  }, [candidate2Id]);
  
  useEffect(() => {
    if (selectedOfficeIdParam && currentCycle) {
      const districts = getDistrictsForOfficeAndCycle(parseInt(selectedOfficeIdParam), currentCycle.id);
      setAvailableDistricts(districts);
      if (districts.length > 0 && !districts.includes(selectedDistrictParam)) {
        setSelectedDistrictParam(''); 
      } else if (districts.length === 0) {
        setSelectedDistrictParam(''); 
      }
    } else {
      setAvailableDistricts([]);
      setSelectedDistrictParam('');
    }
  }, [selectedOfficeIdParam, currentCycle, selectedDistrictParam]);


  const availableCandidatesForSelection = useMemo(() => {
    if (currentOffice && currentCycle) {
      if (availableDistricts.length > 0 && !selectedDistrictParam) {
        return []; 
      }
      return getCandidatesByOfficeAndCycle(currentOffice.id, currentCycle.id, selectedDistrictParam || undefined);
    }
    return [];
  }, [currentOffice, currentCycle, selectedDistrictParam, availableDistricts]);

  useEffect(() => {
    if (candidate1Id && !candidate2Id && availableCandidatesForSelection.length === 2) {
      const candidate1Object = getCandidateById(parseInt(candidate1Id));
      if (candidate1Object) {
        const opponent = availableCandidatesForSelection.find(
          (c) => c.id !== candidate1Object.id
        );
        if (opponent) {
          setCandidate2Id(opponent.id.toString());
        }
      }
    }
  }, [candidate1Id, candidate2Id, availableCandidatesForSelection]);


  const handleElectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedElectionDateParam(e.target.value);
    setSelectedOfficeIdParam(''); 
    setSelectedDistrictParam('');
    setCandidate1Id('');
    setCandidate2Id('');
  };

  const handleOfficeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOfficeIdParam(e.target.value);
    setSelectedDistrictParam(''); 
    setCandidate1Id('');
    setCandidate2Id('');
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDistrictParam(e.target.value);
    setCandidate1Id('');
    setCandidate2Id('');
  };
  
  const renderIncumbentBadge = (candidate: Candidate | null, large: boolean = false) => {
    if (candidate?.isIncumbent) {
      return (
        <span className={`ml-2 text-xs font-semibold text-midnight-navy bg-sunlight-gold px-2 py-0.5 rounded-full inline-flex items-center ${large ? 'text-sm px-2.5 py-1' : ''}`}>
          <CheckBadgeIcon className={`h-3 w-3 mr-1 ${large ? 'h-4 w-4' : ''}`} />
          Incumbent
        </span>
      );
    }
    return null;
  };

  const handleCandidateBallotAction = (candidate: Candidate | null) => {
    if (!candidate || !selectedElectionDateParam || currentElectionIsPast) return;
    
    if (isCandidateSelected(candidate.id, selectedElectionDateParam)) {
      removeCandidateSelection(candidate.officeId, candidate.district, selectedElectionDateParam);
    } else {
      addCandidateSelection(candidate, selectedElectionDateParam);
    }
  };

  const renderBallotButton = (candidate: Candidate | null) => {
    if (!candidate || !selectedElectionDateParam) {
      return null;
    }
    const selectedForBallot = isCandidateSelected(candidate.id, selectedElectionDateParam);

    return (
      <button
        onClick={() => handleCandidateBallotAction(candidate)}
        disabled={currentElectionIsPast}
        className={`mt-2 w-full sm:w-auto flex items-center justify-center font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold ${ 
          currentElectionIsPast
          ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
          : selectedForBallot 
            ? 'bg-sunlight-gold hover:bg-opacity-80 text-midnight-navy' 
            : 'bg-civic-blue hover:bg-opacity-80 text-white'
        }`}
      >
        {selectedForBallot ? <MinusCircleIcon className="h-5 w-5 mr-2" /> : <PlusCircleIcon className="h-5 w-5 mr-2" />}
        {currentElectionIsPast ? 'Election Past' :(selectedForBallot ? 'Remove from Ballot' : 'Add to Ballot')}
      </button>
    );
  }

  const showDistrictSelector = selectedElectionDateParam && selectedOfficeIdParam && availableDistricts.length > 0;
  const showCandidateSelectors = selectedElectionDateParam && selectedOfficeIdParam && (availableDistricts.length === 0 || (availableDistricts.length > 0 && selectedDistrictParam));
  const showComparisonTable = candidate1 && candidate2 && showCandidateSelectors;
  const formattedElectionDisplayName = getFormattedElectionName(currentCycle);
  const formattedComparisonOfficeName = currentOffice 
    ? (selectedDistrictParam ? `${currentOffice.name}, ${selectedDistrictParam}` : currentOffice.name) 
    : "Office";

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center text-civic-blue hover:text-sunlight-gold transition-colors font-medium"
      >
        <ArrowLeftIcon className="h-5 w-5 mr-2" />
        Back
      </button>

      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/20">
        <h1 className="text-3xl font-bold text-midnight-navy mb-8 text-center">Compare Candidates</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <label htmlFor="election-select" className="block text-sm font-medium text-midnight-navy mb-1">
              Select Election
            </label>
            <select
              id="election-select"
              value={selectedElectionDateParam}
              onChange={handleElectionChange}
              className="mt-1 block w-full py-2 px-3 border border-midnight-navy/30 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold sm:text-sm text-midnight-navy"
            >
              <option value="">-- Select Election --</option>
              {allCyclesData.map(cycle => (
                <option key={cycle.electionDate} value={cycle.electionDate}>
                  {getFormattedElectionName(cycle)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="office-select" className="block text-sm font-medium text-midnight-navy mb-1">
              Select Office
            </label>
            <select
              id="office-select"
              value={selectedOfficeIdParam}
              onChange={handleOfficeChange}
              disabled={!selectedElectionDateParam}
              className="mt-1 block w-full py-2 px-3 border border-midnight-navy/30 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold sm:text-sm text-midnight-navy disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">-- Select Office --</option>
              {allOfficesData
                .filter(office => {
                    if (!currentCycle) return false;
                    return getCandidatesByOfficeAndCycle(office.id, currentCycle.id, undefined).length > 0;
                })
                .map(office => (
                    <option key={office.id} value={office.id.toString()}>{office.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="district-select" className="block text-sm font-medium text-midnight-navy mb-1">
              Select District/Seat
            </label>
            <select
              id="district-select"
              value={selectedDistrictParam}
              onChange={handleDistrictChange}
              disabled={!showDistrictSelector}
              className="mt-1 block w-full py-2 px-3 border border-midnight-navy/30 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold sm:text-sm text-midnight-navy disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">-- {availableDistricts.length > 0 ? "Select District" : "N/A for this office"} --</option>
              {availableDistricts.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>
        </div>

        {showCandidateSelectors && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div>
              <label htmlFor="candidate1-select" className="block text-sm font-medium text-midnight-navy mb-1">
                Select Candidate 1
              </label>
              <select
                id="candidate1-select"
                value={candidate1Id}
                onChange={(e) => setCandidate1Id(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-midnight-navy/30 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold sm:text-sm text-midnight-navy"
              >
                <option value="">-- Select Candidate --</option>
                {availableCandidatesForSelection
                    .filter(c => c.id.toString() !== candidate2Id) 
                    .map(c => {
                        let displayName = `${c.firstName} ${c.lastName}`;
                        if (c.officeId === 5 && c.runningMateName) {
                            displayName += ` / ${c.runningMateName}`;
                        }
                        return <option key={c.id} value={c.id.toString()}>{displayName} ({c.party})</option>;
                    })}
              </select>
            </div>
            <div>
              <label htmlFor="candidate2-select" className="block text-sm font-medium text-midnight-navy mb-1">
                Select Candidate 2
              </label>
              <select
                id="candidate2-select"
                value={candidate2Id}
                onChange={(e) => setCandidate2Id(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-midnight-navy/30 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold sm:text-sm text-midnight-navy"
              >
                <option value="">-- Select Candidate --</option>
                {availableCandidatesForSelection
                    .filter(c => c.id.toString() !== candidate1Id) 
                    .map(c => {
                        let displayName = `${c.firstName} ${c.lastName}`;
                        if (c.officeId === 5 && c.runningMateName) {
                            displayName += ` / ${c.runningMateName}`;
                        }
                        return <option key={c.id} value={c.id.toString()}>{displayName} ({c.party})</option>;
                    })}
              </select>
            </div>
          </div>
        )}

        {loading && <LoadingSpinner />}

        {!selectedElectionDateParam || !selectedOfficeIdParam && (
           <div className="text-center py-10">
            <UsersIcon className="h-16 w-16 text-midnight-navy/30 mx-auto mb-4" />
            <p className="text-xl text-midnight-navy/70">Please select an election and an office to compare candidates.</p>
          </div>
        )}

        {selectedElectionDateParam && selectedOfficeIdParam && availableDistricts.length > 0 && !selectedDistrictParam && (
            <div className="text-center py-10">
                <InformationCircleIcon className="h-16 w-16 text-midnight-navy/30 mx-auto mb-4" />
                <p className="text-xl text-midnight-navy/70">Please select a district for {currentOffice?.name} to compare candidates.</p>
            </div>
        )}
        
        {showCandidateSelectors && (!candidate1 || !candidate2) && (
          <div className="text-center py-10">
            <InformationCircleIcon className="h-16 w-16 text-midnight-navy/30 mx-auto mb-4" />
            <p className="text-xl text-midnight-navy/70">Select two candidates to see a side-by-side comparison.</p>
          </div>
        )}


        {showComparisonTable && (
          <div className="overflow-x-auto">
            <h2 className="text-2xl font-semibold text-midnight-navy mb-2">
              Comparison: {formattedComparisonOfficeName} - {formattedElectionDisplayName}
            </h2>
            {currentElectionIsPast && <p className="mb-4 text-sm text-midnight-navy/70 italic">Note: This is an archived comparison for a past election. Ballot actions are disabled.</p>}
            <table className="min-w-full divide-y divide-midnight-navy/20 border border-midnight-navy/20">
              <thead className="bg-slate-100">
                <tr>
                  <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-midnight-navy w-1/4 sticky left-0 bg-slate-100 z-10 border-r border-midnight-navy/20">
                    Feature
                  </th>
                  {[candidate1, candidate2].map((candidate, index) => {
                    if (!candidate) return <th key={`empty-th-${index}`} className={`py-3.5 px-4 ${index === 0 ? 'border-r border-midnight-navy/20' : ''}`}></th>; 
                    let headerDisplayName = `${candidate.firstName} ${candidate.lastName}`;
                    if (candidate.officeId === 5 && candidate.runningMateName) {
                      headerDisplayName += ` / ${candidate.runningMateName}`;
                    }
                    return (
                      <th key={candidate.id} scope="col" className={`py-3.5 px-4 text-left text-sm font-semibold text-midnight-navy ${index === 0 ? 'border-r border-midnight-navy/20' : ''}`}>
                        <Link to={`/candidate/${candidate.id}`} className="hover:text-sunlight-gold group">
                            <img src={candidate.photoUrl || `https://picsum.photos/seed/${candidate.slug}/100/100`} alt={headerDisplayName} className="h-16 w-16 rounded-full object-cover mx-auto mb-2 border-2 border-civic-blue group-hover:border-sunlight-gold transition-colors"/>
                            {headerDisplayName} {renderIncumbentBadge(candidate)}
                            <p className="text-xs text-midnight-navy/80 font-normal">{candidate.party}</p>
                        </Link>
                         {renderBallotButton(candidate)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-navy/20 bg-white">
                {surveyQuestions.map(sq => (
                  <tr key={sq.key}>
                    <td className="py-4 px-3 text-sm font-medium text-midnight-navy sticky left-0 bg-white z-10 border-r border-midnight-navy/20">{sq.question}</td>
                    {[candidate1, candidate2].map((candidate, index) => (
                      <td key={candidate ? candidate.id : `empty-${index}`} className={`py-4 px-4 text-sm text-midnight-navy/90 whitespace-pre-line ${index === 0 ? 'border-r border-midnight-navy/20' : ''}`}>
                        {candidate?.surveyResponses?.[sq.key] || <span className="italic text-midnight-navy/60">No response</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                <NoteRow candidates={[candidate1, candidate2]} />
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareCandidatesPage;
