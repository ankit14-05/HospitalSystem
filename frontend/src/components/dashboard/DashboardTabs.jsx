import React from 'react';

const THEMES = {
  teal: {
    active: 'border-teal-200 bg-teal-50 text-teal-700 shadow-sm',
    activeIcon: 'text-teal-600',
    inactive: 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800',
    inactiveIcon: 'text-slate-400',
    badge: 'bg-teal-600 text-white',
    inactiveBadge: 'bg-slate-200 text-slate-600',
  },
  blue: {
    active: 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm',
    activeIcon: 'text-blue-600',
    inactive: 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800',
    inactiveIcon: 'text-slate-400',
    badge: 'bg-blue-600 text-white',
    inactiveBadge: 'bg-slate-200 text-slate-600',
  },
  indigo: {
    active: 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm',
    activeIcon: 'text-indigo-600',
    inactive: 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800',
    inactiveIcon: 'text-slate-400',
    badge: 'bg-indigo-600 text-white',
    inactiveBadge: 'bg-slate-200 text-slate-600',
  },
};

export default function DashboardTabs({
  tabs = [],
  activeTab,
  onChange,
  theme = 'teal',
}) {
  const palette = THEMES[theme] || THEMES.teal;

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-[28px] border border-slate-100 bg-slate-50/80 p-2">
        {tabs.map((tab) => {
          const key = tab.key ?? tab.id;
          const Icon = tab.icon;
          const isActive = activeTab === key;
          const badge = Number(tab.badge || 0);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange?.(key)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                isActive ? palette.active : palette.inactive
              }`}
            >
              {Icon ? (
                <Icon
                  size={16}
                  className={isActive ? palette.activeIcon : palette.inactiveIcon}
                />
              ) : null}
              <span className="whitespace-nowrap">{tab.label}</span>
              {badge > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isActive ? palette.badge : palette.inactiveBadge
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
