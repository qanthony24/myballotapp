import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { Cycle } from '../../types';
import { useElectionData } from '../../services/electionDataStore';
import { saveElection, deleteElection, newElectionId } from '../../services/adminEntryService';
import { racesForElection, slugify } from '../../services/races';
import { isElectionPast } from '../../services/dataService';

const emptyElection = (): Cycle => ({ id: 0, name: '', slug: '', electionDate: '', evStart: '', evEnd: '', coverageNote: '' });

const field = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-600 mb-1';

/** Louisiana early voting usually runs 14 to 7 days before election day. */
function suggestEarlyVoting(date: string): { evStart: string; evEnd: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { evStart: '', evEnd: '' };
  const d = new Date(date + 'T12:00:00');
  const shift = (days: number) => new Date(d.getTime() - days * 86400000).toISOString().slice(0, 10);
  return { evStart: shift(14), evEnd: shift(7) };
}

const ElectionForm: React.FC<{ initial: Cycle; onDone: () => void }> = ({ initial, onDone }) => {
  const [e, setE] = useState<Cycle>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = initial.id === 0;

  async function handleSave() {
    if (!e.name.trim() || !e.electionDate) {
      setError('Name and election date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = isNew ? newElectionId() : e.id;
      await saveElection({ ...e, id, slug: slugify(e.name), coverageNote: e.coverageNote?.trim() || '' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-blue-50/40 border border-civic-blue/30 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={label}>Name (e.g. "2027 Primary")</label>
          <input className={field} value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} />
        </div>
        <div>
          <label className={label}>Election day</label>
          <input
            type="date"
            className={field}
            value={e.electionDate}
            onChange={(ev) => {
              const date = ev.target.value;
              // Pre-fill early voting the first time a date is chosen.
              setE({ ...e, electionDate: date, ...(e.evStart || e.evEnd ? {} : suggestEarlyVoting(date)) });
            }}
          />
        </div>
        <div>
          <label className={label}>Early voting starts</label>
          <input type="date" className={field} value={e.evStart} onChange={(ev) => setE({ ...e, evStart: ev.target.value })} />
        </div>
        <div>
          <label className={label}>Early voting ends</label>
          <input type="date" className={field} value={e.evEnd} onChange={(ev) => setE({ ...e, evEnd: ev.target.value })} />
        </div>
      </div>
      <div>
        <label className={label}>Coverage note (optional; shown to voters in the banner, e.g. when not every race is listed yet)</label>
        <input className={field} value={e.coverageNote || ''} onChange={(ev) => setE({ ...e, coverageNote: ev.target.value })} />
      </div>
      <p className="text-xs text-gray-500">Early voting is pre-filled with Louisiana's usual window (14 to 7 days before). Check it against the Secretary of State's calendar.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="bg-civic-blue text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : isNew ? 'Create election' : 'Save changes'}
        </button>
        <button onClick={onDone} className="px-4 py-2 rounded-md text-sm text-gray-600 border border-gray-200">Cancel</button>
      </div>
    </div>
  );
};

const AdminElectionsPage: React.FC = () => {
  const { cycles, races, candidates, offices, results } = useElectionData();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const raceCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of cycles) m.set(c.id, racesForElection(c.id, races, candidates, offices).length);
    return m;
  }, [cycles, races, candidates, offices]);

  async function handleDelete(c: Cycle) {
    const n = raceCounts.get(c.id) || 0;
    const msg = n > 0
      ? `Delete "${c.name}"? It has ${n} race(s). Candidates keep their profiles, but this election disappears from the app.`
      : `Delete "${c.name}"?`;
    if (!window.confirm(msg)) return;
    await deleteElection(c.id);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Admin: Elections</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">Elections, their dates, and links to each election's races and results</p>
        </div>
        <div className="flex items-center gap-4">
          {!creating && (
            <button onClick={() => { setCreating(true); setEditingId(null); }} className="text-sm bg-civic-blue text-white px-3 py-1.5 rounded-md font-medium flex items-center gap-1">
              <PlusIcon className="h-4 w-4" /> New election
            </button>
          )}
          <Link to="/admin/offices" className="text-sm text-civic-blue underline">Offices</Link>
          <Link to="/admin" className="text-sm text-gray-500 underline">Setup</Link>
        </div>
      </div>

      {creating && (
        <div className="mb-6">
          <ElectionForm initial={emptyElection()} onDone={() => setCreating(false)} />
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y">
        {cycles.map((c) => {
          const past = isElectionPast(c.electionDate);
          const hasResults = results.some((r) => r._docId === String(c.id));
          return (
            <div key={c.id} className="p-4">
              {editingId === c.id ? (
                <ElectionForm initial={{ ...emptyElection(), ...c }} onDone={() => setEditingId(null)} />
              ) : (
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-midnight-navy">{c.name}</span>
                      {past ? (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Past</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Upcoming</span>
                      )}
                      {c.coverageNote && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Has voter note</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {c.electionDate}
                      {c.evStart && c.evEnd && <> · early voting {c.evStart} → {c.evEnd}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Link to={`/admin/elections/${c.id}/races`} className="bg-midnight-navy text-white px-3 py-1.5 rounded-md">
                      Races ({raceCounts.get(c.id) || 0})
                    </Link>
                    <Link to={`/admin/results/${c.id}`} className="text-civic-blue underline">
                      {hasResults ? 'Edit results' : 'Enter results'}
                    </Link>
                    <button onClick={() => { setEditingId(c.id); setCreating(false); }} className="text-civic-blue underline">Edit</button>
                    <button onClick={() => handleDelete(c)} className="text-red-600 underline">Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminElectionsPage;
