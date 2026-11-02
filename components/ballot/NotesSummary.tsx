/**
 * The voter's private candidate notes, all in one place (moved here from the
 * old Info "Essentials"/"Q&A" pages to My Ballot, where notes are used).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useAllNotesSummary } from '../../hooks/useAllNotesSummary';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const NotesSummary: React.FC = () => {
  const notes = useAllNotesSummary();
  const [open, setOpen] = useState(false);
  if (notes.length === 0) return null;
  return (
    <section className="mt-8 bg-white border border-midnight-navy/10 rounded-lg print:hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center font-display font-semibold text-midnight-navy">
          <PencilSquareIcon className="h-5 w-5 mr-2 text-civic-blue" /> My candidate notes ({notes.length})
        </span>
        <ChevronDownIcon className={`h-5 w-5 text-midnight-navy/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="divide-y divide-midnight-navy/10 border-t border-midnight-navy/10">
          {notes.map((n) => (
            <li key={n.candidateId} className="px-4 py-3">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <Link to={n.candidateProfileLink} className="font-semibold text-midnight-navy hover:text-civic-blue">{n.candidateName}</Link>
                  <p className="text-xs text-midnight-navy/60">{n.officeName} · {n.electionName}</p>
                </div>
                <Link to={`${n.candidateProfileLink}#notes-section`} className="text-xs text-civic-blue flex items-center whitespace-nowrap">
                  Manage <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 ml-1" />
                </Link>
              </div>
              {n.latestNote && (
                <p className="mt-1 text-sm text-midnight-navy/80">
                  “{n.latestNote.text.slice(0, 150)}{n.latestNote.text.length > 150 ? '…' : ''}”
                  <span className="block text-xs text-midnight-navy/50 mt-0.5">
                    {fmt(n.latestNote.date)}
                    {n.notesCount > 1 && ` · ${n.notesCount} notes`}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default NotesSummary;
