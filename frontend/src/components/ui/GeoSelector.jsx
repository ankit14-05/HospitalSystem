// src/components/ui/GeoSelector.jsx
// Cascading Country → State → District → Pincode selector
import React, { useState, useEffect } from 'react';
import { geoAPI } from '../../services/api';
import { MapPin, Plus, AlertCircle } from 'lucide-react';

export default function GeoSelector({
  value = {},
  onChange,
  errors = {},
  showAddButtons = false,
  disabled = false,
}) {
  const [countries, setCountries] = useState([]);
  const [states, setStates]       = useState([]);
  const [districts, setDistricts] = useState([]);
  const [pincodes, setPincodes]   = useState([]);

  const [loading, setLoading] = useState({ states: false, districts: false, pincodes: false });

  // Load countries once
  useEffect(() => {
    geoAPI.countries().then(r => setCountries(r.data || [])).catch(() => {});
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!value.countryId) { setStates([]); return; }
    setLoading(l => ({ ...l, states: true }));
    geoAPI.states(value.countryId)
      .then(r => setStates(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(l => ({ ...l, states: false })));
  }, [value.countryId]);

  // Load districts when state changes
  useEffect(() => {
    if (!value.stateId) { setDistricts([]); return; }
    setLoading(l => ({ ...l, districts: true }));
    geoAPI.districts(value.stateId)
      .then(r => setDistricts(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(l => ({ ...l, districts: false })));
  }, [value.stateId]);

  // Load pincodes when district changes
  useEffect(() => {
    if (!value.districtId) { setPincodes([]); return; }
    setLoading(l => ({ ...l, pincodes: true }));
    geoAPI.pincodes(value.districtId)
      .then(r => setPincodes(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(l => ({ ...l, pincodes: false })));
  }, [value.districtId]);

  const update = (key, val, extra = {}) => {
    // Reset downstream selections
    const reset = {};
    if (key === 'countryId')  { reset.stateId = ''; reset.districtId = ''; reset.pincodeId = ''; reset.pincodeText = ''; }
    if (key === 'stateId')    { reset.districtId = ''; reset.pincodeId = ''; reset.pincodeText = ''; }
    if (key === 'districtId') { reset.pincodeId = ''; reset.pincodeText = ''; }
    onChange({ ...value, [key]: val, ...reset, ...extra });
  };

  const SelectWrapper = ({ label, children, loading: isLoading, error, action }) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="form-label mb-0">{label}</label>
        {action}
      </div>
      <div className="relative">
        {children}
        {isLoading && (
          <div className="absolute right-9 top-1/2 -translate-y-1/2">
            <div className="spinner w-4 h-4" />
          </div>
        )}
      </div>
      {error && <p className="form-error"><AlertCircle size={12} />{error}</p>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Country */}
      <SelectWrapper label="Country" error={errors.countryId}>
        <select
          className={`form-select ${errors.countryId ? 'form-input-error' : ''}`}
          value={value.countryId || ''}
          onChange={(e) => update('countryId', e.target.value ? parseInt(e.target.value) : '')}
          disabled={disabled}
        >
          <option value="">Select Country</option>
          {countries.map(c => (
            <option key={c.Id} value={c.Id}>{c.FlagEmoji} {c.Name}</option>
          ))}
        </select>
      </SelectWrapper>

      {/* State */}
      <SelectWrapper label="State" loading={loading.states} error={errors.stateId}>
        <select
          className={`form-select ${errors.stateId ? 'form-input-error' : ''}`}
          value={value.stateId || ''}
          onChange={(e) => update('stateId', e.target.value ? parseInt(e.target.value) : '')}
          disabled={disabled || !value.countryId || loading.states}
        >
          <option value="">Select State</option>
          {states.map(s => (
            <option key={s.Id} value={s.Id}>{s.Name}</option>
          ))}
        </select>
      </SelectWrapper>

      {/* District */}
      <SelectWrapper
        label="District"
        loading={loading.districts}
        error={errors.districtId}
        action={showAddButtons && value.stateId && (
          <AddDistrictButton stateId={value.stateId} onAdded={(d) => {
            setDistricts(prev => [...prev, d].sort((a,b) => a.Name.localeCompare(b.Name)));
            update('districtId', d.Id);
          }} />
        )}
      >
        <select
          className={`form-select ${errors.districtId ? 'form-input-error' : ''}`}
          value={value.districtId || ''}
          onChange={(e) => update('districtId', e.target.value ? parseInt(e.target.value) : '')}
          disabled={disabled || !value.stateId || loading.districts}
        >
          <option value="">Select District</option>
          {districts.map(d => (
            <option key={d.Id} value={d.Id}>
              {d.Name}{d.IsCustom ? ' ★' : ''}
            </option>
          ))}
        </select>
      </SelectWrapper>

      {/* Pincode */}
      <SelectWrapper
        label="Pincode"
        loading={loading.pincodes}
        error={errors.pincodeId}
        action={showAddButtons && value.districtId && (
          <AddPincodeButton districtId={value.districtId} onAdded={(p) => {
            setPincodes(prev => [...prev, p].sort((a,b) => a.Pincode.localeCompare(b.Pincode)));
            update('pincodeId', p.Id, { pincodeText: p.Pincode });
          }} />
        )}
      >
        {pincodes.length > 0 ? (
          <select
            className={`form-select ${errors.pincodeId ? 'form-input-error' : ''}`}
            value={value.pincodeId || ''}
            onChange={(e) => {
              const selected = pincodes.find(p => p.Id === parseInt(e.target.value));
              update('pincodeId', e.target.value ? parseInt(e.target.value) : '', {
                pincodeText: selected?.Pincode || '',
              });
            }}
            disabled={disabled || !value.districtId || loading.pincodes}
          >
            <option value="">Select Pincode</option>
            {pincodes.map(p => (
              <option key={p.Id} value={p.Id}>
                {p.Pincode}{p.AreaName ? ` — ${p.AreaName}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder={value.districtId ? 'Enter pincode manually' : 'Select district first'}
            value={value.pincodeText || ''}
            onChange={(e) => onChange({ ...value, pincodeText: e.target.value, pincodeId: '' })}
            className="form-input"
            disabled={disabled || !value.districtId}
            maxLength={20}
          />
        )}
      </SelectWrapper>

      {/* City */}
      <div className="sm:col-span-2">
        <label className="form-label">City</label>
        <div className="relative">
          <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="City / Town"
            value={value.city || ''}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            className="form-input pl-10"
            disabled={disabled}
            maxLength={100}
          />
        </div>
      </div>
    </div>
  );
}

// ── Inline add district modal ──────────────────────────────────────────────
function AddDistrictButton({ stateId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [hq, setHq] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await geoAPI.addDistrict({ stateId, name: name.trim(), headquarter: hq || undefined, customNote: note || undefined });
      onAdded({ Id: res.data.id, Name: name.trim(), IsCustom: true });
      setOpen(false);
      setName(''); setHq(''); setNote('');
    } catch (err) {
      setError(err.message || 'Failed to add district');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        <Plus size={12} />Add new
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-dialog w-full max-w-sm p-6 animate-slide-up">
            <h4 className="font-semibold text-slate-800 mb-4">Add New District</h4>
            <div className="space-y-3">
              <div>
                <label className="form-label">District Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="form-input" placeholder="e.g. Ratnagiri" autoFocus />
              </div>
              <div>
                <label className="form-label">Headquarter</label>
                <input value={hq} onChange={e => setHq(e.target.value)} className="form-input" placeholder="e.g. Ratnagiri" />
              </div>
              <div>
                <label className="form-label">Note / Reason</label>
                <input value={note} onChange={e => setNote(e.target.value)} className="form-input" placeholder="Why is this being added manually?" />
              </div>
              {error && <p className="form-error"><AlertCircle size={12} />{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handle} disabled={loading} className="btn-primary flex-1">
                {loading ? <><div className="spinner w-3 h-3" />Adding...</> : 'Add District'}
              </button>
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Inline add pincode modal ───────────────────────────────────────────────
function AddPincodeButton({ districtId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [pincode, setPincode] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!pincode.trim() || pincode.trim().length < 4) {
      setError('Pincode must be at least 4 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await geoAPI.addPincode({ districtId, pincode: pincode.trim(), areaName: area || undefined, city: city || undefined });
      onAdded({ Id: res.data.id, Pincode: pincode.trim(), AreaName: area, City: city, IsCustom: true });
      setOpen(false);
      setPincode(''); setArea(''); setCity('');
    } catch (err) {
      setError(err.message || 'Failed to add pincode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        <Plus size={12} />Add new
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-dialog w-full max-w-sm p-6 animate-slide-up">
            <h4 className="font-semibold text-slate-800 mb-4">Add New Pincode</h4>
            <div className="space-y-3">
              <div>
                <label className="form-label">Pincode *</label>
                <input value={pincode} onChange={e => setPincode(e.target.value)} className="form-input" placeholder="e.g. 415612" autoFocus maxLength={10} />
              </div>
              <div>
                <label className="form-label">Area Name</label>
                <input value={area} onChange={e => setArea(e.target.value)} className="form-input" placeholder="e.g. Khed" />
              </div>
              <div>
                <label className="form-label">City</label>
                <input value={city} onChange={e => setCity(e.target.value)} className="form-input" placeholder="e.g. Ratnagiri" />
              </div>
              {error && <p className="form-error"><AlertCircle size={12} />{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handle} disabled={loading} className="btn-primary flex-1">
                {loading ? <><div className="spinner w-3 h-3" />Adding...</> : 'Add Pincode'}
              </button>
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
