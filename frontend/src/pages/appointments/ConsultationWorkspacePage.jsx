import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, User, Phone, Hash,
  AlertTriangle, FileText, Stethoscope, ClipboardList,
  History, Microscope, Plus, Trash2, CalendarDays,
  CheckCircle, Loader, Save, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getPayload } from '../../utils/apiPayload';
import './ConsultationWorkspacePage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const createLabTestItem = () => ({
  localId: Math.random().toString(36).substr(2, 9),
  testName: '',
  criteria: '',
  details: '',
});

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '—';
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return '—';
  const h = Number(match[1]);
  const m = match[2];
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

const calcAge = (dob) => {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '—';
  const ageDiff = Date.now() - birth.getTime();
  return `${Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000))} yrs`;
};

const AUTOSAVE_KEY = (id) => `cw-draft-${id}`;

// ═══════════════════════════════════════════════════════════════════════════════
export default function ConsultationWorkspacePage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  // Appointment data
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Clinical form
  const [allergy, setAllergy] = useState('');
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [historyPresentIllness, setHistoryPresentIllness] = useState('');
  const [pastHistory, setPastHistory] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [procedure, setProcedure] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  // Lab tests
  const [labTests, setLabTests] = useState([createLabTestItem()]);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const autosaveTimer = useRef(null);

  // ── Load appointment data ──────────────────────────────────────────────────
  const loadAppointment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/appointments/${appointmentId}`);
      const data = getPayload(res) || res;
      setAppointment(data);

      // Restore autosaved draft if present
      try {
        const savedDraft = localStorage.getItem(AUTOSAVE_KEY(appointmentId));
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          if (draft.allergy) setAllergy(draft.allergy);
          if (draft.chiefComplaints) setChiefComplaints(draft.chiefComplaints);
          if (draft.historyPresentIllness) setHistoryPresentIllness(draft.historyPresentIllness);
          if (draft.pastHistory) setPastHistory(draft.pastHistory);
          if (draft.clinicalNotes) setClinicalNotes(draft.clinicalNotes);
          if (draft.procedure) setProcedure(draft.procedure);
          if (draft.diagnosis) setDiagnosis(draft.diagnosis);
          if (draft.followUpDate) setFollowUpDate(draft.followUpDate);
          if (draft.followUpNotes) setFollowUpNotes(draft.followUpNotes);
          if (Array.isArray(draft.labTests) && draft.labTests.length) setLabTests(draft.labTests);
          toast.success('Restored your autosaved draft', { duration: 2000 });
        }
      } catch { /* ignore corrupt local storage */ }
    } catch (err) {
      setError(err?.message || 'Failed to load appointment');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => { loadAppointment(); }, [loadAppointment]);

  // ── Autosave to localStorage every 15s ─────────────────────────────────────
  useEffect(() => {
    if (autosaveTimer.current) clearInterval(autosaveTimer.current);

    autosaveTimer.current = setInterval(() => {
      const draft = {
        allergy, chiefComplaints, historyPresentIllness, pastHistory,
        clinicalNotes, procedure, diagnosis, followUpDate, followUpNotes, labTests,
      };
      const hasContent = Object.values(draft).some(v =>
        typeof v === 'string' ? v.trim() : (Array.isArray(v) && v.some(t => t.testName))
      );
      if (hasContent) {
        localStorage.setItem(AUTOSAVE_KEY(appointmentId), JSON.stringify(draft));
      }
    }, 15000);

    return () => clearInterval(autosaveTimer.current);
  }, [allergy, chiefComplaints, historyPresentIllness, pastHistory,
      clinicalNotes, procedure, diagnosis, followUpDate, followUpNotes, labTests, appointmentId]);

  // ── Warn on browser close ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Lab test handlers ──────────────────────────────────────────────────────
  const addLabTest = () => setLabTests(prev => [...prev, createLabTestItem()]);

  const removeLabTest = (localId) => {
    setLabTests(prev => {
      const next = prev.filter(t => t.localId !== localId);
      return next.length ? next : [createLabTestItem()];
    });
  };

  const updateLabTest = (localId, field, value) => {
    setLabTests(prev => prev.map(t => t.localId === localId ? { ...t, [field]: value } : t));
  };

  // ── Complete & Finalize ────────────────────────────────────────────────────
  const handleFinalize = async () => {
    setSaving(true);
    try {
      await api.post(`/appointments/${appointmentId}/complete-with-prescription`, {
        allergy: allergy.trim() || undefined,
        sections: {
          chiefComplaints: chiefComplaints.trim() || undefined,
          historyPresentIllness: historyPresentIllness.trim() || undefined,
          pastHistory: pastHistory.trim() || undefined,
          clinicalNotes: clinicalNotes.trim() || undefined,
          procedure: procedure.trim() || undefined,
        },
        labTests: labTests.filter(t => t.testName.trim()),
        diagnosis: diagnosis.trim() || undefined,
        consultationNotes: clinicalNotes.trim() || undefined,
        followUpDate: followUpDate || undefined,
        followUpNotes: followUpNotes.trim() || undefined,
      });

      // Clear autosaved draft
      localStorage.removeItem(AUTOSAVE_KEY(appointmentId));

      toast.success('Consultation completed & prescription finalized ✓');
      navigate('/appointments', { replace: true });
    } catch (err) {
      toast.error(err?.message || 'Failed to complete consultation');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cw-page">
        <div className="cw-loading">
          <div className="cw-loading-spinner" />
          <p style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>Loading consultation…</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="cw-page">
        <div className="cw-error">
          <AlertTriangle size={36} style={{ color: '#f59e0b' }} />
          <h2>Could not load appointment</h2>
          <p style={{ fontSize: 13 }}>{error || 'Appointment not found'}</p>
          <button className="cw-back-btn" onClick={() => navigate('/appointments')}>
            <ArrowLeft size={14} /> Back to Appointments
          </button>
        </div>
      </div>
    );
  }

  const patientName = `${appointment.PatientFirstName || ''} ${appointment.PatientLastName || ''}`.trim() || 'Patient';
  const patientInitials = `${(appointment.PatientFirstName || '?')[0]}${(appointment.PatientLastName || '?')[0]}`.toUpperCase();
  const isAlreadyCompleted = appointment.Status === 'Completed';

  return (
    <div className="cw-page">

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="cw-topbar">
        <div className="cw-topbar-left">
          <button className="cw-back-btn" onClick={() => navigate('/appointments')}>
            <ArrowLeft size={14} /> Back
          </button>
          <div className="cw-topbar-title">
            <h1>Consultation Workspace</h1>
            <p>{appointment.AppointmentNo} · {patientName}</p>
          </div>
        </div>

        <div className="cw-topbar-right">
          <div className="cw-autosave">
            <span className="cw-autosave-dot" />
            Auto-saving
          </div>

          {!isAlreadyCompleted && (
            <button
              className="cw-finalize-btn"
              onClick={handleFinalize}
              disabled={saving}
            >
              {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? 'Saving…' : 'Complete & Finalize'}
            </button>
          )}

          {isAlreadyCompleted && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> Already Completed
            </span>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="cw-body">

        {/* ── Left Panel: Patient Context ─────────────────────────────────── */}
        <aside className="cw-sidebar">
          <div className="cw-patient-card">
            <div className="cw-patient-avatar">{patientInitials}</div>
            <p className="cw-patient-name">{patientName}</p>
            <p className="cw-patient-uhid">{appointment.UHID || appointment.PatientUHID || '—'}</p>
          </div>

          <div className="cw-info-grid">
            <div className="cw-info-item">
              <p className="cw-info-label">Age</p>
              <p className="cw-info-value">{appointment.Age || calcAge(appointment.DateOfBirth || appointment.PatientDOB)}</p>
            </div>
            <div className="cw-info-item">
              <p className="cw-info-label">Gender</p>
              <p className="cw-info-value">{appointment.Gender || appointment.PatientGender || '—'}</p>
            </div>
            <div className="cw-info-item">
              <p className="cw-info-label">Blood Group</p>
              <p className="cw-info-value">{appointment.BloodGroup || appointment.PatientBloodGroup || '—'}</p>
            </div>
            <div className="cw-info-item">
              <p className="cw-info-label">Phone</p>
              <p className="cw-info-value">{appointment.PatientPhone || appointment.Phone || '—'}</p>
            </div>
          </div>

          <div className="cw-appointment-info">
            <h4>Appointment Details</h4>
            <div className="cw-appt-row">
              <Calendar size={14} />
              <span>{formatDate(appointment.AppointmentDate)}</span>
            </div>
            <div className="cw-appt-row">
              <Clock size={14} />
              <span>{formatTime(appointment.AppointmentTime)} — {formatTime(appointment.EndTime)}</span>
            </div>
            <div className="cw-appt-row">
              <Hash size={14} />
              <span>Token <strong>{appointment.TokenNumber || '—'}</strong></span>
            </div>
            <div className="cw-appt-row">
              <User size={14} />
              <span>Dr. {appointment.DoctorFirstName} {appointment.DoctorLastName}</span>
            </div>
            {appointment.DepartmentName && (
              <div className="cw-appt-row">
                <Stethoscope size={14} />
                <span>{appointment.DepartmentName}</span>
              </div>
            )}
            {appointment.Reason && (
              <div className="cw-appt-row">
                <FileText size={14} />
                <span>{appointment.Reason}</span>
              </div>
            )}
          </div>
        </aside>

        {/* ── Right Panel: Clinical Workspace ──────────────────────────────── */}
        <main className="cw-workspace">

          {/* Allergy */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon red"><Shield size={16} /></div>
              <div>
                <p className="cw-section-title">Allergy</p>
                <p className="cw-section-subtitle">Known drug or food allergies</p>
              </div>
            </div>
            <input
              className="cw-input"
              value={allergy}
              onChange={e => setAllergy(e.target.value)}
              placeholder="e.g. Penicillin, Sulfa drugs, Peanuts…"
            />
          </div>

          {/* Chief Complaints */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon blue"><ClipboardList size={16} /></div>
              <div>
                <p className="cw-section-title">Chief Complaints</p>
                <p className="cw-section-subtitle">Primary presenting symptoms</p>
              </div>
            </div>
            <textarea
              className="cw-input"
              rows={3}
              value={chiefComplaints}
              onChange={e => setChiefComplaints(e.target.value)}
              placeholder="e.g. Fever for 3 days, headache, body ache…"
            />
          </div>

          {/* HOPI */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon amber"><History size={16} /></div>
              <div>
                <p className="cw-section-title">History of Present Illness</p>
                <p className="cw-section-subtitle">Timeline and progression of current symptoms</p>
              </div>
            </div>
            <textarea
              className="cw-input"
              rows={3}
              value={historyPresentIllness}
              onChange={e => setHistoryPresentIllness(e.target.value)}
              placeholder="Detailed history of the current illness…"
            />
          </div>

          {/* Past History */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon purple"><FileText size={16} /></div>
              <div>
                <p className="cw-section-title">Past History</p>
                <p className="cw-section-subtitle">Previous medical, surgical, or family history</p>
              </div>
            </div>
            <textarea
              className="cw-input"
              rows={3}
              value={pastHistory}
              onChange={e => setPastHistory(e.target.value)}
              placeholder="Known comorbidities, past surgeries, family history…"
            />
          </div>

          {/* Clinical Notes */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon emerald"><Stethoscope size={16} /></div>
              <div>
                <p className="cw-section-title">Clinical Notes / Examination</p>
                <p className="cw-section-subtitle">Clinical findings, observations, assessments</p>
              </div>
            </div>
            <textarea
              className="cw-input"
              rows={4}
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
              placeholder="Clinical examination findings, observations…"
            />
          </div>

          {/* Procedure */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon cyan"><FileText size={16} /></div>
              <div>
                <p className="cw-section-title">Procedures</p>
                <p className="cw-section-subtitle">Any procedures performed during consultation</p>
              </div>
            </div>
            <textarea
              className="cw-input"
              rows={2}
              value={procedure}
              onChange={e => setProcedure(e.target.value)}
              placeholder="Wound dressing, suture removal, injection given…"
            />
          </div>

          {/* Primary Diagnosis */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon rose"><AlertTriangle size={16} /></div>
              <div>
                <p className="cw-section-title">Primary Diagnosis</p>
                <p className="cw-section-subtitle">Concluded diagnosis for this visit</p>
              </div>
            </div>
            <input
              className="cw-input"
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder="e.g. Viral fever, Acute gastritis, URTI…"
            />
          </div>

          {/* Lab Tests */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon indigo"><Microscope size={16} /></div>
              <div>
                <p className="cw-section-title">Lab Tests</p>
                <p className="cw-section-subtitle">Investigations to be ordered</p>
              </div>
            </div>
            <table className="cw-lab-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Test Name</th>
                  <th style={{ width: '25%' }}>Criteria</th>
                  <th style={{ width: '30%' }}>Details / Notes</th>
                  <th style={{ width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {labTests.map((test) => (
                  <tr key={test.localId}>
                    <td>
                      <input
                        className="cw-lab-input"
                        value={test.testName}
                        onChange={e => updateLabTest(test.localId, 'testName', e.target.value)}
                        placeholder="CBC, LFT, RBS…"
                      />
                    </td>
                    <td>
                      <input
                        className="cw-lab-input"
                        value={test.criteria}
                        onChange={e => updateLabTest(test.localId, 'criteria', e.target.value)}
                        placeholder="Fasting, Random…"
                      />
                    </td>
                    <td>
                      <input
                        className="cw-lab-input"
                        value={test.details}
                        onChange={e => updateLabTest(test.localId, 'details', e.target.value)}
                        placeholder="Additional notes…"
                      />
                    </td>
                    <td>
                      <button className="cw-remove-btn" onClick={() => removeLabTest(test.localId)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="cw-add-test-btn" onClick={addLabTest}>
              <Plus size={13} /> Add Test
            </button>
          </div>

          {/* Follow-up */}
          <div className="cw-card">
            <div className="cw-section-header">
              <div className="cw-section-icon amber"><CalendarDays size={16} /></div>
              <div>
                <p className="cw-section-title">Follow-up</p>
                <p className="cw-section-subtitle">Schedule next visit if needed</p>
              </div>
            </div>
            <div className="cw-followup-grid">
              <input
                type="date"
                className="cw-input"
                value={followUpDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setFollowUpDate(e.target.value)}
              />
              <input
                className="cw-input"
                value={followUpNotes}
                onChange={e => setFollowUpNotes(e.target.value)}
                placeholder="Review in 7 days, repeat CBC, monitor BP…"
              />
            </div>
          </div>

          {/* Bottom Finalize */}
          {!isAlreadyCompleted && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, paddingBottom: 40 }}>
              <button
                className="cw-finalize-btn"
                onClick={handleFinalize}
                disabled={saving}
                style={{ fontSize: 14, padding: '12px 32px' }}
              >
                {saving ? <Loader size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {saving ? 'Saving…' : 'Complete & Finalize Consultation'}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
