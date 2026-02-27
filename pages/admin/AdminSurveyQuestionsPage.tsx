import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SurveyQuestion } from '../../types';
import {
  getFirestoreSurveyQuestions,
  saveSurveyQuestion,
  deleteSurveyQuestion,
} from '../../services/firestoreDataService';
import { PlusIcon, TrashIcon, PencilSquareIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const AdminSurveyQuestionsPage: React.FC = () => {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    setLoading(true);
    const data = await getFirestoreSurveyQuestions();
    setQuestions(data);
    setLoading(false);
  }

  async function handleSaveEdit(key: string) {
    if (!editText.trim()) return;
    await saveSurveyQuestion({ key, question: editText.trim() });
    setEditingKey(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await loadQuestions();
  }

  async function handleAddNew() {
    if (!newKey.trim() || !newQuestion.trim()) return;
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    await saveSurveyQuestion({ key, question: newQuestion.trim() });
    setNewKey('');
    setNewQuestion('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await loadQuestions();
  }

  async function handleDelete(key: string) {
    if (!confirm(`Delete question "${key}"? This won't remove existing responses from candidates, but the question will no longer appear in the survey.`)) return;
    await deleteSurveyQuestion(key);
    await loadQuestions();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Admin: Survey Questions</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">Manage the questions sent to all candidates</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/admin/survey-responses" className="text-sm bg-civic-blue text-white px-3 py-1.5 rounded-md hover:bg-opacity-90 font-medium">Upload Responses</Link>
          <Link to="/admin" className="text-sm text-gray-500 underline">Setup</Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <p className="text-sm text-gray-500 mb-4">
          These questions are sent to every candidate in every race. Candidates and their responses are compared side-by-side on the Compare page. The same questions apply to all offices — U.S. Senate, Mayor-President, Metro Council, etc.
        </p>

        {saved && (
          <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm flex items-center gap-1">
            <CheckCircleIcon className="h-4 w-4" /> Saved
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.key} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-sm font-bold text-midnight-navy/40 w-6 pt-0.5">
                  {idx + 1}.
                </div>
                <div className="flex-1">
                  {editingKey === q.key ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(q.key)}
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(q.key)} className="text-green-600 text-sm font-medium hover:underline">Save</button>
                      <button onClick={() => setEditingKey(null)} className="text-gray-400 text-sm hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-midnight-navy">{q.question}</p>
                      <p className="text-xs text-gray-400 mt-0.5">key: {q.key}</p>
                    </div>
                  )}
                </div>
                {editingKey !== q.key && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingKey(q.key); setEditText(q.question); }}
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-civic-blue"
                      title="Edit"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.key)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new question */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-midnight-navy mb-3">Add a New Question</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key (e.g. community_priorities)"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Question text (e.g. What are your top three community priorities?)"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            />
            <button
              onClick={handleAddNew}
              disabled={!newKey.trim() || !newQuestion.trim()}
              className="inline-flex items-center gap-1 bg-midnight-navy text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-90 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" /> Add Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSurveyQuestionsPage;
