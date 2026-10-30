# Data Sources

MyBallot sources ballot data from multiple providers. Each source implements
the `BallotExtractor` interface (see ADR-001) so the pipeline can swap or
stack them without touching the UI layer.

## Current Sources

### Google Civic Information API (`google-civic`)

| Field           | Value |
|-----------------|-------|
| API Docs        | https://developers.google.com/civic-information |
| Base URL        | `https://www.googleapis.com/civicinfo/v2` |
| Auth            | API key (`GOOGLE_CIVIC_API_KEY` env var) |
| Rate limits     | ~25 000 req/day (free tier) |
| Data freshness  | Mirrors VIP feeds; updated by state election offices |

**What it provides:**
- Election list (`/elections`)
- Contest / race data for a given address + election (`/voterinfo`)
- Candidate names, parties, URLs, social channels
- Referendum titles, descriptions, ballot responses
- Polling locations and early vote sites
- District metadata (scope, OCD division IDs)

**Limitations:**
- **Address-centric** — returns only races relevant to a single address.
  To get all contests parish-wide, you need representative addresses per
  district (or combine with a SOS feed).
- **Louisiana coverage is sparse.** As of Feb 2026, no Louisiana elections
  appear in the API. The pipeline was validated against the NC Primary
  (election ID 9505, Charlotte address) which has full VIP coverage.
- No candidate bios, survey responses, or photos beyond the occasional
  `photoUrl` / `candidateUrl`.

### Manual Entry (`manual`) — PRIMARY SOURCE FOR LOUISIANA

| Field           | Value |
|-----------------|-------|
| Seed dir        | `data/seed/` |
| Format          | JSON files matching `SeedFile` TypeScript interface |
| Coverage        | Louisiana / East Baton Rouge Parish |

This is the **primary data source** for Louisiana elections because Google
Civic API does not currently carry Louisiana election data (no VIP feed).

**Coverage status (cleaned up and re-verified Oct 26, 2026):**

`data/seed/la-2026-may-primary.json`: May 16, 2026 closed party primary.
- **U.S. Senate Republican and Democratic primaries** (verified against published results).
- Removed the U.S. House primaries. The governor suspended them after
  *Louisiana v. Callais*, and they moved to Nov 3 under a redrawn map.
- Removed the Family Court Judge special election (could not be verified).

`data/seed/la-2026-nov.json`: November 3, 2026 election. **Partial.**
- **U.S. Senate general**: Julia Letlow (R) vs. Jamie Davis (D).
- **Not loaded yet:** U.S. House open primaries (new map), constitutional
  amendments, and local races and propositions. The app shows a partial-ballot
  notice for this election (`coverageNote` on the cycle in `constants.tsx`).
- Removed Mayor-President and Metro Council (those seats were elected in 2024;
  next race is 2028), plus Family Court Judge and "Proposition L" (could not be
  verified).

`public/data/results/elections.json` is intentionally empty. The previous contents
were placeholder numbers presented as real results. Only add results copied
from official Secretary of State returns.

**Candidate photos and profiles (synced from Firestore Oct 29, 2026):**
- The hand-curated photo links for Cassidy, Fleming, Letlow and Crockett are now
  in the seed files, so they no longer live only in Firestore.
- Nick Albares's and Jamie Davis's Firestore photos were Facebook CDN links,
  which have already expired. Replace them with official photos.
- `data/profiles/candidate-profiles.json` keeps the House candidates you
  corrected in the admin dashboard (names, parties, photos). They aren't on any
  ballot until their new-map races are verified. The pipeline doesn't read this
  folder. Don't put non-election files in `data/seed/`, because the runner
  treats every file there as an election.
- Prefer photos from official sources (government or campaign sites), or upload
  them to Firebase Storage. Links to Facebook or Google Images thumbnails stop
  working.

**Pipeline fix (Oct 29, 2026):** the contest change-detection hash ignored
nested fields, so editing a candidate's name, party or photo in a seed file was
silently skipped as "Unchanged". `computeHash` now sorts keys recursively.

