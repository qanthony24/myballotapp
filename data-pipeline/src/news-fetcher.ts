#!/usr/bin/env node
/**
 * News feed fetcher: RSS → normalized JSON.
 *
 * Fetches RSS feeds from approved Louisiana news outlets, normalizes
 * articles into the NewsArticle schema, deduplicates by URL, filters
 * for political/civic relevance, and writes data/news/feed.json.
 *
 * Usage:
 *   npx tsx data-pipeline/src/news-fetcher.ts
 *
 * For production, run on a schedule (every 10-30 minutes) via cron
 * or a Firebase Cloud Function.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const OUTPUT_PATH = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '../../data/news/feed.json',
);

const MAX_ARTICLES = 50;
const MAX_AGE_DAYS = 14;

interface FeedSource {
  name: string;
  slug: string;
  feedUrl: string;
}

const SOURCES: FeedSource[] = [
  { name: 'The Advocate', slug: 'the-advocate', feedUrl: 'https://www.theadvocate.com/baton_rouge/news/politics/rss/' },
  { name: 'NOLA.com', slug: 'nola-com', feedUrl: 'https://www.nola.com/news/politics/rss/' },
  { name: 'Louisiana Illuminator', slug: 'louisiana-illuminator', feedUrl: 'https://lailluminator.com/feed/' },
  { name: 'WAFB', slug: 'wafb', feedUrl: 'https://www.wafb.com/search/?f=rss&t=article&c=news/politics' },
  { name: 'WBRZ', slug: 'wbrz', feedUrl: 'https://www.wbrz.com/news/politics.rss' },
  { name: 'WWL-TV', slug: 'wwl-tv', feedUrl: 'https://www.wwltv.com/feeds/syndication/rss/news/local' },
  { name: 'The Gambit', slug: 'the-gambit', feedUrl: 'https://www.theadvocate.com/gambit/rss/' },
];

const RELEVANCE_KEYWORDS = [
  'election', 'vote', 'voting', 'ballot', 'candidate', 'primary',
  'runoff', 'campaign', 'legislature', 'governor', 'senator', 'representative',
  'parish', 'council', 'mayor', 'sheriff', 'judge', 'millage', 'tax',
  'democrat', 'republican', 'bipartisan', 'political', 'politics',
  'baton rouge', 'louisiana', 'capitol', 'redistrict', 'gerrymander',
  'polling', 'precinct', 'registration', 'qualification',
];

const EXCLUDE_KEYWORDS = [
  'sports', 'football', 'basketball', 'baseball', 'lsu tigers',
  'saints score', 'pelicans score', 'recipe', 'entertainment',
  'weather forecast', 'traffic update', 'flash flood', 'tornado warning',
  'severe thunderstorm', 'amber alert', 'obituar',
];

interface RawArticle {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  author?: string;
  imageUrl?: string;
  categories?: string[];
}

interface NewsArticle {
  id: string;
  source: string;
  sourceSlug: string;
  title: string;
  summary?: string;
  url: string;
  imageUrl?: string;
  author?: string;
  publishedAt: string;
  categories?: string[];
  createdAt: string;
  updatedAt: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isRelevant(article: RawArticle): boolean {
  const text = `${article.title} ${article.description ?? ''}`.toLowerCase();
  const excluded = EXCLUDE_KEYWORDS.some((kw) => text.includes(kw));
  if (excluded) return false;
  return RELEVANCE_KEYWORDS.some((kw) => text.includes(kw));
}

function isRecent(pubDate: string | undefined): boolean {
  if (!pubDate) return true;
  const published = new Date(pubDate);
  if (isNaN(published.getTime())) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  return published >= cutoff;
}

function extractImageFromDescription(desc: string): string | undefined {
  const match = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Minimal XML → article parser. Extracts <item> elements from RSS/Atom.
 * Full XML parsing would use a library; this is sufficient for RSS feeds.
 */
function parseRssFeed(xml: string): RawArticle[] {
  const articles: RawArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractTag(item, 'title');
    const link = extractTag(item, 'link');
    const description = extractTag(item, 'description');
    const pubDate = extractTag(item, 'pubDate');
    const author = extractTag(item, 'dc:creator') ?? extractTag(item, 'author');
    const imageUrl = extractMediaContent(item) ??
      (description ? extractImageFromDescription(description) : undefined);
    const categories = extractAllTags(item, 'category');

    if (title && link) {
      articles.push({
        title: stripHtml(title),
        link: link.trim(),
        description: description ? stripHtml(description).substring(0, 300) : undefined,
        pubDate,
        author: author ? stripHtml(author) : undefined,
        imageUrl,
        categories: categories.map((c) => slugify(stripHtml(c))).filter(Boolean),
      });
    }
  }
  return articles;
}

function extractTag(xml: string, tag: string): string | undefined {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match?.[1];
}

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function extractMediaContent(xml: string): string | undefined {
  const match = xml.match(/<media:content[^>]+url=["']([^"']+)["']/i) ??
    xml.match(/<enclosure[^>]+url=["']([^"']+)["']/i) ??
    xml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  return match?.[1];
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Map<string, NewsArticle>();
  for (const a of articles) {
    const normalizedUrl = a.url.replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (!seen.has(normalizedUrl)) {
      seen.set(normalizedUrl, a);
    }
  }
  return Array.from(seen.values());
}

async function fetchFeed(source: FeedSource): Promise<RawArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(source.feedUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MyBallot-NewsFetcher/1.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`  ⚠️  ${source.name}: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    return parseRssFeed(xml);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠️  ${source.name}: ${msg}`);
    return [];
  }
}

async function main(): Promise<void> {
  console.log('\n📰 MyBallot — News Feed Fetcher\n');
  const now = new Date().toISOString();
  const allArticles: NewsArticle[] = [];

  for (const source of SOURCES) {
    console.log(`📥 Fetching: ${source.name} (${source.feedUrl})`);
    const raw = await fetchFeed(source);
    console.log(`   Got ${raw.length} items`);

    const relevant = raw.filter(isRelevant);
    console.log(`   ${relevant.length} relevant after filtering`);

    for (const r of relevant) {
      if (!isRecent(r.pubDate)) continue;

      allArticles.push({
        id: `${source.slug}-${slugify(r.title).substring(0, 40)}-${Date.now()}`,
        source: source.name,
        sourceSlug: source.slug,
        title: r.title,
        summary: r.description,
        url: r.link,
        imageUrl: r.imageUrl,
        author: r.author,
        publishedAt: r.pubDate ? new Date(r.pubDate).toISOString() : now,
        categories: r.categories,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const deduped = deduplicateArticles(allArticles);
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const trimmed = deduped.slice(0, MAX_ARTICLES);

  console.log(`\n📊 Summary:`);
  console.log(`   Total fetched: ${allArticles.length}`);
  console.log(`   After dedup: ${deduped.length}`);
  console.log(`   Output (max ${MAX_ARTICLES}): ${trimmed.length}`);

  const sourceCounts = new Map<string, number>();
  for (const a of trimmed) {
    sourceCounts.set(a.source, (sourceCounts.get(a.source) ?? 0) + 1);
  }
  console.log('\n   By source:');
  for (const [name, count] of sourceCounts) {
    console.log(`     ${name}: ${count}`);
  }

  const output = {
    items: trimmed,
    lastRefreshedAt: now,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n💾 Wrote ${trimmed.length} articles → ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  console.log('✅ News fetch complete.\n');
}

main().catch((err) => {
  console.error('\n❌ News fetcher failed:', err.message);
  process.exit(1);
});
