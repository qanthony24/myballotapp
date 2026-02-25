import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ContestCandidate {
  name: string;
  party: string | null;
  candidateUrl: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  channels: { type: string; id: string }[];
  orderOnBallot: number | null;
}

interface ContestDistrict {
  name: string;
  scope: string | null;
  ocdDivisionId: string | null;
}

interface ReferendumInfo {
  title: string;
  subtitle: string | null;
  brief: string | null;
  fullText: string | null;
  url: string | null;
  ballotResponses: string[];
  proStatement: string | null;
  conStatement: string | null;
}

interface ContestV1 {
  id: string;
  type: string;
  office: string;
  officeSlug: string;
  ballotTitle: string | null;
  electionId: string;
  electionDate: string;
  electionName: string;
  district: ContestDistrict;
  numberElected: number;
  candidates: ContestCandidate[];
  referendumInfo: ReferendumInfo | null;
  source: string;
  sourceMetadata: Record<string, unknown>;
  fetchedAt: string;
  contentHash: string;
  deleted: boolean;
}

interface Manifest {
  lastUpdated: string;
  electionId: string;
  electionName: string;
  electionDate: string;
  address: string;
  source: string;
  totalContests: number;
  totalCandidates: number;
}

const SOURCE_BADGE_COLORS: Record<string, string> = {
  'google-civic': 'bg-blue-100 text-blue-800',
  manual: 'bg-yellow-100 text-yellow-800',
  'sos-la': 'bg-green-100 text-green-800',
  'vip-feed': 'bg-purple-100 text-purple-800',
};