**Rule going forward:** every contest and candidate in a seed file should be
traceable to an official source (SoS qualifying list, sample ballot, or
certified results). Each seed file's `_coverageNote` records what was verified
and what's missing.

To add new races or candidates, edit the seed file and re-run:
```bash
npx tsx data-pipeline/src/runner.ts --source manual
npx tsx data-pipeline/src/seed-app.ts
```

The second command (`seed-app.ts`) converts pipeline output to the app's data
model and writes `data/app/candidates.json` + `data/app/ballot-measures.json`,
which `constants.tsx` imports directly.

### Louisiana Secretary of State (`sos-la`)

Future. The LA SOS publishes candidate qualifying data and election results.
A dedicated extractor will parse their feeds when available.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────┐
│          Stage 1: data-pipeline/src/runner.ts        │
│                                                     │
│  1. EXTRACT   →  ManualExtractor / GoogleCivic      │
│                  (with file-based 24h cache)         │
│                                                     │
│  2. TRANSFORM →  transformManualContests() /         │
│                  transformGoogleCivicContests()      │
│                  Raw JSON → ContestV1 schema         │
│                  Generates OCD-style IDs             │
│                  Computes SHA-256 content hashes     │
│                                                     │
│  3. DIFF      →  diffContests()                     │
│                  Hash comparison vs existing store   │
│                  Detects adds / updates / deletes    │
│                                                     │
│  4. WRITE     →  data/contests/{electionId}.json    │
│                  + data/contests/manifest.json       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│         Stage 2: data-pipeline/src/seed-app.ts      │
│                                                     │
│  5. ADAPT     →  ContestV1 → Candidate[]            │
│                  ContestV1 → BallotMeasure[]         │
│                  Office mapping, name parsing,       │
│                  stable IDs, social link conversion  │
│                                                     │
│  6. WRITE     →  data/app/candidates.json           │
│                  data/app/ballot-measures.json       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  Frontend (constants.tsx imports data/app/*.json)     │
│  + Firestore overlay for editorial enrichment        │
│  + Debug route: /#/debug/ballot-feed                 │
└──────────────────────────────────────────────────────┘
```

## Running the Pipeline

```bash
# Full pipeline: extract + normalize + adapt (no API key needed for manual)
npx tsx data-pipeline/src/runner.ts --source manual
npx tsx data-pipeline/src/seed-app.ts

# List available seed elections
npx tsx data-pipeline/src/runner.ts --source manual --list-elections

# Google Civic (when LA data becomes available)
GOOGLE_CIVIC_API_KEY=<key> npx tsx data-pipeline/src/runner.ts \
  --source google-civic --address "..." --election-id ...
npx tsx data-pipeline/src/seed-app.ts

# Output (Stage 1 — runner.ts):
#   data/contests/la-2026-nov.json         ← normalized ContestV1 records
#   data/contests/la-2026-may-primary.json ← normalized ContestV1 records
#   data/contests/manifest.json            ← metadata summary
#
# Output (Stage 2 — seed-app.ts):
#   data/app/candidates.json       ← Candidate[] for the app
#   data/app/ballot-measures.json  ← BallotMeasure[] for the app
```

## Schema

The normalized data contract is defined in `/schemas/contest_v1.schema.json`
(based on VIP 5.2 Contest). TypeScript types mirror the schema in
`data-pipeline/src/types.ts`.

Key fields per contest:
- `id` — deterministic OCD-style key: `{electionId}:{division}:{officeSlug}`
- `contentHash` — SHA-256 of the stable payload for diff detection
- `source` — which extractor produced the record
- `deleted` — soft-delete flag when a contest disappears upstream

## Security

- The Google Civic API key is passed via `GOOGLE_CIVIC_API_KEY` environment
  variable. It is **never** committed to the repo or sent to the browser.
- The pipeline output (`data/contests/*.json`) contains only public
  election/candidate data — no voter addresses or PII.
- The query address in `manifest.json` is a civic building address used
  for testing; real voter addresses should never be logged.
