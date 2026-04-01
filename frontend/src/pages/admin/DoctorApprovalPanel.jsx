// src/pages/admin/DoctorApprovalPanel.jsx
// Place this file at: frontend/src/pages/admin/DoctorApprovalPanel.jsx
// Add route in App.jsx: <Route path="/admin/doctor-approvals" element={<DoctorApprovalPanel />} />
// Link from AdminDashboard: navigate('/admin/doctor-approvals') or <Link to="/admin/doctor-approvals">

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, Clock, Eye, Search,
  User, Stethoscope, MapPin, Phone, Mail, FileText,
  Shield, RefreshCw, Check, X, Loader2, Building2,
  Calendar, Hash, Activity, ChevronLeft, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:  { label: 'Pending Review', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
  approved: { label: 'Approved',       color: '#10b981', bg: '#d1fae5', icon: CheckCircle },
  rejected: { label: 'Rejected',       color: '#ef4444', bg: '#fee2e2', icon: XCircle },
  deferred: { label: 'On Hold',        color: '#6366f1', bg: '#e0e7ff', icon: AlertTriangle },
};

const DOC_TYPE_LABELS = {
  medical_degree: 'Medical Degree', license: 'Medical License',
  id_proof: 'Government ID', experience_cert: 'Experience Certificate',
  registration_cert: 'Registration Certificate', insurance: 'Insurance Document', other: 'Other',
};

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const calcAge = (dob) =>
  dob ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000)) : null;

// ── Sub-components ────────────────────────────────────────────────────────────
const Badge = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} strokeWidth={2.5} />{cfg.label}
    </span>
  );
};

