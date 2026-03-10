// src/pages/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-primary-700 flex items-center justify-center mx-auto mb-6">
          <Activity size={24} className="text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-6xl font-black text-slate-200 mb-2">404</h1>
        <h2 className="text-xl font-bold text-slate-700 mb-2">Page not found</h2>
        <p className="text-slate-500 text-sm mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/dashboard" className="btn-primary inline-flex">
          <Home size={15} />Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
