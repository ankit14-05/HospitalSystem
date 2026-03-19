import React from 'react';
import { PhoneCall, Calendar, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-purple-500 to-fuchsia-600 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.username || 'Receptionist'}</h1>
          <p className="text-purple-50 opacity-90">Front Desk & Scheduling. Assist patients, confirm walk-ins, and manage enquiries.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
              <Users size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Walk-ins Today</p>
              <h3 className="text-2xl font-bold text-slate-800">45</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <PhoneCall size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Pending Enquiries</p>
              <h3 className="text-2xl font-bold text-slate-800">8</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Appointments Booked</p>
              <h3 className="text-2xl font-bold text-slate-800">112</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-96 flex flex-col items-center justify-center text-slate-500">
          <Users size={48} className="text-purple-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Visitor & Call Log</h2>
          <p className="max-w-md text-center text-sm mt-2">
            Centralized visitor logging and quick appointment booking interface is coming soon.
          </p>
        </div>

      </div>
    </div>
  );
}
