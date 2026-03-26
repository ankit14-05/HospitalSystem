import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
  Stethoscope,
  CreditCard,
  Smartphone,
  Building2,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { APPOINTMENT_DESK_ROLES } from '../../config/roles';

// ─── Constants & Helpers ────────────────────────────────────────────────────────
const WEEK_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const PAYMENT_METHODS = [
  { id: 'card', label: 'Card Payment', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'net', label: 'Net Banking', icon: Building2 },
];

const toIsoDate = (value) => {
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeTime = (value) => {
  if (!value) return '';
  const match = String(value).match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : String(value).slice(0, 5);
};

const formatTime = (value) => {
  const time = normalizeTime(value);
  if (!time) return '--';
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${(hours % 12) || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const formatTimeRange = (start, end) => {
  const startText = formatTime(start);
  const endText = formatTime(end);

  if (startText === '--' && endText === '--') return '--';
  if (startText !== '--' && endText !== '--') return `${startText} - ${endText}`;
  return startText !== '--' ? startText : endText;
};

const formatMonthLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
  month: 'long',
  year: 'numeric',
});

const formatSummaryDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const initials = (value = '') => value.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const getHospitalId = (user) => String(user?.hospitalId || user?.HospitalId || localStorage.getItem('hospitalId') || '1');

const toArray = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of keys) if (Array.isArray(payload[key])) return payload[key];
  if (Array.isArray(payload.data)) return payload.data;
  for (const value of Object.values(payload)) if (Array.isArray(value)) return value;
  return [];
};

const normalizeDoctor = (row) => ({
  doctorId: String(row?.DoctorId || row?.DoctorProfileId || row?.Id || row?.id || ''),
  doctorName: row?.DoctorName || row?.FullName || `${row?.FirstName || ''} ${row?.LastName || ''}`.trim(),
  departmentId: String(row?.DepartmentId || row?.departmentId || ''),
  departmentName: row?.DepartmentName || row?.Department || '',
  specializationId: String(row?.SpecializationId || row?.specializationId || ''),
  specializationName: row?.SpecializationName || row?.Specialization || row?.Designation || 'Specialist',
  consultationFee: row?.ConsultationFee || row?.consultationFee || 500, // default fee if missing
  experienceYears: row?.ExperienceYears || row?.experienceYears || null,
  photoUrl: row?.PhotoUrl || row?.photoUrl || null,
});

const normalizePatient = (row) => ({
  patientId: String(row?.patientId || row?.PatientId || row?.Id || row?.id || ''),
  uhid: row?.uhid || row?.UHID || 'Pending',
  fullName: row?.fullName || row?.FullName || `${row?.firstName || row?.FirstName || ''} ${row?.lastName || row?.LastName || ''}`.trim(),
  gender: row?.gender || row?.Gender || '',
  phone: row?.phone || row?.Phone || '',
  relationshipToUser: row?.relationshipToUser || row?.RelationshipToUser || 'Self',
});

const normalizeSlot = (slot) => {
  if (typeof slot === 'string') return { time: slot, available: true };
  const time = normalizeTime(slot?.time || slot?.StartTime || slot?.AppointmentTime || '');
  const endTime = normalizeTime(slot?.endTime || slot?.EndTime || '');
  const available = Boolean(slot?.available ?? !(slot?.isBooked ?? slot?.IsBooked ?? false));
  return { ...slot, time, endTime, available };
};

