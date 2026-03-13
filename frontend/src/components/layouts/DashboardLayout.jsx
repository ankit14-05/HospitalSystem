// src/layouts/DashboardLayout.jsx
//
// Wire up in your router:
//
//   import DashboardLayout from '../layouts/DashboardLayout';
//
//   <Route element={<DashboardLayout />}>
//     <Route path="/dashboard/admin"   element={<AdminDashboard />}   />
//     <Route path="/dashboard/doctor"  element={<DoctorDashboard />}  />
//     <Route path="/dashboard/patient" element={<PatientDashboard />} />
//     <Route path="/dashboard/staff"   element={<StaffDashboard />}   />
//   </Route>

import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, LayoutDashboard, Users, Stethoscope, Briefcase,
  Calendar, Pill, FileText, Receipt, Heart, BarChart2,
  Settings, LogOut, Bell, ChevronDown, PanelLeftClose,
  PanelLeftOpen, Clock, Bed, ClipboardList, Search,
  UserCircle, Edit2, Shield, X,
} from 'lucide-react';
import { useAuth } from "../../context/AuthContext";
import useHospitalBranding from '../../hooks/useHospitalBranding';

// ── colour helpers (identical to LoginPage) ───────────────────────────────────
function shiftColor(hex, amt) {
  try {
    const n = parseInt((hex || '#6d28d9').replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (n >> 16)         + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff)         + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return hex || '#6d28d9'; }
}

const initials = (first = '', last = '') =>
  `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}` || '?';

const ROLE_LABEL = {
  superadmin:'Super Admin', admin:'Administrator', doctor:'Doctor',
  nurse:'Nurse', receptionist:'Receptionist', pharmacist:'Pharmacist',
  labtech:'Lab Technician', patient:'Patient', auditor:'Auditor',
};

function staffNav() {
  return [
    { path:'/dashboard/staff',    label:'Dashboard',   icon: LayoutDashboard },
    { path:'/staff/tasks',        label:'My Tasks',    icon: ClipboardList   },
    { path:'/staff/patients',     label:'Patients',    icon: Users           },
    { path:'/staff/beds',         label:'Bed Status',  icon: Bed             },
    { path:'/staff/schedule',     label:'My Schedule', icon: Clock           },
  ];
}

const NAV = {
  superadmin: [
    { path:'/dashboard/admin',        label:'Dashboard',        icon: LayoutDashboard },
    { path:'/admin/doctor-approvals', label:'Doctor Approvals', icon: Stethoscope     },
    { path:'/admin/staff-approvals',  label:'Staff Approvals',  icon: Briefcase       },
    { path:'/admin/patients',         label:'Patients',         icon: Users           },
    { path:'/admin/appointments',     label:'Appointments',     icon: Calendar        },
    { path:'/admin/departments',      label:'Departments',      icon: Bed             },
    { path:'/admin/reports',          label:'Reports',          icon: BarChart2       },
    { path:'/admin/settings',         label:'Settings',         icon: Settings        },
  ],
  admin: [
    { path:'/dashboard/admin',        label:'Dashboard',        icon: LayoutDashboard },
    { path:'/admin/doctor-approvals', label:'Doctor Approvals', icon: Stethoscope     },
    { path:'/admin/staff-approvals',  label:'Staff Approvals',  icon: Briefcase       },
    { path:'/admin/patients',         label:'Patients',         icon: Users           },
    { path:'/admin/appointments',     label:'Appointments',     icon: Calendar        },
    { path:'/admin/departments',      label:'Departments',      icon: Bed             },
    { path:'/admin/reports',          label:'Reports',          icon: BarChart2       },
    { path:'/admin/settings',         label:'Settings',         icon: Settings        },
  ],
  doctor: [
    { path:'/dashboard/doctor',       label:'Dashboard',       icon: LayoutDashboard },
    { path:'/doctor/queue',           label:"Today's Queue",   icon: Users           },
    { path:'/doctor/appointments',    label:'Appointments',    icon: Calendar        },
    { path:'/doctor/prescriptions',   label:'Prescriptions',   icon: Pill            },
    { path:'/doctor/schedule',        label:'Schedule',        icon: Clock           },
    { path:'/doctor/analytics',       label:'Analytics',       icon: BarChart2       },
    { path:'/doctor/profile',         label:'My Profile',      icon: UserCircle      },
  ],
  patient: [
    { path:'/dashboard/patient',      label:'Dashboard',       icon: LayoutDashboard },
    { path:'/patient/appointments',   label:'Appointments',    icon: Calendar        },
    { path:'/patient/prescriptions',  label:'Prescriptions',   icon: Pill            },
    { path:'/patient/records',        label:'Medical Records', icon: FileText        },
    { path:'/patient/reports',        label:'Lab Reports',     icon: ClipboardList   },
    { path:'/patient/billing',        label:'Billing',         icon: Receipt         },
    { path:'/patient/vitals',         label:'Health Vitals',   icon: Heart           },
    { path:'/patient/profile',        label:'My Profile',      icon: UserCircle      },
  ],
  nurse:        staffNav(),
  receptionist: staffNav(),
  pharmacist:   staffNav(),
  labtech:      staffNav(),
};

