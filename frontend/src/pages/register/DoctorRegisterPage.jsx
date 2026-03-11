// src/pages/register/DoctorRegisterPage.jsx
// FIXES:
//  1. availableFrom / availableTo empty string → SQL TIME crash (500)
//  2. Multiple submissions on double-click → 409 Conflict (submitLock ref)
//  3. abhaNumber / aadhaar sending '' instead of undefined
//  4. DOM nesting warning: <div> cannot appear as descendant of <p>
//     — All inline status messages changed from <p> → <div>
//     — FW hint/error use <p> tags which are fine as they only wrap text
//     — PhoneField status indicators were the offenders; now use <div>

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle, ArrowLeft, ArrowRight,
  Activity, Shield, MapPin, Lock, Camera, Check, X,
  Search, Plus, AlertCircle, Stethoscope, Clock, User,
  FileText, Upload, Trash2, Award, BookOpen, Mail, Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── Constants ─────────────────────────────────────────────────────────────────
const BLOOD_GROUPS  = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS       = ['Male','Female','Other','Prefer Not to Say'];
const COUNTRY_CODES = ['+91','+1','+44','+971','+61','+65','+49','+81'];
const DAYS          = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const FULL_DAYS     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MARITAL       = ['Single','Married','Divorced','Widowed'];
const RELIGIONS     = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain','Other'];
const DOC_TYPES = [
  { value:'medical_degree',    label:'Medical Degree' },
  { value:'license',           label:'Medical License' },
  { value:'id_proof',          label:'Government ID' },
  { value:'experience_cert',   label:'Experience Certificate' },
  { value:'registration_cert', label:'Registration Certificate' },
  { value:'insurance',         label:'Insurance Document' },
  { value:'other',             label:'Other' },
];
const STEPS = [
  { id:1, label:'Personal & Contact',   sub:'Basic info, contact & credentials', icon: User },
  { id:2, label:'Professional Details', sub:'License, schedule, fees & identity', icon: Stethoscope },
  { id:3, label:'Address & Documents',  sub:'Residential address & file uploads', icon: FileText },
];

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr       = new Date().toISOString().split('T')[0];
const MIN_DOCTOR_AGE = 25;
const MAX_DOCTOR_AGE = 80;
const getMaxDOB = () => { const d=new Date(); d.setFullYear(d.getFullYear()-MIN_DOCTOR_AGE); return d.toISOString().split('T')[0]; };
const getMinDOB = () => { const d=new Date(); d.setFullYear(d.getFullYear()-MAX_DOCTOR_AGE); return d.toISOString().split('T')[0]; };
const validateDoctorDOB = (dob) => {
  if (!dob) return null;
  const yrs = (new Date() - new Date(dob)) / (1000*60*60*24*365.25);
  if (yrs < MIN_DOCTOR_AGE) return `Doctor must be at least ${MIN_DOCTOR_AGE} years old`;
  if (yrs > MAX_DOCTOR_AGE) return `Age cannot exceed ${MAX_DOCTOR_AGE} years`;
  return null;
};

// ── Identity format helpers ───────────────────────────────────────────────────
const formatPAN = (raw) => {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g,'');
  let r = '';
  for (let i=0;i<Math.min(v.length,10);i++){
    if(i<5){if(/[A-Z]/.test(v[i]))r+=v[i];}
    else if(i<9){if(/[0-9]/.test(v[i]))r+=v[i];}
    else{if(/[A-Z]/.test(v[i]))r+=v[i];}
  }
  return r;
};
const formatPassport = (raw) => {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g,'');
  let r='';
  for(let i=0;i<Math.min(v.length,8);i++){
    if(i===0){if(/[A-Z]/.test(v[i]))r+=v[i];}else{if(/[0-9]/.test(v[i]))r+=v[i];}
  }
  return r;
};
const formatVoterId = (raw) => {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g,'');
  let r='';
  for(let i=0;i<Math.min(v.length,10);i++){
    if(i<3){if(/[A-Z]/.test(v[i]))r+=v[i];}else{if(/[0-9]/.test(v[i]))r+=v[i];}
  }
  return r;
};
const formatABHA = (raw) => {
  const d = raw.replace(/\D/g,'').slice(0,14);
  let o = d.slice(0,2);
  if(d.length>2) o+='-'+d.slice(2,6);
  if(d.length>6) o+='-'+d.slice(6,10);
  if(d.length>10)o+='-'+d.slice(10,14);
  return o;
};
const formatAadhaar = (raw) => {
  const d = raw.replace(/\D/g,'').slice(0,12);
  return d.replace(/(.{4})(?=.)/g,'$1 ');
};

