// src/pages/dashboard/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, Bed, Activity, TrendingUp, Clock,
  CheckCircle, XCircle, AlertCircle, Building2, ArrowRight,
  Stethoscope, Briefcase
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="card">
    <div className="card-body flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">
          {value ?? <span className="text-slate-300 text-lg">—</span>}
        </p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

// ── Reusable pending approvals card ──────────────────────────────────────────
const PendingCard = ({
  title, icon: Icon, iconColor, items, loading, onApprove, onRejectNavigate,
  approving, navigatePath, badgeColor, avatarColor, avatarText,
  line1, line2, line3, meta,
}) => (
  <div className="card">
    <div className="card-header">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
        <Icon size={16} className={iconColor} />
        {title}
        {items.length > 0 && (
          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
            {items.length}
          </span>
        )}
      </h3>
      <div className="flex items-center gap-2">
        <button
          onClick={onApprove.reload}
          className="btn-ghost btn-sm">
          Refresh
        </button>
        <button
          onClick={() => onRejectNavigate(navigatePath)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
          View All <ArrowRight size={12} />
        </button>
      </div>
    </div>

    <div className="card-body p-0">
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="spinner w-6 h-6" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <CheckCircle size={32} className="mb-2 text-green-300" />
          <p className="text-sm font-medium">No pending approvals</p>
          <p className="text-xs">All {title.toLowerCase()} have been reviewed</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-50">
            {items.slice(0, 5).map(item => (
              <div key={item.Id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${avatarColor}`}>
                  {item.FirstName?.[0]}{item.LastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 text-sm">
                    {avatarText} {item.FirstName} {item.LastName}
                  </p>
                  <p className="text-xs text-slate-500">{line1(item)}</p>
                  <p className="text-xs text-slate-400">{line2(item)}</p>
                </div>
                <div className="text-xs text-slate-400 hidden md:block">
                  {meta(item)}
                  <p>{new Date(item.CreatedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => onApprove.approve(item.Id)}
                    disabled={approving === item.Id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50">
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button
                    onClick={() => onRejectNavigate(navigatePath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
          {items.length > 5 && (
            <div className="px-6 py-3 border-t border-slate-50">
              <button
                onClick={() => onRejectNavigate(navigatePath)}
                className="flex items-center gap-1.5 text-indigo-600 text-xs font-semibold hover:underline">
                +{items.length - 5} more pending — View full panel <ArrowRight size={11} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [pendingDoctors, setPendingDoctors]   = useState([]);
  const [pendingStaff,   setPendingStaff]     = useState([]);
  const [loadingDoctors, setLoadingDoctors]   = useState(true);
  const [loadingStaff,   setLoadingStaff]     = useState(true);
  const [approvingDoc,   setApprovingDoc]     = useState(null);
  const [approvingStaff, setApprovingStaff]   = useState(null);
  const [stats,          setStats]            = useState({});

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    loadPendingDoctors();
    loadPendingStaff();
    loadStats();
  }, []);

  const loadPendingDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const r = await api.get('/register/pending-doctors');
      setPendingDoctors(r.data.data || []);
    } catch {
      setPendingDoctors([]);
    }
    setLoadingDoctors(false);
  };

  const loadPendingStaff = async () => {
    setLoadingStaff(true);
    try {
      const r = await api.get('/register/pending-staff');
      setPendingStaff(r.data.data || []);
    } catch {
      setPendingStaff([]);
    }
    setLoadingStaff(false);
  };

  const loadStats = async () => {
    try {
      const r = await api.get('/users?limit=1');
      setStats(r.data.meta || {});
    } catch {}
  };

  const handleApproveDoctor = async (id) => {
    setApprovingDoc(id);
    try {
      await api.patch(`/register/approve-doctor/${id}`, { action: 'approved' });
      toast.success('Doctor approved successfully');
      setPendingDoctors(p => p.filter(d => d.Id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve doctor');
    }
    setApprovingDoc(null);
  };

  const handleApproveStaff = async (id) => {
    setApprovingStaff(id);
    try {
      await api.patch(`/register/approve-staff/${id}`, { action: 'approved' });
      toast.success('Staff member approved successfully');
      setPendingStaff(p => p.filter(s => s.Id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve staff');
    }
    setApprovingStaff(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName || 'Admin'} 👋</h1>
          <p className="page-subtitle">Here's what's happening at your hospital today.</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-700">
            {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
          <p className="text-xs text-slate-400">
            {user?.role === 'superadmin' ? 'Super Administrator' : 'Hospital Administrator'}
          </p>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Total Patients"  value="—" sub="This month" color="bg-blue-500" />
        <StatCard icon={UserCheck}  label="Active Doctors"  value="—" sub="On staff"   color="bg-primary-600" />
        <StatCard icon={Bed}        label="Beds Occupied"   value="—" sub="/ Total"    color="bg-green-500" />
        <StatCard icon={TrendingUp} label="Revenue Today"   value="—" sub="₹"          color="bg-orange-500" />
      </div>

      {/* ── Pending Approvals Summary Banner (shows if both have items) ──────── */}
      {(pendingDoctors.length > 0 || pendingStaff.length > 0) && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            You have{' '}
            {pendingDoctors.length > 0 && (
              <span className="font-bold">{pendingDoctors.length} doctor{pendingDoctors.length > 1 ? 's' : ''}</span>
            )}
            {pendingDoctors.length > 0 && pendingStaff.length > 0 && ' and '}
            {pendingStaff.length > 0 && (
              <span className="font-bold">{pendingStaff.length} staff member{pendingStaff.length > 1 ? 's' : ''}</span>
            )}
            {' '}awaiting approval.
          </p>
        </div>
      )}

      {/* ── Pending Doctor Approvals ─────────────────────────────────────────── */}
      <PendingCard
        title="Pending Doctor Approvals"
        icon={Stethoscope}
        iconColor="text-yellow-500"
        items={pendingDoctors}
        loading={loadingDoctors}
        approving={approvingDoc}
        navigatePath="/admin/doctor-approvals"
        badgeColor="bg-yellow-100 text-yellow-700"
        avatarColor="bg-primary-100 text-primary-700"
        avatarText="Dr."
        onApprove={{ approve: handleApproveDoctor, reload: loadPendingDoctors }}
        onRejectNavigate={navigate}
        line1={d => `${d.SpecializationName || '—'} · ${d.QualificationName || d.QualificationCode || '—'}`}
        line2={d => `${d.Email} · Lic: ${d.LicenseNumber}`}
        meta={d => (
          <>
            {d.ExperienceYears && <p>{d.ExperienceYears} yrs exp</p>}
            {d.ConsultationFee && <p>₹{d.ConsultationFee} fee</p>}
          </>
        )}
      />

      {/* ── Pending Staff Approvals ───────────────────────────────────────────── */}
      <PendingCard
        title="Pending Staff Approvals"
        icon={Briefcase}
        iconColor="text-blue-500"
        items={pendingStaff}
        loading={loadingStaff}
        approving={approvingStaff}
        navigatePath="/admin/staff-approvals"
        badgeColor="bg-blue-100 text-blue-700"
        avatarColor="bg-blue-100 text-blue-700"
        avatarText=""
        onApprove={{ approve: handleApproveStaff, reload: loadPendingStaff }}
        onRejectNavigate={navigate}
        line1={s => `${s.Role ? s.Role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'} · ${s.DepartmentName || 'No dept'}`}
        line2={s => `${s.Email} · ${s.Phone}`}
        meta={s => (
          <>
            {s.Shift && <p>{s.Shift} shift</p>}
            {s.ExperienceYears && <p>{s.ExperienceYears} yrs exp</p>}
          </>
        )}
      />

      {/* ── Two column layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Activity size={15} />Recent Activity
            </h3>
          </div>
          <div className="card-body p-0">
            {[
              { text: 'New patient registered',      time: '2 min ago',  color: 'bg-blue-400' },
              { text: 'Dr. Sharma approved',         time: '1 hr ago',   color: 'bg-green-400' },
              { text: 'Invoice #1042 generated',     time: '2 hrs ago',  color: 'bg-orange-400' },
              { text: 'Lab report uploaded',         time: '3 hrs ago',  color: 'bg-purple-400' },
              { text: 'Bed #12 assigned to patient', time: '4 hrs ago',  color: 'bg-teal-400' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-50 last:border-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.color}`} />
                <span className="text-sm text-slate-600 flex-1">{a.text}</span>
                <span className="text-xs text-slate-400">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department overview */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Building2 size={15} />Department Overview
            </h3>
          </div>
          <div className="card-body space-y-3">
            {[
              { name: 'Cardiology',  patients: 24, capacity: 30 },
              { name: 'Orthopedics', patients: 18, capacity: 25 },
              { name: 'Pediatrics',  patients: 31, capacity: 40 },
              { name: 'Neurology',   patients: 12, capacity: 20 },
              { name: 'General',     patients: 45, capacity: 60 },
            ].map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">{d.name}</span>
                  <span className="text-xs text-slate-400">{d.patients}/{d.capacity}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${(d.patients / d.capacity) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}