/**
 * MyBallot Cloud Functions.
 *
 *   refreshNews       every 30 min: pull the six news feeds into Firestore `news/{id}`
 *   countReactions    keeps news/{id}.reactions.{type} counts in step with news/{id}/reactions/{uid}
 *   moderateComments  on each comment write: rate limit + hold checks on create, keeps commentCount
 *   countReports      3 reports hide a comment until an admin reviews it
 *
 * Deploy: npm run deploy:functions (see docs/DEPLOY.md).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { SOURCES, parseFeed, normalize, isRecent, dedupe, REACTIONS, holdReason, rateLimit, REPORTS_TO_HIDE } from './lib/news.js';

initializeApp();
const db = getFirestore();
const REGION = 'us-central1';

async function fetchSource(source) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(source.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'MyBallot news reader (+https://myballot-app.web.app)', Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

export const refreshNews = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'America/Chicago', region: REGION, memory: '256MiB', timeoutSeconds: 120, retryCount: 0 },
  async () => {
    const now = new Date();
    const status = {};
    const all = [];
    await Promise.all(
      SOURCES.map(async (s) => {
        try {
          const items = (await fetchSource(s)).map((r) => normalize(r, s, now)).filter(Boolean).filter((a) => isRecent(a, now));
          all.push(...items);
          status[s.slug] = { ok: true, count: items.length };
        } catch (e) {
          status[s.slug] = { ok: false, error: String(e?.message ?? e).slice(0, 200) };
          logger.warn(`news source failed: ${s.slug}`, e);
        }
      }),
    );
    const articles = dedupe(all);
    // Merge so reaction/comment counts on existing articles are kept.
    for (let i = 0; i < articles.length; i += 400) {
      const batch = db.batch();
      for (const a of articles.slice(i, i + 400)) {
        const { id, ...fields } = a;
        Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
        batch.set(db.collection('news').doc(id), { ...fields, fetchedAt: now.toISOString() }, { merge: true });
      }
      await batch.commit();
    }
    await db.doc('config/newsStatus').set({ lastRefreshedAt: now.toISOString(), articles: articles.length, sources: status });
    logger.info(`news refreshed: ${articles.length} articles`, status);
  },
);

export const countReactions = onDocumentWritten({ document: 'news/{articleId}/reactions/{uid}', region: REGION }, async (event) => {
  const before = event.data?.before?.data()?.type;
  const after = event.data?.after?.data()?.type;
  if (before === after) return;
  const update = {};
  if (REACTIONS.includes(before)) update[`reactions.${before}`] = FieldValue.increment(-1);
  if (REACTIONS.includes(after)) update[`reactions.${after}`] = FieldValue.increment(1);
  if (Object.keys(update).length) await db.doc(`news/${event.params.articleId}`).update(update).catch((e) => logger.warn('reaction count', e));
});

export const moderateComments = onDocumentWritten({ document: 'news/{articleId}/comments/{commentId}', region: REGION }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const article = db.doc(`news/${event.params.articleId}`);

  // New comment: rate limit, then hold checks. Changing status re-triggers this function, which fixes the count.
  if (!before && after && after.status === 'visible') {
    const throttle = db.doc(`commentThrottle/${after.uid}`);
    const over = await db.runTransaction(async (tx) => {
      const snap = await tx.get(throttle);
      const r = rateLimit(snap.exists ? snap.data().recent : [], Date.now());
      tx.set(throttle, { recent: r.next });
      return r.over;
    });
    const reason = over ? 'rate' : holdReason(after.text ?? '');
    if (reason) {
      await event.data.after.ref.update({ status: 'held', heldReason: reason });
      return; // counted when (if) an admin approves it
    }
  }

  const delta = (after?.status === 'visible' ? 1 : 0) - (before?.status === 'visible' ? 1 : 0);
  if (delta) await article.update({ commentCount: FieldValue.increment(delta) }).catch((e) => logger.warn('comment count', e));
});

export const countReports = onDocumentCreated({ document: 'news/{articleId}/comments/{commentId}/reports/{uid}', region: REGION }, async (event) => {
  const comment = db.doc(`news/${event.params.articleId}/comments/${event.params.commentId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(comment);
    if (!snap.exists) return;
    const reports = (snap.data().reportCount ?? 0) + 1;
    const update = { reportCount: reports };
    if (reports >= REPORTS_TO_HIDE && snap.data().status === 'visible') Object.assign(update, { status: 'held', heldReason: 'reports' });
    tx.update(comment, update);
  });
});
