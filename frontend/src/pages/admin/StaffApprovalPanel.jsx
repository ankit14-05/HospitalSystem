// src/pages/admin/StaffApprovalPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, CheckCircle, XCircle, Clock, Eye, Search,
  RefreshCw, ChevronLeft, AlertCircle, User, Phone, Mail,
  Building2, Calendar, Layers, MapPin, BadgeCheck, X,
  SlidersHorizontal, Download, Shield
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:  'bg-amber-50  text-amber-700  border border-amber-200',
    approved: 'bg-green-50  text-green-700  border border-green-200',
    rejected: 'bg-red-50    text-red-600    border border-red-200',
    deferred: 'bg-slate-100 text-slate-600  border border-slate-200',
  };
  const icons = { pending: Clock, approved: CheckCircle, rejected: XCircle, deferred: AlertCircle };
  const Icon = icons[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || map.pending}`}>
      <Icon size={11} />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

// ── Detail row ────────────────────────────────────────────────────────────────
const DetailRow = ({ label, value, highlight }) => (
  <div className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
    <span className="text-xs text-slate-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
    <span className={`text-sm flex-1 ${highlight ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
      {value || <span className="text-slate-300 italic">Not provided</span>}
    </span>
  </div>
);

// ── Reject modal ──────────────────────────────────────────────────────────────
const RejectModal = ({ staff, onConfirm, onClose, loading }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <XCircle size={16} className="text-red-500" />
            Reject Staff Registration
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 mb-4">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 font-bold text-red-700 text-sm">
              {staff?.FirstName?.[0]}{staff?.LastName?.[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{staff?.FirstName} {staff?.LastName}</p>
              <p className="text-xs text-slate-500">{staff?.Role?.replace(/_/g, ' ')} · {staff?.Email}</p>
            </div>
          </div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Explain why this registration is being rejected…"
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 placeholder:text-slate-300"
          />
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 btn-ghost py-2.5 rounded-xl text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
            {loading ? <span className="spinner w-4 h-4 border-white" /> : <XCircle size={14} />}
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Staff Detail Modal ────────────────────────────────────────────────────────
const StaffDetailModal = ({ staff, onClose, onApprove, onReject, actionLoading }) => {
  if (!staff) return null;

  const fmt = (val) => val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
  const fmtRole = (r) => r ? r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
              {staff.FirstName?.[0]}{staff.LastName?.[0]}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{staff.FirstName} {staff.LastName}</h3>
              <p className="text-xs text-slate-500">{fmtRole(staff.Role)} · @{staff.Username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={staff.Status} />
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors ml-1">
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Rejection reason banner */}
          {staff.RejectionReason && (
            <div className="flex gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
                <p className="text-sm text-red-600">{staff.RejectionReason}</p>
              </div>
            </div>
          )}

          {/* Personal Info */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <User size={12} /> Personal Information
            </h4>
            <div className="bg-slate-50 rounded-xl px-4 py-1">
              <DetailRow label="Full Name"    value={`${staff.FirstName} ${staff.LastName}`} highlight />
              <DetailRow label="Gender"       value={staff.Gender} />
              <DetailRow label="Date of Birth" value={fmt(staff.DateOfBirth)} />
              <DetailRow label="Blood Group"  value={staff.BloodGroup} />
              <DetailRow label="Nationality"  value={staff.Nationality} />
            </div>
          </section>

          {/* Contact */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Phone size={12} /> Contact Details
            </h4>
            <div className="bg-slate-50 rounded-xl px-4 py-1">
              <DetailRow label="Email"        value={staff.Email} highlight />
              <DetailRow label="Phone"        value={staff.Phone} />
              <DetailRow label="Alt Phone"    value={staff.AltPhone} />
            </div>
          </section>

          {/* Employment */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Briefcase size={12} /> Employment Details
            </h4>
            <div className="bg-slate-50 rounded-xl px-4 py-1">
              <DetailRow label="Role"           value={fmtRole(staff.Role)} highlight />
              <DetailRow label="Department"     value={staff.DepartmentName} />
              <DetailRow label="Employee ID"    value={staff.EmployeeId} />
              <DetailRow label="Joining Date"   value={fmt(staff.JoiningDate)} />
              <DetailRow label="Shift"          value={staff.Shift} />
              <DetailRow label="Contract Type"  value={staff.ContractType} />
              <DetailRow label="Reporting To"   value={staff.ReportingManager} />
              <DetailRow label="Experience"     value={staff.ExperienceYears ? `${staff.ExperienceYears} years` : null} />
              <DetailRow label="Qualification"  value={staff.Qualification} />
              <DetailRow label="Languages"      value={staff.LanguagesSpoken} />
            </div>
          </section>

          {/* Address */}
          {(staff.Street1 || staff.City || staff.StateName) && (
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapPin size={12} /> Address
              </h4>
              <div className="bg-slate-50 rounded-xl px-4 py-1">
                <DetailRow label="Street"    value={[staff.Street1, staff.Street2].filter(Boolean).join(', ')} />
                <DetailRow label="City"      value={staff.City} />
                <DetailRow label="State"     value={staff.StateName} />
                <DetailRow label="Country"   value={staff.CountryName} />
                <DetailRow label="Pincode"   value={staff.Pincode} />
              </div>
            </section>
          )}

          {/* Meta */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield size={12} /> Record Info
            </h4>
            <div className="bg-slate-50 rounded-xl px-4 py-1">
              <DetailRow label="Registered On" value={fmt(staff.CreatedAt)} />
              <DetailRow label="Reviewed At"   value={fmt(staff.ReviewedAt)} />
              <DetailRow label="Username"      value={`@${staff.Username}`} />
            </div>
          </section>
        </div>

        {/* Footer actions */}
        {staff.Status === 'pending' && (
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <button
              onClick={() => onReject(staff)}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
              <XCircle size={14} /> Reject
            </button>
            <button
              onClick={() => onApprove(staff.Id)}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
              {actionLoading ? <span className="spinner w-4 h-4 border-white" /> : <CheckCircle size={14} />}
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'pending',  label: 'Pending',  icon: Clock,         color: 'text-amber-500' },
  { key: 'approved', label: 'Approved', icon: CheckCircle,   color: 'text-green-500' },
  { key: 'rejected', label: 'Rejected', icon: XCircle,       color: 'text-red-500'   },
  { key: 'all',      label: 'All',      icon: Layers,        color: 'text-slate-500' },
];

export default function StaffApprovalPanel() {
  const navigate = useNavigate();

  const [activeTab,    setActiveTab]    = useState('pending');
  const [staff,        setStaff]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [counts,       setCounts]       = useState({});
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState(null);       // detail modal
  const [rejectTarget, setRejectTarget] = useState(null);       // reject modal
  const [actioning,    setActioning]    = useState(null);       // id being actioned

  const fetchStaff = useCallback(async (tab = activeTab) => {
    setLoading(true);
    try {
      const r = await api.get(`/register/pending-staff?status=${tab}`);
      // Handle both { data: [] } and { data: { data: [] } } response shapes
      const raw = r.data;
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];

      console.log(`[StaffPanel] tab=${tab} records=${data.length}`, data);
      setStaff(data);

      if (tab === 'all') {
        const c = {};
        data.forEach(s => { c[s.Status] = (c[s.Status] || 0) + 1; });
        setCounts(prev => ({ ...prev, ...c, all: data.length }));
      } else {
        setCounts(prev => ({ ...prev, [tab]: data.length }));
      }
    } catch (err) {
      console.error('[StaffPanel] fetch error:', err.response?.status, err.response?.data);
      toast.error(`Failed to load staff records (${err.response?.status || 'network error'})`);
      setStaff([]);
    }
    setLoading(false);
  }, [activeTab]);

  // On mount, fetch counts for all tabs in parallel (allSettled = never fails silently)
  useEffect(() => {
    const loadCounts = async () => {
      const [p, a, r] = await Promise.allSettled([
        api.get('/register/pending-staff?status=pending'),
        api.get('/register/pending-staff?status=approved'),
        api.get('/register/pending-staff?status=rejected'),
      ]);
      // Support both { data: { data: [] } } and { data: [] } response shapes
      const extract = (res) => {
        if (res.status !== 'fulfilled') return [];
        const d = res.value.data;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.data)) return d.data;
        return [];
      };
      const pd = extract(p);
      const ad = extract(a);
      const rd = extract(r);
      setCounts({
        pending:  pd.length,
        approved: ad.length,
        rejected: rd.length,
        all: pd.length + ad.length + rd.length,
      });
    };
    loadCounts();
    fetchStaff('pending');
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch('');
    fetchStaff(tab);
  };

  const handleApprove = async (id) => {
    setActioning(id);
    try {
      await api.patch(`/register/approve-staff/${id}`, { action: 'approved' });
      toast.success('Staff member approved successfully');
      setStaff(prev => prev.filter(s => s.Id !== id));
      setCounts(prev => ({
        ...prev,
        pending:  Math.max(0, (prev.pending || 0) - 1),
        approved: (prev.approved || 0) + 1,
        all:      prev.all,
      }));
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
    setActioning(null);
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectTarget) return;
    setActioning(rejectTarget.Id);
    try {
      await api.patch(`/register/approve-staff/${rejectTarget.Id}`, {
        action: 'rejected',
        rejectionReason: reason,
      });
      toast.success('Staff registration rejected');
      setStaff(prev => prev.filter(s => s.Id !== rejectTarget.Id));
      setCounts(prev => ({
        ...prev,
        pending:  Math.max(0, (prev.pending || 0) - 1),
        rejected: (prev.rejected || 0) + 1,
        all:      prev.all,
      }));
      setRejectTarget(null);
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
    setActioning(null);
  };

  // Filter by search
  const filtered = staff.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      `${s.FirstName} ${s.LastName}`.toLowerCase().includes(q) ||
      s.Email?.toLowerCase().includes(q) ||
      s.Phone?.includes(q) ||
      s.Role?.toLowerCase().includes(q) ||
      s.DepartmentName?.toLowerCase().includes(q) ||
      s.EmployeeId?.toLowerCase().includes(q)
    );
  });

  const fmtRole = (r) => r ? r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/admin')}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Briefcase size={20} className="text-blue-500" /> Staff Approval Panel
            </h1>
            <p className="page-subtitle">Review and manage staff registration requests</p>
          </div>
        </div>
        <button
          onClick={() => fetchStaff(activeTab)}
          className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${activeTab === key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Icon size={13} className={activeTab === key ? 'text-white' : color} />
            {label}
            {counts[key] !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold
                ${activeTab === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, phone, role, department…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-300"
        />
      </div>

      {/* Content */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Briefcase size={15} className="text-blue-500" />
            {TABS.find(t => t.key === activeTab)?.label} Staff
            {!loading && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                {filtered.length}
              </span>
            )}
          </h3>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="spinner w-7 h-7" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              {search ? (
                <>
                  <Search size={32} className="mb-2 text-slate-200" />
                  <p className="text-sm font-medium">No results for "{search}"</p>
                  <p className="text-xs">Try a different search term</p>
                </>
              ) : (
                <>
                  <CheckCircle size={32} className="mb-2 text-green-200" />
                  <p className="text-sm font-medium">No {activeTab} staff records</p>
                  <p className="text-xs">All caught up!</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_100px_120px] gap-4 px-6 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <span>Staff Member</span>
                <span>Role / Department</span>
                <span>Contact</span>
                <span>Details</span>
                <span>Registered</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="divide-y divide-slate-50">
                {filtered.map(s => (
                  <div key={s.Id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_100px_120px] gap-4 px-6 py-4 hover:bg-slate-50 transition-colors items-center">

                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 font-bold text-blue-700 text-xs">
                        {s.FirstName?.[0]}{s.LastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 text-sm">{s.FirstName} {s.LastName}</p>
                        <p className="text-xs text-slate-400">@{s.Username}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <p className="text-sm font-medium text-slate-700">{fmtRole(s.Role)}</p>
                      <p className="text-xs text-slate-400">{s.DepartmentName || 'No dept'}</p>
                    </div>

                    {/* Contact */}
                    <div>
                      <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Mail size={11} className="text-slate-300" />{s.Email}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Phone size={11} className="text-slate-300" />{s.Phone}
                      </p>
                    </div>

                    {/* Details */}
                    <div>
                      {s.Shift && (
                        <p className="text-xs text-slate-500">{s.Shift} shift</p>
                      )}
                      {s.ExperienceYears && (
                        <p className="text-xs text-slate-400">{s.ExperienceYears} yrs exp</p>
                      )}
                      {s.EmployeeId && (
                        <p className="text-xs text-slate-400">ID: {s.EmployeeId}</p>
                      )}
                    </div>

                    {/* Date */}
                    <div className="hidden md:block">
                      <p className="text-xs text-slate-500">
                        {new Date(s.CreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <StatusBadge status={s.Status} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setSelected(s)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors">
                        <Eye size={12} /> View
                      </button>
                      {s.Status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(s.Id)}
                            disabled={actioning === s.Id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50">
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            onClick={() => setRejectTarget(s)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                            <XCircle size={12} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <StaffDetailModal
          staff={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={(s) => { setRejectTarget(s); }}
          actionLoading={actioning === selected?.Id}
        />
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          staff={rejectTarget}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
          loading={actioning === rejectTarget?.Id}
        />
      )}
    </div>
  );
}