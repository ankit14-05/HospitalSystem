// src/pages/scheduling/AdminScheduleManager.jsx
// Admin assigns weekly schedules to doctors — full CRUD with weekly grid view
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar, Clock, Plus, Edit2, Trash2, X, Save, Loader,
  ChevronDown, Search, Filter, User, Building2, MapPin,
  CheckCircle, AlertCircle, Info, Stethoscope, RefreshCw,
  CalendarDays, Copy, Eye, EyeOff, MoreVertical, Layers,
  ArrowLeft, ArrowRight, Hash
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TODAY_DOW = new Date().getDay();

const VISIT_TYPES = [
  { value:'opd',         label:'OPD',           color:'#0d9488' },
  { value:'teleconsult', label:'Teleconsult',    color:'#6d28d9' },
  { value:'emergency',   label:'Emergency',      color:'#dc2626' },
  { value:'followup',    label:'Follow-up',      color:'#2563eb' },
  { value:'both',        label:'OPD + Tele',     color:'#7c3aed' },
];

const DAY_COLORS = [
  { bg:'#fef3c7', border:'#fbbf24', text:'#92400e', dot:'#f59e0b' }, // Sun
  { bg:'#eff6ff', border:'#93c5fd', text:'#1e40af', dot:'#3b82f6' }, // Mon
  { bg:'#f0fdf4', border:'#86efac', text:'#166534', dot:'#22c55e' }, // Tue
  { bg:'#fdf4ff', border:'#d8b4fe', text:'#5b21b6', dot:'#a855f7' }, // Wed
  { bg:'#fff7ed', border:'#fdba74', text:'#9a3412', dot:'#f97316' }, // Thu
  { bg:'#f0f9ff', border:'#7dd3fc', text:'#075985', dot:'#0ea5e9' }, // Fri
  { bg:'#fdf2f8', border:'#f0abfc', text:'#701a75', dot:'#e879f9' }, // Sat
];

const fmt12 = t => {
  if (!t) return '—';
  const parts = String(t).split(':').map(Number);
  const h = parts[0], m = parts[1] || 0;
  if (isNaN(h)) return '—';
  return `${(h % 12) || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const slotCount = (s, e, d) => {
  if (!s || !e || !d || isNaN(Number(d))) return 0;
  const toMin = t => { const p=String(t).split(':').map(Number); return (p[0]||0)*60+(p[1]||0); };
  const diff = toMin(e) - toMin(s);
  return diff > 0 ? Math.floor(diff / Number(d)) : 0;
};
const initials = n => (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const extractList = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const Sk = ({ w='w-full', h='h-4', r='rounded-lg' }) => (
  <div className={`${w} ${h} ${r} bg-slate-100 animate-pulse`} />
);

// ─── Modal backdrop ───────────────────────────────────────────────────────────
const Modal = ({ children, onClose, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
       style={{ background:'rgba(15,23,42,0.55)', backdropFilter:'blur(4px)' }}>
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide?'max-w-2xl':'max-w-lg'} max-h-[90vh] overflow-y-auto`}
         onClick={e=>e.stopPropagation()}>
      {children}
    </div>
  </div>
);

