import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { HeaderNavigation } from '../components/HeaderNavigation';
import '../styles/ScanPost.css';

// Define the shape of the extracted data
interface ExtractedData {
    serialNo: string;
    INV_NO: number;
    productType: string;
    customerName: string;
    address: string;
    contactNumber: number;
    bookName: string;
    OUT: number;
    No_of_Bags: string;
    Remark: string;
    Total: string;
    // remarks: string;
    // createdBy: string;
    // createdOn: string;
    // bulkReference: string;
}

// --- CONSTANTS ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GEMINI_API_KEY = process.env.API_KEY; 
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const LOADING_MESSAGES = [
    "Uploading and securing your document...",
    "Warming up the AI model...",
    "Scanning the document for text...",
    "Identifying headers and columns...",
    "Extracting individual records...",
    "Structuring the data into JSON format...",
    "Almost done, finalizing the results..."
];
const columnOrder = [
    'serialNo', 'INV_NO','Customer Name', 'Address','contactNumber', 
    'productType','weight','Number of Bags','Payment','Total'
];

// Gemini setup
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const textPart = {
    text: `From the provided document image, extract the data into a structured JSON format.
    The document contains header information (like Sender GSTIN, Customer ID) and a table of records.
    For each row in the table, create a JSON object. This object should include all the header information combined with the specific data from that row (Serial No, Article Number, etc.).
    The final output should be an array of these JSON objects, where each object represents one complete record.`
};

const responseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            serialNo: { type: Type.STRING },
            INV_NO: { type: Type.NUMBER },
            customerNumber: { type: Type.STRING },
            address: { type: Type.STRING },
            contactNumber: { type: Type.NUMBER },
            BookName: { type: Type.STRING },
            OUT: { type: Type.NUMBER },
            No_of_Bags: { type: Type.STRING },
            Remark: { type: Type.STRING },
            Total: { type: Type.STRING },
            // baseTariff: { type: Type.NUMBER },
            // remarks: { type: Type.STRING },
            // createdBy: { type: Type.STRING },
            // createdOn: { type: Type.STRING },
            // bulkReference: { type: Type.STRING }
        },
    }
};

