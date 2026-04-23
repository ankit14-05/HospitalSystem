// src/pages/register/DoctorRegisterPage.jsx
//
// Free API integrations (no API key needed):
//   • Countries  → https://restcountries.com/v3.1/all?fields=name,cca3
//                  stores ISO 3166-1 alpha-3 code (IND, USA, GBR …) as countryId
//   • States     → https://countriesnow.space/api/v0.1/countries/states  (POST)
//   • Pincode    → https://api.postalpincode.in/pincode/{pin}
//                  auto-fills city + state for Indian 6-digit pincodes

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle, ArrowLeft, ArrowRight,
  Activity, Shield, MapPin, Lock, Camera, Check, X,
  Search, Plus, AlertCircle, Stethoscope, User,
  FileText, Upload, Trash2, BookOpen, Mail,
  PanelLeftClose, PanelLeftOpen, ChevronDown, RefreshCw, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── Constants ─────────────────────────────────────────────────────────────────
const BLOOD_GROUPS  = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS       = ['Male','Female','Other','Prefer Not to Say'];
const COUNTRY_CODES = ['+91','+1','+44','+971','+61','+65','+49','+81'];
const MARITAL       = ['Single','Married','Divorced','Widowed'];
const RELIGIONS     = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain','Other'];
const DOC_TYPES = [
  { value:'medical_degree',    label:'Medical Degree'         },
  { value:'id_proof',          label:'Government ID'          },
  { value:'experience_cert',   label:'Experience Certificate' },
  { value:'registration_cert', label:'NMC/State Registration' },
  { value:'insurance',         label:'Insurance Document'     },
  { value:'other',             label:'Other'                  },
];

// ── Free-API base URLs ────────────────────────────────────────────────────────
const REST_COUNTRIES_URL  = 'https://restcountries.com/v3.1/all?fields=name,cca3';
const COUNTRIES_NOW_URL   = 'https://countriesnow.space/api/v0.1/countries/states';
const INDIA_PINCODE_URL   = 'https://api.postalpincode.in/pincode';

// Fallback list if REST Countries is unreachable (stores cca3 codes)
const FALLBACK_COUNTRIES = [
  { Id:'IND', Name:'India'          },
  { Id:'USA', Name:'United States'  },
  { Id:'GBR', Name:'United Kingdom' },
  { Id:'ARE', Name:'UAE'            },
  { Id:'AUS', Name:'Australia'      },
  { Id:'SGP', Name:'Singapore'      },
  { Id:'DEU', Name:'Germany'        },
  { Id:'CAN', Name:'Canada'         },
];

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { id:1, label:'Personal & Contact',   sub:'Basic info & credentials',  icon: User        },
  { id:2, label:'Professional Details', sub:'Qualifications & identity', icon: Stethoscope },
  { id:3, label:'Address & Documents',  sub:'Address & file uploads',    icon: FileText    },
];

const STEP1_TABS = [
  { id:'personal',    label:'Personal',    icon: User   },
  { id:'contact',     label:'Contact',     icon: Mail   },
  { id:'credentials', label:'Credentials', icon: Lock   },
];
const STEP2_TABS = [
  { id:'qualifications', label:'Qualifications', icon: Stethoscope },
  { id:'identity',       label:'Identity',       icon: Shield      },
  { id:'profile',        label:'Profile',        icon: BookOpen    },
];
const STEP3_TABS = [
  { id:'address',   label:'Address',   icon: MapPin  },
  { id:'documents', label:'Documents', icon: Upload  },
];

// ── Date helpers ──────────────────────────────────────────────────────────────
const MIN_AGE = 25, MAX_AGE = 80;
const getMaxDOB = () => { const d=new Date(); d.setFullYear(d.getFullYear()-MIN_AGE); return d.toISOString().split('T')[0]; };
const getMinDOB = () => { const d=new Date(); d.setFullYear(d.getFullYear()-MAX_AGE); return d.toISOString().split('T')[0]; };
const validateDOB = dob => {
  if (!dob) return null;
  const yrs = (new Date()-new Date(dob))/(1000*60*60*24*365.25);
  if (yrs < MIN_AGE) return `Must be at least ${MIN_AGE} years old`;
  if (yrs > MAX_AGE) return `Age cannot exceed ${MAX_AGE} years`;
  return null;
};
const todayStr = new Date().toISOString().split('T')[0];

// ── Identity formatters ───────────────────────────────────────────────────────
const formatPAN      = raw => { const v=raw.toUpperCase().replace(/[^A-Z0-9]/g,''); let r=''; for(let i=0;i<Math.min(v.length,10);i++){if(i<5){if(/[A-Z]/.test(v[i]))r+=v[i];}else if(i<9){if(/[0-9]/.test(v[i]))r+=v[i];}else{if(/[A-Z]/.test(v[i]))r+=v[i];}} return r; };
const formatPassport = raw => { const v=raw.toUpperCase().replace(/[^A-Z0-9]/g,''); let r=''; for(let i=0;i<Math.min(v.length,8);i++){if(i===0){if(/[A-Z]/.test(v[i]))r+=v[i];}else{if(/[0-9]/.test(v[i]))r+=v[i];}} return r; };
const formatVoterId  = raw => { const v=raw.toUpperCase().replace(/[^A-Z0-9]/g,''); let r=''; for(let i=0;i<Math.min(v.length,10);i++){if(i<3){if(/[A-Z]/.test(v[i]))r+=v[i];}else{if(/[0-9]/.test(v[i]))r+=v[i];}} return r; };
const formatABHA     = raw => { const d=raw.replace(/\D/g,'').slice(0,14); let o=d.slice(0,2); if(d.length>2)o+='-'+d.slice(2,6); if(d.length>6)o+='-'+d.slice(6,10); if(d.length>10)o+='-'+d.slice(10,14); return o; };
const formatAadhaar  = raw => raw.replace(/\D/g,'').slice(0,12).replace(/(.{4})(?=.)/g,'$1 ');

// ── Password strength ─────────────────────────────────────────────────────────
const pwStrength = pw => {
  if (!pw) return null;
  let s=0;
  if(pw.length>=8)s++; if(pw.length>=12)s++;
  if(/[A-Z]/.test(pw))s++; if(/[0-9]/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
  if(s<=1) return {l:'Weak',  c:'#ef4444',w:20};
  if(s<=2) return {l:'Fair',  c:'#f97316',w:45};
  if(s<=3) return {l:'Good',  c:'#eab308',w:70};
  return         {l:'Strong',c:'#22c55e',w:100};
};

// ── Shared input styles ───────────────────────────────────────────────────────
const inputBase = `w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-700 bg-white placeholder:text-slate-400 outline-none transition-all`;
const inputNorm = `border-slate-200 hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`;
const inputErr  = `border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100`;
const inputOk   = `border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100`;

const FI  = ({err,ok,className='',...p}) => <input    className={`${inputBase} ${err?inputErr:ok?inputOk:inputNorm} ${className}`} {...p}/>;
const FTA = ({className='',...p})        => <textarea className={`${inputBase} ${inputNorm} resize-none ${className}`} {...p}/>;

const SelectField = ({children,err=false,className='',...p}) => (
  <div className="relative">
    <select className={`${inputBase} ${err?inputErr:inputNorm} ${className} appearance-none cursor-pointer pr-9`} {...p}>{children}</select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/>
  </div>
);

const FL = ({label,required,error,hint,children,className=''}) => (
  <div className={className}>
    {label && <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}{required&&<span className="text-red-400 ml-0.5">*</span>}</label>}
    {children}
    {error && <div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/><span>{error}</span></div>}
    {!error && hint && <div className="mt-1 text-[11px] text-slate-400">{hint}</div>}
  </div>
);

