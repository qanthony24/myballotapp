import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlusIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { Candidate, Office, Race } from '../../types';
import { useElectionData } from '../../services/electionDataStore';
import {
  saveRace,
  deleteRace,
  addCandidateToRace,
  removeCandidateFromElection,
  importRaces,
} from '../../services/adminEntryService';
import {
  racesForElection,
  candidatesInRace,
  raceId,
  parseRacesCsv,
  normalizeParty,
  RACES_CSV_TEMPLATE,
  ParsedRaceRow,
} from '../../services/races';
import { getAllParties } from '../../lib/parties';
import { raceDistrictKey } from '../../services/ballotScope';

const field = 'w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm';
const label = 'block text-xs font-medium text-gray-600 mb-1';

function raceTitle(race: Race, offices: Office[]): string {
  const office = offices.find((o) => o.id === race.officeId);
  const name = office?.name ?? `Office #${race.officeId}`;
  return race.district ? `${name}, ${race.district}` : name;
}

// ---- Race editor (new or existing) ----

const RaceForm: React.FC<{ electionId: number; offices: Office[]; initial?: Race; onDone: () => void }> = ({ electionId, offices, initial, onDone }) => {
  const [r, setR] = useState<Race>(
    initial ?? { id: '', electionId, officeId: offices[0]?.id ?? 0, district: '', districtKey: '', seats: 1 },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !initial || initial._inferred;

  async function save() {
    if (!r.officeId) {
      setError('Pick an office.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Changing office/district on an existing race would orphan its candidates, so those fields are locked after creation.
      const id = initial && !initial._inferred ? initial.id : raceId(electionId, r.officeId, r.district);
      await saveRace({ ...r, id, electionId, _inferred: undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const locked = !!initial && !initial._inferred;
  return (
    <div className="bg-blue-50/40 border border-civic-blue/30 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <label className={label}>Office</label>
          <select className={field} disabled={locked} value={r.officeId} onChange={(e) => setR({ ...r, officeId: Number(e.target.value) })}>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>District (shown to voters)</label>
          <input className={field} disabled={locked} placeholder="e.g. District 61" value={r.district || ''} onChange={(e) => setR({ ...r, district: e.target.value })} />
        </div>
        <div>
          <label className={label}>District key (for address lookup)</label>
          <input className={field} placeholder="e.g. la-house-61" value={r.districtKey || ''} onChange={(e) => setR({ ...r, districtKey: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Seats</label>
            <input type="number" min={1} className={field} value={r.seats ?? 1} onChange={(e) => setR({ ...r, seats: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
          <div>
            <label className={label}>Order</label>
            <input type="number" className={field} value={r.ballotOrder ?? ''} onChange={(e) => setR({ ...r, ballotOrder: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </div>
        </div>
      </div>
      {locked && <p className="text-xs text-gray-500">Office and district can't change once a race is saved (its candidates are matched by them). Delete and re-create the race instead.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="bg-civic-blue text-white px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : isNew ? 'Save race' : 'Save changes'}
        </button>
        <button onClick={onDone} className="px-4 py-1.5 rounded-md text-sm text-gray-600 border border-gray-200">Cancel</button>
      </div>
    </div>
  );
};

// ---- One race card ----

const RaceCard: React.FC<{ race: Race; offices: Office[]; candidates: Candidate[]; electionId: number }> = ({ race, offices, candidates, electionId }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [party, setParty] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inRace = candidatesInRace(race, candidates);

  async function addCandidate() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      if (race._inferred) await saveRace({ ...race, _inferred: undefined });
      const res = await addCandidateToRace(race, { name: name.trim(), party: normalizeParty(party) });
      setMsg(res.reused ? `${name.trim()} already had a profile for this office, so they were added to this election.` : null);
      setName('');
      setParty('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not add candidate');
    } finally {
      setBusy(false);
    }
  }

  async function removeRace() {
    const msg = inRace.length
      ? `Delete this race? Its ${inRace.length} candidate(s) will also be taken off this election's ballot (their profiles are kept).`
      : 'Delete this race?';
    if (!window.confirm(msg)) return;
    for (const c of inRace) await removeCandidateFromElection(c, electionId);
    if (!race._inferred) await deleteRace(race.id);
  }

  if (editing) return <RaceForm electionId={electionId} offices={offices} initial={race} onDone={() => setEditing(false)} />;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-midnight-navy">{raceTitle(race, offices)}</h3>
            {race._inferred && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded" title="Candidates are assigned to this office/district, but the race itself hasn't been saved.">
                Not saved yet
              </span>
            )}
            {(race.seats ?? 1) > 1 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{race.seats} seats</span>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {race.districtKey ? (
              <>District key: <code>{race.districtKey}</code></>
            ) : raceDistrictKey(race, offices) ? (
              <>District key: <code>{raceDistrictKey(race, offices)}</code> (automatic)</>
            ) : (
              <span className="text-amber-700">Needs a district key for address matching (voters will see this race as “might be on your ballot”)</span>
            )}
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          {race._inferred ? (
            <button onClick={() => saveRace({ ...race, _inferred: undefined })} className="bg-amber-500 text-white px-3 py-1 rounded-md">Save race</button>
          ) : null}
          <button onClick={() => setEditing(true)} className="text-civic-blue underline">Edit</button>
          <button onClick={removeRace} className="text-red-600 underline">Delete</button>
        </div>
      </div>

      <ul className="mt-3 divide-y border rounded-md">
        {inRace.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No candidates yet.</li>}
        {inRace.map((c) => (
          <li key={c.id} className="px-3 py-2 flex items-center justify-between text-sm">
            <span>
              <span className="font-medium text-midnight-navy">{c.firstName} {c.lastName}</span>
              {c.party && <span className="text-gray-500"> · {c.party}</span>}
              {c.isIncumbent && <span className="text-xs text-gray-500"> · incumbent</span>}
            </span>
            <span className="space-x-3 whitespace-nowrap">
              <Link to={`/admin/candidates/${c.id}`} className="text-civic-blue underline">Edit profile</Link>
              <button
                onClick={() => window.confirm(`Take ${c.firstName} ${c.lastName} off this election's ballot? Their profile is kept.`) && removeCandidateFromElection(c, electionId)}
                className="text-red-600 underline"
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-col md:flex-row gap-2">
        <input
          className={`${field} md:flex-1`}
          placeholder="Add candidate: full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCandidate()}
        />
        <select className={`${field} md:w-48`} value={party} onChange={(e) => setParty(e.target.value)}>
          <option value="">Party…</option>
          {getAllParties().map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button onClick={addCandidate} disabled={busy || !name.trim()} className="bg-midnight-navy text-white px-4 py-1.5 rounded-md text-sm disabled:opacity-50 flex items-center gap-1 justify-center">
          <PlusIcon className="h-4 w-4" /> Add
        </button>
      </div>
      {msg && <p className="text-xs text-gray-600 mt-2">{msg}</p>}
    </div>
  );
};

// ---- CSV import panel ----

const CsvImport: React.FC<{ electionId: number; offices: Office[] }> = ({ electionId, offices }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseRacesCsv(text, offices) : { rows: [] as ParsedRaceRow[], errors: [] as string[] }), [text, offices]);

  function downloadTemplate() {
    const blob = new Blob([RACES_CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'races-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setText(await f.text());
  }

  async function runImport() {
    setBusy(true);
    setResult(null);
    try {
      const r = await importRaces(electionId, parsed.rows);
      setResult(`Imported ${r.races} race(s): ${r.candidatesAdded} new candidate(s), ${r.candidatesReused} existing candidate(s) added to this election.`);
      setText('');
    } catch (err) {
      setResult(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const candidateCount = parsed.rows.reduce((n, r) => n + r.candidates.length, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-midnight-navy">Import races from a spreadsheet (CSV)</h2>
        <button onClick={downloadTemplate} className="text-sm text-civic-blue underline flex items-center gap-1">
          <ArrowDownTrayIcon className="h-4 w-4" /> Template
        </button>
      </div>
      <p className="text-xs text-gray-500">
        One row per race. Columns: <code>office</code> (name as listed under Offices), <code>district</code>, <code>district_key</code>,{' '}
        <code>seats</code>, <code>ballot_order</code>, <code>candidates</code> written like <code>Jane Doe (R); John Roe (D)</code>.
        Re-importing is safe: existing races update, and existing candidates are reused, not duplicated.
      </p>
      <div className="flex gap-2 items-center">
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <span className="text-xs text-gray-400">or paste below</span>
      </div>
      <textarea className={`${field} font-mono h-28`} value={text} onChange={(e) => setText(e.target.value)} placeholder={RACES_CSV_TEMPLATE} />
      {text.trim() && (
        <div className="text-sm">
          <p className="text-gray-700">Ready to import: <strong>{parsed.rows.length}</strong> race(s), <strong>{candidateCount}</strong> candidate(s).</p>
          {parsed.errors.length > 0 && (
            <ul className="text-red-600 text-xs mt-1 list-disc ml-5">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          )}
        </div>
      )}
      {result && <p className="text-sm text-green-700">{result}</p>}
      <button onClick={runImport} disabled={busy || parsed.rows.length === 0} className="bg-civic-blue text-white px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
        {busy ? 'Importing…' : `Import ${parsed.rows.length || ''} race(s)`}
      </button>
    </div>
  );
};

// ---- Page ----

const AdminRacesPage: React.FC = () => {
  const { electionId: idParam } = useParams<{ electionId: string }>();
  const navigate = useNavigate();
  const { cycles, races, candidates, offices } = useElectionData();
  const electionId = Number(idParam);
  const election = cycles.find((c) => c.id === electionId);
  const [adding, setAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const list = useMemo(() => racesForElection(electionId, races, candidates, offices), [electionId, races, candidates, offices]);
  const unsaved = list.filter((r) => r._inferred).length;
  const missingKeys = list.filter((r) => !raceDistrictKey(r, offices)).length;

  if (!election) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12 text-gray-500">
        Election not found. <Link to="/admin/elections" className="text-civic-blue underline">Back to elections</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Races: {election.name}</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">
            {election.electionDate} · {list.length} race(s)
            {unsaved > 0 && <> · <span className="text-amber-700">{unsaved} not saved yet</span></>}
            {missingKeys > 0 && <> · <span className="text-amber-700">{missingKeys} need a district key</span></>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="border border-gray-200 rounded-md px-2 py-1.5 text-sm" value={electionId} onChange={(e) => navigate(`/admin/elections/${e.target.value}/races`)}>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.electionDate})</option>)}
          </select>
          <Link to={`/admin/results/${electionId}`} className="text-sm text-civic-blue underline">Results</Link>
          <Link to="/admin/elections" className="text-sm text-gray-500 underline">Elections</Link>
        </div>
      </div>

      <div className="flex gap-2">
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-sm bg-civic-blue text-white px-3 py-1.5 rounded-md font-medium flex items-center gap-1">
            <PlusIcon className="h-4 w-4" /> New race
          </button>
        )}
        <button onClick={() => setShowImport((v) => !v)} className="text-sm border border-gray-200 px-3 py-1.5 rounded-md">
          {showImport ? 'Hide CSV import' : 'Import from CSV'}
        </button>
      </div>

      {adding && <RaceForm electionId={electionId} offices={offices} onDone={() => setAdding(false)} />}
      {showImport && <CsvImport electionId={electionId} offices={offices} />}

      {list.length === 0 && !adding && (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 text-sm">
          No races yet. Add one with <strong>New race</strong>, or import a spreadsheet.
        </div>
      )}
      {list.map((race) => (
        <RaceCard key={race.id} race={race} offices={offices} candidates={candidates} electionId={electionId} />
      ))}
    </div>
  );
};

export default AdminRacesPage;
