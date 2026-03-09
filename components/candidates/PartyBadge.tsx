import React from 'react';
import { getPartyInfo } from '../../lib/parties';

interface PartyBadgeProps {
  party: string;
  size?: 'sm' | 'md';
  showAbbreviation?: boolean;
}

const PartyBadge: React.FC<PartyBadgeProps> = ({
  party,
  size = 'sm',
  showAbbreviation = false,
}) => {
  const info = getPartyInfo(party);
  const text = showAbbreviation ? info.abbreviation : info.label;
  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-block font-medium rounded-full ${sizeClasses} ${info.badgeClasses}`}>
      {text}
    </span>
  );
};

export default PartyBadge;
