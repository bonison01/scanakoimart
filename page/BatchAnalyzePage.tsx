import React, { useEffect, useState } from 'react';
import { extractDataFromImage } from '../services/geminiService';
import { saveContactToSupabase } from '../services/supabaseService';
import { ColumnConfig } from '../types';
import { useNavigate } from 'react-router-dom';
import { HeaderNavigation } from '../components/HeaderNavigation';
import { LoadingSpinner } from '../components/LoadingSpinner';

type RecordWithImage = {
  id: string;
  imageSrc: string;
  analyzed: boolean;
  saved?: boolean;      // New flag: true when saved to Supabase
  dateAdded: string;
  [key: string]: any;
};

const DEFAULT_CONFIG: ColumnConfig[] = [
  { key: 'name', header: 'Name', visible: true },
  { key: 'company', header: 'Company', visible: true },
  { key: 'phone', header: 'Phone', visible: true },
  { key: 'dateAdded', header: 'Date Added', visible: true },
  { key: 'address', header: 'Address', visible: false },
  { key: 'delivery_Amt', header: 'Delivery Amount', visible: true },
  { key: 'product_Amt', header: 'Product Amount', visible: true },
  { key: 'mode', header: 'Payment Mode', visible: true },
];

export default function BatchAnalyzePage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<RecordWithImage[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalToAnalyze, setTotalToAnalyze] = useState(0);
  const [showPendingAnalyzed, setShowPendingAnalyzed] = useState(false);

  useEffect(() => {
    const startBatchAnalysis = async () => {
      try {
        const existing = localStorage.getItem('visual-text-extractor-db');
        const parsed: RecordWithImage[] = existing ? JSON.parse(existing) : [];

        // Filter images that are not analyzed yet
        const toAnalyze = parsed.filter((entry) => entry.imageSrc && !entry.analyzed);
        setTotalToAnalyze(toAnalyze.length);

        for (let i = 0; i < toAnalyze.length; i++) {
          setCurrentIndex(i);
          const record = toAnalyze[i];
          const base64Data = record.imageSrc.split(',')[1];
          const extracted = await extractDataFromImage(base64Data, DEFAULT_CONFIG);

          const updatedRecord = {
            ...record,
            ...extracted,
            analyzed: true,
            saved: false, // Mark as analyzed but not saved yet
            dateAdded: new Date().toISOString(),
          };

          const index = parsed.findIndex((r) => r.id === record.id);
          if (index !== -1) parsed[index] = updatedRecord;

          setProgress(((i + 1) / toAnalyze.length) * 100);
        }

        // Save all updated records back
        localStorage.setItem('visual-text-extractor-db', JSON.stringify(parsed));

        // Show all analyzed records that are NOT saved yet, initially
        const pendingAnalyzed = parsed.filter(r => r.analyzed && !r.saved);
        setRecords(pendingAnalyzed);

        setIsAnalyzing(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Batch analysis failed: ${message}`);
        setIsAnalyzing(false);
      }
    };

    startBatchAnalysis();
  }, []);

  const handleInputChange = (id: string, field: string, value: string) => {
    setRecords((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, [field]: value } : rec))
    );
  };

  const handleSaveToSupabase = async (record: RecordWithImage) => {
    try {
      setSavingId(record.id);
      const { id, imageSrc, analyzed, saved, ...dataToSave } = record;

      const { error } = await saveContactToSupabase(dataToSave);
      if (error) {
        alert(`Failed to save ${record.name}: ${error.message}`);
      } else {
        alert(`Saved "${record.name}" to Supabase successfully.`);

        // Mark record as saved in local storage and update state
        const existing = localStorage.getItem('visual-text-extractor-db');
        const parsed: RecordWithImage[] = existing ? JSON.parse(existing) : [];
        const idx = parsed.findIndex(r => r.id === record.id);
        if (idx !== -1) {
          parsed[idx].saved = true;
          localStorage.setItem('visual-text-extractor-db', JSON.stringify(parsed));
        }

        // Remove saved record from current view list
        setRecords(prev => prev.filter(r => r.id !== record.id));
      }
    } catch (err) {
      alert(`Failed to save "${record.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingId(null);
    }
  };

  // Button to toggle showing all analyzed-but-not-saved vs un-analyzed
  const handleTogglePending = () => {
    const existing = localStorage.getItem('visual-text-extractor-db');
    const parsed: RecordWithImage[] = existing ? JSON.parse(existing) : [];

    if (showPendingAnalyzed) {
      // Show un-analyzed data
      const unAnalyzed = parsed.filter(r => !r.analyzed);
      setRecords(unAnalyzed);
    } else {
      // Show analyzed but not saved data
      const pendingAnalyzed = parsed.filter(r => r.analyzed && !r.saved);
      setRecords(pendingAnalyzed);
    }
    setShowPendingAnalyzed(!showPendingAnalyzed);
  };

  const handleNavigate = (page: 'HOME' | 'SCAN' | 'SETTINGS') => {
    if (page === 'HOME') navigate('/');
    if (page === 'SCAN') navigate('/scan');
    if (page === 'SETTINGS') navigate('/settings');
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content p-4 sm:p-6">
      <HeaderNavigation appState="RESULT" isSettingsOpen={isSettingsOpen} onNavigate={handleNavigate} />

      <main className="w-full max-w-5xl mx-auto mt-6 bg-base-200 rounded-2xl shadow-lg p-6">
        {isAnalyzing ? (
          <div className="text-center">
            <LoadingSpinner text={`Analyzing image ${currentIndex + 1} of ${totalToAnalyze}`} />
            <progress className="progress progress-primary w-full mt-4" value={progress} max="100" />
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {showPendingAnalyzed ? 'Pending Analyzed Data (Not Saved)' : 'Data Pending Analysis'}
              </h2>

              <button
                onClick={handleTogglePending}
                className="btn btn-sm btn-outline"
                aria-label="Toggle data view"
              >
                {showPendingAnalyzed ? 'Show Un-analyzed Data' : 'Show Pending Analyzed Data'}
              </button>
            </div>

            {records.length === 0 ? (
              <p className="text-center text-gray-500 font-semibold mt-10">No records to display.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className={`rounded-lg p-4 shadow border ${
                      record.saved
                        ? 'border-green-400 bg-green-100 text-green-900'
                        : record.analyzed
                        ? 'border-yellow-400 bg-yellow-50 text-yellow-900'
                        : 'border-gray-300 bg-white text-black'
                    }`}
                  >
                    <img
                      src={record.imageSrc}
                      alt="Captured"
                      className="max-h-40 mb-4 rounded border"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {DEFAULT_CONFIG.filter(c => c.visible).map((col) => (
                        <div key={col.key}>
                          <label className="block font-semibold text-sm mb-1">
                            {col.header}
                          </label>
                          <input
                            type="text"
                            value={record[col.key] || ''}
                            onChange={(e) =>
                              handleInputChange(record.id, col.key, e.target.value)
                            }
                            className={`input input-bordered w-full placeholder-gray-400 ${
                              record.saved ? 'bg-green-100 text-green-900' : ''
                            }`}
                            placeholder={`Enter ${col.header}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 text-right">
                      <button
                        onClick={() => handleSaveToSupabase(record)}
                        disabled={savingId === record.id || record.saved}
                        className={`py-2 px-5 rounded-md font-semibold text-white transition ${
                          record.saved
                            ? 'bg-green-600 cursor-default opacity-70'
                            : savingId === record.id
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-teal-600 hover:bg-teal-700'
                        }`}
                      >
                        {record.saved ? 'Saved' : savingId === record.id ? 'Saving...' : 'Save to Supabase'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
