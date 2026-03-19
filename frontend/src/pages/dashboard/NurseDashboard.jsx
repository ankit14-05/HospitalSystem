import React from 'react';
import { Stethoscope, HeartPulse, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function NurseDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.username || 'Nurse'}</h1>
          <p className="text-teal-50 opacity-90">Nursing & Ward Management. Monitor patient vitals, medication schedules, and ward capacity.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-500">
              <HeartPulse size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Critical Patients</p>
              <h3 className="text-2xl font-bold text-slate-800">2</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Vitals Check Due</p>
              <h3 className="text-2xl font-bold text-slate-800">12</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Stethoscope size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Assigned Wards</p>
              <h3 className="text-2xl font-bold text-slate-800">A, C</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-96 flex flex-col items-center justify-center text-slate-500">
          <Stethoscope size={48} className="text-teal-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Patient Ward List</h2>
          <p className="max-w-md text-center text-sm mt-2">
            Medication tracking and real-time patient charts integration is coming soon. 
          </p>
        </div>

      </div>
    </div>
  );
}
