import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './page/HomePage';
import SupabaseContactsPage from './page/SupabaseContactsPage';
import ScanPage from './page/ScanPage';
import ScanPost from './page/ScanPost'; // ✅ NEW IMPORT
import BatchAnalyzePage from './page/BatchAnalyzePage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/supabase-contacts" element={<SupabaseContactsPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/scan-post" element={<ScanPost />} /> {/* ✅ NEW ROUTE */}
        <Route path="/batch-analyze" element={<BatchAnalyzePage />} />
      </Routes>
    </Router>
  );
}