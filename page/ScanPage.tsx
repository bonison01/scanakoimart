// pages/ScanPage.tsx
import React, { useState, useCallback } from 'react';
import { WebcamCapture } from '../components/WebcamCapture';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { DataForm } from '../components/DataForm';
import { SparklesIcon, ArrowUturnLeftIcon } from '../components/Icons';
import { extractDataFromImage } from '../services/geminiService';
import { ColumnConfig, ExtractedData } from '../types';
import { useNavigate } from 'react-router-dom';
import { HeaderNavigation } from '../components/HeaderNavigation';

type AppState = 'CAPTURING' | 'PREVIEW' | 'SAVED' | 'ANALYZING' | 'RESULT' | 'ERROR';

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

export default function ScanPage() {
  const navigate = useNavigate();

  const [appState, setAppState] = useState<AppState>('CAPTURING');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnConfig] = useState<ColumnConfig[]>(DEFAULT_CONFIG);
  const [isSettingsOpen] = useState(false);

  const handlePhotoTaken = (imageDataUrl: string) => {
    setImageSrc(imageDataUrl);
    setAppState('PREVIEW');
  };

  const savePhotoToDB = () => {
    if (!imageSrc) return;

    const existing = localStorage.getItem('visual-text-extractor-db');
    const parsed = existing ? JSON.parse(existing) : [];

    const newRecord = {
      id: Date.now().toString(),
      imageSrc: imageSrc,
      analyzed: false,
      dateAdded: new Date().toISOString(), // Always ISO string here
    };

    localStorage.setItem('visual-text-extractor-db', JSON.stringify([...parsed, newRecord]));
    setAppState('SAVED');
  };

  const retake = () => {
    setAppState('CAPTURING');
    setImageSrc(null);
    setExtractedData(null);
    setError(null);
  };

  const retryAnalysis = () => {
    setAppState('PREVIEW');
    setError(null);
  };

  const handleAnalyze = useCallback(async () => {
    if (!imageSrc) {
      setError('No image available to analyze.');
      setAppState('ERROR');
      return;
    }

    setAppState('ANALYZING');
    setError(null);
    setExtractedData(null);

    try {
      const base64Data = imageSrc.split(',')[1];
      if (!base64Data) throw new Error('Invalid image data URL.');

      const data = await extractDataFromImage(base64Data, columnConfig);

      setExtractedData(data);
      setAppState('RESULT');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to analyze image. ${message}`);
      setAppState('ERROR');
    }
  }, [imageSrc, columnConfig]);

  const handleSaveExtractedData = (data: ExtractedData) => {
    if (!imageSrc) {
      setError('No image to save.');
      return;
    }

    // Ensure dateAdded is ISO string (if user edited or changed)
    let dateAddedIso = data.dateAdded;
    try {
      const d = new Date(data.dateAdded);
      if (!isNaN(d.getTime())) {
        dateAddedIso = d.toISOString();
      } else {
        dateAddedIso = new Date().toISOString();
      }
    } catch {
      dateAddedIso = new Date().toISOString();
    }

    const newRecord = {
      ...data,
      id: Date.now().toString(),
      dateAdded: dateAddedIso,
      imageSrc,
      analyzed: true,
    };

    const existing = localStorage.getItem('visual-text-extractor-db');
    const parsed = existing ? JSON.parse(existing) : [];

    // Remove previous un-analyzed version (optional)
    const filtered = parsed.filter((item: any) => item.imageSrc !== imageSrc);

    localStorage.setItem('visual-text-extractor-db', JSON.stringify([...filtered, newRecord]));

    navigate('/');
  };

  const handleNavigate = (page: 'HOME' | 'SCAN' | 'SETTINGS') => {
    if (page === 'HOME') {
      navigate('/');
    } else if (page === 'SCAN') {
      setAppState('CAPTURING');
      navigate('/scan');
    } else if (page === 'SETTINGS') {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content flex flex-col items-center p-4 sm:p-6">
      <HeaderNavigation appState={appState} isSettingsOpen={isSettingsOpen} onNavigate={handleNavigate} />

      <main className="w-full max-w-3xl bg-base-200 rounded-2xl shadow-xl p-6 sm:p-8 flex items-center justify-center min-h-[400px]">
        {appState === 'CAPTURING' && <WebcamCapture onPhotoTaken={handlePhotoTaken} />}

        {(appState === 'PREVIEW' || appState === 'SAVED') && (
          <div className="w-full flex flex-col items-center">
            {imageSrc && (
              <img
                src={imageSrc}
                alt="Captured"
                className="rounded-lg shadow-2xl mb-6 border-4 border-base-300 max-h-[400px] object-contain"
              />
            )}

            {appState === 'PREVIEW' && (
              <div className="flex space-x-4">
                <button
                  onClick={retake}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center"
                >
                  <ArrowUturnLeftIcon className="w-5 h-5 mr-2" />
                  Retake
                </button>

                <button
                  onClick={savePhotoToDB}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Save Photo to DB
                </button>
              </div>
            )}

            {appState === 'SAVED' && (
              <div className="text-center">
                <p className="text-green-600 font-semibold mb-4">Photo saved to DB successfully!</p>
                <button
                  onClick={retake}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Capture Another
                </button>
              </div>
            )}
          </div>
        )}

        {appState === 'ANALYZING' && <LoadingSpinner text="Analyzing image..." />}

        {appState === 'ERROR' && error && <ErrorDisplay message={error} onRetry={retryAnalysis} />}

        {appState === 'RESULT' && extractedData && (
          <DataForm
            initialData={extractedData}
            onSave={handleSaveExtractedData}
            onDiscard={retake}
            isEditing={false}
            isAuthed={false}
            isSavingToSheet={false}
            isSheetReady={false}
            onSaveToSheet={async () => {}}
            isSheetSaveSuccess={false}
            sheetError={null}
            columnConfig={columnConfig}
          />
        )}
      </main>

      <footer className="text-center mt-8 text-gray-500 text-sm">
        <p>Powered by Google</p>
      </footer>
    </div>
  );
}
