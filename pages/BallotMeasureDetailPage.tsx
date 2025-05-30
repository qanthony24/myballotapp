import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BallotMeasure } from '../types';
import { getBallotMeasureById, getFormattedElectionNameFromDate } from '../services/dataService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useBallot } from '../hooks/useBallot';
import { ArrowLeftIcon, DocumentTextIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon, HandThumbUpIcon, HandThumbDownIcon, NoSymbolIcon } from '@heroicons/react/24/outline';

const BallotMeasureDetailPage: React.FC = () => {
  const { id: measureIdParam } = useParams<{ id: string }>(); // Corrected: Use 'id' from route param
  const navigate = useNavigate();
  const [measure, setMeasure] = useState<BallotMeasure | null>(null);
  const [loading, setLoading] = useState(true);

  const { 
    setMeasureStance, 
    removeMeasureStance, 
    getSelectedMeasureStance, 
    isElectionPast 
  } = useBallot();

  useEffect(() => {
    setLoading(true); 
    if (measureIdParam) { 
      const id = parseInt(measureIdParam);
      const fetchedMeasure = getBallotMeasureById(id);
      setMeasure(fetchedMeasure);
    } else {
      setMeasure(null); // Explicitly set to null if no ID
    }
    setLoading(false);
  }, [measureIdParam]); // Depend on the renamed param

  if (loading) return <LoadingSpinner size="lg" />;
  if (!measure) return <div className="text-center py-10 text-sunlight-gold">Ballot measure not found.</div>; // Updated text color

  const electionIsPastForMeasure = isElectionPast(measure.electionDate);
  const currentStance = getSelectedMeasureStance(measure.id, measure.electionDate);
  const formattedElectionName = getFormattedElectionNameFromDate(measure.electionDate);

  const handleStanceSelection = (vote: 'support' | 'oppose' | null) => {
    if (electionIsPastForMeasure) return;
    if (vote === null) {
      removeMeasureStance(measure.id, measure.electionDate);
    } else {
      setMeasureStance(measure.id, vote, measure.electionDate);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center text-midnight-navy hover:text-civic-blue transition-colors font-medium" // Updated text and hover colors
      >
        <ArrowLeftIcon className="h-5 w-5 mr-2" />
        Back to Measures List
      </button>

      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/20"> {/* Updated border color */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-midnight-navy mb-2">{measure.title}</h1> {/* Updated text color */}
          <p className="text-lg text-midnight-navy/70">
            For {formattedElectionName} {electionIsPastForMeasure && <span className="text-sm font-semibold text-midnight-navy/60">(Past Election)</span>} {/* Updated text color */}
          </p>
        </header>

        {!electionIsPastForMeasure && (
          <div className="mb-8 p-4 bg-slate-100 rounded-lg border border-midnight-navy/10"> {/* Updated background and border colors */}
            <h2 className="text-xl font-semibold text-midnight-navy mb-3">Your Stance:</h2> {/* Updated text color */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-3 sm:space-y-0">
              <button
                onClick={() => handleStanceSelection('support')}
                disabled={electionIsPastForMeasure}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-md text-lg font-semibold transition-colors border-2
                  ${currentStance === 'support' ? 'bg-civic-blue text-white border-civic-blue/90 ring-2 ring-civic-blue ring-offset-1' : 'bg-white hover:bg-civic-blue/10 text-civic-blue border-civic-blue'}
                  ${electionIsPastForMeasure ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <HandThumbUpIcon className="h-6 w-6 mr-2" /> Support
              </button>
              <button
                onClick={() => handleStanceSelection('oppose')}
                disabled={electionIsPastForMeasure}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-md text-lg font-semibold transition-colors border-2
                  ${currentStance === 'oppose' ? 'bg-sunlight-gold text-midnight-navy border-sunlight-gold/90 ring-2 ring-sunlight-gold ring-offset-1' : 'bg-white hover:bg-sunlight-gold/10 text-sunlight-gold border-sunlight-gold'}
                  ${electionIsPastForMeasure ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <HandThumbDownIcon className="h-6 w-6 mr-2" /> Oppose
              </button>
              {currentStance && (
                <button
                  onClick={() => handleStanceSelection(null)}
                  disabled={electionIsPastForMeasure}
                  className={`flex items-center justify-center py-3 px-4 rounded-md text-base font-semibold transition-colors border-2 bg-white hover:bg-slate-100 text-midnight-navy/70 border-midnight-navy/30
                    ${electionIsPastForMeasure ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Clear Stance"
                >
                   <NoSymbolIcon className="h-5 w-5 mr-2" /> Clear
                </button>
              )}
            </div>
            {electionIsPastForMeasure && <p className="text-sm text-midnight-navy/60 mt-2 italic">Voting has ended for this measure.</p>} {/* Updated text color */}
          </div>
        )}
        
        {electionIsPastForMeasure && currentStance && (
             <div className="mb-8 p-4 bg-slate-100 rounded-lg border border-midnight-navy/10"> {/* Updated background and border colors */}
                <h2 className="text-xl font-semibold text-midnight-navy mb-2">Your Archived Stance:</h2> {/* Updated text color */}
                 <p className={`text-lg font-medium py-2 px-4 rounded-md inline-block
                    ${currentStance === 'support' ? 'bg-civic-blue/10 text-civic-blue' : ''}
                    ${currentStance === 'oppose' ? 'bg-sunlight-gold/10 text-sunlight-gold' : ''}
                 `}>
                    You chose to {currentStance === 'support' ? 'Support' : 'Oppose'} this measure.
                 </p>
             </div>
        )}
         {electionIsPastForMeasure && !currentStance && (
             <div className="mb-8 p-4 bg-slate-100 rounded-lg border border-midnight-navy/10"> {/* Updated background and border colors */}
                <h2 className="text-xl font-semibold text-midnight-navy mb-2">Your Archived Stance:</h2> {/* Updated text color */}
                 <p className="text-lg text-midnight-navy/70 py-2 px-4 rounded-md inline-block bg-slate-100/50"> {/* Updated text and background colors */}
                    No stance was recorded for this measure.
                 </p>
             </div>
        )}


        <section className="mb-6">
          <h3 className="text-xl font-semibold text-midnight-navy mb-2 flex items-center"> {/* Updated text color */}
            <DocumentTextIcon className="h-6 w-6 mr-2 text-midnight-navy/70" /> Official Ballot Language {/* Updated icon color */}
          </h3>
          <p className="text-midnight-navy whitespace-pre-line leading-relaxed p-4 bg-slate-100/50 rounded-md border border-midnight-navy/10">{measure.ballotLanguage}</p> {/* Updated text, background, and border colors */}
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-semibold text-midnight-navy mb-2 flex items-center"> {/* Updated text color */}
            <ChatBubbleLeftEllipsisIcon className="h-6 w-6 mr-2 text-midnight-navy/70" /> In other words... {/* Updated icon color */}
          </h3>
          <p className="text-midnight-navy whitespace-pre-line leading-relaxed">{measure.laymansExplanation}</p> {/* Updated text color */}
        </section>

        <section className="mb-6">
          <h3 className="text-xl font-semibold text-midnight-navy mb-2 flex items-center"> {/* Updated text color */}
            <CheckCircleIcon className="h-6 w-6 mr-2 text-civic-blue" /> A YES vote means: {/* Updated icon color */}
          </h3>
          <p className="text-midnight-navy whitespace-pre-line leading-relaxed">{measure.yesVoteMeans}</p> {/* Updated text color */}
        </section>

        <section>
          <h3 className="text-xl font-semibold text-midnight-navy mb-2 flex items-center"> {/* Updated text color */}
            <XCircleIcon className="h-6 w-6 mr-2 text-sunlight-gold" /> A NO vote means: {/* Updated icon color */}
          </h3>
          <p className="text-midnight-navy whitespace-pre-line leading-relaxed">{measure.noVoteMeans}</p> {/* Updated text color */}
        </section>
      </div>
    </div>
  );
};

export default BallotMeasureDetailPage;