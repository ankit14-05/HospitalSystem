// src/pages/admin/PeopleDirectoryPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Users, Search, Filter, Mail, Phone, Building2, UserCircle2, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import _debounce from 'lodash/debounce';

export default function PeopleDirectoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({ patients: 0, doctors: 0, staff: 0 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadDirectory = async (cat, term, pg) => {
    setLoading(true);
    try {
      const resp = await api.get('/dashboard/admin/people', {
        params: { category: cat, search: term, page: pg, limit: 15 }
      });
      const payload = resp.data || resp;
      setData(payload.data || []);
      setTotals(payload.totals || { patients: 0, doctors: 0, staff: 0 });
      setTotalPages(payload.pagination?.totalPages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load people directory');
    } finally {
      setLoading(false);
    }
  };

  const debouncedLoad = useCallback(_debounce(loadDirectory, 300), []);

  useEffect(() => {
    debouncedLoad(category, search, page);
    return () => debouncedLoad.cancel();
  }, [category, search, page, debouncedLoad]);

  const TABS = [
    { id: 'all', label: 'All Users', count: totals.patients + totals.doctors + totals.staff },
    { id: 'patient', label: 'Patients', count: totals.patients },
    { id: 'doctor', label: 'Doctors', count: totals.doctors },
    { id: 'staff', label: 'Staff members', count: totals.staff }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">People Directory</h1>
          <p className="page-subtitle">A unified view of all patients, doctors, and staff members across the system.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex bg-slate-100/50 p-1 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setCategory(tab.id); setPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  category === tab.id 
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  category === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, ID, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">User</th>
                <th className="px-6 py-4 font-bold">Contact</th>
                <th className="px-6 py-4 font-bold">Role / Dept</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan="4" className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse"></div>
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-slate-100 rounded animate-pulse w-1/4"></div>
                          <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3"></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400 text-sm">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                data.map(person => (
                  <tr key={`${person.Category}-${person.ProfileId}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm
                          ${person.Category === 'patient' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            person.Category === 'doctor' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            'bg-amber-50 text-amber-600 border border-amber-100'}`}
                        >
                          {(person.FirstName?.[0] || '?')}{(person.LastName?.[0] || '')}
                        </div>
                        <div className="flex flex-col">
                          <p 
                            className={`text-sm font-bold text-slate-800 transition-colors ${person.Category === 'patient' ? 'cursor-pointer hover:text-indigo-600' : ''}`}
                            onClick={() => person.Category === 'patient' && navigate(`/patient/emr/${person.ProfileId}`)}
                          >
                            {person.FullName}
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{person.Identifier}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Mail size={12} className="text-slate-400" />
                          <span className="truncate">{person.Email || 'No email provided'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Phone size={12} className="text-slate-400" />
                          <span>{person.Phone || 'No phone provided'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-700">{person.RoleLabel}</p>
                      {person.DepartmentName && (
                        <p className="text-xs text-slate-500 mt-0.5">{person.DepartmentName}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                          ${person.IsActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {person.IsActive ? 'Active' : 'Inactive'}
                        </span>
                        {person.ApprovalStatus && person.ApprovalStatus !== 'active' && (
                          <span className={`text-[10px] font-semibold
                            ${person.ApprovalStatus === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {person.ApprovalStatus} verification
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {person.Category === 'patient' && (
                        <button
                          onClick={() => navigate(`/patient/emr/${person.ProfileId}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                        >
                          View EMR <ArrowRight size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