// ── PhoneField ────────────────────────────────────────────────────────────────
const PhoneField = ({code,onCode,val,onChange,err,placeholder='9876543210'}) => (
  <div className={`flex rounded-xl border overflow-hidden transition-all focus-within:ring-2
    ${err?'border-red-400 focus-within:border-red-400 focus-within:ring-red-100 bg-red-50'
        :'border-slate-200 hover:border-indigo-300 focus-within:border-indigo-400 focus-within:ring-indigo-100'}`}>
    <select value={code} onChange={e=>onCode(e.target.value)}
      className="px-2 bg-slate-50 border-r border-slate-200 text-[12px] text-slate-600 outline-none cursor-pointer py-2.5 min-w-[68px]">
      {COUNTRY_CODES.map(c=><option key={c}>{c}</option>)}
    </select>
    <input value={val}
      onChange={e=>{const v=e.target.value.replace(/\D/g,'');if(v.startsWith('0'))return;if(v.length<=10)onChange(v);}}
      placeholder={placeholder} inputMode="numeric"
      className="flex-1 px-3 py-2.5 text-[13px] text-slate-700 outline-none bg-white placeholder:text-slate-300 min-w-0"/>
  </div>
);

// ── Status dot ────────────────────────────────────────────────────────────────
const Dot = ({status}) => {
  if(!status)             return null;
  if(status==='checking') return <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>;
  if(status==='available')return <Check size={13} className="text-emerald-500"/>;
  if(status==='taken')    return <X size={13} className="text-red-500"/>;
  return null;
};

