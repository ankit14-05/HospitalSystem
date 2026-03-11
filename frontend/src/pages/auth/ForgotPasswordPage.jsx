// src/pages/auth/ForgotPasswordPage.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, Mail, Phone, ArrowLeft, Send, CheckCircle,
  AlertCircle, Eye, EyeOff, Lock, RefreshCw, ShieldCheck,
  Shield, Clock, Key
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';

// ── OTP 6-box input ───────────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputRefs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  const focusBox = (i) => { if (i >= 0 && i < 6) inputRefs.current[i]?.focus(); };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) { next[i] = ''; onChange(next.join('')); }
      else if (i > 0) { next[i - 1] = ''; onChange(next.join('')); focusBox(i - 1); }
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = [...digits];
      next[i] = e.key; onChange(next.join(''));
      if (i < 5) focusBox(i + 1);
    } else if (e.key === 'ArrowLeft')  { e.preventDefault(); focusBox(i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); focusBox(i + 1); }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(Array.from({ length: 6 }, (_, i) => pasted[i] || '').join(''));
    focusBox(Math.min(pasted.length, 5));
  };

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text" inputMode="numeric"
          autoComplete="off" name={`otp-${i}`} maxLength={1}
          value={d} disabled={disabled} onChange={() => {}}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: '46px', height: '52px', textAlign: 'center',
            fontSize: '20px', fontWeight: '700', borderRadius: '12px',
            border: d ? '2px solid #7c3aed' : '2px solid #e5e7eb',
            background: d ? '#f5f3ff' : '#fff',
            color: d ? '#5b21b6' : '#111827',
            outline: 'none', cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
            fontFamily: 'monospace',
          }}
          onFocus={(e) => { e.target.select(); e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)'; }}
          onBlur={(e)  => { e.target.style.borderColor = d ? '#7c3aed' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
        />
      ))}
    </div>
  );
}

// ── Password strength ─────────────────────────────────────────────────────────
const pwStrength = (pw) => {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8) s++; if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { label: 'Weak',   color: '#ef4444', w: 20  };
  if (s <= 2) return { label: 'Fair',   color: '#f97316', w: 45  };
  if (s <= 3) return { label: 'Good',   color: '#eab308', w: 70  };
  return             { label: 'Strong', color: '#22c55e', w: 100 };
};

