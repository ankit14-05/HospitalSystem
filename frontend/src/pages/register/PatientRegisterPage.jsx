// src/pages/register/PatientRegisterPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle, ArrowLeft, ArrowRight, User,
  FileText, CreditCard, Activity, Shield, Heart, MapPin,
  Camera, ChevronRight, AlertCircle, Check, X, Search, Plus,
  Lock, Smartphone, Building2, Mail, RefreshCw, Globe, PenLine,
  PanelLeftClose, PanelLeftOpen, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── Constants ─────────────────────────────────────────────────────────────────
const BLOOD_GROUPS   = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS        = [
  'Male','Female','Non-binary','Transgender Male','Transgender Female',
  'Genderqueer','Genderfluid','Agender','Intersex','Two-Spirit','Prefer not to say'
];
const MARITAL        = ['Single','Married','Divorced','Widowed','Separated','In a relationship'];
const RELIGIONS      = [
  'Prefer not to say','No Religion / Atheist','Agnostic',
  'Hindu','Muslim','Christian','Sikh','Buddhist','Jain',
  'Jewish','Zoroastrian / Parsi','Baháʼí',
  'Shinto','Taoism','Confucianism','Other'
];
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

const STEP1_TABS = [
  { id:'personal',    label:'Personal',          icon: User   },
  { id:'address',     label:'Address',           icon: MapPin },
  { id:'emergency',   label:'Emergency',         icon: Shield },
  { id:'credentials', label:'Contact & Account', icon: Lock   },
];

