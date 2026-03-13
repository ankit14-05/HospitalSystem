// src/pages/appointments/AppointmentDetailModal.jsx
import React, { useState } from 'react';
import {
  X, Calendar, Clock, User, Stethoscope, Building2, Hash,
  CheckCircle, XCircle, RotateCcw, Phone, Mail, FileText,
  AlertCircle, Check, ArrowRight, Bell
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const STATUS_CONFIG = {
  Scheduled:   { color: 'bg-blue-100 text-blue-700',   label: 'Scheduled',   icon: Clock },
  Confirmed:   { color: 'bg-emerald-100 text-emerald-700', label: 'Confirmed', icon: CheckCircle },
  Completed:   { color: 'bg-purple-100 text-purple-700', label: 'Completed', icon: Check },
  Cancelled:   { color: 'bg-red-100 text-red-600',      label: 'Cancelled',  icon: XCircle },
  NoShow:      { color: 'bg-orange-100 text-orange-700', label: 'No Show',   icon: AlertCircle },
  Rescheduled: { color: 'bg-amber-100 text-amber-700',  label: 'Rescheduled', icon: RotateCcw },
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
    <Icon size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700 mt-0.5">{value || '—'}</p>
    </div>
  </div>
);

export default function AppointmentDetailModal({ appt, onClose, onAction }) {
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(null);
  const [cancelReason,  setCancelReason]  = useState('');
  const [showCancel,    setShowCancel]    = useState(false);

  const statusCfg = STATUS_CONFIG[appt.Status] || STATUS_CONFIG.Scheduled;
  const StatusIcon = statusCfg.icon;

  const doAction = async (type, extra = {}) => {
    setActionLoading(type);
    try {
      if (type === 'cancel') {
        if (!cancelReason.trim()) return toast.error('Cancel reason required');
        await api.patch(`/appointments/${appt.Id}/cancel`, { cancelReason });
        toast.success('Cancelled — notifications sent ✓');
      } else {
        await api.patch(`/appointments/${appt.Id}/status`, { status: type, ...extra });
        toast.success(`${type} — notifications sent ✓`);
      }
      onAction();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const isTerminal = ['Cancelled', 'Completed'].includes(appt.Status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-900 text-lg tracking-tight">Appointment Details</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                <StatusIcon size={11} /> {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{appt.AppointmentNo}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl flex-shrink-0">
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Token highlight */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <p className="text-white font-black text-xl leading-none">#{appt.TokenNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wide">Token Number</p>
              <p className="text-sm font-bold text-indigo-800 mt-0.5">
                {new Date(appt.AppointmentDate).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
              </p>
              <p className="text-sm text-indigo-600 font-semibold">{appt.AppointmentTime}</p>
            </div>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Patient */}
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <User size={11} /> Patient
              </p>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                  {appt.PatientFirstName?.[0]}{appt.PatientLastName?.[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{appt.PatientFirstName} {appt.PatientLastName}</p>
                  <p className="text-xs text-slate-400">{appt.UHID}</p>
                </div>
              </div>
              {appt.PatientPhone && (
                <a href={`tel:${appt.PatientPhone}`} className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:underline">
                  <Phone size={11} /> {appt.PatientPhone}
                </a>
              )}
            </div>

            {/* Doctor */}
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Stethoscope size={11} /> Doctor
              </p>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 flex-shrink-0">
                  {appt.DoctorFirstName?.[0]}{appt.DoctorLastName?.[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Dr. {appt.DoctorFirstName} {appt.DoctorLastName}</p>
                  <p className="text-xs text-slate-400">{appt.DepartmentName}</p>
                </div>
              </div>
              {appt.DoctorEmail && (
                <a href={`mailto:${appt.DoctorEmail}`} className="flex items-center gap-1.5 text-xs text-purple-600 font-semibold hover:underline truncate">
                  <Mail size={11} /> {appt.DoctorEmail}
                </a>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4">
            <InfoRow icon={Building2} label="Department"  value={appt.DepartmentName} />
            <InfoRow icon={Calendar}  label="Date"        value={new Date(appt.AppointmentDate).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })} />
            <InfoRow icon={Clock}     label="Time"        value={appt.AppointmentTime} />
            <InfoRow icon={Hash}      label="Visit Type"  value={appt.VisitType} />
            <InfoRow icon={AlertCircle} label="Priority"  value={appt.Priority} />
            {appt.Reason && <InfoRow icon={FileText} label="Reason" value={appt.Reason} />}
            {appt.CancelReason && <InfoRow icon={XCircle} label="Cancel Reason" value={appt.CancelReason} />}
          </div>

          {/* Notification info */}
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <Bell size={13} className="text-emerald-600 flex-shrink-0" />
            <p className="text-xs text-emerald-700 font-medium">
              Email & in-app notifications are automatically sent for all status changes.
            </p>
          </div>

          {/* Cancel reason input */}
          {showCancel && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Cancel Reason *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2}
                className="w-full px-4 py-3 rounded-xl border border-red-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                placeholder="Reason for cancellation…" />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isTerminal && (
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50 flex-shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Quick Actions</p>
            <div className="flex flex-wrap gap-2">

              {appt.Status === 'Scheduled' && (
                <button onClick={() => doAction('Confirmed')} disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {actionLoading === 'Confirmed' ? '…' : <><CheckCircle size={13} /> Confirm</>}
                </button>
              )}

              {['Scheduled', 'Confirmed'].includes(appt.Status) && (
                <button onClick={() => doAction('Completed')} disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {actionLoading === 'Completed' ? '…' : <><Check size={13} /> Mark Complete</>}
                </button>
              )}

              {['Scheduled', 'Confirmed'].includes(appt.Status) && (
                <button onClick={() => doAction('NoShow')} disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  {actionLoading === 'NoShow' ? '…' : <><AlertCircle size={13} /> No Show</>}
                </button>
              )}

              {!showCancel && (
                <button onClick={() => setShowCancel(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors">
                  <XCircle size={13} /> Cancel
                </button>
              )}

              {showCancel && (
                <button onClick={() => doAction('cancel')} disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {actionLoading === 'cancel' ? '…' : <>Confirm Cancel</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}