import React from 'react';
import { Loader2, Mail, Stethoscope } from 'lucide-react';
import { fmtTime, fmtTimeRange } from '../../ui';

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const formatScheduleText = (value) => {
  if (!value) return 'Not assigned';
  return String(value).replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g, (_, start, end) => fmtTimeRange(start, end));
};

export default function OpdDoctorRosterPanel({
  doctors = [],
  loading = false,
  sendingEmailId = null,
  onSendSchedule,
}) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.33)] backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-black tracking-tight text-slate-900">Doctors on duty</h2>
      </div>

      <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-[28px] bg-slate-100" />
          ))
        ) : doctors.length ? (
          doctors.map((doctor) => (
            <div
              key={doctor.DoctorId}
              className="rounded-[28px] border border-slate-100 bg-slate-50/75 p-5 transition-colors hover:border-slate-200 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-sm font-black text-white shadow-lg">
                    {initials(doctor.DoctorName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black tracking-tight text-slate-900">Dr. {doctor.DoctorName}</p>
                    <p className="truncate text-sm text-slate-500">{doctor.Specialization || doctor.DepartmentName || 'General practice'}</p>
                  </div>
                </div>
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
                  {doctor.TodayAppointments || 0} today
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Today schedule</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{formatScheduleText(doctor.TodaySchedule)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Next patient</p>
                    <p className="mt-2 text-base font-black text-slate-900">
                      {doctor.NextAppointmentTime
                        ? fmtTimeRange(doctor.NextAppointmentTime, doctor.NextAppointmentEndTime)
                        : 'Free'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Completed</p>
                    <p className="mt-2 text-base font-black text-slate-900">{doctor.CompletedToday || 0}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-700">{doctor.Email || 'No email configured'}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{doctor.DepartmentName || 'Department not assigned'}</p>
                </div>
                <button
                  onClick={() => onSendSchedule(doctor.DoctorId)}
                  disabled={!doctor.Email || sendingEmailId === doctor.DoctorId}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {sendingEmailId === doctor.DoctorId ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                  Email plan
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
            <Stethoscope size={28} className="text-slate-300" />
            <p className="mt-4 text-base font-semibold text-slate-500">No approved doctors found</p>
          </div>
        )}
      </div>
    </div>
  );
}