const STEP2_TABS = [
  { id:'insurance',  label:'Insurance',  icon: Shield  },
  { id:'identity',   label:'Identity',   icon: FileText},
  { id:'medical',    label:'Medical',    icon: Heart   },
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

const sanitizeIdNumber = (val, idType) => {
  let v = val.toUpperCase();
  switch (idType) {
    case 'Aadhar Card':  return v.replace(/\D/g, '').slice(0, 12);
    case 'PAN Card': {
      let out='', raw=v.replace(/[^A-Z0-9]/g,'').slice(0,10);
      for(let i=0;i<raw.length;i++){const ch=raw[i];if(i<=4||i===9){if(/[A-Z]/.test(ch))out+=ch;}else{if(/[0-9]/.test(ch))out+=ch;}}
      return out;
    }
    case 'Passport': {
      let raw=v.replace(/[^A-Z0-9]/g,'').slice(0,8), out='';
      for(let i=0;i<raw.length;i++){const ch=raw[i];if(i===0){if(/[A-Z]/.test(ch))out+=ch;}else{if(/[0-9]/.test(ch))out+=ch;}}
      return out;
    }
    case 'Voter ID':        return v.replace(/[^A-Z0-9]/g,'').slice(0,10);
    case 'Driving License': return v.replace(/[^A-Z0-9-]/g,'').slice(0,16);
    default:                return v.slice(0,20);
  }
};

const idPlaceholder = idType => {
  switch (idType) {
    case 'Aadhar Card':     return '12-digit number';
    case 'PAN Card':        return 'ABCDE1234F';
    case 'Passport':        return 'A1234567';
    case 'Voter ID':        return 'ABC1234567';
    case 'Driving License': return 'MH01-20110012345';
    default:                return 'Identity number';
  }
};

// ── Shared input styles ───────────────────────────────────────────────────────
const inputBase = `w-full px-3.5 py-2 rounded-lg border text-[14px] text-slate-800 bg-white placeholder:text-slate-400 outline-none transition-all`;
const inputNorm = `border-slate-200 hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100`;
const inputErr  = `border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100`;
const inputOk   = `border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100`;

const FI = ({err, ok, className='', ...p}) => (
  <input className={`${inputBase} ${err?inputErr:ok?inputOk:inputNorm} ${className}`} {...p}/>
);

// ── Select with chevron wrapper ───────────────────────────────────────────────
const SelectField = ({ children, err=false, className='', ...p }) => (
  <div className="relative">
    <select
      className={`${inputBase} ${err?inputErr:inputNorm} ${className} appearance-none cursor-pointer pr-9`}
      {...p}
    >
      {children}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/>
  </div>
);

const FL = ({label, required, error, hint, children, className=''}) => (
  <div className={className}>
    {label && (
      <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error && <div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={10}/><span>{error}</span></div>}
    {!error && hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
  </div>
);

// ── Phone field ───────────────────────────────────────────────────────────────
const PhoneField = ({code, onCode, val, onChange, err, maxLen=10, compact=false}) => (
  <div className={`flex rounded-lg border overflow-hidden transition-all focus-within:ring-2
    ${err ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100 bg-red-50'
          : 'border-slate-200 hover:border-purple-300 focus-within:border-purple-500 focus-within:ring-purple-100'}`}>
    <select value={code} onChange={e=>onCode(e.target.value)}
      className={`bg-slate-50 border-r border-slate-200 text-[13px] text-slate-700 outline-none cursor-pointer py-2.5 ${compact ? 'px-1.5 min-w-[58px]' : 'px-2.5 min-w-[70px]'}`}>
      {['+91','+1','+44','+971','+61','+65','+81','+49'].map(c=><option key={c}>{c}</option>)}
    </select>
    <input value={val}
      onChange={e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.startsWith('0')) v = v.replace(/^0+/, '');
        if (v.length <= maxLen) onChange(v);
      }}
      placeholder={maxLen===10 ? '9876543210' : 'Phone'}
      inputMode="numeric"
      className="flex-1 px-3 py-2.5 text-[14px] text-slate-800 outline-none bg-white placeholder:text-slate-400 min-w-0"
    />
  </div>
);

// ── Status indicator ──────────────────────────────────────────────────────────
const StatusDot = ({status}) => {
  if(!status) return null;
  if(status==='checking')  return <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin"/>;
  if(status==='available') return <Check size={14} className="text-emerald-500"/>;
  if(status==='taken')     return <X size={14} className="text-red-500"/>;
  if(status==='unverified')return <AlertCircle size={14} className="text-amber-500"/>;
  return null;
};

// ── GeoSelect ─────────────────────────────────────────────────────────────────
function GeoSelect({ value, onChange, items, placeholder, loading=false, disabled=false, err=false, onAddManually, addLabel='Add manually' }) {
  const [open, setOpen]           = useState(false);
  const [q, setQ]                 = useState('');
  const [cursor, setCursor]       = useState(-1);
  const [addMode, setAddMode]     = useState(false);
  const [manualVal, setManualVal] = useState('');
  const wrapRef=useRef(null); const listRef=useRef(null); const srchRef=useRef(null); const manualRef=useRef(null);

  const filtered     = items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
  const selected     = items.find(i => i.code === value || i.name === value);
  const displayLabel = selected ? selected.name : (value?.startsWith('manual_') ? value.replace('manual_','').replace(/_/g,' ') : (value || ''));

  useEffect(() => {
    const h = ev => { if (wrapRef.current && !wrapRef.current.contains(ev.target)) { setOpen(false); setAddMode(false); setQ(''); setCursor(-1); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => { if (open && !addMode) { const t = setTimeout(() => srchRef.current?.focus(), 30); return () => clearTimeout(t); } }, [open, addMode]);
  useEffect(() => { if (addMode) { const t = setTimeout(() => manualRef.current?.focus(), 30); return () => clearTimeout(t); } }, [addMode]);
  useEffect(() => { if (cursor >= 0 && listRef.current) { const el = listRef.current.querySelector(`[data-idx="${cursor}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); } }, [cursor]);

  const pick = item => { onChange(item.code || item.name, item.name); setOpen(false); setQ(''); setCursor(-1); };
  const submitManual = () => { const v = manualVal.trim(); if (!v) return; onAddManually?.(v); onChange('manual_' + v.toLowerCase().replace(/\s+/g, '_'), v); setAddMode(false); setManualVal(''); setOpen(false); };

  return (
    <div ref={wrapRef} className="relative">
      <div onClick={() => { if (!disabled) setOpen(o => !o); }} tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === 'ArrowDown')) { e.preventDefault(); setOpen(true); } }}
        className={`${inputBase} ${err ? inputErr : inputNorm} flex items-center justify-between gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {selected?.flag && <span className="text-[16px] leading-none flex-shrink-0">{selected.flag}</span>}
          <span className={`truncate ${displayLabel ? 'text-slate-800' : 'text-slate-400'}`} style={{ fontSize: 14 }}>
            {loading ? 'Loading…' : displayLabel || placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {displayLabel && !disabled && (
            <button type="button" onClick={e => { e.stopPropagation(); onChange('', ''); setQ(''); }}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
              <X size={8} className="text-slate-500" />
            </button>
          )}
          {loading ? <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-purple-500 rounded-full animate-spin" />
            : <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>}
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-[999] mt-1 rounded-xl overflow-hidden"
          style={{ background:'#fff', border:'1px solid #e8eaf0', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.07),0 16px 48px -8px rgba(0,0,0,0.14)' }}>
          <div className="px-2.5 pt-2.5 pb-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              <input ref={srchRef} value={q} onChange={e => { setQ(e.target.value); setCursor(-1); }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setOpen(false); setQ(''); return; }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(p => Math.min(p+1, filtered.length-1)); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(p => Math.max(p-1, 0)); return; }
                  if (e.key === 'Enter') { e.preventDefault(); if (cursor >= 0 && filtered[cursor]) { pick(filtered[cursor]); return; } if (filtered.length === 1) pick(filtered[0]); }
                }}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg outline-none border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 180, scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((item, i) => {
              const isSel = item.code === value || item.name === value;
              return (
                <div key={i} data-idx={i} onMouseDown={e => { e.preventDefault(); pick(item); }} onMouseEnter={() => setCursor(i)}
                  className="px-3 py-2 mx-1.5 mb-0.5 rounded-lg cursor-pointer flex items-center gap-2 transition-all select-none"
                  style={{ background: isSel ? '#f3f0ff' : cursor === i ? '#f8faff' : 'transparent', color: isSel ? '#7c3aed' : '#334155' }}>
                  {item.flag && <span className="text-[14px]">{item.flag}</span>}
                  <span className="flex-1 truncate text-[13px] font-medium">{item.name}</span>
                  {isSel && <Check size={11} className="text-purple-600 flex-shrink-0" />}
                </div>
              );
            }) : (
              <div className="px-3 py-5 text-center">
                <p className="text-[12px] text-slate-400">No results. Use "Add manually" below.</p>
              </div>
            )}
          </div>
          {onAddManually !== false && (
            <div className="p-2" style={{ borderTop: '1px solid #f1f5f9' }}>
              {!addMode ? (
                <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setAddMode(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left border border-dashed border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-400">
                  <PenLine size={12} className="text-purple-600" />
                  <span className="text-[12px] font-semibold text-purple-600">{addLabel}</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <input ref={manualRef} type="text" value={manualVal} onChange={e => setManualVal(e.target.value)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && manualVal.trim()) submitManual(); if (e.key === 'Escape') { setAddMode(false); setManualVal(''); } }}
                    placeholder="Type name…"
                    className="flex-1 px-2.5 py-2 text-[13px] rounded-lg border border-purple-300 outline-none focus:ring-2 focus:ring-purple-100" />
                  <button type="button" onMouseDown={e => { e.preventDefault(); submitManual(); }} disabled={!manualVal.trim()}
                    className="px-3 py-2 rounded-lg text-[12px] font-bold text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>Add</button>
                  <button type="button" onMouseDown={e => { e.preventDefault(); setAddMode(false); setManualVal(''); }}
                    className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={13} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({value, onChange, items, placeholder, onAddNew, addLabel='Add custom', disabled=false, err=false}) {
  const [open,setOpen]       = useState(false);
  const [q,setQ]             = useState('');
  const [addMode,setAddMode] = useState(false);
  const [custom,setCustom]   = useState('');
  const [cursor,setCursor]   = useState(-1);
  const wrapRef=useRef(null); const listRef=useRef(null); const srchRef=useRef(null);

  const isStr = typeof items[0] === 'string';
  const filtered = isStr
    ? items.filter(i => i.toLowerCase().includes(q.toLowerCase()))
    : items.filter(i=>(i.Name??String(i)).toLowerCase().includes(q.toLowerCase()));
  const selected = isStr
    ? (value ? items.find(i => i === value) : null)
    : ((value!==''&&value!=null) ? items.find(i=>String(i.Id??i)===String(value)) : null);
  const displayLabel = isStr
    ? (value || '')
    : (selected ? (selected.Name??String(selected)) : (value?String(value):''));

  useEffect(()=>{
    const h=ev=>{if(wrapRef.current&&!wrapRef.current.contains(ev.target)){setOpen(false);setAddMode(false);setQ('');setCursor(-1);}};
    document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h);
  },[]);
  useEffect(()=>{if(cursor>=0&&listRef.current){const el=listRef.current.querySelector(`[data-idx="${cursor}"]`);if(el)el.scrollIntoView({block:'nearest'});}}, [cursor]);
  useEffect(()=>{if(open){const t=setTimeout(()=>srchRef.current?.focus(),20);return()=>clearTimeout(t);}}, [open]);

  const pick = item=>{
    if (isStr) { onChange(item, item); }
    else { onChange(item.Id??item, String(item.Name??item)); }
    setOpen(false);setQ('');setCursor(-1);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div onClick={()=>{if(!disabled)setOpen(o=>!o);}} tabIndex={disabled?-1:0}
        onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key==='ArrowDown')){e.preventDefault();setOpen(true);}}}
        className={`${inputBase} ${err?inputErr:inputNorm} flex items-center justify-between ${disabled?'opacity-50 cursor-not-allowed':'cursor-pointer'}`}>
        <span className={displayLabel?'text-slate-800':'text-slate-400'} style={{fontSize:14}}>{displayLabel||placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {displayLabel&&!disabled&&(<button type="button" onClick={e=>{e.stopPropagation();onChange('','');setQ('');}} className="p-0.5 text-slate-300 hover:text-slate-500"><X size={11}/></button>)}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>
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
                  if(e.key==='Enter'){e.preventDefault();if(cursor>=0&&filtered[cursor]){pick(filtered[cursor]);return;}if(filtered.length===1){pick(filtered[0]);return;}if(!filtered.length&&q.trim()&&onAddNew){onAddNew(q.trim());setOpen(false);setQ('');}}
                }}
                placeholder="Type to search..."
                className="w-full pl-7 pr-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"/>
            </div>
          </div>
          <div ref={listRef} className="max-h-44 overflow-y-auto">
            {filtered.length>0 ? filtered.map((item,i)=>{
              const lbl = isStr ? item : (item.Name??String(item));
              const isSel = isStr ? item === value : String(item.Id??item)===String(value);
              return(<div key={i} data-idx={i} onMouseDown={()=>pick(item)} onMouseEnter={()=>setCursor(i)}
                className={`px-3 py-2.5 text-[13px] cursor-pointer flex items-center justify-between transition-colors ${cursor===i?'bg-purple-50 text-purple-700':'text-slate-700 hover:bg-slate-50'}`}>
                <span>{lbl}</span>{isSel&&<Check size={12} className="text-purple-500"/>}
              </div>);
            }) : (
              <div className="px-3 py-4 text-center">
                <p className="text-[12px] text-slate-400 mb-2">No results{q?` for "${q}"`:''}</p>
                {onAddNew&&q.trim()&&(<button onMouseDown={()=>{onAddNew(q.trim());setOpen(false);setQ('');}} className="text-[12px] text-purple-600 font-semibold flex items-center gap-1 mx-auto hover:underline"><Plus size={11}/>Add "{q}"</button>)}
              </div>
            )}
          </div>
          {onAddNew&&filtered.length>0&&(
            <div className="p-2 border-t border-slate-50">
              {!addMode
                ? <button onMouseDown={()=>setAddMode(true)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-purple-300 text-[12px] text-purple-600 hover:bg-purple-50 transition-colors"><Plus size={12}/>{addLabel}</button>
                : <div className="flex gap-2">
                    <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Type name..." autoFocus
                      className="flex-1 px-2.5 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-purple-400"
                      onKeyDown={e=>{if(e.key==='Enter'&&custom.trim()){onAddNew(custom.trim());setAddMode(false);setCustom('');setOpen(false);}if(e.key==='Escape'){setAddMode(false);setCustom('');}}}/>
                    <button onMouseDown={()=>{if(custom.trim()){onAddNew(custom.trim());setAddMode(false);setCustom('');setOpen(false);}}} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-[12px] font-semibold">Add</button>
                  </div>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Email OTP Modal ───────────────────────────────────────────────────────────
function EmailOtpModal({ email, onVerified, onClose, primary }) {
  const [otp, setOtp]             = useState(['','','','','','']);
  const [sending, setSending]     = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError]         = useState('');
  const [resendCool, setResendCool] = useState(0);
  const inputRefs = [useRef(null),useRef(null),useRef(null),useRef(null),useRef(null),useRef(null)];
  const timerRef  = useRef(null);
  const sentRef   = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    sendOtp();
    return () => clearInterval(timerRef.current);
  }, []);

  const startCooldown = (secs = 60) => {
    setResendCool(secs);
    timerRef.current = setInterval(() => {
      setResendCool(p => { if (p <= 1) { clearInterval(timerRef.current); return 0; } return p - 1; });
    }, 1000);
  };

  const sendOtp = async () => {
    setSending(true); setError('');
    try {
      await api.post('/register/send-email-otp', { email });
      startCooldown(60);
      toast.success('OTP sent to ' + email);
    } catch(err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally { setSending(false); }
  };

  const handleChange = (idx, val) => {
    const v = val.replace(/\D/g, '');
    const next = [...otp]; next[idx] = v.slice(-1); setOtp(next); setError('');
    if (v && idx < 5) inputRefs[idx + 1].current?.focus();
  };
  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs[idx - 1].current?.focus();
    if (e.key === 'ArrowLeft'  && idx > 0) inputRefs[idx - 1].current?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputRefs[idx + 1].current?.focus();
  };
  const handlePaste = e => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split('')); inputRefs[5].current?.focus(); }
    e.preventDefault();
  };
  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setVerifying(true); setError('');
    try {
      await api.post('/register/verify-email-otp', { email, otp: code });
      toast.success('Email verified!');
      onVerified();
    } catch(err) {
      setError(err.response?.data?.message || 'Invalid OTP.');
      setOtp(['','','','','','']); inputRefs[0].current?.focus();
    } finally { setVerifying(false); }
  };
  const filled = otp.every(d => d !== '');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative">
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${primary}, #8b5cf6)` }} />
        <div className="p-7">
          <button onClick={onClose} className="absolute top-5 right-5 w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
            <X size={14} />
          </button>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${primary}20`, border: `2px solid ${primary}30` }}>
            <Mail size={22} style={{ color: primary }} />
          </div>
          <h2 className="text-[17px] font-bold text-slate-800 text-center mb-1">Verify your email</h2>
          <p className="text-[12px] text-slate-500 text-center mb-5 leading-relaxed">
            6-digit code sent to<br/><span className="font-semibold text-slate-700 text-[13px]">{email}</span>
          </p>
          <div className="flex gap-2 justify-center mb-4" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input key={idx} ref={inputRefs[idx]} value={digit} maxLength={1} inputMode="numeric"
                onChange={e => handleChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onFocus={e => e.target.select()}
                className={`w-10 h-12 text-center text-[18px] font-bold rounded-xl border-2 outline-none transition-all
                  ${error ? 'border-red-300 bg-red-50 text-red-600' : digit ? 'bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-800 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:bg-white'}`}
                style={digit && !error ? { borderColor: primary, background: `${primary}10`, color: primary } : {}}
              />
            ))}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
              <AlertCircle size={13} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          <button onClick={handleVerify} disabled={!filled || verifying}
            className="w-full py-2.5 rounded-xl text-white text-[14px] font-bold mb-3 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: filled && !verifying ? `linear-gradient(135deg, ${primary}, #8b5cf6)` : '#94a3b8' }}>
            {verifying ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</> : <><Check size={14}/>Verify Email</>}
          </button>
          <div className="text-center">
            {resendCool > 0
              ? <p className="text-[12px] text-slate-400">Resend in <span className="font-bold tabular-nums" style={{ color: primary }}>{resendCool}s</span></p>
              : <button onClick={sendOtp} disabled={sending}
                  className="text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all hover:opacity-80" style={{ color: primary }}>
                  <RefreshCw size={12} className={sending ? 'animate-spin' : ''} />
                  {sending ? 'Sending...' : 'Resend code'}
                </button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
function TabNav({ tabs, active, onChange, primary }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <button key={tab.id} type="button" onClick={() => onChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[12px] font-semibold transition-all"
            style={isActive
              ? { background: '#fff', color: primary, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: '#94a3b8' }}>
            <Icon size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PatientRegisterPage() {
  const {branding} = useHospitalBranding(1);
  const primary = branding?.primaryColor || '#7c3aed';

  const [step,setStep]               = useState(1);
  const [tab1,setTab1]               = useState('personal');
  const [tab2,setTab2]               = useState('insurance');
  const [showPass,setShowPass]       = useState(false);
  const [showConf,setShowConf]       = useState(false);
  const [loading,setLoading]         = useState(false);
  const [success,setSuccess]         = useState(false);
  const [createdUser,setCreatedUser] = useState('');
  const [createdPatientId,setCreatedPatientId] = useState('');
  const [errors,setErrors]           = useState({});
  const [parentChoice,setParentChoice] = useState('');
  const [photoPreview,setPhotoPreview] = useState(null);
  const [photoFile,setPhotoFile]       = useState(null);
  const [sidebarOpen, setSidebarOpen]  = useState(true);
  const photoRef = useRef(null);

  const [showOtpModal,setShowOtpModal] = useState(false);
  const [emailVerified,setEmailVerified] = useState(false);
  const [countries,setCountries]         = useState([]);
  const [states,setStates]               = useState([]);
  const [countriesLoading,setCountriesLoading] = useState(false);
  const [statesLoading,setStatesLoading]       = useState(false);

  // ── NEW: pincode lookup state ─────────────────────────────────────────────
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeInfo, setPincodeInfo]       = useState(null); // { area, district, state }
  const [pincodeError, setPincodeError]     = useState('');

  const [unStatus,setUnStatus]   = useState(null);
  const [emailStatus,setEmailStatus] = useState(null);
  const unTimer=useRef(null); const emailTimer=useRef(null);
  const [payMethod,setPayMethod] = useState('card');
  const [payLater,setPayLater]   = useState(false);
  const [card,setCard] = useState({number:'',expiry:'',cvv:'',name:''});
  const [upiId,setUpiId] = useState('');
  const [bank,setBank]  = useState({name:'',account:'',ifsc:''});
  const [customReligion, setCustomReligion] = useState('');

  const [form,setForm] = useState({
    firstName:'', lastName:'', dob:'', gender:'', bloodGroup:'',
    maritalStatus:'', religion:'', occupation:'', dateOfArrival:'',
    fatherName:'', husbandName:'',
    mobile:'', mobileCode:'+91', email:'',
    street1:'', street2:'', city:'',
    countryCode:'', countryName:'', stateName:'', pincode:'',
    emFirstName:'', emLastName:'', emAge:'', emBloodGroup:'', emRelation:'', emPhone:'', emCode:'+91',
    username:'', password:'', confirmPassword:'',
    insurance:'', policyNo:'', policyExpiry:'',
    idType:'', idNumber:'',
    allergies:'', pastSurgery:'no', pastSurgeryDetails:'', diseases:'', additionalNotes:'',
  });

  const set = useCallback((k,v)=>{ setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:''})); },[]);

  // ── Geo: countries (ISO 3-letter codes via restcountries.com) ────────────
  useEffect(() => {
    setCountriesLoading(true);
    fetch('https://restcountries.com/v3.1/all?fields=name,cca3,flag')
      .then(r => r.json())
      .then(data => {
        const sorted = data
          .map(c => ({ code: c.cca3, name: c.name.common, flag: c.flag || '' }))
          .sort((a, b) => {
            if (a.code === 'IND') return -1;
            if (b.code === 'IND') return 1;
            return a.name.localeCompare(b.name);
          });
        setCountries(sorted);
      })
      .catch(() => setCountries([
        {code:'IND',name:'India',flag:'🇮🇳'},{code:'USA',name:'United States',flag:'🇺🇸'},
        {code:'GBR',name:'United Kingdom',flag:'🇬🇧'},{code:'ARE',name:'UAE',flag:'🇦🇪'},
        {code:'AUS',name:'Australia',flag:'🇦🇺'},{code:'SGP',name:'Singapore',flag:'🇸🇬'},
        {code:'CAN',name:'Canada',flag:'🇨🇦'},{code:'DEU',name:'Germany',flag:'🇩🇪'},
      ]))
      .finally(() => setCountriesLoading(false));
  }, []);

  // ── Geo: states via countriesnow.space ───────────────────────────────────
  useEffect(() => {
    setStates([]); setStatesLoading(false);
    if (!form.countryName) return;
    setStatesLoading(true);
    fetch('https://countriesnow.space/api/v0.1/countries/states', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: form.countryName }),
    })
      .then(r => r.json())
      .then(data => {
        const sl = data?.data?.states || [];
        setStates(sl.map(s => ({ code: s.state_code || s.name, name: s.name, flag: '' })));
      })
      .catch(() => setStates([]))
      .finally(() => setStatesLoading(false));
  }, [form.countryName]);

  // ── NEW: India pincode auto-fill via api.postalpincode.in ────────────────
  // Fires when pincode reaches 6 digits AND country is India (IND)
  const pincodeTimer = useRef(null);
  useEffect(() => {
    setPincodeInfo(null);
    setPincodeError('');

    if (pincodeTimer.current) clearTimeout(pincodeTimer.current);

    // Only auto-fill for India
    if (!form.pincode || form.pincode.length !== 6 || form.countryCode !== 'IND') return;

    setPincodeLoading(true);
    pincodeTimer.current = setTimeout(() => {
      fetch(`https://api.postalpincode.in/pincode/${form.pincode}`)
        .then(r => r.json())
        .then(data => {
          const result = data?.[0];
          if (result?.Status === 'Success' && result.PostOffice?.length > 0) {
            const po = result.PostOffice[0];
            const district = po.District || '';
            const state    = po.State    || '';
            const area     = po.Name     || '';

            // Auto-fill city (district) and state
            setForm(f => ({
              ...f,
              city:      district || f.city,
              stateName: state    || f.stateName,
            }));
            setErrors(e => ({ ...e, city: '', stateName: '' }));
            setPincodeInfo({ area, district, state, officeCount: result.PostOffice.length });
            toast.success(`📍 ${district}, ${state}`, { duration: 3000 });
          } else {
            setPincodeError('Pincode not found');
          }
        })
        .catch(() => setPincodeError('Could not verify pincode'))
        .finally(() => setPincodeLoading(false));
    }, 400);

    return () => clearTimeout(pincodeTimer.current);
  }, [form.pincode, form.countryCode]);

  const handleUsername = v => {
    const clean = v.replace(/[^a-z0-9_.-]/g,'').toLowerCase();
    setForm(f=>({...f,username:clean})); setErrors(e=>({...e,username:''})); setUnStatus(null);
    if (unTimer.current) clearTimeout(unTimer.current);
    if (!clean || clean.length < 3) return;
    setUnStatus('checking');
    unTimer.current = setTimeout(async () => {
      try {
        const r = await api.get('/register/check-username?username='+encodeURIComponent(clean));
        const avail = r?.data?.available ?? r?.available;
        setUnStatus(avail===true?'available':avail===false?'taken':'unverified');
        if (avail===false) setErrors(e=>({...e,username:'Username already taken'}));
      } catch { setUnStatus(null); }
    }, 500);
  };

  const handleEmail = v => {
    set('email', v);
    setEmailVerified(false);
    setEmailStatus(null);
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (!v.trim() || !/\S+@\S+\.\S+/.test(v)) return;
    setEmailStatus('checking');
    emailTimer.current = setTimeout(async () => {
      try {
        const r = await api.get('/register/check-email?email='+encodeURIComponent(v.trim()));
        const avail = r?.data?.available ?? r?.available;
        setEmailStatus(avail===true?'available':avail===false?'taken':null);
        if (avail===false) setErrors(e=>({...e,email:'Email already registered'}));
      } catch { setEmailStatus(null); }
    }, 600);
  };

  const validate = () => {
    const e = {};
    if (step===1) {
      if (!form.firstName.trim()) e.firstName = 'Required';
      if (!form.lastName.trim())  e.lastName  = 'Required';
      if (!form.gender)           e.gender    = 'Required';
      if (!form.mobile)           e.mobile    = 'Required';
      else if (form.mobile.length !== 10) e.mobile = 'Must be 10 digits';
      if (!form.email.trim())     e.email = 'Required';
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
      else if (emailStatus === 'taken') e.email = 'Already registered';
      else if (!emailVerified) e.email = 'Please verify email';
      if (!form.street1.trim())   e.street1   = 'Required';
      if (!form.city.trim())      e.city      = 'Required';
      if (!form.countryCode)      e.countryCode = 'Required';
      if (form.pincode && !/^\d{6}$/.test(form.pincode)) e.pincode = '6 digits';
      if (!form.username.trim())  e.username  = 'Required';
      else if (form.username.length < 4) e.username = 'Min 4 chars';
      else if (unStatus === 'taken') e.username = 'Already taken';
      if (!form.password)         e.password  = 'Required';
      else if (form.password.length < 8) e.password = 'Min 8 chars';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Need upper, lower, number';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'No match';
    }
    setErrors(e);
    if (step === 1) {
      if (e.firstName || e.lastName || e.gender) setTab1('personal');
      else if (e.mobile || e.email) setTab1('credentials');
      else if (e.street1 || e.city || e.countryCode || e.pincode) setTab1('address');
      else if (e.username || e.password || e.confirmPassword) setTab1('credentials');
    }
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) setStep(s=>s+1); };
  const handleBack = () => setStep(s=>s-1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        hospitalId:1, firstName:form.firstName, lastName:form.lastName,
        gender:form.gender||undefined, dateOfBirth:form.dob||undefined,
        bloodGroup:form.bloodGroup||undefined, maritalStatus:form.maritalStatus||undefined,
        religion:form.religion||undefined, occupation:form.occupation||undefined,
        dateOfArrival:form.dateOfArrival||undefined, fatherName:form.fatherName||undefined,
        husbandName:form.husbandName||undefined, phone:form.mobile,
        phoneCountryCode:form.mobileCode, email:form.email||undefined,
        street1:form.street1, street2:form.street2||undefined, city:form.city,
        pincode:form.pincode||undefined, countryCode:form.countryCode||undefined,
        countryName:form.countryName||undefined, stateName:form.stateName||undefined,
        emergencyName:[form.emFirstName,form.emLastName].filter(Boolean).join(' ')||undefined,
        emergencyRelation:form.emRelation||undefined, emergencyPhone:form.emPhone||undefined,
        knownAllergies:form.allergies||undefined, chronicConditions:form.diseases||undefined,
        pastSurgery:form.pastSurgery, pastSurgeryDetails:form.pastSurgeryDetails||undefined,
        additionalNotes:form.additionalNotes||undefined, insuranceProvider:form.insurance||undefined,
        insurancePolicyNo:form.policyNo||undefined, insuranceValidUntil:form.policyExpiry||null,
        idType:form.idType||undefined, idNumber:form.idNumber||undefined,
        username:form.username, password:form.password,
      };
      const clean = Object.fromEntries(Object.entries(payload).filter(([,v]) => v !== undefined && v !== ''));
      let res;
      if (photoFile) {
        const fd = new FormData();
        Object.entries(clean).forEach(([k,v]) => fd.append(k, String(v)));
        fd.append('photo', photoFile);
        res = await api.post('/register/patient', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        res = await api.post('/register/patient', clean);
      }
      setCreatedUser(res.data?.data?.username || form.username);
      setCreatedPatientId(res.data?.data?.patientId || '');
      setSuccess(true);
    } catch(err) {
      const errs = err.response?.data?.errors;
      const msg = errs ? errs.map(e => `${e.path||e.param}: ${e.msg}`).join(' | ') : err.response?.data?.message || 'Registration failed.';
      toast.error(msg, { duration: 6000 });
    } finally { setLoading(false); }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Registration Successful!</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Your patient account has been created. A confirmation email has been sent to <strong>{form.email}</strong>.
        </p>
        <div className="space-y-3 mb-6">
          {createdPatientId && (
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-100 text-left">
              <p className="text-[11px] text-purple-500 uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5"><Shield size={10}/>Patient ID</p>
              <p className="font-mono font-bold text-purple-700 text-xl tracking-widest">{createdPatientId}</p>
              <p className="text-[11px] text-purple-400 mt-1">Use this ID for all hospital visits</p>
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-left">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Login Username</p>
            <p className="font-mono font-bold text-slate-700 text-lg">{createdUser}</p>
          </div>
        </div>
        <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm" style={{ background: primary }}>
          Go to Login<ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );

  const str     = pwStrength(form.password);
  const pwMatch = form.confirmPassword ? form.password===form.confirmPassword : null;

  const allReligions = customReligion && !RELIGIONS.includes(customReligion)
    ? [...RELIGIONS, customReligion]
    : RELIGIONS;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%)' }}>
      {showOtpModal && (
        <EmailOtpModal email={form.email} primary={primary}
          onVerified={() => { setEmailVerified(true); setShowOtpModal(false); setErrors(e=>({...e,email:''})); }}
          onClose={() => setShowOtpModal(false)}
        />
      )}

      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex flex-col flex-shrink-0 relative overflow-hidden transition-all duration-300"
        style={{
          width: sidebarOpen ? 272 : 56,
          background: 'linear-gradient(160deg,#1e0a3c 0%,#2d1165 50%,#1a0a35 100%)'
        }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle,#a855f7,transparent)' }}/>
          <div className="absolute bottom-10 -right-10 w-48 h-48 rounded-full opacity-15" style={{ background: 'radial-gradient(circle,#6366f1,transparent)' }}/>
        </div>
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="absolute top-4 right-3 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          {sidebarOpen ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}
        </button>
        <div className="relative p-4 pb-3 overflow-hidden">
          <div className={`flex items-center gap-3 mb-4 transition-all duration-300 ${sidebarOpen ? '' : 'justify-center'}`}>
            {branding?.logoUrl
              ? <img src={branding.logoUrl} alt="logo" className="w-9 h-9 rounded-xl object-contain flex-shrink-0"/>
              : <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(168,85,247,0.3)' }}>
                  <Activity size={18} className="text-purple-300"/>
                </div>}
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-white font-bold text-[14px] whitespace-nowrap">{branding?.name||'MediCore HMS'}</p>
                <p className="text-purple-300/60 text-[10px] tracking-widest uppercase whitespace-nowrap">Hospital Management</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4" style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                <span className="text-[10px] font-semibold text-green-400 tracking-wider uppercase">New Patient Registration</span>
              </div>
              <h2 className="text-white text-[20px] font-bold leading-tight mb-1">
                Smarter Hospital<br/>
                <span className="text-purple-300">Operations.</span>
              </h2>
              <p className="text-purple-200/50 text-[11px] leading-relaxed">Unified clinical & administrative workflows for modern healthcare.</p>
            </>
          )}
        </div>
        <div className="relative px-3 flex-1 overflow-hidden">
          {sidebarOpen && <p className="text-[10px] font-bold text-purple-300/50 uppercase tracking-widest mb-3 px-2">Registration Steps</p>}
          {[
            { id:1, label:'Account Details',  sub:'Personal & contact', icon: User       },
            { id:2, label:'Medical Details',  sub:'Insurance & health', icon: FileText   },
            { id:3, label:'Payment',          sub:'Registration fee',   icon: CreditCard },
          ].map((s, i) => {
            const Icon = s.icon; const done = step > s.id; const active = step === s.id;
            return (
              <div key={s.id}>
                <div onClick={() => setStep(s.id)}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 mb-1 transition-all cursor-pointer
                    ${active ? 'bg-white/10' : 'opacity-40 hover:opacity-70 hover:bg-white/5'}
                    ${!sidebarOpen ? 'justify-center px-1' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-emerald-500' : ''}`}
                    style={!done && active ? { background: primary } : !done ? { background: 'rgba(255,255,255,0.08)' } : {}}>
                    {done ? <Check size={14} className="text-white"/> : <Icon size={14} className="text-white"/>}
                  </div>
                  {sidebarOpen && (
                    <div className="min-w-0 overflow-hidden">
                      <p className={`text-[12px] whitespace-nowrap ${active ? 'font-semibold text-white' : 'text-white/50'}`}>{s.label}</p>
                      <p className="text-[10px] text-white/30 whitespace-nowrap">{s.sub}</p>
                    </div>
                  )}
                  {sidebarOpen && active && <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: primary }}/>}
                </div>
                {i < 2 && <div className={`w-0.5 h-3 mb-1 rounded-full ${sidebarOpen ? 'ml-7' : 'mx-auto'}`} style={{ background: step > s.id ? '#22c55e40' : 'rgba(255,255,255,0.06)' }}/>}
              </div>
            );
          })}
        </div>
        {sidebarOpen && (
          <div className="relative p-4 border-t border-white/8">
            <div className="flex items-center gap-2 text-white/20 text-[11px] mb-1"><Lock size={10}/><span>256-bit SSL encrypted</span></div>
            <p className="text-white/15 text-[10px]">© {new Date().getFullYear()} {branding?.name||'MediCore HMS'}</p>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100/50 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="lg:hidden flex items-center gap-2">
              {branding?.logoUrl
                ? <img src={branding.logoUrl} alt="" className="w-7 h-7 rounded-lg object-contain"/>
                : <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: primary }}><Activity size={14} className="text-white"/></div>}
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-slate-800">Patient Registration</h1>
              <p className="text-[11px] text-slate-500">Step {step} of 3</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1,2,3].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div onClick={() => setStep(s)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer hover:scale-110"
                  style={step > s ? { background: '#22c55e', color: '#fff' } : step === s ? { background: primary, color: '#fff' } : { background: '#f1f5f9', color: '#94a3b8' }}>
                  {step > s ? <Check size={12}/> : s}
                </div>
                {i < 2 && <div className="w-8 h-0.5 rounded-full" style={{ background: step > s ? '#22c55e' : '#e2e8f0' }}/>}
              </div>
            ))}
          </div>
          <Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-purple-600 transition-colors">
            <ArrowLeft size={13}/> Login
          </Link>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ddd6fe transparent' }}>

          {/* ════════ STEP 1 ════════ */}
          {step === 1 && (
            <div className="max-w-3xl mx-auto">
              <TabNav tabs={STEP1_TABS} active={tab1} onChange={setTab1} primary={primary} />

              {/* ── Personal ── */}
              {tab1 === 'personal' && (
                <div className="space-y-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 150px 56px' }}>
                    <FL label="First Name" required error={errors.firstName}>
                      <FI err={!!errors.firstName} value={form.firstName}
                        onChange={e=>set('firstName',e.target.value.replace(/[^A-Za-z\s]/g,''))}
                        placeholder="First name"/>
                    </FL>
                    <FL label="Last Name" required error={errors.lastName}>
                      <FI err={!!errors.lastName} value={form.lastName}
                        onChange={e=>set('lastName',e.target.value.replace(/[^A-Za-z\s]/g,''))}
                        placeholder="Last name"/>
                    </FL>
                    <FL label="Date of Birth">
                      <FI type="date" value={form.dob} min={minDOB} max={todayStr}
                        onChange={e=>{ if(e.target.value<=todayStr) set('dob',e.target.value); }}/>
                    </FL>
                    <FL label="Age">
                      <div className={`${inputBase} ${inputNorm} bg-slate-50 text-center text-slate-600 cursor-not-allowed font-semibold px-1`}>
                        {calcAge(form.dob) || '—'}
                      </div>
                    </FL>
                  </div>

                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 110px 1fr 1fr' }}>
                    <FL label="Gender" required error={errors.gender}>
                      <SelectField err={!!errors.gender} value={form.gender} onChange={e=>set('gender',e.target.value)}>
                        <option value="">— Gender —</option>
                        {GENDERS.map(g=><option key={g} value={g}>{g}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Blood Group">
                      <SelectField value={form.bloodGroup} onChange={e=>set('bloodGroup',e.target.value)}>
                        <option value="">—</option>
                        {BLOOD_GROUPS.map(b=><option key={b} value={b}>{b}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Marital Status">
                      <SelectField value={form.maritalStatus} onChange={e=>set('maritalStatus',e.target.value)}>
                        <option value="">— Select —</option>
                        {MARITAL.map(m=><option key={m} value={m}>{m}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Religion">
                      <SearchSelect
                        value={form.religion}
                        items={allReligions}
                        placeholder="— Select or add —"
                        onChange={(id, label) => set('religion', label || id)}
                        onAddNew={name => { setCustomReligion(name); set('religion', name); }}
                        addLabel="Add religion manually"
                      />
                    </FL>
                  </div>

                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 180px' }}>
                    <FL label="Occupation">
                      <FI value={form.occupation} onChange={e=>set('occupation',e.target.value)} placeholder="e.g. Engineer, Teacher"/>
                    </FL>
                    <FL label="Date of Arrival" hint="When first visited (up to 3 yrs)">
                      <FI type="date" value={form.dateOfArrival} min={minArrival} max={todayStr}
                        onChange={e=>set('dateOfArrival',e.target.value)}/>
                    </FL>
                  </div>

                  <FL label="Parent / Spouse Name">
                    <div className="flex gap-2 mb-2.5">
                      {[{k:'father',l:"Father's Name"},{k:'husband',l:"Husband's Name"}].map(o=>(
                        <button key={o.k} type="button"
                          onClick={()=>{setParentChoice(pc=>pc===o.k?'':o.k);set('fatherName','');set('husbandName','');}}
                          className="px-4 py-2 rounded-lg text-[13px] font-semibold border transition-all"
                          style={parentChoice===o.k ? {background:primary,color:'#fff',borderColor:'transparent'} : {background:'#f8fafc',color:'#475569',borderColor:'#e2e8f0'}}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                    {parentChoice==='father'  && <FI value={form.fatherName}  onChange={e=>set('fatherName', e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Father's full name"/>}
                    {parentChoice==='husband' && <FI value={form.husbandName} onChange={e=>set('husbandName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Husband's full name"/>}
                  </FL>
                </div>
              )}

              {/* ── Address ── */}
              {tab1 === 'address' && (
                <div className="space-y-4">
                  <FL label="Street Line 1" required error={errors.street1}>
                    <FI err={!!errors.street1} value={form.street1} onChange={e=>set('street1',e.target.value)} placeholder="Building no., Street name"/>
                  </FL>
                  <FL label="Street Line 2 (optional)">
                    <FI value={form.street2} onChange={e=>set('street2',e.target.value)} placeholder="Area, Landmark"/>
                  </FL>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Country" required error={errors.countryCode}>
                      <GeoSelect value={form.countryCode} items={countries} loading={countriesLoading}
                        placeholder="Select country" onAddManually={()=>{}} addLabel="Add country manually"
                        onChange={(code,name)=>{
                          set('countryCode',code);
                          set('countryName',name);
                          set('stateName','');
                          set('pincode','');
                          setPincodeInfo(null);
                          setPincodeError('');
                        }}
                      />
                      {errors.countryCode && <div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={10}/>{errors.countryCode}</div>}
                    </FL>
                    <FL label="State / Province">
                      {form.countryCode
                        ? <GeoSelect value={form.stateName} items={states} loading={statesLoading}
                            placeholder="Select state" onAddManually={()=>{}} addLabel="Add state manually"
                            onChange={(_code,name)=>{set('stateName',name);}}/>
                        : <FI value="" disabled placeholder="Pick country first" className="opacity-50 cursor-not-allowed"/>}
                    </FL>
                  </div>

                  {/* ── City + Pincode row — with auto-fill feedback ── */}
                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 140px' }}>
                    <FL label="City" required error={errors.city}>
                      <FI err={!!errors.city} value={form.city}
                        onChange={e=>set('city',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Mumbai"/>
                    </FL>
                    <div/>
                    <FL label="Pincode" error={errors.pincode || pincodeError}
                      hint={
                        form.countryCode === 'IND' && !pincodeError && !pincodeInfo
                          ? 'Auto-fills city & state'
                          : undefined
                      }>
                      <div className="relative">
                        <FI
                          err={!!errors.pincode || !!pincodeError}
                          ok={!!pincodeInfo}
                          value={form.pincode}
                          onChange={e => {
                            const v = e.target.value.replace(/\D/g,'').slice(0,6);
                            set('pincode', v);
                            if (v.length < 6) { setPincodeInfo(null); setPincodeError(''); }
                          }}
                          placeholder="400001"
                          inputMode="numeric"
                          maxLength={6}
                          className="font-mono text-center tracking-wider pr-8"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {pincodeLoading
                            ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin"/>
                            : pincodeInfo
                              ? <Check size={14} className="text-emerald-500"/>
                              : pincodeError
                                ? <AlertCircle size={14} className="text-red-400"/>
                                : null}
                        </div>
                      </div>
                      {/* Show auto-filled area name as a success badge */}
                      {pincodeInfo && !pincodeError && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                          <MapPin size={9} className="flex-shrink-0"/>
                          <span className="font-medium truncate">
                            {pincodeInfo.area}{pincodeInfo.area ? ', ' : ''}{pincodeInfo.district}
                            {pincodeInfo.officeCount > 1 && (
                              <span className="text-emerald-400 ml-1">+{pincodeInfo.officeCount - 1} offices</span>
                            )}
                          </span>
                        </div>
                      )}
                    </FL>
                  </div>
                </div>
              )}

              {/* ── Emergency ── */}
              {tab1 === 'emergency' && (
                <div className="space-y-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 140px 100px' }}>
                    <FL label="First Name">
                      <FI value={form.emFirstName}
                        onChange={e=>set('emFirstName',e.target.value.replace(/[^A-Za-z\s]/g,''))}
                        placeholder="First name"/>
                    </FL>
                    <FL label="Last Name">
                      <FI value={form.emLastName}
                        onChange={e=>set('emLastName',e.target.value.replace(/[^A-Za-z\s]/g,''))}
                        placeholder="Last name"/>
                    </FL>
                    <FL label="Relation">
                      <FI value={form.emRelation}
                        placeholder="e.g. Father"
                        onChange={e=>set('emRelation',e.target.value.replace(/[^A-Za-z\s]/g,''))}/>
                    </FL>
                    <FL label="Blood Group">
                      <SelectField value={form.emBloodGroup} onChange={e=>set('emBloodGroup',e.target.value)}>
                        <option value="">—</option>
                        {BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                      </SelectField>
                    </FL>
                  </div>

                  <div className="grid gap-3" style={{ gridTemplateColumns: '220px 80px 1fr' }}>
                    <FL label="Contact Number">
                      <PhoneField code={form.emCode} onCode={v=>set('emCode',v)}
                        val={form.emPhone} onChange={v=>set('emPhone',v)} compact={true}/>
                    </FL>
                    <FL label="Age">
                      <FI type="number" value={form.emAge} min={0} max={120} placeholder="—"
                        onChange={e=>{const v=parseInt(e.target.value);if(!isNaN(v)&&v>=0&&v<=120)set('emAge',String(v));else if(e.target.value==='')set('emAge','');}}
                        className="text-center"/>
                    </FL>
                    <div/>
                  </div>
                </div>
              )}

              {/* ── Contact & Account ── */}
              {tab1 === 'credentials' && (
                <div className="space-y-4">

                  <div className="grid gap-3" style={{ gridTemplateColumns: '260px 1fr' }}>
                    <FL label="Mobile Number" required error={errors.mobile}>
                      <PhoneField code={form.mobileCode} onCode={v=>set('mobileCode',v)} val={form.mobile}
                        onChange={v=>set('mobile',v)} err={!!errors.mobile}/>
                    </FL>

                    <FL label="Email Address" required error={errors.email}>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <FI type="email"
                            err={!!errors.email || emailStatus==='taken'}
                            ok={emailVerified}
                            value={form.email}
                            onChange={e => handleEmail(e.target.value)}
                            placeholder="john@example.com"
                            className="pr-9"/>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {emailVerified ? <Check size={14} className="text-emerald-500"/> : <StatusDot status={emailStatus}/>}
                          </div>
                        </div>
                        {form.email && /\S+@\S+\.\S+/.test(form.email) && emailStatus !== 'taken' && !emailVerified && (
                          <button type="button" onClick={() => setShowOtpModal(true)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all hover:opacity-90 whitespace-nowrap"
                            style={{ background: primary }}>
                            <Mail size={13}/>Verify
                          </button>
                        )}
                      </div>
                      {emailVerified && <div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={10}/>Email verified</div>}
                      {emailStatus==='taken' && <div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={10}/>Already registered</div>}
                      {!emailVerified && form.email && /\S+@\S+\.\S+/.test(form.email) && emailStatus !== 'taken' && (
                        <div className="text-amber-600 text-[11px] mt-1 flex items-center gap-1"><AlertCircle size={10}/>Verification required to proceed</div>
                      )}
                    </FL>
                  </div>

                  <div className="grid gap-3" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <FL label="Username" required error={errors.username}>
                      <div className="relative">
                        <FI err={!!errors.username||unStatus==='taken'} ok={unStatus==='available'}
                          value={form.username} onChange={e=>handleUsername(e.target.value)}
                          placeholder="Choose a username" className="pr-10"/>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2"><StatusDot status={unStatus}/></div>
                      </div>
                      {unStatus==='available' && <div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={10}/>Username available</div>}
                      {unStatus==='taken'     && <div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={10}/>Already taken</div>}
                    </FL>
                    <div/>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Password" required error={errors.password}>
                      <div className="relative">
                        <FI type={showPass?'text':'password'} err={!!errors.password}
                          value={form.password} onChange={e=>set('password',e.target.value)}
                          placeholder="Create a strong password" className="pr-10"/>
                        <button type="button" onClick={()=>setShowPass(s=>!s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
                        </button>
                      </div>
                      {form.password && str && (
                        <div className="mt-1.5">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all" style={{width:`${str.w}%`,background:str.c}}/>
                          </div>
                          <span className="text-[11px] font-semibold" style={{color:str.c}}>{str.l} password</span>
                        </div>
                      )}
                    </FL>

                    <FL label="Confirm Password" required error={errors.confirmPassword}>
                      <div className="relative">
                        <FI type={showConf?'text':'password'} err={!!errors.confirmPassword} ok={pwMatch===true}
                          value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)}
                          placeholder="Re-enter password" className="pr-10"/>
                        <button type="button" onClick={()=>setShowConf(s=>!s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showConf?<EyeOff size={15}/>:<Eye size={15}/>}
                        </button>
                      </div>
                      {pwMatch===true && <div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={10}/>Passwords match</div>}
                    </FL>
                  </div>
                </div>
              )}

              {/* Tab navigation arrows */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-purple-100">
                <button type="button"
                  onClick={() => {
                    const idx = STEP1_TABS.findIndex(t => t.id === tab1);
                    if (idx > 0) setTab1(STEP1_TABS[idx-1].id);
                  }}
                  disabled={tab1 === STEP1_TABS[0].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-slate-600 border border-slate-200 hover:border-purple-300 disabled:opacity-30 transition-all">
                  <ArrowLeft size={13}/>Previous
                </button>
                <div className="flex gap-1.5">
                  {STEP1_TABS.map(t => (
                    <div key={t.id} onClick={() => setTab1(t.id)}
                      className="w-2 h-2 rounded-full cursor-pointer transition-all"
                      style={{ background: t.id === tab1 ? primary : '#ddd6fe' }}/>
                  ))}
                </div>
                <button type="button"
                  onClick={() => {
                    const idx = STEP1_TABS.findIndex(t => t.id === tab1);
                    if (idx < STEP1_TABS.length - 1) setTab1(STEP1_TABS[idx+1].id);
                  }}
                  disabled={tab1 === STEP1_TABS[STEP1_TABS.length-1].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-30 transition-all"
                  style={{ background: primary }}>
                  Next<ArrowRight size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 2 ════════ */}
          {step === 2 && (
            <div className="max-w-3xl mx-auto">
              <TabNav tabs={STEP2_TABS} active={tab2} onChange={setTab2} primary={primary} />

              {tab2 === 'insurance' && (
                <div className="space-y-4">
                  <FL label="Insurance Company">
                    <SearchSelect value={form.insurance} items={INSURANCE_LIST}
                      placeholder="Select insurance company"
                      onChange={(id,label)=>set('insurance',label||id)}
                      onAddNew={name=>set('insurance',name)} addLabel="Add other company"/>
                  </FL>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Policy Number">
                      <FI value={form.policyNo} onChange={e=>set('policyNo',e.target.value)} placeholder="e.g. SHI123456789"/>
                    </FL>
                    <FL label="Policy Valid Until">
                      <FI type="date" value={form.policyExpiry} onChange={e=>set('policyExpiry',e.target.value)} min={todayStr}/>
                    </FL>
                  </div>
                </div>
              )}

              {tab2 === 'identity' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div onClick={()=>photoRef.current?.click()}
                      className="w-16 h-16 rounded-full flex-shrink-0 cursor-pointer border-2 overflow-hidden flex items-center justify-center relative group"
                      style={{borderColor:photoPreview?primary:'#e2e8f0',background:photoPreview?'transparent':'#f8fafc'}}>
                      {photoPreview?<img src={photoPreview} alt="Patient" className="w-full h-full object-cover"/>:<User size={24} className="text-slate-400"/>}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                        <Camera size={14} className="text-white"/>
                      </div>
                    </div>
                    <input ref={photoRef} type="file" accept="image/*"
                      onChange={e=>{const f=e.target.files[0];if(f){setPhotoPreview(URL.createObjectURL(f));setPhotoFile(f);}}} className="hidden"/>
                    <div>
                      <p className="text-[14px] font-semibold text-slate-700">{photoPreview?'Photo uploaded ✓':'Patient Photo'}</p>
                      <p className="text-[12px] text-slate-500">{photoPreview?'Click to change photo':'Click the circle to upload a photo'}</p>
                    </div>
                  </div>

                  <FL label="Identity Document Type">
                    <div className="flex gap-2 flex-wrap">
                      {IDENTITY_DOCS.map(d => (
                        <button key={d} type="button"
                          onClick={()=>{set('idType',d);set('idNumber','');}}
                          className="px-3.5 py-2 rounded-lg text-[13px] font-semibold border transition-all"
                          style={form.idType === d
                            ? { background: primary, color: '#fff', borderColor: 'transparent' }
                            : { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </FL>

                  {form.idType && (
                    <FL label="Identity Number"
                      hint={form.idType==='Aadhar Card'?'12 digits only':form.idType==='PAN Card'?'Format: ABCDE1234F':form.idType==='Passport'?'1 letter + 7 digits':form.idType==='Voter ID'?'Letters & digits, up to 10':'Letters, digits, hyphens'}>
                      <FI value={form.idNumber}
                        onChange={e=>set('idNumber',sanitizeIdNumber(e.target.value,form.idType))}
                        placeholder={idPlaceholder(form.idType)}
                        className="font-mono tracking-wider uppercase"/>
                    </FL>
                  )}
                </div>
              )}

              {tab2 === 'medical' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Known Allergies">
                      <textarea value={form.allergies} onChange={e=>set('allergies',e.target.value)}
                        className={`${inputBase} ${inputNorm} resize-none`} rows={3} placeholder="e.g. Penicillin, Pollen..."/>
                    </FL>
                    <FL label="Known Diseases / Conditions">
                      <FI value={form.diseases} onChange={e=>set('diseases',e.target.value)} placeholder="e.g. Diabetes, Hypertension"/>
                    </FL>
                  </div>

                  <FL label="Past Surgery?">
                    <div className="flex gap-2 mb-2">
                      {['yes','no'].map(v=>(
                        <button key={v} type="button" onClick={()=>{set('pastSurgery',v);if(v==='no')set('pastSurgeryDetails','');}}
                          className="px-5 py-2 rounded-lg text-[13px] font-semibold border transition-all capitalize"
                          style={form.pastSurgery===v ? {background:primary,color:'#fff',borderColor:'transparent'} : {background:'#f8fafc',color:'#475569',borderColor:'#e2e8f0'}}>
                          {v}
                        </button>
                      ))}
                    </div>
                    {form.pastSurgery==='yes' && (
                      <textarea value={form.pastSurgeryDetails} onChange={e=>set('pastSurgeryDetails',e.target.value)}
                        className={`${inputBase} ${inputNorm} resize-none mt-1`} rows={2} placeholder="Describe past surgeries..."/>
                    )}
                  </FL>

                  <FL label="Additional Notes">
                    <textarea value={form.additionalNotes} onChange={e=>set('additionalNotes',e.target.value)}
                      className={`${inputBase} ${inputNorm} resize-none`} rows={3} placeholder="Anything else the doctor should know..."/>
                  </FL>
                </div>
              )}

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-purple-100">
                <button type="button"
                  onClick={() => { const idx = STEP2_TABS.findIndex(t=>t.id===tab2); if(idx>0) setTab2(STEP2_TABS[idx-1].id); }}
                  disabled={tab2===STEP2_TABS[0].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-slate-600 border border-slate-200 hover:border-purple-300 disabled:opacity-30 transition-all">
                  <ArrowLeft size={13}/>Previous
                </button>
                <div className="flex gap-1.5">
                  {STEP2_TABS.map(t => (
                    <div key={t.id} onClick={() => setTab2(t.id)}
                      className="w-2 h-2 rounded-full cursor-pointer transition-all"
                      style={{ background: t.id === tab2 ? primary : '#ddd6fe' }}/>
                  ))}
                </div>
                <button type="button"
                  onClick={() => { const idx = STEP2_TABS.findIndex(t=>t.id===tab2); if(idx<STEP2_TABS.length-1) setTab2(STEP2_TABS[idx+1].id); }}
                  disabled={tab2===STEP2_TABS[STEP2_TABS.length-1].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-30 transition-all"
                  style={{ background: primary }}>
                  Next<ArrowRight size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 3 ════════ */}
          {step === 3 && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="rounded-2xl p-5 flex items-center justify-between" style={{background:'linear-gradient(135deg,#1e0a3c,#2d1165)'}}>
                <div>
                  <p className="text-purple-300/60 text-[11px] uppercase tracking-widest mb-0.5">Registration Fee</p>
                  <p className="text-white font-bold text-3xl tracking-tight">₹200<span className="text-white/40 text-[14px] font-normal ml-2">one-time</span></p>
                  <p className="text-white/30 text-[11px] mt-0.5">Non-refundable patient registration fee</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)'}}>
                  <Lock size={11} style={{color:'#4ade80'}}/><span className="text-[11px] font-semibold" style={{color:'#4ade80'}}>Secure</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Payment Method</p>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map(m => {
                      const Icon = m.icon; const sel = payMethod===m.id && !payLater;
                      return (
                        <button key={m.id} onClick={()=>{setPayMethod(m.id);setPayLater(false);}}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${sel?'border-purple-400 bg-purple-50':'border-slate-200 hover:border-slate-300'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sel?'bg-purple-100':'bg-slate-50'}`}>
                            <Icon size={14} className={sel?'text-purple-600':'text-slate-400'}/>
                          </div>
                          <span className={`text-[13px] font-medium ${sel?'text-purple-700':'text-slate-600'}`}>{m.label}</span>
                          {sel && <Check size={13} className="ml-auto text-purple-600 flex-shrink-0"/>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-700">Pay Later</p>
                        <p className="text-[11px] text-slate-400">At hospital</p>
                      </div>
                      <div onClick={()=>setPayLater(p=>!p)} className="cursor-pointer"
                        style={{width:38,height:22,borderRadius:11,background:payLater?primary:'#e2e8f0',position:'relative',transition:'background 0.2s'}}>
                        <div style={{position:'absolute',top:3,left:payLater?18:3,width:16,height:16,borderRadius:'50%',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left 0.2s'}}/>
                      </div>
                    </div>
                    {payLater && <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">⚠ Due before first consultation</p>}
                  </div>
                </div>

                <div className="col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                  {payLater ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                      <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center mb-3"><span className="text-2xl">⏰</span></div>
                      <p className="font-semibold text-slate-700 mb-1 text-[15px]">Pay Later Selected</p>
                      <p className="text-[13px] text-slate-400 max-w-xs leading-relaxed">₹200 must be cleared before your first consultation.</p>
                    </div>
                  ) : payMethod==='card' ? (
                    <div className="space-y-3">
                      <p className="text-[14px] font-semibold text-slate-700">Card Details</p>
                      <FL label="Card Number">
                        <FI value={card.number} onChange={e=>{const v=e.target.value.replace(/\D/g,'').slice(0,16);setCard(c=>({...c,number:v.replace(/(.{4})/g,'$1 ').trim()}));}} placeholder="0000 0000 0000 0000" className="font-mono tracking-widest" maxLength={19}/>
                      </FL>
                      <div className="grid grid-cols-3 gap-2">
                        <FL label="Expiry">
                          <FI value={card.expiry} onChange={e=>{let v=e.target.value.replace(/\D/g,'').slice(0,4);if(v.length>=3)v=v.slice(0,2)+'/'+v.slice(2);setCard(c=>({...c,expiry:v}));}} placeholder="MM/YY" maxLength={5}/>
                        </FL>
                        <FL label="CVV">
                          <FI type="password" value={card.cvv} onChange={e=>setCard(c=>({...c,cvv:e.target.value.replace(/\D/g,'').slice(0,3)}))} placeholder="•••" maxLength={3} className="tracking-widest text-center"/>
                        </FL>
                        <div/>
                      </div>
                      <FL label="Name on Card">
                        <FI value={card.name} onChange={e=>setCard(c=>({...c,name:e.target.value.replace(/[^A-Za-z\s]/g,'')}))} placeholder="As printed on card"/>
                      </FL>
                      <div className="flex gap-2">
                        {['VISA','MC','RuPay','Maestro'].map(t=>(<div key={t} className="px-2.5 py-1.5 rounded border border-slate-200 text-[11px] font-bold text-slate-500">{t}</div>))}
                      </div>
                    </div>
                  ) : payMethod==='upi' ? (
                    <div className="space-y-3">
                      <p className="text-[14px] font-semibold text-slate-700">UPI</p>
                      <FL label="UPI ID">
                        <FI value={upiId} onChange={e=>setUpiId(e.target.value)} placeholder="name@okicici"/>
                      </FL>
                      <div className="p-3 bg-slate-50 rounded-lg text-[12px] text-slate-500 border border-slate-100">
                        Accepted: @okicici, @oksbi, @paytm, @upi
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[14px] font-semibold text-slate-700">Net Banking</p>
                      <FL label="Bank Name">
                        <FI value={bank.name} onChange={e=>setBank(b=>({...b,name:e.target.value.replace(/[^A-Za-z\s]/g,'')}))} placeholder="State Bank of India"/>
                      </FL>
                      <FL label="Account Number">
                        <FI value={bank.account} onChange={e=>setBank(b=>({...b,account:e.target.value.replace(/\D/g,'').slice(0,18)}))} placeholder="Account number" inputMode="numeric"/>
                      </FL>
                      <FL label="IFSC Code">
                        <FI value={bank.ifsc} onChange={e=>setBank(b=>({...b,ifsc:e.target.value.replace(/[^A-Z0-9]/g,'').toUpperCase().slice(0,11)}))} placeholder="SBIN0001234" className="font-mono uppercase"/>
                      </FL>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 px-5 py-3 flex items-center justify-between">
                <p className="text-[12px] text-slate-500">
                  By completing registration you agree to our <span className="text-purple-600 cursor-pointer font-medium">Terms of Service</span> and <span className="text-purple-600 cursor-pointer font-medium">Privacy Policy</span>
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                  <CheckCircle size={13} className="text-emerald-500"/>
                  <span className="text-[11px] font-semibold text-emerald-600">256-bit SSL</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-white/90 backdrop-blur-sm border-t border-purple-100/50 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {step > 1
              ? <button onClick={handleBack} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors"><ArrowLeft size={14}/>Back</button>
              : <Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-purple-600 transition-colors"><ArrowLeft size={13}/>Back to Login</Link>}
          </div>
          <div>
            {step < 3
              ? <button onClick={handleNext} className="flex items-center gap-2 px-7 py-2.5 rounded-lg text-white text-[14px] font-semibold hover:opacity-90 transition-all shadow-sm" style={{background:primary}}>
                  Save & Continue<ArrowRight size={15}/>
                </button>
              : <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-7 py-2.5 rounded-lg text-white text-[14px] font-semibold disabled:opacity-60 shadow-sm" style={{background:primary}}>
                  {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Registering...</> : <><CheckCircle size={15}/>Complete Registration</>}
                </button>}
          </div>
        </footer>
      </div>
    </div>
  );
}