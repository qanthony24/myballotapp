# Deploying

MyBallot is a static site served by **Firebase Hosting** (project `myballot-app`).
There's no server to deploy. (Firebase *App Hosting* is a different product for
server-rendered apps; it doesn't fit this app and its backend was deleted in
Oct 2026.)

## One-time setup on your computer

```bash
npx firebase-tools@15 login     # opens a browser to sign in with your Google account
```

## Private preview link (for testing)

```bash
npm run deploy:preview
```

This builds the app and uploads it to a **preview channel**: a private URL like
`https://myballot-app--preview-xxxxxxxx.web.app` that expires after 7 days.
Re-running it updates the same link. It doesn't touch the main site.

**Google sign-in on a preview link:** Firebase only allows sign-in from approved
domains. The first time, add the preview domain in the Firebase console under
**Authentication → Settings → Authorized domains** (paste the host without
`https://`). Browsing without signing in works either way.

## Production (later)

```bash
npm run build && npx firebase-tools@15 deploy --only hosting
```

This publishes to `https://myballot-app.web.app`. Hold off until the MVP is ready.

## Security rules

```bash
npm run deploy:rules
```

This deploys `firestore.rules` and `storage.rules` from the repo. The rules in
the repo match what's live as of Oct 27, 2026. See `docs/ADMIN_SETUP.md` for
what they allow and how to test them first.

## Cloud Functions (news feed, reactions, comments)

`functions/` holds four small functions:

| Function | What it does |
|---|---|
| `refreshNews` | Every 30 minutes, pulls the six news feeds (`functions/lib/news.js` → `SOURCES`) into Firestore `news/`. Status in `config/newsStatus`. |
| `countReactions` | Keeps the reaction totals on each article. |
| `moderateComments` | New comments: rate limit (5 per 10 minutes) and hold checks (links, flagged words, spam). Keeps comment counts. |
| `countReports` | Three reports hide a comment until an admin reviews it (Admin → Comments). |

Deploy (also deploys the Firestore rules and indexes they rely on):

```bash
npm run deploy:functions
```

The first deploy may ask to enable a few Google Cloud APIs (Cloud Functions,
Cloud Build, Artifact Registry, Cloud Scheduler, Eventarc). Say yes. It's on
the Blaze plan already; at this volume the cost should be pennies a month.

After deploying, the first news refresh happens within 30 minutes. To run it
right away: Google Cloud console → Cloud Scheduler → `firebase-schedule-refreshNews-…` → **Force run**.
Check `config/newsStatus` in Firestore to see how each source did.

To change sources, edit `SOURCES` in `functions/lib/news.js` and deploy again.

**Node.js runtime:** the functions run on Node.js 24 (`firebase.json` →
`runtime`), which Google supports until October 2028. Google retires each
version on a fixed schedule (Node 20 was retired Oct 31, 2026), and deploys
fail once that happens. Before then, bump `runtime` and `functions/package.json`
→ `engines.node` to the next version.

## Caching

`firebase.json` sets these cache rules:
- `index.html`, the service worker (`sw.js`), `manifest.json` and `/data/**`
  (news and results) are never cached, so updates show up right away.
- Built JS and CSS under `/assets/` have content-hashed names, so they're cached
  for a year.

The app is also a PWA, and the service worker updates itself on the next visit
after a deploy.
