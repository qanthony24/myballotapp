import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Candidate, Cycle, NoteEntry } from '../types';
import { 
  getCandidateById, 
  getCycleById, 
  getSurveyQuestions, 
  getFormattedElectionName, 
  getFormattedCandidateOfficeName,
  getCandidatesByOfficeAndCycle
} from '../services/dataService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SkeletonCard from '../components/SkeletonCard';
import { ArrowLeftIcon, BuildingOffice2Icon, CalendarDaysIcon, GlobeAltIcon, EnvelopeIcon, PhoneIcon, UserGroupIcon, PlusCircleIcon, MinusCircleIcon, ScaleIcon, CheckBadgeIcon, PencilSquareIcon, ChatBubbleOvalLeftEllipsisIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useBallot } from '../hooks/useBallot';
import { useNotes } from '../hooks/useNotes';

// SVG Icon Components (remain unchanged)
const FacebookIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V15.89H8.322V12.88h2.116v-2.2c0-2.085 1.262-3.223 3.138-3.223.891 0 1.658.067 1.881.097v2.713h-1.602c-1.012 0-1.208.481-1.208 1.186v1.555H16.3l-.356 3.01H13.05v6.008C18.343 21.128 22 16.991 22 12z"/>
  </svg>
);
const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const InstagramIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.359 2.618 6.78 6.98 6.98 1.281.059 1.689.073 4.948.073s3.667-.014 4.947-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.947s-.014-3.667-.072-4.947c-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.948-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4s1.791-4 4-4c2.209 0 4 1.79 4 4s-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);
const YouTubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.183c-5.403 0-9.791 4.388-9.791 9.791s4.388 9.791 9.791 9.791 9.791-4.388 9.791-9.791S17.403 2.183 12 2.183zm0 17.582c-4.293 0-7.791-3.498-7.791-7.791s3.498-7.791 7.791-7.791 7.791 3.498 7.791 7.791-3.498 7.791-7.791 7.791zm-2.012-10.747L14.562 12l-4.574 2.965z"/>
  </svg>
);
const TikTokIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 0 .17.01.23.05.27.18.38.5.39.81v10.2c-.01.3-.15.58-.38.75-.23.17-.5.26-.78.25-.91-.01-1.83-.01-2.74-.01v4.51c0 1.03-.31 2.05-.93 2.95-.62.89-1.53 1.5-2.58 1.77-.04.01-.07.02-.11.02-.9.01-1.8-.01-2.7-.05-.23-.01-.45-.1-.65-.24-.23-.17-.37-.45-.38-.73v-1.8c.01-.3.15-.58.38-.75.23-.17.5-.26.78-.25.82.01 1.63.01 2.45.01V5.55c0-1.03.31-2.05.93-2.95.62-.89 1.53-1.5 2.58-1.77.04-.01.07.02.11-.02z"/>
  </svg>
);

const getPartyAbbreviation = (party: string): string => {
  if (!party) return '';
  const lowerParty = party.toLowerCase();
  if (lowerParty.startsWith('dem')) return 'D';
  if (lowerParty.startsWith('rep')) return 'R';
  if (lowerParty.startsWith('ind')) return 'I';
  if (lowerParty.startsWith('gre')) return 'G';
  if (lowerParty.startsWith('oth')) return 'O';
  return party.charAt(0).toUpperCase();
};

