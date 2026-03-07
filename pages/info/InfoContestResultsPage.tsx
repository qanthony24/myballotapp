import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { fetchContestById } from '../../services/resultsService';
import type { ElectionResultSummary, ContestResult } from '../../types/info';
import ResultsBarChart from '../../components/info/ResultsBarChart';
import MeasureResultChart from '../../components/info/MeasureResultChart';

const InfoContestResultsPage: React.FC = () => {
  const { electionId, contestId } = useParams<{ electionId: string; contestId: string }>();
  const [election, setElection] = useState<ElectionResultSummary | null>(null);
  const [contest, setContest] = useState<ContestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!electionId || !contestId) return;
    fetchContestById(electionId, contestId).then((result) => {
      if (!cancelled) {
        if (result) {
          setElection(result.election);
          setContest(result.contest);
        }
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [electionId, contestId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10 space-y-4">
          <div className="animate-pulse h-5 bg-gray-200 rounded w-1/4" />
          <div className="animate-pulse h-7 bg-gray-200 rounded w-2/3" />
          <div className="animate-pulse h-4 bg-gray-200 rounded w-1/3" />
          <div className="animate-pulse h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!contest || !election) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-midnight-navy/60">Contest not found.</p>
        <Link
          to={electionId ? `/info/results/${electionId}` : '/info/results'}
          className="text-civic-blue hover:text-sunlight-gold text-sm mt-2 inline-block"
        >
          &larr; Back
        </Link>
      </div>
    );
  }

  const isMeasure = contest.contestType === 'measure';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10">
        {/* Nav */}
        <Link
          to={`/info/results/${election.electionId}`}
          className="inline-flex items-center text-sm text-civic-blue hover:text-sunlight-gold transition-colors mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          {election.electionName}
        </Link>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-display font-bold text-midnight-navy mb-1">
          {contest.title}
        </h1>
        {contest.district && (
          <p className="text-sm text-midnight-navy/60 mb-1">{contest.district}</p>
        )}

        {/* Called status */}
        <div className="flex items-center gap-4 text-sm text-midnight-navy/60 mb-6">
          {contest.called && (
            <span className="flex items-center gap-1 text-green-700 font-medium">
              <CheckCircleIcon className="h-4 w-4" />
              Called
            </span>
          )}
          {contest.totalVotes != null && (
            <span>{contest.totalVotes.toLocaleString()} total votes</span>
          )}
        </div>

        {/* Chart */}
        {isMeasure ? (
          <MeasureResultChart items={contest.resultItems} totalVotes={contest.totalVotes} />
        ) : (
          <ResultsBarChart items={contest.resultItems} totalVotes={contest.totalVotes} />
        )}
      </div>
    </div>
  );
};

export default InfoContestResultsPage;
