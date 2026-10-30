# MyBallot

A Louisiana voter guide. Voters see what's on their ballot, compare candidates,
read plain-language explanations of ballot measures, and build a personal ballot
to take to the polls. Launch target: the 2027 Louisiana elections (Oct 9 primary,
Nov 20 general), starting with statewide races and East Baton Rouge Parish.

Platforms: the web (desktop and mobile), plus iOS and Android apps planned
(the same code, packaged with Capacitor).

## What's in the app

**For voters**
- Browse and search candidates; candidate profiles with bios, links and survey answers
- Side-by-side comparison of candidates in a race
- Build your ballot (no account needed; sign in to sync it across devices)
- Private notes on candidates, election reminders
- Ballot measures with plain-language explanations
- Election essentials, past results, Louisiana political news
- Works offline once loaded

**For admins** (`/#/admin`, restricted to admin accounts)
- Add and edit candidates: photos (with focal-point cropping), bios, links, survey answers
- CSV import for candidates and survey responses
- Ballot measures and survey questions
- Publish bundled pipeline data to the database

## Tech

- React 18 + TypeScript, built with Vite; Tailwind CSS; installable PWA
- Firebase: Auth, Firestore (election data + user data, offline cache), Storage (photos)
- No custom backend server. Security is enforced by `firestore.rules` and `storage.rules`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run deploy:preview` | Build and deploy to a private Firebase Hosting preview link (expires in 7 days) |
| `npm run test:data` | Tests for how database data merges with the bundled data |
| `npm run data:snapshot` | Refresh the bundled data from the live database (run before release builds) |

No `.env` is required. The Firebase web config in `firebase.ts` is public by
design; access is controlled by the security rules.

## How data works

The **Firestore database is the source of truth**. The app ships with a bundled
copy of the election data (`data/app/*.json`, produced by the data pipeline),
loads the database on top of it, and stays subscribed. Admin edits reach every
screen within seconds without a new release, and the last data is cached on the
device for offline use.

- Election data flow, admin setup, deploying rules: [`docs/ADMIN_SETUP.md`](docs/ADMIN_SETUP.md)
- Data sources and the pipeline: [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)
- Notes for coding agents: [`AGENTS.md`](AGENTS.md)

## Project layout

```
App.tsx, index.tsx        App shell and routes (HashRouter)
pages/                    Screens (pages/admin/ = admin dashboard, pages/info/ = info hub)
components/               Reusable UI
hooks/                    Auth, ballot, notes, settings
services/                 Data access (electionDataStore = live data store), Firestore writes
data/seed/                Hand-entered election data (pipeline input)
data/contests/, data/app/ Pipeline output; data/app is bundled into the app
data/profiles/            Candidate profiles not currently on any ballot
data-pipeline/            Pipeline + news fetcher + snapshot scripts (Node/tsx)
public/                   Static files served as-is (icons, manifest, news/results JSON)
firestore.rules, storage.rules   Security rules
tests/                    Data-merge tests, security-rules tests
```
