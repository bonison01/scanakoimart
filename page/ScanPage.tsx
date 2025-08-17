// pages/ScanPage.tsx
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { WebcamCapture } from '../components/WebcamCapture';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { DataForm } from '../components/DataForm';
import { SparklesIcon, ArrowUturnLeftIcon } from '../components/Icons';

import { extractDataFromImage } from '../services/geminiService';
import { ColumnConfig, ExtractedData } from '../types';
import { HeaderNavigation } from '../components/HeaderNavigation';

type AppState =
  | 'CAPTURING'
  | 'PREVIEW'
  | 'SAVED'
  | 'ANALYZING'
  | 'RESULT'
  | 'ERROR'
  | 'BATCH_PREVIEW'
  | 'BATCH_RESULT';

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

  // Single image state
  const [appState, setAppState] = useState<AppState>('CAPTURING');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Batch upload state
  const [batchImages, setBatchImages] = useState<string[]>([]);
  const [batchExtractedData, setBatchExtractedData] = useState<ExtractedData[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0);

  const [columnConfig] = useState<ColumnConfig[]>(DEFAULT_CONFIG);
  const [isSettingsOpen] = useState(false);

  // === Single image handlers ===

  const handlePhotoTaken = (imageDataUrl: string) => {
    setImageSrc(imageDataUrl);
    setAppState('PREVIEW');
  };

  // Support batch upload from files input
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      // Single file upload
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImageSrc(result);
        setAppState('PREVIEW');
      };
      reader.readAsDataURL(file);
    } else {
      // Multiple files - batch mode
      const newImages: string[] = [];
      let loadedCount = 0;
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          newImages.push(result);
          loadedCount++;
          if (loadedCount === files.length) {
            // All images loaded
            setBatchImages(newImages);
            setCurrentBatchIndex(0);
            setBatchExtractedData([]);
            setAppState('BATCH_PREVIEW');
          }
        };
        reader.readAsDataURL(files[i]);
      }
    }
  };

  const savePhotoToDB = () => {
    if (!imageSrc) return;

    const existing = localStorage.getItem('visual-text-extractor-db');
    const parsed = existing ? JSON.parse(existing) : [];

    const newRecord = {
      id: Date.now().toString(),
      imageSrc: imageSrc,
      analyzed: false,
      dateAdded: new Date().toISOString(),
    };

    localStorage.setItem('visual-text-extractor-db', JSON.stringify([...parsed, newRecord]));
    setAppState('SAVED');
  };

  const retake = () => {
    setAppState('CAPTURING');
    setImageSrc(null);
    setExtractedData(null);
    setError(null);

    // Reset batch upload states too
    setBatchImages([]);
    setBatchExtractedData([]);
    setCurrentBatchIndex(0);
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

    let dateAddedIso = data.dateAdded;
    try {
      const d = new Date(data.dateAdded);
      dateAddedIso = !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
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

    // Remove previous record with same imageSrc (if any)
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

  // === Batch upload handlers ===

  // Analyze the current batch image (async)
  const analyzeBatchImage = useCallback(
    async (index: number) => {
      if (!batchImages[index]) {
        setError('No image to analyze in batch.');
        setAppState('ERROR');
        return;
      }

      setAppState('ANALYZING');
      setError(null);

      try {
        const base64Data = batchImages[index].split(',')[1];
        if (!base64Data) throw new Error('Invalid image data URL.');

        const data = await extractDataFromImage(base64Data, columnConfig);

        // Append extracted data to batchExtractedData
        setBatchExtractedData((prev) => {
          const newData = [...prev];
          newData[index] = data;
          return newData;
        });

        setAppState('BATCH_RESULT');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to analyze batch image. ${message}`);
        setAppState('ERROR');
      }
    },
    [batchImages, columnConfig]
  );


  const handleSaveAllPhotosToDB = () => {
  const existing = localStorage.getItem('visual-text-extractor-db');
  const parsed = existing ? JSON.parse(existing) : [];

  const timestamp = Date.now();

  const newRecords = batchImages.map((imgSrc, idx) => ({
    id: `${timestamp}_${idx}`,
    imageSrc: imgSrc,
    analyzed: false,
    dateAdded: new Date().toISOString(),
  }));

  // Avoid duplicates by filtering out any record with the same imageSrc
  const filtered = parsed.filter((item: any) => !batchImages.includes(item.imageSrc));

  localStorage.setItem('visual-text-extractor-db', JSON.stringify([...filtered, ...newRecords]));

  setAppState('SAVED');
};

  // On batch preview, user clicks analyze first image
  const handleBatchAnalyzeCurrent = () => {
    analyzeBatchImage(currentBatchIndex);
  };

  // Navigate through batch images
  const nextBatchImage = () => {
    if (currentBatchIndex < batchImages.length - 1) {
      setCurrentBatchIndex(currentBatchIndex + 1);
      setAppState('BATCH_PREVIEW');
      setError(null);
    }
  };

  const prevBatchImage = () => {
    if (currentBatchIndex > 0) {
      setCurrentBatchIndex(currentBatchIndex - 1);
      setAppState('BATCH_PREVIEW');
      setError(null);
    }
  };

  // Save batch extracted data all at once
  const handleSaveBatchData = () => {
  const existing = localStorage.getItem('visual-text-extractor-db');
  const parsed = existing ? JSON.parse(existing) : [];

  const newRecords = batchExtractedData.map((data, idx) => {
    let dateAddedIso = data.dateAdded;
    try {
      const d = new Date(data.dateAdded);
      dateAddedIso = !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
    } catch {
      dateAddedIso = new Date().toISOString();
    }

    return {
      ...data,
      id: Date.now().toString() + '_' + idx,
      dateAdded: dateAddedIso,
      imageSrc: batchImages[idx],
      analyzed: true,
    };
  });

  const filtered = parsed.filter(
    (item: any) => !batchImages.includes(item.imageSrc)
  );

  localStorage.setItem('visual-text-extractor-db', JSON.stringify([...filtered, ...newRecords]));

  navigate('/');
};


  return (
    <div className="min-h-screen bg-base-100 text-base-content flex flex-col items-center p-4 sm:p-6">
      <HeaderNavigation appState={appState} isSettingsOpen={isSettingsOpen} onNavigate={handleNavigate} />

      <main className="w-full max-w-3xl bg-base-200 rounded-2xl shadow-xl p-6 sm:p-8 flex items-center justify-center min-h-[400px]">
        {appState === 'CAPTURING' && (
          <div className="flex flex-col items-center space-y-6 w-full">
            <WebcamCapture onPhotoTaken={handlePhotoTaken} />
            <div className="flex flex-col items-center">
              <label
                htmlFor="file-upload"
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Upload Image(s)
              </label>
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        )}

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

                <button
                  onClick={handleAnalyze}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Analyze Image
                  <SparklesIcon className="inline-block w-5 h-5 ml-2" />
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

        {/* Batch preview */}
        {(appState === 'BATCH_PREVIEW' || appState === 'BATCH_RESULT') && batchImages.length > 0 && (
          <div className="w-full flex flex-col items-center">
            <img
              src={batchImages[currentBatchIndex]}
              alt={`Batch image ${currentBatchIndex + 1}`}
              className="rounded-lg shadow-2xl mb-6 border-4 border-base-300 max-h-[400px] object-contain"
            />

            <div className="flex justify-between w-full max-w-md mb-4">
              <button
                onClick={prevBatchImage}
                disabled={currentBatchIndex === 0}
                className="bg-gray-600 disabled:bg-gray-400 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Previous
              </button>
              <button
                onClick={nextBatchImage}
                disabled={currentBatchIndex === batchImages.length - 1}
                className="bg-gray-600 disabled:bg-gray-400 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>

            {appState === 'BATCH_PREVIEW' && batchImages.length > 0 && (
  <button
    onClick={handleSaveAllPhotosToDB}
    className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
  >
    Save All Photos to DB
  </button>
)}


            {appState === 'BATCH_RESULT' && batchExtractedData[currentBatchIndex] && (
              <DataForm
                initialData={batchExtractedData[currentBatchIndex]}
                onSave={(data) => {
                  // Update extracted data for current batch index
                  setBatchExtractedData((prev) => {
                    const copy = [...prev];
                    copy[currentBatchIndex] = data;
                    return copy;
                  });
                }}
                onDiscard={() => {
                  // Discard current extraction, return to preview
                  setAppState('BATCH_PREVIEW');
                }}
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

            {batchExtractedData.length === batchImages.length && batchExtractedData.every(Boolean) && (
  <button
    onClick={handleSaveBatchData}
    className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
  >
    Save All Extracted Data
  </button>
)}

          </div>
        )}
      </main>

      <footer className="text-center mt-8 text-gray-500 text-sm">
        <p>Powered by Google</p>
      </footer>
    </div>
  );
}
