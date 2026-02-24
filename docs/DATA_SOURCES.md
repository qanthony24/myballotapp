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

### Manual Entry (`manual`)

Planned. Will import from a JSON/CSV maintained by the MyBallot editorial
team. Fills gaps not covered by the API (e.g. candidate bios, survey
responses, local races without VIP data).

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
# Set the API key (never committed to source)
export GOOGLE_CIVIC_API_KEY=<your-key>

# List available elections
npx tsx data-pipeline/src/runner.ts --list-elections

# Fetch contest data for a specific address and election
npx tsx data-pipeline/src/runner.ts \
  --address "600 E Trade St Charlotte NC" \
  --election-id 9505

# Output:
#   data/contests/9505.json      ← normalized contest records
#   data/contests/manifest.json  ← metadata summary
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
