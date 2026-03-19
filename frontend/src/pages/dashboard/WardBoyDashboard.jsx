import React from 'react';
import { Truck, Users, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function WardBoyDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.username || 'Ward Boy'}</h1>
          <p className="text-indigo-50 opacity-90">Ward Assistance & Transport. Manage patient transport requests and emergency assistance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Pending Transfers</p>
              <h3 className="text-2xl font-bold text-slate-800">4</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Active Emergencies</p>
              <h3 className="text-2xl font-bold text-slate-800">0</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <Users size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Completed Duties</p>
              <h3 className="text-2xl font-bold text-slate-800">14</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-96 flex flex-col items-center justify-center text-slate-500">
          <Truck size={48} className="text-indigo-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Live Transport Requests</h2>
          <p className="max-w-md text-center text-sm mt-2">
            Real-time live assignment tracking and transport logging is coming soon.
          </p>
        </div>

      </div>
    </div>
  );
}
