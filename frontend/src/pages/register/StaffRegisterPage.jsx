// src/pages/register/StaffRegisterPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle, ArrowLeft, ArrowRight,
  Activity, Shield, MapPin, Lock, Camera, Check, X,
  Search, Plus, AlertCircle, Briefcase, User, FileText,
  Clock, Calendar, Heart, Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useHospitalBranding from '../../hooks/useHospitalBranding';

const BLOOD_GROUPS  = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS       = ['Male','Female','Other','Prefer Not to Say'];
const MARITAL       = ['Single','Married','Divorced','Widowed'];
const RELIGIONS     = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain','Other'];
const SHIFT_TYPES   = ['Morning','Afternoon','Evening','Night','Rotating'];
const COUNTRY_CODES = ['+91','+1','+44','+971','+61','+65','+49','+81'];

// ── Role colors for custom roles ──────────────────────────────────────────────
const ROLE_COLORS = ['#0ea5e9','#8b5cf6','#10b981','#f59e0b','#6366f1','#ec4899','#64748b','#f97316','#ef4444','#14b8a6'];

const DEFAULT_ROLES = [
  { value:'nurse',          label:'Nurse',               desc:'Patient care & ward management',      color:'#0ea5e9' },
  { value:'receptionist',   label:'Receptionist',        desc:'Front desk & scheduling',             color:'#8b5cf6' },
  { value:'pharmacist',     label:'Pharmacist',          desc:'Dispensing & inventory',              color:'#10b981' },
  { value:'lab_technician', label:'Lab Technician',      desc:'Sample collection & processing',      color:'#f59e0b' },
  { value:'ward_boy',       label:'Ward Boy / Attender', desc:'Ward assistance & patient transport', color:'#6366f1' },
  { value:'housekeeping',   label:'Housekeeping',        desc:'Sanitation & cleanliness',            color:'#ec4899' },
  { value:'security',       label:'Security',            desc:'Hospital premises security',          color:'#64748b' },
  { value:'admin_staff',    label:'Admin Staff',         desc:'Administrative & clerical work',      color:'#f97316' },
];

const STEPS = [
  { id:1, label:'Personal & Contact',  sub:'Basic info, demographics & address',    icon: User      },
  { id:2, label:'Job Details',         sub:'Role, department & employment info',    icon: Briefcase },
  { id:3, label:'Emergency & Account', sub:'Emergency contact & login credentials', icon: Lock      },
];

const todayStr = new Date().toISOString().split('T')[0];

// ── Input restriction helpers ─────────────────────────────────────────────────
const lettersOnly   = v => v.replace(/[^A-Za-z\s]/g, '');
const addressChars  = v => v.replace(/[^A-Za-z0-9\s,./\-#]/g, '');
const digitsOnly    = v => v.replace(/\D/g, '');
const alphaNumUpper = v => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
const langChars     = v => v.replace(/[^A-Za-z\s,]/g, '');

// ── Helpers ───────────────────────────────────────────────────────────────────
const calcAge = dob => {
  if (!dob) return '';
  const b = new Date(dob), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth()-b.getMonth() < 0 || (t.getMonth()===b.getMonth() && t.getDate()<b.getDate())) a--;
  return a < 0 || a > 120 ? '' : String(a);
};

const pwStrength = pw => {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8)  s++; if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { l:'Weak',   c:'#ef4444', w:20  };
  if (s <= 2) return { l:'Fair',   c:'#f97316', w:45  };
  if (s <= 3) return { l:'Good',   c:'#eab308', w:70  };
  return             { l:'Strong', c:'#22c55e', w:100 };
};

// ── Primitives ────────────────────────────────────────────────────────────────
const ib  = `w-full px-3 py-2.5 rounded-xl border text-[13px] text-slate-700 bg-white placeholder:text-slate-300 outline-none transition-all`;
const in_ = `border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`;
const ie  = `border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100`;
const io  = `border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100`;

const FI  = ({ err, ok, className='', ...p }) => <input    className={`${ib} ${err?ie:ok?io:in_} ${className}`} {...p}/>;
const FS  = ({ err, children, className='', ...p }) => <select className={`${ib} ${err?ie:in_} ${className}`} {...p}>{children}</select>;
const FTA = ({ className='', ...p }) => <textarea className={`${ib} ${in_} resize-none ${className}`} {...p}/>;

const FW = ({ label, required, error, hint, children, className='' }) => (
  <div className={className}>
    {label && <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>}
    {children}
    {error && <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{error}</p>}
    {!error && hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

const SecHead = ({ icon:Icon, title, sub, color='#6366f1' }) => (
  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:`${color}18`}}>
      <Icon size={15} style={{color}} strokeWidth={2.2}/>
    </div>
    <div>
      <h3 className="text-[13px] font-semibold text-slate-700 leading-tight">{title}</h3>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  </div>
);

// ── Phone field ───────────────────────────────────────────────────────────────
const PhoneField = ({ code, onCode, val, onChange, err, placeholder='9876543210' }) => (
  <div className={`flex rounded-xl border overflow-hidden transition-all focus-within:ring-2
    ${err
      ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100 bg-red-50'
      : 'border-slate-200 hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-indigo-100'}`}>
    <select value={code} onChange={e=>onCode(e.target.value)}
      className="px-2 bg-slate-50 border-r border-slate-200 text-[12px] text-slate-600 outline-none cursor-pointer py-2.5 min-w-[68px]">
      {COUNTRY_CODES.map(c=><option key={c}>{c}</option>)}
    </select>
    {/* digits only enforced here */}
    <input value={val}
      onChange={e=>{ const v=digitsOnly(e.target.value); if(v.length<=10) onChange(v); }}
      placeholder={placeholder} inputMode="numeric"
      className="flex-1 px-3 py-2.5 text-[13px] text-slate-700 outline-none bg-white placeholder:text-slate-300"/>
  </div>
);

