// src/pages/dashboard/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, Bed, Activity, TrendingUp, Clock,
  CheckCircle, XCircle, AlertCircle, Building2, ArrowRight,
  Stethoscope, Briefcase, Calendar, CalendarOff, Timer,
  Hash, ChevronRight, LayoutGrid
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TODAY_DOW = new Date().getDay();

const fmt12 = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12)}:${String(m).padStart(2,'0')} ${ampm}`;
};

const slotCount = (start, end, dur) => {
  if (!start || !end || !dur) return 0;
  const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  return Math.floor((toMin(end) - toMin(start)) / dur);
};

// Safely extract array from any API response shape
const extractList = (responseData, ...listKeys) => {
  if (!responseData) return [];
  if (Array.isArray(responseData.data)) return responseData.data;
  for (const key of listKeys) {
    if (Array.isArray(responseData[key])) return responseData[key];
  }
  if (Array.isArray(responseData)) return responseData;
  return [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="card">
    <div className="card-body flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">
          {value ?? <span className="text-slate-300 text-lg">—</span>}
        </p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

const PendingCard = ({
  title, icon: Icon, iconColor, items, loading, onApprove, onRejectNavigate,
  approving, navigatePath, badgeColor, avatarColor, avatarText,
  line1, line2, meta,
}) => (
  <div className="card">
    <div className="card-header">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
        <Icon size={16} className={iconColor} />
        {title}
        {items.length > 0 && (
          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
            {items.length}
          </span>
        )}
      </h3>
      <div className="flex items-center gap-2">
        <button onClick={onApprove.reload} className="btn-ghost btn-sm">Refresh</button>
        <button
          onClick={() => onRejectNavigate(navigatePath)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
          View All <ArrowRight size={12} />
        </button>
      </div>
    </div>
    <div className="card-body p-0">
      {loading ? (
        <div className="flex justify-center py-10"><div className="spinner w-6 h-6" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <CheckCircle size={32} className="mb-2 text-green-300" />
          <p className="text-sm font-medium">No pending approvals</p>
          <p className="text-xs">All {title.toLowerCase()} have been reviewed</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-50">
            {items.slice(0, 5).map(item => (
              <div key={item.Id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${avatarColor}`}>
                  {item.FirstName?.[0]}{item.LastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 text-sm">
                    {avatarText} {item.FirstName} {item.LastName}
                  </p>
                  <p className="text-xs text-slate-500">{line1(item)}</p>
                  <p className="text-xs text-slate-400">{line2(item)}</p>
                </div>
                <div className="text-xs text-slate-400 hidden md:block">
                  {meta(item)}
                  <p>{new Date(item.CreatedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => onApprove.approve(item.Id)}
                    disabled={approving === item.Id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50">
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button
                    onClick={() => onRejectNavigate(navigatePath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
          {items.length > 5 && (
            <div className="px-6 py-3 border-t border-slate-50">
              <button
                onClick={() => onRejectNavigate(navigatePath)}
                className="flex items-center gap-1.5 text-indigo-600 text-xs font-semibold hover:underline">
                +{items.length - 5} more pending — View full panel <ArrowRight size={11} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  </div>
);

// ── OPD Slot Utilisation card ─────────────────────────────────────────────────
const SlotUtilisationCard = ({ data, loading, navigate }) => (
  <div className="card">
    <div className="card-header">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
        <LayoutGrid size={15} className="text-indigo-500" />
        Today's OPD Slot Utilisation
      </h3>
      <button
        onClick={() => navigate('/admin/scheduling')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
        Manage Slots <ArrowRight size={12} />
      </button>
    </div>
    <div className="card-body p-0">
      {loading ? (
        <div className="flex justify-center py-10"><div className="spinner w-6 h-6" /></div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Calendar size={32} className="mb-2 text-slate-200" />
          <p className="text-sm font-medium">No slots generated for today</p>
          <p className="text-xs">Configure doctor schedules to generate slots</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {data.slice(0, 6).map(d => {
            const pct = d.TotalSlots ? Math.round((d.BookedSlots / d.TotalSlots) * 100) : 0;
            const color = pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-green-400';
            return (
              <div key={d.DoctorId} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50">
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {d.DoctorName?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">Dr. {d.DoctorName}</p>
                  <p className="text-xs text-slate-400">{d.DepartmentName || 'General'}</p>
                  <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-700">{d.BookedSlots}/{d.TotalSlots}</p>
                  <p className="text-xs text-slate-400">{pct}% booked</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

// ── Doctor Weekly Schedule preview card ──────────────────────────────────────
const DoctorScheduleCard = ({ schedules, loading, navigate }) => {
  const [selectedDay, setSelectedDay] = useState(TODAY_DOW);
  const filtered = (schedules || []).filter(s => s.DayOfWeek === selectedDay && s.IsActive);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Stethoscope size={15} className="text-yellow-500" />
          Doctor Schedules
        </h3>
        <button
          onClick={() => navigate('/admin/scheduling')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
          Manage <ArrowRight size={12} />
        </button>
      </div>

      <div className="px-6 pt-4 pb-2 flex gap-1.5 flex-wrap">
        {DAY_NAMES.map((d, i) => (
          <button key={i} onClick={() => setSelectedDay(i)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors
              ${selectedDay === i
                ? 'bg-primary-600 text-white'
                : i === TODAY_DOW
                  ? 'bg-primary-50 text-primary-700 border border-primary-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {d}
            {i === TODAY_DOW && <span className="ml-1 text-[9px] opacity-70">today</span>}
          </button>
        ))}
      </div>

      <div className="card-body p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner w-5 h-5" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <CalendarOff size={28} className="mb-2 text-slate-200" />
            <p className="text-sm">No doctors scheduled on {DAY_FULL[selectedDay]}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(s => (
              <div key={s.Id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {s.DoctorName?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">Dr. {s.DoctorName}</p>
                  <p className="text-xs text-slate-400">{s.Specialization} · {s.DepartmentName}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">
                    {fmt12(s.StartTime)} – {fmt12(s.EndTime)}
                  </p>
                  <p className="text-slate-400">
                    {s.SlotDurationMins} min · {slotCount(s.StartTime, s.EndTime, s.SlotDurationMins)} slots
                    {s.RoomNumber && ` · Rm ${s.RoomNumber}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Staff Shift card ──────────────────────────────────────────────────────────
const StaffShiftCard = ({ shifts, loading, navigate }) => {
  const [selectedDay, setSelectedDay] = useState(TODAY_DOW);
  const filtered = (shifts || []).filter(s => s.DayOfWeek === selectedDay && s.IsActive);

  const shiftColor = (type) => ({
    morning:   'bg-amber-100 text-amber-700',
    afternoon: 'bg-blue-100 text-blue-700',
    evening:   'bg-purple-100 text-purple-700',
    night:     'bg-slate-200 text-slate-700',
    custom:    'bg-teal-100 text-teal-700',
  }[type] || 'bg-slate-100 text-slate-600');

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Briefcase size={15} className="text-blue-500" />
          Staff Shifts
        </h3>
        <button
          onClick={() => navigate('/admin/scheduling')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
          Manage <ArrowRight size={12} />
        </button>
      </div>

      <div className="px-6 pt-4 pb-2 flex gap-1.5 flex-wrap">
        {DAY_NAMES.map((d, i) => (
          <button key={i} onClick={() => setSelectedDay(i)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors
              ${selectedDay === i
                ? 'bg-blue-600 text-white'
                : i === TODAY_DOW
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {d}
            {i === TODAY_DOW && <span className="ml-1 text-[9px] opacity-70">today</span>}
          </button>
        ))}
      </div>

      <div className="card-body p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner w-5 h-5" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <CalendarOff size={28} className="mb-2 text-slate-200" />
            <p className="text-sm">No staff scheduled on {DAY_FULL[selectedDay]}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(s => (
              <div key={s.Id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {s.StaffName?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">{s.StaffName}</p>
                  <p className="text-xs text-slate-400">{s.Role?.replace(/_/g,' ')} · {s.DepartmentName || 'No dept'}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-slate-700">
                    {fmt12(s.StartTime)} – {fmt12(s.EndTime)}
                  </p>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${shiftColor(s.ShiftType)}`}>
                    {s.ShiftType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Leave Requests card ───────────────────────────────────────────────────────
const LeaveRequestsCard = ({ leaves, loading, onApprove, navigate }) => (
  <div className="card">
    <div className="card-header">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
        <CalendarOff size={15} className="text-red-500" />
        Pending Leave Requests
        {leaves.length > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
            {leaves.length}
          </span>
        )}
      </h3>
      <button
        onClick={() => navigate('/admin/scheduling')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
        View All <ArrowRight size={12} />
      </button>
    </div>
    <div className="card-body p-0">
      {loading ? (
        <div className="flex justify-center py-8"><div className="spinner w-5 h-5" /></div>
      ) : leaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <CheckCircle size={28} className="mb-2 text-green-300" />
          <p className="text-sm">No pending leave requests</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {leaves.slice(0, 5).map(l => (
            <div key={`${l.Type}-${l.Id}`} className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0
                ${l.Type === 'doctor' ? 'bg-primary-100 text-primary-700' : 'bg-blue-100 text-blue-700'}`}>
                {l.Name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">
                  {l.Type === 'doctor' ? 'Dr. ' : ''}{l.Name}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(l.LeaveDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                  &nbsp;·&nbsp;{l.LeaveType?.replace(/_/g,' ')}
                </p>
                {l.Reason && <p className="text-xs text-slate-400 truncate">{l.Reason}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => onApprove(l.Type, l.Id, 'approved')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors">
                  <CheckCircle size={12} /> Approve
                </button>
                <button
                  onClick={() => navigate('/admin/scheduling')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                  <XCircle size={12} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ── OPD Queue card ─────────────────────────────────────────────────────────────
const OpdQueueCard = ({ queue, loading, navigate }) => {
  const statusColor = (s) => ({
    waiting:   'bg-amber-100 text-amber-700',
    called:    'bg-blue-100 text-blue-700',
    serving:   'bg-green-100 text-green-700',
    served:    'bg-slate-100 text-slate-500',
    skipped:   'bg-red-100 text-red-600',
    cancelled: 'bg-slate-100 text-slate-400',
  }[s] || 'bg-slate-100 text-slate-500');

  const priorityDot = (p) => ({
    urgent: 'bg-red-500',
    vip:    'bg-purple-500',
    normal: 'bg-slate-300',
  }[p] || 'bg-slate-300');

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Hash size={15} className="text-teal-500" />
          Live OPD Queue — Today
        </h3>
        <button
          onClick={() => navigate('/admin/scheduling')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors">
          Full View <ArrowRight size={12} />
        </button>
      </div>
      <div className="card-body p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner w-5 h-5" /></div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Timer size={28} className="mb-2 text-slate-200" />
            <p className="text-sm">Queue is empty today</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {queue.slice(0, 6).map(q => (
              <div key={q.Id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-700 flex-shrink-0">
                  #{q.TokenNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot(q.Priority)}`} />
                    <p className="text-sm font-semibold text-slate-700 truncate">{q.PatientName || 'Patient'}</p>
                  </div>
                  <p className="text-xs text-slate-400">Dr. {q.DoctorName}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(q.QueueStatus)}`}>
                  {q.QueueStatus}
                </span>
              </div>
            ))}
            {queue.length > 6 && (
              <div className="px-6 py-2.5 border-t border-slate-50">
                <button onClick={() => navigate('/admin/scheduling')}
                  className="flex items-center gap-1 text-indigo-600 text-xs font-semibold hover:underline">
                  +{queue.length - 6} more in queue <ChevronRight size={11} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [pendingStaff,   setPendingStaff]   = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingStaff,   setLoadingStaff]   = useState(true);
  const [approvingDoc,   setApprovingDoc]   = useState(null);
  const [approvingStaff, setApprovingStaff] = useState(null);
  const [stats,          setStats]          = useState({});

  const [doctorSchedules, setDoctorSchedules] = useState([]);
  const [staffShifts,     setStaffShifts]     = useState([]);
  const [slotSummary,     setSlotSummary]     = useState([]);
  const [pendingLeaves,   setPendingLeaves]   = useState([]);
  const [opdQueue,        setOpdQueue]        = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    loadPendingDoctors();
    loadPendingStaff();
    loadStats();
    loadSchedulingData();
  }, []);

  const loadPendingDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const r = await api.get('/register/pending-doctors');
      setPendingDoctors(extractList(r.data));
    } catch { setPendingDoctors([]); }
    setLoadingDoctors(false);
  };

  const loadPendingStaff = async () => {
    setLoadingStaff(true);
    try {
      const r = await api.get('/register/pending-staff');
      setPendingStaff(extractList(r.data));
    } catch { setPendingStaff([]); }
    setLoadingStaff(false);
  };

  const loadStats = async () => {
    try {
      const r = await api.get('/users?limit=1');
      setStats(r.data.meta || {});
    } catch {}
  };

  const loadSchedulingData = async () => {
    setLoadingSchedule(true);
    try {
      const [schedRes, staffRes, slotRes, leaveRes, queueRes] = await Promise.allSettled([
        api.get('/scheduling/doctor-schedules'),
        api.get('/scheduling/staff-shifts'),
        api.get('/scheduling/slots/today/summary'),
        api.get('/scheduling/leaves?status=pending'),
        api.get('/scheduling/queue/today'),
      ]);

      if (schedRes.status === 'fulfilled') setDoctorSchedules(extractList(schedRes.value.data));
      if (staffRes.status === 'fulfilled')  setStaffShifts(extractList(staffRes.value.data));
      if (slotRes.status === 'fulfilled')   setSlotSummary(extractList(slotRes.value.data));
      if (leaveRes.status === 'fulfilled')  setPendingLeaves(extractList(leaveRes.value.data));
      if (queueRes.status === 'fulfilled')  setOpdQueue(extractList(queueRes.value.data));
    } catch {}
    setLoadingSchedule(false);
  };

  const handleApproveDoctor = async (id) => {
    setApprovingDoc(id);
    try {
      await api.patch(`/register/approve-doctor/${id}`, { action: 'approved' });
      toast.success('Doctor approved successfully');
      setPendingDoctors(p => p.filter(d => d.Id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve doctor');
    }
    setApprovingDoc(null);
  };

  const handleApproveStaff = async (id) => {
    setApprovingStaff(id);
    try {
      await api.patch(`/register/approve-staff/${id}`, { action: 'approved' });
      toast.success('Staff member approved successfully');
      setPendingStaff(p => p.filter(s => s.Id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve staff');
    }
    setApprovingStaff(null);
  };

  const handleLeaveAction = async (type, id, action) => {
    try {
      const endpoint = type === 'doctor'
        ? `/scheduling/doctor-leaves/${id}`
        : `/scheduling/staff-leaves/${id}`;
      await api.patch(endpoint, { status: action });
      toast.success(`Leave ${action} successfully`);
      setPendingLeaves(p => p.filter(l => !(l.Type === type && l.Id === id)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update leave');
    }
  };

  const hasScheduleAlerts = pendingLeaves.length > 0;

  return (
    <div className="space-y-6">

      {/* Greeting header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName || 'Admin'} 👋</h1>
          <p className="page-subtitle">Here's what's happening at your hospital today.</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-700">
            {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
          <p className="text-xs text-slate-400">
            {user?.role === 'superadmin' ? 'Super Administrator' : 'Hospital Administrator'}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Total Patients" value="—" sub="This month" color="bg-blue-500" />
        <StatCard icon={UserCheck}  label="Active Doctors" value="—" sub="On staff"   color="bg-primary-600" />
        <StatCard icon={Bed}        label="Beds Occupied"  value="—" sub="/ Total"    color="bg-green-500" />
        <StatCard icon={TrendingUp} label="Revenue Today"  value="—" sub="₹"          color="bg-orange-500" />
      </div>

      {/* Alert banners */}
      {(pendingDoctors.length > 0 || pendingStaff.length > 0) && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            You have{' '}
            {pendingDoctors.length > 0 && (
              <span className="font-bold">{pendingDoctors.length} doctor{pendingDoctors.length > 1 ? 's' : ''}</span>
            )}
            {pendingDoctors.length > 0 && pendingStaff.length > 0 && ' and '}
            {pendingStaff.length > 0 && (
              <span className="font-bold">{pendingStaff.length} staff member{pendingStaff.length > 1 ? 's' : ''}</span>
            )}
            {' '}awaiting approval.
          </p>
        </div>
      )}

      {hasScheduleAlerts && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-red-50 border border-red-200">
          <CalendarOff size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            <span className="font-bold">{pendingLeaves.length} leave request{pendingLeaves.length > 1 ? 's' : ''}</span>
            {' '}pending your approval — affected slots will auto-block on approval.
          </p>
          <button
            onClick={() => navigate('/admin/scheduling')}
            className="ml-auto flex items-center gap-1 text-red-600 text-xs font-semibold hover:underline flex-shrink-0">
            Review <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Pending Doctor Approvals */}
      <PendingCard
        title="Pending Doctor Approvals"
        icon={Stethoscope}
        iconColor="text-yellow-500"
        items={pendingDoctors}
        loading={loadingDoctors}
        approving={approvingDoc}
        navigatePath="/admin/doctor-approvals"
        badgeColor="bg-yellow-100 text-yellow-700"
        avatarColor="bg-primary-100 text-primary-700"
        avatarText="Dr."
        onApprove={{ approve: handleApproveDoctor, reload: loadPendingDoctors }}
        onRejectNavigate={navigate}
        line1={d => `${d.SpecializationName || '—'} · ${d.QualificationName || d.QualificationCode || '—'}`}
        line2={d => `${d.Email} · Lic: ${d.LicenseNumber}`}
        meta={d => (
          <>
            {d.ExperienceYears && <p>{d.ExperienceYears} yrs exp</p>}
            {d.ConsultationFee && <p>₹{d.ConsultationFee} fee</p>}
          </>
        )}
      />

      {/* Pending Staff Approvals */}
      <PendingCard
        title="Pending Staff Approvals"
        icon={Briefcase}
        iconColor="text-blue-500"
        items={pendingStaff}
        loading={loadingStaff}
        approving={approvingStaff}
        navigatePath="/admin/staff-approvals"
        badgeColor="bg-blue-100 text-blue-700"
        avatarColor="bg-blue-100 text-blue-700"
        avatarText=""
        onApprove={{ approve: handleApproveStaff, reload: loadPendingStaff }}
        onRejectNavigate={navigate}
        line1={s => `${s.Role ? s.Role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'} · ${s.DepartmentName || 'No dept'}`}
        line2={s => `${s.Email} · ${s.Phone}`}
        meta={s => (
          <>
            {s.Shift           && <p>{s.Shift} shift</p>}
            {s.ExperienceYears && <p>{s.ExperienceYears} yrs exp</p>}
          </>
        )}
      />

      {/* Scheduling section header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar size={16} className="text-indigo-500" />
            Scheduling & OPD
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage doctor &amp; staff schedules, slots, leaves, and the live OPD queue.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/scheduling')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
          <Calendar size={13} /> Open Scheduler
        </button>
      </div>

      {/* Slot utilisation + Leave requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SlotUtilisationCard
          data={slotSummary}
          loading={loadingSchedule}
          navigate={navigate}
        />
        <LeaveRequestsCard
          leaves={pendingLeaves}
          loading={loadingSchedule}
          onApprove={handleLeaveAction}
          navigate={navigate}
        />
      </div>

      {/* Doctor Schedules + Staff Shifts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DoctorScheduleCard
          schedules={doctorSchedules}
          loading={loadingSchedule}
          navigate={navigate}
        />
        <StaffShiftCard
          shifts={staffShifts}
          loading={loadingSchedule}
          navigate={navigate}
        />
      </div>

      {/* OPD Queue (full width) */}
      <OpdQueueCard
        queue={opdQueue}
        loading={loadingSchedule}
        navigate={navigate}
      />

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Activity size={15} /> Recent Activity
            </h3>
          </div>
          <div className="card-body p-0">
            {[
              { text: 'New patient registered',       time: '2 min ago', color: 'bg-blue-400'   },
              { text: 'Dr. Sharma approved',          time: '1 hr ago',  color: 'bg-green-400'  },
              { text: 'Invoice #1042 generated',      time: '2 hrs ago', color: 'bg-orange-400' },
              { text: 'Lab report uploaded',          time: '3 hrs ago', color: 'bg-purple-400' },
              { text: 'Bed #12 assigned to patient',  time: '4 hrs ago', color: 'bg-teal-400'   },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-50 last:border-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.color}`} />
                <span className="text-sm text-slate-600 flex-1">{a.text}</span>
                <span className="text-xs text-slate-400">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Building2 size={15} /> Department Overview
            </h3>
          </div>
          <div className="card-body space-y-3">
            {[
              { name: 'Cardiology',  patients: 24, capacity: 30 },
              { name: 'Orthopedics', patients: 18, capacity: 25 },
              { name: 'Pediatrics',  patients: 31, capacity: 40 },
              { name: 'Neurology',   patients: 12, capacity: 20 },
              { name: 'General',     patients: 45, capacity: 60 },
            ].map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">{d.name}</span>
                  <span className="text-xs text-slate-400">{d.patients}/{d.capacity}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${(d.patients / d.capacity) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}