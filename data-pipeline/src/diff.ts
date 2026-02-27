import { ContestV1, DiffResult } from './types.js';
import { computeHash } from './transform.js';

/**
 * Compare incoming contests against the existing store.
 * Uses contentHash to detect real changes vs. no-ops.
 *
 * Returns only the records that need writing (added/updated)
 * and IDs of records that should be soft-deleted.
 */
export function diffContests(
  incoming: ContestV1[],
  existing: ContestV1[],
): DiffResult {
  const existingMap = new Map(existing.map((c) => [c.id, c]));
  const incomingIds = new Set(incoming.map((c) => c.id));

  const added: ContestV1[] = [];
  const updated: ContestV1[] = [];
  let unchanged = 0;

  for (const contest of incoming) {
    const prev = existingMap.get(contest.id);
    if (!prev) {
      added.push(contest);
    } else if (prev.contentHash !== contest.contentHash) {
      updated.push(contest);
    } else {
      unchanged++;
    }
  }

  const deleted: string[] = [];
  for (const prev of existing) {
    if (!prev.deleted && !incomingIds.has(prev.id)) {
      deleted.push(prev.id);
    }
  }

  return { added, updated, deleted, unchanged };
}

/** Apply diff to existing store, returning the merged result. */
export function applyDiff(
  existing: ContestV1[],
  diff: DiffResult,
  incoming: ContestV1[],
): ContestV1[] {
  const result = new Map(existing.map((c) => [c.id, c]));

  for (const c of diff.added) {
    result.set(c.id, c);
  }

  for (const c of diff.updated) {
    result.set(c.id, c);
  }

  for (const id of diff.deleted) {
    const prev = result.get(id);
    if (prev) {
      result.set(id, {
        ...prev,
        deleted: true,
        fetchedAt: new Date().toISOString(),
        contentHash: computeHash({ ...prev, deleted: true }),
      });
    }
  }

  return Array.from(result.values());
}
