import React from 'react';
import { Sparkles, ClipboardCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function HousekeepingDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.username || 'Housekeeping'}</h1>
          <p className="text-pink-50 opacity-90">Sanitation & Cleanliness. Manage ongoing cleaning requests and room preparations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center text-pink-500">
              <Sparkles size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Rooms to Clean</p>
              <h3 className="text-2xl font-bold text-slate-800">12</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <Trash2 size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Bio-waste Clearance</p>
              <h3 className="text-2xl font-bold text-slate-800">Pending</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Tasks Completed</p>
              <h3 className="text-2xl font-bold text-slate-800">28</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-96 flex flex-col items-center justify-center text-slate-500">
          <Sparkles size={48} className="text-pink-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Cleaning Duty Roster</h2>
          <p className="max-w-md text-center text-sm mt-2">
            Discharge room notifications and live cleaning schedules are coming soon.
          </p>
        </div>

      </div>
    </div>
  );
}
