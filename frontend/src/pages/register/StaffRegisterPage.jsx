// src/pages/register/StaffRegisterPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle, ArrowLeft, ArrowRight,
  Activity, Shield, MapPin, Lock, Camera, Check, X,
  Search, Plus, AlertCircle, Briefcase, User, FileText,
  Calendar, Heart, Phone, Mail, Send, ChevronDown,
  PanelLeftClose, PanelLeftOpen, RefreshCw, PenLine
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── Constants ─────────────────────────────────────────────────────────────────
const BLOOD_GROUPS  = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS       = ['Male','Female','Other','Prefer Not to Say'];
const MARITAL       = ['Single','Married','Divorced','Widowed'];
const RELIGIONS     = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain','Other'];
const COUNTRY_CODES = ['+91','+1','+44','+971','+61','+65','+49','+81'];

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

// Step definitions (3 main steps)
const MAIN_STEPS = [
  { id:1, label:'Personal Details',   sub:'Name, contact & address',       icon: User      },
  { id:2, label:'Job Details',        sub:'Role & department',             icon: Briefcase },
  { id:3, label:'Account & Extras',   sub:'Login credentials & extras',    icon: Lock      },
];

// Tab definitions per step
const STEP1_TABS = [
  { id:'personal',  label:'Personal',  icon: User    },
  { id:'contact',   label:'Contact',   icon: Phone   },
  { id:'address',   label:'Address',   icon: MapPin  },
  { id:'identity',  label:'Identity',  icon: Shield  },
];

const STEP2_TABS = [
  { id:'role',      label:'Role',      icon: Briefcase },
  { id:'employment',label:'Employment',icon: Calendar  },
];

const STEP3_TABS = [
  { id:'emergency', label:'Emergency', icon: Shield  },
  { id:'health',    label:'Health',    icon: Heart   },
  { id:'account',   label:'Account',   icon: Lock    },
  { id:'extras',    label:'Extras',    icon: FileText},
];

const todayStr = new Date().toISOString().split('T')[0];
const eighteenYearsAgo = new Date();
eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
const eighteenYearsAgoStr = eighteenYearsAgo.toISOString().split('T')[0];

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
  if (pw.length >= 8) s++; if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { l:'Weak',   c:'#ef4444', w:20  };
  if (s <= 2) return { l:'Fair',   c:'#f97316', w:45  };
  if (s <= 3) return { l:'Good',   c:'#eab308', w:70  };
  return             { l:'Strong', c:'#22c55e', w:100 };
};

// ── Shared input styles ───────────────────────────────────────────────────────
const inputBase = `w-full px-3.5 py-2 rounded-lg border text-[14px] text-slate-800 bg-white placeholder:text-slate-400 outline-none transition-all`;
const inputNorm = `border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100`;
const inputErr  = `border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100`;
const inputOk   = `border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100`;

const FI = ({ err, ok, className='', ...p }) => (
  <input className={`${inputBase} ${err ? inputErr : ok ? inputOk : inputNorm} ${className}`} {...p}/>
);

const SelectField = ({ children, err=false, className='', ...p }) => (
  <div className="relative">
    <select className={`${inputBase} ${err ? inputErr : inputNorm} ${className} appearance-none cursor-pointer pr-9`} {...p}>
      {children}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/>
  </div>
);

const FL = ({ label, required, error, hint, children, className='' }) => (
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
const PhoneField = ({ code, onCode, val, onChange, err, placeholder='9876543210' }) => (
  <div className={`flex rounded-lg border overflow-hidden transition-all focus-within:ring-2
    ${err
      ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-100 bg-red-50'
      : 'border-slate-200 hover:border-indigo-300 focus-within:border-indigo-500 focus-within:ring-indigo-100'}`}>
    <select value={code} onChange={e => onCode(e.target.value)}
      className="px-2.5 bg-slate-50 border-r border-slate-200 text-[13px] text-slate-700 outline-none cursor-pointer py-2.5 min-w-[70px]">
      {COUNTRY_CODES.map(c => <option key={c}>{c}</option>)}
    </select>
    <input value={val}
      onChange={e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.startsWith('0')) v = v.replace(/^0+/, '');
        if (v.length <= 10) onChange(v);
      }}
      placeholder={placeholder} inputMode="numeric"
      className="flex-1 px-3.5 py-2.5 text-[14px] text-slate-800 outline-none bg-white placeholder:text-slate-400"/>
  </div>
);

// ── Status indicator ──────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  if (!status) return null;
  if (status === 'checking')  return <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"/>;
  if (status === 'available') return <Check size={14} className="text-emerald-500"/>;
  if (status === 'taken')     return <X size={14} className="text-red-500"/>;
  return null;
};

