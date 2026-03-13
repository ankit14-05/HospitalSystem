// src/pages/dashboard/PatientDashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar, FileText, Pill, Receipt, Phone, Heart, Activity,
  User, Camera, X, Check, Clock, Download, Plus, Shield,
  CheckCircle, XCircle, RefreshCw, Loader, Edit2, Bell,
  Thermometer, Droplets, Weight, ArrowRight, AlertCircle, FlaskConical
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  TEAL, BLUE, Sk, StatCard, StatusBadge, Empty,
  SectionHeader, Card, Modal, fmtDate, fmtTime, initials, InfoBadge
} from '../../components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Safely parse a date — returns null for invalid/missing values instead of NaN
const safeDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};
const safeDay   = (val) => safeDate(val)?.getDate()                                    ?? '—';
const safeMon   = (val) => safeDate(val)?.toLocaleString('en', { month: 'short' })     ?? '';

// ─── Vital Card ───────────────────────────────────────────────────────────────
const VitalCard = ({ icon: Icon, label, value, unit, normal, color, loading }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${normal ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
        {normal ? 'Normal' : 'Alert'}
      </span>
    </div>
    {loading ? <><Sk w="w-20" h="h-7" /><Sk w="w-16" h="h-3" /></> : (
      <>
        <div>
          <p className="text-2xl font-bold text-slate-800 leading-none">{value != null ? value : '—'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{unit}</p>
        </div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </>
    )}
  </div>
);

const SkRow = () => (
  <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-50">
    <Sk w="w-11" h="h-11" r="rounded-2xl" />
    <div className="flex-1 space-y-2"><Sk w="w-44" h="h-3.5" /><Sk w="w-32" h="h-3" /></div>
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

// ─── Profile Modal ────────────────────────────────────────────────────────────
const ProfileModal = ({ profile, onClose, onSave }) => {
  const [form, setForm] = useState({
    firstName:      profile?.FirstName      || profile?.firstName      || '',
    lastName:       profile?.LastName       || profile?.lastName       || '',
    phone:          profile?.Phone          || profile?.phone          || '',
    email:          profile?.Email          || profile?.email          || '',
    gender:         profile?.Gender         || profile?.gender         || '',
    dateOfBirth:    (profile?.DateOfBirth   || profile?.dateOfBirth    || '').split('T')[0],
    bloodGroup:     profile?.BloodGroup     || profile?.bloodGroup     || '',
    address:        profile?.Street1        || profile?.address        || '',
    emergencyPhone: profile?.EmergencyPhone || profile?.emergencyPhone || '',
    emergencyName:  profile?.EmergencyName  || profile?.emergencyName  || '',
    allergies:      profile?.KnownAllergies || profile?.allergies      || '',
  });
  const [preview, setPreview] = useState(profile?.ProfilePicUrl || null);
  const [saving,  setSaving]  = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v != null) fd.append(k, v);
      });
      if (fileRef.current?.files[0]) fd.append('profilePic', fileRef.current.files[0]);
      await api.patch('/patients/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile updated');
      onSave({ ...form, profilePicUrl: preview });
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
        <h3 className="font-bold text-slate-800">Edit Profile</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={14} className="text-slate-400" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
          <div className="relative">
            {preview
              ? <img src={preview} className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md" alt="av" />
              : <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-md"
                  style={{ background: `linear-gradient(135deg,${BLUE},#0ea5e9)` }}>
                  {initials(form.firstName, form.lastName)}
                </div>
            }
            <button onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-lg"
              style={{ background: BLUE }}>
              <Camera size={13} />
            </button>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{form.firstName} {form.lastName}</p>
            <button onClick={() => fileRef.current?.click()} className="text-xs font-semibold hover:underline mt-1 block" style={{ color: BLUE }}>
              Change photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const f = e.target.files[0];
                if (f) {
                  if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
                  setPreview(URL.createObjectURL(f));
                }
              }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['First Name',    'firstName',   'text'],
            ['Last Name',     'lastName',    'text'],
            ['Phone',         'phone',       'tel'],
            ['Email',         'email',       'email'],
            ['Date of Birth', 'dateOfBirth', 'date'],
          ].map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
              <input type={type} value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': `${BLUE}40` }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Gender</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${BLUE}40` }}>
              <option value="">Select</option>
              {['Male', 'Female', 'Other'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Blood Group</label>
            <select value={form.bloodGroup} onChange={e => setForm(f => ({ ...f, bloodGroup: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${BLUE}40` }}>
              <option value="">Select</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Emergency Contact</label>
            <input value={form.emergencyName}
              onChange={e => setForm(f => ({ ...f, emergencyName: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${BLUE}40` }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Emergency Phone</label>
            <input type="tel" value={form.emergencyPhone}
              onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${BLUE}40` }} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Known Allergies</label>
          <textarea value={form.allergies} rows={2}
            onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': `${BLUE}40` }}
            placeholder="e.g. Penicillin, Dust…" />
        </div>
      </div>
      <div className="flex gap-3 px-7 py-5 border-t border-slate-100">
        <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ background: BLUE }}>
          {saving ? <><Loader size={14} className="animate-spin" />Saving…</> : <><Check size={14} />Save Changes</>}
        </button>
      </div>
    </Modal>
  );
};

// ─── Book Appointment Modal ───────────────────────────────────────────────────
const BookModal = ({ onClose, onSuccess }) => {
  const [step,        setStep]       = useState(1);
  const [departments, setDepts]      = useState([]);
  const [doctors,     setDoctors]    = useState([]);
  const [slots,       setSlots]      = useState([]);
  const [ldDepts,     setLdDepts]    = useState(true);
  const [ldDocs,      setLdDocs]     = useState(false);
  const [ldSlots,     setLdSlots]    = useState(false);
  const [submitting,  setSubmitting] = useState(false);

  // All IDs stored as strings for reliable === comparison
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId,     setDoctorId]     = useState('');
  const [slotId,       setSlotId]       = useState('');
  const [visitDate,    setVisitDate]    = useState('');
  const [visitType,    setVisitType]    = useState('consultation');
  const [reason,       setReason]       = useState('');

  // Load departments once on mount
  useEffect(() => {
    api.get('/departments')
      .then(r => setDepts(r?.data?.data || r?.data || []))
      .catch(() => {})
      .finally(() => setLdDepts(false));
  }, []);

  // NO useEffect for doctors/slots — fetch is triggered directly by user clicks
  // This completely avoids StrictMode double-invoke wiping selections

  // API confirmed: doctors use UserId, slots use Id
  const getDoctorId = (doc)  => doc.UserId  != null ? String(doc.UserId)  : '';
  const getSlotId   = (slot) => slot.Id     != null ? String(slot.Id)     :
                                slot.SlotId != null ? String(slot.SlotId) : '';

  const fetchDoctors = (deptId) => {
    setDepartmentId(deptId);
    setDoctorId('');
    setSlotId('');
    setDoctors([]);
    setSlots([]);
    setLdDocs(true);
    api.get(`/doctors?departmentId=${deptId}&isActive=1`)
      .then(r => setDoctors(r?.data?.data || r?.data || []))
      .catch(() => setDoctors([]))
      .finally(() => setLdDocs(false));
  };

  const fetchSlots = (docId, date) => {
    if (!docId || !date) return;
    setSlotId('');
    setSlots([]);
    setLdSlots(true);
    api.get(`/appointments/slots?doctorId=${docId}&date=${date}`)
      .then(r => setSlots(r?.data?.data || r?.data || []))
      .catch(() => setSlots([]))
      .finally(() => setLdSlots(false));
  };

  const selDoc  = doctors.find(d => getDoctorId(d) === doctorId);
  const selSlot = slots.find(s   => getSlotId(s)   === slotId);

  const next = () => {
    if (step === 1 && (!departmentId || !doctorId)) return toast.error('Select department and doctor');
    if (step === 2 && (!visitDate   || !slotId))    return toast.error('Select date and slot');
    setStep(s => s + 1);
  };

  const submit = async () => {
    if (!reason.trim()) return toast.error('Please describe your reason for visit');
    setSubmitting(true);
    try {
      await api.post('/appointments', {
        departmentId, doctorId, slotId,
        date: visitDate, type: visitType, reason,
      });
      toast.success('Appointment booked successfully!');
      onSuccess();
    } catch (e) { toast.error(e.response?.data?.message || 'Booking failed'); }
    finally { setSubmitting(false); }
  };

  const STEP_LABELS = ['Select Doctor', 'Date & Time', 'Confirm'];

  return (
    <Modal onClose={onClose}>
      <div className="px-7 pt-6 pb-4 flex-shrink-0 bg-gradient-to-r from-blue-50 to-white border-b border-slate-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Schedule Appointment</h3>
            <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1">
              <span className="font-semibold" style={{ color: BLUE }}>{STEP_LABELS[step - 1]}</span>
              <span>· Step {step}/3</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={14} className="text-slate-400" /></button>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map(n => (
            <div key={n} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${n <= step ? '' : 'bg-slate-100'}`}
              style={n <= step ? { background: BLUE } : {}} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 pb-4 pt-5 space-y-4">
        {step === 1 && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Department</label>
              {ldDepts
                ? <div className="grid grid-cols-2 gap-2">{[...Array(6)].map((_, i) => <Sk key={i} h="h-11" r="rounded-xl" />)}</div>
                : <div className="grid grid-cols-2 gap-2">
                    {departments.map(d => {
                      const deptId = String(d.Id ?? d.id ?? '');
                      return (
                        <button key={deptId} onClick={() => fetchDoctors(deptId)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium border text-left transition-all ${
                            departmentId === deptId
                              ? 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                          {d.Name || d.name}
                        </button>
                      );
                    })}
                  </div>
              }
            </div>
            {departmentId && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Doctor</label>
                {ldDocs ? <Sk h="h-20" r="rounded-xl" /> :
                  doctors.length === 0
                    ? <p className="text-sm text-slate-400 text-center py-4">No doctors available in this department</p>
                    : <div className="space-y-2">
                        {doctors.map(doc => {
                          const docId = getDoctorId(doc);
                          const isSelected = docId !== '' && doctorId === docId;
                          const consultFee = doc.ConsultationFee ?? doc.consultationFee;
                          return (
                            <button key={docId} onClick={() => {
                              setDoctorId(docId);
                              if (visitDate) fetchSlots(docId, visitDate);
                            }}
                              className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                                isSelected
                                  ? 'border-blue-400 bg-blue-50'
                                  : 'border-slate-200 hover:bg-slate-50'}`}>
                              <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                                style={{ background: `linear-gradient(135deg,${BLUE},#0ea5e9)` }}>
                                {(doc.FirstName || doc.firstName)?.[0]}{(doc.LastName || doc.lastName)?.[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm">Dr. {doc.FirstName || doc.firstName} {doc.LastName || doc.lastName}</p>
                                <p className="text-xs text-slate-400">{doc.Designation || doc.designation || 'Specialist'}</p>
                              </div>
                              {/* ✅ FIX: use ?? so fee of 0 is still shown */}
                              {consultFee != null && (
                                <p className="text-sm font-bold flex-shrink-0" style={{ color: BLUE }}>₹{consultFee}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                }
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Visit Type</label>
              <div className="grid grid-cols-2 gap-2">
                {['Consultation', 'Follow-up', 'Review', 'Emergency'].map(t => (
                  <button key={t} onClick={() => setVisitType(t.toLowerCase())}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                      visitType === t.toLowerCase()
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Preferred Date</label>
              <input type="date" value={visitDate} min={new Date().toISOString().split('T')[0]}
                onChange={e => {
                  setVisitDate(e.target.value);
                  if (doctorId) fetchSlots(doctorId, e.target.value);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': `${BLUE}40` }} />
            </div>
            {visitDate && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  <span className="flex items-center gap-2">
                    Available Slots {ldSlots && <Loader size={11} className="animate-spin text-slate-400" />}
                  </span>
                </label>
                {!ldSlots && slots.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl">No slots available for this date</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {slots.map(s => {
                    const sId = getSlotId(s);
                    return (
                      <button key={sId} disabled={s.IsBooked || s.isBooked}
                        onClick={() => setSlotId(sId)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          slotId === sId
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {s.StartTime || s.time}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Reason for Visit</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': `${BLUE}40` }}
                placeholder="Describe your symptoms or reason for the visit…" />
            </div>
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5 space-y-3">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Booking Summary</p>
              {[
                ['Doctor', selDoc ? `Dr. ${selDoc.FirstName || selDoc.firstName} ${selDoc.LastName || selDoc.lastName}` : '—'],
                ['Date',   fmtDate(visitDate)],
                ['Time',   selSlot?.StartTime || selSlot?.time || '—'],
                ['Type',   visitType],
                ['Fee',    (selDoc?.ConsultationFee ?? selDoc?.consultationFee) != null
                            ? `₹${selDoc.ConsultationFee ?? selDoc.consultationFee}`
                            : 'N/A'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">{k}</span>
                  <span className="text-sm font-bold text-slate-700 capitalize">{v}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 px-7 py-5 border-t border-slate-100">
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Back
          </button>
        )}
        <button disabled={submitting} onClick={step < 3 ? next : submit}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ background: BLUE }}>
          {submitting
            ? <><Loader size={14} className="animate-spin" />Booking…</>
            : step === 3
              ? <><CheckCircle size={14} />Confirm Appointment</>
              : <>Continue <ArrowRight size={14} /></>
          }
        </button>
      </div>
    </Modal>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────
const OverviewTab = ({ profile, appointments, prescriptions, vitals, healthChart, loading, onBook, onTab }) => {
  const upcoming = appointments.filter(a => (a.Status || a.status || '').toLowerCase() === 'upcoming');
  const nextAppt = upcoming[0];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { icon: Activity,    label: 'Blood Pressure', value: vitals?.SystolicBP  || vitals?.systolicBP,  unit: 'mmHg', color: '#ef4444', normal: (vitals?.SystolicBP  || vitals?.systolicBP  || 120) < 140 },
          { icon: Heart,       label: 'Heart Rate',     value: vitals?.HeartRate   || vitals?.heartRate,   unit: 'BPM',  color: '#f43f5e', normal: true },
          { icon: Droplets,    label: 'Blood Sugar',    value: vitals?.BloodSugar  || vitals?.bloodSugar,  unit: 'mg/dL',color: '#f59e0b', normal: (vitals?.BloodSugar  || vitals?.bloodSugar  || 100) < 140 },
          { icon: Weight,      label: 'Weight',         value: vitals?.Weight      || vitals?.weight,      unit: 'kg',   color: BLUE,      normal: true },
          { icon: Thermometer, label: 'Temperature',    value: vitals?.Temperature || vitals?.temperature, unit: '°C',   color: '#8b5cf6', normal: (vitals?.Temperature || vitals?.temperature || 37) < 37.5 },
        ].map(v => <VitalCard key={v.label} {...v} loading={loading.vitals} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800">Health Report</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last checkup · {vitals?.RecordedAt ? fmtDate(vitals.RecordedAt) : '—'}</p>
            </div>
            <InfoBadge color={BLUE}>Heart Rate Trend</InfoBadge>
          </div>
          {loading.vitals ? <Sk h="h-44" r="rounded-2xl" /> :
            healthChart.length === 0
              ? <div className="h-44 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm">No health data available</div>
              : <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={healthChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={BLUE} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis                tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="hr" name="Heart Rate" stroke={BLUE} strokeWidth={2.5} fill="url(#blueGrad)" dot={false} activeDot={{ r: 4, fill: BLUE }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
          }
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Next Appointment</p>
              <button onClick={onBook} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background: BLUE }}>
                <Plus size={11} /> Book
              </button>
            </div>
            {loading.appointments
              ? <div className="p-4"><Sk h="h-28" r="rounded-2xl" /></div>
              : nextAppt
                ? <div className="p-4">
                    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `${BLUE}08`, border: `1.5px solid ${BLUE}20` }}>
                      <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-white" style={{ background: BLUE }}>
                        <span className="font-black text-lg leading-none">{safeDay(nextAppt.AppointmentDate || nextAppt.Date || nextAppt.date)}</span>
                        <span className="text-white/70 text-[9px] font-bold">{safeMon(nextAppt.AppointmentDate || nextAppt.Date || nextAppt.date)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{nextAppt.DoctorName || nextAppt.doctorName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{nextAppt.AppointmentTime || nextAppt.StartTime || nextAppt.time}</p>
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1" style={{ background: `${BLUE}15`, color: BLUE }}>
                          Token {nextAppt.TokenNumber || nextAppt.Token || nextAppt.token || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                : <div className="py-8 flex flex-col items-center text-slate-400">
                    <Calendar size={22} className="mb-2 text-slate-200" />
                    <p className="text-xs">No upcoming appointments</p>
                    <button onClick={onBook} className="mt-2 text-xs font-bold hover:underline" style={{ color: BLUE }}>+ Book now</button>
                  </div>
            }
          </Card>

          <Card>
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Active Medications</p>
            </div>
            {loading.prescriptions
              ? [1, 2].map(i => (
                  <div key={i} className="flex gap-3 px-5 py-3 border-b border-slate-50">
                    <Sk w="w-8" h="h-8" r="rounded-xl" />
                    <div className="flex-1 space-y-1.5"><Sk h="h-3.5" /><Sk w="w-24" h="h-3" /></div>
                  </div>
                ))
              : prescriptions.filter(x => x.IsActive || x.isActive).length === 0
                ? <div className="py-6 text-center text-slate-400"><Pill size={18} className="mx-auto mb-2 text-slate-200" /><p className="text-xs">No active medications</p></div>
                : prescriptions.filter(x => x.IsActive || x.isActive).map(rx => (
                    <div key={rx.Id || rx.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Pill size={13} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{rx.DrugName || rx.drugName || rx.name}</p>
                        <p className="text-xs text-slate-400">{rx.Dosage || rx.dosage}</p>
                      </div>
                      <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">{rx.Duration || rx.duration}</span>
                    </div>
                  ))
            }
          </Card>

          <div className="rounded-2xl p-4 flex items-center gap-3 border bg-red-50 border-red-100">
            <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <Phone size={16} className="text-red-600" />
            </div>
            <div>
              <p className="font-bold text-red-700 text-sm">Emergency: 112</p>
              <p className="text-xs text-red-400">Ambulance 108 · 24×7</p>
            </div>
            <a href="tel:112" className="ml-auto px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors">
              Call
            </a>
          </div>
        </div>
      </div>

      <Card>
        <SectionHeader title="Recent Appointments" icon={Calendar}>
          <button onClick={() => onTab('appointments')} className="text-xs font-bold hover:underline flex items-center gap-1" style={{ color: BLUE }}>
            View All <ArrowRight size={11} />
          </button>
        </SectionHeader>
        {loading.appointments
          ? [1, 2, 3].map(i => <SkRow key={i} />)
          : appointments.slice(0, 5).map(a => (
              <div key={a.Id || a.id} className="flex items-center gap-4 px-6 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <div className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border"
                  style={{ background: `${BLUE}08`, borderColor: `${BLUE}20` }}>
                  <span className="font-black text-sm leading-none" style={{ color: BLUE }}>{safeDay(a.AppointmentDate || a.Date || a.date)}</span>
                  <span className="text-[9px] font-bold" style={{ color: `${BLUE}80` }}>{safeMon(a.AppointmentDate || a.Date || a.date)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{a.DoctorName || a.doctorName || a.FullName || 'Doctor'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.DepartmentName || a.departmentName} · {a.StartTime || a.time}</p>
                </div>
                <StatusBadge status={a.Status || a.status} />
              </div>
            ))
        }
        {!loading.appointments && appointments.length === 0 && (
          <Empty icon={Calendar} text="No appointments yet" action="Book First Appointment" onAction={onBook} />
        )}
      </Card>
    </div>
  );
};

// ─── Appointments Tab ─────────────────────────────────────────────────────────
const AppointmentsTab = ({ appointments, loading, onRefresh, onBook, onCancel }) => (
  <Card>
    <SectionHeader title="All Appointments" icon={Calendar}>
      <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
      <button onClick={onBook} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: BLUE }}>
        <Plus size={13} /> Book New
      </button>
    </SectionHeader>
    {loading ? [1, 2, 3, 4].map(i => <SkRow key={i} />) :
      appointments.length === 0
        ? <Empty icon={Calendar} text="No appointments found" action="Book Appointment" onAction={onBook} />
        : <div className="divide-y divide-slate-50">
            {appointments.map(a => (
              <div key={a.Id || a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors flex-wrap">
                <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: `${BLUE}0c`, border: `1.5px solid ${BLUE}20` }}>
                  <span className="font-black text-base leading-none" style={{ color: BLUE }}>{safeDay(a.AppointmentDate || a.Date || a.date)}</span>
                  <span className="text-[10px] font-bold" style={{ color: `${BLUE}80` }}>{safeMon(a.AppointmentDate || a.Date || a.date)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{a.DoctorName || a.doctorName || a.FullName || 'Doctor'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.DepartmentName || a.departmentName} · {a.AppointmentTime || a.StartTime || a.time} · Token: {a.TokenNumber || a.Token || a.token || 'N/A'}</p>
                  <p className="text-xs text-slate-400 capitalize">{a.VisitType || a.Type || a.type}</p>
                </div>
                {/* ✅ FIX: use ?? so fee of 0 is still shown */}
                {((a.ConsultationFee ?? a.fee) != null) && (
                  <p className="font-bold text-slate-700 text-sm">₹{a.ConsultationFee ?? a.fee ?? 0}</p>
                )}
                <StatusBadge status={a.Status || a.status} />
                {(a.Status || a.status)?.toLowerCase() === 'upcoming' && (
                  <button onClick={() => onCancel(a.Id || a.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-slate-200 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
    }
  </Card>
);

// ─── Prescriptions Tab ────────────────────────────────────────────────────────
const PrescriptionsTab = ({ prescriptions, loading, onRefresh }) => (
  <Card>
    <SectionHeader title="Prescriptions" icon={Pill}>
      <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
    </SectionHeader>
    {loading ? [1, 2, 3].map(i => <SkRow key={i} />) :
      prescriptions.length === 0
        ? <Empty icon={Pill} text="No prescriptions on record" />
        : <div className="divide-y divide-slate-50">
            {prescriptions.map(rx => (
              <div key={rx.Id || rx.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${(rx.IsActive || rx.isActive) ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                  <Pill size={14} className={(rx.IsActive || rx.isActive) ? 'text-emerald-600' : 'text-slate-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{rx.DrugName || rx.drugName || rx.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{rx.Dosage || rx.dosage} · {rx.Duration || rx.duration}</p>
                  <p className="text-xs text-slate-400">{rx.DoctorName || rx.doctorName} · {fmtDate(rx.PrescribedDate || rx.date)}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${(rx.IsActive || rx.isActive) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {(rx.IsActive || rx.isActive) ? 'Active' : 'Completed'}
                </span>
                <button className="p-2 rounded-xl hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                  <Download size={13} />
                </button>
              </div>
            ))}
          </div>
    }
  </Card>
);

// ─── Reports Tab ──────────────────────────────────────────────────────────────
const ReportsTab = ({ reports, loading, onRefresh }) => (
  <Card>
    <SectionHeader title="Medical Reports" icon={FileText}>
      <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
    </SectionHeader>
    {loading ? [1, 2, 3].map(i => <SkRow key={i} />) :
      reports.length === 0
        ? <Empty icon={FileText} text="No reports available yet" />
        : <div className="divide-y divide-slate-50">
            {reports.map(r => (
              <div key={r.Id || r.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${BLUE}0c` }}>
                  <FileText size={14} style={{ color: BLUE }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{r.Name || r.name || r.TestName || r.testName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.Type || r.type || r.Category} · {r.DoctorName || r.doctorName} · {fmtDate(r.Date || r.date)}</p>
                </div>
                <StatusBadge status={r.Status || r.status || 'pending'} />
                {(r.Status || r.status) === 'ready' && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-sm font-semibold" style={{ background: BLUE }}>
                    <Download size={12} /> Download
                  </button>
                )}
              </div>
            ))}
          </div>
    }
  </Card>
);

// ─── Billing Tab ──────────────────────────────────────────────────────────────
const BillingTab = ({ bills, loading, onRefresh }) => {
  const totalPaid    = bills.filter(b => (b.Status || b.status || '').toLowerCase() === 'paid').reduce((s, b) => s + (parseFloat(b.Amount ?? b.amount) || 0), 0);
  const totalPending = bills.filter(b => (b.Status || b.status || '').toLowerCase() === 'pending').reduce((s, b) => s + (parseFloat(b.Amount ?? b.amount) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={CheckCircle} label="Total Paid"     color="#059669" value={loading ? null : `₹${totalPaid.toLocaleString()}`}    loading={loading} />
        <StatCard icon={Clock}       label="Pending"        color="#d97706" value={loading ? null : `₹${totalPending.toLocaleString()}`} loading={loading} />
        <StatCard icon={Receipt}     label="Total Invoices" color={BLUE}    value={loading ? null : bills.length}                        loading={loading} />
      </div>
      <Card>
        <SectionHeader title="Invoice History" icon={Receipt}>
          <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
        </SectionHeader>
        {loading ? [1, 2, 3].map(i => <SkRow key={i} />) :
          bills.length === 0
            ? <Empty icon={Receipt} text="No bills found" />
            : <div className="divide-y divide-slate-50">
                {bills.map(b => (
                  <div key={b.Id || b.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <Receipt size={14} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm">{b.Description || b.desc || b.InvoiceNo || b.invoiceNo}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{b.InvoiceNo || b.invoiceNo} · {fmtDate(b.Date || b.date)}</p>
                    </div>
                    <p className="font-bold text-slate-800">₹{(parseFloat(b.Amount ?? b.amount) || 0).toLocaleString()}</p>
                    <StatusBadge status={b.Status || b.status} />
                    <button className="p-2 rounded-xl hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                      <Download size={13} />
                    </button>
                  </div>
                ))}
              </div>
        }
      </Card>
    </div>
  );
};

// ─── Vitals Tab ───────────────────────────────────────────────────────────────
const VitalsTab = ({ vitals, healthChart, loading }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {[
        { icon: Activity,    label: 'Blood Pressure', value: vitals?.SystolicBP  || vitals?.systolicBP,  unit: 'mmHg', color: '#ef4444', normal: (vitals?.SystolicBP  || vitals?.systolicBP  || 120) < 140 },
        { icon: Heart,       label: 'Heart Rate',     value: vitals?.HeartRate   || vitals?.heartRate,   unit: 'BPM',  color: '#f43f5e', normal: true },
        { icon: Droplets,    label: 'Blood Sugar',    value: vitals?.BloodSugar  || vitals?.bloodSugar,  unit: 'mg/dL',color: '#f59e0b', normal: (vitals?.BloodSugar  || vitals?.bloodSugar  || 100) < 140 },
        { icon: Weight,      label: 'Weight',         value: vitals?.Weight      || vitals?.weight,      unit: 'kg',   color: BLUE,      normal: true },
        { icon: Thermometer, label: 'Temperature',    value: vitals?.Temperature || vitals?.temperature, unit: '°C',   color: '#8b5cf6', normal: (vitals?.Temperature || vitals?.temperature || 37) < 37.5 },
      ].map(v => <VitalCard key={v.label} {...v} loading={loading} />)}
    </div>
    <Card className="p-6">
      <h3 className="font-bold text-slate-800 mb-5">Heart Rate Over Time</h3>
      {loading ? <Sk h="h-56" r="rounded-2xl" /> :
        healthChart.length === 0
          ? <div className="h-56 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-sm">No historical data available</div>
          : <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={healthChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blueGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={BLUE} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis                tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="hr" name="Heart Rate" stroke={BLUE} strokeWidth={2.5} fill="url(#blueGrad2)" dot={false} activeDot={{ r: 4, fill: BLUE }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
      }
    </Card>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function PatientDashboard() {
  const { user } = useAuth();

  const [profile,       setProfile]       = useState(null);
  const [appointments,  setAppointments]  = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [reports,       setReports]       = useState([]);
  const [bills,         setBills]         = useState([]);
  const [vitals,        setVitals]        = useState(null);
  const [healthChart,   setHealthChart]   = useState([]);

  const [loading,     setLoading]     = useState({ profile: true, appointments: true, prescriptions: true, reports: true, bills: true, vitals: true });
  const [activeTab,   setActiveTab]   = useState('overview');
  const [showBook,    setShowBook]    = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const setL = useCallback((k, v) => setLoading(l => ({ ...l, [k]: v })), []);

  const fetchAll = useCallback(async () => {
    setLoading({ profile: true, appointments: true, prescriptions: true, reports: true, bills: true, vitals: true });

    api.get('/patients/profile')
      .then(r => setProfile(r?.data?.data || r?.data || {}))
      .catch(() => {})
      .finally(() => setL('profile', false));

    api.get('/appointments/my')
      .then(r => setAppointments(r?.data?.data || []))
      .catch(() => setAppointments([]))
      .finally(() => setL('appointments', false));

    api.get('/prescriptions/my')
      .then(r => setPrescriptions(r?.data?.data || []))
      .catch(() => setPrescriptions([]))
      .finally(() => setL('prescriptions', false));

    api.get('/reports/my')
      .then(r => setReports(r?.data?.data || []))
      .catch(() => setReports([]))
      .finally(() => setL('reports', false));

    api.get('/bills/my')
      .then(r => setBills(r?.data?.data || []))
      .catch(() => setBills([]))
      .finally(() => setL('bills', false));

    api.get('/patients/vitals')
      .then(r => {
        const d = r?.data?.data || r?.data || {};
        setVitals(d?.latest || d);
        const hist = d?.history || d?.chartData || [];
        setHealthChart(
          hist.map(h => ({
            time: h.Time || h.time || h.RecordedAt || '',
            hr:   h.HeartRate  || h.heartRate  || h.hr || 0,
            bp:   h.SystolicBP || h.systolicBP || h.bp || 0,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setL('vitals', false));
  }, [setL]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const p           = profile || {};
  const displayName = `${p.FirstName || user?.firstName || ''} ${p.LastName || user?.lastName || ''}`.trim() || 'Patient';
  const upcoming    = appointments.filter(a => (a.Status || a.status || '').toLowerCase() === 'upcoming');
  const activeMeds  = prescriptions.filter(x => x.IsActive || x.isActive);

  const cancelAppt = async (id) => {
    try {
      await api.patch(`/appointments/${id}/cancel`);
      setAppointments(a => a.map(x => (x.Id || x.id) === id ? { ...x, Status: 'cancelled', status: 'cancelled' } : x));
      toast.success('Appointment cancelled');
    } catch { toast.error('Failed to cancel'); }
  };

  const refreshAppointments = useCallback(() => {
    setL('appointments', true);
    api.get('/appointments/my')
      .then(r => setAppointments(r?.data?.data || []))
      .catch(() => {})
      .finally(() => setL('appointments', false));
  }, [setL]);

  const refreshPrescriptions = useCallback(() => {
    setL('prescriptions', true);
    api.get('/prescriptions/my')
      .then(r => setPrescriptions(r?.data?.data || r?.data || []))
      .catch(() => {})
      .finally(() => setL('prescriptions', false));
  }, [setL]);

  const refreshReports = useCallback(() => {
    setL('reports', true);
    api.get('/reports/my')
      .then(r => setReports(r?.data?.data || r?.data || []))
      .catch(() => {})
      .finally(() => setL('reports', false));
  }, [setL]);

  const refreshBills = useCallback(() => {
    setL('bills', true);
    api.get('/bills/my')
      .then(r => setBills(r?.data?.data || r?.data || []))
      .catch(() => {})
      .finally(() => setL('bills', false));
  }, [setL]);

  const TABS = [
    { key: 'overview',      label: 'Dashboard',       icon: Activity                            },
    { key: 'appointments',  label: 'Appointments',    icon: Calendar, badge: upcoming.length    },
    { key: 'prescriptions', label: 'Prescriptions',   icon: Pill,     badge: activeMeds.length  },
    { key: 'emr',           label: 'Medical Records', icon: FileText                            },
    { key: 'reports',       label: 'Lab Reports',     icon: FlaskConical                        },
    { key: 'billing',       label: 'Billing',         icon: Receipt                             },
    { key: 'vitals',        label: 'Health Vitals',   icon: Heart                               },
    { key: 'profile',       label: 'My Profile',      icon: User                                },
  ];

  const tabContent = {
    overview: (
      <OverviewTab profile={p} appointments={appointments} prescriptions={prescriptions}
        vitals={vitals} healthChart={healthChart} loading={loading}
        onBook={() => setShowBook(true)} onTab={setActiveTab} />
    ),
    appointments: (
      <AppointmentsTab appointments={appointments} loading={loading.appointments}
        onRefresh={refreshAppointments} onBook={() => setShowBook(true)} onCancel={cancelAppt} />
    ),
    prescriptions: (
      <PrescriptionsTab prescriptions={prescriptions} loading={loading.prescriptions}
        onRefresh={refreshPrescriptions} />
    ),
    emr: <Card className="p-8"><Empty icon={FileText} text="Electronic Medical Records coming soon" /></Card>,
    reports: (
      <ReportsTab reports={reports} loading={loading.reports}
        onRefresh={refreshReports} />
    ),
    billing: (
      <BillingTab bills={bills} loading={loading.bills}
        onRefresh={refreshBills} />
    ),
    vitals: <VitalsTab vitals={vitals} healthChart={healthChart} loading={loading.vitals} />,
    profile: (
      <Card className="p-6">
        <div className="flex items-center gap-5 mb-6">
          {p.ProfilePicUrl
            ? <img src={p.ProfilePicUrl} className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 shadow" alt="profile" />
            : <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow"
                style={{ background: `linear-gradient(135deg,${BLUE},#0ea5e9)` }}>
                {initials(p.FirstName || user?.firstName, p.LastName || user?.lastName)}
              </div>
          }
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
              {(p.BloodGroup || user?.bloodGroup) && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                  <Heart size={10} /> {p.BloodGroup || user?.bloodGroup}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-0.5">{p.Gender} · {p.Age ? `${p.Age} yrs` : ''}</p>
            <button onClick={() => setShowProfile(true)}
              className="mt-2 flex items-center gap-1.5 text-sm font-bold hover:underline" style={{ color: BLUE }}>
              <Edit2 size={12} /> Edit Profile
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['UHID',            p.UHID          || user?.uhid  || '—'],
            ['Phone',           p.Phone         || user?.phone || '—'],
            ['Email',           p.Email         || user?.email || '—'],
            ['Blood Group',     p.BloodGroup                   || '—'],
            ['Emergency',       p.EmergencyName                || '—'],
            ['Emergency Phone', p.EmergencyPhone               || '—'],
            ['Allergies',       p.KnownAllergies               || 'None on record'],
            ['Address',         p.Street1       || p.address   || '—'],
          ].map(([k, v]) => (
            <div key={k} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-400 mb-0.5">{k}</p>
              <p className="text-sm font-semibold text-slate-700 truncate" title={v}>{v}</p>
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
          <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
            {(p.UHID || user?.uhid) && (
              <span className="flex items-center gap-1"><Shield size={11} /> {p.UHID || user.uhid}</span>
            )}
            {p.BloodGroup && (
              <span className="flex items-center gap-1 text-red-500 font-semibold"><Heart size={11} /> {p.BloodGroup}</span>
            )}
            {p.Gender && <span>{p.Gender}{p.Age ? ` · ${p.Age} yrs` : ''}</span>}
          </p>
        </div>
        <button onClick={() => setShowBook(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: BLUE }}>
          <Plus size={14} /> Schedule Appointment
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-0.5 flex-wrap border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all
              ${activeTab === key
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            <Icon size={14} />
            {label}
            {badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${activeTab === key ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tabContent[activeTab] ?? null}

      {/* ── Modals ── */}
      {showBook    && <BookModal    onClose={() => setShowBook(false)}    onSuccess={() => { setShowBook(false);    fetchAll(); }} />}
      {showProfile && <ProfileModal profile={profile || user}            onClose={() => setShowProfile(false)} onSave={d => { setProfile(pr => ({ ...pr, ...d })); setShowProfile(false); }} />}
    </div>
  );
}