import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BallotMeasure, Cycle } from '../types';
import { 
  getAllBallotMeasures, 
  getUpcomingCycles, // Use this for upcoming elections
  getFormattedElectionName, 
  getFormattedElectionNameFromDate,
  isElectionPast // Use centralized version
} from '../services/dataService';
import { DocumentCheckIcon, InformationCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useBallot } from '../hooks/useBallot';
import { useSettings } from '../hooks/useSettings';

const BallotMeasuresListPage: React.FC = () => {
  const [allMeasures, setAllMeasures] = useState<BallotMeasure[]>([]);
  const [upcomingElectionEvents, setUpcomingElectionEvents] = useState<Cycle[]>([]);
  const { selectedElectionDate: ballotSelectedElectionDate } = useBallot();
  const [selectedElectionFilter, setSelectedElectionFilter] = useState<string>('');
  const { uiDensity } = useSettings();

  useEffect(() => {
    setAllMeasures(getAllBallotMeasures());
    const upcomingCycles = getUpcomingCycles();
    setUpcomingElectionEvents(upcomingCycles);

    if (ballotSelectedElectionDate && !isElectionPast(ballotSelectedElectionDate)) {
      setSelectedElectionFilter(ballotSelectedElectionDate);
    } else if (upcomingCycles.length > 0) {
      setSelectedElectionFilter(upcomingCycles[0].electionDate);
    } else {
      setSelectedElectionFilter('');
    }
  }, [ballotSelectedElectionDate]);

  const filteredMeasures = useMemo(() => {
    // First, filter allMeasures to include only those tied to an upcoming election
    const measuresInUpcomingElections = allMeasures.filter(measure => 
      upcomingElectionEvents.some(cycle => cycle.electionDate === measure.electionDate)
    );

    if (!selectedElectionFilter) { // If "All Upcoming Elections" is selected
      return measuresInUpcomingElections;
    }
    // If a specific upcoming election is selected
    return measuresInUpcomingElections.filter(measure => measure.electionDate === selectedElectionFilter);
  }, [allMeasures, selectedElectionFilter, upcomingElectionEvents]);
  
  const currentFilteredElectionName = selectedElectionFilter
    ? getFormattedElectionNameFromDate(selectedElectionFilter)
    : "All Upcoming Elections";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/20">
        <div className="text-center mb-10">
          <DocumentCheckIcon className="h-16 w-16 text-civic-blue mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-midnight-navy">Ballot Measures</h1>
          <p className="text-midnight-navy/70 mt-2">Review propositions and other measures on the upcoming ballots.</p>
        </div>

        {/* Election Filter */}
        <div className="mb-8 max-w-md mx-auto">
          <label htmlFor="election-filter" className="block text-sm font-medium text-midnight-navy mb-1">
            Filter by Election:
          </label>
          <select
            id="election-filter"
            value={selectedElectionFilter}
            onChange={(e) => setSelectedElectionFilter(e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-midnight-navy/30 bg-white rounded-md shadow-sm focus:outline-none focus:ring-sunlight-gold focus:border-sunlight-gold sm:text-sm text-midnight-navy"
          >
            <option value="">All Upcoming Elections</option>
            {upcomingElectionEvents.map((event) => (
              // isElectionPast check here is redundant as upcomingElectionEvents only contains upcoming
              <option key={event.electionDate} value={event.electionDate}>
                {getFormattedElectionName(event)}
              </option>
            ))}
          </select>
        </div>
        
        {filteredMeasures.length > 0 ? (
          <div className="space-y-6">
            {filteredMeasures.map(measure => (
              <Link
                key={measure.id}
                to={`/ballot-measure/${measure.id}`}
                className={`block bg-slate-100 ${uiDensity === 'compact' ? 'p-4' : 'p-6'} rounded-lg shadow-md hover:shadow-lg transition-shadow border border-midnight-navy/20 hover:border-civic-blue`}
              >
                <h2 className="text-xl font-semibold text-midnight-navy mb-1">{measure.title}</h2>
                <p className="text-sm text-midnight-navy/70 flex items-center">
                  <CalendarDaysIcon className="h-4 w-4 mr-2 text-midnight-navy/70" />
                  {getFormattedElectionNameFromDate(measure.electionDate)}
                  {/* isElectionPast check here is also redundant for display as only upcoming are shown */}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <InformationCircleIcon className="h-16 w-16 text-midnight-navy/40 mx-auto mb-4" />
            <p className="text-xl text-midnight-navy/70">
              No ballot measures found for {selectedElectionFilter ? `${currentFilteredElectionName}` : 'upcoming elections'}.
            </p>
            {upcomingElectionEvents.length > 0 && selectedElectionFilter && (
                <p className="text-midnight-navy/50">Try selecting "All Upcoming Elections" or a different upcoming election.</p>
            )}
             {upcomingElectionEvents.length === 0 && (
                <p className="text-midnight-navy/50">Check back later for information on measures for future elections.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BallotMeasuresListPage;