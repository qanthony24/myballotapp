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
assert.equal(raw[0].imageUrl, 'https://bloximages.example.com/photo?resize=800%2C', 'BLOX enclosure: url before type, no file extension');
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
assert.equal(w.imageUrl, 'https://insecure.example/x.jpg', 'http images upgraded to https (hidden by the card if the host has no https)');
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

// Illuminator shape: short <description> without a photo; the photo is in <content:encoded>,
// after a tracking pixel / avatar that must be skipped.
const ill = `<rss><channel><item><title>Photo story</title><link>https://lailluminator.com/2026/10/31/x/</link>
<description><![CDATA[Short text only.]]></description>
<content:encoded><![CDATA[<img src="https://secure.gravatar.com/avatar/abc" width="96"><img src="https://lailluminator.com/pixel.gif" width="1" height="1"><figure><img width="1024" src="https://lailluminator.com/wp-content/uploads/2026/10/capitol.jpg"></figure><p>Body</p>]]></content:encoded>
<pubDate>Sat, 31 Oct 2026 12:00:00 +0000</pubDate></item></channel></rss>`;
const ip = parseFeed(ill)[0];
assert.equal(ip.imageUrl, 'https://lailluminator.com/wp-content/uploads/2026/10/capitol.jpg', 'photo found in content:encoded, pixels/avatars skipped');
assert.equal(ip.summary, 'Short text only.', 'summary still from description');
assert.equal(parseFeed('<rss><item><title>t</title><link>https://a.b/c</link><description>no image</description></item></rss>')[0].imageUrl, undefined);
console.log('feed images OK');

// Headline (og:image) extraction.
import { extractOgImage } from '../functions/lib/news.js';
const page = `<html><head><meta charset="utf-8"><meta property="og:title" content="x">
<meta content="https://cms.bayouprogressive.com/uploads/banks-hero.jpg?w=1200&amp;h=630" property="og:image">
<meta name="twitter:image" content="https://cms.bayouprogressive.com/other.jpg"></head><body><img src="/inline.jpg"></body></html>`;
assert.equal(extractOgImage(page, 'https://bayouprogressive.com/a'), 'https://cms.bayouprogressive.com/uploads/banks-hero.jpg?w=1200&h=630', 'og:image wins, attribute order and entities handled');
assert.equal(extractOgImage('<meta name="twitter:image" content="/img/lead.png">', 'https://lailluminator.com/2026/x/'), 'https://lailluminator.com/img/lead.png', 'twitter:image fallback, relative URL resolved');
assert.equal(extractOgImage('<meta property="og:image" content="http://site.com/a.jpg">', 'https://site.com'), 'https://site.com/a.jpg', 'upgraded to https');
assert.equal(extractOgImage('<meta property="og:image" content="https://site.com/logo.png">', 'https://site.com'), undefined, 'site logo is not a headline image');
assert.equal(extractOgImage('<html>no meta</html>', 'https://site.com'), undefined);
console.log('headline images OK');

// Advocate feeds: http:// thumbnails at 300px → https, 800px.
import { feedImageUrl } from '../functions/lib/news.js';
assert.equal(feedImageUrl('http://bloximages.chicago2.vip.townnews.com/theadvocate.com/content/tncms/assets/v3/editorial/c/dd/cdd493ee45.image.jpg?resize=300%2C191'),
  'https://bloximages.chicago2.vip.townnews.com/theadvocate.com/content/tncms/assets/v3/editorial/c/dd/cdd493ee45.image.jpg?resize=800%2C');
assert.equal(feedImageUrl('http://other.example/a.jpg'), 'https://other.example/a.jpg');
assert.equal(feedImageUrl('ftp://x/a.jpg'), undefined);
const bloxItem = parseFeed('<rss><item><title>t</title><link>https://www.theadvocate.com/x</link><enclosure url="http://bloximages.chicago2.vip.townnews.com/a.image.jpg?resize=300%2C191" length="1" type="image/jpeg" /></item></rss>')[0];
assert.equal(bloxItem.imageUrl, 'https://bloximages.chicago2.vip.townnews.com/a.image.jpg?resize=800%2C', 'real BLOX enclosure now kept');
// Bayou Progressive feed after Quentin's change: media:content.
assert.equal(parseFeed('<rss><item><title>t</title><link>https://bayouprogressive.com/x</link><media:content url="https://cms.bayouprogressive.com/uploads/a.jpg" medium="image"/></item></rss>')[0].imageUrl, 'https://cms.bayouprogressive.com/uploads/a.jpg');
console.log('advocate images OK');
