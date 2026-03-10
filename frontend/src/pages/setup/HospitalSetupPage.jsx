// src/pages/setup/HospitalSetupPage.jsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import {
  Building2, Phone, MapPin, Settings, Palette, Save,
  AlertCircle, Plus, History, RefreshCw, Globe,
} from 'lucide-react';
import { hospitalAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import GeoSelector from '../../components/ui/GeoSelector';

const schema = yup.object({
  name: yup.string().trim().min(3, 'Min 3 characters').max(300).required('Hospital name is required'),
  email: yup.string().email('Invalid email').nullable(),
  phone: yup.string().max(20).nullable(),
  gstin: yup.string()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[A-Z0-9]{1}$/, 'Invalid GSTIN')
    .nullable().transform(v => v === '' ? null : v),
  pan: yup.string()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN')
    .nullable().transform(v => v === '' ? null : v),
  website: yup.string().url('Invalid URL').nullable().transform(v => v === '' ? null : v),
  bedCapacity: yup.number().positive('Must be positive').integer().nullable().transform(v => isNaN(v) ? null : v),
  maxUsers: yup.number().positive().integer().default(50),
  planType: yup.string().oneOf(['basic','standard','enterprise']).default('standard'),
  timeFormat: yup.string().oneOf(['12h','24h']).default('12h'),
});

const TABS = [
  { id: 'identity',   label: 'Identity',   icon: Building2 },
  { id: 'contact',    label: 'Contact',    icon: Phone },
  { id: 'address',    label: 'Address',    icon: MapPin },
  { id: 'branding',   label: 'Branding',   icon: Palette },
  { id: 'config',     label: 'Config',     icon: Settings },
];

