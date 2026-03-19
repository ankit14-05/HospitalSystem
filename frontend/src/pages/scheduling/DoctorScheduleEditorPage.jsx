import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getPayload } from '../../utils/apiPayload';

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VISIT_TYPES = [
  { value: 'opd', label: 'OPD' },
  { value: 'teleconsult', label: 'Teleconsult' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'both', label: 'OPD + Tele' },
];

const emptyForm = {
  DoctorId: '',
  OpdRoomId: '',
  DayOfWeek: '',
  StartTime: '09:00',
  EndTime: '13:00',
  SlotDurationMins: 15,
  MaxSlots: '',
  VisitType: 'opd',
  EffectiveFrom: new Date().toISOString().slice(0, 10),
  EffectiveTo: '',
  Notes: '',
};

const parseList = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const toMinutes = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return (hours * 60) + minutes;
};

export default function DoctorScheduleEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const isEdit = Boolean(id);
  const prefilledDay = searchParams.get('day');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({
    ...emptyForm,
    DayOfWeek: prefilledDay ?? '',
  });

  const computedSlots = useMemo(() => {
    const diff = toMinutes(form.EndTime) - toMinutes(form.StartTime);
    if (diff <= 0) return 0;
    return Math.floor(diff / Number(form.SlotDurationMins || 15));
  }, [form.EndTime, form.SlotDurationMins, form.StartTime]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [doctorRes, roomRes, scheduleRes] = await Promise.all([
        api.get('/scheduling/doctors-list'),
        api.get('/scheduling/rooms'),
        isEdit ? api.get(`/scheduling/doctor-schedules/${id}`) : Promise.resolve(null),
      ]);

      const doctorPayload = getPayload(doctorRes) || {};
      const roomPayload = getPayload(roomRes) || {};

      setDoctors(parseList(doctorPayload, 'doctors'));
      setRooms(parseList(roomPayload, 'rooms'));

      if (scheduleRes) {
        const schedule = getPayload(scheduleRes) || {};
        setForm({
          DoctorId: String(schedule.DoctorId || ''),
          OpdRoomId: schedule.OpdRoomId ? String(schedule.OpdRoomId) : '',
          DayOfWeek: schedule.DayOfWeek !== undefined ? String(schedule.DayOfWeek) : '',
          StartTime: String(schedule.StartTime || '').slice(0, 5),
          EndTime: String(schedule.EndTime || '').slice(0, 5),
          SlotDurationMins: Number(schedule.SlotDurationMins || 15),
          MaxSlots: schedule.MaxSlots || '',
          VisitType: schedule.VisitType || 'opd',
          EffectiveFrom: String(schedule.EffectiveFrom || '').slice(0, 10) || emptyForm.EffectiveFrom,
          EffectiveTo: String(schedule.EffectiveTo || '').slice(0, 10),
          Notes: schedule.Notes || '',
        });
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to load schedule editor');
      navigate('/admin/schedule-manager', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.DoctorId || form.DayOfWeek === '' || !form.StartTime || !form.EndTime) {
      toast.error('Doctor, day, start time, and end time are required');
      return;
    }

    if (toMinutes(form.EndTime) <= toMinutes(form.StartTime)) {
      toast.error('End time must be after start time');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        DoctorId: Number(form.DoctorId),
        OpdRoomId: form.OpdRoomId ? Number(form.OpdRoomId) : null,
        DayOfWeek: Number(form.DayOfWeek),
        StartTime: form.StartTime,
        EndTime: form.EndTime,
        SlotDurationMins: Number(form.SlotDurationMins || 15),
        MaxSlots: form.MaxSlots ? Number(form.MaxSlots) : null,
        VisitType: form.VisitType,
        EffectiveFrom: form.EffectiveFrom || emptyForm.EffectiveFrom,
        EffectiveTo: form.EffectiveTo || null,
        Notes: form.Notes.trim() || null,
      };

      if (isEdit) {
        await api.put(`/scheduling/doctor-schedules/${id}`, payload);
        toast.success('Doctor schedule updated');
      } else {
        await api.post('/scheduling/doctor-schedules', payload);
        toast.success('Doctor schedule created');
      }

      navigate('/admin/schedule-manager');
    } catch (error) {
      toast.error(error?.message || 'Could not save doctor schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/admin/schedule-manager')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft size={14} />
          Back to schedule board
        </button>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
          {isEdit ? 'Edit doctor schedule' : 'Create doctor schedule'}
        </h1>
      </div>

      {loading ? (
        <div className="rounded-[32px] border border-slate-100 bg-white p-12 text-center shadow-[0_30px_80px_-44px_rgba(15,23,42,0.35)]">
          <Loader2 size={20} className="mx-auto animate-spin text-teal-600" />
          <p className="mt-4 text-sm font-semibold text-slate-600">Loading schedule editor...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.35)]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Doctor</label>
                <select
                  value={form.DoctorId}
                  onChange={(event) => updateField('DoctorId', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => {
                    const doctorId = doctor.DoctorProfileId || doctor.DoctorId;
                    return (
                      <option key={doctorId} value={doctorId}>
                        Dr. {doctor.DoctorName}{doctor.Specialization ? ` - ${doctor.Specialization}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Day</label>
                <select
                  value={form.DayOfWeek}
                  onChange={(event) => updateField('DayOfWeek', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Select day</option>
                  {DAYS_FULL.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Visit Type</label>
                <select
                  value={form.VisitType}
                  onChange={(event) => updateField('VisitType', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                >
                  {VISIT_TYPES.map((visitType) => (
                    <option key={visitType.value} value={visitType.value}>{visitType.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Start Time</label>
                <input
                  type="time"
                  value={form.StartTime}
                  onChange={(event) => updateField('StartTime', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">End Time</label>
                <input
                  type="time"
                  value={form.EndTime}
                  onChange={(event) => updateField('EndTime', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Slot Duration (mins)</label>
                <select
                  value={form.SlotDurationMins}
                  onChange={(event) => updateField('SlotDurationMins', Number(event.target.value))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                >
                  {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} min</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Max Slots Override</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={form.MaxSlots}
                  onChange={(event) => updateField('MaxSlots', event.target.value)}
                  placeholder={`Auto: ${computedSlots}`}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">OPD Room</label>
                <select
                  value={form.OpdRoomId}
                  onChange={(event) => updateField('OpdRoomId', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">No room selected</option>
                  {rooms.map((room) => (
                    <option key={room.Id} value={room.Id}>
                      Room {room.RoomNumber}{room.RoomName ? ` - ${room.RoomName}` : ''}{room.DepartmentName ? ` - ${room.DepartmentName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Effective From</label>
                <input
                  type="date"
                  value={form.EffectiveFrom}
                  onChange={(event) => updateField('EffectiveFrom', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Effective Until</label>
                <input
                  type="date"
                  min={form.EffectiveFrom || emptyForm.EffectiveFrom}
                  value={form.EffectiveTo}
                  onChange={(event) => updateField('EffectiveTo', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Notes</label>
                <textarea
                  rows={4}
                  value={form.Notes}
                  onChange={(event) => updateField('Notes', event.target.value)}
                  placeholder="Notes"
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/schedule-manager')}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isEdit ? 'Update schedule' : 'Save schedule'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
