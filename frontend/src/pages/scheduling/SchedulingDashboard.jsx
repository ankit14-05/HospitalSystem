// src/pages/scheduling/SchedulingDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, CalendarOff, Hash, Plus, ChevronLeft, ChevronRight,
  Stethoscope, Briefcase, CheckCircle, XCircle, Edit2, Trash2,
  RefreshCw, AlertCircle, Search, Filter, MoreVertical, Layers,
  ArrowRight, Sun, Sunset, Moon, Zap, Eye, X, Save, Loader
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const DAYS      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TODAY_DOW = new Date().getDay();
const TODAY_STR = new Date().toISOString().slice(0,10);

const SHIFT_COLORS = {
  morning:   { bg:'bg-amber-50',  border:'border-amber-200',  text:'text-amber-700',  dot:'bg-amber-400',  badge:'bg-amber-100 text-amber-700'  },
  afternoon: { bg:'bg-sky-50',    border:'border-sky-200',    text:'text-sky-700',    dot:'bg-sky-400',    badge:'bg-sky-100 text-sky-700'       },
  evening:   { bg:'bg-violet-50', border:'border-violet-200', text:'text-violet-700', dot:'bg-violet-400', badge:'bg-violet-100 text-violet-700' },
  night:     { bg:'bg-slate-50',  border:'border-slate-200',  text:'text-slate-600',  dot:'bg-slate-400',  badge:'bg-slate-100 text-slate-600'   },
  custom:    { bg:'bg-teal-50',   border:'border-teal-200',   text:'text-teal-700',   dot:'bg-teal-400',   badge:'bg-teal-100 text-teal-700'     },
};

