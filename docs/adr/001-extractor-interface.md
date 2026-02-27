# ADR-001: Pluggable Ballot Extractor Interface

**Status:** Accepted
**Date:** 2026-02-24
**Decision makers:** Project team

## Context

MyBallot needs to ingest ballot data from multiple sources over time:

1. **Google Civic Information API** — available now, mirrors VIP feeds,
   JSON-based, address-centric.
2. **Louisiana Secretary of State** — future, likely XML/HTML scraping,
   may provide richer local data.
3. **Manual entry** — always needed for candidate bios, survey responses,
   photos, and jurisdictions without API coverage.
4. **VIP XML feeds** — future, direct access to Voting Information Project
   data files.

Each source has different auth, rate limits, data shapes, and update
cadences. We need a design that lets us add or swap sources without
touching the transformation logic or the frontend.

## Decision

Define an abstract `BallotExtractor` base class that every data source
must implement:

```typescript
abstract class BallotExtractor {
  abstract readonly sourceId: SourceId;
  abstract readonly displayName: string;

  abstract fetch(
    electionDate: string,
    options?: Record<string, unknown>,
  ): Promise<RawExtractionResult>;

  abstract listElections(): Promise<
    Array<{ id: string; name: string; date: string }>
  >;
}
```

Each extractor returns raw data wrapped in `RawExtractionResult`. A
separate transform step normalizes raw data into the `ContestV1` schema.
This means:

- Extractors own **fetching + caching** for their source.
- Transform functions own **mapping** to the shared schema.
- The pipeline runner owns **orchestration** (extract → transform → diff → write).

## Consequences

**Pros:**
- New data sources only require a new extractor class + transform function.
- Source-specific quirks (rate limits, auth, paging) are isolated.
- The frontend never needs to know which source produced a contest.
- Easy to run multiple extractors in parallel and merge results.

**Cons:**
- Slight boilerplate per new source.
- Each source needs its own transform function (can't fully generalize).
- The `options` bag is loosely typed per source.

## How to Add a New Extractor

1. Create `data-pipeline/src/extractors/{source-name}.ts`
2. Extend `BallotExtractor`, implement `fetch()` and `listElections()`
3. Create `data-pipeline/src/transform-{source-name}.ts` with mapping logic
4. Register in the pipeline runner
5. The `source` field on ContestV1 will automatically tag records
