import React from 'react';
import { Microscope, Activity, Droplet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LabTechnicianDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.username || 'Lab Technician'}</h1>
          <p className="text-cyan-50 opacity-90">Laboratory & Sample Processing. Manage samples, tests, and upload results.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-500">
              <Droplet size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Samples to Collect</p>
              <h3 className="text-2xl font-bold text-slate-800">22</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <Microscope size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Tests in Progress</p>
              <h3 className="text-2xl font-bold text-slate-800">14</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Results Uploaded</p>
              <h3 className="text-2xl font-bold text-slate-800">38</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-96 flex flex-col items-center justify-center text-slate-500">
          <Microscope size={48} className="text-cyan-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Lab Reports Queue</h2>
          <p className="max-w-md text-center text-sm mt-2">
            Barcode scanning integration for samples and automated report dispatch coming soon.
          </p>
        </div>

      </div>
    </div>
  );
}
