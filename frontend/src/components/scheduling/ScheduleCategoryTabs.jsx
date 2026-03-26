import React from 'react';
import { SCHEDULE_CATEGORY_TABS } from './scheduleConfig';

export default function ScheduleCategoryTabs({
  activeCategory,
  counts = {},
  onChange,
  size = 'md',
  className = '',
  variant = 'pill',
}) {
  const sizeClass =
    size === 'sm'
      ? 'px-3 py-2 text-xs'
      : 'px-4 py-3 text-sm';

  if (variant === 'underline') {
    return (
      <div className={`flex flex-wrap items-center gap-4 ${className}`.trim()}>
        {SCHEDULE_CATEGORY_TABS.map((tab) => {
          const active = tab.value === activeCategory;
          const count = Number(counts?.[tab.value] || 0);

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange?.(tab.value)}
              className={`relative inline-flex items-center gap-2 pb-3 text-sm font-black transition ${
                active ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                active ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
              <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full transition ${
                active ? 'bg-indigo-500' : 'bg-transparent'
              }`} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {SCHEDULE_CATEGORY_TABS.map((tab) => {
        const active = tab.value === activeCategory;
        const count = Number(counts?.[tab.value] || 0);

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange?.(tab.value)}
            className={`inline-flex items-center gap-3 rounded-2xl border transition ${
              active
                ? 'border-slate-900 bg-slate-900 text-white shadow-[0_20px_50px_-38px_rgba(15,23,42,0.65)]'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            } ${sizeClass}`}
          >
            <span className="font-black">{tab.label}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                active ? 'bg-white/12 text-white/85' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
