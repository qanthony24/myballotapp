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
import { SOURCES, parseFeed, normalize, isRecent, dedupe, REACTIONS, holdReason, rateLimit, REPORTS_TO_HIDE, FEED_HAS_LEAD_IMAGE, extractOgImage } from './lib/news.js';

initializeApp();
const db = getFirestore();
const REGION = 'us-central1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch one feed. On 429/503 ("slow down"), wait (Retry-After, capped at
 * 30 s) and try once more. We identify ourselves honestly in User-Agent.
 */
async function fetchSource(source, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(source.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'MyBallot news reader (+https://myballot-app.web.app)', Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if ((res.status === 429 || res.status === 503) && attempt === 1) {
      const wait = Math.min(30, parseInt(res.headers.get('retry-after') ?? '10', 10) || 10);
      clearTimeout(timer);
      await sleep(wait * 1000);
      return fetchSource(source, 2);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}${attempt > 1 ? ' (after retry)' : ''}`);
    return parseFeed(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

const OG_LOOKUPS_PER_RUN = 25;

/** Read the article page's headline (og:image) image. Never throws. */
async function fetchHeadlineImage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'MyBallot news reader (+https://myballot-app.web.app)', Accept: 'text/html' } });
    if (!res.ok) return undefined;
    return extractOgImage(await res.text(), url);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Use each article's headline image (og:image), looked up once per article
 * and remembered (ogChecked). Skipped for feeds that already carry the lead
 * photo. Backfills at most OG_LOOKUPS_PER_RUN articles per refresh.
 */
async function addHeadlineImages(articles) {
  const candidates = articles.filter((a) => !FEED_HAS_LEAD_IMAGE.has(a.sourceSlug));
  if (!candidates.length) return { looked: 0, found: 0 };
  const snaps = await db.getAll(...candidates.map((a) => db.collection('news').doc(a.id)));
  const existing = new Map(snaps.map((d) => [d.id, d.exists ? d.data() : null]));
  let looked = 0;
  let found = 0;
  for (const a of candidates) {
    const prev = existing.get(a.id);
    if (prev?.ogChecked) {
      // Already looked up: keep what we stored (don't overwrite with a guess from the feed).
      delete a.imageUrl;
      continue;
    }
    if (looked >= OG_LOOKUPS_PER_RUN) continue; // next refresh
    if (looked > 0) await sleep(500);
    looked++;
    const og = await fetchHeadlineImage(a.url);
    if (og) {
      a.imageUrl = og;
      found++;
    }
    a.ogChecked = true;
  }
  return { looked, found };
}

export const refreshNews = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'America/Chicago', region: REGION, memory: '256MiB', timeoutSeconds: 300, retryCount: 0 },
  async () => {
    const now = new Date();
    const status = {};
    const all = [];
    // One source at a time, a few seconds apart: four of them share one
    // publishing platform (BLOX/TownNews), which rate-limits bursts.
    for (const [i, s] of SOURCES.entries()) {
      if (i > 0) await sleep(4000);
      try {
        const items = (await fetchSource(s)).map((r) => normalize(r, s, now)).filter(Boolean).filter((a) => isRecent(a, now));
        all.push(...items);
        status[s.slug] = { ok: true, count: items.length, withImages: items.filter((a) => a.imageUrl).length };
      } catch (e) {
        status[s.slug] = { ok: false, error: String(e?.message ?? e).slice(0, 200) };
        logger.warn(`news source failed: ${s.slug}`, e);
      }
    }
    const articles = dedupe(all);
    const og = await addHeadlineImages(articles).catch((e) => {
      logger.warn('headline images', e);
      return { looked: 0, found: 0, error: String(e) };
    });
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
    await db.doc('config/newsStatus').set({ lastRefreshedAt: now.toISOString(), articles: articles.length, sources: status, headlineImages: og });
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
