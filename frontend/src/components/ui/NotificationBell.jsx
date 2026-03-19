import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCheck,
  Clock,
  FlaskConical,
  Info,
  Pill,
  Receipt,
} from 'lucide-react';
import api from '../../services/api';

const NOTIF_ICONS = {
  appointment: { icon: Calendar, color: 'bg-indigo-100 text-indigo-600' },
  lab_result: { icon: FlaskConical, color: 'bg-purple-100 text-purple-600' },
  prescription: { icon: Pill, color: 'bg-emerald-100 text-emerald-600' },
  billing: { icon: Receipt, color: 'bg-orange-100 text-orange-600' },
  alert: { icon: AlertCircle, color: 'bg-red-100 text-red-600' },
  reminder: { icon: Clock, color: 'bg-amber-100 text-amber-600' },
  system: { icon: Info, color: 'bg-slate-100 text-slate-600' },
};

const timeAgo = (dateStr) => {
  const value = new Date(dateStr);
  if (Number.isNaN(value.getTime())) return 'Just now';

  const diff = Date.now() - value.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/appointments/notifications', { params: { limit: 15 } });
      const payload = response?.data || response;
      setNotifications(payload?.data || []);
      setUnread(payload?.unread || 0);
    } catch {
      setNotifications([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handleFocus = () => load();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/appointments/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, IsRead: 1 })));
      setUnread(0);
    } catch {}
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/appointments/notifications/${id}/read`);
      setNotifications((current) =>
        current.map((item) => (item.Id === id ? { ...item, IsRead: 1 } : item))
      );
      setUnread((current) => Math.max(0, current - 1));
    } catch {}
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.IsRead) {
      await markOneRead(notification.Id);
    }

    if (notification.Link) {
      navigate(notification.Link);
    }

    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) load();
        }}
        className="relative w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all hover:shadow-sm"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div>
              <h3 className="font-black text-slate-800 text-sm">Notifications</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </p>
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {loading && notifications.length === 0 ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-3 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded-full animate-pulse w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded-full animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={28} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm text-slate-400 font-medium">No notifications yet</p>
                <p className="text-xs text-slate-300 mt-0.5">We&apos;ll show live updates here.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = NOTIF_ICONS[notification.NotifType] || NOTIF_ICONS.system;
                const Icon = config.icon;

                return (
                  <div
                    key={notification.Id}
                    className={`flex gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-slate-50 ${
                      !notification.IsRead ? 'bg-indigo-50/30' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          !notification.IsRead
                            ? 'font-bold text-slate-800'
                            : 'font-medium text-slate-600'
                        }`}
                      >
                        {notification.Title}
                      </p>
                      {notification.Body && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {notification.Body}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-300 mt-1.5 font-semibold">
                        {timeAgo(notification.CreatedAt)}
                      </p>
                    </div>
                    {!notification.IsRead && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-center">
            <button
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
