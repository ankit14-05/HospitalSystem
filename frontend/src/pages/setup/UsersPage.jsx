// src/pages/setup/UsersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Filter, Eye, EyeOff, AlertCircle,
  ToggleLeft, ToggleRight, X, UserPlus, Mail, Phone, Shield,
} from 'lucide-react';
import { userAPI, hospitalAPI } from '../../services/api';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';

const ROLES = [
  { value: 'admin',         label: 'Hospital Admin' },
  { value: 'doctor',        label: 'Doctor' },
  { value: 'nurse',         label: 'Nurse / Staff' },
  { value: 'receptionist',  label: 'Receptionist' },
  { value: 'pharmacist',    label: 'Pharmacist' },
  { value: 'labtech',       label: 'Lab Technician' },
  { value: 'lab_incharge',  label: 'Lab Incharge' },
  { value: 'patient',       label: 'Patient' },
  { value: 'auditor',       label: 'Auditor' },
];

const ROLE_COLORS = {
  superadmin: 'badge-purple', admin: 'badge-purple', doctor: 'badge-blue',
  nurse: 'badge-green', receptionist: 'badge-yellow', pharmacist: 'badge-blue',
  labtech: 'badge-blue', lab_incharge: 'badge-blue', patient: 'badge-gray', auditor: 'badge-gray',
};

const schema = yup.object({
  hospitalId: yup.number().required(),
  username: yup.string().trim().min(3).max(80).matches(/^\S+$/, 'No spaces allowed').required('Username required'),
  email: yup.string().email('Invalid email').nullable().transform(v => v === '' ? null : v),
  phone: yup.string().nullable().transform(v => v === '' ? null : v),
  phoneCountryCode: yup.string().default('+91'),
  password: yup.string().min(8, 'Min 8 chars')
    .matches(/[A-Z]/, 'Needs uppercase').matches(/[a-z]/, 'Needs lowercase').matches(/\d/, 'Needs number')
    .required('Password required'),
  role: yup.string().required('Role required'),
  firstName: yup.string().trim().required('First name required'),
  lastName: yup.string().trim().required('Last name required'),
  gender: yup.string().nullable(),
  departmentId: yup.number().nullable().transform(v => isNaN(v) ? null : v),
  designation: yup.string().nullable(),
});

