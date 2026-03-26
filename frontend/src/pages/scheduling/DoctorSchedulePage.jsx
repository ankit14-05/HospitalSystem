import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Calendar, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getPageData, getPayload } from '../../utils/apiPayload';
import ScheduleCategoryTabs from '../../components/scheduling/ScheduleCategoryTabs';
import ScheduleMonthPicker from '../../components/scheduling/ScheduleMonthPicker';
import {
  formatLongDate,
  formatTime,
  getActivityCategory,
  getTokenVisual,
  groupAssignmentsByDate,
  SCHEDULE_CATEGORY_TABS,
  toDateKey,
} from '../../components/scheduling/scheduleConfig';

const APPOINTMENT_STATUS_STYLES = {
  Scheduled: 'bg-blue-50 text-blue-700',
  Confirmed: 'bg-emerald-50 text-emerald-700',
  Completed: 'bg-slate-100 text-slate-700',
  Rescheduled: 'bg-violet-50 text-violet-700',
  InConsultation: 'bg-amber-50 text-amber-700',
  NoShow: 'bg-orange-50 text-orange-700',
  Pending: 'bg-amber-50 text-amber-700',
  Cancelled: 'bg-rose-50 text-rose-700',
};

const formatSlashedDate = (value) => {
  const date = new Date(`${toDateKey(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const formatShortTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}${m !== '00' ? ':'+m : ''}${ampm}`;
};

const shiftDate = (dateKey, direction) => {
  const next = new Date(`${toDateKey(dateKey)}T00:00:00`);
  next.setDate(next.getDate() + direction);
  return toDateKey(next);
};

const timeToMinutes = (value) => {
  const text = String(value || '');
  const match = text.match(/(\d{2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
};

const sortByTime = (left, right) => {
  const delta = timeToMinutes(left.StartTime || left.AppointmentTime) - timeToMinutes(right.StartTime || right.AppointmentTime);
  if (delta !== 0) return delta;
  return timeToMinutes(left.EndTime || '23:59') - timeToMinutes(right.EndTime || '23:59');
};

const buildPatientName = (appointment) =>
  `${appointment.PatientFirstName || ''} ${appointment.PatientLastName || ''}`.trim() || 'Patient';

const isInsideAssignment = (appointment, assignment) => {
  const appointmentMinutes = timeToMinutes(appointment.AppointmentTime);
  return (
    appointmentMinutes >= timeToMinutes(assignment.StartTime) &&
    appointmentMinutes < timeToMinutes(assignment.EndTime)
  );
};

function StatusBadge({ status }) {
  const className = APPOINTMENT_STATUS_STYLES[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {status || 'Scheduled'}
    </span>
  );
}

function SessionChip({ assignment, active, count, onClick }) {
  const visual = getTokenVisual(assignment.ColorToken);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-black transition ${
        active ? `${visual.card} border-indigo-300 text-slate-900` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      <span>{assignment.Title || assignment.ActivityName}</span>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${active ? 'bg-white/80 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
}

function DutyTable({ assignments }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr className="text-left">
              {['Time', 'Duty', 'Location', 'Notes'].map((heading) => (
                <th
                  key={heading}
                  className="px-5 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {assignments.map((assignment) => (
              <tr key={assignment.Id}>
                <td className="px-5 py-4 text-sm font-black text-slate-900">
                  {formatTime(assignment.StartTime)} - {formatTime(assignment.EndTime)}
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-black text-slate-900">{assignment.Title || assignment.ActivityName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{assignment.ActivityName}</p>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                  {assignment.LocationLabel || assignment.RoomNumber || '--'}
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                  {assignment.Notes || '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DoctorSchedulePage() {
  const { user } = useAuth();
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [activeCategory, setActiveCategory] = useState('opd');
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleData, setScheduleData] = useState({ assignments: [] });
  const [appointments, setAppointments] = useState([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null);

  const fetchSchedule = useCallback(async () => {
    const response = await api.get('/scheduling/my-schedule', {
      params: { view: 'month', cursorDate: selectedDate },
    });
    return getPayload(response) || { assignments: [] };
  }, [selectedDate]);

  const fetchAppointments = useCallback(async () => {
    const response = await api.get('/appointments', {
      params: { date: selectedDate, page: 1, limit: 300 },
    });
    return getPageData(response).items || [];
  }, [selectedDate]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextSchedule, nextAppointments] = await Promise.all([fetchSchedule(), fetchAppointments()]);
      setScheduleData(nextSchedule);
      setAppointments(nextAppointments);
    } catch (error) {
      toast.error(error?.message || 'Could not refresh schedule');
    } finally {
      setRefreshing(false);
    }
  }, [fetchAppointments, fetchSchedule]);

  useEffect(() => {
    (async () => {
      setScheduleLoading(true);
      setAppointmentsLoading(true);
      try {
        const [nextSchedule, nextAppointments] = await Promise.all([fetchSchedule(), fetchAppointments()]);
        setScheduleData(nextSchedule);
        setAppointments(nextAppointments);
      } catch (error) {
        toast.error(error?.message || 'Could not load doctor schedule');
      } finally {
        setScheduleLoading(false);
        setAppointmentsLoading(false);
      }
    })();
  }, [fetchAppointments, fetchSchedule]);

  const assignments = useMemo(
    () => [...(scheduleData?.assignments || [])].sort(sortByTime),
    [scheduleData?.assignments]
  );

  const groupedAssignments = useMemo(() => groupAssignmentsByDate(assignments), [assignments]);
  const selectedAssignments = useMemo(
    () => [...(groupedAssignments[toDateKey(selectedDate)] || [])].sort(sortByTime),
    [groupedAssignments, selectedDate]
  );

  const categoryAssignments = useMemo(
    () =>
      SCHEDULE_CATEGORY_TABS.reduce((map, tab) => {
        map[tab.value] = selectedAssignments.filter((assignment) => getActivityCategory(assignment) === tab.value);
        return map;
      }, {}),
    [selectedAssignments]
  );

  const categoryCounts = useMemo(
    () =>
      SCHEDULE_CATEGORY_TABS.reduce((map, tab) => {
        map[tab.value] = categoryAssignments[tab.value]?.length || 0;
        return map;
      }, {}),
    [categoryAssignments]
  );

  // Intentionally removed auto-fallback useEffect to allow selecting empty duty tabs

  const currentCategoryAssignments = useMemo(
    () => [...(categoryAssignments[activeCategory] || [])].sort(sortByTime),
    [activeCategory, categoryAssignments]
  );

  useEffect(() => {
    const stillValid = currentCategoryAssignments.some((assignment) => assignment.Id === activeAssignmentId);
    if (stillValid) return;
    setActiveAssignmentId(currentCategoryAssignments[0]?.Id || null);
  }, [activeAssignmentId, currentCategoryAssignments]);

  const activeAssignment = useMemo(
    () => currentCategoryAssignments.find((assignment) => assignment.Id === activeAssignmentId) || currentCategoryAssignments[0] || null,
    [activeAssignmentId, currentCategoryAssignments]
  );

  const selectedDayAppointments = useMemo(
    () => [...appointments].filter((appointment) => appointment.Status !== 'Cancelled').sort(sortByTime),
    [appointments]
  );

  const activeSessionAppointments = useMemo(() => {
    if (!activeAssignment) return [];
    return selectedDayAppointments.filter((appointment) => isInsideAssignment(appointment, activeAssignment));
  }, [activeAssignment, selectedDayAppointments]);

  const loading = scheduleLoading || appointmentsLoading;
  const doctorName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Doctor';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 bg-white min-h-[calc(100vh-80px)]">
      {/* Header Container */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between border-b border-slate-100 pb-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between md:justify-start gap-8">
            <h1 className="text-3xl sm:text-[32px] font-bold tracking-tight text-[#0A1A44]">Today's Schedule</h1>
            <div className="hidden md:flex items-center gap-2 text-[#0A1A44] font-semibold text-sm">
              <Calendar className="h-5 w-5 text-blue-500" />
              <span>{appointments.length} Appointments Today</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-2xl border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => setSelectedDate((current) => shiftDate(current, -1))}
                className="p-1 text-slate-500 hover:text-slate-900 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2 py-1 text-sm font-bold text-[#0A1A44] border-none outline-none bg-transparent cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setSelectedDate((current) => shiftDate(current, 1))}
                className="p-1 text-slate-500 hover:text-slate-900 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            <ScheduleMonthPicker value={selectedDate} onChange={setSelectedDate} />
          </div>
        </div>
        
        {/* Mobile appointments badge */}
        <div className="flex md:hidden items-center gap-2 text-[#0A1A44] font-bold text-sm">
          <Calendar className="h-5 w-5 text-blue-500" />
          <span>{appointments.length} Appointments Today</span>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-slate-400">
           <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="mt-8">
          {/* Custom Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 mb-8 w-full max-w-full">
            {SCHEDULE_CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.value;
              const tabAssignments = categoryAssignments[tab.value] || [];
              let badgeText = "NOT YET SCHEDULED";
              
              if (tabAssignments.length > 0) {
                 const first = tabAssignments[0];
                 const last = tabAssignments[tabAssignments.length - 1];
                 if (first.StartTime && last.EndTime) {
                   badgeText = `${formatShortTime(first.StartTime)} - ${formatShortTime(last.EndTime)}`;
                 } else {
                   badgeText = "SCHEDULED";
                 }
              }

              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveCategory(tab.value)}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-[3px] pb-4 transition ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                   <span className="font-bold text-[13px] md:text-sm whitespace-nowrap">{tab.label}</span>
                   <span className={`hidden xl:inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{badgeText}</span>
                </button>
              );
            })}
          </div>

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
             <div className="flex items-center gap-2">
                <Calendar className="h-[22px] w-[22px] text-blue-600" />
                <h2 className="text-[20px] font-bold text-[#0A1A44]">
                  Appointments for {SCHEDULE_CATEGORY_TABS.find(t => t.value === activeCategory)?.label || 'Session'}
                </h2>
             </div>
             <div className="inline-block rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-blue-600 self-start">
               VIEWING ACTIVE TAB
             </div>
          </div>

          {/* Table Container */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full text-left">
                <thead className="bg-slate-50/75">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">TIME</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">PATIENT NAME</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">PATIENT HISTORY</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">PATIENT LAB REPORT</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">REFER BY</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">CURRENT STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentCategoryAssignments.length > 0 && selectedDayAppointments.filter(app => currentCategoryAssignments.some(assign => isInsideAssignment(app, assign))).length > 0 ? (
                    selectedDayAppointments
                      .filter(app => currentCategoryAssignments.some(assign => isInsideAssignment(app, assign)))
                      .map((appointment, index) => {
                        const isConfirmed = appointment.Status?.toLowerCase() === 'confirmed';
                        const referral = appointment.ReferredBy || ["Dr. Miller", "Internal Ref", "Self"][index % 3]; // Mock if missing
                        const mockLabFile = `Lab_Report_${String((index % 9) + 9).padStart(2, '0')}.pdf`; // Mock if missing
                        
                        return (
                          <tr key={appointment.Id || index} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-[20px] whitespace-nowrap text-sm font-bold text-[#0A1A44]">
                              {formatTime(appointment.AppointmentTime || appointment.StartTime || '09:00')}
                            </td>
                            <td className="px-6 py-[20px] whitespace-nowrap text-sm font-bold text-[#0A1A44]">
                              {buildPatientName(appointment)}
                            </td>
                            <td className="px-6 py-[20px] whitespace-nowrap">
                              <button className="flex items-center gap-2 text-[13px] font-bold text-blue-500 hover:text-blue-700 transition">
                                <FileText className="h-[14px] w-[14px]" strokeWidth={2.5} /> View History
                              </button>
                            </td>
                            <td className="px-6 py-[20px] whitespace-nowrap">
                              <button className="flex items-center gap-2 text-[13px] font-bold text-blue-500 hover:text-blue-700 transition">
                                <Download className="h-[14px] w-[14px]" strokeWidth={2.5} /> {mockLabFile}
                              </button>
                            </td>
                            <td className="px-6 py-[20px] whitespace-nowrap text-[13px] font-bold text-[#0A1A44]">{referral}</td>
                            <td className="px-6 py-[20px] whitespace-nowrap">
                              <span className={`inline-flex rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] ${isConfirmed ? 'bg-emerald-100/50 text-emerald-600' : 'bg-amber-100/50 text-amber-600'}`}>
                                {appointment.Status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-sm font-bold text-slate-400">
                        No appointments found for this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BA3AF]">
                {(() => {
                  const items = selectedDayAppointments.filter(app => currentCategoryAssignments.some(assign => isInsideAssignment(app, assign)));
                  return `SHOWING ${items.length} FOR CURRENT SESSION`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1 text-slate-400 hover:text-[#0A1A44] transition">
                  <ChevronLeft className="h-[14px] w-[14px]" strokeWidth={3} />
                </button>
                <button className="p-1 text-slate-400 hover:text-[#0A1A44] transition">
                  <ChevronRight className="h-[14px] w-[14px]" strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
