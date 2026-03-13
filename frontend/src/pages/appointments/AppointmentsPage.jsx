// src/pages/appointments/AppointmentsPage.jsx
// Admin / Doctor / Receptionist — full appointment management with status actions
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Search, Filter, RefreshCw, Plus, CheckCircle, XCircle,
  Clock, Eye, RotateCcw, ChevronLeft, ChevronRight, AlertCircle,
  Stethoscope, User, Phone, Hash, Building2, ArrowUpRight, Bell,
  Check, X, CalendarClock, ClipboardList
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import AppointmentBookingModal from './AppointmentBookingModal';
import AppointmentDetailModal from './AppointmentDetailModal';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Scheduled:   { color: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-500',    label: 'Scheduled'   },
  Confirmed:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Confirmed' },
  Completed:   { color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500',  label: 'Completed'  },
  Cancelled:   { color: 'bg-red-100 text-red-600 border-red-200',         dot: 'bg-red-500',     label: 'Cancelled'  },
  NoShow:      { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400',  label: 'No Show'    },
  Rescheduled: { color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-500',   label: 'Rescheduled' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Scheduled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkRow = () => (
  <tr className="border-b border-slate-50">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse" style={{ width: `${60 + (i * 7) % 40}%` }} />
      </td>
    ))}
  </tr>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon: Icon }) => (
  <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${color} bg-white`}>
    <Icon size={18} className="flex-shrink-0 opacity-70" />
    <div>
      <p className="text-xl font-black">{value ?? '—'}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  </div>
);

// ── Cancel Modal ──────────────────────────────────────────────────────────────
const CancelModal = ({ appt, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!reason.trim()) return toast.error('Please provide a cancel reason');
    setLoading(true);
    try {
      await api.patch(`/appointments/${appt.Id}/cancel`, { cancelReason: reason });
      toast.success('Appointment cancelled — notifications sent');
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to cancel');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 bg-red-50">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <XCircle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Cancel Appointment</h3>
            <p className="text-xs text-slate-500">Ref: {appt.AppointmentNo}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-red-100 rounded-xl"><X size={14} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
            <p className="font-semibold text-slate-700">{appt.PatientFirstName} {appt.PatientLastName}</p>
            <p className="text-slate-500 mt-0.5">Dr. {appt.DoctorFirstName} {appt.DoctorLastName} · {new Date(appt.AppointmentDate).toLocaleDateString('en-IN')} at {appt.AppointmentTime}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reason for cancellation *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="e.g. Doctor unavailable, Patient request…" />
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700 flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              Email and in-app notifications will be sent to the patient and doctor.
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Keep Appointment</button>
          <button onClick={confirm} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
            {loading ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Reschedule Modal ──────────────────────────────────────────────────────────
const RescheduleModal = ({ appt, onClose, onDone }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!date || !time) return toast.error('Select new date and time');
    setLoading(true);
    try {
      await api.patch(`/appointments/${appt.Id}/reschedule`, { appointmentDate: date, appointmentTime: time });
      toast.success('Appointment rescheduled — notifications sent');
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reschedule');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 bg-amber-50">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <CalendarClock size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Reschedule Appointment</h3>
            <p className="text-xs text-slate-500">Ref: {appt.AppointmentNo}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-amber-100 rounded-xl"><X size={14} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
            <p className="font-semibold text-slate-700">Current: {new Date(appt.AppointmentDate).toLocaleDateString('en-IN')} at {appt.AppointmentTime}</p>
            <p className="text-slate-500 mt-0.5">{appt.PatientFirstName} {appt.PatientLastName} · Dr. {appt.DoctorFirstName} {appt.DoctorLastName}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Date *</label>
              <input type="date" value={date} min={new Date().toISOString().split('T')[0]}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Time *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700 flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              Reschedule notifications will be emailed to the patient and doctor.
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={confirm} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
            {loading ? 'Rescheduling…' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
export default function AppointmentsPage() {
  const { user } = useAuth();

  const [appointments,  setAppointments]  = useState([]);
  const [stats,         setStats]         = useState({});
  const [loading,       setLoading]       = useState(true);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const LIMIT = 15;

  // Filters
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterDate,    setFilterDate]    = useState('');

  // Modals
  const [showBook,       setShowBook]     = useState(false);
  const [cancelAppt,     setCancelAppt]   = useState(null);
  const [reschedAppt,    setReschedAppt]  = useState(null);
  const [detailAppt,     setDetailAppt]   = useState(null);
  const [actionLoading,  setActionLoading]= useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterStatus) params.append('status', filterStatus);
      if (filterDate)   params.append('date',   filterDate);

      const [apptRes, statsRes] = await Promise.allSettled([
        api.get(`/appointments?${params}`),
        api.get('/appointments/stats'),
      ]);

      if (apptRes.status === 'fulfilled') {
        const d = apptRes.value?.data;
        setAppointments(d?.data || []);
        setTotal(d?.total || 0);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value?.data || {});
      }
    } catch {}
    setLoading(false);
  }, [page, filterStatus, filterDate]);

  useEffect(() => { load(); }, [load]);

  const handleStatusUpdate = async (id, status, extra = {}) => {
    setActionLoading(id);
    try {
      await api.patch(`/appointments/${id}/status`, { status, ...extra });
      toast.success(`Appointment ${status.toLowerCase()} — notifications sent ✓`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally { setActionLoading(null); }
  };

  // Client-side search filter
  const filtered = appointments.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${a.PatientFirstName} ${a.PatientLastName}`.toLowerCase().includes(q) ||
      `${a.DoctorFirstName} ${a.DoctorLastName}`.toLowerCase().includes(q) ||
      (a.AppointmentNo || '').toLowerCase().includes(q) ||
      (a.DepartmentName || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar size={22} className="text-indigo-600" /> Appointments
          </h1>
          <p className="page-subtitle">Manage bookings, send notifications, track status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
            <RefreshCw size={15} />
          </button>
          {['admin', 'superadmin', 'receptionist'].includes(user?.role) && (
            <button onClick={() => setShowBook(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
              <Plus size={15} /> New Appointment
            </button>
          )}
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Today"       value={stats.TodayTotal} color="border-indigo-200 text-indigo-700"  icon={Calendar} />
        <StatCard label="Scheduled"   value={stats.Scheduled}  color="border-blue-200 text-blue-700"      icon={Clock} />
        <StatCard label="Confirmed"   value={stats.Confirmed}  color="border-emerald-200 text-emerald-700" icon={CheckCircle} />
        <StatCard label="Completed"   value={stats.Completed}  color="border-purple-200 text-purple-700"  icon={Check} />
        <StatCard label="Cancelled"   value={stats.Cancelled}  color="border-red-200 text-red-600"        icon={XCircle} />
        <StatCard label="No Show"     value={stats.NoShow}     color="border-orange-200 text-orange-700"  icon={AlertCircle} />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient, doctor, ref no…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white min-w-36">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
        {(filterStatus || filterDate || search) && (
          <button onClick={() => { setFilterStatus(''); setFilterDate(''); setSearch(''); setPage(1); }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-1.5">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Ref / Token', 'Patient', 'Doctor', 'Date & Time', 'Dept', 'Type', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => <SkRow key={i} />)
                : filtered.length === 0
                  ? (
                    <tr><td colSpan={8} className="py-16 text-center">
                      <ClipboardList size={32} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-400 font-medium">No appointments found</p>
                      <p className="text-slate-300 text-xs mt-1">Try adjusting your filters</p>
                    </td></tr>
                  ) : filtered.map(a => {
                    const isActioning = actionLoading === a.Id;
                    return (
                      <tr key={a.Id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">

                        {/* Ref / Token */}
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-xs font-bold text-indigo-600">{a.AppointmentNo}</p>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Hash size={10} /> Token {a.TokenNumber || '—'}
                          </p>
                        </td>

                        {/* Patient */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                              {a.PatientFirstName?.[0]}{a.PatientLastName?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-700">{a.PatientFirstName} {a.PatientLastName}</p>
                              <p className="text-xs text-slate-400">{a.PatientPhone || a.UHID}</p>
                            </div>
                          </div>
                        </td>

                        {/* Doctor */}
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-700">Dr. {a.DoctorFirstName} {a.DoctorLastName}</p>
                          {a.ConsultationFee && <p className="text-xs text-slate-400">₹{a.ConsultationFee}</p>}
                        </td>

                        {/* Date & Time */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="font-semibold text-slate-700">
                            {new Date(a.AppointmentDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} /> {a.AppointmentTime}</p>
                        </td>

                        {/* Dept */}
                        <td className="px-4 py-3.5">
                          <p className="text-slate-600 text-xs">{a.DepartmentName || '—'}</p>
                        </td>

                        {/* Visit Type */}
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">{a.VisitType}</span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge status={a.Status} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {/* View detail */}
                            <button onClick={() => setDetailAppt(a)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="View Details">
                              <Eye size={13} />
                            </button>

                            {/* Confirm */}
                            {a.Status === 'Scheduled' && (
                              <button onClick={() => handleStatusUpdate(a.Id, 'Confirmed')}
                                disabled={isActioning}
                                className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-40" title="Confirm">
                                <CheckCircle size={13} />
                              </button>
                            )}

                            {/* Complete */}
                            {['Scheduled', 'Confirmed'].includes(a.Status) && (
                              <button onClick={() => handleStatusUpdate(a.Id, 'Completed')}
                                disabled={isActioning}
                                className="p-1.5 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors disabled:opacity-40" title="Mark Complete">
                                <Check size={13} />
                              </button>
                            )}

                            {/* Reschedule */}
                            {!['Cancelled', 'Completed'].includes(a.Status) && (
                              <button onClick={() => setReschedAppt(a)}
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors" title="Reschedule">
                                <RotateCcw size={13} />
                              </button>
                            )}

                            {/* Cancel */}
                            {!['Cancelled', 'Completed'].includes(a.Status) && (
                              <button onClick={() => setCancelAppt(a)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Cancel">
                                <XCircle size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-1.5">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors">
                <ChevronLeft size={14} />
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const n = i + 1;
                return (
                  <button key={n} onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === n ? 'bg-indigo-600 text-white' : 'border border-slate-200 hover:bg-white text-slate-600'}`}>
                    {n}
                  </button>
                );
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {showBook    && <AppointmentBookingModal onClose={() => setShowBook(false)} onSuccess={() => { setShowBook(false); load(); }} />}
      {cancelAppt  && <CancelModal     appt={cancelAppt}  onClose={() => setCancelAppt(null)}  onDone={() => { setCancelAppt(null);  load(); }} />}
      {reschedAppt && <RescheduleModal appt={reschedAppt} onClose={() => setReschedAppt(null)} onDone={() => { setReschedAppt(null); load(); }} />}
      {detailAppt  && <AppointmentDetailModal appt={detailAppt} onClose={() => setDetailAppt(null)} onAction={load} />}
    </div>
  );
}