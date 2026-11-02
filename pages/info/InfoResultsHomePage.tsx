import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ChartBarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useElectionData } from '../../services/electionDataStore';
import { fetchResultsIndex } from '../../services/resultsService';
import { useVoterDistricts } from '../../hooks/useVoterDistricts';
import type { ResultsIndexEntry } from '../../services/sosResults';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'municipal', label: 'Local only' },
] as const;

const InfoResultsHomePage: React.FC = () => {
  const [elections, setElections] = useState<ResultsIndexEntry[] | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());
  const { version } = useElectionData();
  const { saved } = useVoterDistricts();
  const myParish = saved?.districts.find((d) => d.type === 'parishwide')?.label.replace(/ Parish$/i, '');

  useEffect(() => {
    let cancelled = false;
    fetchResultsIndex().then((d) => !cancelled && setElections(d));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (elections ?? []).filter((e) => {
      if (filter !== 'all' && e.electionType !== filter) return false;
      if (mineOnly && myParish && !e.parishes.includes(myParish) && e.statewideCount === 0) return false;
      if (!words.length) return true;
      const hay = `${e.electionName} ${e.electionDate} ${e.highlights.join(' ')} ${e.parishes.join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [elections, filter, q, mineOnly, myParish]);

  const byYear = useMemo(() => {
    const m = new Map<string, ResultsIndexEntry[]>();
    for (const e of filtered) {
      const y = e.electionDate.slice(0, 4);
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(e);
    }
    return [...m.entries()];
  }, [filtered]);

  // Searching opens everything; otherwise the most recent three years start open.
  const isOpen = (y: string, i: number) => q.trim() !== '' || openYears.has(y) || (openYears.size === 0 && i < 3);
  const toggle = (y: string) =>
    setOpenYears((s) => {
      const n = new Set(s.size === 0 ? byYear.slice(0, 3).map(([yy]) => yy) : s);
      n.has(y) ? n.delete(y) : n.add(y);
      return n;
    });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-5 md:p-10 border border-midnight-navy/10">
        <Link to="/info" className="inline-flex items-center text-sm text-civic-blue hover:text-sunlight-gold mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back to Info
        </Link>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-midnight-navy flex items-center">
          <ChartBarIcon className="h-8 w-8 mr-3 text-civic-blue" /> Election Results
        </h1>
        <p className="text-sm text-midnight-navy/60 mt-1 mb-5">
          Official results from the Louisiana Secretary of State
          {elections && elections.length > 0 && <>: {elections.length} elections since {elections[elections.length - 1].electionDate.slice(0, 4)}</>}.
        </p>

        <div className="relative mb-3">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-2.5 text-midnight-navy/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: governor, 2019, amendment, Livingston…"
            aria-label="Search elections"
            className="w-full pl-10 pr-3 py-2 border border-midnight-navy/20 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-civic-blue/40"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${filter === f.value ? 'bg-civic-blue text-white' : 'bg-slate-100 text-midnight-navy/70 hover:bg-slate-200'}`}
            >
              {f.label}
            </button>
          ))}
          {myParish && (
            <label className="flex items-center gap-1.5 text-sm text-midnight-navy/80 ml-1">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
              On {myParish} ballots
            </label>
          )}
        </div>

        {elections === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <ChartBarIcon className="h-12 w-12 mx-auto text-midnight-navy/20 mb-3" />
            <p className="text-midnight-navy/60">{elections.length === 0 ? 'No results available yet.' : 'No elections match.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {byYear.map(([year, list], i) => (
              <section key={year} className="border border-midnight-navy/10 rounded-lg">
                <button onClick={() => toggle(year)} aria-expanded={isOpen(year, i)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
                  <span className="font-display font-bold text-midnight-navy">{year}</span>
                  <span className="text-xs text-midnight-navy/60">
                    {list.length} election{list.length === 1 ? '' : 's'} {isOpen(year, i) ? '▾' : '▸'}
                  </span>
                </button>
                {isOpen(year, i) && (
                  <ul className="divide-y divide-midnight-navy/10 border-t border-midnight-navy/10">
                    {list.map((e) => (
                      <li key={e.electionId}>
                        <Link to={`/info/results/${e.electionId}`} className="block px-4 py-3 hover:bg-slate-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-midnight-navy">{e.electionName}</p>
                              <p className="text-sm text-midnight-navy/70 truncate">{e.highlights.join(' · ') || 'Local races'}</p>
                            </div>
                            <div className="text-right text-xs text-midnight-navy/60 whitespace-nowrap">
                              {e.turnout?.turnoutPercent != null && <p>{e.turnout.turnoutPercent}% turnout</p>}
                              <p>{e.contestCount.toLocaleString()} contests</p>
                              {!e.official && <p className="text-amber-700 font-medium">Unofficial</p>}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoResultsHomePage;
