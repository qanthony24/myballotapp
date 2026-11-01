// News feed parsing and comment moderation (functions/lib/news.js). Run: npm run test:data
import assert from 'node:assert/strict';
import { parseFeed, normalize, dedupe, articleId, canonicalUrl, isRecent, holdReason, rateLimit, SOURCES } from '../functions/lib/news.js';

// Shapes seen in the real feeds (BLOX/TownNews for the Advocate sites, WordPress for the Illuminator).
const blox = `<?xml version="1.0"?><rss><channel><title>Politics</title>
<item><title><![CDATA[The races for Louisiana&#8217;s two open seats in Congress]]></title>
<link>https://www.theadvocate.com/baton_rouge/news/politics/congress-races/article_abc.html?utm_source=rss#tncms</link>
<description><![CDATA[<p>Voters in two districts will pick &amp; choose.</p>]]></description>
<pubDate>Sat, 31 Oct 2026 04:00:00 -0500</pubDate><dc:creator>BY JANE REPORTER | Staff writer</dc:creator>
<enclosure url="https://bloximages.example.com/photo?resize=1" length="1838076" type="image/png" /></item>
<item><title>No link item</title></item>
</channel></rss>`;
const wp = `<rss><channel><item><title>Legislators weigh &quot;data centers&quot;</title>
<link>https://lailluminator.com/2026/10/30/data-centers/</link>
<description><![CDATA[<img src="http://insecure.example/x.jpg"> A long summary. The post Legislators weigh data centers appeared first on Louisiana Illuminator.]]></description>
<pubDate>Fri, 30 Oct 2026 22:54:47 +0000</pubDate><author>Wesley Muller</author></item></channel></rss>`;

const raw = parseFeed(blox);
assert.equal(raw.length, 1, 'items without a link are skipped');
assert.equal(raw[0].title, 'The races for Louisiana’s two open seats in Congress');
assert.equal(raw[0].summary, 'Voters in two districts will pick & choose.');
assert.equal(raw[0].imageUrl, 'https://bloximages.example.com/photo?resize=1', 'BLOX enclosure: url before type, no file extension');
const now = new Date('2026-11-01T12:00:00Z');
const a = normalize(raw[0], SOURCES[0], now)!;
assert.equal(a.url, 'https://www.theadvocate.com/baton_rouge/news/politics/congress-races/article_abc.html', 'tracking params and hash dropped');
assert.equal(a.publishedAt, '2026-10-31T09:00:00.000Z');
assert.equal(a.author, 'Jane Reporter');
assert.equal(a.id, articleId('https://www.theadvocate.com/baton_rouge/news/politics/congress-races/article_abc.html?utm_medium=x'), 'id is stable across tracking params');
assert.match(a.id, /^[0-9a-f]{20}$/);

const w = normalize(parseFeed(wp)[0], SOURCES[1], now)!;
assert.equal(w.title, 'Legislators weigh "data centers"');
assert.equal(w.summary, 'A long summary.', 'WordPress "appeared first on" footer removed');
assert.equal(w.imageUrl, undefined, 'non-https images dropped');
assert.ok(isRecent(w, now));
assert.ok(!isRecent({ ...w, publishedAt: '2026-10-01T00:00:00Z' }, now), 'older than 14 days');
assert.equal(canonicalUrl('https://x.com/a/?id=5&utm_source=y'), 'https://x.com/a/?id=5');

// Same story on the Shreveport-Bossier site → kept once, from the higher-priority source.
const shv = { ...a, id: 'other', sourceSlug: 'shreveport-bossier-advocate', source: 'Shreveport-Bossier Advocate', url: 'https://www.shreveportbossieradvocate.com/x' };
const d = dedupe([shv, w, a]);
assert.equal(d.length, 2);
assert.equal(d.find((x) => x.title.startsWith('The races'))!.sourceSlug, 'the-advocate');
assert.equal(d[0].publishedAt >= d[1].publishedAt, true, 'newest first');
console.log('news parsing OK');

// Moderation.
assert.equal(holdReason('I think the PSC candidate has the better plan on rates.'), null);
assert.equal(holdReason('read more at www.spam-site.ru now'), 'link');
assert.equal(holdReason('See https://example.com'), 'link');
assert.equal(holdReason('THIS IS ALL CAPS SHOUTING ABOUT THE ELECTION FOR NO REASON'), 'spam');
assert.equal(holdReason('soooooooooooooooo'), 'spam');
assert.equal(holdReason('Fiscal policy matters, e.g. the budget.'), null, 'abbreviations are not links');
let r = rateLimit([], 0);
for (let i = 1; i < 5; i++) r = rateLimit(r.next, i * 1000);
assert.equal(r.over, false, '5th comment in the window is fine');
assert.equal(rateLimit(r.next, 6000).over, true, '6th within 10 minutes is held');
assert.equal(rateLimit(r.next, 11 * 60 * 1000).over, false, 'window expires');
console.log('comment moderation OK');
