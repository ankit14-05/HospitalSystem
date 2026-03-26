import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  HeartPulse,
  Smartphone,
  UserRoundPlus,
  Activity,
  ChevronDown,
  X,
  Search,
  PenLine,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import useHospitalBranding from '../../hooks/useHospitalBranding';

const REGISTRATION_FEE = 200;

const RELATION_OPTIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'InLaw', 'Other'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'PreferNot'];

const IDENTITY_OPTIONS = ['Aadhar Card', 'PAN Card', 'Passport', 'Voter ID'];
const PAYMENT_METHODS = [
  { id: 'card', label: 'Card Payment', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'net', label: 'Net Banking', icon: Building2 },
];

const TAB_META = [
  { id: 1, label: 'Personal Details', icon: UserRoundPlus },
  { id: 2, label: 'Clinical & Identity', icon: HeartPulse },
  { id: 3, label: 'Payment', icon: CreditCard },
];

// Input classes for compact UI
const inputBase = 'w-full rounded-lg border px-3 py-2 text-[13px] text-slate-800 outline-none transition-colors placeholder:text-slate-400';
const inputNorm = 'border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const inputErr = 'border-rose-400 bg-rose-50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100';

const labelClass = 'text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1';

const INITIAL_FORM = {
  relationshipToUser: 'Child',
  firstName: '',
  lastName: '',
  gender: 'Male',
  dateOfBirth: '',
  dateOfArrival: '',
  phoneCountryCode: '+91',
  phone: '',
  email: '',
  street1: '',
  street2: '',
  city: '',
  stateName: '',
  countryCode: 'IND',
  countryName: 'India',
  pincodeText: '',
  emergencyName: '',
  emergencyRelation: '',
  emergencyPhone: '',
  insuranceProvider: '',
  insurancePolicyNo: '',
  insuranceValidUntil: '',
  idType: '',
  idNumber: '',
  knownAllergies: '',
  currentMedications: '',
  pastSurgery: 'no',
  pastSurgeryDetails: '',
};

function Field({ label, hint, children }) {
  return (
    <div className="space-y-0.5">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <p className="text-[11px] font-semibold mt-1 flex text-rose-500">{hint}</p> : null}
    </div>
  );
}

// ── GeoSelect Component ────────────────────────────────────────────────────────
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
          <span className={`truncate ${displayLabel ? 'text-slate-800' : 'text-slate-400'}`} style={{ fontSize: 13 }}>
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

