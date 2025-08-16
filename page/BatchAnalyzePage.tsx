// pages/BatchAnalyzePage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { extractDataFromImage } from '../services/geminiService';
import { ColumnConfig, ExtractedData } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { DataForm } from '../components/DataForm';

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

type ContactRecord = {
  id: string;
  imageSrc: string;
  analyzed: boolean;
  dateAdded: string;
  // Optional extracted data
} & Partial<ExtractedData>;

export default function BatchAnalyzePage() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    // Load contacts from localStorage on mount
    const existing = localStorage.getItem('visual-text-extractor-db');
    const parsed: ContactRecord[] = existing ? JSON.parse(existing) : [];
    setContacts(parsed);
  }, []);

  const saveContacts = (updatedContacts: ContactRecord[]) => {
    setContacts(updatedContacts);
    localStorage.setItem('visual-text-extractor-db', JSON.stringify(updatedContacts));
  };

  const analyzeNext = useCallback(async () => {
    setError(null);

    // Find next un-analyzed contact
    const nextIndex = contacts.findIndex((c, i) => !c.analyzed && i >= currentIndex);
    if (nextIndex === -1) {
      setError('No more un-analyzed images to process.');
      return;
    }

    setLoading(true);
    try {
      const contact = contacts[nextIndex];
      const base64Data = contact.imageSrc.split(',')[1];
      if (!base64Data) throw new Error('Invalid image data.');

      const extracted = await extractDataFromImage(base64Data, columnConfig);

      // Update contact record
      const updatedContact = {
        ...contact,
        ...extracted,
        analyzed: true,
        dateAdded: new Date().toLocaleString(),
      };

      const updatedContacts = [...contacts];
      updatedContacts[nextIndex] = updatedContact;
      saveContacts(updatedContacts);

      setCurrentIndex(nextIndex + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during analysis.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [contacts, currentIndex, columnConfig]);

  const analyzeAll = async () => {
    while (contacts.some((c, i) => !c.analyzed && i >= currentIndex)) {
      await analyzeNext();
      // small delay could be added here if needed
    }
  };

  return (
    <div className="min-h-screen bg-base-100 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Batch Analyze Images</h1>

      {contacts.length === 0 && <p>No saved images found.</p>}

      {contacts.length > 0 && (
        <div className="max-w-3xl w-full bg-base-200 rounded-lg p-6 shadow-lg">
          {currentIndex < contacts.length ? (
            <>
              <img
                src={contacts[currentIndex].imageSrc}
                alt={`Contact ${contacts[currentIndex].id}`}
                className="rounded-lg shadow mb-4 max-h-96 object-contain mx-auto"
              />

              {contacts[currentIndex].analyzed ? (
                <DataForm
                  initialData={contacts[currentIndex]}
                  onSave={(data) => {
                    // Update saved data on manual save
                    const updatedContacts = [...contacts];
                    updatedContacts[currentIndex] = { ...updatedContacts[currentIndex], ...data };
                    saveContacts(updatedContacts);
                  }}
                  onDiscard={() => {}}
                  isEditing={false}
                  isAuthed={false}
                  isSavingToSheet={false}
                  isSheetReady={false}
                  onSaveToSheet={async () => {}}
                  isSheetSaveSuccess={false}
                  sheetError={null}
                  columnConfig={columnConfig}
                />
              ) : (
                <>
                  <button
                    onClick={analyzeNext}
                    disabled={loading}
                    className="bg-brand-primary text-white font-bold py-3 px-6 rounded-lg mb-2 w-full"
                  >
                    {loading ? 'Analyzing...' : 'Analyze This Image'}
                  </button>
                </>
              )}

              {error && (
                <div className="text-red-600 mt-2 text-center">
                  <p>{error}</p>
                </div>
              )}

              <button
                onClick={analyzeAll}
                disabled={loading}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg w-full"
              >
                Analyze All Remaining Images
              </button>
            </>
          ) : (
            <p className="text-center font-semibold">All images analyzed!</p>
          )}
        </div>
      )}
    </div>
  );
}
