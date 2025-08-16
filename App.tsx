// App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './page/HomePage';
import SupabaseContactsPage from './page/SupabaseContactsPage';
import ScanPage from './page/ScanPage';
import BatchAnalyzePage from './page/BatchAnalyzePage'; // ✅ NEW IMPORT

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/supabase-contacts" element={<SupabaseContactsPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/batch-analyze" element={<BatchAnalyzePage />} /> {/* ✅ NEW ROUTE */}
      </Routes>
    </Router>
  );
}
