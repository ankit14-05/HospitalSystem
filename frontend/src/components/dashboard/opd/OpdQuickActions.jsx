import React from 'react';
import { ArrowRight, CalendarPlus2, ClipboardList, Clock3 } from 'lucide-react';

const ACTIONS = [
  {
    key: 'book',
    title: 'Book Appointment',
    icon: CalendarPlus2,
    accent: '#0f766e',
  },
  {
    key: 'appointments',
    title: 'Manage Appointments',
    icon: ClipboardList,
    accent: '#1d4ed8',
  },
  {
    key: 'schedules',
    title: 'Doctor Schedules',
    icon: Clock3,
    accent: '#7c3aed',
  },
];

export default function OpdQuickActions({ onBook, onAppointments, onSchedules }) {
  const handlers = {
    book: onBook,
    appointments: onAppointments,
    schedules: onSchedules,
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.key}
            onClick={handlers[action.key]}
            className="group rounded-[28px] border border-white/60 bg-white/90 p-5 text-left shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-slate-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, ${action.accent}, rgba(15,23,42,0.82))` }}
              >
                <Icon size={18} />
              </div>
              <ArrowRight
                size={16}
                className="mt-1 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-500"
              />
            </div>
            <h3 className="mt-5 text-lg font-black tracking-tight text-slate-900">{action.title}</h3>
          </button>
        );
      })}
    </div>
  );
}
