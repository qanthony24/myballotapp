import React from 'react';
import { TrophyIcon } from '@heroicons/react/24/solid';
import type { ResultItem } from '../../types/info';

interface MeasureResultChartProps {
  items: ResultItem[];
  totalVotes?: number;
}

const MeasureResultChart: React.FC<MeasureResultChartProps> = ({ items, totalVotes }) => {
  const yesItem = items.find((i) => i.name.toUpperCase() === 'YES');
  const noItem = items.find((i) => i.name.toUpperCase() === 'NO');

  if (!yesItem || !noItem) {
    return (
      <p className="text-midnight-navy/60 italic text-sm">
        Measure result data is unavailable.
      </p>
    );
  }

  const yesPct = yesItem.votePercent;
  const noPct = noItem.votePercent;
  const passed = yesItem.isWinner;
  const margin = Math.abs(yesPct - noPct);

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div
        className="flex h-8 rounded-full overflow-hidden border border-midnight-navy/10"
        role="img"
        aria-label={`Measure result: YES ${yesPct}%, NO ${noPct}%`}
      >
        <div
          className="bg-green-500 flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
          style={{ width: `${Math.max(yesPct, 2)}%` }}
        >
          {yesPct >= 15 && `YES ${yesPct}%`}
        </div>
        <div
          className="bg-red-400 flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
          style={{ width: `${Math.max(noPct, 2)}%` }}
        >
          {noPct >= 15 && `NO ${noPct}%`}
        </div>
      </div>

      {/* Labels below bar */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-1.5">
          {passed && <TrophyIcon className="h-4 w-4 text-sunlight-gold" aria-label="Winner" />}
          <span className="font-semibold text-green-700">YES</span>
          <span className="text-midnight-navy/70">
            {yesItem.votes.toLocaleString()} ({yesPct}%)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!passed && <TrophyIcon className="h-4 w-4 text-sunlight-gold" aria-label="Winner" />}
          <span className="font-semibold text-red-600">NO</span>
          <span className="text-midnight-navy/70">
            {noItem.votes.toLocaleString()} ({noPct}%)
          </span>
        </div>
      </div>

      {/* Margin callout */}
      <p className={`text-sm font-medium ${passed ? 'text-green-700' : 'text-red-600'}`}>
        {passed ? 'Passed' : 'Failed'} by {margin.toFixed(1)} points
      </p>

      {totalVotes != null && (
        <p className="text-xs text-midnight-navy/60 pt-2 border-t border-slate-100">
          Total votes: {totalVotes.toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default MeasureResultChart;
