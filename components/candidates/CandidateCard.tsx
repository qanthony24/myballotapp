import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Candidate } from '../../types';
import { ViewMode } from '../../constants';
import { getCycleById, getFormattedElectionName, getFormattedCandidateOfficeName } from '../../services/dataService';
import { BuildingOffice2Icon, CalendarDaysIcon, ArrowRightIcon, CheckBadgeIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { useNotes } from '../../hooks/useNotes';
import { useSettings } from '../../hooks/useSettings';
import CandidatePhoto from './CandidatePhoto';
import PartyBadge from './PartyBadge';

interface CandidateCardProps {
  candidate: Candidate;
  viewMode: string; 
  onToggleCandidateBallotStatus: (candidate: Candidate, electionDate: string) => void;
  isCandidateSelected: (candidateId: number, electionDate: string) => boolean;
}

import { getPartyInfo } from '../../lib/parties';

const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, viewMode, onToggleCandidateBallotStatus, isCandidateSelected }) => {
  const cycle = (candidate.cycleIds || []).map((cid: number) => getCycleById(cid)).find(Boolean) ?? null;
  const electionDate = cycle?.electionDate; 
  const formattedElectionName = getFormattedElectionName(cycle);
  const formattedOfficeName = getFormattedCandidateOfficeName(candidate);
  const navigate = useNavigate();

  const { notes, addNote, getLatestNote } = useNotes(candidate.id);
  const [isQuickNoteVisible, setIsQuickNoteVisible] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const { uiDensity } = useSettings();

  const latestNote = getLatestNote();

  let displayName = `${candidate.firstName} ${candidate.lastName}`;
  if (candidate.officeId === 5 && candidate.runningMateName) { // Office ID 5 for US President
    displayName += ` / ${candidate.runningMateName}`;
  }
  const selectedForBallot = electionDate ? isCandidateSelected(candidate.id, electionDate) : false;

  const cardBaseClasses = "bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300 hover:shadow-xl border border-midnight-navy/10";
  const paddingClasses = uiDensity === 'compact' ? 'p-3 sm:p-4' : 'p-4 sm:p-6';
  
  const incumbentBadge = candidate.isIncumbent ? (
    <span className="ml-2 text-xs font-semibold text-white bg-sunlight-gold px-2 py-0.5 rounded-full inline-flex items-center">
      <CheckBadgeIcon className="h-3 w-3 mr-1" />
      Incumbent
    </span>
  ) : null;

  const handleBallotButtonClick = () => {
    if (electionDate) {
      onToggleCandidateBallotStatus(candidate, electionDate);
    } else {
      console.warn("Cannot add to ballot: election date unknown for candidate", candidate);
    }
  };

  const handleSaveQuickNote = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent card click-through
    addNote(quickNoteText);
    setQuickNoteText('');
    // setIsQuickNoteVisible(false); // Optionally close after saving
  };
  
  const handleManageAllNotesClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    navigate(`/candidate/${candidate.id}#notes-section`);
  };

  const noteIconToggle = (
    <button
      className={`note-btn ${notes.length > 0 ? 'has-note' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setIsQuickNoteVisible(!isQuickNoteVisible);
      }}
      aria-label={isQuickNoteVisible ? "Close notes area" : (notes.length > 0 ? "View/Add notes" : "Add note")}
      title={isQuickNoteVisible ? "Close notes area" : (notes.length > 0 ? "View/Add notes" : "Add note")}
    >
      🗒️
    </button>
  );

  const quickNoteSection = isQuickNoteVisible && (
    <div className="quick-note-area mt-3 p-3 bg-slate-100/50 border border-midnight-navy/10 rounded" onClick={e => e.stopPropagation()}>
      {latestNote && (
        <div className="quick-note-latest text-xs text-midnight-navy/80 mb-2 pb-2 border-b border-midnight-navy/10">
          <strong>Latest:</strong> {latestNote.text.substring(0, 70)}{latestNote.text.length > 70 ? '...' : ''}
          <span className="block text-midnight-navy/60 text-xxs">
            On: {new Date(latestNote.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
       {!latestNote && <p className="text-xs text-midnight-navy/60 mb-2">No notes yet.</p>}
      <textarea
        className="note-input w-full text-sm p-2 border border-midnight-navy/20 rounded focus:ring-sunlight-gold focus:border-sunlight-gold text-midnight-navy placeholder-midnight-navy/50 bg-white"
        value={quickNoteText}
        onChange={e => setQuickNoteText(e.target.value)}
        placeholder="Add a quick note..."
        rows={2}
      />
      <div className="flex justify-between items-center mt-2">
        <button
          onClick={handleSaveQuickNote}
          disabled={!quickNoteText.trim()}
          className="bg-civic-blue text-white text-xs py-1 px-2 rounded hover:bg-opacity-80 disabled:opacity-50"
        >
          Save Quick Note
        </button>
        <Link
          to={`/candidate/${candidate.id}#notes-section`}
          onClick={handleManageAllNotesClick}
          className="text-xs text-civic-blue hover:underline hover:text-sunlight-gold"
        >
          Manage All Notes
        </Link>
      </div>
    </div>
  );


  if (viewMode === ViewMode.GRID) {
    return (
      <div className={`${cardBaseClasses} flex flex-col`}>
        <Link to={`/candidate/${candidate.id}`} className="block hover:opacity-90 transition-opacity">
          <CandidatePhoto
            src={candidate.photoUrl}
            alt={displayName}
            focalPoint={candidate.photoFocalPoint}
            className="w-full h-48"
          />
        </Link>
        <div className={`${paddingClasses} flex flex-col flex-grow`}>
          <div className="flex justify-between items-start">
            <Link to={`/candidate/${candidate.id}`} className="hover:text-sunlight-gold transition-colors flex-grow mr-2">
              <h3 className="text-xl font-display font-semibold text-midnight-navy mb-1">
                {displayName} 
                {incumbentBadge}
              </h3>
            </Link>
            {noteIconToggle}
          </div>
          <p className="text-sm text-midnight-navy/80 mb-1 flex items-center"><BuildingOffice2Icon className="h-4 w-4 mr-2 text-midnight-navy/60" />{formattedOfficeName}</p>
          <p className="text-sm text-midnight-navy/80 mb-1 flex items-center"><CalendarDaysIcon className="h-4 w-4 mr-2 text-midnight-navy/60" />{formattedElectionName}</p>
          <div className="mb-3"><PartyBadge party={candidate.party} size="md" /></div>
          
          {quickNoteSection}

          <div className="mt-auto space-y-2 pt-3">
            <Link
              to={`/candidate/${candidate.id}`}
              className="w-full flex items-center justify-center bg-civic-blue hover:bg-opacity-80 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold"
            >
              View Profile <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Link>
            <button
              onClick={handleBallotButtonClick}
              disabled={!electionDate}
              className={`w-full font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold ${
                selectedForBallot 
                ? 'bg-sunlight-gold hover:bg-opacity-80 text-midnight-navy' 
                : 'bg-midnight-navy hover:bg-opacity-80 text-white'
              } ${!electionDate ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {selectedForBallot ? 'Remove from Ballot' : 'Add to Ballot'}
            </button>
            {electionDate && (
              <Link
                to={`/compare?electionDate=${electionDate}&officeId=${candidate.officeId}${candidate.district ? `&district=${encodeURIComponent(candidate.district)}` : ''}&candidate1Id=${candidate.id}`}
                className="w-full flex items-center justify-center border border-civic-blue text-civic-blue hover:bg-civic-blue/10 font-medium py-1.5 px-4 rounded-md transition text-xs"
              >
                <ScaleIcon className="h-3.5 w-3.5 mr-1.5" /> Compare in this race
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // LIST View
  const partyAbbreviation = getPartyInfo(candidate.party).abbreviation;
  return (
    <div className={`${cardBaseClasses} flex flex-col sm:flex-row items-start sm:items-center`}>
      {/* Image Link removed for LIST view */}
      <div className={`${paddingClasses} flex-grow w-full`}>
        <div className="flex justify-between items-start mb-1">
          <Link to={`/candidate/${candidate.id}`} className="hover:text-sunlight-gold transition-colors flex-grow mr-2">
            <h3 className="text-xl font-display font-semibold text-midnight-navy">
              {displayName} 
              {partyAbbreviation && <span className="text-midnight-navy/70 font-normal ml-1">({partyAbbreviation})</span>}
              {incumbentBadge}
            </h3>
          </Link>
          {noteIconToggle}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
          <p className="text-midnight-navy/80 flex items-center"><BuildingOffice2Icon className="h-4 w-4 mr-2 text-midnight-navy/60" />{formattedOfficeName}</p>
          <p className="text-midnight-navy/80 flex items-center"><CalendarDaysIcon className="h-4 w-4 mr-2 text-midnight-navy/60" />{formattedElectionName}</p>
        </div>

        {quickNoteSection}

        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0 mt-auto pt-3">
          <Link
            to={`/candidate/${candidate.id}`}
            className="flex-1 text-center bg-civic-blue hover:bg-opacity-80 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold"
          >
            View Profile
          </Link>
          <button
            onClick={handleBallotButtonClick}
            disabled={!electionDate}
            className={`flex-1 font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold ${
              selectedForBallot 
              ? 'bg-sunlight-gold hover:bg-opacity-80 text-midnight-navy' 
              : 'bg-midnight-navy hover:bg-opacity-80 text-white'
            } ${!electionDate ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedForBallot ? 'Remove from Ballot' : 'Add to Ballot'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CandidateCard;
