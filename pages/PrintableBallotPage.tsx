/**
 * Printable / shareable ballot.
 *
 *   /#/my-ballot/print            the voter's own picks for the selected election
 *   /#/ballot/shared/<payload>    someone else's picks, from a share link (read-only)
 *
 * Deliberately plain black-on-white: Louisiana lets voters bring a personal
 * sample ballot into the booth, but campaign material isn't allowed within
 * 600 feet of a polling place, so no logos, colors or party branding here.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PrinterIcon, ShareIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useBallot } from '../hooks/useBallot';
import { useVoterDistricts } from '../hooks/useVoterDistricts';
import { useElectionData } from '../services/electionDataStore';
import { getFormattedElectionNameFromDate } from '../services/dataService';
import { buildPrintableBallot, decodeSharedBallot, encodeSharedBallot, sharedToEntries, ballotAsText } from '../services/ballotShare';
import { trackEvent } from '../services/analytics';
import type { BallotEntry } from '../types';

const SOS_PORTAL = 'https://voterportal.sos.la.gov/';

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function shareUrlFor(electionDate: string, entries: BallotEntry[]): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/ballot/shared/${encodeSharedBallot(electionDate, entries)}`;
}

/** Native share sheet on phones; copy to clipboard elsewhere. Returns what happened. */
export async function shareBallot(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

const PrintableBallotPage: React.FC<{ mode: 'mine' | 'shared' }> = ({ mode }) => {
  const { payload } = useParams();
  const ballot = useBallot();
  const data = useElectionData();
  const { keys: voterKeys, saved } = useVoterDistricts();
  const [notice, setNotice] = useState<string | null>(null);

  const shared = useMemo(() => (mode === 'shared' && payload ? decodeSharedBallot(payload) : null), [mode, payload]);
  const electionDate = mode === 'shared' ? shared?.electionDate ?? null : ballot.selectedElectionDate;
  const cycle = data.cycles.find((c) => c.electionDate === electionDate);
  const entries: BallotEntry[] = useMemo(() => {
    if (mode === 'shared') return shared ? sharedToEntries(shared, data.candidates) : [];
    return ballot.currentElectionEntries;
  }, [mode, shared, data.candidates, ballot.currentElectionEntries]);

  const printable = useMemo(() => {
    if (!cycle || !electionDate) return null;
    return buildPrintableBallot({
      electionId: cycle.id,
      electionDate,
      entries,
      candidates: data.candidates,
      races: data.races,
      offices: data.offices,
      measures: data.ballotMeasures,
      // A shared ballot is filtered to the sender's picks only; the viewer's address doesn't apply.
      voterKeys: mode === 'mine' ? voterKeys : null,
    });
  }, [cycle, electionDate, entries, data, voterKeys, mode]);

  // In shared mode, only show the races the sender actually made a choice in.
  const races = printable ? (mode === 'shared' ? printable.races.filter((r) => r.choices.length) : printable.races) : [];
  const measures = printable ? (mode === 'shared' ? printable.measures.filter((m) => m.vote) : printable.measures) : [];
  const electionName = electionDate ? getFormattedElectionNameFromDate(electionDate) || cycle?.name || 'Election' : 'Election';

  if (mode === 'shared' && !shared) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold text-midnight-navy mb-2">This ballot link doesn't work</h1>
        <p className="text-slate-600 mb-6">It may have been cut off when it was copied. Ask the sender for the link again.</p>
        <Link to="/" className="text-civic-blue font-semibold underline">Build your own ballot</Link>
      </div>
    );
  }
  if (!electionDate || !cycle || !printable) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-slate-600 mb-6">We couldn't find that election.</p>
        <Link to="/my-ballot" className="text-civic-blue font-semibold underline">Back to My Ballot</Link>
      </div>
    );
  }

  async function onShare() {
    const url = shareUrlFor(electionDate!, entries);
    const result = await shareBallot(url, `My ballot: ${electionName}`, ballotAsText(electionName, { ...printable!, races, measures }));
    trackEvent('ballot_share', { result, source: 'print_page' });
    setNotice(result === 'copied' ? 'Link copied. Paste it into a text or email.' : result === 'failed' ? "Couldn't share or copy the link on this device." : null);
  }

  function onPrint() {
    trackEvent('ballot_print', { races: races.length, undecided: printable!.undecided });
    window.print();
  }

  function copyToMine() {
    if (!shared) return;
    if (!window.confirm(`Copy these choices onto your own ${electionName} ballot? Any choice you've already made in the same race will be replaced.`)) return;
    for (const e of entries) {
      if (e.itemType === 'candidate') {
        const c = data.candidates.find((x) => x.id === e.candidateId);
        if (c) ballot.addCandidateSelection(c, shared.electionDate);
      } else {
        ballot.setMeasureStance(e.measureId, e.vote, shared.electionDate);
      }
    }
    ballot.setSelectedElectionDate(shared.electionDate);
    trackEvent('ballot_copy_shared', { items: entries.length });
    setNotice('Copied to your ballot. Open My Ballot to review or change anything.');
  }

  return (
    <div className="max-w-2xl mx-auto print:max-w-none">
      {/* Toolbar (not printed) */}
      <div className="print:hidden mb-6 space-y-3">
        {mode === 'shared' ? (
          <div className="bg-sunlight-gold/20 border border-sunlight-gold rounded-lg p-4 text-midnight-navy">
            <p className="font-semibold">Someone shared their ballot choices with you.</p>
            <p className="text-sm mt-1">These are their picks, not a recommendation from MyBallot. Look up the candidates yourself, or build your own ballot.</p>
            <div className="flex flex-wrap gap-3 mt-3">
              <button onClick={copyToMine} className="bg-midnight-navy text-white font-semibold px-4 py-2 rounded-md">Copy to my ballot</button>
              <Link to="/" className="border border-midnight-navy text-midnight-navy font-semibold px-4 py-2 rounded-md">Build my own</Link>
            </div>
          </div>
        ) : (
          <Link to="/my-ballot" className="inline-flex items-center text-civic-blue font-semibold">
            <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back to My Ballot
          </Link>
        )}
        <div className="flex flex-wrap gap-3">
          <button onClick={onPrint} className="inline-flex items-center bg-civic-blue text-white font-semibold px-4 py-2 rounded-md">
            <PrinterIcon className="h-5 w-5 mr-2" /> Print or save as PDF
          </button>
          {mode === 'mine' && (
            <button onClick={onShare} className="inline-flex items-center bg-midnight-navy text-white font-semibold px-4 py-2 rounded-md">
              <ShareIcon className="h-5 w-5 mr-2" /> Share
            </button>
          )}
        </div>
        {notice && <p role="status" className="text-sm text-green-700 font-medium">{notice}</p>}
        {mode === 'mine' && printable.undecided > 0 && (
          <p className="text-sm text-slate-600">
            {printable.undecided} race{printable.undecided === 1 ? '' : 's'} with no choice yet. They print with blank lines so you can write one in.
          </p>
        )}
        {mode === 'mine' && !saved && (
          <p className="text-sm text-slate-600">
            Tip: add your address on <Link to="/my-ballot" className="underline">My Ballot</Link> to leave off races that aren't on your ballot.
          </p>
        )}
      </div>

      {/* The ballot sheet */}
      <article className="bg-white text-black border border-slate-300 rounded-lg p-6 print:border-0 print:p-0 print:rounded-none font-sans" aria-label="Printable ballot">
        <header className="border-b-2 border-black pb-3 mb-4">
          <p className="text-xs uppercase tracking-wider">{mode === 'shared' ? 'Shared sample ballot' : 'My personal sample ballot'}</p>
          <h1 className="text-2xl font-bold">{electionName}</h1>
          <p className="text-sm">Election Day: {formatDate(electionDate)}</p>
          {cycle.evStart && cycle.evEnd && <p className="text-sm">Early voting: {formatDate(cycle.evStart)} to {formatDate(cycle.evEnd)}</p>}
          {mode === 'mine' && saved?.matchedAddress && <p className="text-xs mt-1">Races for: {saved.matchedAddress}</p>}
          {cycle.coverageNote && <p className="text-xs mt-1 font-semibold">{cycle.coverageNote}</p>}
        </header>

        {races.length === 0 && measures.length === 0 && (
          <p className="text-sm">{mode === 'shared' ? 'No choices on this shared ballot match the current candidate list.' : 'No races found for this election yet.'}</p>
        )}

        {races.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-2">Candidates</h2>
            <ol className="divide-y divide-slate-300">
              {races.map((r) => (
                <li key={r.key} className="py-2 break-inside-avoid">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold">
                      {r.title}
                      {r.seats > 1 && <span className="font-normal text-sm"> (vote for up to {r.seats})</span>}
                    </span>
                    {r.uncertain && <span className="text-xs italic whitespace-nowrap">may not be on your ballot</span>}
                  </div>
                  {r.choices.length > 0 ? (
                    <ul className="mt-1">
                      {r.choices.map((c) => (
                        <li key={c.name} className="flex items-center gap-2">
                          <span aria-hidden className="inline-block w-4 h-4 border-2 border-black bg-black" />
                          <span>{c.name}</span>
                          {c.party && <span className="text-sm">({c.party})</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm">
                      <span className="sr-only">No choice yet.</span>
                      <span aria-hidden className="inline-block w-56 border-b border-black align-bottom">&nbsp;</span>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {measures.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-2">Ballot measures</h2>
            <ol className="divide-y divide-slate-300">
              {measures.map((m) => (
                <li key={m.title} className="py-2 flex justify-between gap-4 break-inside-avoid">
                  <span className="font-semibold">{m.title}</span>
                  <span className="whitespace-nowrap">
                    <span className={m.vote === 'YES' ? 'font-bold' : ''}>{m.vote === 'YES' ? '☒' : '☐'} YES</span>
                    {'  '}
                    <span className={`ml-3 ${m.vote === 'NO' ? 'font-bold' : ''}`}>{m.vote === 'NO' ? '☒' : '☐'} NO</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="mt-6 pt-3 border-t border-black text-xs space-y-1">
          <p>This is a personal reminder list, not an official ballot. The official ballot at your polling place is final.</p>
          <p>Louisiana voters may bring a sample ballot like this into the voting booth. Check your official sample ballot and polling place at {SOS_PORTAL.replace('https://', '').replace(/\/$/, '')}.</p>
          <p>Made with MyBallot.</p>
        </footer>
      </article>
    </div>
  );
};

export default PrintableBallotPage;
