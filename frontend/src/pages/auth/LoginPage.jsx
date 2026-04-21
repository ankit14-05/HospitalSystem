// src/pages/auth/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Activity, MapPin, Phone, ArrowRight,
  Stethoscope, Users, Briefcase, Shield,
  Bed, TrendingUp, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../config/roles';
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── Colour helpers ────────────────────────────────────────────────────────────
function shiftColor(hex, amt) {
  try {
    const n = parseInt((hex || '#6d28d9').replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (n >> 16)        + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff)        + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return hex || '#6d28d9'; }
}

// ── Floating stat card (left panel) ─────────────────────────────────────────
const FloatCard = ({ icon: Icon, value, label, delay }) => (
  <div
    className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/8 shadow-xl backdrop-blur-md"
    style={{ animation: `lp-up .65s ease both`, animationDelay: delay }}>
    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
      <Icon size={15} className="text-white" />
    </div>
    <div>
      <p className="text-white font-bold text-sm leading-none">{value}</p>
      <p className="text-white/45 text-xs mt-0.5">{label}</p>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const { branding } = useHospitalBranding(1);

  const [form, setForm]         = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [focused, setFocused]   = useState('');

  const year    = new Date().getFullYear();
  const primary = branding?.primaryColor || '#6d28d9';
  const deep    = shiftColor(primary, -65);
  const light   = shiftColor(primary, -20);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { setError('Please enter your username and password.'); return; }
    setLoading(true); setError('');
    try {
      const user = await login(form.username.trim(), form.password);
      if (user.role === 'patient') {
        navigate('/patient/profiles', { replace: true });
      } else {
        navigate(getDashboardPath(user.role), { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  const inputBase = (name) => ({
    onFocus: () => setFocused(name),
    onBlur:  () => setFocused(''),
  });

  return (
    <>
      {/* ── Keyframes ───────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes lp-up {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes lp-orb1 {
          0%,100% { transform:scale(1);    opacity:.12; }
          50%      { transform:scale(1.15); opacity:.06; }
        }
        @keyframes lp-orb2 {
          0%,100% { transform:translate(0,0); }
          40%     { transform:translate(14px,-10px); }
          80%     { transform:translate(-8px,12px); }
        }
        .lp-field {
          position:relative;
          background:#fff;
          border-radius:16px;
          border:1.5px solid #e2e8f0;
          box-shadow:0 1px 3px rgba(0,0,0,.04);
          transition:border-color .2s,box-shadow .2s;
          overflow:hidden;
        }
        .lp-field.active {
          border-color: ${primary}88;
          box-shadow: 0 0 0 3px ${primary}18, 0 1px 3px rgba(0,0,0,.04);
        }
        .lp-field::after {
          content:'';
          position:absolute;
          bottom:0;left:0;
          height:2px;width:0;
          background:${primary};
          transition:width .3s ease;
          border-radius:0 0 16px 16px;
        }
        .lp-field.active::after { width:100%; }
        .lp-submit {
          background: linear-gradient(135deg, ${primary} 0%, ${light} 100%);
          transition: transform .18s ease, box-shadow .18s ease, opacity .18s;
        }
        .lp-submit:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px ${primary}50;
        }
        .lp-submit:not(:disabled):active { transform:translateY(0); }
        .lp-reg:hover {
          border-color: ${primary}55;
          background: ${primary}0a;
          transform:translateY(-2px);
          box-shadow:0 6px 18px rgba(0,0,0,.08);
        }
        .lp-reg { transition: all .2s ease; }
      `}</style>

      {/* Root: fixed full viewport, no overflow */}
      <div className="h-screen w-screen flex overflow-hidden" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>

        {/* ═══════════════ LEFT — Immersive brand panel ═══════════════════ */}
        <div
          className="hidden lg:flex lg:w-[46%] xl:w-[44%] flex-col relative overflow-hidden flex-shrink-0"
          style={{ background:`linear-gradient(155deg, ${primary} 0%, ${deep} 100%)` }}>

          {/* Animated orbs */}
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white pointer-events-none"
            style={{ opacity:.1, animation:'lp-orb1 7s ease-in-out infinite' }} />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-white pointer-events-none"
            style={{ opacity:.07, animation:'lp-orb1 9s ease-in-out infinite reverse' }} />
          <div className="absolute top-1/3 left-1/2 w-[500px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white pointer-events-none"
            style={{ opacity:.04, animation:'lp-orb2 14s ease-in-out infinite' }} />

          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:'radial-gradient(rgba(255,255,255,.35) 1px, transparent 1px)',
              backgroundSize:'26px 26px',
              opacity:.08,
            }} />

          {/* Diagonal sheen */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -right-16 top-0 bottom-0 w-32 opacity-10"
              style={{ background:'linear-gradient(to bottom,transparent,white 50%,transparent)', transform:'skewX(-6deg)' }} />
          </div>

          <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">

            {/* Logo */}
            <div className="flex items-center gap-3.5 mb-10"
              style={{ animation:'lp-up .55s ease both' }}>
              {branding?.logoUrl
                ? <img src={branding.logoUrl} alt="logo"
                    className="w-12 h-12 rounded-2xl object-contain bg-white/15 border border-white/20 p-1.5" />
                : <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Activity size={22} className="text-white" strokeWidth={2.5} />
                  </div>
              }
              <div>
                <p className="text-white font-bold text-xl leading-tight">{branding?.name || 'MediCore HMS'}</p>
                <p className="text-white/40 text-xs tracking-wide">{branding?.shortName || 'Hospital Management System'}</p>
              </div>
            </div>

            {/* Headline */}
            <div className="mb-8" style={{ animation:'lp-up .55s ease .08s both' }}>
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-sm mb-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation:'lp-orb1 2s ease-in-out infinite' }} />
                <span className="text-white/75 text-xs font-semibold tracking-wide">All Systems Operational</span>
              </div>

              <h2 className="text-white font-bold leading-[1.12] mb-3" style={{ fontSize:'clamp(24px,2.6vw,34px)' }}>
                Smarter Hospital<br />
                Operations,<br />
                <span className="text-white/40">All in One Place.</span>
              </h2>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                Unified clinical, financial, and administrative workflows for modern healthcare teams.
              </p>
            </div>

            {/* Stat cards */}
            <div className="space-y-2 mb-8">
              {branding?.bedCapacity && (
                <FloatCard icon={Bed}        value={`${branding.bedCapacity}+ Beds`} label="Total hospital capacity"  delay=".18s" />
              )}
              <FloatCard   icon={TrendingUp} value="Real-time Dashboards"           label="Live analytics & reports"  delay=".34s" />
              {branding?.emergencyNumber && (
                <FloatCard icon={Phone}      value={branding.emergencyNumber}       label="24/7 Emergency line"       delay=".42s" />
              )}
            </div>

            {/* Role access */}
            <div className="mt-auto" style={{ animation:'lp-up .55s ease .5s both' }}>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-[.15em] mb-3">Role-based access</p>
              <div className="flex flex-wrap gap-2">
                {['Admin','Doctor','Nurse','Receptionist','Pharmacist','Lab Tech','Patient'].map(r => (
                  <span key={r}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/12 text-white/70 bg-white/08 backdrop-blur-sm">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/10"
              style={{ animation:'lp-up .55s ease .6s both' }}>
              {branding?.city && (
                <div className="flex items-center gap-2 text-white/30 text-xs mb-1">
                  <MapPin size={10} />
                  <span>{[branding.city, branding.stateName].filter(Boolean).join(', ')}</span>
                </div>
              )}
              <p className="text-white/20 text-xs">© {year} {branding?.name || 'MediCore HMS'} · All rights reserved</p>
            </div>
          </div>
        </div>

        {/* ═══════════════ RIGHT — Login form (no scroll) ════════════════ */}
        <div className="flex-1 flex items-center justify-center bg-slate-50 overflow-hidden">
          <div className="w-full max-w-[400px] px-6" style={{ animation:'lp-up .6s ease .12s both' }}>

            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-7 lg:hidden">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:primary }}>
                <Activity size={17} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-800 text-base">{branding?.name || 'MediCore HMS'}</span>
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-tight mb-1">Welcome back</h2>
              <p className="text-slate-400 text-sm">Sign in to access your workspace</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-start gap-3 p-3.5 rounded-2xl bg-red-50 border border-red-100">
                <div className="w-5 h-5 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-red-500 font-bold text-xs">!</div>
                <p className="text-red-600 text-sm leading-snug">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">

              {/* Username */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-[.1em] mb-1.5">
                  Username or Email
                </label>
                <div className={`lp-field ${focused === 'u' ? 'active' : ''}`}>
                  <div className="flex items-center gap-3 px-4 py-[13px]">
                    <svg width="15" height="15" fill="none"
                      stroke={focused === 'u' ? primary : '#cbd5e1'}
                      strokeWidth="2" viewBox="0 0 24 24"
                      style={{ flexShrink:0, transition:'stroke .2s' }}>
                      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                    <input
                      value={form.username}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      {...inputBase('u')}
                      className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-300 outline-none font-medium"
                      placeholder="e.g. superadmin or you@hospital.com"
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-[.1em]">Password</label>
                  <Link to="/forgot-password"
                    className="text-xs font-bold hover:underline"
                    style={{ color:primary }}>
                    Forgot password?
                  </Link>
                </div>
                <div className={`lp-field ${focused === 'p' ? 'active' : ''}`}>
                  <div className="flex items-center gap-3 px-4 py-[13px]">
                    <svg width="15" height="15" fill="none"
                      stroke={focused === 'p' ? primary : '#cbd5e1'}
                      strokeWidth="2" viewBox="0 0 24 24"
                      style={{ flexShrink:0, transition:'stroke .2s' }}>
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      {...inputBase('p')}
                      className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-300 outline-none font-medium"
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="lp-submit w-full flex items-center justify-center gap-2.5 py-[14px] rounded-2xl font-bold text-white text-sm disabled:opacity-60 mt-1">
                {loading
                  ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Signing in…</>
                  : <>Sign in <ArrowRight size={15} /></>
                }
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-slate-300 text-xs font-semibold tracking-wide">NEW HERE?</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Register cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { to:'/register/patient', label:'Patient', icon:Users },
                { to:'/register/doctor',  label:'Doctor',  icon:Stethoscope },
                { to:'/register/staff',   label:'Staff',   icon:Briefcase },
              ].map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to}
                  className="lp-reg flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs font-bold text-slate-600">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background:`${primary}14` }}>
                    <Icon size={14} style={{ color:primary }} />
                  </div>
                  {label}
                </Link>
              ))}
            </div>

            {/* Dev credentials */}
            {import.meta.env.DEV && (
              <div className="mt-4 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield size={11} className="text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Dev credentials</span>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-xs font-mono text-slate-500"><span className="text-slate-300">user </span><strong className="text-slate-700">superadmin</strong></p>
                  <p className="text-xs font-mono text-slate-500"><span className="text-slate-300">pass </span><strong className="text-slate-700">Admin@123</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
