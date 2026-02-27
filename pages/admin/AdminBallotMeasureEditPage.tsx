import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BallotMeasure } from '../../types';
import {
  getFirestoreBallotMeasureById,
  saveBallotMeasure,
  getLocalCycles,
  getFirestoreBallotMeasures,
} from '../../services/firestoreDataService';
import { getFormattedElectionNameFromDate } from '../../services/dataService';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const AdminBallotMeasureEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [measure, setMeasure] = useState<BallotMeasure | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cycles = getLocalCycles();

  useEffect(() => {
    if (isNew) {
      setMeasure({
        id: Date.now(),
        slug: '',
        title: '',
        electionDate: cycles[0]?.electionDate || '',
        ballotLanguage: '',
        laymansExplanation: '',
        yesVoteMeans: '',
        noVoteMeans: '',
      });
      setLoading(false);
    } else if (id) {
      getFirestoreBallotMeasureById(parseInt(id)).then((m) => {
        setMeasure(m ?? null);
        if (!m) setError('Ballot measure not found');
        setLoading(false);
      });
    }
  }, [id]);

  async function handleSave() {
    if (!measure) return;
    if (!measure.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!measure.slug.trim()) {
      measure.slug = measure.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    setSaving(true);
    setError(null);
    try {
      await saveBallotMeasure(measure);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (isNew) {
        navigate(`/admin/ballot-measures/${measure.id}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof BallotMeasure>(field: K, value: BallotMeasure[K]) {
    if (!measure) return;
    setMeasure({ ...measure, [field]: value });
    setSaved(false);
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (error && !measure) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!measure) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/admin/ballot-measures')} className="text-civic-blue hover:underline flex items-center gap-1 text-sm">
          <ArrowLeftIcon className="h-4 w-4" /> All Ballot Measures
        </button>
        {!isNew && (
          <Link to={`/ballot-measure/${measure.id}`} className="text-xs text-gray-500 underline">
            View public page →
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-midnight-navy mb-6">
          {isNew ? 'New Ballot Measure' : `Edit: ${measure.title}`}
        </h2>

        {/* Basic Info */}
        <Section title="Basic Information">
          <div className="space-y-4">
            <Field label="Title" value={measure.title} onChange={(v) => updateField('title', v)} placeholder="e.g. Proposition L: Library System Millage Renewal" />
            <Field label="Slug (URL-safe, auto-generated if blank)" value={measure.slug} onChange={(v) => updateField('slug', v)} placeholder="e.g. proposition-l-library-millage" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Election</label>
              <select
                value={measure.electionDate}
                onChange={(e) => updateField('electionDate', e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.electionDate}>{c.name} ({c.electionDate})</option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        {/* Official Language */}
        <Section title="Official Ballot Language">
          <textarea
            value={measure.ballotLanguage}
            onChange={(e) => updateField('ballotLanguage', e.target.value)}
            rows={6}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-y"
            placeholder="The exact text that appears on the ballot..."
          />
          <p className="text-xs text-gray-400 mt-1">This should be the official legal language as it will appear on the ballot.</p>
        </Section>

        {/* Plain Language Explanation */}
        <Section title="Plain Language Explanation">
          <textarea
            value={measure.laymansExplanation}
            onChange={(e) => updateField('laymansExplanation', e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-y"
            placeholder="What this measure means in everyday language..."
          />
          <p className="text-xs text-gray-400 mt-1">Write this for someone who has never read a ballot before.</p>
        </Section>

        {/* What a vote means */}
        <Section title="What Your Vote Means">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-green-700 mb-1">✅ A "Yes" vote means...</label>
              <textarea
                value={measure.yesVoteMeans}
                onChange={(e) => updateField('yesVoteMeans', e.target.value)}
                rows={3}
                className="w-full border border-green-200 rounded-md px-3 py-2 text-sm resize-y bg-green-50/50"
                placeholder="What happens if this passes..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-700 mb-1">❌ A "No" vote means...</label>
              <textarea
                value={measure.noVoteMeans}
                onChange={(e) => updateField('noVoteMeans', e.target.value)}
                rows={3}
                className="w-full border border-red-200 rounded-md px-3 py-2 text-sm resize-y bg-red-50/50"
                placeholder="What happens if this fails..."
              />
            </div>
          </div>
        </Section>

        {/* Save */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {saved && (
              <p className="text-green-600 text-sm flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4" /> Saved to Firestore
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-civic-blue text-white font-semibold px-6 py-2.5 rounded-md hover:bg-opacity-90 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : isNew ? 'Create Measure' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-sm font-semibold text-midnight-navy uppercase tracking-wide mb-3">{title}</h3>
    {children}
  </div>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
    />
  </div>
);

export default AdminBallotMeasureEditPage;
