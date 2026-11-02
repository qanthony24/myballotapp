/**
 * How to Vote in Louisiana (replaces the old "Essentials" and "Q&A" pages).
 *
 * Every rule here is from the Louisiana Secretary of State (sos.la.gov,
 * checked Nov 2, 2026): Register to Vote, Ways to Vote. Deadlines for the
 * next election come from services/votingDates.ts (official dates from Admin →
 * Elections when entered, otherwise estimated from the standard rules and
 * labeled so). Keep this page factual and link to the official source.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon, ArrowTopRightOnSquareIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, EnvelopeIcon, IdentificationIcon,
  MapPinIcon, ScaleIcon, UserPlusIcon, HandRaisedIcon, PhoneIcon,
} from '@heroicons/react/24/outline';
import { useElectionData } from '../../services/electionDataStore';
import { getAllCycles, getFormattedElectionName } from '../../services/dataService';
import { nextElection, voterDeadlines } from '../../services/votingDates';

const PORTAL = 'https://voterportal.sos.la.gov/';
const SOS_REGISTER = 'https://www.sos.la.gov/elections-voting/register-to-vote';
const SOS_WAYS = 'https://www.sos.la.gov/elections-voting/ways-to-vote';
const SOS_DATES = 'https://www.sos.la.gov/elections-voting/election-dates';

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', opts);

const Ext: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-civic-blue font-medium underline underline-offset-2 inline-flex items-center gap-0.5">
    {children}
    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
  </a>
);

const Section: React.FC<{ id: string; icon: React.ElementType; title: string; children: React.ReactNode }> = ({ id, icon: Icon, title, children }) => (
  <section id={id} className="scroll-mt-40 border-t border-midnight-navy/10 pt-5 mt-5 first:border-0 first:pt-0 first:mt-0">
    <h2 className="flex items-center gap-2 text-lg font-display font-bold text-midnight-navy mb-2">
      <Icon className="h-6 w-6 text-civic-blue" /> {title}
    </h2>
    <div className="text-sm text-midnight-navy/90 space-y-2 leading-relaxed">{children}</div>
  </section>
);

const HowToVotePage: React.FC = () => {
  const { version } = useElectionData();
  const election = useMemo(() => nextElection(getAllCycles()), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const deadlines = election ? voterDeadlines(election) : [];
  const today = new Date().toISOString().slice(0, 10);
  const anyEstimated = deadlines.some((d) => d.estimated);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-5 md:p-10 border border-midnight-navy/10">
        <Link to="/info" className="text-civic-blue text-sm mb-4 inline-flex items-center">
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back to Info
        </Link>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-midnight-navy">How to Vote in Louisiana</h1>
        <p className="text-sm text-midnight-navy/60 mt-1 mb-5">
          Deadlines, ID, early voting and voting by mail. From the Louisiana Secretary of State. Rules can change, so the official site always has the final word.
        </p>

        <nav aria-label="On this page" className="flex flex-wrap gap-2 mb-6 text-xs">
          {[
            ['dates', 'Key dates'], ['register', 'Register'], ['early', 'Vote early'], ['election-day', 'Election Day'],
            ['id', 'Bring ID'], ['mail', 'Vote by mail'], ['primaries', 'Primaries'], ['at-the-polls', 'At the polls'], ['help', 'Get help'],
          ].map(([id, l]) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }} className="px-2.5 py-1 rounded-full border border-midnight-navy/15 text-midnight-navy/80 hover:bg-civic-blue hover:text-white">
              {l}
            </a>
          ))}
        </nav>

        <Section id="dates" icon={CalendarDaysIcon} title={election ? `Key dates: ${getFormattedElectionName(election)}` : 'Key dates'}>
          {election ? (
            <>
              <ol className="divide-y divide-midnight-navy/10 border border-midnight-navy/10 rounded-lg">
                {deadlines.map((d) => {
                  const past = (d.endDate ?? d.date) < today;
                  return (
                    <li key={d.key} className={`flex gap-3 px-3 py-2 ${past ? 'opacity-50' : ''}`}>
                      <div className="w-28 shrink-0 font-semibold text-midnight-navy">
                        {fmt(d.date)}
                        {d.endDate && <> – {fmt(d.endDate)}</>}
                        {d.estimated && <span className="block text-[10px] font-normal uppercase tracking-wide text-amber-700">estimated</span>}
                      </div>
                      <div>
                        <p className="font-medium">{d.label}{past && ' (passed)'}</p>
                        {d.detail && <p className="text-xs text-midnight-navy/60">{d.detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {anyEstimated && (
                <p className="text-xs text-midnight-navy/60">
                  “Estimated” dates follow the standard rules; holidays and weekends can move them. Confirm on the <Ext href={SOS_DATES}>official election calendar</Ext>.
                </p>
              )}
            </>
          ) : (
            <p>No upcoming election is listed yet. See the <Ext href={SOS_DATES}>official election calendar</Ext>.</p>
          )}
        </Section>

        <Section id="register" icon={UserPlusIcon} title="Register to vote">
          <p>
            Register at least <strong>30 days</strong> before an election in person or by mail (postmarked by then), or <strong>20 days</strong> before online through{' '}
            <Ext href={PORTAL}>GeauxVote</Ext> if you have a Louisiana driver’s license or special ID. Registering is free.
          </p>
          <p>
            You must be a U.S. citizen, live in the parish where you register, and be 18 to vote (you can register at 17, or at 16 in person at the registrar’s office or OMV).
            If you’re under an order of imprisonment for a felony, you can still register if you haven’t been incarcerated under that order in the last five years
            (this doesn’t apply to convictions for election offenses).
          </p>
          <p>
            <Ext href={PORTAL}>Check your registration</Ext> and update your address if you’ve moved. Full rules: <Ext href={SOS_REGISTER}>Register to Vote</Ext>.
          </p>
        </Section>

        <Section id="early" icon={ClipboardDocumentCheckIcon} title="Vote early">
          <p>
            Anyone can vote early, no reason needed. Early voting runs from <strong>14 to 7 days</strong> before an election (18 to 7 for presidential elections),
            <strong> 8:30 a.m. to 6 p.m.</strong> at your parish registrar of voters and other designated sites, except Sundays and holidays.
          </p>
          <p>Find early voting locations in the <Ext href={PORTAL}>Voter Portal</Ext> or the free GeauxVote app.</p>
        </Section>

        <Section id="election-day" icon={MapPinIcon} title="Vote on Election Day">
          <p>
            Polls are open <strong>7 a.m. to 8 p.m.</strong> for Saturday elections and <strong>6 a.m. to 8 p.m.</strong> for Tuesday elections.
          </p>
          <p className="bg-sunlight-gold/20 border-l-4 border-sunlight-gold rounded-r px-3 py-2 text-base">
            <strong>In line by 8 p.m.? Stay in line.</strong> Every voter in line when the polls close has the right to vote. You can’t be turned away
            or told to leave. Just don’t step out of line.
          </p>
          <p>
            You vote at your assigned precinct. Find it in the <Ext href={PORTAL}>Voter Portal</Ext>. Your official sample ballot appears there about two weeks before each election.
          </p>
        </Section>

        <Section id="id" icon={IdentificationIcon} title="Bring a photo ID">
          <p>Bring a photo ID with your picture and signature (like a Louisiana driver’s license), or a U.S. military ID with your name and picture.</p>
          <p>
            No photo ID? You can get a free Louisiana special ID at the Office of Motor Vehicles by showing your voter information card, or you can still vote by signing an affidavit
            after answering identifying questions at the polls.
          </p>
        </Section>

        <Section id="mail" icon={EnvelopeIcon} title="Vote by mail (absentee)">
          <p>
            In Louisiana you need a qualifying reason to vote by mail, for example being 65 or older, having a disability, or being away from your parish. Military and overseas
            voters don’t need a reason. The full list is on the <Ext href={SOS_WAYS}>Ways to Vote</Ext> page.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Request</strong> your ballot by <strong>4:30 p.m. on the 4th day</strong> before the election, online in the <Ext href={PORTAL}>Voter Portal</Ext> or from your registrar.
              Apply early; there’s no start date.
            </li>
            <li>
              <strong>Return</strong> it so your registrar of voters <strong>receives</strong> it by <strong>4:30 p.m. the day before</strong> the election. Allow for mail delivery time.
            </li>
            <li>Hospitalized, military and overseas voters have later deadlines.</li>
            <li>New absentee voting laws took effect Aug. 1, 2024. See the official page for details, and track your ballot in the Voter Portal.</li>
          </ul>
        </Section>

        <Section id="primaries" icon={ScaleIcon} title="Open and closed primaries">
          <p>
            <strong>Most Louisiana races use an open primary:</strong> every candidate is on one ballot and every voter can vote, whatever their party. A candidate who wins a majority
            is elected; otherwise the top two go to a runoff. This includes governor, other statewide offices, the Legislature and local offices.
          </p>
          <p>
            <strong>A few offices now use closed party primaries,</strong> including U.S. Senate, U.S. House, the Public Service Commission and the Louisiana Supreme Court. Republicans
            vote in the Republican primary and Democrats in the Democratic primary. Voters registered as <strong>No Party</strong> can choose either party’s primary when they vote.
            Your sample ballot shows which applies to each race.
          </p>
        </Section>

        <Section id="at-the-polls" icon={HandRaisedIcon} title="At the polls">
          <ul className="list-disc pl-5 space-y-1">
            <li>Don’t wear, carry or hand out anything for or against a candidate, party or proposition. Polling places have a 600-foot campaign-free zone.</li>
            <li>
              You can bring your own list of choices into the booth. <Link to="/my-ballot" className="text-civic-blue font-medium underline">Print your MyBallot</Link>, which is plain on purpose so
              it doesn’t count as campaign material.
            </li>
            <li>Voters who have a disability or can’t read can get help voting. Ask a poll commissioner or contact your registrar of voters.</li>
            <li>If you’re listed as inactive, you can confirm your address at the polls and vote.</li>
            <li>If your name isn’t on the list, ask for a provisional ballot.</li>
          </ul>
        </Section>

        <Section id="help" icon={PhoneIcon} title="Get help">
          <ul className="space-y-2">
            <li>
              <strong>Louisiana Secretary of State elections hotline:</strong>{' '}
              <a href="tel:+18008832805" className="text-civic-blue font-semibold underline">1-800-883-2805</a> (TTY: 711). Registration, polling places,
              ballots and deadlines.
            </li>
            <li>
              <strong>Your parish registrar of voters:</strong> find the office and phone number in the <Ext href={PORTAL}>Voter Portal</Ext>.
            </li>
            <li>
              <strong>Election Protection (nonpartisan):</strong>{' '}
              <a href="tel:+18666878683" className="text-civic-blue font-semibold underline">866-OUR-VOTE</a> (866-687-8683). Free legal help if you have trouble
              voting or someone tries to stop you.
            </li>
            <li>
              <strong>Problem at your polling place?</strong> Ask for the commissioner-in-charge first. If you’re told you can’t vote, ask for a provisional ballot.
            </li>
          </ul>
        </Section>

        <p className="mt-8 text-xs text-midnight-navy/50">
          Sources: Louisiana Secretary of State, <Ext href={SOS_REGISTER}>Register to Vote</Ext> and <Ext href={SOS_WAYS}>Ways to Vote</Ext> (checked Nov. 2, 2026). MyBallot is not
          affiliated with the Secretary of State.
        </p>
      </div>
    </div>
  );
};

export default HowToVotePage;
