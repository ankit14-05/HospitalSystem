// src/pages/dashboard/DashboardPage.jsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users, BedDouble, ClipboardList, CreditCard,
  TrendingUp, Activity, AlertCircle, CheckCircle2,
} from 'lucide-react';

const STATS = [
  { label: 'Total Patients', value: '1,284', change: '+12%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Beds Occupied', value: '47/80', change: '59%', icon: BedDouble, color: 'text-purple-600', bg: 'bg-purple-50' },
  { label: "Today's Appointments", value: '32', change: '+5 vs yesterday', icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-50' },
  { label: 'Pending Bills', value: '₹2.4L', change: '18 invoices', icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-50' },
];

const RECENT = [
  { name: 'Priya Sharma', action: 'New OPD Appointment', time: '5 min ago', status: 'success' },
  { name: 'Ramesh Patel', action: 'Discharge — Ward B', time: '22 min ago', status: 'info' },
  { name: 'Anita Desai', action: 'Lab Report Ready', time: '1 hr ago', status: 'warning' },
  { name: 'Karan Mehta', action: 'Bill Generated ₹8,400', time: '2 hr ago', status: 'success' },
  { name: 'Sunita Rao', action: 'Prescription Issued', time: '3 hr ago', status: 'info' },
];

function StatCard({ label, value, change, icon: Icon, color, bg }) {
  return (
    <div className="card hover:shadow-card-hover transition-shadow">
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{change}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
            <Icon size={20} className={color} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, roleLabel } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">
          Good morning, {user?.firstName} 👋
        </h1>
        <p className="page-subtitle">{roleLabel} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent activity */}
        <div className="xl:col-span-2 card">
          <div className="card-header">
            <div>
              <h3 className="font-semibold text-slate-700">Recent Activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest hospital events</p>
            </div>
            <Activity size={16} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-50">
            {RECENT.map((item, i) => (
              <div key={i} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  item.status === 'success' ? 'bg-green-400' :
                  item.status === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 truncate">{item.action}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats panel */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="font-semibold text-slate-700">Today's Summary</h3>
              <p className="text-xs text-slate-400 mt-0.5">Key metrics at a glance</p>
            </div>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <div className="card-body space-y-4">
            {[
              { label: 'OPD Consultations', val: 28, total: 32, color: 'bg-blue-500' },
              { label: 'Lab Tests Completed', val: 15, total: 22, color: 'bg-green-500' },
              { label: 'Surgeries Scheduled', val: 4, total: 5, color: 'bg-purple-500' },
              { label: 'Beds Occupied', val: 47, total: 80, color: 'bg-orange-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-600 font-medium">{item.label}</span>
                  <span className="text-slate-500 font-semibold">{item.val}/{item.total}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all`}
                    style={{ width: `${(item.val / item.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-slate-600">All systems operational</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle size={14} className="text-yellow-500" />
                <span className="text-slate-600">3 lab reports pending review</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
