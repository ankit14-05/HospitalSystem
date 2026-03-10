// src/pages/auth/ResetPasswordPage.jsx
import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Activity, AlertCircle, ArrowLeft, KeyRound, CheckCircle } from 'lucide-react';
import { authAPI } from '../../services/api';

const schema = yup.object({
  identifier: yup.string().trim().required('Email or phone is required'),
  otp: yup.string().trim().length(6, 'OTP must be 6 digits').matches(/^\d+$/, 'OTP must be numeric').required('OTP is required'),
  newPassword: yup
    .string()
    .min(8, 'Minimum 8 characters')
    .matches(/[A-Z]/, 'Must contain an uppercase letter')
    .matches(/[a-z]/, 'Must contain a lowercase letter')
    .matches(/\d/, 'Must contain a number')
    .required('New password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords do not match')
    .required('Please confirm your password'),
});

// OTP digit input component
function OtpInput({ value, onChange, error }) {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleChange = (idx, e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) return;
    const newDigits = [...digits];
    newDigits[idx] = val[val.length - 1];
    const newVal = newDigits.join('').slice(0, 6);
    onChange(newVal);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const newDigits = [...digits];
        newDigits[idx] = '';
        onChange(newDigits.join(''));
      } else if (idx > 0) {
        inputs.current[idx - 1]?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2">
      {Array(6).fill(0).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`w-11 h-12 text-center text-lg font-bold rounded-lg border transition-all
            focus:outline-none focus:ring-2
            ${error
              ? 'border-danger-400 focus:ring-danger-200 text-danger-700'
              : digits[i]
              ? 'border-primary-400 bg-primary-50 focus:ring-primary-200 text-primary-700'
              : 'border-slate-200 focus:ring-primary-200 focus:border-primary-400'
            }`}
        />
      ))}
    </div>
  );
}

// Password strength indicator
function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [
    { label: '8+ chars', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase', pass: /[a-z]/.test(password) },
    { label: 'Number',    pass: /\d/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const colors = ['', 'bg-danger-500', 'bg-warning-500', 'bg-yellow-400', 'bg-green-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1.5">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colors[score] : 'bg-slate-200'}`} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {checks.map(c => (
            <span key={c.label} className={`text-xs ${c.pass ? 'text-green-600' : 'text-slate-400'}`}>
              {c.pass ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span className={`text-xs font-semibold ${score >= 4 ? 'text-green-600' : score >= 3 ? 'text-yellow-600' : 'text-danger-600'}`}>
            {labels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [otpValue, setOtpValue] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { otp: '' },
  });

  const newPassword = watch('newPassword');

  const handleOtpChange = (val) => {
    setOtpValue(val);
    setValue('otp', val, { shouldValidate: true });
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    setServerError('');
    try {
      await authAPI.resetPassword({
        identifier: data.identifier,
        otp: data.otp,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      setSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setServerError(err.message || 'Reset failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Password Reset!</h2>
          <p className="text-slate-500 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary-700 flex items-center justify-center">
            <Activity size={17} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-800">MediCore HMS</span>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
                <KeyRound size={20} className="text-primary-700" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Reset Password</h2>
              <p className="text-slate-500 text-sm mt-1">Enter the OTP sent to your email/phone and choose a new password.</p>
            </div>

            {serverError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-danger-50 border border-danger-200 p-3 animate-fade-in">
                <AlertCircle size={15} className="text-danger-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-danger-700">{serverError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Identifier */}
              <div>
                <label className="form-label">Email or Phone</label>
                <input
                  {...register('identifier')}
                  type="text"
                  placeholder="same as used in forgot password"
                  className={`form-input ${errors.identifier ? 'form-input-error' : ''}`}
                />
                {errors.identifier && <p className="form-error"><AlertCircle size={12} />{errors.identifier.message}</p>}
              </div>

              {/* OTP */}
              <div>
                <label className="form-label">One-Time Password (OTP)</label>
                <input type="hidden" {...register('otp')} />
                <OtpInput value={otpValue} onChange={handleOtpChange} error={!!errors.otp} />
                {errors.otp && <p className="form-error mt-2"><AlertCircle size={12} />{errors.otp.message}</p>}
                <p className="text-xs text-slate-400 mt-2">OTP expires in 10 minutes.</p>
              </div>

              {/* New password */}
              <div>
                <label className="form-label">New Password</label>
                <div className="relative">
                  <input
                    {...register('newPassword')}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    className={`form-input pr-11 ${errors.newPassword ? 'form-input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrength password={newPassword} />
                {errors.newPassword && <p className="form-error mt-1"><AlertCircle size={12} />{errors.newPassword.message}</p>}
              </div>

              {/* Confirm */}
              <div>
                <label className="form-label">Confirm New Password</label>
                <div className="relative">
                  <input
                    {...register('confirmPassword')}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter your new password"
                    className={`form-input pr-11 ${errors.confirmPassword ? 'form-input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="form-error"><AlertCircle size={12} />{errors.confirmPassword.message}</p>}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? <><div className="spinner w-4 h-4" />Resetting...</> : 'Reset Password'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-700 font-medium">
                <ArrowLeft size={14} />Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
