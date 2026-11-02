/**
 * Voter deadlines for an election. Official dates (entered per election in
 * Admin → Elections, from the Secretary of State's calendar) win; otherwise
 * they're computed from Louisiana's standard rules and marked `estimated`.
 *
 * Rules (Louisiana Secretary of State, sos.la.gov, checked Nov 2, 2026):
 *  - Register in person or by mail (postmarked): 30 days before the election.
 *  - Register online (GeauxVote, with a LA driver's license or special ID): 20 days before.
 *  - Early voting: 14 to 7 days before (18 to 7 for presidential elections),
 *    8:30 a.m. to 6 p.m.; starts a day earlier when a state holiday falls in the window.
 *  - Absentee (mail) ballot: request by 4:30 p.m. on the 4th day before;
 *    voted ballot received by the registrar by 4:30 p.m. the day before.
 * Holidays and weekends can move official dates, so the computed ones are
 * labeled "estimated" in the app.
 */
import type { Cycle } from '../types';

export interface VoterDeadline {
  key: 'registerInPerson' | 'registerOnline' | 'earlyVoting' | 'absenteeRequest' | 'absenteeReturn' | 'electionDay';
  label: string;
  date: string; // yyyy-mm-dd
  endDate?: string;
  detail?: string;
  estimated: boolean;
}

export function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function voterDeadlines(c: Cycle): VoterDeadline[] {
  const e = c.electionDate;
  const tuesday = new Date(`${e}T12:00:00Z`).getUTCDay() === 2;
  const pick = (official: string | undefined, days: number) => ({ date: official || shiftDays(e, -days), estimated: !official });
  const out: VoterDeadline[] = [
    { key: 'registerInPerson', label: 'Register in person or by mail', ...pick(c.registrationDeadline, 30), detail: 'Mailed applications must be postmarked by this date.' },
    { key: 'registerOnline', label: 'Register online', ...pick(c.onlineRegistrationDeadline, 20), detail: 'Through GeauxVote, with a Louisiana driver’s license or special ID.' },
  ];
  if (c.evStart && c.evEnd) out.push({ key: 'earlyVoting', label: 'Early voting', date: c.evStart, endDate: c.evEnd, detail: '8:30 a.m. to 6 p.m. (closed Sundays and holidays).', estimated: false });
  out.push(
    { key: 'absenteeRequest', label: 'Request a mail ballot', ...pick(c.absenteeRequestDeadline, 4), detail: 'By 4:30 p.m. Hospitalized, military and overseas voters have until the day before.' },
    { key: 'absenteeReturn', label: 'Mail ballot due', ...pick(c.absenteeReturnDeadline, 1), detail: 'Must be received by your registrar of voters by 4:30 p.m.' },
    { key: 'electionDay', label: 'Election Day', date: e, detail: `Polls open ${tuesday ? '6' : '7'} a.m. to 8 p.m. If you're in line at 8, you can vote.`, estimated: false },
  );
  return out;
}

/** The next election on or after today (or the most recent past one if none is upcoming). */
export function nextElection(cycles: Cycle[], todayIso = new Date().toISOString().slice(0, 10)): Cycle | null {
  const upcoming = cycles.filter((c) => c.electionDate >= todayIso).sort((a, b) => a.electionDate.localeCompare(b.electionDate));
  return upcoming[0] ?? null;
}
