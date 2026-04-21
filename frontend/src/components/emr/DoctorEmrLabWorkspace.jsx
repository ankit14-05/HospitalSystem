import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getList, getPayload } from '../../utils/apiPayload';
import { buildServerFileUrl } from '../../utils/fileUrls';

const LAB_OPTIONS = ['Apollo Diagnostics', 'SRL Diagnostics', 'Dr Lal PathLabs', 'Metropolis', 'Thyrocare'];
const COMPLETED_APPOINTMENT_STATUSES = new Set(['completed', 'done', 'served']);
const initialForm = {
  testId: '',
  priority: 'Normal',
  place: 'Indoor',
  roomNo: '',
  labName: '',
  criteria: '',
  additionalDetails: '',
};

const resolvePatientName = (source = {}) =>
  source.PatientFullName ||
  source.PatientName ||
  source.Name ||
  source.name ||
  `${source.PatientFirstName || source.firstName || ''} ${source.PatientLastName || source.lastName || ''}`.trim() ||
  'Patient';

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase();
const isCompletedAppointmentStatus = (value) => COMPLETED_APPOINTMENT_STATUSES.has(normalizeStatus(value));

const resolveCompletedAppointmentId = (source = {}) => {
  const latestCompletedAppointmentId = source.LatestCompletedAppointmentId || source.latestCompletedAppointmentId || null;
  if (latestCompletedAppointmentId) return latestCompletedAppointmentId;

  const fallbackAppointmentId =
    source.AppointmentId ||
    source.appointmentId ||
    ((source.PatientId || source.patientId) ? (source.Id || source.id) : null);

  const appointmentStatus =
    source.LatestCompletedAppointmentStatus ||
    source.latestCompletedAppointmentStatus ||
    source.AppointmentStatus ||
    source.appointmentStatus ||
    source.QueueStatus ||
    source.queueStatus ||
    source.Status ||
    source.status ||
    '';

  return isCompletedAppointmentStatus(appointmentStatus) ? fallbackAppointmentId : null;
};

const resolvePatientCandidate = (source = {}, bucket = 'queue') => {
  const patientId = source.PatientId || source.patientId || source.Id || source.id || null;
  const appointmentId = resolveCompletedAppointmentId(source);
  const appointmentStatus =
    source.LatestCompletedAppointmentStatus ||
    source.latestCompletedAppointmentStatus ||
    source.AppointmentStatus ||
    source.appointmentStatus ||
    source.QueueStatus ||
    source.queueStatus ||
    source.Status ||
    source.status ||
    '';

  return {
    key: String(patientId || `${bucket}-${appointmentId || resolvePatientName(source)}`),
    patientId,
    appointmentId,
    patientName: resolvePatientName(source),
    patientCode: source.UHID || source.uhid || `PT-${patientId || appointmentId || '0000'}`,
    phone: source.PatientPhone || source.Phone || source.phone || '',
    appointmentStatus,
    latestCompletedAppointmentDate: source.LatestCompletedAppointmentDate || source.latestCompletedAppointmentDate || null,
    bookingEligible: Boolean(patientId && appointmentId),
  };
};

const isLabBookingEligible = (candidate) => Boolean(candidate?.patientId && candidate?.appointmentId);

