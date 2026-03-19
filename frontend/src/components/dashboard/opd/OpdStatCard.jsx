import React from 'react';

export default function OpdStatCard({ icon: Icon, label, value, subtitle, accent = '#0f766e' }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.85))` }}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${accent}, rgba(15,23,42,0.85))` }}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
