// src/pages/dashboard/DoctorDashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Calendar, Pill, Clock, RefreshCw, Loader,
  Check, CheckCircle, XCircle, X, Plus, Search,
  Edit2, Download, Camera, BarChart2, FlaskConical,
  Activity, Stethoscope, ArrowRight, Bell, Eye, AlertCircle, CalendarDays
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  TEAL, BLUE, Sk, StatCard, StatusBadge, Empty,
  SectionHeader, Card, Modal, fmtDate, fmtTime, fmtTimeRange, initials, InfoBadge
} from '../../components/ui';
import CompleteAppointmentModal from '../../components/appointments/CompleteAppointmentModal';
import PrescriptionComposerModal from '../../components/prescriptions/PrescriptionComposerModal';
import DashboardTabs from '../../components/dashboard/DashboardTabs';
import { getList, getPayload } from '../../utils/apiPayload';

// ─── Token status config ──────────────────────────────────────────────────────
const Q_STATUS = {
  current: { ring:'ring-2 ring-emerald-400', bg:'bg-emerald-50 text-emerald-700', dot:'bg-emerald-500', label:'In Consult' },
  waiting: { ring:'ring-2 ring-amber-300',   bg:'bg-amber-50 text-amber-700',     dot:'bg-amber-400',   label:'Waiting'   },
  done:    { ring:'ring-2 ring-slate-200',   bg:'bg-slate-100 text-slate-400',    dot:'bg-slate-300',   label:'Done'      },
};

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getPrescriptionId = (rx) => toInt(rx?.Id || rx?.id);
const getPrescriptionVersion = (rx) => toInt(rx?.VersionNo || rx?.versionNo) || 1;
const isPrescriptionFinalized = (rx) => Boolean(rx?.IsFinalized ?? rx?.isFinalized);
const getPrescriptionItems = (rx) => (Array.isArray(rx?.Items) ? rx.Items : Array.isArray(rx?.items) ? rx.items : []);

const SkRow = () => (
  <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50 last:border-0">
    <Sk w="w-10" h="h-10" r="rounded-xl" />
    <div className="flex-1 space-y-2"><Sk w="w-40" h="h-3.5" /><Sk w="w-28" h="h-3" r="rounded-md" /></div>
    <Sk w="w-20" h="h-6" r="rounded-full" />
  </div>
);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 shadow-xl rounded-xl px-3 py-2">
      <p className="text-xs font-bold text-slate-600 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ─── Prescription Modal ───────────────────────────────────────────────────────
