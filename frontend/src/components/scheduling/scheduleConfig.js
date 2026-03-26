export const VIEW_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

export const SCHEDULE_CATEGORY_TABS = [
  { value: 'opd', label: 'OPD Session', badge: '9-1PM' },
  { value: 'ward', label: 'Ward Visit', badge: '1-2 PM' },
  { value: 'ot', label: 'OT', badge: 'SCHEDULED' },
  { value: 'other', label: 'Other', badge: '4-6 PM' },
];

export const CATEGORY_ACTIVITY_CODES = {
  opd: ['OPD_SESSION', 'CLINICAL_VISIT', 'TELECONSULT'],
  ward: ['WARD_VISIT', 'WARD_ROUND'],
  ot: ['SURGERY', 'PROCEDURE'],
  other: ['DOCTOR_DISCUSSION', 'MEETING', 'TEACHING', 'ADMIN_BLOCK', 'LEAVE'],
};

export const CATEGORY_DEFAULT_ACTIVITY_CODE = {
  opd: 'OPD_SESSION',
  ward: 'WARD_VISIT',
  ot: 'SURGERY',
  other: 'MEETING',
};

export const REPEAT_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

export const TOKEN_VISUALS = {
  teal:   { pill: 'bg-teal-50 text-teal-700 border-teal-200', card: 'border-teal-200 bg-teal-50/80', dot: 'bg-teal-500' },
  blue:   { pill: 'bg-blue-50 text-blue-700 border-blue-200', card: 'border-blue-200 bg-blue-50/80', dot: 'bg-blue-500' },
  amber:  { pill: 'bg-amber-50 text-amber-700 border-amber-200', card: 'border-amber-200 bg-amber-50/80', dot: 'bg-amber-500' },
  orange: { pill: 'bg-orange-50 text-orange-700 border-orange-200', card: 'border-orange-200 bg-orange-50/80', dot: 'bg-orange-500' },
  indigo: { pill: 'bg-indigo-50 text-indigo-700 border-indigo-200', card: 'border-indigo-200 bg-indigo-50/80', dot: 'bg-indigo-600' },
  sky:    { pill: 'bg-sky-50 text-sky-700 border-sky-200', card: 'border-sky-200 bg-sky-50/80', dot: 'bg-sky-500' },
  violet: { pill: 'bg-violet-50 text-violet-700 border-violet-200', card: 'border-violet-200 bg-violet-50/80', dot: 'bg-violet-500' },
  purple: { pill: 'bg-purple-50 text-purple-700 border-purple-200', card: 'border-purple-200 bg-purple-50/80', dot: 'bg-purple-500' },
  slate:  { pill: 'bg-slate-100 text-slate-700 border-slate-200', card: 'border-slate-200 bg-slate-100/80', dot: 'bg-slate-500' },
  rose:   { pill: 'bg-rose-50 text-rose-700 border-rose-200', card: 'border-rose-200 bg-rose-50/80', dot: 'bg-rose-500' },
};

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const toDateKey = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
};

export const toTimeValue = (value) => {
  if (!value) return '';
  const match = String(value).match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : String(value).slice(0, 5);
};

export const formatTime = (value) => {
  const time = toTimeValue(value);
  if (!time) return '--';
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = (hours % 12) || 12;
  return `${String(twelveHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

export const formatLongDate = (value) => {
  const date = new Date(`${toDateKey(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const formatMonthLabel = (value) => {
  const date = new Date(`${toDateKey(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export const getTokenVisual = (token) => TOKEN_VISUALS[token] || TOKEN_VISUALS.slate;

export const buildMonthGrid = (cursorDate) => {
  const cursor = new Date(`${toDateKey(cursorDate)}T00:00:00`);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    cells.push({
      dateKey: toDateKey(current),
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === cursor.getMonth(),
    });
  }
  return cells;
};

export const buildYearMonths = (cursorDate) => {
  const cursor = new Date(`${toDateKey(cursorDate)}T00:00:00`);
  return Array.from({ length: 12 }, (_, index) => new Date(cursor.getFullYear(), index, 1));
};

export const groupAssignmentsByDate = (assignments = []) => {
  return assignments.reduce((map, assignment) => {
    const key = toDateKey(assignment.AssignmentDate);
    if (!map[key]) map[key] = [];
    map[key].push(assignment);
    return map;
  }, {});
};

export const toWeekday = (dateKey) => {
  const date = new Date(`${toDateKey(dateKey)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getDay();
};

export const countGeneratedSlots = (assignment) =>
  Number(assignment.GeneratedSlotCount || 0) + Number(assignment.PublishedSlotsCount || 0);

const CATEGORY_BY_ACTIVITY_CODE = Object.entries(CATEGORY_ACTIVITY_CODES).reduce(
  (map, [category, codes]) => {
    codes.forEach((code) => {
      map[code] = category;
    });
    return map;
  },
  {}
);

export const getActivityCategory = (item) => {
  const category = String(item?.ActivityCategory || '').toLowerCase();
  if (['opd', 'ward', 'ot', 'other'].includes(category)) return category;

  const activityCode = String(item?.ActivityCode || item?.Code || '').toUpperCase();
  return CATEGORY_BY_ACTIVITY_CODE[activityCode] || 'other';
};

export const getCategoryActivityTypes = (activityTypes = [], category = 'opd') =>
  activityTypes.filter((activityType) => getActivityCategory(activityType) === category);
