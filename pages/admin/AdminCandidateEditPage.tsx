import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Candidate, SurveyQuestion } from '../../types';
import {
  getFirestoreCandidateById,
  saveCandidate,
  getLocalOffices,
  getLocalCycles,
  getLocalSurveyQuestions,
} from '../../services/firestoreDataService';
import { getOfficeById } from '../../services/dataService';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const AdminCandidateEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offices = getLocalOffices();
  const cycles = getLocalCycles();
  const surveyQuestions = getLocalSurveyQuestions();

  useEffect(() => {
    if (!id) return;
    loadCandidate(parseInt(id));
  }, [id]);

  async function loadCandidate(candidateId: number) {
    setLoading(true);
    const c = await getFirestoreCandidateById(candidateId);
    if (c) {
      setCandidate(c);
    } else {
      setError('Candidate not found');
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!candidate) return;
    setSaving(true);
    setError(null);
    try {
      await saveCandidate(candidate);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof Candidate>(field: K, value: Candidate[K]) {
    if (!candidate) return;
    setCandidate({ ...candidate, [field]: value });
    setSaved(false);
  }

  function updateSocialLink(platform: string, value: string) {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      socialLinks: { ...candidate.socialLinks, [platform]: value },
    });
    setSaved(false);
  }

  function updateSurveyResponse(key: string, value: string) {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      surveyResponses: { ...candidate.surveyResponses, [key]: value },
    });
    setSaved(false);
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (error && !candidate) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!candidate) return null;

  const office = getOfficeById(candidate.officeId);
  const cycle = cycles.find((c) => c.id === candidate.cycleId);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/candidates')} className="text-civic-blue hover:underline flex items-center gap-1 text-sm">
            <ArrowLeftIcon className="h-4 w-4" /> All Candidates
          </button>
        </div>
        <Link to={`/candidate/${candidate.id}`} className="text-xs text-gray-500 underline">
          View public profile →
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Candidate header */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b">
          <img
            src={candidate.photoUrl || 'https://via.placeholder.com/80'}
            alt=""
            className="w-20 h-20 rounded-full object-cover bg-gray-200 border-2 border-civic-blue"
            onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/80'; }}
          />
          <div>
            <h2 className="text-xl font-bold text-midnight-navy">
              {candidate.firstName} {candidate.lastName}
            </h2>
            <p className="text-sm text-gray-500">
              {office?.name}{candidate.district ? `, ${candidate.district}` : ''} · {cycle?.name} · {candidate.party}
            </p>
            <p className="text-xs text-gray-400 mt-1">ID: {candidate.id}</p>
          </div>
        </div>

        {/* Basic Info */}
        <Section title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" value={candidate.firstName} onChange={(v) => updateField('firstName', v)} />
            <Field label="Last Name" value={candidate.lastName} onChange={(v) => updateField('lastName', v)} />
            <Field label="Party" value={candidate.party} onChange={(v) => updateField('party', v)} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Office</label>
              <select
                value={candidate.officeId}
                onChange={(e) => updateField('officeId', parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <Field label="District" value={candidate.district || ''} onChange={(v) => updateField('district', v || undefined)} placeholder="e.g. District 1" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Election</label>
              <select
                value={candidate.cycleId}
                onChange={(e) => updateField('cycleId', parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Field label="Ballot Order" value={String(candidate.ballotOrder)} onChange={(v) => updateField('ballotOrder', parseInt(v) || 1)} />
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={candidate.isIncumbent || false}
                onChange={(e) => updateField('isIncumbent', e.target.checked)}
                className="accent-civic-blue h-4 w-4"
              />
              <label className="text-sm text-gray-700">Incumbent</label>
            </div>
          </div>
        </Section>

        {/* Photo & Media */}
        <Section title="Photo & Media">
          <Field
            label="Photo URL"
            value={candidate.photoUrl || ''}
            onChange={(v) => updateField('photoUrl', v)}
            placeholder="https://example.com/photo.jpg"
          />
          {candidate.photoUrl && (
            <div className="mt-2">
              <img
                src={candidate.photoUrl}
                alt="Preview"
                className="w-24 h-24 rounded-lg object-cover border"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}
          <div className="mt-3 text-xs text-gray-400">
            Tip: Use a direct link to a candidate headshot from their campaign site, social media, or a news article.
          </div>
        </Section>

        {/* Contact & Web */}
        <Section title="Contact & Web">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Website" value={candidate.website || ''} onChange={(v) => updateField('website', v || undefined)} placeholder="https://" />
            <Field label="Email" value={candidate.email || ''} onChange={(v) => updateField('email', v || undefined)} placeholder="candidate@example.com" />
            <Field label="Phone" value={candidate.phone || ''} onChange={(v) => updateField('phone', v || undefined)} placeholder="225-555-0000" />
            <Field label="Mailing Address" value={candidate.mailingAddress || ''} onChange={(v) => updateField('mailingAddress', v || undefined)} />
          </div>
        </Section>

        {/* Social Links */}
        <Section title="Social Media">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Facebook" value={candidate.socialLinks?.facebook || ''} onChange={(v) => updateSocialLink('facebook', v)} placeholder="https://facebook.com/..." />
            <Field label="Twitter / X" value={candidate.socialLinks?.twitter || ''} onChange={(v) => updateSocialLink('twitter', v)} placeholder="https://twitter.com/..." />
            <Field label="Instagram" value={candidate.socialLinks?.instagram || ''} onChange={(v) => updateSocialLink('instagram', v)} placeholder="https://instagram.com/..." />
            <Field label="YouTube" value={candidate.socialLinks?.youtube || ''} onChange={(v) => updateSocialLink('youtube', v)} placeholder="https://youtube.com/..." />
            <Field label="TikTok" value={candidate.socialLinks?.tiktok || ''} onChange={(v) => updateSocialLink('tiktok', v)} placeholder="https://tiktok.com/@..." />
          </div>
        </Section>

        {/* Bio */}
        <Section title="Biography">
          <textarea
            value={candidate.bio || ''}
            onChange={(e) => updateField('bio', e.target.value)}
            rows={5}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-y"
            placeholder="Write the candidate's biography..."
          />
        </Section>

        {/* Survey Responses */}
        <Section title="Survey Responses">
          <p className="text-xs text-gray-400 mb-4">
            Enter the candidate's responses to each survey question. Leave blank if not yet received.
          </p>
          {surveyQuestions.map((q) => (
            <div key={q.key} className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{q.question}</label>
              <textarea
                value={candidate.surveyResponses?.[q.key] || ''}
                onChange={(e) => updateSurveyResponse(q.key, e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-y"
                placeholder="Candidate's response..."
              />
            </div>
          ))}
        </Section>

        {/* Running Mate (for president) */}
        {candidate.officeId === 5 && (
          <Section title="Running Mate">
            <Field
              label="Running Mate Name"
              value={candidate.runningMateName || ''}
              onChange={(v) => updateField('runningMateName', v || undefined)}
              placeholder="Vice Presidential candidate"
            />
          </Section>
        )}

        {/* Save bar */}
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
            {saving ? 'Saving...' : 'Save Changes'}
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

export default AdminCandidateEditPage;
