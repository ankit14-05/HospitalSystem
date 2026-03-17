// src/pages/appointments/BookAppointmentPage.jsx
// Patient-facing appointment booking — browse doctors → pick slot → confirm → token receipt
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, Star, MapPin, Clock, Calendar, ChevronRight,
  ChevronLeft, Check, X, Loader, Stethoscope, Building2, User,
  Hash, Phone, Mail, AlertCircle, CheckCircle, ArrowLeft, RefreshCw,
  Heart, Award, Languages, DollarSign, CalendarDays, Ticket,
  Info, Sparkles, TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const VISIT_TYPES = [
  { key:'OPD',       label:'OPD',        desc:'Outpatient visit',   color:'#0d9488', bg:'#f0fdfa' },
  { key:'Emergency', label:'Emergency',  desc:'Urgent care',        color:'#dc2626', bg:'#fef2f2' },
  { key:'FollowUp',  label:'Follow-up',  desc:'Follow-up visit',    color:'#2563eb', bg:'#eff6ff' },
];

const PRIORITIES = ['Normal','Urgent','Emergency'];

const TODAY = new Date();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt12 = t => {
  if (!t) return '';
  const p = String(t).split(':').map(Number);
  const h = p[0], m = p[1] || 0;
  if (isNaN(h)) return t;
  return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
};

const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
const shortDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
const isoDate = d => d.toISOString().slice(0,10);
const getHospitalId = user => String(user?.hospitalId || user?.HospitalId || localStorage.getItem('hospitalId') || '1');
const normalizeSlot = slot => {
  if (typeof slot === 'string') return { time: slot, available: true };
  const time = slot?.time || slot?.StartTime || slot?.AppointmentTime || '';
  const available = slot?.available ?? !(slot?.isBooked ?? slot?.IsBooked ?? false);
  return { ...slot, time, available, isBooked: !available };
};

const initials = n => (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ w='w-full', h='h-4', r='rounded-lg' }) => (
  <div className={`${w} ${h} ${r} bg-slate-100 animate-pulse`} />
);


