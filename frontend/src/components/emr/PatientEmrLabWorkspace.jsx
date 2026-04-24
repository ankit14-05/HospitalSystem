import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertCircle,
  Clipboard,
  Download,
  Eye,
  FileText,
  FlaskConical,
  History,
  Pill,
  RefreshCw,
  Upload,
} from 'lucide-react';
import api from '../../services/api';
import { getPayload } from '../../utils/apiPayload';
import { buildServerFileUrl } from '../../utils/fileUrls';

const TEAL = '#0f766e';
const BLUE = '#1d4ed8';

const S = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '20px 24px',
  },
  btn: {
    primary: {
      background: TEAL,
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'inherit',
    },
    outline: {
      background: '#fff',
      color: '#374151',
      border: '1px solid #d1d5db',
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'inherit',
    },
  },
  pill: (bg, color) => ({
    background: bg,
    color,
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  }),
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const getAttachmentTone = (attachment = {}) => {
  const type = String(attachment.ContentType || attachment.contentType || attachment.type || '').toLowerCase();
  if (type.includes('pdf')) return { label: 'PDF', bg: '#e0f2fe', color: '#0369a1' };
  if (type.startsWith('video/')) return { label: 'VID', bg: '#ffedd5', color: '#c2410c' };
  if (type.startsWith('image/')) return { label: 'IMG', bg: '#ecfccb', color: '#3f6212' };
  return { label: 'FILE', bg: '#f1f5f9', color: '#475569' };
};

const normalizeReportDetail = (payload = {}) => ({
  ...payload,
  tests: Array.isArray(payload.tests) ? payload.tests : [],
  attachments: Array.isArray(payload.attachments)
    ? payload.attachments.map((attachment) => ({
      ...attachment,
      url: buildServerFileUrl(attachment.StoragePath || attachment.storagePath || attachment.url),
    }))
    : [],
});

const defaultReportModalState = {
  open: false,
  loading: false,
  report: null,
};

const getReportTests = (report = {}) =>
  Array.isArray(report.Tests) ? report.Tests : Array.isArray(report.tests) ? report.tests : [];

const getPrescriptionItems = (prescription = {}) =>
  Array.isArray(prescription.Items) ? prescription.Items : Array.isArray(prescription.items) ? prescription.items : [];

const getDisplayName = (profile = {}, user = {}) =>
  `${profile.FirstName || user.firstName || ''} ${profile.LastName || user.lastName || ''}`.trim() || 'Patient';

const joinDisplayParts = (...values) => values
  .map((value) => String(value || '').trim())
  .filter(Boolean);

const resolveDoctorName = (record = {}, fallback = '') => {
  const directName =
    record.DoctorName ||
    record.doctorName ||
    record.OrderedByName ||
    record.orderedByName ||
    record.RecordedByName ||
    record.recordedByName ||
    '';

  if (String(directName).trim()) return String(directName).trim();

  const composedName = joinDisplayParts(
    record.DoctorFirstName || record.doctorFirstName,
    record.DoctorLastName || record.doctorLastName
  ).join(' ');

  return composedName || fallback;
};

const resolveAppointmentTitle = (appointment = {}) =>
  appointment.DepartmentName ||
  appointment.departmentName ||
  appointment.VisitType ||
  appointment.visitType ||
  appointment.AppointmentNo ||
  appointment.appointmentNo ||
  'Appointment';

const resolveAppointmentSummary = (appointment = {}) => joinDisplayParts(
  resolveDoctorName(appointment),
  appointment.Reason || appointment.reason || appointment.Notes || appointment.notes || appointment.VisitType || appointment.visitType
).join(' | ');

const resolveReportStatus = (report = {}) =>
  report.WorkflowStage ||
  report.workflowStage ||
  report.Status ||
  report.status ||
  '';

const resolveReportSummary = (report = {}) => joinDisplayParts(
  getReportTests(report).map((test) => test.TestName || test.Name).slice(0, 2).join(', '),
  resolveReportStatus(report)
).join(' | ');

const getStatusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'reviewed', 'active'].includes(normalized)) return { bg: '#f0fdf4', color: '#166534' };
  if (['pending', 'processing', 'refill required', 'followupneeded'].includes(normalized)) return { bg: '#fffbeb', color: '#b45309' };
  if (['expired', 'cancelled', 'inactive'].includes(normalized)) return { bg: '#fef2f2', color: '#b91c1c' };
  return { bg: '#eff6ff', color: BLUE };
};

