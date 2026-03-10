// src/pages/auth/ForgotPasswordPage.jsx
// 3-step flow entirely on one page:
//   Step 1 — Enter email  →  POST /auth/forgot-password
//   Step 2 — Enter OTP   →  POST /auth/verify-otp
//   Step 3 — New password →  POST /auth/reset-password  →  redirect to /login

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, Mail, ArrowLeft, Send, CheckCircle,
  AlertCircle, Eye, EyeOff, Lock, RefreshCw, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';

// ── OTP digit-box input ───────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputRefs = useRef([]);

  // Build exactly 6 slots — never use padEnd (creates space chars)
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const focusBox = (i) => {
    if (i >= 0 && i < 6) inputRefs.current[i]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        next[i - 1] = '';
        onChange(next.join(''));
        focusBox(i - 1);
      }
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = [...digits];
      next[i] = e.key;
      onChange(next.join(''));
      if (i < 5) focusBox(i + 1);
    } else if (e.key === 'ArrowLeft')  { e.preventDefault(); focusBox(i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); focusBox(i + 1); }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || '');
    onChange(next.join(''));
    focusBox(Math.min(pasted.length, 5));
  };

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          name={`otp-digit-${i}`}
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={() => {}}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          style={{
            width: '44px',
            height: '52px',
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: '700',
            borderRadius: '12px',
            border: d ? '2px solid #6366f1' : '2px solid #e2e8f0',
            background: d ? '#eef2ff' : '#fff',
            color: d ? '#4338ca' : '#334155',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.5 : 1,
            transition: 'border-color 0.15s, background 0.15s',
            fontFamily: 'monospace',
          }}
          onFocusCapture={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
          onBlurCapture={(e)  => { e.target.style.borderColor = d ? '#6366f1' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
        />
      ))}
    </div>
  );
}