// ── GeoSelect — same component used in PatientRegisterPage ───────────────────
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
  const submitManual = () => { const v = manualVal.trim(); if (!v) return; onAddManually?.(v); onChange('manual_' + v.toLowerCase().replace(/\s+/g,'_'), v); setAddMode(false); setManualVal(''); setOpen(false); };

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
              <X size={8} className="text-slate-500"/>
            </button>
          )}
          {loading
            ? <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/>
            : <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>}
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-[999] mt-1 rounded-xl overflow-hidden"
          style={{ background:'#fff', border:'1px solid #e8eaf0', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.07),0 16px 48px -8px rgba(0,0,0,0.14)' }}>
          <div className="px-2.5 pt-2.5 pb-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/>
              <input ref={srchRef} value={q} onChange={e => { setQ(e.target.value); setCursor(-1); }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setOpen(false); setQ(''); return; }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(p => Math.min(p+1, filtered.length-1)); return; }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(p => Math.max(p-1, 0)); return; }
                  if (e.key === 'Enter') { e.preventDefault(); if (cursor >= 0 && filtered[cursor]) { pick(filtered[cursor]); return; } if (filtered.length === 1) pick(filtered[0]); }
                }}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg outline-none border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 180, scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((item, i) => {
              const isSel = item.code === value || item.name === value;
              return (
                <div key={i} data-idx={i} onMouseDown={e => { e.preventDefault(); pick(item); }} onMouseEnter={() => setCursor(i)}
                  className="px-3 py-2 mx-1.5 mb-0.5 rounded-lg cursor-pointer flex items-center gap-2 transition-all select-none"
                  style={{ background: isSel ? '#eef2ff' : cursor === i ? '#f8faff' : 'transparent', color: isSel ? '#6366f1' : '#334155' }}>
                  {item.flag && <span className="text-[14px]">{item.flag}</span>}
                  <span className="flex-1 truncate text-[13px] font-medium">{item.name}</span>
                  {isSel && <Check size={11} className="text-indigo-600 flex-shrink-0"/>}
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
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left border border-dashed border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400">
                  <PenLine size={12} className="text-indigo-600"/>
                  <span className="text-[12px] font-semibold text-indigo-600">{addLabel}</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <input ref={manualRef} type="text" value={manualVal} onChange={e => setManualVal(e.target.value)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && manualVal.trim()) submitManual(); if (e.key === 'Escape') { setAddMode(false); setManualVal(''); } }}
                    placeholder="Type name…"
                    className="flex-1 px-2.5 py-2 text-[13px] rounded-lg border border-indigo-300 outline-none focus:ring-2 focus:ring-indigo-100"/>
                  <button type="button" onMouseDown={e => { e.preventDefault(); submitManual(); }} disabled={!manualVal.trim()}
                    className="px-3 py-2 rounded-lg text-[12px] font-bold text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>Add</button>
                  <button type="button" onMouseDown={e => { e.preventDefault(); setAddMode(false); setManualVal(''); }}
                    className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={13}/></button>
                </div>
              )}
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
  const [desc, setDesc]   = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  const handleAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const value = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    onAdd({ value, label: trimmed, desc: desc.trim() || 'Custom staff role' });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-slate-800">Add Custom Role</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={15}/></button>
        </div>
        <div className="space-y-3">
          <FL label="Role Title" required>
            <input ref={inputRef} value={label}
              onChange={e => setLabel(lettersOnly(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose(); }}
              placeholder="e.g. Dietitian, Physiotherapist"
              className={`${inputBase} ${inputNorm}`}/>
            <p className="mt-1 text-[11px] text-slate-400">Letters only — no numbers or symbols</p>
          </FL>
          <FL label="Short Description">
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Brief role description (optional)"
              className={`${inputBase} ${inputNorm}`}/>
          </FL>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={handleAdd} disabled={!label.trim()}
            className="flex-1 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50"
            style={{ background: primary || '#6366f1' }}>Add Role</button>
        </div>
      </div>
    </div>
  );
};

