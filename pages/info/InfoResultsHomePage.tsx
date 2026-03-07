import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChartBarIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { fetchAllElections } from '../../services/resultsService';
import type { ElectionResultSummary, ElectionType } from '../../types/info';

const TYPE_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  municipal: 'Municipal',
  special: 'Special',
  primary: 'Primary',
  general: 'General',
};

const FILTER_CHIPS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Federal', value: 'federal' },
  { label: 'State', value: 'state' },
  { label: 'Municipal', value: 'municipal' },
];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const InfoResultsHomePage: React.FC = () => {
  const [elections, setElections] = useState<ElectionResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    fetchAllElections().then((data) => {
      if (!cancelled) {
        setElections(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return elections;
    return elections.filter((e) => e.electionType === filter);
  }, [elections, filter]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/info"
            className="inline-flex items-center text-sm text-civic-blue hover:text-sunlight-gold transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Info Hub
          </Link>
          <h1 className="text-3xl font-display font-bold text-midnight-navy flex items-center">
            <ChartBarIcon className="h-8 w-8 mr-3 text-civic-blue" />
            Past Election Results
          </h1>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setFilter(chip.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === chip.value
                  ? 'bg-civic-blue text-white'
                  : 'bg-slate-100 text-midnight-navy/70 hover:bg-slate-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-100 p-5 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <ChartBarIcon className="h-12 w-12 mx-auto text-midnight-navy/20 mb-3" />
            <p className="text-midnight-navy/60">
              {elections.length === 0
                ? 'No past election results available yet.'
                : 'No elections match the selected filter.'}
            </p>
          </div>
        )}

        {/* Election cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((election) => (
              <ElectionCard key={election.electionId} election={election} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ElectionCard: React.FC<{ election: ElectionResultSummary }> = ({ election }) => {
  const typeBadge = TYPE_LABELS[election.electionType] ?? election.electionType;

  return (
    <Link
      to={`/info/results/${election.electionId}`}
      className="block rounded-lg border border-midnight-navy/10 p-5 hover:shadow-md hover:border-civic-blue/40 transition-all duration-200 group"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-display font-semibold text-midnight-navy group-hover:text-civic-blue transition-colors truncate">
            {election.electionName}
          </h2>
          <p className="text-sm text-midnight-navy/60 mt-1">
            {formatDate(election.electionDate)} &middot; {election.jurisdiction}
          </p>
        </div>

        <span className="inline-block self-start rounded-full bg-civic-blue/10 text-civic-blue text-xs font-medium px-2.5 py-1">
          {typeBadge}
        </span>
      </div>

      {/* Turnout snippet */}
      {election.turnout?.turnoutPercent != null && (
        <p className="text-sm text-midnight-navy/50 mt-2">
          Turnout: {election.turnout.turnoutPercent}%
          {election.turnout.ballotsCast != null && (
            <> &middot; {election.turnout.ballotsCast.toLocaleString()} ballots cast</>
          )}
        </p>
      )}

      <p className="text-xs text-midnight-navy/40 mt-2">
        {election.contests.length} contest{election.contests.length !== 1 && 's'}
      </p>
    </Link>
  );
};

export default InfoResultsHomePage;