const QUEUE_COLORS = {
  waiting:   'bg-amber-100 text-amber-700 border-amber-200',
  called:    'bg-blue-100 text-blue-700 border-blue-200',
  serving:   'bg-green-100 text-green-700 border-green-200',
  served:    'bg-slate-100 text-slate-500 border-slate-200',
  skipped:   'bg-red-100 text-red-600 border-red-200',
  cancelled: 'bg-slate-100 text-slate-400 border-slate-200',
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
const fmt12 = t => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${(h % 12) || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const slotCount = (start, end, dur) => {
  if (!start || !end || !dur) return 0;
  const mins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  return Math.max(0, Math.floor((mins(end) - mins(start)) / dur));
};

const initials = name => (name || '').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

// Helper: safely extract the primary key from a record
// Handles Id, id, DoctorId, StaffId, DoctorProfileId, etc.
const getRecordId = (record, ...fallbackKeys) => {
  if (!record) return '';
  if (record.Id !== undefined) return record.Id;
  if (record.id !== undefined) return record.id;
  for (const key of fallbackKeys) {
    if (record[key] !== undefined) return record[key];
  }
  return '';
};

// Helper: safely extract doctors/staff array from any API response shape
const extractList = (responseData, ...listKeys) => {
  if (!responseData) return [];
  // Try data.data first (most common)
  if (Array.isArray(responseData.data)) return responseData.data;
  // Try named keys
  for (const key of listKeys) {
    if (Array.isArray(responseData[key])) return responseData[key];
  }
  // Try top-level array
  if (Array.isArray(responseData)) return responseData;
  return [];
};

const ShiftIcon = ({ type, size=14 }) => {
  if (type === 'morning')   return <Sun size={size} />;
  if (type === 'afternoon') return <Sun size={size} />;
  if (type === 'evening')   return <Sunset size={size} />;
  if (type === 'night')     return <Moon size={size} />;
  return <Zap size={size} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────
const Card = ({ children, className='' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children, className='' }) => (
  <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-50 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color='bg-slate-100 text-slate-600' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
    {children}
  </span>
);

const Spinner = ({ size='w-5 h-5' }) => (
  <div className={`${size} border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin`} />
);

const EmptyState = ({ icon: Icon, text, sub }) => (
  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
    <Icon size={36} className="mb-3 text-slate-200" strokeWidth={1.5} />
    <p className="text-sm font-semibold">{text}</p>
    {sub && <p className="text-xs mt-1">{sub}</p>}
  </div>
);

// Day selector pill row
const DaySelector = ({ selected, onChange, accentClass='bg-primary-600' }) => (
  <div className="flex gap-1.5 flex-wrap px-6 py-3 border-b border-slate-50">
    {DAYS.map((d,i) => (
      <button key={i} onClick={() => onChange(i)}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
          ${selected === i
            ? `${accentClass} text-white shadow-sm`
            : i === TODAY_DOW
              ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-300'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
        {d}
        {i === TODAY_DOW && <span className="ml-1 text-[9px] opacity-70">·</span>}
      </button>
    ))}
    <span className="ml-auto text-xs text-slate-400 self-center">{DAYS_FULL[selected]}</span>
  </div>
);

// Modal wrapper
const Modal = ({ open, onClose, title, children, width='max-w-lg' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// Form field
const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Input = ({ className='', ...props }) => (
  <input className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700
    focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all
    disabled:bg-slate-50 disabled:text-slate-400 ${className}`} {...props} />
);

const Select = ({ className='', children, ...props }) => (
  <select className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700
    focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all
    disabled:bg-slate-50 ${className}`} {...props}>
    {children}
  </select>
);

const Textarea = ({ className='', ...props }) => (
  <textarea rows={3} className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700
    focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all resize-none ${className}`} {...props} />
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab navigation
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'doctor',  label:'Doctor Schedules', icon:Stethoscope },
  { id:'staff',   label:'Staff Shifts',     icon:Briefcase   },
  { id:'leaves',  label:'Leave Requests',   icon:CalendarOff },
  { id:'slots',   label:'Slot Viewer',      icon:Layers      },
  { id:'queue',   label:'OPD Queue',        icon:Hash        },
];

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 1: Doctor Schedules
// ─────────────────────────────────────────────────────────────────────────────
function DoctorSchedulesTab() {
  const [day,       setDay]       = useState(TODAY_DOW);
  const [schedules, setSchedules] = useState([]);
  const [doctors,   setDoctors]   = useState([]);
  const [rooms,     setRooms]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [search,    setSearch]    = useState('');

  const blank = {
    DoctorId:'', DayOfWeek:String(TODAY_DOW), StartTime:'09:00',
    EndTime:'17:00', SlotDurationMins:'15', VisitType:'opd',
    OpdRoomId:'', EffectiveFrom:TODAY_STR, EffectiveTo:'', Notes:''
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes, rRes] = await Promise.allSettled([
        api.get('/scheduling/doctor-schedules'),
        api.get('/doctors?status=approved&limit=200'),
        api.get('/scheduling/rooms'),
      ]);
      if (sRes.status==='fulfilled') {
        setSchedules(extractList(sRes.value.data));
      }
      if (dRes.status==='fulfilled') {
        const list = extractList(dRes.value.data, 'doctors');
        console.log('Doctors raw response:', dRes.value.data, '→ extracted:', list);
        setDoctors(list);
      }
      if (rRes.status==='fulfilled') {
        setRooms(extractList(rRes.value.data, 'rooms'));
      }
    } catch (err) {
      console.error('DoctorSchedulesTab load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = schedules.filter(s =>
    s.DayOfWeek === day &&
    (!search || `${s.DoctorName} ${s.Specialization}`.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd  = ()  => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = s   => {
    setEditing(s);
    setForm({
      DoctorId: String(getRecordId(s, 'DoctorId')),
      DayOfWeek: String(s.DayOfWeek),
      StartTime: s.StartTime?.slice(0,5),
      EndTime: s.EndTime?.slice(0,5),
      SlotDurationMins: String(s.SlotDurationMins),
      VisitType: s.VisitType,
      OpdRoomId: String(s.OpdRoomId || ''),
      EffectiveFrom: s.EffectiveFrom?.slice(0,10) || TODAY_STR,
      EffectiveTo: s.EffectiveTo?.slice(0,10) || '',
      Notes: s.Notes || ''
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.DoctorId || !form.StartTime || !form.EndTime) {
      toast.error('Doctor, start time and end time are required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        DayOfWeek: +form.DayOfWeek,
        SlotDurationMins: +form.SlotDurationMins,
        OpdRoomId: form.OpdRoomId || null,
        EffectiveTo: form.EffectiveTo || null
      };
      if (editing) await api.put(`/scheduling/doctor-schedules/${getRecordId(editing)}`, payload);
      else         await api.post('/scheduling/doctor-schedules', payload);
      toast.success(editing ? 'Schedule updated' : 'Schedule created');
      setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await api.delete(`/scheduling/doctor-schedules/${id}`);
      toast.success('Schedule deleted'); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const f = (k,v) => setForm(p => ({...p,[k]:v}));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Stethoscope size={16} className="text-primary-500" />
          <h3 className="font-bold text-slate-700">Doctor Schedules</h3>
          <Badge color="bg-primary-100 text-primary-700">{filtered.length} on {DAYS[day]}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search doctor…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-300 w-44" />
          </div>
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><RefreshCw size={14}/></button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors">
            <Plus size={13}/> Add Schedule
          </button>
        </div>
      </CardHeader>

      <DaySelector selected={day} onChange={setDay} accentClass="bg-primary-600" />

      <div className="p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CalendarOff} text={`No schedules on ${DAYS_FULL[day]}`} sub="Add a schedule using the button above" />
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(s => {
              const slots = slotCount(s.StartTime, s.EndTime, s.SlotDurationMins);
              return (
                <div key={getRecordId(s)} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {initials(s.DoctorName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">Dr. {s.DoctorName}</p>
                    <p className="text-xs text-slate-500">{s.Specialization} · {s.DepartmentName}</p>
                    {s.RoomNumber && <p className="text-xs text-slate-400 mt-0.5">Room {s.RoomNumber}</p>}
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-sm font-bold text-slate-700">{fmt12(s.StartTime)} – {fmt12(s.EndTime)}</p>
                    <p className="text-xs text-slate-400">{s.SlotDurationMins} min · <span className="font-semibold text-slate-600">{slots} slots</span></p>
                  </div>
                  <div className="hidden lg:flex flex-col items-end gap-1">
                    <Badge color={s.VisitType==='opd' ? 'bg-green-100 text-green-700' : s.VisitType==='teleconsult' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                      {s.VisitType}
                    </Badge>
                    <p className="text-[10px] text-slate-400">From {fmtDate(s.EffectiveFrom)}</p>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={()=>openEdit(s)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Edit2 size={13}/></button>
                    <button onClick={()=>handleDelete(getRecordId(s))} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={13}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title={editing ? 'Edit Doctor Schedule' : 'Add Doctor Schedule'}>
        <div className="space-y-4">
          <Field label="Doctor" required>
            <Select value={form.DoctorId} onChange={e=>f('DoctorId',e.target.value)}>
              <option value="">Select doctor…</option>
              {doctors.map(d => {
                const id = getRecordId(d, 'DoctorId', 'DoctorProfileId', 'UserId');
                return (
                  <option key={id} value={id}>
                    Dr. {d.FirstName} {d.LastName} – {d.SpecializationName || d.Specialization || 'General'}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Day of Week" required>
            <Select value={form.DayOfWeek} onChange={e=>f('DayOfWeek',e.target.value)}>
              {DAYS_FULL.map((d,i)=><option key={i} value={i}>{d}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time" required><Input type="time" value={form.StartTime} onChange={e=>f('StartTime',e.target.value)}/></Field>
            <Field label="End Time" required><Input type="time" value={form.EndTime} onChange={e=>f('EndTime',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slot Duration (mins)" required>
              <Select value={form.SlotDurationMins} onChange={e=>f('SlotDurationMins',e.target.value)}>
                {[5,10,15,20,30,45,60].map(m=><option key={m} value={m}>{m} min</option>)}
              </Select>
            </Field>
            <Field label="Visit Type">
              <Select value={form.VisitType} onChange={e=>f('VisitType',e.target.value)}>
                <option value="opd">OPD</option>
                <option value="teleconsult">Teleconsult</option>
                <option value="both">OPD + Tele</option>
              </Select>
            </Field>
          </div>
          <Field label="OPD Room">
            <Select value={form.OpdRoomId} onChange={e=>f('OpdRoomId',e.target.value)}>
              <option value="">No room assigned</option>
              {rooms.map(r => {
                const rid = getRecordId(r, 'RoomId');
                return (
                  <option key={rid} value={rid}>
                    Room {r.RoomNumber}{r.RoomName ? ` – ${r.RoomName}` : ''}
                  </option>
                );
              })}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Effective From" required><Input type="date" value={form.EffectiveFrom} onChange={e=>f('EffectiveFrom',e.target.value)}/></Field>
            <Field label="Effective To"><Input type="date" value={form.EffectiveTo} onChange={e=>f('EffectiveTo',e.target.value)}/></Field>
          </div>
          <Field label="Notes"><Textarea value={form.Notes} onChange={e=>f('Notes',e.target.value)} placeholder="Optional notes…"/></Field>
          {form.StartTime && form.EndTime && form.SlotDurationMins && (
            <div className="px-3 py-2 rounded-lg bg-primary-50 border border-primary-100 text-xs text-primary-700">
              This will generate <strong>{slotCount(form.StartTime,form.EndTime,+form.SlotDurationMins)}</strong> slots of {form.SlotDurationMins} min each ({fmt12(form.StartTime)} – {fmt12(form.EndTime)})
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {saving ? <Spinner size="w-4 h-4"/> : <Save size={14}/>} {editing?'Update':'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 2: Staff Shifts
// ─────────────────────────────────────────────────────────────────────────────
function StaffShiftsTab() {
  const [day,     setDay]     = useState(TODAY_DOW);
  const [shifts,  setShifts]  = useState([]);
  const [staff,   setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(null);
  const [search,  setSearch]  = useState('');

  const blank = {
    StaffId:'', DayOfWeek:String(TODAY_DOW), ShiftType:'morning',
    StartTime:'08:00', EndTime:'16:00', BreakStartTime:'', BreakEndTime:'',
    EffectiveFrom:TODAY_STR, EffectiveTo:'', Notes:''
  };
  const [form, setForm] = useState(blank);

  const shiftDefaults = {
    morning:   { s:'08:00', e:'16:00' },
    afternoon: { s:'14:00', e:'22:00' },
    evening:   { s:'16:00', e:'00:00' },
    night:     { s:'22:00', e:'06:00' }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, stRes] = await Promise.allSettled([
        api.get('/scheduling/staff-shifts'),
        api.get('/staff?status=approved&limit=200'),
      ]);
      if (sRes.status==='fulfilled') {
        setShifts(extractList(sRes.value.data));
      }
      if (stRes.status==='fulfilled') {
        const list = extractList(stRes.value.data, 'staff');
        console.log('Staff raw response:', stRes.value.data, '→ extracted:', list);
        setStaff(list);
      }
    } catch (err) {
      console.error('StaffShiftsTab load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = shifts.filter(s =>
    s.DayOfWeek === day &&
    (!search || `${s.StaffName} ${s.Role}`.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd  = ()  => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = s   => {
    setEditing(s);
    setForm({
      StaffId: String(getRecordId(s, 'StaffId')),
      DayOfWeek: String(s.DayOfWeek),
      ShiftType: s.ShiftType,
      StartTime: s.StartTime?.slice(0,5),
      EndTime: s.EndTime?.slice(0,5),
      BreakStartTime: s.BreakStartTime?.slice(0,5) || '',
      BreakEndTime: s.BreakEndTime?.slice(0,5) || '',
      EffectiveFrom: s.EffectiveFrom?.slice(0,10) || TODAY_STR,
      EffectiveTo: s.EffectiveTo?.slice(0,10) || '',
      Notes: s.Notes || ''
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.StaffId || !form.StartTime || !form.EndTime) {
      toast.error('Staff member, start time and end time are required'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        DayOfWeek: +form.DayOfWeek,
        BreakStartTime: form.BreakStartTime || null,
        BreakEndTime: form.BreakEndTime || null,
        EffectiveTo: form.EffectiveTo || null
      };
      if (editing) await api.put(`/scheduling/staff-shifts/${getRecordId(editing)}`, payload);
      else         await api.post('/scheduling/staff-shifts', payload);
      toast.success(editing ? 'Shift updated' : 'Shift created');
      setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this shift?')) return;
    try { await api.delete(`/scheduling/staff-shifts/${id}`); toast.success('Shift deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); }
  };

  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const applyShiftType = type => {
    const d = shiftDefaults[type];
    if (d) setForm(p=>({...p, ShiftType:type, StartTime:d.s, EndTime:d.e}));
    else   setForm(p=>({...p, ShiftType:type}));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Briefcase size={16} className="text-blue-500" />
          <h3 className="font-bold text-slate-700">Staff Shifts</h3>
          <Badge color="bg-blue-100 text-blue-700">{filtered.length} on {DAYS[day]}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 w-44"/>
          </div>
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><RefreshCw size={14}/></button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
            <Plus size={13}/> Add Shift
          </button>
        </div>
      </CardHeader>

      <DaySelector selected={day} onChange={setDay} accentClass="bg-blue-600" />

      <div>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner/></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Briefcase} text={`No staff scheduled on ${DAYS_FULL[day]}`} sub="Add shifts using the button above"/>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(s => {
              const c = SHIFT_COLORS[s.ShiftType] || SHIFT_COLORS.custom;
              return (
                <div key={getRecordId(s)} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {initials(s.StaffName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{s.StaffName}</p>
                    <p className="text-xs text-slate-500">
                      {s.Role?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} · {s.DepartmentName||'No dept'}
                    </p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-sm font-bold text-slate-700">{fmt12(s.StartTime)} – {fmt12(s.EndTime)}</p>
                    {s.BreakStartTime && <p className="text-xs text-slate-400">Break {fmt12(s.BreakStartTime)} – {fmt12(s.BreakEndTime)}</p>}
                  </div>
                  <div className="hidden lg:block">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${c.badge}`}>
                      <ShiftIcon type={s.ShiftType} size={11}/> {s.ShiftType}
                    </span>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={()=>openEdit(s)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Edit2 size={13}/></button>
                    <button onClick={()=>handleDelete(getRecordId(s))} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={13}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title={editing ? 'Edit Staff Shift' : 'Add Staff Shift'}>
        <div className="space-y-4">
          <Field label="Staff Member" required>
            <Select value={form.StaffId} onChange={e=>f('StaffId',e.target.value)}>
              <option value="">Select staff…</option>
              {staff.map(s => {
                const id = getRecordId(s, 'StaffId', 'StaffProfileId', 'UserId');
                return (
                  <option key={id} value={id}>
                    {s.FirstName} {s.LastName} – {s.Role?.replace(/_/g,' ')}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Day of Week" required>
            <Select value={form.DayOfWeek} onChange={e=>f('DayOfWeek',e.target.value)}>
              {DAYS_FULL.map((d,i)=><option key={i} value={i}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Shift Type" required>
            <div className="grid grid-cols-5 gap-1.5">
              {Object.keys(shiftDefaults).concat(['custom']).map(t => {
                const c = SHIFT_COLORS[t];
                return (
                  <button key={t} type="button" onClick={()=>applyShiftType(t)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-all capitalize
                      ${form.ShiftType===t ? `${c.bg} ${c.border} ${c.text}` : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time" required><Input type="time" value={form.StartTime} onChange={e=>f('StartTime',e.target.value)}/></Field>
            <Field label="End Time" required><Input type="time" value={form.EndTime} onChange={e=>f('EndTime',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Break Start"><Input type="time" value={form.BreakStartTime} onChange={e=>f('BreakStartTime',e.target.value)}/></Field>
            <Field label="Break End"><Input type="time" value={form.BreakEndTime} onChange={e=>f('BreakEndTime',e.target.value)}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Effective From" required><Input type="date" value={form.EffectiveFrom} onChange={e=>f('EffectiveFrom',e.target.value)}/></Field>
            <Field label="Effective To"><Input type="date" value={form.EffectiveTo} onChange={e=>f('EffectiveTo',e.target.value)}/></Field>
          </div>
          <Field label="Notes"><Textarea value={form.Notes} onChange={e=>f('Notes',e.target.value)} placeholder="Optional notes…"/></Field>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {saving ? <Spinner size="w-4 h-4"/> : <Save size={14}/>} {editing?'Update':'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 3: Leave Requests
// ─────────────────────────────────────────────────────────────────────────────
function LeaveRequestsTab() {
  const [leaves,     setLeaves]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [acting,     setActing]     = useState(null);
  const [modal,      setModal]      = useState(false);
  const [saving,     setSaving]     = useState(false);

  const blank = { type:'doctor', PersonId:'', LeaveDate:TODAY_STR, LeaveType:'full_day', Reason:'' };
  const [form, setForm] = useState(blank);
  const [people, setPeople] = useState({ doctors:[], staff:[] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes, docPeopleRes] = await Promise.allSettled([
        api.get(`/scheduling/doctor-leaves?status=${filter}`),
        api.get(`/scheduling/staff-leaves?status=${filter}`),
        api.get('/doctors?status=approved&limit=200'),
      ]);
      const dl = dRes.status==='fulfilled'
        ? extractList(dRes.value.data).map(l => ({...l, _type:'doctor'}))
        : [];
      const sl = sRes.status==='fulfilled'
        ? extractList(sRes.value.data).map(l => ({...l, _type:'staff'}))
        : [];
      setLeaves([...dl,...sl].sort((a,b) => new Date(a.LeaveDate) - new Date(b.LeaveDate)));

      if (docPeopleRes.status==='fulfilled') {
        const list = extractList(docPeopleRes.value.data, 'doctors');
        console.log('Leave tab doctors:', docPeopleRes.value.data, '→', list);
        setPeople(p => ({...p, doctors: list}));
      }
    } catch (err) {
      console.error('LeaveRequestsTab load error:', err);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const loadStaff = async () => {
    try {
      const r = await api.get('/staff?status=approved&limit=200');
      const list = extractList(r.data, 'staff');
      console.log('Leave tab staff:', r.data, '→', list);
      setPeople(p => ({...p, staff: list}));
    } catch (err) {
      console.error('loadStaff error:', err);
    }
  };

  const openModal = () => {
    setForm(blank);
    // Load both doctors and staff upfront so both selects work immediately
    loadStaff();
    setModal(true);
  };

  const handleAction = async (leave, action, rejectionReason='') => {
    setActing(leave.Id + leave._type);
    try {
      const ep = leave._type === 'doctor'
        ? `/scheduling/doctor-leaves/${getRecordId(leave)}`
        : `/scheduling/staff-leaves/${getRecordId(leave)}`;
      await api.patch(ep, { status: action, rejectionReason });
      toast.success(`Leave ${action}`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Action failed'); }
    setActing(null);
  };

  const handleSave = async () => {
    if (!form.PersonId || !form.LeaveDate) { toast.error('Person and date are required'); return; }
    setSaving(true);
    try {
      const payload = { LeaveDate:form.LeaveDate, LeaveType:form.LeaveType, Reason:form.Reason, Status:'pending' };
      if (form.type==='doctor') {
        payload.DoctorId = form.PersonId;
        await api.post('/scheduling/doctor-leaves', payload);
      } else {
        payload.StaffId = form.PersonId;
        await api.post('/scheduling/staff-leaves', payload);
      }
      toast.success('Leave request created'); setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  // Reset PersonId when switching between doctor/staff to avoid stale value
  const f = (k,v) => setForm(p => ({...p,[k]:v}));
  const setType = (type) => setForm(p => ({...p, type, PersonId:''}));

  const visible = typeFilter==='all' ? leaves : leaves.filter(l => l._type === typeFilter);

  const statusBg = {
    pending:  'border-l-amber-400',
    approved: 'border-l-green-400',
    rejected: 'border-l-red-400'
  };
  const statusBadge = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600'
  };

  const currentPeople = form.type === 'doctor' ? people.doctors : people.staff;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarOff size={16} className="text-red-500"/>
          <h3 className="font-bold text-slate-700">Leave Requests</h3>
          <Badge color={filter==='pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
            {visible.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e=>setFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300">
            <option value="all">All</option>
            <option value="doctor">Doctors</option>
            <option value="staff">Staff</option>
          </select>
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><RefreshCw size={14}/></button>
          <button onClick={openModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors">
            <Plus size={13}/> Add Leave
          </button>
        </div>
      </CardHeader>

      <div>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner/></div>
        ) : visible.length === 0 ? (
          <EmptyState icon={CheckCircle} text="No leave requests" sub={`No ${filter} leave requests found`}/>
        ) : (
          <div className="divide-y divide-slate-50">
            {visible.map(l => {
              const isActing = acting === l.Id + l._type;
              return (
                <div key={`${l._type}-${getRecordId(l)}`}
                  className={`flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors border-l-2 ${statusBg[l.Status] || 'border-l-slate-200'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0
                    ${l._type==='doctor' ? 'bg-primary-100 text-primary-700' : 'bg-blue-100 text-blue-700'}`}>
                    {initials(l.DoctorName || l.StaffName || l.Name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">
                        {l._type==='doctor' ? 'Dr. ' : ''}{l.DoctorName || l.StaffName || l.Name}
                      </p>
                      <Badge color={l._type==='doctor' ? 'bg-primary-100 text-primary-700' : 'bg-blue-100 text-blue-700'}>
                        {l._type}
                      </Badge>
                      <Badge color={statusBadge[l.Status] || 'bg-slate-100 text-slate-600'}>{l.Status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtDate(l.LeaveDate)} · {l.LeaveType?.replace(/_/g,' ')}
                    </p>
                    {l.Reason && <p className="text-xs text-slate-400 mt-0.5 truncate">{l.Reason}</p>}
                    {l.RejectionReason && <p className="text-xs text-red-400 mt-0.5">Rejected: {l.RejectionReason}</p>}
                  </div>
                  <p className="text-xs text-slate-400 hidden md:block flex-shrink-0">{fmtDate(l.CreatedAt)}</p>
                  {l.Status === 'pending' && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={()=>handleAction(l,'approved')} disabled={isActing}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors">
                        {isActing ? <Spinner size="w-3 h-3"/> : <CheckCircle size={12}/>} Approve
                      </button>
                      <button
                        onClick={() => { const r = window.prompt('Rejection reason (optional):',''); if (r !== null) handleAction(l, 'rejected', r); }}
                        disabled={isActing}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors">
                        <XCircle size={12}/> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Add Leave Request">
        <div className="space-y-4">
          <Field label="Type" required>
            <div className="grid grid-cols-2 gap-2">
              {['doctor','staff'].map(t => (
                <button key={t} type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-lg text-sm font-semibold border capitalize transition-all
                    ${form.type === t
                      ? t === 'doctor'
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {t === 'doctor' ? 'Doctor' : 'Staff'}
                </button>
              ))}
            </div>
          </Field>
          <Field label={form.type==='doctor' ? 'Doctor' : 'Staff Member'} required>
            <Select value={form.PersonId} onChange={e=>f('PersonId',e.target.value)}>
              <option value="">
                {currentPeople.length === 0
                  ? 'Loading…'
                  : `Select ${form.type === 'doctor' ? 'doctor' : 'staff member'}…`}
              </option>
              {currentPeople.map(p => {
                const id = getRecordId(p, 'DoctorId', 'StaffId', 'DoctorProfileId', 'StaffProfileId', 'UserId');
                return (
                  <option key={id} value={id}>
                    {form.type==='doctor' ? 'Dr. ' : ''}{p.FirstName} {p.LastName}
                  </option>
                );
              })}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Leave Date" required>
              <Input type="date" value={form.LeaveDate} onChange={e=>f('LeaveDate',e.target.value)}/>
            </Field>
            <Field label="Leave Type" required>
              <Select value={form.LeaveType} onChange={e=>f('LeaveType',e.target.value)}>
                <option value="full_day">Full Day</option>
                <option value="half_day_am">Half Day AM</option>
                <option value="half_day_pm">Half Day PM</option>
                <option value="custom">Custom Hours</option>
              </Select>
            </Field>
          </div>
          <Field label="Reason">
            <Textarea value={form.Reason} onChange={e=>f('Reason',e.target.value)} placeholder="Reason for leave…"/>
          </Field>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors">
              {saving ? <Spinner size="w-4 h-4"/> : <Save size={14}/>} Submit
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 4: Slot Viewer
// ─────────────────────────────────────────────────────────────────────────────
function SlotViewerTab() {
  const [date,      setDate]      = useState(TODAY_STR);
  const [slots,     setSlots]     = useState([]);
  const [doctors,   setDoctors]   = useState([]);
  const [selDoc,    setSelDoc]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [genLoading,setGenLoading]= useState(false);

  const STATUS_COLORS = {
    available: 'bg-green-50 border-green-200 text-green-700',
    booked:    'bg-blue-50 border-blue-200 text-blue-700',
    blocked:   'bg-slate-100 border-slate-200 text-slate-500',
    on_leave:  'bg-red-50 border-red-200 text-red-500',
    past:      'bg-slate-50 border-slate-100 text-slate-300',
  };

  const loadDoctors = useCallback(async () => {
    try {
      const r = await api.get('/doctors?status=approved&limit=200');
      const list = extractList(r.data, 'doctors');
      console.log('SlotViewer doctors:', r.data, '→', list);
      setDoctors(list);
    } catch (err) {
      console.error('SlotViewer loadDoctors error:', err);
    }
  }, []);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (selDoc) params.append('doctorId', selDoc);
      const r = await api.get(`/scheduling/slots?${params}`);
      setSlots(extractList(r.data));
    } catch {
      setSlots([]);
    }
    setLoading(false);
  }, [date, selDoc]);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);
  useEffect(() => { loadSlots(); }, [loadSlots]);

  const generateSlots = async () => {
    setGenLoading(true);
    try {
      await api.post('/scheduling/slots/generate', { fromDate:date, toDate:date });
      toast.success('Slots generated for ' + fmtDate(date)); loadSlots();
    } catch (e) { toast.error(e.response?.data?.message || 'Generation failed'); }
    setGenLoading(false);
  };

  const blockSlot = async (id) => {
    try {
      await api.patch(`/scheduling/slots/${id}`, { status:'blocked', blockedReason:'Manually blocked by admin' });
      toast.success('Slot blocked'); loadSlots();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const unblockSlot = async (id) => {
    try {
      await api.patch(`/scheduling/slots/${id}`, { status:'available', blockedReason:null });
      toast.success('Slot unblocked'); loadSlots();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const moveDate = d => {
    const nd = new Date(date); nd.setDate(nd.getDate() + d);
    setDate(nd.toISOString().slice(0,10));
  };

  const summary = slots.reduce((acc,s) => { acc[s.Status] = (acc[s.Status]||0)+1; return acc; }, {});

  const grouped = slots.reduce((acc,s) => {
    const key = s.DoctorId || 'unknown';
    if (!acc[key]) acc[key] = { name: s.DoctorName, slots: [] };
    acc[key].slots.push(s);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-violet-500"/>
          <h3 className="font-bold text-slate-700">Slot Viewer</h3>
        </div>
        <button onClick={generateSlots} disabled={genLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-60 transition-colors">
          {genLoading ? <Spinner size="w-3 h-3"/> : <Zap size={13}/>} Generate Slots
        </button>
      </CardHeader>

      {/* Controls */}
      <div className="px-6 py-3 border-b border-slate-50 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={()=>moveDate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft size={16}/></button>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-300"/>
          <button onClick={()=>moveDate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight size={16}/></button>
          <button onClick={()=>setDate(TODAY_STR)} className="ml-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Today</button>
        </div>
        <select value={selDoc} onChange={e=>setSelDoc(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-300 flex-1 min-w-0 max-w-xs">
          <option value="">All Doctors</option>
          {doctors.map(d => {
            const id = getRecordId(d, 'DoctorId', 'DoctorProfileId', 'UserId');
            return (
              <option key={id} value={id}>
                Dr. {d.FirstName} {d.LastName}
              </option>
            );
          })}
        </select>
        <button onClick={loadSlots} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><RefreshCw size={14}/></button>
      </div>

      {/* Summary row */}
      {slots.length > 0 && (
        <div className="px-6 py-3 flex gap-4 border-b border-slate-50 flex-wrap">
          {Object.entries(summary).map(([status,count]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                status==='available' ? 'bg-green-400' :
                status==='booked'    ? 'bg-blue-400'  :
                status==='on_leave'  ? 'bg-red-400'   : 'bg-slate-300'}`}/>
              <span className="text-xs text-slate-600 capitalize">{status.replace('_',' ')}</span>
              <span className="text-xs font-bold text-slate-800">{count}</span>
            </div>
          ))}
          <span className="ml-auto text-xs text-slate-400">{slots.length} total slots</span>
        </div>
      )}

      <div className="p-0">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner/></div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Layers size={36} className="mb-3 text-slate-200" strokeWidth={1.5}/>
            <p className="text-sm font-semibold">No slots for {fmtDate(date)}</p>
            <p className="text-xs mt-1">Click "Generate Slots" to create slots from doctor schedules</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {Object.values(grouped).map(({ name, slots: dSlots }) => (
              <div key={name} className="px-6 py-4">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">Dr. {name}</p>
                <div className="flex flex-wrap gap-2">
                  {dSlots.map(s => (
                    <div key={getRecordId(s)}
                      className={`group relative flex flex-col items-center px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${STATUS_COLORS[s.Status] || 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                      <span>{fmt12(s.StartTime)}</span>
                      {s.TokenNumber && <span className="text-[10px] opacity-70">#{s.TokenNumber}</span>}
                      {(s.Status==='available' || s.Status==='blocked') && (
                        <button
                          onClick={() => s.Status==='available' ? blockSlot(getRecordId(s)) : unblockSlot(getRecordId(s))}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 items-center justify-center text-slate-400 hover:text-red-500 hidden group-hover:flex shadow-sm transition-colors">
                          <X size={8}/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 5: OPD Queue
// ─────────────────────────────────────────────────────────────────────────────
function OpdQueueTab() {
  const [date,    setDate]    = useState(TODAY_STR);
  const [queue,   setQueue]   = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selDoc,  setSelDoc]  = useState('');
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(null);
  const [modal,   setModal]   = useState(false);
  const [saving,  setSaving]  = useState(false);

  const blank = { DoctorId:'', PatientName:'', Priority:'normal', Notes:'' };
  const [form, setForm] = useState(blank);

  const nextAction = status => ({ waiting:'called', called:'serving', serving:'served' }[status] || null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, dRes] = await Promise.allSettled([
        api.get(`/scheduling/queue?date=${date}${selDoc ? `&doctorId=${selDoc}` : ''}`),
        api.get('/doctors?status=approved&limit=200'),
      ]);
      if (qRes.status==='fulfilled') {
        setQueue(extractList(qRes.value.data));
      }
      if (dRes.status==='fulfilled') {
        const list = extractList(dRes.value.data, 'doctors');
        console.log('OpdQueue doctors:', dRes.value.data, '→', list);
        setDoctors(list);
      }
    } catch (err) {
      console.error('OpdQueueTab load error:', err);
    }
    setLoading(false);
  }, [date, selDoc]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, newStatus) => {
    setActing(id);
    try {
      await api.patch(`/scheduling/queue/${id}`, { queueStatus: newStatus });
      setQueue(q => q.map(e => getRecordId(e) === id ? {...e, QueueStatus: newStatus} : e));
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setActing(null);
  };

  const handleSave = async () => {
    if (!form.DoctorId || !form.PatientName) { toast.error('Doctor and patient name are required'); return; }
    setSaving(true);
    try {
      await api.post('/scheduling/queue', { ...form, QueueDate: date });
      toast.success('Patient added to queue'); setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setSaving(false);
  };

  const f = (k,v) => setForm(p => ({...p,[k]:v}));

  const active   = queue.filter(q => ['waiting','called','serving'].includes(q.QueueStatus));
  const complete = queue.filter(q => ['served','skipped','cancelled'].includes(q.QueueStatus));

  const priorityDot = p => ({ urgent:'bg-red-500', vip:'bg-purple-500', normal:'bg-slate-300' }[p] || 'bg-slate-300');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-teal-500"/>
          <h3 className="font-bold text-slate-700">OPD Queue</h3>
          <Badge color="bg-teal-100 text-teal-700">{active.length} active</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><RefreshCw size={14}/></button>
          <button onClick={()=>{ setForm(blank); setModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors">
            <Plus size={13}/> Add to Queue
          </button>
        </div>
      </CardHeader>

      {/* Controls */}
      <div className="px-6 py-3 border-b border-slate-50 flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300"/>
        <button onClick={()=>setDate(TODAY_STR)} className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Today</button>
        <select value={selDoc} onChange={e=>setSelDoc(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300 flex-1 min-w-0 max-w-xs">
          <option value="">All Doctors</option>
          {doctors.map(d => {
            const id = getRecordId(d, 'DoctorId', 'DoctorProfileId', 'UserId');
            return (
              <option key={id} value={id}>
                Dr. {d.FirstName} {d.LastName}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner/></div>
        ) : queue.length === 0 ? (
          <EmptyState icon={Hash} text="Queue is empty" sub="Add patients to the queue using the button above"/>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <p className="px-6 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50">Active — {active.length}</p>
                <div className="divide-y divide-slate-50">
                  {active.map(q => {
                    const qId = getRecordId(q);
                    const isActing = acting === qId;
                    const next = nextAction(q.QueueStatus);
                    return (
                      <div key={qId} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-700 flex-shrink-0">
                          #{q.TokenNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot(q.Priority)}`}/>
                            <p className="font-semibold text-slate-800 text-sm">{q.PatientName || 'Walk-in'}</p>
                          </div>
                          <p className="text-xs text-slate-400">Dr. {q.DoctorName} · {q.QueueStatus}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${QUEUE_COLORS[q.QueueStatus] || ''}`}>
                          {q.QueueStatus}
                        </span>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {next && (
                            <button onClick={()=>updateStatus(qId, next)} disabled={isActing}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold hover:bg-teal-100 disabled:opacity-50 border border-teal-200 transition-colors">
                              {isActing ? <Spinner size="w-3 h-3"/> : <ArrowRight size={11}/>}
                              {next.charAt(0).toUpperCase() + next.slice(1)}
                            </button>
                          )}
                          <button onClick={()=>updateStatus(qId,'skipped')} disabled={isActing}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Skip">
                            <XCircle size={14}/>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {complete.length > 0 && (
              <div>
                <p className="px-6 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50">Completed — {complete.length}</p>
                <div className="divide-y divide-slate-50">
                  {complete.map(q => (
                    <div key={getRecordId(q)} className="flex items-center gap-4 px-6 py-3 opacity-60">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-500 flex-shrink-0">
                        #{q.TokenNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600">{q.PatientName || 'Walk-in'}</p>
                        <p className="text-xs text-slate-400">Dr. {q.DoctorName}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${QUEUE_COLORS[q.QueueStatus] || ''}`}>
                        {q.QueueStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Add Patient to Queue">
        <div className="space-y-4">
          <Field label="Doctor" required>
            <Select value={form.DoctorId} onChange={e=>f('DoctorId',e.target.value)}>
              <option value="">Select doctor…</option>
              {doctors.map(d => {
                const id = getRecordId(d, 'DoctorId', 'DoctorProfileId', 'UserId');
                return (
                  <option key={id} value={id}>
                    Dr. {d.FirstName} {d.LastName}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Patient Name" required>
            <Input value={form.PatientName} onChange={e=>f('PatientName',e.target.value)} placeholder="Patient name or UHID…"/>
          </Field>
          <Field label="Priority">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['normal','Normal','bg-slate-100 text-slate-600 border-slate-300'],
                ['urgent','Urgent','bg-red-100 text-red-700 border-red-300'],
                ['vip',   'VIP',   'bg-purple-100 text-purple-700 border-purple-300']
              ].map(([v,l,c]) => (
                <button key={v} type="button" onClick={()=>f('Priority',v)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all
                    ${form.Priority===v ? c : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notes">
            <Textarea value={form.Notes} onChange={e=>f('Notes',e.target.value)} placeholder="Optional notes…"/>
          </Field>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors">
              {saving ? <Spinner size="w-4 h-4"/> : <Plus size={14}/>} Add to Queue
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SchedulingDashboard() {
  const [tab, setTab] = useState('doctor');

  const TAB_ACCENT = {
    doctor: 'text-primary-600 border-primary-500',
    staff:  'text-blue-600 border-blue-500',
    leaves: 'text-amber-600 border-amber-500',
    slots:  'text-violet-600 border-violet-500',
    queue:  'text-teal-600 border-teal-500',
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Calendar size={22} className="text-primary-500"/> Scheduling
        </h1>
        <p className="page-subtitle">Manage doctor OPD schedules, staff shifts, leave requests, slots, and the live queue.</p>
      </div>

      <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={()=>setTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all
              ${tab===id ? TAB_ACCENT[id] : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'}`}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      <div>
        {tab==='doctor' && <DoctorSchedulesTab/>}
        {tab==='staff'  && <StaffShiftsTab/>}
        {tab==='leaves' && <LeaveRequestsTab/>}
        {tab==='slots'  && <SlotViewerTab/>}
        {tab==='queue'  && <OpdQueueTab/>}
      </div>
    </div>
  );
}