const Dot = ({ status }) => {
  if (!status) return null;
  if (status==='checking')  return <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>;
  if (status==='available') return <Check size={13} className="text-emerald-500"/>;
  if (status==='taken')     return <X     size={13} className="text-red-500"/>;
  return null;
};

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({ value, onChange, items, placeholder, onAddNew, addLabel, disabled, err }) {
  const [open,setOpen]       = useState(false);
  const [q,setQ]             = useState('');
  const [custom,setCustom]   = useState('');
  const [addMode,setAddMode] = useState(false);
  const [cursor,setCursor]   = useState(-1);
  const wrapRef=useRef(null); const listRef=useRef(null); const srchRef=useRef(null);

  const filtered     = items.filter(i=>(i.Name??String(i)).toLowerCase().includes(q.toLowerCase()));
  const selected     = (value!==''&&value!=null) ? items.find(i=>String(i.Id??i)===String(value)) : null;
  const displayLabel = selected ? (selected.Name??String(selected)) : (value ? String(value) : '');

  useEffect(()=>{
    const h = ev => { if (wrapRef.current && !wrapRef.current.contains(ev.target)) { setOpen(false); setAddMode(false); setQ(''); setCursor(-1); } };
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);
  useEffect(()=>{ if(cursor>=0&&listRef.current){ const el=listRef.current.querySelector(`[data-idx="${cursor}"]`); if(el)el.scrollIntoView({block:'nearest'}); }},[cursor]);
  useEffect(()=>{ if(open){ const t=setTimeout(()=>srchRef.current?.focus(),20); return ()=>clearTimeout(t); }},[open]);

  const pick = item => { onChange(item.Id??item, String(item.Name??item)); setOpen(false); setQ(''); setCursor(-1); };

  return (
    <div ref={wrapRef} className="relative">
      <div onClick={()=>{ if(!disabled) setOpen(o=>!o); }} tabIndex={disabled?-1:0}
        onKeyDown={e=>{ if(!disabled&&(e.key==='Enter'||e.key==='ArrowDown')){ e.preventDefault(); setOpen(true); } }}
        className={`${ib} ${err?ie:in_} flex items-center justify-between ${disabled?'opacity-50 cursor-not-allowed':'cursor-pointer'}`}>
        <span className={displayLabel?'text-slate-700':'text-slate-300'} style={{fontSize:13}}>{displayLabel||placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {displayLabel&&!disabled&&<button type="button" onClick={e=>{ e.stopPropagation(); onChange('',''); }} className="p-0.5 text-slate-300 hover:text-slate-500"><X size={10}/></button>}
          <Search size={11} className="text-slate-400"/>
        </div>
      </div>
      {open&&(
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-[999] overflow-hidden">
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input ref={srchRef} value={q} onChange={e=>{ setQ(e.target.value); setCursor(-1); }}
                onKeyDown={e=>{
                  if(e.key==='Escape'){ setOpen(false); setQ(''); return; }
                  if(e.key==='ArrowDown'){ e.preventDefault(); setCursor(p=>Math.min(p+1,filtered.length-1)); return; }
                  if(e.key==='ArrowUp'){  e.preventDefault(); setCursor(p=>Math.max(p-1,0)); return; }
                  if(e.key==='Enter'){ e.preventDefault();
                    if(cursor>=0&&filtered[cursor]){ pick(filtered[cursor]); return; }
                    if(filtered.length===1){ pick(filtered[0]); return; }
                    if(!filtered.length&&q.trim()&&onAddNew){ onAddNew(q.trim()); setOpen(false); setQ(''); }
                  }
                }}
                placeholder="Search..." className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400"/>
            </div>
          </div>
          <div ref={listRef} className="max-h-44 overflow-y-auto">
            {filtered.length>0
              ? filtered.map((item,i)=>{
                  const lbl=item.Name??String(item); const isSel=String(item.Id??item)===String(value);
                  return (
                    <div key={i} data-idx={i} onMouseDown={()=>pick(item)} onMouseEnter={()=>setCursor(i)}
                      className={`px-3 py-2 text-[13px] cursor-pointer flex items-center justify-between transition-colors ${cursor===i?'bg-indigo-50 text-indigo-700':'text-slate-700 hover:bg-slate-50'}`}>
                      <span>{lbl}</span>{isSel&&<Check size={11} className="text-indigo-500"/>}
                    </div>
                  );
                })
              : <div className="px-3 py-4 text-center">
                  <p className="text-[11px] text-slate-400 mb-1.5">No results{q?` for "${q}"`:''}</p>
                  {onAddNew&&q.trim()&&<button onMouseDown={()=>{ onAddNew(q.trim()); setOpen(false); setQ(''); }}
                    className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 mx-auto hover:underline"><Plus size={10}/>Add "{q}"</button>}
                </div>
            }
          </div>
          {onAddNew&&filtered.length>0&&(
            <div className="p-2 border-t border-slate-50">
              {!addMode
                ? <button onMouseDown={()=>setAddMode(true)} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-indigo-200 text-[11px] text-indigo-600 hover:bg-indigo-50">
                    <Plus size={11}/>{addLabel||'Add custom'}
                  </button>
                : <div className="flex gap-1.5">
                    <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Type name..." autoFocus
                      className="flex-1 px-2 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400"
                      onKeyDown={e=>{ if(e.key==='Enter'&&custom.trim()){ onAddNew(custom.trim()); setAddMode(false); setCustom(''); setOpen(false); } if(e.key==='Escape'){ setAddMode(false); setCustom(''); } }}/>
                    <button onMouseDown={()=>{ if(custom.trim()){ onAddNew(custom.trim()); setAddMode(false); setCustom(''); setOpen(false); } }}
                      className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold">Add</button>
                  </div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Custom Role Modal ─────────────────────────────────────────────────────
const AddRoleModal = ({ onAdd, onClose, primary }) => {
  const [label, setLabel] = useState('');
  const [desc,  setDesc]  = useState('');
  const inputRef = useRef(null);
  useEffect(()=>{ setTimeout(()=>inputRef.current?.focus(), 50); },[]);
  const handleAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const value = trimmed.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    onAdd({ value, label: trimmed, desc: desc.trim() || 'Custom staff role' });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-slate-800">Add Custom Role</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={15}/></button>
        </div>
        <div className="space-y-3">
          <FW label="Role Title" required>
            <input ref={inputRef} value={label}
              onChange={e=>setLabel(lettersOnly(e.target.value))}
              onKeyDown={e=>{ if(e.key==='Enter') handleAdd(); if(e.key==='Escape') onClose(); }}
              placeholder="e.g. Dietitian, Physiotherapist"
              className={`${ib} ${in_}`}/>
            <p className="mt-1 text-[11px] text-slate-400">Letters only — no numbers or symbols</p>
          </FW>
          <FW label="Short Description">
            <input value={desc} onChange={e=>setDesc(e.target.value)}
              placeholder="Brief role description (optional)"
              className={`${ib} ${in_}`}/>
          </FW>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={handleAdd} disabled={!label.trim()}
            className="flex-1 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50 transition-colors"
            style={{background: primary || '#6366f1'}}>
            Add Role
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ step, setStep, completedSteps, branding, primary }) => (
  <aside style={{width:264, background:'#0f172a'}} className="flex-shrink-0 flex flex-col min-h-screen">
    <div className="p-5 border-b border-white/8">
      <div className="flex items-center gap-3">
        {branding?.logoUrl
          ? <img src={branding.logoUrl} alt="logo" className="w-9 h-9 rounded-xl object-contain"/>
          : <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:primary+'30'}}><Activity size={18} style={{color:primary}}/></div>}
        <div>
          <p className="text-white font-bold text-[13px] leading-tight">{branding?.name||'MediCore HMS'}</p>
          <p className="text-white/40 text-[10px] tracking-wider uppercase">Hospital Management</p>
        </div>
      </div>
    </div>
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{background:primary+'20', border:`1px solid ${primary}40`}}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#60a5fa'}}/>
        <span className="text-[11px] font-semibold text-white/70 tracking-wider uppercase">Staff Registration</span>
      </div>
    </div>
    <div className="px-3 flex-1">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 px-1">Registration Steps</p>
      {STEPS.map((s,i)=>{
        const Icon=s.icon; const done=completedSteps.includes(s.id); const active=step===s.id;
        return (
          <div key={s.id}>
            <div onClick={()=>setStep(s.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1 transition-all cursor-pointer ${active?'bg-white/10':'hover:bg-white/8 opacity-70 hover:opacity-100'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${done?'bg-emerald-500':''}`}
                style={!done&&active?{background:primary}:!done?{background:'rgba(255,255,255,0.08)'}:{}}>
                {done?<Check size={13} className="text-white"/>:<Icon size={13} className="text-white"/>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] truncate ${active?'font-semibold text-white':done?'font-medium text-white/80':'font-normal text-white/60'}`}>{s.label}</p>
                <p className="text-[10px] text-white/30 truncate">{s.sub}</p>
              </div>
              {done&&!active&&<Check size={12} className="text-emerald-400 flex-shrink-0"/>}
            </div>
            {i<STEPS.length-1&&<div className="ml-7 w-0.5 h-3 mb-1 rounded-full" style={{background:done?'#22c55e50':'rgba(255,255,255,0.08)'}}/>}
          </div>
        );
      })}
    </div>
    <div className="p-4 border-t border-white/8">
      <p className="text-white/25 text-[11px] leading-relaxed mb-2">Staff accounts are reviewed by admin before activation.</p>
      <div className="flex items-center gap-2 text-white/25 text-[11px]"><Lock size={11}/><span>256-bit SSL encrypted</span></div>
      <p className="text-white/20 text-[11px] mt-1">© {new Date().getFullYear()} {branding?.name||'MediCore HMS'}</p>
    </div>
  </aside>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function StaffRegisterPage() {
  const { branding } = useHospitalBranding(1);
  const primary = branding?.primaryColor || '#6366f1';

  const [step,setStep]                     = useState(1);
  const [completedSteps,setCompletedSteps] = useState([]);
  const [showPass,setShowPass]             = useState(false);
  const [showConf,setShowConf]             = useState(false);
  const [loading,setLoading]               = useState(false);
  const [success,setSuccess]               = useState(false);
  const [errors,setErrors]                 = useState({});
  const [photoPreview,setPhotoPreview]     = useState(null);
  const [photoFile,setPhotoFile]           = useState(null);
  const photoRef   = useRef(null);
  const submitLock = useRef(false);

  // ── Custom roles state ─────────────────────────────────────────────────────
  const [roles,setRoles]             = useState(DEFAULT_ROLES);
  const [showAddRole,setShowAddRole] = useState(false);

  const addCustomRole = (newRole) => {
    const color = ROLE_COLORS[roles.length % ROLE_COLORS.length];
    setRoles(prev => [...prev, { ...newRole, color }]);
    set('role', newRole.value);
    toast.success(`Role "${newRole.label}" added`);
  };

  const [depts,setDepts]         = useState([]);
  const [countries,setCountries] = useState([]);
  const [states,setStates]       = useState([]);

  const [emailStatus,setEmailStatus] = useState(null);
  const [phoneStatus,setPhoneStatus] = useState(null);
  const [unStatus,setUnStatus]       = useState(null);
  const emailTimer=useRef(null); const phoneTimer=useRef(null); const unTimer=useRef(null);

  const FALLBACK_COUNTRIES = [
    {Id:-1,Name:'India'},{Id:-2,Name:'United States'},{Id:-3,Name:'United Kingdom'},
    {Id:-4,Name:'UAE'},{Id:-5,Name:'Australia'},{Id:-6,Name:'Singapore'},
  ];

  const extractList = r => {
    if(Array.isArray(r))              return r;
    if(Array.isArray(r?.data))        return r.data;
    if(Array.isArray(r?.data?.items)) return r.data.items;
    if(Array.isArray(r?.items))       return r.items;
    return [];
  };

  const [form,setForm] = useState({
    firstName:'', lastName:'', gender:'', dateOfBirth:'',
    bloodGroup:'', nationality:'Indian', maritalStatus:'', religion:'', motherTongue:'',
    phone:'', phoneCode:'+91', altPhone:'', altCode:'+91', email:'',
    street1:'', street2:'', city:'', countryId:'', countryName:'', stateId:'', stateName:'', pincode:'',
    aadhaar:'', pan:'', passportNo:'', voterId:'', abhaNumber:'',
    role:'', departmentId:'', employeeId:'', joiningDate:'', shiftType:'', qualification:'',
    contractType:'', reportingManager:'',
    workStartTime:'09:00', workEndTime:'17:00', weeklyOff:[],
    emergencyName:'', emergencyRelation:'', emergencyPhone:'', emergencyCode:'+91',
    knownAllergies:'', bloodDonor:'',
    languagesSpoken:'', previousEmployer:'', experienceYears:'',
    bankAccountNo:'', ifscCode:'',
    username:'', password:'', confirmPassword:'',
  });

  const set = useCallback((k,v) => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:''})); },[]);

  useEffect(()=>{
    api.get('/hospitals/1/departments').then(r=>setDepts(extractList(r.data))).catch(()=>{});
    api.get('/geo/countries')
      .then(r=>{ const l=extractList(r.data)??extractList(r); setCountries(l.length?l:FALLBACK_COUNTRIES); })
      .catch(()=>setCountries(FALLBACK_COUNTRIES));
  },[]);

  useEffect(()=>{
    if(!form.countryId||Number(form.countryId)<0){ setStates([]); return; }
    api.get(`/geo/countries/${form.countryId}/states`).then(r=>setStates(extractList(r.data)??extractList(r))).catch(()=>setStates([]));
  },[form.countryId]);

  // ── Real-time checks via api service ──────────────────────────────────────
  const handleEmail = v => {
    set('email',v); setEmailStatus(null);
    if(emailTimer.current) clearTimeout(emailTimer.current);
    if(!v||!/\S+@\S+\.\S+/.test(v)) return;
    setEmailStatus('checking');
    emailTimer.current = setTimeout(async()=>{
      try {
        const r = await api.get('/register/check-email?email='+encodeURIComponent(v.trim()));
        const avail = r?.data?.available??r?.available;
        setEmailStatus(avail===true?'available':avail===false?'taken':null);
        if(avail===false) setErrors(e=>({...e,email:'Already registered'}));
      } catch { setEmailStatus(null); }
    }, 600);
  };

  const handlePhone = v => {
    set('phone',v); setPhoneStatus(null);
    if(phoneTimer.current) clearTimeout(phoneTimer.current);
    if(v.length<10) return;
    setPhoneStatus('checking');
    phoneTimer.current = setTimeout(async()=>{
      try {
        const r = await api.get('/register/check-phone?phone='+encodeURIComponent(v));
        const avail = r?.data?.available??r?.available;
        setPhoneStatus(avail===true?'available':avail===false?'taken':null);
        if(avail===false) setErrors(e=>({...e,phone:'Already registered'}));
      } catch { setPhoneStatus(null); }
    }, 600);
  };

  const handleUsername = v => {
    const clean = v.replace(/[^a-z0-9_.-]/g,'').toLowerCase();
    setForm(f=>({...f,username:clean})); setErrors(e=>({...e,username:''})); setUnStatus(null);
    if(unTimer.current) clearTimeout(unTimer.current);
    if(!clean||clean.length<3) return;
    setUnStatus('checking');
    unTimer.current = setTimeout(async()=>{
      try {
        const r = await api.get('/register/check-username?username='+encodeURIComponent(clean));
        const avail = r?.data?.available??r?.available;
        setUnStatus(avail===true?'available':avail===false?'taken':null);
        if(avail===false) setErrors(e=>({...e,username:'Already taken'}));
      } catch { setUnStatus(null); }
    }, 500);
  };

  const validate = () => {
    const e = {};
    if(step===1){
      if(!form.firstName.trim()) e.firstName = 'Required';
      if(!form.lastName.trim())  e.lastName  = 'Required';
      if(!form.gender)           e.gender    = 'Required';
      if(!form.phone)              e.phone   = 'Required';
      else if(form.phone.length!==10) e.phone = 'Must be 10 digits';
      else if(phoneStatus==='taken')  e.phone = 'Already registered';
      if(!form.email||!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
      else if(emailStatus==='taken') e.email = 'Already registered';
      if(!form.street1.trim()) e.street1 = 'Required';
      if(!form.city.trim())    e.city    = 'Required';
      if(!form.countryId)      e.countryId = 'Required';
      if(form.pincode&&!/^\d{6}$/.test(form.pincode)) e.pincode = 'Must be 6 digits';
      if(form.pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan)) e.pan = 'Invalid format (ABCDE1234F)';
      if(form.aadhaar&&form.aadhaar.length!==12) e.aadhaar = 'Must be 12 digits';
    }
    if(step===2){ if(!form.role) e.role = 'Please select a role'; }
    if(step===3){
      if(!form.username.trim())        e.username = 'Required';
      else if(form.username.length<3)  e.username = 'Min 3 characters';
      else if(unStatus==='taken')      e.username = 'Already taken';
      if(!form.password)               e.password = 'Required';
      else if(form.password.length<8)  e.password = 'Min 8 characters';
      else if(!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Need uppercase, lowercase & number';
      if(form.password!==form.confirmPassword) e.confirmPassword = 'Do not match';
    }
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleNext = () => {
    if(validate()){ setCompletedSteps(p=>p.includes(step)?p:[...p,step]); setStep(s=>s+1); }
  };
  const handleBack = () => setStep(s=>s-1);

  const handleSubmit = async () => {
    if(submitLock.current) return;
    if(!validate()) return;
    submitLock.current = true;
    setLoading(true);
    try {
      const orUndef = v => (v===''||v==null?undefined:v);
      const payload = {
        hospitalId:1,
        firstName:form.firstName, lastName:form.lastName, gender:form.gender,
        dateOfBirth:orUndef(form.dateOfBirth), bloodGroup:orUndef(form.bloodGroup),
        nationality:form.nationality, maritalStatus:orUndef(form.maritalStatus),
        religion:orUndef(form.religion), motherTongue:orUndef(form.motherTongue),
        email:form.email, phone:form.phone, phoneCountryCode:form.phoneCode,
        altPhone:orUndef(form.altPhone),
        street1:form.street1, street2:orUndef(form.street2), city:form.city,
        pincode:orUndef(form.pincode), countryId:orUndef(form.countryId), stateId:orUndef(form.stateId),
        role:form.role, departmentId:orUndef(form.departmentId),
        employeeId:orUndef(form.employeeId), joiningDate:orUndef(form.joiningDate),
        shiftType:orUndef(form.shiftType), qualification:orUndef(form.qualification),
        emergencyName:orUndef(form.emergencyName), emergencyRelation:orUndef(form.emergencyRelation),
        emergencyPhone:orUndef(form.emergencyPhone),
        aadhaar:orUndef(form.aadhaar), pan:orUndef(form.pan),
        passportNo:orUndef(form.passportNo), voterId:orUndef(form.voterId), abhaNumber:orUndef(form.abhaNumber),
        contractType:orUndef(form.contractType), reportingManager:orUndef(form.reportingManager),
        workStartTime:orUndef(form.workStartTime), workEndTime:orUndef(form.workEndTime),
        weeklyOff:form.weeklyOff.length?form.weeklyOff.join(','):undefined,
        knownAllergies:orUndef(form.knownAllergies), bloodDonor:orUndef(form.bloodDonor),
        languagesSpoken:orUndef(form.languagesSpoken),
        previousEmployer:orUndef(form.previousEmployer),
        experienceYears:form.experienceYears?Number(form.experienceYears):undefined,
        bankAccountNo:orUndef(form.bankAccountNo), ifscCode:orUndef(form.ifscCode),
        username:form.username, password:form.password,
      };
      if(photoFile){
        const fd = new FormData();
        Object.entries(payload).forEach(([k,v])=>{ if(v!=null) fd.append(k,String(v)); });
        fd.append('photo',photoFile);
        await api.post('/register/staff', fd, {headers:{'Content-Type':'multipart/form-data'}});
      } else {
        await api.post('/register/staff', payload);
      }
      setSuccess(true);
    } catch(err) {
      toast.error(err?.response?.data?.message||err?.message||'Registration failed');
    } finally {
      setLoading(false);
      submitLock.current = false;
    }
  };

  if(success) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 border-4 border-blue-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={30} className="text-blue-500"/>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Submitted!</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">Your staff registration is pending admin review. You'll receive an email once your account is activated.</p>
        <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm" style={{background:primary}}>Back to Login</Link>
      </div>
    </div>
  );

  const pct     = Math.round(((step-1)/STEPS.length)*100);
  const str     = pwStrength(form.password);
  const pwMatch = form.confirmPassword ? form.password===form.confirmPassword : null;

  return (
    <div className="min-h-screen flex" style={{background:'#f8faff'}}>
      {showAddRole && <AddRoleModal onAdd={addCustomRole} onClose={()=>setShowAddRole(false)} primary={primary}/>}

      <div className="hidden md:flex">
        <Sidebar step={step} setStep={setStep} completedSteps={completedSteps} branding={branding} primary={primary}/>
      </div>

      <div className="flex-1 flex flex-col min-h-screen overflow-auto">
        <header className="bg-white border-b border-slate-100 px-6 lg:px-10 py-4 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-[18px] font-bold text-slate-800">Staff Registration</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Step {step} of {STEPS.length} — {STEPS[step-1].label}</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {STEPS.map((s,i)=>(
              <div key={s.id} className="flex items-center gap-2">
                <div onClick={()=>setStep(s.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer hover:scale-105
                    ${completedSteps.includes(s.id)?'bg-emerald-500 text-white':step===s.id?'text-white':'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  style={step===s.id?{background:primary}:{}}>
                  {completedSteps.includes(s.id)?<Check size={13}/>:s.id}
                </div>
                {i<STEPS.length-1&&<div className="w-8 h-0.5 rounded-full" style={{background:completedSteps.includes(s.id)?'#22c55e':'#e2e8f0'}}/>}
              </div>
            ))}
            <span className="ml-2 text-[12px] text-slate-400 font-medium">{pct}%</span>
          </div>
        </header>

        <main className="flex-1 px-6 lg:px-10 py-5">

          {/* ══ STEP 1 ══ */}
          {step===1&&(
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={User} title="Personal Details" sub="Name, demographics & profile photo" color={primary}/>

                  <div className="flex items-start gap-4 mb-3">
                    <div onClick={()=>photoRef.current?.click()}
                      className="w-16 h-16 rounded-full flex-shrink-0 cursor-pointer border-2 overflow-hidden flex items-center justify-center relative group"
                      style={{borderColor:photoPreview?primary:'#e2e8f0', background:photoPreview?'transparent':'#f8fafc'}}>
                      {photoPreview?<img src={photoPreview} alt="Staff" className="w-full h-full object-cover"/>:<Camera size={20} className="text-slate-300"/>}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"><Camera size={13} className="text-white"/></div>
                    </div>
                    <input ref={photoRef} type="file" accept="image/*"
                      onChange={e=>{ const f=e.target.files[0]; if(f){ setPhotoPreview(URL.createObjectURL(f)); setPhotoFile(f); } }} className="hidden"/>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <FW label="First Name" required error={errors.firstName}>
                        {/* RESTRICTION: letters + spaces only — no digits, no symbols */}
                        <FI err={!!errors.firstName} value={form.firstName}
                          onChange={e=>set('firstName', lettersOnly(e.target.value))} placeholder="Priya"/>
                      </FW>
                      <FW label="Last Name" required error={errors.lastName}>
                        <FI err={!!errors.lastName} value={form.lastName}
                          onChange={e=>set('lastName', lettersOnly(e.target.value))} placeholder="Sharma"/>
                      </FW>
                    </div>
                  </div>

                  <div className="grid grid-cols-8 gap-3 mb-3">
                    <FW label="Gender" required error={errors.gender} className="col-span-2">
                      <FS err={!!errors.gender} value={form.gender} onChange={e=>set('gender',e.target.value)}>
                        <option value="">—</option>{GENDERS.map(g=><option key={g}>{g}</option>)}
                      </FS>
                    </FW>
                    <FW label="Date of Birth" className="col-span-3">
                      <FI type="date" value={form.dateOfBirth} onChange={e=>set('dateOfBirth',e.target.value)} max={todayStr}/>
                    </FW>
                    <FW label="Age" className="col-span-1">
                      <FI value={calcAge(form.dateOfBirth)} disabled placeholder="—" className="bg-slate-50 text-slate-500 cursor-not-allowed"/>
                    </FW>
                    <FW label="Blood Grp" className="col-span-2">
                      <FS value={form.bloodGroup} onChange={e=>set('bloodGroup',e.target.value)}>
                        <option value="">—</option>{BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                      </FS>
                    </FW>
                  </div>

                  <div className="grid grid-cols-8 gap-3 mb-3">
                    <FW label="Marital Status" className="col-span-3">
                      <FS value={form.maritalStatus} onChange={e=>set('maritalStatus',e.target.value)}>
                        <option value="">—</option>{MARITAL.map(m=><option key={m}>{m}</option>)}
                      </FS>
                    </FW>
                    {/* Religion is a dropdown — cannot type numbers anyway */}
                    <FW label="Religion" className="col-span-3">
                      <FS value={form.religion} onChange={e=>set('religion',e.target.value)}>
                        <option value="">—</option>{RELIGIONS.map(r=><option key={r}>{r}</option>)}
                      </FS>
                    </FW>
                    <FW label="Mother Tongue" className="col-span-2">
                      {/* RESTRICTION: letters + spaces only */}
                      <FI value={form.motherTongue} onChange={e=>set('motherTongue', lettersOnly(e.target.value))} placeholder="Hindi"/>
                    </FW>
                  </div>

                  <FW label="Nationality" className="mb-4">
                    {/* RESTRICTION: letters + spaces only — nationality is never a number */}
                    <FI value={form.nationality} onChange={e=>set('nationality', lettersOnly(e.target.value))} placeholder="Indian"/>
                  </FW>

                  <div className="pt-3.5 border-t border-slate-50">
                    <SecHead icon={MapPin} title="Residential Address" sub="Current place of residence" color="#8b5cf6"/>
                    <div className="space-y-3">
                      <FW label="Street Line 1" required error={errors.street1}>
                        {/* RESTRICTION: letters + digits + , . / - # (address chars) */}
                        <FI err={!!errors.street1} value={form.street1}
                          onChange={e=>set('street1', addressChars(e.target.value))} placeholder="Building no., Street name"/>
                      </FW>
                      <FI value={form.street2} onChange={e=>set('street2', addressChars(e.target.value))} placeholder="Area, Landmark (optional — Street Line 2)"/>
                      <div className="grid grid-cols-2 gap-3">
                        <FW label="Country" required error={errors.countryId}>
                          <SearchSelect value={form.countryId} items={countries}
                            placeholder={countries.length?'Select':'Loading...'} err={!!errors.countryId}
                            onChange={(id,name)=>{ set('countryId',id); set('countryName',name); set('stateId',''); set('stateName',''); }}/>
                          {errors.countryId&&<p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.countryId}</p>}
                        </FW>
                        <FW label="State / Province">
                          {(Number(form.countryId)<0||!form.countryId)
                            ? <FI value={form.stateName} onChange={e=>{ set('stateName', lettersOnly(e.target.value)); set('stateId','manual'); }} placeholder="Type state"/>
                            : <SearchSelect value={form.stateId} items={states}
                                placeholder={form.countryId?'Select':'Pick country first'} disabled={!form.countryId}
                                onAddNew={name=>{ set('stateName',name); set('stateId','custom'); }} addLabel="Add manually"
                                onChange={(id,name)=>{ set('stateId',id); set('stateName',name); }}/>}
                        </FW>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        <FW label="City" required error={errors.city} className="col-span-3">
                          {/* RESTRICTION: city = letters + spaces only — no digits */}
                          <FI err={!!errors.city} value={form.city}
                            onChange={e=>set('city', lettersOnly(e.target.value))} placeholder="Mumbai"/>
                        </FW>
                        <FW label="Pincode" error={errors.pincode} hint="6 digits" className="col-span-2">
                          {/* RESTRICTION: digits only, max 6 */}
                          <FI err={!!errors.pincode} value={form.pincode}
                            onChange={e=>set('pincode', digitsOnly(e.target.value).slice(0,6))}
                            placeholder="400001" inputMode="numeric" maxLength={6} className="font-mono tracking-wider"/>
                        </FW>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Phone} title="Contact Info" sub="Phone & email" color="#0ea5e9"/>
                    <div className="space-y-3">
                      <FW label="Mobile" required error={errors.phone}>
                        {/* RESTRICTION: digits only inside PhoneField component */}
                        <PhoneField code={form.phoneCode} onCode={v=>set('phoneCode',v)}
                          val={form.phone} onChange={handlePhone} err={!!errors.phone||phoneStatus==='taken'}/>
                        {/* FIX: <div> not <p> to avoid DOM nesting warning */}
                        {phoneStatus==='checking' &&<div className="text-slate-400 text-[11px] mt-1 flex items-center gap-1"><div className="w-2.5 h-2.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>Checking...</div>}
                        {phoneStatus==='taken'    &&<div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={9}/>Already registered</div>}
                        {phoneStatus==='available'&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                      </FW>
                      <FW label="Alternate Phone">
                        <PhoneField code={form.altCode} onCode={v=>set('altCode',v)}
                          val={form.altPhone} onChange={v=>set('altPhone',v)} placeholder="Optional"/>
                      </FW>
                      <FW label="Email" required error={errors.email}>
                        <div className="relative">
                          <FI type="email" err={!!errors.email||emailStatus==='taken'} ok={emailStatus==='available'}
                            value={form.email} onChange={e=>handleEmail(e.target.value)}
                            placeholder="priya@email.com" className="pr-8"/>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2"><Dot status={emailStatus}/></div>
                        </div>
                        {errors.email&&<p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.email}</p>}
                        {emailStatus==='available'&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                      </FW>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Shield} title="Identity Documents" sub="Government IDs (optional)" color="#ef4444"/>
                    <div className="space-y-3">
                      <FW label="Aadhaar Number" error={errors.aadhaar} hint={!errors.aadhaar?"12 digits":undefined}>
                        {/* RESTRICTION: digits only, displayed with spaces every 4 chars */}
                        <FI err={!!errors.aadhaar}
                          value={form.aadhaar.replace(/(.{4})(?=.)/g,'$1 ')}
                          onChange={e=>set('aadhaar', digitsOnly(e.target.value).slice(0,12))}
                          placeholder="1234 5678 9012" inputMode="numeric" className="font-mono tracking-wider" maxLength={14}/>
                      </FW>
                      <div className="grid grid-cols-2 gap-3">
                        <FW label="PAN" error={errors.pan} hint={!errors.pan?"5L · 4D · 1L":undefined}>
                          {/* RESTRICTION: char-by-char — pos 0-4 uppercase letters, 5-8 digits, 9 uppercase letter */}
                          <FI err={!!errors.pan} value={form.pan}
                            onChange={e=>{
                              const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
                              let out = '';
                              for(let i=0;i<raw.length;i++){
                                if(i<5)     { if(/[A-Z]/.test(raw[i])) out+=raw[i]; }
                                else if(i<9){ if(/[0-9]/.test(raw[i])) out+=raw[i]; }
                                else        { if(/[A-Z]/.test(raw[i])) out+=raw[i]; }
                              }
                              set('pan', out);
                            }}
                            placeholder="ABCDE1234F" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                        </FW>
                        <FW label="ABHA No.">
                          {/* RESTRICTION: digits only, auto-formatted XX-XXXX-XXXX-XXXX */}
                          <FI value={form.abhaNumber}
                            onChange={e=>{
                              const d = digitsOnly(e.target.value).slice(0,14);
                              let o = d.slice(0,2);
                              if(d.length>2)  o+='-'+d.slice(2,6);
                              if(d.length>6)  o+='-'+d.slice(6,10);
                              if(d.length>10) o+='-'+d.slice(10,14);
                              set('abhaNumber', o);
                            }}
                            placeholder="12-3456-7890-1234" inputMode="numeric" className="font-mono tracking-wider" maxLength={19}/>
                        </FW>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FW label="Passport No." hint="1 letter + 7 digits">
                          {/* RESTRICTION: pos 0 = letter, pos 1-7 = digits */}
                          <FI value={form.passportNo}
                            onChange={e=>{
                              const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
                              let out='';
                              for(let i=0;i<raw.length;i++){
                                if(i===0){ if(/[A-Z]/.test(raw[i])) out+=raw[i]; }
                                else     { if(/[0-9]/.test(raw[i])) out+=raw[i]; }
                              }
                              set('passportNo', out);
                            }}
                            placeholder="A1234567" className="font-mono uppercase tracking-widest" maxLength={8} spellCheck={false}/>
                        </FW>
                        <FW label="Voter ID" hint="3 letters + 7 digits">
                          {/* RESTRICTION: pos 0-2 = letters, pos 3-9 = digits */}
                          <FI value={form.voterId}
                            onChange={e=>{
                              const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
                              let out='';
                              for(let i=0;i<raw.length;i++){
                                if(i<3){ if(/[A-Z]/.test(raw[i])) out+=raw[i]; }
                                else   { if(/[0-9]/.test(raw[i])) out+=raw[i]; }
                              }
                              set('voterId', out);
                            }}
                            placeholder="ABC1234567" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                        </FW>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 2 ══ */}
          {step===2&&(
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  {/* Header with Add Role button */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:primary+'18'}}>
                        <Briefcase size={15} style={{color:primary}} strokeWidth={2.2}/>
                      </div>
                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-700 leading-tight">Role Selection</h3>
                        <p className="text-[11px] text-slate-400">Choose the staff position for this member</p>
                      </div>
                    </div>
                    <button type="button" onClick={()=>setShowAddRole(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-[11px] text-indigo-600 hover:bg-indigo-50 transition-colors font-medium">
                      <Plus size={12}/>Add Role
                    </button>
                  </div>
                  {errors.role&&<p className="mb-3 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.role}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((r,idx)=>{
                      const color = r.color || ROLE_COLORS[idx % ROLE_COLORS.length];
                      return (
                        <label key={r.value}
                          className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none"
                          style={form.role===r.value?{background:color+'10',borderColor:color+'50'}:{borderColor:'#f1f5f9'}}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:color+'15'}}>
                            <Briefcase size={13} style={{color}}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-700 truncate">{r.label}</p>
                            <p className="text-[10px] text-slate-400 leading-tight truncate">{r.desc}</p>
                          </div>
                          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={form.role===r.value?{borderColor:color,background:color}:{borderColor:'#cbd5e1'}}>
                            {form.role===r.value&&<div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                          </div>
                          <input type="radio" name="role" value={r.value} checked={form.role===r.value}
                            onChange={e=>set('role',e.target.value)} className="hidden"/>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Calendar} title="Employment Details" sub="Work schedule & department" color="#0ea5e9"/>
                    <div className="space-y-3">
                      <FW label="Department">
                        <SearchSelect value={form.departmentId}
                          items={depts.map(d=>({Id:d.Id??d.id, Name:d.Name??d.name}))}
                          placeholder="Select department"
                          onChange={id=>set('departmentId',id)}/>
                      </FW>
                      <div className="grid grid-cols-2 gap-3">
                        <FW label="Employee ID">
                          {/* RESTRICTION: alphanumeric + dash only */}
                          <FI value={form.employeeId}
                            onChange={e=>set('employeeId', e.target.value.replace(/[^A-Za-z0-9\-]/g,''))}
                            placeholder="EMP-001"/>
                        </FW>
                        <FW label="Joining Date">
                          <FI type="date" value={form.joiningDate} onChange={e=>set('joiningDate',e.target.value)} max={todayStr}/>
                        </FW>
                      </div>
                      <FW label="Shift Type">
                        <FS value={form.shiftType} onChange={e=>set('shiftType',e.target.value)}>
                          <option value="">Select shift</option>
                          {SHIFT_TYPES.map(s=><option key={s}>{s}</option>)}
                        </FS>
                      </FW>
                      <FW label="Qualification / Certification">
                        {/* RESTRICTION: letters + digits + spaces + . , (cert names can have nums) */}
                        <FI value={form.qualification}
                          onChange={e=>set('qualification', e.target.value.replace(/[^A-Za-z0-9\s.,]/g,''))}
                          placeholder="e.g. B.Sc Nursing, GNM, DMLT"/>
                      </FW>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Clock} title="Work Schedule" sub="Timing & work preferences" color="#8b5cf6"/>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <FW label="Work Start Time">
                          <FI type="time" value={form.workStartTime} onChange={e=>set('workStartTime',e.target.value)}/>
                        </FW>
                        <FW label="Work End Time">
                          <FI type="time" value={form.workEndTime} onChange={e=>set('workEndTime',e.target.value)}/>
                        </FW>
                      </div>
                      <FW label="Weekly Off Days">
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>{
                            const full=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i];
                            const sel=form.weeklyOff.includes(full);
                            return(
                              <button key={d} type="button"
                                onClick={()=>set('weeklyOff',sel?form.weeklyOff.filter(x=>x!==full):[...form.weeklyOff,full])}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${sel?'text-white border-transparent':'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                style={sel?{background:primary}:{}}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </FW>
                      <FW label="Contract Type">
                        <FS value={form.contractType} onChange={e=>set('contractType',e.target.value)}>
                          <option value="">Select</option>
                          {['Permanent','Contract','Probation','Part-Time','Intern'].map(c=><option key={c}>{c}</option>)}
                        </FS>
                      </FW>
                      <FW label="Reporting Manager / Supervisor">
                        {/* RESTRICTION: letters + spaces only — names have no digits */}
                        <FI value={form.reportingManager}
                          onChange={e=>set('reportingManager', lettersOnly(e.target.value))}
                          placeholder="Manager name (optional)"/>
                      </FW>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 3 ══ */}
          {step===3&&(
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Shield} title="Emergency Contact" sub="Relative or guardian to contact in case of emergency" color="#ef4444"/>
                    <div className="grid grid-cols-8 gap-3 mb-3">
                      <FW label="Contact Name" className="col-span-4">
                        {/* RESTRICTION: letters + spaces only — person names have no digits */}
                        <FI value={form.emergencyName}
                          onChange={e=>set('emergencyName', lettersOnly(e.target.value))}
                          placeholder="Full name of contact person"/>
                      </FW>
                      <FW label="Relation" className="col-span-4">
                        {/* RESTRICTION: letters + spaces only — Spouse, Parent, etc */}
                        <FI value={form.emergencyRelation}
                          onChange={e=>set('emergencyRelation', lettersOnly(e.target.value))}
                          placeholder="e.g. Spouse, Parent, Sibling"/>
                      </FW>
                    </div>
                    <FW label="Emergency Phone">
                      <PhoneField code={form.emergencyCode} onCode={v=>set('emergencyCode',v)}
                        val={form.emergencyPhone} onChange={v=>set('emergencyPhone',v)}
                        placeholder="Emergency contact number"/>
                    </FW>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Heart} title="Health Information" sub="For HR and hospital records" color="#ec4899"/>
                    <div className="space-y-3">
                      <FW label="Known Allergies">
                        <FTA value={form.knownAllergies} onChange={e=>set('knownAllergies',e.target.value)} rows={3}
                          placeholder="e.g. Penicillin, Latex gloves, Dust, Pollen — or type None"/>
                      </FW>
                      <FW label="Willing to Donate Blood?">
                        <div className="flex gap-2.5 mt-1">
                          {['Yes','No','Maybe'].map(opt=>(
                            <button key={opt} type="button" onClick={()=>set('bloodDonor',opt)}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[13px] font-medium transition-all
                                ${form.bloodDonor===opt?'text-white border-transparent':'text-slate-600 border-slate-200 hover:border-slate-300'}`}
                              style={form.bloodDonor===opt?{background:primary}:{}}>
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.bloodDonor===opt?'border-white':'border-slate-400'}`}>
                                {form.bloodDonor===opt&&<div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                              </div>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </FW>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Lock} title="Login Credentials" sub="Set username & password" color="#8b5cf6"/>
                    <div className="space-y-3">
                      <FW label="Username" required error={errors.username}>
                        <div className="relative">
                          <FI err={!!errors.username||unStatus==='taken'} ok={unStatus==='available'}
                            value={form.username} onChange={e=>handleUsername(e.target.value)}
                            placeholder="priya.sharma" className="pr-8"/>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2"><Dot status={unStatus}/></div>
                        </div>
                        {unStatus==='available'&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                        {errors.username&&<p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.username}</p>}
                      </FW>
                      <FW label="Password" required error={errors.password}>
                        <div className="relative">
                          <FI type={showPass?'text':'password'} err={!!errors.password}
                            value={form.password} onChange={e=>set('password',e.target.value)}
                            placeholder="Min 8 characters" className="pr-9"/>
                          <button type="button" onClick={()=>setShowPass(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPass?<EyeOff size={14}/>:<Eye size={14}/>}
                          </button>
                        </div>
                        {form.password&&str&&(
                          <div className="mt-1.5">
                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-0.5">
                              <div className="h-full rounded-full transition-all" style={{width:`${str.w}%`,background:str.c}}/>
                            </div>
                            <span className="text-[10px] font-semibold" style={{color:str.c}}>{str.l}</span>
                          </div>
                        )}
                      </FW>
                      <FW label="Confirm Password" required error={errors.confirmPassword}>
                        <div className="relative">
                          <FI type={showConf?'text':'password'} err={!!errors.confirmPassword} ok={pwMatch===true}
                            value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)}
                            placeholder="Re-enter password" className="pr-9"/>
                          <button type="button" onClick={()=>setShowConf(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showConf?<EyeOff size={14}/>:<Eye size={14}/>}
                          </button>
                        </div>
                        {pwMatch===true&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Passwords match</div>}
                      </FW>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={User} title="Additional Info" sub="Optional profile details" color="#64748b"/>
                    <div className="space-y-3">
                      <FW label="Languages Spoken">
                        {/* RESTRICTION: letters + spaces + comma only */}
                        <FI value={form.languagesSpoken}
                          onChange={e=>set('languagesSpoken', langChars(e.target.value))}
                          placeholder="Hindi, English, Marathi"/>
                      </FW>
                      <FW label="Previous Employer">
                        {/* RESTRICTION: letters + digits + common punctuation (org names can have & - .) */}
                        <FI value={form.previousEmployer}
                          onChange={e=>set('previousEmployer', e.target.value.replace(/[^A-Za-z0-9\s,.\-&]/g,''))}
                          placeholder="Previous hospital or clinic"/>
                      </FW>
                      <FW label="Total Experience (Years)">
                        {/* RESTRICTION: digits only, max 2 digits */}
                        <FI value={form.experienceYears}
                          onChange={e=>set('experienceYears', digitsOnly(e.target.value).slice(0,2))}
                          placeholder="e.g. 3" inputMode="numeric" maxLength={2}/>
                      </FW>
                      <FW label="Bank Account No.">
                        {/* RESTRICTION: digits only */}
                        <FI value={form.bankAccountNo}
                          onChange={e=>set('bankAccountNo', digitsOnly(e.target.value))}
                          placeholder="For salary credit" inputMode="numeric"/>
                      </FW>
                      <FW label="IFSC Code" hint="4 letters + 0 + 6 alphanumeric">
                        {/* RESTRICTION: uppercase alphanumeric only, max 11 chars */}
                        <FI value={form.ifscCode}
                          onChange={e=>set('ifscCode', alphaNumUpper(e.target.value).slice(0,11))}
                          placeholder="SBIN0001234" className="font-mono uppercase" maxLength={11} spellCheck={false}/>
                      </FW>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="bg-white border-t border-slate-100 px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {step>1
              ? <button onClick={handleBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-colors">
                  <ArrowLeft size={14}/>Back
                </button>
              : <Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-600 transition-colors">
                  <ArrowLeft size={13}/>Back to Login
                </Link>}
            <span className="text-[11px] text-slate-300 hidden sm:block">© {new Date().getFullYear()} {branding?.name||'MediCore HMS'}. All rights reserved.</span>
          </div>
          <div>
            {step<STEPS.length
              ? <button onClick={handleNext} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm hover:opacity-90 transition-all" style={{background:primary}}>
                  Save & Continue<ArrowRight size={14}/>
                </button>
              : <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm disabled:opacity-60" style={{background:primary}}>
                  {loading?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting...</>:<><CheckCircle size={15}/>Submit Application</>}
                </button>}
          </div>
        </footer>
      </div>
    </div>
  );
}