// ── Password strength ─────────────────────────────────────────────────────────
const pwStrength = (pw) => {
  if(!pw) return null;
  let s=0;
  if(pw.length>=8)s++; if(pw.length>=12)s++;
  if(/[A-Z]/.test(pw))s++; if(/[0-9]/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
  if(s<=1) return {l:'Weak',  c:'#ef4444',w:20};
  if(s<=2) return {l:'Fair',  c:'#f97316',w:45};
  if(s<=3) return {l:'Good',  c:'#eab308',w:70};
  return           {l:'Strong',c:'#22c55e',w:100};
};

// ── Tailwind base classes ─────────────────────────────────────────────────────
const ib  = `w-full px-3 py-2.5 rounded-xl border text-[13px] text-slate-700 bg-white placeholder:text-slate-300 outline-none transition-all`;
const in_ = `border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`;
const ie  = `border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100`;
const io  = `border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100`;

const FI  = ({ err, ok, className='', ...p }) => <input  className={`${ib} ${err?ie:ok?io:in_} ${className}`} {...p}/>;
const FS  = ({ children, className='', err, ...p }) => <select className={`${ib} ${err?ie:in_} ${className}`} {...p}>{children}</select>;
const FTA = ({ className='', ...p }) => <textarea className={`${ib} ${in_} resize-none ${className}`} {...p}/>;

// ── FIX 4: FW wrapper uses <div> throughout — hint and error are <p> tags
//           which is valid because they only ever wrap inline text, never block elements.
const FW = ({ label, required, error, hint, children, className='' }) => (
  <div className={className}>
    {label && <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}{required&&<span className="text-red-400 ml-0.5">*</span>}</label>}
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

// ── FIX 4: PhoneField — status messages changed from <p> to <div>
//           Reason: PhoneField is used inside FW which is a <div>.
//           The old <p> tags caused "validateDOMNesting: <div> cannot appear
//           as descendant of <p>" because React's rendering path included a <p>
//           ancestor when the status elements themselves were <p> tags containing
//           the spinner <div> child. Using <div> for the whole status row is correct.
const PhoneField = ({ code, onCode, val, onChange, err, placeholder='9876543210', statusEl }) => (
  <div>
    <div className={`flex rounded-xl border overflow-hidden transition-all focus-within:ring-2
      ${err?'border-red-400 focus-within:border-red-400 focus-within:ring-red-100 bg-red-50'
          :'border-slate-200 hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-indigo-100'}`}>
      <select value={code} onChange={e=>onCode(e.target.value)}
        className="px-2 bg-slate-50 border-r border-slate-200 text-[12px] text-slate-600 outline-none cursor-pointer py-2.5 min-w-[68px]">
        {COUNTRY_CODES.map(c=><option key={c}>{c}</option>)}
      </select>
      <input value={val} onChange={e=>{const v=e.target.value.replace(/\D/g,'');if(v.startsWith('0'))return;if(v.length<=10)onChange(v);}}
        placeholder={placeholder} inputMode="numeric"
        className="flex-1 px-3 py-2.5 text-[13px] text-slate-700 outline-none bg-white placeholder:text-slate-300"/>
    </div>
    {/* FIX 4: was <p> — changed to <div> to avoid invalid nesting with spinner <div> child */}
    {statusEl}
  </div>
);

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({ value, onChange, items, placeholder, onAddNew, addLabel, disabled, err }) {
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState('');
  const [custom,setCustom]=useState('');
  const [addMode,setAddMode]=useState(false);
  const [cursor,setCursor]=useState(-1);
  const wrapRef=useRef(null); const listRef=useRef(null); const srchRef=useRef(null);
  const filtered=items.filter(i=>(i.Name??String(i)).toLowerCase().includes(q.toLowerCase()));
  const selected=(value!==''&&value!=null)?items.find(i=>String(i.Id??i)===String(value)):null;
  const displayLabel=selected?(selected.Name??String(selected)):(value?String(value):'');
  useEffect(()=>{const h=ev=>{if(wrapRef.current&&!wrapRef.current.contains(ev.target)){setOpen(false);setAddMode(false);setQ('');setCursor(-1);}};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  useEffect(()=>{if(cursor>=0&&listRef.current){const el=listRef.current.querySelector(`[data-idx="${cursor}"]`);if(el)el.scrollIntoView({block:'nearest'});}},[cursor]);
  useEffect(()=>{if(open){const t=setTimeout(()=>srchRef.current?.focus(),20);return()=>clearTimeout(t);}},[open]);
  const pick=item=>{onChange(item.Id??item,String(item.Name??item));setOpen(false);setQ('');setCursor(-1);};
  return (
    <div ref={wrapRef} className="relative">
      <div onClick={()=>{if(!disabled)setOpen(o=>!o);}} tabIndex={disabled?-1:0}
        onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key==='ArrowDown')){e.preventDefault();setOpen(true);}}}
        className={`${ib} ${err?ie:in_} flex items-center justify-between ${disabled?'opacity-50 cursor-not-allowed':'cursor-pointer'}`}>
        <span className={displayLabel?'text-slate-700':'text-slate-300'} style={{fontSize:13}}>{displayLabel||placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {displayLabel&&!disabled&&<button type="button" onClick={e=>{e.stopPropagation();onChange('','');}} className="p-0.5 text-slate-300 hover:text-slate-500 rounded"><X size={10}/></button>}
          <Search size={11} className="text-slate-400"/>
        </div>
      </div>
      {open&&(
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-[999] overflow-hidden">
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input ref={srchRef} value={q} onChange={e=>{setQ(e.target.value);setCursor(-1);}}
                onKeyDown={e=>{
                  if(e.key==='Escape'){setOpen(false);setQ('');return;}
                  if(e.key==='ArrowDown'){e.preventDefault();setCursor(p=>Math.min(p+1,filtered.length-1));return;}
                  if(e.key==='ArrowUp'){e.preventDefault();setCursor(p=>Math.max(p-1,0));return;}
                  if(e.key==='Enter'){e.preventDefault();
                    if(cursor>=0&&filtered[cursor]){pick(filtered[cursor]);return;}
                    if(filtered.length===1){pick(filtered[0]);return;}
                    if(!filtered.length&&q.trim()&&onAddNew){onAddNew(q.trim());setOpen(false);setQ('');}
                  }
                }}
                placeholder="Search..." className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400"/>
            </div>
          </div>
          <div ref={listRef} className="max-h-44 overflow-y-auto">
            {filtered.length>0?filtered.map((item,i)=>{
              const lbl=item.Name??String(item);const isSel=String(item.Id??item)===String(value);
              return(<div key={i} data-idx={i} onMouseDown={()=>pick(item)} onMouseEnter={()=>setCursor(i)}
                className={`px-3 py-2 text-[13px] cursor-pointer flex items-center justify-between transition-colors ${cursor===i?'bg-indigo-50 text-indigo-700':'text-slate-700 hover:bg-slate-50'}`}>
                <span>{lbl}</span>{isSel&&<Check size={11} className="text-indigo-500"/>}
              </div>);}):(<div className="px-3 py-4 text-center">
                <p className="text-[11px] text-slate-400 mb-1.5">No results{q?` for "${q}"`:''}</p>
                {onAddNew&&q.trim()&&<button onMouseDown={()=>{onAddNew(q.trim());setOpen(false);setQ('');}}
                  className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 mx-auto hover:underline"><Plus size={10}/>Add "{q}"</button>}
              </div>)}
          </div>
          {onAddNew&&filtered.length>0&&(
            <div className="p-2 border-t border-slate-50">
              {!addMode?<button onMouseDown={()=>setAddMode(true)}
                className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-indigo-200 text-[11px] text-indigo-600 hover:bg-indigo-50">
                <Plus size={11}/>{addLabel||'Add custom'}</button>
              :<div className="flex gap-1.5">
                <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Type name..." autoFocus
                  className="flex-1 px-2 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400"
                  onKeyDown={e=>{if(e.key==='Enter'&&custom.trim()){onAddNew(custom.trim());setAddMode(false);setCustom('');setOpen(false);}if(e.key==='Escape'){setAddMode(false);setCustom('');}}}/>
                <button onMouseDown={()=>{if(custom.trim()){onAddNew(custom.trim());setAddMode(false);setCustom('');setOpen(false);}}}
                  className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold">Add</button>
              </div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Dot = ({status}) => {
  if(!status) return null;
  if(status==='checking') return <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>;
  if(status==='available') return <Check size={13} className="text-emerald-500"/>;
  if(status==='taken')     return <X size={13} className="text-red-500"/>;
  return null;
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ step, setStep, completedSteps, branding, primary }) => (
  <aside style={{width:264,background:'#0f172a'}} className="flex-shrink-0 flex flex-col min-h-screen">
    <div className="p-5 border-b border-white/8">
      <div className="flex items-center gap-3">
        {branding?.logoUrl
          ?<img src={branding.logoUrl} alt="logo" className="w-9 h-9 rounded-xl object-contain"/>
          :<div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:primary+'30'}}><Activity size={18} style={{color:primary}}/></div>}
        <div>
          <p className="text-white font-bold text-[13px] leading-tight">{branding?.name||'MediCore HMS'}</p>
          <p className="text-white/40 text-[10px] tracking-wider uppercase">Hospital Management</p>
        </div>
      </div>
    </div>
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{background:primary+'20',border:`1px solid ${primary}40`}}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#fbbf24'}}/>
        <span className="text-[11px] font-semibold text-white/70 tracking-wider uppercase">Doctor Registration</span>
      </div>
    </div>
    <div className="px-3 flex-1">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 px-1">Registration Steps</p>
      {STEPS.map((s,i)=>{
        const Icon=s.icon; const done=completedSteps.includes(s.id); const active=step===s.id;
        return(
          <div key={s.id}>
            <div onClick={()=>setStep(s.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1 transition-all cursor-pointer ${active?'bg-white/10':'hover:bg-white/8 opacity-70 hover:opacity-100'}`}>
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
      <div className="flex items-center gap-2 text-white/25 text-[11px]"><Lock size={11}/><span>256-bit SSL encrypted</span></div>
      <p className="text-white/20 text-[11px] mt-1">© {new Date().getFullYear()} {branding?.name||'MediCore HMS'}</p>
    </div>
  </aside>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function DoctorRegisterPage() {
  const { branding } = useHospitalBranding(1);
  const primary = branding?.primaryColor || '#6d28d9';

  const [step, setStep]                     = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showPass, setShowPass]             = useState(false);
  const [showConf, setShowConf]             = useState(false);
  const [loading, setLoading]               = useState(false);
  const [success, setSuccess]               = useState(false);
  const [errors, setErrors]                 = useState({});
  const [photoPreview, setPhotoPreview]     = useState(null);
  const [photoFile, setPhotoFile]           = useState(null);
  const photoRef = useRef(null);

  // ── FIX 2: prevent double-submit ─────────────────────────────────────────
  const submitLock = useRef(false);

  const [documents, setDocuments] = useState([]);
  const [countries, setCountries] = useState([]);
  const [states,    setStates]    = useState([]);
  const [specs,     setSpecs]     = useState([]);
  const [quals,     setQuals]     = useState([]);
  const [depts,     setDepts]     = useState([]);
  const [councils,  setCouncils]  = useState([]);

  const [unStatus,    setUnStatus]    = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [phoneStatus, setPhoneStatus] = useState(null);
  const unTimer=useRef(null); const emailTimer=useRef(null); const phoneTimer=useRef(null);

  // ── FIX 6: Email OTP state for doctor registration ────────────────────────
  const [emailOtpSent,     setEmailOtpSent]     = useState(false);  // OTP sent to email
  const [emailOtpValue,    setEmailOtpValue]    = useState('');     // what user typed
  const [emailVerified,    setEmailVerified]    = useState(false);  // backend confirmed
  const [emailOtpLoading,  setEmailOtpLoading]  = useState(false);  // send/verify spinner
  const [emailOtpError,    setEmailOtpError]    = useState('');     // inline error
  const [otpCooldown,      setOtpCooldown]      = useState(0);      // resend countdown (s)
  const otpCooldownRef = useRef(null);

  const [form, setForm] = useState({
    firstName:'', lastName:'', gender:'', dateOfBirth:'',
    bloodGroup:'', nationality:'Indian', maritalStatus:'', religion:'',
    occupation:'', motherTongue:'', designation:'',
    phone:'', phoneCode:'+91', altPhone:'', email:'',
    username:'', password:'', confirmPassword:'',
    specializationId:'', qualificationId:'', departmentId:'', medicalCouncilId:'',
    licenseNumber:'', licenseExpiry:'',
    experienceYears:'', maxDailyPatients:'',
    consultationFee:'', followUpFee:'', emergencyFee:'',
    availableDays:[], availableFrom:'09:00', availableTo:'17:00',
    languagesSpoken:'Hindi, English',
    bio:'', awards:'', publications:'',
    aadhaar:'', pan:'', passportNo:'', voterId:'', abhaNumber:'',
    street1:'', street2:'', city:'',
    countryId:'', countryName:'', stateId:'', stateName:'',
    pincode:'',
  });

  const set = useCallback((k,v)=>{ setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:''})); },[]);
  const toggleDay = d => setForm(f=>({...f,availableDays:f.availableDays.includes(d)?f.availableDays.filter(x=>x!==d):[...f.availableDays,d]}));

  const FALLBACK_COUNTRIES=[{Id:-1,Name:'India'},{Id:-2,Name:'United States'},{Id:-3,Name:'United Kingdom'},{Id:-4,Name:'UAE'},{Id:-5,Name:'Australia'},{Id:-6,Name:'Singapore'}];
  const extractList = (r) => {
    if(Array.isArray(r))              return r;
    if(Array.isArray(r?.data))        return r.data;
    if(Array.isArray(r?.data?.items)) return r.data.items;
    if(Array.isArray(r?.items))       return r.items;
    return [];
  };

  useEffect(()=>{
    api.get('/setup/specializations?limit=200').then(r=>setSpecs(extractList(r))).catch(()=>{});
    api.get('/setup/qualifications?limit=200').then(r=>setQuals(extractList(r))).catch(()=>{});
    api.get('/hospitals/1/departments').then(r=>setDepts(extractList(r))).catch(()=>{});
    api.get('/setup/medical-councils?limit=200').then(r=>setCouncils(extractList(r))).catch(()=>{});
    api.get('/geo/countries')
      .then(r=>{ const l=extractList(r); setCountries(l.length?l:FALLBACK_COUNTRIES); })
      .catch(()=>setCountries(FALLBACK_COUNTRIES));
  },[]);

  useEffect(()=>{
    if(!form.countryId||Number(form.countryId)<0){setStates([]);return;}
    api.get(`/geo/countries/${form.countryId}/states`).then(r=>setStates(extractList(r))).catch(()=>setStates([]));
  },[form.countryId]);

  // ── Live checks ───────────────────────────────────────────────────────────
  const handleUsername = v => {
    const clean=v.replace(/[^a-z0-9_.-]/g,'').toLowerCase();
    setForm(f=>({...f,username:clean})); setErrors(e=>({...e,username:''})); setUnStatus(null);
    if(unTimer.current) clearTimeout(unTimer.current);
    if(!clean||clean.length<3) return;
    setUnStatus('checking');
    unTimer.current=setTimeout(async()=>{
      try{
        const r=await api.get('/register/check-username?username='+encodeURIComponent(clean));
        const avail=r?.data?.available??r?.available;
        setUnStatus(avail===true?'available':avail===false?'taken':null);
        if(avail===false) setErrors(e=>({...e,username:'Already taken'}));
      }catch{setUnStatus(null);}
    },500);
  };
  // ── FIX 6: handleEmail resets OTP state whenever email changes ──────────────
  const handleEmail = v => {
    set('email', v);
    setEmailStatus(null);
    // Reset entire OTP flow if email changes after OTP was sent / verified
    if (emailOtpSent || emailVerified) {
      setEmailOtpSent(false);
      setEmailVerified(false);
      setEmailOtpValue('');
      setEmailOtpError('');
    }
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (!v || !/\S+@\S+\.\S+/.test(v)) return;
    setEmailStatus('checking');
    emailTimer.current = setTimeout(async () => {
      try {
        const r = await api.get('/register/check-email?email=' + encodeURIComponent(v.trim()));
        const avail = r?.data?.available ?? r?.available;
        setEmailStatus(avail === true ? 'available' : avail === false ? 'taken' : null);
        if (avail === false) setErrors(e => ({ ...e, email: 'Already registered' }));
      } catch { setEmailStatus(null); }
    }, 600);
  };

  // ── FIX 5: handlePhone blocks leading 0 ──────────────────────────────────
  const handlePhone = v => {
    if (v.startsWith('0')) return;           // reject 0-prefix at handler level too
    set('phone', v); setPhoneStatus(null);
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    if (v.length < 10) return;
    setPhoneStatus('checking');
    phoneTimer.current = setTimeout(async () => {
      try {
        const r = await api.get('/register/check-phone?phone=' + encodeURIComponent(v));
        const avail = r?.data?.available ?? r?.available;
        setPhoneStatus(avail === true ? 'available' : avail === false ? 'taken' : null);
        if (avail === false) setErrors(e => ({ ...e, phone: 'Already registered' }));
      } catch { setPhoneStatus(null); }
    }, 600);
  };

  // ── FIX 6: OTP cooldown ticker ────────────────────────────────────────────
  const startCooldown = (secs = 60) => {
    setOtpCooldown(secs);
    if (otpCooldownRef.current) clearInterval(otpCooldownRef.current);
    otpCooldownRef.current = setInterval(() => {
      setOtpCooldown(prev => {
        if (prev <= 1) { clearInterval(otpCooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── FIX 6: Send email OTP to doctor ──────────────────────────────────────
  const sendDocEmailOtp = async () => {
    const email = form.email.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailOtpError('Enter a valid email first'); return;
    }
    if (emailStatus === 'taken') { setEmailOtpError('This email is already registered'); return; }
    setEmailOtpLoading(true); setEmailOtpError('');
    try {
      // Reuse the same endpoint used by patient registration
      await api.post('/register/send-email-otp', { email });
      setEmailOtpSent(true);
      setEmailOtpValue('');
      startCooldown(60);
      toast.success('OTP sent! Check your inbox.');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to send OTP';
      setEmailOtpError(msg);
      toast.error(msg);
    } finally { setEmailOtpLoading(false); }
  };

  // ── FIX 6: Verify email OTP ───────────────────────────────────────────────
  const verifyDocEmailOtp = async () => {
    if (emailOtpValue.length !== 6) { setEmailOtpError('Enter the 6-digit OTP'); return; }
    setEmailOtpLoading(true); setEmailOtpError('');
    try {
      await api.post('/register/verify-email-otp', { email: form.email.trim(), otp: emailOtpValue });
      setEmailVerified(true);
      setEmailOtpError('');
      setErrors(e => ({ ...e, email: '' }));
      toast.success('Email verified!');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid OTP';
      setEmailOtpError(msg);
    } finally { setEmailOtpLoading(false); }
  };

  // ── Identity handlers ─────────────────────────────────────────────────────
  const handlePAN      = raw => set('pan',      formatPAN(raw));
  const handlePassport = raw => set('passportNo',formatPassport(raw));
  const handleVoterId  = raw => set('voterId',   formatVoterId(raw));
  const handleABHA     = raw => set('abhaNumber',formatABHA(raw));
  const handleAadhaar  = raw => set('aadhaar',   raw.replace(/\D/g,'').slice(0,12));

  // ── Documents ─────────────────────────────────────────────────────────────
  const addDoc    = () => setDocuments(d=>[...d,{docType:'',file:null,fileName:'',expiryDate:'',notes:''}]);
  const removeDoc = i  => setDocuments(d=>d.filter((_,idx)=>idx!==i));
  const setDocF   = (i,k,v) => setDocuments(d=>d.map((doc,idx)=>idx===i?{...doc,[k]:v}:doc));
  const handleDocFile = (i,e) => { const f=e.target.files[0]; if(f)setDocuments(d=>d.map((doc,idx)=>idx===i?{...doc,file:f,fileName:f.name}:doc)); };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = (s, f=form) => {
    const e={};
    if(s===1){
      if(!f.firstName.trim()) e.firstName='Required';
      if(!f.lastName.trim())  e.lastName='Required';
      if(!f.gender)           e.gender='Required';
      if(f.dateOfBirth){ const de=validateDoctorDOB(f.dateOfBirth); if(de) e.dateOfBirth=de; }
      if(!f.email||!/\S+@\S+\.\S+/.test(f.email)) e.email='Valid email required';
      else if(emailStatus==='taken') e.email='Email already registered';
      else if(!emailVerified) e.email='Please verify your email with the OTP sent';
      if(!f.phone)                  e.phone='Required';
      else if(f.phone.startsWith('0')) e.phone='Cannot start with 0';
      else if(f.phone.length!==10)    e.phone='Must be 10 digits';
      else if(phoneStatus==='taken')  e.phone='Already registered';
      if(!f.username.trim())       e.username='Required';
      else if(f.username.length<3) e.username='Min 3 characters';
      else if(unStatus==='taken')  e.username='Already taken';
      if(!f.password)              e.password='Required';
      else if(f.password.length<8) e.password='Min 8 characters';
      else if(!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(f.password)) e.password='Need uppercase, lowercase & number';
      if(f.password!==f.confirmPassword) e.confirmPassword='Do not match';
    }
    if(s===2){
      if(!f.specializationId) e.specializationId='Required';
      if(!f.licenseNumber.trim()) e.licenseNumber='Required';
      if(f.licenseExpiry&&new Date(f.licenseExpiry)<=new Date()) e.licenseExpiry='Must be a future date';
      if(f.pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan)) e.pan='Invalid format (e.g. ABCDE1234F)';
      if(f.aadhaar&&f.aadhaar.replace(/\s/g,'').length!==12) e.aadhaar='Must be 12 digits';
    }
    if(s===3){
      if(!f.street1.trim()) e.street1='Required';
      if(!f.city.trim())    e.city='Required';
      if(!f.countryId)      e.countryId='Required';
      if(f.pincode&&!/^\d{6}$/.test(f.pincode)) e.pincode='Must be 6 digits';
    }
    return e;
  };

  const validate    = () => { const e=validateStep(step); setErrors(e); return Object.keys(e).length===0; };

  const validateAll = () => {
    const all={}; let firstErr=null;
    for(const s of [1,2,3]){
      const e=validateStep(s);
      if(Object.keys(e).length>0){ Object.assign(all,e); if(!firstErr)firstErr=s; }
    }
    setErrors(all);
    if(firstErr&&firstErr!==step){ setStep(firstErr); toast.error(`Please fix errors in Step ${firstErr}`); }
    return Object.keys(all).length===0;
  };

  const handleNext      = () => { if(validate()){ setCompletedSteps(prev=>prev.includes(step)?prev:[...prev,step]); setStep(s=>s+1); } };
  const handleBack      = () => setStep(s=>s-1);
  const handleStepClick = t  => setStep(t);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // ── FIX 2: block re-entrant calls (double-click / React StrictMode) ────
    if (submitLock.current) return;
    if (!validateAll()) return;

    submitLock.current = true;
    setLoading(true);

    try {
      // ── FIX 1: helpers so we never send blank strings to SQL Server ────────
      const orUndef     = v => (v === '' || v == null ? undefined : v);
      // Only send availableFrom / availableTo when they contain HH:MM
      const timeOrUndef = v => (/^\d{2}:\d{2}$/.test(v ?? '') ? v : undefined);

      // ── FIX 3: strip formatting before sending ─────────────────────────────
      const cleanAadhaar = form.aadhaar.replace(/\s/g,'');
      const cleanABHA    = form.abhaNumber.replace(/-/g,'');

      const payload = {
        hospitalId: 1,
        // Personal
        firstName:     form.firstName,
        lastName:      form.lastName,
        gender:        form.gender,
        dateOfBirth:   orUndef(form.dateOfBirth),
        bloodGroup:    orUndef(form.bloodGroup),
        nationality:   orUndef(form.nationality),
        maritalStatus: orUndef(form.maritalStatus),
        religion:      orUndef(form.religion),
        occupation:    orUndef(form.occupation),
        motherTongue:  orUndef(form.motherTongue),
        designation:   orUndef(form.designation),
        // Contact
        email:            form.email,
        phone:            form.phone,
        phoneCountryCode: form.phoneCode,
        altPhone:         orUndef(form.altPhone),
        // Credentials
        username: form.username,
        password: form.password,
        // Professional
        specializationId:  orUndef(form.specializationId),
        qualificationId:   orUndef(form.qualificationId),
        departmentId:      orUndef(form.departmentId),
        medicalCouncilId:  orUndef(form.medicalCouncilId),
        licenseNumber:     form.licenseNumber,
        licenseExpiry:     orUndef(form.licenseExpiry),
        experienceYears:   form.experienceYears  ? Number(form.experienceYears)  : undefined,
        maxDailyPatients:  form.maxDailyPatients ? Number(form.maxDailyPatients) : undefined,
        // Fees
        consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
        followUpFee:     form.followUpFee     ? Number(form.followUpFee)     : undefined,
        emergencyFee:    form.emergencyFee    ? Number(form.emergencyFee)    : undefined,
        // ── FIX 1: never send '' for TIME columns ─────────────────────────────
        availableDays: form.availableDays.length ? form.availableDays.join(',') : undefined,
        availableFrom: timeOrUndef(form.availableFrom),
        availableTo:   timeOrUndef(form.availableTo),
        languagesSpoken: orUndef(form.languagesSpoken),
        bio:             orUndef(form.bio),
        awards:          orUndef(form.awards),
        publications:    orUndef(form.publications),
        // ── FIX 3: identity — send undefined not '' ───────────────────────────
        aadhaar:    cleanAadhaar  || undefined,
        pan:        orUndef(form.pan),
        passportNo: orUndef(form.passportNo),
        voterId:    orUndef(form.voterId),
        abhaNumber: cleanABHA    || undefined,
        // Address
        street1:   form.street1,
        street2:   orUndef(form.street2),
        city:      form.city,
        pincode:   orUndef(form.pincode),
        countryId: orUndef(form.countryId),
        stateId:   orUndef(form.stateId),
      };

      const hasFiles = documents.some(d=>d.file) || !!photoFile;

      if (hasFiles) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k,v])=>{ if(v!=null) fd.append(k,String(v)); });
        if(photoFile) fd.append('photo',photoFile);
        documents.forEach((doc,i)=>{
          if(doc.docType)    fd.append(`documents[${i}][docType]`,    doc.docType);
          if(doc.file)       fd.append(`documents[${i}][file]`,       doc.file);
          if(doc.expiryDate) fd.append(`documents[${i}][expiryDate]`, doc.expiryDate);
          if(doc.notes)      fd.append(`documents[${i}][notes]`,      doc.notes);
        });
        await api.post('/register/doctor', fd, { headers:{'Content-Type':'multipart/form-data'} });
      } else {
        await api.post('/register/doctor', payload);
      }

      setSuccess(true);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
      submitLock.current = false; // release lock so user can retry after an error
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if(success) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-yellow-50 border-4 border-yellow-100 flex items-center justify-center mx-auto mb-4">
          <Clock size={30} className="text-yellow-500"/>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Submitted!</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Your doctor registration is pending admin review. You'll receive an email once approved — usually within 1–2 business days.
        </p>
        <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm" style={{background:primary}}>
          Back to Login
        </Link>
      </div>
    </div>
  );

  const pct     = Math.round(((step-1)/STEPS.length)*100);
  const str     = pwStrength(form.password);
  const pwMatch = form.confirmPassword ? form.password===form.confirmPassword : null;

  // ── FIX 4: phone status rendered as <div> rows (not <p>) so that the
  //           spinner <div> child never violates HTML nesting rules ──────────
  const phoneStatusEl = (
    <>
      {phoneStatus==='checking'  && <div className="text-slate-400 text-[11px] mt-1 flex items-center gap-1"><div className="w-2.5 h-2.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>Checking...</div>}
      {phoneStatus==='taken'     && <div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={9}/>Already registered</div>}
      {phoneStatus==='available' && <div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
    </>
  );

  return (
    <div className="min-h-screen flex" style={{background:'#f8faff'}}>
      <div className="hidden md:flex">
        <Sidebar step={step} setStep={handleStepClick} completedSteps={completedSteps} branding={branding} primary={primary}/>
      </div>

      <div className="flex-1 flex flex-col min-h-screen overflow-auto">

        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-6 lg:px-10 py-4 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-[18px] font-bold text-slate-800">Doctor Registration</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Step {step} of {STEPS.length} — {STEPS[step-1].label}</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {STEPS.map((s,i)=>(
              <div key={s.id} className="flex items-center gap-2">
                <div onClick={()=>handleStepClick(s.id)}
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

          {/* ═══ STEP 1 ═══ */}
          {step===1&&(
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

                {/* Personal */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={User} title="Personal Details" sub="Name, demographics & additional info" color={primary}/>
                  <div className="flex items-start gap-4 mb-3">
                    <div onClick={()=>photoRef.current?.click()}
                      className="w-16 h-16 rounded-full flex-shrink-0 cursor-pointer border-2 overflow-hidden flex items-center justify-center relative group"
                      style={{borderColor:photoPreview?primary:'#e2e8f0',background:photoPreview?'transparent':'#f8fafc'}}>
                      {photoPreview?<img src={photoPreview} alt="Doctor" className="w-full h-full object-cover"/>:<Camera size={20} className="text-slate-300"/>}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"><Camera size={13} className="text-white"/></div>
                    </div>
                    <input ref={photoRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(f){setPhotoPreview(URL.createObjectURL(f));setPhotoFile(f);}}} className="hidden"/>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <FW label="First Name" required error={errors.firstName}>
                        <FI err={!!errors.firstName} value={form.firstName} onChange={e=>set('firstName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Priya"/>
                      </FW>
                      <FW label="Last Name" required error={errors.lastName}>
                        <FI err={!!errors.lastName} value={form.lastName} onChange={e=>set('lastName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Mehta"/>
                      </FW>
                    </div>
                  </div>
                  <div className="grid grid-cols-8 gap-3 mb-3">
                    <FW label="Gender" required error={errors.gender} className="col-span-2">
                      <FS err={!!errors.gender} value={form.gender} onChange={e=>set('gender',e.target.value)}>
                        <option value="">—</option>{GENDERS.map(g=><option key={g}>{g}</option>)}
                      </FS>
                    </FW>
                    <FW label="Date of Birth" error={errors.dateOfBirth} hint={`Age ${MIN_DOCTOR_AGE}–${MAX_DOCTOR_AGE} yrs`} className="col-span-3">
                      <FI type="date" err={!!errors.dateOfBirth} value={form.dateOfBirth}
                        onChange={e=>{set('dateOfBirth',e.target.value);const de=validateDoctorDOB(e.target.value);if(de)setErrors(p=>({...p,dateOfBirth:de}));}}
                        min={getMinDOB()} max={getMaxDOB()}/>
                    </FW>
                    <FW label="Blood Grp" className="col-span-1">
                      <FS value={form.bloodGroup} onChange={e=>set('bloodGroup',e.target.value)}>
                        <option value="">—</option>{BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                      </FS>
                    </FW>
                    <FW label="Nationality" className="col-span-2">
                      <FI value={form.nationality} onChange={e=>set('nationality',e.target.value)} placeholder="Indian"/>
                    </FW>
                  </div>
                  <div className="mb-3">
                    <FW label="Designation">
                      <FI value={form.designation} onChange={e=>set('designation',e.target.value)} placeholder="e.g. Senior Consultant, Resident Doctor"/>
                    </FW>
                  </div>
                  <div className="grid grid-cols-8 gap-3 mb-3">
                    <FW label="Marital Status" className="col-span-3">
                      <FS value={form.maritalStatus} onChange={e=>set('maritalStatus',e.target.value)}>
                        <option value="">—</option>{MARITAL.map(m=><option key={m}>{m}</option>)}
                      </FS>
                    </FW>
                    <FW label="Religion" className="col-span-3">
                      <FS value={form.religion} onChange={e=>set('religion',e.target.value)}>
                        <option value="">—</option>{RELIGIONS.map(r=><option key={r}>{r}</option>)}
                      </FS>
                    </FW>
                    <FW label="Mother Tongue" className="col-span-2">
                      <FI value={form.motherTongue} onChange={e=>set('motherTongue',e.target.value)} placeholder="Hindi"/>
                    </FW>
                  </div>
                  <FW label="Occupation">
                    <FI value={form.occupation} onChange={e=>set('occupation',e.target.value)} placeholder="e.g. Medical Professional, Surgeon"/>
                  </FW>
                </div>

                {/* Right col */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Activity} title="Contact Info" sub="Phone & email" color="#0ea5e9"/>
                    <div className="space-y-3">
                      {/* FIX 4: pass statusEl prop instead of rendering <p> inside FW */}
                      <FW label="Mobile" required error={errors.phone}>
                        <PhoneField
                          code={form.phoneCode} onCode={v=>set('phoneCode',v)}
                          val={form.phone} onChange={handlePhone}
                          err={!!errors.phone||phoneStatus==='taken'}
                          statusEl={phoneStatusEl}
                        />
                      </FW>
                      <FW label="Alternate Phone">
                        <PhoneField code={form.phoneCode} onCode={()=>{}} val={form.altPhone} onChange={v=>set('altPhone',v)} placeholder="Optional"/>
                      </FW>
                      {/* ── FIX 6: Email with inline OTP verification ────── */}
                      <FW label="Email" required error={!emailOtpSent && errors.email}>
                        {/* Email input row */}
                        <div className="relative">
                          <FI type="email"
                            err={!!errors.email || emailStatus==='taken'}
                            ok={emailVerified}
                            value={form.email}
                            onChange={e => handleEmail(e.target.value)}
                            placeholder="dr.priya@email.com"
                            className="pr-20"
                            disabled={emailVerified}
                          />
                          {/* Availability dot OR verified badge */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {emailVerified
                              ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold"><Check size={9}/>Verified</span>
                              : <Dot status={emailStatus}/>
                            }
                          </div>
                        </div>

                        {/* Error when not yet in OTP flow */}
                        {!emailOtpSent && errors.email && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.email}</p>
                        )}

                        {/* Send OTP button — shown when email is valid, not taken, not verified */}
                        {!emailVerified && !emailOtpSent && emailStatus==='available' && (
                          <button type="button" onClick={sendDocEmailOtp} disabled={emailOtpLoading}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-[12px] font-semibold hover:bg-indigo-50 disabled:opacity-50 transition-colors">
                            {emailOtpLoading
                              ? <><div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"/>Sending...</>
                              : <><Send size={11}/>Send Verification OTP</>}
                          </button>
                        )}

                        {/* OTP input + verify — shown after OTP sent */}
                        {emailOtpSent && !emailVerified && (
                          <div className="mt-2 p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2">
                            <p className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                              <Mail size={10}/>OTP sent to <span className="font-bold">{form.email}</span>
                            </p>
                            <div className="flex gap-2">
                              <input
                                value={emailOtpValue}
                                onChange={e => { setEmailOtpValue(e.target.value.replace(/\D/g,'').slice(0,6)); setEmailOtpError(''); }}
                                placeholder="Enter 6-digit OTP"
                                inputMode="numeric"
                                maxLength={6}
                                className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-[13px] text-slate-700 outline-none focus:border-indigo-400 font-mono tracking-widest bg-white placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-300"
                              />
                              <button type="button" onClick={verifyDocEmailOtp} disabled={emailOtpLoading || emailOtpValue.length!==6}
                                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors">
                                {emailOtpLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Verify'}
                              </button>
                            </div>
                            {emailOtpError && (
                              <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={9}/>{emailOtpError}</p>
                            )}
                            {/* Resend with cooldown */}
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-slate-400">Didn't receive it?</p>
                              {otpCooldown > 0
                                ? <span className="text-[11px] text-slate-400 font-medium">Resend in {otpCooldown}s</span>
                                : <button type="button" onClick={sendDocEmailOtp} disabled={emailOtpLoading}
                                    className="text-[11px] text-indigo-600 font-semibold hover:underline disabled:opacity-50">
                                    Resend OTP
                                  </button>
                              }
                            </div>
                          </div>
                        )}

                        {/* Verified success row */}
                        {emailVerified && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                            <CheckCircle size={12} className="text-emerald-500"/>Email verified successfully
                          </div>
                        )}
                      </FW>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Lock} title="Login Credentials" sub="Username & password" color="#8b5cf6"/>
                    <div className="space-y-3">
                      <FW label="Username" required error={errors.username}>
                        <div className="relative">
                          <FI err={!!errors.username||unStatus==='taken'} ok={unStatus==='available'}
                            value={form.username} onChange={e=>handleUsername(e.target.value)} placeholder="dr.priya.mehta" className="pr-8"/>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2"><Dot status={unStatus}/></div>
                        </div>
                        {/* FIX 4: was <p> — changed to <div> */}
                        {unStatus==='available'&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                        {errors.username&&<p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.username}</p>}
                      </FW>
                      <FW label="Password" required error={errors.password}>
                        <div className="relative">
                          <FI type={showPass?'text':'password'} err={!!errors.password}
                            value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Min 8 characters" className="pr-9"/>
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
                            value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} placeholder="Re-enter password" className="pr-9"/>
                          <button type="button" onClick={()=>setShowConf(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showConf?<EyeOff size={14}/>:<Eye size={14}/>}
                          </button>
                        </div>
                        {/* FIX 4: was <p> — changed to <div> */}
                        {pwMatch===true&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Passwords match</div>}
                      </FW>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 2 ═══ */}
          {step===2&&(
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Stethoscope} title="Qualifications & Role" sub="Specialization, department & council" color={primary}/>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <FW label="Specialization" required error={errors.specializationId}>
                        <SearchSelect value={form.specializationId} items={specs} placeholder="Select or type to add"
                          err={!!errors.specializationId}
                          onAddNew={name=>{const c={Id:`custom_spec_${Date.now()}`,Name:name};setSpecs(p=>[...p,c]);set('specializationId',c.Id);toast.success(`"${name}" added`);}}
                          addLabel="Add specialization" onChange={id=>set('specializationId',id)}/>
                        {errors.specializationId&&<p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.specializationId}</p>}
                      </FW>
                      <FW label="Qualification">
                        <SearchSelect value={form.qualificationId}
                          items={quals.map(q=>({...q,Name:`${q.Code||''} ${q.FullName??q.Name??''}`.trim()}))}
                          placeholder="Select or type to add"
                          onAddNew={name=>{const c={Id:`custom_qual_${Date.now()}`,Name:name};setQuals(p=>[...p,c]);set('qualificationId',c.Id);toast.success(`"${name}" added`);}}
                          addLabel="Add qualification" onChange={id=>set('qualificationId',id)}/>
                      </FW>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FW label="Department">
                        <SearchSelect value={form.departmentId} items={depts} placeholder="Select or type to add"
                          onAddNew={name=>{const c={Id:`custom_dept_${Date.now()}`,Name:name};setDepts(p=>[...p,c]);set('departmentId',c.Id);toast.success(`"${name}" added`);}}
                          addLabel="Add department" onChange={id=>set('departmentId',id)}/>
                      </FW>
                      <FW label="Medical Council">
                        <SearchSelect value={form.medicalCouncilId} items={councils} placeholder="Select or type to add"
                          onAddNew={name=>{const c={Id:`custom_council_${Date.now()}`,Name:name};setCouncils(p=>[...p,c]);set('medicalCouncilId',c.Id);toast.success(`"${name}" added`);}}
                          addLabel="Add medical council" onChange={id=>set('medicalCouncilId',id)}/>
                      </FW>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={FileText} title="License, Fees & Schedule" sub="Registration, availability & rates" color="#0ea5e9"/>
                    <div className="grid grid-cols-8 gap-3 mb-3">
                      <FW label="License No." required error={errors.licenseNumber} className="col-span-4">
                        <FI err={!!errors.licenseNumber} value={form.licenseNumber} onChange={e=>set('licenseNumber',e.target.value)} placeholder="MH/12345/2020"/>
                      </FW>
                      <FW label="Expiry" error={errors.licenseExpiry} className="col-span-2">
                        <FI type="date" err={!!errors.licenseExpiry} value={form.licenseExpiry}
                          onChange={e=>{set('licenseExpiry',e.target.value);if(e.target.value&&new Date(e.target.value)<=new Date())setErrors(p=>({...p,licenseExpiry:'Must be a future date'}));}}
                          min={todayStr}/>
                      </FW>
                      <FW label="Exp.Yrs" className="col-span-1">
                        <FI type="number" value={form.experienceYears} onChange={e=>set('experienceYears',e.target.value)} placeholder="5" min={0} max={60}/>
                      </FW>
                      <FW label="Max/Day" className="col-span-1">
                        <FI type="number" value={form.maxDailyPatients} onChange={e=>set('maxDailyPatients',e.target.value)} placeholder="30" min={1}/>
                      </FW>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <FW label="Consultation (₹)"><FI type="number" value={form.consultationFee} onChange={e=>set('consultationFee',e.target.value)} placeholder="500" min={0}/></FW>
                      <FW label="Follow-up (₹)"><FI type="number" value={form.followUpFee} onChange={e=>set('followUpFee',e.target.value)} placeholder="300" min={0}/></FW>
                      <FW label="Emergency (₹)"><FI type="number" value={form.emergencyFee} onChange={e=>set('emergencyFee',e.target.value)} placeholder="1000" min={0}/></FW>
                    </div>
                    <FW label="Available Days" className="mb-3">
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {DAYS.map((d,i)=>(
                          <button key={d} type="button" onClick={()=>toggleDay(FULL_DAYS[i])}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${form.availableDays.includes(FULL_DAYS[i])?'text-white border-transparent':'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            style={form.availableDays.includes(FULL_DAYS[i])?{background:primary}:{}}>{d}</button>
                        ))}
                      </div>
                    </FW>
                    <div className="grid grid-cols-8 gap-3">
                      <FW label="From" className="col-span-2"><FI type="time" value={form.availableFrom} onChange={e=>set('availableFrom',e.target.value)}/></FW>
                      <FW label="To"   className="col-span-2"><FI type="time" value={form.availableTo}   onChange={e=>set('availableTo',  e.target.value)}/></FW>
                      <FW label="Languages Spoken" className="col-span-4"><FI value={form.languagesSpoken} onChange={e=>set('languagesSpoken',e.target.value)} placeholder="Hindi, English"/></FW>
                    </div>
                  </div>
                </div>

                {/* Right 2/5 */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={Shield} title="Identity Documents" sub="Government IDs (optional)" color="#ef4444"/>
                    <div className="space-y-3">
                      <FW label="Aadhaar Number" error={errors.aadhaar} hint={!errors.aadhaar?'Format: XXXX XXXX XXXX':undefined}>
                        <FI err={!!errors.aadhaar} value={formatAadhaar(form.aadhaar)} onChange={e=>handleAadhaar(e.target.value)}
                          placeholder="1234 5678 9012" inputMode="numeric" className="font-mono tracking-widest" maxLength={14}/>
                      </FW>
                      <div className="grid grid-cols-2 gap-3">
                        <FW label="PAN" error={errors.pan} hint={!errors.pan?'5 letters · 4 digits · 1 letter':undefined}>
                          <FI err={!!errors.pan} value={form.pan} onChange={e=>handlePAN(e.target.value)}
                            placeholder="ABCDE1234F" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                        </FW>
                        <FW label="ABHA No." hint="Format: XX-XXXX-XXXX-XXXX">
                          <FI value={form.abhaNumber} onChange={e=>handleABHA(e.target.value)}
                            placeholder="12-3456-7890-1234" inputMode="numeric" className="font-mono tracking-wider" maxLength={19}/>
                        </FW>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FW label="Passport No." hint="1 letter + 7 digits">
                          <FI value={form.passportNo} onChange={e=>handlePassport(e.target.value)}
                            placeholder="A1234567" className="font-mono uppercase tracking-widest" maxLength={8} spellCheck={false}/>
                        </FW>
                        <FW label="Voter ID" hint="3 letters + 7 digits">
                          <FI value={form.voterId} onChange={e=>handleVoterId(e.target.value)}
                            placeholder="ABC1234567" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                        </FW>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <SecHead icon={BookOpen} title="Profile & Achievements" sub="Bio, awards & publications" color="#8b5cf6"/>
                    <div className="space-y-3">
                      <FW label="Bio / About">
                        <FTA value={form.bio} onChange={e=>set('bio',e.target.value)} rows={3} placeholder="Brief professional summary visible to patients..."/>
                      </FW>
                      <FW label="Awards & Recognition">
                        <FTA value={form.awards} onChange={e=>set('awards',e.target.value)} rows={2} placeholder="e.g. Best Doctor Award 2022, AIIMS Gold Medal..."/>
                      </FW>
                      <FW label="Publications / Research">
                        <FTA value={form.publications} onChange={e=>set('publications',e.target.value)} rows={2} placeholder="List published papers, journals or books..."/>
                      </FW>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 3 ═══ */}
          {step===3&&(
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={MapPin} title="Residential Address" sub="Current place of residence" color="#8b5cf6"/>
                  <div className="space-y-3">
                    <FW label="Street Line 1" required error={errors.street1}>
                      <FI err={!!errors.street1} value={form.street1} onChange={e=>set('street1',e.target.value)} placeholder="Building no., Street name"/>
                    </FW>
                    <FW label="Street Line 2">
                      <FI value={form.street2} onChange={e=>set('street2',e.target.value)} placeholder="Area, Landmark (optional)"/>
                    </FW>
                    <div className="grid grid-cols-2 gap-3">
                      <FW label="Country" required error={errors.countryId}>
                        <SearchSelect value={form.countryId} items={countries}
                          placeholder={countries.length?'Select':'Loading...'} err={!!errors.countryId}
                          onChange={(id,name)=>{set('countryId',id);set('countryName',name);set('stateId','');set('stateName','');}}/>
                        {errors.countryId&&<p className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.countryId}</p>}
                      </FW>
                      <FW label="State / Province">
                        {(Number(form.countryId)<0||!form.countryId)
                          ?<FI value={form.stateName} onChange={e=>{set('stateName',e.target.value);set('stateId','manual');}} placeholder="Type state"/>
                          :<SearchSelect value={form.stateId} items={states}
                              placeholder={form.countryId?'Select':'Pick country'} disabled={!form.countryId}
                              onAddNew={name=>{set('stateName',name);set('stateId','custom');}} addLabel="Add manually"
                              onChange={(id,name)=>{set('stateId',id);set('stateName',name);}}/>}
                      </FW>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      <FW label="City" required error={errors.city} className="col-span-3">
                        <FI err={!!errors.city} value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Mumbai"/>
                      </FW>
                      <FW label="Pincode" error={errors.pincode} hint="6 digits" className="col-span-2">
                        <FI err={!!errors.pincode} value={form.pincode}
                          onChange={e=>set('pincode',e.target.value.replace(/\D/g,'').slice(0,6))}
                          placeholder="400001" inputMode="numeric" maxLength={6} className="font-mono tracking-wider"/>
                      </FW>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'#0ea5e918'}}>
                        <Upload size={15} style={{color:'#0ea5e9'}} strokeWidth={2.2}/>
                      </div>
                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-700 leading-tight">Credential Documents</h3>
                        <p className="text-[11px] text-slate-400">Upload for admin verification (optional at this stage)</p>
                      </div>
                    </div>
                    <button type="button" onClick={addDoc}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-[11px] text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <Plus size={12}/>Add Doc
                    </button>
                  </div>
                  {documents.length===0&&(
                    <div className="border-2 border-dashed border-slate-100 rounded-xl p-8 text-center">
                      <Upload size={24} className="text-slate-200 mx-auto mb-2"/>
                      <p className="text-[12px] text-slate-400 mb-1">No documents added yet</p>
                      <p className="text-[11px] text-slate-300">Medical degree, license, ID proof, experience cert...</p>
                    </div>
                  )}
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {documents.map((doc,i)=>(
                      <div key={i} className="border border-slate-100 rounded-xl p-3.5 relative bg-slate-50/50">
                        <button type="button" onClick={()=>removeDoc(i)}
                          className="absolute top-3 right-3 p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={12}/>
                        </button>
                        <div className="grid grid-cols-7 gap-2.5 mb-2.5">
                          <FW label="Doc Type" className="col-span-4">
                            <FS value={doc.docType} onChange={e=>setDocF(i,'docType',e.target.value)}>
                              <option value="">Select type</option>
                              {DOC_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                            </FS>
                          </FW>
                          <FW label="Expiry Date" className="col-span-3">
                            <FI type="date" value={doc.expiryDate} onChange={e=>setDocF(i,'expiryDate',e.target.value)} min={todayStr}/>
                          </FW>
                        </div>
                        <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all mb-2.5
                          ${doc.fileName?'border-emerald-300 bg-emerald-50':'border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50'}`}>
                          <Upload size={13} className={doc.fileName?'text-emerald-500':'text-slate-400'}/>
                          <span className={`text-[11px] truncate ${doc.fileName?'text-emerald-700 font-medium':'text-slate-400'}`}>
                            {doc.fileName||'Click to upload (PDF, JPG, PNG)'}
                          </span>
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>handleDocFile(i,e)} className="hidden"/>
                        </label>
                        <FI value={doc.notes} onChange={e=>setDocF(i,'notes',e.target.value)}
                          placeholder="Notes e.g. Issued by Maharashtra Medical Council (optional)" className="text-[12px]"/>
                      </div>
                    ))}
                  </div>
                  {documents.length>0&&(
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                      <AlertCircle size={12} className="text-blue-500 flex-shrink-0"/>
                      <p className="text-[11px] text-blue-600">{documents.length} document{documents.length>1?'s':''} added. Admin will verify after submission.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer nav */}
        <footer className="bg-white border-t border-slate-100 px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {step>1
              ?<button onClick={handleBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-colors">
                  <ArrowLeft size={14}/>Back
                </button>
              :<Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-600 transition-colors">
                  <ArrowLeft size={13}/>Back to Login
                </Link>}
            <span className="text-[11px] text-slate-300 hidden sm:block">© {new Date().getFullYear()} {branding?.name||'MediCore HMS'}. All rights reserved.</span>
          </div>
          <div>
            {step<STEPS.length
              ?<button onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm hover:opacity-90 transition-all"
                  style={{background:primary}}>
                  Save & Continue<ArrowRight size={14}/>
                </button>
              :<button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{background:primary}}>
                  {loading
                    ?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting...</>
                    :<><CheckCircle size={15}/>Submit Application</>}
                </button>}
          </div>
        </footer>
      </div>
    </div>
  );
}