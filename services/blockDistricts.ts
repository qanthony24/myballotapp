/**
 * Statewide districts the Census doesn't provide (BESE, PSC, Supreme Court),
 * looked up by the voter's 2020 Census block, which the Census geocoder
 * already returns with every address.
 *
 * Source: the Legislature's official block equivalency files (one line per
 * census block → district) for each enacted plan, turned into small
 * per-parish tables by `npm run data:districts` (scripts/build-district-blocks.mts):
 *   public/data/districts/blocks-<parish FIPS>.json
 * The app loads only the voter's parish file (a few KB) and caches it.
 *
 * Table format, per plan: { "<6-digit tract>": district }  when the whole tract
 * is in one district (most tracts), or [defaultDistrict, { "<4-digit block>": district }]
 * listing only the blocks that differ from the default.
 */
import type { VoterDistrict } from './districtLookup';

export type PlanTable = Record<string, number | [number, Record<string, number>]>;

export interface ParishBlockFile {
  v: 1;
  parish: string; // 3-digit county FIPS, e.g. "033"
  plans: Partial<Record<BlockPlan, PlanTable>>;
  sources: Record<string, string>;
}

export const BLOCK_PLANS = {
  bese: { prefix: 'la-bese', type: 'bese', label: 'BESE District' },
  psc: { prefix: 'la-psc', type: 'psc', label: 'PSC District' },
  supreme: { prefix: 'la-supreme', type: 'supreme-court', label: 'Supreme Court District' },
} as const;
export type BlockPlan = keyof typeof BLOCK_PLANS;

// ---- Building (used by the script; pure) ----

/** Parse a block equivalency file: "220330051003010   8" or "220330051003010,8" per line. */
export function parseBlockEquivalency(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^"?(22\d{13})"?[\s,|]+"?(\d+)"?/);
    if (m) out.set(m[1], parseInt(m[2], 10));
  }
  return out;
}

/** Group plan maps into per-parish compressed tables. */
export function buildParishTables(plans: Partial<Record<BlockPlan, Map<string, number>>>): Map<string, Partial<Record<BlockPlan, PlanTable>>> {
  const parishes = new Map<string, Partial<Record<BlockPlan, PlanTable>>>();
  for (const [plan, blocks] of Object.entries(plans) as [BlockPlan, Map<string, number>][]) {
    // parish → tract → block → district
    const tree = new Map<string, Map<string, Map<string, number>>>();
    for (const [geoid, d] of blocks) {
      const parish = geoid.slice(2, 5);
      const tract = geoid.slice(5, 11);
      const block = geoid.slice(11, 15);
      if (!tree.has(parish)) tree.set(parish, new Map());
      const t = tree.get(parish)!;
      if (!t.has(tract)) t.set(tract, new Map());
      t.get(tract)!.set(block, d);
    }
    for (const [parish, tracts] of tree) {
      const table: PlanTable = {};
      for (const [tract, bs] of [...tracts].sort(([a], [b]) => a.localeCompare(b))) {
        const counts = new Map<number, number>();
        bs.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
        const def = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
        if (counts.size === 1) {
          table[tract] = def;
        } else {
          const ex: Record<string, number> = {};
          for (const [b, d] of [...bs].sort(([a], [c]) => a.localeCompare(c))) if (d !== def) ex[b] = d;
          table[tract] = [def, ex];
        }
      }
      if (!parishes.has(parish)) parishes.set(parish, {});
      parishes.get(parish)![plan] = table;
    }
  }
  return parishes;
}

// ---- Lookup (app; pure) ----

export function districtForBlock(table: PlanTable | undefined, blockGeoid: string): number | undefined {
  if (!table) return undefined;
  const entry = table[blockGeoid.slice(5, 11)];
  if (entry === undefined) return undefined;
  if (typeof entry === 'number') return entry;
  return entry[1][blockGeoid.slice(11, 15)] ?? entry[0];
}

/**
 * Add BESE/PSC/Supreme Court districts for the voter's block. Districts the
 * parish GIS already supplied are kept (same keys); a plan is "checked" only
 * when the block was found in it.
 */
export function districtsFromBlockFile(file: ParishBlockFile, blockGeoid: string, existing: VoterDistrict[]): { districts: VoterDistrict[]; checked: string[] } {
  const districts = [...existing];
  const checked: string[] = [];
  if (file.parish !== blockGeoid.slice(2, 5)) return { districts, checked };
  for (const plan of Object.keys(BLOCK_PLANS) as BlockPlan[]) {
    const spec = BLOCK_PLANS[plan];
    const n = districtForBlock(file.plans[plan], blockGeoid);
    if (!n) continue;
    checked.push(spec.prefix);
    const key = `${spec.prefix}-${n}`;
    // Replace any other answer for the same plan (the Legislature's file is the enacted plan).
    for (let i = districts.length - 1; i >= 0; i--) if (districts[i].key.startsWith(`${spec.prefix}-`) && districts[i].key !== key) districts.splice(i, 1);
    if (!districts.some((d) => d.key === key)) districts.push({ type: spec.type, key, label: `${spec.label} ${n}`, number: n });
  }
  return { districts, checked };
}

// ---- Loading (app) ----

const cache = new Map<string, Promise<ParishBlockFile | null>>();

export function loadParishBlockFile(parishFips: string, base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'): Promise<ParishBlockFile | null> {
  if (!/^\d{3}$/.test(parishFips)) return Promise.resolve(null);
  if (!cache.has(parishFips)) {
    cache.set(
      parishFips,
      fetch(`${base}data/districts/blocks-${parishFips}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j?.v === 1 ? (j as ParishBlockFile) : null))
        .catch(() => null),
    );
  }
  return cache.get(parishFips)!;
}

/** Never throws; without a block or file, nothing changes (races stay "might be on your ballot"). */
export async function addBlockDistricts(districts: VoterDistrict[], blockGeoid: string | undefined): Promise<{ districts: VoterDistrict[]; checked: string[] }> {
  if (!blockGeoid || !/^22\d{13}$/.test(blockGeoid)) return { districts, checked: [] };
  const file = await loadParishBlockFile(blockGeoid.slice(2, 5));
  return file ? districtsFromBlockFile(file, blockGeoid, districts) : { districts, checked: [] };
}
