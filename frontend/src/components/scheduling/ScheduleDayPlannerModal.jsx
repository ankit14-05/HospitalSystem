import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, MapPin, Save, Trash2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
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
} from './scheduleConfig';

const CATEGORY_LOCATION_KIND = {
  opd: 'opd_room',
  ward: 'ward',
  ot: 'ot',
  other: 'general',
};

const VISIT_TYPES = [
  { value: 'opd', label: 'OPD Session' },
  { value: 'ward', label: 'Ward Visit' },
  { value: 'ot', label: 'Operation Theatre' },
  { value: 'other', label: 'Other Duty' },
];

const buildBlankForm = (selectedDate, activityTypes, defaultDoctorId = '', category = 'opd') => {
  const scopedTypes = getCategoryActivityTypes(activityTypes, category);
  const defaultType =
    scopedTypes.find((item) => item.Code === CATEGORY_DEFAULT_ACTIVITY_CODE[category]) ||
    scopedTypes[0] ||
    null;

  return {
    DoctorId: defaultDoctorId ? String(defaultDoctorId) : '',
    Category: category,
    ActivityTypeId: defaultType ? String(defaultType.Id) : '',
    Title: defaultType?.Name || '',
    AssignmentDate: toDateKey(selectedDate),
    StartTime: '09:00',
    EndTime: '13:00',
    LocationKind: CATEGORY_LOCATION_KIND[category] || 'general',
    OpdRoomId: '',
    LocationLabel: '',
    BookingEnabled: category === 'opd',
    NoteText: '',
    BreakStart: '',
    BreakEnd: '',
    RepeatEnabled: false,
    RepeatFrequency: 'weekly',
    RepeatUntil: '',
    RepeatDays: [toWeekday(selectedDate)],
    SlotDurationMins: 15,
  };
};

const parseNotes = (notes) => {
  if (!notes) return { NoteText: '', BreakStart: '', BreakEnd: '' };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object') {
      return {
        NoteText: parsed.noteText || '',
        BreakStart: parsed.breakStart || '',
        BreakEnd: parsed.breakEnd || '',
      };
    }
  } catch (_error) {
    // fallback
  }
  return { NoteText: String(notes), BreakStart: '', BreakEnd: '' };
};

const serializeNotes = (form) => {
  const payload = {
    noteText: form.NoteText?.trim() || '',
    breakStart: form.BreakStart || '',
    breakEnd: form.BreakEnd || '',
  };
  if (!payload.noteText && !payload.breakStart && !payload.breakEnd) return null;
  return JSON.stringify(payload);
};

const sortAssignments = (assignments) =>
  [...assignments].sort((left, right) => {
    const leftStart = String(left.StartTime || '');
    const rightStart = String(right.StartTime || '');
    if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
    return String(left.EndTime || '').localeCompare(String(right.EndTime || ''));
  });

