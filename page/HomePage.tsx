import React, { useState, useCallback, useEffect } from 'react';
import { WebcamCapture } from '../components/WebcamCapture';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { DataForm } from '../components/DataForm';
import { DataTable } from '../components/DataTable';
import { SettingsDashboard } from '../components/SettingsDashboard';
import { extractDataFromImage } from '../services/geminiService';
import { ColumnConfig, ExtractedData } from '../types';
import { CameraIcon, SparklesIcon, ArrowUturnLeftIcon, CogIcon } from '../components/Icons';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { useNavigate } from 'react-router-dom';

import { HeaderNavigation } from '../components/HeaderNavigation';

type AppState = 'IDLE' | 'CAPTURING' | 'PREVIEW' | 'ANALYZING' | 'RESULT' | 'ERROR' | 'EDITING';
const DB_KEY = 'visual-text-extractor-db';
const CONFIG_KEY = 'visual-text-extractor-config';

const DEFAULT_CONFIG: ColumnConfig[] = [
  { key: 'name', header: 'Name', visible: true },
  { key: 'company', header: 'Company', visible: true },
  { key: 'email', header: 'Email', visible: true },
  { key: 'phone', header: 'Phone', visible: true },
  { key: 'dateAdded', header: 'Date Added', visible: true },
  { key: 'address', header: 'Address', visible: false },
];

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editingRecord, setEditingRecord] = useState<ExtractedData | null>(null);
  const [savedRecords, setSavedRecords] = useState<ExtractedData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const navigate = useNavigate();

  const {
    isReady: isSheetReady,
    isAuthed,
    isSaving: isSavingToSheet,
    error: sheetError,
    saveSuccess,
    saveContact: saveContactToSheet,
  } = useGoogleDrive();

  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(() => {
    try {
      const storedConfig = localStorage.getItem(CONFIG_KEY);
      return storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  useEffect(() => {
    try {
      const storedRecords = localStorage.getItem(DB_KEY);
      setSavedRecords(storedRecords ? JSON.parse(storedRecords) : []);
    } catch {
      setSavedRecords([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DB_KEY, JSON.stringify(savedRecords));
  }, [savedRecords]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(columnConfig));
  }, [columnConfig]);

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

  const handleSave = (data: ExtractedData) => {
    const newRecord = {
      ...data,
      id: Date.now().toString(),
      dateAdded: new Date().toLocaleString(),
    };
    setSavedRecords((prev) => [...prev, newRecord]);
    reset();
  };

  const handleUpdate = (data: ExtractedData) => {
    const updatedRecord = {
      ...data,
      dateAdded: new Date().toLocaleString(),
    };
    setSavedRecords((prev) => prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)));
    reset();
  };

  const handleSaveToSheet = useCallback(
    async (data: ExtractedData) => {
      await saveContactToSheet(data, columnConfig.filter((c) => c.key !== 'id'));
    },
    [saveContactToSheet, columnConfig]
  );

  const handleStartEdit = (record: ExtractedData) => {
    setEditingRecord(record);
    setAppState('EDITING');
  };

  const handleDeleteRecord = (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      setSavedRecords((prev) => prev.filter((r) => r.id !== recordId));
    }
  };

  const handleClearDb = () => {
    if (window.confirm('Are you sure you want to delete all saved contacts?')) {
      setSavedRecords([]);
    }
  };

  const reset = () => {
    setAppState('IDLE');
    setImageSrc(null);
    setExtractedData(null);
    setEditingRecord(null);
    setError(null);
  };

  const retake = () => {
    setAppState('CAPTURING');
    setImageSrc(null);
    setExtractedData(null);
    setError(null);
  };

  const handlePhotoTaken = (imageDataUrl: string) => {
    setImageSrc(imageDataUrl);
    setAppState('PREVIEW');
  };

  const retryAnalysis = () => {
    setAppState('PREVIEW');
    setError(null);
  };

  const navigateTo = (page: 'HOME' | 'SCAN' | 'SETTINGS') => {
    setError(null);
    if (page === 'HOME') {
      setAppState('IDLE');
      setIsSettingsOpen(false);
    } 
    else if (page === 'SCAN') {
      setAppState('CAPTURING');
      setIsSettingsOpen(false);
    } 
    // else if (page === 'SETTINGS') {
    //   setIsSettingsOpen(true);
    // }
  };

  const renderContent = () => {
    const dataFormProps = {
      columnConfig,
      onSaveToSheet: handleSaveToSheet,
      isSheetReady,
      isAuthed,
      isSavingToSheet,
      isSheetSaveSuccess: saveSuccess,
      sheetError,
    };

    switch (appState) {
      case 'IDLE':
        return (
          <div className="text-center w-full flex flex-col items-center">
            <DataTable
              records={savedRecords}
              onClear={handleClearDb}
              columnConfig={columnConfig}
              onEdit={handleStartEdit}
              onDelete={handleDeleteRecord}
            />
            <div className="flex items-center space-x-4 mx-auto mt-8">
              {/* <button
                onClick={() => navigateTo('SETTINGS')}
                className="bg-base-300 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center"
              >
                <CogIcon className="w-6 h-6 mr-2" />
                Customize
              </button> */}
              <button
      onClick={() => navigate('/scan')}
      className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center"
    >
      <CameraIcon className="w-6 h-6 mr-2" />
      Scan New Contact
    </button>
            </div>
          </div>
        );

      case 'CAPTURING':
        return <WebcamCapture onPhotoTaken={handlePhotoTaken} />;

      case 'PREVIEW':
      case 'ANALYZING':
      case 'ERROR':
        return (
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
            {imageSrc && (
              <img src={imageSrc} alt="Captured" className="rounded-lg shadow-2xl mb-6 border-4 border-base-300" />
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
                  onClick={handleAnalyze}
                  className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center"
                >
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  Analyze Image
                </button>
              </div>
            )}
            {appState === 'ANALYZING' && <LoadingSpinner text="Analyzing image, please wait..." />}
            {appState === 'ERROR' && error && <ErrorDisplay message={error} onRetry={retryAnalysis} />}
          </div>
        );

      case 'RESULT':
        return extractedData && (
          <DataForm
            {...dataFormProps}
            initialData={extractedData}
            onSave={handleSave}
            onDiscard={retake}
            isEditing={false}
          />
        );

      case 'EDITING':
        return editingRecord && (
          <DataForm
            {...dataFormProps}
            initialData={editingRecord}
            onSave={handleUpdate}
            onDiscard={reset}
            isEditing={true}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content flex flex-col items-center p-4 sm:p-6">
      <HeaderNavigation appState={appState} isSettingsOpen={isSettingsOpen} onNavigate={navigateTo} />

      <main className="w-full max-w-4xl bg-base-200 rounded-2xl shadow-xl p-6 sm:p-8 flex items-center justify-center min-h-[400px]">
        {renderContent()}
      </main>

      <footer className="text-center mt-8 text-gray-500 text-sm">
        <p>Powered by React & Google Gemini</p>
      </footer>

      {isSettingsOpen && (
        <SettingsDashboard
          currentConfig={columnConfig}
          onClose={() => setIsSettingsOpen(false)}
          onSave={(newConfig) => {
            setColumnConfig(newConfig);
            setIsSettingsOpen(false);
            setAppState('IDLE');
          }}
        />
      )}
    </div>
  );
}
