/**
 * Address / location → the voter's districts, using the free U.S. Census
 * Bureau geocoder (no API key). The Census API doesn't allow direct browser
 * calls (no CORS), but it supports JSONP, so we load it as a script tag.
 *
 * Privacy: the address goes only to the Census Bureau. MyBallot keeps the
 * resulting districts on the device (see hooks/useVoterDistricts.ts) and
 * never stores the address on a server.
 *
 * Districts returned (Census "Current" vintage):
 *   statewide (Louisiana), congressional district (current/new map),
 *   State Senate and State House districts, parish, incorporated city/town.
 * Not available from the Census: BESE, PSC, judicial, school board, council,
 * JP/constable districts — those need map files (future work).
 */

export type VoterDistrictType =
  | 'statewide'
  | 'congressional'
  | 'state-senate'
  | 'state-house'
  | 'parishwide'
  | 'municipal';

export interface VoterDistrict {
  type: VoterDistrictType;
  /** Matches Race.districtKey, e.g. "la", "la-cd-6", "la-house-61", "parish-east-baton-rouge", "city-baton-rouge". */
  key: string;
  /** Human label, e.g. "State House District 61". */
  label: string;
  /** District number where relevant (e.g. 61). */
  number?: number;
}

export interface DistrictLookupResult {
  matchedAddress?: string;
  coordinates?: { lat: number; lng: number };
  districts: VoterDistrict[];
}

export class DistrictLookupError extends Error {
  constructor(
    message: string,
    public code: 'not-found' | 'outside-louisiana' | 'network' | 'timeout',
  ) {
    super(message);
  }
}

const CENSUS_BASE = 'https://geocoding.geo.census.gov/geocoder/geographies/';
const CENSUS_PARAMS = 'benchmark=Public_AR_Current&vintage=Current_Current';
const LOUISIANA_FIPS = '22';

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type CensusGeo = Record<string, string | undefined>;
type CensusGeographies = Record<string, CensusGeo[]>;

/** Find a geography layer by name pattern (layer names include vintages that change, e.g. "120th Congressional Districts"). */
function layer(geos: CensusGeographies, pattern: RegExp): CensusGeo | undefined {
  const key = Object.keys(geos).find((k) => pattern.test(k) && Array.isArray(geos[k]) && geos[k].length > 0);
  return key ? geos[key][0] : undefined;
}

function districtNumber(g: CensusGeo | undefined, field: string): number | undefined {
  const raw = g?.[field] ?? g?.BASENAME;
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Turn Census geographies into MyBallot districts. Pure function (tested with
 * real Census responses in tests/districts.test.mts).
 */
export function parseCensusGeographies(geos: CensusGeographies): VoterDistrict[] {
  const state = layer(geos, /^States$/);
  if (!state || state.STATE !== LOUISIANA_FIPS) {
    throw new DistrictLookupError(
      `That address is in ${state?.NAME ?? 'another state'}. MyBallot currently covers Louisiana only.`,
      'outside-louisiana',
    );
  }
  const out: VoterDistrict[] = [{ type: 'statewide', key: 'la', label: 'Louisiana (statewide)' }];

  const cd = layer(geos, /Congressional Districts/i);
  const cdField = cd ? Object.keys(cd).find((f) => /^CD\d+$/.test(f)) : undefined;
  const cdNum = cdField ? districtNumber(cd, cdField) : districtNumber(cd, 'BASENAME');
  if (cdNum) out.push({ type: 'congressional', key: `la-cd-${cdNum}`, label: `U.S. House District ${cdNum}`, number: cdNum });

  const sen = layer(geos, /State Legislative Districts - Upper/i);
  const senNum = districtNumber(sen, 'SLDU');
  if (senNum) out.push({ type: 'state-senate', key: `la-sen-${senNum}`, label: `State Senate District ${senNum}`, number: senNum });

  const house = layer(geos, /State Legislative Districts - Lower/i);
  const houseNum = districtNumber(house, 'SLDL');
  if (houseNum) out.push({ type: 'state-house', key: `la-house-${houseNum}`, label: `State House District ${houseNum}`, number: houseNum });

  const parish = layer(geos, /^Counties$/);
  if (parish?.BASENAME) {
    out.push({ type: 'parishwide', key: `parish-${slug(parish.BASENAME)}`, label: parish.NAME ?? `${parish.BASENAME} Parish` });
  }

  const place = layer(geos, /Incorporated Places/i);
  if (place?.BASENAME) {
    out.push({ type: 'municipal', key: `city-${slug(place.BASENAME)}`, label: place.NAME ?? place.BASENAME });
  }
  return out;
}

/** Load a Census URL as JSONP. */
function jsonp<T>(url: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cb = `__mbCensus${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      delete w[cb];
      script.remove();
    };
    w[cb] = (data: T) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new DistrictLookupError("Couldn't reach the address lookup service. Check your connection and try again.", 'network'));
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new DistrictLookupError('The address lookup took too long. Please try again.', 'timeout'));
    }, timeoutMs);
    script.src = `${url}&format=jsonp&callback=${cb}`;
    document.head.appendChild(script);
  });
}

interface CensusAddressResponse {
  result?: {
    addressMatches?: { matchedAddress: string; coordinates: { x: number; y: number }; geographies: CensusGeographies }[];
  };
}
interface CensusCoordinatesResponse {
  result?: { geographies?: CensusGeographies };
}

export async function lookupAddress(address: string): Promise<DistrictLookupResult> {
  const url = `${CENSUS_BASE}onelineaddress?address=${encodeURIComponent(address)}&${CENSUS_PARAMS}`;
  const data = await jsonp<CensusAddressResponse>(url);
  const match = data.result?.addressMatches?.[0];
  if (!match) {
    throw new DistrictLookupError(
      "We couldn't find that address. Try the full street address with city and ZIP, e.g. \"222 St Louis St, Baton Rouge, LA 70802\".",
      'not-found',
    );
  }
  return {
    matchedAddress: match.matchedAddress,
    coordinates: { lat: match.coordinates.y, lng: match.coordinates.x },
    districts: parseCensusGeographies(match.geographies),
  };
}

export async function lookupCoordinates(lat: number, lng: number): Promise<DistrictLookupResult> {
  const url = `${CENSUS_BASE}coordinates?x=${lng}&y=${lat}&${CENSUS_PARAMS}`;
  const data = await jsonp<CensusCoordinatesResponse>(url);
  const geos = data.result?.geographies;
  if (!geos) throw new DistrictLookupError("We couldn't look up districts for your location.", 'not-found');
  return { coordinates: { lat, lng }, districts: parseCensusGeographies(geos) };
}
