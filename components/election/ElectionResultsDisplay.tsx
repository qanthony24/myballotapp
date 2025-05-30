import React from 'react';
import { Link } from 'react-router-dom';
import { OfficeElectionResults, ElectionResultCandidate } from '../../types';
import { TrophyIcon } from '@heroicons/react/24/solid'; // Solid for winner, removed unused CheckCircleIcon

interface ElectionResultsDisplayProps {
  officeResults: OfficeElectionResults;
}

const ElectionResultsDisplay: React.FC<ElectionResultsDisplayProps> = ({ officeResults }) => {
  const { office, results, totalVotesInOffice } = officeResults;

  // Determine a good max bar width, e.g., if highest percentage is low, still make it look substantial
  // const maxPercentageInResults = results.reduce((max, r) => Math.max(max, r.percentage), 0); // Commented out as unused for now
  // If max is very low (e.g. < 20%), we might want to scale up bars for visual effect,
  // but for simplicity, we'll use direct percentage for width for now.

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-midnight-navy/20 mb-6">
      <h3 className="text-2xl font-semibold text-midnight-navy mb-4">{office.name}{officeResults.district ? `, ${officeResults.district}` : ''} - Results</h3>
      {results.length === 0 ? (
        <p className="text-midnight-navy/70 italic">No results available for this office.</p>
      ) : (
        <ul className="space-y-5">
          {results.map((resCandidate: ElectionResultCandidate) => (
            <li key={resCandidate.candidateId} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                <div className="flex items-center mb-2 sm:mb-0">
                    <img 
                        src={resCandidate.photoUrl || `https://picsum.photos/seed/${resCandidate.candidateName.replace(/\s+/g, '').replace('/', '')}/40/40`} 
                        alt={resCandidate.candidateName} 
                        className="w-10 h-10 rounded-full mr-3 object-cover border border-midnight-navy/20"
                        onError={(e) => (e.currentTarget.src = 'https://picsum.photos/40/40?grayscale')}
                    />
                    <div>
                        <Link to={`/candidate/${resCandidate.candidateId}`} className="font-semibold text-midnight-navy hover:text-sunlight-gold text-lg">
                            {resCandidate.candidateName}
                        </Link>
                        <span className="text-sm text-midnight-navy/70 ml-2">({resCandidate.party})</span>
                    </div>
                </div>
                {resCandidate.isWinner && (
                  <span className="text-xs sm:text-sm font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full flex items-center self-start sm:self-center">
                    <TrophyIcon className="h-4 w-4 mr-1.5" />
                    Winner
                  </span>
                )}
              </div>
              
              <div className="flex items-center mb-1">
                <div className="w-full bg-slate-100 rounded-full h-6 mr-3 relative border border-midnight-navy/20">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${resCandidate.isWinner ? 'bg-sunlight-gold' : 'bg-civic-blue'}`}
                    style={{ width: `${Math.max(resCandidate.percentage, 2)}%` }}
                    role="progressbar"
                    aria-valuenow={resCandidate.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${resCandidate.candidateName} vote percentage`}
                  >
                     <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-medium text-white leading-none">
                        {resCandidate.percentage}%
                     </span>
                  </div>
                </div>
              </div>
               <p className="text-xs text-right text-midnight-navy/70">
                    {resCandidate.votes.toLocaleString()} votes
                </p>
            </li>
          ))}
        </ul>
      )}
       {totalVotesInOffice > 0 && (
          <p className="text-sm text-midnight-navy/70 mt-4 pt-3 border-t border-slate-100">
            Total Votes Cast in Office: {totalVotesInOffice.toLocaleString()}
          </p>
        )}
    </div>
  );
};

export default ElectionResultsDisplay;