const buildCalendarCells = (visibleMonth) => {
  const [year, month] = visibleMonth.split('-').map(Number);
  const monthIndex = month - 1;
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7;
  const previousMonthDays = new Date(year, monthIndex, 0).getDate();
  const cells = [];

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const date = new Date(year, monthIndex - 1, previousMonthDays - i);
    cells.push({ iso: toIsoDate(date), day: date.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    cells.push({ iso: toIsoDate(date), day, inMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const index = cells.length - (startOffset + daysInMonth) + 1;
    const date = new Date(year, monthIndex + 1, index);
    cells.push({ iso: toIsoDate(date), day: date.getDate(), inMonth: false });
  }
  return cells;
};

// ─── Sub-Components ─────────────────────────────────────────────────────────

function MiniCalendar({ visibleMonth, selectedDate, onSelectDate, onChangeMonth, minDate }) {
  const cells = useMemo(() => buildCalendarCells(visibleMonth), [visibleMonth]);
  const moveMonth = (offset) => {
    const [year, month] = visibleMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    onChangeMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50 border border-slate-200 rounded-xl p-2 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
      {/* Date Pick Input Above Mini Calendar */}
      <div className="mb-2 w-full">
         <input 
           type="date"
           min={minDate}
           value={selectedDate}
           onChange={(e) => { 
             const val = e.target.value;
             onSelectDate(val); 
             if (val) onChangeMonth(val.slice(0, 7)); // sync minicalendar month
           }}
           className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] font-bold text-indigo-900 outline-none focus:border-indigo-500 shadow-sm transition cursor-pointer"
         />
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[14px] font-bold text-slate-900 tracking-tight">Calendar</h3>
        <div className="flex items-center gap-3 text-slate-900">
          <button type="button" onClick={() => moveMonth(-1)} className="hover:opacity-70 transition-opacity"><ChevronLeft size={16} strokeWidth={3} className="text-black" /></button>
          <span className="text-[13px] font-bold">{formatMonthLabel(`${visibleMonth}-01`)}</span>
          <button type="button" onClick={() => moveMonth(1)} className="hover:opacity-70 transition-opacity"><ChevronRight size={16} strokeWidth={3} className="text-black" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-bold text-slate-500 mb-1 px-1">
        {WEEK_DAYS.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-y-1 gap-x-1 px-1 flex-1">
        {cells.map((cell) => {
          const isSelected = cell.iso === selectedDate;
          const isPast = Boolean(minDate && cell.iso < minDate);
          const isToday = cell.iso === minDate; 
          
          return (
            <div key={cell.iso} className="flex justify-center">
              <button
                type="button"
                disabled={isPast && !isToday}
                onClick={() => (!isPast || isToday) && onSelectDate(cell.iso)}
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[11px] font-bold transition-all ${
                  isSelected 
                    ? 'bg-[#0B1120] text-white shadow-md' 
                    : isToday 
                    ? 'bg-[#9CA3AF] text-white' 
                    : cell.inMonth 
                      ? 'text-slate-900 hover:bg-slate-200' 
                      : 'text-slate-400'
                } ${isPast && !isToday ? 'cursor-not-allowed opacity-30' : ''}`}
              >
                {cell.day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DoctorCard({ doctor, selected, onSelect }) {
  return (
    <div className={`group relative w-full overflow-hidden rounded-xl bg-white transition-all flex items-center p-3 gap-3 border shadow-sm ${selected ? 'border-[#0B1120] ring-1 ring-[#0B1120]' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
       {selected && <div className="absolute inset-y-0 left-0 w-[4px] bg-[#0B1120]" />}
       <button
         type="button"
         onClick={() => onSelect(doctor)}
         className="absolute inset-0 w-full h-full cursor-pointer z-10 focus:outline-none"
       />
       {doctor.photoUrl ? (
          <img src={doctor.photoUrl} alt={doctor.doctorName} className={`h-14 w-14 rounded-xl object-cover border border-slate-200 ${selected ? 'ml-1' : ''}`} />
       ) : (
          <div className={`flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white border border-slate-200 ${selected ? 'ml-1' : ''}`}>
            {initials(doctor.doctorName)}
          </div>
       )}
       <div className="flex-1 min-w-0 pr-1 py-1 flex flex-col justify-center text-left">
         <h4 className="truncate text-[14px] font-bold text-slate-900 tracking-tight">{doctor.doctorName}</h4>
         <p className="truncate text-[11px] font-semibold text-slate-600 mt-0.5">{doctor.departmentName ? `${doctor.departmentName} - ` : ''}{doctor.specializationName}</p>
         <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
           <span className="text-black">★</span>
           <span>4.6</span> 
           <span className="text-slate-500 font-medium tracking-tight">(210)</span>
         </div>
       </div>
       {selected && (
         <div className="flex-none pr-3">
           <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#0B1120] text-white">
             <Check size={12} strokeWidth={4} />
           </div>
         </div>
       )}
    </div>
  );
}

function SlotButton({ slot, selected, onSelect }) {
  return (
    <button
      type="button"
      disabled={!slot.available}
      onClick={() => slot.available && onSelect(slot.time)}
      className={`rounded-lg border px-1 py-2 text-center text-[13px] font-bold tracking-tight transition-all disabled:opacity-30 ${
        selected ? 'border-[#0B1120] bg-slate-200 text-[#0B1120] shadow-inner' : slot.available ? 'border-slate-300 bg-white text-slate-800 hover:border-[#0B1120] hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
      }`}
    >
      {formatTimeRange(slot.time, slot.endTime)}
    </button>
  );
}

function PaymentMethodCard({ method, selected, onSelect }) {
  const Icon = method.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(method.id)}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
        selected ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
        <Icon size={20} />
      </div>
      <span className={`text-[13px] font-bold ${selected ? 'text-indigo-900' : 'text-slate-700'}`}>{method.label}</span>
      {selected && <div className="absolute right-2 top-2"><CheckCircle2 size={16} className="text-indigo-600" /></div>}
    </button>
  );
}

function SuccessState({ result, doctor, patient, date, time, endTime, onBack, onBookAnother }) {
  return (
    <div className="mx-auto max-w-2xl rounded-[36px] border border-emerald-100 bg-white p-8 shadow-[0_28px_70px_-36px_rgba(16,185,129,0.35)] mt-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-lg shadow-emerald-200"><CheckCircle2 size={28} /></div>
        <div>
          <p className="text-2xl font-black tracking-tight text-slate-900">Appointment booked successfully</p>
          <p className="text-sm text-slate-500">The appointment is now confirmed in the system.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-white/45">Token</p>
          <p className="mt-2 text-5xl font-black leading-none">{result?.token || '--'}</p>
          <p className="mt-4 text-sm text-white/70">Ref {result?.appointmentNo || '--'}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
          <div className="space-y-4 text-sm text-slate-600">
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Patient</p><p className="mt-0.5 text-lg font-bold text-slate-900">{patient?.fullName || 'Patient'}</p></div>
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Doctor</p><p className="mt-0.5 font-semibold text-slate-900">{doctor?.doctorName || 'Doctor'}</p></div>
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Scheduled</p><p className="mt-0.5 font-semibold text-slate-900">{formatSummaryDate(date)} | {formatTimeRange(time, endTime)}</p></div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={onBookAnother} className="rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition">Book Another</button>
        <button type="button" onClick={onBack} className="rounded-2xl bg-teal-600 px-6 py-3.5 text-[14px] font-bold text-white hover:bg-teal-700 shadow-sm shadow-teal-200 transition">Go to Appointments</button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function AppointmentBookingBoard({ mode = 'auto' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, activePatientProfile, patientProfiles } = useAuth();

  const hospitalId = getHospitalId(user);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const isDeskMode = mode === 'desk' || (mode === 'auto' && APPOINTMENT_DESK_ROLES.includes(user?.role));
  const activePatientSource = activePatientProfile || patientProfiles?.[0] || null;

  const prefills = useMemo(() => ({
    doctorId: searchParams.get('doctorId') || '',
    departmentId: searchParams.get('departmentId') || '',
    date: searchParams.get('date') || todayIso,
    time: normalizeTime(searchParams.get('time') || ''),
    visitType: searchParams.get('visitType') || 'OPD',
    priority: searchParams.get('priority') || 'Normal',
  }), [searchParams, todayIso]);

  // View state
  const [step, setStep] = useState('select'); // 'select' | 'payment' | 'success'

  // Form State
  const [selectionQuery, setSelectionQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(isDeskMode ? null : normalizePatient(activePatientSource || {}));
  
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  
  const [selectedDepartment, setSelectedDepartment] = useState(prefills.departmentId);
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  
  const [selectedDate, setSelectedDate] = useState(prefills.date);
  const [visibleMonth, setVisibleMonth] = useState(prefills.date.slice(0, 7));
  const [selectedTime, setSelectedTime] = useState(prefills.time);
  
  const [slots, setSlots] = useState([]);
  const [successResult, setSuccessResult] = useState(null);
  const [loading, setLoading] = useState({ departments: true, doctors: false, patients: false, slots: false, submit: false });

  // Payment State
  const [payMethod, setPayMethod] = useState('card');
  const [payLater, setPayLater] = useState(false);
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState({ name: '', account: '', ifsc: '' });

  // Enforce patient initialization
  useEffect(() => {
    if (!isDeskMode) setSelectedPatient(normalizePatient(activePatientSource || {}));
  }, [activePatientSource, isDeskMode]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.time === selectedTime) || null,
    [selectedTime, slots]
  );

  const setLoadingKey = useCallback((key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadDepartments = useCallback(async () => {
    setLoadingKey('departments', true);
    try {
      const payload = await api.get(`/departments?hospitalId=${hospitalId}`);
      setDepartments(toArray(payload, ['departments']).map((row) => ({
        id: String(row?.Id || row?.id || row?.DepartmentId || ''),
        name: row?.Name || row?.name || row?.DepartmentName || 'Department',
      })));
    } catch (error) {
      toast.error(error.message || 'Could not load departments');
      setDepartments([]);
    } finally {
      setLoadingKey('departments', false);
    }
  }, [hospitalId, setLoadingKey]);

  const loadDoctors = useCallback(async (departmentId = '') => {
    setLoadingKey('doctors', true);
    try {
      const params = new URLSearchParams({ hospitalId, limit: '200' });
      if (departmentId) params.set('departmentId', departmentId);
      const payload = await api.get(`/doctors?${params.toString()}`);
      setDoctors(
        toArray(payload, ['doctors', 'results'])
          .map(normalizeDoctor)
          .filter((doctor) => Number.parseInt(doctor.doctorId, 10) > 0)
      );
    } catch (error) {
      toast.error(error.message || 'Could not load doctors');
      setDoctors([]);
    } finally {
      setLoadingKey('doctors', false);
    }
  }, [hospitalId, setLoadingKey]);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);
  useEffect(() => { loadDoctors(selectedDepartment); }, [loadDoctors, selectedDepartment]);

  // OPD Patient Selection Search
  useEffect(() => {
    if (!isDeskMode) return undefined;
    if (!selectionQuery.trim() || selectionQuery.trim().length < 2) {
      setPatientResults([]);
      return undefined;
    }
    setLoadingKey('patients', true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const payload = await api.get(`/patients/search?q=${encodeURIComponent(selectionQuery.trim())}&limit=8`);
        setPatientResults(toArray(payload, ['patients', 'results']).map(normalizePatient));
      } catch {
        setPatientResults([]);
      } finally {
        setLoadingKey('patients', false);
      }
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [isDeskMode, selectionQuery, setLoadingKey]);

  const specializationOptions = useMemo(() => {
    const seen = new Map();
    doctors.forEach((doctor) => {
      if (!doctor.specializationName) return;
      const key = doctor.specializationId || doctor.specializationName;
      if (!seen.has(key)) seen.set(key, { id: String(doctor.specializationId || ''), name: doctor.specializationName });
    });
    return Array.from(seen.values());
  }, [doctors]);

  useEffect(() => {
    if (!selectedSpecialization) return;
    const exists = specializationOptions.some((option) => option.id === selectedSpecialization || option.name === selectedSpecialization);
    if (!exists) setSelectedSpecialization('');
  }, [selectedSpecialization, specializationOptions]);

  const filteredDoctors = useMemo(() => {
    const query = doctorSearchQuery.trim().toLowerCase();
    return doctors.filter((doctor) => {
      const matchesSpecialization = !selectedSpecialization || doctor.specializationId === selectedSpecialization || doctor.specializationName === selectedSpecialization;
      const matchesQuery = !query || [doctor.doctorName, doctor.departmentName, doctor.specializationName, doctor.phone, doctor.email].join(' ').toLowerCase().includes(query);
      return matchesSpecialization && matchesQuery;
    });
  }, [doctors, doctorSearchQuery, selectedSpecialization]);

  useEffect(() => {
    if (!filteredDoctors.length) {
      setSelectedDoctor(null);
      setSelectedTime('');
      return;
    }
    if (selectedDoctor && filteredDoctors.some((doctor) => doctor.doctorId === selectedDoctor.doctorId)) return;
    if (prefills.doctorId) {
      const prefilledDoctor = filteredDoctors.find((doctor) => doctor.doctorId === prefills.doctorId);
      if (prefilledDoctor) {
        setSelectedDoctor(prefilledDoctor);
        if (prefilledDoctor.departmentId && prefilledDoctor.departmentId !== selectedDepartment) setSelectedDepartment(prefilledDoctor.departmentId);
        if (prefilledDoctor.specializationId) setSelectedSpecialization(prefilledDoctor.specializationId);
        return;
      }
    }
  }, [filteredDoctors, prefills.doctorId, selectedDepartment, selectedDoctor]);

  useEffect(() => {
    if (!selectedDoctor || !selectedDate) {
      setSlots([]);
      setSelectedTime('');
      return;
    }
    setLoadingKey('slots', true);
    setSelectedTime((current) => (current && current === prefills.time ? current : ''));
    api.get(`/doctors/${selectedDoctor.doctorId}/slots?date=${selectedDate}&includeUnavailable=1`)
      .then((payload) => {
        const rows = toArray(payload, ['slots']).map(normalizeSlot).filter((slot) => slot.time);
        const sorted = [...rows].sort((left, right) => left.time.localeCompare(right.time));
        setSlots(sorted);
        if (prefills.time && sorted.some((slot) => slot.time === prefills.time && slot.available)) {
          setSelectedTime(prefills.time);
          return;
        }
        setSelectedTime((current) => (current && sorted.some((slot) => slot.time === current && slot.available) ? current : ''));
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingKey('slots', false));
  }, [prefills.time, selectedDate, selectedDoctor, setLoadingKey]);

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedTime('');
    if (doctor.departmentId && doctor.departmentId !== selectedDepartment) setSelectedDepartment(doctor.departmentId);
    if (doctor.specializationId) setSelectedSpecialization(doctor.specializationId);
  };

  const proceedToPayment = () => {
    if (!selectedPatient?.patientId) return toast.error('Please select a patient profile first');
    if (!selectedDoctor?.doctorId) return toast.error('Please select a doctor');
    if (!selectedDate || !selectedTime) return toast.error('Please select date and time');
    setStep('payment');
  };

  const handleBookSubmit = async () => {
    setLoadingKey('submit', true);
    try {
      const payload = {
        doctorId: Number(selectedDoctor.doctorId),
        departmentId: selectedDoctor.departmentId ? Number(selectedDoctor.departmentId) : undefined,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        visitType: prefills.visitType,
        reason: 'General Consultation',
        priority: prefills.priority,
      };
      if (isDeskMode) payload.patientId = Number(selectedPatient.patientId);
      
      const response = await api.post('/appointments', payload);
      const appointment = response?.data || response?.appointment || response || {};
      setSuccessResult({
        token: appointment.TokenNumber || appointment.token || appointment.Token || '--',
        appointmentNo: appointment.AppointmentNo || appointment.appointmentNo || '--',
        endTime: appointment.EndTime || appointment.endTime || selectedSlot?.endTime || '',
      });
      setStep('success');
      toast.success('Appointment booked successfully');
    } catch (error) {
      toast.error(error.message || 'Booking failed. Please try again.');
    } finally {
      setLoadingKey('submit', false);
    }
  };

  // State Renders
  if (step === 'success' && successResult) {
    return (
      <SuccessState
        result={successResult}
        doctor={selectedDoctor}
        patient={selectedPatient}
        date={selectedDate}
        time={selectedTime}
        endTime={successResult?.endTime || selectedSlot?.endTime || ''}
        onBack={() => navigate('/appointments')}
        onBookAnother={() => {
          setSuccessResult(null);
          setSelectedTime('');
          setStep('select');
        }}
      />
    );
  }

  const inputBase = "w-full rounded-xl border-2 px-4 py-3 text-[14px] font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-semibold";
  const inputNorm = "border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

  return (
    <div className="flex h-[calc(100vh-80px)] w-full flex-col gap-3 overflow-y-auto bg-[#E5E7EB] p-3 font-serif max-w-[1440px] mx-auto">
       
       {/* Top Navigation Card */}
       <div className="flex-none rounded-xl bg-white p-3 shadow-sm border border-slate-200 relative z-20">
         <div className="flex flex-col gap-2">
           {/* Top Row: General Info/Search */}
           <div className="flex flex-col gap-2 md:flex-row md:items-end">
             {/* SELECTION SEARCH (OPD Desk only) */}
             {isDeskMode && (
               <div className="flex-[1.5] relative">
                 <label className="mb-1 block text-[11px] font-extrabold text-slate-500 tracking-wider">PATIENT SEARCH</label>
                 <div className="relative">
                   <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold" />
                   <input 
                     value={selectionQuery} 
                     onChange={(event) => setSelectionQuery(event.target.value)} 
                     placeholder="Name, Phone, Email..." 
                     className="h-[34px] w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400" 
                   />
                   {selectionQuery.trim().length >= 2 && (
                     <div className="absolute left-0 right-0 top-[40px] z-50 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                       {loading.patients ? (
                         <div className="flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-semibold text-slate-500"><Loader2 size={16} className="animate-spin" />Searching...</div>
                       ) : patientResults.length ? (
                         <div className="space-y-1">
                           {patientResults.map((p) => (
                             <button key={p.patientId} type="button" onClick={() => { setSelectedPatient(p); setSelectionQuery(''); setPatientResults([]); }} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                               <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-[10px] font-black text-indigo-700">{initials(p.fullName)}</div>
                               <div className="min-w-0">
                                 <p className="truncate text-[12px] font-bold text-slate-900 leading-tight">{p.fullName}</p>
                                 <p className="truncate text-[10px] font-semibold text-slate-500">{p.uhid} | {p.phone}</p>
                               </div>
                             </button>
                           ))}
                         </div>
                       ) : <div className="px-4 py-3 text-center text-[12px] font-semibold text-slate-500">No matching patients.</div>}
                     </div>
                   )}
                 </div>
               </div>
             )}

             {isDeskMode && selectedPatient && (
               <div className="flex-none">
                 <button type="button" onClick={() => { setSelectedPatient(null); setSelectionQuery(''); }} className="flex h-[34px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[11px] font-extrabold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm w-full md:w-auto">
                   CLEAR
                 </button>
               </div>
             )}

             {/* PATIENT ID */}
             <div className="flex-1">
               <label className="mb-1 block text-[11px] font-extrabold text-slate-500 tracking-wider">PATIENT ID</label>
               <div className="flex h-[34px] items-center rounded-lg bg-slate-100 border border-slate-200 px-3 text-[13px] font-extrabold text-slate-700 uppercase disable-select">
                 {selectedPatient?.uhid || '—'}
               </div>
             </div>

             {/* PATIENT NAME */}
             <div className="flex-1">
               <label className="mb-1 block text-[11px] font-extrabold text-slate-500 tracking-wider">PATIENT NAME</label>
               <div className="flex h-[34px] items-center rounded-lg bg-slate-100 border border-slate-200 px-3 text-[13px] font-extrabold text-slate-700 uppercase disable-select">
                 {selectedPatient?.fullName || '—'}
               </div>
             </div>
           </div>

           {/* Bottom Row: Dept/Spec filters */}
           <div className="grid gap-3 md:grid-cols-2">
             <div className="flex items-center">
               <label className="w-[100px] shrink-0 text-[11px] font-extrabold text-slate-500 tracking-wider">DEPARTMENT</label>
               <select 
                 value={selectedDepartment} 
                 onChange={(event) => { setSelectedDepartment(event.target.value); setSelectedDoctor(null); setSelectedSpecialization(''); setSelectedTime(''); }} 
                 className="h-[34px] w-full appearance-none rounded-lg bg-slate-50 border border-slate-200 px-3 text-[12px] font-bold text-slate-800 outline-none hover:bg-white flex-1 transition"
                 style={{ paddingRight: '2.5rem', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.8rem center", backgroundSize: "1rem" }}
               >
                 <option value="">All Departments</option>
                 {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
               </select>
             </div>
             <div className="flex items-center">
               <label className="w-[100px] shrink-0 text-[11px] font-extrabold text-slate-500 tracking-wider">SPECIALTY</label>
               <select 
                 value={selectedSpecialization} 
                 onChange={(event) => { setSelectedSpecialization(event.target.value); setSelectedDoctor(null); setSelectedTime(''); }} 
                 className="h-[34px] w-full appearance-none rounded-lg bg-slate-50 border border-slate-200 px-3 text-[12px] font-bold text-slate-800 outline-none hover:bg-white flex-1 transition"
                 style={{ paddingRight: '2.5rem', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.8rem center", backgroundSize: "1rem" }}
               >
                 <option value="">All Specializations</option>
                 {specializationOptions.map((specialization) => <option key={specialization.id || specialization.name} value={specialization.id || specialization.name}>{specialization.name}</option>)}
               </select>
             </div>
           </div>
         </div>
       </div>

       {/* Main Workflow Area */}
       <div className="flex min-h-[380px] flex-1 pb-1">
         
         {step === 'select' ? (
           <div className="flex w-full gap-4 xl:flex-row flex-col max-h-full">
             {/* LEFT COL: DOCTOR LIST w/ Search */}
             <div className="flex flex-[1] min-w-[300px] max-w-[340px] flex-col overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
               <h2 className="text-[16px] font-black text-slate-900 tracking-tight mb-2">Select Doctor</h2>
               <div className="relative mb-2 flex-none">
                 <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold" />
                 <input 
                   value={doctorSearchQuery} 
                   onChange={(event) => setDoctorSearchQuery(event.target.value)} 
                   placeholder="Search..." 
                   className="h-[34px] w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400" 
                 />
               </div>
               <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                 {loading.doctors ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-50/80 border border-slate-100" />) : filteredDoctors.length ? filteredDoctors.map((doctor) => <DoctorCard key={doctor.doctorId} doctor={doctor} selected={doctor.doctorId === selectedDoctor?.doctorId} onSelect={handleDoctorSelect} />) : (
                   <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center mt-2">
                     <Stethoscope size={24} className="mx-auto text-slate-300" />
                     <p className="mt-3 text-[13px] font-bold text-slate-500">No doctors found</p>
                   </div>
                 )}
               </div>
             </div>

             {/* MIDDLE COL: DATE CALENDAR */}
             <div className="flex flex-[0.8] min-w-[280px] max-w-[340px] flex-col gap-2">
               <div className="flex-1 flex flex-col rounded-2xl bg-white px-3 py-3 shadow-sm border border-slate-200 h-full overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                 <h3 className="text-[13px] font-extrabold text-slate-900 tracking-tight uppercase mb-2">Select Date</h3>
                 <MiniCalendar 
                    visibleMonth={visibleMonth} 
                    selectedDate={selectedDate} 
                    onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(''); }} 
                    onChangeMonth={setVisibleMonth} 
                    minDate={todayIso} 
                 />
               </div>
             </div>

             {/* RIGHT COL: SLOTS & ACTION */}
             <div className="flex flex-[1.2] flex-col rounded-2xl bg-white px-4 py-4 shadow-sm border border-slate-200 overflow-hidden">
               <div className="mb-3 flex items-center justify-between">
                 <h3 className="text-[13px] font-extrabold text-slate-900 tracking-tight uppercase">Time Slot Selection</h3>
                 {loading.slots ? <Loader2 size={16} className="animate-spin text-slate-400" /> : null}
               </div>
               <div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                 {slots.length ? (
                   <div className="grid grid-cols-3 sm:grid-cols-3 gap-x-2 gap-y-2">
                     {slots.map((slot) => <SlotButton key={slot.time} slot={slot} selected={selectedTime === slot.time} onSelect={setSelectedTime} />)}
                   </div>
                 ) : (
                   <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50 p-6 text-center mt-2">
                     <Clock3 size={24} className="text-slate-300" />
                     <p className="mt-2 text-[13px] font-bold text-slate-500">
                       {selectedDoctor?.doctorId && selectedDate
                         ? 'No published slots available for this doctor on the selected date'
                         : 'Pick a doctor and date to view slots'}
                     </p>
                   </div>
                 )}
               </div>
               
               {/* Action Bar */}
               <div className="pt-3 mt-1 border-t border-slate-100 flex-none">
                 <button 
                   type="button" 
                   onClick={proceedToPayment} 
                   disabled={!selectedPatient?.patientId || !selectedDoctor?.doctorId || !selectedDate || !selectedTime} 
                   className="w-full flex items-center justify-center gap-2 h-[42px] rounded-xl bg-indigo-600 text-[13px] font-extrabold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all uppercase tracking-wide"
                 >
                   Proceed & Pay
                 </button>
               </div>
             </div>
           </div>
         ) : step === 'payment' ? (
           <div className="flex w-full items-center justify-center flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="w-full max-w-[800px]">
                <button type="button" onClick={() => setStep('select')} className="mb-4 flex items-center gap-2 text-[13px] font-bold text-slate-500 hover:text-slate-900 transition bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 w-fit">
                  <ArrowLeft size={16} /> Back to Selection
                </button>
                
                <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                  {/* Summary Block */}
                  <div className="w-full md:w-[320px] bg-slate-900 text-white p-8 flex flex-col justify-between">
                     <div>
                       <h3 className="text-[20px] font-black tracking-tight leading-tight mb-8">Appointment<br/>Summary</h3>
                       
                       <div className="space-y-6">
                         <div>
                           <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-1">Patient</p>
                           <p className="text-[15px] font-semibold text-slate-100">{selectedPatient?.fullName}</p>
                         </div>
                         <div>
                           <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-1">Doctor</p>
                           <p className="text-[15px] font-semibold text-slate-100">{selectedDoctor?.doctorName}</p>
                           <p className="text-[13px] text-slate-400">{selectedDoctor?.departmentName}</p>
                         </div>
                         <div>
                           <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-1">Schedule</p>
                           <p className="text-[15px] font-semibold text-slate-100">{formatSummaryDate(selectedDate)}</p>
                           <p className="text-[13px] text-slate-400">{formatTimeRange(selectedTime, selectedSlot?.endTime)}</p>
                         </div>
                       </div>
                     </div>
                     <div className="mt-12 pt-6 border-t border-slate-800">
                        <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-1">Consultation Fee</p>
                        <p className="text-[28px] font-black text-emerald-400">₹{selectedDoctor?.consultationFee || 500}</p>
                     </div>
                  </div>

                  {/* Payment Block */}
                  <div className="flex-1 p-8 bg-white">
                     <h3 className="text-[18px] font-black text-slate-900 tracking-tight mb-6">Payment Details</h3>
                     
                     <div className="grid gap-3 grid-cols-3 mb-6">
                       {PAYMENT_METHODS.map((method) => (
                         <PaymentMethodCard key={method.id} method={method} selected={!payLater && payMethod === method.id} onSelect={setPayMethod} />
                       ))}
                     </div>

                     <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 cursor-pointer hover:bg-slate-100 transition shadow-sm mb-6">
                       <div>
                         <p className="text-[14px] font-extrabold text-slate-900 leading-none mb-1.5">Mark as Pay Later</p>
                         <p className="text-[12px] font-semibold text-slate-500 leading-none">Patient will complete payment at the reception.</p>
                       </div>
                       <input type="checkbox" checked={payLater} onChange={(e) => setPayLater(e.target.checked)} className="h-5 w-5 rounded-md border-slate-300 text-indigo-600 pointer-events-none focus:ring-indigo-500" />
                     </label>

                     <div className="min-h-[160px]">
                       {!payLater && payMethod === 'card' && (
                         <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 animate-in fade-in fill-mode-forwards">
                           <div className="col-span-2">
                             <input value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 19) }))} className={inputBase + ' ' + inputNorm} placeholder="Card Number (0000 0000 0000 0000)" />
                           </div>
                           <div>
                             <input value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} className={inputBase + ' ' + inputNorm} placeholder="Cardholder Name" />
                           </div>
                           <div className="flex gap-4">
                             <input value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} className={inputBase + ' ' + inputNorm + ' w-2/3'} placeholder="MM/YY" />
                             <input type="password" value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))} className={inputBase + ' ' + inputNorm + ' w-1/3 text-center'} placeholder="CVV" />
                           </div>
                         </div>
                       )}

                       {!payLater && payMethod === 'upi' && (
                         <div className="max-w-sm animate-in fade-in fill-mode-forwards">
                           <input value={upiId} onChange={(e) => setUpiId(e.target.value)} className={inputBase + ' ' + inputNorm} placeholder="UPI ID (e.g., name@bank)" />
                         </div>
                       )}

                       {!payLater && payMethod === 'net' && (
                         <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 animate-in fade-in fill-mode-forwards">
                           <div className="col-span-2">
                             <input value={bank.name} onChange={(e) => setBank((c) => ({ ...c, name: e.target.value }))} className={inputBase + ' ' + inputNorm} placeholder="Bank Name (e.g., HDFC, SBI)" />
                           </div>
                           <div>
                             <input value={bank.account} onChange={(e) => setBank((c) => ({ ...c, account: e.target.value.replace(/\D/g, '').slice(0, 18) }))} className={inputBase + ' ' + inputNorm} placeholder="Account No" />
                           </div>
                           <div>
                             <input value={bank.ifsc} onChange={(e) => setBank((c) => ({ ...c, ifsc: e.target.value.toUpperCase() }))} className={inputBase + ' ' + inputNorm} placeholder="IFSC Code" />
                           </div>
                         </div>
                       )}
                     </div>

                     <div className="pt-6 mt-4 border-t border-slate-100 flex justify-end">
                       <button 
                         type="button" 
                         onClick={handleBookSubmit} 
                         disabled={loading.submit} 
                         className="flex items-center justify-center gap-2 h-[48px] px-8 rounded-xl bg-indigo-600 text-[14px] font-extrabold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 disabled:shadow-none transition-all uppercase tracking-wide min-w-[200px]"
                       >
                         {loading.submit ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Booking'}
                       </button>
                     </div>
                  </div>
                </div>
              </div>
           </div>
         ) : null}

       </div>
    </div>
  );
}
