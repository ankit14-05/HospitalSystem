import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Save, ShieldAlert } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getList, getPayload } from '../../utils/apiPayload';
import SlotTimeGrid from '../../components/scheduling/SlotTimeGrid';
import ScheduleCategoryTabs from '../../components/scheduling/ScheduleCategoryTabs';
import {
  CATEGORY_DEFAULT_ACTIVITY_CODE,
  DAY_LABELS,
  formatLongDate,
  formatTime,
  getActivityCategory,
  getCategoryActivityTypes,
  getTokenVisual,
  toDateKey,
  toTimeValue,
  toWeekday,
} from '../../components/scheduling/scheduleConfig';

const CATEGORY_LOCATION_KIND = {
  opd: 'opd_room',
  ward: 'ward',
  ot: 'ot',
  other: 'general',
};

const defaultAdminForm = {
  DoctorId: '',
  Category: 'opd',
  ActivityTypeId: '',
  Title: '',
  AssignmentDate: toDateKey(new Date()),
  StartTime: '09:00',
  EndTime: '13:00',
  LocationKind: 'opd_room',
  OpdRoomId: '',
  LocationLabel: '',
  SlotDurationMins: 15,
  MaxSlots: '',
  BookingEnabled: true,
  Notes: '',
  RepeatEnabled: false,
  RepeatUntil: '',
  RepeatDays: [],
};

const defaultOpdForm = {
  DoctorId: '',
  SessionDate: toDateKey(new Date()),
  AssignmentId: '',
  StartTime: '09:00',
  EndTime: '13:00',
  SlotDurationMins: 15,
  OpdRoomId: '',
  Notes: '',
  RepeatEnabled: false,
  RepeatUntil: '',
  SelectedTimes: [],
};

const toMinutes = (value) => {
  const time = toTimeValue(value);
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const generateSlotTimes = (startTime, endTime, slotDurationMins) => {
  const duration = Number(slotDurationMins) || 15;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const slots = [];

  for (let current = start; current < end; current += duration) {
    const hours = String(Math.floor(current / 60)).padStart(2, '0');
    const minutes = String(current % 60).padStart(2, '0');
    slots.push(`${hours}:${minutes}`);
  }

  return slots;
};

const getMonthEnd = (dateKey) => {
  const date = new Date(`${toDateKey(dateKey)}T00:00:00`);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

const isOverlapping = (leftStart, leftEnd, rightStart, rightEnd) =>
  toMinutes(leftStart) < toMinutes(rightEnd) && toMinutes(leftEnd) > toMinutes(rightStart);

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_25px_80px_-60px_rgba(15,23,42,0.45)]">
      <div className="mb-4">
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function AssignmentCard({ assignment, active = false, onClick }) {
  const visual = getTokenVisual(assignment.ColorToken);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
        active ? 'border-indigo-300 bg-indigo-50' : `${visual.card} hover:border-slate-300`
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${visual.dot}`} />
          <p className="text-sm font-black text-slate-900">
            {assignment.Title || assignment.ActivityName}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${visual.pill}`}>
          {assignment.ActivityName}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-600">
        {formatTime(assignment.StartTime)} - {formatTime(assignment.EndTime)}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {assignment.LocationLabel || assignment.RoomNumber || 'Location not set'}
      </p>
    </button>
  );
}

