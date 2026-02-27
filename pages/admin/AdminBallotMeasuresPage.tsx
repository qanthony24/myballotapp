import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BallotMeasure } from '../../types';
import { getFirestoreBallotMeasures, getLocalCycles } from '../../services/firestoreDataService';
import { getFormattedElectionNameFromDate } from '../../services/dataService';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';

const AdminBallotMeasuresPage: React.FC = () => {
  const [measures, setMeasures] = useState<BallotMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [electionFilter, setElectionFilter] = useState('');
  const cycles = getLocalCycles();

  useEffect(() => {
    getFirestoreBallotMeasures().then((data) => {
      setMeasures(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return measures.filter((m) => {
      const matchesSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
      const matchesElection = !electionFilter || m.electionDate === electionFilter;
      return matchesSearch && matchesElection;
    });
  }, [measures, search, electionFilter]);

  const hasRealContent = (m: BallotMeasure) =>
    m.ballotLanguage && !m.ballotLanguage.startsWith('This is the official ballot language');

  const stats = useMemo(() => ({
    total: measures.length,
    withContent: measures.filter(hasRealContent).length,
  }), [measures]);

  const uniqueElectionDates = useMemo(() => {
    return Array.from(new Set(measures.map((m) => m.electionDate))).sort();
  }, [measures]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Admin: Ballot Measures</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">Edit propositions, millages, and ballot initiatives</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/admin/ballot-measures/new" className="text-sm bg-civic-blue text-white px-3 py-1.5 rounded-md hover:bg-opacity-90 font-medium flex items-center gap-1">
            <PlusIcon className="h-4 w-4" /> New Measure
          </Link>
          <Link to="/admin/candidates" className="text-sm text-civic-blue underline">Candidates</Link>
          <Link to="/admin" className="text-sm text-gray-500 underline">Setup</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg border p-3 bg-gray-50 border-gray-200 text-gray-700">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs font-medium">Total measures</div>
        </div>
        <div className={`rounded-lg border p-3 ${stats.withContent > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
          <div className="text-2xl font-bold">{stats.withContent}</div>
          <div className="text-xs font-medium">With real content ({stats.total > 0 ? Math.round((stats.withContent / stats.total) * 100) : 0}%)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search measures..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm"
          />
        </div>
        <select value={electionFilter} onChange={(e) => setElectionFilter(e.target.value)} className="border border-gray-200 rounded-md px-3 py-2 text-sm">
          <option value="">All Elections</option>
          {uniqueElectionDates.map((d) => (
            <option key={d} value={d}>{getFormattedElectionNameFromDate(d)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Election</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Content</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-midnight-navy">{m.title}</div>
                    <div className="text-xs text-gray-400">ID: {m.id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {getFormattedElectionNameFromDate(m.electionDate)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-6 h-6 rounded-full text-xs leading-6 ${hasRealContent(m) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-300'}`}>
                      {hasRealContent(m) ? '✓' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/ballot-measures/${m.id}`} className="text-civic-blue hover:underline text-xs font-medium">
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400">No measures match your filters.</div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-400 mt-4 text-right">
        Showing {filtered.length} of {measures.length} measures
      </div>
    </div>
  );
};

export default AdminBallotMeasuresPage;
