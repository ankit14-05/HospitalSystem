import React, { useState } from 'react';
import { CalendarDays, CheckCircle, Loader, Stethoscope, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PrescriptionComposerModal from '../prescriptions/PrescriptionComposerModal';
import LabOrderComposerModal from '../reports/LabOrderComposerModal';

const POST_COMPLETE_ACTIONS = [
  { key: 'prescription', label: 'Prescription', helper: 'Finish the visit with medicines and follow-up advice.' },
  { key: 'tests', label: 'Tests', helper: 'Complete and immediately place investigations only.' },
  { key: 'both', label: 'Both', helper: 'Save the consultation, then issue both prescription and tests.' },
  { key: 'none', label: 'None', helper: 'Only mark the appointment completed for now.' },
];

const resolveAppointmentId = (appointment) =>
  appointment?.AppointmentId || appointment?.Id || appointment?.id || null;

const resolvePatientName = (appointment) =>
  appointment?.PatientFullName ||
  appointment?.PatientName ||
  appointment?.Name ||
  `${appointment?.PatientFirstName || ''} ${appointment?.PatientLastName || ''}`.trim() ||
  'Patient';

export default function CompleteAppointmentModal({
  appointment,
  onClose,
  onCompleted,
}) {
  const appointmentId = resolveAppointmentId(appointment);
  const patientName = resolvePatientName(appointment);

  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState(appointment?.PrimaryDiagnosis || '');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [postCompleteAction, setPostCompleteAction] = useState('prescription');
  const [showPrescriptionComposer, setShowPrescriptionComposer] = useState(false);
  const [showLabOrderComposer, setShowLabOrderComposer] = useState(false);

  const finishFlow = () => {
    onCompleted?.();
    onClose?.();
  };

  const launchNextStep = () => {
    if (postCompleteAction === 'prescription') {
      setShowPrescriptionComposer(true);
      return;
    }
    if (postCompleteAction === 'tests') {
      setShowLabOrderComposer(true);
      return;
    }
    if (postCompleteAction === 'both') {
      setShowPrescriptionComposer(true);
      return;
    }
    finishFlow();
  };

  const handleComplete = async () => {
    if (!appointmentId) {
      toast.error('Appointment information is missing');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/appointments/${appointmentId}/complete`, {
        consultationNotes: notes.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        followUpDate: followUpDate || undefined,
        followUpNotes: followUpNotes.trim() || undefined,
      });

      toast.success('Appointment marked as completed');
      launchNextStep();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not complete appointment');
    } finally {
      setSaving(false);
    }
  };

  const handlePrescriptionSaved = () => {
    if (postCompleteAction === 'both') {
      setShowPrescriptionComposer(false);
      setShowLabOrderComposer(true);
      return;
    }

    finishFlow();
  };

  if (showPrescriptionComposer) {
    return (
      <PrescriptionComposerModal
        patient={appointment}
        appointmentId={appointmentId}
        initialDiagnosis={diagnosis}
        initialNotes={notes}
        initialValidUntil={followUpDate}
        onClose={finishFlow}
        onSaved={handlePrescriptionSaved}
      />
    );
  }

  if (showLabOrderComposer) {
    return (
      <LabOrderComposerModal
        patient={appointment}
        appointmentId={appointmentId}
        initialNotes={followUpNotes || notes}
        onClose={finishFlow}
        onSaved={finishFlow}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-slate-900">Complete consultation</h3>
                <p className="text-sm text-slate-500">
                  Patient: <strong>{patientName}</strong>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-white">
              <X size={15} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Primary Diagnosis
              </label>
              <input
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                placeholder="e.g. viral fever, gastritis, hypertension"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Follow-up Date
              </label>
              <div className="relative">
                <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={followUpDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setFollowUpDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <label className="mb-1.5 mt-4 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Follow-up Notes
              </label>
              <input
                value={followUpNotes}
                onChange={(event) => setFollowUpNotes(event.target.value)}
                placeholder="Review in 7 days, repeat tests, etc."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              <Stethoscope size={13} />
              Consultation Notes
            </label>
            <textarea
              rows={5}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Clinical findings, observations, treatment advice, red flags, or discharge instructions."
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5">
            <label className="mb-3 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              After Completion
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {POST_COMPLETE_ACTIONS.map((option) => {
                const isSelected = postCompleteAction === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPostCompleteAction(option.key)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                      isSelected
                        ? 'border-emerald-200 bg-emerald-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-800">{option.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{option.helper}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 shadow-lg shadow-emerald-200"
          >
            {saving ? (
              <Loader size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
            {postCompleteAction === 'prescription' ? 'Save & Write Prescription' :
             postCompleteAction === 'tests' ? 'Save & Order Tests' :
             postCompleteAction === 'both' ? 'Save & Issue Rx/Tests' :
             'Mark as Completed'}
          </button>
        </div>
      </div>
    </div>
  );
}
