import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  Loader,
  Plus,
  Pill,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getPayload } from '../../utils/apiPayload';

const FREQS = ['Once daily', 'Twice daily', 'Thrice daily', 'SOS / as needed', 'Before food', 'After food', 'At bedtime'];
const ROUTES = ['Oral', 'Topical', 'Injection', 'Inhalation', 'IV', 'Other'];

const createItem = () => ({
  medicineName: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: '',
  route: 'Oral',
  instructions: '',
});

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

const resolvePrescriptionId = (patient, prescriptionId) =>
  prescriptionId || patient?.LatestPrescriptionId || patient?.latestPrescriptionId || null;

const mapPrescriptionItem = (item = {}) => ({
  medicineName: item.MedicineName || item.medicineName || '',
  dosage: item.Dosage || item.dosage || '',
  frequency: item.Frequency || item.frequency || '',
  duration: item.Duration || item.duration || '',
  quantity: item.Quantity || item.quantity || '',
  route: item.Route || item.route || 'Oral',
  instructions: item.Instructions || item.instructions || '',
});

export default function PrescriptionComposerModal({
  patient,
  appointmentId = null,
  prescriptionId = null,
  initialDiagnosis = '',
  initialNotes = '',
  initialValidUntil = '',
  onClose,
  onSaved,
}) {
  const patientId = resolvePatientId(patient);
  const patientName = resolvePatientName(patient);
  const linkedAppointmentId = resolveAppointmentId(patient, appointmentId);
  const existingPrescriptionId = resolvePrescriptionId(patient, prescriptionId);

  const [diagnosis, setDiagnosis] = useState(initialDiagnosis || '');
  const [notes, setNotes] = useState(initialNotes || '');
  const [validUntil, setValidUntil] = useState(initialValidUntil || '');
  const [items, setItems] = useState([createItem()]);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(existingPrescriptionId));

  useEffect(() => {
    if (!existingPrescriptionId) {
      setLoadingExisting(false);
      return undefined;
    }

    let active = true;

    const loadExistingPrescription = async () => {
      setLoadingExisting(true);
      try {
        const payload = getPayload(await api.get(`/prescriptions/${existingPrescriptionId}`)) || {};
        const data = payload?.data || payload;

        if (!active || !data) return;

        setDiagnosis(data.Diagnosis || data.diagnosis || initialDiagnosis || '');
        setNotes(data.Notes || data.notes || initialNotes || '');
        setValidUntil((data.ValidUntil || data.validUntil || '').slice(0, 10));

        const existingItems = Array.isArray(data.items)
          ? data.items.map(mapPrescriptionItem)
          : [];
        setItems(existingItems.length ? existingItems : [createItem()]);
      } catch (error) {
        if (active) {
          toast.error(error?.message || 'Could not load the existing prescription');
        }
      } finally {
        if (active) setLoadingExisting(false);
      }
    };

    loadExistingPrescription();

    return () => {
      active = false;
    };
  }, [existingPrescriptionId, initialDiagnosis, initialNotes]);

  const updateItem = (index, key, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  };

  const addItem = () => setItems((current) => [...current, createItem()]);
  const removeItem = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const submit = async () => {
    if (!patientId) {
      toast.error('Patient information is missing for this prescription');
      return;
    }

    const cleanedItems = items
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

    if (!cleanedItems.length) {
      toast.error('Add at least one medicine before issuing the prescription');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/prescriptions', {
        patientId,
        appointmentId: linkedAppointmentId,
        diagnosis: diagnosis.trim() || null,
        notes: notes.trim() || null,
        validUntil: validUntil || null,
        items: cleanedItems,
      });

      toast.success(response?.message || 'Prescription saved successfully');
      onSaved?.(response?.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not save prescription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100">
              <Pill size={18} className="text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Issue Prescription</h3>
              <p className="text-sm text-slate-500">Patient: <strong>{patientName}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-slate-100">
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
          {loadingExisting ? (
            <div className="flex h-48 items-center justify-center rounded-[28px] border border-slate-100 bg-slate-50">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Loader size={14} className="animate-spin" />
                Loading prescription...
              </div>
            </div>
          ) : (
            <>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Diagnosis
              </label>
              <textarea
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                rows={3}
                placeholder="Primary diagnosis or clinical impression"
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
              />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Valid Until
              </label>
              <div className="relative">
                <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={validUntil}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setValidUntil(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                />
              </div>
              <label className="mb-1.5 mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="General instructions, investigations advised, diet notes, etc."
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Medicines</p>
              <h4 className="mt-1 text-xl font-black tracking-tight text-slate-900">Medication plan</h4>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700 transition-colors hover:bg-teal-100"
            >
              <Plus size={14} />
              Add medicine
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_22px_60px_-45px_rgba(15,23,42,0.45)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Medicine {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Dose and timing details</p>
                  </div>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Medicine name</label>
                    <input
                      value={item.medicineName}
                      onChange={(event) => updateItem(index, 'medicineName', event.target.value)}
                      placeholder="e.g. Amoxicillin 500mg"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Dosage</label>
                    <input
                      value={item.dosage}
                      onChange={(event) => updateItem(index, 'dosage', event.target.value)}
                      placeholder="1 tablet"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Frequency</label>
                    <select
                      value={item.frequency}
                      onChange={(event) => updateItem(index, 'frequency', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                    >
                      <option value="">Select frequency</option>
                      {FREQS.map((freq) => <option key={freq} value={freq}>{freq}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Duration</label>
                    <input
                      value={item.duration}
                      onChange={(event) => updateItem(index, 'duration', event.target.value)}
                      placeholder="5 days"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                      placeholder="10"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Route</label>
                    <select
                      value={item.route}
                      onChange={(event) => updateItem(index, 'route', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                    >
                      {ROUTES.map((route) => <option key={route} value={route}>{route}</option>)}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Instructions</label>
                    <textarea
                      value={item.instructions}
                      onChange={(event) => updateItem(index, 'instructions', event.target.value)}
                      rows={2}
                      placeholder="Before meals, after food, review after 3 days, etc."
                      className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-200"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
            </>
          )}
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
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
            Save prescription
          </button>
        </div>
      </div>
    </div>
  );
}