// ─── Schedule Form ────────────────────────────────────────────────────────────
const ScheduleForm = ({ initial, doctors, rooms, onSave, onClose, saving }) => {
  const [form, setForm] = useState({
    DoctorId:         initial?.DoctorId    || '',
    OpdRoomId:        initial?.OpdRoomId   || '',
    DayOfWeek:        initial?.DayOfWeek   !== undefined ? initial.DayOfWeek : '',
    StartTime:        initial?.StartTime?.slice(0,5) || '',
    EndTime:          initial?.EndTime?.slice(0,5)   || '',
    SlotDurationMins: initial?.SlotDurationMins || 15,
    MaxSlots:         initial?.MaxSlots    || '',
    VisitType:        initial?.VisitType   || 'opd',
    EffectiveFrom:    initial?.EffectiveFrom?.slice(0,10) || new Date().toISOString().slice(0,10),
    EffectiveTo:      initial?.EffectiveTo?.slice(0,10)   || '',
    Notes:            initial?.Notes       || '',
  });

  const upd = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const computedSlots = slotCount(form.StartTime, form.EndTime, form.SlotDurationMins);
  const isEdit = !!initial?.Id;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.DoctorId || form.DayOfWeek === '' || !form.StartTime || !form.EndTime)
      return toast.error('Please fill all required fields');
    if (form.StartTime >= form.EndTime)
      return toast.error('End time must be after start time');
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
            <CalendarDays size={18} className="text-teal-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{isEdit ? 'Edit Schedule' : 'Assign Schedule'}</h3>
            <p className="text-xs text-slate-500">Weekly recurring OPD slot</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Doctor */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Doctor <span className="text-red-500">*</span></label>
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={form.DoctorId} onChange={e=>upd('DoctorId',e.target.value)} required disabled={isEdit}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Select Doctor</option>
              {doctors.map(d => (
                <option key={d.DoctorProfileId} value={d.DoctorProfileId}>
                  Dr. {d.DoctorName} {d.Specialization ? `— ${d.Specialization}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Day + Visit Type row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Day <span className="text-red-500">*</span></label>
            <select
              value={form.DayOfWeek} onChange={e=>upd('DayOfWeek',e.target.value)} required
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none"
            >
              <option value="">Select Day</option>
              {DAYS_FULL.map((d,i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Visit Type</label>
            <select
              value={form.VisitType} onChange={e=>upd('VisitType',e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none"
            >
              {VISIT_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Time row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Start Time <span className="text-red-500">*</span></label>
            <input type="time" value={form.StartTime} onChange={e=>upd('StartTime',e.target.value)} required
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">End Time <span className="text-red-500">*</span></label>
            <input type="time" value={form.EndTime} onChange={e=>upd('EndTime',e.target.value)} required
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none" />
          </div>
        </div>

        {/* Slot duration + max slots */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Slot Duration (mins)</label>
            <select value={form.SlotDurationMins} onChange={e=>upd('SlotDurationMins',Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none">
              {[5,10,15,20,30,45,60].map(v=><option key={v} value={v}>{v} min</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Max Slots Override</label>
            <input type="number" min="1" max="200" placeholder={`Auto: ${computedSlots}`}
              value={form.MaxSlots} onChange={e=>upd('MaxSlots',e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none" />
          </div>
        </div>

        {/* Computed slots indicator */}
        {form.StartTime && form.EndTime && (
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-xl border border-teal-100">
            <Hash size={13} className="text-teal-600" />
            <span className="text-xs text-teal-700 font-medium">
              {computedSlots} computed slots ({form.SlotDurationMins} min each) · {fmt12(form.StartTime)} – {fmt12(form.EndTime)}
            </span>
          </div>
        )}

        {/* Room */}
        {rooms.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">OPD Room</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select value={form.OpdRoomId} onChange={e=>upd('OpdRoomId',e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none">
                <option value="">No specific room</option>
                {rooms.map(r=>(
                  <option key={r.Id} value={r.Id}>
                    Room {r.RoomNumber}{r.RoomName ? ` — ${r.RoomName}` : ''}{r.DepartmentName ? ` (${r.DepartmentName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Effective dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Effective From</label>
            <input type="date" value={form.EffectiveFrom} onChange={e=>upd('EffectiveFrom',e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Effective Until</label>
            <input type="date" value={form.EffectiveTo} onChange={e=>upd('EffectiveTo',e.target.value)}
              min={form.EffectiveFrom}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notes</label>
          <textarea rows={2} placeholder="Any additional notes..." value={form.Notes}
            onChange={e=>upd('Notes',e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none resize-none" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
        <button type="button" onClick={onClose}
          className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          {isEdit ? 'Update Schedule' : 'Assign Schedule'}
        </button>
      </div>
    </form>
  );
};

// ─── Doctor Schedule Card ──────────────────────────────────────────────────────
const ScheduleCard = ({ schedule, onEdit, onDelete }) => {
  const dc = DAY_COLORS[schedule.DayOfWeek] || DAY_COLORS[0];
  const vt = VISIT_TYPES.find(v=>v.value===schedule.VisitType) || VISIT_TYPES[0];
  const slots = schedule.MaxSlots || schedule.ComputedMaxSlots;

  return (
    <div className="group relative bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Day color accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: dc.dot }} />

      <div className="pl-4 pr-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Doctor name */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                   style={{ background: dc.dot }}>
                {initials(schedule.DoctorName)}
              </div>
              <span className="text-sm font-bold text-slate-800 truncate">Dr. {schedule.DoctorName}</span>
            </div>
            {schedule.DepartmentName && (
              <div className="flex items-center gap-1 ml-9 mb-2">
                <Building2 size={11} className="text-slate-400" />
                <span className="text-xs text-slate-500">{schedule.DepartmentName}</span>
              </div>
            )}

            {/* Time & day */}
            <div className="flex flex-wrap items-center gap-1.5 ml-9">
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: dc.bg, color: dc.text, border:`1px solid ${dc.border}` }}>
                {schedule.DayName}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                <Clock size={10} />
                {fmt12(schedule.StartTime)} – {fmt12(schedule.EndTime)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background:`${vt.color}15`, color: vt.color, border:`1px solid ${vt.color}30` }}>
                {vt.label}
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 ml-9 mt-1.5">
              <span className="text-xs text-slate-500">{schedule.SlotDurationMins} min slots</span>
              {slots && <span className="text-xs font-semibold text-teal-700">{slots} max patients</span>}
              {schedule.RoomNumber && (
                <span className="text-xs text-slate-500">
                  <MapPin size={10} className="inline mr-0.5" />Rm {schedule.RoomNumber}
                </span>
              )}
            </div>

            {/* Effective period */}
            <div className="ml-9 mt-1">
              <span className="text-[11px] text-slate-400">
                {fmtDate(schedule.EffectiveFrom)}{schedule.EffectiveTo ? ` → ${fmtDate(schedule.EffectiveTo)}` : ' · ongoing'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={()=>onEdit(schedule)}
              className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-colors">
              <Edit2 size={13} />
            </button>
            <button onClick={()=>onDelete(schedule)}
              className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminScheduleManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [doctors,   setDoctors]   = useState([]);
  const [rooms,     setRooms]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [editTarget,setEditTarget]= useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [search,    setSearch]    = useState('');
  const [filterDoc, setFilterDoc] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [viewMode,  setViewMode]  = useState('grid'); // 'grid' | 'list'

  // ── Load data ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schRes, docRes, roomRes] = await Promise.allSettled([
        api.get('/scheduling/doctor-schedules'),
        api.get('/scheduling/doctors-list'),
        api.get('/scheduling/rooms'),
      ]);

      const loadErrors = [];

      if (schRes.status === 'fulfilled') {
        setSchedules(extractList(schRes.value));
      } else {
        setSchedules([]);
        loadErrors.push(schRes.reason?.message || 'Failed to load schedules');
      }

      if (docRes.status === 'fulfilled') {
        setDoctors(extractList(docRes.value));
      } else {
        setDoctors([]);
        loadErrors.push(docRes.reason?.message || 'Failed to load doctors');
      }

      if (roomRes.status === 'fulfilled') {
        setRooms(extractList(roomRes.value));
      } else {
        setRooms([]);
        const roomMessage = roomRes.reason?.message || 'Failed to load OPD rooms';
        if (schRes.status === 'fulfilled' && docRes.status === 'fulfilled') {
          toast.error(`${roomMessage}. You can still manage schedules without assigning a room.`);
        } else {
          loadErrors.push(roomMessage);
        }
      }

      if (loadErrors.length) {
        toast.error(loadErrors.join(' | '));
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to load schedules');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editTarget?.Id) {
        await api.put(`/scheduling/doctor-schedules/${editTarget.Id}`, form);
        toast.success('Schedule updated');
      } else {
        await api.post('/scheduling/doctor-schedules', form);
        toast.success('Schedule assigned to doctor');
      }
      setShowForm(false);
      setEditTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save schedule');
    } finally { setSaving(false); }
  };

  const handleDelete = async (sch) => {
    setSaving(true);
    try {
      await api.delete(`/scheduling/doctor-schedules/${sch.Id}`);
      toast.success('Schedule removed');
      setDelTarget(null);
      load();
    } catch (e) {
      toast.error('Failed to remove schedule');
    } finally { setSaving(false); }
  };

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = schedules.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.DoctorName?.toLowerCase().includes(q) || s.DepartmentName?.toLowerCase().includes(q);
    const matchDoc = !filterDoc || String(s.DoctorId) === filterDoc;
    const matchDay = filterDay === '' || filterDay === undefined ? true : String(s.DayOfWeek) === filterDay;
    return matchSearch && matchDoc && matchDay;
  });

  // Group by day for grid view
  const byDay = DAYS.map((_, i) => filtered.filter(s => s.DayOfWeek === i));

  // Stats
  const totalDoctors = [...new Set(schedules.map(s=>s.DoctorId))].length;
  const totalSlots   = schedules.reduce((acc,s)=> acc + (s.MaxSlots || s.ComputedMaxSlots || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Doctor Schedule Management</h1>
            <p className="text-sm text-slate-500 mt-0.5">Assign & manage weekly OPD schedules for all doctors</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => navigate('/admin/schedule-manager/new')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-sm">
              <Plus size={15} /> Assign Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-xs text-slate-500">Total Schedules: <strong className="text-slate-700">{schedules.length}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs text-slate-500">Doctors Covered: <strong className="text-slate-700">{totalDoctors}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-xs text-slate-500">Weekly Slots: <strong className="text-slate-700">{totalSlots}</strong></span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search doctor or department..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
        </div>

        <select value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-200 outline-none">
          <option value="">All Doctors</option>
          {doctors.map(d=><option key={d.DoctorProfileId} value={d.DoctorProfileId}>Dr. {d.DoctorName}</option>)}
        </select>

        <select value={filterDay} onChange={e=>setFilterDay(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-200 outline-none">
          <option value="">All Days</option>
          {DAYS_FULL.map((d,i)=><option key={i} value={i}>{d}</option>)}
        </select>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={()=>setViewMode('grid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${viewMode==='grid'?'bg-white text-slate-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            Weekly Grid
          </button>
          <button onClick={()=>setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${viewMode==='list'?'bg-white text-slate-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            List View
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-8">
        {loading ? (
          <div className="grid grid-cols-7 gap-3">
            {DAYS.map((_,i) => (
              <div key={i} className="space-y-2">
                <Sk h="h-8" r="rounded-xl" />
                <Sk h="h-24" r="rounded-xl" />
                <Sk h="h-24" r="rounded-xl" />
              </div>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          // ── Weekly grid ───────────────────────────────────────────────────
          <div className="grid grid-cols-7 gap-3">
            {DAYS.map((day, i) => {
              const dc = DAY_COLORS[i];
              const isToday = i === TODAY_DOW;
              return (
                <div key={i} className="min-w-0">
                  {/* Day header */}
                  <div className={`mb-2 px-3 py-2 rounded-xl text-center ${isToday ? 'bg-teal-600 text-white shadow-md' : ''}`}
                       style={!isToday ? { background: dc.bg, border:`1px solid ${dc.border}` } : {}}>
                    <div className={`text-xs font-bold ${isToday?'text-white':'text-slate-700'}`}>{day}</div>
                    <div className={`text-[10px] mt-0.5 font-medium ${isToday?'text-teal-100':'text-slate-500'}`}>
                      {byDay[i].length} schedule{byDay[i].length!==1?'s':''}
                    </div>
                  </div>

                  {/* Schedule cards in this day column */}
                  <div className="space-y-2">
                    {byDay[i].length === 0 ? (
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                        <p className="text-xs text-slate-400">No schedule</p>
                        <button onClick={() => navigate(`/admin/schedule-manager/new?day=${i}`)}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1 block mx-auto">
                          + Add
                        </button>
                      </div>
                    ) : byDay[i].map(sch => (
                      <div key={sch.Id}
                        className="group relative bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all p-2.5 overflow-hidden cursor-pointer"
                        style={{ borderLeft:`3px solid ${dc.dot}` }}>
                        {/* Doctor initials + name */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                               style={{ background: dc.dot }}>
                            {initials(sch.DoctorName)}
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 truncate">Dr. {sch.DoctorName}</span>
                        </div>
                        {/* Time */}
                        <div className="text-[10px] text-slate-500 mb-1">
                          {fmt12(sch.StartTime)} – {fmt12(sch.EndTime)}
                        </div>
                        {/* Slots */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-teal-700">
                            {sch.MaxSlots || sch.ComputedMaxSlots || '?'} slots
                          </span>
                          <span className="text-[10px] text-slate-400">{sch.SlotDurationMins}m</span>
                        </div>
                        {/* Action buttons on hover */}
                        <div className="absolute inset-0 bg-white/90 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                          <button onClick={() => navigate(`/admin/schedule-manager/${sch.Id}/edit`)}
                            className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-200 transition-colors">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={()=>setDelTarget(sch)}
                            className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-200 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── List view ────────────────────────────────────────────────────
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <CalendarDays size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No schedules found</p>
                <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or assign a new schedule</p>
              </div>
            ) : filtered.map(sch => (
              <ScheduleCard key={sch.Id} schedule={sch}
                onEdit={s => navigate(`/admin/schedule-manager/${s.Id}/edit`)}
                onDelete={s=>setDelTarget(s)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <Modal onClose={()=>{ setShowForm(false); setEditTarget(null); }} wide>
          <ScheduleForm
            initial={editTarget}
            doctors={doctors}
            rooms={rooms}
            onSave={handleSave}
            onClose={()=>{ setShowForm(false); setEditTarget(null); }}
            saving={saving}
          />
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {delTarget && (
        <Modal onClose={()=>setDelTarget(null)}>
          <div className="px-6 py-5">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <AlertCircle size={22} className="text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Remove Schedule?</h3>
            <p className="text-sm text-slate-500 mb-1">
              This will remove the <strong>{delTarget.DayName}</strong> schedule for
            </p>
            <p className="text-sm font-semibold text-slate-700 mb-4">Dr. {delTarget.DoctorName}</p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
              Existing booked appointments will not be affected. Only future slot generation will stop.
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setDelTarget(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={()=>handleDelete(delTarget)} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
