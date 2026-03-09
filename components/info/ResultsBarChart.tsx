import React from 'react';
import { TrophyIcon } from '@heroicons/react/24/solid';
import type { ResultItem } from '../../types/info';
import { getPartyInfo } from '../../lib/parties';

interface ResultsBarChartProps {
  items: ResultItem[];
  totalVotes?: number;
}

const ResultsBarChart: React.FC<ResultsBarChartProps> = ({ items, totalVotes }) => {
  const sorted = [...items].sort((a, b) => b.votePercent - a.votePercent);
  const maxPct = sorted.length > 0 ? sorted[0].votePercent : 1;
  const scaleFactor = maxPct > 0 ? 90 / maxPct : 1;

  return (
    <div
      role="img"
      aria-label={`Candidate results bar chart${totalVotes ? `. ${totalVotes.toLocaleString()} total votes` : ''}`}
      className="space-y-4"
    >
      {sorted.map((item) => {
        const barWidth = Math.max(item.votePercent * scaleFactor, 2);
        const badge = item.party ? getPartyInfo(item.party).badgeClasses : null;

        return (
          <div key={item.id} className="space-y-1">
            {/* Name row */}
            <div className="flex items-center gap-2 text-sm">
              {item.isWinner && (
                <TrophyIcon className="h-4 w-4 text-sunlight-gold flex-shrink-0" aria-label="Winner" />
              )}
              <span className="font-semibold text-midnight-navy">
                {item.name}
              </span>
              {item.incumbent && (
                <span className="text-[10px] font-medium bg-midnight-navy/10 text-midnight-navy/70 px-1.5 py-0.5 rounded">
                  Incumbent
                </span>
              )}
              {badge && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge}`}>
                  {item.party}
                </span>
              )}
            </div>

            {/* Bar row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden border border-midnight-navy/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${item.isWinner ? 'bg-sunlight-gold' : 'bg-civic-blue/60'}`}
                  style={{ width: `${barWidth}%` }}
                  role="meter"
                  aria-valuenow={item.votePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.name}: ${item.votePercent}%`}
                />
              </div>
              <span className="text-sm font-medium text-midnight-navy w-14 text-right">
                {item.votePercent}%
              </span>
              <span className="text-xs text-midnight-navy/60 w-20 text-right hidden sm:inline">
                {item.votes.toLocaleString()} votes
              </span>
            </div>
          </div>
        );
      })}

      {totalVotes != null && (
        <p className="text-xs text-midnight-navy/60 pt-2 border-t border-slate-100">
          Total votes: {totalVotes.toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default ResultsBarChart;
