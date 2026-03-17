// src/pages/scheduling/DoctorSchedulePage.jsx
// Doctor's read-only view of their admin-assigned schedule
// Shows weekly schedule + today's appointments + upcoming week summary
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, MapPin, User, Building2, Hash,
  RefreshCw, Loader, Stethoscope, CalendarDays,
  CheckCircle, AlertCircle, ChevronRight, Activity,
  Info, Phone, Droplets, ArrowRight, Star, Users,
  Sun, Sunset, Moon, Zap, Coffee
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const DAY_PALETTE = [
  { bg:'#fef3c7', border:'#fbbf24', text:'#92400e', accent:'#f59e0b', light:'#fffbeb' }, // Sun
  { bg:'#eff6ff', border:'#93c5fd', text:'#1e40af', accent:'#3b82f6', light:'#f0f7ff' }, // Mon
  { bg:'#f0fdf4', border:'#86efac', text:'#166534', accent:'#22c55e', light:'#f7fdf9' }, // Tue
  { bg:'#fdf4ff', border:'#d8b4fe', text:'#5b21b6', accent:'#a855f7', light:'#fdf5ff' }, // Wed
  { bg:'#fff7ed', border:'#fdba74', text:'#9a3412', accent:'#f97316', light:'#fffaf5' }, // Thu
  { bg:'#f0f9ff', border:'#7dd3fc', text:'#075985', accent:'#0ea5e9', light:'#f5fbff' }, // Fri
  { bg:'#fdf2f8', border:'#f0abfc', text:'#701a75', accent:'#e879f9', light:'#fef5fd' }, // Sat
];

const VISIT_TYPE_CONFIG = {
  opd:         { label:'OPD',         color:'#0d9488', bg:'#f0fdfa' },
  teleconsult: { label:'Teleconsult', color:'#6d28d9', bg:'#f5f3ff' },
  emergency:   { label:'Emergency',   color:'#dc2626', bg:'#fef2f2' },
  followup:    { label:'Follow-up',   color:'#2563eb', bg:'#eff6ff' },
  both:        { label:'OPD + Tele',  color:'#7c3aed', bg:'#f5f0ff' },
};

const APPT_STATUS = {
  Scheduled:  { color:'#2563eb', bg:'#eff6ff',  label:'Scheduled'  },
  Confirmed:  { color:'#0d9488', bg:'#f0fdfa',  label:'Confirmed'  },
  'In Progress': { color:'#7c3aed', bg:'#f5f3ff', label:'In Progress' },
  Completed:  { color:'#16a34a', bg:'#f0fdf4',  label:'Completed'  },
  Cancelled:  { color:'#dc2626', bg:'#fef2f2',  label:'Cancelled'  },
  NoShow:     { color:'#78716c', bg:'#fafaf9',  label:'No-Show'    },
};

