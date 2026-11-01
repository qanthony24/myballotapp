/**
 * Admin → Comments: the moderation queue. Comments land here (hidden from
 * the public) when they contain a link or flagged language, when the author
 * posts too fast, or after 3 user reports. Approve, remove, or remove and
 * ban the author (banned users can't react, comment or report).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../../firebase';
import { approveComment, banCommenter, deleteComment, listHeldComments, type NewsComment } from '../../services/newsSocial';

const REASONS: Record<string, string> = {
  link: 'Contains a link',
  language: 'Flagged language',
  spam: 'Looks like spam',
  rate: 'Posting too fast',
  reports: 'Reported by 3+ users',
};

const AdminCommentsPage: React.FC = () => {
  const [items, setItems] = useState<NewsComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listHeldComments()
      .then(setItems)
      .catch((e) => setError(String(e?.message ?? e)));
  };
  useEffect(load, []);

  async function act(c: NewsComment, action: 'approve' | 'remove' | 'ban') {
    if (action === 'ban' && !window.confirm(`Remove this comment and ban ${c.authorName}? They won't be able to react, comment or report.`)) return;
    setBusy(c.id);
    try {
      if (action === 'approve') await approveComment(c, auth.currentUser?.email ?? 'admin');
      else {
        if (action === 'ban') await banCommenter(c.uid, `Comment ${c.id}: ${c.heldReason ?? ''}`);
        await deleteComment(c.articleId, c.id);
      }
      setItems((list) => (list ?? []).filter((x) => x.id !== c.id));
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/admin" className="text-civic-blue underline text-sm">← Admin</Link>
      <h1 className="text-2xl font-bold text-midnight-navy mt-2 mb-1">Comments awaiting review</h1>
      <p className="text-sm text-gray-600 mb-4">
        Held comments are hidden from everyone except their author. Approve to publish, or remove. Ban only for clear abuse.
      </p>
      <button onClick={load} className="text-sm text-civic-blue underline mb-3">Refresh</button>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      {items === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing to review. 🎉</p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                <span className="font-semibold text-midnight-navy">{c.authorName}</span>
                <span>{c.createdAt?.toLocaleString() ?? ''}</span>
                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">{REASONS[c.heldReason ?? ''] ?? c.heldReason ?? 'Held'}</span>
                {!!c.reportCount && <span>{c.reportCount} report{c.reportCount === 1 ? '' : 's'}</span>}
              </div>
              <p className="text-sm whitespace-pre-line break-words">{c.text}</p>
              <div className="flex gap-3 mt-2 text-sm">
                <button disabled={busy === c.id} onClick={() => act(c, 'approve')} className="bg-civic-blue text-white px-3 py-1 rounded-md disabled:opacity-50">Approve</button>
                <button disabled={busy === c.id} onClick={() => act(c, 'remove')} className="border border-gray-300 px-3 py-1 rounded-md">Remove</button>
                <button disabled={busy === c.id} onClick={() => act(c, 'ban')} className="text-red-700 underline">Remove &amp; ban author</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminCommentsPage;
