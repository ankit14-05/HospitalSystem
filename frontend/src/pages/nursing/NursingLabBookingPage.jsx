import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, RefreshCw, Search, AlertTriangle, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

// ── Helpers ──────────────────────────────────────────────────────────
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

/** Compute deadline from OrderDate + max TurnaroundHrs of items */
const getDeadline = (order) => {
  const items = Array.isArray(order.Items) ? order.Items : [];
  const maxHrs = items.reduce((max, it) => Math.max(max, Number(it.TurnaroundHrs) || 24), 0);
  const orderDate = new Date(order.OrderDate);
  if (isNaN(orderDate.getTime())) return null;
  return new Date(orderDate.getTime() + maxHrs * 60 * 60 * 1000);
};

/** How much time is remaining — returns { text, urgency } */
const getTimeRemaining = (deadline) => {
  if (!deadline) return { text: '—', urgency: 'normal' };
  const now = new Date();
  const diffMs = deadline - now;
  if (diffMs <= 0) return { text: 'Overdue', urgency: 'overdue' };
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hrs < 2) return { text: `${hrs}h ${mins}m left`, urgency: 'critical' };
  if (hrs < 6) return { text: `${hrs}h ${mins}m left`, urgency: 'warning' };
  return { text: `${hrs}h ${mins}m left`, urgency: 'normal' };
};

const urgencyColors = {
  overdue:  { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: 'text-red-500' },
  critical: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: 'text-orange-500' },
  warning:  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: 'text-amber-500' },
  normal:   { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: 'text-emerald-500' },
};

export default function NursingLabBookingPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomByItem, setSelectedRoomByItem] = useState({});
  const [bookingOrderId, setBookingOrderId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, roomsRes] = await Promise.all([
        api.get('/lab/orders/nurse/queue'),
        api.get('/lab/rooms'),
      ]);

      setOrders(Array.isArray(queueRes?.data) ? queueRes.data : []);
      setRooms(Array.isArray(roomsRes?.data) ? roomsRes.data : []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load nurse lab queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      String(o?.OrderNumber || '').toLowerCase().includes(q) ||
      String(o?.PatientName || '').toLowerCase().includes(q) ||
      String(o?.UHID || '').toLowerCase().includes(q),
    );
  }, [orders, search]);

  const bookOrder = async (order) => {
    const items = Array.isArray(order?.Items) ? order.Items : [];
    if (!items.length) {
      toast.error('No tests found in this order.');
      return;
    }
    const itemBookings = items.map((it) => ({
      itemId: Number(it.ItemId),
      roomId: Number(selectedRoomByItem[it.ItemId]),
    }));
    if (itemBookings.some((x) => !x.itemId || !x.roomId)) {
      toast.error('Select room for each test first.');
      return;
    }
    setBookingOrderId(order.Id);
    try {
      const now = new Date().toISOString();
      const result = await api.post(`/lab/orders/${order.Id}/nurse-book`, {
        itemBookings,
        slotAt: now,
      });
      toast.success(result?.message || 'Lab booking saved.');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Booking failed');
    } finally {
      setBookingOrderId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarClock size={20} className="text-indigo-600" /> Nurse Lab Booking
          </h1>
          <p className="page-subtitle">Book only doctor-prescribed tests after consultation.</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order, patient, UHID..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Prescribed By</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tests</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Lab Room</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const deadline = getDeadline(o);
                const remaining = getTimeRemaining(deadline);
                const uc = urgencyColors[remaining.urgency];

                return (
                  <tr key={o.Id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    {/* Order Number */}
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-bold text-indigo-600">{o.OrderNumber}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateTime(o.OrderDate)}</p>
                    </td>

                    {/* Patient */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{o.PatientName}</p>
                      <p className="text-xs text-slate-400">{o.UHID}</p>
                    </td>

                    {/* Doctor Name with specialization */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Stethoscope size={13} className="text-indigo-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 text-sm">{o.DoctorName || 'Unknown Doctor'}</p>
                          {o.DoctorSpecialization && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{o.DoctorSpecialization}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tests */}
                    <td className="px-4 py-3 text-slate-600">
                      <div className="space-y-1">
                        {(Array.isArray(o.Items) ? o.Items : []).map((it) => (
                          <div key={it.ItemId} className="text-xs text-slate-700">{it.TestName || 'Test'}</div>
                        ))}
                      </div>
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-3">
                      <div className={`inline-flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg border ${uc.bg} ${uc.border}`}>
                        <div className="flex items-center gap-1.5">
                          {remaining.urgency === 'overdue'
                            ? <AlertTriangle size={12} className={uc.icon} />
                            : <Clock size={12} className={uc.icon} />
                          }
                          <span className={`text-xs font-bold ${uc.text}`}>{remaining.text}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{deadline ? fmtDateTime(deadline) : '—'}</span>
                      </div>
                    </td>

                    {/* Lab Room dropdown */}
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {(Array.isArray(o.Items) ? o.Items : []).map((it) => {
                          const category = String(it.Category || '').toLowerCase();
                          const mappedRooms = rooms.filter((r) => {
                            const roomType = String(r.RoomType || '').toLowerCase();
                            if (!category || !roomType) return true;
                            return roomType.includes(category) || category.includes(roomType);
                          });
                          const options = mappedRooms.length ? mappedRooms : rooms;
                          return (
                            <select
                              key={it.ItemId}
                              value={selectedRoomByItem[it.ItemId] || ''}
                              onChange={(e) => setSelectedRoomByItem((prev) => ({ ...prev, [it.ItemId]: e.target.value }))}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs min-w-[180px]"
                            >
                              <option value="">Select room for {it.TestName}...</option>
                              <optgroup label="Internal Lab Rooms">
                                {options.map((r) => (
                                  <option key={`${it.ItemId}-${r.Id}`} value={r.Id}>
                                    {r.RoomNo} {r.RoomType ? `- ${r.RoomType}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="External Partners">
                                <option value="EXT-LALPATH">External - Dr Lal PathLabs</option>
                                <option value="EXT-MAXLAB">External - Max Lab</option>
                              </optgroup>
                            </select>
                          );
                        })}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => bookOrder(o)}
                        disabled={bookingOrderId === o.Id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                      >
                        <CheckCircle2 size={13} /> {bookingOrderId === o.Id ? 'Booking...' : 'Book'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No doctor-prescribed pending lab orders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
