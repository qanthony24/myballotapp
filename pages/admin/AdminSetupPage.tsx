import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  seedAllToFirestore,
  setAdminEmails,
} from '../../services/firestoreDataService';

const AdminSetupPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [adminEmail, setAdminEmail] = useState(currentUser?.email || '');
  const [adminSaved, setAdminSaved] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await seedAllToFirestore();
      setSeedResult(result);
    } catch (err) {
      setSeedResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSeeding(false);
    }
  }

  async function handleSetAdmin() {
    if (!adminEmail.trim()) return;
    try {
      const emails = adminEmail.split(',').map((e) => e.trim()).filter(Boolean);
      await setAdminEmails(emails);
      setAdminSaved(true);
      setTimeout(() => setAdminSaved(false), 3000);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-midnight-navy">Admin: Setup</h1>
        <Link to="/admin/candidates" className="text-sm text-civic-blue underline">
          Go to Candidates →
        </Link>
      </div>

      {/* Set admin emails */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-midnight-navy mb-2">Admin Access</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter the email addresses that should have admin access. Separate multiple emails with commas.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={handleSetAdmin}
            className="bg-civic-blue text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-90"
          >
            Save
          </button>
        </div>
        {adminSaved && <p className="text-green-600 text-sm mt-2">Admin emails saved!</p>}
        <p className="text-xs text-gray-400 mt-2">
          Currently logged in as: {currentUser?.email || 'Not logged in'}
        </p>
      </div>

      {/* Seed data */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-midnight-navy mb-2">Seed Firestore</h2>
        <p className="text-sm text-gray-500 mb-4">
          Import the current mock data from constants.tsx into Firestore. This creates documents for
          all candidates, elections, offices, and survey questions. Existing documents will be overwritten.
        </p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="bg-midnight-navy text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-90 disabled:opacity-50"
        >
          {seeding ? 'Seeding...' : 'Seed All Data to Firestore'}
        </button>
        {seedResult && (
          <p className={`text-sm mt-3 ${seedResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
            {seedResult}
          </p>
        )}
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-midnight-navy mb-3">Quick Links</h2>
        <ul className="space-y-2 text-sm">
          <li><Link to="/admin/candidates" className="text-civic-blue underline">Manage Candidates</Link></li>
          <li><Link to="/admin/ballot-measures" className="text-civic-blue underline">Manage Ballot Measures</Link></li>
          <li><Link to="/admin/survey-questions" className="text-civic-blue underline">Manage Survey Questions</Link></li>
          <li><Link to="/admin/survey-responses" className="text-civic-blue underline">Upload Survey Responses (by race)</Link></li>
          <li><Link to="/admin/csv-import" className="text-civic-blue underline">CSV Candidate Import</Link></li>
          <li><a href="https://console.firebase.google.com/project/myballot-app/firestore" target="_blank" rel="noopener noreferrer" className="text-civic-blue underline">Firebase Console (Firestore)</a></li>
          <li><Link to="/debug/ballot-feed" className="text-civic-blue underline">Debug Ballot Feed</Link></li>
        </ul>
      </div>
    </div>
  );
};

export default AdminSetupPage;
