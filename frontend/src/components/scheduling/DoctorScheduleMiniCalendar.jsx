import React from 'react';
import {
  DAY_LABELS,
  buildMonthGrid,
  buildYearMonths,
  getTokenVisual,
  toDateKey,
} from './scheduleConfig';

function DayDots({ assignments = [] }) {
  if (!assignments.length) {
    return <span className="text-[10px] font-semibold text-slate-300">No duty</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {assignments.slice(0, 3).map((assignment) => {
        const visual = getTokenVisual(assignment.ColorToken);
        return (
          <span
            key={assignment.Id}
            className={`h-2 w-2 rounded-full ${visual.dot}`}
            title={assignment.Title || assignment.ActivityName}
          />
        );
      })}
      {assignments.length > 3 && (
        <span className="text-[10px] font-bold text-slate-400">+{assignments.length - 3}</span>
      )}
    </div>
  );
}

function MonthGrid({ cursorDate, selectedDate, groupedAssignments, onSelectDate }) {
  const monthCells = buildMonthGrid(cursorDate);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {monthCells.map((cell) => {
          const cellAssignments = groupedAssignments[cell.dateKey] || [];
          const isSelected = toDateKey(selectedDate) === cell.dateKey;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate?.(cell.dateKey, { outsideCurrentMonth: !cell.isCurrentMonth })}
              className={`min-h-[90px] rounded-[22px] border p-2.5 text-left transition ${
                cell.isCurrentMonth
                  ? 'bg-white text-slate-800'
                  : 'bg-slate-50 text-slate-300'
              } ${
                isSelected
                  ? 'border-teal-300 ring-2 ring-teal-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-sm font-black">{cell.dayNumber}</span>
                {cellAssignments.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                    {cellAssignments.length}
                  </span>
                )}
              </div>
              <DayDots assignments={cellAssignments} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearMonthCard({ monthDate, groupedAssignments, selectedDate, onSelectDate }) {
  const monthKey = toDateKey(monthDate);
  const monthCells = buildMonthGrid(monthKey);
  const monthAssignments = monthCells.reduce((count, cell) => {
    if (!cell.isCurrentMonth) return count;
    return count + ((groupedAssignments[cell.dateKey] || []).length);
  }, 0);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-3.5 shadow-[0_20px_60px_-52px_rgba(15,23,42,0.45)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">
            {monthDate.toLocaleDateString('en-IN', { month: 'long' })}
          </p>
          <p className="text-[11px] font-semibold text-slate-400">
            {monthAssignments} assignment{monthAssignments === 1 ? '' : 's'}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
          {monthDate.getFullYear()}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <div
            key={`${monthKey}-${label}-${index}`}
            className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-300"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthCells.map((cell) => {
          const items = groupedAssignments[cell.dateKey] || [];
          const isSelected = toDateKey(selectedDate) === cell.dateKey;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate?.(cell.dateKey, { outsideCurrentMonth: !cell.isCurrentMonth })}
              className={`rounded-xl border px-1 py-2 text-center transition ${
                cell.isCurrentMonth
                  ? 'border-slate-100 bg-white text-slate-700'
                  : 'border-slate-100 bg-slate-50 text-slate-300'
              } ${
                isSelected
                  ? 'border-teal-300 ring-2 ring-teal-100'
                  : 'hover:border-slate-200'
              }`}
            >
              <div className="text-[11px] font-black">{cell.dayNumber}</div>
              <div className="mt-1 flex min-h-[8px] items-center justify-center gap-1">
                {items.slice(0, 2).map((assignment) => {
                  const visual = getTokenVisual(assignment.ColorToken);
                  return (
                    <span
                      key={assignment.Id}
                      className={`h-1.5 w-1.5 rounded-full ${visual.dot}`}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DoctorScheduleMiniCalendar({
  mode = 'month',
  cursorDate,
  selectedDate,
  groupedAssignments = {},
  onSelectDate,
}) {
  if (mode === 'year') {
    const months = buildYearMonths(cursorDate);
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {months.map((monthDate) => (
          <YearMonthCard
            key={monthDate.toISOString()}
            monthDate={monthDate}
            groupedAssignments={groupedAssignments}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>
    );
  }

  return (
    <MonthGrid
      cursorDate={cursorDate}
      selectedDate={selectedDate}
      groupedAssignments={groupedAssignments}
      onSelectDate={onSelectDate}
    />
  );
}