export default function DoctorScheduleEditorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const isEdit = Boolean(id);
  const isOpdManager = ['opdmanager', 'opd_manager'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [dayOverview, setDayOverview] = useState(null);
  const [adminForm, setAdminForm] = useState(defaultAdminForm);
  const [opdForm, setOpdForm] = useState({
    ...defaultOpdForm,
    DoctorId: searchParams.get('doctorId') || '',
    SessionDate: searchParams.get('date') || defaultOpdForm.SessionDate,
  });

  const adminCategoryTypes = useMemo(
    () => getCategoryActivityTypes(activityTypes, adminForm.Category),
    [activityTypes, adminForm.Category]
  );

  const selectedDoctor = useMemo(
    () =>
      doctors.find(
        (doctor) =>
          String(doctor.DoctorProfileId) ===
          String(isOpdManager ? opdForm.DoctorId : adminForm.DoctorId)
      ),
    [adminForm.DoctorId, doctors, isOpdManager, opdForm.DoctorId]
  );

  const availableRooms = useMemo(() => {
    if (!selectedDoctor?.DepartmentId) return rooms;
    return rooms.filter(
      (room) => !room.DepartmentId || String(room.DepartmentId) === String(selectedDoctor.DepartmentId)
    );
  }, [rooms, selectedDoctor]);

  const dateAssignments = dayOverview?.assignments || [];
  const dateSessions = dayOverview?.sessions || [];

  const opdAssignments = useMemo(
    () => dateAssignments.filter((assignment) => assignment.AllowsOpdSlots && assignment.BookingEnabled),
    [dateAssignments]
  );

  const selectedAssignment = useMemo(
    () => opdAssignments.find((assignment) => String(assignment.Id) === String(opdForm.AssignmentId)),
    [opdAssignments, opdForm.AssignmentId]
  );

  const previewSlots = useMemo(
    () => generateSlotTimes(opdForm.StartTime, opdForm.EndTime, opdForm.SlotDurationMins),
    [opdForm.EndTime, opdForm.SlotDurationMins, opdForm.StartTime]
  );

  const clientConflicts = useMemo(() => {
    if (isOpdManager) return [];
    if (!adminForm.StartTime || !adminForm.EndTime) return [];
    return dateAssignments.filter((assignment) => {
      if (isEdit && String(assignment.Id) === String(id)) return false;
      return isOverlapping(adminForm.StartTime, adminForm.EndTime, assignment.StartTime, assignment.EndTime);
    });
  }, [adminForm.EndTime, adminForm.StartTime, dateAssignments, id, isEdit, isOpdManager]);

  const loadDayOverview = useCallback(
    async (doctorId, date, preferredAssignmentId = null) => {
      if (!doctorId || !date) {
        setDayOverview(null);
        return null;
      }

      try {
        const response = await api.get('/scheduling/day-overview', { params: { doctorId, date } });
        const payload = getPayload(response);
        setDayOverview(payload);

        if (isOpdManager) {
          const assignments = (payload?.assignments || []).filter(
            (assignment) => assignment.AllowsOpdSlots && assignment.BookingEnabled
          );
          const preferred =
            assignments.find((assignment) => String(assignment.Id) === String(preferredAssignmentId)) ||
            assignments[0];
          setOpdForm((current) => ({
            ...current,
            AssignmentId: preferred ? String(preferred.Id) : '',
          }));
        }

        return payload;
      } catch (error) {
        setDayOverview(null);
        toast.error(error?.message || 'Could not load day overview');
        return null;
      }
    },
    [isOpdManager]
  );

  const loadEditor = useCallback(async () => {
    setLoading(true);
    try {
      const [doctorRes, roomRes, typeRes] = await Promise.all([
        api.get('/scheduling/doctors-list'),
        api.get('/scheduling/rooms'),
        api.get('/scheduling/activity-types'),
      ]);

      const doctorList = getList(doctorRes);
      const roomList = getList(roomRes);
      const typeList = getList(typeRes);

      setDoctors(doctorList);
      setRooms(roomList);
      setActivityTypes(typeList);

      if (isEdit) {
        const response = await api.get(`/scheduling/doctor-schedules/${id}`);
        const assignment = getPayload(response);
        const category = getActivityCategory(assignment);

        setAdminForm({
          ...defaultAdminForm,
          DoctorId: String(assignment.DoctorId || ''),
          Category: category,
          ActivityTypeId: String(assignment.ActivityTypeId || ''),
          Title: assignment.Title || '',
          AssignmentDate: toDateKey(assignment.AssignmentDate),
          StartTime: toTimeValue(assignment.StartTimeText || assignment.StartTime),
          EndTime: toTimeValue(assignment.EndTimeText || assignment.EndTime),
          LocationKind: assignment.LocationKind || CATEGORY_LOCATION_KIND[category],
          OpdRoomId: assignment.OpdRoomId ? String(assignment.OpdRoomId) : '',
          LocationLabel: assignment.LocationLabel || '',
          SlotDurationMins: Number(assignment.SlotDurationMins) || 15,
          MaxSlots: assignment.MaxSlots || '',
          BookingEnabled: Boolean(assignment.BookingEnabled),
          Notes: assignment.Notes || '',
          RepeatDays: [toWeekday(assignment.AssignmentDate)],
        });

        await loadDayOverview(assignment.DoctorId, assignment.AssignmentDate, assignment.Id);
      } else if (isOpdManager) {
        const doctorId = searchParams.get('doctorId') || '';
        const date = searchParams.get('date') || defaultOpdForm.SessionDate;

        setOpdForm((current) => ({
          ...current,
          DoctorId: doctorId || current.DoctorId,
          SessionDate: date || current.SessionDate,
        }));

        if (doctorId && date) {
          await loadDayOverview(doctorId, date);
        }
      } else {
        const doctorId = searchParams.get('doctorId') || '';
        const date = searchParams.get('date') || defaultAdminForm.AssignmentDate;
        const defaultType =
          typeList.find((item) => item.Code === CATEGORY_DEFAULT_ACTIVITY_CODE.opd) || typeList[0];

        setAdminForm((current) => ({
          ...current,
          DoctorId: doctorId || current.DoctorId,
          AssignmentDate: date || current.AssignmentDate,
          Category: getActivityCategory(defaultType),
          ActivityTypeId: String(defaultType?.Id || ''),
          Title: current.Title || defaultType?.Name || '',
          RepeatDays: [toWeekday(date || current.AssignmentDate)],
        }));

        if (doctorId && date) {
          await loadDayOverview(doctorId, date);
        }
      }
    } catch (error) {
      toast.error(error?.message || 'Could not load schedule editor');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, isOpdManager, loadDayOverview, searchParams]);

  useEffect(() => {
    loadEditor();
  }, [loadEditor]);

  useEffect(() => {
    if (loading || isOpdManager) return;
    if (!adminForm.DoctorId || !adminForm.AssignmentDate) {
      setDayOverview(null);
      return;
    }
    loadDayOverview(adminForm.DoctorId, adminForm.AssignmentDate, id);
  }, [adminForm.AssignmentDate, adminForm.DoctorId, id, isOpdManager, loadDayOverview, loading]);

  useEffect(() => {
    if (loading || !isOpdManager) return;
    if (!opdForm.DoctorId || !opdForm.SessionDate) {
      setDayOverview(null);
      return;
    }
    loadDayOverview(opdForm.DoctorId, opdForm.SessionDate, opdForm.AssignmentId);
  }, [isOpdManager, loadDayOverview, loading, opdForm.AssignmentId, opdForm.DoctorId, opdForm.SessionDate]);

  useEffect(() => {
    if (isOpdManager || !activityTypes.length) return;
    const validType = adminCategoryTypes.find((item) => String(item.Id) === String(adminForm.ActivityTypeId));
    if (validType) return;

    const fallback =
      adminCategoryTypes.find((item) => item.Code === CATEGORY_DEFAULT_ACTIVITY_CODE[adminForm.Category]) ||
      adminCategoryTypes[0] ||
      activityTypes[0];

    if (fallback) {
      setAdminForm((current) => ({
        ...current,
        ActivityTypeId: String(fallback.Id),
        Title: current.Title || fallback.Name,
        LocationKind: CATEGORY_LOCATION_KIND[getActivityCategory(fallback)],
        BookingEnabled: getActivityCategory(fallback) === 'opd',
      }));
    }
  }, [activityTypes, adminCategoryTypes, adminForm.ActivityTypeId, adminForm.Category, isOpdManager]);

  useEffect(() => {
    if (!isOpdManager || !selectedAssignment) return;
    setOpdForm((current) => ({
      ...current,
      StartTime: toTimeValue(selectedAssignment.StartTime),
      EndTime: toTimeValue(selectedAssignment.EndTime),
      SlotDurationMins: Number(selectedAssignment.SlotDurationMins) || current.SlotDurationMins || 15,
      OpdRoomId: current.OpdRoomId || (selectedAssignment.OpdRoomId ? String(selectedAssignment.OpdRoomId) : ''),
    }));
  }, [isOpdManager, selectedAssignment]);

  useEffect(() => {
    if (!isOpdManager) return;
    setOpdForm((current) => ({ ...current, SelectedTimes: previewSlots }));
  }, [isOpdManager, previewSlots]);

  const handleAdminChange = (key, value) => {
    setAdminForm((current) => ({ ...current, [key]: value }));
  };

  const handleCategoryChange = (category) => {
    const nextTypes = getCategoryActivityTypes(activityTypes, category);
    const nextType =
      nextTypes.find((item) => item.Code === CATEGORY_DEFAULT_ACTIVITY_CODE[category]) || nextTypes[0] || null;

    setAdminForm((current) => ({
      ...current,
      Category: category,
      ActivityTypeId: nextType ? String(nextType.Id) : '',
      Title: current.Title || nextType?.Name || '',
      LocationKind: CATEGORY_LOCATION_KIND[category],
      OpdRoomId: category === 'opd' ? current.OpdRoomId : '',
      LocationLabel: category === 'opd' ? '' : current.LocationLabel,
      BookingEnabled: category === 'opd',
    }));
  };

  const toggleRepeatDay = (dayIndex) => {
    setAdminForm((current) => {
      const exists = current.RepeatDays.includes(dayIndex);
      return {
        ...current,
        RepeatDays: exists
          ? current.RepeatDays.filter((day) => day !== dayIndex)
          : [...current.RepeatDays, dayIndex].sort((left, right) => left - right),
      };
    });
  };

  const toggleAdminRepeat = () => {
    setAdminForm((current) => ({
      ...current,
      RepeatEnabled: !current.RepeatEnabled,
      RepeatUntil: current.RepeatEnabled ? '' : current.RepeatUntil || getMonthEnd(current.AssignmentDate),
      RepeatDays: current.RepeatDays.length ? current.RepeatDays : [toWeekday(current.AssignmentDate)],
    }));
  };

  const handleOpdChange = (key, value) => {
    setOpdForm((current) => ({ ...current, [key]: value }));
  };

  const toggleSelectedTime = (slot) => {
    setOpdForm((current) => {
      const exists = current.SelectedTimes.includes(slot);
      return {
        ...current,
        SelectedTimes: exists
          ? current.SelectedTimes.filter((time) => time !== slot)
          : [...current.SelectedTimes, slot].sort(),
      };
    });
  };

  const toggleOpdRepeat = () => {
    setOpdForm((current) => ({
      ...current,
      RepeatEnabled: !current.RepeatEnabled,
      RepeatUntil: current.RepeatEnabled ? '' : current.RepeatUntil || getMonthEnd(current.SessionDate),
    }));
  };

  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        DoctorId: Number(adminForm.DoctorId),
        ActivityTypeId: Number(adminForm.ActivityTypeId),
        Title: adminForm.Title?.trim() || undefined,
        AssignmentDate: adminForm.AssignmentDate,
        StartTime: adminForm.StartTime,
        EndTime: adminForm.EndTime,
        LocationKind: adminForm.Category === 'opd' ? 'opd_room' : CATEGORY_LOCATION_KIND[adminForm.Category],
        OpdRoomId: adminForm.Category === 'opd' && adminForm.OpdRoomId ? Number(adminForm.OpdRoomId) : null,
        LocationLabel: adminForm.Category === 'opd' ? null : adminForm.LocationLabel?.trim() || null,
        SlotDurationMins: adminForm.Category === 'opd' ? Number(adminForm.SlotDurationMins) || 15 : null,
        MaxSlots: adminForm.Category === 'opd' && adminForm.MaxSlots ? Number(adminForm.MaxSlots) : null,
        BookingEnabled: adminForm.Category === 'opd' ? Boolean(adminForm.BookingEnabled) : false,
        Notes: adminForm.Notes?.trim() || null,
        RepeatEnabled: Boolean(adminForm.RepeatEnabled),
        RepeatFrequency: 'weekly',
        RepeatUntil: adminForm.RepeatEnabled ? adminForm.RepeatUntil || null : null,
        RepeatDays:
          adminForm.RepeatEnabled && adminForm.RepeatDays.length
            ? adminForm.RepeatDays
            : [toWeekday(adminForm.AssignmentDate)],
      };

      const response = isEdit
        ? await api.put(`/scheduling/doctor-schedules/${id}`, payload)
        : await api.post('/scheduling/doctor-schedules', payload);

      const result = getPayload(response);
      const count = Array.isArray(result) ? result.length : 1;
      toast.success(isEdit ? 'Schedule updated' : `${count} schedule assignment${count === 1 ? '' : 's'} created`);
      navigate('/admin/schedule-manager');
    } catch (error) {
      toast.error(error?.message || 'Could not save schedule assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleOpdSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/scheduling/opd-slot-sessions', {
        DoctorId: Number(opdForm.DoctorId),
        SessionDate: opdForm.SessionDate,
        AssignmentId: Number(opdForm.AssignmentId),
        StartTime: opdForm.StartTime,
        EndTime: opdForm.EndTime,
        SlotDurationMins: Number(opdForm.SlotDurationMins) || 15,
        OpdRoomId: opdForm.OpdRoomId ? Number(opdForm.OpdRoomId) : null,
        Notes: opdForm.Notes?.trim() || null,
        RepeatEnabled: Boolean(opdForm.RepeatEnabled),
        RepeatFrequency: 'weekly',
        RepeatUntil: opdForm.RepeatEnabled ? opdForm.RepeatUntil || null : null,
        SelectedTimes: opdForm.SelectedTimes,
      });

      toast.success('OPD slots published successfully');
      navigate('/admin/schedule-manager');
    } catch (error) {
      toast.error(error?.message || 'Could not publish OPD slots');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-500">
          <Loader2 size={18} className="animate-spin text-teal-600" />
          Loading schedule editor...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-6 shadow-[0_25px_80px_-60px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/admin/schedule-manager')}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-slate-500 transition hover:bg-slate-100"
            >
              <ArrowLeft size={14} />
              Back to board
            </button>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              {isOpdManager ? 'Publish OPD Slots' : isEdit ? 'Update Doctor Schedule' : 'Create Doctor Schedule'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">
              {isOpdManager
                ? 'Publish bookable patient slots only inside the assigned OPD window.'
                : 'Use the four scheduling lanes and multi-day apply to create clean monthly doctor schedules.'}
            </p>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              {isOpdManager ? 'OPD Desk' : 'Schedule Context'}
            </p>
            <p className="mt-2 text-sm font-black text-slate-900">
              {selectedDoctor ? `Dr. ${selectedDoctor.DoctorName}` : 'Choose doctor'}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {selectedDoctor?.DepartmentName || 'Department pending'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <form onSubmit={isOpdManager ? handleOpdSubmit : handleAdminSubmit} className="space-y-6">
          {!isOpdManager ? (
            <>
              <SectionCard title="Duty Type" subtitle="Pick one of the four duty lanes first.">
                <ScheduleCategoryTabs
                  activeCategory={adminForm.Category}
                  onChange={handleCategoryChange}
                  counts={{ opd: 0, ward: 0, ot: 0, other: 0 }}
                />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Doctor">
                    <select
                      value={adminForm.DoctorId}
                      onChange={(event) => handleAdminChange('DoctorId', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.DoctorProfileId} value={doctor.DoctorProfileId}>
                          Dr. {doctor.DoctorName}
                          {doctor.SpecializationName ? ` • ${doctor.SpecializationName}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Sub Type">
                    <select
                      value={adminForm.ActivityTypeId}
                      onChange={(event) => handleAdminChange('ActivityTypeId', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="">Select subtype</option>
                      {adminCategoryTypes.map((activityType) => (
                        <option key={activityType.Id} value={activityType.Id}>
                          {activityType.Name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </SectionCard>

              <SectionCard title="Date, Time & Location" subtitle="A compact block with the fields that matter for the selected duty lane.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Date">
                    <input
                      type="date"
                      value={adminForm.AssignmentDate}
                      onChange={(event) => handleAdminChange('AssignmentDate', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </Field>

                  <Field label="Title">
                    <input
                      value={adminForm.Title}
                      onChange={(event) => handleAdminChange('Title', event.target.value)}
                      placeholder="Morning OPD, Round 1, Surgery block..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </Field>

                  <Field label="Start Time">
                    <input
                      type="time"
                      value={adminForm.StartTime}
                      onChange={(event) => handleAdminChange('StartTime', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </Field>

                  <Field label="End Time">
                    <input
                      type="time"
                      value={adminForm.EndTime}
                      onChange={(event) => handleAdminChange('EndTime', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </Field>

                  {adminForm.Category === 'opd' ? (
                    <Field label="OPD Room">
                      <select
                        value={adminForm.OpdRoomId}
                        onChange={(event) => handleAdminChange('OpdRoomId', event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                      >
                        <option value="">Select room</option>
                        {availableRooms.map((room) => (
                          <option key={room.Id} value={room.Id}>
                            {room.RoomNumber}
                            {room.RoomName ? ` • ${room.RoomName}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Location">
                      <input
                        value={adminForm.LocationLabel}
                        onChange={(event) => handleAdminChange('LocationLabel', event.target.value)}
                        placeholder={
                          adminForm.Category === 'ward'
                            ? 'Ward / unit'
                            : adminForm.Category === 'ot'
                              ? 'OT / theatre'
                              : 'Meeting room / other location'
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                      />
                    </Field>
                  )}
                </div>
              </SectionCard>

              {adminForm.Category === 'opd' ? (
                <SectionCard title="OPD Window" subtitle="Only OPD blocks can later be published by the OPD manager.">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Slot Duration">
                      <select
                        value={adminForm.SlotDurationMins}
                        onChange={(event) => handleAdminChange('SlotDurationMins', Number(event.target.value))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                      >
                        {[10, 15, 20, 30, 45, 60].map((duration) => (
                          <option key={duration} value={duration}>
                            {duration} minutes
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Max Slots">
                      <input
                        type="number"
                        min="1"
                        value={adminForm.MaxSlots}
                        onChange={(event) => handleAdminChange('MaxSlots', event.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                      />
                    </Field>

                    <Field label="Booking Access">
                      <button
                        type="button"
                        onClick={() => handleAdminChange('BookingEnabled', !adminForm.BookingEnabled)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold ${
                          adminForm.BookingEnabled
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <span>{adminForm.BookingEnabled ? 'Open for OPD slots' : 'Closed'}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black">
                          {adminForm.BookingEnabled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </Field>
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard title="Notes & Multi-Day Apply" subtitle="Choose the weekdays once and apply the same schedule block until month end or your selected date.">
                <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
                  <Field label="Notes">
                    <textarea
                      rows={5}
                      value={adminForm.Notes}
                      onChange={(event) => handleAdminChange('Notes', event.target.value)}
                      placeholder="Coverage details, OT prep notes, round instructions..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                    />
                  </Field>

                  <div className="space-y-4">
                    <Field label="Apply to Multiple Days">
                      <button
                        type="button"
                        onClick={toggleAdminRepeat}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold ${
                          adminForm.RepeatEnabled
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <span>Repeat on chosen weekdays</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black">
                          {adminForm.RepeatEnabled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </Field>

                    {adminForm.RepeatEnabled ? (
                      <>
                        <Field label="Repeat Until">
                          <input
                            type="date"
                            value={adminForm.RepeatUntil}
                            onChange={(event) => handleAdminChange('RepeatUntil', event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                          />
                        </Field>

                        <Field label="Days">
                          <div className="flex flex-wrap gap-2">
                            {DAY_LABELS.map((label, index) => {
                              const active = adminForm.RepeatDays.includes(index);
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => toggleRepeatDay(index)}
                                  className={`rounded-full px-3.5 py-2 text-xs font-black ${
                                    active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-500'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      </>
                    ) : null}
                  </div>
                </div>
              </SectionCard>
            </>
          ) : (
            <>
              <SectionCard title="Assigned OPD Window" subtitle="Choose the doctor and assigned OPD block, then publish only the time slots you want patients to see.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Doctor">
                    <select
                      value={opdForm.DoctorId}
                      onChange={(event) => handleOpdChange('DoctorId', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.DoctorProfileId} value={doctor.DoctorProfileId}>
                          Dr. {doctor.DoctorName}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Date">
                    <input
                      type="date"
                      value={opdForm.SessionDate}
                      onChange={(event) => handleOpdChange('SessionDate', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </Field>

                  <Field label="Assigned OPD Block">
                    <select
                      value={opdForm.AssignmentId}
                      onChange={(event) => handleOpdChange('AssignmentId', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="">Select assigned OPD block</option>
                      {opdAssignments.map((assignment) => (
                        <option key={assignment.Id} value={assignment.Id}>
                          {assignment.Title || assignment.ActivityName} • {formatTime(assignment.StartTime)} - {formatTime(assignment.EndTime)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="OPD Room">
                    <select
                      value={opdForm.OpdRoomId}
                      onChange={(event) => handleOpdChange('OpdRoomId', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      <option value="">Keep assigned room</option>
                      {availableRooms.map((room) => (
                        <option key={room.Id} value={room.Id}>
                          {room.RoomNumber}
                          {room.RoomName ? ` • ${room.RoomName}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Start Time">
                    <input
                      type="time"
                      value={opdForm.StartTime}
                      onChange={(event) => handleOpdChange('StartTime', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </Field>

                  <Field label="End Time">
                    <input
                      type="time"
                      value={opdForm.EndTime}
                      onChange={(event) => handleOpdChange('EndTime', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </Field>

                  <Field label="Slot Duration">
                    <select
                      value={opdForm.SlotDurationMins}
                      onChange={(event) => handleOpdChange('SlotDurationMins', Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                    >
                      {[10, 15, 20, 30, 45, 60].map((duration) => (
                        <option key={duration} value={duration}>
                          {duration} minutes
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
                  <Field label="Notes">
                    <textarea
                      rows={4}
                      value={opdForm.Notes}
                      onChange={(event) => handleOpdChange('Notes', event.target.value)}
                      placeholder="Walk-in desk notes, room update, patient flow comments..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                    />
                  </Field>

                  <div className="space-y-4">
                    <Field label="Repeat Publishing">
                      <button
                        type="button"
                        onClick={toggleOpdRepeat}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold ${
                          opdForm.RepeatEnabled
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <span>Repeat on future same day</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black">
                          {opdForm.RepeatEnabled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </Field>
                    {opdForm.RepeatEnabled ? (
                      <Field label="Repeat Until">
                        <input
                          type="date"
                          value={opdForm.RepeatUntil}
                          onChange={(event) => handleOpdChange('RepeatUntil', event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                        />
                      </Field>
                    ) : null}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Time Slot Selection" subtitle="Select the exact patient slots to publish inside the assigned OPD period.">
                {selectedAssignment ? (
                  <SlotTimeGrid
                    slots={previewSlots}
                    selectedTimes={opdForm.SelectedTimes}
                    onToggle={toggleSelectedTime}
                  />
                ) : (
                  <p className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-medium text-slate-400">
                    Select the assigned OPD block first.
                  </p>
                )}
              </SectionCard>
            </>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[22px] bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : isOpdManager ? 'Publish Slots' : isEdit ? 'Update Schedule' : 'Save Schedule'}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <SectionCard title={isOpdManager ? 'Scheduled Slots' : 'Day Overview'} subtitle={selectedDoctor ? formatLongDate(isOpdManager ? opdForm.SessionDate : adminForm.AssignmentDate) : 'Select a doctor and date to inspect current assignments.'}>
            {!selectedDoctor ? (
              <p className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-14 text-center text-sm font-medium text-slate-400">
                Choose a doctor to inspect scheduled assignments.
              </p>
            ) : (
              <div className="space-y-4">
                {dateAssignments.length ? (
                  dateAssignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.Id}
                      assignment={assignment}
                      active={String(assignment.Id) === String(opdForm.AssignmentId)}
                      onClick={() => {
                        if (isOpdManager) handleOpdChange('AssignmentId', String(assignment.Id));
                      }}
                    />
                  ))
                ) : (
                  <p className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-medium text-slate-400">
                    No assignment exists on this date yet.
                  </p>
                )}

                {isOpdManager && dateSessions.length ? (
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    {dateSessions.map((session) => (
                      <div key={session.Id} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-black text-slate-900">
                          {formatTime(session.StartTime)} - {formatTime(session.EndTime)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {session.PublishedSlotsCount || session.TotalSlots || 0} published slots
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>

          {!isOpdManager ? (
            <SectionCard title="Conflict Check" subtitle="Overlapping assignments are checked before save.">
              {clientConflicts.length ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-rose-700">
                    <ShieldAlert size={16} />
                    {clientConflicts.length} overlap{clientConflicts.length === 1 ? '' : 's'} found
                  </div>
                  {clientConflicts.map((assignment) => (
                    <AssignmentCard key={assignment.Id} assignment={assignment} />
                  ))}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  <CheckCircle2 size={16} />
                  No overlap detected
                </div>
              )}
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
