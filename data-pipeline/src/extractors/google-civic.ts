import { BallotExtractor } from './base.js';
import {
  GoogleCivic,
  RawExtractionResult,
  SourceId,
} from '../types.js';
import { readCache, writeCache } from '../cache.js';

const BASE_URL = 'https://www.googleapis.com/civicinfo/v2';
const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 1_000;

export class GoogleCivicExtractor extends BallotExtractor {
  readonly sourceId: SourceId = 'google-civic';
  readonly displayName = 'Google Civic Information API';
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    if (!apiKey) throw new Error('GoogleCivicExtractor requires an API key');
    this.apiKey = apiKey;
  }

  /** Fetch with exponential backoff on 429 / 5xx only. */
  private async fetchWithBackoff<T>(url: string): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url);

        if (res.status === 429 || res.status >= 500) {
          const wait = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[google-civic] ${res.status} on attempt ${attempt + 1}, retrying in ${wait}ms…`,
          );
          await sleep(wait);
          lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
          continue;
        }

        const body = await res.json();

        if (body.error) {
          // 4xx errors (except 429) are not retryable
          throw new Error(
            `Google Civic API error ${body.error.code}: ${body.error.message}`,
          );
        }

        return body as T;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        // Don't retry on known non-transient API errors
        if (error.message.includes('API error 4')) throw error;
        lastError = error;
        if (attempt < MAX_RETRIES) {
          const wait = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[google-civic] Attempt ${attempt + 1} failed: ${lastError.message}, retrying in ${wait}ms…`,
          );
          await sleep(wait);
        }
      }
    }
    throw lastError ?? new Error('fetchWithBackoff exhausted retries');
  }

  async listElections(): Promise<
    Array<{ id: string; name: string; date: string }>
  > {
    const cacheKey = 'google-civic:elections';
    const cached = await readCache<GoogleCivic.ElectionsResponse>(cacheKey);
    if (cached) {
      return cached.elections.map((e) => ({
        id: e.id,
        name: e.name,
        date: e.electionDay,
      }));
    }

    const url = `${BASE_URL}/elections?key=${this.apiKey}`;
    const data =
      await this.fetchWithBackoff<GoogleCivic.ElectionsResponse>(url);

    await writeCache(cacheKey, data);
    return data.elections.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.electionDay,
    }));
  }

  /**
   * Fetch contest/voter info for a specific address and election.
   *
   * @param electionDate  Used to find matching electionId if not in options.
   * @param options.address  Street address to query (REQUIRED).
   * @param options.electionId  Explicit Google Civic electionId (optional).
   */
  async fetch(
    electionDate: string,
    options?: Record<string, unknown>,
  ): Promise<RawExtractionResult> {
    const address = options?.address as string | undefined;
    if (!address) {
      throw new Error(
        'GoogleCivicExtractor.fetch() requires options.address',
      );
    }

    let electionId = options?.electionId as string | undefined;

    if (!electionId) {
      const elections = await this.listElections();
      const match = elections.find((e) => e.date === electionDate);
      if (match) {
        electionId = match.id;
      } else {
        throw new Error(
          `No Google Civic election found for date ${electionDate}. Available: ${elections.map((e) => `${e.date} (${e.id})`).join(', ')}`,
        );
      }
    }

    const cacheKey = `google-civic:voterinfo:${electionId}:${hashAddress(address)}`;
    const cached =
      await readCache<GoogleCivic.VoterInfoResponse>(cacheKey);
    if (cached && cached.contests) {
      console.log(
        `[google-civic] Cache hit for ${cacheKey} (${cached.contests.length} contests)`,
      );
      return buildResult(cached, address, electionDate);
    }

    const encodedAddr = encodeURIComponent(address);
    const url = `${BASE_URL}/voterinfo?key=${this.apiKey}&address=${encodedAddr}&electionId=${electionId}`;
    const start = Date.now();
    const data =
      await this.fetchWithBackoff<GoogleCivic.VoterInfoResponse>(url);
    const durationMs = Date.now() - start;

    await writeCache(cacheKey, data);

    return buildResult(data, address, electionDate, durationMs);
  }
}

function buildResult(
  data: GoogleCivic.VoterInfoResponse,
  address: string,
  electionDate: string,
  durationMs = 0,
): RawExtractionResult {
  const contests = data.contests ?? [];
  return {
    meta: {
      source: 'google-civic',
      electionId: data.election.id,
      electionDate: data.election.electionDay ?? electionDate,
      electionName: data.election.name,
      address,
      fetchedAt: new Date().toISOString(),
      durationMs,
      rawContestCount: contests.length,
    },
    rawContests: contests,
    rawResponse: data,
  };
}

function hashAddress(address: string): string {
  let hash = 0;
  for (const ch of address.toLowerCase().replace(/\s+/g, '')) {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