const DebugBallotFeedPage: React.FC = () => {
  const navigate = useNavigate();
  const [contests, setContests] = useState<ContestV1[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'contests' | 'referenda'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const knownFiles = ['la-2026-may-primary', 'la-2026-nov'];
      const allContests: ContestV1[] = [];

      for (const id of knownFiles) {
        try {
          const res = await fetch(`/data/contests/${id}.json`);
          if (res.ok) {
            const data: ContestV1[] = await res.json();
            allContests.push(...data);
          }
        } catch { /* skip missing files */ }
      }

      if (allContests.length === 0) {
        setError('No pipeline data found. Run the pipeline first:\n  npx tsx data-pipeline/src/runner.ts --source manual');
        return;
      }

      setContests(allContests);

      const manifestRes = await fetch('/data/contests/manifest.json');
      if (manifestRes.ok) {
        const m: Manifest = await manifestRes.json();
        m.totalContests = allContests.filter(c => !c.deleted).length;
        m.totalCandidates = allContests.filter(c => !c.deleted).reduce((s, c) => s + c.candidates.length, 0);
        m.electionName = 'Louisiana 2026 Elections';
        setManifest(m);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeContests = contests.filter((c) => !c.deleted);
  const filtered = activeContests.filter((c) => {
    if (filter === 'contests') return c.type !== 'Referendum';
    if (filter === 'referenda') return c.type === 'Referendum';
    return true;
  });

  const totalCandidates = activeContests.reduce(
    (sum, c) => sum + c.candidates.length,
    0,
  );

  return (
    <div className="max-w-4xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🔍</span> Debug: Ballot Feed
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Data sourced from the pipeline — not for public use
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-civic-blue underline"
        >
          ← Back to app
        </button>
      </div>

      {/* Manifest summary */}
      {manifest && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Election</div>
              <div className="font-semibold">{manifest.electionName}</div>
            </div>
            <div>
              <div className="text-gray-500">Date</div>
              <div className="font-semibold">{manifest.electionDate}</div>
            </div>
            <div>
              <div className="text-gray-500">Contests</div>
              <div className="font-semibold">{manifest.totalContests}</div>
            </div>
            <div>
              <div className="text-gray-500">Candidates</div>
              <div className="font-semibold">{manifest.totalCandidates}</div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-500">Address</div>
              <div className="font-semibold">{manifest.address}</div>
            </div>
            <div>
              <div className="text-gray-500">Source</div>
              <SourceBadge source={manifest.source} />
            </div>
            <div>
              <div className="text-gray-500">Last updated</div>
              <div className="font-semibold text-xs">
                {new Date(manifest.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-12 text-gray-400">Loading pipeline data…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="text-red-800 font-semibold mb-1">⚠️ No data available</div>
          <pre className="text-red-700 text-xs whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {/* Filter tabs */}
      {!loading && !error && (
        <>
          <div className="flex gap-2 mb-4">
            {(['all', 'contests', 'referenda'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                  filter === f
                    ? 'bg-civic-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all'
                  ? `All (${activeContests.length})`
                  : f === 'contests'
                    ? `Offices (${activeContests.filter((c) => c.type !== 'Referendum').length})`
                    : `Referenda (${activeContests.filter((c) => c.type === 'Referendum').length})`}
              </button>
            ))}
            <div className="ml-auto text-sm text-gray-400">
              {totalCandidates} total candidates
            </div>
          </div>

          {/* Contest list */}
          <div className="space-y-3">
            {filtered.map((contest) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                expanded={expandedIds.has(contest.id)}
                onToggle={() => toggleExpand(contest.id)}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No {filter === 'referenda' ? 'referenda' : 'contests'} found.
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ContestCard: React.FC<{
  contest: ContestV1;
  expanded: boolean;
  onToggle: () => void;
}> = ({ contest, expanded, onToggle }) => {
  const isReferendum = contest.type === 'Referendum';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">
              {contest.office}
            </span>
            <SourceBadge source={contest.source} />
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {contest.type}
            </span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {contest.district.name}
            {contest.district.scope && (
              <span className="ml-2 text-xs text-gray-400">
                ({contest.district.scope})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          {!isReferendum && (
            <span className="text-sm text-gray-500">
              {contest.candidates.length} candidate
              {contest.candidates.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 p-4">
          {isReferendum && contest.referendumInfo ? (
            <ReferendumDetail info={contest.referendumInfo} />
          ) : (
            <CandidateList candidates={contest.candidates} />
          )}

          {/* Metadata */}
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-1">
            <div>
              <span className="font-medium">ID:</span> {contest.id}
            </div>
            <div>
              <span className="font-medium">Hash:</span>{' '}
              {contest.contentHash.slice(0, 16)}…
            </div>
            <div>
              <span className="font-medium">Fetched:</span>{' '}
              {new Date(contest.fetchedAt).toLocaleString()}
            </div>
            {contest.numberElected > 1 && (
              <div>
                <span className="font-medium">Seats:</span>{' '}
                {contest.numberElected}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CandidateList: React.FC<{ candidates: ContestCandidate[] }> = ({
  candidates,
}) => {
  if (candidates.length === 0) {
    return <div className="text-sm text-gray-400 italic">No candidates listed.</div>;
  }
  return (
    <div className="space-y-2">
      {candidates.map((c, i) => (
        <div
          key={`${c.name}-${i}`}
          className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
        >
          <div>
            <span className="font-medium text-gray-900">{c.name}</span>
            {c.party && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                {c.party}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {c.candidateUrl && (
              <a
                href={c.candidateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-civic-blue underline"
              >
                Website
              </a>
            )}
            {c.channels.map((ch) => (
              <span key={ch.type} className="text-xs text-gray-400">
                {ch.type}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const ReferendumDetail: React.FC<{ info: ReferendumInfo }> = ({ info }) => (
  <div className="space-y-2 text-sm">
    {info.subtitle && <p className="text-gray-600">{info.subtitle}</p>}
    {info.brief && <p className="text-gray-700">{info.brief}</p>}
    {info.ballotResponses.length > 0 && (
      <div className="flex gap-2">
        {info.ballotResponses.map((r) => (
          <span
            key={r}
            className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
          >
            {r}
          </span>
        ))}
      </div>
    )}
    {info.url && (
      <a
        href={info.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-civic-blue underline text-xs"
      >
        More info →
      </a>
    )}
  </div>
);

const SourceBadge: React.FC<{ source: string }> = ({ source }) => (
  <span
    className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE_COLORS[source] ?? 'bg-gray-100 text-gray-600'}`}
  >
    {source}
  </span>
);

export default DebugBallotFeedPage;