function PaymentMethodCard({ method, selected, onSelect, primaryColor }) {
  const Icon = method.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(method.id)}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
        selected ? 'shadow-sm' : 'bg-white hover:bg-slate-50'
      }`}
      style={{
         borderColor: selected ? primaryColor : '#e2e8f0',
         backgroundColor: selected ? `${primaryColor}0C` : '#fff',
      }}
    >
      <div className="flex items-center justify-center h-8 w-8 rounded-lg"
         style={{ backgroundColor: selected ? primaryColor : '#f1f5f9', color: selected ? '#fff' : '#64748b' }}
      >
        <Icon size={16} />
      </div>
      <span className={`text-[13px] font-bold ${selected ? 'text-slate-900' : 'text-slate-600'}`}>{method.label}</span>
    </button>
  );
}

function TabNav({ tabs, activeStep, onChange, primary }) {
  return (
    <div className="flex gap-1.5 bg-slate-100/80 rounded-[14px] p-1 mb-5 border border-slate-200/60 max-w-fit">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = tab.id === activeStep;
        return (
          <button key={tab.id} type="button" onClick={() => onChange(tab.id)}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer"
            style={isActive
              ? { background: '#fff', color: primary, boxShadow: '0 2px 5px rgba(0,0,0,0.06)' }
              : { color: '#64748b' }}>
            <Icon size={15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AddFamilyMemberPage() {
  const navigate = useNavigate();
  const { branding } = useHospitalBranding(1);
  const primary = branding?.primaryColor || '#6d28d9';
  const { addFamilyMember } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(INITIAL_FORM);
  const [payMethod, setPayMethod] = useState('card');
  const [payLater, setPayLater] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState({ name: '', account: '', ifsc: '' });

  // ── Geo States ──
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [statesLoading, setStatesLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // Load countries
  useEffect(() => {
    setCountriesLoading(true);
    fetch('https://restcountries.com/v3.1/all?fields=name,cca3,flag')
      .then(r => r.json())
      .then(data => {
        const sorted = data.map(c => ({ code: c.cca3, name: c.name.common, flag: c.flag || '' }))
          .sort((a, b) => {
            if (a.code === 'IND') return -1;
            if (b.code === 'IND') return 1;
            return a.name.localeCompare(b.name);
          });
        setCountries(sorted);
      })
      .catch(() => setCountries([{code:'IND',name:'India',flag:'🇮🇳'}]))
      .finally(() => setCountriesLoading(false));
  }, []);

  // Load states when country changes
  useEffect(() => {
    setStates([]);
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

  // India Pincode Autofill
  const pincodeTimer = useRef(null);
  useEffect(() => {
    if (pincodeTimer.current) clearTimeout(pincodeTimer.current);
    if (!form.pincodeText || form.pincodeText.length !== 6 || form.countryCode !== 'IND') return;

    setPincodeLoading(true);
    pincodeTimer.current = setTimeout(() => {
      fetch(`https://api.postalpincode.in/pincode/${form.pincodeText}`)
        .then(r => r.json())
        .then(data => {
          const result = data?.[0];
          if (result?.Status === 'Success' && result.PostOffice?.length > 0) {
            const po = result.PostOffice[0];
            setForm(f => ({ ...f, city: po.District || f.city, stateName: po.State || f.stateName }));
            setErrors(e => ({ ...e, city: '', stateName: '' }));
            toast.success(`📍 Autofilled: ${po.District}, ${po.State}`);
          }
        })
        .finally(() => setPincodeLoading(false));
    }, 400);

    return () => clearTimeout(pincodeTimer.current);
  }, [form.pincodeText, form.countryCode]);

  const ageText = useMemo(() => {
    if (!form.dateOfBirth) return 'Pending';
    const dob = new Date(form.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return 'Pending';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
    return age >= 0 ? `${age} years` : 'Pending';
  }, [form.dateOfBirth]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const validateStep = (currentStep) => {
    const nextErrors = {};

    if (currentStep === 1) {
      if (!form.relationshipToUser) nextErrors.relationshipToUser = 'Required';
      if (!form.firstName.trim()) nextErrors.firstName = 'Required';
      if (!form.lastName.trim()) nextErrors.lastName = 'Required';
      if (!form.gender) nextErrors.gender = 'Required';
      if (!form.dateOfBirth) nextErrors.dateOfBirth = 'Required';
      if (!form.phone.trim()) nextErrors.phone = 'Required';
      if (!form.city.trim()) nextErrors.city = 'Required';
      if (!form.pincodeText.trim()) nextErrors.pincodeText = 'Required';
      if (!form.emergencyName.trim()) nextErrors.emergencyName = 'Required';
      if (!form.emergencyPhone.trim()) nextErrors.emergencyPhone = 'Required';
    }

    if (currentStep === 2) {
      if (form.idType && !form.idNumber.trim()) nextErrors.idNumber = 'Required';
      if (form.pastSurgery === 'yes' && !form.pastSurgeryDetails.trim()) {
        nextErrors.pastSurgeryDetails = 'Provide details';
      }
    }

    if (currentStep === 3 && !payLater) {
      if (payMethod === 'card') {
        if (!card.number.replace(/\D/g, '')) nextErrors.cardNumber = 'Required';
        if (!card.expiry.trim()) nextErrors.cardExpiry = 'Required';
        if (!card.name.trim()) nextErrors.cardName = 'Required';
      }
      if (payMethod === 'upi' && !upiId.trim()) nextErrors.upiId = 'Required';
      if (payMethod === 'net') {
        if (!bank.name.trim()) nextErrors.bankName = 'Required';
        if (!bank.account.trim()) nextErrors.bankAccount = 'Required';
        if (!bank.ifsc.trim()) nextErrors.bankIfsc = 'Required';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goBack = () => setStep((current) => Math.max(1, current - 1));

  const goNext = () => {
    if (validateStep(step)) setStep((current) => Math.min(3, current + 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    Object.keys(INITIAL_FORM).forEach(k => validateStep(1)); // Fast way to trigger highlights
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
       toast.error("Please fill all required fields in all tabs.");
       return;
    }

    setSaving(true);
    try {
      await addFamilyMember({ ...form, registrationFee: REGISTRATION_FEE, payMethod, payLater, card, upiId, bank });
      navigate('/patient/profiles', { replace: true });
    } catch (error) {
      toast.error(error.message || 'Failed to add patient profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
       
      {/* ── Top Header ─────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: primary }}>
                {branding?.logoUrl ? <img src={branding.logoUrl} alt="Logo" className="w-4 h-4 object-contain filter invert" /> : <Activity size={14} strokeWidth={2.5} />}
             </div>
             <span className="font-extrabold text-[15px] text-slate-900 tracking-tight">{branding?.name || 'MediCore HMS'}</span>
          </div>
          
          <button onClick={() => navigate('/patient/profiles')} 
            className="text-[12px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </header>

      {/* ── Main Canvas ─────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6">
        
        {/* Compact Title Header */}
        <div className="mb-4">
          <h1 className="text-[24px] font-black text-slate-900 tracking-tight mb-1">Register Family Member</h1>
        </div>

        {/* ── Tab Navigation (Free Clicking allowed) ── */}
        <TabNav tabs={TAB_META} activeStep={step} onChange={(newStep) => {
           // We just set the step instantly so they can navigate
           setStep(newStep);
        }} primary={primary} />
        
        {/* ── Form Section ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[20px] p-5 sm:p-6 border border-slate-200 shadow-sm">
          <div className="min-h-[300px]">
          
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <Field label="Relationship" hint={errors.relationshipToUser}>
                    <select value={form.relationshipToUser} onChange={(e) => updateField('relationshipToUser', e.target.value)} className={`${inputBase} ${errors.relationshipToUser?inputErr:inputNorm}`}>
                      {RELATION_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
                    </select>
                  </Field>
                  <Field label="Date of Arrival">
                    <input type="date" value={form.dateOfArrival} onChange={(e) => updateField('dateOfArrival', e.target.value)} className={`${inputBase} ${inputNorm}`} />
                  </Field>
                </div>
                
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <Field label="First Name" hint={errors.firstName}>
                    <input value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} className={`${inputBase} ${errors.firstName?inputErr:inputNorm}`} placeholder="e.g. John" />
                  </Field>
                  <Field label="Last Name" hint={errors.lastName}>
                    <input value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} className={`${inputBase} ${errors.lastName?inputErr:inputNorm}`} placeholder="e.g. Doe" />
                  </Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                  <Field label="Gender" hint={errors.gender}>
                    <select value={form.gender} onChange={(e) => updateField('gender', e.target.value)} className={`${inputBase} ${errors.gender?inputErr:inputNorm}`}>
                      {GENDER_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
                    </select>
                  </Field>
                  <Field label="Date of Birth" hint={errors.dateOfBirth}>
                    <input type="date" value={form.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.target.value)} className={`${inputBase} ${errors.dateOfBirth?inputErr:inputNorm}`} />
                  </Field>
                  <Field label="Calculated Age">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-500">{ageText}</div>
                  </Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                   <Field label="Mobile Phone" hint={errors.phone}>
                      <div className="flex gap-2">
                        <input value={form.phoneCountryCode} onChange={(e) => updateField('phoneCountryCode', e.target.value)} className={`${inputBase} ${inputNorm} w-[65px] text-center font-medium`} />
                        <input value={form.phone} onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className={`${inputBase} ${errors.phone?inputErr:inputNorm} flex-1 font-medium`} placeholder="9876543210" />
                      </div>
                   </Field>
                   <Field label="Email Address">
                      <input value={form.email} onChange={(e) => updateField('email', e.target.value)} className={`${inputBase} ${inputNorm}`} placeholder="support@medicore.com" />
                   </Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
                  <Field label="Country">
                    <GeoSelect items={countries} value={form.countryCode} loading={countriesLoading} placeholder="Select country"
                      onChange={(code, name) => { updateField('countryCode', code); updateField('countryName', name); updateField('stateName', ''); }} />
                  </Field>
                  <Field label="State / Province">
                     <GeoSelect items={states} value={form.stateName} loading={statesLoading} placeholder="Select state" disabled={!form.countryCode}
                       onChange={(code, name) => updateField('stateName', name)} onAddManually={(val) => updateField('stateName', val)} addLabel="Add custom state" />
                  </Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <Field label="Address Line 1"><input value={form.street1} onChange={(e) => updateField('street1', e.target.value)} className={`${inputBase} ${inputNorm}`} /></Field>
                  <Field label="Address Line 2"><input value={form.street2} onChange={(e) => updateField('street2', e.target.value)} className={`${inputBase} ${inputNorm}`} /></Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <Field label="Pincode" hint={errors.pincodeText}>
                    <div className="relative">
                      <input value={form.pincodeText} onChange={(e) => updateField('pincodeText', e.target.value.replace(/\D/g, '').slice(0, 6))} className={`${inputBase} ${errors.pincodeText?inputErr:inputNorm}`} />
                      {pincodeLoading && <div className="absolute right-3 top-2.5 w-4 h-4 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />}
                    </div>
                  </Field>
                  <Field label="City" hint={errors.city}><input value={form.city} onChange={(e) => updateField('city', e.target.value)} className={`${inputBase} ${errors.city?inputErr:inputNorm}`} /></Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3 pt-2 border-t border-slate-100 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                  <Field label="Emergency Contact" hint={errors.emergencyName}><input value={form.emergencyName} onChange={(e) => updateField('emergencyName', e.target.value)} className={`${inputBase} ${errors.emergencyName?inputErr:inputNorm}`} placeholder="Name" /></Field>
                  <Field label="Relation"><input value={form.emergencyRelation} onChange={(e) => updateField('emergencyRelation', e.target.value)} className={`${inputBase} ${inputNorm}`} placeholder="e.g. Spouse" /></Field>
                  <Field label="Emergency Phone" hint={errors.emergencyPhone}><input value={form.emergencyPhone} onChange={(e) => updateField('emergencyPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} className={`${inputBase} ${errors.emergencyPhone?inputErr:inputNorm}`} placeholder="9876543210" /></Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Field label="Insurance Provider"><input value={form.insuranceProvider} onChange={(e) => updateField('insuranceProvider', e.target.value)} className={`${inputBase} ${inputNorm}`} placeholder="E.g. Star Health" /></Field>
                  <Field label="Policy No"><input value={form.insurancePolicyNo} onChange={(e) => updateField('insurancePolicyNo', e.target.value)} className={`${inputBase} ${inputNorm}`} /></Field>
                  <Field label="Valid Until"><input type="date" value={form.insuranceValidUntil} onChange={(e) => updateField('insuranceValidUntil', e.target.value)} className={`${inputBase} ${inputNorm}`} /></Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
                  <Field label="Identity Type">
                    <select value={form.idType} onChange={(e) => updateField('idType', e.target.value)} className={`${inputBase} ${inputNorm}`}>
                      <option value="">Select ID Type</option>
                      {IDENTITY_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
                    </select>
                  </Field>
                  <Field label="Identity Number" hint={errors.idNumber}>
                     <input value={form.idNumber} onChange={(e) => updateField('idNumber', e.target.value)} className={`${inputBase} ${errors.idNumber?inputErr:inputNorm}`} />
                  </Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
                  <Field label="Known Allergies">
                    <textarea rows={2} value={form.knownAllergies} onChange={(e) => updateField('knownAllergies', e.target.value)} className={`${inputBase} ${inputNorm} resize-none`} placeholder="Dust, Peanuts..." />
                  </Field>
                  <Field label="Current Medications">
                    <textarea rows={2} value={form.currentMedications} onChange={(e) => updateField('currentMedications', e.target.value)} className={`${inputBase} ${inputNorm} resize-none`} placeholder="List prescriptions" />
                  </Field>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Field label="Past Surgery">
                    <select value={form.pastSurgery} onChange={(e) => updateField('pastSurgery', e.target.value)} className={`${inputBase} ${inputNorm}`}>
                      <option value="no">No History</option>
                      <option value="yes">Yes, Previously</option>
                    </select>
                  </Field>
                  <Field label="Surgery Details" hint={errors.pastSurgeryDetails}>
                    <input value={form.pastSurgeryDetails} onChange={(e) => updateField('pastSurgeryDetails', e.target.value)} className={`${inputBase} ${errors.pastSurgeryDetails?inputErr:inputNorm}`} disabled={form.pastSurgery !== 'yes'} placeholder="If yes, specify..." />
                  </Field>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-row items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <div>
                    <h3 className="text-[14px] font-black text-slate-900">Registration Fee</h3>
                    <p className="text-[11px] font-semibold text-slate-500">Standard one-time activation.</p>
                  </div>
                  <span className="text-[20px] font-black" style={{ color: primary }}>₹{REGISTRATION_FEE}</span>
                </div>

                <div className="grid gap-3 grid-cols-3">
                  {PAYMENT_METHODS.map((method) => (
                    <PaymentMethodCard key={method.id} method={method} selected={!payLater && payMethod === method.id} onSelect={setPayMethod} primaryColor={primary} />
                  ))}
                </div>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition drop-shadow-sm">
                  <div>
                    <p className="text-[13px] font-extrabold text-slate-900 leading-none mb-1">Mark as Pay Later</p>
                    <p className="text-[11px] font-semibold text-slate-500 leading-none">Complete payment at the reception.</p>
                  </div>
                  <input type="checkbox" checked={payLater} onChange={(e) => setPayLater(e.target.checked)} className="h-4 w-4 rounded-md border-slate-300 pointer-events-none" style={{ accentColor: primary }} />
                </label>

                {!payLater && payMethod === 'card' && (
                  <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 pt-2">
                    <Field label="Card Number" hint={errors.cardNumber}>
                      <input value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 19) }))} className={`${inputBase} ${errors.cardNumber?inputErr:inputNorm}`} placeholder="0000 0000 0000 0000" />
                    </Field>
                    <Field label="Cardholder Name" hint={errors.cardName}>
                      <input value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} className={`${inputBase} ${errors.cardName?inputErr:inputNorm}`} placeholder="John Doe" />
                    </Field>
                    <Field label="Expiry Date" hint={errors.cardExpiry}>
                      <input value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} className={`${inputBase} ${errors.cardExpiry?inputErr:inputNorm}`} placeholder="MM/YY" />
                    </Field>
                    <Field label="CVV Code">
                      <input type="password" value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))} className={`${inputBase} ${inputNorm}`} placeholder="***" />
                    </Field>
                  </div>
                )}

                {!payLater && payMethod === 'upi' && (
                  <div className="pt-2 max-w-sm"><Field label="UPI ID" hint={errors.upiId}><input value={upiId} onChange={(e) => setUpiId(e.target.value)} className={`${inputBase} ${errors.upiId?inputErr:inputNorm}`} placeholder="name@bank" /></Field></div>
                )}

                {!payLater && payMethod === 'net' && (
                  <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3 pt-2">
                    <Field label="Bank Name" hint={errors.bankName}><input value={bank.name} onChange={(e) => setBank((c) => ({ ...c, name: e.target.value }))} className={`${inputBase} ${errors.bankName?inputErr:inputNorm}`} placeholder="HDFC, SBI..." /></Field>
                    <Field label="Account No" hint={errors.bankAccount}><input value={bank.account} onChange={(e) => setBank((c) => ({ ...c, account: e.target.value.replace(/\D/g, '').slice(0, 18) }))} className={`${inputBase} ${errors.bankAccount?inputErr:inputNorm}`} placeholder="0000000000" /></Field>
                    <Field label="IFSC Code" hint={errors.bankIfsc}><input value={bank.ifsc} onChange={(e) => setBank((c) => ({ ...c, ifsc: e.target.value.toUpperCase() }))} className={`${inputBase} ${errors.bankIfsc?inputErr:inputNorm}`} placeholder="HDFC000123" /></Field>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Pagination Footer ── */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
            <button type="button" onClick={goBack} disabled={step === 1} className={`inline-flex items-center text-[12px] font-bold px-3 py-1.5 rounded-md transition-colors ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-500 hover:bg-slate-100'}`}>
              <ArrowLeft size={13} className="mr-1" /> Back
            </button>
            
            {step < 3 ? (
              <button type="button" onClick={goNext} className="inline-flex items-center px-4 py-2 text-[12px] font-bold text-white rounded-lg shadow-sm" style={{ background: primary }}>
                Next <ArrowRight size={13} className="ml-1.5" />
              </button>
            ) : (
              <button type="submit" disabled={saving} className="inline-flex items-center px-4 py-2 text-[12px] font-bold text-white rounded-lg shadow-sm disabled:opacity-60" style={{ background: '#10B981' }}>
                {saving ? 'Saving...' : 'Complete Registration'}
                {!saving && <CheckCircle2 size={13} className="ml-1.5" />}
              </button>
            )}
          </div>
        </form>

      </main>
    </div>
  );
}
