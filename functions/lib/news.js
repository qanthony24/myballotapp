/**
 * News feed: sources, RSS parsing, normalization, de-duplication, and the
 * comment moderation checks. Pure functions (no Firebase), shared by the
 * Cloud Functions in ../index.js and tested in tests/news.test.mts.
 */
import { createHash } from 'node:crypto';

/**
 * The feeds MyBallot shows (decided by Quentin, Oct 29, 2026). Politics
 * sections only for the Advocate/NOLA sites; everything from the Louisiana
 * Illuminator and The Bayou Progressive. Order = priority when the same story
 * appears on several Advocate network sites.
 */
export const SOURCES = [
  { slug: 'the-advocate', name: 'The Advocate', url: 'https://www.theadvocate.com/search/?f=rss&t=article&c=baton_rouge/news/politics*&l=25&s=start_time&sd=desc' },
  { slug: 'louisiana-illuminator', name: 'Louisiana Illuminator', url: 'https://lailluminator.com/feed/' },
  { slug: 'bayou-progressive', name: 'The Bayou Progressive', url: 'https://bayouprogressive.com/feed/' },
  { slug: 'nola-com', name: 'NOLA.com', url: 'https://www.nola.com/search/?f=rss&t=article&c=news/politics*&l=25&s=start_time&sd=desc' },
  { slug: 'acadiana-advocate', name: 'The Acadiana Advocate', url: 'https://www.theadvocate.com/search/?f=rss&t=article&c=acadiana/news/politics*&l=25&s=start_time&sd=desc' },
  { slug: 'shreveport-bossier-advocate', name: 'Shreveport-Bossier Advocate', url: 'https://www.shreveportbossieradvocate.com/search/?f=rss&t=article&c=news/state_politics*&l=25&s=start_time&sd=desc' },
];

export const MAX_AGE_DAYS = 14;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripHtml(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tag(xml, name) {
  const cdata = xml.match(new RegExp(`<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`, 'i'));
  if (cdata) return cdata[1];
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m?.[1];
}

function enclosureImage(item) {
  for (const m of item.matchAll(/<enclosure\b[^>]*>/gi)) {
    const url = m[0].match(/url=["']([^"']+)["']/i)?.[1];
    const type = m[0].match(/type=["']([^"']+)["']/i)?.[1] ?? '';
    if (url && (type.startsWith('image/') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url))) return [m[0], url];
  }
  return null;
}

/** "BY GIGI LIMAN | Staff writer" → "Gigi Liman". */
export function cleanAuthor(a) {
  let s = stripHtml(a).replace(/^by\s+/i, '').split('|')[0].trim();
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
  return s || undefined;
}

// Tracking pixels, avatars and share buttons that show up as <img> in feed HTML.
const NOT_A_PHOTO = /(gravatar|pixel|feedburner|stats\.wp|\/emoji\/|1x1|spacer|logo|icon|share)/i;

/** First real photo in feed HTML (skips pixels/avatars, prefers https). */
function firstPhoto(html) {
  for (const m of (html ?? '').matchAll(/<img\b[^>]*>/gi)) {
    const src = m[0].match(/\ssrc=["']([^"']+)["']/i)?.[1];
    const w = parseInt(m[0].match(/\swidth=["']?(\d+)/i)?.[1] ?? '0', 10);
    if (!src || NOT_A_PHOTO.test(src) || (w > 0 && w < 100)) continue;
    return [m[0], src];
  }
  return null;
}

function image(item, html) {
  const m =
    item.match(/<media:content[^>]+url=["']([^"']+)["']/i) ??
    item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ??
    enclosureImage(item) ??
    firstPhoto(html);
  return feedImageUrl(m?.[1]);
}

/**
 * Make a feed image usable on an https page: upgrade http → https (the
 * Advocate sites' feeds list http:// images that also work over https), and
 * ask BLOX (bloximages) for 800px wide instead of its 300px feed thumbnail.
 */
export function feedImageUrl(raw) {
  if (!raw) return undefined;
  try {
    const u = new URL(decodeEntities(raw.trim()));
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (u.protocol !== 'https:') return undefined;
    if (/(^|\.)bloximages\./i.test(u.hostname) && u.searchParams.has('resize')) u.searchParams.set('resize', '800,');
    return u.toString();
  } catch {
    return undefined;
  }
}

/** RSS 2.0 items → raw articles. */
export function parseFeed(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const item = m[1];
    const title = tag(item, 'title');
    const link = tag(item, 'link');
    if (!title || !link) continue;
    const content = tag(item, 'content:encoded');
    const description = tag(item, 'description') ?? content;
    out.push({
      title: stripHtml(title),
      link: decodeEntities(link.trim()),
      summary: description ? stripHtml(description) : undefined,
      pubDate: tag(item, 'pubDate')?.trim(),
      author: (() => {
        const a = tag(item, 'dc:creator') ?? tag(item, 'author');
        return a ? cleanAuthor(a) : undefined;
      })(),
      imageUrl: image(item, `${description ?? ''} ${content ?? ''}`),
    });
  }
  return out;
}

export function canonicalUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    // Drop tracking parameters; keep anything else (some sites use ?id=).
    [...u.searchParams.keys()].forEach((k) => /^(utm_|fbclid|gclid|tncms)/i.test(k) && u.searchParams.delete(k));
    return u.toString().replace(/\/+$/, '');
  } catch {
    return url.trim();
  }
}