function CreateUserModal({ onClose, onCreated, hospitalId, departments }) {
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { hospitalId, phoneCountryCode: '+91', gender: '' },
  });

  const onSubmit = async (data) => {
    try {
      const res = await userAPI.create(data);
      toast.success(`User "${res.data.Username}" created!`);
      onCreated();
      onClose();
    } catch (err) {
      if (err.errors) {
        toast.error(err.errors[0]?.msg || 'Validation failed');
      } else {
        toast.error(err.message || 'Failed to create user');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-dialog w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-primary-600" />
            <h3 className="font-semibold text-slate-800">Create New User</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1">
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="hidden" {...register('hospitalId')} />

            {/* Name */}
            <div>
              <label className="form-label">First Name *</label>
              <input {...register('firstName')} className={`form-input ${errors.firstName ? 'form-input-error' : ''}`} placeholder="John" />
              {errors.firstName && <p className="form-error"><AlertCircle size={12} />{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input {...register('lastName')} className={`form-input ${errors.lastName ? 'form-input-error' : ''}`} placeholder="Doe" />
              {errors.lastName && <p className="form-error"><AlertCircle size={12} />{errors.lastName.message}</p>}
            </div>

            {/* Username */}
            <div>
              <label className="form-label">Username *</label>
              <input {...register('username')} className={`form-input font-mono ${errors.username ? 'form-input-error' : ''}`}
                placeholder="dr.johndoe" autoComplete="off" />
              {errors.username && <p className="form-error"><AlertCircle size={12} />{errors.username.message}</p>}
            </div>

            {/* Role */}
            <div>
              <label className="form-label">Role *</label>
              <select {...register('role')} className={`form-select ${errors.role ? 'form-input-error' : ''}`}>
                <option value="">Select Role</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {errors.role && <p className="form-error"><AlertCircle size={12} />{errors.role.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="form-label">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input {...register('email')} type="email" className={`form-input pl-10 ${errors.email ? 'form-input-error' : ''}`}
                  placeholder="john@hospital.com" />
              </div>
              {errors.email && <p className="form-error"><AlertCircle size={12} />{errors.email.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="form-label">Phone</label>
              <div className="flex gap-2">
                <select {...register('phoneCountryCode')} className="form-select w-28">
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+65">🇸🇬 +65</option>
                </select>
                <div className="relative flex-1">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input {...register('phone')} type="tel" className="form-input pl-10" placeholder="98765 43210" />
                </div>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="form-label">Gender</label>
              <select {...register('gender')} className="form-select">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="PreferNot">Prefer not to say</option>
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="form-label">Department</label>
              <select {...register('departmentId')} className="form-select">
                <option value="">No Department</option>
                {departments.map(d => <option key={d.Id} value={d.Id}>{d.Name}</option>)}
              </select>
            </div>

            {/* Designation */}
            <div>
              <label className="form-label">Designation</label>
              <input {...register('designation')} className="form-input" placeholder="e.g. Senior Consultant" />
            </div>

            {/* Password */}
            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <Shield size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input {...register('password')} type={showPass ? 'text' : 'password'}
                  className={`form-input pl-10 pr-11 ${errors.password ? 'form-input-error' : ''}`}
                  placeholder="Min 8 chars with uppercase & number" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" tabIndex={-1}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="form-error"><AlertCircle size={12} />{errors.password.message}</p>}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <><div className="spinner w-4 h-4" />Creating...</> : <><UserPlus size={15} />Create User</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading]     = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [departments, setDepts]   = useState([]);
  const LIMIT = 15;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userAPI.list({
        page, limit: LIMIT, search, role: roleFilter,
        hospitalId: user?.role !== 'superadmin' ? user?.hospitalId : undefined,
      });
      setUsers(res.data);
      setTotal(res.meta?.total || 0);
    } catch {}
    setLoading(false);
  }, [page, search, roleFilter, user]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    if (!user?.hospitalId) return;
    hospitalAPI.depts(user.hospitalId)
      .then(r => setDepts(r.data || [])).catch(() => {});
  }, [user?.hospitalId]);

  const handleToggle = async (userId, currentActive) => {
    try {
      await userAPI.toggleActive(userId);
      toast.success(`User ${currentActive ? 'deactivated' : 'activated'}.`);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage staff accounts, roles and access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={15} />Add User
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="form-select w-44"
              >
                <option value="">All Roles</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="text-sm text-slate-500 flex items-center">
              {total} user{total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Department</th>
              <th>Contact</th>
              <th>Last Login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <div className="spinner w-6 h-6 mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                  No users found
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.Id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                      {u.FirstName?.[0]}{u.LastName?.[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700">{u.FirstName} {u.LastName}</div>
                      <div className="text-xs text-slate-400 font-mono">{u.Username}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${ROLE_COLORS[u.Role] || 'badge-gray'}`}>
                    {ROLE_LABELS[u.Role] || u.Role}
                  </span>
                </td>
                <td className="text-slate-500 text-sm">{u.DepartmentName || '—'}</td>
                <td>
                  <div className="text-sm text-slate-600">{u.Email || '—'}</div>
                  <div className="text-xs text-slate-400">{u.Phone || ''}</div>
                </td>
                <td className="text-xs text-slate-400">
                  {u.LastLoginAt ? new Date(u.LastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                </td>
                <td>
                  <span className={`badge ${u.IsActive ? 'badge-green' : 'badge-red'}`}>
                    {u.IsActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleToggle(u.Id, u.IsActive)}
                    title={u.IsActive ? 'Deactivate' : 'Activate'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      u.IsActive
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {u.IsActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={loadUsers}
          hospitalId={user?.hospitalId}
          departments={departments}
        />
      )}
    </div>
  );
}