// ─── Mini Calendar Component ──────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const MiniCalendar = ({ selected, onSelect, calendarDate, onChangeMonth, minDate }) => {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  // First day of month + total days
  const firstDow  = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells     = Array.from({ length: firstDow + totalDays }, (_, i) =>
    i < firstDow ? null : i - firstDow + 1
  );

  const prevMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() - 1);
    onChangeMonth(d);
  };
  const nextMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() + 1);
    onChangeMonth(d);
  };

  const todayIso = isoDate(TODAY);
  const isPast = (day) => {
    if (!day || !minDate) return false;
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return iso < minDate;
  };
  const cellIso = (day) =>
    `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
          <ChevronLeft size={14} className="text-slate-500" />
        </button>
        <span className="text-sm font-bold text-slate-700">
          {MONTH_NAMES[month]} {year}
        </span>
        <button type="button" onClick={nextMonth}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
          <ChevronRight size={14} className="text-slate-500" />
        </button>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso     = cellIso(day);
          const isSel   = selected === iso;
          const isToday = iso === todayIso;
          const past    = isPast(day);
          return (
            <button
              key={iso}
              type="button"
              disabled={past}
              onClick={() => !past && onSelect(iso)}
              className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all
                ${past
                  ? 'text-slate-300 cursor-not-allowed'
                  : isSel
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                    : isToday
                      ? 'bg-teal-50 text-teal-600 border border-teal-200 font-bold'
                      : 'hover:bg-teal-50 hover:text-teal-600 text-slate-600'
                }`}
            >
              <span className="leading-none">{day}</span>
              {isToday && !isSel && <span className="w-1 h-1 rounded-full bg-teal-400 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Doctor Card ──────────────────────────────────────────────────────────────
const DoctorCard = ({ doctor, selected, onSelect }) => {
  const name = doctor.DoctorName || `${doctor.FirstName || ''} ${doctor.LastName || ''}`.trim();
  const spec = doctor.Specialization || doctor.SpecializationName || 'Specialist';
  const dept = doctor.DepartmentName || '';
  const fee  = doctor.ConsultationFee;
  const exp  = doctor.ExperienceYears;

  return (
    <div onClick={() => onSelect(doctor)}
      className={`relative bg-white rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden
        ${selected
          ? 'border-teal-400 shadow-lg shadow-teal-100'
          : 'border-slate-100 hover:border-slate-200 hover:shadow-md'}`}>
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center z-10">
          <Check size={12} className="text-white" />
        </div>
      )}
      <div className="h-1.5 w-full" style={{ background: selected ? '#0d9488' : '#e2e8f0' }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
               style={{ background: selected ? '#0d9488' : '#64748b' }}>
            {initials(name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm truncate">Dr. {name}</h3>
            <p className="text-xs text-teal-600 font-medium truncate">{spec}</p>
            {dept && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Building2 size={9}/>{dept}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50">
          {exp && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <TrendingUp size={10} className="text-slate-400" />{exp}y exp
            </span>
          )}
          {fee && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-700">
              ₹{fee}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Time Slot Grid ───────────────────────────────────────────────────────────
const SlotGrid = ({ slots, selected, onSelect, loading }) => {
  if (loading) return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({length:12}).map((_,i) => <Sk key={i} h="h-10" r="rounded-xl" />)}
    </div>
  );
  if (!slots.length) return (
    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
      <CalendarDays size={24} className="text-slate-300 mx-auto mb-2" />
      <p className="text-sm font-medium text-slate-500">No slots available on this day</p>
      <p className="text-xs text-slate-400 mt-1">Try a different date</p>
    </div>
  );

  const visibleSlots = slots.filter(s => (s?.available ?? !(s?.isBooked ?? s?.IsBooked ?? false)));
  const morning   = visibleSlots.filter(s => parseInt(s.time||s, 10) < 12);
  const afternoon = visibleSlots.filter(s => { const h=parseInt(s.time||s, 10); return h>=12&&h<17; });
  const evening   = visibleSlots.filter(s => parseInt(s.time||s, 10) >= 17);

  const SlotBtn = ({ slot }) => {
    const time  = slot.time || slot.StartTime || slot;
    const isSel = selected === time;
    return (
      <button type="button" onClick={() => onSelect(time)}
        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center
          ${isSel
            ? 'border-teal-400 bg-teal-500 text-white shadow-md shadow-teal-200'
            : 'border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50'}`}>
        {fmt12(time)}
      </button>
    );
  };

  const Section = ({ title, slots }) => slots.length === 0 ? null : (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((s,i) => <SlotBtn key={i} slot={s} />)}
      </div>
    </div>
  );

  return (
    <div>
      <Section title="Morning" slots={morning} />
      <Section title="Afternoon" slots={afternoon} />
      <Section title="Evening" slots={evening} />
    </div>
  );
};

// ─── Token Receipt ────────────────────────────────────────────────────────────
const TokenReceipt = ({ booking, onDone }) => {
  const { doctor, patient, appointment } = booking;
  const name = doctor?.DoctorName || `Dr. ${doctor?.FirstName || ''} ${doctor?.LastName || ''}`.trim();

  return (
    <div className="max-w-md mx-auto">
      {/* Success animation */}
      <div className="text-center mb-8">
        <div className="relative inline-flex">
          <div className="w-20 h-20 rounded-full bg-teal-500 flex items-center justify-center shadow-xl shadow-teal-200">
            <CheckCircle size={36} className="text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
            <Sparkles size={12} className="text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mt-4">Appointment Confirmed!</h2>
        <p className="text-slate-500 text-sm mt-1">Your booking has been confirmed. Check your email for details.</p>
      </div>

      {/* Token Card */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-3xl p-6 text-white mb-4 shadow-xl shadow-teal-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-teal-200 text-xs font-bold uppercase tracking-widest">Token Number</p>
              <p className="text-6xl font-black leading-none mt-1">{appointment?.TokenNumber || appointment?.token || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-teal-200 text-xs">Ref No.</p>
              <p className="text-xs font-mono font-bold mt-0.5">{appointment?.AppointmentNo || '—'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Stethoscope size={13} className="text-teal-300" />
              <span className="text-sm font-semibold">{name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-teal-300" />
              <span className="text-sm">{fmtDate(appointment?.AppointmentDate || booking?.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-teal-300" />
              <span className="text-sm">{fmt12(appointment?.AppointmentTime || booking?.time)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-teal-500/50 flex items-center justify-between">
            <span className="text-teal-200 text-xs">Please arrive 15 min early</span>
            <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full">
              {appointment?.VisitType || 'OPD'}
            </span>
          </div>
        </div>
      </div>

      {/* What to bring */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
          <Info size={12} /> What to bring
        </p>
        <ul className="space-y-1 text-xs text-blue-600">
          {['Government ID / Aadhaar', 'Insurance card (if any)', 'Previous prescriptions', 'Test reports (if any)'].map(item => (
            <li key={item} className="flex items-center gap-2">
              <Check size={10} className="text-blue-400 flex-shrink-0" />{item}
            </li>
          ))}
        </ul>
      </div>

      <button onClick={onDone}
        className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all text-sm">
        Back to Dashboard
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookAppointmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hospitalId = getHospitalId(user);

  const [step, setStep] = useState(1); // 1=dept+doctor, 2=date+time, 3=details+confirm, 4=success
  const [departments, setDepartments]   = useState([]);
  const [doctors,     setDoctors]       = useState([]);
  const [slots,       setSlots]         = useState([]);
  const [calendarDate, setCalendarDate] = useState(() => new Date(TODAY));

  const [loading, setLoading] = useState({ depts: true, doctors: false, slots: false, submit: false });
  const [search,  setSearch]  = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [booking, setBooking] = useState(null);

  const [form, setForm] = useState({
    departmentId:    '',
    doctorId:        '',
    doctorObj:       null,
    date:            isoDate(TODAY),
    time:            '',
    visitType:       'OPD',
    reason:          '',
    priority:        'Normal',
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setL = (k, v) => setLoading(l => ({ ...l, [k]: v }));

  // Load departments
  useEffect(() => {
    api.get(`/departments?hospitalId=${hospitalId}`)
      .then(r => {
        const d = r?.data || r;
        const arr = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
        setDepartments(arr);
      })
      .catch(() => {})
      .finally(() => setL('depts', false));
  }, [hospitalId]);

  // Load doctors when dept changes or on mount
  const loadDoctors = useCallback(async (deptId) => {
    setL('doctors', true);
    try {
      const params = new URLSearchParams({ hospitalId, limit: 200 });
      if (deptId) params.set('departmentId', deptId);
      const r = await api.get(`/doctors?${params}`);
      const raw = r?.data ?? r;
      // Handle all response shapes
      const arr = Array.isArray(raw) ? raw
        : Array.isArray(raw?.data)   ? raw.data
        : Array.isArray(raw?.doctors)? raw.doctors
        : Array.isArray(raw?.results)? raw.results
        : typeof raw === 'object' && raw
          ? Object.values(raw).find(v => Array.isArray(v) && v.length > 0) || []
          : [];
      // The /doctors endpoint returns DoctorId = DoctorProfiles.Id (the booking key)
      // and UserId = Users.Id. There is no bare "Id" field.
      const normalized = arr.map(d => ({
        ...d,
        // DoctorId from the API = DoctorProfiles.Id — use this for booking
        DoctorProfileId: String(d.DoctorId || d.DoctorProfileId || d.Id || d.id || ''),
        DoctorName: d.FullName || d.DoctorName || `${d.FirstName||''} ${d.LastName||''}`.trim(),
        Specialization: d.Specialization || d.SpecializationName || d.Designation || '',
        DepartmentName: d.DepartmentName || d.Department || '',
        ConsultationFee: d.ConsultationFee || d.consultationFee,
        ExperienceYears: d.ExperienceYears || d.experienceYears,
      })).filter(d => Number.parseInt(d.DoctorProfileId, 10) > 0);
      setDoctors(normalized);
    } catch (e) {
      console.error('loadDoctors error:', e);
      setDoctors([]);
    } finally { setL('doctors', false); }
  }, [hospitalId]);

  useEffect(() => { loadDoctors(filterDept); }, [filterDept, loadDoctors]);

  // Load slots when doctor + date change (or when arriving at step 2)
  useEffect(() => {
    if (!form.doctorId || !form.date) return;
    if (step !== 2) return;
    setL('slots', true);
    setSlots([]);
    api.get(`/doctors/${form.doctorId}/slots?date=${form.date}`)
      .then(r => {
        const d = r?.data ?? r;
        const arr = Array.isArray(d)          ? d
                  : Array.isArray(d?.slots)   ? d.slots
                  : Array.isArray(d?.data)    ? d.data
                  : [];
        const normalized = arr
          .map(normalizeSlot)
          .filter(s => s.time && s.available);
        setSlots(normalized);
      })
      .catch(() => setSlots([]))
      .finally(() => setL('slots', false));
  }, [form.doctorId, form.date, step]);

  const handleSelectDoctor = doc => {
    // DoctorProfileId is already normalized to DoctorProfiles.Id (stored as string)
    const id = String(doc.DoctorProfileId || doc.DoctorId || doc.Id || doc.id || '');
    const deptId = doc.DepartmentId || doc.departmentId || '';
    setF('doctorId', id);
    setF('departmentId', deptId);
    setF('doctorObj', doc);
    setF('time', '');
  };

  const handleNext = () => {
    if (step === 1) {
      if (!form.doctorId) return toast.error('Please select a doctor');
      setStep(2);
    } else if (step === 2) {
      if (!form.date) return toast.error('Please select a date');
      if (!form.time) return toast.error('Please select a time slot');
      setStep(3);
    } else if (step === 3) {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!form.reason.trim()) return toast.error('Please describe your reason for visit');
    setL('submit', true);
    try {
      const payload = {
        doctorId:        parseInt(form.doctorId),
        departmentId:    form.departmentId ? parseInt(form.departmentId) : undefined,
        appointmentDate: form.date,
        appointmentTime: form.time,
        visitType:       form.visitType,
        reason:          form.reason,
        priority:        form.priority,
      };
      const r = await api.post('/appointments', payload);
      const appt = r?.data || r?.appointment || r;
      setBooking({ doctor: form.doctorObj, date: form.date, time: form.time, appointment: appt });
      setStep(4);
    } catch (e) {
      toast.error(e?.message || 'Booking failed. Please try again.');
    } finally { setL('submit', false); }
  };

  const filteredDoctors = doctors.filter(d => {
    const name = d.DoctorName || `${d.FirstName||''} ${d.LastName||''}`;
    const spec = d.Specialization || d.SpecializationName || '';
    const dept = d.DepartmentName || '';
    const q = search.toLowerCase();
    return !q || name.toLowerCase().includes(q) || spec.toLowerCase().includes(q) || dept.toLowerCase().includes(q);
  });

  const STEPS = ['Choose Doctor', 'Pick Date & Time', 'Confirm Details'];
  const stepColors = ['#0d9488','#2563eb','#7c3aed'];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => step > 1 && step < 4 ? setStep(s=>s-1) : navigate('/dashboard/patient')}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="font-bold text-slate-800">Book Appointment</h1>
              <p className="text-xs text-slate-500">
                {step < 4 ? `Step ${step} of 3 — ${STEPS[step-1]}` : 'Booking Confirmed'}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          {step < 4 && (
            <div className="hidden sm:flex items-center gap-2">
              {STEPS.map((s, i) => (
                <React.Fragment key={i}>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                    ${step === i+1 ? 'text-white shadow-sm' : step > i+1 ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}
                    style={step === i+1 ? { background: stepColors[i] } : {}}>
                    {step > i+1
                      ? <Check size={11} />
                      : <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                               style={{ borderColor: step === i+1 ? 'rgba(255,255,255,0.5)' : '#cbd5e1' }}>{i+1}</span>}
                    <span className="hidden md:block">{s}</span>
                  </div>
                  {i < STEPS.length-1 && <div className={`w-6 h-0.5 rounded-full ${step > i+1 ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">

        {/* ── STEP 4: Success ── */}
        {step === 4 && booking && (
          <TokenReceipt booking={booking} onDone={() => navigate('/dashboard/patient')} />
        )}

        {/* ── STEP 1: Choose Doctor ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-slate-100 p-4">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search doctor, specialization..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
              </div>
              <select value={filterDept} onChange={e=>setFilterDept(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-200 outline-none">
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.Id || d.id} value={d.Id || d.id}>{d.Name || d.name}</option>
                ))}
              </select>
            </div>

            {/* Doctor grid */}
            {loading.doctors ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({length:6}).map((_,i)=><Sk key={i} h="h-32" r="rounded-2xl" />)}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <Stethoscope size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-500">No doctors found</p>
                <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDoctors.map(doc => (
                  <DoctorCard key={String(doc.DoctorProfileId || doc.Id || doc.UserId || Math.random())}
                    doctor={doc}
                    selected={String(form.doctorId) === String(doc.DoctorProfileId || doc.Id || '')}
                    onSelect={handleSelectDoctor} />
                ))}
              </div>
            )}

            {/* Next */}
            <div className="flex justify-end pt-2">
              <button onClick={handleNext} disabled={!form.doctorId}
                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-teal-200">
                Continue to Date & Time <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Date + Time ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-5">

              {/* ── Calendar ── */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
                  <CalendarDays size={15} className="text-teal-500" /> Select Date
                </h3>
                <MiniCalendar
                  selected={form.date}
                  onSelect={iso => { setF('date', iso); setF('time', ''); }}
                  calendarDate={calendarDate}
                  onChangeMonth={setCalendarDate}
                  minDate={isoDate(TODAY)}
                />
              </div>

              {/* ── Slots ── */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-bold text-slate-700 text-sm mb-1 flex items-center gap-2">
                  <Clock size={15} className="text-teal-500" /> Available Slots
                </h3>
                <p className="text-xs text-slate-400 mb-4">{fmtDate(form.date)}</p>
                <SlotGrid
                  slots={slots}
                  selected={form.time}
                  onSelect={t => setF('time', t)}
                  loading={loading.slots}
                />
              </div>
            </div>

            {/* Selected summary */}
            {form.time && (
              <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
                  <Check size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-teal-800">
                    {fmtDate(form.date)} at {fmt12(form.time)}
                  </p>
                  <p className="text-xs text-teal-600">
                    Dr. {form.doctorObj?.DoctorName || `${form.doctorObj?.FirstName||''} ${form.doctorObj?.LastName||''}`}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-2xl hover:bg-slate-50 transition-all text-sm">
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={handleNext} disabled={!form.time}
                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all disabled:opacity-40 shadow-md shadow-teal-200">
                Review & Confirm <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Form */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-bold text-slate-700 text-sm mb-4">Visit Details</h3>

                {/* Visit type */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Visit Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {VISIT_TYPES.map(vt => (
                      <button key={vt.key} type="button" onClick={() => setF('visitType', vt.key)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-all
                          ${form.visitType === vt.key ? 'border-2 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                        style={form.visitType === vt.key ? { borderColor: vt.color, background: vt.bg } : {}}>
                        <p className="text-xs font-bold" style={form.visitType === vt.key ? { color: vt.color } : { color:'#475569' }}>{vt.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{vt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Reason for Visit <span className="text-red-400">*</span>
                  </label>
                  <textarea rows={3} value={form.reason} onChange={e=>setF('reason', e.target.value)}
                    placeholder="Describe your symptoms or reason for this appointment..."
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Priority</label>
                  <div className="flex gap-2">
                    {PRIORITIES.map(p => (
                      <button key={p} type="button" onClick={() => setF('priority', p)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                          ${form.priority === p
                            ? p==='Normal' ? 'bg-teal-500 text-white border-teal-500'
                              : p==='Urgent' ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-red-500 text-white border-red-500'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary sidebar */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-bold text-slate-700 text-sm mb-4">Booking Summary</h3>
                <div className="space-y-3">
                  {/* Doctor */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                      {initials(form.doctorObj?.DoctorName || `${form.doctorObj?.FirstName||''} ${form.doctorObj?.LastName||''}`)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Dr. {form.doctorObj?.DoctorName || `${form.doctorObj?.FirstName||''} ${form.doctorObj?.LastName||''}`}
                      </p>
                      <p className="text-[11px] text-teal-600">{form.doctorObj?.Specialization || ''}</p>
                    </div>
                  </div>

                  {[
                    { icon: Calendar, label: 'Date',   val: fmtDate(form.date) },
                    { icon: Clock,    label: 'Time',   val: fmt12(form.time) },
                    { icon: Ticket,   label: 'Type',   val: form.visitType },
                    form.doctorObj?.ConsultationFee && { icon: DollarSign, label: 'Fee', val: `₹${form.doctorObj.ConsultationFee}` },
                  ].filter(Boolean).map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <row.icon size={11} className="text-slate-400" />{row.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={handleSubmit} disabled={loading.submit || !form.reason.trim()}
                  className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-teal-200">
                  {loading.submit
                    ? <><Loader size={15} className="animate-spin" />Booking...</>
                    : <><CheckCircle size={15} />Confirm Booking</>}
                </button>
                <button onClick={() => setStep(2)}
                  className="w-full py-2.5 border border-slate-200 text-slate-600 font-medium rounded-2xl hover:bg-slate-50 transition-all text-sm">
                  <ChevronLeft size={13} className="inline mr-1" />Change Date/Time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
