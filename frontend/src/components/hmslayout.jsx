// src/components/HMSLayout.jsx
import React, { useState } from 'react';
import {
  LayoutDashboard, Calendar, FileText, Receipt, Stethoscope,
  Activity, Users, Pill, Search, ChevronDown, Menu,
  LogOut, Settings, Clock, BarChart3, FlaskConical,
  ChevronRight, User
} from 'lucide-react';

// ── NotificationBell replaces the old hardcoded bell button ──────────────────
import NotificationBell from './ui/NotificationBell';

const TEAL  = '#0d9488';
const BLUE  = '#1a6cf6';
const NAVY  = '#0f172a';

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, badge, onClick, collapsed }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`
      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
      transition-all duration-150 group relative
      ${active
        ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
        : 'text-slate-400 hover:bg-white/8 hover:text-white'
      }
    `}
  >
    <Icon size={18} className="flex-shrink-0" />
    {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
    {!collapsed && badge > 0 && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-teal-500/20 text-teal-400'}`}>
        {badge}
      </span>
    )}
    {collapsed && badge > 0 && (
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
);

// ─── HMS Sidebar ──────────────────────────────────────────────────────────────
export const HMSSidebar = ({ role = 'doctor', activeTab, setActiveTab, badges = {}, onLogout, collapsed, setCollapsed }) => {
  const doctorNav = [
    { key: 'overview',   label: 'Dashboard',      icon: LayoutDashboard },
    { key: 'queue',      label: "Today's Queue",   icon: Users,       badge: badges.queue },
    { key: 'requests',   label: 'Appointments',    icon: Calendar,    badge: badges.requests },
    { key: 'rx',         label: 'Prescriptions',   icon: Pill },
    { key: 'schedule',   label: 'Schedule',        icon: Clock },
    { key: 'analytics',  label: 'Analytics',       icon: BarChart3 },
    { key: 'profile',    label: 'My Profile',      icon: User },
  ];

  const patientNav = [
    { key: 'overview',      label: 'Dashboard',      icon: LayoutDashboard },
    { key: 'appointments',  label: 'Appointments',   icon: Calendar,   badge: badges.upcoming },
    { key: 'prescriptions', label: 'Prescriptions',  icon: Pill,       badge: badges.activeMeds },
    { key: 'emr',           label: 'Medical Records',icon: FileText },
    { key: 'reports',       label: 'Lab Reports',    icon: FlaskConical },
    { key: 'billing',       label: 'Billing',        icon: Receipt },
    { key: 'vitals',        label: 'Health Vitals',  icon: Activity },
    { key: 'profile',       label: 'My Profile',     icon: User },
  ];

  const nav = role === 'doctor' ? doctorNav : patientNav;

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full transition-all duration-300"
      style={{
        width: collapsed ? 68 : 240,
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)'
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0d9488, #1a6cf6)' }}>
          <Stethoscope size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-none">HMS</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Hospital System</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={14} /> : <Menu size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
        {!collapsed && (
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">
            {role === 'doctor' ? 'Clinical' : 'Patient Portal'}
          </p>
        )}
        {nav.map(item => (
          <NavItem
            key={item.key}
            {...item}
            active={activeTab === item.key}
            onClick={() => setActiveTab(item.key)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-1 border-t border-white/8 pt-3">
        <NavItem icon={Settings} label="Settings" collapsed={collapsed} active={false} onClick={() => {}} />
        <NavItem icon={LogOut}   label="Logout"   collapsed={collapsed} active={false} onClick={onLogout} />
      </div>
    </aside>
  );
};

// ─── HMS Topbar ───────────────────────────────────────────────────────────────
// CHANGED: removed `notifications`, `onNotifClick` props — NotificationBell
// is now self-contained and handles its own state internally.
export const HMSTopbar = ({ name, role, avatarUrl, onProfileClick }) => {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center px-6 gap-4 flex-shrink-0 shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{greet}, {name?.split(' ')[0] || 'User'} 👋</p>
        <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-56">
        <Search size={13} className="text-slate-400 flex-shrink-0" />
        <input
          placeholder="Search patients, records…"
          className="flex-1 bg-transparent text-xs text-slate-600 placeholder-slate-400 outline-none"
        />
      </div>

      {/* ── CHANGED: replaced hardcoded bell button with NotificationBell ── */}
      <NotificationBell />

      {/* Avatar */}
      <button
        onClick={onProfileClick}
        className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
      >
        {avatarUrl
          ? <img src={avatarUrl} className="w-8 h-8 rounded-xl object-cover" alt="av" />
          : <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #0d9488, #1a6cf6)' }}>
              {(name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
        }
        <div className="hidden sm:block text-left">
          <p className="text-xs font-bold text-slate-800 leading-none">{name}</p>
          <p className="text-[10px] text-slate-400 capitalize">{role}</p>
        </div>
        <ChevronDown size={12} className="text-slate-400" />
      </button>
    </header>
  );
};

// ─── HMS Shell Layout ─────────────────────────────────────────────────────────
export const HMSShell = ({ children, sidebar, topbar }) => (
  <div className="flex h-screen overflow-hidden bg-slate-50">
    {sidebar}
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {topbar}
      <main className="flex-1 overflow-y-auto p-5">
        {children}
      </main>
    </div>
  </div>
);