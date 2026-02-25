import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Candidate, Office, Cycle } from '../../types';
import { getFirestoreCandidates, getLocalOffices, getLocalCycles } from '../../services/firestoreDataService';
import { MagnifyingGlassIcon, PencilSquareIcon, PhotoIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';

const AdminCandidatesPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');

  const offices = getLocalOffices();
  const cycles = getLocalCycles();
  const officeMap = useMemo(() => new Map(offices.map((o) => [o.id, o])), [offices]);
  const cycleMap = useMemo(() => new Map(cycles.map((c) => [c.id, c])), [cycles]);

  useEffect(() => {
    loadCandidates();
  }, []);

  async function loadCandidates() {
    setLoading(true);
    const data = await getFirestoreCandidates();
    setCandidates(data);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase());
      const matchesOffice = !officeFilter || c.officeId === parseInt(officeFilter);
      const matchesCycle = !cycleFilter || c.cycleId === parseInt(cycleFilter);
      return matchesSearch && matchesOffice && matchesCycle;
    });
  }, [candidates, search, officeFilter, cycleFilter]);

  const hasPhoto = (c: Candidate) => c.photoUrl && !c.photoUrl.includes('picsum.photos') && !c.photoUrl.includes('randomuser.me');
  const hasBio = (c: Candidate) => c.bio && !c.bio.startsWith('This is the detailed biography for Candidate');
  const hasSurvey = (c: Candidate) => {
    const responses = Object.values(c.surveyResponses || {});
    return responses.some((r) => r && !r.startsWith('Candidate '));
  };

  const stats = useMemo(() => {
    const total = candidates.length;
    const withPhoto = candidates.filter(hasPhoto).length;
    const withBio = candidates.filter(hasBio).length;
    const withSurvey = candidates.filter(hasSurvey).length;
    return { total, withPhoto, withBio, withSurvey };
  }, [candidates]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Admin: Candidates</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">Edit candidate details, photos, bios, and survey responses</p>
        </div>
        <Link to="/" className="text-sm text-civic-blue underline">← Back to app</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Have photo" value={stats.withPhoto} total={stats.total} color="green" />
        <StatCard label="Have bio" value={stats.withBio} total={stats.total} color="blue" />
        <StatCard label="Have survey" value={stats.withSurvey} total={stats.total} color="purple" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm"
          />
        </div>
        <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)} className="border border-gray-200 rounded-md px-3 py-2 text-sm">
          <option value="">All Offices</option>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="border border-gray-200 rounded-md px-3 py-2 text-sm">
          <option value="">All Elections</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Candidate table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading candidates...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Candidate</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Office</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Election</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Data</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const office = officeMap.get(c.officeId);
                const cycle = cycleMap.get(c.cycleId);
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={c.photoUrl || 'https://via.placeholder.com/32'}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover bg-gray-200"
                          onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/32'; }}
                        />
                        <div>
                          <div className="font-medium text-midnight-navy">{c.firstName} {c.lastName}</div>
                          <div className="text-xs text-gray-500">{c.party}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {office?.name}{c.district ? `, ${c.district}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {cycle?.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <DataDot present={hasPhoto(c)} icon={<PhotoIcon className="h-3.5 w-3.5" />} label="Photo" />
                        <DataDot present={hasBio(c)} icon={<ChatBubbleBottomCenterTextIcon className="h-3.5 w-3.5" />} label="Bio" />
                        <DataDot present={hasSurvey(c)} icon={<PencilSquareIcon className="h-3.5 w-3.5" />} label="Survey" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/candidates/${c.id}`}
                        className="text-civic-blue hover:underline text-xs font-medium"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400">No candidates match your filters.</div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-400 mt-4 text-right">
        Showing {filtered.length} of {candidates.length} candidates
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; total?: number; color?: string }> = ({ label, value, total, color }) => {
  const pct = total ? Math.round((value / total) * 100) : null;
  const colorMap: Record<string, string> = {
    green: 'text-green-700 bg-green-50 border-green-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    purple: 'text-purple-700 bg-purple-50 border-purple-200',
  };
  const classes = color ? colorMap[color] : 'text-gray-700 bg-gray-50 border-gray-200';
  return (
    <div className={`rounded-lg border p-3 ${classes}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}{pct != null ? ` (${pct}%)` : ''}</div>
    </div>
  );
};

const DataDot: React.FC<{ present: boolean; icon: React.ReactNode; label: string }> = ({ present, icon, label }) => (
  <span
    title={`${label}: ${present ? 'Yes' : 'Missing'}`}
    className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${present ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-300'}`}
  >
    {icon}
  </span>
);

export default AdminCandidatesPage;
