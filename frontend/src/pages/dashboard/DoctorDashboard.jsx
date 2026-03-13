// src/pages/dashboard/DoctorDashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Calendar, Pill, Clock, RefreshCw, Loader,
  Check, CheckCircle, XCircle, X, Plus, Search,
  Edit2, Download, Camera, BarChart2,
  Activity, Stethoscope, ArrowRight, Bell
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
  SectionHeader, Card, Modal, fmtDate, fmtTime, initials, InfoBadge
} from '../../components/ui';

// ─── Token status config ──────────────────────────────────────────────────────
const Q_STATUS = {
  current: { ring:'ring-2 ring-emerald-400', bg:'bg-emerald-50 text-emerald-700', dot:'bg-emerald-500', label:'In Consult' },
  waiting: { ring:'ring-2 ring-amber-300',   bg:'bg-amber-50 text-amber-700',     dot:'bg-amber-400',   label:'Waiting'   },
  done:    { ring:'ring-2 ring-slate-200',   bg:'bg-slate-100 text-slate-400',    dot:'bg-slate-300',   label:'Done'      },
};

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
const OverviewTab = ({ profile, queue, weeklyStats, loading }) => {
  const done    = queue.filter(x => (x.Status || x.status) === 'done');
  const waiting = queue.filter(x => (x.Status || x.status) === 'waiting');
  const current = queue.find(x  => (x.Status || x.status) === 'current');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Today's Queue" color={BLUE}    value={loading.queue ? null : queue.length}   loading={loading.queue}   trend={5}  />
        <StatCard icon={CheckCircle} label="Seen Today"    color="#059669" value={loading.queue ? null : done.length}    loading={loading.queue}   trend={12} />
        <StatCard icon={Clock}       label="In Queue"      color="#d97706" value={loading.queue ? null : waiting.length} loading={loading.queue}              />
        <StatCard icon={Bell}        label="New Requests"  color="#ef4444" value={loading.requests ? null : 0}           loading={loading.requests}           />
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
const QueueTab = ({ queue, loading, onRefresh, onCallIn, onMarkDone, onRx, search, setSearch }) => {
  const filtered = search
    ? queue.filter(p => (p.Name||p.name||'').toLowerCase().includes(search.toLowerCase()) || (p.Token||p.token||'').toString().includes(search))
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
                  const st  = ((pt.Status||pt.status)||'waiting').toLowerCase();
                  const tok = Q_STATUS[st] || Q_STATUS.waiting;
                  const id  = pt.Id||pt.id;
                  return (
                    <div key={id} className={`grid grid-cols-1 lg:grid-cols-[56px_1fr_64px_1fr_130px_180px] items-center gap-3 px-6 py-4 hover:bg-slate-50/70 transition-colors ${st==='done'?'opacity-50':''}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs ${tok.ring} ${tok.bg}`}>
                        {pt.Token||pt.token}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{pt.Name||pt.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{pt.Gender||pt.gender} · {pt.Phone||pt.phone}</p>
                      </div>
                      <p className="text-sm text-slate-600">{(pt.Age||pt.age)?`${pt.Age||pt.age}yr`:'—'}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{pt.Reason||pt.reason||pt.Type||pt.type||'—'}</p>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{fmtTime(pt.StartTime||pt.time)}</p>
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
                            <button onClick={() => onRx(pt)}
                              className="p-2 rounded-xl border transition-colors"
                              style={{ color:BLUE, borderColor:`${BLUE}25`, background:`${BLUE}0c` }}>
                              <Pill size={13} />
                            </button>
                            <button onClick={() => onMarkDone(id)}
                              className="px-3 py-1.5 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-opacity"
                              style={{ background:'#059669' }}>
                              Mark Done
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
const RequestsTab = ({ requests, loading, onRefresh, onApprove, onReject, approvingId, rejectingId }) => (
  <Card>
    <SectionHeader title="Appointment Requests" icon={Calendar}
      badge={requests.filter(r => (r.Status||r.status||'').toLowerCase()==='pending').length}>
      <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-xl"><RefreshCw size={13} className="text-slate-400" /></button>
    </SectionHeader>
    {loading
      ? [1,2,3].map(i => <SkRow key={i} />)
      : requests.length === 0
        ? <Empty icon={Calendar} text="No appointment requests" />
        : <div className="divide-y divide-slate-50">
            {requests.map(req => {
              const id = req.Id||req.id;
              const st = (req.Status||req.status||'pending').toLowerCase();
              return (
                <div key={id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors flex-wrap">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 border"
                    style={{ background:`${TEAL}0c`, borderColor:`${TEAL}20`, color:TEAL }}>
                    {(req.PatientName||req.patientName||'P')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{req.PatientName||req.patientName||'Patient'}</p>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {(req.Age||req.age) && <span className="text-xs text-slate-400">{req.Age||req.age} yrs</span>}
                      <span className="text-xs text-slate-400 capitalize">{req.Type||req.type||'consultation'}</span>
                      <span className="text-xs text-slate-400">{fmtDate(req.Date||req.date)} · {fmtTime(req.StartTime||req.time)}</span>
                    </div>
                    {(req.Reason||req.reason) && (
                      <p className="text-xs text-slate-400 italic mt-1">"{req.Reason||req.reason}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={req.Status||req.status||'pending'} />
                    {st==='pending' && (
                      <>
                        <button onClick={() => onApprove(id)} disabled={approvingId===id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 disabled:opacity-50">
                          {approvingId===id ? <Loader size={11} className="animate-spin" /> : <CheckCircle size={11} />} Approve
                        </button>
                        <button onClick={() => onReject(id)} disabled={rejectingId===id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-red-50 text-red-600 border-red-100 hover:bg-red-100 disabled:opacity-50">
                          {rejectingId===id ? <Loader size={11} className="animate-spin" /> : <XCircle size={11} />} Reject
                        </button>
                      </>
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
const RxTab = ({ prescriptions, loading, onRefresh, onNew }) => (
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
                  <p className="font-bold text-slate-800 text-sm">{rx.DrugName||rx.drugName||rx.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{rx.Dosage||rx.dosage} · {rx.Frequency||rx.frequency} · {rx.Duration||rx.duration}</p>
                  <p className="text-xs text-slate-400">Patient: {rx.PatientName||rx.patientName||'—'} · {fmtDate(rx.PrescribedDate||rx.date)}</p>
                </div>
                <InfoBadge color={TEAL}>{rx.Status||rx.status||'active'}</InfoBadge>
                <button className="p-2 rounded-xl hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                  <Download size={13} />
                </button>
              </div>
            ))}
          </div>
    }
  </Card>
);

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
              ['Shift Hours',      (schedule?.AvailableFrom && schedule?.AvailableTo) ? `${fmtTime(schedule.AvailableFrom)} – ${fmtTime(schedule.AvailableTo)}` : '—'],
              ['Break',           (schedule?.BreakFrom && schedule?.BreakTo) ? `${fmtTime(schedule.BreakFrom)} – ${fmtTime(schedule.BreakTo)}` : 'No break set'],
              ['Slot Duration',    schedule?.SlotDurationMins ? `${schedule.SlotDurationMins} min` : '—'],
              ['Max Patients',     schedule?.MaxDailyPatients ? `${schedule.MaxDailyPatients} / day` : '—'],
              ['Consultation Fee', schedule?.ConsultationFee  ? `₹${schedule.ConsultationFee}`       : '—'],
              ['Languages',        schedule?.LanguagesSpoken  || profile?.LanguagesSpoken             || '—'],
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
                  {todaySlots.map(s => {
                    const booked = s.IsBooked||s.isBooked;
                    return (
                      <div key={s.Id||s.id}
                        className={`flex flex-col items-center py-2.5 px-2 rounded-xl border text-xs font-semibold ${booked?'bg-slate-100 border-slate-200 text-slate-400':'text-teal-700'}`}
                        style={!booked ? { background:`${TEAL}0c`, borderColor:`${TEAL}25` } : {}}>
                        <span>{fmtTime(s.StartTime||s.time)}</span>
                        <span className={`text-[10px] mt-0.5 ${booked?'text-slate-400':'text-teal-500'}`}>{booked?'Booked':'Open'}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background:TEAL }} />Open</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" />Booked</span>
                  <span className="ml-auto font-semibold text-slate-600">
                    {todaySlots.filter(s => !s.IsBooked && !s.isBooked).length}/{todaySlots.length} available
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
  const [showProfile, setShowProfile] = useState(false);
  const [showRx,      setShowRx]      = useState(null);
  const [profilePic,  setProfilePic]  = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const setL = (k, v) => setLoading(l => ({ ...l, [k]: v }));

  const fetchProfile = useCallback(async () => {
    try {
      const r = await api.get('/doctors/profile');
      const d = r?.data || r;
      setProfile(d);
      setProfilePic(d?.ProfilePicUrl || d?.profilePicUrl || null);
    } catch {}
    finally { setL('profile', false); }
  }, []);

  const fetchQueue = useCallback(async () => {
    setL('queue', true);
    try {
      const r = await api.get(`/appointments/my-queue?date=${new Date().toISOString().split('T')[0]}`);
      setQueue(r?.data || r || []);
    } catch { setQueue([]); }
    finally { setL('queue', false); }
  }, []);

  const fetchRequests = useCallback(async () => {
    setL('requests', true);
    try {
      const r = await api.get('/appointments/pending-requests');
      setRequests(r?.data || r || []);
    } catch { setRequests([]); }
    finally { setL('requests', false); }
  }, []);

  const fetchPrescriptions = useCallback(async () => {
    setL('prescriptions', true);
    try {
      const r = await api.get('/prescriptions/issued');
      setPrescriptions(r?.data || r || []);
    } catch { setPrescriptions([]); }
    finally { setL('prescriptions', false); }
  }, []);

  const fetchSchedule = useCallback(async () => {
    setL('schedule', true);
    try {
      const [sched, slots, stats] = await Promise.allSettled([
        api.get('/doctors/schedule'),
        api.get(`/appointments/slots?doctorId=${user?.doctorId||user?.id}&date=${new Date().toISOString().split('T')[0]}`),
        api.get('/doctors/weekly-stats'),
      ]);
      if (sched.status==='fulfilled') setSchedule(sched.value?.data||sched.value);
      if (slots.status==='fulfilled') setTodaySlots(slots.value?.data||slots.value||[]);
      if (stats.status==='fulfilled') {
        const d = stats.value?.data||stats.value||[];
        setWeeklyStats(Array.isArray(d)?d:[]);
      }
    } catch {}
    finally { setL('schedule', false); }
  }, [user]);

  useEffect(() => {
    fetchProfile(); fetchQueue(); fetchRequests(); fetchPrescriptions(); fetchSchedule();
  }, []);

  const callPatient = async (id) => {
    try {
      await api.patch(`/appointments/${id}/call`);
      setQueue(q => q.map(p => ({
        ...p,
        Status: (p.Id||p.id)===id ? 'current' : (p.Status||p.status)==='current' ? 'waiting' : (p.Status||p.status),
        status: (p.Id||p.id)===id ? 'current' : (p.Status||p.status)==='current' ? 'waiting' : (p.Status||p.status),
      })));
      toast.success('Patient called in');
    } catch { toast.error('Could not update queue'); }
  };

  const markDone = async (id) => {
    try {
      await api.patch(`/appointments/${id}/complete`);
      setQueue(q => q.map(p => (p.Id||p.id)===id ? { ...p, Status:'done', status:'done' } : p));
      toast.success('Consultation complete');
    } catch { toast.error('Update failed'); }
  };

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      await api.patch(`/appointments/${id}/approve`);
      setRequests(r => r.map(a => (a.Id||a.id)===id ? { ...a, Status:'approved', status:'approved' } : a));
      toast.success('Appointment approved');
    } catch { toast.error('Failed to approve'); }
    finally { setApprovingId(null); }
  };

  const handleReject = async (id) => {
    setRejectingId(id);
    try {
      await api.patch(`/appointments/${id}/reject`);
      setRequests(r => r.map(a => (a.Id||a.id)===id ? { ...a, Status:'rejected', status:'rejected' } : a));
      toast.success('Appointment rejected');
    } catch { toast.error('Failed to reject'); }
    finally { setRejectingId(null); }
  };

  const p          = profile || {};
  const doctorName = `Dr. ${p.FirstName||user?.firstName||''} ${p.LastName||user?.lastName||''}`.trim();
  const pending    = requests.filter(x => (x.Status||x.status||'').toLowerCase()==='pending');
  const waiting    = queue.filter(x   => (x.Status||x.status)==='waiting');
  const current    = queue.find(x    => (x.Status||x.status)==='current');

  const TABS = [
    { key:'overview',  label:'Overview',       icon:Activity   },
    { key:'queue',     label:"Today's Queue",  icon:Users,    badge:waiting.length  },
    { key:'requests',  label:'Requests',       icon:Calendar, badge:pending.length  },
    { key:'rx',        label:'Prescriptions',  icon:Pill                            },
    { key:'schedule',  label:'Schedule',       icon:Clock                           },
    { key:'analytics', label:'Analytics',      icon:BarChart2                       },
    { key:'profile',   label:'My Profile',     icon:Edit2                           },
  ];

  const tabContent = {
    overview: <OverviewTab profile={p} queue={queue} weeklyStats={weeklyStats} loading={loading} />,
    queue: (
      <QueueTab queue={queue} loading={loading.queue} onRefresh={fetchQueue}
        onCallIn={callPatient} onMarkDone={markDone} onRx={setShowRx}
        search={search} setSearch={setSearch} />
    ),
    requests: (
      <RequestsTab requests={requests} loading={loading.requests} onRefresh={fetchRequests}
        onApprove={handleApprove} onReject={handleReject}
        approvingId={approvingId} rejectingId={rejectingId} />
    ),
    rx: (
      <RxTab prescriptions={prescriptions} loading={loading.prescriptions}
        onRefresh={fetchPrescriptions}
        onNew={() => setShowRx({ Name:'Manual Entry', name:'Manual Entry' })} />
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

      {/* ── Tab bar ── */}
      <div className="flex gap-1.5 flex-wrap border-b border-slate-200">
        {TABS.map(({ key, label, icon:Icon, badge }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all
              ${activeTab===key
                ? 'border-teal-600 text-teal-700 bg-teal-50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            <Icon size={14} />
            {label}
            {badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${activeTab===key ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Current patient banner ── */}
      {!loading.queue && current && (
        <div className="rounded-2xl border border-emerald-100 overflow-hidden bg-white shadow-sm">
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
              <button onClick={() => markDone(current.Id||current.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                style={{ background:'#059669' }}>
                <CheckCircle size={13} /> Mark Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab content ── */}
      {tabContent[activeTab] || null}

      {/* ── Modals ── */}
      {showProfile && (
        <ProfileModal profile={profile||user} avatar={profilePic} onClose={() => setShowProfile(false)}
          onSave={d => { setProfile(pr => ({ ...pr, ...d })); setProfilePic(d.profilePicUrl); fetchSchedule(); setShowProfile(false); }} />
      )}
      {showRx && (
        <RxModal patient={showRx} onClose={() => setShowRx(null)}
          onSave={() => { fetchPrescriptions(); setShowRx(null); }} />
      )}
    </div>
  );
}