const buildPatientList = (queue = [], requests = []) => {
  const buckets = [
    ...queue.map((item) => resolvePatientCandidate(item, 'queue')),
    ...requests.map((item) => resolvePatientCandidate(item, 'request')),
  ];

  const seen = new Set();
  return buckets.filter((candidate) => {
    const dedupeKey = `${candidate.patientId || ''}|${candidate.patientCode}|${candidate.patientName.toLowerCase()}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  }).sort((left, right) => Number(right.bookingEligible) - Number(left.bookingEligible));
};

const normalizeTest = (test = {}) => ({
  id: test.Id || test.id || test.TestId,
  name: test.Name || test.name || test.TestName || '',
  category: test.Category || test.category || '',
});

const getPriorityWeight = (value) => {
  if (value === 'Urgent') return 2;
  if (value === 'STAT') return 3;
  return 1;
};

const getOrderPriority = (tests = []) => {
  const max = tests.reduce((highest, test) => Math.max(highest, getPriorityWeight(test.priority)), 1);
  if (max === 3) return 'STAT';
  if (max === 2) return 'Urgent';
  return 'Routine';
};

const formatDate = (value, fallback = 'Pending') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const normalizeReport = (report = {}) => ({
  id: report.Id || report.id || null,
  orderNumber: report.OrderNumber || report.orderNumber || 'LAB-ORDER',
  patientId: report.PatientId || report.patientId || null,
  patientName: report.PatientName || resolvePatientName(report),
  patientCode: report.UHID || report.uhid || `PT-${report.PatientId || report.patientId || '0000'}`,
  status: report.WorkflowStage || report.Status || report.status || 'Pending',
  priority: report.Priority || report.priority || 'Routine',
  orderDate: report.OrderDate || report.orderDate || report.CreatedAt || null,
  appointmentNo: report.AppointmentNo || report.appointmentNo || '',
  notes: report.Notes || report.notes || '',
  tests: Array.isArray(report.Tests)
    ? report.Tests
    : Array.isArray(report.tests)
      ? report.tests
      : [],
});

const normalizeReportDetail = (payload = {}) => {
  const tests = Array.isArray(payload.tests) ? payload.tests : [];

  return {
    ...payload,
    tests,
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments.map((attachment) => ({
        ...attachment,
        url: buildServerFileUrl(attachment.StoragePath || attachment.storagePath),
      }))
      : [],
  };
};

const getAttachmentChip = (attachment = {}) => {
  const type = String(attachment.ContentType || attachment.contentType || '').toLowerCase();
  if (type.includes('pdf')) return { label: 'PDF', bg: '#e0f2fe', color: '#0369a1' };
  if (type.startsWith('video/')) return { label: 'VID', bg: '#ffedd5', color: '#c2410c' };
  if (type.startsWith('image/')) return { label: 'IMG', bg: '#ecfccb', color: '#3f6212' };
  return { label: 'FILE', bg: '#f1f5f9', color: '#475569' };
};

function PriorityBadge({ type }) {
  const styles = {
    Normal: { background: '#e6f9f0', color: '#0f6e56', border: '1px solid #9fe1cb' },
    Urgent: { background: '#faeeda', color: '#854f0b', border: '1px solid #fac775' },
    STAT: { background: '#fcebeb', color: '#a32d2d', border: '1px solid #f09595' },
    Routine: { background: '#e6f9f0', color: '#0f6e56', border: '1px solid #9fe1cb' },
  };

  return (
    <span style={{ ...(styles[type] || styles.Normal), fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {type}
    </span>
  );
}

function ReportStatusBadge({ value }) {
  const normalized = String(value || 'Pending').toLowerCase();
  const palette = normalized.includes('review') || normalized.includes('verified')
    ? { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
    : normalized.includes('completed') || normalized.includes('released')
      ? { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' }
      : normalized.includes('processing') || normalized.includes('sample')
        ? { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' }
        : { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };

  return (
    <span style={{ background: palette.bg, color: palette.color, border: `1px solid ${palette.border}`, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {value || 'Pending'}
    </span>
  );
}

export default function DoctorEmrLabWorkspace({
  queue = [],
  requests = [],
  doctorName = 'Doctor',
  onViewPatient,
}) {
  const patientOptions = useMemo(() => buildPatientList(queue, requests), [queue, requests]);
  const [catalog, setCatalog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTouched, setSearchTouched] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [tests, setTests] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [doctorReports, setDoctorReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loadingSelectedReport, setLoadingSelectedReport] = useState(false);
  const [releasingReport, setReleasingReport] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTests = async () => {
      setLoadingCatalog(true);
      try {
        const list = getList(await api.get('/setup/lab-tests'));
        if (active) setCatalog(Array.isArray(list) ? list.map(normalizeTest) : []);
      } catch (error) {
        if (active) {
          setCatalog([]);
          toast.error(error?.message || 'Could not load lab tests');
        }
      } finally {
        if (active) setLoadingCatalog(false);
      }
    };

    loadTests();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPatient && patientOptions.length) {
      const defaultPatient = patientOptions.find(isLabBookingEligible) || patientOptions[0];
      setSelectedPatient(defaultPatient);
      setSearchQuery(defaultPatient.patientCode);
    }
  }, [patientOptions, selectedPatient]);

  useEffect(() => {
    if (!selectedPatient?.patientId || !patientOptions.length) return;

    const refreshedCandidate =
      patientOptions.find((patient) => (
        String(patient.patientId) === String(selectedPatient.patientId)
        && String(patient.appointmentId || '') === String(selectedPatient.appointmentId || '')
      ))
      || patientOptions.find((patient) => (
        String(patient.patientId) === String(selectedPatient.patientId)
        && patient.bookingEligible
      ));

    if (!refreshedCandidate) return;

    const changed =
      refreshedCandidate.appointmentId !== selectedPatient.appointmentId
      || refreshedCandidate.bookingEligible !== selectedPatient.bookingEligible
      || refreshedCandidate.latestCompletedAppointmentDate !== selectedPatient.latestCompletedAppointmentDate
      || refreshedCandidate.patientCode !== selectedPatient.patientCode
      || refreshedCandidate.phone !== selectedPatient.phone;

    if (changed) {
      setSelectedPatient((current) => ({ ...current, ...refreshedCandidate }));
    }
  }, [patientOptions, selectedPatient]);

  useEffect(() => {
    if (!searchTouched) {
      setSearchingPatients(false);
      setSearchResults([]);
      return undefined;
    }

    const query = searchQuery.trim();

    if (!query) {
      setSearchingPatients(false);
      setSearchResults([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const localMatches = patientOptions.filter((patient) => {
          const normalized = query.toLowerCase();
          return (
            String(patient.patientId || '').includes(query) ||
            String(patient.patientCode || '').toLowerCase().includes(normalized) ||
            String(patient.patientName || '').toLowerCase().includes(normalized) ||
            String(patient.phone || '').includes(query)
          );
        });

        const remoteResults = getList(await api.get('/patients/search', { params: { q: query, limit: 12 } }));
        const remoteCandidates = Array.isArray(remoteResults)
          ? remoteResults.map((patient) => resolvePatientCandidate(patient, 'search'))
          : [];

        const merged = [...localMatches, ...remoteCandidates];
        const deduped = [];
        const seen = new Set();

        merged.forEach((patient) => {
          const dedupeKey = `${patient.patientId || ''}|${patient.patientCode || ''}|${String(patient.patientName || '').toLowerCase()}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          deduped.push(patient);
        });

        deduped.sort((left, right) => Number(right.bookingEligible) - Number(left.bookingEligible));
        setSearchResults(deduped);
      } catch (error) {
        setSearchResults([]);
        toast.error(error?.message || 'Could not search patients');
      } finally {
        setSearchingPatients(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [patientOptions, searchQuery, searchTouched]);

  useEffect(() => {
    let active = true;

    const loadDoctorReports = async () => {
      setLoadingReports(true);
      try {
        const list = getList(await api.get('/reports/my', { params: { limit: 24 } }));
        const normalized = Array.isArray(list) ? list.map(normalizeReport) : [];

        if (!active) return;

        setDoctorReports(normalized);

        if (!normalized.length) {
          setSelectedReportId(null);
          setSelectedReport(null);
          return;
        }

        const hasExistingSelection = normalized.some((report) => String(report.id) === String(selectedReportId));
        setSelectedReportId(hasExistingSelection ? selectedReportId : normalized[0].id);
      } catch (error) {
        if (active) {
          setDoctorReports([]);
          toast.error(error?.message || 'Could not load doctor lab reports');
        }
      } finally {
        if (active) setLoadingReports(false);
      }
    };

    loadDoctorReports();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      return undefined;
    }

    let active = true;

    const loadReportDetail = async () => {
      setLoadingSelectedReport(true);
      try {
        const payload = getPayload(await api.get(`/reports/${selectedReportId}`)) || {};
        if (!active) return;
        setSelectedReport(normalizeReportDetail(payload));
      } catch (error) {
        if (active) {
          setSelectedReport(null);
          toast.error(error?.message || 'Could not load report details');
        }
      } finally {
        if (active) setLoadingSelectedReport(false);
      }
    };

    loadReportDetail();

    return () => {
      active = false;
    };
  }, [selectedReportId]);

  const handleSearchChange = (event) => {
    setSearchTouched(true);
    setSearchQuery(event.target.value);
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchTouched(false);
    setSearchQuery(patient.patientCode);
    setSearchResults([]);
  };

  const handleFormChange = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'place') {
        next.roomNo = '';
        next.labName = '';
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.testId) nextErrors.testId = 'Test type is required.';
    if (!form.priority) nextErrors.priority = 'Priority is required.';
    if (!form.place) nextErrors.place = 'Place is required.';

    if (form.place === 'Indoor') {
      if (!form.roomNo.trim()) nextErrors.roomNo = 'Room No is required for Indoor.';
      else if (!/^[a-zA-Z0-9-]+$/.test(form.roomNo.trim())) nextErrors.roomNo = 'Only alphanumeric values are allowed.';
    }

    if (form.place === 'Outside' && !form.labName) nextErrors.labName = 'Lab name is required for Outside.';
    if (form.criteria.length > 150) nextErrors.criteria = 'Max 150 characters.';
    if (form.additionalDetails.length > 500) nextErrors.additionalDetails = 'Max 500 characters.';
    return nextErrors;
  };

  const handleAddTest = () => {
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const selectedTest = catalog.find((test) => String(test.id) === String(form.testId));
    if (!selectedTest) {
      toast.error('Please choose a valid test type');
      return;
    }

    if (tests.some((test) => String(test.testId) === String(form.testId))) {
      toast.error('This test is already added.');
      return;
    }

    setTests((current) => [
      ...current,
      {
        id: Date.now(),
        testId: selectedTest.id,
        testType: selectedTest.name,
        priority: form.priority,
        place: form.place,
        roomNo: form.roomNo,
        labName: form.labName,
        criteria: form.criteria,
        additionalDetails: form.additionalDetails,
      },
    ]);
    setForm(initialForm);
    setErrors({});
    toast.success(`${selectedTest.name} added successfully.`);
  };

  const refreshDoctorReports = async (focusReportId = null) => {
    setLoadingReports(true);
    try {
      const list = getList(await api.get('/reports/my', { params: { limit: 24 } }));
      const normalized = Array.isArray(list) ? list.map(normalizeReport) : [];
      setDoctorReports(normalized);
      const currentStillExists = normalized.some((report) => String(report.id) === String(selectedReportId));
      setSelectedReportId(focusReportId || (currentStillExists ? selectedReportId : normalized[0]?.id || null));
    } catch (error) {
      toast.error(error?.message || 'Could not refresh doctor lab reports');
    } finally {
      setLoadingReports(false);
    }
  };

  const handleReleaseToPatient = async () => {
    if (!selectedReportId) return;

    setReleasingReport(true);
    try {
      await api.patch(`/reports/${selectedReportId}/review`, {
        reviewStatus: 'Reviewed',
        reviewSummary: 'Doctor reviewed the lab report.',
        patientVisibleNote: 'Doctor reviewed and released this lab report to the patient.',
        requiresFollowUp: false,
      });

      toast.success('Report reviewed and released to patient');
      await refreshDoctorReports(selectedReportId);
      const payload = getPayload(await api.get(`/reports/${selectedReportId}`)) || {};
      setSelectedReport(normalizeReportDetail(payload));
    } catch (error) {
      toast.error(error?.message || 'Could not release report to patient');
    } finally {
      setReleasingReport(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedPatient?.patientId) {
      toast.error('Please select a patient first.');
      return;
    }

    if (!isLabBookingEligible(selectedPatient)) {
      toast.error('Complete the appointment / OPD session first before booking lab tests.');
      return;
    }

    if (!tests.length) {
      toast.error('Add at least one test to confirm booking.');
      return;
    }

    setSubmitting(true);
    try {
      const criteriaSummary = tests.map((test) => test.criteria).filter(Boolean).join(' | ');
      const locationSummary = tests
        .map((test) => (test.place === 'Indoor' ? `Indoor: ${test.roomNo}` : `Outside: ${test.labName}`))
        .join(' | ');

      const response = getPayload(await api.post('/reports', {
        patientId: selectedPatient.patientId,
        appointmentId: selectedPatient.appointmentId,
        priority: getOrderPriority(tests),
        clinicalIndication: criteriaSummary || null,
        doctorInstructions: locationSummary || null,
        notes: tests.map((test) => test.additionalDetails).filter(Boolean).join(' | ') || null,
        tests: tests.map((test) => ({
          testId: test.testId,
          criteriaText: test.criteria || null,
          additionalDetails: [
            test.place === 'Indoor' ? `Indoor - ${test.roomNo}` : `Outside - ${test.labName}`,
            test.additionalDetails || null,
          ].filter(Boolean).join(' | '),
        })),
      })) || {};

      toast.success('Booking confirmed successfully!');
      setTests([]);
      setForm(initialForm);
      await refreshDoctorReports(response.id || null);
    } catch (error) {
      toast.error(error?.message || 'Could not confirm booking');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPatientEligible = isLabBookingEligible(selectedPatient);
  const selectedPatientEligibilityMessage = !selectedPatient
    ? 'Search for a patient with a completed appointment or OPD visit to continue.'
    : selectedPatientEligible
      ? `Booking is enabled from the completed appointment${selectedPatient?.latestCompletedAppointmentDate ? ` on ${formatDate(selectedPatient.latestCompletedAppointmentDate, 'recent visit')}` : ''}.`
      : 'Complete the appointment / OPD session first to enable lab booking for this patient.';
  const isAddDisabled = !selectedPatientEligible || !form.testId || !form.priority || !form.place || (form.place === 'Indoor' && !form.roomNo.trim()) || (form.place === 'Outside' && !form.labName);
  const isConfirmDisabled = !selectedPatient?.patientId || !selectedPatientEligible || tests.length === 0 || submitting;
  const selectedWorkflowStage = normalizeStatus(selectedReport?.WorkflowStage || selectedReport?.Status || selectedReport?.status);
  const selectedReportApproved = Boolean(selectedReport?.VerifiedAt || selectedReport?.verifiedAt || ['doctorreview', 'reviewed', 'released'].includes(selectedWorkflowStage));
  const selectedReportReleased = selectedWorkflowStage === 'released' || Boolean(selectedReport?.ReleasedToPatientAt || selectedReport?.releasedToPatientAt);

  return (
    <div className="doctor-lab-page">
      <style>{`
        .doctor-lab-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; background:#f0f2f0; min-height:100vh; padding:32px 24px; color:#0d1f0d; }
        .doctor-lab-page * { box-sizing:border-box; }
        .blt-title { margin:0 0 4px; font-size:28px; font-weight:700; letter-spacing:-0.5px; }
        .blt-subtitle { margin:0 0 28px; font-size:14px; color:#607060; }
        .blt-grid-3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:24px; }
        .blt-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .blt-card { background:#fff; border:1px solid #e4ebe4; border-radius:14px; padding:24px; }
        .blt-input,.blt-select,.blt-textarea { width:100%; padding:10px 14px; border-radius:8px; border:1.5px solid #dde3dd; background:#f7f8f7; font-size:14px; color:#1a2e1a; outline:none; }
        .blt-input:focus,.blt-select:focus,.blt-textarea:focus { border-color:#0f766e; background:#fff; }
        .field-error { border-color:#e24b4a !important; }
        .blt-label { font-size:13px; font-weight:600; color:#3a4a3a; display:block; margin-bottom:6px; }
        .blt-field { margin-bottom:16px; }
        .err-msg { color:#a32d2d; font-size:12px; margin:4px 0 0; }
        .char-count { font-size:11px; color:#a0aba0; text-align:right; margin-top:3px; }
        .btn-add,.btn-confirm { border:none; border-radius:10px; background:#0f766e; color:#fff; font-weight:700; cursor:pointer; }
        .btn-add { width:100%; padding:13px; font-size:15px; }
        .btn-confirm { padding:12px 28px; font-size:14px; }
        .btn-add:disabled,.btn-confirm:disabled { background:#9ab8b0; cursor:not-allowed; }
        .btn-draft,.btn-light { border:1.5px solid #c0ccc0; border-radius:10px; background:#fff; color:#0f766e; font-weight:700; cursor:pointer; }
        .btn-draft { padding:12px 24px; color:#444; font-weight:600; }
        .btn-light { padding:10px 16px; font-size:13px; }
        .patient-dropdown { position:absolute; top:calc(100% + 4px); left:0; right:0; background:#fff; border:1.5px solid #dde3dd; border-radius:8px; z-index:100; box-shadow:0 4px 16px rgba(0,0,0,0.08); overflow:hidden; }
        .patient-item { padding:10px 14px; cursor:pointer; font-size:14px; border-bottom:1px solid #f0f2f0; display:flex; justify-content:space-between; gap:12px; }
        .patient-item:hover { background:#e1f5ee; }
        .eligibility-banner { margin:0 0 20px; border-radius:12px; padding:12px 16px; font-size:13px; line-height:1.5; border:1px solid transparent; }
        .eligibility-banner.ready { background:#ecfdf5; border-color:#a7f3d0; color:#166534; }
        .eligibility-banner.blocked { background:#fff7ed; border-color:#fdba74; color:#9a3412; }
        .tests-card { padding:0; display:flex; flex-direction:column; min-height:520px; }
        .tests-head,.tests-foot { padding:16px 24px; border-bottom:1px solid #f0f2f0; display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .tests-foot { border-top:1px solid #f0f2f0; border-bottom:none; justify-content:flex-end; }
        .test-row { padding:12px 24px; display:grid; grid-template-columns:3fr 1.2fr 1fr 0.4fr; gap:10px; align-items:center; border-bottom:1px solid #f0f2f0; }
        .report-shell { margin-top:28px; background:#fff; border:1px solid #e4ebe4; border-radius:18px; padding:24px; }
        .report-layout { display:grid; grid-template-columns:minmax(280px,.95fr) minmax(320px,1.05fr); gap:18px; }
        .report-box { border:1px solid #e7ece7; border-radius:16px; overflow:hidden; background:#fff; }
        .report-box-head { padding:14px 18px; border-bottom:1px solid #edf1ed; background:#fbfcfb; font-size:13px; font-weight:800; color:#4b5c4b; text-transform:uppercase; letter-spacing:.05em; }
        .report-order { width:100%; text-align:left; border:0; border-bottom:1px solid #edf1ed; background:#fff; padding:16px 18px; cursor:pointer; }
        .report-order.active { background:#eefaf6; }
        .file-row { display:flex; align-items:center; gap:12px; border:1px solid #e7ece7; border-radius:14px; padding:12px 14px; }
        @media (max-width: 900px) { .blt-grid-3,.blt-grid-2,.report-layout { grid-template-columns:1fr; } }
      `}</style>

      <h1 className="blt-title">Book Lab Test</h1>
      <p className="blt-subtitle">
        {doctorName} can schedule diagnostic procedures and review technician-uploaded PDF/video reports from the same workspace.
      </p>

      <div className="blt-grid-3">
        <div style={{ position: 'relative' }}>
          <input className="blt-input" placeholder="Search by patient ID, UHID, phone, or name" value={searchQuery} onChange={handleSearchChange} style={{ background: '#fff' }} />
          {searchingPatients ? (
            <div className="patient-dropdown">
              <div className="patient-item" style={{ cursor: 'default', justifyContent: 'flex-start' }}>
                <span style={{ fontWeight: 600, color: '#607060' }}>Searching patients...</span>
              </div>
            </div>
          ) : null}
          {searchResults.length > 0 ? (
            <div className="patient-dropdown">
              {searchResults.map((patient) => (
                <div key={patient.key} className="patient-item" onClick={() => handleSelectPatient(patient)}>
                  <span style={{ fontWeight: 600 }}>{patient.patientName}</span>
                  <span style={{ fontSize: 12, color: '#607060' }}>
                    ID {patient.patientId || '—'} · {patient.patientCode}{patient.phone ? ` · ${patient.phone}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <input className="blt-input" placeholder="Patient ID / UHID" value={selectedPatient ? `${selectedPatient.patientId || '—'} · ${selectedPatient.patientCode || '—'}` : ''} readOnly />
        <input className="blt-input" placeholder="Patient name" value={selectedPatient?.patientName || ''} readOnly />
      </div>

      <div className={`eligibility-banner ${selectedPatientEligible ? 'ready' : 'blocked'}`}>
        <strong>{selectedPatientEligible ? 'Booking enabled.' : 'Booking locked.'}</strong> {selectedPatientEligibilityMessage}
      </div>

      <div className="blt-grid-2">
        <section className="blt-card">
          <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>Test Type and Details</h2>
          <div className="blt-field">
            <label className="blt-label">Test Type</label>
            <select className={`blt-select${errors.testId ? ' field-error' : ''}`} value={form.testId} onChange={(event) => handleFormChange('testId', event.target.value)} disabled={loadingCatalog}>
              <option value="">{loadingCatalog ? 'Loading Test Catalog...' : 'Select Test Type'}</option>
              {catalog.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}
            </select>
            {errors.testId ? <p className="err-msg">{errors.testId}</p> : null}
          </div>
          <div className="blt-field">
            <label className="blt-label">Priority</label>
            <select className="blt-select" value={form.priority} onChange={(event) => handleFormChange('priority', event.target.value)}>
              <option value="Normal">Normal</option>
              <option value="Urgent">Urgent</option>
              <option value="STAT">STAT</option>
            </select>
          </div>
          <div className="blt-grid-2" style={{ gap: 12 }}>
            <div className="blt-field">
              <label className="blt-label">Place</label>
              <select className="blt-select" value={form.place} onChange={(event) => handleFormChange('place', event.target.value)}>
                <option value="Indoor">Indoor</option>
                <option value="Outside">Outside</option>
              </select>
            </div>
            <div className="blt-field">
              {form.place === 'Indoor' ? (
                <>
                  <label className="blt-label">Room No</label>
                  <input className={`blt-input${errors.roomNo ? ' field-error' : ''}`} placeholder="e.g. 101A" value={form.roomNo} onChange={(event) => handleFormChange('roomNo', event.target.value)} />
                  {errors.roomNo ? <p className="err-msg">{errors.roomNo}</p> : null}
                </>
              ) : (
                <>
                  <label className="blt-label">Lab Name</label>
                  <select className={`blt-select${errors.labName ? ' field-error' : ''}`} value={form.labName} onChange={(event) => handleFormChange('labName', event.target.value)}>
                    <option value="">Select Lab</option>
                    {LAB_OPTIONS.map((lab) => <option key={lab} value={lab}>{lab}</option>)}
                  </select>
                  {errors.labName ? <p className="err-msg">{errors.labName}</p> : null}
                </>
              )}
            </div>
          </div>
          <div className="blt-field">
            <label className="blt-label">Criteria for each test</label>
            <input className={`blt-input${errors.criteria ? ' field-error' : ''}`} value={form.criteria} onChange={(event) => handleFormChange('criteria', event.target.value)} maxLength={160} placeholder="Enter criteria" />
            <div className="char-count">{form.criteria.length}/150</div>
            {errors.criteria ? <p className="err-msg">{errors.criteria}</p> : null}
          </div>
          <div className="blt-field">
            <label className="blt-label">Additional details</label>
            <textarea className={`blt-textarea${errors.additionalDetails ? ' field-error' : ''}`} value={form.additionalDetails} onChange={(event) => handleFormChange('additionalDetails', event.target.value)} rows={4} maxLength={510} placeholder="Add any extra information..." />
            <div className="char-count">{form.additionalDetails.length}/500</div>
            {errors.additionalDetails ? <p className="err-msg">{errors.additionalDetails}</p> : null}
          </div>
          <button className="btn-add" disabled={isAddDisabled} onClick={handleAddTest}>+ Add Test</button>
        </section>

        <section className="blt-card tests-card">
          <div className="tests-head">
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Total Tests</h2>
            {tests.length ? <span style={{ background: '#0f766e', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{tests.length} added</span> : null}
          </div>
          <div style={{ flex: 1 }}>
            {tests.length === 0 ? (
              <div style={{ height: '100%', minHeight: 260, display: 'grid', placeItems: 'center', color: '#a0aba0', padding: 32, textAlign: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14 }}>No tests added yet</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12 }}>Fill the form and click + Add Test</p>
                </div>
              </div>
            ) : (
              tests.map((test) => (
                <div key={test.id} className="test-row">
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{test.testType}</span>
                  <PriorityBadge type={test.priority} />
                  <span style={{ fontSize: 13, color: '#607060' }}>{test.place}</span>
                  <button onClick={() => setTests((current) => current.filter((item) => item.id !== test.id))} style={{ background: 'none', border: 'none', color: '#e24b4a', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              ))
            )}
          </div>
          <div className="tests-foot">
            <button className="btn-draft" onClick={() => toast.success('Draft saved locally for now.')}>Save as Draft</button>
            <button className="btn-confirm" disabled={isConfirmDisabled} onClick={handleConfirmBooking}>{submitting ? 'Saving...' : 'Confirm Booking'}</button>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#a0aba0' }}>Technician PDF/video uploads appear in the report section below after result submission.</p>
        {selectedPatient?.patientId ? <button className="btn-light" onClick={() => onViewPatient?.(selectedPatient.patientId, selectedPatient.patientName)}>Open Patient EMR</button> : null}
      </div>

      <section className="report-shell">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Recent Lab Orders & Reports</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#607060' }}>Doctor can review technician-uploaded report PDFs, images, and videos here.</p>
          </div>
          <button className="btn-light" onClick={() => refreshDoctorReports()}>Refresh Reports</button>
        </div>

        <div className="report-layout">
          <div className="report-box">
            <div className="report-box-head">Doctor Orders</div>
            {loadingReports ? (
              <div style={{ padding: 24, color: '#607060' }}>Loading lab orders...</div>
            ) : doctorReports.length === 0 ? (
              <div style={{ padding: 24, color: '#607060' }}>No lab orders found.</div>
            ) : doctorReports.map((report) => (
              <button key={report.id} className={`report-order${String(report.id) === String(selectedReportId) ? ' active' : ''}`} onClick={() => setSelectedReportId(report.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{report.orderNumber}</div>
                    <div style={{ fontSize: 13, color: '#607060', marginTop: 2 }}>{report.patientName} · {report.patientCode}</div>
                  </div>
                  <ReportStatusBadge value={report.status} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                  <PriorityBadge type={report.priority} />
                  <span style={{ fontSize: 12, color: '#607060' }}>{formatDate(report.orderDate, 'Recently created')}</span>
                </div>
                <div style={{ fontSize: 12, color: '#495a49', lineHeight: 1.5 }}>
                  {(report.tests || []).slice(0, 3).map((test) => test.TestName || test.name).filter(Boolean).join(', ') || 'No test details available'}
                </div>
              </button>
            ))}
          </div>

          <div className="report-box">
            <div className="report-box-head">Report Detail</div>
            {loadingSelectedReport ? (
              <div style={{ padding: 24, color: '#607060' }}>Loading selected report...</div>
            ) : !selectedReport ? (
              <div style={{ padding: 24, color: '#607060' }}>Choose an order to review tests and uploads.</div>
            ) : (
              <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selectedReport.OrderNumber || selectedReport.orderNumber}</h3>
                    <p style={{ margin: '6px 0 0', color: '#607060', fontSize: 14 }}>{selectedReport.PatientName || selectedReport.patientName || 'Patient'} · {selectedReport.UHID || selectedReport.patientCode || 'UHID unavailable'}</p>
                  </div>
                  <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
                    <ReportStatusBadge value={selectedReport.WorkflowStage || selectedReport.Status || selectedReport.status} />
                    {selectedReportReleased ? (
                      <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>Visible to patient</span>
                    ) : selectedReportApproved ? (
                      <button className="btn-light" onClick={handleReleaseToPatient} disabled={releasingReport}>
                        {releasingReport ? 'Releasing...' : 'Review & Release to Patient'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: '#a16207', fontWeight: 700 }}>Awaiting lab head approval</span>
                    )}
                  </div>
                </div>

                <div style={{ border: '1px solid #e7ece7', borderRadius: 14, overflow: 'hidden' }}>
                  <div className="report-box-head">Ordered Tests</div>
                  {selectedReport.tests?.length ? selectedReport.tests.map((test) => (
                    <div key={test.Id || test.TestId || test.id} style={{ padding: '12px 16px', borderBottom: '1px solid #edf1ed', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10 }}>
                      <strong>{test.TestName || test.name || 'Lab Test'}</strong>
                      <span>{test.ResultValue || 'Pending'} {test.ResultUnit || test.Unit || ''}</span>
                      <span>{test.Status || 'Pending'}</span>
                    </div>
                  )) : <div style={{ padding: 16, color: '#607060' }}>No tests attached.</div>}
                </div>

                <div style={{ border: '1px solid #e7ece7', borderRadius: 14, overflow: 'hidden' }}>
                  <div className="report-box-head">Technician Uploads</div>
                  {selectedReport.attachments?.length ? (
                    <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                      {selectedReport.attachments.map((attachment) => {
                        const chip = getAttachmentChip(attachment);
                        return (
                          <div key={attachment.Id || attachment.id || attachment.FileName} className="file-row">
                            <div style={{ minWidth: 44, height: 44, borderRadius: 12, background: chip.bg, color: chip.color, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{chip.label}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.FileName || attachment.fileName || 'Attachment'}</div>
                              <div style={{ fontSize: 12, color: '#607060', marginTop: 4 }}>{formatBytes(attachment.FileSizeBytes || attachment.fileSizeBytes || 0)} · {formatDate(attachment.UploadedAt || attachment.uploadedAt, 'Recently uploaded')}</div>
                            </div>
                            {attachment.url ? <a href={attachment.url} target="_blank" rel="noreferrer" style={{ background: '#0f766e', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 800 }}>Open File</a> : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : <div style={{ padding: 16, color: '#607060' }}>No PDF, image, or video uploaded yet.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
