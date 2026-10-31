/**
 * Local districts the Census doesn't provide (council, school board, BESE,
 * PSC, Supreme Court, court sections, precinct), looked up from official
 * parish GIS map services by the voter's coordinates.
 *
 * Coverage so far: East Baton Rouge Parish, from the City-Parish's public
 * ArcGIS server (maps.brla.gov, "Governmental_Units"). It allows browser
 * calls (CORS), needs no key, and is maintained by the City-Parish, so
 * redistricting and new city limits (e.g. St. George) show up without an
 * app update.
 *
 * Privacy: only the map point (latitude/longitude) is sent to the City-Parish
 * server, never the address text.
 *
 * Failure is safe: if a layer can't be reached, its races show as "might be
 * on your ballot" instead of being hidden (see `checked` below and
 * ballotScope.statusForKey).
 */
import type { VoterDistrict } from './districtLookup';
import { slug } from './districtLookup';

export const EBR_GIS_BASE = 'https://maps.brla.gov/gis/rest/services/Governmental_Units/';

type Attrs = Record<string, string | number | null | undefined>;

interface LayerSpec {
  service: string;
  /** Key prefixes this layer answers for. If the layer is reached, a voter with no matching key is definitely not in those districts. */
  covers: string[];
  parse: (features: Attrs[]) => VoterDistrict[];
}

const num = (v: unknown) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const letters = (v: unknown) =>
  String(v ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z]$/.test(s));

const SCHOOL_SYSTEMS: Record<string, { prefix: string; name: string }> = {
  EBR: { prefix: 'ebr-school', name: 'EBR School Board' },
  CENTRAL: { prefix: 'central-school', name: 'Central School Board' },
  BAKER: { prefix: 'baker-school', name: 'Baker School Board' },
  ZACHARY: { prefix: 'zachary-school', name: 'Zachary School Board' },
};

const CITY_NAMES: Record<string, string> = { 'BATON ROUGE': 'Baton Rouge', 'SAINT GEORGE': 'St. George', BAKER: 'Baker', CENTRAL: 'Central', ZACHARY: 'Zachary' };

function numbered(type: VoterDistrict['type'], prefix: string, label: string, field: string) {
  return (features: Attrs[]): VoterDistrict[] => {
    const n = num(features[0]?.[field]);
    return n ? [{ type, key: `${prefix}-${n}`, label: `${label} ${n}`, number: n }] : [];
  };
}

export const EBR_LAYERS: LayerSpec[] = [
  { service: 'BESE_District', covers: ['la-bese'], parse: numbered('bese', 'la-bese', 'BESE District', 'DISTRICT_NUM') },
  { service: 'Public_Service_Commission', covers: ['la-psc'], parse: numbered('psc', 'la-psc', 'PSC District', 'DISTRICT_NUM') },
  { service: 'LA_Supreme_Court', covers: ['la-supreme'], parse: numbered('supreme-court', 'la-supreme', 'Supreme Court District', 'DISTRICT_NUMBER') },
  { service: 'Council_District', covers: ['ebr-council'], parse: numbered('parish-council', 'ebr-council', 'Metro Council District', 'DISTRICT_NUM') },
  { service: 'Council_District_Baker', covers: ['city-baker-council'], parse: numbered('city-council', 'city-baker-council', 'Baker City Council District', 'DISTRICT_NUM') },
  { service: 'Council_District_Central', covers: ['city-central-council'], parse: numbered('city-council', 'city-central-council', 'Central City Council District', 'DISTRICT_NUM') },
  { service: 'Council_District_Zachary', covers: ['city-zachary-council'], parse: numbered('city-council', 'city-zachary-council', 'Zachary City Council District', 'DISTRICT_NUM') },
  {
    service: 'School_District',
    covers: Object.values(SCHOOL_SYSTEMS).map((s) => s.prefix),
    parse: (features) => {
      // DISTRICT_NO looks like "EBR-5", "Central-3".
      const m = String(features[0]?.DISTRICT_NO ?? '').match(/^([A-Za-z ]+)-(\d+)$/);
      const sys = m ? SCHOOL_SYSTEMS[m[1].trim().toUpperCase()] : undefined;
      if (!m || !sys) return [];
      const n = parseInt(m[2], 10);
      return [{ type: 'school-board', key: `${sys.prefix}-${n}`, label: `${sys.name} District ${n}`, number: n }];
    },
  },
  {
    // 19th JDC judges run by division; each election section votes on a set of divisions.
    service: 'Judicial_Court_Sections',
    covers: ['jdc-19-div', 'jdc-19-section'],
    parse: (features) => {
      const f = features[0];
      const section = num(f?.SECTION);
      if (!section) return [];
      const divs = letters(f?.DIVISIONS);
      return [{
        type: 'judicial',
        key: `jdc-19-section-${section}`,
        label: `19th JDC Section ${section}`,
        number: section,
        extraKeys: divs.map((d) => `jdc-19-div-${d}`),
      }];
    },
  },
  {
    service: 'City_Court_Section',
    covers: ['br-city-court-div', 'br-city-court-section'],
    parse: (features) => {
      const f = features[0];
      const section = num(f?.SECTION_NO);
      if (!section) return [];
      return [{
        type: 'judicial',
        key: `br-city-court-section-${section}`,
        label: `Baton Rouge City Court Section ${section}`,
        number: section,
        extraKeys: letters(f?.DIVISION).map((d) => `br-city-court-div-${d}`),
      }];
    },
  },
  {
    service: 'Voting_Precinct',
    covers: ['ebr-precinct'],
    parse: (features) => {
      const name = String(features[0]?.VOTING_PRECINCT_NAME ?? '').trim();
      return name ? [{ type: 'precinct', key: `ebr-precinct-${slug(name)}`, label: `Precinct ${name}` }] : [];
    },
  },
  {
    // City limits: more current than the Census (St. George, annexations).
    service: 'City_Limit',
    covers: ['city'],
    parse: (features) => {
      const raw = String(features[0]?.CITY_LIMITS_NAME ?? '').trim().toUpperCase();
      if (!raw) return [];
      const name = CITY_NAMES[raw] ?? raw.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());
      return [{ type: 'municipal', key: `city-${slug(name)}`, label: name }];
    },
  },
];

