import React from 'react';
import { CalendarDays } from 'lucide-react';
import {
  DAY_LABELS,
  buildMonthGrid,
  formatLongDate,
  formatTime,
  getTokenVisual,
  groupAssignmentsByDate,
  toDateKey,
} from './scheduleConfig';

const startOfWeek = (dateKey) => {
  const current = new Date(`${toDateKey(dateKey)}T00:00:00`);
  const start = new Date(current);
  start.setDate(current.getDate() - current.getDay());
  return start;
};

const buildWeekGrid = (dateKey) => {
  const start = startOfWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return {
      dateKey: toDateKey(current),
      dayNumber: current.getDate(),
      isCurrentMonth: true,
    };
  });
};

function AssignmentPill({ assignment, compact = false }) {
  const visual = getTokenVisual(assignment.ColorToken);
  const pillClass = compact ? 'px-2.5 py-2 text-[10px]' : 'px-3 py-2.5 text-[11px]';

  return (
    <div className={`rounded-2xl border-l-[4px] border px-0 ${visual.card}`}>
      <div className={`pl-3 pr-2 ${pillClass}`}>
        <p className="font-black text-slate-800 line-clamp-1">
          {assignment.Title || assignment.ActivityName}
        </p>
        <p className="mt-1 font-semibold text-slate-500">
          {formatTime(assignment.StartTime)} - {formatTime(assignment.EndTime)}
        </p>
      </div>
    </div>
  );
}

function EmptyDay({ label }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-5 text-center text-[11px] font-semibold text-slate-300">
      {label}
    </div>
  );
}

export default function ScheduleCalendarBoard({
  assignments = [],
  view = 'month',
  cursorDate,
  selectedDate,
  onDateSelect,
  emptyLabel = 'No schedule on this day',
}) {
  const grouped = groupAssignmentsByDate(assignments);
  const monthCells = buildMonthGrid(cursorDate);
  const weekCells = buildWeekGrid(selectedDate || cursorDate);
  const activeDateKey = toDateKey(selectedDate || cursorDate);
  const cells = view === 'week' ? weekCells : monthCells;

  if (view === 'list') {
    const days = Object.entries(grouped)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateKey, dayAssignments]) => ({ dateKey, assignments: dayAssignments }));

    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-indigo-500" />
          <h3 className="text-lg font-black text-slate-900">List View</h3>
        </div>

        {days.length ? (
          <div className="space-y-4">
            {days.map((day) => (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => onDateSelect?.(day.dateKey)}
                className={`w-full rounded-[24px] border p-4 text-left transition ${
                  day.dateKey === activeDateKey
                    ? 'border-indigo-300 bg-indigo-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-900">{formatLongDate(day.dateKey)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {day.assignments.length} assignment{day.assignments.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {day.assignments.map((assignment) => (
                    <AssignmentPill key={assignment.Id} assignment={assignment} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-16 text-center text-sm font-semibold text-slate-400">
            No schedule assignments found for the selected filters.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)]">
      <div className="mb-4 grid grid-cols-7 gap-3 text-center">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {cells.map((cell) => {
          const cellAssignments = grouped[cell.dateKey] || [];
          const isSelected = cell.dateKey === activeDateKey;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onDateSelect?.(cell.dateKey)}
              className={`min-h-[148px] rounded-[24px] border p-3 text-left transition ${
                cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/70'
              } ${
                isSelected
                  ? 'border-indigo-300 ring-2 ring-indigo-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={`text-sm font-black ${cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-300'}`}>
                  {cell.dayNumber}
                </span>
                {cellAssignments.length ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                    {cellAssignments.length}
                  </span>
                ) : null}
              </div>

              <div className="space-y-2">
                {cellAssignments.slice(0, 3).map((assignment) => (
                  <AssignmentPill key={assignment.Id} assignment={assignment} compact />
                ))}

                {!cellAssignments.length ? <EmptyDay label={emptyLabel} /> : null}

                {cellAssignments.length > 3 ? (
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-500">
                    +{cellAssignments.length - 3} more
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
