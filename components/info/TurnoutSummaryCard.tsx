import React from 'react';
import type { TurnoutData } from '../../types/info';

interface TurnoutSummaryCardProps {
  turnout: TurnoutData;
}

const TurnoutSummaryCard: React.FC<TurnoutSummaryCardProps> = ({ turnout }) => {
  const { ballotsCast, registeredVoters, turnoutPercent } = turnout;

  const pct = turnoutPercent ?? (ballotsCast && registeredVoters
    ? Math.round((ballotsCast / registeredVoters) * 1000) / 10
    : undefined);

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = pct != null ? circumference - (pct / 100) * circumference : circumference;

  return (
    <div className="bg-white rounded-lg shadow border border-midnight-navy/10 p-5">
      <h3 className="text-sm font-semibold text-midnight-navy/60 uppercase tracking-wide mb-4">
        Voter Turnout
      </h3>

      <div className="grid grid-cols-3 gap-4 text-center">
        {/* Ballots Cast */}
        <div>
          <p className="text-2xl font-bold text-midnight-navy">
            {ballotsCast != null ? ballotsCast.toLocaleString() : 'N/A'}
          </p>
          <p className="text-xs text-midnight-navy/60 mt-1">Ballots Cast</p>
        </div>

        {/* Registered Voters */}
        <div>
          <p className="text-2xl font-bold text-midnight-navy">
            {registeredVoters != null ? registeredVoters.toLocaleString() : 'N/A'}
          </p>
          <p className="text-xs text-midnight-navy/60 mt-1">Registered Voters</p>
        </div>

        {/* Turnout Rate — circular progress */}
        <div className="flex flex-col items-center">
          <div className="relative w-[76px] h-[76px]">
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 76 76"
              aria-hidden="true"
            >
              <circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="6"
              />
              {pct != null && (
                <circle
                  cx="38"
                  cy="38"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  className="text-civic-blue"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              )}
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-midnight-navy">
              {pct != null ? `${pct}%` : 'N/A'}
            </span>
          </div>
          <p className="text-xs text-midnight-navy/60 mt-1">Turnout Rate</p>
        </div>
      </div>
    </div>
  );
};

export default TurnoutSummaryCard;
