import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BallotExtractor } from './base.js';
import { RawExtractionResult, SourceId } from '../types.js';

/**
 * Manual-entry extractor.
 *
 * Reads curated JSON seed files from data/seed/ and presents them
 * as raw extraction results that flow through the same transform →
 * diff → write pipeline as any API-based source.
 *
 * This is the primary data source for Louisiana elections that aren't
 * (yet) available in the Google Civic API.
 */
export class ManualExtractor extends BallotExtractor {
  readonly sourceId: SourceId = 'manual';
  readonly displayName = 'Manual Entry (Editorial)';
  private seedDir: string;

  constructor(seedDir?: string) {
    super();
    this.seedDir = seedDir ?? path.resolve(
      import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
      '../../../data/seed',
    );
  }

  async listElections(): Promise<
    Array<{ id: string; name: string; date: string }>
  > {
    const files = await fs.readdir(this.seedDir).catch(() => []);
    const elections: Array<{ id: string; name: string; date: string }> = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(this.seedDir, file), 'utf-8');
        const seed = JSON.parse(raw) as SeedFile;
        elections.push({
          id: seed.electionId,
          name: seed.electionName,
          date: seed.electionDate,
        });
      } catch {
        // skip malformed files
      }
    }
    return elections;
  }

  async fetch(
    electionDate: string,
    options?: Record<string, unknown>,
  ): Promise<RawExtractionResult> {
    const seedFile = options?.seedFile as string | undefined;
    let seed: SeedFile;

    if (seedFile) {
      const raw = await fs.readFile(
        path.resolve(this.seedDir, seedFile),
        'utf-8',
      );
      seed = JSON.parse(raw);
    } else {
      seed = await this.findSeedByDate(electionDate);
    }

    return {
      meta: {
        source: 'manual',
        electionId: seed.electionId,
        electionDate: seed.electionDate,
        electionName: seed.electionName,
        address: 'East Baton Rouge Parish, LA',
        fetchedAt: new Date().toISOString(),
        durationMs: 0,
        rawContestCount: seed.contests.length,
      },
      rawContests: seed.contests,
      rawResponse: seed,
    };
  }

  private async findSeedByDate(electionDate: string): Promise<SeedFile> {
    const files = await fs.readdir(this.seedDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(this.seedDir, file), 'utf-8');
      const seed = JSON.parse(raw) as SeedFile;
      if (seed.electionDate === electionDate) return seed;
    }
    throw new Error(
      `No manual seed file found for election date ${electionDate} in ${this.seedDir}`,
    );
  }
}

/** Shape of a manual seed file in data/seed/. */
export interface SeedContest {
  office: string;
  type: 'General' | 'Primary' | 'Runoff' | 'Referendum' | 'Special';
  district?: {
    name: string;
    scope?: string;
    ocdDivisionId?: string;
  };
  numberElected?: number;
  candidates?: Array<{
    name: string;
    party?: string;
    candidateUrl?: string;
    photoUrl?: string;
    email?: string;
    phone?: string;
    channels?: Array<{ type: string; id: string }>;
    orderOnBallot?: number;
    isIncumbent?: boolean;
  }>;
  referendumInfo?: {
    title: string;
    subtitle?: string;
    brief?: string;
    fullText?: string;
    url?: string;
    ballotResponses?: string[];
    proStatement?: string;
    conStatement?: string;
  };
}

export interface SeedFile {
  electionId: string;
  electionName: string;
  electionDate: string;
  jurisdiction: string;
  contests: SeedContest[];
}
