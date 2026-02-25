import React from 'react';
import { useElection } from '../hooks/useBallot';
import { getFormattedElectionName, getUpcomingCycles } from '../services/dataService';

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const ElectionBanner: React.FC = () => {
  const selectedElection = useElection();
  const upcoming = getUpcomingCycles();
  const nextElection = upcoming[0] ?? selectedElection;

  if (!nextElection) return null;

  const daysUntil = getDaysUntil(nextElection.electionDate);
  const displayName = getFormattedElectionName(nextElection);

  let countdownLabel: string;
  if (daysUntil === 0) countdownLabel = 'TODAY';
  else if (daysUntil === 1) countdownLabel = 'TOMORROW';
  else if (daysUntil > 0) countdownLabel = `${daysUntil} days away`;
  else countdownLabel = '';

  const evStart = nextElection.evStart ? new Date(nextElection.evStart + 'T00:00:00') : null;
  const evEnd = nextElection.evEnd ? new Date(nextElection.evEnd + 'T00:00:00') : null;
  const now = new Date();
  const isEarlyVotingActive = evStart && evEnd && now >= evStart && now <= evEnd;

  return (
    <div className="bg-sunlight-gold text-midnight-navy text-center py-1.5 shadow-sm border-b border-midnight-navy/10 fixed top-16 left-0 w-full z-30">
      <div className="container mx-auto px-4 flex items-center justify-center gap-3 text-sm">
        <span className="font-semibold">{displayName}</span>
        {daysUntil >= 0 && (
          <>
            <span className="text-midnight-navy/40">|</span>
            <span className="font-bold">
              {isEarlyVotingActive ? '🗳️ Early voting is open!' : countdownLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default ElectionBanner;