// ── Password strength ─────────────────────────────────────────────────────────
const pwStrength = (pw) => {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { label: 'Weak',   color: '#ef4444', w: 20  };
  if (s <= 2) return { label: 'Fair',   color: '#f97316', w: 45  };
  if (s <= 3) return { label: 'Good',   color: '#eab308', w: 70  };
  return             { label: 'Strong', color: '#22c55e', w: 100 };
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // Step: 'email' | 'otp' | 'password' | 'done'
  const [step, setStep]           = useState('email');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Step 1 state
  const [email, setEmail]         = useState('');

  // Step 2 state
  const [otp, setOtp]             = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);       // seconds remaining
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef(null);

  // Step 3 state
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [showConf, setShowConf]               = useState(false);

  const str     = pwStrength(newPassword);
  const pwMatch = confirmPassword ? newPassword === confirmPassword : null;

  // ── Countdown timer ──────────────────────────────────────────────────────
  const startTimer = useCallback((seconds) => {
    setExpiresIn(seconds);
    setCanResend(false);
    setResendCooldown(60); // 60s before resend is allowed
    if (timerRef.current) clearInterval(timerRef.current);

    // Count down expiry display
    const expiryEnd = Date.now() + seconds * 1000;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((expiryEnd - Date.now()) / 1000));
      setExpiresIn(remaining);
      if (remaining === 0) {
        clearInterval(timerRef.current);
        setCanResend(true);
      }
    }, 1000);

    // Resend cooldown (60s)
    let cooldown = 60;
    const cdTimer = setInterval(() => {
      cooldown -= 1;
      setResendCooldown(cooldown);
      if (cooldown <= 0) {
        clearInterval(cdTimer);
        setCanResend(true);
      }
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword({ identifier: email.trim(), contactType: 'email' });
      const data = res?.data?.data || res?.data || {};
      setMaskedEmail(data.maskedEmail || email.replace(/(.{2}).*@/, '$1***@'));
      const expMin = data.expiresInMinutes || 10;
      startTimer(expMin * 60);
      setStep('otp');
      toast.success('OTP sent to your email!');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setError('');
    if (otp.length !== 6) { setError('Please enter the 6-digit OTP.'); return; }
    setLoading(true);
    try {
      await authAPI.verifyOtp({ contact: email.trim(), otp, purpose: 'forgot_password' });
      setOtpVerified(true);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success('OTP verified!');
      setTimeout(() => setStep('password'), 400);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Invalid OTP.');
      // Shake the OTP boxes on error
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend) return;
    setError('');
    setOtp('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword({ identifier: email.trim(), contactType: 'email' });
      const data = res?.data?.data || res?.data || {};
      const expMin = data.expiresInMinutes || 10;
      startTimer(expMin * 60);
      toast.success('New OTP sent!');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ───────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Password needs uppercase, lowercase and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({ identifier: email.trim(), otp, newPassword });
      setStep('done');
      toast.success('Password reset successfully!');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicator ───────────────────────────────────────────────────────
  const STEPS = ['Email', 'Verify OTP', 'New Password'];
  const stepIdx = step === 'email' ? 0 : step === 'otp' ? 1 : step === 'password' ? 2 : 3;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-indigo-700 flex items-center justify-center">
            <Activity size={17} className="text-white" strokeWidth={2.5}/>
          </div>
          <span className="font-bold text-slate-800 text-[15px]">MediCore HMS</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

          {/* Progress bar */}
          {step !== 'done' && (
            <div className="px-8 pt-8 pb-0">
              <div className="flex items-center gap-2 mb-6">
                {STEPS.map((label, i) => (
                  <React.Fragment key={label}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all
                        ${i < stepIdx ? 'bg-emerald-500 text-white'
                          : i === stepIdx ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-400'}`}>
                        {i < stepIdx ? <CheckCircle size={13}/> : i + 1}
                      </div>
                      <span className={`text-[11px] font-medium hidden sm:block
                        ${i === stepIdx ? 'text-indigo-700' : i < stepIdx ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded-full transition-all ${i < stepIdx ? 'bg-emerald-400' : 'bg-slate-100'}`}/>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="px-8 pb-8 pt-2">

            {/* ── STEP 1: Email ── */}
            {step === 'email' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-800">Forgot Password</h2>
                  <p className="text-slate-500 text-sm mt-1">Enter your registered email and we'll send a 6-digit OTP.</p>
                </div>

                {error && <ErrorBox message={error}/>}

                <form onSubmit={handleSendOtp} noValidate className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(''); }}
                        placeholder="doctor@hospital.com"
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300"/>
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all">
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending OTP...</>
                      : <><Send size={14}/>Send OTP</>}
                  </button>
                </form>
              </>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 'otp' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-800">Enter OTP</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    We sent a 6-digit code to <span className="font-semibold text-slate-700">{maskedEmail}</span>
                  </p>
                </div>

                {error && <ErrorBox message={error}/>}

                <div className="space-y-5">
                  <OtpInput value={otp} onChange={setOtp} disabled={loading || otpVerified}/>

                  {/* Timer */}
                  <div className="text-center">
                    {expiresIn > 0 && !otpVerified
                      ? <p className="text-[12px] text-slate-400">
                          OTP expires in <span className={`font-bold ${expiresIn <= 60 ? 'text-red-500' : 'text-slate-600'}`}>{fmtTime(expiresIn)}</span>
                        </p>
                      : !otpVerified && (
                          <p className="text-[12px] text-red-500 font-medium">OTP has expired.</p>
                        )
                    }
                  </div>

                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 6 || otpVerified}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all">
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying...</>
                      : otpVerified
                      ? <><CheckCircle size={14}/>Verified!</>
                      : <><ShieldCheck size={14}/>Verify OTP</>}
                  </button>

                  {/* Resend */}
                  <div className="text-center">
                    <p className="text-[12px] text-slate-400 mb-1">Didn't receive the email?</p>
                    <button
                      onClick={handleResend}
                      disabled={!canResend || loading}
                      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors
                        ${canResend ? 'text-indigo-600 hover:text-indigo-700 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`}>
                      <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>
                      {canResend ? 'Resend OTP' : `Resend in ${resendCooldown}s`}
                    </button>
                  </div>

                  {/* Change email */}
                  <div className="text-center">
                    <button onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                      className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
                      ← Use a different email
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: New Password ── */}
            {step === 'password' && (
              <>
                <div className="mb-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                    <Lock size={18} className="text-indigo-600"/>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Set New Password</h2>
                  <p className="text-slate-500 text-sm mt-1">OTP verified. Choose a strong new password.</p>
                </div>

                {error && <ErrorBox message={error}/>}

                <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      New Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setError(''); }}
                        placeholder="Min 8 characters"
                        autoFocus
                        className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 text-[13px] text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300"/>
                      <button type="button" onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {newPassword && str && (
                      <div className="mt-1.5">
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-0.5">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${str.w}%`, background: str.color }}/>
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: str.color }}>{str.label}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConf ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                        placeholder="Re-enter new password"
                        className={`w-full px-3 py-2.5 pr-10 rounded-xl border text-[13px] text-slate-700 outline-none transition-all placeholder:text-slate-300
                          ${pwMatch === false
                            ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                            : pwMatch === true
                            ? 'border-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
                            : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'}`}/>
                      <button type="button" onClick={() => setShowConf(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showConf ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                    {pwMatch === true && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                        <CheckCircle size={10}/>Passwords match
                      </p>
                    )}
                    {pwMatch === false && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
                        <AlertCircle size={10}/>Passwords do not match
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-600 mb-1">Password requirements:</p>
                    {[
                      [newPassword.length >= 8,               'At least 8 characters'],
                      [/[A-Z]/.test(newPassword),             'One uppercase letter'],
                      [/[a-z]/.test(newPassword),             'One lowercase letter'],
                      [/\d/.test(newPassword),                'One number'],
                    ].map(([ok, label]) => (
                      <div key={label} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {ok ? <CheckCircle size={10}/> : <div className="w-2.5 h-2.5 rounded-full border border-slate-300"/>}
                        {label}
                      </div>
                    ))}
                  </div>

                  <button type="submit" disabled={loading || pwMatch !== true}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all">
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Resetting...</>
                      : <><Lock size={14}/>Reset Password</>}
                  </button>
                </form>
              </>
            )}

            {/* ── DONE ── */}
            {step === 'done' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={30} className="text-emerald-500"/>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Password Reset!</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Your password has been updated successfully.<br/>
                  A confirmation email has been sent to <span className="font-semibold text-slate-700">{maskedEmail}</span>.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition-all">
                  <Activity size={14}/>Back to Login
                </button>
              </div>
            )}

            {/* Back to login */}
            {step !== 'done' && (
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <Link to="/login"
                  className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-indigo-600 font-medium transition-colors">
                  <ArrowLeft size={13}/>Back to Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline error box ──────────────────────────────────────────────────────────
const ErrorBox = ({ message }) => (
  <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 p-3">
    <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>
    <p className="text-[12px] text-red-700 leading-relaxed">{message}</p>
  </div>
);