// ── TabNav ────────────────────────────────────────────────────────────────────
function TabNav({tabs,active,onChange,primary}) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
      {tabs.map(tab=>{
        const Icon=tab.icon; const isActive=tab.id===active;
        return (
          <button key={tab.id} type="button" onClick={()=>onChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[12px] font-semibold transition-all"
            style={isActive?{background:'#fff',color:primary,boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}:{color:'#94a3b8'}}>
            <Icon size={13}/><span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── TabFooter ─────────────────────────────────────────────────────────────────
function TabFooter({tabs,active,onChange,primary}) {
  const idx=tabs.findIndex(t=>t.id===active);
  return (
    <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
      <button type="button" onClick={()=>{if(idx>0)onChange(tabs[idx-1].id);}} disabled={idx===0}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-slate-600 border border-slate-200 hover:border-indigo-300 disabled:opacity-30 transition-all">
        <ArrowLeft size={13}/>Previous
      </button>
      <div className="flex gap-1.5">
        {tabs.map(t=>(
          <div key={t.id} onClick={()=>onChange(t.id)}
            className="w-2 h-2 rounded-full cursor-pointer transition-all"
            style={{background:t.id===active?primary:'#e2e8f0'}}/>
        ))}
      </div>
      <button type="button" onClick={()=>{if(idx<tabs.length-1)onChange(tabs[idx+1].id);}} disabled={idx===tabs.length-1}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-30 transition-all"
        style={{background:primary}}>
        Next<ArrowRight size={13}/>
      </button>
    </div>
  );
}

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({value,onChange,items,placeholder,onAddNew,addLabel,disabled=false,err=false}) {
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState('');
  const [custom,setCustom]=useState('');
  const [addMode,setAddMode]=useState(false);
  const [cursor,setCursor]=useState(-1);
  const wrapRef=useRef(null); const listRef=useRef(null); const srchRef=useRef(null);
  const isStr=typeof items[0]==='string';
  const filtered=isStr?items.filter(i=>i.toLowerCase().includes(q.toLowerCase())):items.filter(i=>(i.Name??String(i)).toLowerCase().includes(q.toLowerCase()));
  const selected=isStr?(value?items.find(i=>i===value):null):((value!==''&&value!=null)?items.find(i=>String(i.Id??i)===String(value)):null);
  const displayLabel=isStr?(value||''):(selected?(selected.Name??String(selected)):(value?String(value):''));

  useEffect(()=>{const h=ev=>{if(wrapRef.current&&!wrapRef.current.contains(ev.target)){setOpen(false);setAddMode(false);setQ('');setCursor(-1);}};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  useEffect(()=>{if(cursor>=0&&listRef.current){const el=listRef.current.querySelector(`[data-idx="${cursor}"]`);if(el)el.scrollIntoView({block:'nearest'});}},[cursor]);
  useEffect(()=>{if(open){const t=setTimeout(()=>srchRef.current?.focus(),20);return()=>clearTimeout(t);}},[open]);

  const pick=item=>{if(isStr){onChange(item,item);}else{onChange(item.Id??item,String(item.Name??item));}setOpen(false);setQ('');setCursor(-1);};

  return (
    <div ref={wrapRef} className="relative">
      <div onClick={()=>{if(!disabled)setOpen(o=>!o);}} tabIndex={disabled?-1:0}
        onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key==='ArrowDown')){e.preventDefault();setOpen(true);}}}
        className={`${inputBase} ${err?inputErr:inputNorm} flex items-center justify-between ${disabled?'opacity-50 cursor-not-allowed':'cursor-pointer'}`}>
        <span className={displayLabel?'text-slate-700':'text-slate-400'} style={{fontSize:13}}>{displayLabel||placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {displayLabel&&!disabled&&<button type="button" onClick={e=>{e.stopPropagation();onChange('','');}} className="p-0.5 text-slate-300 hover:text-slate-500 rounded"><X size={10}/></button>}
          <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${open?'rotate-180':''}`}/>
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
                  if(e.key==='Enter'){e.preventDefault();if(cursor>=0&&filtered[cursor]){pick(filtered[cursor]);return;}if(filtered.length===1){pick(filtered[0]);return;}if(!filtered.length&&q.trim()&&onAddNew){onAddNew(q.trim());setOpen(false);setQ('');}}
                }}
                placeholder="Search…" className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-indigo-400"/>
            </div>
          </div>
          <div ref={listRef} className="max-h-44 overflow-y-auto">
            {filtered.length>0?filtered.map((item,i)=>{
              const lbl=isStr?item:(item.Name??String(item));
              const isSel=isStr?item===value:String(item.Id??item)===String(value);
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
                <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Type name…" autoFocus
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({step,setStep,completedSteps,branding,primary,open,onToggle}) => (
  <aside className="hidden md:flex flex-col flex-shrink-0 relative overflow-hidden transition-all duration-300"
    style={{width:open?264:56,background:'linear-gradient(160deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)'}}>
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-20" style={{background:'radial-gradient(circle,#6366f1,transparent)'}}/>
      <div className="absolute bottom-10 -right-10 w-48 h-48 rounded-full opacity-15" style={{background:'radial-gradient(circle,#4f46e5,transparent)'}}/>
    </div>
    <button onClick={onToggle}
      className="absolute top-4 right-3 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
      style={{color:'rgba(255,255,255,0.5)'}}>
      {open?<PanelLeftClose size={16}/>:<PanelLeftOpen size={16}/>}
    </button>
    <div className="relative p-4 pb-3 overflow-hidden">
      <div className={`flex items-center gap-3 mb-4 transition-all duration-300 ${open?'':'justify-center'}`}>
        {branding?.logoUrl
          ?<img src={branding.logoUrl} alt="logo" className="w-9 h-9 rounded-xl object-contain flex-shrink-0"/>
          :<div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(99,102,241,0.3)'}}><Activity size={18} className="text-indigo-300"/></div>}
        {open&&(
          <div className="overflow-hidden">
            <p className="text-white font-bold text-[14px] whitespace-nowrap">{branding?.name||'MediCore HMS'}</p>
            <p className="text-indigo-300/60 text-[10px] tracking-widest uppercase whitespace-nowrap">Hospital Management</p>
          </div>
        )}
      </div>
      {open&&(
        <>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4" style={{background:'rgba(99,102,241,0.2)',border:'1px solid rgba(99,102,241,0.4)'}}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:'#fbbf24'}}/>
            <span className="text-[10px] font-semibold text-indigo-300 tracking-wider uppercase">Doctor Registration</span>
          </div>
          <h2 className="text-white text-[18px] font-bold leading-tight mb-1">Join Our<br/><span className="text-indigo-300">Medical Team.</span></h2>
          <p className="text-indigo-200/40 text-[11px] leading-relaxed">Quality healthcare with our unified hospital platform.</p>
        </>
      )}
    </div>
    <div className="relative px-3 flex-1 overflow-hidden">
      {open&&<p className="text-[10px] font-bold text-indigo-300/50 uppercase tracking-widest mb-3 px-2">Registration Steps</p>}
      {STEPS.map((s,i)=>{
        const Icon=s.icon; const done=completedSteps.includes(s.id); const active=step===s.id;
        return (
          <div key={s.id}>
            <div onClick={()=>setStep(s.id)}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 mb-1 transition-all cursor-pointer
                ${active?'bg-white/10':'opacity-40 hover:opacity-70 hover:bg-white/5'}
                ${!open?'justify-center px-1':''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${done?'bg-emerald-500':''}`}
                style={!done&&active?{background:primary}:!done?{background:'rgba(255,255,255,0.08)'}:{}}>
                {done?<Check size={14} className="text-white"/>:<Icon size={14} className="text-white"/>}
              </div>
              {open&&(
                <div className="min-w-0 overflow-hidden">
                  <p className={`text-[12px] whitespace-nowrap ${active?'font-semibold text-white':'text-white/50'}`}>{s.label}</p>
                  <p className="text-[10px] text-white/30 whitespace-nowrap">{s.sub}</p>
                </div>
              )}
              {open&&active&&<div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:primary}}/>}
            </div>
            {i<STEPS.length-1&&<div className={`w-0.5 h-3 mb-1 rounded-full ${open?'ml-7':'mx-auto'}`} style={{background:done?'#22c55e40':'rgba(255,255,255,0.06)'}}/>}
          </div>
        );
      })}
    </div>
    {open&&(
      <div className="relative p-4 border-t border-white/8">
        <div className="flex items-center gap-2 text-white/20 text-[11px] mb-1"><Lock size={10}/><span>256-bit SSL encrypted</span></div>
        <p className="text-white/15 text-[10px]">© {new Date().getFullYear()} {branding?.name||'MediCore HMS'}</p>
      </div>
    )}
  </aside>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function DoctorRegisterPage() {
  const {branding} = useHospitalBranding(1);
  const primary = branding?.primaryColor || '#6366f1';

  const [step,setStep]                     = useState(1);
  const [tab1,setTab1]                     = useState('personal');
  const [tab2,setTab2]                     = useState('qualifications');
  const [tab3,setTab3]                     = useState('address');
  const [sidebarOpen,setSidebarOpen]       = useState(true);
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

  const [documents,setDocuments] = useState([]);
  const [specs,setSpecs]         = useState([]);
  const [quals,setQuals]         = useState([]);
  const [depts,setDepts]         = useState([]);
  const [councils,setCouncils]   = useState([]);

  // ── geo state ──────────────────────────────────────────────────────────────
  const [countries,setCountries]           = useState([]);
  const [countriesLoading,setCountriesLoading] = useState(true);
  const [states,setStates]                 = useState([]);
  const [statesLoading,setStatesLoading]   = useState(false);

  // ── pincode auto-fill ──────────────────────────────────────────────────────
  const [pincodeLoading,setPincodeLoading] = useState(false);
  const [pincodeInfo,setPincodeInfo]       = useState(null); // { locality, district, state }
  const pinTimer = useRef(null);

  const [unStatus,setUnStatus]       = useState(null);
  const [emailStatus,setEmailStatus] = useState(null);
  const [phoneStatus,setPhoneStatus] = useState(null);
  const unTimer=useRef(null); const emailTimer=useRef(null); const phoneTimer=useRef(null);

  // Email OTP
  const [emailOtpSent,setEmailOtpSent]       = useState(false);
  const [emailOtpValue,setEmailOtpValue]     = useState('');
  const [emailVerified,setEmailVerified]     = useState(false);
  const [emailOtpLoading,setEmailOtpLoading] = useState(false);
  const [emailOtpError,setEmailOtpError]     = useState('');
  const [otpCooldown,setOtpCooldown]         = useState(0);
  const otpCooldownRef = useRef(null);

  const [form,setForm] = useState({
    firstName:'', lastName:'', gender:'', dateOfBirth:'',
    bloodGroup:'', nationality:'Indian', maritalStatus:'', religion:'',
    occupation:'', motherTongue:'', designation:'',
    phone:'', phoneCode:'+91', altPhone:'', email:'',
    username:'', password:'', confirmPassword:'',
    specializationId:'', qualificationId:'', departmentId:'', medicalCouncilId:'',
    experienceYears:'', maxDailyPatients:'',
    consultationFee:'', followUpFee:'', emergencyFee:'',
    languagesSpoken:'Hindi, English',
    bio:'', awards:'', publications:'',
    aadhaar:'', pan:'', passportNo:'', voterId:'', abhaNumber:'',
    street1:'', street2:'', city:'',
    countryId:'', countryName:'', stateId:'', stateName:'', pincode:'',
  });

  const set = useCallback((k,v)=>{ setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:''})); },[]);

  const extractList = r => {
    if(Array.isArray(r))              return r;
    if(Array.isArray(r?.data))        return r.data;
    if(Array.isArray(r?.data?.items)) return r.data.items;
    if(Array.isArray(r?.items))       return r.items;
    return [];
  };

  // ── Fetch HMS data ─────────────────────────────────────────────────────────
  useEffect(()=>{
    api.get('/setup/specializations?limit=200').then(r=>setSpecs(extractList(r))).catch(()=>{});
    api.get('/setup/qualifications?limit=200').then(r=>setQuals(extractList(r))).catch(()=>{});
    api.get('/hospitals/1/departments').then(r=>setDepts(extractList(r))).catch(()=>{});
    api.get('/setup/medical-councils?limit=200').then(r=>setCouncils(extractList(r))).catch(()=>{});
  },[]);

  // ── Fetch countries from REST Countries (free, no key) ────────────────────
  // Returns ISO 3166-1 alpha-3 codes (cca3): IND, USA, GBR …
  useEffect(()=>{
    setCountriesLoading(true);
    fetch(REST_COUNTRIES_URL)
      .then(r=>r.json())
      .then(data=>{
        if(!Array.isArray(data)) throw new Error('bad response');
        const list = data
          .map(c=>({ Id: c.cca3, Name: c.name.common }))
          .sort((a,b)=>{
            // India first, then alphabetical
            if(a.Id==='IND') return -1;
            if(b.Id==='IND') return 1;
            return a.Name.localeCompare(b.Name);
          });
        setCountries(list);
        // Pre-select India
        setForm(f=>({...f, countryId:'IND', countryName:'India'}));
      })
      .catch(()=>{
        setCountries(FALLBACK_COUNTRIES);
        setForm(f=>({...f, countryId:'IND', countryName:'India'}));
      })
      .finally(()=>setCountriesLoading(false));
  },[]);

  // ── Fetch states from CountriesNow when country changes ───────────────────
  // POST https://countriesnow.space/api/v0.1/countries/states { country: "India" }
  useEffect(()=>{
    if(!form.countryName){ setStates([]); return; }
    setStatesLoading(true);
    setStates([]);
    fetch(COUNTRIES_NOW_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({country: form.countryName}),
    })
      .then(r=>r.json())
      .then(data=>{
        if(!data.error && Array.isArray(data.data?.states)){
          const list = data.data.states
            .map(s=>({ Id: s.state_code||s.name, Name: s.name }))
            .sort((a,b)=>a.Name.localeCompare(b.Name));
          setStates(list);
        } else {
          setStates([]);
        }
      })
      .catch(()=>setStates([]))
      .finally(()=>setStatesLoading(false));
  },[form.countryName]);

  // ── Pincode auto-fill (India Post API — free, no key) ─────────────────────
  // GET https://api.postalpincode.in/pincode/{6-digit-pin}
  // Fills: city (District), stateName, stateId — only for Indian 6-digit pins
  const lookupPincode = useCallback(async (pin) => {
    setPincodeLoading(true);
    setPincodeInfo(null);
    try {
      const res  = await fetch(`${INDIA_PINCODE_URL}/${pin}`);
      const data = await res.json();
      if(data?.[0]?.Status==='Success' && data[0].PostOffice?.length){
        const po = data[0].PostOffice[0];
        const district = po.District  || '';
        const state    = po.State     || '';
        const locality = po.Name      || '';
        // Auto-fill address fields
        if(district) setForm(f=>({...f, city: district}));
        if(state){
          // Also ensure country is India when we get an Indian pincode
          setForm(f=>({
            ...f,
            stateName: state,
            stateId:   state,   // use name as key when filled from pincode
            countryId:   f.countryId   || 'IND',
            countryName: f.countryName || 'India',
          }));
        }
        setPincodeInfo({ locality, district, state });
        setErrors(e=>({...e, pincode:'', city:'', stateName:''}));
        toast.success(`📍 ${[locality, district, state].filter(Boolean).join(', ')}`);
      } else {
        setPincodeInfo(null);
        toast.error('Pincode not found');
      }
    } catch {
      setPincodeInfo(null);
    } finally {
      setPincodeLoading(false);
    }
  },[]);

  const handlePincodeChange = (raw) => {
    const clean = raw.replace(/\D/g,'').slice(0,6);
    set('pincode', clean);
    setPincodeInfo(null);
    if(pinTimer.current) clearTimeout(pinTimer.current);
    if(clean.length===6){
      pinTimer.current = setTimeout(()=>lookupPincode(clean), 400);
    }
  };

  // ── Live uniqueness checks ─────────────────────────────────────────────────
  const handleUsername = v => {
    const clean=v.replace(/[^a-z0-9_.-]/g,'').toLowerCase();
    setForm(f=>({...f,username:clean})); setErrors(e=>({...e,username:''})); setUnStatus(null);
    if(unTimer.current) clearTimeout(unTimer.current);
    if(!clean||clean.length<3) return;
    setUnStatus('checking');
    unTimer.current=setTimeout(async()=>{
      try{const r=await api.get('/register/check-username?username='+encodeURIComponent(clean));const avail=r?.data?.available??r?.available;setUnStatus(avail===true?'available':avail===false?'taken':null);if(avail===false)setErrors(e=>({...e,username:'Already taken'}));}catch{setUnStatus(null);}
    },500);
  };

  const handleEmail = v => {
    set('email',v); setEmailStatus(null);
    if(emailOtpSent||emailVerified){setEmailOtpSent(false);setEmailVerified(false);setEmailOtpValue('');setEmailOtpError('');}
    if(emailTimer.current) clearTimeout(emailTimer.current);
    if(!v||!/\S+@\S+\.\S+/.test(v)) return;
    setEmailStatus('checking');
    emailTimer.current=setTimeout(async()=>{
      try{const r=await api.get('/register/check-email?email='+encodeURIComponent(v.trim()));const avail=r?.data?.available??r?.available;setEmailStatus(avail===true?'available':avail===false?'taken':null);if(avail===false)setErrors(e=>({...e,email:'Already registered'}));}catch{setEmailStatus(null);}
    },600);
  };

  const handlePhone = v => {
    if(v.startsWith('0')) return;
    set('phone',v); setPhoneStatus(null);
    if(phoneTimer.current) clearTimeout(phoneTimer.current);
    if(v.length<10) return;
    setPhoneStatus('checking');
    phoneTimer.current=setTimeout(async()=>{
      try{const r=await api.get('/register/check-phone?phone='+encodeURIComponent(v));const avail=r?.data?.available??r?.available;setPhoneStatus(avail===true?'available':avail===false?'taken':null);if(avail===false)setErrors(e=>({...e,phone:'Already registered'}));}catch{setPhoneStatus(null);}
    },600);
  };

  // ── Email OTP ─────────────────────────────────────────────────────────────
  const startCooldown = (secs=60) => {
    setOtpCooldown(secs);
    if(otpCooldownRef.current) clearInterval(otpCooldownRef.current);
    otpCooldownRef.current=setInterval(()=>{
      setOtpCooldown(prev=>{if(prev<=1){clearInterval(otpCooldownRef.current);return 0;}return prev-1;});
    },1000);
  };
  const sendOtp = async () => {
    const email=form.email.trim();
    if(!email||!/\S+@\S+\.\S+/.test(email)){setEmailOtpError('Enter a valid email first');return;}
    if(emailStatus==='taken'){setEmailOtpError('This email is already registered');return;}
    setEmailOtpLoading(true); setEmailOtpError('');
    try{
      await api.post('/register/send-email-otp',{email});
      setEmailOtpSent(true); setEmailOtpValue(''); startCooldown(60);
      toast.success('OTP sent! Check your inbox.');
    }catch(err){const msg=err?.response?.data?.message||'Failed to send OTP';setEmailOtpError(msg);toast.error(msg);}
    finally{setEmailOtpLoading(false);}
  };
  const verifyOtp = async () => {
    if(emailOtpValue.length!==6){setEmailOtpError('Enter the 6-digit OTP');return;}
    setEmailOtpLoading(true); setEmailOtpError('');
    try{
      await api.post('/register/verify-email-otp',{email:form.email.trim(),otp:emailOtpValue});
      setEmailVerified(true); setEmailOtpError(''); setErrors(e=>({...e,email:''}));
      toast.success('Email verified!');
    }catch(err){setEmailOtpError(err?.response?.data?.message||'Invalid OTP');}
    finally{setEmailOtpLoading(false);}
  };

  // ── Identity handlers ─────────────────────────────────────────────────────
  const handlePAN      = raw => set('pan',       formatPAN(raw));
  const handlePassport = raw => set('passportNo', formatPassport(raw));
  const handleVoterId  = raw => set('voterId',    formatVoterId(raw));
  const handleABHA     = raw => set('abhaNumber', formatABHA(raw));
  const handleAadhaar  = raw => set('aadhaar',    raw.replace(/\D/g,'').slice(0,12));

  // ── Documents ─────────────────────────────────────────────────────────────
  const addDoc    = () => setDocuments(d=>[...d,{docType:'',file:null,fileName:'',expiryDate:'',notes:''}]);
  const removeDoc = i  => setDocuments(d=>d.filter((_,idx)=>idx!==i));
  const setDocF   = (i,k,v) => setDocuments(d=>d.map((doc,idx)=>idx===i?{...doc,[k]:v}:doc));
  const handleDocFile = (i,e) => {const f=e.target.files[0];if(f)setDocuments(d=>d.map((doc,idx)=>idx===i?{...doc,file:f,fileName:f.name}:doc));};

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = (s,f=form) => {
    const e={};
    if(s===1){
      if(!f.firstName.trim()) e.firstName='Required';
      if(!f.lastName.trim())  e.lastName='Required';
      if(!f.gender)           e.gender='Required';
      if(f.dateOfBirth){const de=validateDOB(f.dateOfBirth);if(de)e.dateOfBirth=de;}
      if(!f.email||!/\S+@\S+\.\S+/.test(f.email)) e.email='Valid email required';
      else if(emailStatus==='taken')  e.email='Email already registered';
      else if(!emailVerified)         e.email='Please verify your email with OTP';
      if(!f.phone)                    e.phone='Required';
      else if(f.phone.length!==10)    e.phone='Must be 10 digits';
      else if(phoneStatus==='taken')  e.phone='Already registered';
      if(!f.username.trim())          e.username='Required';
      else if(f.username.length<3)    e.username='Min 3 characters';
      else if(unStatus==='taken')     e.username='Already taken';
      if(!f.password)                 e.password='Required';
      else if(f.password.length<8)    e.password='Min 8 characters';
      else if(!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(f.password)) e.password='Need uppercase, lowercase & number';
      if(f.password!==f.confirmPassword) e.confirmPassword='Do not match';
    }
    if(s===2){
      if(!f.specializationId) e.specializationId='Required';
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

  const validate    = () => {const e=validateStep(step);setErrors(e);return Object.keys(e).length===0;};
  const validateAll = () => {
    const all={}; let firstErr=null;
    for(const s of [1,2,3]){const e=validateStep(s);if(Object.keys(e).length>0){Object.assign(all,e);if(!firstErr)firstErr=s;}}
    setErrors(all);
    if(firstErr&&firstErr!==step){setStep(firstErr);toast.error(`Please fix errors in Step ${firstErr}`);}
    return Object.keys(all).length===0;
  };

  const handleNext = () => {if(validate()){setCompletedSteps(prev=>prev.includes(step)?prev:[...prev,step]);setStep(s=>s+1);}};
  const handleBack = () => setStep(s=>s-1);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if(submitLock.current) return;
    if(!validateAll()) return;
    submitLock.current=true; setLoading(true);
    try{
      const orUndef = v => (v===''||v==null?undefined:v);
      const cleanAadhaar = form.aadhaar.replace(/\s/g,'');
      const cleanABHA    = form.abhaNumber.replace(/-/g,'');
      const payload = {
        hospitalId:1,
        firstName:form.firstName, lastName:form.lastName, gender:form.gender,
        dateOfBirth:orUndef(form.dateOfBirth), bloodGroup:orUndef(form.bloodGroup),
        nationality:orUndef(form.nationality), maritalStatus:orUndef(form.maritalStatus),
        religion:orUndef(form.religion), occupation:orUndef(form.occupation),
        motherTongue:orUndef(form.motherTongue), designation:orUndef(form.designation),
        email:form.email, phone:form.phone, phoneCountryCode:form.phoneCode,
        altPhone:orUndef(form.altPhone), username:form.username, password:form.password,
        specializationId:orUndef(form.specializationId), qualificationId:orUndef(form.qualificationId),
        departmentId:orUndef(form.departmentId), medicalCouncilId:orUndef(form.medicalCouncilId),
        experienceYears:form.experienceYears?Number(form.experienceYears):undefined,
        maxDailyPatients:form.maxDailyPatients?Number(form.maxDailyPatients):undefined,
        consultationFee:form.consultationFee?Number(form.consultationFee):undefined,
        followUpFee:form.followUpFee?Number(form.followUpFee):undefined,
        emergencyFee:form.emergencyFee?Number(form.emergencyFee):undefined,
        languagesSpoken:orUndef(form.languagesSpoken),
        bio:orUndef(form.bio), awards:orUndef(form.awards), publications:orUndef(form.publications),
        aadhaar:cleanAadhaar||undefined, pan:orUndef(form.pan),
        passportNo:orUndef(form.passportNo), voterId:orUndef(form.voterId),
        abhaNumber:cleanABHA||undefined,
        street1:form.street1, street2:orUndef(form.street2), city:form.city,
        pincode:orUndef(form.pincode),
        // send both the cca3 code and the name so backend can store either
        countryCode:orUndef(form.countryId),   // ISO alpha-3  e.g. "IND"
        countryName:orUndef(form.countryName), // human name   e.g. "India"
        stateId:orUndef(form.stateId),
        stateName:orUndef(form.stateName),
      };
      const hasFiles=documents.some(d=>d.file)||!!photoFile;
      if(hasFiles){
        const fd=new FormData();
        Object.entries(payload).forEach(([k,v])=>{if(v!=null)fd.append(k,String(v));});
        if(photoFile)fd.append('photo',photoFile);
        documents.forEach((doc,i)=>{
          if(doc.docType)    fd.append(`documents[${i}][docType]`,    doc.docType);
          if(doc.file)       fd.append(`documents[${i}][file]`,       doc.file);
          if(doc.expiryDate) fd.append(`documents[${i}][expiryDate]`, doc.expiryDate);
          if(doc.notes)      fd.append(`documents[${i}][notes]`,      doc.notes);
        });
        await api.post('/register/doctor',fd,{headers:{'Content-Type':'multipart/form-data'}});
      }else{
        await api.post('/register/doctor',payload);
      }
      setSuccess(true);
    }catch(err){
      toast.error(err?.response?.data?.message||err?.message||'Registration failed');
    }finally{setLoading(false);submitLock.current=false;}
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if(success) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:'linear-gradient(135deg,#eef2ff,#e0e7ff)'}}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={30} className="text-amber-500"/>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Submitted!</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Your registration is pending superadmin review.<br/>
          You'll receive an email once approved — usually within 1–2 business days.
        </p>
        <Link to="/login" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm" style={{background:primary}}>
          Back to Login
        </Link>
      </div>
    </div>
  );

  const str     = pwStrength(form.password);
  const pwMatch = form.confirmPassword ? form.password===form.confirmPassword : null;

  return (
    <div className="h-screen flex overflow-hidden" style={{background:'linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%)'}}>

      <Sidebar step={step} setStep={setStep} completedSteps={completedSteps}
        branding={branding} primary={primary} open={sidebarOpen} onToggle={()=>setSidebarOpen(o=>!o)}/>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ── Header ── */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100/50 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2">
              {branding?.logoUrl
                ?<img src={branding.logoUrl} alt="" className="w-7 h-7 rounded-lg object-contain"/>
                :<div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:primary}}><Activity size={14} className="text-white"/></div>}
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-slate-800">Doctor Registration</h1>
              <p className="text-[11px] text-slate-500">Step {step} of {STEPS.length} — {STEPS[step-1].label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {STEPS.map((s,i)=>(
              <div key={s.id} className="flex items-center gap-2">
                <div onClick={()=>setStep(s.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer hover:scale-110"
                  style={completedSteps.includes(s.id)?{background:'#22c55e',color:'#fff'}:step===s.id?{background:primary,color:'#fff'}:{background:'#f1f5f9',color:'#94a3b8'}}>
                  {completedSteps.includes(s.id)?<Check size={13}/>:s.id}
                </div>
                {i<STEPS.length-1&&<div className="w-8 h-0.5 rounded-full" style={{background:completedSteps.includes(s.id)?'#22c55e':'#e2e8f0'}}/>}
              </div>
            ))}
          </div>
          <Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft size={13}/> Login
          </Link>
        </header>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{scrollbarWidth:'thin',scrollbarColor:'#c7d2fe transparent'}}>

          {/* ═══════ STEP 1 ═══════ */}
          {step===1&&(
            <div className="max-w-3xl mx-auto">
              <TabNav tabs={STEP1_TABS} active={tab1} onChange={setTab1} primary={primary}/>

              {/* Personal */}
              {tab1==='personal'&&(
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div onClick={()=>photoRef.current?.click()}
                      className="w-16 h-16 rounded-full flex-shrink-0 cursor-pointer border-2 overflow-hidden flex items-center justify-center relative group"
                      style={{borderColor:photoPreview?primary:'#e2e8f0',background:photoPreview?'transparent':'#f8fafc'}}>
                      {photoPreview?<img src={photoPreview} alt="Doctor" className="w-full h-full object-cover"/>:<Camera size={20} className="text-slate-300"/>}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                        <Camera size={13} className="text-white"/>
                      </div>
                    </div>
                    <input ref={photoRef} type="file" accept="image/*"
                      onChange={e=>{const f=e.target.files[0];if(f){setPhotoPreview(URL.createObjectURL(f));setPhotoFile(f);}}} className="hidden"/>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <FL label="First Name" required error={errors.firstName}>
                        <FI err={!!errors.firstName} value={form.firstName}
                          onChange={e=>set('firstName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Priya"/>
                      </FL>
                      <FL label="Last Name" required error={errors.lastName}>
                        <FI err={!!errors.lastName} value={form.lastName}
                          onChange={e=>set('lastName',e.target.value.replace(/[^A-Za-z\s]/g,''))} placeholder="Mehta"/>
                      </FL>
                    </div>
                  </div>

                  <div className="grid gap-3" style={{gridTemplateColumns:'1fr 160px 100px 1fr'}}>
                    <FL label="Gender" required error={errors.gender}>
                      <SelectField err={!!errors.gender} value={form.gender} onChange={e=>set('gender',e.target.value)}>
                        <option value="">— Gender —</option>
                        {GENDERS.map(g=><option key={g}>{g}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Date of Birth" error={errors.dateOfBirth} hint={`${MIN_AGE}–${MAX_AGE} yrs`}>
                      <FI type="date" err={!!errors.dateOfBirth} value={form.dateOfBirth}
                        min={getMinDOB()} max={getMaxDOB()}
                        onChange={e=>{set('dateOfBirth',e.target.value);const de=validateDOB(e.target.value);if(de)setErrors(p=>({...p,dateOfBirth:de}));}}/>
                    </FL>
                    <FL label="Blood Grp">
                      <SelectField value={form.bloodGroup} onChange={e=>set('bloodGroup',e.target.value)}>
                        <option value="">—</option>
                        {BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Nationality">
                      <FI value={form.nationality} onChange={e=>set('nationality',e.target.value)} placeholder="Indian"/>
                    </FL>
                  </div>

                  <FL label="Designation">
                    <FI value={form.designation} onChange={e=>set('designation',e.target.value)} placeholder="e.g. Senior Consultant, Resident Doctor"/>
                  </FL>

                  <div className="grid grid-cols-4 gap-3">
                    <FL label="Marital Status">
                      <SelectField value={form.maritalStatus} onChange={e=>set('maritalStatus',e.target.value)}>
                        <option value="">—</option>{MARITAL.map(m=><option key={m}>{m}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Religion">
                      <SelectField value={form.religion} onChange={e=>set('religion',e.target.value)}>
                        <option value="">—</option>{RELIGIONS.map(r=><option key={r}>{r}</option>)}
                      </SelectField>
                    </FL>
                    <FL label="Mother Tongue">
                      <FI value={form.motherTongue} onChange={e=>set('motherTongue',e.target.value)} placeholder="Hindi"/>
                    </FL>
                    <FL label="Occupation">
                      <FI value={form.occupation} onChange={e=>set('occupation',e.target.value)} placeholder="Medical Professional"/>
                    </FL>
                  </div>
                </div>
              )}

              {/* Contact */}
              {tab1==='contact'&&(
                <div className="space-y-4">
                  <FL label="Mobile Number" required error={errors.phone}>
                    <PhoneField code={form.phoneCode} onCode={v=>set('phoneCode',v)}
                      val={form.phone} onChange={handlePhone} err={!!errors.phone||phoneStatus==='taken'}/>
                    {phoneStatus==='checking'  &&<div className="text-slate-400 text-[11px] mt-1 flex items-center gap-1"><div className="w-2.5 h-2.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin"/>Checking...</div>}
                    {phoneStatus==='taken'     &&<div className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><X size={9}/>Already registered</div>}
                    {phoneStatus==='available' &&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                  </FL>

                  <FL label="Alternate Phone">
                    <PhoneField code={form.phoneCode} onCode={()=>{}} val={form.altPhone} onChange={v=>set('altPhone',v)} placeholder="Optional"/>
                  </FL>

                  {/* Email + OTP */}
                  <FL label="Email Address" required error={!emailOtpSent&&errors.email}>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FI type="email"
                          err={!!errors.email||emailStatus==='taken'} ok={emailVerified}
                          value={form.email} onChange={e=>handleEmail(e.target.value)}
                          placeholder="dr.priya@email.com" className="pr-10"
                          disabled={emailVerified}/>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {emailVerified
                            ?<span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold"><Check size={9}/>Verified</span>
                            :<Dot status={emailStatus}/>}
                        </div>
                      </div>
                      {!emailVerified&&!emailOtpSent&&emailStatus==='available'&&(
                        <button type="button" onClick={sendOtp} disabled={emailOtpLoading}
                          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 whitespace-nowrap disabled:opacity-50"
                          style={{background:primary}}>
                          {emailOtpLoading?<><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending...</>:<><Mail size={12}/>Verify</>}
                        </button>
                      )}
                    </div>
                    {!emailOtpSent&&errors.email&&<div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.email}</div>}
                    {emailOtpSent&&!emailVerified&&(
                      <div className="mt-2 p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2">
                        <p className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                          <Mail size={10}/>OTP sent to <span className="font-bold ml-1">{form.email}</span>
                        </p>
                        <div className="flex gap-2">
                          <input value={emailOtpValue}
                            onChange={e=>{setEmailOtpValue(e.target.value.replace(/\D/g,'').slice(0,6));setEmailOtpError('');}}
                            placeholder="Enter 6-digit OTP" inputMode="numeric" maxLength={6}
                            className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-[13px] outline-none focus:border-indigo-400 font-mono tracking-widest bg-white placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-300"/>
                          <button type="button" onClick={verifyOtp} disabled={emailOtpLoading||emailOtpValue.length!==6}
                            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors">
                            {emailOtpLoading?<div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Verify'}
                          </button>
                        </div>
                        {emailOtpError&&<div className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={9}/>{emailOtpError}</div>}
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-400">Didn't receive it?</p>
                          {otpCooldown>0
                            ?<span className="text-[11px] text-slate-400 font-medium">Resend in {otpCooldown}s</span>
                            :<button type="button" onClick={sendOtp} disabled={emailOtpLoading}
                                className="text-[11px] text-indigo-600 font-semibold hover:underline disabled:opacity-50 flex items-center gap-1">
                                <RefreshCw size={10}/>Resend OTP
                              </button>}
                        </div>
                      </div>
                    )}
                    {emailVerified&&<div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold"><CheckCircle size={12} className="text-emerald-500"/>Email verified successfully</div>}
                  </FL>
                </div>
              )}

              {/* Credentials */}
              {tab1==='credentials'&&(
                <div className="space-y-4">
                  <div className="grid gap-3" style={{gridTemplateColumns:'240px 1fr'}}>
                    <FL label="Username" required error={errors.username}>
                      <div className="relative">
                        <FI err={!!errors.username||unStatus==='taken'} ok={unStatus==='available'}
                          value={form.username} onChange={e=>handleUsername(e.target.value)}
                          placeholder="dr.priya.mehta" className="pr-10"/>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2"><Dot status={unStatus}/></div>
                      </div>
                      {unStatus==='available'&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Available</div>}
                    </FL>
                    <div/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Password" required error={errors.password}>
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
                          placeholder="Re-enter password" className="pr-9"/>
                        <button type="button" onClick={()=>setShowConf(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showConf?<EyeOff size={14}/>:<Eye size={14}/>}
                        </button>
                      </div>
                      {pwMatch===true&&<div className="text-emerald-600 text-[11px] mt-1 flex items-center gap-1"><Check size={9}/>Passwords match</div>}
                    </FL>
                  </div>
                </div>
              )}

              <TabFooter tabs={STEP1_TABS} active={tab1} onChange={setTab1} primary={primary}/>
            </div>
          )}

          {/* ═══════ STEP 2 ═══════ */}
          {step===2&&(
            <div className="max-w-3xl mx-auto">
              <TabNav tabs={STEP2_TABS} active={tab2} onChange={setTab2} primary={primary}/>

              {/* Qualifications */}
              {tab2==='qualifications'&&(
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Specialization" required error={errors.specializationId}>
                      <SearchSelect value={form.specializationId} items={specs} placeholder="Select or type to add"
                        err={!!errors.specializationId}
                        onAddNew={name=>{const c={Id:`custom_spec_${Date.now()}`,Name:name};setSpecs(p=>[...p,c]);set('specializationId',c.Id);toast.success(`"${name}" added`);}}
                        addLabel="Add specialization" onChange={id=>set('specializationId',id)}/>
                      {errors.specializationId&&<div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.specializationId}</div>}
                    </FL>
                    <FL label="Qualification">
                      <SearchSelect value={form.qualificationId}
                        items={quals.map(q=>({...q,Name:`${q.Code||''} ${q.FullName??q.Name??''}`.trim()}))}
                        placeholder="Select or type to add"
                        onAddNew={name=>{const c={Id:`custom_qual_${Date.now()}`,Name:name};setQuals(p=>[...p,c]);set('qualificationId',c.Id);toast.success(`"${name}" added`);}}
                        addLabel="Add qualification" onChange={id=>set('qualificationId',id)}/>
                    </FL>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Department">
                      <SearchSelect value={form.departmentId} items={depts} placeholder="Select or type to add"
                        onAddNew={name=>{const c={Id:`custom_dept_${Date.now()}`,Name:name};setDepts(p=>[...p,c]);set('departmentId',c.Id);toast.success(`"${name}" added`);}}
                        addLabel="Add department" onChange={id=>set('departmentId',id)}/>
                    </FL>
                    <FL label="Medical Council (NMC / State)">
                      <SearchSelect value={form.medicalCouncilId} items={councils} placeholder="Select or type to add"
                        onAddNew={name=>{const c={Id:`custom_council_${Date.now()}`,Name:name};setCouncils(p=>[...p,c]);set('medicalCouncilId',c.Id);toast.success(`"${name}" added`);}}
                        addLabel="Add council" onChange={id=>set('medicalCouncilId',id)}/>
                    </FL>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FL label="Experience (Years)">
                      <FI type="number" value={form.experienceYears} onChange={e=>set('experienceYears',e.target.value)} placeholder="5" min={0} max={60}/>
                    </FL>
                    <FL label="Max Patients / Day">
                      <FI type="number" value={form.maxDailyPatients} onChange={e=>set('maxDailyPatients',e.target.value)} placeholder="30" min={1}/>
                    </FL>
                    <FL label="Languages Spoken">
                      <FI value={form.languagesSpoken} onChange={e=>set('languagesSpoken',e.target.value)} placeholder="Hindi, English"/>
                    </FL>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FL label="Consultation Fee (₹)">
                      <FI type="number" value={form.consultationFee} onChange={e=>set('consultationFee',e.target.value)} placeholder="500" min={0}/>
                    </FL>
                    <FL label="Follow-up Fee (₹)">
                      <FI type="number" value={form.followUpFee} onChange={e=>set('followUpFee',e.target.value)} placeholder="300" min={0}/>
                    </FL>
                    <FL label="Emergency Fee (₹)">
                      <FI type="number" value={form.emergencyFee} onChange={e=>set('emergencyFee',e.target.value)} placeholder="1000" min={0}/>
                    </FL>
                  </div>
                </div>
              )}

              {/* Identity */}
              {tab2==='identity'&&(
                <div className="space-y-4">
                  <FL label="Aadhaar Number" error={errors.aadhaar} hint={!errors.aadhaar?'Format: XXXX XXXX XXXX':undefined}>
                    <FI err={!!errors.aadhaar} value={formatAadhaar(form.aadhaar)} onChange={e=>handleAadhaar(e.target.value)}
                      placeholder="1234 5678 9012" inputMode="numeric" className="font-mono tracking-widest" maxLength={14}/>
                  </FL>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="PAN" error={errors.pan} hint={!errors.pan?'5 letters · 4 digits · 1 letter':undefined}>
                      <FI err={!!errors.pan} value={form.pan} onChange={e=>handlePAN(e.target.value)}
                        placeholder="ABCDE1234F" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                    </FL>
                    <FL label="ABHA Number" hint="Format: XX-XXXX-XXXX-XXXX">
                      <FI value={form.abhaNumber} onChange={e=>handleABHA(e.target.value)}
                        placeholder="12-3456-7890-1234" inputMode="numeric" className="font-mono tracking-wider" maxLength={19}/>
                    </FL>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label="Passport No." hint="1 letter + 7 digits">
                      <FI value={form.passportNo} onChange={e=>handlePassport(e.target.value)}
                        placeholder="A1234567" className="font-mono uppercase tracking-widest" maxLength={8} spellCheck={false}/>
                    </FL>
                    <FL label="Voter ID" hint="3 letters + 7 digits">
                      <FI value={form.voterId} onChange={e=>handleVoterId(e.target.value)}
                        placeholder="ABC1234567" className="font-mono uppercase tracking-widest" maxLength={10} spellCheck={false}/>
                    </FL>
                  </div>
                </div>
              )}

              {/* Profile */}
              {tab2==='profile'&&(
                <div className="space-y-4">
                  <FL label="Bio / About">
                    <FTA value={form.bio} onChange={e=>set('bio',e.target.value)} rows={4}
                      placeholder="Brief professional summary visible to patients…"/>
                  </FL>
                  <FL label="Awards & Recognition">
                    <FTA value={form.awards} onChange={e=>set('awards',e.target.value)} rows={3}
                      placeholder="e.g. Best Doctor Award 2022, AIIMS Gold Medal…"/>
                  </FL>
                  <FL label="Publications / Research">
                    <FTA value={form.publications} onChange={e=>set('publications',e.target.value)} rows={3}
                      placeholder="List published papers, journals or books…"/>
                  </FL>
                </div>
              )}

              <TabFooter tabs={STEP2_TABS} active={tab2} onChange={setTab2} primary={primary}/>
            </div>
          )}

          {/* ═══════ STEP 3 ═══════ */}
          {step===3&&(
            <div className="max-w-3xl mx-auto">
              <TabNav tabs={STEP3_TABS} active={tab3} onChange={setTab3} primary={primary}/>

              {/* ── Address ── */}
              {tab3==='address'&&(
                <div className="space-y-4">
                  <FL label="Street Line 1" required error={errors.street1}>
                    <FI err={!!errors.street1} value={form.street1} onChange={e=>set('street1',e.target.value)} placeholder="Building no., Street name"/>
                  </FL>
                  <FL label="Street Line 2">
                    <FI value={form.street2} onChange={e=>set('street2',e.target.value)} placeholder="Area, Landmark (optional)"/>
                  </FL>

                  <div className="grid grid-cols-2 gap-3">
                    {/* ── Country (REST Countries — cca3 codes) ── */}
                    <FL label="Country" required error={errors.countryId}>
                      {countriesLoading
                        ?<div className={`${inputBase} ${inputNorm} flex items-center gap-2 text-slate-400`}>
                            <Loader2 size={13} className="animate-spin"/><span>Loading countries…</span>
                          </div>
                        :<SearchSelect
                            value={form.countryId}
                            items={countries}
                            placeholder="Select country"
                            err={!!errors.countryId}
                            onChange={(id,name)=>{
                              set('countryId',id);
                              set('countryName',name);
                              set('stateId','');
                              set('stateName','');
                              setPincodeInfo(null);
                            }}/>}
                      {errors.countryId&&<div className="mt-1 flex items-center gap-1 text-[11px] text-red-500"><AlertCircle size={9}/>{errors.countryId}</div>}
                      {form.countryId&&!countriesLoading&&(
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-500 font-mono font-semibold">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 tracking-wider">{form.countryId}</span>
                          <span className="text-slate-400 font-normal">ISO 3166-1 alpha-3</span>
                        </div>
                      )}
                    </FL>

                    {/* ── State (CountriesNow) ── */}
                    <FL label="State / Province">
                      {statesLoading
                        ?<div className={`${inputBase} ${inputNorm} flex items-center gap-2 text-slate-400`}>
                            <Loader2 size={13} className="animate-spin"/><span>Loading states…</span>
                          </div>
                        :states.length>0
                          ?<SearchSelect
                              value={form.stateId}
                              items={states}
                              placeholder={form.countryName?'Select state':'Pick country first'}
                              disabled={!form.countryId}
                              onAddNew={name=>{set('stateName',name);set('stateId','custom_'+name);}}
                              addLabel="Add manually"
                              onChange={(id,name)=>{set('stateId',id);set('stateName',name);}}/>
                          :<FI
                              value={form.stateName}
                              onChange={e=>{set('stateName',e.target.value);set('stateId','manual_'+e.target.value);}}
                              placeholder="Type state / province"/>}
                    </FL>
                  </div>

                  <div className="grid gap-3" style={{gridTemplateColumns:'1fr 1fr 140px'}}>
                    <FL label="City" required error={errors.city}>
                      <FI err={!!errors.city} value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Mumbai"/>
                    </FL>
                    <div/>

                    {/* ── Pincode with India Post auto-fill ── */}
                    <FL label="Pincode" error={errors.pincode}
                      hint={!errors.pincode?(form.countryId==='IND'?'6 digits — auto-fills city & state':'6 digits'):undefined}>
                      <div className="relative">
                        <FI
                          err={!!errors.pincode}
                          ok={!!pincodeInfo}
                          value={form.pincode}
                          onChange={e=>handlePincodeChange(e.target.value)}
                          placeholder="400001"
                          inputMode="numeric"
                          maxLength={6}
                          className="font-mono tracking-wider text-center pr-8"/>
                        {pincodeLoading&&(
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            <Loader2 size={13} className="animate-spin text-indigo-400"/>
                          </div>
                        )}
                        {pincodeInfo&&!pincodeLoading&&(
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            <Check size={13} className="text-emerald-500"/>
                          </div>
                        )}
                      </div>
                      {pincodeInfo&&(
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                          <MapPin size={9}/>
                          <span className="truncate">{[pincodeInfo.locality, pincodeInfo.district].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                    </FL>
                  </div>

                  {/* Pincode auto-filled info banner */}
                  {pincodeInfo&&(
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                      <MapPin size={12} className="text-emerald-500 mt-0.5 flex-shrink-0"/>
                      <p className="text-[11px] text-emerald-700">
                        <span className="font-semibold">Auto-filled from pincode: </span>
                        {[pincodeInfo.locality, pincodeInfo.district, pincodeInfo.state].filter(Boolean).join(' → ')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Documents ── */}
              {tab3==='documents'&&(
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[12px] text-slate-500">Upload for admin verification — optional at this stage</p>
                    <button type="button" onClick={addDoc}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-[12px] transition-colors"
                      style={{borderColor:primary+'60',color:primary,background:primary+'08'}}>
                      <Plus size={12}/>Add Document
                    </button>
                  </div>
                  {documents.length===0&&(
                    <div className="border-2 border-dashed border-slate-100 rounded-xl p-10 text-center">
                      <Upload size={28} className="text-slate-200 mx-auto mb-3"/>
                      <p className="text-[13px] text-slate-400 mb-1">No documents added yet</p>
                      <p className="text-[11px] text-slate-300">Medical degree, NMC registration, ID proof, experience cert…</p>
                    </div>
                  )}
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {documents.map((doc,i)=>(
                      <div key={i} className="border border-slate-100 rounded-xl p-3.5 relative bg-slate-50/50">
                        <button type="button" onClick={()=>removeDoc(i)}
                          className="absolute top-3 right-3 p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={12}/>
                        </button>
                        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                          <FL label="Document Type">
                            <SelectField value={doc.docType} onChange={e=>setDocF(i,'docType',e.target.value)}>
                              <option value="">Select type</option>
                              {DOC_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                            </SelectField>
                          </FL>
                          <FL label="Expiry Date">
                            <FI type="date" value={doc.expiryDate} onChange={e=>setDocF(i,'expiryDate',e.target.value)} min={todayStr}/>
                          </FL>
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
                          placeholder="Notes (optional)" className="text-[12px]"/>
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
              )}

              <TabFooter tabs={STEP3_TABS} active={tab3} onChange={setTab3} primary={primary}/>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="bg-white/90 backdrop-blur-sm border-t border-indigo-100/50 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {step>1
              ?<button onClick={handleBack} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors">
                  <ArrowLeft size={14}/>Back
                </button>
              :<Link to="/login" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-indigo-600 transition-colors">
                  <ArrowLeft size={13}/>Back to Login
                </Link>}
          </div>
          <div>
            {step<STEPS.length
              ?<button onClick={handleNext}
                  className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-white text-[14px] font-semibold shadow-sm hover:opacity-90 transition-all"
                  style={{background:primary}}>
                  Save & Continue<ArrowRight size={15}/>
                </button>
              :<button onClick={handleSubmit} disabled={loading}
                  className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-white text-[14px] font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{background:primary}}>
                  {loading
                    ?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting…</>
                    :<><CheckCircle size={15}/>Submit Application</>}
                </button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
