/**
 * Phone layout for Compare Candidates (below the md breakpoint).
 *
 * The desktop table needs side-scrolling on a phone. Here, both candidates
 * stay pinned at the top as a compact two-up header, and each question is a
 * card with the two answers stacked full-width, color-coded to match the
 * header. Long answers are clamped with "Read more", so the page reads as a
 * list of short head-to-heads instead of a squeezed grid.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatBubbleOvalLeftEllipsisIcon, PlusCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { Candidate, SurveyQuestion } from '../../types';
import CandidatePhoto from '../candidates/CandidatePhoto';
import { useNotes } from '../../hooks/useNotes';

/** Candidate A = civic blue, candidate B = gold. Used on the header and every answer. */
const SIDES = [
  { bar: 'bg-civic-blue', ring: 'border-civic-blue', text: 'text-civic-blue', soft: 'bg-blue-50' },
  { bar: 'bg-sunlight-gold', ring: 'border-sunlight-gold', text: 'text-amber-700', soft: 'bg-amber-50' },
] as const;

const CLAMP_CHARS = 220;

/** Bottom edge of the app's fixed header + election banner (their heights vary: the banner wraps, the header shrinks). */
function useFixedTopOffset(): number {
  const [top, setTop] = useState(96);
  useEffect(() => {
    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-fixed-top]'));
      const bottom = Math.max(0, ...els.map((e) => e.getBoundingClientRect().bottom));
      setTop((t) => (Math.abs(t - bottom) > 1 ? bottom : t));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    document.querySelectorAll('[data-fixed-top]').forEach((e) => ro?.observe(e));
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, []);
  return top;
}

function displayName(c: Candidate) {
  return c.officeId === 5 && c.runningMateName ? `${c.firstName} ${c.lastName} / ${c.runningMateName}` : `${c.firstName} ${c.lastName}`;
}

const Answer: React.FC<{ side: 0 | 1; candidate: Candidate; text?: string }> = ({ side, candidate, text }) => {
  const [open, setOpen] = useState(false);
  const s = SIDES[side];
  const long = !!text && text.length > CLAMP_CHARS;
  return (
    <div className={`relative pl-3 py-2 pr-2 rounded-md ${s.soft}`}>
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${s.bar}`} />
      <p className={`text-xs font-semibold uppercase tracking-wide ${s.text}`}>{candidate.lastName}</p>
      {text ? (
        <>
          <p className={`text-sm text-midnight-navy/90 whitespace-pre-line mt-0.5 ${long && !open ? 'line-clamp-4' : ''}`}>{text}</p>
          {long && (
            <button onClick={() => setOpen(!open)} className={`text-xs font-semibold mt-1 ${s.text}`} aria-expanded={open}>
              {open ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm italic text-midnight-navy/50 mt-0.5">No response</p>
      )}
    </div>
  );
};

const NoteAnswer: React.FC<{ side: 0 | 1; candidate: Candidate }> = ({ side, candidate }) => {
  const { notes, getLatestNote } = useNotes(candidate.id);
  const latest = getLatestNote();
  return <Answer side={side} candidate={candidate} text={latest ? latest.text + (notes.length > 1 ? `\n(+${notes.length - 1} more)` : '') : undefined} />;
};

interface Props {
  candidates: [Candidate, Candidate];
  questions: SurveyQuestion[];
  /** Renders the add/remove-from-ballot control for a candidate (compact). */
  ballotState: (c: Candidate) => { selected: boolean; disabled: boolean; toggle: () => void };
}

const MobileComparison: React.FC<Props> = ({ candidates, questions, ballotState }) => {
  const answered = (q: SurveyQuestion) => candidates.filter((c) => c.surveyResponses?.[q.key]).length;
  const [hideUnanswered, setHideUnanswered] = useState(false);
  const shown = hideUnanswered ? questions.filter((q) => answered(q) > 0) : questions;
  const skipped = questions.length - questions.filter((q) => answered(q) > 0).length;
  const stickyTop = useFixedTopOffset();

  return (
    <div data-testid="mobile-comparison">
      {/* Pinned two-up header (below the fixed app header + election banner). */}
      <div style={{ top: stickyTop }} className="sticky z-20 -mx-6 px-4 py-2 bg-white/95 backdrop-blur border-b border-midnight-navy/10 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          {candidates.map((c, i) => {
            const s = SIDES[i];
            const b = ballotState(c);
            return (
              <div key={c.id} className="flex flex-col items-center text-center min-w-0">
                <Link to={`/candidate/${c.id}`} className="flex flex-col items-center min-w-0">
                  <CandidatePhoto src={c.photoUrl} alt={displayName(c)} focalPoint={c.photoFocalPoint} className={`h-12 w-12 rounded-full border-2 ${s.ring}`} />
                  <span className="mt-1 text-sm font-semibold text-midnight-navy leading-tight truncate max-w-full">{displayName(c)}</span>
                  <span className="text-[11px] text-midnight-navy/70 truncate max-w-full">
                    {c.party}
                    {c.isIncumbent ? ' · Incumbent' : ''}
                  </span>
                </Link>
                <button
                  onClick={b.toggle}
                  disabled={b.disabled}
                  className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                    b.disabled ? 'bg-slate-200 text-slate-500' : b.selected ? 'bg-sunlight-gold text-midnight-navy' : 'bg-civic-blue text-white'
                  }`}
                  aria-pressed={b.selected}
                >
                  {b.selected ? <CheckCircleIcon className="h-4 w-4" /> : <PlusCircleIcon className="h-4 w-4" />}
                  {b.disabled ? 'Past election' : b.selected ? 'On my ballot' : 'Add to ballot'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {skipped > 0 && (
        <label className="flex items-center gap-2 text-sm text-midnight-navy/80 mt-4">
          <input type="checkbox" checked={hideUnanswered} onChange={(e) => setHideUnanswered(e.target.checked)} />
          Hide {skipped} question{skipped === 1 ? '' : 's'} neither candidate answered
        </label>
      )}

      <ol className="mt-4 space-y-4">
        {shown.map((q, n) => (
          <li key={q.key} className="border border-midnight-navy/15 rounded-lg p-3 bg-white">
            <h3 className="text-sm font-semibold text-midnight-navy mb-2">
              <span className="text-midnight-navy/40 mr-1">{n + 1}.</span>
              {q.question}
            </h3>
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <Answer key={c.id} side={i as 0 | 1} candidate={c} text={c.surveyResponses?.[q.key]} />
              ))}
            </div>
          </li>
        ))}
        <li className="border border-midnight-navy/15 rounded-lg p-3 bg-white">
          <h3 className="text-sm font-semibold text-midnight-navy mb-2 flex items-center">
            <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 mr-1.5 text-civic-blue" /> My private notes
          </h3>
          <div className="space-y-2">
            {candidates.map((c, i) => (
              <NoteAnswer key={c.id} side={i as 0 | 1} candidate={c} />
            ))}
          </div>
        </li>
      </ol>
    </div>
  );
};

export default MobileComparison;
