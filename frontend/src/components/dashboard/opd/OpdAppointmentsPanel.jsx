import React from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, Ticket } from 'lucide-react';

const STATUS_STYLES = {
  Scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  Confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rescheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-violet-50 text-violet-700 border-violet-200',
};

const formatDateLabel = (dateValue) => {
  if (!dateValue) return 'Date TBD';
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Date TBD';

  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
};

export default function OpdAppointmentsPanel({
  appointments = [],
  schedules = [],
  loading = false,
  onOpenBoard,
}) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.33)] backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black tracking-tight text-slate-900">Appointments</h2>
          <button
            onClick={onOpenBoard}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Open board
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex flex-wrap gap-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-9 w-40 animate-pulse rounded-full bg-slate-100" />
            ))
          ) : schedules.length ? (
            schedules.slice(0, 8).map((schedule) => (
              <div
                key={schedule.Id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600"
              >
                <Clock3 size={12} className="text-slate-400" />
                <span>{schedule.StartTime} - {schedule.EndTime}</span>
                <span className="text-slate-300">|</span>
                <span className="truncate">{schedule.DoctorName}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No schedules for today.</p>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-3xl bg-slate-100" />
            ))}
          </div>
        ) : appointments.length ? (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <div
                key={appointment.Id}
                className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4 transition-colors hover:border-slate-200 hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black tracking-tight text-slate-900">{appointment.PatientName}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[appointment.Status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {appointment.Status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Dr. {appointment.DoctorName}
                      {appointment.DepartmentName ? ` - ${appointment.DepartmentName}` : ''}
                    </p>
                    {appointment.Reason ? (
                      <p className="mt-2 text-sm text-slate-400 line-clamp-2">{appointment.Reason}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
                      <CalendarClock size={12} className="text-teal-500" />
                      {formatDateLabel(appointment.AppointmentDate)} - {appointment.AppointmentTime || 'TBD'}
                    </div>
                    {appointment.TokenNumber ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
                        <Ticket size={12} />
                        Token #{appointment.TokenNumber}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white px-3 py-1.5 font-semibold">{appointment.VisitType || 'OPD'}</span>
                  <span className="rounded-full bg-white px-3 py-1.5 font-semibold">{appointment.Priority || 'Normal'} priority</span>
                  <span className="rounded-full bg-white px-3 py-1.5 font-semibold">Ref {appointment.AppointmentNo}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
            <CheckCircle2 size={28} className="text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-500">No appointments right now</p>
          </div>
        )}
      </div>
    </div>
  );
}
