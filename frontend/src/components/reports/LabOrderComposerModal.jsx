import React, { useEffect, useState } from 'react';
import {
  Check,
  FlaskConical,
  Loader,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getList, getPayload } from '../../utils/apiPayload';

const resolvePatientId = (patient) =>
  patient?.PatientId || patient?.patientId || patient?.Id || patient?.id || null;

const resolvePatientName = (patient) =>
  patient?.PatientFullName ||
  patient?.PatientName ||
  patient?.Name ||
  patient?.name ||
  `${patient?.PatientFirstName || patient?.firstName || ''} ${patient?.PatientLastName || patient?.lastName || ''}`.trim() ||
  'Patient';

const resolveAppointmentId = (patient, appointmentId) =>
  appointmentId || patient?.AppointmentId || patient?.appointmentId || patient?.Id || patient?.id || null;

const resolveLabOrderId = (patient, labOrderId) =>
  labOrderId || patient?.LatestLabOrderId || patient?.latestLabOrderId || null;

const normalizeTest = (test = {}) => ({
  Id: test.TestId || test.Id || test.id,
  Name: test.TestName || test.Name || test.name || '',
  Category: test.Category || test.category || '',
  Price: test.Price || test.price || null,
  TurnaroundHrs: test.TurnaroundHrs || test.turnaroundHrs || null,
  SampleType: test.SampleType || test.sampleType || '',
  RequiresFasting: Boolean(test.RequiresFasting || test.requiresFasting),
});

export default function LabOrderComposerModal({
  patient,
  appointmentId = null,
  labOrderId = null,
  initialNotes = '',
  onClose,
  onSaved,
}) {
  const patientId = resolvePatientId(patient);
  const patientName = resolvePatientName(patient);
  const linkedAppointmentId = resolveAppointmentId(patient, appointmentId);
  const existingLabOrderId = resolveLabOrderId(patient, labOrderId);

  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [priority, setPriority] = useState('Routine');
  const [notes, setNotes] = useState(initialNotes || '');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(existingLabOrderId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const timeoutId = window.setTimeout(async () => {
      setLoadingCatalog(true);
      try {
        const tests = getList(await api.get('/setup/lab-tests', { params: { search } }));
        if (active) setCatalog(Array.isArray(tests) ? tests.map(normalizeTest) : []);
      } catch (error) {
        if (active) {
          setCatalog([]);
          toast.error(error?.message || 'Could not load lab tests');
        }
      } finally {
        if (active) setLoadingCatalog(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  useEffect(() => {
    if (!existingLabOrderId) {
      setLoadingExisting(false);
      return undefined;
    }

    let active = true;

    const loadExistingOrder = async () => {
      setLoadingExisting(true);
      try {
        const payload = getPayload(await api.get(`/reports/${existingLabOrderId}`)) || {};
        const data = payload?.data || payload;

        if (!active || !data) return;

        setPriority(data.Priority || data.priority || 'Routine');
        setNotes(data.Notes || data.notes || initialNotes || '');

        const tests = Array.isArray(data.tests) ? data.tests.map(normalizeTest) : [];
        setSelectedTests(tests);
      } catch (error) {
        if (active) {
          toast.error(error?.message || 'Could not load the existing lab order');
        }
      } finally {
        if (active) setLoadingExisting(false);
      }
    };

    loadExistingOrder();

    return () => {
      active = false;
    };
  }, [existingLabOrderId, initialNotes]);

  const addTest = (test) => {
    const normalized = normalizeTest(test);
    if (!normalized.Id) return;

    setSelectedTests((current) => (
      current.some((item) => String(item.Id) === String(normalized.Id))
        ? current
        : [...current, normalized]
    ));
  };

  const removeTest = (testId) => {
    setSelectedTests((current) => current.filter((item) => String(item.Id) !== String(testId)));
  };

  const submit = async () => {
    if (!patientId) {
      toast.error('Patient information is missing for this test order');
      return;
    }

    if (!selectedTests.length) {
      toast.error('Select at least one test before saving');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/reports', {
        patientId,
        appointmentId: linkedAppointmentId,
        priority,
        notes: notes.trim() || null,
        tests: selectedTests.map((test) => ({ testId: test.Id })),
      });

      toast.success(response?.message || 'Lab order saved successfully');
      onSaved?.(response?.data || null);
    } catch (error) {
      toast.error(error?.message || 'Could not save the lab order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-cyan-50 to-white px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100">
              <FlaskConical size={18} className="text-cyan-700" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Order Lab Tests</h3>
              <p className="text-sm text-slate-500">Patient: <strong>{patientName}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-slate-100">
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5 overflow-y-auto border-r border-slate-100 px-7 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200"
                >
                  {['Routine', 'Urgent', 'Stat'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Find Tests
                </label>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="CBC, thyroid, sugar..."
                    className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-slate-50/80 p-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Order Notes
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Clinical summary, fasting instructions, panel notes, etc."
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Available Tests</p>
                  <h4 className="mt-1 text-xl font-black tracking-tight text-slate-900">Choose investigations</h4>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  {selectedTests.length} selected
                </span>
              </div>

              <div className="space-y-3">
                {loadingCatalog || loadingExisting ? (
                  <div className="flex h-48 items-center justify-center rounded-[28px] border border-slate-100 bg-white">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <Loader size={14} className="animate-spin" />
                      Loading tests...
                    </div>
                  </div>
                ) : catalog.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm font-medium text-slate-400">
                    No tests matched your search.
                  </div>
                ) : (
                  catalog.map((test) => {
                    const isSelected = selectedTests.some((item) => String(item.Id) === String(test.Id));

                    return (
                      <button
                        key={test.Id}
                        type="button"
                        onClick={() => addTest(test)}
                        className={`w-full rounded-[28px] border px-5 py-4 text-left transition-all ${
                          isSelected
                            ? 'border-cyan-200 bg-cyan-50 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-cyan-200 hover:bg-cyan-50/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{test.Name}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {test.Category || 'General'}{test.SampleType ? ` • ${test.SampleType}` : ''}{test.TurnaroundHrs ? ` • ${test.TurnaroundHrs}h TAT` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            {test.Price ? <p className="text-sm font-bold text-cyan-700">Rs. {test.Price}</p> : null}
                            {test.RequiresFasting ? (
                              <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                Fasting
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto bg-slate-50/70 px-7 py-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Selected Tests</p>
              <h4 className="mt-1 text-xl font-black tracking-tight text-slate-900">This appointment order</h4>
            </div>

            {selectedTests.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm font-medium text-slate-400">
                No tests selected yet.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedTests.map((test) => (
                  <div key={test.Id} className="rounded-[28px] border border-slate-100 bg-white px-5 py-4 shadow-[0_20px_55px_-45px_rgba(15,23,42,0.45)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{test.Name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {test.Category || 'General'}{test.SampleType ? ` • ${test.SampleType}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTest(test.Id)}
                        className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-7 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || loadingExisting}
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-800 disabled:opacity-60"
          >
            {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
            Save lab order
          </button>
        </div>
      </div>
    </div>
  );
}
