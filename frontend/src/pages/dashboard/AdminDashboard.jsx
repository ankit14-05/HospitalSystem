import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Briefcase,
  Bed,
  IndianRupee,
  CalendarRange,
  Clock3,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Building2,
  LayoutDashboard,
  Activity,
  FlaskConical,
  Microscope,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import RecentActivityList from '../../components/dashboard/RecentActivityList';
import DashboardTabs from '../../components/dashboard/DashboardTabs';

// ============================================================================
// REUSABLE DASHBOARD WIDGETS
// ============================================================================

// 1. OverviewCard: Displays top-level statistical metrics (e.g. Total Patients)
const OverviewCard = ({ icon: Icon, label, value, accent, subLabel }) => (
  <div className="card h-full flex flex-col justify-center">
    <div className="card-body flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: accent }}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {subLabel && <p className="text-xs text-slate-400 mt-1">{subLabel}</p>}
      </div>
    </div>
  </div>
);

// 2. ApprovalCard: Displays pending approval requests (Doctors, Staff)
const ApprovalCard = ({
  title,
  items,
  loading,
  emptyText,
  badgeClassName,
  actionLabel,
  onApprove,
  onViewAll,
}) => (
  <div className="card h-full flex flex-col">
    <div className="card-header border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {!!items.length && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeClassName}`}>
            {items.length}
          </span>
        )}
      </div>
      <button
        onClick={onViewAll}
        className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
      >
        View all
        <ArrowRight size={12} />
      </button>
    </div>
    <div className="card-body p-0 flex-1 overflow-y-auto max-h-[400px]">
      {loading ? (
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="px-6 py-4">
              <div className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : !items.length ? (
        <div className="px-6 py-12 text-center text-slate-400 text-sm">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {items.map((item) => (
            <div key={item.Id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold flex-shrink-0">
                {(item.FirstName?.[0] || '?').toUpperCase()}
                {(item.LastName?.[0] || '').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-700 truncate">
                  {item.FirstName} {item.LastName}
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {item.DepartmentName || item.SpecializationName || item.Role || item.Email || 'Pending approval'}
                </p>
              </div>
              <button
                onClick={() => onApprove(item.Id)}
                className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                <CheckCircle2 size={13} />
                {actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// 3. ListCard: A generic list container for various dashboard rows (e.g. Queues, Leaves)
const ListCard = ({ title, actionLabel, actionTo, navigate, rows, loading, emptyText, renderRow }) => (
  <div className="card h-full flex flex-col">
    <div className="card-header border-b border-slate-100 flex-shrink-0">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {actionLabel && (
        <button
          onClick={() => navigate(actionTo)}
          className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
        >
          {actionLabel}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
    <div className="card-body p-0 flex-1 overflow-y-auto max-h-[400px]">
      {loading ? (
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="px-6 py-4">
              <div className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : !rows.length ? (
        <div className="px-6 py-12 text-center text-slate-400 text-sm">{emptyText}</div>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map(renderRow)}
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// MAIN ADMIN DASHBOARD COMPONENT
// ============================================================================

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── State variables ──
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // Controls the visible section in the right column
  const [overview, setOverview] = useState({
    stats: {},
    pendingDoctors: [],
    pendingStaff: [],
    doctorSchedules: [],
    staffShifts: [],
    slotSummary: [],
    pendingLeaves: [],
    opdQueue: [],
    recentActivity: [],
    departmentOverview: [],
  });

  // ── Network Fetcher ──
  const loadOverview = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard/admin/overview');
      const payload = response?.data || response;
      setOverview({
        stats: payload?.stats || {},
        pendingDoctors: payload?.pendingDoctors || [],
        pendingStaff: payload?.pendingStaff || [],
        doctorSchedules: payload?.doctorSchedules || [],
        staffShifts: payload?.staffShifts || [],
        slotSummary: payload?.slotSummary || [],
        pendingLeaves: payload?.pendingLeaves || [],
        opdQueue: payload?.opdQueue || [],
        recentActivity: payload?.recentActivity || [],
        departmentOverview: payload?.departmentOverview || [],
      });
    } catch (error) {
      toast.error(error.message || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on initial mount
  useEffect(() => {
    loadOverview();
  }, []);

  // ── Specific Action Handlers ──
  const approveDoctor = async (id) => {
    try {
      await api.patch(`/register/approve-doctor/${id}`, { action: 'approved' });
      toast.success('Doctor approved successfully');
      loadOverview();
    } catch (error) {
      toast.error(error.message || 'Failed to approve doctor');
    }
  };

  const approveStaff = async (id) => {
    try {
      await api.patch(`/register/approve-staff/${id}`, { action: 'approved' });
      toast.success('Staff member approved successfully');
      loadOverview();
    } catch (error) {
      toast.error(error.message || 'Failed to approve staff member');
    }
  };

  // ── Navigation Configuration ──
  const TABS = [
    { id: 'overview', label: 'Overview Metrics', icon: LayoutDashboard },
    { id: 'approvals', label: 'Pending Approvals', icon: Clock3 },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'queues', label: 'Queues & Schedules', icon: CalendarRange },
    { id: 'activity', label: 'Recent Activity', icon: Activity },
  ];

  const stats = overview.stats || {};
  const greetingName = user?.firstName || 'Admin';

  // ============================================================================
  // RENDER SECTIONS
  // ============================================================================

  // 1. Overview Section
  const renderOverview = () => (
    <div className="space-y-6 slide-in content-section">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <OverviewCard icon={Users} label="Total Patients" value={stats.totalPatients || 0} accent="#2563eb" subLabel="Registered patients" />
        <OverviewCard icon={UserCheck} label="Active Doctors" value={stats.activeDoctors || 0} accent="#0f766e" subLabel="Approved and active" />
        <OverviewCard icon={Briefcase} label="Staff Members" value={stats.totalStaff || 0} accent="#7c3aed" subLabel="Approved staff accounts" />
        <OverviewCard icon={Bed} label="Beds Occupied" value={`${stats.occupiedBeds || 0}/${stats.totalBeds || 0}`} accent="#16a34a" subLabel="Current active beds" />
        <OverviewCard icon={IndianRupee} label="Revenue Today" value={`Rs. ${(stats.revenueToday || 0).toLocaleString('en-IN')}`} accent="#ea580c" subLabel="Bills generated today" />
        <OverviewCard icon={CalendarRange} label="Today's Appointments" value={stats.todayAppointments || 0} accent="#4f46e5" subLabel={`${stats.todayQueueCount || 0} currently in queue`} />
      </div>

      <div className="card mt-6">
        <div className="card-header border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800">Quick Admin Actions</h2>
            <p className="text-xs text-slate-500 mt-1">Jump directly into dedicated management portals.</p>
          </div>
        </div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 bg-slate-50/50">
          {[
            { label: 'Directory', desc: 'Manage all internal users', path: '/admin/people', icon: Users },
            { label: 'Schedules', desc: 'Map out doctor availability', path: '/admin/schedule-manager', icon: ClipboardList },
            { label: 'Appointments', desc: 'Oversee daily bookings', path: '/admin/appointments', icon: CalendarRange },
            { label: 'Lab Approvals', desc: 'Approve technician transfers', path: '/admin/lab-approvals', icon: FlaskConical },
            { label: 'Lab Management', desc: 'Configure rooms, rules, and tests', path: '/admin/lab-management', icon: Microscope },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all px-5 py-5 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon size={18} />
                </div>
                <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{action.label}</p>
                <p className="text-[11px] text-slate-400 mt-1">{action.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // 2. Approvals Section
  const renderApprovals = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 slide-in content-section">
      <ApprovalCard
        title="Pending Doctor Approvals"
        items={overview.pendingDoctors}
        loading={loading}
        emptyText="No doctor approvals are waiting right now."
        badgeClassName="bg-amber-100 text-amber-700"
        actionLabel="Approve"
        onApprove={approveDoctor}
        onViewAll={() => navigate('/admin/doctor-approvals')}
      />
      <ApprovalCard
        title="Pending Staff Approvals"
        items={overview.pendingStaff}
        loading={loading}
        emptyText="No staff approvals are waiting right now."
        badgeClassName="bg-cyan-100 text-cyan-700"
        actionLabel="Approve"
        onApprove={approveStaff}
        onViewAll={() => navigate('/admin/staff-approvals')}
      />
    </div>
  );

  // 3. Departments Section
  const renderDepartments = () => (
    <div className="max-w-3xl slide-in content-section">
      <ListCard
        title="Department Capacity & Usage"
        actionLabel="Open directory filter"
        actionTo="/admin/people"
        navigate={navigate}
        rows={overview.departmentOverview}
        loading={loading}
        emptyText="Department data is not available yet."
        renderRow={(row) => (
          <div key={row.Id} className="px-6 py-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{row.Name}</p>
                <p className="text-xs text-slate-500 mt-1">{row.DoctorCount} doctor(s)</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-slate-800">{row.TodayAppointments}</span>
                <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Today</span>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                style={{ width: `${Math.min(100, (Number(row.TodayAppointments || 0) / Math.max(1, Number(overview.departmentOverview?.[0]?.TodayAppointments || 1))) * 100)}%` }}
              />
            </div>
          </div>
        )}
      />
    </div>
  );

  // 4. Queues & Schedules Section
  const renderQueues = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 slide-in content-section p-4 -m-4 bg-slate-50/50 rounded-3xl">
      <ListCard
        title="Today's OPD Slot Utilisation"
        actionLabel="Manage schedules"
        actionTo="/admin/schedule-manager"
        navigate={navigate}
        rows={overview.slotSummary}
        loading={loading}
        emptyText="No slots have been generated for today. It might be a holiday or schedule wasn't run."
        renderRow={(row) => {
          const totalSlots = Number(row.TotalSlots || 0);
          const bookedSlots = Number(row.BookedSlots || 0);
          const bookedPercent = totalSlots ? Math.round((bookedSlots / totalSlots) * 100) : 0;

          return (
            <div key={row.DoctorId} className="px-6 py-4 bg-white m-2 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">Dr. {row.DoctorName}</p>
                  <p className="text-[11px] font-semibold text-indigo-600 mt-0.5 uppercase tracking-wider">{row.DepartmentName || 'General'}</p>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-slate-50 flex items-center justify-center font-bold text-slate-700 bg-slate-100 flex-shrink-0">
                  {bookedPercent}%
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span>Booked: {bookedSlots}</span>
                <span>Capacity: {totalSlots}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${bookedPercent > 80 ? 'bg-rose-500' : bookedPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${bookedPercent}%` }} />
              </div>
            </div>
          );
        }}
      />

      <ListCard
        title="Live Queue and Leave Requests"
        actionLabel="Open scheduler"
        actionTo="/admin/schedule-manager"
        navigate={navigate}
        rows={[...overview.pendingLeaves.slice(0, 3), ...overview.opdQueue.slice(0, 3)]}
        loading={loading}
        emptyText="Queue and leave requests are quiet right now."
        renderRow={(row) => {
          const isLeave = Object.prototype.hasOwnProperty.call(row, 'LeaveDate');

          return (
            <div key={`${isLeave ? 'leave' : 'queue'}-${row.Id}`} className="px-6 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
              {isLeave ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{row.StaffName}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded text-rose-700 bg-rose-50 inline-block mt-1">LEAVE REQUEST</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                      {new Date(row.LeaveDate).toLocaleDateString('en-IN', { month:'short', day:'numeric'})}
                    </span>
                  </div>
                  {row.Reason && <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">"{row.Reason}"</p>}
                </>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{row.PatientName}</p>
                    <p className="text-xs text-slate-500 mt-1">Consulting: <span className="font-medium text-slate-700">Dr. {row.DoctorName}</span></p>
                  </div>
                  <div className="text-center bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl flex-shrink-0">
                    <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Token</span>
                    <span className="block text-indigo-700 font-black text-lg leading-tight">#{row.TokenNumber}</span>
                  </div>
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );

  // 5. Recent Activity Section
  const renderActivity = () => (
    <div className="max-w-3xl slide-in content-section">
      <div className="card h-full">
        <div className="card-header border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800">System Activity Log</h2>
            <p className="text-xs text-slate-500 mt-1">Live feed assembled on the server representing actions across the hospital.</p>
          </div>
        </div>
        <div className="card-body p-0 max-h-[600px] overflow-y-auto">
          <RecentActivityList activities={overview.recentActivity} loading={loading} />
        </div>
      </div>
    </div>
  );


  // ============================================================================
  // MAIN RENDER (DUAL-COLUMN ARCHITECTURE)
  // ============================================================================
  return (
    <div className="space-y-6">
      <style>{`
        @keyframes slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .slide-in { animation: slide-in 0.25s ease-out forwards; }
        .content-section { min-height: 400px; }
      `}</style>
      
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Welcome back, {greetingName}!</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage and monitor the hospital metrics continuously.</p>
        </div>
        <button
          onClick={loadOverview}
          disabled={loading}
          className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all focus:ring-4 focus:ring-slate-100 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Sync Data
        </button>
      </div>

      {/* ── Optional Important Alert ── */}
      {(stats.pendingDoctors || stats.pendingStaff || stats.pendingLeaves) ? (
        <div className="rounded-2xl border-l-4 border-l-amber-500 bg-amber-50 px-5 py-4 flex flex-wrap items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
             <Clock3 size={16} />
          </div>
          <p className="text-sm text-amber-900 font-semibold">
            Action Required: <span className="font-normal text-amber-700">{stats.pendingDoctors || 0} doctor approvals, {stats.pendingStaff || 0} staff approvals, and {stats.pendingLeaves || 0} leave requests await your review.</span>
          </p>
        </div>
      ) : null}

      {/* ── The Two-Column Layout ── */}
      <DashboardTabs
        tabs={TABS.map((tab) => ({ key: tab.id, label: tab.label, icon: tab.icon }))}
        activeTab={activeTab}
        onChange={setActiveTab}
        theme="indigo"
      />

      <div className="w-full min-w-0 transition-all">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'approvals' && renderApprovals()}
        {activeTab === 'departments' && renderDepartments()}
        {activeTab === 'queues' && renderQueues()}
        {activeTab === 'activity' && renderActivity()}
      </div>

    </div>
  );
}
