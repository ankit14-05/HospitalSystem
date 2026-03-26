import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel, toDateKey } from './scheduleConfig';

const getYear = (value) => {
  const date = new Date(`${toDateKey(value)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
};

export default function ScheduleMonthPicker({
  value,
  onChange,
  label = null,
  className = '',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(getYear(value));

  useEffect(() => {
    setPickerYear(getYear(value));
  }, [value]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(pickerYear, index, 1)),
    [pickerYear]
  );

  const selectedMonth = new Date(`${toDateKey(value)}T00:00:00`);
  const selectedMonthIndex = Number.isNaN(selectedMonth.getTime()) ? -1 : selectedMonth.getMonth();
  const selectedYear = Number.isNaN(selectedMonth.getTime()) ? -1 : selectedMonth.getFullYear();

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      {label ? (
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
          {label}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:bg-slate-50"
      >
        <CalendarDays size={15} className="text-indigo-500" />
        {formatMonthLabel(value)}
        <ChevronDown size={15} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+12px)] z-30 w-[330px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_90px_-55px_rgba(15,23,42,0.45)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPickerYear((current) => current - 1)}
              className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-lg font-black text-slate-900">{pickerYear}</p>
            <button
              type="button"
              onClick={() => setPickerYear((current) => current + 1)}
              className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {months.map((month) => {
              const monthIndex = month.getMonth();
              const active = monthIndex === selectedMonthIndex && month.getFullYear() === selectedYear;

              return (
                <button
                  key={`${month.getFullYear()}-${monthIndex}`}
                  type="button"
                  onClick={() => {
                    onChange?.(toDateKey(month));
                    setOpen(false);
                  }}
                  className={`rounded-2xl px-3 py-3 text-xs font-black uppercase tracking-[0.18em] transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {month.toLocaleDateString('en-IN', { month: 'short' })}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