const RxModal = ({ patient, onClose, onSave }) => {
  const [drugs,    setDrugs]    = useState([{ name:'', dose:'', frequency:'', duration:'', notes:'' }]);
  const [diag,     setDiag]     = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving,   setSaving]   = useState(false);
  const FREQS = ['Once daily','Twice daily','Thrice daily','SOS / as needed','Before food','After food','At bedtime'];

  const addDrug    = () => setDrugs(d => [...d, { name:'', dose:'', frequency:'', duration:'', notes:'' }]);
  const removeDrug = i  => setDrugs(d => d.filter((_, j) => j !== i));
  const upd        = (i, k, v) => setDrugs(d => d.map((r, j) => j === i ? { ...r, [k]: v } : r));

  const save = async () => {
    const valid = drugs.filter(d => d.name.trim());
    if (!valid.length) return toast.error('Add at least one medication');
    setSaving(true);
    try {
      await api.post('/prescriptions', {
        patientId:     patient?.PatientId || patient?.patientId || patient?.id,
        appointmentId: patient?.AppointmentId || patient?.appointmentId,
        diagnosis:     diag,
        followUpDate:  followUp || undefined,
        drugs: valid.map(d => ({ drugName:d.name, dosage:d.dose, frequency:d.frequency, duration:d.duration, notes:d.notes })),
      });
      toast.success('Prescription issued successfully');
      onSave();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to issue prescription'); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-start justify-between px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:`${TEAL}15` }}>
            <Pill size={16} style={{ color: TEAL }} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Write Prescription</h3>
            <p className="text-xs text-slate-500 mt-0.5">Patient: <strong>{patient?.Name || patient?.name}</strong></p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={14} className="text-slate-400" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Diagnosis / Clinical Notes</label>
          <textarea value={diag} onChange={e => setDiag(e.target.value)} rows={2}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 resize-none"
            style={{ '--tw-ring-color': `${TEAL}40` }}
            placeholder="Primary diagnosis or chief complaint…" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Medications</label>
            <button onClick={addDrug}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors"
              style={{ color:TEAL, borderColor:`${TEAL}30`, background:`${TEAL}08` }}>
              <Plus size={11} /> Add Drug
            </button>
          </div>
          <div className="space-y-3">
            {drugs.map((d, i) => (
              <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medication #{i + 1}</span>
                  {drugs.length > 1 && (
                    <button onClick={() => removeDrug(i)} className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                      <X size={11} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Drug Name & Strength</label>
                    <input value={d.name} onChange={e => upd(i, 'name', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': `${TEAL}40` }}
                      placeholder="e.g. Amoxicillin 500mg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Dosage</label>
                    <input value={d.dose} onChange={e => upd(i, 'dose', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': `${TEAL}40` }}
                      placeholder="e.g. 1 tablet" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                    <select value={d.frequency} onChange={e => upd(i, 'frequency', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': `${TEAL}40` }}>
                      <option value="">Select frequency</option>
                      {FREQS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Duration</label>
                    <input value={d.duration} onChange={e => upd(i, 'duration', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': `${TEAL}40` }}
                      placeholder="e.g. 7 days" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Special Notes</label>
                    <input value={d.notes} onChange={e => upd(i, 'notes', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': `${TEAL}40` }}
                      placeholder="Optional instructions" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
            Follow-up Date <span className="text-slate-300 font-normal normal-case">(optional)</span>
          </label>
          <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': `${TEAL}40` }} />
        </div>
      </div>

      <div className="flex gap-3 px-7 py-5 border-t border-slate-100">
        <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ background: TEAL }}>
          {saving ? <><Loader size={14} className="animate-spin" />Issuing…</> : <><Check size={14} />Issue Prescription</>}
        </button>
      </div>
    </Modal>
  );
};


// ─── Patient History Modal ────────────────────────────────────────────────────
const PatientHistoryModal = ({ patientId, patientName, onClose, onRx }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('overview');

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    api.get(`/patients/${patientId}`)
      .then(r => setData(r?.data ?? r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  const profile = data?.profile || {};
  const appts   = data?.appointments   || [];
  const rxList  = data?.prescriptions  || [];
  const vitals  = data?.vitals         || null;
  const labs    = data?.labOrders      || [];

  const age = profile.DateOfBirth
    ? Math.floor((Date.now() - new Date(profile.DateOfBirth)) / 3.156e10)
    : profile.AgeYears;

  const statusColors = {
    Scheduled:  'bg-blue-100 text-blue-700',
    Confirmed:  'bg-teal-100 text-teal-700',
    Completed:  'bg-purple-100 text-purple-700',
    Cancelled:  'bg-red-100 text-red-600',
    NoShow:     'bg-orange-100 text-orange-700',
  };

  const TABS = [
    { key:'overview',      label:'Overview'       },
    { key:'appointments',  label:`History (${appts.length})` },
    { key:'prescriptions', label:`Rx (${rxList.length})`     },
    { key:'vitals',        label:'Vitals'         },
    { key:'labs',          label:`Labs (${labs.length})`     },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background:'rgba(15,23,42,0.6)', backdropFilter:'blur(6px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-lg font-black text-white border border-white/20">
              {(profile.FirstName || patientName || 'P')[0]}
            </div>
            <div>
              <h2 className="font-black text-white text-lg leading-tight">
                {profile.FullName || profile.FirstName && `${profile.FirstName} ${profile.LastName}` || patientName}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                {profile.UHID && <span className="text-xs font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">{profile.UHID}</span>}
                {age  && <span className="text-xs text-slate-300">{age}y</span>}
                {profile.Gender && <span className="text-xs text-slate-300 capitalize">{profile.Gender}</span>}
                {profile.BloodGroup && (
                  <span className="text-xs font-bold text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded-full">
                    🩸 {profile.BloodGroup}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onRx({ PatientId: patientId, Name: profile.FullName || patientName })}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-xl transition-colors">
              <Pill size={12} /> New Rx
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-5 py-2 border-b border-slate-100 overflow-x-auto flex-shrink-0 bg-slate-50">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                ${tab === t.key ? 'bg-white text-slate-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : !data ? (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
              <p>Could not load patient data</p>
            </div>
          ) : (
            <>
              {/* Overview */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label:'Total Visits',   value: appts.length,                            color:'#0d9488' },
                      { label:'Prescriptions',  value: rxList.length,                           color:'#7c3aed' },
                      { label:'Lab Orders',     value: labs.length,                             color:'#2563eb' },
                      { label:'Last Visit',     value: appts[0] ? fmtDate(appts[0].AppointmentDate) : '—', color:'#d97706', small: true },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                        <p className={`${s.small ? 'text-sm' : 'text-2xl'} font-black`} style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Contact & identity */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Contact & Identity</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {[
                        ['Phone',        profile.Phone],
                        ['Email',        profile.Email || profile.UserEmail],
                        ['Marital',      profile.MaritalStatus],
                        ['Occupation',   profile.Occupation],
                        ['Blood Group',  profile.BloodGroup],
                        ['Nationality',  profile.Nationality],
                        ['ABHA No.',     profile.AbhaNumber],
                        ['Emergency',    profile.EmergencyName && `${profile.EmergencyName} (${profile.EmergencyRelation || ''}) — ${profile.EmergencyPhone}`],
                        ['Insurance',    profile.InsuranceProvider && `${profile.InsuranceProvider} · ${profile.InsurancePolicyNo || ''}`],
                      ].filter(([,v]) => v).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-slate-400 text-xs w-20 flex-shrink-0">{k}</span>
                          <span className="text-slate-700 text-xs font-medium truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Critical medical context */}
                  {(profile.KnownAllergies || profile.ChronicConditions || profile.CurrentMedications) && (
                    <div className="rounded-2xl p-4 border border-red-100 bg-red-50/50">
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3">⚠️ Critical Medical Info</p>
                      <div className="space-y-2">
                        {profile.KnownAllergies && (
                          <div className="bg-white rounded-xl px-3 py-2 border border-red-100">
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-0.5">Known Allergies</p>
                            <p className="text-xs text-slate-700 font-medium">{profile.KnownAllergies}</p>
                          </div>
                        )}
                        {profile.ChronicConditions && (
                          <div className="bg-white rounded-xl px-3 py-2 border border-amber-100">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Chronic Conditions</p>
                            <p className="text-xs text-slate-700 font-medium">{profile.ChronicConditions}</p>
                          </div>
                        )}
                        {profile.CurrentMedications && (
                          <div className="bg-white rounded-xl px-3 py-2 border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Current Medications</p>
                            <p className="text-xs text-slate-700 font-medium">{profile.CurrentMedications}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Latest vitals snapshot */}
                  {vitals && (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        Latest Vitals · <span className="normal-case font-normal text-slate-400">{fmtDate(vitals.RecordedAt)}</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label:'BP', value: vitals.BloodPressureSystolic ? `${vitals.BloodPressureSystolic}/${vitals.BloodPressureDiastolic}` : null, unit:'mmHg', color:'#dc2626' },
                          { label:'Heart Rate', value: vitals.HeartRate,    unit:'bpm',  color:'#e11d48' },
                          { label:'SpO₂',       value: vitals.OxygenSaturation, unit:'%', color:'#0ea5e9' },
                          { label:'Temp',       value: vitals.Temperature,  unit:'°F',   color:'#f97316' },
                          { label:'Weight',     value: vitals.Weight,       unit:'kg',   color:'#7c3aed' },
                          { label:'BMI',        value: vitals.BMI,          unit:'',     color:'#16a34a' },
                        ].filter(v => v.value).map(v => (
                          <div key={v.label} className="bg-white rounded-xl p-2.5 text-center border border-slate-100">
                            <p className="text-base font-black" style={{ color: v.color }}>{v.value}<span className="text-[10px] font-normal ml-0.5">{v.unit}</span></p>
                            <p className="text-[10px] text-slate-400">{v.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent appointment */}
                  {appts[0] && (
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Last Visit</p>
                      <p className="text-sm font-bold text-slate-700">{fmtDate(appts[0].AppointmentDate)} · {appts[0].DoctorName}</p>
                      <p className="text-xs text-slate-500 mt-1">{appts[0].Reason || '—'}</p>
                      <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[appts[0].Status] || 'bg-slate-100 text-slate-500'}`}>
                        {appts[0].Status}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Appointment History */}
              {tab === 'appointments' && (
                <div className="space-y-2">
                  {appts.length === 0
                    ? <p className="text-center py-8 text-slate-400 text-sm">No appointment history</p>
                    : appts.map(a => (
                      <div key={a.Id} className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-700">{fmtDate(a.AppointmentDate)}</span>
                              {(a.AppointmentTime || a.EndTime) && (
                                <span className="text-xs text-slate-400">
                                  at {fmtTimeRange(a.AppointmentTime, a.EndTime)}
                                </span>
                              )}
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{a.VisitType}</span>
                              {a.TokenNumber && <span className="text-[10px] text-teal-600 font-mono">Token #{a.TokenNumber}</span>}
                            </div>
                            <p className="text-xs text-teal-600 font-medium mt-0.5">{a.DoctorName} · {a.Specialization || a.DepartmentName}</p>
                            {a.Reason && <p className="text-xs text-slate-500 italic mt-1">"{a.Reason}"</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[a.Status] || 'bg-slate-100 text-slate-500'}`}>
                            {a.Status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Prescriptions */}
              {tab === 'prescriptions' && (
                <div className="space-y-3">
                  {rxList.length === 0
                    ? <p className="text-center py-8 text-slate-400 text-sm">No prescriptions found</p>
                    : rxList.map(rx => (
                      <div key={rx.Id} className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-all">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{rx.RxNumber}</p>
                            <p className="text-xs text-slate-400">{fmtDate(rx.RxDate)} · Dr. {rx.DoctorName}</p>
                            {rx.Diagnosis && <p className="text-xs text-blue-600 font-medium mt-0.5">Dx: {rx.Diagnosis}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rx.Status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {rx.Status}
                          </span>
                        </div>
                        {rx.Items?.length > 0 && (
                          <div className="space-y-1.5 border-t border-slate-50 pt-3">
                            {rx.Items.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-[9px] flex-shrink-0 mt-0.5">{i+1}</span>
                                <div>
                                  <span className="font-semibold text-slate-700">{item.MedicineName}</span>
                                  {item.Dosage && <span className="text-slate-400 ml-1">— {item.Dosage}</span>}
                                  {item.Frequency && <span className="text-slate-400">, {item.Frequency}</span>}
                                  {item.Duration && <span className="text-slate-400">, {item.Duration}</span>}
                                  {item.Instructions && <p className="text-slate-400 italic text-[10px] mt-0.5">{item.Instructions}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Vitals */}
              {tab === 'vitals' && (
                <div>
                  {!vitals
                    ? <p className="text-center py-8 text-slate-400 text-sm">No vitals recorded yet</p>
                    : (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-400">Recorded: {fmtDate(vitals.RecordedAt)}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label:'Blood Pressure',   value: vitals.BloodPressureSystolic ? `${vitals.BloodPressureSystolic}/${vitals.BloodPressureDiastolic} mmHg` : null, color:'#dc2626' },
                            { label:'Heart Rate',        value: vitals.HeartRate    ? `${vitals.HeartRate} bpm`  : null, color:'#e11d48' },
                            { label:'Oxygen Saturation', value: vitals.OxygenSaturation ? `${vitals.OxygenSaturation}%` : null, color:'#0ea5e9' },
                            { label:'Temperature',        value: vitals.Temperature  ? `${vitals.Temperature} °F` : null, color:'#f97316' },
                            { label:'Weight',             value: vitals.Weight       ? `${vitals.Weight} kg`      : null, color:'#7c3aed' },
                            { label:'Height',             value: vitals.Height       ? `${vitals.Height} cm`      : null, color:'#16a34a' },
                            { label:'BMI',                value: vitals.BMI          ? `${vitals.BMI}`            : null, color:'#0891b2' },
                          ].filter(v => v.value).map(v => (
                            <div key={v.label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                              <p className="text-xl font-black" style={{ color: v.color }}>{v.value}</p>
                              <p className="text-xs text-slate-400 mt-1">{v.label}</p>
                            </div>
                          ))}
                        </div>
                        {vitals.Notes && (
                          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                            <p className="text-xs font-bold text-amber-700 mb-1">Notes</p>
                            <p className="text-sm text-amber-800">{vitals.Notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* Lab Orders */}
              {tab === 'labs' && (
                <div className="space-y-2">
                  {labs.length === 0
                    ? <p className="text-center py-8 text-slate-400 text-sm">No lab orders found</p>
                    : labs.map(lab => (
                      <div key={lab.Id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-200 transition-all">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FlaskConical size={14} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700">{lab.OrderNumber}</p>
                          <p className="text-xs text-slate-400">{fmtDate(lab.OrderDate)} · {lab.OrderedByName || 'Unknown'}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full
                          ${lab.Status === 'Completed' ? 'bg-emerald-100 text-emerald-700'
                          : lab.Status === 'Pending'   ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'}`}>
                          {lab.Status}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── Complete Appointment Modal ───────────────────────────────────────────────
const CompleteModal = ({ appointment, onClose, onDone }) => {
  const [notes,      setNotes]      = useState('');
  const [diagnosis,  setDiagnosis]  = useState('');
  const [followUp,   setFollowUp]   = useState('');
  const [followNote, setFollowNote] = useState('');
  const [saving,     setSaving]     = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    try {
      const id = appointment?.AppointmentId || appointment?.Id || appointment?.id;
      await api.patch(`/appointments/${id}/complete`, {
        consultationNotes: notes,
        diagnosis,
        followUpDate:  followUp   || undefined,
        followUpNotes: followNote || undefined,
      });
      toast.success('Appointment marked as completed');
      onDone();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not complete appointment');
    } finally { setSaving(false); }
  };

  const patName = appointment?.PatientFullName || appointment?.PatientName || appointment?.Name || 'Patient';

  return (
    <Modal onClose={onClose} wide>
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle size={17} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Complete Consultation</h3>
            <p className="text-xs text-slate-500">Patient: <strong>{patName}</strong></p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Primary Diagnosis
          </label>
          <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute pharyngitis, Hypertension..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Consultation Notes
          </label>
          <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Clinical observations, treatment given, patient response, instructions given..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Follow-up Date
            </label>
            <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)}
              min={new Date().toISOString().slice(0,10)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Follow-up Instructions
            </label>
            <input value={followNote} onChange={e => setFollowNote(e.target.value)}
              placeholder="e.g. Return if fever persists..."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none" />
          </div>
        </div>
        {followUp && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700 flex items-center gap-2">
            <CalendarDays size={12} />
            Follow-up scheduled for {new Date(followUp).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl hover:bg-white transition-all">
          Cancel
        </button>
        <button onClick={handleComplete} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-60">
          {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          Mark as Completed
        </button>
      </div>
    </Modal>
  );
};

// ─── Profile Edit Modal ───────────────────────────────────────────────────────
const ProfileModal = ({ profile, avatar, onClose, onSave }) => {
  const [form, setForm] = useState({
    firstName:        profile?.FirstName        || profile?.firstName        || '',
    lastName:         profile?.LastName         || profile?.lastName         || '',
    phone:            profile?.Phone            || profile?.phone            || '',
    email:            profile?.Email            || profile?.email            || '',
    designation:      profile?.Designation      || profile?.designation      || '',
    languagesSpoken:  profile?.LanguagesSpoken  || profile?.languagesSpoken  || '',
    consultationFee:  profile?.ConsultationFee  || profile?.consultationFee  || '',
    availableFrom:    profile?.AvailableFrom    || profile?.availableFrom    || '09:00',
    availableTo:      profile?.AvailableTo      || profile?.availableTo      || '17:00',
    maxDailyPatients: profile?.MaxDailyPatients || profile?.maxDailyPatients || 20,
    slotDurationMins: profile?.SlotDurationMins || profile?.slotDurationMins || 20,
    breakFrom:        profile?.BreakFrom        || profile?.breakFrom        || '',
    breakTo:          profile?.BreakTo          || profile?.breakTo          || '',
    bio:              profile?.Bio              || profile?.bio              || '',
  });
  const [preview, setPreview] = useState(avatar || null);
  const [saving,  setSaving]  = useState(false);
  const fileRef = useRef();

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== '' && v !== undefined && fd.append(k, v));
      if (fileRef.current?.files[0]) fd.append('profilePic', fileRef.current.files[0]);
      await api.patch('/doctors/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile updated');
      onSave({ ...form, profilePicUrl: preview });
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const F = ({ label, k, type = 'text', placeholder }) => (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type={type} value={form[k]} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
        style={{ '--tw-ring-color': `${TEAL}40` }} />
    </div>
  );

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
        <h3 className="font-bold text-slate-800">Edit Profile</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={14} className="text-slate-400" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-teal-50 border border-teal-100">
          <div className="relative flex-shrink-0">
            {preview
              ? <img src={preview} className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md" alt="av" />
              : <div className="w-20 h-20 rounded-2xl border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-2xl"
                  style={{ background:`linear-gradient(135deg,${TEAL},${BLUE})` }}>
                  {initials(form.firstName, form.lastName)}
                </div>
            }
            <button onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl shadow-lg text-white flex items-center justify-center"
              style={{ background: TEAL }}>
              <Camera size={13} />
            </button>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">Dr. {form.firstName} {form.lastName}</p>
            <button onClick={() => fileRef.current?.click()} className="text-xs font-semibold hover:underline mt-1 block" style={{ color: TEAL }}>
              Change photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Personal Information</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="First Name" k="firstName" />
            <F label="Last Name"  k="lastName"  />
            <F label="Phone"      k="phone" type="tel" />
            <F label="Email"      k="email" type="email" />
            <div className="col-span-2"><F label="Designation / Specialization" k="designation" placeholder="e.g. Consultant Cardiologist" /></div>
            <div className="col-span-2"><F label="Languages Spoken" k="languagesSpoken" placeholder="e.g. Hindi, English" /></div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Practice Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="Consultation Fee (₹)" k="consultationFee" type="number" />
            <F label="Max Patients / Day"   k="maxDailyPatients" type="number" />
            <F label="Available From"       k="availableFrom" type="time" />
            <F label="Available To"         k="availableTo"   type="time" />
            <F label="Break From"           k="breakFrom"     type="time" />
            <F label="Break To"             k="breakTo"       type="time" />
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Slot Duration (min)</label>
              <select value={form.slotDurationMins}
                onChange={e => setForm(f => ({ ...f, slotDurationMins: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': `${TEAL}40` }}>
                {[10, 15, 20, 30, 45, 60].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Professional Bio</label>
          <textarea value={form.bio} rows={3}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': `${TEAL}40` }}
            placeholder="Brief professional summary…" />
        </div>
      </div>
      <div className="flex gap-3 px-7 py-5 border-t border-slate-100">
        <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ background: TEAL }}>
          {saving ? <><Loader size={13} className="animate-spin" />Saving…</> : <><Check size={13} />Save Changes</>}
        </button>
      </div>
    </Modal>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────
const OverviewTab = ({ profile, queue, weeklyStats, loading, upcomingCount }) => {
  const done    = queue.filter(x => (x.Status || x.status) === 'done');
  const waiting = queue.filter(x => (x.Status || x.status) === 'waiting');
  const current = queue.find(x  => (x.Status || x.status) === 'current');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Today's Queue" color={BLUE}    value={loading.queue ? null : queue.length}   loading={loading.queue}   trend={5}  />
        <StatCard icon={CheckCircle} label="Seen Today"    color="#059669" value={loading.queue ? null : done.length}    loading={loading.queue}   trend={12} />
        <StatCard icon={Clock}       label="In Queue"      color="#d97706" value={loading.queue ? null : waiting.length} loading={loading.queue}              />
        <StatCard icon={Bell}        label="Upcoming Visits" color="#ef4444" value={loading.requests ? null : upcomingCount} loading={loading.requests} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800">Weekly Patient Volume</h3>
              <p className="text-xs text-slate-400 mt-0.5">Patients seen per day this week</p>
            </div>
            <InfoBadge color={TEAL}>This Week</InfoBadge>
          </div>
          {loading.schedule ? <Sk h="h-48" r="rounded-2xl" /> :
            weeklyStats.length === 0
              ? <div className="h-48 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
              : <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyStats} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                      <defs>
                        <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={TEAL} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis                tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="patients" name="Patients" stroke={TEAL} strokeWidth={2.5} fill="url(#tealGrad)" dot={false} activeDot={{ r:4, fill:TEAL }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
          }
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Current Patient
              </p>
            </div>
            {loading.queue
              ? <div className="p-4"><Sk h="h-20" r="rounded-xl" /></div>
              : current
                ? <div className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-lg flex-shrink-0">
                      {(current.Name || current.name)?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{current.Name || current.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Token {current.Token || current.token} · {current.Age || current.age} yrs</p>
                      {(current.Reason || current.reason) && (
                        <p className="text-xs text-slate-400 italic mt-0.5 truncate">"{current.Reason || current.reason}"</p>
                      )}
                    </div>
                  </div>
                : <div className="py-8 flex flex-col items-center text-slate-400">
                    <Users size={22} className="mb-2 text-slate-200" />
                    <p className="text-xs">No patient in consultation</p>
                  </div>
            }
          </Card>

          <Card>
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today's Practice</p>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                ['Clinic Hours',  profile?.AvailableFrom && profile?.AvailableTo
                  ? `${fmtTime(profile.AvailableFrom)} – ${fmtTime(profile.AvailableTo)}` : '—'],
                ['Slot Duration', profile?.SlotDurationMins ? `${profile.SlotDurationMins} min` : '—'],
                ['Consult Fee',   profile?.ConsultationFee  ? `₹${profile.ConsultationFee}`    : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-slate-400">{k}</span>
                  <span className="text-xs font-bold text-slate-700">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── Queue Tab ────────────────────────────────────────────────────────────────
const QueueTab = ({ queue, loading, onRefresh, onCallIn, onMarkDone, onRx, search, setSearch, onComplete, onViewPatient }) => {
  const filtered = search
    ? queue.filter(p => (p.PatientFullName||p.PatientName||p.Name||p.name||'').toLowerCase().includes(search.toLowerCase()) || (p.TokenNumber||p.Token||p.token||'').toString().includes(search))
    : queue;

  return (
    <Card>
      <SectionHeader title="Today's Patient Queue" icon={Users} badge={queue.filter(x => (x.Status||x.status)==='waiting').length}>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none w-36" />
        </div>
        <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
      </SectionHeader>

      {loading
        ? [1,2,3,4,5].map(i => <SkRow key={i} />)
        : filtered.length === 0
          ? <Empty icon={Users} text="No patients in queue today" />
          : <>
              <div className="hidden lg:grid grid-cols-[56px_1fr_64px_1fr_130px_180px] gap-3 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
                {['Token','Patient','Age','Complaint','Time & Status','Actions'].map(h => (
                  <span key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest last:text-right">{h}</span>
                ))}
              </div>
              <div className="divide-y divide-slate-50">
                {filtered.map(pt => {
                  const rawSt = (pt.QueueStatus||pt.Status||pt.status||'waiting').toLowerCase();
                  // Map appointment statuses to queue display statuses
                  const stMap = {
                    scheduled:'waiting',
                    confirmed:'waiting',
                    called:'current',
                    serving:'current',
                    'in progress':'current',
                    served:'done',
                    completed:'done',
                    cancelled:'done',
                    skipped:'done',
                    noshow:'done',
                  };
                  const st = stMap[rawSt] || rawSt;
                  const tok = Q_STATUS[st] || Q_STATUS.waiting;
                  const id  = pt.Id||pt.id;
                  return (
                    <div key={id} className={`grid grid-cols-1 lg:grid-cols-[56px_1fr_64px_1fr_130px_180px] items-center gap-3 px-6 py-4 hover:bg-slate-50/70 transition-colors ${st==='done'?'opacity-50':''}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs ${tok.ring} ${tok.bg}`}>
                        {pt.TokenNumber||pt.Token||pt.token||'—'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{pt.PatientFullName||pt.PatientName||pt.Name||pt.name||'—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{pt.Gender||pt.gender} · {pt.PatientPhone||pt.Phone||pt.phone}</p>
                      </div>
                      <p className="text-sm text-slate-600">{(pt.Age||pt.age)?`${pt.Age||pt.age}yr`:'—'}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{pt.Reason||pt.reason||pt.VisitType||pt.Type||pt.type||'—'}</p>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {fmtTimeRange(pt.AppointmentTime || pt.StartTime || pt.time, pt.EndTime || pt.endTime)}
                        </p>
                        <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${tok.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tok.dot}`} />
                          {tok.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        {st==='waiting' && (
                          <button onClick={() => onCallIn(id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border"
                            style={{ color:TEAL, borderColor:`${TEAL}30`, background:`${TEAL}0c` }}>
                            Call In
                          </button>
                        )}
                        {st==='current' && (
                          <>
                            <button onClick={() => onViewPatient && onViewPatient(pt.PatientId||pt.patientId||pt.id, pt.PatientFullName||pt.PatientName||pt.Name||pt.name)}
                              className="p-2 rounded-xl border transition-colors"
                              style={{ color:'#64748b', borderColor:'#e2e8f0', background:'#f8fafc' }}
                              title="View history">
                              <Eye size={13} />
                            </button>
                            <button onClick={() => onRx(pt)}
                              className="p-2 rounded-xl border transition-colors"
                              style={{ color:BLUE, borderColor:`${BLUE}25`, background:`${BLUE}0c` }}>
                              <Pill size={13} />
                            </button>
                            <button onClick={() => onComplete && onComplete(pt)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-opacity"
                              style={{ background:'#059669' }}>
                              <CheckCircle size={11} /> Complete
                            </button>
                          </>
                        )}
                        {st==='done' && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <CheckCircle size={11} className="text-emerald-400" /> Done
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
      }
    </Card>
  );
};

// ─── Requests Tab ─────────────────────────────────────────────────────────────
const RequestsTab = ({ requests, loading, onRefresh, onViewPatient }) => (
  <Card>
    <SectionHeader title="Upcoming Appointments" icon={Calendar}
      badge={requests.length}>
      <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
    </SectionHeader>
    {loading
      ? [1,2,3].map(i => <SkRow key={i} />)
      : requests.length === 0
        ? <Empty icon={Calendar} text="No upcoming appointments" />
        : <div className="divide-y divide-slate-50">
            {requests.map(req => {
              const id        = req.Id||req.id;
              const patientId = req.PatientId||req.patientId;
              const st        = (req.Status||req.status||'pending').toLowerCase();
              const name      = req.PatientName||req.patientName||'Patient';
              return (
                <div key={id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors flex-wrap">
                  {/* Clickable avatar → opens patient history */}
                  <button
                    onClick={() => patientId && onViewPatient(patientId, name)}
                    title="View patient history"
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 border hover:ring-2 hover:ring-teal-300 transition-all"
                    style={{ background:`${TEAL}0c`, borderColor:`${TEAL}20`, color:TEAL }}>
                    {name[0]}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => patientId && onViewPatient(patientId, name)}
                        className="font-bold text-slate-800 text-sm hover:text-teal-600 hover:underline transition-colors text-left">
                        {name}
                      </button>
                      {patientId && (
                        <button onClick={() => onViewPatient(patientId, name)}
                          className="flex items-center gap-1 text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full hover:bg-teal-100 transition-colors font-semibold">
                          <Eye size={9}/> History
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {(req.Age||req.age) && <span className="text-xs text-slate-400">{req.Age||req.age} yrs</span>}
                      {(req.Gender||req.gender) && <span className="text-xs text-slate-400 capitalize">{req.Gender||req.gender}</span>}
                      <span className="text-xs text-slate-400 capitalize">{req.VisitType||req.Type||req.type||'OPD'}</span>
                      <span className="text-xs text-slate-400">
                        {fmtDate((req.AppointmentDate||req.Date||req.date||'').toString().slice(0,10))}
                        {(req.AppointmentTime || req.StartTime || req.EndTime) && (
                          <> · {fmtTimeRange(req.AppointmentTime || req.StartTime, req.EndTime || req.endTime)}</>
                        )}
                      </span>
                      {(req.UHID||req.uhid) && <span className="text-xs font-mono text-slate-400">{req.UHID||req.uhid}</span>}
                    </div>
                    {(req.Reason||req.reason) && (
                      <p className="text-xs text-slate-400 italic mt-1">"{req.Reason||req.reason}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={req.Status||req.status||'pending'} />
                    {['pending', 'scheduled', 'confirmed', 'rescheduled'].includes(st) && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-full">
                        <Clock size={10}/> Managed by OPD desk
                      </span>
                    )}
                    {st==='completed' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle size={10}/> Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
    }
  </Card>
);

// ─── Prescriptions Tab ────────────────────────────────────────────────────────
const RxTab = ({ prescriptions, loading, onRefresh, onNew, onDownload, onShowVersions }) => (
  <Card>
    <SectionHeader title="Issued Prescriptions" icon={Pill}>
      <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
      <button onClick={onNew} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: TEAL }}>
        <Plus size={13} /> New Rx
      </button>
    </SectionHeader>
    {loading
      ? [1,2,3].map(i => <SkRow key={i} />)
      : prescriptions.length === 0
        ? <Empty icon={Pill} text="No prescriptions issued yet" />
        : <div className="divide-y divide-slate-50">
            {prescriptions.map(rx => (
              <div key={rx.Id||rx.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background:`${TEAL}0c` }}>
                  <Pill size={14} style={{ color: TEAL }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{rx.RxNumber || 'Prescription'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{rx.Diagnosis || 'Consultation prescription'}</p>
                  <p className="text-xs text-slate-400">
                    Patient: {rx.PatientName || rx.patientName || '-'}
                    {' · '}
                    {getPrescriptionItems(rx).length} medicine(s)
                    {' · '}
                    {fmtDate(rx.RxDate || rx.PrescribedDate || rx.date)}
                    {' · '}
                    V{getPrescriptionVersion(rx)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <InfoBadge color={isPrescriptionFinalized(rx) ? '#047857' : '#b45309'}>
                    {isPrescriptionFinalized(rx) ? 'Finalized' : 'Draft'}
                  </InfoBadge>
                  <button
                    onClick={() => onShowVersions(rx)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Version history"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => onDownload(rx)}
                    disabled={!isPrescriptionFinalized(rx)}
                    className="p-2 rounded-xl text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title={isPrescriptionFinalized(rx) ? 'Download PDF' : 'Only finalized prescriptions can be downloaded'}
                  >
                    <Download size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
    }
  </Card>
);

const RxVersionModal = ({ open, rxNumber, loading, versions, onClose }) => {
  if (!open) return null;

  return (
    <Modal onClose={onClose}>
      <div className="px-6 py-5 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-900">Version History</h3>
        <p className="text-xs text-slate-500 mt-1">{rxNumber || 'Prescription'}</p>
      </div>

      <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader size={13} className="animate-spin" />
            Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-slate-500">No version history available.</p>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => (
              <div key={version.Id || version.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-700">
                  V{version.VersionNo || version.versionNo || 1}
                  {' · '}
                  {version.RxNumber || version.rxNumber || 'RX'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {Boolean(version.IsFinalized ?? version.isFinalized) ? 'Finalized' : 'Draft'}
                  {' · '}
                  {fmtDate(version.CreatedAt || version.createdAt || Date.now())}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
const ScheduleTab = ({ profile, schedule, todaySlots, weeklyStats, loading, onEdit, onRefresh }) => (
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
    <Card className="lg:col-span-2">
      <SectionHeader title="Practice Settings" icon={Clock}>
        <button onClick={onEdit} className="flex items-center gap-1 text-xs font-bold hover:underline" style={{ color: TEAL }}>
          <Edit2 size={11} /> Edit
        </button>
      </SectionHeader>
      {loading
        ? <div className="p-5 space-y-3">{[1,2,3,4,5,6].map(i => <Sk key={i} h="h-6" />)}</div>
        : <div className="divide-y divide-slate-50">
            {[
              ['Shift Hours',      (profile?.AvailableFrom && profile?.AvailableTo) ? `${fmtTime(profile.AvailableFrom)} – ${fmtTime(profile.AvailableTo)}` : '—'],
              ['Slot Duration',    profile?.SlotDurationMins ? `${profile.SlotDurationMins} min` : '—'],
              ['Max Patients',     profile?.MaxDailyPatients ? `${profile.MaxDailyPatients} / day` : '—'],
              ['Consultation Fee', profile?.ConsultationFee  ? `₹${profile.ConsultationFee}`       : '—'],
              ['Languages',        profile?.LanguagesSpoken  || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-slate-400">{k}</span>
                <span className="text-sm font-semibold text-slate-700">{v}</span>
              </div>
            ))}
          </div>
      }
    </Card>

    <div className="lg:col-span-3 space-y-5">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm">Weekly Patient Volume</h3>
          <button onClick={onRefresh} className="p-1.5 hover:bg-slate-100 rounded-xl"><RefreshCw size={12} className="text-slate-400" /></button>
        </div>
        {loading ? <Sk h="h-36" r="rounded-2xl" /> :
          weeklyStats.length === 0
            ? <div className="h-36 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm">No data</div>
            : <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyStats} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis                tick={{ fontSize:10, fill:'#94a3b8' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="patients" name="Patients" fill={TEAL} radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
        }
      </Card>

      <Card>
        <SectionHeader title="Today's Slot Availability" icon={Calendar}>
          <button onClick={onRefresh} className="p-1.5 hover:bg-slate-100 rounded-xl"><RefreshCw size={12} className="text-slate-400" /></button>
        </SectionHeader>
        {loading
          ? <div className="p-5"><div className="grid grid-cols-4 gap-2">{[...Array(8)].map((_,i) => <Sk key={i} h="h-12" r="rounded-xl" />)}</div></div>
          : todaySlots.length === 0
            ? <div className="flex flex-col items-center py-10 text-slate-400">
                <Clock size={22} className="mb-2 text-slate-200" />
                <p className="text-sm">No slots configured</p>
                <button onClick={onEdit} className="mt-2 text-xs font-bold hover:underline" style={{ color: TEAL }}>Set up schedule</button>
              </div>
            : <div className="p-5">
                <div className="grid grid-cols-4 gap-2">
                  {todaySlots.map((s, idx) => {
                    const booked = !s.available;
                    return (
                      <div key={s.Id||s.id||idx}
                        className={`flex flex-col items-center py-2.5 px-2 rounded-xl border text-xs font-semibold ${booked?'bg-slate-100 border-slate-200 text-slate-400':'text-teal-700'}`}
                        style={!booked ? { background:`${TEAL}0c`, borderColor:`${TEAL}25` } : {}}>
                        <span>{fmtTimeRange(s.StartTime || s.time, s.EndTime || s.endTime)}</span>
                        <span className={`text-[10px] mt-0.5 ${booked?'text-slate-400':'text-teal-500'}`}>{booked?'Booked':'Open'}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background:TEAL }} />Open</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" />Booked</span>
                  <span className="ml-auto font-semibold text-slate-600">
                    {todaySlots.filter(s => s.available).length}/{todaySlots.length} available
                  </span>
                </div>
              </div>
        }
      </Card>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function DoctorDashboard() {
  const { user } = useAuth();

  const [profile,       setProfile]       = useState(null);
  const [queue,         setQueue]         = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [schedule,      setSchedule]      = useState(null);
  const [todaySlots,    setTodaySlots]    = useState([]);
  const [weeklyStats,   setWeeklyStats]   = useState([]);

  const [loading,     setLoading]     = useState({ profile:true, queue:true, requests:true, prescriptions:true, schedule:true });
  const [activeTab,   setActiveTab]   = useState('overview');
  const [search,      setSearch]      = useState('');
  const [showProfile,  setShowProfile]  = useState(false);
  const [showPatient,  setShowPatient]  = useState(null); // { patientId, patientName }
  const [showComplete, setShowComplete] = useState(null); // appointment to complete
  const [showRx,      setShowRx]      = useState(null);
  const [profilePic,  setProfilePic]  = useState(null);
  const [rxVersionModal, setRxVersionModal] = useState({
    open: false,
    rxNumber: '',
    loading: false,
    versions: [],
  });

  const setL = (k, v) => setLoading(l => ({ ...l, [k]: v }));

  // ── fetchProfile ────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      const r = await api.get('/doctors/profile');
      const d = r?.data?.data ?? r?.data ?? r;
      setProfile(d);
      setProfilePic(d?.ProfilePicUrl || d?.profilePicUrl || null);
    } catch {}
    finally { setL('profile', false); }
  }, []);

  // ── fetchQueue ──────────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    setL('queue', true);
    try {
      const r    = await api.get(`/appointments/my-queue?date=${new Date().toISOString().split('T')[0]}`);
      const list = r?.data?.data ?? r?.data ?? r ?? [];
      setQueue(Array.isArray(list) ? list : []);
    } catch { setQueue([]); }
    finally { setL('queue', false); }
  }, []);

  // ── fetchRequests ───────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setL('requests', true);
    try {
      const r    = await api.get('/appointments/pending-requests');
      const list = r?.data?.data ?? r?.data ?? r ?? [];
      setRequests(Array.isArray(list) ? list : []);
    } catch { setRequests([]); }
    finally { setL('requests', false); }
  }, []);

  // ── fetchPrescriptions ──────────────────────────────────────────────────────
  const fetchPrescriptions = useCallback(async () => {
    setL('prescriptions', true);
    try {
      const list = getList(await api.get('/prescriptions/issued'));
      setPrescriptions(Array.isArray(list) ? list : []);
    } catch { setPrescriptions([]); }
    finally { setL('prescriptions', false); }
  }, []);

  const downloadPrescriptionPdf = useCallback(async (rx) => {
    const prescriptionId = getPrescriptionId(rx);
    if (!prescriptionId) {
      toast.error('Prescription reference missing');
      return;
    }
    if (!isPrescriptionFinalized(rx)) {
      toast.error('Only finalized prescriptions can be downloaded');
      return;
    }

    try {
      const fileBlob = await api.get(`/prescriptions/${prescriptionId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(fileBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${rx?.RxNumber || `prescription-${prescriptionId}`}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.message || 'Unable to download prescription');
    }
  }, []);

  const showPrescriptionVersions = useCallback(async (rx) => {
    const prescriptionId = getPrescriptionId(rx);
    if (!prescriptionId) {
      toast.error('Prescription reference missing');
      return;
    }

    setRxVersionModal({
      open: true,
      rxNumber: rx?.RxNumber || `Prescription #${prescriptionId}`,
      loading: true,
      versions: [],
    });

    try {
      const payload = getPayload(await api.get(`/prescriptions/${prescriptionId}/versions`)) || {};
      const versions = payload?.data || payload;
      setRxVersionModal({
        open: true,
        rxNumber: rx?.RxNumber || `Prescription #${prescriptionId}`,
        loading: false,
        versions: Array.isArray(versions) ? versions : [],
      });
    } catch (error) {
      setRxVersionModal({
        open: true,
        rxNumber: rx?.RxNumber || `Prescription #${prescriptionId}`,
        loading: false,
        versions: [],
      });
      toast.error(error?.message || 'Unable to load version history');
    }
  }, []);

  // ── fetchSchedule ───────────────────────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    setL('schedule', true);
    try {
      // Use DoctorProfileId from profile if available, fallback to user id
      const doctorId = user?.DoctorProfileId || user?.doctorProfileId || user?.doctorId || user?.id;
      const today    = new Date().toISOString().split('T')[0];

      const [sched, slots, stats] = await Promise.allSettled([
        api.get('/doctors/schedule'),
        api.get(`/appointments/slots?doctorId=${doctorId}&date=${today}`),
        api.get('/doctors/weekly-stats'),
      ]);

      // Schedule: returns array of rows — use profile directly for settings display
      if (sched.status === 'fulfilled') {
        const arr = sched.value?.data?.data ?? sched.value?.data ?? sched.value ?? [];
        setSchedule(Array.isArray(arr) ? (arr[0] ?? null) : arr);
      }

      // Slots: returns { success, available, slots: [...] }
      if (slots.status === 'fulfilled') {
        const v    = slots.value?.data ?? slots.value ?? {};
        const list = v?.slots ?? v?.data ?? v ?? [];
        setTodaySlots(Array.isArray(list) ? list : []);
      }

      // Weekly stats: returns { success, data: { TotalThisWeek, Completed, TodayTotal, ... } }
      if (stats.status === 'fulfilled') {
        const raw = stats.value?.data?.data ?? stats.value?.data ?? stats.value ?? {};
        if (Array.isArray(raw)) {
          setWeeklyStats(raw);
        } else {
          // Build a week array using the flat stats object
          const days    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          const todayDow = new Date().getDay(); // 0=Sun,1=Mon...
          // Reorder so today is last
          const pivot   = todayDow === 0 ? 6 : todayDow - 1;
          const ordered = [...days.slice(pivot + 1), ...days.slice(0, pivot + 1)];
          setWeeklyStats(ordered.map((day, i) => ({
            day,
            patients: i === ordered.length - 1 ? (raw.TodayTotal || 0) : 0,
          })));
        }
      }
    } catch {}
    finally { setL('schedule', false); }
  }, [user]);

  const refreshLiveAppointmentData = useCallback(() => {
    if (document.hidden) return;
    fetchQueue();
    fetchRequests();
    fetchPrescriptions();
    fetchSchedule();
  }, [fetchPrescriptions, fetchQueue, fetchRequests, fetchSchedule]);

  useEffect(() => {
    fetchProfile();
    fetchQueue();
    fetchRequests();
    fetchPrescriptions();
    fetchSchedule();
  }, [fetchProfile, fetchQueue, fetchRequests, fetchPrescriptions, fetchSchedule]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshLiveAppointmentData();
      }
    };

    const intervalId = window.setInterval(refreshLiveAppointmentData, 30000);
    window.addEventListener('focus', refreshLiveAppointmentData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshLiveAppointmentData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshLiveAppointmentData]);

  const callPatient = async (id) => {
    try {
      await api.patch(`/appointments/${id}/call`);
      setQueue(q => q.map(p => ({
        ...p,
        Status: (p.Id||p.id)===id ? 'current' : (p.Status||p.status)==='current' ? 'waiting' : (p.Status||p.status),
        status: (p.Id||p.id)===id ? 'current' : (p.Status||p.status)==='current' ? 'waiting' : (p.Status||p.status),
      })));
      toast.success('Patient called in');
      fetchQueue();
    } catch (e) { toast.error(e?.message || 'Could not update queue'); }
  };

  const markDone = async (id) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status: 'Completed' });
      setQueue(q => q.map(p => (p.Id||p.id)===id ? { ...p, Status:'Completed', status:'done' } : p));
      refreshLiveAppointmentData();
    } catch (e) { toast.error(e?.message || 'Could not update status'); }
  };;

  const p          = profile || {};
  const doctorName = `Dr. ${p.FirstName||user?.firstName||''} ${p.LastName||user?.lastName||''}`.trim();
  // Filter: show non-completed, non-cancelled requests
  const activeRequests = requests.filter(x => {
    const st = (x.Status||x.status||'').toLowerCase();
    return st !== 'completed' && st !== 'cancelled' && st !== 'noshow';
  });
  const waiting    = queue.filter(x   => (x.Status||x.status)==='waiting');
  const current    = queue.find(x    => (x.Status||x.status)==='current');

  const TABS = [
    { key:'overview',  label:'Overview',       icon:Activity   },
    { key:'queue',     label:"Today's Queue",  icon:Users,    badge:waiting.length  },
    { key:'requests',  label:'Upcoming',       icon:Calendar, badge:activeRequests.length },
    { key:'rx',        label:'Prescriptions',  icon:Pill                            },
    { key:'schedule',  label:'Schedule',       icon:Clock                           },
    { key:'analytics', label:'Analytics',      icon:BarChart2                       },
    { key:'profile',   label:'My Profile',     icon:Edit2                           },
  ];

  const tabContent = {
    overview: <OverviewTab profile={p} queue={queue} weeklyStats={weeklyStats} loading={loading} upcomingCount={activeRequests.length} />,
    queue: (
      <QueueTab queue={queue} loading={loading.queue} onRefresh={fetchQueue}
        onViewPatient={(patientId, name) => setShowPatient({ patientId, patientName: name })}
        onComplete={pt => setShowComplete(pt)}
        onCallIn={callPatient} onMarkDone={markDone} onRx={setShowRx}
        search={search} setSearch={setSearch} />
    ),
    requests: (
      <RequestsTab requests={activeRequests} loading={loading.requests} onRefresh={fetchRequests}
        onViewPatient={(patientId, name) => setShowPatient({ patientId, patientName: name })} />
    ),
    rx: (
      <RxTab prescriptions={prescriptions} loading={loading.prescriptions}
        onRefresh={fetchPrescriptions}
        onDownload={downloadPrescriptionPdf}
        onShowVersions={showPrescriptionVersions}
        onNew={() => {
          if (current) {
            setShowRx(current);
            return;
          }
          toast.error('Open a patient from the queue before writing a prescription');
        }} />
    ),
    schedule: (
      <ScheduleTab profile={p} schedule={schedule} todaySlots={todaySlots} weeklyStats={weeklyStats}
        loading={loading.schedule} onEdit={() => setShowProfile(true)} onRefresh={fetchSchedule} />
    ),
    analytics: (
      <Card className="p-8">
        <div className="flex flex-col items-center text-slate-400">
          <BarChart2 size={32} className="mb-3 text-slate-200" />
          <p className="font-semibold text-slate-500">Analytics coming soon</p>
          <p className="text-sm mt-1">Detailed patient and revenue analytics will appear here.</p>
        </div>
      </Card>
    ),
    profile: (
      <Card className="p-6">
        <div className="flex items-center gap-5 mb-6">
          {profilePic
            ? <img src={profilePic} className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 shadow" alt="profile" />
            : <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow"
                style={{ background:`linear-gradient(135deg,${TEAL},${BLUE})` }}>
                {initials(p.FirstName||user?.firstName, p.LastName||user?.lastName)}
              </div>
          }
          <div>
            <h2 className="text-xl font-bold text-slate-900">{doctorName}</h2>
            <p className="text-slate-500 text-sm">{p.Designation||p.designation||'Specialist'}</p>
            <button onClick={() => setShowProfile(true)}
              className="mt-2 flex items-center gap-1.5 text-sm font-bold hover:underline" style={{ color: TEAL }}>
              <Edit2 size={12} /> Edit Profile
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Email',       p.Email           || user?.email || '—'],
            ['Phone',       p.Phone           || user?.phone || '—'],
            ['Languages',   p.LanguagesSpoken || '—'],
            ['Consult Fee', p.ConsultationFee  ? `₹${p.ConsultationFee}` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-400 mb-0.5">{k}</p>
              <p className="text-sm font-semibold text-slate-700">{v}</p>
            </div>
          ))}
        </div>
      </Card>
    ),
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{doctorName}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {p.Designation||p.designation||'Specialist'}
            {(p.ConsultationFee||p.consultationFee) && (
              <span className="ml-2 font-semibold" style={{ color: TEAL }}>
                · ₹{p.ConsultationFee||p.consultationFee} / visit
              </span>
            )}
          </p>
        </div>
        <button onClick={() => setShowProfile(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors"
          style={{ color:TEAL, borderColor:`${TEAL}30`, background:`${TEAL}08` }}>
          <Edit2 size={13} /> Edit Profile
        </button>
      </div>

      {/* ── Current patient banner ── */}
      {!loading.queue && current && (
        <div className="rounded-2xl border border-emerald-100 overflow-hidden bg-white shadow-sm mb-6">
          <div className="flex items-center gap-2 px-5 py-2" style={{ background:'#059669' }}>
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <p className="text-white text-xs font-bold tracking-widest uppercase">Currently In Consultation</p>
          </div>
          <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xl flex-shrink-0">
              {(current.Name||current.name)?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800">{current.Name||current.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {current.Age||current.age ? `${current.Age||current.age} yrs · ` : ''}
                {current.Type||current.type} · Token #{current.Token||current.token}
              </p>
              {(current.Reason||current.reason) && (
                <p className="text-xs text-slate-400 italic mt-0.5">"{current.Reason||current.reason}"</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRx(current)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold"
                style={{ color:TEAL, borderColor:`${TEAL}30`, background:`${TEAL}0c` }}>
                <Pill size={13} /> Write Rx
              </button>
              <button onClick={() => setShowComplete(current)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                style={{ background:'#059669' }}>
                <CheckCircle size={13} /> Mark Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── The Two-Column Layout ── */}
      <DashboardTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} theme="teal" />

      <div className="w-full min-w-0 transition-all">
        {tabContent[activeTab] || null}
      </div>

      {/* ── Modals ── */}
      {showComplete && (
        <CompleteAppointmentModal
          appointment={showComplete}
          onClose={() => setShowComplete(null)}
          onCompleted={() => {
            setShowComplete(null);
            fetchQueue();
            fetchRequests();
            fetchPrescriptions();
            fetchSchedule();
          }}
        />
      )}
      {showPatient && (
        <PatientHistoryModal
          patientId={showPatient.patientId}
          patientName={showPatient.patientName}
          onClose={() => setShowPatient(null)}
          onRx={p => { setShowRx(p); setShowPatient(null); }}
        />
      )}
      {showProfile && (
        <ProfileModal profile={profile||user} avatar={profilePic} onClose={() => setShowProfile(false)}
          onSave={d => { setProfile(pr => ({ ...pr, ...d })); setProfilePic(d.profilePicUrl); fetchSchedule(); setShowProfile(false); }} />
      )}
      <RxVersionModal
        open={rxVersionModal.open}
        rxNumber={rxVersionModal.rxNumber}
        loading={rxVersionModal.loading}
        versions={rxVersionModal.versions}
        onClose={() => setRxVersionModal({ open: false, rxNumber: '', loading: false, versions: [] })}
      />
      {showRx && (
        <PrescriptionComposerModal
          patient={showRx}
          onClose={() => setShowRx(null)}
          onSaved={() => {
            fetchPrescriptions();
            fetchQueue();
            fetchRequests();
            setShowRx(null);
          }}
        />
      )}
    </div>
  );
}
