import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { DistrictType, Office, OfficeLevel } from '../../types';
import { useElectionData } from '../../services/electionDataStore';
import { saveOffice, deleteOffice, newOfficeId } from '../../services/adminEntryService';
import { slugify } from '../../services/races';

const LEVELS: { value: OfficeLevel; label: string }[] = [
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'judicial', label: 'Judicial' },
  { value: 'parish', label: 'Parish' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'other', label: 'Other' },
];

const DISTRICT_TYPES: { value: DistrictType; label: string }[] = [
  { value: 'statewide', label: 'Statewide (everyone in LA)' },
  { value: 'congressional', label: 'U.S. House district' },
  { value: 'state-senate', label: 'State Senate district' },
  { value: 'state-house', label: 'State House district' },
  { value: 'bese', label: 'BESE district' },
  { value: 'psc', label: 'Public Service Commission district' },
  { value: 'supreme-court', label: 'Supreme Court district' },
  { value: 'judicial', label: 'Judicial district / court' },
  { value: 'parishwide', label: 'Parishwide' },
  { value: 'parish-council', label: 'Parish/Metro council district' },
  { value: 'school-board', label: 'School board district' },
  { value: 'municipal', label: 'City/town' },
  { value: 'justice-of-the-peace', label: 'Justice of the Peace ward/district' },
  { value: 'constable', label: 'Constable ward/district' },
  { value: 'other', label: 'Other' },
];

const field = 'w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm';

const OfficeRow: React.FC<{ office: Office; inUse: number; isNew?: boolean; onDone?: () => void }> = ({ office, inUse, isNew, onDone }) => {
  const [o, setO] = useState<Office>(office);
  const [editing, setEditing] = useState(!!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!o.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveOffice({ ...o, id: isNew ? newOfficeId() : o.id, slug: slugify(o.name) });
      setEditing(false);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const msg = inUse > 0
      ? `"${office.name}" is used by ${inUse} candidate(s) or race(s). Deleting it will hide their office name. Delete anyway?`
      : `Delete "${office.name}"?`;
    if (window.confirm(msg)) await deleteOffice(office.id);
  }

  const levelLabel = LEVELS.find((l) => l.value === office.level)?.label ?? '—';
  const typeLabel = DISTRICT_TYPES.find((d) => d.value === office.districtType)?.label ?? 'Not set';

  if (!editing) {
    return (
      <tr className="border-t">
        <td className="px-3 py-2 font-medium text-midnight-navy">{office.name}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{levelLabel}</td>
        <td className={`px-3 py-2 text-sm ${office.districtType ? 'text-gray-600' : 'text-amber-700'}`}>{typeLabel}</td>
        <td className="px-3 py-2 text-sm text-gray-500">{inUse}</td>
        <td className="px-3 py-2 text-sm text-right space-x-3 whitespace-nowrap">
          <button onClick={() => setEditing(true)} className="text-civic-blue underline">Edit</button>
          <button onClick={remove} className="text-red-600 underline">Delete</button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t bg-blue-50/40">
      <td className="px-3 py-2"><input className={field} value={o.name} placeholder="e.g. Agriculture Commissioner" onChange={(e) => setO({ ...o, name: e.target.value })} /></td>
      <td className="px-3 py-2">
        <select className={field} value={o.level || ''} onChange={(e) => setO({ ...o, level: (e.target.value || undefined) as OfficeLevel })}>
          <option value="">—</option>
          {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select className={field} value={o.districtType || ''} onChange={(e) => setO({ ...o, districtType: (e.target.value || undefined) as DistrictType })}>
          <option value="">Not set</option>
          {DISTRICT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">{inUse}</td>
      <td className="px-3 py-2 text-sm text-right whitespace-nowrap space-x-2">
        {error && <span className="text-red-600 text-xs">{error}</span>}
        <button onClick={save} disabled={saving} className="bg-civic-blue text-white px-3 py-1 rounded-md disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={() => { setO(office); setEditing(false); onDone?.(); }} className="text-gray-600 underline">Cancel</button>
      </td>
    </tr>
  );
};

const AdminOfficesPage: React.FC = () => {
  const { offices, candidates, races } = useElectionData();
  const [adding, setAdding] = useState(false);
  const usage = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of candidates) m.set(c.officeId, (m.get(c.officeId) || 0) + 1);
    for (const r of races) if (!r._deleted) m.set(r.officeId, (m.get(r.officeId) || 0) + 1);
    return m;
  }, [candidates, races]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Admin: Offices</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">
            The offices races can be for. The <strong>district type</strong> tells the app which district map decides who
            votes in each race (used for address → ballot).
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!adding && (
            <button onClick={() => setAdding(true)} className="text-sm bg-civic-blue text-white px-3 py-1.5 rounded-md font-medium flex items-center gap-1">
              <PlusIcon className="h-4 w-4" /> New office
            </button>
          )}
          <Link to="/admin/elections" className="text-sm text-civic-blue underline">Elections</Link>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">Office</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">District type</th>
              <th className="px-3 py-2">In use</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <OfficeRow office={{ id: 0, name: '', slug: '' }} inUse={0} isNew onDone={() => setAdding(false)} />
            )}
            {offices.map((o) => (
              <OfficeRow key={o.id} office={o} inUse={usage.get(o.id) || 0} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOfficesPage;
