// src/components/layout/AppLayout.jsx
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';
import {
  LayoutDashboard, Building2, Users, MapPin, Settings,
  FlaskConical, Pill, Stethoscope, BedDouble, FileText,
  CreditCard, ClipboardList, Bell, LogOut, Menu, X,
  ChevronDown, ChevronRight, Activity, UserCheck,
} from 'lucide-react';

const NAV = [
  {
    section: 'Main',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: null },
    ],
  },
  {
    section: 'Clinical',
    roles: ['superadmin','admin','doctor','nurse','receptionist'],
    items: [
      { to: '/appointments', icon: ClipboardList, label: 'Appointments', roles: ['doctor','nurse','receptionist','admin','superadmin'] },
      { to: '/patients', icon: UserCheck, label: 'Patients', roles: ['doctor','nurse','receptionist','admin','superadmin'] },
      { to: '/admissions', icon: BedDouble, label: 'Admissions', roles: ['doctor','nurse','receptionist','admin','superadmin'] },
      { to: '/prescriptions', icon: Pill, label: 'Prescriptions', roles: ['doctor','pharmacist','admin','superadmin'] },
      { to: '/lab', icon: FlaskConical, label: 'Lab Orders', roles: ['doctor','labtech','admin','superadmin'] },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/billing', icon: CreditCard, label: 'Billing', roles: ['receptionist','admin','superadmin'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/setup/hospital', icon: Building2, label: 'Hospital Setup', roles: ['superadmin','admin'] },
      { to: '/setup/users',    icon: Users,     label: 'Users',          roles: ['superadmin','admin'] },
      { to: '/setup/geography',icon: MapPin,    label: 'Geography',      roles: ['superadmin','admin'] },
    ],
  },
];

function NavItem({ item }) {
  const { hasRole } = useAuth();
  if (item.roles && !hasRole(...item.roles)) return null;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'active' : ''}`
      }
    >
      <item.icon size={17} strokeWidth={2} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function Sidebar({ mobile, onClose }) {
  const { user, logout, roleLabel } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className={`
      flex flex-col h-full bg-white border-r border-slate-100
      ${mobile ? 'w-72' : 'w-64'}
    `}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-primary-700 flex items-center justify-center">
          <Activity size={18} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-bold text-slate-800 text-sm leading-tight">MediCore HMS</div>
          <div className="text-xs text-slate-400">Hospital Management</div>
        </div>
        {mobile && (
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section">{section.section}</div>
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* User info */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-700 truncate">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-slate-400 truncate">{roleLabel}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-danger-600"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 h-full animate-slide-down">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center gap-4 px-6 bg-white border-b border-slate-100 flex-shrink-0">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          {/* Notifications */}
          <button className="relative text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger-500" />
          </button>
          {/* Hospital name */}
          <div className="hidden md:block text-sm text-slate-500 font-medium border-l border-slate-100 pl-4">
            {user?.hospitalName || 'MediCore HMS'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
