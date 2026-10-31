/**
 * The voter's districts, saved on this device only (localStorage). The
 * address itself is kept locally just so we can show "Showing the ballot for
 * <address>"; it is never sent to MyBallot's servers.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { VoterDistrict } from '../services/districtLookup';

export interface SavedVoterDistricts {
  matchedAddress?: string;
  source: 'address' | 'location';
  districts: VoterDistrict[];
  /** Key prefixes the local map lookup answered for (see services/localDistricts.ts). */
  checked?: string[];
  savedAt: string;
}

const STORAGE_KEY = 'myballot.voterDistricts.v1';
const listeners = new Set<() => void>();

function read(): SavedVoterDistricts | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedVoterDistricts;
    return Array.isArray(parsed?.districts) ? parsed : null;
  } catch {
    return null;
  }
}

let current: SavedVoterDistricts | null = typeof window !== 'undefined' ? read() : null;

function emit() {
  listeners.forEach((l) => l());
}

export function saveVoterDistricts(value: Omit<SavedVoterDistricts, 'savedAt'>): void {
  current = { ...value, savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private browsing / storage blocked: keep it for this session only.
  }
  emit();
}

export function clearVoterDistricts(): void {
  current = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}

// Keep other open tabs in sync when the voter changes or forgets their address.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      current = read();
      emit();
    }
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Every key on the voter's ballot, plus "checked:<prefix>" markers (see ballotScope.statusForKey). */
export function voterKeySet(saved: Pick<SavedVoterDistricts, 'districts' | 'checked'>): Set<string> {
  const keys = new Set<string>();
  for (const d of saved.districts) {
    keys.add(d.key);
    d.extraKeys?.forEach((k) => keys.add(k));
  }
  saved.checked?.forEach((p) => keys.add(`checked:${p}`));
  return keys;
}

export function useVoterDistricts(): { saved: SavedVoterDistricts | null; keys: Set<string> | null } {
  const saved = useSyncExternalStore(subscribe, () => current, () => current);
  const keys = useMemo(() => (saved ? voterKeySet(saved) : null), [saved]);
  return { saved, keys };
}
