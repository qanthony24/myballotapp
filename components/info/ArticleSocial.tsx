/**
 * In-feed reactions and comments for a news card (Bleacher Report style):
 * a reaction bar with counts, and a comment thread that opens inline.
 * Anyone can read; signed-in users with a verified email can react and post.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatBubbleLeftIcon, EllipsisHorizontalIcon, FlagIcon, NoSymbolIcon, TrashIcon } from '@heroicons/react/24/outline';
import { auth } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { trackEvent } from '../../services/analytics';
import { formatRelativeTime } from '../../services/newsService';
import {
  COMMENT_MAX, REACTIONS, REPORT_REASONS, commentAuthorName, deleteComment, postComment, reportComment, setBlocked, setReaction,
  subscribeComment, subscribeComments, useBlockedCommenters, useMyReaction,
  type LiveArticle, type NewsComment, type ReactionType,
} from '../../services/newsSocial';

function usePostingStatus(): { uid?: string; canPost: boolean; reason?: 'signed-out' | 'unverified' } {
  const { currentUser } = useAuth();
  if (!currentUser) return { canPost: false, reason: 'signed-out' };
  if (!auth.currentUser?.emailVerified) return { uid: currentUser.id, canPost: false, reason: 'unverified' };
  return { uid: currentUser.id, canPost: true };
}

const SignInNote: React.FC<{ reason?: 'signed-out' | 'unverified'; what: string }> = ({ reason, what }) => (
  <p className="text-xs text-midnight-navy/70" role="status">
    {reason === 'unverified' ? (
      <>Verify your email address to {what}. Check your inbox for the link, or sign in with Google.</>
    ) : (
      <>
        <Link to="/auth" className="text-civic-blue font-semibold underline">Sign in</Link> to {what}.
      </>
    )}
  </p>
);

// ---- Reactions ----

const ReactionBar: React.FC<{ article: LiveArticle; onCommentsClick: () => void; commentsOpen: boolean }> = ({ article, onCommentsClick, commentsOpen }) => {
  const { uid, canPost, reason } = usePostingStatus();
  const mine = useMyReaction(article.id, canPost ? uid : undefined);
  const [optimistic, setOptimistic] = useState<{ type: ReactionType | null } | null>(null);
  const [note, setNote] = useState(false);
  const current = optimistic ? optimistic.type : mine;

  useEffect(() => setOptimistic(null), [mine]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ...(article.reactions ?? {}) };
    // Show the user's change immediately (the server count catches up in a second or two).
    if (optimistic && optimistic.type !== mine) {
      if (mine) c[mine] = Math.max(0, (c[mine] ?? 0) - 1);
      if (optimistic.type) c[optimistic.type] = (c[optimistic.type] ?? 0) + 1;
    }
    return c;
  }, [article.reactions, optimistic, mine]);

  async function react(type: ReactionType) {
    if (!canPost || !uid) return setNote(true);
    const next = current === type ? null : type;
    setOptimistic({ type: next });
    try {
      await setReaction(article.id, uid, next);
      trackEvent('news_react', { reaction: next ?? 'removed', source: article.sourceSlug });
    } catch {
      setOptimistic(null);
    }
  }

  const comments = article.commentCount ?? 0;
  return (
    <div className="pt-2 border-t border-midnight-navy/10">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1" role="group" aria-label="React to this article">
          {REACTIONS.map((r) => {
            const n = counts[r.type] ?? 0;
            const on = current === r.type;
            return (
              <button
                key={r.type}
                onClick={() => react(r.type)}
                aria-pressed={on}
                aria-label={`${r.label}${n ? `, ${n}` : ''}`}
                title={r.label}
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-sm transition-colors ${
                  on ? 'bg-civic-blue/10 ring-1 ring-civic-blue text-civic-blue' : 'hover:bg-slate-100 text-midnight-navy/70'
                }`}
              >
                <span aria-hidden className="text-base leading-none">{r.emoji}</span>
                {n > 0 && <span className="text-xs font-medium tabular-nums">{n}</span>}
              </button>
            );
          })}
        </div>
        <button
          onClick={onCommentsClick}
          aria-expanded={commentsOpen}
          className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1 ${commentsOpen ? 'bg-slate-100 text-midnight-navy' : 'text-midnight-navy/70 hover:bg-slate-100'}`}
        >
          <ChatBubbleLeftIcon className="h-4 w-4" />
          {comments > 0 ? comments : ''} {comments === 1 ? 'Comment' : 'Comments'}
        </button>
      </div>
      {note && !canPost && (
        <div className="mt-1">
          <SignInNote reason={reason} what="react" />
        </div>
      )}
    </div>
  );
};

// ---- Comments ----

const CommentItem: React.FC<{ c: NewsComment; uid?: string; canPost: boolean }> = ({ c, uid, canPost }) => {
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const own = uid === c.uid;

  async function report(reason: string) {
    if (!uid) return;
    try {
      await reportComment(c.articleId, c.id, uid, reason);
      trackEvent('news_comment_report', { reason });
      setDone('Thanks. Our team will review it.');
    } catch {
      setDone("You've already reported this comment.");
    }
    setReporting(false);
    setMenu(false);
  }

  return (
    <li className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-midnight-navy/60">
            <span className="font-semibold text-midnight-navy">{c.authorName}</span>
            {c.createdAt && <> · {formatRelativeTime(c.createdAt.toISOString())}</>}
          </p>
          <p className="text-sm text-midnight-navy/90 whitespace-pre-line break-words">{c.text}</p>
          {done && <p className="text-xs text-green-700 mt-0.5">{done}</p>}
        </div>
        <div className="relative flex-shrink-0">
          <button onClick={() => setMenu(!menu)} aria-label="Comment options" className="p-1 rounded hover:bg-slate-100 text-midnight-navy/50">
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </button>
          {menu && (
            <div className="absolute right-0 z-10 mt-1 w-56 bg-white border border-midnight-navy/15 rounded-md shadow-lg text-sm py-1">
              {own ? (
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-red-700"
                  onClick={async () => {
                    if (window.confirm('Delete your comment?')) await deleteComment(c.articleId, c.id);
                    setMenu(false);
                  }}
                >
                  <TrashIcon className="h-4 w-4" /> Delete
                </button>
              ) : !canPost ? (
                <p className="px-3 py-1.5 text-xs text-midnight-navy/70">Sign in to report or block.</p>
              ) : reporting ? (
                <>
                  <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-midnight-navy/70">Why are you reporting this?</p>
                  {REPORT_REASONS.map((r) => (
                    <button key={r.value} className="w-full text-left px-3 py-1.5 hover:bg-slate-50" onClick={() => report(r.value)}>
                      {r.label}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2" onClick={() => setReporting(true)}>
                    <FlagIcon className="h-4 w-4" /> Report
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                    onClick={() => {
                      setBlocked(c.uid, true);
                      trackEvent('news_comment_block');
                    }}
                  >
                    <NoSymbolIcon className="h-4 w-4" /> Block {c.authorName}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

const CommentThread: React.FC<{ article: LiveArticle }> = ({ article }) => {
  const { currentUser } = useAuth();
  const { uid, canPost, reason } = usePostingStatus();
  const blocked = useBlockedCommenters();
  const [comments, setComments] = useState<NewsComment[] | null>(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; status?: string; heldReason?: string } | null>(null);

  useEffect(() => subscribeComments(article.id, setComments), [article.id]);
  useEffect(() => {
    if (!pending?.id) return;
    return subscribeComment(article.id, pending.id, (c) => setPending((p) => (p && c ? { ...p, status: c.status, heldReason: c.heldReason } : p)));
  }, [article.id, pending?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const id = await postComment(article.id, uid, commentAuthorName(currentUser), text);
      setPending({ id });
      setText('');
      trackEvent('news_comment', { source: article.sourceSlug });
    } catch {
      setError("Couldn't post your comment. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  const shown = (comments ?? []).filter((c) => !blocked.includes(c.uid));
  const hiddenByBlock = (comments?.length ?? 0) - shown.length;

  return (
    <div className="pt-2" data-testid="comment-thread">
      {canPost ? (
        <form onSubmit={submit} className="space-y-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
            rows={2}
            placeholder="Add a comment. Keep it civil and about the issues."
            aria-label="Your comment"
            className="w-full text-sm border border-midnight-navy/20 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-civic-blue/40"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-midnight-navy/50">
              Posting as {commentAuthorName(currentUser)} · {text.length}/{COMMENT_MAX}
            </span>
            <button type="submit" disabled={posting || !text.trim()} className="bg-civic-blue text-white text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-50">
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      ) : (
        <SignInNote reason={reason} what="comment" />
      )}
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      {pending?.status === 'held' && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1 mt-1" role="status">
          {pending.heldReason === 'rate'
            ? "You're commenting faster than we allow. This comment will appear if a moderator approves it."
            : 'Your comment is waiting for a moderator to review it (links and some words are checked first).'}
        </p>
      )}

      {comments === null ? (
        <p className="text-xs text-midnight-navy/50 py-2">Loading comments…</p>
      ) : shown.length === 0 ? (
        <p className="text-xs text-midnight-navy/50 py-2">No comments yet.</p>
      ) : (
        <ul className="divide-y divide-midnight-navy/10 mt-1">
          {shown.map((c) => (
            <CommentItem key={c.id} c={c} uid={uid} canPost={canPost} />
          ))}
        </ul>
      )}
      {hiddenByBlock > 0 && (
        <p className="text-[11px] text-midnight-navy/50">
          {hiddenByBlock} comment{hiddenByBlock === 1 ? '' : 's'} from people you blocked hidden.
        </p>
      )}
    </div>
  );
};

const ArticleSocial: React.FC<{ article: LiveArticle }> = ({ article }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ReactionBar article={article} commentsOpen={open} onCommentsClick={() => setOpen(!open)} />
      {open && <CommentThread article={article} />}
    </div>
  );
};

export default ArticleSocial;
