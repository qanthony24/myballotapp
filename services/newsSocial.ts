/**
 * Live news feed + in-feed reactions and comments (Firestore).
 *
 *   news/{id}                         articles, written every 30 min by the refreshNews function;
 *                                     carries reactions.{type} and commentCount (kept by functions)
 *   news/{id}/reactions/{uid}         one reaction per signed-in user (private to them)
 *   news/{id}/comments/{commentId}    comments; status 'visible' | 'held' (awaiting admin review)
 *   .../comments/{c}/reports/{uid}    one report per user; 3 reports hold a comment
 *
 * Rules: firestore.rules. Moderation logic: functions/index.js.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { NewsArticle } from '../types/info';

export type ReactionType = 'up' | 'wow' | 'think' | 'sad' | 'angry';
export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'up', emoji: '👍', label: 'Useful' },
  { type: 'wow', emoji: '😮', label: 'Surprising' },
  { type: 'think', emoji: '🤔', label: 'Makes me think' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
];

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or personal attack' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'misinformation', label: 'False information about voting' },
  { value: 'other', label: 'Something else' },
] as const;

export const COMMENT_MAX = 1000;

export interface LiveArticle extends NewsArticle {
  reactions?: Partial<Record<ReactionType, number>>;
  commentCount?: number;
}

export interface NewsComment {
  id: string;
  articleId: string;
  uid: string;
  authorName: string;
  text: string;
  createdAt: Date | null;
  status: 'visible' | 'held';
  heldReason?: string;
  reportCount?: number;
}

const toDate = (t: unknown) => ((t as Timestamp)?.toDate ? (t as Timestamp).toDate() : null);

// ---- Articles ----

export function subscribeNews(onData: (items: LiveArticle[]) => void, onError: (e: Error) => void, max = 50): () => void {
  return onSnapshot(
    query(collection(db, 'news'), orderBy('publishedAt', 'desc'), limit(max)),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as Omit<LiveArticle, 'id'>), id: d.id }))),
    onError,
  );
}

export function subscribeNewsStatus(onData: (s: { lastRefreshedAt?: string } | null) => void): () => void {
  return onSnapshot(doc(db, 'config/newsStatus'), (d) => onData(d.exists() ? (d.data() as { lastRefreshedAt?: string }) : null), () => onData(null));
}

// ---- Reactions ----

export function useMyReaction(articleId: string, uid: string | undefined): ReactionType | null {
  const [type, setType] = useState<ReactionType | null>(null);
  useEffect(() => {
    if (!uid) return setType(null);
    return onSnapshot(doc(db, 'news', articleId, 'reactions', uid), (d) => setType(d.exists() ? (d.data().type as ReactionType) : null), () => setType(null));
  }, [articleId, uid]);
  return type;
}

/** Set, change, or (type = null) remove the user's reaction. */
export async function setReaction(articleId: string, uid: string, type: ReactionType | null): Promise<void> {
  const ref = doc(db, 'news', articleId, 'reactions', uid);
  if (type) await setDoc(ref, { type, at: serverTimestamp() });
  else await deleteDoc(ref);
}

// ---- Comments ----

export function subscribeComments(articleId: string, onData: (c: NewsComment[]) => void, max = 30): () => void {
  return onSnapshot(
    query(collection(db, 'news', articleId, 'comments'), where('status', '==', 'visible'), orderBy('createdAt', 'desc'), limit(max)),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as Omit<NewsComment, 'id' | 'createdAt' | 'articleId'>), id: d.id, articleId, createdAt: toDate(d.data().createdAt) }))),
    () => onData([]),
  );
}

/** Watch one comment (used right after posting, to tell the author if it was held for review). */
export function subscribeComment(articleId: string, commentId: string, onData: (c: NewsComment | null) => void): () => void {
  return onSnapshot(
    doc(db, 'news', articleId, 'comments', commentId),
    (d) => onData(d.exists() ? ({ ...(d.data() as NewsComment), id: d.id, articleId, createdAt: toDate(d.data().createdAt) }) : null),
    () => onData(null),
  );
}

export async function postComment(articleId: string, uid: string, authorName: string, text: string): Promise<string> {
  const ref = await addDoc(collection(db, 'news', articleId, 'comments'), {
    uid,
    authorName: authorName.slice(0, 40),
    text: text.trim().slice(0, COMMENT_MAX),
    createdAt: serverTimestamp(),
    status: 'visible',
  });
  return ref.id;
}

export async function deleteComment(articleId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'news', articleId, 'comments', commentId));
}

export async function reportComment(articleId: string, commentId: string, uid: string, reason: string): Promise<void> {
  await setDoc(doc(db, 'news', articleId, 'comments', commentId, 'reports', uid), { reason, at: serverTimestamp() });
}

/** Public name on comments: "First L." from the account name, otherwise "Voter 1a2b". Never the email. */
export function commentAuthorName(user: { id: string; displayName?: string } | null): string {
  const parts = (user?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`.slice(0, 40);
  if (parts.length === 1 && !parts[0].includes('@')) return parts[0].slice(0, 40);
  return `Voter ${(user?.id ?? '0000').slice(-4)}`;
}

// ---- Blocking (this device): hide a user's comments from yourself ----

const BLOCK_KEY = 'myballot.blockedCommenters.v1';
const blockListeners = new Set<() => void>();
let blocked: string[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(BLOCK_KEY) ?? '[]');
  } catch {
    return [];
  }
})();

export function setBlocked(uid: string, on: boolean) {
  blocked = on ? [...new Set([...blocked, uid])] : blocked.filter((u) => u !== uid);
  try {
    localStorage.setItem(BLOCK_KEY, JSON.stringify(blocked));
  } catch {
    // storage blocked: keep for this session
  }
  blockListeners.forEach((l) => l());
}

export function useBlockedCommenters(): string[] {
  return useSyncExternalStore(
    (l) => {
      blockListeners.add(l);
      return () => blockListeners.delete(l);
    },
    () => blocked,
  );
}

// ---- Admin moderation ----

export async function listHeldComments(): Promise<NewsComment[]> {
  const snap = await getDocs(query(collectionGroup(db, 'comments'), where('status', '==', 'held'), limit(200)));
  return snap.docs
    .map((d) => ({ ...(d.data() as NewsComment), id: d.id, articleId: d.ref.parent.parent!.id, createdAt: toDate(d.data().createdAt) }))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function approveComment(c: NewsComment, adminEmail: string): Promise<void> {
  await updateDoc(doc(db, 'news', c.articleId, 'comments', c.id), { status: 'visible', reviewedAt: serverTimestamp(), reviewedBy: adminEmail });
}

export async function banCommenter(uid: string, reason: string): Promise<void> {
  await setDoc(doc(db, 'bannedUsers', uid), { reason: reason.slice(0, 200), at: serverTimestamp() });
}
