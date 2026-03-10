// src/pages/setup/GeoSetupPage.jsx
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { MapPin, ChevronRight, Search, Plus, Star, Globe } from 'lucide-react';
import { geoAPI } from '../../services/api';

export default function GeoSetupPage() {
  const [countries, setCountries] = useState([]);
  const [states, setStates]       = useState([]);
  const [districts, setDistricts] = useState([]);
  const [pincodes, setPincodes]   = useState([]);

  const [selCountry, setSelCountry]     = useState('');
  const [selState, setSelState]         = useState('');
  const [selDistrict, setSelDistrict]   = useState('');
  const [loading, setLoading]           = useState({ states: false, districts: false, pincodes: false });

  const [searchPin, setSearchPin]   = useState('');
  const [pinResults, setPinResults] = useState([]);
  const [searching, setSearching]   = useState(false);

  const [addDistrict, setAddDistrict] = useState({ name: '', hq: '', note: '', saving: false });
  const [addPincode, setAddPincode]   = useState({ pincode: '', area: '', city: '', saving: false });

  useEffect(() => {
    geoAPI.countries().then(r => setCountries(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selCountry) { setStates([]); setSelState(''); return; }
    setLoading(l => ({ ...l, states: true }));
    geoAPI.states(selCountry)
      .then(r => setStates(r.data || []))
      .finally(() => setLoading(l => ({ ...l, states: false })));
  }, [selCountry]);

  useEffect(() => {
    if (!selState) { setDistricts([]); setSelDistrict(''); return; }
    setLoading(l => ({ ...l, districts: true }));
    geoAPI.districts(selState)
      .then(r => setDistricts(r.data || []))
      .finally(() => setLoading(l => ({ ...l, districts: false })));
  }, [selState]);

  useEffect(() => {
    if (!selDistrict) { setPincodes([]); return; }
    setLoading(l => ({ ...l, pincodes: true }));
    geoAPI.pincodes(selDistrict)
      .then(r => setPincodes(r.data || []))
      .finally(() => setLoading(l => ({ ...l, pincodes: false })));
  }, [selDistrict]);

  const searchPincode = async () => {
    if (searchPin.trim().length < 3) { toast.error('Enter at least 3 digits'); return; }
    setSearching(true);
    try {
      const r = await geoAPI.searchPincode(searchPin.trim());
      setPinResults(r.data || []);
      if (!r.data?.length) toast('No results found', { icon: '🔍' });
    } catch {}
    setSearching(false);
  };

  const handleAddDistrict = async () => {
    if (!selState) { toast.error('Select a state first'); return; }
    if (!addDistrict.name.trim() || addDistrict.name.trim().length < 2) {
      toast.error('District name must be at least 2 characters'); return;
    }
    setAddDistrict(a => ({ ...a, saving: true }));
    try {
      const res = await geoAPI.addDistrict({
        stateId: selState,
        name: addDistrict.name.trim(),
        headquarter: addDistrict.hq || undefined,
        customNote: addDistrict.note || undefined,
      });
      toast.success('Custom district added!');
      setDistricts(d => [...d, { Id: res.data.id, Name: addDistrict.name.trim(), IsCustom: true }]
        .sort((a, b) => a.Name.localeCompare(b.Name)));
      setAddDistrict({ name: '', hq: '', note: '', saving: false });
    } catch (err) {
      toast.error(err.message || 'Failed to add district');
      setAddDistrict(a => ({ ...a, saving: false }));
    }
  };

  const handleAddPincode = async () => {
    if (!selDistrict) { toast.error('Select a district first'); return; }
    if (!addPincode.pincode.trim() || addPincode.pincode.trim().length < 4) {
      toast.error('Pincode must be at least 4 characters'); return;
    }
    setAddPincode(a => ({ ...a, saving: true }));
    try {
      const res = await geoAPI.addPincode({
        districtId: selDistrict,
        pincode: addPincode.pincode.trim(),
        areaName: addPincode.area || undefined,
        city: addPincode.city || undefined,
      });
      toast.success('Custom pincode added!');
      setPincodes(p => [...p, { Id: res.data.id, Pincode: addPincode.pincode.trim(), AreaName: addPincode.area, City: addPincode.city, IsCustom: true }]
        .sort((a, b) => a.Pincode.localeCompare(b.Pincode)));
      setAddPincode({ pincode: '', area: '', city: '', saving: false });
    } catch (err) {
      toast.error(err.message || 'Failed to add pincode');
      setAddPincode(a => ({ ...a, saving: false }));
    }
  };

  const selectedDistrictName = districts.find(d => d.Id === parseInt(selDistrict))?.Name;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Geography Setup</h1>
        <p className="page-subtitle">Browse countries, states, districts and pincodes. Add custom entries when needed.</p>
      </div>

      {/* Pincode search */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Search size={16} />Pincode Quick Search
          </h3>
        </div>
        <div className="card-body">
          <div className="flex gap-3 max-w-md">
            <input
              value={searchPin}
              onChange={e => setSearchPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPincode()}
              className="form-input flex-1"
              placeholder="Enter pincode prefix, e.g. 411"
              maxLength={10}
            />
            <button onClick={searchPincode} disabled={searching} className="btn-primary">
              {searching ? <div className="spinner w-4 h-4" /> : <Search size={15} />}
              Search
            </button>
          </div>
          {pinResults.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {pinResults.map(p => (
                <div key={p.Id} className="flex items-start gap-2 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <MapPin size={13} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-mono font-bold text-slate-700 text-sm">{p.Pincode}</div>
                    <div className="text-xs text-slate-600">{p.AreaName && `${p.AreaName}, `}{p.City}</div>
                    <div className="text-xs text-slate-400">{p.District}, {p.State}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Browse hierarchy */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Globe size={16} />Browse Hierarchy
            </h3>
          </div>
          <div className="card-body space-y-4">
            {/* Country */}
            <div>
              <label className="form-label">Country</label>
              <select className="form-select" value={selCountry}
                onChange={e => { setSelCountry(e.target.value); setSelState(''); setSelDistrict(''); setPinResults([]); }}>
                <option value="">Select Country</option>
                {countries.map(c => <option key={c.Id} value={c.Id}>{c.FlagEmoji} {c.Name}</option>)}
              </select>
            </div>

            {/* State */}
            <div>
              <label className="form-label">
                State {loading.states && <span className="text-slate-400 text-xs ml-1">loading...</span>}
              </label>
              <select className="form-select" value={selState}
                onChange={e => { setSelState(e.target.value); setSelDistrict(''); }}
                disabled={!selCountry || loading.states}>
                <option value="">Select State</option>
                {states.map(s => <option key={s.Id} value={s.Id}>{s.Name} {s.Code && `(${s.Code})`}</option>)}
              </select>
              {selState && <p className="text-xs text-slate-400 mt-1">{states.length} states available</p>}
            </div>

            {/* District list */}
            {selState && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">
                    Districts
                    {loading.districts
                      ? <span className="text-slate-400 text-xs ml-1">loading...</span>
                      : <span className="text-slate-400 text-xs ml-1">({districts.length})</span>
                    }
                  </label>
                  <span className="text-xs text-yellow-600 flex items-center gap-1">
                    <Star size={10} fill="currentColor" /> = custom
                  </span>
                </div>
                {loading.districts ? (
                  <div className="flex justify-center py-4"><div className="spinner w-5 h-5" /></div>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                    {districts.length === 0 && (
                      <p className="text-xs text-slate-400 px-3 py-3">No districts found</p>
                    )}
                    {districts.map(d => (
                      <button
                        key={d.Id}
                        onClick={() => setSelDistrict(String(d.Id))}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors text-left
                          ${selDistrict === String(d.Id) ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-700'}`}
                      >
                        <span className="flex items-center gap-2">
                          {d.IsCustom && <Star size={10} className="text-yellow-500 flex-shrink-0" fill="currentColor" />}
                          {d.Name}
                          {d.Headquarter && <span className="text-xs text-slate-400 font-normal">({d.Headquarter})</span>}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pincode list */}
            {selDistrict && (
              <div>
                <label className="form-label mb-2">
                  Pincodes in {selectedDistrictName}
                  {!loading.pincodes && <span className="text-slate-400 text-xs ml-1">({pincodes.length})</span>}
                </label>
                {loading.pincodes ? (
                  <div className="flex justify-center py-4"><div className="spinner w-5 h-5" /></div>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                    {pincodes.length === 0 && (
                      <p className="text-xs text-slate-400 px-3 py-3">No pincodes found. Add one →</p>
                    )}
                    {pincodes.map(p => (
                      <div key={p.Id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                        <span className="font-mono text-sm font-bold text-slate-700 w-16 flex-shrink-0">{p.Pincode}</span>
                        {p.IsCustom && <Star size={10} className="text-yellow-500 flex-shrink-0" fill="currentColor" />}
                        <span className="text-xs text-slate-500 truncate">
                          {[p.AreaName, p.City].filter(Boolean).join(' — ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Add custom entries */}
        <div className="space-y-4">
          {/* Add District */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Plus size={16} />Add Custom District
              </h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" />
                <p className="text-xs text-amber-700">
                  Custom districts are flagged with ★ and logged to the setup change log.
                  Select a <strong>state</strong> in the left panel before adding.
                </p>
              </div>

              <div>
                <label className="form-label">District Name <span className="text-danger-500">*</span></label>
                <input
                  value={addDistrict.name}
                  onChange={e => setAddDistrict(a => ({ ...a, name: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. Ratnagiri"
                  disabled={!selState}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="form-label">Headquarter City</label>
                <input
                  value={addDistrict.hq}
                  onChange={e => setAddDistrict(a => ({ ...a, hq: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. Ratnagiri city"
                  disabled={!selState}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="form-label">Reason / Note</label>
                <input
                  value={addDistrict.note}
                  onChange={e => setAddDistrict(a => ({ ...a, note: e.target.value }))}
                  className="form-input"
                  placeholder="Why is this being added manually?"
                  disabled={!selState}
                  maxLength={500}
                />
              </div>

              {!selState && (
                <p className="text-xs text-slate-400 text-center py-1">← Select a country & state first</p>
              )}

              <button
                onClick={handleAddDistrict}
                disabled={addDistrict.saving || !selState}
                className="btn-primary w-full"
              >
                {addDistrict.saving
                  ? <><div className="spinner w-4 h-4" />Adding District...</>
                  : <><Plus size={15} />Add District</>
                }
              </button>
            </div>
          </div>

          {/* Add Pincode */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Plus size={16} />Add Custom Pincode
              </h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" />
                <p className="text-xs text-amber-700">
                  Select a <strong>district</strong> from the left panel, then add its pincode here.
                </p>
              </div>

              <div>
                <label className="form-label">Pincode <span className="text-danger-500">*</span></label>
                <input
                  value={addPincode.pincode}
                  onChange={e => setAddPincode(a => ({ ...a, pincode: e.target.value.replace(/\D/g, '') }))}
                  className="form-input font-mono tracking-widest"
                  placeholder="e.g. 415612"
                  disabled={!selDistrict}
                  maxLength={10}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Area Name</label>
                  <input
                    value={addPincode.area}
                    onChange={e => setAddPincode(a => ({ ...a, area: e.target.value }))}
                    className="form-input"
                    placeholder="e.g. Khed"
                    disabled={!selDistrict}
                    maxLength={150}
                  />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input
                    value={addPincode.city}
                    onChange={e => setAddPincode(a => ({ ...a, city: e.target.value }))}
                    className="form-input"
                    placeholder="e.g. Ratnagiri"
                    disabled={!selDistrict}
                    maxLength={100}
                  />
                </div>
              </div>

              {!selDistrict && (
                <p className="text-xs text-slate-400 text-center py-1">← Select a district first</p>
              )}

              <button
                onClick={handleAddPincode}
                disabled={addPincode.saving || !selDistrict}
                className="btn-primary w-full"
              >
                {addPincode.saving
                  ? <><div className="spinner w-4 h-4" />Adding Pincode...</>
                  : <><Plus size={15} />Add Pincode</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
