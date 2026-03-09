/**
 * Canonical party registry.
 *
 * Single source of truth for party names, abbreviations, colors, and sort
 * order. Every part of the app (filters, admin dropdowns, badges, charts)
 * reads from this registry so values stay consistent.
 */

export interface PartyInfo {
  id: string;          // canonical key — must match Candidate.party exactly
  label: string;       // display name
  abbreviation: string;
  badgeClasses: string; // Tailwind classes for the badge pill
  barColor: string;     // Tailwind class for chart bars
  sortOrder: number;    // lower = first in dropdowns
}

const REGISTRY: PartyInfo[] = [
  { id: 'Democratic',    label: 'Democratic',    abbreviation: 'D',  badgeClasses: 'bg-blue-100 text-blue-700',   barColor: 'bg-blue-500',   sortOrder: 1 },
  { id: 'Republican',    label: 'Republican',    abbreviation: 'R',  badgeClasses: 'bg-red-100 text-red-700',     barColor: 'bg-red-500',    sortOrder: 2 },
  { id: 'Libertarian',   label: 'Libertarian',   abbreviation: 'L',  badgeClasses: 'bg-yellow-100 text-yellow-700', barColor: 'bg-yellow-500', sortOrder: 3 },
  { id: 'Green',         label: 'Green',         abbreviation: 'G',  badgeClasses: 'bg-green-100 text-green-700', barColor: 'bg-green-500',  sortOrder: 4 },
  { id: 'Independent',   label: 'Independent',   abbreviation: 'I',  badgeClasses: 'bg-purple-100 text-purple-700', barColor: 'bg-purple-400', sortOrder: 5 },
  { id: 'Nonpartisan',   label: 'Nonpartisan',   abbreviation: 'NP', badgeClasses: 'bg-gray-100 text-gray-600',   barColor: 'bg-gray-400',   sortOrder: 6 },
  { id: 'Other',         label: 'Other',         abbreviation: 'O',  badgeClasses: 'bg-gray-100 text-gray-600',   barColor: 'bg-gray-400',   sortOrder: 99 },
];

const BY_ID = new Map<string, PartyInfo>(REGISTRY.map((p) => [p.id, p]));

const FALLBACK: PartyInfo = {
  id: 'Unknown',
  label: 'Unknown',
  abbreviation: '?',
  badgeClasses: 'bg-gray-100 text-gray-500',
  barColor: 'bg-gray-300',
  sortOrder: 100,
};

/** Ordered list of all known parties (for dropdowns / filters). */
export function getAllParties(): PartyInfo[] {
  return [...REGISTRY].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Get a single party's info by its canonical ID. */
export function getPartyInfo(partyId: string | undefined | null): PartyInfo {
  if (!partyId) return FALLBACK;
  return BY_ID.get(partyId) ?? { ...FALLBACK, id: partyId, label: partyId, abbreviation: partyId.charAt(0).toUpperCase() };
}

/** All canonical party IDs, sorted. */
export function getPartyIds(): string[] {
  return REGISTRY.sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.id);
}

/**
 * Normalize a raw party string from external sources into a canonical ID.
 * Handles case differences, common variants, etc.
 */
export function normalizeParty(raw: string | null | undefined): string {
  if (!raw) return 'Nonpartisan';
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith('dem')) return 'Democratic';
  if (lower.startsWith('rep')) return 'Republican';
  if (lower.startsWith('lib')) return 'Libertarian';
  if (lower.startsWith('gre')) return 'Green';
  if (lower.startsWith('ind')) return 'Independent';
  if (lower === 'nonpartisan' || lower === 'non-partisan' || lower === 'no party' || lower === 'none') return 'Nonpartisan';
  const exact = BY_ID.get(raw.trim());
  if (exact) return exact.id;
  return 'Other';
}