const fmt12 = t => {
  if (!t) return '—';
  const parts = String(t).split(':').map(Number);
  const h = parts[0], m = parts[1] || 0;
  if (isNaN(h)) return '—';
  return `${(h % 12) || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const calcAge = dob => {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob)) / 3.156e10);
};
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const slotCount = (s, e, d) => {
  if (!s || !e || !d) return 0;
  const m = t => { const [h,mn]=t.split(':').map(Number); return h*60+mn; };
  return Math.max(0, Math.floor((m(e)-m(s))/d));
};

const getShiftIcon = (startTime) => {
  if (!startTime) return <Activity size={14} />;
  const h = parseInt(startTime.split(':')[0]);
  if (h < 9)  return <Sun size={14} />;
  if (h < 13) return <Coffee size={14} />;
  if (h < 17) return <Sunset size={14} />;
  return <Moon size={14} />;
};

const getShiftLabel = (startTime) => {
  if (!startTime) return 'Shift';
  const h = parseInt(startTime.split(':')[0]);
  if (h < 9)  return 'Early Morning';
  if (h < 13) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 20) return 'Evening';
  return 'Night';
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ w='w-full', h='h-4', r='rounded-lg' }) => (
  <div className={`${w} ${h} ${r} bg-slate-100 animate-pulse`} />
);

// ─── Today's Appointment Card ─────────────────────────────────────────────────
const AppointmentCard = ({ appt, index }) => {
  const st = APPT_STATUS[appt.Status] || APPT_STATUS.Scheduled;
  const age = calcAge(appt.DateOfBirth);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-200 overflow-hidden"
         style={{ animationDelay:`${index*50}ms` }}>
      <div className="flex items-stretch">
        {/* Token number */}
        <div className="flex-shrink-0 w-16 flex flex-col items-center justify-center bg-slate-50 border-r border-slate-100 py-4">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Token</span>
          <span className="text-2xl font-black text-slate-700 leading-none mt-0.5">
            {appt.TokenNumber || '—'}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-slate-800 text-sm">{appt.PatientName}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                {appt.UHID && <span className="text-[11px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{appt.UHID}</span>}
                {appt.Gender && <span className="text-[11px] text-slate-500 capitalize">{appt.Gender}</span>}
                {age && <span className="text-[11px] text-slate-500">{age}y</span>}
                {appt.BloodGroup && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background:'#fef2f2', color:'#dc2626' }}>
                    <Droplets size={9} className="inline mr-0.5" />{appt.BloodGroup}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: st.bg, color: st.color }}>
              {st.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Clock size={11} className="text-slate-400" />
              <span className="font-medium">{fmt12(appt.AppointmentTime)}</span>
              {appt.EndTime && <span className="text-slate-400">– {fmt12(appt.EndTime)}</span>}
            </div>
            {appt.PatientPhone && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Phone size={11} className="text-slate-400" />
                {appt.PatientPhone}
              </div>
            )}
            {appt.VisitType && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: VISIT_TYPE_CONFIG[appt.VisitType]?.bg || '#f1f5f9', color: VISIT_TYPE_CONFIG[appt.VisitType]?.color || '#475569' }}>
                {VISIT_TYPE_CONFIG[appt.VisitType]?.label || appt.VisitType}
              </span>
            )}
          </div>

          {appt.Reason && (
            <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1 italic">
              &ldquo;{appt.Reason}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Weekly Schedule Day Card ──────────────────────────────────────────────────
const DayScheduleCard = ({ dayIndex, schedules, isToday }) => {
  const dp = DAY_PALETTE[dayIndex];
  const totalSlots = schedules.reduce((acc, s) => acc + (s.MaxSlots || s.ComputedMaxSlots || 0), 0);

  if (schedules.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center min-h-[100px] flex flex-col items-center justify-center">
        <span className="text-xs font-semibold text-slate-300">{DAYS_FULL[dayIndex]}</span>
        <span className="text-[11px] text-slate-300 mt-1">Off / No OPD</span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${isToday ? 'ring-2 ring-teal-400 ring-offset-2' : ''}`}
         style={{ borderColor: dp.border, background: dp.light }}>
      {/* Day header */}
      <div className="px-3 py-2.5 flex items-center justify-between"
           style={{ background: dp.bg, borderBottom: `1px solid ${dp.border}` }}>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold" style={{ color: dp.text }}>{DAYS_FULL[dayIndex]}</span>
            {isToday && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500 text-white">TODAY</span>
            )}
          </div>
          <span className="text-[11px] font-medium" style={{ color: dp.text, opacity: 0.7 }}>
            {schedules.length} block{schedules.length !== 1 ? 's' : ''} · {totalSlots} slots
          </span>
        </div>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
             style={{ background: dp.accent }}>
          {schedules.length}
        </div>
      </div>

      {/* Schedule blocks */}
      <div className="p-2 space-y-1.5">
        {schedules.map(sch => {
          const vt = VISIT_TYPE_CONFIG[sch.VisitType] || VISIT_TYPE_CONFIG.opd;
          const slots = sch.MaxSlots || sch.ComputedMaxSlots;
          return (
            <div key={sch.Id} className="bg-white rounded-xl px-3 py-2.5 border border-white shadow-sm">
              {/* Time range */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  {getShiftIcon(sch.StartTime)}
                  <span>{fmt12(sch.StartTime)} – {fmt12(sch.EndTime)}</span>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: vt.bg, color: vt.color }}>
                  {vt.label}
                </span>
              </div>

              {/* Details row */}
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Hash size={10} className="text-slate-400" />
                  {sch.SlotDurationMins} min / slot
                </span>
                {slots && (
                  <span className="flex items-center gap-1 font-semibold text-teal-700">
                    <Users size={10} />
                    {slots} patients max
                  </span>
                )}
                {sch.RoomNumber && (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} className="text-slate-400" />
                    Room {sch.RoomNumber}
                  </span>
                )}
              </div>

              {/* Effective period if not ongoing */}
              {sch.EffectiveTo && (
                <div className="mt-1.5 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Info size={9} />
                  Until {fmtDate(sch.EffectiveTo)}
                </div>
              )}

              {/* Notes */}
              {sch.Notes && (
                <p className="text-[11px] text-slate-400 italic mt-1 truncate">{sch.Notes}</p>
              )}

              {/* Assigned by */}
              {sch.AssignedByName && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Set by {sch.AssignedByName}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DoctorSchedulePage() {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('week'); // 'week' | 'today'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/scheduling/my-schedule');
      setData(res.data);
    } catch (e) {
      toast.error(e?.message || 'Could not load your schedule');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refreshSchedule = () => {
      if (document.hidden) return;
      load();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshSchedule();
      }
    };

    const intervalId = window.setInterval(refreshSchedule, 30000);
    window.addEventListener('focus', refreshSchedule);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSchedule);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [load]);

  const schedules     = data?.schedules           || [];
  const todayAppts    = data?.todayAppointments   || [];
  const todayDow      = data?.todayDow            ?? new Date().getDay();
  const todayDate     = data?.todayDate           || new Date().toISOString().slice(0,10);

  // Group schedules by day
  const byDay = DAYS_FULL.map((_, i) => schedules.filter(s => s.DayOfWeek === i));

  // Today's schedule blocks
  const todayBlocks = byDay[todayDow] || [];

  // Weekly stats
  const workingDays   = byDay.filter(d => d.length > 0).length;
  const totalWeekSlots= schedules.reduce((a,s) => a+(s.MaxSlots||s.ComputedMaxSlots||0), 0);
  const todaySlots    = todayBlocks.reduce((a,s) => a+(s.MaxSlots||s.ComputedMaxSlots||0), 0);

  // Format today nicely
  const todayFormatted = new Date(todayDate).toLocaleDateString('en-IN', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md shadow-teal-200">
                <CalendarDays size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">My Schedule</h1>
                <p className="text-sm text-slate-500 mt-0.5">{todayFormatted}</p>
              </div>
            </div>
            <button onClick={load} disabled={loading}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors disabled:opacity-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Stat pills */}
          {!loading && (
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
                <CalendarDays size={14} className="text-teal-600" />
                <span className="text-xs font-semibold text-teal-700">{workingDays} working days / week</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <Users size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">{totalWeekSlots} weekly slots</span>
              </div>
              <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                <Stethoscope size={14} className="text-violet-600" />
                <span className="text-xs font-semibold text-violet-700">
                  {todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''} today
                </span>
              </div>
              {todaySlots > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  <Hash size={14} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">{todaySlots} slots today</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-slate-100 px-6">
          {[
            { key:'today', label:"Today's View", icon: Activity },
            { key:'week',  label:'Weekly Schedule', icon: CalendarDays },
          ].map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                tab === t.key
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon size={15} />
              {t.label}
              {t.key === 'today' && todayAppts.length > 0 && (
                <span className="ml-1 text-[10px] font-bold bg-teal-500 text-white w-4 h-4 rounded-full flex items-center justify-center">
                  {todayAppts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-3">
              {Array.from({length:7}).map((_,i) => <Sk key={i} h="h-36" r="rounded-2xl" />)}
            </div>
            <Sk h="h-24" r="rounded-2xl" />
            <Sk h="h-24" r="rounded-2xl" />
          </div>
        ) : schedules.length === 0 && tab === 'week' ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
              <CalendarDays size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-600 mb-2">No Schedule Assigned Yet</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              Your OPD schedule hasn't been set up yet. Please contact the hospital admin to assign your weekly schedule.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-100 rounded-xl px-4 py-2.5">
              <Info size={13} />
              Schedules are assigned by hospital administrators
            </div>
          </div>

        ) : tab === 'today' ? (
          /* ── TODAY'S VIEW ─────────────────────────────────────────────────── */
          <div className="space-y-6 max-w-3xl">

            {/* Today's schedule blocks */}
            <section>
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-teal-500 rounded-full" />
                {DAYS_FULL[todayDow]} OPD Schedule
              </h2>
              {todayBlocks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <Star size={24} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">No OPD scheduled today</p>
                  <p className="text-xs text-slate-400 mt-1">Enjoy your day off or check with admin</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {todayBlocks.map(sch => {
                    const vt = VISIT_TYPE_CONFIG[sch.VisitType] || VISIT_TYPE_CONFIG.opd;
                    const dp = DAY_PALETTE[todayDow];
                    const slots = sch.MaxSlots || sch.ComputedMaxSlots;
                    return (
                      <div key={sch.Id} className="bg-white rounded-2xl border overflow-hidden shadow-sm"
                           style={{ borderColor: dp.border }}>
                        <div className="h-1" style={{ background: dp.accent }} />
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                              {getShiftIcon(sch.StartTime)}
                              <span>{getShiftLabel(sch.StartTime)}</span>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                  style={{ background: vt.bg, color: vt.color }}>
                              {vt.label}
                            </span>
                          </div>
                          <div className="text-2xl font-black text-slate-800 mb-1 tracking-tight">
                            {fmt12(sch.StartTime)}
                          </div>
                          <div className="text-sm text-slate-500 mb-3">until {fmt12(sch.EndTime)}</div>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-600 pt-3 border-t border-slate-50">
                            <span className="flex items-center gap-1">
                              <Hash size={11} className="text-slate-400" />
                              {sch.SlotDurationMins} min/slot
                            </span>
                            {slots && (
                              <span className="flex items-center gap-1 font-semibold text-teal-700">
                                <Users size={11} />
                                {slots} max
                              </span>
                            )}
                            {sch.RoomNumber && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-slate-400" />
                                Room {sch.RoomNumber}
                                {sch.RoomName && ` — ${sch.RoomName}`}
                              </span>
                            )}
                          </div>
                          {sch.Notes && (
                            <p className="text-xs text-slate-400 mt-2 italic">{sch.Notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Today's appointments */}
            <section>
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-violet-500 rounded-full" />
                Today's Appointments
                {todayAppts.length > 0 && (
                  <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full ml-1">
                    {todayAppts.length}
                  </span>
                )}
              </h2>

              {todayAppts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <CheckCircle size={24} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">No appointments booked for today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayAppts.map((appt, idx) => (
                    <AppointmentCard key={appt.Id} appt={appt} index={idx} />
                  ))}
                </div>
              )}
            </section>
          </div>

        ) : (
          /* ── WEEKLY SCHEDULE VIEW ─────────────────────────────────────────── */
          <div className="space-y-6">
            {/* Quick summary row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {DAYS_FULL.map((day, i) => {
                const hasSchedule = byDay[i].length > 0;
                const isToday     = i === todayDow;
                const dp          = DAY_PALETTE[i];
                return (
                  <div key={i}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                      isToday ? 'ring-2 ring-teal-400 ring-offset-1' : ''
                    }`}
                    style={{
                      background: hasSchedule ? dp.bg : '#f8fafc',
                      border: `1px solid ${hasSchedule ? dp.border : '#e2e8f0'}`
                    }}>
                    <span className="text-[11px] font-bold" style={{ color: hasSchedule ? dp.text : '#94a3b8' }}>
                      {DAYS_SHORT[i]}
                    </span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      hasSchedule ? 'text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                    style={{ background: hasSchedule ? dp.accent : undefined }}>
                      {hasSchedule ? byDay[i].length : '–'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {DAYS_FULL.map((_, i) => (
                <DayScheduleCard
                  key={i}
                  dayIndex={i}
                  schedules={byDay[i]}
                  isToday={i === todayDow}
                />
              ))}
            </div>

            {/* Legend / Info */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Info size={11} />
                Schedules are assigned by hospital administration
              </span>
              {schedules[0]?.AssignedByName && (
                <span className="text-xs text-slate-400">
                  · Last set by {schedules[0].AssignedByName}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
