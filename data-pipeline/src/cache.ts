import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const CACHE_DIR = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '../../data/.cache',
);

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  storedAt: string;
  ttlMs: number;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function keyToPath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_:-]/g, '_');
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function readCache<T>(
  key: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T | null> {
  try {
    const raw = await fs.readFile(keyToPath(key), 'utf-8');
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - new Date(entry.storedAt).getTime();
    if (age > (entry.ttlMs ?? ttlMs)) {
      return null; // expired
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function writeCache<T>(
  key: string,
  data: T,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> {
  await ensureDir();
  const entry: CacheEntry<T> = {
    data,
    storedAt: new Date().toISOString(),
    ttlMs,
  };
  await fs.writeFile(keyToPath(key), JSON.stringify(entry, null, 2));
}

export async function clearCache(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR);
    await Promise.all(
      files.map((f) => fs.unlink(path.join(CACHE_DIR, f))),
    );
  } catch {
    // cache dir may not exist
  }
}
