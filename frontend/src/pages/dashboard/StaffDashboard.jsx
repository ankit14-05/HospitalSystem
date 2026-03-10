// src/pages/dashboard/StaffDashboard.jsx
import React, { useState } from 'react';
import { Bed, ClipboardList, Users, Bell, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS = { nurse:'Nurse', receptionist:'Receptionist', pharmacist:'Pharmacist', labtech:'Lab Technician' };
const today = new Date();

const MOCK_TASKS = [
  { id:1, task:'Administer IV drip — Room 204', priority:'high',   done:false, time:'10:00' },
  { id:2, task:'Check vitals — Room 208',        priority:'medium', done:false, time:'10:30' },
  { id:3, task:'Patient discharge — Room 212',   priority:'low',    done:true,  time:'09:00' },
  { id:4, task:'Blood sample collection — Ward B',priority:'high',  done:false, time:'11:00' },
  { id:5, task:'Medication round — Ward A',       priority:'medium', done:false, time:'12:00' },
];

const MOCK_BEDS = [
  { bed:'101', patient:'Rahul Sharma',  status:'occupied',  condition:'Stable' },
  { bed:'102', patient:'Priya Patel',   status:'occupied',  condition:'Critical' },
  { bed:'103', patient:null,            status:'available', condition:null },
  { bed:'104', patient:'Vikram Singh',  status:'occupied',  condition:'Stable' },
  { bed:'105', patient:null,            status:'cleaning',  condition:null },
  { bed:'106', patient:'Anjali Mehta',  status:'occupied',  condition:'Recovering' },
];

const BED_COLORS = { occupied:'bg-red-100 text-red-700', available:'bg-green-100 text-green-700', cleaning:'bg-yellow-100 text-yellow-700' };
const CONDITION_COLORS = { Critical:'text-red-600 font-semibold', Stable:'text-green-600', Recovering:'text-blue-600' };
const PRIORITY_COLORS = { high:'border-l-red-400', medium:'border-l-yellow-400', low:'border-l-slate-200' };

export default function StaffDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const roleLabel = ROLE_LABELS[user?.role] || 'Staff';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const shift = hour < 14 ? 'Morning Shift (8AM – 2PM)' : hour < 20 ? 'Evening Shift (2PM – 8PM)' : 'Night Shift (8PM – 8AM)';

  const toggleTask = (id) => setTasks(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName || roleLabel} 👋</h1>
          <p className="page-subtitle">{today.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
          <Clock size={14} className="text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">{shift}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Bed,          label: 'Occupied Beds',     value: MOCK_BEDS.filter(b => b.status === 'occupied').length,  color: 'bg-red-500' },
          { icon: Users,        label: 'Patients in Ward',  value: MOCK_BEDS.filter(b => b.status === 'occupied').length,  color: 'bg-primary-600' },
          { icon: ClipboardList,label: 'Tasks Pending',     value: tasks.filter(t => !t.done).length,                      color: 'bg-yellow-500' },
          { icon: CheckCircle,  label: 'Tasks Completed',   value: tasks.filter(t => t.done).length,                       color: 'bg-green-500' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon size={20} className="text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task list */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <ClipboardList size={15} />My Tasks Today
            </h3>
            <span className="text-xs text-slate-400">{tasks.filter(t => !t.done).length} pending</span>
          </div>
          <div className="divide-y divide-slate-50">
            {tasks.map(t => (
              <div key={t.id} className={`flex items-center gap-3 px-6 py-3.5 border-l-4 ${PRIORITY_COLORS[t.priority]} ${t.done ? 'opacity-50' : ''}`}>
                <button onClick={() => toggleTask(t.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${t.done ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-400'}`}>
                  {t.done && <CheckCircle size={12} className="text-white" />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm ${t.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.task}</p>
                  <p className="text-xs text-slate-400">{t.time}</p>
                </div>
                {t.priority === 'high' && !t.done && <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Bed status */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Bed size={15} />Bed Status — Ward A
            </h3>
          </div>
          <div className="card-body p-0">
            <div className="grid grid-cols-1 divide-y divide-slate-50">
              {MOCK_BEDS.map(b => (
                <div key={b.bed} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm flex-shrink-0">
                    {b.bed}
                  </div>
                  <div className="flex-1">
                    {b.patient
                      ? <>
                          <p className="text-sm font-medium text-slate-700">{b.patient}</p>
                          <p className={`text-xs ${CONDITION_COLORS[b.condition]}`}>{b.condition}</p>
                        </>
                      : <p className="text-sm text-slate-400 italic">{b.status === 'cleaning' ? 'Being cleaned' : 'Available'}</p>
                    }
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${BED_COLORS[b.status]}`}>
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
