import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ArrowLeft, ArrowRight, Calendar as CalendarIcon, 
  Search, SlidersHorizontal, Printer, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getList, getPayload } from '../../utils/apiPayload';
import ScheduleDayPlannerModal from '../../components/scheduling/ScheduleDayPlannerModal';
import {
  DAY_LABELS,
  buildMonthGrid,
  formatTime,
  getTokenVisual,
  groupAssignmentsByDate,
  toDateKey,
} from '../../components/scheduling/scheduleConfig';

const VIEW_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

const shiftCursorDate = (dateKey, view, direction) => {
  const current = new Date(`${toDateKey(dateKey)}T00:00:00`);
  if (view === 'week') current.setDate(current.getDate() + (direction * 7));
  else if (view === 'day') current.setDate(current.getDate() + direction);
  else current.setMonth(current.getMonth() + direction);
  return toDateKey(current);
};

export default function AdminScheduleManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOpdManager = ['opdmanager', 'opd_manager'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [view, setView] = useState('month');
  const [layoutView, setLayoutView] = useState('grid');
  const [cursorDate, setCursorDate] = useState(toDateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [filters, setFilters] = useState({
    search: '',
    doctorId: '',
    departmentId: '',
    specializationId: '',
  });

  const departments = useMemo(() => {
    const map = new Map();
    doctors.forEach((doctor) => {
      if (doctor.DepartmentId && doctor.DepartmentName) {
        map.set(String(doctor.DepartmentId), doctor.DepartmentName);
      }
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [doctors]);

  const specializations = useMemo(() => {
    const map = new Map();
    doctors
      .filter((doctor) => !filters.departmentId || String(doctor.DepartmentId) === String(filters.departmentId))
      .forEach((doctor) => {
        if (doctor.SpecializationId && doctor.SpecializationName) {
          map.set(String(doctor.SpecializationId), doctor.SpecializationName);
        }
      });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [doctors, filters.departmentId]);

  const filteredDoctors = useMemo(() => doctors.filter((doctor) => {
    if (filters.departmentId && String(doctor.DepartmentId) !== String(filters.departmentId)) return false;
    if (filters.specializationId && String(doctor.SpecializationId) !== String(filters.specializationId)) return false;
    return true;
  }), [doctors, filters.departmentId, filters.specializationId]);

  const loadBoard = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);

    try {
      const [scheduleRes, doctorRes, roomRes, typeRes] = await Promise.all([
        api.get('/scheduling/doctor-schedules', {
          params: {
            view: view,
            cursorDate,
            doctorId: filters.doctorId || undefined,
            departmentId: filters.departmentId || undefined,
            specializationId: filters.specializationId || undefined,
            search: filters.search || undefined,
          },
        }),
        api.get('/scheduling/doctors-list'),
        api.get('/scheduling/rooms'),
        api.get('/scheduling/activity-types'),
      ]);

      const schedulePayload = getPayload(scheduleRes) || {};
      setAssignments(Array.isArray(schedulePayload.assignments) ? schedulePayload.assignments : []);
      setDoctors(getList(doctorRes));
      setRooms(getList(roomRes));
      setActivityTypes(getList(typeRes));
    } catch (error) {
      toast.error(error?.message || 'Could not load schedule planner');
    } finally {
      setLoading(false);
    }
  }, [cursorDate, filters.departmentId, filters.doctorId, filters.search, filters.specializationId, view]);

  useEffect(() => { loadBoard(true); }, [loadBoard]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'departmentId' ? { specializationId: '', doctorId: '' } : {}),
      ...(key === 'specializationId' ? { doctorId: '' } : {}),
    }));
  };

  const boardAssignments = useMemo(() => {
    if (!isOpdManager) return assignments;
    return assignments.filter(
      (assignment) => Boolean(assignment.AllowsOpdSlots) && Boolean(assignment.BookingEnabled)
    );
  }, [assignments, isOpdManager]);

  const groupedAssignments = useMemo(() => groupAssignmentsByDate(boardAssignments), [boardAssignments]);
  const monthCells = useMemo(() => buildMonthGrid(cursorDate), [cursorDate]);

  const monthYearLabel = useMemo(() => {
    const d = new Date(`${toDateKey(cursorDate)}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [cursorDate]);

  const renderPill = (assignment, isMore) => {
    if (isMore) {
      return (
        <div className="mt-1 rounded border border-blue-200 bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800">
          +{assignment.count} MORE
        </div>
      );
    }

    const title = assignment.Title || assignment.ActivityName || 'Scheduled Duty';
    const visual = getTokenVisual(assignment.ColorToken);
    const timeRange = assignment.StartTime && assignment.EndTime
      ? `${formatTime(assignment.StartTime)} - ${formatTime(assignment.EndTime)}`
      : null;

    return (
      <div className={`mt-1 rounded-md border px-2 py-1.5 ${visual.pill}`}>
        <p className="truncate text-[10px] font-extrabold leading-tight">
          {String(title).toUpperCase()}
        </p>
        {timeRange && (
          <p className="mt-0.5 truncate text-[9px] font-semibold opacity-80">
            {timeRange}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-full bg-[#f1f5f9] font-sans rounded-[16px] -m-5">
      
      {/* ── HEADER ROW ── */}
      <div className="p-8 pb-0 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#0B1A2A]">Doctor Schedule Management</h1>
          <p className="text-[14px] text-slate-500 mt-1 font-medium">Coordinating clinical availability across central and satellite campuses.</p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-1 shadow-sm h-fit">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setView(opt.value)}
              className={`px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                view === opt.value
                  ? 'bg-white text-slate-800 shadow-sm rounded'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 pb-8">
        {/* ── FILTER CONTAINER ── */}
        <div className="mb-6 rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="flex-1 min-w-[140px] max-w-[200px] border-r border-slate-100 pr-4">
              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Department</label>
              <select
                value={filters.departmentId}
                onChange={(e) => handleFilterChange('departmentId', e.target.value)}
                className="w-full text-[14px] font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            
            <div className="flex-1 min-w-[140px] max-w-[200px] border-r border-slate-100 pr-4">
              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Specialization</label>
              <select
                value={filters.specializationId}
                onChange={(e) => handleFilterChange('specializationId', e.target.value)}
                className="w-full text-[14px] font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
              >
                <option value="">All Specializations</option>
                {specializations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex-1 min-w-[140px] max-w-[220px]">
               <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 block">Doctor</label>
               <select
                 value={filters.doctorId}
                 onChange={(e) => handleFilterChange('doctorId', e.target.value)}
                 className="w-full text-[14px] font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
               >
                 <option value="">All Doctors</option>
                 {filteredDoctors.map((d) => <option key={d.DoctorProfileId} value={d.DoctorProfileId}>Dr. {d.DoctorName}</option>)}
               </select>
            </div>

            <div className="flex-1 min-w-[200px] relative ml-auto">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 placeholder="Search schedules..." 
                 value={filters.search}
                 onChange={(e) => handleFilterChange('search', e.target.value)}
                 className="w-full rounded-md border border-slate-200 py-2.5 pl-9 pr-3 text-[13px] font-medium text-slate-700 outline-none focus:border-indigo-400"
               />
            </div>
          </div>

          <div className="flex overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-1 flex-shrink-0">
            <button
              onClick={() => setLayoutView('grid')}
              className={`px-3 py-2 text-[12px] font-bold transition-colors ${
                layoutView === 'grid' ? 'bg-white text-slate-800 shadow-sm rounded' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setLayoutView('list')}
              className={`px-3 py-2 text-[12px] font-bold transition-colors ${
                layoutView === 'list' ? 'bg-white text-slate-800 shadow-sm rounded' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              List View
            </button>
          </div>

        </div>

        {/* ── CALENDAR TOOLBAR ── */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setCursorDate(toDateKey(new Date()))}
              className="rounded bg-white px-5 py-2.5 text-[14px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Today
            </button>
            <div className="flex items-center gap-3">
               <button onClick={() => setCursorDate((c) => shiftCursorDate(c, view, -1))} className="text-slate-500 hover:text-slate-800 transition">
                 <ChevronLeft size={20} />
               </button>
               <span className="min-w-[130px] text-center text-[20px] font-bold text-[#142646] tracking-tight">
                 {monthYearLabel}
               </span>
               <button onClick={() => setCursorDate((c) => shiftCursorDate(c, view, 1))} className="text-slate-500 hover:text-slate-800 transition">
                 <ChevronRight size={20} />
               </button>
               <button className="text-slate-800 ml-2 hover:bg-slate-200 p-1.5 rounded transition">
                 <CalendarIcon size={20} />
               </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 rounded bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition">
               <SlidersHorizontal size={15} />
               Filter Doctors
             </button>
             <button className="flex items-center gap-2 rounded bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition">
               <Printer size={15} />
               Print Grid
             </button>
          </div>
        </div>

        {/* ── CALENDAR GRID ── */}
        <div className="rounded-[16px] bg-[#D4D6D9] p-[6px] shadow-sm">
          <div className="grid grid-cols-7 gap-1 px-[2px] pb-[6px] pt-[10px]">
            {DAY_LABELS.map((label) => (
              <div key={label} className="text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-[6px]">
            {monthCells.map((cell, idx) => {
               const cellAssignments = groupedAssignments[cell.dateKey] || [];
               const isFaded = !cell.isCurrentMonth;
               
               const todayKey = toDateKey(new Date());
               const isPast = cell.dateKey < todayKey;
               
               return (
                 <div
                   key={`${cell.dateKey}-${idx}`}
                   onClick={() => {
                     if (isPast) return;
                     if (isOpdManager && !cellAssignments.length) {
                       toast.error('No admin-assigned OPD window exists on this date');
                       return;
                     }
                     setSelectedDate(cell.dateKey);
                     setPlannerOpen(true);
                   }}
                   className={`group relative flex min-h-[140px] flex-col rounded-[12px] p-2 transition-all 
                   ${isPast ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-indigo-300 hover:z-10'} 
                   ${isFaded ? 'bg-[#EBEDF0]' : 'bg-white'} bg-clip-padding`}
                 >
                   <span className={`text-[12px] font-bold mb-1 ${isFaded ? 'text-slate-400' : 'text-slate-800'}`}>
                      {cell.dayNumber}
                   </span>
                   
                   <div className="flex-1 space-y-[4px] overflow-hidden">
                      {cellAssignments.slice(0, 2).map((assignment) => renderPill(assignment, false))}
                      {cellAssignments.length > 2 && renderPill({ count: cellAssignments.length - 2 }, true)}
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      </div>

      <ScheduleDayPlannerModal
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        selectedDate={selectedDate}
        dayAssignments={groupedAssignments[selectedDate] || []}
        doctors={filteredDoctors.length ? filteredDoctors : doctors}
        rooms={rooms}
        activityTypes={activityTypes}
        defaultDoctorId={filters.doctorId}
        isOpdManager={isOpdManager}
        onSaved={async () => {
          setPlannerOpen(false);
          await loadBoard(false);
        }}
      />
    </div>
  );
}