const CandidateProfilePage: React.FC = () => {
  const { id: candidateIdParam } = useParams<{ id: string }>(); // Corrected: Use 'id' from route param
  const navigate = useNavigate();
  const location = useLocation();
  const notesSectionRef = useRef<HTMLDivElement>(null);

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateCycle, setCandidateCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [opponents, setOpponents] = useState<Candidate[]>([]);

  // Use candidateIdParam directly in useNotes if it's stable or manage its change
  const { notes, addNote, updateNote, deleteNote } = useNotes(candidateIdParam || '0');
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const {
    addCandidateSelection,
    removeCandidateSelection,
    isCandidateSelected,
    isElectionPast
  } = useBallot();

  useEffect(() => {
    setLoading(true);
    if (candidateIdParam) {
      const id = parseInt(candidateIdParam);
      const fetchedCandidate = getCandidateById(id);
      setCandidate(fetchedCandidate);
      if (fetchedCandidate) {
        const cycle = getCycleById(fetchedCandidate.cycleId);
        setCandidateCycle(cycle);
        const otherCandidatesInRace = getCandidatesByOfficeAndCycle(
          fetchedCandidate.officeId,
          fetchedCandidate.cycleId,
          fetchedCandidate.district
        ).filter(op => op.id !== fetchedCandidate.id);
        setOpponents(otherCandidatesInRace);
      } else {
        setOpponents([]);
      }
    } else {
        setCandidate(null);
        setCandidateCycle(null);
        setOpponents([]);
    }
    setLoading(false);
  }, [candidateIdParam]); // Depend on the renamed param

  useEffect(() => {
    if (location.hash === '#notes-section' && notesSectionRef.current) {
      notesSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location, loading]); // Depend on loading to ensure ref is available

  if (loading) return <SkeletonCard />;
  if (!candidate || !candidateCycle) return <div className="text-center py-10 text-sunlight-gold">Candidate or election information not found.</div>;

  const surveyQuestions = getSurveyQuestions();
  
  const electionDate = candidateCycle.electionDate;
  const selectedForBallot = isCandidateSelected(candidate.id, electionDate);
  const electionIsPastForCandidate = isElectionPast(electionDate);
  const formattedElectionDisplayName = getFormattedElectionName(candidateCycle);
  const formattedOfficeName = getFormattedCandidateOfficeName(candidate);

  const handleBallotAction = () => {
    if (electionIsPastForCandidate) return; 
    if (selectedForBallot) {
      removeCandidateSelection(candidate.officeId, candidate.district, electionDate);
    } else {
      addCandidateSelection(candidate, electionDate);
    }
  };
  
  let displayName = `${candidate.firstName} ${candidate.lastName}`;
  let runningMateDisplay: string | null = null;
  if (candidate.officeId === 5 && candidate.runningMateName) { 
    displayName += ` / ${candidate.runningMateName}`;
    runningMateDisplay = candidate.runningMateName;
  }

  const incumbentBadge = candidate.isIncumbent ? (
    <span className="ml-3 text-sm font-semibold text-midnight-navy bg-sunlight-gold px-2.5 py-1 rounded-full inline-flex items-center align-middle">
      <CheckBadgeIcon className="h-4 w-4 mr-1.5" />
      Incumbent
    </span>
  ) : null;

  const socialLinksExist = candidate.socialLinks && Object.values(candidate.socialLinks).some(link => link);

  let compareLink = `/compare?electionDate=${electionDate}&officeId=${candidate.officeId}`;
  if (candidate.district) {
    compareLink += `&district=${encodeURIComponent(candidate.district)}`;
  }
  compareLink += `&candidate1Id=${candidate.id}`;

  const handleAddNewNote = () => {
    addNote(newNoteText);
    setNewNoteText('');
  };

  const handleEditNote = (note: NoteEntry) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const handleSaveEditedNote = () => {
    if (editingNoteId) {
      updateNote(editingNoteId, editingNoteText);
      setEditingNoteId(null);
      setEditingNoteText('');
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (window.confirm("Are you sure you want to delete this note? This action cannot be undone.")) {
      deleteNote(noteId);
    }
  };

  const formatNoteDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 max-w-4xl mx-auto border border-midnight-navy/10">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center text-civic-blue hover:text-sunlight-gold transition-colors font-medium"
      >
        <ArrowLeftIcon className="h-5 w-5 mr-2" />
        Back
      </button>

      {/* Main Candidate Info */}
      <div className="flex flex-col md:flex-row items-center md:items-start mb-8">
        <img
          src={candidate.photoUrl || `https://picsum.photos/seed/${candidate.slug}/200/200`}
          alt={displayName}
          className="w-40 h-40 rounded-full object-cover border-4 border-civic-blue shadow-md mb-4 md:mb-0 md:mr-8"
          onError={(e) => (e.currentTarget.src = 'https://picsum.photos/200/200?grayscale')}
        />
        <div className="text-center md:text-left flex-grow">
          <h1 className="text-4xl font-display font-bold text-midnight-navy">
            {candidate.firstName} {candidate.lastName}
            {incumbentBadge}
          </h1>
          {runningMateDisplay && (
            <p className="text-2xl text-midnight-navy/80 mt-1 font-display">
              Running Mate: {runningMateDisplay}
            </p>
          )}
          <p className="text-xl text-midnight-navy/80 mt-1">{candidate.party}</p>
          <p className="text-lg text-midnight-navy/70 mt-2 flex items-center justify-center md:justify-start">
            <BuildingOffice2Icon className="h-5 w-5 mr-2 text-midnight-navy/60" /> {formattedOfficeName}
          </p>
          <p className="text-lg text-midnight-navy/70 mt-1 flex items-center justify-center md:justify-start">
            <CalendarDaysIcon className="h-5 w-5 mr-2 text-midnight-navy/60" /> {formattedElectionDisplayName}
          </p>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={handleBallotAction}
          disabled={electionIsPastForCandidate}
          className={`w-full flex items-center justify-center font-semibold py-3 px-4 rounded-md transition duration-150 ease-in-out text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold ${
            electionIsPastForCandidate
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : selectedForBallot 
              ? 'bg-sunlight-gold hover:bg-opacity-80 text-midnight-navy' 
              : 'bg-civic-blue hover:bg-opacity-80 text-white'
          }`}
        >
          {selectedForBallot ? <MinusCircleIcon className="h-6 w-6 mr-2" /> : <PlusCircleIcon className="h-6 w-6 mr-2" />}
          {electionIsPastForCandidate ? 'Election Past' : (selectedForBallot ? 'Remove from My Ballot' : 'Add to My Ballot')}
        </button>
        <Link
          to={compareLink}
          className="w-full flex items-center justify-center bg-midnight-navy hover:bg-opacity-80 text-white font-semibold py-3 px-4 rounded-md transition duration-150 ease-in-out text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold"
        >
         <ScaleIcon className="h-6 w-6 mr-2" /> Compare Candidates
        </Link>
      </div>

      {/* My Private Notes Section */}
      <div id="notes-section" ref={notesSectionRef} className="notes-section">
        <h2 className="text-2xl font-display font-semibold text-midnight-navy mb-4 flex items-center">
            <ChatBubbleOvalLeftEllipsisIcon className="h-7 w-7 mr-3 text-civic-blue"/> My Private Notes
        </h2>
        
        {/* Add New Note Form */}
        <div className="mb-6 p-4 bg-slate-100 border border-midnight-navy/10 rounded-lg">
          <h3 className="text-lg font-display font-semibold text-midnight-navy mb-2">Add a New Note</h3>
          <textarea
            className="note-input w-full text-midnight-navy bg-white placeholder-midnight-navy/50 border-midnight-navy/20 focus:ring-sunlight-gold focus:border-sunlight-gold"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Type your note here..."
            rows={4}
          />
          <button
            onClick={handleAddNewNote}
            disabled={!newNoteText.trim()}
            className="mt-3 bg-civic-blue text-white font-semibold py-2 px-4 rounded-md hover:bg-opacity-80 transition duration-150 ease-in-out disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sunlight-gold"
          >
            Save Note
          </button>
        </div>

        {/* Existing Notes List */}
        {notes.length > 0 && (
          <div>
            <h3 className="text-lg font-display font-semibold text-midnight-navy mb-3">Existing Notes ({notes.length})</h3>
            <div className="space-y-4">
              {notes.map(note => (
                <div key={note.id} className="note-entry bg-white p-4 rounded-md shadow border border-midnight-navy/10">
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        className="note-input w-full mb-2 text-midnight-navy bg-white placeholder-midnight-navy/50 border-midnight-navy/20 focus:ring-sunlight-gold focus:border-sunlight-gold"
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        rows={3}
                      />
                      <div className="flex items-center">
                        <button onClick={handleSaveEditedNote} className="bg-green-500 text-white text-sm py-1 px-3 rounded hover:bg-green-600 mr-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400">Save Changes</button>
                        <button onClick={() => setEditingNoteId(null)} className="text-midnight-navy/80 text-sm py-1 px-3 rounded hover:bg-slate-200 border border-midnight-navy/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="note-date text-xs text-midnight-navy/60">{formatNoteDate(note.date)}</p>
                      <p className="note-text text-midnight-navy whitespace-pre-line py-1">{note.text}</p>
                      <div className="mt-2 text-right note-actions space-x-2">
                        <button onClick={() => handleEditNote(note)} className="edit-btn text-civic-blue hover:text-sunlight-gold text-sm">
                          <PencilSquareIcon className="h-4 w-4 inline mr-1"/>Edit
                        </button>
                        <button onClick={() => handleDeleteNote(note.id)} className="delete-btn text-red-600 hover:text-red-800 text-sm">
                          <TrashIcon className="h-4 w-4 inline mr-1"/>Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {notes.length === 0 && !newNoteText && (
            <p className="text-midnight-navy/70 italic mt-4">No notes saved for this candidate yet.</p>
        )}
      </div>
      
      {/* Biography */}
      <div className="mt-8 pt-6 border-t border-midnight-navy/10">
        <h2 className="text-2xl font-display font-semibold text-midnight-navy mb-3">Biography</h2>
        <p className="text-midnight-navy font-sans whitespace-pre-line leading-relaxed">{candidate.bio || 'No biography provided.'}</p>
      </div>

      {/* Survey Responses */}
      <div className="mt-8 pt-6 border-t border-midnight-navy/10">
        <h2 className="text-2xl font-display font-semibold text-midnight-navy mb-4">Survey Responses</h2>
        {surveyQuestions.length > 0 ? (
          <div className="space-y-6">
            {surveyQuestions.map((sq) => (
              <div key={sq.key} className="bg-slate-100 p-4 rounded-md shadow-sm border border-midnight-navy/10">
                <h3 className="text-lg font-display font-semibold text-midnight-navy">{sq.question}</h3>
                <p className="text-midnight-navy/90 mt-1 whitespace-pre-line font-sans">
                  {candidate.surveyResponses?.[sq.key] || <span className="italic">No response provided.</span>}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-midnight-navy/70 italic font-sans">No survey questions available for this election.</p>
        )}
      </div>
      
      {/* Contact Information */}
      <div className="mt-8 pt-6 border-t border-midnight-navy/10">
        <h2 className="text-2xl font-display font-semibold text-midnight-navy mb-3">Contact Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-midnight-navy/80 mb-4 font-sans">
          {candidate.website && (
            <p className="flex items-center"><GlobeAltIcon className="h-5 w-5 mr-2 text-civic-blue" />
              <a href={candidate.website} target="_blank" rel="noopener noreferrer" className="text-civic-blue hover:text-sunlight-gold hover:underline break-all">{candidate.website}</a>
            </p>
          )}
          {candidate.email && (
            <p className="flex items-center"><EnvelopeIcon className="h-5 w-5 mr-2 text-civic-blue" />
              <a href={`mailto:${candidate.email}`} className="text-civic-blue hover:text-sunlight-gold hover:underline break-all">{candidate.email}</a>
            </p>
          )}
          {candidate.phone && (
            <p className="flex items-center"><PhoneIcon className="h-5 w-5 mr-2 text-civic-blue" />{candidate.phone}</p>
          )}
        </div>
        
        {socialLinksExist && (
          <div className="mt-4">
            <h3 className="text-lg font-display font-semibold text-midnight-navy mb-2">Social Media</h3>
            <div className="flex space-x-4">
              {candidate.socialLinks?.facebook && (
                <a href={candidate.socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label={`${candidate.firstName} ${candidate.lastName} Facebook`} className="text-civic-blue hover:text-sunlight-gold transition-colors">
                  <FacebookIcon className="w-6 h-6" />
                </a>
              )}
              {candidate.socialLinks?.twitter && ( 
                <a href={candidate.socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label={`${candidate.firstName} ${candidate.lastName} X Profile`} className="text-civic-blue hover:text-sunlight-gold transition-colors">
                  <XIcon className="w-6 h-6" />
                </a>
              )}
              {candidate.socialLinks?.instagram && (
                <a href={candidate.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${candidate.firstName} ${candidate.lastName} Instagram`} className="text-civic-blue hover:text-sunlight-gold transition-colors">
                  <InstagramIcon className="w-6 h-6" />
                </a>
              )}
              {candidate.socialLinks?.youtube && (
                <a href={candidate.socialLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label={`${candidate.firstName} ${candidate.lastName} YouTube`} className="text-civic-blue hover:text-sunlight-gold transition-colors">
                  <YouTubeIcon className="w-6 h-6" />
                </a>
              )}
              {candidate.socialLinks?.tiktok && (
                <a href={candidate.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" aria-label={`${candidate.firstName} ${candidate.lastName} TikTok`} className="text-civic-blue hover:text-sunlight-gold transition-colors">
                  <TikTokIcon className="w-6 h-6" />
                </a>
              )}
            </div>
          </div>
        )}
         {candidate.mailingAddress && (
            <div className="mt-6">
                 <h3 className="text-lg font-display font-semibold text-midnight-navy mb-1">Mailing Address</h3>
                 <p className="text-midnight-navy/90 whitespace-pre-line font-sans">{candidate.mailingAddress}</p>
            </div>
        )}
      </div>

      {/* Other Candidates in this Race Section */}
      <div className="mt-10 pt-6 border-t border-midnight-navy/10">
        <h2 className="text-2xl font-display font-semibold text-midnight-navy mb-4 flex items-center">
          <UserGroupIcon className="h-7 w-7 mr-3 text-civic-blue" />
          Other Candidates in this Race
        </h2>
        {opponents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {opponents.map((op, idx) => {
              let opponentDisplayName = `${op.firstName} ${op.lastName}`;
              if (op.officeId === 5 && op.runningMateName) {
                opponentDisplayName += ` / ${op.runningMateName}`;
              }
              return (
                <Link
                  key={op.id}
                  to={`/candidate/${op.id}`}
                  className={`block p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-midnight-navy/10 hover:border-sunlight-gold focus:outline-none focus:ring-2 focus:ring-sunlight-gold ${idx % 2 === 1 ? 'bg-slate-50' : 'bg-slate-100'}`}
                >
                  <div className="flex items-center">
                    <img 
                      src={op.photoUrl || `https://picsum.photos/seed/${op.slug}/60/60`} 
                      alt={opponentDisplayName} 
                      className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-slate-300"
                      onError={(e) => (e.currentTarget.src = 'https://picsum.photos/60/60?grayscale')}
                    />
                    <div>
                      <p className="font-semibold text-midnight-navy leading-tight font-display">
                        {opponentDisplayName}
                        <span className="text-sm text-midnight-navy/70 font-sans font-normal ml-1">({getPartyAbbreviation(op.party)})</span>
                      </p>
                      {op.isIncumbent && (
                        <span className="mt-0.5 text-xs font-semibold text-midnight-navy bg-sunlight-gold px-1.5 py-0.5 rounded-full inline-flex items-center">
                          <CheckBadgeIcon className="h-3 w-3 mr-1" />
                          Incumbent
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          !electionIsPastForCandidate && (
            <p className="text-midnight-navy/70 italic font-sans">Currently running unopposed for this seat in this election.</p>
          )
        )}
        {opponents.length === 0 && electionIsPastForCandidate && (
           <p className="text-midnight-navy/70 italic font-sans">No other candidates were listed for this race in this past election.</p>
        )}
      </div>
    </div>
  );
};

export default CandidateProfilePage;
