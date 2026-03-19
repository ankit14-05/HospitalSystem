import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck2,
  Clock3,
  RefreshCw,
  Ticket,
  UserRoundCog,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getPayload } from '../../utils/apiPayload';
import AppointmentBookingModal from '../appointments/AppointmentBookingModal';
import RecentActivityList from '../../components/dashboard/RecentActivityList';
import OpdAppointmentsPanel from '../../components/dashboard/opd/OpdAppointmentsPanel';
import OpdDoctorRosterPanel from '../../components/dashboard/opd/OpdDoctorRosterPanel';
import OpdQuickActions from '../../components/dashboard/opd/OpdQuickActions';
import OpdStatCard from '../../components/dashboard/opd/OpdStatCard';
import DashboardTabs from '../../components/dashboard/DashboardTabs';

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY_OVERVIEW = {
  stats: {
    todayAppointments: 0,
    scheduledToday: 0,
    confirmedToday: 0,
    completedToday: 0,
    liveQueue: 0,
    doctorsOnDuty: 0,
    upcomingAppointments: 0,
  },
  upcomingAppointments: [],
  doctorRoster: [],
  todaySchedules: [],
  recentActivity: [],
};

export default function OPDManagerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [showBook, setShowBook] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadOverview = useCallback(async () => {
    try {
      const response = await api.get('/dashboard/opd/overview');
      const payload = getPayload(response) || {};

      setOverview({
        stats: { ...EMPTY_OVERVIEW.stats, ...(payload.stats || {}) },
        upcomingAppointments: payload.upcomingAppointments || [],
        doctorRoster: payload.doctorRoster || [],
        todaySchedules: payload.todaySchedules || [],
        recentActivity: payload.recentActivity || [],
      });
    } catch (error) {
      toast.error(error.message || 'Failed to load the OPD dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (!document.hidden) {
        loadOverview();
      }
    };

    const intervalId = window.setInterval(refreshIfVisible, 30000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadOverview]);

  const handleSendSchedule = async (doctorId) => {
    setSendingEmailId(doctorId);
    try {
      await api.post('/appointments/send-doctor-schedule', { doctorId, date: TODAY });
      toast.success('Daily schedule emailed to the doctor');
      loadOverview();
    } catch (error) {
      toast.error(error.message || 'Could not email the doctor schedule');
    } finally {
      setSendingEmailId(null);
    }
  };

  const stats = overview.stats || EMPTY_OVERVIEW.stats;
  const tabs = [
    { key: 'overview', label: 'Overview', icon: CalendarCheck2 },
    { key: 'appointments', label: 'Appointments', icon: Ticket, badge: overview.upcomingAppointments.length },
    { key: 'doctors', label: 'Doctors', icon: UserRoundCog, badge: overview.doctorRoster.length },
    { key: 'activity', label: 'Activity', icon: Clock3, badge: overview.recentActivity.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={loadOverview}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <DashboardTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} theme="teal" />

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OpdStatCard
              icon={CalendarCheck2}
              label="Today bookings"
              value={stats.todayAppointments || 0}
              accent="#0f766e"
            />
            <OpdStatCard
              icon={Clock3}
              label="Awaiting desk action"
              value={stats.scheduledToday || 0}
              accent="#d97706"
            />
            <OpdStatCard
              icon={Ticket}
              label="Live queue"
              value={stats.liveQueue || 0}
              accent="#2563eb"
            />
            <OpdStatCard
              icon={UserRoundCog}
              label="Doctors on duty"
              value={stats.doctorsOnDuty || 0}
              accent="#7c3aed"
            />
          </div>

          <OpdQuickActions
            onBook={() => setShowBook(true)}
            onAppointments={() => navigate('/appointments')}
            onSchedules={() => navigate('/admin/schedule-manager')}
          />
        </div>
      ) : null}

      {activeTab === 'appointments' ? (
        <OpdAppointmentsPanel
          appointments={overview.upcomingAppointments}
          schedules={overview.todaySchedules}
          loading={loading}
          onOpenBoard={() => navigate('/appointments')}
        />
      ) : null}

      {activeTab === 'doctors' ? (
        <OpdDoctorRosterPanel
          doctors={overview.doctorRoster}
          loading={loading}
          sendingEmailId={sendingEmailId}
          onSendSchedule={handleSendSchedule}
        />
      ) : null}

      {activeTab === 'activity' ? (
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.33)] backdrop-blur">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-black tracking-tight text-slate-900">Recent activity</h2>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <RecentActivityList activities={overview.recentActivity} loading={loading} emptyText="No recent OPD-facing activity yet." />
          </div>
        </div>
      ) : null}

      {showBook ? (
        <AppointmentBookingModal
          onClose={() => setShowBook(false)}
          onSuccess={() => {
            setShowBook(false);
            loadOverview();
          }}
        />
      ) : null}
    </div>
  );
}
