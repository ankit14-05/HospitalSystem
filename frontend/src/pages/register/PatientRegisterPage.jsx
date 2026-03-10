// src/pages/register/PatientRegisterPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle, ArrowLeft, ArrowRight, User,
  FileText, CreditCard, Activity, Shield, Heart, MapPin,
  Camera, ChevronRight, AlertCircle, Check, X, Search, Plus,
  Lock, Smartphone, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── Constants ─────────────────────────────────────────────────────────────────
const BLOOD_GROUPS   = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS        = ['Male','Female','Other'];
const MARITAL        = ['Single','Married','Divorced','Widowed','Separated'];
const IDENTITY_DOCS  = ['Aadhar Card','PAN Card','Passport','Voter ID','Driving License'];
const INSURANCE_LIST = [
  'Star Health','HDFC ERGO','ICICI Lombard','Bajaj Allianz','Niva Bupa',
  'Aditya Birla','Care Health','SBI Health','Tata AIG','United India',
  'New India Assurance','Oriental Insurance','National Insurance',
];
const PAYMENT_METHODS = [
  { id:'card', label:'Credit / Debit Card', icon: CreditCard },
  { id:'upi',  label:'UPI',                 icon: Smartphone },
  { id:'net',  label:'Net Banking',         icon: Building2  },
];
const STEPS = [
  { id:1, label:'Account Details',  sub:'Personal & contact info',    icon: User       },
  { id:2, label:'Medical Details',  sub:'Insurance & health history', icon: FileText   },
  { id:3, label:'Payment',          sub:'Registration fee',           icon: CreditCard },
];

const todayStr   = new Date().toISOString().split('T')[0];
const minDOB     = (() => { const d=new Date(); d.setFullYear(d.getFullYear()-150); return d.toISOString().split('T')[0]; })();
const minArrival = (() => { const d=new Date(); d.setFullYear(d.getFullYear()-3);   return d.toISOString().split('T')[0]; })();

// ── Helpers ───────────────────────────────────────────────────────────────────
const calcAge = dob => {
  if (!dob) return '';
  const b=new Date(dob), t=new Date();
  let a = t.getFullYear()-b.getFullYear();
  if (t.getMonth()-b.getMonth()<0 || (t.getMonth()===b.getMonth()&&t.getDate()<b.getDate())) a--;
  return a<0||a>150 ? '' : String(a);
};

const pwStrength = pw => {
  if (!pw) return null;
  let s=0;
  if(pw.length>=8)s++; if(pw.length>=12)s++;
  if(/[A-Z]/.test(pw))s++; if(/[0-9]/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
  if(s<=1) return {l:'Weak',   c:'#ef4444', w:20};
  if(s<=2) return {l:'Fair',   c:'#f97316', w:45};
  if(s<=3) return {l:'Good',   c:'#eab308', w:70};
  return         {l:'Strong', c:'#22c55e', w:100};
};

// ── Identity field handler ────────────────────────────────────────────────────
// Enforces correct character types per document:
//   Aadhar  : digits only,          max 12
//   PAN     : AAAAA9999A pattern    max 10  (pos 0-4 = letters, 5-8 = digits, 9 = letter)
//   Passport: 1 letter + 7 digits   max 8
//   Voter ID: letters+digits        max 10
//   DL      : letters+digits+hyphens max 16
const sanitizeIdNumber = (val, idType) => {
  let v = val.toUpperCase();
  switch (idType) {
    case 'Aadhar Card':
      return v.replace(/\D/g, '').slice(0, 12);
    case 'PAN Card': {
      // PAN format: ABCDE1234F
      // positions 0-4 = letters, 5-8 = digits, 9 = letter
      let out = '';
      let raw = v.replace(/[^A-Z0-9]/g, '').slice(0, 10);
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (i <= 4 || i === 9) {
          // must be letter
          if (/[A-Z]/.test(ch)) out += ch;
        } else {
          // must be digit
          if (/[0-9]/.test(ch)) out += ch;
        }
      }
      return out;
    }
    case 'Passport': {
      // Format: 1 letter + 7 digits
      let raw = v.replace(/[^A-Z0-9]/g, '').slice(0, 8);
      let out = '';
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (i === 0) { if (/[A-Z]/.test(ch)) out += ch; }
        else         { if (/[0-9]/.test(ch)) out += ch; }
      }
      return out;
    }
    case 'Voter ID':
      return v.replace(/[^A-Z0-9]/g, '').slice(0, 10);
    case 'Driving License':
      return v.replace(/[^A-Z0-9-]/g, '').slice(0, 16);
    default:
      return v.slice(0, 20);
  }
};

const idPlaceholder = idType => {
  switch (idType) {
    case 'Aadhar Card':      return '12-digit number (e.g. 1234 5678 9012)';
    case 'PAN Card':         return 'ABCDE1234F';
    case 'Passport':         return 'A1234567';
    case 'Voter ID':         return 'ABC1234567';
    case 'Driving License':  return 'MH01-20110012345';
    default:                 return 'Identity number';
  }
};

// ── Input primitives ──────────────────────────────────────────────────────────
const ib  = `w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-700 bg-white placeholder:text-slate-300 outline-none transition-all`;
const in_ = `border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`;
const ie  = `border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100`;
const io  = `border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100`;

const FI = ({err, ok, className='', ...p}) => (
  <input className={`${ib} ${err?ie:ok?io:in_} ${className}`} {...p}/>
);
const FS = ({children, className='', ...p}) => (
  <select className={`${ib} ${in_} ${className}`} {...p}>{children}</select>
);

const FieldWrap = ({label, required, error, hint, children, className=''}) => (
  <div className={className}>
    {label && (
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error && <div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={10}/><span>{error}</span></div>}
    {!error && hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
  </div>
);

const SecHead = ({icon:Icon, title, sub, color='#6366f1'}) => (
  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-50">
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:`${color}15`}}>
      <Icon size={17} style={{color}} strokeWidth={2}/>
    </div>
    <div>
      <h3 className="text-[14px] font-semibold text-slate-700">{title}</h3>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  </div>
);