const InfoRow = ({ label, value, mono }) =>
  value ? (
    <div className="flex gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-[12px] text-slate-700 font-medium flex-1 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  ) : null;

const SectionCard = ({ icon: Icon, title, color = '#6366f1', children }) => (
  <div className="bg-white rounded-xl border border-slate-100 p-4 mb-3">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
        <Icon size={12} style={{ color }} strokeWidth={2.2} />
      </div>
      <span className="text-[12px] font-semibold text-slate-600">{title}</span>
    </div>
    {children}
  </div>
);

// ── Doctor Detail Drawer ──────────────────────────────────────────────────────
function DoctorDrawer({ doctor, onClose, onAction, actioning }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [deferNote, setDeferNote] = useState('');
  const [showDeferForm, setShowDeferForm] = useState(false);

  // Reset forms when doctor changes
  useEffect(() => {
    setShowRejectForm(false);
    setShowDeferForm(false);
    setRejectReason('');
    setDeferNote('');
  }, [doctor?.Id]);

  if (!doctor) return null;

  const days = doctor.AvailableDays
    ? doctor.AvailableDays.split(',').map(d => d.trim().slice(0, 3)).join(', ')
    : '—';

  const isPending = doctor.Status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-full max-w-xl bg-slate-50 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[14px]">
              {(doctor.FirstName || '?')[0]}{(doctor.LastName || '?')[0]}
            </div>
            <div>
              <p className="text-[15px] font-bold text-slate-800">
                Dr. {doctor.FirstName} {doctor.LastName}
              </p>
              <p className="text-[11px] text-slate-400">
                {doctor.SpecializationName || 'General'} · {doctor.Designation || 'Doctor'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={doctor.Status} />
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Reviewed banner */}
          {doctor.ReviewedAt && (
            <div className={`rounded-xl p-3 mb-3 border text-[11px] ${
              doctor.Status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : doctor.Status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-indigo-50 border-indigo-100 text-indigo-700'
            }`}>
              <p className="font-semibold mb-0.5">
                {doctor.Status === 'approved' ? '✓ Approved'
                  : doctor.Status === 'rejected' ? '✗ Rejected'
                  : '⏸ Deferred'} on {fmtDate(doctor.ReviewedAt)}
              </p>
              {doctor.RejectionReason && (
                <p className="opacity-80 mt-0.5">{doctor.RejectionReason}</p>
              )}
            </div>
          )}

          <SectionCard icon={User} title="Personal Information" color="#6366f1">
            <InfoRow label="Full Name" value={`Dr. ${doctor.FirstName} ${doctor.LastName}`} />
            <InfoRow label="Gender" value={doctor.Gender} />
            <InfoRow label="Date of Birth"
              value={doctor.DateOfBirth ? `${fmtDate(doctor.DateOfBirth)} (${calcAge(doctor.DateOfBirth)} yrs)` : null} />
            <InfoRow label="Blood Group" value={doctor.BloodGroup} />
            <InfoRow label="Nationality" value={doctor.Nationality} />
            <InfoRow label="Designation" value={doctor.Designation} />
            <InfoRow label="Marital Status" value={doctor.MaritalStatus} />
            <InfoRow label="Languages" value={doctor.LanguagesSpoken} />
            {doctor.Bio && (
              <div className="pt-2">
                <p className="text-[11px] text-slate-400 mb-1">Bio</p>
                <p className="text-[12px] text-slate-600 leading-relaxed">{doctor.Bio}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Phone} title="Contact Details" color="#0ea5e9">
            <InfoRow label="Email" value={doctor.Email} />
            <InfoRow label="Phone" value={doctor.Phone} />
            <InfoRow label="Alt Phone" value={doctor.AltPhone} />
            <InfoRow label="Username" value={doctor.Username} mono />
          </SectionCard>

          <SectionCard icon={Stethoscope} title="Professional Details" color="#8b5cf6">
            <InfoRow label="Specialization" value={doctor.SpecializationName} />
            <InfoRow label="Qualification" value={doctor.QualificationName} />
            <InfoRow label="Department" value={doctor.DepartmentName} />
            <InfoRow label="Medical Council" value={doctor.MedicalCouncilName} />
            
            
            <InfoRow label="Experience" value={doctor.ExperienceYears ? `${doctor.ExperienceYears} years` : null} />
            <InfoRow label="Max Patients/Day" value={doctor.MaxDailyPatients} />
          </SectionCard>

          <SectionCard icon={Calendar} title="Availability & Fees" color="#f59e0b">
            <InfoRow label="Available Days" value={days} />
            <InfoRow label="Timings"
              value={(doctor.AvailableFrom && doctor.AvailableTo)
                ? `${doctor.AvailableFrom} – ${doctor.AvailableTo}` : null} />
            <InfoRow label="Consultation" value={doctor.ConsultationFee ? `₹${doctor.ConsultationFee}` : null} />
            <InfoRow label="Follow-up" value={doctor.FollowUpFee ? `₹${doctor.FollowUpFee}` : null} />
            <InfoRow label="Emergency" value={doctor.EmergencyFee ? `₹${doctor.EmergencyFee}` : null} />
          </SectionCard>

          <SectionCard icon={MapPin} title="Address" color="#10b981">
            <InfoRow label="Street"
              value={[doctor.Street1, doctor.Street2].filter(Boolean).join(', ')} />
            <InfoRow label="City" value={doctor.City} />
            <InfoRow label="State" value={doctor.StateName} />
            <InfoRow label="Country" value={doctor.CountryName} />
            <InfoRow label="Pincode" value={doctor.Pincode} mono />
          </SectionCard>

          <SectionCard icon={Shield} title="Identity Documents" color="#ef4444">
            {doctor.Aadhaar   && <InfoRow label="Aadhaar"  value={`•••• •••• ${String(doctor.Aadhaar).slice(-4)}`} mono />}
            {doctor.Pan       && <InfoRow label="PAN"      value={doctor.Pan} mono />}
            {doctor.PassportNo && <InfoRow label="Passport" value={doctor.PassportNo} mono />}
            {doctor.VoterId   && <InfoRow label="Voter ID" value={doctor.VoterId} mono />}
            {doctor.AbhaNumber && <InfoRow label="ABHA No." value={doctor.AbhaNumber} mono />}
            {!doctor.Aadhaar && !doctor.Pan && !doctor.PassportNo &&
             !doctor.VoterId && !doctor.AbhaNumber && (
              <p className="text-[12px] text-slate-400">No identity documents submitted</p>
            )}
          </SectionCard>

          {(doctor.Awards || doctor.Publications) && (
            <SectionCard icon={Activity} title="Awards & Publications" color="#f59e0b">
              {doctor.Awards && <InfoRow label="Awards" value={doctor.Awards} />}
              {doctor.Publications && <InfoRow label="Publications" value={doctor.Publications} />}
            </SectionCard>
          )}

          {doctor.Documents && doctor.Documents.length > 0 && (
            <SectionCard icon={FileText} title={`Uploaded Documents (${doctor.Documents.length})`} color="#0ea5e9">
              {doctor.Documents.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
                  <FileText size={12} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-slate-700 font-medium truncate">
                      {doc.FileName || doc.fileName || 'Document'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {DOC_TYPE_LABELS[doc.DocType || doc.docType] || doc.DocType}
                    </p>
                  </div>
                </div>
              ))}
            </SectionCard>
          )}

          <div className="text-[11px] text-slate-400 text-center pb-2">
            Submitted: {fmt(doctor.CreatedAt)}
          </div>
        </div>

        {/* Action Footer — only for pending */}
        {isPending && (
          <div className="bg-white border-t border-slate-100 px-5 py-4 flex-shrink-0">

            {/* Reject form */}
            {showRejectForm && (
              <div className="mb-3 p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-[11px] font-semibold text-red-700 mb-1.5">
                  Reason for rejection <span className="text-red-400">*</span>
                </p>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why — the doctor will see this in their notification email..."
                  className="w-full px-3 py-2 rounded-lg border border-red-200 text-[12px] text-slate-700 outline-none focus:border-red-400 resize-none bg-white"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    disabled={!rejectReason.trim() || actioning}
                    onClick={() => onAction(doctor.Id, 'rejected', rejectReason)}
                    className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-[11px] font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1">
                    {actioning ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                    Confirm Reject
                  </button>
                </div>
              </div>
            )}

            {/* Defer form */}
            {showDeferForm && (
              <div className="mb-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-[11px] font-semibold text-indigo-700 mb-1.5">
                  Deferral note (optional)
                </p>
                <textarea
                  value={deferNote}
                  onChange={e => setDeferNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Awaiting verification from Medical Council..."
                  className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-[12px] text-slate-700 outline-none focus:border-indigo-400 resize-none bg-white"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setShowDeferForm(false); setDeferNote(''); }}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    disabled={actioning}
                    onClick={() => onAction(doctor.Id, 'deferred', deferNote)}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-500 text-white text-[11px] font-semibold hover:bg-indigo-600 disabled:opacity-50 flex items-center justify-center gap-1">
                    {actioning ? <Loader2 size={11} className="animate-spin" /> : <Clock size={11} />}
                    Put On Hold
                  </button>
                </div>
              </div>
            )}

            {/* Main action buttons */}
            {!showRejectForm && !showDeferForm && (
              <div className="flex gap-2">
                <button
                  onClick={() => onAction(doctor.Id, 'approved')}
                  disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-[13px] font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {actioning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Approve
                </button>
                <button
                  onClick={() => { setShowDeferForm(false); setShowRejectForm(true); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 flex items-center justify-center gap-2 transition-all">
                  <XCircle size={14} />Reject
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setShowDeferForm(true); }}
                  className="px-4 py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-[13px] font-semibold hover:bg-indigo-50 flex items-center justify-center gap-2 transition-all">
                  <Clock size={14} />Hold
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Doctor Card ───────────────────────────────────────────────────────────────
function DoctorCard({ doctor, onView, onQuickAction, actioning }) {
  const isPending = doctor.Status === 'pending';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${
      isPending ? 'border-amber-100 hover:border-amber-200' : 'border-slate-100 hover:border-slate-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[13px] flex-shrink-0"
              style={{
                background: isPending ? '#fef3c7'
                  : doctor.Status === 'approved' ? '#d1fae5' : '#fee2e2',
                color: isPending ? '#92400e'
                  : doctor.Status === 'approved' ? '#065f46' : '#991b1b',
              }}>
              {(doctor.FirstName || '?')[0]}{(doctor.LastName || '?')[0]}
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-800 leading-tight">
                Dr. {doctor.FirstName} {doctor.LastName}
              </p>
              <p className="text-[11px] text-slate-400">
                {doctor.SpecializationName || 'General'} · {doctor.ExperienceYears ? `${doctor.ExperienceYears} yrs` : 'New'}
              </p>
            </div>
          </div>
          <Badge status={doctor.Status} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
            <Mail size={10} className="text-slate-300 flex-shrink-0" />{doctor.Email}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Phone size={10} className="text-slate-300 flex-shrink-0" />{doctor.Phone}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Building2 size={10} className="text-slate-300 flex-shrink-0" />{doctor.DepartmentName || '—'}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin size={10} className="text-slate-300 flex-shrink-0" />{doctor.City || '—'}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-3 flex-wrap">
          <Hash size={9} />
          <span className="font-mono">{doctor.LicenseNumber}</span>
          <span className="mx-1 text-slate-200">·</span>
          <Clock size={9} />
          <span>{fmt(doctor.CreatedAt)}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onView(doctor)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 transition-colors">
            <Eye size={12} />View Details
          </button>
          {isPending && (
            <>
              <button
                onClick={() => onQuickAction(doctor.Id, 'approved')}
                disabled={actioning === doctor.Id}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-[12px] font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                {actioning === doctor.Id
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Check size={12} />}
                Approve
              </button>
              <button
                onClick={() => onView(doctor)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-red-500 text-[12px] font-semibold hover:bg-red-50 transition-colors">
                <X size={12} />Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ doctors }) {
  const counts = { pending: 0, approved: 0, rejected: 0, deferred: 0 };
  doctors.forEach(d => { if (counts[d.Status] !== undefined) counts[d.Status]++; });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {[
        { key: 'pending',  label: 'Pending',  color: '#f59e0b', bg: '#fef9ec' },
        { key: 'approved', label: 'Approved', color: '#10b981', bg: '#f0fdf4' },
        { key: 'rejected', label: 'Rejected', color: '#ef4444', bg: '#fff5f5' },
        { key: 'deferred', label: 'On Hold',  color: '#6366f1', bg: '#f5f3ff' },
      ].map(({ key, label, color, bg }) => (
        <div key={key} className="rounded-2xl p-4 border" style={{ background: bg, borderColor: color + '30' }}>
          <p className="text-[28px] font-black leading-none mb-1" style={{ color }}>{counts[key]}</p>
          <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function DoctorApprovalPanel() {
  const navigate = useNavigate();
  const [doctors, setDoctors]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [actioning, setActioning] = useState(null);
  const [filter, setFilter]       = useState('pending');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('newest');

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      // `api` returns the JSON body directly (see `frontend/src/services/api.js`)
      const r = await api.get('/register/pending-doctors?status=all');
      const list = Array.isArray(r?.data) ? r.data
        : Array.isArray(r) ? r : [];
      setDoctors(list);
    } catch {
      toast.error('Failed to load doctor registrations');
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  const handleAction = useCallback(async (doctorId, newStatus, reason = '') => {
    setActioning(doctorId);
    try {
      await api.patch(`/register/approve-doctor/${doctorId}`, {
        action: newStatus,
        rejectionReason: reason || undefined,
      });

      toast.success({
        approved: '✓ Doctor approved. Credentials sent by email.',
        rejected: '✗ Application rejected. Doctor notified.',
        deferred: '⏸ Application put on hold.',
      }[newStatus] || 'Done');

      setDoctors(prev => prev.map(d =>
        d.Id === doctorId
          ? { ...d, Status: newStatus, ReviewedAt: new Date().toISOString(), RejectionReason: reason || undefined }
          : d
      ));
      setSelected(prev => prev?.Id === doctorId
        ? { ...prev, Status: newStatus, ReviewedAt: new Date().toISOString(), RejectionReason: reason || undefined }
        : prev
      );

      if (newStatus !== 'deferred') setTimeout(() => setSelected(null), 500);
    } catch (err) {
      toast.error(err?.message || 'Action failed');
    } finally {
      setActioning(null);
    }
  }, []);

  const filtered = doctors
    .filter(d => {
      if (filter !== 'all' && d.Status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (d.FirstName || '').toLowerCase().includes(q) ||
        (d.LastName  || '').toLowerCase().includes(q) ||
        (d.Email     || '').toLowerCase().includes(q) ||
        (d.SpecializationName || '').toLowerCase().includes(q) ||
        (d.LicenseNumber || '').toLowerCase().includes(q) ||
        (d.City || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.CreatedAt) - new Date(a.CreatedAt);
      if (sortBy === 'oldest') return new Date(a.CreatedAt) - new Date(b.CreatedAt);
      if (sortBy === 'name')   return (a.LastName || '').localeCompare(b.LastName || '');
      return 0;
    });

  const pendingCount = doctors.filter(d => d.Status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <header className="bg-white border-b border-slate-100 px-6 lg:px-10 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mr-1">
            <ChevronLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Activity size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-slate-800 leading-tight">Doctor Registrations</h1>
            <p className="text-[11px] text-slate-400">Super Admin · MediCore HMS</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-amber-700">{pendingCount} awaiting review</span>
            </div>
          )}
          <button onClick={loadDoctors}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="px-6 lg:px-10 py-6 max-w-6xl mx-auto">
        <StatsBar doctors={doctors} />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, specialization, license, city..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white placeholder:text-slate-300"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all',      label: 'All' },
              { key: 'pending',  label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'deferred', label: 'On Hold' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all whitespace-nowrap
                  ${filter === key
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                {label}
                {key !== 'all' && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                    ${filter === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {doctors.filter(d => d.Status === key).length}
                  </span>
                )}
              </button>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-[12px] text-slate-500 outline-none bg-white hover:border-slate-300 cursor-pointer">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="text-indigo-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <User size={24} className="text-slate-300" />
            </div>
            <p className="text-[14px] text-slate-500 font-medium">No doctors found</p>
            <p className="text-[12px] text-slate-400 mt-1">Try adjusting your filters or search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(doctor => (
              <DoctorCard
                key={doctor.Id}
                doctor={doctor}
                onView={setSelected}
                onQuickAction={(id, status) => handleAction(id, status)}
                actioning={actioning}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail drawer */}
      {selected && (
        <DoctorDrawer
          doctor={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          actioning={actioning === selected?.Id}
        />
      )}
    </div>
  );
}