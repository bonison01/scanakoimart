// components/HeaderNavigation.tsx
import React from 'react';
import { Link } from 'react-router-dom';

type HeaderNavigationProps = {
  appState: string;
  isSettingsOpen: boolean;
  onNavigate: (page: 'HOME' | 'SCAN' | 'SETTINGS') => void;
};

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({
  appState,
  isSettingsOpen,
  onNavigate,
}) => {
  return (
    <header className="text-center mb-8 w-full max-w-4xl">
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-light">
        Mateng Delivery
      </h1>
      <p className="mt-2 text-lg text-gray-400">Scan a business card. We'll do the rest.</p>
      <nav className="mt-6 flex justify-center space-x-6 flex-wrap">
        <Link
          to="/"
          className="font-semibold py-2 px-4 rounded text-gray-500 hover:text-brand-primary"
        >
          Home
        </Link>

        {/* Replaced the old Scan button with a Link */}
        <Link
          to="/scan"
          className={`font-semibold py-2 px-4 rounded ${
            appState === 'CAPTURING'
              ? 'bg-brand-primary text-white'
              : 'text-gray-500 hover:text-brand-primary'
          }`}
        >
          Scan
        </Link>

        {/* ✅ ADDED Scan Post Link */}
        <Link
          to="/scan-post"
          className="font-semibold py-2 px-4 rounded text-gray-500 hover:text-brand-primary"
        >
          Scan Post
        </Link>

        {/* Added Batch Analyze Link */}
        <Link
          to="/batch-analyze"
          className="font-semibold py-2 px-4 rounded text-gray-500 hover:text-brand-primary"
        >
          Batch Analyze
        </Link>

        {/* Added Supabase Contacts Link */}
        <Link
          to="/supabase-contacts"
          className="font-semibold py-2 px-4 rounded text-gray-500 hover:text-brand-primary"
        >
          Order List
        </Link>
      </nav>
    </header>
  );
};