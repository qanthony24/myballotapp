import React from 'react';
import { useElection } from '../hooks/useBallot';
import { getFormattedElectionName } from '../services/dataService';

const ElectionBanner: React.FC = () => {
  const election = useElection();

  if (!election) return null;

  return (
    <div className="bg-sunlight-gold text-midnight-navy text-center py-1 shadow-sm border-b border-midnight-navy/10">
      <span className="text-sm font-medium">{getFormattedElectionName(election)}</span>
    </div>
  );
};

export default ElectionBanner;
