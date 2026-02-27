import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { importCandidatesFromCsv, CsvImportResult } from '../../services/firestoreDataService';
import { ArrowUpTrayIcon, DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const SAMPLE_CSV = `id,firstName,lastName,party,officeId,cycleId,district,photoUrl,website,email,phone,bio,ballotOrder,isIncumbent,facebook,twitter,instagram,why_running,top_priority,experience,fiscal_approach
1001,Jane,Smith,Democratic,1,1,,https://example.com/jane.jpg,https://janesmith.com,jane@example.com,225-555-0001,"Jane Smith is a community leader running for Mayor-President.",1,false,https://facebook.com/janesmith,https://twitter.com/janesmith,,I want to serve my community.,Education funding and public safety.,10 years on the city council.,Balanced budgets with investment in infrastructure.
1002,John,Doe,Republican,2,1,District 61,https://example.com/john.jpg,https://johndoe.com,john@example.com,225-555-0002,"John Doe is a local business owner.",2,false,,,,"To bring business sense to government.",Economic development.,15 years in small business.,Cut waste and reduce taxes."`;

const AdminCsvImportPage: React.FC = () => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      generatePreview(text);
    };
    reader.readAsText(file);
  }

  function generatePreview(text: string) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const rows = lines.slice(0, 6).map((line) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { cells.push(current); current = ''; continue; }
        current += ch;
      }
      cells.push(current);
      return cells;
    });
    setPreview(rows);
  }

  async function handleImport() {
    if (!csvText.trim()) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importCandidatesFromCsv(csvText);
      setResult(res);
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: [err instanceof Error ? err.message : String(err)] });
    } finally {
      setImporting(false);
    }
  }

  function handleDownloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'myballot-candidates-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-midnight-navy">Admin: CSV Import</h1>
          <p className="text-sm text-midnight-navy/60 mt-1">Bulk-import candidates from a CSV file</p>
        </div>
        <Link to="/admin/candidates" className="text-sm text-civic-blue underline">← Back to Candidates</Link>
      </div>

      {/* Template download */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-midnight-navy mb-2">Step 1: Prepare your CSV</h2>
        <p className="text-sm text-gray-500 mb-3">
          Download the template, fill in your candidate data in a spreadsheet (Excel, Google Sheets, etc.), then save/export as CSV.
        </p>
        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-midnight-navy text-white hover:bg-opacity-90"
        >
          <ArrowDownTrayIcon className="h-4 w-4" /> Download CSV Template
        </button>

        <div className="mt-4 text-xs text-gray-400">
          <strong>Required columns:</strong> id, firstName, lastName, party, officeId, cycleId
          <br />
          <strong>Optional columns:</strong> district, photoUrl, website, email, phone, bio, ballotOrder, isIncumbent, facebook, twitter, instagram, why_running, top_priority, experience, fiscal_approach
        </div>
      </div>

      {/* File upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-midnight-navy mb-2">Step 2: Upload your CSV</h2>
        <div className="flex items-center gap-3">
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
          {fileName && (
            <span className="text-sm text-gray-500">
              {csvText.split('\n').filter(Boolean).length - 1} data rows
            </span>
          )}
        </div>

        {/* Preview */}
        {preview && preview.length > 1 && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-xs text-gray-500 mb-2">Preview (first 5 rows):</p>
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  {preview[0].map((h, i) => (
                    <th key={i} className="px-2 py-1 bg-gray-50 border text-left font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 border text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {cell || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import button */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-midnight-navy mb-2">Step 3: Import</h2>
        <p className="text-sm text-gray-500 mb-3">
          This will create or overwrite candidate records in Firestore. Existing candidates with the same ID will be replaced.
        </p>
        <button
          onClick={handleImport}
          disabled={importing || !csvText.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-sm font-semibold bg-civic-blue text-white hover:bg-opacity-90 disabled:opacity-50"
        >
          <ArrowUpTrayIcon className="h-4 w-4" />
          {importing ? 'Importing...' : 'Import to Firestore'}
        </button>

        {result && (
          <div className={`mt-4 p-4 rounded-lg border ${result.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-sm font-medium">
              ✅ Imported: {result.imported} | ⏭️ Skipped: {result.skipped}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2 text-xs text-red-600">
                <strong>Errors:</strong>
                <ul className="list-disc ml-4 mt-1">
                  {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 10 && <li>...and {result.errors.length - 10} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCsvImportPage;
