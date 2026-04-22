import React, { useState, useEffect, useCallback } from 'react';
import { Beaker, Search, RefreshCw, AlertCircle, Eye, ClipboardList } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getPayload, getPageData } from '../../utils/apiPayload';
import TestDetailsModal from '../../components/lab/TestDetailsModal';

const STATUS_COLORS = {
  Pending: 'bg-amber-100 text-amber-700',
  Collected: 'bg-blue-100 text-blue-700',
  Testing: 'bg-indigo-100 text-indigo-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Reported: 'bg-purple-100 text-purple-700',
  Rejected: 'bg-red-100 text-red-700',
};

export default function DoctorLabOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const LIMIT = 15;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterStatus) params.append('status', filterStatus);
      // Backend handles doctor filtering automatically based on role

      const res = await api.get(`/lab/orders?${params.toString()}`);
      if (res.success) {
        let items = res.orders || res.data || [];
        
        // Client-side search (if no search endpoint param exists)
        if (search) {
          const q = search.toLowerCase();
          items = items.filter(o => 
            (o.PatientName && o.PatientName.toLowerCase().includes(q)) ||
            (o.OrderNumber && o.OrderNumber.toLowerCase().includes(q)) ||
            (o.UHID && o.UHID.toLowerCase().includes(q))
          );
        }
        
        setOrders(items);
        setTotal(res.total || items.length);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to load lab orders');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Beaker size={22} className="text-teal-600" /> Patient Lab Tests
          </h1>
          <p className="page-subtitle">View status of lab tests ordered for your patients</p>
        </div>
        <button onClick={loadOrders} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search patient, order number, UHID…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white" 
          />
        </div>
        <select 
          value={filterStatus} 
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white min-w-36"
        >
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Order #</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Patient</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Test Info</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Priority</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse" style={{ width: `${60 + (j * 10) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <ClipboardList size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400 font-medium">No lab tests found</p>
                    <p className="text-slate-300 text-xs mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : orders.map(order => (
                <tr key={order.Id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-xs font-bold text-teal-600">
                    {order.OrderNumber}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">
                    {new Date(order.OrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-700">{order.PatientName}</p>
                    <p className="text-xs text-slate-400">{order.UHID}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-slate-700">{order.TestName || 'Multiple Tests'}</p>
                    {order.TestCount > 1 && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1">+{order.TestCount - 1} more</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                      order.Priority === 'Urgent' || order.Priority === 'STAT' 
                        ? 'bg-red-50 text-red-700 border-red-200' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {order.Priority || 'Routine'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.Status] || STATUS_COLORS.Pending}`}>
                      {order.Status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {order.Status === 'Completed' && (
                      <button 
                        onClick={() => setSelectedOrder({ raw: order })} 
                        className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1.5 font-medium text-xs"
                      >
                        <Eye size={16} /> View Report
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {selectedOrder && (
        <TestDetailsModal test={selectedOrder.raw} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}