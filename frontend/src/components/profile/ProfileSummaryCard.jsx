import React from 'react';
import { Building2, ShieldCheck } from 'lucide-react';

const initials = (firstName = '', lastName = '') =>
  `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();

export default function ProfileSummaryCard({ profile, roleLabel, onEdit }) {
  const displayName = profile?.fullName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'User';

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {profile?.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt={displayName}
                className="w-16 h-16 rounded-2xl object-cover border border-white/15 shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg bg-white/10 border border-white/15">
                {initials(profile?.firstName, profile?.lastName)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{displayName}</h1>
              <p className="text-sm text-slate-300 mt-1">{roleLabel}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-300">
                {profile?.identifier && (
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 font-semibold">
                    {profile.identifier}
                  </span>
                )}
                {profile?.isActive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/20">
                    <ShieldCheck size={11} />
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onEdit}
            className="px-4 py-2 rounded-xl bg-white text-slate-800 text-sm font-semibold hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            Edit Details
          </button>
        </div>
      </div>

      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide font-bold text-slate-400">Username</p>
          <p className="text-sm font-semibold text-slate-700 mt-1">{profile?.username || '-'}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide font-bold text-slate-400 flex items-center gap-1">
            <Building2 size={11} />
            Hospital
          </p>
          <p className="text-sm font-semibold text-slate-700 mt-1">{profile?.hospitalName || '-'}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide font-bold text-slate-400">Primary Contact</p>
          <p className="text-sm font-semibold text-slate-700 mt-1">{profile?.email || profile?.phone || '-'}</p>
        </div>
      </div>
    </div>
  );
}
