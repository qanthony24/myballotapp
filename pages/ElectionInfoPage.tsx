import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Cycle } from '../types';
import { CalendarDaysIcon, MapPinIcon, LifebuoyIcon, PencilSquareIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { getAllCycles, getFormattedElectionName } from '../services/dataService';
import { useAllNotesSummary } from '../hooks/useAllNotesSummary';
import { useSettings } from '../hooks/useSettings';

const ElectionInfoPage: React.FC = () => {
  const allElectionEvents = useMemo(() => getAllCycles(), []);
  const allNotesSummary = useAllNotesSummary();
  const { uiDensity, setUiDensity } = useSettings();

  const relevantElection: Cycle | null = allElectionEvents.length > 0 ? allElectionEvents[0] : null;

  const formatNoteDateForDisplay = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10">
        <h1 className="text-3xl font-display font-bold text-midnight-navy mb-8 text-center">Election Information & Q&A</h1>
        <div className="mb-8 text-right">
          <label htmlFor="ui-density" className="text-sm mr-2">UI Density:</label>
          <select
            id="ui-density"
            value={uiDensity}
            onChange={(e) => setUiDensity(e.target.value as 'normal' | 'compact')}
            className="border border-midnight-navy/20 rounded px-2 py-1 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="compact">Compact</option>
          </select>
        </div>

        <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard title="Key Election Dates" icon={<CalendarDaysIcon className="h-8 w-8 text-civic-blue" />}>
                {relevantElection ? (
                    <>
                        <p className="font-semibold text-midnight-navy">{getFormattedElectionName(relevantElection)}</p>
                        <p>Election Day: {new Date(relevantElection.electionDate  + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p>Early Voting: {new Date(relevantElection.evStart  + 'T00:00:00').toLocaleDateString()} - {new Date(relevantElection.evEnd  + 'T00:00:00').toLocaleDateString()}</p>
                    </>
                ) : <p>Election dates will be updated soon.</p>}
                <p className="mt-2 text-sm text-midnight-navy/70"><em>(Dates are for example purposes. Always check official sources.)</em></p>
            </InfoCard>
            <InfoCard title="Polling Place Info" icon={<MapPinIcon className="h-8 w-8 text-civic-blue" />}>
                <p>Find your official polling place by visiting the <a href="https://www.sos.la.gov/ElectionsAndVoting/Pages/OnlineVoterRegistration.aspx" target="_blank" rel="noopener noreferrer" className="text-civic-blue hover:text-sunlight-gold hover:underline">Louisiana Secretary of State website</a> or <a href="https://voterportal.sos.la.gov/" target="_blank" rel="noopener noreferrer" className="text-civic-blue hover:text-sunlight-gold hover:underline">GeauxVote.com</a>.</p>
            </InfoCard>
            <InfoCard title="Voter Resources" icon={<LifebuoyIcon className="h-8 w-8 text-civic-blue" />}>
                 <ul className="list-disc list-inside space-y-1">
                    <li><a href="https://www.sos.la.gov/" target="_blank" rel="noopener noreferrer" className="text-civic-blue hover:text-sunlight-gold hover:underline">Louisiana Secretary of State</a></li>
                    <li><a href="https://www.ebrclerkofcourt.org/elections/" target="_blank" rel="noopener noreferrer" className="text-civic-blue hover:text-sunlight-gold hover:underline">EBR Clerk of Court (Elections)</a></li>
                    <li><a href="https://www.vote.org/" target="_blank" rel="noopener noreferrer" className="text-civic-blue hover:text-sunlight-gold hover:underline">Vote.org (Non-partisan)</a></li>
                 </ul>
            </InfoCard>
             <InfoCard title="Voting Reminders" icon={<CalendarDaysIcon className="h-8 w-8 text-civic-blue" />}>
                <p>Visit the "My Ballot" page to set or manage voting reminders for specific elections.</p>
            </InfoCard>
        </div>

        {/* My Notes Summary Section */}
        <div className="mt-10 border-t border-midnight-navy/10 pt-8">
          <h2 className="text-2xl font-display font-semibold text-midnight-navy mb-4 flex items-center">
            <PencilSquareIcon className="h-8 w-8 mr-3 text-civic-blue" />
            My Candidate Notes Summary
          </h2>
          {allNotesSummary.length > 0 ? (
            <div className="space-y-4 notes-summary-list">
              {allNotesSummary.map(summaryItem => (
                <div key={summaryItem.candidateId} className="notes-summary-item p-4 bg-slate-100 rounded-md border border-midnight-navy/10 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link to={summaryItem.candidateProfileLink} className="text-lg font-display font-semibold text-midnight-navy hover:text-sunlight-gold hover:underline">
                        {summaryItem.candidateName}
                      </Link>
                      <p className="text-xs text-midnight-navy/70">{summaryItem.officeName} - {summaryItem.electionName}</p>
                    </div>
                    <Link 
                        to={`${summaryItem.candidateProfileLink}#notes-section`}
                        className="text-sm text-civic-blue hover:text-sunlight-gold hover:underline flex items-center"
                        title="Manage all notes for this candidate"
                    >
                        Manage Notes <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                  {summaryItem.latestNote ? (
                    <div className="mt-2 text-sm text-midnight-navy">
                      <p className="italic font-sans">
                        "{summaryItem.latestNote.text.substring(0, 150)}{summaryItem.latestNote.text.length > 150 ? '...' : ''}"
                      </p>
                      <p className="text-xs text-midnight-navy/70 mt-1">
                        Latest: {formatNoteDateForDisplay(summaryItem.latestNote.date)}
                        {summaryItem.notesCount > 1 && ` (${summaryItem.notesCount} notes total)`}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-midnight-navy/70 italic font-sans">No notes recorded.</p> 
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-midnight-navy/70 italic font-sans">You haven't saved any notes for candidates yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface InfoCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}
const InfoCard: React.FC<InfoCardProps> = ({ title, icon, children }) => {
    const { uiDensity } = useSettings();
    const padding = uiDensity === 'compact' ? 'p-4' : 'p-6';
    return (
        <div className={`bg-slate-100 ${padding} rounded-lg shadow-md border border-midnight-navy/10`}>
            <div className="flex items-center mb-3">
                {icon}
                <h3 className="text-xl font-display font-semibold text-midnight-navy ml-3">{title}</h3>
            </div>
            <div className="text-midnight-navy/90 text-sm space-y-1 font-sans">
                {children}
            </div>
        </div>
    );
}

export default ElectionInfoPage;
