// src/components/ui/NotificationBell.jsx
// Notification bell with dropdown — shows real-time unread count
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Calendar, FlaskConical, Pill, Receipt, AlertCircle, Info, Clock } from 'lucide-react';
import api from '../../services/api';

const NOTIF_ICONS = {
  appointment:  { icon: Calendar,      color: 'bg-indigo-100 text-indigo-600' },
  lab_result:   { icon: FlaskConical,  color: 'bg-purple-100 text-purple-600' },
  prescription: { icon: Pill,          color: 'bg-emerald-100 text-emerald-600' },
  billing:      { icon: Receipt,       color: 'bg-orange-100 text-orange-600' },
  alert:        { icon: AlertCircle,   color: 'bg-red-100 text-red-600' },
  reminder:     { icon: Clock,         color: 'bg-amber-100 text-amber-600' },
  system:       { icon: Info,          color: 'bg-slate-100 text-slate-600' },
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function NotificationBell() {
  const [open,         setOpen]        = useState(false);
  const [notifications, setNotifs]     = useState([]);
  const [unread,       setUnread]      = useState(0);
  const [loading,      setLoading]     = useState(false);
  const dropdownRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/appointments/notifications?limit=15');
      setNotifs(r?.data?.data || []);
      setUnread(r?.data?.unread || 0);
    } catch {}
    setLoading(false);
  }, []);

  // Load on mount + poll every 30s
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/appointments/notifications/read-all');
      setNotifs(n => n.map(x => ({ ...x, IsRead: 1 })));
      setUnread(0);
    } catch {}
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/appointments/notifications/${id}/read`);
      setNotifs(n => n.map(x => x.Id === id ? { ...x, IsRead: 1 } : x));
      setUnread(u => Math.max(0, u - 1));
    } catch {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors">
        <Bell size={18} className="text-slate-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div>
              <h3 className="font-black text-slate-800 text-sm">Notifications</h3>
              {unread > 0 && <p className="text-xs text-slate-400">{unread} unread</p>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {loading && notifications.length === 0
              ? [...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded-full animate-pulse w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded-full animate-pulse w-1/2" />
                  </div>
                </div>
              ))
              : notifications.length === 0
                ? (
                  <div className="py-12 text-center">
                    <Bell size={28} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No notifications yet</p>
                    <p className="text-xs text-slate-300 mt-0.5">We'll notify you of important updates</p>
                  </div>
                )
                : notifications.map(n => {
                  const cfg = NOTIF_ICONS[n.NotifType] || NOTIF_ICONS.system;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.Id}
                      className={`flex gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-slate-50 ${!n.IsRead ? 'bg-indigo-50/30' : ''}`}
                      onClick={() => { if (!n.IsRead) markOneRead(n.Id); }}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.IsRead ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                          {n.Title}
                        </p>
                        {n.Body && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.Body}</p>
                        )}
                        <p className="text-[10px] text-slate-300 mt-1.5 font-semibold">{timeAgo(n.CreatedAt)}</p>
                      </div>
                      {!n.IsRead && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
            }
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-center">
              <button onClick={() => setOpen(false)}
                className="text-xs font-semibold text-indigo-600 hover:underline">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}