// ── Phone field ───────────────────────────────────────────────────────────────
const PhoneField = ({code, onCode, val, onChange, err, maxLen=10}) => (
  <div className={`flex rounded-xl border overflow-hidden transition-all focus-within:ring-2
    ${err ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100 bg-red-50'
          : 'border-slate-200 hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-indigo-100'}`}>
    <select value={code} onChange={e=>onCode(e.target.value)}
      className="px-2 bg-slate-50 border-r border-slate-200 text-[12px] text-slate-600 outline-none cursor-pointer py-2.5 min-w-[72px]">
      {['+91','+1','+44','+971','+61','+65','+81','+49'].map(c=><option key={c}>{c}</option>)}
    </select>
    <input value={val}
      onChange={e=>{const v=e.target.value.replace(/\D/g,''); if(v.length<=maxLen) onChange(v);}}
      placeholder={maxLen===10?'9876543210':'Phone number'} inputMode="numeric"
      className="flex-1 px-3 py-2.5 text-[13px] text-slate-700 outline-none bg-white placeholder:text-slate-300"/>
  </div>
);

// ── Status indicator ──────────────────────────────────────────────────────────
const StatusDot = ({status}) => {
  if(!status) return null;
  if(status==='checking')  return <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"/>;
  if(status==='available') return <Check size={14} className="text-emerald-500"/>;
  if(status==='taken')     return <X size={14} className="text-red-500"/>;
  if(status==='unverified')return <AlertCircle size={14} className="text-amber-500"/>;
  return null;
};

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({value, onChange, items, placeholder, onAddNew, addLabel='Add custom', disabled=false, err=false}) {
  const [open,setOpen]       = useState(false);
  const [q,setQ]             = useState('');
  const [addMode,setAddMode] = useState(false);
  const [custom,setCustom]   = useState('');
  const [cursor,setCursor]   = useState(-1);
  const wrapRef=useRef(null); const listRef=useRef(null); const srchRef=useRef(null);

  const filtered     = items.filter(i=>(i.Name??String(i)).toLowerCase().includes(q.toLowerCase()));
  const selected     = (value!==''&&value!=null) ? items.find(i=>String(i.Id??i)===String(value)) : null;
  const displayLabel = selected ? (selected.Name??String(selected)) : (value?String(value):'');

  useEffect(()=>{
    const h=ev=>{if(wrapRef.current&&!wrapRef.current.contains(ev.target)){setOpen(false);setAddMode(false);setQ('');setCursor(-1);}};
    document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h);
  },[]);
  useEffect(()=>{
    if(cursor>=0&&listRef.current){const el=listRef.current.querySelector(`[data-idx="${cursor}"]`);if(el)el.scrollIntoView({block:'nearest'});}
  },[cursor]);
  useEffect(()=>{
    if(open){const t=setTimeout(()=>srchRef.current?.focus(),20);return()=>clearTimeout(t);}
  },[open]);

  const pick = item=>{onChange(item.Id??item, String(item.Name??item));setOpen(false);setQ('');setCursor(-1);};

  return (
    <div ref={wrapRef} className="relative">
      <div onClick={()=>{if(!disabled)setOpen(o=>!o);}} tabIndex={disabled?-1:0}
        onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key==='ArrowDown')){e.preventDefault();setOpen(true);}}}
        className={`${ib} ${err?ie:in_} flex items-center justify-between ${disabled?'opacity-50 cursor-not-allowed':'cursor-pointer'}`}>
        <span className={displayLabel?'text-slate-700':'text-slate-300'} style={{fontSize:13}}>{displayLabel||placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {displayLabel&&!disabled&&(
            <button type="button" onClick={e=>{e.stopPropagation();onChange('','');setQ('');}} className="p-0.5 text-slate-300 hover:text-slate-500">
              <X size={11}/>
            </button>
          )}
          <Search size={12} className="text-slate-400"/>
        </div>
      </div>
      {open&&(
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-[999] overflow-hidden">
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
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
                placeholder="Type to search..."
                className="w-full pl-7 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/>
            </div>
          </div>
          <div ref={listRef} className="max-h-52 overflow-y-auto">
            {filtered.length>0
              ? filtered.map((item,i)=>{
                  const lbl=item.Name??String(item); const isSel=String(item.Id??item)===String(value);
                  return(
                    <div key={i} data-idx={i} onMouseDown={()=>pick(item)} onMouseEnter={()=>setCursor(i)}
                      className={`px-3 py-2.5 text-[13px] cursor-pointer flex items-center justify-between transition-colors
                        ${cursor===i?'bg-indigo-50 text-indigo-700':'text-slate-700 hover:bg-slate-50'}`}>
                      <span>{lbl}</span>{isSel&&<Check size={12} className="text-indigo-500"/>}
                    </div>
                  );
                })
              : <div className="px-3 py-4 text-center">
                  <p className="text-[12px] text-slate-400 mb-2">No results{q?` for "${q}"`:''}</p>
                  {onAddNew&&q.trim()&&(
                    <button onMouseDown={()=>{onAddNew(q.trim());setOpen(false);setQ('');}}
                      className="text-[12px] text-indigo-600 font-semibold flex items-center gap-1 mx-auto hover:underline">
                      <Plus size={11}/>Add "{q}"
                    </button>
                  )}
                </div>
            }
          </div>
          {onAddNew&&filtered.length>0&&(
            <div className="p-2 border-t border-slate-50">
              {!addMode
                ? <button onMouseDown={()=>setAddMode(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-indigo-300 text-[12px] text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Plus size={12}/>{addLabel}
                  </button>
                : <div className="flex gap-2">
                    <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Type name..." autoFocus
                      className="flex-1 px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400"
                      onKeyDown={e=>{
                        if(e.key==='Enter'&&custom.trim()){onAddNew(custom.trim());setAddMode(false);setCustom('');setOpen(false);}
                        if(e.key==='Escape'){setAddMode(false);setCustom('');}
                      }}/>
                    <button onMouseDown={()=>{if(custom.trim()){onAddNew(custom.trim());setAddMode(false);setCustom('');setOpen(false);}}}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-semibold">Add</button>
                  </div>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({step:cur, setStep, branding, primary}) => (
  <aside style={{width:264, background:'#0f172a'}} className="flex-shrink-0 flex flex-col min-h-screen">
    <div className="p-5 border-b border-white/8">
      <div className="flex items-center gap-3">
        {branding?.logoUrl
          ? <img src={branding.logoUrl} alt="logo" className="w-9 h-9 rounded-xl object-contain"/>
          : <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:primary+'30'}}>
              <Activity size={18} style={{color:primary}}/>
            </div>}
        <div>
          <p className="text-white font-bold text-[13px] leading-tight">{branding?.name||'MediCore HMS'}</p>
          <p className="text-white/40 text-[10px] tracking-wider uppercase">Hospital Management</p>
        </div>
      </div>
    </div>
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{background:primary+'20', border:`1px solid ${primary}40`}}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#4ade80'}}/>
        <span className="text-[11px] font-semibold text-white/70 tracking-wider uppercase">New Patient Registration</span>
      </div>
    </div>
    <div className="px-4 flex-1">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 px-1">Registration Steps</p>
      {STEPS.map((s,i)=>{
        const Icon=s.icon; const done=cur>s.id; const active=cur===s.id;
        return(
          <div key={s.id}>
            <div onClick={()=>setStep(s.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1 transition-all cursor-pointer
                ${active?'bg-white/10':'opacity-50 hover:opacity-80 hover:bg-white/5'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${done?'bg-emerald-500':''}`}
                style={!done&&active?{background:primary}:!done?{background:'rgba(255,255,255,0.07)'}:{}}>
                {done?<Check size={14} className="text-white"/>:<Icon size={14} className="text-white"/>}
              </div>
              <div>
                <p className={`text-[13px] ${active?'font-semibold text-white':'font-normal text-white/50'}`}>{s.label}</p>
                <p className="text-[11px] text-white/30">{s.sub}</p>
              </div>
            </div>
            {i<STEPS.length-1&&<div className="ml-7 w-0.5 h-3 mb-1 rounded-full" style={{background:cur>s.id?'#22c55e50':'rgba(255,255,255,0.08)'}}/>}
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
export default function PatientRegisterPage() {
  const {branding} = useHospitalBranding(1);
  const primary = branding?.primaryColor || '#6366f1';

  const [step,setStep]               = useState(1);
  const [showPass,setShowPass]       = useState(false);
  const [showConf,setShowConf]       = useState(false);
  const [loading,setLoading]         = useState(false);
  const [success,setSuccess]         = useState(false);
  const [createdUser,setCreatedUser] = useState('');
  const [errors,setErrors]           = useState({});
  const [parentChoice,setParentChoice] = useState('');
  const [photoPreview,setPhotoPreview] = useState(null);
  const [photoFile,setPhotoFile]       = useState(null);
  const photoRef = useRef(null);

  // Geo
  const [countries,setCountries] = useState([]);
  const [states,setStates]       = useState([]);

  // Realtime checks
  const [unStatus,setUnStatus]       = useState(null);
  const [emailStatus,setEmailStatus] = useState(null);
  const [phoneStatus,setPhoneStatus] = useState(null);
  const unTimer=useRef(null); const emailTimer=useRef(null); const phoneTimer=useRef(null);

  // Payment
  const [payMethod,setPayMethod] = useState('card');
  const [payLater,setPayLater]   = useState(false);
  const [card,setCard] = useState({number:'',expiry:'',cvv:'',name:''});
  const [upiId,setUpiId] = useState('');
  const [bank,setBank]  = useState({name:'',account:'',ifsc:''});

  const [form,setForm] = useState({
    firstName:'', lastName:'', dob:'', gender:'', bloodGroup:'',
    maritalStatus:'', religion:'', occupation:'', dateOfArrival:'',
    fatherName:'', husbandName:'',
    mobile:'', mobileCode:'+91', email:'',
    street1:'', street2:'', city:'',
    countryId:'', countryName:'', stateId:'', stateName:'', pincodeText:'',
    emFirstName:'', emLastName:'', emAge:'', emBloodGroup:'', emRelation:'', emPhone:'', emCode:'+91',
    username:'', password:'', confirmPassword:'',
    insurance:'', policyNo:'', policyExpiry:'',
    idType:'', idNumber:'',
    allergies:'', pastSurgery:'no', pastSurgeryDetails:'', diseases:'', additionalNotes:'',
  });

  const set = useCallback((k,v)=>{
    setForm(f=>({...f,[k]:v}));
    setErrors(e=>({...e,[k]:''}));
  },[]);

  const FALLBACK_COUNTRIES = [
    {Id:-1,Name:'India'},{Id:-2,Name:'United States'},{Id:-3,Name:'United Kingdom'},
    {Id:-4,Name:'UAE'},{Id:-5,Name:'Australia'},{Id:-6,Name:'Singapore'},
    {Id:-7,Name:'Canada'},{Id:-8,Name:'Germany'},{Id:-9,Name:'France'},
    {Id:-10,Name:'Japan'},{Id:-11,Name:'China'},{Id:-12,Name:'Nepal'},
    {Id:-13,Name:'Bangladesh'},{Id:-14,Name:'Pakistan'},{Id:-15,Name:'Sri Lanka'},
  ];

  const isFallback = id => !id || String(id).startsWith('custom_') || Number(id)<0;

  // Load countries
  useEffect(()=>{
    fetch('/api/v1/geo/countries').then(r=>r.json())
      .then(r=>{const d=r.data??r??[];setCountries(Array.isArray(d)&&d.length?d:FALLBACK_COUNTRIES);})
      .catch(()=>setCountries(FALLBACK_COUNTRIES));
  },[]);

  // Load states on country change
  useEffect(()=>{
    setStates([]);
    if(isFallback(form.countryId)) return;
    fetch(`/api/v1/geo/countries/${form.countryId}/states`).then(r=>r.json())
      .then(r=>setStates(r.data??r??[])).catch(()=>{});
  },[form.countryId]);

  // ── Realtime checks ────────────────────────────────────────────────────────
  const handleUsername = v=>{
    const clean=v.replace(/[^a-z0-9_.-]/g,'').toLowerCase();
    setForm(f=>({...f,username:clean})); setErrors(e=>({...e,username:''})); setUnStatus(null);
    if(unTimer.current) clearTimeout(unTimer.current);
    if(!clean||clean.length<3) return;
    setUnStatus('checking');
    unTimer.current=setTimeout(async()=>{
      try{
        const r=await fetch('/api/v1/register/check-username?username='+encodeURIComponent(clean));
        const data=await r.json(); const avail=data?.data?.available??data?.available;
        setUnStatus(avail===true?'available':avail===false?'taken':'unverified');
        if(avail===false) setErrors(e=>({...e,username:'Username already taken'}));
      }catch{setUnStatus(null);}
    },500);
  };

  const handleEmail = v=>{
    set('email',v); setEmailStatus(null);
    if(emailTimer.current) clearTimeout(emailTimer.current);
    if(!v.trim()||!/\S+@\S+\.\S+/.test(v)) return;
    setEmailStatus('checking');
    emailTimer.current=setTimeout(async()=>{
      try{
        const r=await fetch('/api/v1/register/check-email?email='+encodeURIComponent(v.trim()));
        const data=await r.json(); const avail=data?.data?.available??data?.available;
        setEmailStatus(avail===true?'available':avail===false?'taken':null);
        if(avail===false) setErrors(e=>({...e,email:'Email already registered'}));
      }catch{setEmailStatus(null);}
    },600);
  };

  const handlePhone = v=>{
    set('mobile',v); setPhoneStatus(null);
    if(phoneTimer.current) clearTimeout(phoneTimer.current);
    if(v.length<10) return;
    setPhoneStatus('checking');
    phoneTimer.current=setTimeout(async()=>{
      try{
        const r=await fetch('/api/v1/register/check-phone?phone='+encodeURIComponent(v));
        const data=await r.json(); const avail=data?.data?.available??data?.available;
        setPhoneStatus(avail===true?'available':avail===false?'taken':null);
        if(avail===false) setErrors(e=>({...e,mobile:'Mobile already registered'}));
      }catch{setPhoneStatus(null);}
    },600);
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = ()=>{
    const e={};
    if(step===1){
      if(!form.firstName.trim())  e.firstName = 'Required';
      if(!form.lastName.trim())   e.lastName  = 'Required';
      if(!form.gender)            e.gender    = 'Required';
      if(!form.mobile)            e.mobile    = 'Required';
      else if(form.mobile.length!==10) e.mobile = 'Must be 10 digits';
      else if(phoneStatus==='taken')   e.mobile = 'Already registered';
      if(!form.email.trim())      e.email = 'Required';
      else if(!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
      else if(emailStatus==='taken') e.email = 'Already registered';
      if(!form.street1.trim())    e.street1   = 'Required';
      if(!form.city.trim())       e.city      = 'Required';
      if(!form.countryId)         e.countryId = 'Required';
      if(form.pincodeText&&!/^\d{6}$/.test(form.pincodeText)) e.pincodeText = 'Must be 6 digits';
      if(!form.username.trim())   e.username  = 'Required';
      else if(form.username.length<4)  e.username = 'Min 4 characters';
      else if(unStatus==='taken')      e.username = 'Already taken';
      if(!form.password)          e.password  = 'Required';
      else if(form.password.length<8)  e.password = 'Min 8 characters';
      else if(!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Need uppercase, lowercase, number';
      if(form.password!==form.confirmPassword) e.confirmPassword = 'Do not match';
    }
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleNext = ()=>{if(validate()) setStep(s=>s+1);};
  const handleBack = ()=>setStep(s=>s-1);

  // ── Submit — sends JSON, uses FormData only when photo is attached ──────────
  const handleSubmit = async()=>{
    setLoading(true);
    try{
      const payload = {
        hospitalId:       1,
        firstName:        form.firstName,
        lastName:         form.lastName,
        gender:           form.gender           || undefined,
        dateOfBirth:      form.dob              || undefined,
        bloodGroup:       form.bloodGroup        || undefined,
        maritalStatus:    form.maritalStatus     || undefined,
        religion:         form.religion          || undefined,
        occupation:       form.occupation        || undefined,
        dateOfArrival:    form.dateOfArrival     || undefined,
        fatherName:       form.fatherName        || undefined,
        husbandName:      form.husbandName       || undefined,
        phone:            form.mobile,
        phoneCountryCode: form.mobileCode,
        email:            form.email             || undefined,
        street1:          form.street1,
        street2:          form.street2           || undefined,
        city:             form.city,
        pincodeText:      form.pincodeText       || undefined,
        countryId:        form.countryId         || undefined,
        stateId:          form.stateId           || undefined,
        emergencyName:    [form.emFirstName,form.emLastName].filter(Boolean).join(' ') || undefined,
        emergencyRelation:form.emRelation        || undefined,
        emergencyPhone:   form.emPhone           || undefined,
        knownAllergies:   form.allergies         || undefined,
        chronicConditions:form.diseases          || undefined,
        pastSurgery:      form.pastSurgery,
        pastSurgeryDetails: form.pastSurgeryDetails || undefined,
        additionalNotes:  form.additionalNotes   || undefined,
        insuranceProvider:form.insurance         || undefined,
        insurancePolicyNo:form.policyNo          || undefined,
        insuranceValidUntil: form.policyExpiry   || undefined,
        idType:           form.idType            || undefined,
        idNumber:         form.idNumber          || undefined,
        username:         form.username,
        password:         form.password,
      };

      // Strip undefined/null/empty values
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([,v]) => v !== undefined && v !== null && v !== '')
      );

      let res;
      if (photoFile) {
        // Photo attached — use multipart
        const fd = new FormData();
        Object.entries(clean).forEach(([k,v]) => fd.append(k, String(v)));
        fd.append('photo', photoFile);
        res = await api.post('/register/patient', fd, {headers:{'Content-Type':'multipart/form-data'}});
      } else {
        // No photo — use JSON (always works without multer)
        res = await api.post('/register/patient', clean);
      }

      setCreatedUser(res.data?.data?.username || form.username);
      setSuccess(true);
    } catch(err) {
      const errs = err.response?.data?.errors;
      const msg  = errs
        ? errs.map(e => `${e.path||e.param}: ${e.msg}`).join(' | ')
        : err.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg, {duration: 6000});
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if(success) return(
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:'#f8faff'}}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={40} className="text-emerald-500"/>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Registration Successful!</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">Your patient account has been created. Please log in to access the portal.</p>
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100 text-left">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Your Login Username</p>
          <p className="font-mono font-bold text-slate-700 text-lg">{createdUser}</p>
        </div>
        <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm" style={{background:primary}}>
          Go to Login<ChevronRight size={16}/>
        </Link>
      </div>
    </div>
  );

  const pct     = Math.round(((step-1)/STEPS.length)*100);
  const str     = pwStrength(form.password);
  const pwMatch = form.confirmPassword ? form.password===form.confirmPassword : null;

  return(
    <div className="min-h-screen flex" style={{background:'#f8faff'}}>
      <div className="hidden md:flex">
        <Sidebar step={step} setStep={setStep} branding={branding} primary={primary}/>
      </div>

      <div className="flex-1 flex flex-col min-h-screen overflow-auto">

        {/* ── Header ── */}
        <header className="bg-white border-b border-slate-100 px-6 lg:px-10 py-4 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-[18px] font-bold text-slate-800">Patient Registration</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Step {step} of {STEPS.length} — {STEPS[step-1].label}</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {STEPS.map((s,i)=>(
              <div key={s.id} className="flex items-center gap-2">
                <div onClick={()=>setStep(s.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer hover:scale-105
                    ${step>s.id?'bg-emerald-500 text-white':step===s.id?'text-white':'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  style={step===s.id?{background:primary}:{}}>
                  {step>s.id?<Check size={13}/>:s.id}
                </div>
                {i<STEPS.length-1&&<div className="w-8 h-0.5 rounded-full" style={{background:step>s.id?'#22c55e':'#e2e8f0'}}/>}
              </div>
            ))}
            <span className="ml-2 text-[12px] text-slate-400 font-medium">{pct}%</span>
          </div>
        </header>

        <main className="flex-1 px-6 lg:px-10 py-6">

          {/* ══════════════════════════════════════════════════════════════
              STEP 1 — Account Details
          ══════════════════════════════════════════════════════════════ */}
          {step===1&&(
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* Patient Details */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={User} title="Patient Details" sub="Personal information" color={primary}/>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FieldWrap label="First Name" required error={errors.firstName}>
                        <FI err={!!errors.firstName} value={form.firstName}
                          onChange={e=>set('firstName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="John"/>
                      </FieldWrap>
                      <FieldWrap label="Last Name" required error={errors.lastName}>
                        <FI err={!!errors.lastName} value={form.lastName}
                          onChange={e=>set('lastName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Doe"/>
                      </FieldWrap>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <FieldWrap label="Date of Birth" className="col-span-2">
                        <FI type="date" value={form.dob} min={minDOB} max={todayStr}
                          onChange={e=>{if(e.target.value<=todayStr) set('dob',e.target.value);}}/>
                      </FieldWrap>
                      <FieldWrap label="Age">
                        <FI value={calcAge(form.dob)} disabled placeholder="—" className="bg-slate-50 text-slate-500 cursor-not-allowed"/>
                      </FieldWrap>
                      <FieldWrap label="Gender" required error={errors.gender}>
                        <FS value={form.gender} onChange={e=>set('gender',e.target.value)}
                          style={errors.gender?{borderColor:'#f87171',background:'#fef2f2'}:{}}>
                          <option value="">—</option>
                          {GENDERS.map(g=><option key={g}>{g}</option>)}
                        </FS>
                      </FieldWrap>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <FieldWrap label="Blood Group">
                        <FS value={form.bloodGroup} onChange={e=>set('bloodGroup',e.target.value)}>
                          <option value="">—</option>{BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                        </FS>
                      </FieldWrap>
                      <FieldWrap label="Marital Status">
                        <FS value={form.maritalStatus} onChange={e=>set('maritalStatus',e.target.value)}>
                          <option value="">—</option>{MARITAL.map(m=><option key={m}>{m}</option>)}
                        </FS>
                      </FieldWrap>
                      <FieldWrap label="Religion">
                        <FI value={form.religion}
                          onChange={e=>set('religion',e.target.value.replace(/[^A-Za-z\s]/g,''))}
                          placeholder="Hindu"/>
                      </FieldWrap>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Occupation — letters only */}
                      <FieldWrap label="Occupation">
                        <FI value={form.occupation}
                          onChange={e=>set('occupation',e.target.value.replace(/[^A-Za-z\s]/g,''))}
                          placeholder="Engineer"/>
                      </FieldWrap>
                      <FieldWrap label="Date of Arrival" error={errors.dateOfArrival} hint="Up to 3 years in past">
                        <FI type="date" err={!!errors.dateOfArrival} value={form.dateOfArrival}
                          min={minArrival} max={todayStr}
                          onChange={e=>{
                            const v=e.target.value; set('dateOfArrival',v);
                            if(v&&v<minArrival) setErrors(er=>({...er,dateOfArrival:'Cannot be more than 3 years ago'}));
                          }}/>
                      </FieldWrap>
                    </div>

                    {/* Father / Husband toggle */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Parent / Spouse</label>
                      <div className="flex gap-2 mb-2">
                        {[{k:'father',l:"Father's Name"},{k:'husband',l:"Husband's Name"}].map(o=>(
                          <button key={o.k} type="button"
                            onClick={()=>{setParentChoice(pc=>pc===o.k?'':o.k);set('fatherName','');set('husbandName','');}}
                            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-all
                              ${parentChoice===o.k?'text-white border-transparent':'text-slate-500 border-slate-200 hover:border-slate-300 bg-white'}`}
                            style={parentChoice===o.k?{background:primary}:{}}>
                            {o.l}
                          </button>
                        ))}
                      </div>
                      {parentChoice==='father'  &&<FI value={form.fatherName}  onChange={e=>set('fatherName', e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Father's full name"/>}
                      {parentChoice==='husband' &&<FI value={form.husbandName} onChange={e=>set('husbandName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Husband's full name"/>}
                    </div>

                    <FieldWrap label="Mobile" required error={errors.mobile}>
                      <PhoneField code={form.mobileCode} onCode={v=>set('mobileCode',v)} val={form.mobile} onChange={handlePhone} err={!!errors.mobile||phoneStatus==='taken'}/>
                      {phoneStatus==='checking' &&<div className="text-slate-400 text-[11px] mt-1 flex items-center gap-1"><div className="w-2.5 h-2.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>Checking...</div>}
                      {phoneStatus==='taken'    &&<div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={10}/>Already registered</div>}
                      {phoneStatus==='available'&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={10}/>Available</div>}
                    </FieldWrap>

                    <FieldWrap label="Email" required error={errors.email}>
                      <div className="relative">
                        <FI type="email" err={!!errors.email||emailStatus==='taken'} ok={emailStatus==='available'}
                          value={form.email} onChange={e=>handleEmail(e.target.value)}
                          placeholder="john@example.com" className="pr-8"/>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2"><StatusDot status={emailStatus}/></div>
                      </div>
                      {emailStatus==='taken'&&<div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={10}/>Already registered</div>}
                    </FieldWrap>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={Shield} title="Emergency Contact" sub="Relative or guardian" color="#ef4444"/>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FieldWrap label="First Name">
                        <FI value={form.emFirstName} onChange={e=>set('emFirstName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Name"/>
                      </FieldWrap>
                      <FieldWrap label="Last Name">
                        <FI value={form.emLastName} onChange={e=>set('emLastName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Name"/>
                      </FieldWrap>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldWrap label="Age">
                        <FI type="number" value={form.emAge} min={0} max={120} placeholder="30"
                          onChange={e=>{const v=parseInt(e.target.value);if(!isNaN(v)&&v>=0&&v<=120)set('emAge',String(v));else if(e.target.value==='')set('emAge','');}}/>
                      </FieldWrap>
                      <FieldWrap label="Blood Group">
                        <FS value={form.emBloodGroup} onChange={e=>set('emBloodGroup',e.target.value)}>
                          <option value="">—</option>{BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                        </FS>
                      </FieldWrap>
                    </div>
                    <FieldWrap label="Relation">
                      <FI value={form.emRelation} onChange={e=>set('emRelation',e.target.value)} placeholder="e.g. Father, Spouse"/>
                    </FieldWrap>
                    <FieldWrap label="Phone">
                      <PhoneField code={form.emCode} onCode={v=>set('emCode',v)} val={form.emPhone} onChange={v=>set('emPhone',v)}/>
                    </FieldWrap>
                  </div>
                </div>
              </div>

              {/* Row 2: Address + Credentials */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* Residential Address */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={MapPin} title="Residential Address" sub="Current place of residence" color="#8b5cf6"/>
                  <div className="space-y-3">
                    <FieldWrap label="Street Line 1" required error={errors.street1}>
                      <FI err={!!errors.street1} value={form.street1} onChange={e=>set('street1',e.target.value)} placeholder="Building no., Street name"/>
                    </FieldWrap>
                    <FI value={form.street2} onChange={e=>set('street2',e.target.value)} placeholder="Area, Landmark (optional — Street Line 2)"/>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldWrap label="Country" required error={errors.countryId}>
                        <SearchSelect value={form.countryId} items={countries}
                          placeholder={countries.length?'Select country':'Loading...'}
                          onAddNew={name=>{
                            const fid='custom_'+Date.now();
                            setCountries(p=>[...p,{Id:fid,Name:name}]);
                            set('countryId',fid); set('countryName',name);
                            set('stateId',''); set('stateName',''); set('pincodeText','');
                          }}
                          addLabel="Add country manually"
                          onChange={(id,name)=>{
                            set('countryId',id); set('countryName',name);
                            set('stateId',''); set('stateName',''); set('pincodeText','');
                          }}/>
                        {errors.countryId&&<div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.countryId}</div>}
                      </FieldWrap>
                      <FieldWrap label="State / Province">
                        {isFallback(form.countryId)
                          ?<FI value={form.stateName}
                              onChange={e=>{set('stateName',e.target.value);set('stateId','custom_state');}}
                              placeholder="Type state / province"/>
                          :<SearchSelect value={form.stateId} items={states}
                              placeholder={form.countryId?'Select state':'Pick country first'}
                              disabled={!form.countryId}
                              onAddNew={name=>{set('stateName',name);set('stateId','custom_state');}}
                              addLabel="Add state manually"
                              onChange={(id,name)=>{set('stateId',id);set('stateName',name);set('pincodeText','');}}/>}
                      </FieldWrap>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      <FieldWrap label="City" required error={errors.city} className="col-span-3">
                        <FI err={!!errors.city} value={form.city}
                          onChange={e=>set('city',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Mumbai"/>
                      </FieldWrap>
                      <FieldWrap label="Pincode" error={errors.pincodeText} hint="6 digits" className="col-span-2">
                        <FI err={!!errors.pincodeText} value={form.pincodeText}
                          onChange={e=>set('pincodeText',e.target.value.replace(/\D/g,'').slice(0,6))}
                          placeholder="400001" inputMode="numeric" maxLength={6} className="font-mono tracking-wider"/>
                      </FieldWrap>
                    </div>
                  </div>
                </div>

                {/* Account Credentials */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={Lock} title="Account Credentials" sub="Your login username and password" color="#0ea5e9"/>
                  <div className="space-y-3">
                    <FieldWrap label="Username" required error={errors.username}>
                      <div className="relative">
                        <FI err={!!errors.username||unStatus==='taken'} ok={unStatus==='available'}
                          value={form.username} onChange={e=>handleUsername(e.target.value)}
                          placeholder="Choose a username" className="pr-8"/>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2"><StatusDot status={unStatus}/></div>
                      </div>
                      {unStatus==='available'&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={10}/>Available</div>}
                      {unStatus==='taken'    &&<div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={10}/>Already taken</div>}
                    </FieldWrap>

                    <FieldWrap label="Password" required error={errors.password}>
                      <div className="relative">
                        <FI type={showPass?'text':'password'} err={!!errors.password}
                          value={form.password} onChange={e=>set('password',e.target.value)}
                          placeholder="Create a strong password" className="pr-10"/>
                        <button type="button" onClick={()=>setShowPass(s=>!s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPass?<EyeOff size={14}/>:<Eye size={14}/>}
                        </button>
                      </div>
                      {form.password&&str&&(
                        <div className="mt-1.5">
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all" style={{width:`${str.w}%`,background:str.c}}/>
                          </div>
                          <span className="text-[11px] font-semibold" style={{color:str.c}}>{str.l}</span>
                        </div>
                      )}
                    </FieldWrap>

                    <FieldWrap label="Confirm Password" required error={errors.confirmPassword}>
                      <div className="relative">
                        <FI type={showConf?'text':'password'} err={!!errors.confirmPassword} ok={pwMatch===true}
                          value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)}
                          placeholder="Re-enter password" className="pr-10"/>
                        <button type="button" onClick={()=>setShowConf(s=>!s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showConf?<EyeOff size={14}/>:<Eye size={14}/>}
                        </button>
                      </div>
                      {pwMatch===true&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={10}/>Passwords match</div>}
                    </FieldWrap>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 2 — Medical Details
          ══════════════════════════════════════════════════════════════ */}
          {step===2&&(
            <div className="space-y-5 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Insurance Details */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={Shield} title="Insurance Details" sub="Health insurance information" color="#0ea5e9"/>
                  <div className="space-y-3">
                    <FieldWrap label="Insurance Company">
                      <SearchSelect value={form.insurance} items={INSURANCE_LIST}
                        placeholder="Select insurance company"
                        onChange={(id,label)=>set('insurance',label)}
                        onAddNew={name=>set('insurance',name)} addLabel="Add other company"/>
                    </FieldWrap>
                    <FieldWrap label="Policy Number">
                      <FI value={form.policyNo} onChange={e=>set('policyNo',e.target.value)} placeholder="e.g. SHI123456789"/>
                    </FieldWrap>
                    <FieldWrap label="Policy Valid Until">
                      <FI type="date" value={form.policyExpiry} onChange={e=>set('policyExpiry',e.target.value)} min={todayStr}/>
                    </FieldWrap>
                  </div>
                </div>

                {/* Identity & Photo */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <SecHead icon={Camera} title="Identity & Photo" sub="Click photo circle to upload" color="#8b5cf6"/>
                  <div className="flex items-center gap-4 mb-4">
                    <div onClick={()=>photoRef.current?.click()}
                      className="w-16 h-16 rounded-full flex-shrink-0 cursor-pointer border-2 overflow-hidden flex items-center justify-center relative group"
                      style={{borderColor:photoPreview?primary:'#e2e8f0',background:photoPreview?'transparent':'#f8fafc'}}>
                      {photoPreview
                        ?<img src={photoPreview} alt="Patient" className="w-full h-full object-cover"/>
                        :<User size={24} className="text-slate-400"/>}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                        <Camera size={14} className="text-white"/>
                      </div>
                    </div>
                    <input ref={photoRef} type="file" accept="image/*"
                      onChange={e=>{const f=e.target.files[0];if(f){setPhotoPreview(URL.createObjectURL(f));setPhotoFile(f);}}}
                      className="hidden"/>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-700">{photoPreview?'Photo uploaded ✓':'Patient Photo'}</p>
                      <p className="text-[11px] text-slate-400">{photoPreview?'Click to change':'Click circle to upload'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <FieldWrap label="Identity Type">
                      <FS value={form.idType} onChange={e=>{set('idType',e.target.value);set('idNumber','');}}>
                        <option value="">Select document type</option>
                        {IDENTITY_DOCS.map(d=><option key={d}>{d}</option>)}
                      </FS>
                    </FieldWrap>
                    {form.idType&&(
                      <FieldWrap label="Identity Number"
                        hint={
                          form.idType==='Aadhar Card' ? 'Digits only — 12 characters' :
                          form.idType==='PAN Card'    ? 'Format: ABCDE1234F (5 letters, 4 digits, 1 letter)' :
                          form.idType==='Passport'    ? 'Format: 1 letter + 7 digits' :
                          form.idType==='Voter ID'    ? 'Letters and digits — up to 10 characters' :
                          'Letters, digits and hyphens'
                        }>
                        <FI value={form.idNumber}
                          onChange={e=>set('idNumber', sanitizeIdNumber(e.target.value, form.idType))}
                          placeholder={idPlaceholder(form.idType)}
                          className="font-mono tracking-wider uppercase"
                          inputMode={
                            form.idType==='Aadhar Card' ? 'numeric' :
                            form.idType==='Passport' && form.idNumber.length >= 1 ? 'numeric' : 'text'
                          }
                        />
                      </FieldWrap>
                    )}
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <SecHead icon={Heart} title="Medical History" sub="Current conditions and relevant health background" color="#ef4444"/>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <FieldWrap label="Known Allergies">
                      <textarea value={form.allergies} onChange={e=>set('allergies',e.target.value)}
                        className={`${ib} ${in_} resize-none`} rows={3} placeholder="e.g. Penicillin, Pollen, Dust..."/>
                    </FieldWrap>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Past Surgery?</label>
                      <div className="flex gap-2">
                        {['yes','no'].map(opt=>(
                          <button key={opt} type="button"
                            onClick={()=>{set('pastSurgery',opt);if(opt==='no')set('pastSurgeryDetails','');}}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-[13px] font-medium select-none
                              ${form.pastSurgery===opt?'text-white border-transparent':'text-slate-600 border-slate-200 hover:border-slate-300'}`}
                            style={form.pastSurgery===opt?{background:primary}:{}}>
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.pastSurgery===opt?'border-white':'border-slate-400'}`}>
                              {form.pastSurgery===opt&&<div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                            </div>
                            {opt==='yes'?'Yes':'No'}
                          </button>
                        ))}
                      </div>
                      {form.pastSurgery==='yes'&&(
                        <textarea value={form.pastSurgeryDetails} onChange={e=>set('pastSurgeryDetails',e.target.value)}
                          className={`${ib} ${in_} resize-none mt-2`} rows={2} placeholder="Describe past surgeries..."/>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <FieldWrap label="Known Diseases">
                      <FI value={form.diseases} onChange={e=>set('diseases',e.target.value)} placeholder="e.g. Diabetes, Hypertension"/>
                    </FieldWrap>
                    <FieldWrap label="Additional Notes">
                      <textarea value={form.additionalNotes} onChange={e=>set('additionalNotes',e.target.value)}
                        className={`${ib} ${in_} resize-none`} rows={4} placeholder="Anything else the doctor should know..."/>
                    </FieldWrap>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 3 — Payment
          ══════════════════════════════════════════════════════════════ */}
          {step===3&&(
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="rounded-2xl p-5 flex items-center justify-between" style={{background:'linear-gradient(135deg,#0f172a,#1e3a5f)'}}>
                <div>
                  <p className="text-white/50 text-[11px] uppercase tracking-widest mb-1">Registration Fee</p>
                  <p className="text-white font-bold text-4xl tracking-tight">₹200<span className="text-white/40 text-[14px] font-normal ml-2">one-time</span></p>
                  <p className="text-white/30 text-[11px] mt-1">Non-refundable patient registration fee</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)'}}>
                  <Lock size={11} style={{color:'#4ade80'}}/>
                  <span className="text-[11px] font-semibold" style={{color:'#4ade80'}}>Secure Payment</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Payment Method</p>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map(m=>{
                      const Icon=m.icon; const sel=payMethod===m.id&&!payLater;
                      return(
                        <button key={m.id} onClick={()=>{setPayMethod(m.id);setPayLater(false);}}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                            ${sel?'border-indigo-400 bg-indigo-50':'border-slate-200 hover:border-slate-300'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sel?'bg-indigo-100':'bg-slate-50'}`}>
                            <Icon size={15} className={sel?'text-indigo-600':'text-slate-400'}/>
                          </div>
                          <span className={`text-[13px] font-medium ${sel?'text-indigo-700':'text-slate-600'}`}>{m.label}</span>
                          {sel&&<Check size={14} className="ml-auto text-indigo-600 flex-shrink-0"/>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-700">Pay Later</p>
                        <p className="text-[11px] text-slate-400">Pay at hospital</p>
                      </div>
                      <div onClick={()=>setPayLater(p=>!p)} className="cursor-pointer"
                        style={{width:38,height:22,borderRadius:11,background:payLater?primary:'#e2e8f0',position:'relative',transition:'background 0.2s'}}>
                        <div style={{position:'absolute',top:3,left:payLater?18:3,width:16,height:16,borderRadius:'50%',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left 0.2s'}}/>
                      </div>
                    </div>
                    {payLater&&<p className="mt-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">⚠ Payment due before first consultation</p>}
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  {payLater?(
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                      <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center mb-3">
                        <span className="text-2xl">⏰</span>
                      </div>
                      <p className="font-semibold text-slate-700 mb-1">Pay Later Selected</p>
                      <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">Payment of ₹200 must be cleared before your first consultation.</p>
                    </div>
                  ):payMethod==='card'?(
                    <div className="space-y-4">
                      <p className="text-[14px] font-semibold text-slate-700 mb-2">Card Details</p>
                      <FieldWrap label="Card Number">
                        <FI value={card.number}
                          onChange={e=>{const v=e.target.value.replace(/\D/g,'').slice(0,16);setCard(c=>({...c,number:v.replace(/(.{4})/g,'$1 ').trim()}));}}
                          placeholder="0000 0000 0000 0000" className="font-mono tracking-widest" maxLength={19}/>
                      </FieldWrap>
                      <div className="grid grid-cols-2 gap-3">
                        <FieldWrap label="Expiry Date">
                          <FI value={card.expiry}
                            onChange={e=>{let v=e.target.value.replace(/\D/g,'').slice(0,4);if(v.length>=3)v=v.slice(0,2)+'/'+v.slice(2);setCard(c=>({...c,expiry:v}));}}
                            placeholder="MM / YY" maxLength={5}/>
                        </FieldWrap>
                        <FieldWrap label="CVV">
                          <FI type="password" value={card.cvv}
                            onChange={e=>setCard(c=>({...c,cvv:e.target.value.replace(/\D/g,'').slice(0,3)}))}
                            placeholder="•••" maxLength={3} className="tracking-widest"/>
                        </FieldWrap>
                      </div>
                      <FieldWrap label="Name on Card">
                        <FI value={card.name} onChange={e=>setCard(c=>({...c,name:e.target.value.replace(/[^A-Za-z\s]/g,'')}))} placeholder="As printed on card"/>
                      </FieldWrap>
                      <div className="flex gap-2 pt-1">
                        {['VISA','MC','RuPay','Maestro'].map(t=>(
                          <div key={t} className="px-2.5 py-1 rounded-md border border-slate-200 text-[10px] font-bold text-slate-500">{t}</div>
                        ))}
                      </div>
                    </div>
                  ):payMethod==='upi'?(
                    <div className="space-y-4">
                      <p className="text-[14px] font-semibold text-slate-700 mb-2">UPI Details</p>
                      <FieldWrap label="UPI ID">
                        <FI value={upiId} onChange={e=>setUpiId(e.target.value)} placeholder="name@okicici"/>
                      </FieldWrap>
                      <div className="p-3 bg-slate-50 rounded-xl text-[12px] text-slate-500 border border-slate-100">
                        Accepted: <strong>@okicici</strong>, <strong>@oksbi</strong>, <strong>@paytm</strong>, <strong>@upi</strong>
                      </div>
                    </div>
                  ):(
                    <div className="space-y-4">
                      <p className="text-[14px] font-semibold text-slate-700 mb-2">Net Banking Details</p>
                      <FieldWrap label="Bank Name">
                        <FI value={bank.name} onChange={e=>setBank(b=>({...b,name:e.target.value.replace(/[^A-Za-z\s]/g,'')}))} placeholder="e.g. State Bank of India"/>
                      </FieldWrap>
                      <FieldWrap label="Account Number">
                        <FI value={bank.account} onChange={e=>setBank(b=>({...b,account:e.target.value.replace(/\D/g,'').slice(0,18)}))} placeholder="Account number" inputMode="numeric"/>
                      </FieldWrap>
                      <FieldWrap label="IFSC Code">
                        <FI value={bank.ifsc} onChange={e=>setBank(b=>({...b,ifsc:e.target.value.replace(/[^A-Z0-9]/g,'').toUpperCase().slice(0,11)}))} placeholder="e.g. SBIN0001234" className="font-mono uppercase"/>
                      </FieldWrap>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={14} className="text-slate-400 flex-shrink-0"/>
                  <p className="text-[12px] text-slate-500">
                    By completing registration you agree to our{' '}
                    <span className="text-indigo-600 cursor-pointer">Terms of Service</span> and{' '}
                    <span className="text-indigo-600 cursor-pointer">Privacy Policy</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                  <CheckCircle size={13} className="text-emerald-500"/>
                  <span className="text-[11px] font-semibold text-emerald-600">256-bit SSL Encrypted</span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Footer nav ── */}
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
              ?<button onClick={handleNext} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm hover:opacity-90 transition-all" style={{background:primary}}>
                  Save & Continue<ArrowRight size={14}/>
                </button>
              :<button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm disabled:opacity-60" style={{background:primary}}>
                  {loading
                    ?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Registering...</>
                    :<><CheckCircle size={15}/>Complete Registration</>}
                </button>}
          </div>
        </footer>
      </div>
    </div>
  );
}