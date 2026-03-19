import React from 'react';
import { Shield, Camera, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SecurityDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.username || 'Security Officer'}</h1>
          <p className="text-slate-300 opacity-90">Hospital Premises Security. Monitor access points, visitors, and emergency alerts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Camera size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Active Cameras</p>
              <h3 className="text-2xl font-bold text-slate-800">24/24</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Shield size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Logged Visitors</p>
              <h3 className="text-2xl font-bold text-slate-800">145</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Incidents Checked</p>
              <h3 className="text-2xl font-bold text-slate-800">0</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-96 flex flex-col items-center justify-center text-slate-500">
          <Shield size={48} className="text-slate-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Security Checkpoints</h2>
          <p className="max-w-md text-center text-sm mt-2">
            Integration with gate visitor logs and QR scan access control is coming soon.
          </p>
        </div>

      </div>
    </div>
  );
}
