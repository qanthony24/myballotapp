import { RawExtractionResult, SourceId } from '../types.js';

/**
 * Abstract base class for ballot data extractors.
 *
 * Every data source (Google Civic, LA SOS, manual entry, VIP XML feed)
 * implements this interface so the pipeline runner can swap sources
 * without touching transformation or UI code.
 */
export abstract class BallotExtractor {
  abstract readonly sourceId: SourceId;
  abstract readonly displayName: string;

  /**
   * Fetch raw contest data for the given election.
   *
   * @param electionDate  ISO 8601 date string (e.g. '2026-03-03')
   * @param options       Source-specific options (e.g. address for Google Civic)
   * @returns Raw extraction results before normalization.
   */
  abstract fetch(
    electionDate: string,
    options?: Record<string, unknown>,
  ): Promise<RawExtractionResult>;

  /**
   * List available elections from this source.
   * Returns an array of { id, name, date } objects.
   */
  abstract listElections(): Promise<
    Array<{ id: string; name: string; date: string }>
  >;
}