/** Stable id: reactions and comments hang off it, so it must not change between refreshes. */
export function articleId(url) {
  return createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 20);
}

const MAX_SUMMARY = 280;

export function normalize(raw, source, now = new Date()) {
  const published = raw.pubDate ? new Date(raw.pubDate) : null;
  const publishedAt = published && !Number.isNaN(published.getTime()) ? published.toISOString() : now.toISOString();
  if (!/^https?:\/\//.test(raw.link)) return null;
  let summary = raw.summary;
  if (summary) {
    // WordPress feeds append "The post … appeared first on …"; drop it.
    summary = summary.replace(/\s*The post .* appeared first on .*$/i, '').trim();
    if (summary.length > MAX_SUMMARY) summary = summary.slice(0, MAX_SUMMARY).replace(/\s+\S*$/, '') + '…';
  }
  return {
    id: articleId(raw.link),
    source: source.name,
    sourceSlug: source.slug,
    title: raw.title,
    summary: summary || undefined,
    url: canonicalUrl(raw.link),
    imageUrl: raw.imageUrl,
    author: raw.author || undefined,
    publishedAt,
  };
}

export function isRecent(article, now = new Date(), maxAgeDays = MAX_AGE_DAYS) {
  return now.getTime() - new Date(article.publishedAt).getTime() <= maxAgeDays * 86400000;
}

const titleKey = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Remove duplicates: same URL, or the same headline on several Advocate
 * network sites (kept from the higher-priority source).
 */
export function dedupe(articles) {
  const priority = new Map(SOURCES.map((s, i) => [s.slug, i]));
  const sorted = [...articles].sort((a, b) => (priority.get(a.sourceSlug) ?? 99) - (priority.get(b.sourceSlug) ?? 99));
  const byId = new Set();
  const byTitle = new Set();
  const out = [];
  for (const a of sorted) {
    const tk = titleKey(a.title);
    if (byId.has(a.id) || byTitle.has(tk)) continue;
    byId.add(a.id);
    byTitle.add(tk);
    out.push(a);
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// ---- Reactions & comments ----

export const REACTIONS = ['up', 'wow', 'think', 'sad', 'angry'];

export const COMMENT_RATE = { max: 5, windowMs: 10 * 60 * 1000 };
export const REPORTS_TO_HIDE = 3;

// Held for review instead of shown: links (spam) and a short list of slurs.
// Reports catch the rest; admins review held comments in Admin → Comments.
const SLURS = /\b(n[i1]gg(?:er|a)s?|f[a@]gg?(?:ot)?s?|k[i1]kes?|sp[i1]cs?|ch[i1]nks?|wetbacks?|retards?|tr[a@]nn(?:y|ies))\b/i;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|info)\b)/i;

/** Why a new comment should be held for review, or null to publish it. */
export function holdReason(text) {
  if (SLURS.test(text)) return 'language';
  if (LINK.test(text)) return 'link';
  if (/(.)\1{9,}/.test(text) || (text.length > 40 && text === text.toUpperCase() && /[A-Z]/.test(text))) return 'spam';
  return null;
}

/** Timestamps (ms) of the user's recent comments → is this one over the limit? Also returns the list to store. */
export function rateLimit(recent, nowMs, rate = COMMENT_RATE) {
  const kept = (recent ?? []).filter((t) => nowMs - t < rate.windowMs);
  return { over: kept.length >= rate.max, next: [...kept, nowMs].slice(-rate.max * 2) };
}

// ---- Headline image (og:image) from the article page ----

/** Sources whose feed already carries the lead photo; never fetch their pages (they rate-limit). */
export const FEED_HAS_LEAD_IMAGE = new Set(['the-advocate', 'nola-com', 'acadiana-advocate', 'shreveport-bossier-advocate']);

/**
 * The article's headline/share image: og:image, then twitter:image, then
 * <link rel="image_src">. Returns an absolute https URL or undefined.
 */
export function extractOgImage(html, pageUrl) {
  const head = html.slice(0, 300000);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const attr = (tagHtml, name) => tagHtml.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
  const pick = (keys) => {
    for (const k of keys) {
      const t = metas.find((m) => (attr(m, 'property') ?? attr(m, 'name') ?? '').toLowerCase() === k);
      const c = t && attr(t, 'content');
      if (c) return c;
    }
    return undefined;
  };
  const raw = pick(['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']) ?? head.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1];
  if (!raw) return undefined;
  try {
    const u = new URL(decodeEntities(raw.trim()), pageUrl);
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.protocol === 'https:' && !NOT_A_PHOTO.test(u.pathname) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
