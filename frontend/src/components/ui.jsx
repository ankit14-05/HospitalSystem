// src/components/ui.jsx  — shared design primitives for HMS
import React from 'react';

export const TEAL = '#0d9488';
export const BLUE = '#1a6cf6';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export const Sk = ({ w = 'w-full', h = 'h-4', r = 'rounded-lg' }) => (
  <div className={`${w} ${h} ${r} bg-slate-100 animate-pulse`} />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
export const StatCard = ({ icon: Icon, label, value, sub, color, loading, trend }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
      {trend !== undefined && !loading && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    {loading
      ? <><Sk w="w-16" h="h-7" /><Sk w="w-24" h="h-3" r="rounded-md" /></>
      : <>
          <p className="text-2xl font-bold text-slate-800 leading-tight">{value ?? '—'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-slate-500 mt-1 font-medium">{sub}</p>}
        </>
    }
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const s = (status || '').toLowerCase();
  const map = {
    completed: 'bg-emerald-100 text-emerald-700',
    approved:  'bg-emerald-100 text-emerald-700',
    active:    'bg-emerald-100 text-emerald-700',
    upcoming:  'bg-blue-100 text-blue-700',
    pending:   'bg-amber-100 text-amber-700',
    waiting:   'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-600',
    rejected:  'bg-red-100 text-red-600',
    done:      'bg-slate-100 text-slate-500',
    current:   'bg-emerald-100 text-emerald-700',
    paid:      'bg-emerald-100 text-emerald-700',
    unpaid:    'bg-red-100 text-red-600',
    ready:     'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${map[s] || map.pending}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
export const Empty = ({ icon: Icon, text, action, onAction }) => (
  <div className="flex flex-col items-center py-16 text-slate-400">
    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
      <Icon size={24} className="text-slate-300" />
    </div>
    <p className="text-sm font-medium text-slate-500">{text}</p>
    {action && (
      <button onClick={onAction}
        className="mt-4 px-4 py-2 rounded-xl text-white text-sm font-semibold"
        style={{ background: TEAL }}>
        {action}
      </button>
    )}
  </div>
);

// ─── Section Header ───────────────────────────────────────────────────────────
export const SectionHeader = ({ title, icon: Icon, badge, children }) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
    <div className="flex items-center gap-2">
      {Icon && <Icon size={15} style={{ color: TEAL }} />}
      <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
      {badge > 0 && (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700">{badge}</span>
      )}
    </div>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

// ─── Modal wrapper ────────────────────────────────────────────────────────────
export const Modal = ({ children, onClose, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className={`bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
      {children}
    </div>
  </div>
);

// ─── Toast-styled notice ─────────────────────────────────────────────────────
export const InfoBadge = ({ children, color }) => (
  <span className="text-xs font-medium px-2.5 py-1 rounded-full"
    style={{ background: `${color}15`, color }}>
    {children}
  </span>
);

// ─── Page section title ───────────────────────────────────────────────────────
export const PageTitle = ({ title, subtitle }) => (
  <div className="mb-5">
    <h1 className="text-xl font-bold text-slate-900">{title}</h1>
    {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

export const fmtTime = (t) => {
  if (!t) return '—';
  try {
    return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return t; }
};

export const initials = (first, last) =>
  `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '?';