export interface LayerResult {
  service: string;
  ok: boolean;
  features: Attrs[];
}

/**
 * Merge GIS answers into the Census districts (pure; tested in
 * tests/localDistricts.test.mts). Returns the combined districts and the
 * key prefixes we can now answer for definitively ("checked").
 */
export function mergeLocalDistricts(censusDistricts: VoterDistrict[], results: LayerResult[]): { districts: VoterDistrict[]; checked: string[] } {
  let districts = [...censusDistricts];
  const checked: string[] = [];
  for (const r of results) {
    const spec = EBR_LAYERS.find((l) => l.service === r.service);
    if (!spec || !r.ok) continue;
    const found = spec.parse(r.features);
    if (spec.service === 'City_Limit') {
      // The parish's city limits replace the Census city (or its absence).
      districts = districts.filter((d) => d.type !== 'municipal');
    } else {
      checked.push(...spec.covers);
    }
    districts.push(...found);
  }
  return { districts, checked };
}

async function queryLayer(service: string, lat: number, lng: number, timeoutMs: number): Promise<LayerResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'false',
      f: 'json',
    });
    const res = await fetch(`${EBR_GIS_BASE}${service}/MapServer/0/query?${params}`, { signal: ctrl.signal });
    const data = await res.json();
    if (!res.ok || data.error || !Array.isArray(data.features)) return { service, ok: false, features: [] };
    return { service, ok: true, features: data.features.map((f: { attributes: Attrs }) => f.attributes) };
  } catch {
    return { service, ok: false, features: [] };
  } finally {
    clearTimeout(timer);
  }
}

export type LocalLookupOutcome = 'ok' | 'partial' | 'failed' | 'not-covered';

/** Add local districts when the voter is in a parish we have maps for. Never throws. */
export async function addLocalDistricts(
  censusDistricts: VoterDistrict[],
  coords: { lat: number; lng: number } | undefined,
  timeoutMs = 10000,
): Promise<{ districts: VoterDistrict[]; checked: string[]; outcome: LocalLookupOutcome }> {
  const inEbr = censusDistricts.some((d) => d.key === 'parish-east-baton-rouge');
  if (!inEbr || !coords) return { districts: censusDistricts, checked: [], outcome: 'not-covered' };
  const results = await Promise.all(EBR_LAYERS.map((l) => queryLayer(l.service, coords.lat, coords.lng, timeoutMs)));
  const okCount = results.filter((r) => r.ok).length;
  const merged = mergeLocalDistricts(censusDistricts, results);
  return { ...merged, outcome: okCount === results.length ? 'ok' : okCount === 0 ? 'failed' : 'partial' };
}