// ── Email OTP Modal ───────────────────────────────────────────────────────────
function EmailOtpModal({ email, onVerified, onClose, primary }) {
  const [otp, setOtp]               = useState(['','','','','','']);
  const [sending, setSending]       = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [error, setError]           = useState('');
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
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs[idx-1].current?.focus();
    if (e.key === 'ArrowLeft'  && idx > 0) inputRefs[idx-1].current?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputRefs[idx+1].current?.focus();
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
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${primary}, #8b5cf6)` }}/>
        <div className="p-7">
          <button onClick={onClose} className="absolute top-5 right-5 w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X size={14}/>
          </button>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${primary}20`, border: `2px solid ${primary}30` }}>
            <Mail size={22} style={{ color: primary }}/>
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
                  ${error ? 'border-red-300 bg-red-50 text-red-600' : digit ? 'bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white'}`}
                style={digit && !error ? { borderColor: primary, background: `${primary}10`, color: primary } : {}}
              />
            ))}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
              <AlertCircle size={13} className="flex-shrink-0"/><span>{error}</span>
            </div>
          )}
          <button onClick={handleVerify} disabled={!filled || verifying}
            className="w-full py-2.5 rounded-xl text-white text-[14px] font-bold mb-3 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: filled && !verifying ? `linear-gradient(135deg, ${primary}, #8b5cf6)` : '#94a3b8' }}>
            {verifying ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying...</> : <><Check size={14}/>Verify Email</>}
          </button>
          <div className="text-center">
            {resendCool > 0
              ? <p className="text-[12px] text-slate-400">Resend in <span className="font-bold tabular-nums" style={{ color: primary }}>{resendCool}s</span></p>
              : <button onClick={sendOtp} disabled={sending}
                  className="text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all hover:opacity-80" style={{ color: primary }}>
                  <RefreshCw size={12} className={sending ? 'animate-spin' : ''}/>
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
        const Icon = tab.icon; const isActive = tab.id === active;
        return (
          <button key={tab.id} type="button" onClick={() => onChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[12px] font-semibold transition-all"
            style={isActive
              ? { background: '#fff', color: primary, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: '#94a3b8' }}>
            <Icon size={13}/>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function StaffRegisterPage() {
  const { branding } = useHospitalBranding(1);
  const primary = branding?.primaryColor || '#6366f1';

  const [step, setStep]               = useState(1);
  const [tab1, setTab1]               = useState('personal');
  const [tab2, setTab2]               = useState('role');
  const [tab3, setTab3]               = useState('emergency');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPass, setShowPass]       = useState(false);
  const [showConf, setShowConf]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [errors, setErrors]           = useState({});
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile]       = useState(null);
  const photoRef   = useRef(null);
  const submitLock = useRef(false);

  // OTP modal
  const [showOtpModal, setShowOtpModal]   = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailStatus, setEmailStatus]     = useState(null);
  const [phoneStatus, setPhoneStatus]     = useState(null);
  const [unStatus, setUnStatus]           = useState(null);
  const emailTimer = useRef(null); const phoneTimer = useRef(null); const unTimer = useRef(null);

  // Custom roles
  const [roles, setRoles]             = useState(DEFAULT_ROLES);
  const [showAddRole, setShowAddRole] = useState(false);

  useEffect(() => {
    api.get('/roles')
      .then(r => {
        if (r.roles && r.roles.length > 0) {
          const fetchedRoles = r.roles.map((roleName, idx) => ({
            value: roleName.toLowerCase().replace(/\s+/g, '_'),
            label: roleName,
            desc: `${roleName} Role`,
            color: ROLE_COLORS[idx % ROLE_COLORS.length]
          }));
          setRoles(fetchedRoles);
        }
      })
      .catch(() => {});
  }, []);

  const addCustomRole = newRole => {
    const color = ROLE_COLORS[roles.length % ROLE_COLORS.length];
    setRoles(prev => [...prev, { ...newRole, color }]);
    set('role', newRole.value);
    toast.success(`Role "${newRole.label}" added`);
  };

  const [depts, setDepts]                   = useState([]);

  // ── NEW: ISO3 countries + free states + pincode ──────────────────────────
  const [countries, setCountries]           = useState([]);
  const [states, setStates]                 = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [statesLoading, setStatesLoading]       = useState(false);
  const [pincodeLoading, setPincodeLoading]     = useState(false);
  const [pincodeInfo, setPincodeInfo]           = useState(null);
  const [pincodeError, setPincodeError]         = useState('');
  const pincodeTimer = useRef(null);

  const [form, setForm] = useState({
    firstName:'', lastName:'', gender:'', dateOfBirth:'',
    bloodGroup:'', nationality:'Indian', maritalStatus:'', religion:'', motherTongue:'',
    phone:'', phoneCode:'+91', altPhone:'', altCode:'+91', email:'',
    street1:'', street2:'', city:'', countryCode:'', countryName:'', stateName:'', pincode:'',
    aadhaar:'', pan:'', passportNo:'', voterId:'', abhaNumber:'',
    role:'', departmentId:'', employeeId:'', joiningDate:'', qualification:'',
    contractType:'', reportingManager:'',
    emergencyName:'', emergencyRelation:'', emergencyPhone:'', emergencyCode:'+91',
    knownAllergies:'', bloodDonor:'',
    languagesSpoken:'', previousEmployer:'', experienceYears:'',
    bankAccountNo:'', ifscCode:'',
    username:'', password:'', confirmPassword:'',
  });

  const set = useCallback((k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); }, []);

  // ── Departments via internal API ──────────────────────────────────────────
  useEffect(() => {
    api.get('/hospitals/1/departments')
      .then(r => {
        const data = r.data;
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.items) ? data.items : [];
        setDepts(list);
      })
      .catch(() => {});
  }, []);

  // ── Countries: restcountries.com with ISO 3-letter codes ─────────────────
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
        { code:'IND', name:'India',          flag:'🇮🇳' },
        { code:'USA', name:'United States',  flag:'🇺🇸' },
        { code:'GBR', name:'United Kingdom', flag:'🇬🇧' },
        { code:'ARE', name:'UAE',            flag:'🇦🇪' },
        { code:'AUS', name:'Australia',      flag:'🇦🇺' },
        { code:'SGP', name:'Singapore',      flag:'🇸🇬' },
        { code:'CAN', name:'Canada',         flag:'🇨🇦' },
        { code:'DEU', name:'Germany',        flag:'🇩🇪' },
      ]))
      .finally(() => setCountriesLoading(false));
  }, []);

  // ── States: countriesnow.space by country name ────────────────────────────
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

  // ── Pincode auto-fill: api.postalpincode.in (India only) ─────────────────
  useEffect(() => {
    setPincodeInfo(null);
    setPincodeError('');
    if (pincodeTimer.current) clearTimeout(pincodeTimer.current);

    if (!form.pincode || form.pincode.length !== 6 || form.countryCode !== 'IND') return;

    setPincodeLoading(true);
    pincodeTimer.current = setTimeout(() => {
      fetch(`https://api.postalpincode.in/pincode/${form.pincode}`)
        .then(r => r.json())
        .then(data => {
          const result = data?.[0];
          if (result?.Status === 'Success' && result.PostOffice?.length > 0) {
            const po       = result.PostOffice[0];
            const district = po.District || '';
            const state    = po.State    || '';
            const area     = po.Name     || '';
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

  // ── Real-time checks ──────────────────────────────────────────────────────
  const handleEmail = v => {
    set('email', v);
    setEmailVerified(false);
    setEmailStatus(null);
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

  const handlePhone = v => {
    if (v.startsWith('0')) return;
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

  const handleUsername = v => {
    const clean = v.replace(/[^a-z0-9_.-]/g, '').toLowerCase();
    setForm(f => ({ ...f, username: clean })); setErrors(e => ({ ...e, username: '' })); setUnStatus(null);
    if (unTimer.current) clearTimeout(unTimer.current);
    if (!clean || clean.length < 3) return;
    setUnStatus('checking');
    unTimer.current = setTimeout(async () => {
      try {
        const r = await api.get('/register/check-username?username=' + encodeURIComponent(clean));
        const avail = r?.data?.available ?? r?.available;
        setUnStatus(avail === true ? 'available' : avail === false ? 'taken' : null);
        if (avail === false) setErrors(e => ({ ...e, username: 'Already taken' }));
      } catch { setUnStatus(null); }
    }, 500);
  };

  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.firstName.trim()) e.firstName = 'Required';
      if (!form.lastName.trim())  e.lastName  = 'Required';
      if (!form.gender)           e.gender    = 'Required';
      if (!form.phone)                    e.phone = 'Required';
      else if (form.phone.length !== 10)  e.phone = 'Must be 10 digits';
      else if (phoneStatus === 'taken')   e.phone = 'Already registered';
      if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
      else if (emailStatus === 'taken')   e.email = 'Already registered';
      else if (!emailVerified)            e.email = 'Please verify your email';
      if (!form.street1.trim()) e.street1 = 'Required';
      if (!form.city.trim())    e.city    = 'Required';
      if (!form.countryCode)    e.countryCode = 'Required';
      if (form.pincode && !/^\d{6}$/.test(form.pincode)) e.pincode = 'Must be 6 digits';
      if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan)) e.pan = 'Invalid (ABCDE1234F)';
      if (form.aadhaar && form.aadhaar.length !== 12) e.aadhaar = 'Must be 12 digits';
      // Auto-navigate to tab with errors
      if (e.firstName || e.lastName || e.gender) setTab1('personal');
      else if (e.phone || e.email)                setTab1('contact');
      else if (e.street1 || e.city || e.countryCode || e.pincode) setTab1('address');
      else if (e.pan || e.aadhaar)                setTab1('identity');
    }
    if (step === 2) {
      if (!form.role) e.role = 'Please select a role';
      if (e.role) setTab2('role');
    }
    if (step === 3) {
      if (!form.username.trim())         e.username = 'Required';
      else if (form.username.length < 3) e.username = 'Min 3 characters';
      else if (unStatus === 'taken')     e.username = 'Already taken';
      if (!form.password)                e.password = 'Required';
      else if (form.password.length < 8) e.password = 'Min 8 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Need uppercase, lowercase & number';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Do not match';
      if (e.username || e.password || e.confirmPassword) setTab3('account');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) setStep(s => s + 1); };
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (submitLock.current) return;
    if (!validate()) return;
    submitLock.current = true;
    setLoading(true);
    try {
      const orUndef = v => (v === '' || v == null ? undefined : v);
      const payload = {
        hospitalId:1,
        firstName:form.firstName, lastName:form.lastName, gender:form.gender,
        dateOfBirth:orUndef(form.dateOfBirth), bloodGroup:orUndef(form.bloodGroup),
        nationality:form.nationality, maritalStatus:orUndef(form.maritalStatus),
        religion:orUndef(form.religion), motherTongue:orUndef(form.motherTongue),
        email:form.email, phone:form.phone, phoneCountryCode:form.phoneCode,
        altPhone:orUndef(form.altPhone),
        street1:form.street1, street2:orUndef(form.street2), city:form.city,
        pincode:orUndef(form.pincode),
        countryCode:orUndef(form.countryCode),
        countryName:orUndef(form.countryName),
        stateName:orUndef(form.stateName),
        role:form.role, departmentId:orUndef(form.departmentId),
        employeeId:orUndef(form.employeeId), joiningDate:orUndef(form.joiningDate),
        shiftType:null, qualification:orUndef(form.qualification),
        emergencyName:orUndef(form.emergencyName), emergencyRelation:orUndef(form.emergencyRelation),
        emergencyPhone:orUndef(form.emergencyPhone),
        aadhaar:orUndef(form.aadhaar), pan:orUndef(form.pan),
        passportNo:orUndef(form.passportNo), voterId:orUndef(form.voterId), abhaNumber:orUndef(form.abhaNumber),
        contractType:orUndef(form.contractType), reportingManager:orUndef(form.reportingManager),
        workStartTime:null, workEndTime:null, weeklyOff:null,
        knownAllergies:orUndef(form.knownAllergies), bloodDonor:orUndef(form.bloodDonor),
        languagesSpoken:orUndef(form.languagesSpoken),
        previousEmployer:orUndef(form.previousEmployer),
        experienceYears:form.experienceYears ? Number(form.experienceYears) : undefined,
        bankAccountNo:orUndef(form.bankAccountNo), ifscCode:orUndef(form.ifscCode),
        username:form.username, password:form.password,
      };
      if (photoFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k,v]) => { if (v != null) fd.append(k, String(v)); });
        fd.append('photo', photoFile);
        await api.post('/register/staff', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/register/staff', payload);
      }
      setSuccess(true);
    } catch(err) {
      toast.error(err?.response?.data?.message || err?.message || 'Registration failed');
    } finally {
      setLoading(false);
      submitLock.current = false;
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-indigo-50 border-4 border-indigo-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={40} className="text-indigo-500"/>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Submitted!</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Your staff registration is pending admin review. You'll receive an email once your account is activated.
        </p>
        <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm" style={{ background: primary }}>
          Back to Login
        </Link>
      </div>
    </div>
  );

  const str     = pwStrength(form.password);
  const pwMatch = form.confirmPassword ? form.password === form.confirmPassword : null;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%)' }}>
      {showOtpModal && (
        <EmailOtpModal email={form.email} primary={primary}
          onVerified={() => { setEmailVerified(true); setShowOtpModal(false); setErrors(e => ({ ...e, email: '' })); }}
          onClose={() => setShowOtpModal(false)}
        />
      )}
      {showAddRole && <AddRoleModal onAdd={addCustomRole} onClose={() => setShowAddRole(false)} primary={primary}/>}

      {/* ── Left Sidebar ── */}
      <div
        className="hidden lg:flex flex-col flex-shrink-0 relative overflow-hidden transition-all duration-300"
        style={{
          width: sidebarOpen ? 272 : 56,
          background: 'linear-gradient(160deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)'
        }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle,#6366f1,transparent)' }}/>
          <div className="absolute bottom-10 -right-10 w-48 h-48 rounded-full opacity-15" style={{ background: 'radial-gradient(circle,#8b5cf6,transparent)' }}/>
        </div>
        <button onClick={() => setSidebarOpen(o => !o)}
          className="absolute top-4 right-3 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          {sidebarOpen ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}
        </button>
        <div className="relative p-4 pb-3">
          <div className={`flex items-center gap-3 mb-4 transition-all duration-300 ${sidebarOpen ? '' : 'justify-center'}`}>
            {branding?.logoUrl
              ? <img src={branding.logoUrl} alt="logo" className="w-9 h-9 rounded-xl object-contain flex-shrink-0"/>
              : <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.3)' }}>
                  <Activity size={18} className="text-indigo-300"/>
                </div>}
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-white font-bold text-[14px] whitespace-nowrap">{branding?.name || 'MediCore HMS'}</p>
                <p className="text-indigo-300/60 text-[10px] tracking-widest uppercase whitespace-nowrap">Hospital Management</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4" style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                <span className="text-[10px] font-semibold text-green-400 tracking-wider uppercase">Staff Registration</span>
              </div>
              <h2 className="text-white text-[20px] font-bold leading-tight mb-1">
                Join Our<br/>
                <span className="text-indigo-300">Care Team.</span>
              </h2>
              <p className="text-indigo-200/50 text-[11px] leading-relaxed">Complete your profile to get started with MediCore HMS.</p>
            </>
          )}
        </div>
        <div className="relative px-3 flex-1">
          {sidebarOpen && <p className="text-[10px] font-bold text-indigo-300/50 uppercase tracking-widest mb-3 px-2">Registration Steps</p>}
          {MAIN_STEPS.map((s, i) => {
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
                {i < MAIN_STEPS.length - 1 && <div className={`w-0.5 h-3 mb-1 rounded-full ${sidebarOpen ? 'ml-7' : 'mx-auto'}`} style={{ background: step > s.id ? '#22c55e40' : 'rgba(255,255,255,0.06)' }}/>}
              </div>
            );
          })}
        </div>
        {sidebarOpen && (
          <div className="relative p-4 border-t border-white/8">
            <p className="text-white/25 text-[11px] leading-relaxed mb-2">Staff accounts are reviewed by admin before activation.</p>
            <div className="flex items-center gap-2 text-white/20 text-[11px] mb-1"><Lock size={10}/><span>256-bit SSL encrypted</span></div>
            <p className="text-white/15 text-[10px]">© {new Date().getFullYear()} {branding?.name || 'MediCore HMS'}</p>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100/50 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="lg:hidden flex items-center gap-2">
              {branding?.logoUrl
                ? <img src={branding.logoUrl} alt="" className="w-7 h-7 rounded-lg object-contain"/>
                : <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: primary }}><Activity size={14} className="text-white"/></div>}
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-slate-800">Staff Registration</h1>
              <p className="text-[11px] text-slate-500">Step {step} of {MAIN_STEPS.length} — {MAIN_STEPS[step-1].label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {MAIN_STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div onClick={() => setStep(s.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer hover:scale-110"
                  style={step > s.id ? { background: '#22c55e', color: '#fff' } : step === s.id ? { background: primary, color: '#fff' } : { background: '#f1f5f9', color: '#94a3b8' }}>
                  {step > s.id ? <Check size={12}/> : s.id}
                </div>
                {i < MAIN_STEPS.length - 1 && <div className="w-8 h-0.5 rounded-full" style={{ background: step > s.id ? '#22c55e' : '#e2e8f0' }}/>}
              </div>
            ))}
          </div>
          <Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft size={13}/> Login
          </Link>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c7d2fe transparent' }}>

          {/* ════════ STEP 1 ════════ */}
          {step === 1 && (
            <div className="max-w-3xl mx-auto">
              <TabNav tabs={STEP1_TABS} active={tab1} onChange={setTab1} primary={primary}/>

              {/* ── Personal ── */}
              {tab1 === 'personal' && (
                <div className="space-y-4">
                  {/* Photo + Name row */}
                  <div className="flex items-start gap-4">
                    <div onClick={() => photoRef.current?.click()}
                      className="w-16 h-16 rounded-full flex-shrink-0 cursor-pointer border-2 overflow-hidden flex items-center justify-center relative group"
                      style={{ borderColor: photoPreview ? primary : '#e2e8f0', background: photoPreview ? 'transparent' : '#f8fafc' }}>
                      {photoPreview ? <img src={photoPreview} alt="Staff" className="w-full h-full object-cover"/> : <Camera size={20} className="text-slate-300"/>}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                        <Camera size={13} className="text-white"/>
                      </div>
                    </div>
                    <input ref={photoRef} type="file" accept="image/*"
                      onChange={e => { const f = e.target.files[0]; if (f) { setPhotoPreview(URL.createObjectURL(f)); setPhotoFile(f); } }} className="hidden"/>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <FL label="First Name" required error={errors.firstName}>
                        <FI err={!!errors.firstName} value={form.firstName}
                          onChange={e => set('firstName', lettersOnly(e.target.value))} placeholder="Priya"/>
                      </FL>
                      <FL label="Last Name" required error={errors.lastName}>
                        <FI err={!!errors.lastName} value={form.lastName}
                          onChange={e => set('lastName', lettersOnly(e.target.value))} placeholder="Sharma"/>
                      </FL>
                    </div>
                  </div>

                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 160px 64px 1fr' }}>
                    <FL label="Gender" required error={errors.gender}>
                      <SelectField err={!!errors.gender} value={form.gender} onChange={e => set('gender', e.target.value)}>
                        <option value="">— Select —</option>
                        {GENDERS.map(g => <option key={g}>{g}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Date of Birth" hint="Must be at least 18 years old">
                      <FI type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} max={eighteenYearsAgoStr}/>
                    </FL>
                    <FL label="Age">
                      <div className={`${inputBase} ${inputNorm} bg-slate-50 text-center text-slate-600 cursor-not-allowed font-semibold`}>
                        {calcAge(form.dateOfBirth) || '—'}
                      </div>
                    </FL>
                    <FL label="Blood Group">
                      <SelectField value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                        <option value="">—</option>
                        {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                      </SelectField>
                    </FL>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <FL label="Marital Status">
                      <SelectField value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)}>
                        <option value="">—</option>
                        {MARITAL.map(m => <option key={m}>{m}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Religion">
                      <SelectField value={form.religion} onChange={e => set('religion', e.target.value)}>
                        <option value="">—</option>
                        {RELIGIONS.map(r => <option key={r}>{r}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Mother Tongue">
                      <FI value={form.motherTongue} onChange={e => set('motherTongue', lettersOnly(e.target.value))} placeholder="Hindi"/>
                    </FL>
                  </div>

                  <FL label="Nationality">
                    <FI value={form.nationality} onChange={e => set('nationality', lettersOnly(e.target.value))} placeholder="Indian"/>
                  </FL>
                </div>
              )}

              {/* ── Contact ── */}
              {tab1 === 'contact' && (
                <div className="space-y-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: '260px 1fr' }}>
                    <FL label="Mobile Number" required error={errors.phone}>
                      <PhoneField code={form.phoneCode} onCode={v => set('phoneCode', v)}
                        val={form.phone} onChange={handlePhone} err={!!errors.phone || phoneStatus === 'taken'}/>
                      {phoneStatus === 'checking'  && <div className="text-slate-400 text-[11px] mt-1 flex items-center gap-1"><div className="w-2.5 h-2.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>Checking...</div>}
                      {phoneStatus === 'taken'     && <div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={9}/>Already registered</div>}
                      {phoneStatus === 'available' && <div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                    </FL>
                    <FL label="Alternate Phone">
                      <PhoneField code={form.altCode} onCode={v => set('altCode', v)}
                        val={form.altPhone} onChange={v => set('altPhone', v)} placeholder="Optional"/>
                    </FL>
                  </div>

                  <FL label="Email Address" required error={errors.email}>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FI type="email"
                          err={!!errors.email || emailStatus === 'taken'}
                          ok={emailVerified}
                          value={form.email}
                          onChange={e => handleEmail(e.target.value)}
                          placeholder="priya@email.com"
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
                    {emailStatus === 'taken' && <div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={10}/>Already registered</div>}
                    {!emailVerified && form.email && /\S+@\S+\.\S+/.test(form.email) && emailStatus !== 'taken' && (
                      <div className="text-amber-600 text-[11px] mt-1 flex items-center gap-1"><AlertCircle size={10}/>Verification required to proceed</div>
                    )}
                  </FL>
                </div>
              )}

              {/* ── Address ── */}
              {tab1 === 'address' && (
                <div className="space-y-4">
                  <FL label="Street Line 1" required error={errors.street1}>
                    <FI err={!!errors.street1} value={form.street1}
                      onChange={e => set('street1', addressChars(e.target.value))} placeholder="Building no., Street name"/>
                  </FL>
                  <FL label="Street Line 2 (optional)">
                    <FI value={form.street2} onChange={e => set('street2', addressChars(e.target.value))} placeholder="Area, Landmark"/>
                  </FL>

                  {/* Country + State using GeoSelect with ISO3 */}
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Country" required error={errors.countryCode}>
                      <GeoSelect
                        value={form.countryCode}
                        items={countries}
                        loading={countriesLoading}
                        placeholder="Select country"
                        onAddManually={() => {}}
                        addLabel="Add country manually"
                        onChange={(code, name) => {
                          set('countryCode', code);
                          set('countryName', name);
                          set('stateName', '');
                          set('pincode', '');
                          setPincodeInfo(null);
                          setPincodeError('');
                        }}
                      />
                      {errors.countryCode && <div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.countryCode}</div>}
                    </FL>
                    <FL label="State / Province">
                      {form.countryCode
                        ? <GeoSelect
                            value={form.stateName}
                            items={states}
                            loading={statesLoading}
                            placeholder="Select state"
                            onAddManually={() => {}}
                            addLabel="Add state manually"
                            onChange={(_code, name) => set('stateName', name)}
                          />
                        : <FI value="" disabled placeholder="Pick country first" className="opacity-50 cursor-not-allowed"/>}
                    </FL>
                  </div>

                  {/* City + Pincode with auto-fill feedback */}
                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 140px' }}>
                    <FL label="City" required error={errors.city}>
                      <FI err={!!errors.city} value={form.city}
                        onChange={e => set('city', lettersOnly(e.target.value))} placeholder="Mumbai"/>
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
                            const v = digitsOnly(e.target.value).slice(0, 6);
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
                            ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"/>
                            : pincodeInfo
                              ? <Check size={14} className="text-emerald-500"/>
                              : pincodeError
                                ? <AlertCircle size={14} className="text-red-400"/>
                                : null}
                        </div>
                      </div>
                      {/* Auto-filled area badge */}
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

              {/* ── Identity ── */}
              {tab1 === 'identity' && (
                <div className="space-y-4">
                  <FL label="Aadhaar Number" error={errors.aadhaar} hint={!errors.aadhaar ? '12 digits' : undefined}>
                    <FI err={!!errors.aadhaar}
                      value={form.aadhaar.replace(/(.{4})(?=.)/g, '$1 ')}
                      onChange={e => set('aadhaar', digitsOnly(e.target.value).slice(0, 12))}
                      placeholder="1234 5678 9012" inputMode="numeric" className="font-mono tracking-wider" maxLength={14}/>
                  </FL>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="PAN" error={errors.pan} hint={!errors.pan ? '5 letters · 4 digits · 1 letter' : undefined}>
                      <FI err={!!errors.pan} value={form.pan}
                        onChange={e => {
                          const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                          let out = '';
                          for (let i = 0; i < raw.length; i++) {
                            if (i < 5)     { if (/[A-Z]/.test(raw[i])) out += raw[i]; }
                            else if (i < 9){ if (/[0-9]/.test(raw[i])) out += raw[i]; }
                            else           { if (/[A-Z]/.test(raw[i])) out += raw[i]; }
                          }
                          set('pan', out);
                        }}
                        placeholder="ABCDE1234F" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                    </FL>
                    <FL label="ABHA No.">
                      <FI value={form.abhaNumber}
                        onChange={e => {
                          const d = digitsOnly(e.target.value).slice(0, 14);
                          let o = d.slice(0, 2);
                          if (d.length > 2)  o += '-' + d.slice(2, 6);
                          if (d.length > 6)  o += '-' + d.slice(6, 10);
                          if (d.length > 10) o += '-' + d.slice(10, 14);
                          set('abhaNumber', o);
                        }}
                        placeholder="12-3456-7890-1234" inputMode="numeric" className="font-mono tracking-wider" maxLength={19}/>
                    </FL>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Passport No." hint="1 letter + 7 digits">
                      <FI value={form.passportNo}
                        onChange={e => {
                          const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                          let out = '';
                          for (let i = 0; i < raw.length; i++) {
                            if (i === 0) { if (/[A-Z]/.test(raw[i])) out += raw[i]; }
                            else         { if (/[0-9]/.test(raw[i])) out += raw[i]; }
                          }
                          set('passportNo', out);
                        }}
                        placeholder="A1234567" className="font-mono uppercase tracking-widest" maxLength={8} spellCheck={false}/>
                    </FL>
                    <FL label="Voter ID" hint="3 letters + 7 digits">
                      <FI value={form.voterId}
                        onChange={e => {
                          const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                          let out = '';
                          for (let i = 0; i < raw.length; i++) {
                            if (i < 3) { if (/[A-Z]/.test(raw[i])) out += raw[i]; }
                            else       { if (/[0-9]/.test(raw[i])) out += raw[i]; }
                          }
                          set('voterId', out);
                        }}
                        placeholder="ABC1234567" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                    </FL>
                  </div>
                </div>
              )}

              {/* Tab navigation arrows */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-indigo-100">
                <button type="button"
                  onClick={() => { const idx = STEP1_TABS.findIndex(t => t.id === tab1); if (idx > 0) setTab1(STEP1_TABS[idx-1].id); }}
                  disabled={tab1 === STEP1_TABS[0].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-slate-600 border border-slate-200 hover:border-indigo-300 disabled:opacity-30 transition-all">
                  <ArrowLeft size={13}/>Previous
                </button>
                <div className="flex gap-1.5">
                  {STEP1_TABS.map(t => (
                    <div key={t.id} onClick={() => setTab1(t.id)}
                      className="w-2 h-2 rounded-full cursor-pointer transition-all"
                      style={{ background: t.id === tab1 ? primary : '#c7d2fe' }}/>
                  ))}
                </div>
                <button type="button"
                  onClick={() => { const idx = STEP1_TABS.findIndex(t => t.id === tab1); if (idx < STEP1_TABS.length - 1) setTab1(STEP1_TABS[idx+1].id); }}
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
              <TabNav tabs={STEP2_TABS} active={tab2} onChange={setTab2} primary={primary}/>

              {/* ── Role ── */}
              {tab2 === 'role' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Select Role</p>
                    <button type="button" onClick={() => setShowAddRole(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-[11px] text-indigo-600 hover:bg-indigo-50 transition-colors font-medium">
                      <Plus size={12}/>Add Custom Role
                    </button>
                  </div>
                  {errors.role && <div className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.role}</div>}
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((r, idx) => {
                      const color = r.color || ROLE_COLORS[idx % ROLE_COLORS.length];
                      return (
                        <label key={r.value}
                          className="flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all select-none"
                          style={form.role === r.value ? { background: color + '10', borderColor: color + '50' } : { borderColor: '#f1f5f9' }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '15' }}>
                            <Briefcase size={13} style={{ color }}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-700 truncate">{r.label}</p>
                            <p className="text-[10px] text-slate-400 leading-tight truncate">{r.desc}</p>
                          </div>
                          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={form.role === r.value ? { borderColor: color, background: color } : { borderColor: '#cbd5e1' }}>
                            {form.role === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                          </div>
                          <input type="radio" name="role" value={r.value} checked={form.role === r.value}
                            onChange={e => set('role', e.target.value)} className="hidden"/>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Employment ── */}
              {tab2 === 'employment' && (
                <div className="space-y-4">
                  <FL label="Department">
                    <SelectField value={form.departmentId} onChange={e => set('departmentId', e.target.value)}>
                      <option value="">Select department</option>
                      {depts.map(d => (
                        <option key={d.Id ?? d.id} value={d.Id ?? d.id}>{d.Name ?? d.name}</option>
                      ))}
                    </SelectField>
                  </FL>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Employee ID">
                      <FI value={form.employeeId}
                        onChange={e => set('employeeId', e.target.value.replace(/[^A-Za-z0-9\-]/g, ''))}
                        placeholder="EMP-001"/>
                    </FL>
                    <FL label="Joining Date">
                      <FI type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} max={todayStr}/>
                    </FL>
                  </div>
                  <FL label="Contract Type">
                    <SelectField value={form.contractType} onChange={e => set('contractType', e.target.value)}>
                      <option value="">Select</option>
                      {['Permanent','Contract','Probation','Part-Time','Intern'].map(c => <option key={c}>{c}</option>)}
                    </SelectField>
                  </FL>
                  <FL label="Qualification / Certification">
                    <FI value={form.qualification}
                      onChange={e => set('qualification', e.target.value.replace(/[^A-Za-z0-9\s.,]/g, ''))}
                      placeholder="e.g. B.Sc Nursing, GNM, DMLT"/>
                  </FL>
                  <FL label="Reporting Manager / Supervisor">
                    <FI value={form.reportingManager}
                      onChange={e => set('reportingManager', lettersOnly(e.target.value))}
                      placeholder="Manager name (optional)"/>
                  </FL>
                </div>
              )}

              {/* Tab navigation arrows */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-indigo-100">
                <button type="button"
                  onClick={() => { const idx = STEP2_TABS.findIndex(t => t.id === tab2); if (idx > 0) setTab2(STEP2_TABS[idx-1].id); }}
                  disabled={tab2 === STEP2_TABS[0].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-slate-600 border border-slate-200 hover:border-indigo-300 disabled:opacity-30 transition-all">
                  <ArrowLeft size={13}/>Previous
                </button>
                <div className="flex gap-1.5">
                  {STEP2_TABS.map(t => (
                    <div key={t.id} onClick={() => setTab2(t.id)}
                      className="w-2 h-2 rounded-full cursor-pointer transition-all"
                      style={{ background: t.id === tab2 ? primary : '#c7d2fe' }}/>
                  ))}
                </div>
                <button type="button"
                  onClick={() => { const idx = STEP2_TABS.findIndex(t => t.id === tab2); if (idx < STEP2_TABS.length - 1) setTab2(STEP2_TABS[idx+1].id); }}
                  disabled={tab2 === STEP2_TABS[STEP2_TABS.length-1].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-30 transition-all"
                  style={{ background: primary }}>
                  Next<ArrowRight size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 3 ════════ */}
          {step === 3 && (
            <div className="max-w-3xl mx-auto">
              <TabNav tabs={STEP3_TABS} active={tab3} onChange={setTab3} primary={primary}/>

              {/* ── Emergency ── */}
              {tab3 === 'emergency' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Contact Name">
                      <FI value={form.emergencyName}
                        onChange={e => set('emergencyName', lettersOnly(e.target.value))}
                        placeholder="Full name of contact person"/>
                    </FL>
                    <FL label="Relation">
                      <FI value={form.emergencyRelation}
                        onChange={e => set('emergencyRelation', lettersOnly(e.target.value))}
                        placeholder="e.g. Spouse, Parent, Sibling"/>
                    </FL>
                  </div>
                  <FL label="Emergency Phone">
                    <PhoneField code={form.emergencyCode} onCode={v => set('emergencyCode', v)}
                      val={form.emergencyPhone} onChange={v => set('emergencyPhone', v)}
                      placeholder="Emergency contact number"/>
                  </FL>
                </div>
              )}

              {/* ── Health ── */}
              {tab3 === 'health' && (
                <div className="space-y-4">
                  <FL label="Known Allergies">
                    <textarea value={form.knownAllergies} onChange={e => set('knownAllergies', e.target.value)}
                      className={`${inputBase} ${inputNorm} resize-none`} rows={3}
                      placeholder="e.g. Penicillin, Latex gloves, Dust, Pollen — or type None"/>
                  </FL>
                  <FL label="Willing to Donate Blood?">
                    <div className="flex gap-2.5 mt-1">
                      {['Yes','No','Maybe'].map(opt => (
                        <button key={opt} type="button" onClick={() => set('bloodDonor', opt)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-all"
                          style={form.bloodDonor === opt ? { background: primary, color: '#fff', borderColor: 'transparent' } : { color: '#475569', borderColor: '#e2e8f0' }}>
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.bloodDonor === opt ? 'border-white' : 'border-slate-400'}`}>
                            {form.bloodDonor === opt && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                          </div>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </FL>
                </div>
              )}

              {/* ── Account ── */}
              {tab3 === 'account' && (
                <div className="space-y-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <FL label="Username" required error={errors.username}>
                      <div className="relative">
                        <FI err={!!errors.username || unStatus === 'taken'} ok={unStatus === 'available'}
                          value={form.username} onChange={e => handleUsername(e.target.value)}
                          placeholder="priya.sharma" className="pr-10"/>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2"><StatusDot status={unStatus}/></div>
                      </div>
                      {unStatus === 'available' && <div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                      {unStatus === 'taken'     && <div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={9}/>Already taken</div>}
                    </FL>
                    <div/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Password" required error={errors.password}>
                      <div className="relative">
                        <FI type={showPass ? 'text' : 'password'} err={!!errors.password}
                          value={form.password} onChange={e => set('password', e.target.value)}
                          placeholder="Min 8 characters" className="pr-10"/>
                        <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      </div>
                      {form.password && str && (
                        <div className="mt-1.5">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all" style={{ width: `${str.w}%`, background: str.c }}/>
                          </div>
                          <span className="text-[11px] font-semibold" style={{ color: str.c }}>{str.l} password</span>
                        </div>
                      )}
                    </FL>
                    <FL label="Confirm Password" required error={errors.confirmPassword}>
                      <div className="relative">
                        <FI type={showConf ? 'text' : 'password'} err={!!errors.confirmPassword} ok={pwMatch === true}
                          value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                          placeholder="Re-enter password" className="pr-10"/>
                        <button type="button" onClick={() => setShowConf(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showConf ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      </div>
                      {pwMatch === true && <div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={10}/>Passwords match</div>}
                    </FL>
                  </div>
                </div>
              )}

              {/* ── Extras ── */}
              {tab3 === 'extras' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Languages Spoken">
                      <FI value={form.languagesSpoken}
                        onChange={e => set('languagesSpoken', langChars(e.target.value))}
                        placeholder="Hindi, English, Marathi"/>
                    </FL>
                    <FL label="Total Experience (Years)">
                      <FI value={form.experienceYears}
                        onChange={e => set('experienceYears', digitsOnly(e.target.value).slice(0, 2))}
                        placeholder="e.g. 3" inputMode="numeric" maxLength={2}/>
                    </FL>
                  </div>
                  <FL label="Previous Employer">
                    <FI value={form.previousEmployer}
                      onChange={e => set('previousEmployer', e.target.value.replace(/[^A-Za-z0-9\s,.\-&]/g, ''))}
                      placeholder="Previous hospital or clinic"/>
                  </FL>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Bank Account No." hint="For salary credit">
                      <FI value={form.bankAccountNo}
                        onChange={e => set('bankAccountNo', digitsOnly(e.target.value))}
                        placeholder="Account number" inputMode="numeric"/>
                    </FL>
                    <FL label="IFSC Code" hint="4 letters + 0 + 6 alphanumeric">
                      <FI value={form.ifscCode}
                        onChange={e => set('ifscCode', alphaNumUpper(e.target.value).slice(0, 11))}
                        placeholder="SBIN0001234" className="font-mono uppercase" maxLength={11} spellCheck={false}/>
                    </FL>
                  </div>
                </div>
              )}

              {/* Tab navigation arrows */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-indigo-100">
                <button type="button"
                  onClick={() => { const idx = STEP3_TABS.findIndex(t => t.id === tab3); if (idx > 0) setTab3(STEP3_TABS[idx-1].id); }}
                  disabled={tab3 === STEP3_TABS[0].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-slate-600 border border-slate-200 hover:border-indigo-300 disabled:opacity-30 transition-all">
                  <ArrowLeft size={13}/>Previous
                </button>
                <div className="flex gap-1.5">
                  {STEP3_TABS.map(t => (
                    <div key={t.id} onClick={() => setTab3(t.id)}
                      className="w-2 h-2 rounded-full cursor-pointer transition-all"
                      style={{ background: t.id === tab3 ? primary : '#c7d2fe' }}/>
                  ))}
                </div>
                <button type="button"
                  onClick={() => { const idx = STEP3_TABS.findIndex(t => t.id === tab3); if (idx < STEP3_TABS.length - 1) setTab3(STEP3_TABS[idx+1].id); }}
                  disabled={tab3 === STEP3_TABS[STEP3_TABS.length-1].id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-30 transition-all"
                  style={{ background: primary }}>
                  Next<ArrowRight size={13}/>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-white/90 backdrop-blur-sm border-t border-indigo-100/50 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {step > 1
              ? <button onClick={handleBack} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors">
                  <ArrowLeft size={14}/>Back
                </button>
              : <Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-indigo-600 transition-colors">
                  <ArrowLeft size={13}/>Back to Login
                </Link>}
            <span className="text-[11px] text-slate-300 hidden sm:block">© {new Date().getFullYear()} {branding?.name || 'MediCore HMS'}. All rights reserved.</span>
          </div>
          <div>
            {step < MAIN_STEPS.length
              ? <button onClick={handleNext} className="flex items-center gap-2 px-7 py-2.5 rounded-lg text-white text-[14px] font-semibold hover:opacity-90 transition-all shadow-sm" style={{ background: primary }}>
                  Save & Continue<ArrowRight size={15}/>
                </button>
              : <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-7 py-2.5 rounded-lg text-white text-[14px] font-semibold disabled:opacity-60 shadow-sm" style={{ background: primary }}>
                  {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting...</> : <><CheckCircle size={15}/>Submit Application</>}
                </button>}
          </div>
        </footer>
      </div>
    </div>
  );
}