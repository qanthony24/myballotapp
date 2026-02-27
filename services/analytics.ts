import { analytics } from '../firebase';
import { logEvent } from 'firebase/analytics';

export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch {
    // analytics may not be available (ad blockers, privacy settings)
  }
}

export function trackBallotAdd(candidateId: number, office: string) {
  trackEvent('ballot_add', { candidate_id: candidateId, office });
}

export function trackBallotRemove(candidateId: number, office: string) {
  trackEvent('ballot_remove', { candidate_id: candidateId, office });
}

export function trackCompare(officeId: number, electionDate: string) {
  trackEvent('compare_candidates', { office_id: officeId, election_date: electionDate });
}

export function trackMeasureStance(measureId: number, vote: string) {
  trackEvent('measure_stance', { measure_id: measureId, vote });
}