const isPrescriptionActive = (prescription) => {
  const status = String(prescription?.Status || prescription?.status || '').toLowerCase();
  if (!status) return true;
  return !['completed', 'cancelled', 'inactive', 'expired'].includes(status);
};

const buildHistoryGroups = (appointments = [], reports = [], encounters = []) => {
  const appointmentEntries = appointments.map((appointment) => {
    const date = new Date(appointment.AppointmentDate || appointment.Date || appointment.date || 0);
    return {
      id: `appt-${appointment.Id || appointment.id}`,
      date,
      title: resolveAppointmentTitle(appointment),
      desc: resolveAppointmentSummary(appointment),
      tag: String(appointment.VisitType || appointment.visitType || appointment.Status || appointment.status || 'Appointment').toUpperCase(),
      tagBg: '#dbeafe',
      tagColor: BLUE,
    };
  });

  const encounterEntries = encounters
    .filter((encounter) => !(encounter.AppointmentId || encounter.appointmentId))
    .map((encounter, index) => {
      const date = new Date(encounter.EncounterDate || encounter.encounterDate || 0);
      return {
        id: `enc-${encounter.Id || encounter.id || index}`,
        date,
        title: encounter.EncounterType || encounter.encounterType || 'Clinical Encounter',
        desc: joinDisplayParts(
          resolveDoctorName(encounter),
          encounter.ChiefComplaint || encounter.chiefComplaint
        ).join(' | '),
        tag: 'ENCOUNTER',
        tagBg: '#ccfbf1',
        tagColor: TEAL,
      };
    });

  const reportEntries = reports.map((report) => {
    const date = new Date(report.OrderDate || report.Date || report.date || 0);
      return {
        id: `lab-${report.Id || report.id}`,
        date,
        title: report.OrderNumber || 'Lab Tests Completed',
        desc: resolveReportSummary(report),
        tag: String(resolveReportStatus(report) || 'Lab').toUpperCase(),
        tagBg: '#f3f4f6',
        tagColor: '#374151',
      };
  });

  return [...appointmentEntries, ...encounterEntries, ...reportEntries]
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .reduce((groups, entry) => {
      const year = entry.date.getFullYear();
      const existing = groups.find((group) => group.year === year);
      const item = {
        ...entry,
        month: entry.date.toLocaleString('en-IN', { month: 'short' }),
        day: entry.date.getDate(),
      };

      if (existing) {
        existing.entries.push(item);
      } else {
        groups.push({ year, entries: [item] });
      }
      return groups;
    }, []);
};

