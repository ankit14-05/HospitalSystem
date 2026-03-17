// src/pages/appointments/AppointmentBookingModal.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Loader, ChevronRight, Check, CheckCircle, AlertCircle,
  Bell, RefreshCw, Building2, Search, Stethoscope
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const BLUE = '#4f46e5';
const getHospitalId = () => String(localStorage.getItem('hospitalId') || '1');

const VISIT_TYPES = [
  { key: 'OPD',       label: 'OPD',       desc: 'Out Patient'       },
  { key: 'Emergency', label: 'Emergency', desc: 'Urgent care'       },
  { key: 'FollowUp',  label: 'Follow-up', desc: 'Review visit'      },
  { key: 'IPD',       label: 'IPD',       desc: 'In Patient'        },
];

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const Sk = ({ w = 'w-full', h = 'h-4', r = 'rounded-lg' }) => (
  <div className={`${w} ${h} ${r} bg-slate-100 animate-pulse`} />
);

function extractArray(res) {
  const d = res?.data ?? res;
  if (Array.isArray(d))              return d;
  if (Array.isArray(d?.data))        return d.data;
  if (Array.isArray(d?.departments)) return d.departments;
  if (Array.isArray(d?.doctors))     return d.doctors;
  if (Array.isArray(d?.patients))    return d.patients;
  if (Array.isArray(d?.results))     return d.results;
  if (typeof d === 'object' && d) {
    for (const v of Object.values(d)) if (Array.isArray(v) && v.length) return v;
    for (const v of Object.values(d)) if (Array.isArray(v)) return v;
  }
  return [];
}

const getDeptId   = d => d?.Id   ?? d?.id   ?? d?.DepartmentId   ?? d?.departmentId   ?? '';
const getDeptName = d => d?.Name ?? d?.name ?? d?.DepartmentName ?? d?.departmentName ?? '(unnamed)';
const getDocId    = d => d?.Id   ?? d?.id   ?? d?.DoctorId        ?? d?.doctorId       ?? '';
const getDocFirst = d => d?.FirstName  ?? d?.firstName  ?? '';
const getDocLast  = d => d?.LastName   ?? d?.lastName   ?? '';
const getDocSpec  = d => d?.SpecializationName ?? d?.Specialization ?? d?.Designation ?? d?.designation ?? 'Specialist';
const normalizeSlot = slot => {
  if (typeof slot === 'string') return { time: slot, available: true };
  const time = slot?.time || slot?.StartTime || slot?.AppointmentTime || '';
  const available = slot?.available ?? !(slot?.isBooked ?? slot?.IsBooked ?? false);
  return { ...slot, time, available, isBooked: !available };
};