const ErrorBox = ({ message }) => (
  <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3">
    <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
    <p className="text-[13px] text-red-700">{message}</p>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep]         = useState('contact'); // contact | otp | done
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Step 1
  const [contactType, setContactType] = useState('email');
  const [identifier, setIdentifier]   = useState('');

  // Step 2 — OTP
  const [otp, setOtp]                     = useState('');
  const [otpVerified, setOtpVerified]     = useState(false);
  const [maskedContact, setMaskedContact] = useState('');
  const [expiresIn, setExpiresIn]         = useState(0);
  const [canResend, setCanResend]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef(null);

  // Step 2 — Password
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [showConf, setShowConf]               = useState(false);

  const str     = pwStrength(newPassword);
  const pwMatch = confirmPassword ? newPassword === confirmPassword : null;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTimer = useCallback((seconds) => {
    setExpiresIn(seconds); setCanResend(false); setResendCooldown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    const end = Date.now() + seconds * 1000;
    const t1 = setInterval(() => {
      const rem = Math.max(0, Math.round((end - Date.now()) / 1000));
      setExpiresIn(rem);
      if (rem === 0) { clearInterval(t1); setCanResend(true); }
    }, 1000);
    timerRef.current = t1;
    let cd = 60;
    const t2 = setInterval(() => { cd--; setResendCooldown(cd); if (cd <= 0) { clearInterval(t2); setCanResend(true); } }, 1000);
  }, []);

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const maskContact = (val, type) => {
    if (type === 'email') {
      const [local, domain] = val.split('@');
      return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
    }
    return `${val.slice(0, 2)}${'*'.repeat(Math.max(val.length - 4, 3))}${val.slice(-2)}`;
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault(); setError('');
    const val = identifier.trim();
    if (!val) { setError(`Please enter your ${contactType === 'email' ? 'email address' : 'phone number'}.`); return; }
    if (contactType === 'email' && !/\S+@\S+\.\S+/.test(val)) { setError('Please enter a valid email address.'); return; }
    if (contactType === 'phone' && !/^\d{7,15}$/.test(val.replace(/\D/g, ''))) { setError('Please enter a valid phone number.'); return; }
    setLoading(true);
    try {
      const res  = await authAPI.forgotPassword({ identifier: val, contactType });
      const data = res?.data?.data || res?.data || {};
      setMaskedContact(data.maskedEmail || data.maskedContact || maskContact(val, contactType));
      startTimer((data.expiresInMinutes || 10) * 60);
      setStep('otp');
      toast.success(`OTP sent to your ${contactType}!`);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (otp.replace(/\s/g, '').length !== 6) { setError('Please enter the complete 6-digit OTP.'); return; }
    setLoading(true);
    try {
      await authAPI.verifyOtp({ contact: identifier.trim(), otp, purpose: 'forgot_password' });
      if (timerRef.current) clearInterval(timerRef.current);
      setOtpVerified(true);
      toast.success('OTP verified! Set your new password below.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Invalid OTP.');
      setOtp('');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setError(''); setOtp(''); setOtpVerified(false); setLoading(true);
    try {
      const res  = await authAPI.forgotPassword({ identifier: identifier.trim(), contactType });
      const data = res?.data?.data || res?.data || {};
      startTimer((data.expiresInMinutes || 10) * 60);
      toast.success('New OTP sent!');
    } catch (err) { setError(err?.response?.data?.message || 'Failed to resend OTP.'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault(); setError('');
    if (!newPassword || newPassword.length < 8)               { setError('Password must be at least 8 characters.'); return; }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) { setError('Password needs uppercase, lowercase and a number.'); return; }
    if (newPassword !== confirmPassword)                       { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword({ identifier: identifier.trim(), otp, newPassword });
      setStep('done');
      toast.success('Password reset successfully!');
    } catch (err) { setError(err?.response?.data?.message || 'Failed to reset password.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — purple gradient (matches login) ── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%)' }}>

        {/* Decorative circles */}
        <div style={{ position:'absolute', top:'-80px', right:'-80px', width:'320px', height:'320px', borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ position:'absolute', bottom:'-60px', left:'-60px', width:'240px', height:'240px', borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ position:'absolute', top:'45%', left:'-40px', width:'160px', height:'160px', borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background:'rgba(255,255,255,0.15)' }}>
            <Activity size={22} className="text-white" strokeWidth={2.5}/>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">MediCore HMS</p>
            <p className="text-purple-200 text-xs mt-0.5">Hospital Management System</p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
            <span className="text-white text-xs font-medium">Secure Password Recovery</span>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-3">
            Reset Your<br/>
            <span style={{ color:'rgba(196,181,253,1)' }}>Password Safely.</span>
          </h1>
          <p className="text-purple-200 text-[15px] leading-relaxed mb-10">
            Verify your identity with a one-time code and set a new secure password for your account.
          </p>

          {/* Feature cards */}
          <div className="space-y-3">
            {[
              { icon: Shield, title: 'Secure OTP Verification',  desc: 'Time-limited one-time passwords' },
              { icon: Clock,  title: 'Quick & Easy',              desc: 'Reset in under 2 minutes'        },
              { icon: Key,    title: 'Encrypted Reset',           desc: 'End-to-end secure process'       },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 rounded-xl p-3" style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'rgba(255,255,255,0.15)' }}>
                  <Icon size={15} className="text-white"/>
                </div>
                <div>
                  <p className="text-white text-[13px] font-semibold">{title}</p>
                  <p className="text-purple-300 text-[11px]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-purple-300 text-xs">© 2026 MediCore HMS. All rights reserved.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL — white form area ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 overflow-y-auto">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <Activity size={16} className="text-white" strokeWidth={2.5}/>
            </div>
            <span className="font-bold text-gray-900">MediCore HMS</span>
          </div>

          {/* ── DONE screen ── */}
          {step === 'done' && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background:'linear-gradient(135deg,#dcfce7,#bbf7d0)' }}>
                <CheckCircle size={36} className="text-emerald-500"/>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
              <p className="text-gray-500 mb-6">
                Your password has been updated.<br/>
                A confirmation was sent to <span className="font-semibold text-gray-700">{maskedContact}</span>.
              </p>
              <button onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-[15px] transition-all hover:opacity-90"
                style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <ArrowLeft size={16}/>Back to Login
              </button>
            </div>
          )}

          {/* ── CONTACT step ── */}
          {step === 'contact' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Forgot Password?</h2>
                <p className="text-gray-500 mt-1">Enter your registered contact and we'll send a 6-digit OTP.</p>
              </div>

              {error && <ErrorBox message={error}/>}

              <form onSubmit={handleSendOtp} noValidate className="space-y-5">
                {/* Toggle */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Send OTP via</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: 'email', icon: Mail,  label: 'Email' },
                      { val: 'phone', icon: Phone, label: 'Phone (SMS)' },
                    ].map(({ val, icon: Icon, label }) => (
                      <button key={val} type="button"
                        onClick={() => { setContactType(val); setIdentifier(''); setError(''); }}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border text-[13px] font-medium transition-all"
                        style={contactType === val
                          ? { border:'2px solid #7c3aed', background:'#f5f3ff', color:'#5b21b6' }
                          : { border:'2px solid #e5e7eb', background:'#fff', color:'#6b7280' }}>
                        <Icon size={14}/>{label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Identifier */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    {contactType === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      {contactType === 'email' ? <Mail size={16}/> : <Phone size={16}/>}
                    </div>
                    <input
                      type={contactType === 'email' ? 'email' : 'tel'}
                      value={identifier}
                      onChange={e => { setIdentifier(e.target.value); setError(''); }}
                      placeholder={contactType === 'email' ? 'you@hospital.com' : '9876543210'}
                      autoFocus
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-[14px] outline-none transition-all placeholder:text-gray-300"
                      style={{ background:'#fff' }}
                      onFocus={e => { e.target.style.borderColor='#7c3aed'; e.target.style.boxShadow='0 0 0 3px rgba(124,58,237,0.12)'; }}
                      onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; }}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-[15px] transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {loading
                    ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending OTP...</>
                    : <><Send size={16}/>Send OTP</>}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-purple-700 font-medium transition-colors">
                  <ArrowLeft size={13}/>Back to Login
                </Link>
              </div>
            </>
          )}

          {/* ── OTP + Password step (same view) ── */}
          {step === 'otp' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Verify & Reset</h2>
                <p className="text-gray-500 mt-1 text-[14px]">
                  Code sent to <span className="font-semibold text-gray-800">{maskedContact}</span>
                  {otpVerified && (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle size={11}/>Verified
                    </span>
                  )}
                </p>
              </div>

              {error && <ErrorBox message={error}/>}

              <div className="space-y-4">

                {/* OTP card */}
                <div className="rounded-2xl border p-5 transition-all"
                  style={{ border: otpVerified ? '1.5px solid #bbf7d0' : '1.5px solid #e5e7eb', background: otpVerified ? '#f0fdf4' : '#fafafa' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">One-Time Password</span>
                    {otpVerified
                      ? <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle size={12}/>OTP Verified</span>
                      : expiresIn > 0
                        ? <span className={`text-xs font-semibold ${expiresIn <= 60 ? 'text-red-500' : 'text-gray-500'}`}>Expires in {fmtTime(expiresIn)}</span>
                        : <span className="text-xs text-red-500 font-semibold">Expired</span>
                    }
                  </div>

                  <OtpInput value={otp} onChange={setOtp} disabled={loading || otpVerified}/>

                  {!otpVerified && (
                    <div className="mt-4 space-y-3">
                      <button onClick={handleVerifyOtp}
                        disabled={loading || otp.replace(/\s/g,'').length !== 6}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-[14px] transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                        {loading
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying...</>
                          : <><ShieldCheck size={15}/>Verify OTP</>}
                      </button>
                      <div className="flex items-center justify-between">
                        <button onClick={handleResend} disabled={!canResend || loading}
                          className={`text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${canResend ? 'text-purple-600 hover:text-purple-800' : 'text-gray-300 cursor-not-allowed'}`}>
                          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>
                          {canResend ? 'Resend OTP' : `Resend in ${resendCooldown}s`}
                        </button>
                        <button
                          onClick={() => { setStep('contact'); setOtp(''); setError(''); if (timerRef.current) clearInterval(timerRef.current); }}
                          className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors">
                          ← Different {contactType}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Password card — grayed out until OTP verified */}
                <div className={`rounded-2xl border p-5 transition-all duration-300 ${otpVerified ? 'opacity-100' : 'opacity-35 pointer-events-none select-none'}`}
                  style={{ border: otpVerified ? '1.5px solid #e5e7eb' : '1.5px solid #f3f4f6', background:'#fafafa' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Lock size={13} className={otpVerified ? 'text-purple-600' : 'text-gray-400'}/>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      {otpVerified ? 'Set New Password' : 'New Password — verify OTP first'}
                    </span>
                  </div>

                  <form onSubmit={handleResetPassword} noValidate className="space-y-3">
                    {/* New password */}
                    <div>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => { setNewPassword(e.target.value); setError(''); }}
                          placeholder="New password (min 8 chars)"
                          disabled={!otpVerified}
                          className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-gray-900 text-[14px] outline-none transition-all placeholder:text-gray-300 disabled:bg-gray-50"
                          onFocus={e => { e.target.style.borderColor='#7c3aed'; e.target.style.boxShadow='0 0 0 3px rgba(124,58,237,0.12)'; }}
                          onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.boxShadow='none'; }}
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                        </button>
                      </div>
                      {newPassword && str && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width:`${str.w}%`, background:str.color }}/>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold" style={{ color:str.color }}>{str.label}</span>
                            <div className="flex gap-2">
                              {[[newPassword.length>=8,'8+ chars'],[/[A-Z]/.test(newPassword),'A-Z'],[/[a-z]/.test(newPassword),'a-z'],[/\d/.test(newPassword),'0-9']].map(([ok,l]) => (
                                <span key={l} className={`text-[10px] font-medium ${ok?'text-emerald-600':'text-gray-300'}`}>{ok?'✓':'○'} {l}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm */}
                    <div>
                      <div className="relative">
                        <input
                          type={showConf ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                          placeholder="Confirm new password"
                          disabled={!otpVerified}
                          className={`w-full px-4 py-3 pr-11 rounded-xl border text-gray-900 text-[14px] outline-none transition-all placeholder:text-gray-300 disabled:bg-gray-50
                            ${pwMatch===false?'border-red-400 bg-red-50':pwMatch===true?'border-emerald-400':'border-gray-200'}`}
                          onFocus={e => { if(pwMatch!==false) { e.target.style.borderColor='#7c3aed'; e.target.style.boxShadow='0 0 0 3px rgba(124,58,237,0.12)'; }}}
                          onBlur={e  => { e.target.style.boxShadow='none'; }}
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowConf(s => !s)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showConf ? <EyeOff size={15}/> : <Eye size={15}/>}
                        </button>
                      </div>
                      {pwMatch===true  && <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><CheckCircle size={10}/>Passwords match</p>}
                      {pwMatch===false && <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500 font-medium"><AlertCircle size={10}/>Passwords do not match</p>}
                    </div>

                    <button type="submit" disabled={loading || !otpVerified || pwMatch !== true}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-[15px] transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                      {loading
                        ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Resetting...</>
                        : <><Lock size={16}/>Reset Password</>}
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-purple-700 font-medium transition-colors">
                  <ArrowLeft size={13}/>Back to Login
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}