export default function ScanPost() {
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [gSheetStatus, setGSheetStatus] = useState<string>('Status: Not Connected');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [exportResult, setExportResult] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [loaderMessage, setLoaderMessage] = useState<string>(LOADING_MESSAGES[0]);
    const [progressBarWidth, setProgressBarWidth] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tokenClient = useRef<google.accounts.oauth2.TokenClient | null>(null);
    const loadingIntervalRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<number | null>(null);

    // Placeholder state for HeaderNavigation props
    const [appState, setAppState] = useState<'CAPTURING' | 'IDLE'>('IDLE');
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const handleNavigation = (page: 'HOME' | 'SCAN' | 'SETTINGS') => {
        // Implement navigation logic here if needed
        console.log(`Navigating to ${page}`);
    };

    // Initial setup for Google APIs
    useEffect(() => {
        const gapiLoaded = () => {
            if (window.gapi) {
                window.gapi.load('client', initializeGapiClient);
            }
        };

        const gisLoaded = () => {
            if (window.google?.accounts?.oauth2) {
                tokenClient.current = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: (tokenResponse: google.accounts.oauth2.TokenResponse) => {
                        if (tokenResponse.error) {
                            setErrorMessage(`Google Auth Error: ${tokenResponse.error}`);
                            return;
                        }
                        setGSheetStatus('Status: Connected');
                    },
                });
            }
        };

        const scriptGapi = document.createElement('script');
        scriptGapi.src = "https://apis.google.com/js/api.js";
        scriptGapi.async = true;
        scriptGapi.onload = gapiLoaded;
        document.body.appendChild(scriptGapi);

        const scriptGis = document.createElement('script');
        scriptGis.src = "https://accounts.google.com/gsi/client";
        scriptGis.async = true;
        scriptGis.onload = gisLoaded;
        document.body.appendChild(scriptGis);

        return () => {
            document.body.removeChild(scriptGapi);
            document.body.removeChild(scriptGis);
        };
    }, []);

    async function initializeGapiClient() {
        if (window.gapi?.client) {
            await window.gapi.client.init({
                apiKey: GEMINI_API_KEY,
                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
            });
        }
    }
    
    // Simulates loading progress
    const setLoading = (loading: boolean) => {
        setIsLoading(loading);
        if (loading) {
            let messageIndex = 0;
            setLoaderMessage(LOADING_MESSAGES[0]);
            loadingIntervalRef.current = window.setInterval(() => {
                messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
                setLoaderMessage(LOADING_MESSAGES[messageIndex]);
            }, 2500);

            let progress = 0;
            setProgressBarWidth(0);
            progressIntervalRef.current = window.setInterval(() => {
                if (progress < 95) {
                    progress += 1;
                    setProgressBarWidth(progress);
                } else {
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                }
            }, 200);
        } else {
            if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setProgressBarWidth(100);
            setTimeout(() => {
                setProgressBarWidth(0);
            }, 500);
        }
    };

    // Handles file selection
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            setImageBase64(reader.result as string);
            setExtractedData([]);
            setErrorMessage(null);
            setExportResult(null);
        };
        reader.readAsDataURL(file);
    };

    // Handles data extraction via Gemini API
    const handleExtractData = async () => {
        if (!imageBase64 || isLoading) return;

        setLoading(true);
        setErrorMessage(null);
        setExportResult(null);
        setExtractedData([]);

        try {
            const imagePart = {
                inlineData: {
                    mimeType: imageBase64.match(/:(.*?);/)?.[1] || 'image/jpeg',
                    data: imageBase64.split(',')[1],
                },
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [textPart, imagePart] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            const data = JSON.parse(response.text);
            setExtractedData(data);
        } catch (error) {
            console.error("Error extracting data:", error);
            setErrorMessage("An error occurred while extracting data. Please check the console for details.");
        } finally {
            setLoading(false);
        }
    };

    // Initiates Google Sheets authentication
    const handleAuthClick = () => {
        if (tokenClient.current) {
            tokenClient.current.requestAccessToken({ prompt: 'consent' });
        }
    };

    // Handles exporting to a new Google Sheet
    const handleExportClick = async () => {
        if (extractedData.length === 0 || isLoading || gSheetStatus !== 'Status: Connected') return;

        setLoading(true);
        setExportResult(null);

        try {
            const createResponse = await window.gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: `Document Extraction - ${new Date().toLocaleString()}`,
                },
            });

            const spreadsheetId = createResponse.result.spreadsheetId;
            const spreadsheetUrl = createResponse.result.spreadsheetUrl;
            
            const headerRow = columnOrder.map(key => {
                const spaced = key.replace(/([A-Z])/g, ' $1');
                return spaced.charAt(0).toUpperCase() + spaced.slice(1);
            });
            const dataRows = extractedData.map(item => columnOrder.map(key => item[key as keyof ExtractedData] ?? ''));
            const values = [headerRow, ...dataRows];

            await window.gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Sheet1!A1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: values },
            });

            setExportResult({
                message: `Successfully exported! <a href="${spreadsheetUrl}" target="_blank" rel="noopener noreferrer">Open Google Sheet</a>`,
                type: 'success'
            });
        } catch (error) {
            console.error("Error exporting to Google Sheets:", error);
            const gapiError = error as any;
            setExportResult({
                message: `Export failed. ${gapiError.result?.error?.message || 'Check console for details.'}`,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // Handles downloading data as a CSV file
    const handleDownloadCsv = () => {
        if (extractedData.length === 0) return;

        const headerRow = columnOrder.map(key => {
            const spaced = key.replace(/([A-Z])/g, ' $1');
            return spaced.charAt(0).toUpperCase() + spaced.slice(1);
        });
        const dataRows = extractedData.map(item =>
            columnOrder.map(key => {
                const stringValue = item[key as keyof ExtractedData] !== undefined && item[key as keyof ExtractedData] !== null ? String(item[key as keyof ExtractedData]) : '';
                if (/[",\n]/.test(stringValue)) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',')
        );

        const csvContent = [headerRow.join(','), ...dataRows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'document-data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Handles copying data to clipboard
    const handleCopyData = async () => {
        if (extractedData.length === 0) {
            setErrorMessage("No data to copy.");
            return;
        }

        const tableText = extractedData.map(row => 
            columnOrder.map(key => row[key as keyof ExtractedData] ?? '').join('\t')
        ).join('\n');

        try {
            await navigator.clipboard.writeText(tableText);
            setExportResult({ message: 'Data copied to clipboard!', type: 'success' });
        } catch (err) {
            console.error('Failed to copy text:', err);
            setErrorMessage('Failed to copy data. Please check browser permissions.');
        }
    };

    return (
        <>
            <HeaderNavigation 
                appState={appState}
                isSettingsOpen={isSettingsOpen}
                onNavigate={handleNavigation}
            />
            <main>
                <h1>📄 Document Data Extractor</h1>
                <p>Upload a document image to automatically extract structured data.</p>
                <div className="controls">
                    <div className="file-uploader"
                        onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).classList.add('dragover'); }}
                        onDragLeave={(e) => (e.currentTarget as HTMLDivElement).classList.remove('dragover')}
                        onDrop={(e) => {
                            e.preventDefault();
                            (e.currentTarget as HTMLDivElement).classList.remove('dragover');
                            if (fileInputRef.current) {
                                fileInputRef.current.files = e.dataTransfer.files;
                                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }}
                    >
                        <label htmlFor="file-upload" id="file-label">
                            <span>Click to upload or drag & drop</span>
                            {fileInputRef.current?.files?.[0]?.name && (
                                <span className="file-name">{fileInputRef.current?.files?.[0]?.name}</span>
                            )}
                        </label>
                        <input
                            type="file"
                            id="file-upload"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                    </div>
                    <button id="extract-button" onClick={handleExtractData} disabled={isLoading || !imageBase64}>Extract Data</button>

                    <div className="g-sheet-controls">
                        <h3>Export Options</h3>
                        {/* <button id="connect-g-sheet-button" onClick={handleAuthClick} disabled={isLoading || gSheetStatus === 'Status: Connected'}>Connect to Google Sheets</button> */}
                        <p id="g-sheet-status">{gSheetStatus}</p>
                        {/* <button id="export-button" onClick={handleExportClick} disabled={isLoading || extractedData.length === 0 || gSheetStatus !== 'Status: Connected'}>Export to Sheet</button> */}
                        <button id="download-csv-button" onClick={handleDownloadCsv} disabled={isLoading || extractedData.length === 0}>Download CSV</button>
                        <button id="copy-button" onClick={handleCopyData} disabled={isLoading || extractedData.length === 0}>Copy Data</button>
                        {exportResult && (
                            <div id="export-result" className={exportResult.type} dangerouslySetInnerHTML={{ __html: exportResult.message }}></div>
                        )}
                    </div>
                </div>
                <div className="output">
                    <div className="preview-container">
                        {imageBase64 && <img id="image-preview" src={imageBase64} alt="Document preview" />}
                    </div>
                    {isLoading && (
                        <div id="loader">
                            <div className="spinner"></div>
                            <div className="progress-bar-container">
                                <div id="progress-bar" style={{ width: `${progressBarWidth}%` }}></div>
                            </div>
                            <p id="loader-percentage">{Math.round(progressBarWidth)}%</p>
                            <p id="loader-message">{loaderMessage}</p>
                        </div>
                    )}
                    {errorMessage && <p id="error-message" className="error">{errorMessage}</p>}
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    {columnOrder.map(key => {
                                        const spaced = key.replace(/([A-Z])/g, ' $1');
                                        return <th key={key}>{spaced.charAt(0).toUpperCase() + spaced.slice(1)}</th>;
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {extractedData.length > 0 ? (
                                    extractedData.map((item, index) => (
                                        <tr key={index}>
                                            {columnOrder.map(key => (
                                                <td key={key}>{item[key as keyof ExtractedData] !== undefined && item[key as keyof ExtractedData] !== null ? String(item[key as keyof ExtractedData]) : 'N/A'}</td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={columnOrder.length} style={{ textAlign: 'center' }}>
                                            {imageBase64 ? "Click 'Extract Data' to begin." : "No data to display."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </>
    );
}