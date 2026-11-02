import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useElectionData } from '../../services/electionDataStore';
import { fetchElectionById } from '../../services/resultsService';
import { useVoterDistricts } from '../../hooks/useVoterDistricts';
import TurnoutSummaryCard from '../../components/info/TurnoutSummaryCard';
import type { ContestResult, ElectionResultSummary } from '../../types/info';
import type { Contest, ResultsElection } from '../../services/sosResults';

type AnyContest = ContestResult & Partial<Contest>;

/** Group statewide/multi-parish contests by SoS office level. */
function groupOf(c: AnyContest): string {
  const l = c.level ?? 500;
  if (l < 100) return 'Federal';
  if (l < 200) return 'Statewide offices';
  if (l < 998) return 'Legislative, judicial and multi-parish';
  if (l === 998) return 'Constitutional amendments';
  return 'Propositions';
}

const ContestCard: React.FC<{ electionId: string; c: AnyContest }> = ({ electionId, c }) => {
  const max = Math.max(1, ...c.resultItems.map((i) => i.votes));
  const shown = c.resultItems.slice(0, c.contestType === 'measure' ? 2 : 4);
  const more = c.resultItems.length - shown.length;
  return (
    <li className="border border-midnight-navy/10 rounded-lg p-3">
      <Link to={`/info/results/${electionId}/${c.contestId}`} className="block group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-midnight-navy group-hover:text-civic-blue">{c.title}</h3>
          {c.runoff && <span className="text-[11px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full whitespace-nowrap">Runoff</span>}
        </div>
        <ul className="space-y-1.5">
          {shown.map((i) => (
            <li key={i.id}>
              <div className="flex justify-between text-xs">
                <span className={`truncate ${i.isWinner ? 'font-semibold text-midnight-navy' : 'text-midnight-navy/80'}`}>
                  {i.isWinner && '✓ '}
                  {i.name}
                  {i.party && <span className="text-midnight-navy/50"> · {i.party}</span>}
                  {i.outcome === 'Runoff' && <span className="text-amber-700"> · to runoff</span>}
                </span>
                <span className="tabular-nums text-midnight-navy/70 ml-2 whitespace-nowrap">
                  {i.votePercent}% · {i.votes.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-0.5">
                <div className={`h-1.5 rounded-full ${i.isWinner ? 'bg-civic-blue' : i.outcome === 'Runoff' ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${(i.votes / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {more > 0 && <p className="text-[11px] text-civic-blue mt-1.5">+{more} more</p>}
      </Link>
    </li>
  );
};

const InfoElectionResultsPage: React.FC = () => {
  const { electionId } = useParams<{ electionId: string }>();
  const [params, setParams] = useSearchParams();
  const [election, setElection] = useState<(ElectionResultSummary & Partial<ResultsElection>) | null | undefined>(undefined);
  const [q, setQ] = useState('');
  const { version } = useElectionData();
  const { saved } = useVoterDistricts();
  const myParish = saved?.districts.find((d) => d.type === 'parishwide')?.label.replace(/ Parish$/i, '');

  useEffect(() => {
    let cancelled = false;
    if (electionId) fetchElectionById(electionId).then((d) => !cancelled && setElection(d));
    return () => {
      cancelled = true;
    };
  }, [electionId, version]);

  const contests = (election?.contests ?? []) as AnyContest[];
  const parishes = election?.parishesWithLocalRaces ?? [...new Set(contests.map((c) => c.parish).filter(Boolean) as string[])].sort();
  const defaultParish = myParish && parishes.includes(myParish) ? myParish : '';
  const parish = params.get('parish') ?? defaultParish;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (c: AnyContest) => !words.length || words.every((w) => `${c.title} ${c.resultItems.map((i) => i.name).join(' ')}`.toLowerCase().includes(w));

  const statewide = useMemo(() => {
    const groups = new Map<string, AnyContest[]>();
    for (const c of contests.filter((c) => !c.parish && match(c))) {
      const g = groupOf(c);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(c);
    }
    return [...groups.entries()];
  }, [contests, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const local = contests.filter((c) => parish && c.parish === parish && match(c));

  if (election === undefined) {
    return (
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10 space-y-3">
        <div className="animate-pulse h-6 bg-gray-200 rounded w-1/2" />
        <div className="animate-pulse h-24 bg-gray-100 rounded" />
      </div>
    );
  }
  if (!election) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <p className="text-midnight-navy/60">Election not found.</p>
        <Link to="/info/results" className="text-civic-blue text-sm mt-2 inline-block">&larr; Back to results</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-5 md:p-10 border border-midnight-navy/10">
        <Link to="/info/results" className="inline-flex items-center text-sm text-civic-blue hover:text-sunlight-gold mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> All results
        </Link>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-midnight-navy">{election.electionName}</h1>
        <p className="text-sm text-midnight-navy/60 mb-4">
          {election.official === false ? 'Unofficial results' : 'Official results'} · Louisiana Secretary of State
        </p>
        {election.turnout && <TurnoutSummaryCard turnout={election.turnout} />}

        <div className="relative my-5">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-2.5 text-midnight-navy/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a race or candidate"
            aria-label="Find a race or candidate"
            className="w-full pl-10 pr-3 py-2 border border-midnight-navy/20 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-civic-blue/40"
          />
        </div>

        {statewide.map(([group, list]) => (
          <section key={group} className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-midnight-navy/60 mb-2">{group}</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {list.map((c) => (
                <ContestCard key={c.contestId} electionId={election.electionId} c={c} />
              ))}
            </ul>
          </section>
        ))}

        {parishes.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-midnight-navy/60">Local races</h2>
              <select
                value={parish}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  e.target.value ? next.set('parish', e.target.value) : next.delete('parish');
                  setParams(next, { replace: true });
                }}
                aria-label="Parish"
                className="border border-midnight-navy/20 rounded-md text-sm px-2 py-1"
              >
                <option value="">Choose a parish ({parishes.length})</option>
                {parishes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                    {p === myParish ? ' (yours)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {!parish ? (
              <p className="text-sm text-midnight-navy/60">Pick a parish to see its local races and propositions.</p>
            ) : local.length === 0 ? (
              <p className="text-sm text-midnight-navy/60">No local races {words.length ? 'match your search' : `in ${parish}`}.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {local.map((c) => (
                  <ContestCard key={c.contestId} electionId={election.electionId} c={c} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default InfoElectionResultsPage;