function StatusPill({ status }) {
  const tone = getStatusTone(status);
  return (
    <span style={{ background: tone.bg, color: tone.color, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>
      {status || 'Pending'}
    </span>
  );
}

function ReportDetailModal({ report, loading = false, onClose }) {
  if (!report) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{report.OrderNumber || report.orderNumber || 'Lab Report Detail'}</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>{report.PatientName || report.patientName || 'Patient'} · {formatDate(report.OrderDate || report.orderDate)}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 22 }}>×</button>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 18 }}>
          {loading ? (
            <div style={{ fontSize: 14, color: '#64748b' }}>Loading report detail...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  ['Ordered By', resolveDoctorName(report, 'Not linked')],
                  ['Status', report.WorkflowStage || report.Status || report.status || 'Pending'],
                  ['Priority', report.Priority || report.priority || 'Routine'],
                  ['Reported On', formatDate(report.ReportedAt || report.reportedAt)],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, color: '#334155' }}>Investigations</div>
                {(report.tests || []).length ? (
                  (report.tests || []).map((test) => (
                    <div key={test.Id || test.TestId || test.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{test.TestName || test.Name || 'Lab Test'}</div>
                      <div style={{ fontSize: 13, color: '#475569' }}>{test.ResultValue || 'Pending'} {test.ResultUnit || test.Unit || ''}</div>
                      <div style={{ fontSize: 13, color: '#475569' }}>{test.NormalRange || 'Range not set'}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: 16, fontSize: 14, color: '#64748b' }}>No test lines available for this order.</div>
                )}
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, color: '#334155' }}>Uploaded Files</div>
                {(report.attachments || []).length ? (
                  <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                    {(report.attachments || []).map((attachment) => {
                      const tone = getAttachmentTone(attachment);
                      return (
                        <div key={attachment.Id || attachment.id || attachment.FileName} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: tone.bg, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                            {tone.label}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.FileName || attachment.fileName || 'Attachment'}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{formatBytes(attachment.FileSizeBytes || attachment.fileSizeBytes || 0)} · {formatDate(attachment.UploadedAt || attachment.uploadedAt)}</div>
                          </div>
                          {attachment.url ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <a href={attachment.url} target="_blank" rel="noreferrer" style={{ ...S.btn.outline, textDecoration: 'none', padding: '8px 12px' }}><Eye size={14} /> Open</a>
                              <a href={attachment.url} target="_blank" rel="noreferrer" download style={{ ...S.btn.primary, textDecoration: 'none', padding: '8px 12px' }}><Download size={14} /> Download</a>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 16, fontSize: 14, color: '#64748b' }}>No uploaded files are available yet for this report.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportTable({ reports = [], onViewReport = null, onUploadComplete = null }) {
  const [page, setPage] = useState(1);
  const [uploadingId, setUploadingId] = useState(null);
  const perPage = 4;
  const totalPages = Math.max(1, Math.ceil(reports.length / perPage));
  const start = (page - 1) * perPage;
  const rows = reports.slice(start, start + perPage);

  const isOutsideUploadAllowed = (report) => {
    const status = String(report?.Status || report?.status || '').toLowerCase();
    return status === 'cancelled' || status === 'rejected';
  };

  const handleOutsideUpload = async (report, event) => {
    const files = Array.from(event.target.files || []);
    const orderId = report?.OrderId || report?.Id || report?.id;
    if (!files.length || !orderId) return;
    try {
      setUploadingId(orderId);
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const res = await api.post(`/lab/orders/${orderId}/patient-uploads`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res?.message || 'Outside report uploaded successfully.');
      onUploadComplete?.();
    } catch (error) {
      toast.error(error?.message || 'Failed to upload outside report');
    } finally {
      setUploadingId(null);
      event.target.value = '';
    }
  };

  return (
    <>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['TEST NAME', 'ORDERED BY', 'SAMPLE DATE', 'STATUS', 'ACTION'].map((header) => (
                <th key={header} style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid #e5e7eb' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => (
              <tr key={report.Id || report.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🧪</div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{getReportTests(report).map((test) => test.TestName || test.Name).join(', ') || report.OrderNumber || 'Lab report'}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 14, color: '#374151' }}>{resolveDoctorName(report, 'Not linked')}</td>
                <td style={{ padding: '14px 16px', fontSize: 14, color: '#374151' }}>{formatDate(report.OrderDate || report.Date || report.date)}</td>
                <td style={{ padding: '14px 16px' }}><StatusPill status={report.Status || report.status} /></td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => onViewReport?.(report)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLUE, padding: 2, fontWeight: 700 }}>
                      View Files
                    </button>
                    {isOutsideUploadAllowed(report) ? (
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#b45309', border: '1px solid #f59e0b', borderRadius: 6, padding: '4px 8px', cursor: uploadingId === (report?.OrderId || report?.Id || report?.id) ? 'not-allowed' : 'pointer', opacity: uploadingId === (report?.OrderId || report?.Id || report?.id) ? 0.6 : 1 }}>
                        {uploadingId === (report?.OrderId || report?.Id || report?.id) ? 'Uploading...' : 'Upload Outside'}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.mp4,.mp3,.wav"
                          multiple
                          disabled={uploadingId === (report?.OrderId || report?.Id || report?.id)}
                          onChange={(event) => handleOutsideUpload(report, event)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Showing {reports.length ? start + 1 : 0} to {Math.min(start + perPage, reports.length)} of {reports.length} lab results</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} style={{ ...S.btn.outline, opacity: page <= 1 ? 0.4 : 1 }}>Previous</button>
          <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} style={{ ...S.btn.outline, opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
        </div>
      </div>
    </>
  );
}

function MedicalHistorySection({ appointments, reports, encounters = [] }) {
  const groups = useMemo(() => buildHistoryGroups(appointments, reports, encounters), [appointments, reports, encounters]);

  if (!groups.length) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 14 }}>No history found.</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Medical History</h2>
        <button style={S.btn.outline}>Export Timeline</button>
      </div>

      {groups.map((group) => (
        <div key={group.year} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 16, paddingLeft: 80 }}>{group.year}</div>
          {group.entries.map((entry) => (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 12 }}>
              <div style={{ width: 80, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                <div style={{ background: BLUE, color: '#fff', borderRadius: 8, padding: '5px 8px', textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{entry.month}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{entry.day}</div>
                </div>
              </div>
              <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111827', marginBottom: 4 }}>{entry.title}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{entry.desc}</div>
                </div>
                <span style={{ background: entry.tagBg, color: entry.tagColor, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{entry.tag}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DiagnosisReportSection({ profile, appointments, diagnoses = [] }) {
  const conditions = String(profile?.ChronicConditions || '')
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const diagnosisRows = diagnoses.length
    ? diagnoses.map((diagnosis, index) => ({
      title: diagnosis.DiagnosisName || diagnosis.diagnosisName || `Diagnosis ${index + 1}`,
      severity: diagnosis.Severity || diagnosis.severity || diagnosis.DiagnosisType || diagnosis.diagnosisType || 'Recorded',
      severityBg: diagnosis.IsPrimary || diagnosis.isPrimary ? '#dbeafe' : '#f0fdf4',
      severityColor: diagnosis.IsPrimary || diagnosis.isPrimary ? BLUE : '#166534',
      doctor: resolveDoctorName(diagnosis, 'Not linked'),
      specialty: diagnosis.DepartmentName || diagnosis.departmentName || null,
      date: `Recorded: ${formatDate(diagnosis.RecordedAt || diagnosis.recordedAt || diagnosis.EncounterDate || diagnosis.encounterDate)}`,
      status: diagnosis.ICDCode || diagnosis.icdCode
        ? `ICD: ${diagnosis.ICDCode || diagnosis.icdCode}`
        : `${diagnosis.RecordSource || diagnosis.recordSource || 'EMR'} entry`,
    }))
    : conditions.length
    ? conditions.map((condition, index) => ({
      title: condition,
      severity: 'Active',
      severityBg: '#dbeafe',
      severityColor: BLUE,
      doctor: resolveDoctorName(appointments[0] || {}, 'Not linked'),
      specialty: appointments[0]?.DepartmentName || null,
      date: `On file: ${formatDate(appointments[0]?.AppointmentDate)}`,
      status: 'Monitoring required',
    }))
    : [{
      title: 'No formal diagnosis recorded',
      severity: 'Info',
      severityBg: '#f0fdf4',
      severityColor: '#166534',
      doctor: resolveDoctorName(appointments[0] || {}, 'Not linked'),
      specialty: appointments[0]?.DepartmentName || null,
      date: 'Profile review pending',
      status: 'Diagnosis details will appear after doctor review',
    }];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Diagnosis Reports</h2>
        <button style={S.btn.outline}>Filter by Type</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {diagnosisRows.map((diagnosis) => (
          <div key={diagnosis.title} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', borderLeft: `4px solid ${TEAL}` }}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{diagnosis.title}</span>
                <span style={{ ...S.pill(diagnosis.severityBg, diagnosis.severityColor) }}>{diagnosis.severity}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                <span>{diagnosis.doctor}{diagnosis.specialty ? ` · ${diagnosis.specialty}` : ''} · {diagnosis.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 13, color: '#374151' }}>{diagnosis.status}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={S.btn.outline}>View Full Report</button>
                  <button style={S.btn.primary}>Download PDF</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrescriptionsSection({ prescriptions }) {
  const rows = prescriptions.slice(0, 8);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Prescription History</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Manage and track patient medication records</p>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['DATE ISSUED', 'DOCTOR', 'MEDICATIONS', 'STATUS'].map((header) => (
                <th key={header} style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid #e5e7eb' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((prescription) => (
              <tr key={prescription.Id || prescription.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '14px 16px', fontSize: 14, color: '#374151' }}>{formatDate(prescription.RxDate || prescription.date)}</td>
                <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 500, color: '#111827' }}>{resolveDoctorName(prescription, 'Not linked')}</td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{getPrescriptionItems(prescription)[0]?.MedicineName || getPrescriptionItems(prescription)[0]?.drugName || 'Prescription items'}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{getPrescriptionItems(prescription).length} medicine(s)</div>
                </td>
                <td style={{ padding: '14px 16px' }}><StatusPill status={prescription.Status || (isPrescriptionActive(prescription) ? 'Active' : 'Completed')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClinicalNotesSection({ appointments, reports, notes = [] }) {
  const noteRows = notes.length ? notes.map((note, index) => ({
    id: note.Id || note.id || `note-${index}`,
    title: note.NoteType || note.noteType || note.OrderNumber || 'Clinical Note',
    doctor: resolveDoctorName(note, 'Not linked'),
    date: formatDate(note.RecordedAt || note.recordedAt),
    content: note.NoteText || note.noteText || '',
    tags: [note.RecordSource || note.recordSource || 'EMR'].filter(Boolean),
  })) : [
    ...appointments.map((appointment, index) => ({
      id: `appt-${appointment.Id || appointment.id || index}`,
      title: resolveAppointmentTitle(appointment),
      doctor: resolveDoctorName(appointment, 'Not linked'),
      date: formatDate(appointment.AppointmentDate || appointment.date),
      content: appointment.Notes || appointment.Reason || appointment.reason || 'Consultation details are not available yet.',
      tags: [appointment.VisitType || appointment.visitType || appointment.Status || appointment.status || 'Appointment'],
    })),
    ...reports
      .filter((report) => report.Notes || report.notes)
      .map((report, index) => ({
        id: `report-${report.Id || report.id || index}`,
        title: report.OrderNumber || 'Lab Comment',
        doctor: resolveDoctorName(report, 'Not linked'),
        date: formatDate(report.OrderDate || report.date),
        content: report.Notes || report.notes,
        tags: [resolveReportStatus(report) || 'Lab'],
      })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Clinical Reports</h2>
        <button style={S.btn.outline}>Filter by Doctor</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {noteRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 14 }}>No notes found.</div>
        ) : noteRows.map((note) => (
          <div key={note.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', borderLeft: `4px solid ${TEAL}` }}>
            <div style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{note.title}</span>
                <span style={{ fontSize: 13, color: '#6b7280' }}>{note.doctor} | {note.date}</span>
              </div>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 10px' }}>{note.content}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {note.tags.map((tag) => (
                  <span key={tag} style={{ background: '#f3f4f6', color: '#374151', fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllergyInfoSection({ profile }) {
  const items = String(profile?.KnownAllergies || '')
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your Allergies</h2>
          <AlertCircle size={18} color="#dc2626" />
        </div>
      </div>

      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#991b1b', fontWeight: 500 }}>
        Critical: Always inform healthcare providers about your allergies before any treatment or medication.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(items.length ? items : ['No allergy recorded']).map((item) => (
          <div key={item} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{item}</div>
            <span style={{ background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>{item === 'No allergy recorded' ? 'NONE' : 'REPORTED'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedicationHistorySection({ prescriptions }) {
  const [subTab, setSubTab] = useState('Current');
  const rows = prescriptions.flatMap((prescription) => getPrescriptionItems(prescription).map((item) => ({
    id: `${prescription.Id || prescription.id}-${item.Id || item.id || item.MedicineName || item.drugName}`,
    name: item.MedicineName || item.drugName || 'Medicine',
    dosage: item.Dosage || item.dose || '—',
    freq: item.Frequency || item.frequency || '—',
    start: formatDate(prescription.RxDate || prescription.date),
    doctor: resolveDoctorName(prescription, 'Not linked'),
    status: isPrescriptionActive(prescription) ? 'Active' : 'Completed',
  })));

  const currentRows = rows.filter((row) => row.status === 'Active');
  const pastRows = rows.filter((row) => row.status !== 'Active');
  const data = subTab === 'Current' ? currentRows : pastRows;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔗</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Medication History</h2>
        </div>
        <button style={S.btn.outline}>Export List</button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {['Current', 'Past'].map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} style={{ background: 'none', border: 'none', borderBottom: subTab === tab ? `2px solid ${BLUE}` : '2px solid transparent', color: subTab === tab ? BLUE : '#6b7280', fontWeight: subTab === tab ? 600 : 400, fontSize: 14, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>{tab}</button>
        ))}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Medication', 'Dosage', 'Frequency', 'Start Date', 'Prescribing Doctor', 'Status'].map((header) => (
                <th key={header} style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '13px 16px', fontSize: 14, color: '#111827', fontWeight: 500 }}>{row.name}</td>
                <td style={{ padding: '13px 16px', fontSize: 14, color: '#374151' }}>{row.dosage}</td>
                <td style={{ padding: '13px 16px', fontSize: 14, color: '#374151' }}>{row.freq}</td>
                <td style={{ padding: '13px 16px', fontSize: 14, color: '#374151' }}>{row.start}</td>
                <td style={{ padding: '13px 16px', fontSize: 14, color: '#374151' }}>{row.doctor}</td>
                <td style={{ padding: '13px 16px' }}><StatusPill status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UploadedDocumentsSection({ reports, documents = [] }) {
  const docs = documents.length
    ? documents.map((document, index) => ({
      id: document.Id || document.id || index,
      name: document.FileName || document.fileName || `Document_${index + 1}`,
      type: document.ContentType || document.contentType || document.FileCategory || document.fileCategory || 'Document',
      size: document.FileSizeBytes || document.fileSizeBytes || 'Stored',
      date: formatDate(document.UploadedAt || document.uploadedAt || document.OrderDate || document.orderDate),
      category: document.FileCategory || document.fileCategory || 'Lab Report',
      orderNumber: document.OrderNumber || document.orderNumber || null,
      testName: document.TestName || document.testName || null,
      url: buildServerFileUrl(document.StoragePath || document.storagePath || document.url),
    }))
    : reports.map((report, index) => ({
      id: report.Id || report.id || index,
      name: `${report.OrderNumber || `Lab_Report_${index + 1}`}.pdf`,
      type: 'PDF',
      size: 'Generated',
      date: formatDate(report.OrderDate || report.date),
      category: 'Lab Report',
      orderNumber: report.OrderNumber || report.orderNumber || null,
      testName: getReportTests(report).map((test) => test.TestName || test.Name).join(', ') || null,
      url: null,
    }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Uploaded Documents</h2>
        <span style={{ background: '#dbeafe', color: BLUE, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>{docs.length} files</span>
      </div>

      <div style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: 24, textAlign: 'center', marginBottom: 20, background: '#f9fafb' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Lab report files uploaded by the technician and doctor review flow appear here automatically.</div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['DOCUMENT', 'TYPE', 'DATE UPLOADED', 'CATEGORY', 'ACTION'].map((header) => (
                <th key={header} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid #e5e7eb' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => {
              const tone = getAttachmentTone({ type: doc.type });
              return (
                <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{doc.name}</div>
                    {doc.orderNumber || doc.testName ? (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{[doc.orderNumber, doc.testName].filter(Boolean).join(' · ')}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                    <span style={{ background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{tone.label}</span>
                    <div style={{ marginTop: 4 }}>{typeof doc.size === 'number' ? formatBytes(doc.size) : doc.size}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{doc.date}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: '#f3f4f6', color: '#374151', fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>{doc.category}</span></td>
                  <td style={{ padding: '12px 16px' }}>
                    {doc.url ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ ...S.btn.outline, textDecoration: 'none', padding: '8px 12px' }}><Eye size={14} /> Open</a>
                        <a href={doc.url} target="_blank" rel="noreferrer" download style={{ ...S.btn.primary, textDecoration: 'none', padding: '8px 12px' }}><Download size={14} /> Download</a>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Use report detail</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useReportDetailModal() {
  const [reportModal, setReportModal] = useState(defaultReportModalState);

  const openReportModal = async (reportSummary = {}) => {
    const reportId = reportSummary?.Id || reportSummary?.id;
    if (!reportId) {
      toast.error('Report details are not available yet.');
      return;
    }

    setReportModal({
      open: true,
      loading: true,
      report: normalizeReportDetail(reportSummary),
    });

    try {
      const payload = getPayload(await api.get(`/reports/${reportId}`));
      setReportModal({
        open: true,
        loading: false,
        report: normalizeReportDetail(payload),
      });
    } catch (error) {
      setReportModal({
        open: true,
        loading: false,
        report: normalizeReportDetail(reportSummary),
      });
      toast.error(error?.message || 'Could not load report details');
    }
  };

  const closeReportModal = () => setReportModal(defaultReportModalState);

  return {
    reportModal,
    openReportModal,
    closeReportModal,
  };
}

export function PatientEmrLabWorkspace({
  profile = {},
  user = {},
  reports = [],
  prescriptions = [],
  appointments = [],
  emr = null,
  vitals = null,
  loading = {},
  onOpenReports,
}) {
  const displayName = getDisplayName(profile, user);
  const [activeTab, setActiveTab] = useState('history');
  const { reportModal, openReportModal, closeReportModal } = useReportDetailModal();

  const tabs = [
    { id: 'history', label: 'Medical History', icon: History },
    { id: 'diagnosis', label: 'Diagnosis Report', icon: FileText },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'lab', label: 'Lab Report', icon: FlaskConical },
    { id: 'notes', label: 'Clinical Notes', icon: Clipboard },
    { id: 'allergies', label: 'Allergy Information', icon: AlertCircle },
    { id: 'medication', label: 'Medication History', icon: Activity },
    { id: 'documents', label: 'Uploaded Documents', icon: Upload },
  ];

  const content = {
    history: <MedicalHistorySection appointments={appointments} reports={reports} encounters={emr?.encounters || []} />,
    diagnosis: <DiagnosisReportSection profile={profile} appointments={appointments} diagnoses={emr?.diagnoses || []} />,
    prescriptions: <PrescriptionsSection prescriptions={prescriptions} />,
    lab: <div><h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>Laboratory Records</h2><ReportTable reports={reports} onViewReport={openReportModal} onUploadComplete={onOpenReports} /></div>,
    notes: <ClinicalNotesSection appointments={appointments} reports={reports} notes={emr?.notes || []} />,
    allergies: <AllergyInfoSection profile={profile} />,
    medication: <MedicationHistorySection prescriptions={prescriptions} />,
    documents: <UploadedDocumentsSection reports={reports} documents={emr?.documents || []} />,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Electronic Medical Record (EMR)</h1>
          <p className="text-sm text-slate-500">{displayName}&apos;s health and clinical history overview.</p>
        </div>
        <button onClick={onOpenReports} style={S.btn.primary}>
          <RefreshCw size={14} /> Open standalone report center
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? 'text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            style={activeTab === tab.id ? { borderColor: BLUE } : {}}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
        {(loading.reports || loading.prescriptions || loading.emr) && activeTab !== 'history' ? (
          <div className="text-sm text-slate-500">Loading medical records...</div>
        ) : (
          content[activeTab]
        )}
        {activeTab === 'history' && vitals ? (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Latest Vitals Snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <div><strong>Blood Sugar:</strong> {vitals.BloodSugar || vitals.bloodSugar || '—'}</div>
              <div><strong>BP:</strong> {vitals.SystolicBP || vitals.systolicBP || '—'}</div>
              <div><strong>Weight:</strong> {vitals.Weight || vitals.weight || '—'}</div>
            </div>
          </div>
        ) : null}
      </div>
      {reportModal.open ? (
        <ReportDetailModal
          report={reportModal.report}
          loading={reportModal.loading}
          onClose={closeReportModal}
        />
      ) : null}
    </div>
  );
}

export function PatientLabReportsWorkspace({
  reports = [],
  loading = false,
  onRefresh,
}) {
  const { reportModal, openReportModal, closeReportModal } = useReportDetailModal();

  return (
    <>
      <div style={{ ...S.card, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Laboratory Records</h2>
            <span style={{ background: '#dbeafe', color: BLUE, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>{reports.length} Results</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onRefresh} style={S.btn.outline}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Reports</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', color: '#6b7280' }}>Loading lab reports...</div>
        ) : (
          <ReportTable reports={reports} onViewReport={openReportModal} onUploadComplete={onRefresh} />
        )}
      </div>
      {reportModal.open ? (
        <ReportDetailModal
          report={reportModal.report}
          loading={reportModal.loading}
          onClose={closeReportModal}
        />
      ) : null}
    </>
  );
}
