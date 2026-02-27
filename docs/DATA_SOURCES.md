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

The seed file `data/seed/la-2026-nov.json` contains **17 contests** and
**39 real candidates** for the November 3, 2026 General Election:

- **U.S. Senate** — Cassidy, Letlow, Fleming, Spencer, Davis
- **U.S. House 5th District** — Miguez, Cathey, Edmonds, McMakin, Cordell, Foy
- **U.S. House 6th District** — Cleo Fields (incumbent)
- **Mayor-President** — Broome + 8 challengers (9 total)
- **Metro Council Districts 1–12** — all qualified candidates
- **Family Court Judge** — special election (candidates TBD)

To add new races or candidates, edit the seed file and re-run the pipeline.

### Louisiana Secretary of State (`sos-la`)

Future. The LA SOS publishes candidate qualifying data and election results.
A dedicated extractor will parse their feeds when available.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────┐
│               CLI: data-pipeline/src/runner.ts       │
│                                                     │
│  1. EXTRACT   →  GoogleCivicExtractor.fetch()       │
│                  (with file-based 24h cache)         │
│                                                     │
│  2. TRANSFORM →  transformGoogleCivicContests()     │
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
└─────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────┐
│  Frontend (Vite serves)  │
│  /data/contests/*.json   │
│  ▸ /#/debug/ballot-feed  │
└──────────────────────────┘
```

## Running the Pipeline

```bash
# Process Louisiana seed data (default, no API key needed)
npx tsx data-pipeline/src/runner.ts --source manual

# List available seed elections
npx tsx data-pipeline/src/runner.ts --source manual --list-elections

# Google Civic (when LA data becomes available)
GOOGLE_CIVIC_API_KEY=<key> npx tsx data-pipeline/src/runner.ts \
  --source google-civic --address "..." --election-id ...

# Output:
#   data/contests/la-2026-nov.json  ← normalized contest records
#   data/contests/manifest.json     ← metadata summary
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