const generateSlots = (start, end, durationMins) => {
  if (!start || !end || !durationMins) return [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let current = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const slots = [];
  while (current + durationMins <= endMins) {
    const sTime = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
    const e = current + durationMins;
    const eTime = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
    slots.push(`${sTime} - ${eTime}`);
    current = e;
  }
  return slots;
};

export default function ScheduleDayPlannerModal({
  open,
  onClose,
  selectedDate,
  dayAssignments = [],
  doctors = [],
  rooms = [],
  activityTypes = [],
  defaultDoctorId = '',
  isOpdManager = false,
  onSaved,
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [form, setForm] = useState(() => buildBlankForm(selectedDate, activityTypes, defaultDoctorId));

  const sortedAssignments = useMemo(() => sortAssignments(dayAssignments), [dayAssignments]);
  const visibleAssignments = useMemo(() => (
    sortedAssignments.filter((assignment) => {
      if (form.DoctorId && String(assignment.DoctorId) !== String(form.DoctorId)) return false;
      if (!isOpdManager) return true;
      return Boolean(assignment.AllowsOpdSlots) && Boolean(assignment.BookingEnabled);
    })
  ), [form.DoctorId, isOpdManager, sortedAssignments]);
  const activeAssignment = useMemo(
    () => visibleAssignments.find((a) => String(a.Id) === String(editingAssignmentId)) || null,
    [editingAssignmentId, visibleAssignments]
  );

  useEffect(() => {
    if (!open) return;
    if (activeAssignment) {
        const noteState = parseNotes(activeAssignment.Notes);
        setForm({
          DoctorId: String(activeAssignment.DoctorId || ''),
          Category: isOpdManager ? 'opd' : getActivityCategory(activeAssignment),
          ActivityTypeId: String(activeAssignment.ActivityTypeId || ''),
          Title: isOpdManager ? 'OPD Session' : activeAssignment.Title || activeAssignment.ActivityName || '',
          AssignmentDate: toDateKey(activeAssignment.AssignmentDate || selectedDate),
          StartTime: toTimeValue(activeAssignment.StartTime) || '09:00',
          EndTime: toTimeValue(activeAssignment.EndTime) || '10:30',
          LocationKind: isOpdManager ? 'opd_room' : activeAssignment.LocationKind || 'general',
          OpdRoomId: activeAssignment.OpdRoomId ? String(activeAssignment.OpdRoomId) : '',
          LocationLabel: activeAssignment.LocationLabel || '',
          BookingEnabled: isOpdManager ? true : Boolean(activeAssignment.BookingEnabled),
          NoteText: noteState.NoteText,
          BreakStart: noteState.BreakStart,
          BreakEnd: noteState.BreakEnd,
          RepeatEnabled: false,
          RepeatFrequency: 'weekly',
          RepeatUntil: '',
          RepeatDays: [toWeekday(activeAssignment.AssignmentDate || selectedDate)],
          SlotDurationMins: activeAssignment.SlotDurationMins || 15,
        });
        return;
    }
    setForm(buildBlankForm(selectedDate, activityTypes, defaultDoctorId, 'opd'));
  }, [activeAssignment, activityTypes, defaultDoctorId, isOpdManager, open, selectedDate]);

  useEffect(() => {
    if (!open) {
      setEditingAssignmentId(null);
    }
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open || !isOpdManager) return;
    if (activeAssignment) return;
    if (!visibleAssignments.length) return;
    setEditingAssignmentId(visibleAssignments[0].Id);
  }, [activeAssignment, isOpdManager, open, visibleAssignments]);

  if (!open) return null;

  const handleField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCategoryChange = (categoryValue) => {
    if (isOpdManager) return;
    let intCategory = 'other';
    if (categoryValue === 'opd') intCategory = 'opd';
    else if (categoryValue === 'ot') intCategory = 'ot';
    else if (categoryValue === 'ward') intCategory = 'ward';

    const nextBlank = buildBlankForm(selectedDate, activityTypes, form.DoctorId, intCategory);
    const label = VISIT_TYPES.find(v => v.value === categoryValue)?.label || 'OPD Session';
    
    setEditingAssignmentId(null);
    setForm((current) => ({
      ...nextBlank,
      DoctorId: current.DoctorId,
      Title: label,
      Category: categoryValue,
      RepeatEnabled: current.RepeatEnabled,
      RepeatFrequency: current.RepeatFrequency,
      RepeatUntil: current.RepeatUntil,
      RepeatDays: current.RepeatDays.length ? current.RepeatDays : [toWeekday(selectedDate)],
    }));
  };

  const toggleRepeatDay = (dayIndex) => {
    setForm((current) => {
      const exists = current.RepeatDays.includes(dayIndex);
      const nextDays = exists
        ? current.RepeatDays.filter((day) => day !== dayIndex)
        : [...current.RepeatDays, dayIndex].sort((left, right) => left - right);
        
      const isMultiDay = nextDays.length > 1;
      return {
        ...current,
        RepeatDays: nextDays.length ? nextDays : [dayIndex],
        RepeatEnabled: isMultiDay || current.RepeatUntil !== '',
      };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.DoctorId) {
      toast.error('Choose a doctor first');
      return;
    }
    
    setSaving(true);
    try {
      if (isOpdManager) {
        if (!activeAssignment) {
          toast.error('Select an assigned OPD window first');
          return;
        }

        await api.post('/scheduling/opd-slot-sessions', {
          DoctorId: Number(form.DoctorId),
          AssignmentId: Number(activeAssignment.Id),
          SessionDate: toDateKey(selectedDate),
          StartTime: form.StartTime,
          EndTime: form.EndTime,
          SlotDurationMins: Number(form.SlotDurationMins) || 15,
          OpdRoomId: form.OpdRoomId ? Number(form.OpdRoomId) : null,
          RoomLabel: activeAssignment.RoomNumber || activeAssignment.LocationLabel || null,
          Notes: serializeNotes(form),
          RepeatEnabled: Boolean(form.RepeatEnabled),
          RepeatFrequency: form.RepeatFrequency,
          RepeatUntil: form.RepeatEnabled ? form.RepeatUntil || null : null,
        });

        toast.success('OPD slots published');
        onSaved?.();
        return;
      }

      let payloadCategory = 'other';
      if (['opd','ot','ward'].includes(form.Category)) {
         payloadCategory = form.Category;
      }
      
      const payload = {
        DoctorId: Number(form.DoctorId),
        ActivityTypeId: form.ActivityTypeId ? Number(form.ActivityTypeId) : null,
        Title: form.Title?.trim() || null,
        AssignmentDate: toDateKey(selectedDate),
        StartTime: form.StartTime,
        EndTime: form.EndTime,
        LocationKind: payloadCategory === 'opd' ? 'opd_room' : CATEGORY_LOCATION_KIND[payloadCategory] || 'general',
        OpdRoomId: payloadCategory === 'opd' && form.OpdRoomId ? Number(form.OpdRoomId) : null,
        LocationLabel: payloadCategory === 'opd' ? null : form.LocationLabel?.trim() || null,
        SlotDurationMins: payloadCategory === 'opd' ? Number(form.SlotDurationMins) : null,
        MaxSlots: payloadCategory === 'opd' ? generateSlots(form.StartTime, form.EndTime, form.SlotDurationMins).length || null : null,
        BookingEnabled: payloadCategory === 'opd',
        Notes: serializeNotes(form),
        RepeatEnabled: Boolean(form.RepeatEnabled),
        RepeatFrequency: form.RepeatFrequency,
        RepeatUntil: form.RepeatEnabled ? form.RepeatUntil || null : null,
        RepeatDays:
          form.RepeatEnabled && form.RepeatFrequency === 'weekly'
            ? form.RepeatDays
            : [toWeekday(selectedDate)],
      };

      if (editingAssignmentId) {
        await api.put(`/scheduling/doctor-schedules/${editingAssignmentId}`, payload);
        toast.success('Schedule updated');
      } else {
        await api.post('/scheduling/doctor-schedules', payload);
        toast.success('Schedule saved');
      }

      onSaved?.();
    } catch (error) {
      toast.error(error?.message || 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async () => {
    if (isOpdManager) return;
    if (!editingAssignmentId) return;
    setDeleting(true);
    try {
      await api.delete(`/scheduling/doctor-schedules/${editingAssignmentId}`);
      toast.success('Schedule removed');
      onSaved?.();
    } catch (error) {
      toast.error(error?.message || 'Could not delete schedule');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#00000066] p-4 backdrop-blur-[2px] font-sans">
      <div className="flex h-[85vh] w-full max-w-[1024px] overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-2xl">
        
        {/* ── LEFT PANEL (Form) ── */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="px-8 pt-8 pb-4">
            <h2 className="text-[22px] font-extrabold text-[#0B1A2A]">
              {isOpdManager ? 'Publish OPD Slots' : 'Add Schedule'}
            </h2>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">
              {isOpdManager ? 'Publish bookable slots inside the assigned OPD window.' : 'Configure duty timings and days.'}
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-1 flex-col px-8 pb-8 space-y-5">
            
            {/* Doctor Select */}
            <div className="w-full">
               <label className="text-[10px] font-bold tracking-wider text-[#4A5568] uppercase mb-1.5 block">Doctor (Required)</label>
               <select
                  value={form.DoctorId}
                  onChange={(e) => handleField('DoctorId', e.target.value)}
                  className="w-full rounded-[6px] border border-slate-200 bg-[#F7FAFC] px-4 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-[#2B6CB0]"
                >
                  <option value="">Select doctor...</option>
                  {doctors.map(d => <option key={d.DoctorProfileId} value={d.DoctorProfileId}>Dr. {d.DoctorName}</option>)}
                </select>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#4A5568] uppercase mb-1.5 block">Start Time</label>
                <input
                  type="time" value={form.StartTime} onChange={(e) => handleField('StartTime', e.target.value)}
                  className="w-full rounded-[6px] border border-slate-200 bg-[#F7FAFC] px-4 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-[#2B6CB0]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#4A5568] uppercase mb-1.5 block">End Time</label>
                <input
                  type="time" value={form.EndTime} onChange={(e) => handleField('EndTime', e.target.value)}
                  className="w-full rounded-[6px] border border-slate-200 bg-[#F7FAFC] px-4 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-[#2B6CB0]"
                />
              </div>
            </div>

            {/* Room */}
            <div className="w-full">
               <label className="text-[10px] font-bold tracking-wider text-[#4A5568] uppercase mb-1.5 block">Room / Location (Optional)</label>
               <input
                 value={form.LocationLabel || form.OpdRoomId} 
                 onChange={(e) => {
                    handleField('LocationLabel', e.target.value);
                    handleField('OpdRoomId', e.target.value); 
                 }}
                 placeholder="e.g. 402-B or General Ward"
                 className="w-full rounded-[6px] border border-slate-200 bg-[#F7FAFC] px-4 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-[#2B6CB0]"
               />
            </div>

            {/* Slot Configuration (OPD Only) */}
            {form.Category === 'opd' && (
              <div className="bg-[#F7FAFC] p-4 rounded-[6px] border border-slate-100">
                 <label className="text-[10px] font-bold tracking-wider text-[#4A5568] uppercase mb-2.5 block">Slot Generation (OPD Only)</label>
                 <div className="flex gap-2 flex-wrap mb-3">
                    {[5, 10, 15, 20, 30].map(mins => (
                       <button
                         key={mins} type="button"
                         onClick={() => handleField('SlotDurationMins', mins)}
                         className={`px-3 py-1.5 rounded-[4px] text-[11px] font-bold transition border ${form.SlotDurationMins === mins ? 'bg-[#2B6CB0] text-white border-[#2B6CB0]' : 'bg-white text-slate-600 hover:border-slate-300 border-slate-200'}`}
                       >
                         {mins} mins
                       </button>
                    ))}
                 </div>
                 <div className="w-full bg-white rounded border border-slate-200 p-2 max-h-[140px] overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5">
                   {(() => {
                      const calculatedSlots = generateSlots(form.StartTime, form.EndTime, form.SlotDurationMins);
                      if (!calculatedSlots.length) return <span className="text-slate-400 text-xs py-1 px-2">No valid slots in duration.</span>;
                      return calculatedSlots.map((slot, i) => (
                        <span key={i} className="bg-slate-50 border border-slate-200 text-[#4A5568] text-[10px] font-extrabold px-2 py-1 rounded-[4px] whitespace-nowrap">
                          {slot}
                        </span>
                      ));
                   })()}
                 </div>
              </div>
            )}

            {/* Additional Notes */}
            <div>
              <label className="text-[10px] font-bold tracking-wider text-[#4A5568] uppercase mb-1.5 block">Additional Notes</label>
              <textarea
                rows={3} value={form.NoteText} onChange={(e) => handleField('NoteText', e.target.value)}
                placeholder="Coverage requirements or duty notes..."
                className="w-full rounded-[6px] border border-slate-200 bg-[#F7FAFC] px-4 py-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-[#2B6CB0] resize-none"
              />
            </div>

            {/* Prominent Day Selection */}
            <div className="pt-2">
               <div className="flex justify-between items-center mb-2">
                 <label className="text-[10px] font-bold tracking-wider text-[#4A5568] uppercase">Select Days</label>
                 <span className="text-[9px] font-semibold text-[#A0AEC0]">Multi-day selectable option</span>
               </div>
               <div className="flex gap-3">
                 {DAY_LABELS.map((label, idx) => {
                   const active = form.RepeatDays.includes(idx);
                   return (
                     <button
                       key={label}
                       type="button"
                       onClick={() => toggleRepeatDay(idx)}
                       className={`flex-1 h-10 rounded-[6px] text-[12px] font-extrabold transition border ${
                         active ? 'bg-[#182C57] text-white border-[#182C57]' : 'bg-white text-[#4A5568] hover:bg-slate-50 hover:border-slate-300 border-slate-200'
                       }`}
                     >
                       {label.substring(0,3)}
                     </button>
                   );
                 })}
               </div>
               
               {/* Expiry Date for repeated selection */}
               {form.RepeatDays.length >= 1 && (
                  <div className="mt-4 flex items-center gap-4 bg-[#F7FAFC] p-4 rounded-[6px] border border-slate-100">
                     <label className="flex items-center gap-2 cursor-pointer">
                       <input
                         type="checkbox"
                         checked={form.RepeatEnabled}
                         onChange={(e) => handleField('RepeatEnabled', e.target.checked)}
                         className="h-4 w-4 rounded border-slate-300 text-[#2B6CB0]"
                       />
                       <span className="text-[12px] font-extrabold text-[#0B1A2A]">Repeat Schedule</span>
                     </label>
                     {form.RepeatEnabled && (
                       <div className="flex-1 flex items-center gap-3">
                         <span className="text-[11px] font-bold text-slate-500 ml-auto">Until</span>
                         <input
                           type="date"
                           value={form.RepeatUntil}
                           onChange={(e) => handleField('RepeatUntil', e.target.value)}
                           className="rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-800 outline-none focus:border-[#2B6CB0]"
                         />
                       </div>
                     )}
                  </div>
               )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mt-auto pt-6 gap-6">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-[6px] border border-slate-300 py-3.5 text-[14px] font-extrabold text-[#4A5568] hover:bg-slate-50 transition"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={saving || deleting || (isOpdManager && !activeAssignment)}
                className="w-full rounded-[6px] bg-[#182C57] py-3.5 text-[14px] font-extrabold text-white hover:bg-[#0B1A2A] transition shadow flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? (isOpdManager ? 'Publishing...' : 'Saving...') : (isOpdManager ? 'Publish Slots' : 'Save')}
              </button>
            </div>
            {editingAssignmentId && !isOpdManager && (
              <div className="text-center mt-2">
                <button
                   type="button"
                   onClick={deleteAssignment}
                   className="text-red-500 text-xs font-bold underline hover:text-red-700"
                >Delete Existing Schedule</button>
              </div>
            )}
          </form>
        </div>

        {/* ── RIGHT PANEL (Overview) ── */}
        <div className="w-[340px] bg-[#F7FAFC] border-l border-slate-200 flex flex-col pt-6 pb-6 shadow-[inset_1px_0_0_rgba(226,232,240,1)] relative">
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 transition">
             <X size={20} />
          </button>
          
          {/* Visit Type Options Moved Here */}
          <div className="px-6 pb-6 border-b border-slate-200 mb-4 mt-2">
             <h3 className="text-[12px] font-extrabold tracking-widest text-[#1A202C] uppercase mb-3">
               {isOpdManager ? 'Publishing Mode' : 'Visit Type'}
             </h3>
             <div className="flex flex-col gap-2">
               {(isOpdManager ? VISIT_TYPES.filter((vt) => vt.value === 'opd') : VISIT_TYPES).map((vt) => {
                 const isActive = form.Category === vt.value;
                 return (
                   <button
                     key={vt.value}
                     type="button"
                     onClick={() => handleCategoryChange(vt.value)}
                     className={`text-left px-4 py-3 rounded-[8px] text-[13px] font-bold transition flex items-center justify-between border ${
                       isActive 
                         ? 'bg-[#EBF8FF] text-[#182C57] border-[#63B3ED] shadow-sm'
                         : 'bg-white text-slate-600 border-[#E2E8F0] hover:border-slate-300'
                     }`}
                   >
                     {vt.label}
                     {isActive && <Check size={16} className="text-[#2B6CB0]" />}
                   </button>
                 );
               })}
             </div>
          </div>

          <div className="px-6 pb-2">
             <h3 className="text-[12px] font-extrabold tracking-widest text-[#1A202C] uppercase mb-0.5">Scheduled Slots</h3>
             <p className="text-[11px] font-semibold text-[#718096]">Daily overview for {formatLongDate(selectedDate)}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pt-2">
            <h4 className="text-[10px] font-bold tracking-wider text-[#A0AEC0] uppercase mb-3">Active Assignments</h4>
            
            <div className="space-y-3">
              {visibleAssignments.length ? visibleAssignments.map((assignment, idx) => {
                 const isActive = String(assignment.Id) === String(editingAssignmentId);
                 const isOpd = (assignment.Title || assignment.ActivityName || '').toUpperCase().includes('OPD');
                 
                 return (
                   <div 
                     key={assignment.Id || idx}
                     onClick={() => setEditingAssignmentId(assignment.Id)}
                     className={`rounded-[8px] p-4 cursor-pointer transition border
                       ${isActive 
                         ? 'bg-white border-[#182C57] ring-1 ring-[#182C57] shadow-sm' 
                         : 'bg-white border-[#E2E8F0] hover:border-slate-300'}`}
                   >
                     <p className={`text-[12px] font-extrabold ${isActive || isOpd ? 'text-[#182C57]' : 'text-slate-800'}`}>
                       {assignment.Title || assignment.ActivityName}
                     </p>
                     <p className="mt-1.5 text-[10px] font-bold text-[#2B6CB0]">
                       {formatTime(assignment.StartTime)} to {formatTime(assignment.EndTime)}
                     </p>
                   </div>
                 );
              }) : (
                 <p className="text-[12px] font-semibold text-slate-400">
                   {isOpdManager ? 'No publishable OPD assignments for this date.' : 'No active assignments for this date.'}
                 </p>
              )}
            </div>
          </div>

          <div className="px-6 mt-6 pt-4 border-t border-slate-200">
             <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 bg-[#2B6CB0] rounded-full"></div>
                <p className="text-[10px] font-extrabold tracking-wider text-[#1A202C] uppercase">Conflict Check Active</p>
             </div>
             <p className="text-[9px] font-semibold text-[#718096]">Verifying hospital facility and staff availability records.</p>
          </div>

        </div>

      </div>
    </div>
  );
}