// ═════════════════════════════════════════════════════════════════════════════
export default function DashboardLayout() {
  const { user, logout }  = useAuth();
  const navigate           = useNavigate();
  const location           = useLocation();
  const { branding }       = useHospitalBranding(1);

  const primary = branding?.primaryColor || '#6d28d9';
  const deep    = shiftColor(primary, -65);
  const light   = shiftColor(primary, +30);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);

  const profileRef = useRef(null);
  const notifRef   = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setNotifOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const role     = user?.role || 'admin';
  const navItems = NAV[role] || NAV.admin;
  const name     = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
  const picUrl   = user?.profilePicUrl || user?.ProfilePicUrl || null;

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const SW = sidebarOpen ? 240 : 60;

  return (
    <>
      <style>{`
        @keyframes dl-fade  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes dl-slide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes dl-orb   { 0%,100%{transform:scale(1);opacity:.12} 50%{transform:scale(1.15);opacity:.06} }
        .dl-content { animation: dl-fade .35s ease both; }
        .dl-pop     { animation: dl-fade .18s ease both; }
        .dl-nav-item { transition: background .15s, color .15s; }
        .dl-nav-item:hover { background: rgba(255,255,255,0.10) !important; }
        .dl-sidebar-scroll {
          overflow-y: auto; scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .dl-sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .dl-sidebar-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15);border-radius:9px; }
        .dl-main-scroll {
          overflow-y: auto; scrollbar-width: thin;
          scrollbar-color: #c7d2fe transparent;
        }
        .dl-main-scroll::-webkit-scrollbar { width: 4px; }
        .dl-main-scroll::-webkit-scrollbar-thumb { background:#c7d2fe;border-radius:9px; }
      `}</style>

      <div className="h-screen w-screen flex overflow-hidden"
        style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", background:'#f1f5f9' }}>

        {/* ═══════════ SIDEBAR ═══════════ */}
        <aside
          className="flex-shrink-0 flex flex-col relative overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            width: SW,
            background: `linear-gradient(165deg, ${deep} 0%, ${shiftColor(primary,-45)} 55%, ${deep} 100%)`,
          }}>

          {/* Orbs */}
          <div className="absolute -top-16 -left-16 w-52 h-52 rounded-full pointer-events-none"
            style={{ background:`radial-gradient(circle,${primary},transparent)`, opacity:.18, animation:'dl-orb 8s ease-in-out infinite' }}/>
          <div className="absolute bottom-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
            style={{ background:`radial-gradient(circle,${shiftColor(primary,30)},transparent)`, opacity:.12, animation:'dl-orb 11s ease-in-out infinite reverse' }}/>
          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage:'radial-gradient(rgba(255,255,255,.28) 1px,transparent 1px)', backgroundSize:'24px 24px', opacity:.07 }}/>

          {/* ── Sidebar top: logo + toggle ── */}
          <div className="relative flex items-center gap-3 px-3.5 py-4 flex-shrink-0"
            style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
              {branding?.logoUrl
                ? <img src={branding.logoUrl} alt="logo"
                    className="w-8 h-8 rounded-xl object-contain border border-white/20 bg-white/10 flex-shrink-0"/>
                : <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/20 bg-white/10 flex-shrink-0">
                    <Activity size={15} className="text-white" strokeWidth={2.5}/>
                  </div>
              }
              {sidebarOpen && (
                <div className="min-w-0 overflow-hidden" style={{ animation:'dl-slide .25s ease both' }}>
                  <p className="text-white font-bold text-[13px] whitespace-nowrap leading-tight truncate">
                    {branding?.name || 'MediCore HMS'}
                  </p>
                  <p className="text-white/35 text-[10px] tracking-widest uppercase whitespace-nowrap">
                    {branding?.shortName || 'Hospital Management'}
                  </p>
                </div>
              )}
            </div>
            <button onClick={() => setSidebarOpen(o => !o)}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color:'rgba(255,255,255,0.45)' }}>
              {sidebarOpen ? <PanelLeftClose size={15}/> : <PanelLeftOpen size={15}/>}
            </button>
          </div>

          {/* Role badge */}
          {sidebarOpen && (
            <div className="relative px-3.5 pt-3 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                  style={{ background: role==='patient'?'#60a5fa':role==='doctor'?'#34d399':'#fbbf24' }}/>
                <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">
                  {ROLE_LABEL[role] || 'Staff'}
                </span>
              </div>
            </div>
          )}
          {!sidebarOpen && <div className="h-3"/>}

          {/* ── Nav items ── */}
          <nav className="relative flex-1 dl-sidebar-scroll px-2 py-1">
            {sidebarOpen && (
              <p className="text-[9px] font-bold text-white/25 uppercase tracking-[.18em] px-3 mb-2 mt-1">
                Navigation
              </p>
            )}
            {navItems.map(item => {
              const Icon   = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path}
                  className={`dl-nav-item flex items-center gap-3 rounded-xl mb-0.5
                    ${sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}`}
                  style={active ? { background:'rgba(255,255,255,0.14)', boxShadow:'0 0 0 1px rgba(255,255,255,0.12)' } : {}}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                    ${active ? 'bg-white/20' : 'bg-transparent'}`}>
                    <Icon size={15} className={active ? 'text-white' : 'text-white/50'} strokeWidth={active ? 2.5 : 2}/>
                  </div>
                  {sidebarOpen && (
                    <span className={`text-[13px] font-semibold truncate ${active ? 'text-white' : 'text-white/50'}`}>
                      {item.label}
                    </span>
                  )}
                  {sidebarOpen && active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: light }}/>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Sidebar footer: user card + logout ── */}
          <div className="relative flex-shrink-0 p-2.5"
            style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            <div className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl mb-2
              ${sidebarOpen ? '' : 'justify-center'}`}
              style={{ background:'rgba(255,255,255,0.06)' }}>
              {picUrl
                ? <img src={picUrl} alt="av"
                    className="w-8 h-8 rounded-lg object-cover border-2 flex-shrink-0"
                    style={{ borderColor:'rgba(255,255,255,0.2)' }}/>
                : <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                    style={{ background:`linear-gradient(135deg,${primary},${light})` }}>
                    {initials(user?.firstName, user?.lastName)}
                  </div>
              }
              {sidebarOpen && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-white text-[12px] font-bold truncate leading-tight">{name}</p>
                  <p className="text-white/35 text-[10px] truncate capitalize">{ROLE_LABEL[role]}</p>
                </div>
              )}
            </div>
            <button onClick={handleLogout}
              className={`dl-nav-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/40 hover:text-white/70
                ${sidebarOpen ? '' : 'justify-center'}`}>
              <LogOut size={14} className="flex-shrink-0"/>
              {sidebarOpen && <span className="text-[12px] font-semibold">Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* ═══════════ RIGHT SIDE ═══════════ */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ── Top Header ── */}
          <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 z-30"
            style={{
              background: 'rgba(255,255,255,0.93)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(226,232,240,0.8)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>

            {/* Page title */}
            <div>
              <h2 className="text-[15px] font-bold text-slate-800 leading-tight">
                {navItems.find(n => isActive(n.path))?.label || 'Dashboard'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {new Date().toLocaleDateString('en-IN', { weekday:'short', month:'long', day:'numeric', year:'numeric' })}
              </p>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">

              {/* Search toggle */}
              <button onClick={() => setSearchOpen(o => !o)}
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all hover:shadow-sm">
                <Search size={14}/>
              </button>

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
                  className="relative w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all hover:shadow-sm">
                  <Bell size={14}/>
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: primary }}/>
                </button>

                {notifOpen && (
                  <div className="dl-pop absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                      <p className="font-bold text-slate-800 text-[13px]">Notifications</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: primary }}>3 new</span>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                      {[
                        { icon:'🩺', text:'Dr. Sharma approved your appointment',   time:'2 min ago',  unread:true  },
                        { icon:'💊', text:'New prescription issued for review',      time:'1 hr ago',   unread:true  },
                        { icon:'📋', text:'Lab report for Priya Patel is ready',    time:'3 hrs ago',  unread:true  },
                        { icon:'✅', text:'Patient discharge completed — Room 212', time:'5 hrs ago',  unread:false },
                      ].map((n, i) => (
                        <div key={i}
                          className={`flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${n.unread ? 'bg-blue-50/40' : ''}`}>
                          <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-slate-700 leading-snug">{n.text}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                          </div>
                          {n.unread && (
                            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: primary }}/>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-slate-100">
                      <button className="text-[12px] font-bold hover:underline" style={{ color: primary }}>
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-px h-5 bg-slate-200"/>

              {/* Profile dropdown */}
              <div className="relative" ref={profileRef}>
                <button onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
                  className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all bg-white">
                  {picUrl
                    ? <img src={picUrl} alt="av"
                        className="w-7 h-7 rounded-lg object-cover border flex-shrink-0"
                        style={{ borderColor:`${primary}30` }}/>
                    : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-black flex-shrink-0"
                        style={{ background:`linear-gradient(135deg,${primary},${light})` }}>
                        {initials(user?.firstName, user?.lastName)}
                      </div>
                  }
                  <div className="hidden sm:block text-left">
                    <p className="text-[12px] font-bold text-slate-800 leading-tight truncate max-w-[100px]">{name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{ROLE_LABEL[role]}</p>
                  </div>
                  <ChevronDown size={12}
                    className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${profileOpen ? 'rotate-180' : ''}`}/>
                </button>

                {profileOpen && (
                  <div className="dl-pop absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        {picUrl
                          ? <img src={picUrl} alt="av"
                              className="w-12 h-12 rounded-xl object-cover border-2 flex-shrink-0"
                              style={{ borderColor:`${primary}30` }}/>
                          : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                              style={{ background:`linear-gradient(135deg,${primary},${light})` }}>
                              {initials(user?.firstName, user?.lastName)}
                            </div>
                        }
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{name}</p>
                          <p className="text-xs text-slate-400 capitalize">{ROLE_LABEL[role]}</p>
                          {user?.email && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      {[
                        { icon: UserCircle, label:'My Profile',   path:`/${role}/profile`  },
                        { icon: Edit2,      label:'Edit Profile', path:`/${role}/profile`  },
                        { icon: Shield,     label:'Security',     path:`/${role}/security` },
                        { icon: Settings,   label:'Settings',     path:`/${role}/settings` },
                      ].map(item => {
                        const Icon = item.icon;
                        return (
                          <Link key={item.label} to={item.path}
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 group-hover:bg-slate-200 transition-colors flex-shrink-0">
                              <Icon size={13} className="text-slate-500"/>
                            </div>
                            <span className="text-[13px] font-medium text-slate-600">{item.label}</span>
                          </Link>
                        );
                      })}
                      <div className="my-1 border-t border-slate-100"/>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors group">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50 group-hover:bg-red-100 transition-colors flex-shrink-0">
                          <LogOut size={13} className="text-red-500"/>
                        </div>
                        <span className="text-[13px] font-medium text-red-600">Sign Out</span>
                      </button>
                    </div>
                    <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/60">
                      <p className="text-[10px] text-slate-400">
                        © {new Date().getFullYear()} {branding?.name || 'MediCore HMS'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ── Slide-down search bar ── */}
          {searchOpen && (
            <div className="flex-shrink-0 px-5 py-2.5 border-b border-slate-100 bg-white/80 backdrop-blur-sm z-20"
              style={{ animation:'dl-fade .2s ease both' }}>
              <div className="relative max-w-xl">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input autoFocus placeholder="Search patients, doctors, appointments…"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-700 placeholder:text-slate-300 outline-none focus:ring-2 focus:border-indigo-300"/>
                <button onClick={() => setSearchOpen(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                  <X size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* ── Breadcrumb strip ── */}
          <div className="flex-shrink-0 flex items-center gap-2 px-5 py-2 text-[11px] text-slate-400 z-10"
            style={{ borderBottom:'1px solid rgba(226,232,240,0.5)', background:'rgba(248,250,252,0.85)' }}>
            <span className="font-semibold text-slate-500">{branding?.name || 'HMS'}</span>
            <span className="text-slate-300">/</span>
            <span className="capitalize text-slate-400">{ROLE_LABEL[role]}</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold" style={{ color: primary }}>
              {navItems.find(n => isActive(n.path))?.label || 'Dashboard'}
            </span>
          </div>

          {/* ── Scrollable dashboard content ── */}
          <main className="flex-1 dl-main-scroll">
            <div className="max-w-[1400px] mx-auto px-5 py-5 dl-content">
              <Outlet/>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}