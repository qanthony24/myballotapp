import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Candidate, SurveyQuestion, Office, Cycle } from '../../types';
import {
  getFirestoreCandidates,
  getFirestoreSurveyQuestions,
  getLocalOffices,
  getLocalCycles,
  importSurveyResponsesCsv,
  CsvImportResult,
} from '../../services/firestoreDataService';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const AdminSurveyResponsesPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedElection, setSelectedElection] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const offices = getLocalOffices();
  const cycles = getLocalCycles();

  useEffect(() => {
    Promise.all([
      getFirestoreCandidates(),
      getFirestoreSurveyQuestions(),
    ]).then(([cands, qs]) => {
      setCandidates(cands);
      setQuestions(qs);
      setLoading(false);
    });
  }, []);

  const raceCandidates = useMemo(() => {
    if (!selectedElection || !selectedOffice) return [];
    const cycle = cycles.find((c) => c.electionDate === selectedElection);
    if (!cycle) return [];
    return candidates.filter((c) => {
      if (c.cycleId !== cycle.id) return false;
      if (c.officeId !== parseInt(selectedOffice)) return false;
      if (selectedDistrict && c.district !== selectedDistrict) return false;
      return true;
    });
  }, [candidates, selectedElection, selectedOffice, selectedDistrict, cycles]);

  const availableDistricts = useMemo(() => {
    if (!selectedElection || !selectedOffice) return [];
    const cycle = cycles.find((c) => c.electionDate === selectedElection);
    if (!cycle) return [];
    const districts = new Set<string>();
    candidates
      .filter((c) => c.cycleId === cycle.id && c.officeId === parseInt(selectedOffice) && c.district)
      .forEach((c) => districts.add(c.district!));
    return Array.from(districts).sort();
  }, [candidates, selectedElection, selectedOffice, cycles]);

  const office = offices.find((o) => o.id === parseInt(selectedOffice));

  function generateCsvTemplate(): string {
    const qHeaders = questions.map((q) => `q_${q.key}`);
    const header = ['candidateId', 'candidateName', 'party', ...qHeaders].join(',');
    const rows = raceCandidates.map((c) => {
      const existing = questions.map((q) => {
        const val = c.surveyResponses?.[q.key] || '';
        return `"${val.replace(/"/g, '""')}"`;
      });
      return [`${c.id}`, `"${c.firstName} ${c.lastName}"`, `"${c.party}"`, ...existing].join(',');
    });
    return [header, ...rows].join('\n');
  }

  function handleDownloadTemplate() {
    if (raceCandidates.length === 0) return;
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const raceName = `${office?.name || 'office'}${selectedDistrict ? `-${selectedDistrict}` : ''}`.replace(/\s+/g, '-').toLowerCase();
    a.href = url;
    a.download = `survey-responses-${raceName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText.trim()) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importSurveyResponsesCsv(csvText);
      setResult(res);
      if (res.imported > 0) {
        const cands = await getFirestoreCandidates();
        setCandidates(cands);
      }
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: [err instanceof Error ? err.message : String(err)] });
    } finally {
      setImporting(false);
    }
  }

  const responseStats = useMemo(() => {
    if (raceCandidates.length === 0) return { total: 0, withAny: 0, complete: 0 };
    const total = raceCandidates.length;
    let withAny = 0;
    let complete = 0;
    for (const c of raceCandidates) {
      const responses = questions.map((q) => c.surveyResponses?.[q.key]).filter(Boolean);
      if (responses.length > 0) withAny++;
      if (responses.length === questions.length) complete++;
    }
    return { total, withAny, complete };
  }, [raceCandidates, questions]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Admin: Survey Responses</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">Upload candidate survey responses per race via CSV</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/admin/survey-questions" className="text-sm text-civic-blue underline">Manage Questions</Link>
          <Link to="/admin/candidates" className="text-sm text-gray-500 underline">Candidates</Link>
        </div>
      </div>

      {/* Step 1: Pick the race */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-midnight-navy mb-3">Step 1: Select the Race</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Election</label>
            <select
              value={selectedElection}
              onChange={(e) => { setSelectedElection(e.target.value); setSelectedOffice(''); setSelectedDistrict(''); }}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            >
              <option value="">-- Select --</option>
              {cycles.map((c) => <option key={c.id} value={c.electionDate}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Office</label>
            <select
              value={selectedOffice}
              onChange={(e) => { setSelectedOffice(e.target.value); setSelectedDistrict(''); }}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            >
              <option value="">-- Select --</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          {availableDistricts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Districts</option>
                {availableDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
        </div>

        {raceCandidates.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-midnight-navy mb-2">
              {office?.name}{selectedDistrict ? `, ${selectedDistrict}` : ''} — {raceCandidates.length} candidate{raceCandidates.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>{responseStats.complete} / {responseStats.total} complete</span>
              <span>{responseStats.withAny} / {responseStats.total} have any responses</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {raceCandidates.map((c) => {
                const responseCount = questions.filter((q) => c.surveyResponses?.[q.key]).length;
                const isComplete = responseCount === questions.length;
                return (
                  <span key={c.id} className={`text-xs px-2 py-1 rounded-full ${isComplete ? 'bg-green-100 text-green-700' : responseCount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.firstName} {c.lastName} ({responseCount}/{questions.length})
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Download template */}
      {raceCandidates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-midnight-navy mb-2">Step 2: Download Pre-filled Template</h2>
          <p className="text-sm text-gray-500 mb-3">
            This CSV comes pre-filled with the candidates in this race. The question columns match your survey questions.
            {responseStats.withAny > 0 && ' Existing responses are included so you can update them.'}
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-midnight-navy text-white hover:bg-opacity-90"
          >
            <ArrowDownTrayIcon className="h-4 w-4" /> Download CSV for {office?.name}{selectedDistrict ? ` ${selectedDistrict}` : ''}
          </button>
          <div className="mt-3 text-xs text-gray-400">
            <strong>Columns:</strong> candidateId, candidateName, party, {questions.map((q) => `q_${q.key}`).join(', ')}
          </div>
        </div>
      )}

      {/* Step 3: Upload */}
      {raceCandidates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-midnight-navy mb-2">Step 3: Upload Completed Responses</h2>
          <div className="flex items-center gap-3 mb-3">
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium cursor-pointer bg-civic-blue/10 text-civic-blue hover:bg-civic-blue/20 border border-civic-blue/30">
              <DocumentTextIcon className="h-4 w-4" />
              {fileName || 'Choose CSV file'}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || !csvText.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-sm font-semibold bg-civic-blue text-white hover:bg-opacity-90 disabled:opacity-50"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {importing ? 'Importing...' : 'Upload Responses'}
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-lg border ${result.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-sm font-medium flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                Updated {result.imported} candidate{result.imported !== 1 ? 's' : ''}{result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 list-disc ml-4">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedElection || !selectedOffice ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          Select an election and office above to get started.
        </div>
      ) : raceCandidates.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No candidates found for this race. Make sure candidates are assigned to this office and election.
        </div>
      ) : null}
    </div>
  );
};

export default AdminSurveyResponsesPage;