export default function HospitalSetupPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('identity');
  const [geoValue, setGeoValue] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hospital, setHospital] = useState(null);
  const [changelog, setChangelog] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      planType: 'standard',
      timeFormat: '12h',
      timezone: 'Asia/Kolkata',
      currencyCode: 'INR',
      dateFormat: 'DD/MM/YYYY',
      language: 'en',
      maxUsers: 50,
      primaryColor: '#6d28d9',
      secondaryColor: '#1d4ed8',
    },
  });

  // Load hospital data
  useEffect(() => {
    if (!user?.hospitalId) return;
    setLoading(true);
    hospitalAPI.get(user.hospitalId)
      .then(res => {
        const h = res.data;
        setHospital(h);
        reset({
          name: h.Name || '',
          shortName: h.ShortName || '',
          registrationNumber: h.RegistrationNumber || '',
          gstin: h.GSTIN || '',
          pan: h.PAN || '',
          tan: h.TAN || '',
          email: h.Email || '',
          phone: h.Phone || '',
          altPhone: h.AltPhone || '',
          website: h.Website || '',
          fax: h.Fax || '',
          emergencyNumber: h.EmergencyNumber || '',
          ambulanceNumber: h.AmbulanceNumber || '',
          street1: h.Street1 || '',
          street2: h.Street2 || '',
          bedCapacity: h.BedCapacity || '',
          establishedYear: h.EstablishedYear || '',
          accreditations: h.Accreditations || '',
          planType: h.PlanType || 'standard',
          maxUsers: h.MaxUsers || 50,
          timeFormat: h.TimeFormat || '12h',
          timezone: h.Timezone || 'Asia/Kolkata',
          currencyCode: h.CurrencyCode || 'INR',
          dateFormat: h.DateFormat || 'DD/MM/YYYY',
          language: h.Language || 'en',
          logoUrl: h.LogoUrl || '',
          primaryColor: h.PrimaryColor || '#6d28d9',
          secondaryColor: h.SecondaryColor || '#1d4ed8',
        });
        setGeoValue({
          countryId: h.CountryId || '',
          stateId: h.StateId || '',
          districtId: h.DistrictId || '',
          pincodeId: h.PincodeId || '',
          pincodeText: h.PincodeText || '',
          city: h.City || '',
        });
      })
      .catch(() => toast.error('Failed to load hospital data'))
      .finally(() => setLoading(false));
  }, [user?.hospitalId]);

  const loadLog = async () => {
    try {
      const res = await hospitalAPI.log(user.hospitalId);
      setChangelog(res.data);
      setShowLog(true);
    } catch {}
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = { ...data, ...geoValue };
      if (hospital) {
        await hospitalAPI.update(user.hospitalId, payload);
        toast.success('Hospital settings saved!');
      } else {
        await hospitalAPI.create({ ...payload, hospitalId: user.hospitalId });
        toast.success('Hospital created!');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Hospital Setup</h1>
          <p className="page-subtitle">Configure hospital identity, contact, branding and system settings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadLog} className="btn-secondary gap-2">
            <History size={15} />Change Log
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <><div className="spinner w-4 h-4" />Saving...</> : <><Save size={15} />Save Changes</>}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {hospital && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-50 border border-primary-100">
          <Building2 size={16} className="text-primary-600" />
          <span className="text-sm text-primary-700 font-medium">{hospital.Name}</span>
          <span className={`badge ${hospital.Status === 'active' ? 'badge-green' : 'badge-gray'} ml-auto`}>
            {hospital.Status}
          </span>
          <span className="badge badge-purple">{hospital.PlanType}</span>
          {hospital.Version && <span className="text-xs text-primary-500">v{hospital.Version}</span>}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={15} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* ── IDENTITY TAB ────────────────────────────────────── */}
        {activeTab === 'identity' && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h3 className="font-semibold text-slate-700">Hospital Identity</h3>
              <p className="text-xs text-slate-400">Legal name, registration, and tax information</p>
            </div>
            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="form-label">Hospital Name *</label>
                <input {...register('name')} className={`form-input ${errors.name ? 'form-input-error' : ''}`}
                  placeholder="e.g. City General Hospital" />
                {errors.name && <p className="form-error"><AlertCircle size={12} />{errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label">Short Name</label>
                <input {...register('shortName')} className="form-input" placeholder="e.g. CGH" maxLength={100} />
              </div>
              <div>
                <label className="form-label">Registration Number</label>
                <input {...register('registrationNumber')} className="form-input" placeholder="Hospital reg. no." />
              </div>
              <div>
                <label className="form-label">GSTIN</label>
                <input {...register('gstin')} className={`form-input font-mono uppercase ${errors.gstin ? 'form-input-error' : ''}`}
                  placeholder="27AABCU9603R1ZX" maxLength={15}
                  onChange={e => { e.target.value = e.target.value.toUpperCase(); }} />
                {errors.gstin && <p className="form-error"><AlertCircle size={12} />{errors.gstin.message}</p>}
              </div>
              <div>
                <label className="form-label">PAN</label>
                <input {...register('pan')} className={`form-input font-mono uppercase ${errors.pan ? 'form-input-error' : ''}`}
                  placeholder="AABCU9603R" maxLength={10}
                  onChange={e => { e.target.value = e.target.value.toUpperCase(); }} />
                {errors.pan && <p className="form-error"><AlertCircle size={12} />{errors.pan.message}</p>}
              </div>
              <div>
                <label className="form-label">TAN</label>
                <input {...register('tan')} className="form-input font-mono uppercase" placeholder="PDES03028F" maxLength={10} />
              </div>
              <div>
                <label className="form-label">Established Year</label>
                <input {...register('establishedYear')} type="number" className="form-input"
                  placeholder="e.g. 1995" min={1800} max={2100} />
              </div>
              <div>
                <label className="form-label">Bed Capacity</label>
                <input {...register('bedCapacity')} type="number" className={`form-input ${errors.bedCapacity ? 'form-input-error' : ''}`}
                  placeholder="e.g. 100" min={1} />
                {errors.bedCapacity && <p className="form-error"><AlertCircle size={12} />{errors.bedCapacity.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Accreditations</label>
                <input {...register('accreditations')} className="form-input" placeholder="NABH, JCI, ISO 9001 (comma-separated)" />
                <p className="text-xs text-slate-400 mt-1">Separate multiple accreditations with commas</p>
              </div>
            </div>
          </div>
        )}

        {/* ── CONTACT TAB ──────────────────────────────────────── */}
        {activeTab === 'contact' && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h3 className="font-semibold text-slate-700">Contact Information</h3>
            </div>
            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="form-label">Primary Email</label>
                <input {...register('email')} type="email" className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                  placeholder="hospital@example.com" />
                {errors.email && <p className="form-error"><AlertCircle size={12} />{errors.email.message}</p>}
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input {...register('phone')} type="tel" className="form-input" placeholder="+91 22 2345 6789" />
              </div>
              <div>
                <label className="form-label">Alternate Phone</label>
                <input {...register('altPhone')} type="tel" className="form-input" />
              </div>
              <div>
                <label className="form-label">Website</label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input {...register('website')} type="url" className={`form-input pl-10 ${errors.website ? 'form-input-error' : ''}`}
                    placeholder="https://www.hospital.com" />
                </div>
                {errors.website && <p className="form-error"><AlertCircle size={12} />{errors.website.message}</p>}
              </div>
              <div>
                <label className="form-label">Fax</label>
                <input {...register('fax')} className="form-input" />
              </div>
              <div>
                <label className="form-label">Emergency Number</label>
                <input {...register('emergencyNumber')} type="tel" className="form-input" placeholder="e.g. 108 / 1800-xxx" />
              </div>
              <div>
                <label className="form-label">Ambulance Number</label>
                <input {...register('ambulanceNumber')} type="tel" className="form-input" placeholder="e.g. 102" />
              </div>
            </div>
          </div>
        )}

        {/* ── ADDRESS TAB ──────────────────────────────────────── */}
        {activeTab === 'address' && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h3 className="font-semibold text-slate-700">Hospital Address</h3>
            </div>
            <div className="card-body space-y-5">
              <div>
                <label className="form-label">Address Line 1</label>
                <input {...register('street1')} className="form-input" placeholder="Building / Plot number, Street" />
              </div>
              <div>
                <label className="form-label">Address Line 2</label>
                <input {...register('street2')} className="form-input" placeholder="Landmark, Area" />
              </div>
              <GeoSelector
                value={geoValue}
                onChange={setGeoValue}
                showAddButtons={true}
              />
            </div>
          </div>
        )}

        {/* ── BRANDING TAB ─────────────────────────────────────── */}
        {activeTab === 'branding' && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h3 className="font-semibold text-slate-700">Branding & Appearance</h3>
            </div>
            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="form-label">Logo URL</label>
                <input {...register('logoUrl')} className="form-input" placeholder="https://cdn.example.com/logo.png" />
              </div>
              <div>
                <label className="form-label">Primary Color</label>
                <div className="flex gap-2">
                  <input {...register('primaryColor')} type="color"
                    className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer p-1 bg-white" />
                  <input {...register('primaryColor')} className="form-input font-mono uppercase flex-1" maxLength={7}
                    placeholder="#6d28d9" />
                </div>
              </div>
              <div>
                <label className="form-label">Secondary Color</label>
                <div className="flex gap-2">
                  <input {...register('secondaryColor')} type="color"
                    className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer p-1 bg-white" />
                  <input {...register('secondaryColor')} className="form-input font-mono uppercase flex-1" maxLength={7}
                    placeholder="#1d4ed8" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIG TAB ───────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h3 className="font-semibold text-slate-700">System Configuration</h3>
            </div>
            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="form-label">Timezone</label>
                <select {...register('timezone')} className="form-select">
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +4)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT +8)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Currency</label>
                <select {...register('currencyCode')} className="form-select">
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="SGD">SGD — Singapore Dollar</option>
                </select>
              </div>
              <div>
                <label className="form-label">Date Format</label>
                <select {...register('dateFormat')} className="form-select">
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="form-label">Time Format</label>
                <select {...register('timeFormat')} className="form-select">
                  <option value="12h">12-hour (AM/PM)</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>
              <div>
                <label className="form-label">Language</label>
                <select {...register('language')} className="form-select">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="mr">Marathi</option>
                  <option value="gu">Gujarati</option>
                </select>
              </div>
              <div>
                <label className="form-label">Plan Type</label>
                <select {...register('planType')} className="form-select">
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="form-label">Max Users</label>
                <input {...register('maxUsers')} type="number" className="form-input" min={1} />
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Change log modal */}
      {showLog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setShowLog(false)}>
          <div className="bg-white rounded-2xl shadow-dialog w-full max-w-2xl max-h-[80vh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Hospital Setup Change Log</h3>
              <button onClick={() => setShowLog(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
              {changelog.length === 0 ? (
                <p className="text-slate-400 text-sm p-6 text-center">No changes recorded yet.</p>
              ) : changelog.map((log, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className={`badge ${log.Action === 'INSERT' ? 'badge-green' : log.Action === 'DELETE' ? 'badge-red' : 'badge-blue'}`}>
                      {log.Action}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{log.TableName}</span>
                    <span className="text-xs text-slate-400 ml-auto">
                      {new Date(log.RequestedAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {log.RequestedByName && (
                    <p className="text-xs text-slate-500 mt-1">By: {log.RequestedByName}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
