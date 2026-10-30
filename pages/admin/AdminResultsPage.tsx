import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Office, Race } from '../../types';
import type { ContestResult, ResultItem } from '../../types/info';
import { useElectionData } from '../../services/electionDataStore';
import { saveResults, StoredResults } from '../../services/adminEntryService';
import { racesForElection, candidatesInRace } from '../../services/races';
import { getBallotMeasuresByElectionDate } from '../../services/dataService';

const field = 'border border-gray-200 rounded-md px-2 py-1 text-sm';

interface ContestDraft {
  votes: Record<string, string>; // itemId -> typed vote count
  called: boolean;
}
interface Draft {
  published: boolean;
  ballotsCast: string;
  registeredVoters: string;
  contests: Record<string, ContestDraft>; // contestId -> draft
}

const toNum = (s: string | undefined) => {
  const n = parseInt((s || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);

function raceTitle(race: Race, offices: Office[]): string {
  const name = offices.find((o) => o.id === race.officeId)?.name ?? `Office #${race.officeId}`;
  return race.district ? `${name}, ${race.district}` : name;
}

const AdminResultsPage: React.FC = () => {
  const { electionId: idParam } = useParams<{ electionId: string }>();
  const navigate = useNavigate();
  const { cycles, races, candidates, offices, results, version } = useElectionData();
  const electionId = Number(idParam);
  const election = cycles.find((c) => c.id === electionId);
  const saved = results.find((r) => r._docId === String(electionId));

  const raceList = useMemo(() => racesForElection(electionId, races, candidates, offices), [electionId, races, candidates, offices]);
  const measures = useMemo(
    () => (election ? getBallotMeasuresByElectionDate(election.electionDate) : []),
    [election, version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load the saved results into the form once per election (later live updates don't overwrite typing).
  useEffect(() => {
    const contests: Record<string, ContestDraft> = {};
    for (const c of saved?.contests ?? []) {
      contests[c.contestId] = {
        called: c.called,
        votes: Object.fromEntries(c.resultItems.map((i) => [i.id, String(i.votes)])),
      };
    }
    setDraft({
      published: !!saved?.published,
      ballotsCast: saved?.turnout?.ballotsCast ? String(saved.turnout.ballotsCast) : '',
      registeredVoters: saved?.turnout?.registeredVoters ? String(saved.turnout.registeredVoters) : '',
      contests,
    });
    setDirty(false);
    setMessage(null);
  }, [electionId, !!saved]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!election) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12 text-gray-500">
        Election not found. <Link to="/admin/elections" className="text-civic-blue underline">Back to elections</Link>
      </div>
    );
  }
  if (!draft) return null;

  const update = (fn: (d: Draft) => Draft) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
  };
  const contestDraft = (id: string): ContestDraft => draft.contests[id] ?? { votes: {}, called: false };
  const setVotes = (contestId: string, itemId: string, value: string) =>
    update((d) => ({ ...d, contests: { ...d.contests, [contestId]: { ...contestDraft(contestId), votes: { ...contestDraft(contestId).votes, [itemId]: value } } } }));
  const setCalled = (contestId: string, called: boolean) =>
    update((d) => ({ ...d, contests: { ...d.contests, [contestId]: { ...contestDraft(contestId), called } } }));

  /** Build the stored results from the form. Winners = top N by votes (N = seats) once a race is called. */
  function buildResults(): StoredResults {
    const contests: ContestResult[] = [];
    for (const race of raceList) {
      const cd = contestDraft(race.id);
      const items = candidatesInRace(race, candidates).map((c) => ({
        id: String(c.id),
        name: `${c.firstName} ${c.lastName}`.trim(),
        party: c.party,
        votes: toNum(cd.votes[String(c.id)]),
        incumbent: !!c.isIncumbent,
      }));
      const total = items.reduce((n, i) => n + i.votes, 0);
      if (total === 0 && !cd.called) continue; // nothing entered for this race yet
      const sorted = [...items].sort((a, b) => b.votes - a.votes);
      const seats = race.seats ?? 1;
      const winners = cd.called ? new Set(sorted.slice(0, seats).map((i) => i.id)) : new Set<string>();
      const resultItems: ResultItem[] = sorted.map((i) => ({ ...i, votePercent: pct(i.votes, total), isWinner: winners.has(i.id) }));
      contests.push({
        contestId: race.id,
        title: raceTitle(race, offices),
        officeName: offices.find((o) => o.id === race.officeId)?.name,
        district: race.district || undefined,
        contestType: 'candidate',
        totalVotes: total,
        called: cd.called,
        winnerId: cd.called ? sorted[0]?.id : undefined,
        resultItems,
      });
    }
    for (const m of measures) {
      const id = `measure-${m.id}`;
      const cd = contestDraft(id);
      const yes = toNum(cd.votes.yes);
      const no = toNum(cd.votes.no);
      const total = yes + no;
      if (total === 0 && !cd.called) continue;
      const winner = cd.called ? (yes > no ? 'yes' : 'no') : undefined;
      contests.push({
        contestId: id,
        title: m.title,
        contestType: 'measure',
        totalVotes: total,
        called: cd.called,
        winnerId: winner,
        resultItems: [
          { id: 'yes', name: 'Yes', votes: yes, votePercent: pct(yes, total), isWinner: winner === 'yes' },
          { id: 'no', name: 'No', votes: no, votePercent: pct(no, total), isWinner: winner === 'no' },
        ],
      });
    }
    const ballotsCast = toNum(draft!.ballotsCast);
    const registeredVoters = toNum(draft!.registeredVoters);
    return {
      electionId: String(election!.id),
      electionName: election!.name,
      electionDate: election!.electionDate,
      electionType: /primary/i.test(election!.name) ? 'primary' : 'general',
      jurisdiction: 'Louisiana',
      turnout:
        ballotsCast || registeredVoters
          ? { ballotsCast: ballotsCast || undefined, registeredVoters: registeredVoters || undefined, turnoutPercent: registeredVoters ? pct(ballotsCast, registeredVoters) : undefined }
          : undefined,
      contests,
      published: draft!.published,
    };
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const r = buildResults();
      await saveResults(electionId, r);
      setDirty(false);
      setMessage(`Saved ${r.contests.length} race(s)${r.published ? ' — live for voters.' : ' — not published, so voters can’t see them yet.'}`);
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  // A plain render function (not a nested component) so inputs keep focus while typing.
  const voteRow = (contestId: string, itemId: string, label: string, total: number, sub?: string) => {
    const v = toNum(contestDraft(contestId).votes[itemId]);
    return (
      <div key={itemId} className="flex items-center gap-3 py-1.5">
        <div className="flex-1 text-sm">
          <span className="font-medium text-midnight-navy">{label}</span>
          {sub && <span className="text-gray-500"> · {sub}</span>}
        </div>
        <input
          inputMode="numeric"
          className={`${field} w-32 text-right`}
          placeholder="0"
          value={contestDraft(contestId).votes[itemId] ?? ''}
          onChange={(e) => setVotes(contestId, itemId, e.target.value)}
        />
        <span className="w-14 text-right text-xs text-gray-500">{pct(v, total)}%</span>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Results: {election.name}</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">{election.electionDate} · {raceList.length} race(s){measures.length ? `, ${measures.length} measure(s)` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="border border-gray-200 rounded-md px-2 py-1.5 text-sm" value={electionId} onChange={(e) => navigate(`/admin/results/${e.target.value}`)}>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.electionDate})</option>)}
          </select>
          <Link to={`/admin/elections/${electionId}/races`} className="text-sm text-civic-blue underline">Races</Link>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky top-28 z-20 bg-white border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-3 shadow-sm">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-civic-blue" checked={draft.published} onChange={(e) => update((d) => ({ ...d, published: e.target.checked }))} />
          <span><strong>Published</strong>: voters can see these results</span>
        </label>
        <div className="flex-1 text-sm">
          {dirty ? <span className="text-amber-700">Unsaved changes</span> : saved ? <span className="text-gray-500">All changes saved</span> : <span className="text-gray-500">No results saved yet</span>}
          {message && <span className="block text-gray-700">{message}</span>}
        </div>
        <button onClick={handleSave} disabled={saving || !dirty} className="bg-civic-blue text-white px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save results'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ballots cast</label>
          <input inputMode="numeric" className={`${field} w-full`} value={draft.ballotsCast} onChange={(e) => update((d) => ({ ...d, ballotsCast: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Registered voters</label>
          <input inputMode="numeric" className={`${field} w-full`} value={draft.registeredVoters} onChange={(e) => update((d) => ({ ...d, registeredVoters: e.target.value }))} />
        </div>
        <div className="text-sm text-gray-600">
          Turnout: <strong>{toNum(draft.registeredVoters) ? `${pct(toNum(draft.ballotsCast), toNum(draft.registeredVoters))}%` : '—'}</strong>
        </div>
      </div>

      {raceList.length === 0 && measures.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 text-sm">
          This election has no races yet. <Link to={`/admin/elections/${electionId}/races`} className="text-civic-blue underline">Set up races first.</Link>
        </div>
      )}

      {raceList.map((race) => {
        const people = candidatesInRace(race, candidates);
        const cd = contestDraft(race.id);
        const total = people.reduce((n, c) => n + toNum(cd.votes[String(c.id)]), 0);
        return (
          <div key={race.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-midnight-navy">{raceTitle(race, offices)}</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-civic-blue" checked={cd.called} onChange={(e) => setCalled(race.id, e.target.checked)} />
                Called{(race.seats ?? 1) > 1 ? ` (top ${race.seats} win)` : ''}
              </label>
            </div>
            {people.length === 0 && <p className="text-sm text-gray-400">No candidates in this race.</p>}
            {people.map((c) => (
              voteRow(race.id, String(c.id), `${c.firstName} ${c.lastName}`, total, c.party)
            ))}
            <div className="text-xs text-gray-500 text-right mt-1">Total: {total.toLocaleString()}</div>
          </div>
        );
      })}

      {measures.map((m) => {
        const id = `measure-${m.id}`;
        const cd = contestDraft(id);
        const total = toNum(cd.votes.yes) + toNum(cd.votes.no);
        return (
          <div key={id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-midnight-navy">{m.title}</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-civic-blue" checked={cd.called} onChange={(e) => setCalled(id, e.target.checked)} />
                Called
              </label>
            </div>
            {voteRow(id, 'yes', 'Yes', total)}
            {voteRow(id, 'no', 'No', total)}
          </div>
        );
      })}

      <p className="text-xs text-gray-500">
        Results are saved per election. Races with no votes entered and not marked called are left out. When a race is
        called, the top vote-getter(s) are marked as winners. Louisiana results are unofficial until certified by the
        Secretary of State.
      </p>
    </div>
  );
};

export default AdminResultsPage;
