import React, { useState } from 'react';
import { MapPinIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { lookupAddress, lookupCoordinates, DistrictLookupError } from '../../services/districtLookup';
import { trackEvent } from '../../services/analytics';
import { addLocalDistricts } from '../../services/localDistricts';
import { EBR_LOCAL_PREFIXES_SHOWN } from '../../services/ballotScope';
import { saveVoterDistricts, clearVoterDistricts, useVoterDistricts } from '../../hooks/useVoterDistricts';

const OFFICIAL_SAMPLE_BALLOT = 'https://voterportal.sos.la.gov/';

/**
 * "Find my ballot": the voter enters an address (or uses their location) and
 * the app works out their districts so it can show only their races.
 */
const FindMyBallot: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { saved } = useVoterDistricts();
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState<'address' | 'location' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function findByAddress(e?: React.FormEvent) {
    e?.preventDefault();
    if (!address.trim()) return;
    setBusy('address');
    setError(null);
    try {
      const r = await lookupAddress(address.trim());
      const local = await addLocalDistricts(r.districts, r.coordinates);
      saveVoterDistricts({ source: 'address', matchedAddress: r.matchedAddress, districts: local.districts, checked: local.checked });
      trackEvent('address_lookup', { method: 'address', outcome: 'success', local: local.outcome });
      setEditing(false);
      setAddress('');
    } catch (err) {
      trackEvent('address_lookup', { method: 'address', outcome: err instanceof DistrictLookupError ? err.code : 'error' });
      setError(err instanceof DistrictLookupError ? err.message : 'Something went wrong looking up that address.');
    } finally {
      setBusy(null);
    }
  }

  function findByLocation() {
    if (!navigator.geolocation) {
      setError("Your browser can't share your location. Enter your address instead.");
      return;
    }
    setBusy('location');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await lookupCoordinates(pos.coords.latitude, pos.coords.longitude);
          const local = await addLocalDistricts(r.districts, r.coordinates);
          saveVoterDistricts({ source: 'location', districts: local.districts, checked: local.checked });
          trackEvent('address_lookup', { method: 'location', outcome: 'success', local: local.outcome });
          setEditing(false);
        } catch (err) {
          trackEvent('address_lookup', { method: 'location', outcome: err instanceof DistrictLookupError ? err.code : 'error' });
          setError(err instanceof DistrictLookupError ? err.message : 'Something went wrong looking up your location.');
        } finally {
          setBusy(null);
        }
      },
      () => {
        setBusy(null);
        trackEvent('address_lookup', { method: 'location', outcome: 'permission-denied' });
        setError("We couldn't get your location. Enter your address instead.");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }

  // ---- Saved: show a summary ----
  if (saved && !editing) {
    const city = saved.districts.find((d) => d.type === 'municipal')?.label;
    const parish = saved.districts.find((d) => d.type === 'parishwide')?.label;
    const chips = saved.districts.filter((d) => d.type !== 'statewide' && d.type !== 'municipal' && d.type !== 'parishwide');
    const inEbr = saved.districts.some((d) => d.key === 'parish-east-baton-rouge');
    const localMissing = inEbr && EBR_LOCAL_PREFIXES_SHOWN.some((p) => !saved.checked?.includes(p));
    return (
      <div className="bg-white border border-civic-blue/30 rounded-lg p-4 mb-4" data-testid="my-ballot-districts">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-midnight-navy font-semibold">
              <MapPinIcon className="h-5 w-5 text-civic-blue" />
              Showing your ballot
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {saved.source === 'location' ? 'Based on your current location' : saved.matchedAddress}
              {(city || parish) && <> · {[city, parish].filter(Boolean).join(', ')}</>}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chips.map((d) => (
                <span key={d.key} className="text-xs bg-blue-50 text-civic-blue border border-blue-100 px-2 py-0.5 rounded-full">{d.label}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-3 text-sm whitespace-nowrap">
            <button onClick={() => setEditing(true)} className="text-civic-blue underline">Change</button>
            <button onClick={clearVoterDistricts} className="text-gray-500 underline">Forget</button>
          </div>
        </div>
        {!compact && (
          <p className="text-xs text-gray-500 mt-3">
            {inEbr
              ? 'Matched using U.S. Census and East Baton Rouge City-Parish district maps.'
              : 'Matched using U.S. Census district maps. Council, school board, BESE, PSC and judicial races are matched by address only in East Baton Rouge Parish so far.'}{' '}
            {localMissing && "Some local maps couldn't be reached, so those races show as \"might be on your ballot\" (tap Change to try again). "}
            Always check your{' '}
            <a href={OFFICIAL_SAMPLE_BALLOT} target="_blank" rel="noopener noreferrer" className="underline">official sample ballot</a>{' '}
            from the Louisiana Secretary of State.
          </p>
        )}
      </div>
    );
  }

  // ---- Not saved (or changing): show the form ----
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4" data-testid="find-my-ballot">
      <h2 className="text-midnight-navy font-semibold flex items-center gap-2">
        <MapPinIcon className="h-5 w-5 text-civic-blue" /> See only what's on your ballot
      </h2>
      <p className="text-sm text-gray-600 mt-0.5">Enter the address where you're registered to vote.</p>
      <form onSubmit={findByAddress} className="mt-3 flex flex-col md:flex-row gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
          placeholder="e.g. 222 St Louis St, Baton Rouge, LA 70802"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          aria-label="Your address"
        />
        <button type="submit" disabled={!!busy || !address.trim()} className="bg-civic-blue text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
          <MagnifyingGlassIcon className="h-4 w-4" /> {busy === 'address' ? 'Looking up…' : 'Find my ballot'}
        </button>
        <button type="button" onClick={findByLocation} disabled={!!busy} className="border border-gray-200 px-4 py-2 rounded-md text-sm disabled:opacity-50">
          {busy === 'location' ? 'Locating…' : 'Use my location'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>}
      <p className="text-xs text-gray-500 mt-2">
        Your address is sent only to the U.S. Census Bureau's address lookup (in East Baton Rouge, the map point, not the address, also goes to the City-Parish's district maps). MyBallot doesn't store it. Your districts are saved on this device.
        {saved && <> <button onClick={() => setEditing(false)} className="underline">Cancel</button></>}
      </p>
    </div>
  );
};

export default FindMyBallot;
