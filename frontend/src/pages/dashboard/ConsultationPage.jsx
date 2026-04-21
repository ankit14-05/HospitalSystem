import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  CheckCircle,
  ChevronLeft,
  FlaskConical,
  Loader,
  Pill,
  Plus,
  Trash2,
  Search,
  Stethoscope,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getList, getPayload } from '../../utils/apiPayload';

const FREQS = ['Once daily', 'Twice daily', 'Thrice daily', 'SOS / as needed', 'Before food', 'After food', 'At bedtime'];
const ROUTES = ['Oral', 'Topical', 'Injection', 'Inhalation', 'IV', 'Other'];

const createPrescriptionItem = () => ({
  medicineName: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: '',
  route: 'Oral',
  instructions: '',
});

const normalizeTest = (test = {}) => ({
  Id: test.TestId || test.Id || test.id,
  Name: test.TestName || test.Name || test.name || '',
  Category: test.Category || test.category || '',
  Price: test.Price || test.price || null,
  TurnaroundHrs: test.TurnaroundHrs || test.turnaroundHrs || null,
  SampleType: test.SampleType || test.sampleType || '',
  RequiresFasting: Boolean(test.RequiresFasting || test.requiresFasting),
});

export default function ConsultationPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // -- Section 1: Notes & Diagnosis --
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // -- Section 2: Prescription --
  const [skipRx, setSkipRx] = useState(false);
  const [rxItems, setRxItems] = useState([createPrescriptionItem()]);

  // -- Section 3: Lab Orders --
  const [skipLab, setSkipLab] = useState(false);
  const [testCatalog, setTestCatalog] = useState([]);
  const [searchTest, setSearchTest] = useState('');
  const [selectedTests, setSelectedTests] = useState([]);
  const [labPriority, setLabPriority] = useState('Routine');
  const [labNotes, setLabNotes] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // -- Submission --
  const [saving, setSaving] = useState(false);

  // Load appointment details
  useEffect(() => {
    async function fetchDetails() {
      try {
        const payload = getPayload(await api.get(`/appointments/${appointmentId}`));
        const data = payload?.data || payload;
        setAppointment(data);
        if (data?.PrimaryDiagnosis) setDiagnosis(data.PrimaryDiagnosis);
      } catch (e) {
        toast.error('Could not load appointment details');
        navigate('/dashboard/doctor');
      } finally {
        setLoadingInitial(false);
      }
    }
    fetchDetails();
  }, [appointmentId, navigate]);

  // Load lab test catalog (debounced)
  useEffect(() => {
    let active = true;
    const loadTests = async () => {
      setLoadingCatalog(true);
      try {
        const tests = getList(await api.get('/setup/lab-tests', { params: { search: searchTest } }));
        if (active) setTestCatalog(Array.isArray(tests) ? tests.map(normalizeTest) : []);
      } catch (error) {
        if (active) setTestCatalog([]);
      } finally {
        if (active) setLoadingCatalog(false);
      }
    };

    const timeout = setTimeout(loadTests, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [searchTest]);

  // Handlers for Prescription
  const addRxItem = () => setRxItems((current) => [...current, createPrescriptionItem()]);
  const removeRxItem = (index) => setRxItems((current) => current.filter((_, i) => i !== index));
  const updateRxItem = (index, key, value) => {
    setRxItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );
  };

  // Handlers for Lab
  const addLabTest = (test) => {
    const normalized = normalizeTest(test);
    if (!normalized.Id) return;
    setSelectedTests((current) =>
      current.some((item) => String(item.Id) === String(normalized.Id))
        ? current
        : [...current, normalized]
    );
  };
  const removeLabTest = (id) => setSelectedTests((curr) => curr.filter((t) => String(t.Id) !== String(id)));

  // Master Submission
  const finishConsultation = async () => {
    if (!appointment) return;
    const patientId = appointment.PatientId || appointment.patientId;

    // Validate Rx if not skipped
    let cleanedRxItems = [];
    if (!skipRx) {
      cleanedRxItems = rxItems
        .filter((item) => item.medicineName.trim())
        .map((item) => ({
          medicineName: item.medicineName.trim(),
          dosage: item.dosage.trim() || null,
          frequency: item.frequency.trim() || null,
          duration: item.duration.trim() || null,
          quantity: item.quantity ? Number(item.quantity) : null,
          route: item.route || null,
          instructions: item.instructions.trim() || null,
        }));
      if (cleanedRxItems.length === 0) {
        toast.error('Add at least one medicine or click "Skip Prescription"');
        return;
      }
    }

    // Validate Lab if not skipped
    if (!skipLab && selectedTests.length === 0) {
      toast.error('Select at least one lab test or click "Skip Lab Tests"');
      return;
    }

    setSaving(true);
    try {
      // 1. Complete Appointment
      await api.patch(`/appointments/${appointmentId}/complete`, {
        consultationNotes: notes.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        followUpDate: followUpDate || undefined,
        followUpNotes: followUpNotes.trim() || undefined,
      });

      // 2. Issue Prescription (if not skipped)
      if (!skipRx && cleanedRxItems.length > 0) {
        await api.post('/prescriptions', {
          patientId,
          appointmentId,
          diagnosis: diagnosis.trim() || null,
          notes: notes.trim() || null,
          validUntil: followUpDate || null,
          items: cleanedRxItems,
        });
      }

      // 3. Issue Lab Orders (if not skipped)
      if (!skipLab && selectedTests.length > 0) {
        await api.post('/reports', {
          patientId,
          appointmentId: appointmentId,
          priority: labPriority,
          notes: labNotes.trim() || null,
          tests: selectedTests.map((test) => ({ testId: test.Id })),
        });
      }

      toast.success('Consultation completed successfully');
      navigate('/dashboard/doctor');
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to complete consultation');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader size={32} className="animate-spin text-emerald-600" />
          <p className="text-sm font-semibold text-slate-500">Loading consultation room...</p>
        </div>
      </div>
    );
  }

  const patientName = appointment?.PatientFullName || appointment?.PatientName || appointment?.PatientFirstName || 'Unknown Patient';
  const age = appointment?.Age || appointment?.age || '';
  const token = appointment?.TokenNumber || appointment?.Token || appointment?.token || 'N/A';

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 text-slate-900 font-sans">
      {/* Header Panel */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate('/dashboard/doctor')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 font-bold text-emerald-800 text-lg">
              {patientName.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">{patientName}</h1>
              <p className="text-sm font-medium text-slate-500">
                {age ? `${age} yrs • ` : ''}Token #{token}
              </p>
            </div>
          </div>
          <div>
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700 text-xs uppercase tracking-wider items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              In Consultation
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-6 pt-8">
        
        {/* Step 1: Clinical Notes & Diagnosis */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h2 className="flex items-center gap-2 font-black text-slate-800">
              <Stethoscope size={18} className="text-slate-400" />
              1. Clinical Notes & Diagnosis
            </h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Primary Diagnosis</label>
                <input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. URI, HTN, Gastritis"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Consultation Notes & Observations</label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Clinical findings, observations, treatment advice..."
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
              />
            </div>
          </div>
        </section>

        {/* Step 2: Prescription */}
        <section className={`overflow-hidden rounded-3xl border transition-all ${skipRx ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-teal-200 bg-white shadow-sm'}`}>
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-teal-50/30 px-6 py-4">
            <h2 className="flex items-center gap-2 font-black text-slate-800">
              <Pill size={18} className={skipRx ? 'text-slate-400' : 'text-teal-600'} />
              2. Prescription
            </h2>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 transition-colors hover:bg-slate-100">
              <input type="checkbox" checked={skipRx} onChange={(e) => setSkipRx(e.target.checked)} className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer" />
              <span className="text-sm font-semibold text-slate-600">Skip Prescription</span>
            </label>
          </div>
          
          {!skipRx && (
            <div className="p-6">
              <div className="space-y-4">
                {rxItems.map((item, index) => (
                  <div key={index} className="relative rounded-2xl border border-slate-100 bg-slate-50 p-4 pt-5 shadow-sm">
                    {rxItems.length > 1 && (
                      <button onClick={() => removeRxItem(index)} className="absolute right-3 top-3 rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div className="grid gap-4 md:grid-cols-[2fr_1fr_1.5fr] lg:grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr]">
                      <div className="lg:col-span-1">
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Medicine name</label>
                        <input value={item.medicineName} onChange={(e) => updateRxItem(index, 'medicineName', e.target.value)} placeholder="e.g. Paracetamol 500mg" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 bg-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Dosage</label>
                        <input value={item.dosage} onChange={(e) => updateRxItem(index, 'dosage', e.target.value)} placeholder="1 tablet" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 bg-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Frequency</label>
                        <select value={item.frequency} onChange={(e) => updateRxItem(index, 'frequency', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 bg-white">
                          <option value="">Select</option>
                          {FREQS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Duration</label>
                        <input value={item.duration} onChange={(e) => updateRxItem(index, 'duration', e.target.value)} placeholder="5 days" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 bg-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Qty</label>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateRxItem(index, 'quantity', e.target.value)} placeholder="10" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 bg-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Route</label>
                        <select value={item.route} onChange={(e) => updateRxItem(index, 'route', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400 bg-white">
                          {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addRxItem} className="mt-4 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-2 font-bold text-teal-700 text-sm hover:bg-teal-100 transition-colors">
                <Plus size={16} /> Add Another Medicine
              </button>
            </div>
          )}
        </section>

        {/* Step 3: Lab Orders */}
        <section className={`overflow-hidden rounded-3xl border transition-all mb-10 ${skipLab ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-indigo-200 bg-white shadow-sm'}`}>
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-indigo-50/30 px-6 py-4">
            <h2 className="flex items-center gap-2 font-black text-slate-800">
              <FlaskConical size={18} className={skipLab ? 'text-slate-400' : 'text-indigo-600'} />
              3. Lab Investigations
            </h2>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 transition-colors hover:bg-slate-100">
              <input type="checkbox" checked={skipLab} onChange={(e) => setSkipLab(e.target.checked)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-sm font-semibold text-slate-600">Skip Lab Tests</span>
            </label>
          </div>
          
          {!skipLab && (
            <div className="p-6">
              <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
                {/* Search & Select */}
                <div className="space-y-4">
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={searchTest} onChange={(e) => setSearchTest(e.target.value)} placeholder="Search test by name..." className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-4 text-sm outline-none transition focus:border-indigo-400" />
                  </div>
                  
                  <div className="h-[220px] overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-2 space-y-1">
                    {loadingCatalog ? (
                      <p className="text-center text-sm text-slate-400 py-6">Loading tests...</p>
                    ) : testCatalog.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-6">No tests found.</p>
                    ) : (
                      testCatalog.map((t) => (
                        <button key={t.Id} onClick={() => addLabTest(t)} className="flex w-full items-center justify-between rounded-xl p-2.5 text-left hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{t.Name}</p>
                            <p className="text-[11px] text-slate-400">{t.Category || 'General'}</p>
                          </div>
                          <Plus size={16} className="text-slate-300" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Selected & Settings */}
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Priority</label>
                      <select value={labPriority} onChange={(e) => setLabPriority(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400">
                        {['Routine', 'Urgent', 'STAT'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Order Notes (Optional)</label>
                    <textarea rows={2} value={labNotes} onChange={(e) => setLabNotes(e.target.value)} placeholder="Fasting instructions, etc." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Selected Tests ({selectedTests.length})
                    </p>
                    <div className="max-h-[120px] overflow-y-auto space-y-2">
                      {selectedTests.length === 0 && <p className="text-xs text-slate-400 italic">No tests selected</p>}
                      {selectedTests.map((t) => (
                        <div key={t.Id} className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
                          <span className="text-sm font-medium text-indigo-900">{t.Name}</span>
                          <button onClick={() => removeLabTest(t.Id)} className="text-indigo-400 hover:text-indigo-700 p-0.5">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-slate-500 font-medium">Verify all details before saving.</p>
          <button
            onClick={finishConsultation}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-700 hover:shadow-emerald-700/30 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {saving ? <Loader size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            Finish Consultation
          </button>
        </div>
      </div>

    </div>
  );
}
