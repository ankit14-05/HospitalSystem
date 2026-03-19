import React from 'react';
import { Activity, CreditCard, CalendarClock, UserPlus, UserCheck, Briefcase } from 'lucide-react';

const TYPE_META = {
  patient_registered: {
    icon: UserPlus,
    dot: 'bg-blue-500',
    iconWrap: 'bg-blue-50 text-blue-600',
  },
  doctor_registration: {
    icon: Briefcase,
    dot: 'bg-amber-500',
    iconWrap: 'bg-amber-50 text-amber-600',
  },
  doctor_approved: {
    icon: UserCheck,
    dot: 'bg-emerald-500',
    iconWrap: 'bg-emerald-50 text-emerald-600',
  },
  staff_registration: {
    icon: Briefcase,
    dot: 'bg-cyan-500',
    iconWrap: 'bg-cyan-50 text-cyan-600',
  },
  staff_approved: {
    icon: UserCheck,
    dot: 'bg-teal-500',
    iconWrap: 'bg-teal-50 text-teal-600',
  },
  appointment_booked: {
    icon: CalendarClock,
    dot: 'bg-indigo-500',
    iconWrap: 'bg-indigo-50 text-indigo-600',
  },
  appointment_cancelled: {
    icon: CalendarClock,
    dot: 'bg-rose-500',
    iconWrap: 'bg-rose-50 text-rose-600',
  },
  appointment_completed: {
    icon: CalendarClock,
    dot: 'bg-violet-500',
    iconWrap: 'bg-violet-50 text-violet-600',
  },
  bill_generated: {
    icon: CreditCard,
    dot: 'bg-orange-500',
    iconWrap: 'bg-orange-50 text-orange-600',
  },
  activity: {
    icon: Activity,
    dot: 'bg-slate-400',
    iconWrap: 'bg-slate-100 text-slate-600',
  },
};

const timeAgo = (value) => {
  if (!value) return 'Recently';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Recently';

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function RecentActivityList({
  activities = [],
  loading = false,
  emptyText = 'No recent activity yet.',
}) {
  if (loading) {
    return (
      <div className="divide-y divide-slate-50">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-6 py-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded-full bg-slate-100 animate-pulse w-2/3" />
              <div className="h-3 rounded-full bg-slate-100 animate-pulse w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="px-6 py-12 text-center text-slate-400">
        <Activity size={28} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm font-medium">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-50">
      {activities.map((activity, index) => {
        const meta = TYPE_META[activity.type] || TYPE_META.activity;
        const Icon = meta.icon;

        return (
          <div key={`${activity.type}-${activity.createdAt || index}`} className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${meta.iconWrap}`}>
              <Icon size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                <p className="text-sm font-semibold text-slate-700 truncate">{activity.title}</p>
              </div>
              {activity.subtitle && (
                <p className="text-xs text-slate-400 mt-1 truncate">{activity.subtitle}</p>
              )}
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(activity.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
