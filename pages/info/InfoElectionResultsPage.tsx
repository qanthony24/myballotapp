import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { fetchElectionById } from '../../services/resultsService';
import type { ElectionResultSummary, ContestResult } from '../../types/info';
import TurnoutSummaryCard from '../../components/info/TurnoutSummaryCard';

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const InfoElectionResultsPage: React.FC = () => {
  const { electionId } = useParams<{ electionId: string }>();
  const [election, setElection] = useState<ElectionResultSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!electionId) return;
    fetchElectionById(electionId).then((data) => {
      if (!cancelled) {
        setElection(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [electionId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10 space-y-4">
          <div className="animate-pulse h-6 bg-gray-200 rounded w-1/2" />
          <div className="animate-pulse h-4 bg-gray-200 rounded w-1/3" />
          <div className="animate-pulse h-24 bg-gray-200 rounded" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse h-20 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <p className="text-midnight-navy/60">Election not found.</p>
        <Link to="/info/results" className="text-civic-blue hover:text-sunlight-gold text-sm mt-2 inline-block">
          &larr; Back to results
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10">
        {/* Nav */}
        <Link
          to="/info/results"
          className="inline-flex items-center text-sm text-civic-blue hover:text-sunlight-gold transition-colors mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          All Results
        </Link>

        {/* Header */}
        <h1 className="text-2xl md:text-3xl font-display font-bold text-midnight-navy mb-1">
          {election.electionName}
        </h1>
        <p className="text-sm text-midnight-navy/60 mb-6">
          {formatDate(election.electionDate)} &middot; {election.jurisdiction}
        </p>

        {/* Turnout */}
        {election.turnout && <div className="mb-8"><TurnoutSummaryCard turnout={election.turnout} /></div>}

        {/* Contest list */}
        <h2 className="text-lg font-display font-semibold text-midnight-navy mb-4">
          Contests ({election.contests.length})
        </h2>

        {election.contests.length === 0 ? (
          <p className="text-midnight-navy/60 italic text-sm">No contest data available.</p>
        ) : (
          <div className="space-y-3">
            {election.contests.map((contest) => (
              <ContestCard
                key={contest.contestId}
                contest={contest}
                electionId={election.electionId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ContestCard: React.FC<{ contest: ContestResult; electionId: string }> = ({ contest, electionId }) => {
  const winner = contest.resultItems.find((r) => r.isWinner);
  const isMeasure = contest.contestType === 'measure';

  let resultLabel = '';
  if (winner) {
    resultLabel = isMeasure ? winner.name.toUpperCase() : winner.name;
  }

  return (
    <Link
      to={`/info/results/${electionId}/${contest.contestId}`}
      className="block rounded-lg border border-midnight-navy/10 p-4 hover:shadow-md hover:border-civic-blue/40 transition-all duration-200 group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-midnight-navy group-hover:text-civic-blue transition-colors truncate">
              {contest.title}
            </h3>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isMeasure
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-civic-blue/10 text-civic-blue'
              }`}
            >
              {isMeasure ? 'Measure' : 'Candidate'}
            </span>
          </div>

          {/* Winner / result summary */}
          {winner && (
            <p className="text-sm text-midnight-navy/60 mt-1 flex items-center gap-1.5">
              <TrophyIcon className="h-3.5 w-3.5 text-sunlight-gold flex-shrink-0" />
              {resultLabel} &mdash; {winner.votePercent}%
            </p>
          )}
        </div>

        {contest.totalVotes != null && (
          <span className="text-xs text-midnight-navy/40 whitespace-nowrap">
            {contest.totalVotes.toLocaleString()} votes
          </span>
        )}
      </div>
    </Link>
  );
};

export default InfoElectionResultsPage;