const PickBtn = ({ selected, onClick, children, sub }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-left transition-all ${
      selected
        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
        : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
    }`}>
    <span className="block leading-tight">{children}</span>
    {sub && <span className="block text-[11px] opacity-60 mt-0.5">{sub}</span>}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function AppointmentBookingModal({ onClose, onSuccess, prefilledPatientId = null }) {
  const hospitalId = getHospitalId();
  const [step,       setStep]      = useState(1);
  const [submitting, setSubmitting]= useState(false);

  const [patients,   setPatients]  = useState([]);
  const [departments,setDepts]     = useState([]);
  const [doctors,    setDoctors]   = useState([]);
  const [slots,      setSlots]     = useState([]);

  const [deptError,  setDeptError] = useState('');
  const [docError,   setDocError]  = useState('');

  const [ldPat,  setLdPat]  = useState(false);
  const [ldDept, setLdDept] = useState(true);
  const [ldDoc,  setLdDoc]  = useState(false);
  const [ldSlots,setLdSlots]= useState(false);

  const [patSearch,  setPatSearch] = useState('');
  const [selPatient, setSelPatient]= useState(null);
  const [selDoctor,  setSelDoctor] = useState(null);

  const [form, setForm] = useState({
    patientId:       prefilledPatientId || '',
    departmentId:    '',
    doctorId:        '',
    appointmentDate: '',
    appointmentTime: '',
    visitType:       'OPD',
    reason:          '',
    priority:        'Normal',
  });

  // ── Correct endpoint confirmed from server logs ───────────────────────────
  // ✅  GET /api/v1/hospitals/1/departments  → 304
  // ❌  GET /api/v1/departments              → 404
  const loadDepts = async () => {
    setLdDept(true);
    setDeptError('');
    try {
      const res = await api.get(`/departments?hospitalId=${hospitalId}`);
      const arr = extractArray(res);
      setDepts(arr);
      if (!arr.length) setDeptError('No departments found for this hospital.');
    } catch (e) {
      // fallback — try without hospital scoping
      try {
        const res2 = await api.get(`/hospitals/${hospitalId}/departments`);
        const arr2 = extractArray(res2);
        setDepts(arr2);
        if (!arr2.length) setDeptError('No departments configured yet.');
      } catch {
        setDeptError('Could not load departments. Please refresh and try again.');
      }
    } finally {
      setLdDept(false);
    }
  };

  useEffect(() => { loadDepts(); }, [hospitalId]);

  // ── Patient search ────────────────────────────────────────────────────────
  // Logs show /api/v1/patients?search=... returns 404 for this user role.
  // The patient portal likely uses a different search endpoint.
  useEffect(() => {
    if (prefilledPatientId) return; // skip if pre-filled
    if (!patSearch || patSearch.length < 2) { setPatients([]); return; }
    setLdPat(true);
    const t = setTimeout(async () => {
      // try hospital-scoped first, then generic
      const endpoints = [
        `/hospitals/${hospitalId}/patients?search=${encodeURIComponent(patSearch)}&limit=8`,
        `/patients?search=${encodeURIComponent(patSearch)}&limit=8`,
        `/patients/search?q=${encodeURIComponent(patSearch)}&limit=8`,
      ];
      for (const ep of endpoints) {
        try {
          const res = await api.get(ep);
          const arr = extractArray(res);
          setPatients(arr);
          setLdPat(false);
          return;
        } catch { /* try next */ }
      }
      setPatients([]);
      setLdPat(false);
    }, 300);
    return () => clearTimeout(t);
  }, [hospitalId, patSearch, prefilledPatientId]);

  // ── Doctors when dept changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!form.departmentId) { setDoctors([]); return; }
    setLdDoc(true);
    setDocError('');
    setForm(f => ({ ...f, doctorId: '' }));
    setSelDoctor(null);
    const deptId = form.departmentId;

    const tryLoad = async () => {
      const endpoints = [
        `/doctors?hospitalId=${hospitalId}&departmentId=${deptId}&isActive=1`,
        `/hospitals/${hospitalId}/departments/${deptId}/doctors`,
        `/doctors?hospitalId=${hospitalId}&departmentId=${deptId}`,
      ];
      for (const ep of endpoints) {
        try {
          const arr = extractArray(await api.get(ep)).map((doc) => ({
            ...doc,
            DoctorId: getDocId(doc),
          })).filter((doc) => Number.parseInt(String(getDocId(doc)), 10) > 0);
          setDoctors(arr);
          return;
        } catch { /* try next */ }
      }
      setDocError('Could not load doctors for this department.');
    };
    tryLoad().finally(() => setLdDoc(false));
  }, [form.departmentId, hospitalId]);

  useEffect(() => {
    if (!form.doctorId || !form.appointmentDate) {
      setSlots([]);
      return;
    }

    setLdSlots(true);
    setForm((prev) => ({ ...prev, appointmentTime: '' }));

    api.get(`/doctors/${form.doctorId}/slots?date=${form.appointmentDate}`)
      .then((res) => {
        const data = res?.data ?? res;
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.slots)
            ? data.slots
            : Array.isArray(data?.data)
              ? data.data
              : [];

        setSlots(
          arr
            .map(normalizeSlot)
            .filter((slot) => slot.time && slot.available)
        );
      })
      .catch(() => setSlots([]))
      .finally(() => setLdSlots(false));
  }, [form.doctorId, form.appointmentDate]);

  const selDeptObj = departments.find(d => String(getDeptId(d)) === String(form.departmentId));

  // ── Navigation ────────────────────────────────────────────────────────────
  const next = () => {
    if (step === 1) {
      if (!form.patientId)    return toast.error('Please select a patient');
      if (!form.departmentId) return toast.error('Please select a department');
      if (!form.doctorId)     return toast.error('Please select a doctor');
    }
    if (step === 2) {
      if (!form.appointmentDate) return toast.error('Please select a date');
      if (!form.appointmentTime) return toast.error('Please select a time slot');
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    if (!form.reason.trim()) return toast.error('Please describe the reason for visit');
    setSubmitting(true);
    try {
      await api.post('/appointments', form);
      toast.success(
        <div>
          <p className="font-semibold">Appointment booked! 🎉</p>
          <p className="text-xs opacity-80 mt-0.5">Notifications sent to patient and doctor</p>
        </div>,
        { duration: 4000 }
      );
      onSuccess();
    } catch (e) {
      toast.error(e?.message || 'Booking failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const STEPS = ['Patient & Doctor', 'Date & Time', 'Confirm & Book'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-7 pt-6 pb-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Schedule Appointment</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                Step {step} of 3 — <span className="font-semibold text-indigo-600">{STEPS[step - 1]}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={15} className="text-slate-400" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {[1,2,3].map(n => (
              <div key={n} className="h-1.5 flex-1 rounded-full transition-all duration-500"
                style={{ background: n <= step ? BLUE : '#e2e8f0' }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* Patient search (skip if pre-filled) */}
              {!prefilledPatientId && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Patient *</label>
                  {selPatient ? (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-indigo-300 bg-indigo-50">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {(selPatient.FirstName ?? selPatient.firstName ?? '?')[0]}
                        {(selPatient.LastName  ?? selPatient.lastName  ?? '')[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">
                          {selPatient.FirstName ?? selPatient.firstName} {selPatient.LastName ?? selPatient.lastName}
                        </p>
                        <p className="text-xs text-slate-400">
                          UHID: {selPatient.UHID ?? selPatient.uhid ?? '—'} · {selPatient.Phone ?? selPatient.phone ?? '—'}
                        </p>
                      </div>
                      <button onClick={() => { setSelPatient(null); setForm(f => ({ ...f, patientId: '' })); setPatSearch(''); }}
                        className="p-1.5 hover:bg-indigo-100 rounded-lg"><X size={12} /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={patSearch} onChange={e => setPatSearch(e.target.value)}
                        placeholder="Search by name, UHID, or phone…"
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                      {ldPat && <Loader size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
                      {patients.length > 0 && (
                        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                          {patients.map(p => {
                            const pid = p.Id ?? p.id ?? p.PatientId ?? p.patientId;
                            const fn  = p.FirstName ?? p.firstName ?? '';
                            const ln  = p.LastName  ?? p.lastName  ?? '';
                            return (
                              <button key={pid}
                                onClick={() => { setSelPatient(p); setForm(f => ({ ...f, patientId: pid })); setPatients([]); setPatSearch(''); }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {fn[0]}{ln[0]}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-700 text-sm">{fn} {ln}</p>
                                  <p className="text-xs text-slate-400">{p.UHID ?? p.uhid ?? '—'} · {p.Phone ?? p.phone ?? '—'}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {patSearch.length >= 2 && !ldPat && patients.length === 0 && (
                        <p className="mt-2 text-xs text-slate-400 pl-1">No patients found for "{patSearch}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Department */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Department *</label>
                  {(deptError || departments.length === 0) && !ldDept && (
                    <button onClick={loadDepts} className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline">
                      <RefreshCw size={10} /> Retry
                    </button>
                  )}
                </div>

                {ldDept ? (
                  <div className="grid grid-cols-2 gap-2">{[...Array(6)].map((_, i) => <Sk key={i} h="h-12" r="rounded-xl" />)}</div>
                ) : deptError ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-red-100 bg-red-50">
                    <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-600 flex-1">{deptError}</span>
                    <button onClick={loadDepts} className="p-1.5 hover:bg-red-100 rounded-lg flex-shrink-0">
                      <RefreshCw size={13} className="text-red-500" />
                    </button>
                  </div>
                ) : departments.length === 0 ? (
                  <div className="flex flex-col items-center py-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                    <Building2 size={24} className="text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-500">No departments found</p>
                    <button onClick={loadDepts} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline">
                      <RefreshCw size={11} /> Try again
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map(d => {
                      const id = getDeptId(d);
                      return (
                        <PickBtn key={id}
                          selected={String(form.departmentId) === String(id)}
                          onClick={() => setForm(f => ({ ...f, departmentId: id }))}>
                          {getDeptName(d)}
                        </PickBtn>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Doctors */}
              {form.departmentId && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Doctor *</label>
                  {ldDoc ? (
                    <div className="space-y-2">{[...Array(2)].map((_, i) => <Sk key={i} h="h-20" r="rounded-2xl" />)}</div>
                  ) : docError ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-red-100 bg-red-50">
                      <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-600">{docError}</span>
                    </div>
                  ) : doctors.length === 0 ? (
                    <div className="flex flex-col items-center py-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                      <Stethoscope size={22} className="text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-500">No doctors available in this department</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {doctors.map(doc => {
                        const id = getDocId(doc);
                        const fn = getDocFirst(doc);
                        const ln = getDocLast(doc);
                        return (
                          <button key={id} type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, doctorId: id, appointmentTime: '' }));
                              setSlots([]);
                              setSelDoctor(doc);
                            }}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                              String(form.doctorId) === String(id)
                                ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                                : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}>
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                              {fn[0]}{ln[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-sm">Dr. {fn} {ln}</p>
                              <p className="text-xs text-slate-400">{getDocSpec(doc)}</p>
                              {(doc.ExperienceYears ?? doc.experienceYears) && (
                                <p className="text-xs text-slate-400">{doc.ExperienceYears ?? doc.experienceYears} yrs exp</p>
                              )}
                            </div>
                            {(doc.ConsultationFee ?? doc.consultationFee) && (
                              <p className="text-sm font-bold flex-shrink-0 text-indigo-600">
                                ₹{doc.ConsultationFee ?? doc.consultationFee}
                              </p>
                            )}
                            {String(form.doctorId) === String(id) && (
                              <Check size={15} className="text-indigo-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Visit Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {VISIT_TYPES.map(t => (
                    <PickBtn key={t.key} selected={form.visitType === t.key}
                      onClick={() => setForm(f => ({ ...f, visitType: t.key }))} sub={t.desc}>
                      {t.label}
                    </PickBtn>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Priority</label>
                <div className="flex gap-2">
                  {['Normal','High','Emergency'].map(p => (
                    <button key={p} type="button" onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        form.priority === p
                          ? p === 'Emergency' ? 'border-red-400 bg-red-50 text-red-700'
                            : p === 'High' ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>{p}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Appointment Date *</label>
                <input type="date" value={form.appointmentDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value, appointmentTime: '' }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Time Slot *</label>
                {ldSlots ? (
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(8)].map((_, i) => <Sk key={i} h="h-10" r="rounded-xl" />)}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">
                    No available slots for the selected doctor and date
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(slot => {
                      const time = slot.time;
                      return (
                        <button key={time} type="button" onClick={() => setForm(f => ({ ...f, appointmentTime: time }))}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            form.appointmentTime === time
                              ? 'border-indigo-400 bg-indigo-600 text-white shadow-sm'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}>{time}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Reason for Visit *</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Describe symptoms or reason for this appointment…"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>

              <div className="rounded-2xl border border-indigo-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-white px-5 py-3 border-b border-indigo-100">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Booking Summary</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {[
                    selDoctor ? ['Doctor',     `Dr. ${getDocFirst(selDoctor)} ${getDocLast(selDoctor)}`] : null,
                    selDeptObj ? ['Department', getDeptName(selDeptObj)] : null,
                    ['Date', form.appointmentDate
                      ? new Date(form.appointmentDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'short', year:'numeric' })
                      : '—'],
                    ['Time',       form.appointmentTime || '—'],
                    ['Visit Type', form.visitType],
                    ['Priority',   form.priority],
                    selDoctor && (selDoctor.ConsultationFee ?? selDoctor.consultationFee)
                      ? ['Fee', `₹${selDoctor.ConsultationFee ?? selDoctor.consultationFee}`]
                      : null,
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-5 py-3">
                      <span className="text-xs text-slate-400">{k}</span>
                      <span className="text-sm font-semibold text-slate-700">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <Bell size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Notifications will be sent</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Email + in-app notification to both patient and doctor.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-7 py-5 border-t border-slate-100 flex-shrink-0">
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Back
            </button>
          )}
          <button type="button" onClick={step < 3 ? next : submit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
            style={{ background: BLUE }}>
            {submitting
              ? <><Loader size={14} className="animate-spin" /> Booking…</>
              : step === 3
                ? <><CheckCircle size={14} /> Confirm & Book</>
                : <>Continue <ChevronRight size={14} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
