import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getList, getPayload } from '../../utils/apiPayload';
import { buildServerFileUrl } from '../../utils/fileUrls';
import ProcessSampleModal from '../../components/lab/ProcessSampleModal';
import StatusUpdateModal from '../../components/lab/StatusUpdateModal';
import TestDetailsModal from '../../components/lab/TestDetailsModal';

const ACCENT = '#0f766e';
const ROWS_PER_PAGE = 5;

/* ── Priority config ────────────────────────────────────────────── */
const PRIORITY_CONFIG = {
  High:   { label: 'High',   bg: '#FCEBEB', color: '#E24B4A', border: '#F09595' },
  Normal: { label: 'Normal', bg: '#EAF3DE', color: '#3B6D11', border: '#BDDC9A' },
  Medium: { label: 'Medium', bg: '#FAEEDA', color: '#854F0B', border: '#FAC775' },
  Low:    { label: 'Low',    bg: '#E6F1FB', color: '#185FA5', border: '#A1C9F2' },
};

/* ── Avatar palette ─────────────────────────────────────────────── */
const AVATAR_PALETTE = [
  { bg: '#E6F1FB', color: '#0C447C' },
  { bg: '#EAF3DE', color: '#27500A' },
  { bg: '#EEEDFE', color: '#3C3489' },
  { bg: '#FAEEDA', color: '#633806' },
  { bg: '#FAECE7', color: '#712B13' },
  { bg: '#E1F5EE', color: '#085041' },
];

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 2).join('');

const getAvatarColor = (name = '') => {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

/* ── Helpers ────────────────────────────────────────────────────── */
const formatDateTime = (value, fallback = 'Pending') => {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value, fallback = '—') => {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const mapPriority = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'stat') return 'High';
  if (v === 'urgent') return 'Medium';
  if (v === 'routine') return 'Normal';
  return 'Low';
};

/* ── Tab → status mapping ───────────────────────────────────────── */
// Pending   = backend status 'Pending'
// Collected = backend status 'Processing' (sample collected, being processed)
// Processing = backend status 'Completed' (results entered, awaiting Lab Head)
const mapStatus = (row) => {
  const rawStatus = String(row.Status || '').trim().toLowerCase();
  const workflow  = String(row.WorkflowStage || '').trim().toLowerCase();

  if (rawStatus === 'completed' || workflow === 'doctorreview' || workflow === 'reviewed' || workflow === 'released') {
    return 'Processing'; // "Processing" tab = awaiting/done approval
  }
  if (['processing', 'samplecollected', 'sample collected'].includes(rawStatus)) {
    return 'Collected';
  }
  return 'Pending';
};

const isApproved = (row) => {
  const wf = String(row.WorkflowStage || row.workflowStage || '').toLowerCase();
  return wf === 'released' || Boolean(row.VerifiedAt || row.verifiedAt || row.VerifiedAt);
};

const normalizeRow = (row = {}) => ({
  id:           row.OrderNumber || `LAB-${row.LabOrderId || row.ItemId || '0000'}`,
  itemId:       row.ItemId,
  labOrderId:   row.LabOrderId,
  patientName:  row.PatientName || 'Unknown Patient',
  patientId:    row.UHID || row.PatientId || 'P-0000',
  uhid:         row.UHID || row.PatientId || 'P-0000',
  testType:     row.TestName || 'Lab Test',
  priority:     mapPriority(row.Priority),
  priorityRaw:  row.Priority || 'Routine',
  sampleId:     row.SampleCode || `SMP-${row.ItemId || '0000'}`,
  collectedDate:formatDateTime(row.CollectedAt || row.OrderCollectedAt || row.ReceivedAtLabAt, 'Awaiting collection'),
  resultDate:   formatDate(row.ReportedAt || row.ProcessingCompletedAt, '—'),
  assignedDate: formatDateTime(row.OrderDate, 'Today'),
  status:       mapStatus(row),
  approved:     isApproved(row),
  criteria:     row.CriteriaText || row.ClinicalIndication || 'Standard lab protocol.',
  additionalDetails: row.AdditionalDetails || row.DoctorInstructions || row.Notes || 'No additional notes.',
  place:        'Indoor',
  roomNo:       row.CollectionLocation || row.DepartmentName || 'Collection Desk',
  location:     row.CollectionLocation || row.DepartmentName || 'Collection Desk',
  resultValue:  row.ResultValue || '',
  resultUnit:   row.ResultUnit || row.Unit || '',
  normalRange:  row.NormalRange || '',
  isAbnormal:   Boolean(row.IsAbnormal),
  remarks:      row.Remarks || '',
  technicianNote: row.TechnicianNotes || '',
  hasResult:    Boolean(row.ResultValue || row.ReportedAt),
});

const emptyForm = {
  barcodeValue: '', collectionLocation: '', technicianNote: '',
  resultValue: '', resultUnit: '', normalRange: '',
  isAbnormal: false, remarks: '', attachments: [],
  collectionDate: '', resultDate: '',
};

/* ── SVG Icons ──────────────────────────────────────────────────── */
const Icons = {
  Microscope: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 18h12M12 6l3 5-3 3-3-5z"/><path d="M15 11l2 3"/><path d="M9 21v-5a3 3 0 0 1 3-3"/>
    </svg>
  ),
  Clipboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  Bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5l3 3"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="2" width="14" height="13" rx="2"/><path d="M1 6h14M5 1v2M11 1v2"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 3.5l3 3 3-3"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M9 2L4 7l5 5"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 2l5 5-5 5"/>
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M7 2v10M2 7h10"/>
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  PDF: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#fee2e2"/>
      <text x="12" y="16" textAnchor="middle" fill="#b91c1c" fontSize="8" fontWeight="800">PDF</text>
    </svg>
  ),
  FileOther: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#e0e7ff"/>
      <text x="12" y="16" textAnchor="middle" fill="#4338ca" fontSize="7" fontWeight="800">FILE</text>
    </svg>
  ),
  ShieldCheck: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
    </svg>
  ),
};

/* ── Metric Card ────────────────────────────────────────────────── */
function MetricCard({ label, value, iconBg, iconColor, Icon, valueColor, loading }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e9ee', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 180 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon />
      </div>
      <div>
        <div style={{ fontSize: 12.5, color: '#8a95a3', marginBottom: 3 }}>{label}</div>
        {loading
          ? <div style={{ width: 44, height: 26, background: '#e8ede8', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
          : <div style={{ fontSize: 28, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
        }
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Dashboard
═══════════════════════════════════════════════════════════════════ */
export default function LabTechnicianDashboard() {
  const { user } = useAuth();
  const debounceRef = useRef(null);

  const [activeTab,    setActiveTab]    = useState('Pending');
  const [currentPage,  setCurrentPage]  = useState(1);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [worklist,     setWorklist]     = useState([]);

  // Process Sample modal (Pending → Collected)
  const [processModal, setProcessModal] = useState({ open: false, testData: null });
  const [processForm,  setProcessForm]  = useState({ collectionDate: '', nextStatus: 'Processing' });

  // Upload Result modal (Collected → Processing/Completed)
  const [uploadModal,  setUploadModal]  = useState({ open: false, testData: null });
  const [uploadForm,   setUploadForm]   = useState(emptyForm);

  // Full details modal
  const [detailsModal, setDetailsModal] = useState({ open: false, testData: null, loading: false });

  /* ── Load worklist ─────────────────────────────────────────────── */
  const loadWorklist = useCallback(async () => {
    setLoading(true);
    try {
      const data = getList(await api.get('/reports/worklist', { params: { limit: 250 } }));
      setWorklist(Array.isArray(data) ? data.map(normalizeRow) : []);
    } catch (err) {
      setWorklist([]);
      toast.error(err?.message || 'Could not load lab worklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorklist(); }, [loadWorklist]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  /* ── Metrics ───────────────────────────────────────────────────── */
  const metrics = useMemo(() => ({
    total:      worklist.length,
    pending:    worklist.filter((r) => r.status === 'Pending').length,
    collected:  worklist.filter((r) => r.status === 'Collected').length,
    processing: worklist.filter((r) => r.status === 'Processing').length,
  }), [worklist]);

  /* ── Search + Tab filter ───────────────────────────────────────── */
  const handleSearch = useCallback((value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setSearchQuery(value.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);
  }, []);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery('');
    const el = document.getElementById('lab-search-input');
    if (el) el.value = '';
  };

  const filteredData = useMemo(() => {
    const bucket = worklist.filter((r) => r.status === activeTab);
    if (!searchQuery) return bucket;
    return bucket.filter((r) =>
      [r.id, r.patientName, r.testType, r.sampleId, r.patientId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(searchQuery))
    );
  }, [activeTab, searchQuery, worklist]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ROWS_PER_PAGE));
  const safePage   = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx   = (safePage - 1) * ROWS_PER_PAGE;
  const pageData   = filteredData.slice(startIdx, startIdx + ROWS_PER_PAGE);
  const startItem  = filteredData.length === 0 ? 0 : startIdx + 1;
  const endItem    = Math.min(startIdx + ROWS_PER_PAGE, filteredData.length);

  /* ── Open "Process Sample" modal (Pending tab) ─────────────────── */
  const openProcessModal = (row) => {
    setProcessForm({ collectionDate: new Date().toISOString().slice(0, 10), nextStatus: 'Processing' });
    setProcessModal({ open: true, testData: row });
  };

  /* ── Submit: Pending → Collected (Processing in backend) ───────── */
  const confirmProcess = async () => {
    if (!processModal.testData?.itemId) return;
    setSaving(true);
    try {
      await api.patch(`/reports/items/${processModal.testData.itemId}/collect`, {
        collectionLocation: null,
        technicianNote: null,
        barcodeValue: null,
      });
      toast.success('Sample moved to Collected');
      setProcessModal({ open: false, testData: null });
      await loadWorklist();
    } catch (err) {
      toast.error(err?.message || 'Could not update sample');
    } finally {
      setSaving(false);
    }
  };

  /* ── Open "Upload Result" modal (Collected tab) ────────────────── */
  const openUploadModal = (row) => {
    setUploadForm({
      ...emptyForm,
      resultValue: row.resultValue || '',
      resultUnit:  row.resultUnit  || '',
      normalRange: row.normalRange  || '',
      isAbnormal:  Boolean(row.isAbnormal),
      remarks:     row.remarks || '',
      technicianNote: row.technicianNote || '',
      resultDate: new Date().toISOString().slice(0, 10),
    });
    setUploadModal({ open: true, testData: row });
  };

  /* ── Submit: Collected → Processing (Completed in backend → Lab Head queue) */
  const confirmUpload = async () => {
    if (!uploadModal.testData?.itemId) return;
    setSaving(true);
    try {
      await api.patch(`/reports/items/${uploadModal.testData.itemId}/result`, {
        resultValue:    uploadForm.resultValue  || null,
        resultUnit:     uploadForm.resultUnit   || null,
        normalRange:    uploadForm.normalRange  || null,
        isAbnormal:     uploadForm.isAbnormal,
        remarks:        uploadForm.remarks      || null,
        technicianNote: uploadForm.technicianNote || null,
      });

      if (Array.isArray(uploadForm.attachments) && uploadForm.attachments.length) {
        const fd = new FormData();
        fd.append('labOrderItemId', String(uploadModal.testData.itemId));
        uploadForm.attachments.forEach((a) => {
          if (a?.file) fd.append('files', a.file, a.file.name);
        });
        await api.post(`/reports/${uploadModal.testData.labOrderId}/attachments/files`, fd);
      }

      toast.success('Result uploaded — sent to Lab Head for approval');
      setUploadModal({ open: false, testData: null });
      setUploadForm(emptyForm);
      await loadWorklist();
    } catch (err) {
      toast.error(err?.message || 'Could not upload result');
    } finally {
      setSaving(false);
    }
  };

  /* ── Open full details modal ───────────────────────────────────── */
  const openDetailsModal = useCallback(async (row) => {
    setDetailsModal({ open: true, testData: row, loading: true });
    try {
      const payload = getPayload(await api.get(`/reports/items/${row.itemId}`)) || {};
      const attachments = Array.isArray(payload.attachments)
        ? payload.attachments.map((a) => ({
            ...a,
            url: buildServerFileUrl(a.StoragePath || a.storagePath),
          }))
        : [];
      setDetailsModal({ open: true, loading: false, testData: { ...row, ...payload, attachments } });
    } catch (err) {
      toast.error(err?.message || 'Could not load details');
      setDetailsModal({ open: true, testData: row, loading: false });
    }
  }, []);

  /* ── Table column config per tab ───────────────────────────────── */
  const getTableConfig = () => {
    if (activeTab === 'Pending') {
      return {
        headers: ['TEST ID', 'PATIENT NAME', 'TEST TYPE', 'PRIORITY', 'SAMPLE ID', 'DATE OF SAMPLE COLLECTION', 'ACTIONS'],
        widths:  ['100px', '1.4fr', '1.2fr', '90px', '110px', '1.2fr', '220px'],
      };
    }
    if (activeTab === 'Collected') {
      return {
        headers: ['TEST ID', 'PATIENT NAME', 'TEST TYPE', 'PRIORITY', 'SAMPLE ID', 'DATE OF SAMPLE COLLECTION', 'DATE OF RESULT', 'TEST RESULT', 'ACTIONS'],
        widths:  ['90px', '1.2fr', '1fr', '80px', '100px', '1fr', '90px', '80px', '200px'],
      };
    }
    // Processing tab
    return {
      headers: ['TEST ID', 'PATIENT NAME', 'TEST TYPE', 'SAMPLE ID', 'DATE OF RESULT', 'STATUS', 'ACTIONS'],
      widths:  ['100px', '1.4fr', '1.2fr', '110px', '100px', '120px', '180px'],
    };
  };

  const { headers, widths } = getTableConfig();
  const gridTemplate = widths.join(' ');

  /* ── Tab labels ────────────────────────────────────────────────── */
  const TABS = ['Pending', 'Collected', 'Processing'];
  const TAB_COUNTS = {
    Pending:    metrics.pending,
    Collected:  metrics.collected,
    Processing: metrics.processing,
  };

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: '#f4f6f8', minHeight: '100vh', padding: '24px 28px', color: '#1a1a1a' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        .lt-tab:hover:not(.lt-tab-active){ background:#eeede8!important; }
        .lt-row:hover{ background:#f8f7f3; }
        .btn-primary{ background:${ACCENT};color:#fff;border:none;padding:7px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;transition:0.2s;white-space:nowrap; }
        .btn-primary:hover{ background:#0a5f56; }
        .btn-outline{ background:#fff;color:#1a1a1a;border:1.5px solid #d3d1c7;padding:7px 14px;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;transition:0.2s;white-space:nowrap; }
        .btn-outline:hover{ background:#f3f4f6; }
        .btn-icon{ background:none;border:none;cursor:pointer;color:#64748b;padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:0.2s; }
        .btn-icon:hover{ background:#f1f5f9;color:#0f766e; }
      `}</style>

      {/* ── Stat Cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <MetricCard label="Total Samples"      value={metrics.total}      iconBg="#f0fdf4" iconColor={ACCENT}    Icon={Icons.Microscope}  valueColor="#1a1a1a" loading={loading} />
        <MetricCard label="Pending Collection" value={metrics.pending}    iconBg="#fff7ed" iconColor="#d97706"   Icon={Icons.Clipboard}   valueColor="#d97706" loading={loading} />
        <MetricCard label="Collected Today"    value={metrics.collected}  iconBg="#f0fdf4" iconColor={ACCENT}    Icon={Icons.CheckCircle} valueColor={ACCENT}  loading={loading} />
        <MetricCard label="Processing"         value={metrics.processing} iconBg="#eff6ff" iconColor="#2563eb"   Icon={Icons.Refresh}     valueColor="#2563eb" loading={loading} />
      </div>

      {/* ── Table Card ─────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e5e9ee', borderRadius: 16, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0efe9', background: '#fafaf7', flexWrap: 'wrap' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 3, background: '#eeede8', padding: 4, borderRadius: 10 }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`lt-tab${activeTab === tab ? ' lt-tab-active' : ''}`}
                onClick={() => handleTabClick(tab)}
                style={{
                  background: activeTab === tab ? '#fff' : 'transparent',
                  border: 'none', borderRadius: 7,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? '#1a1a1a' : '#5f5e5a',
                  boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
                  transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {tab}
                {TAB_COUNTS[tab] > 0 && (
                  <span style={{
                    background: activeTab === tab ? ACCENT : '#d1d5db',
                    color: activeTab === tab ? '#fff' : '#374151',
                    borderRadius: 100, fontSize: 10, fontWeight: 700,
                    padding: '1px 6px', lineHeight: 1.6,
                  }}>
                    {TAB_COUNTS[tab]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', border: '1px solid #d3d1c7', borderRadius: 8, background: '#fff', fontSize: 13, color: '#5f5e5a', cursor: 'pointer' }}>
            <Icons.Calendar /> Date Range: Today <Icons.ChevronDown />
          </button>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#b4b2a9' }}><Icons.Search /></span>
            <input
              id="lab-search-input"
              type="text"
              placeholder="Search samples..."
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #d3d1c7', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* New Sample */}
          <button
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', fontSize: 13 }}
          >
            <Icons.Plus /> New Sample
          </button>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, padding: '11px 20px', borderBottom: '1px solid #e5e9ee', background: '#f8f9fb', gap: 10 }}>
          {headers.map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#7c8898', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
          ))}
        </div>

        {/* Table body */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#888780', fontSize: 14 }}>Loading records...</div>
        ) : pageData.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#888780', fontSize: 14 }}>No records found.</div>
        ) : (
          pageData.map((row) => {
            const avatar   = getAvatarColor(row.patientName);
            const priority = PRIORITY_CONFIG[row.priority] || PRIORITY_CONFIG.Normal;

            return (
              <div key={row.itemId} className="lt-row" style={{ display: 'grid', gridTemplateColumns: gridTemplate, padding: '12px 20px', borderBottom: '1px solid #f0efe9', alignItems: 'center', gap: 10, transition: 'background 0.15s' }}>

                {/* Test ID */}
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{row.id}</div>

                {/* Patient */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatar.bg, color: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {getInitials(row.patientName)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.patientName}</div>
                    <div style={{ fontSize: 11, color: '#888780' }}>{row.patientId}</div>
                  </div>
                </div>

                {/* Test Type */}
                <div style={{ fontSize: 13, color: '#4a5568', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.testType}</div>

                {/* Priority */}
                <div>
                  <span style={{ background: priority.bg, color: priority.color, border: `1px solid ${priority.border}`, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {priority.label}
                  </span>
                </div>

                {/* Sample ID */}
                <div style={{ fontSize: 12.5, color: '#4a5568', fontFamily: 'monospace', fontWeight: 500 }}>{row.sampleId}</div>

                {/* Date of Sample Collection */}
                <div style={{ fontSize: 12.5, color: '#5f5e5a' }}>{row.collectedDate}</div>

                {/* Collected tab extra columns */}
                {activeTab === 'Collected' && (
                  <>
                    <div style={{ fontSize: 12.5, color: '#5f5e5a' }}>{row.resultDate}</div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {row.hasResult ? <Icons.PDF /> : <Icons.FileOther />}
                    </div>
                  </>
                )}

                {/* Processing tab extra columns */}
                {activeTab === 'Processing' && (
                  <>
                    <div style={{ fontSize: 12.5, color: '#5f5e5a' }}>{row.resultDate}</div>
                    <div>
                      {row.approved ? (
                        <span style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icons.ShieldCheck /> Signed
                        </span>
                      ) : (
                        <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          Awaiting Sign
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {activeTab === 'Pending' && (
                    <>
                      <button className="btn-primary" onClick={() => openProcessModal(row)} style={{ fontSize: 12, padding: '6px 12px' }}>
                        Process Sample
                      </button>
                      <button className="btn-outline" onClick={() => openDetailsModal(row)} style={{ fontSize: 12, padding: '6px 12px' }}>
                        Check Full Details
                      </button>
                    </>
                  )}
                  {activeTab === 'Collected' && (
                    <>
                      <button className="btn-outline" onClick={() => openUploadModal(row)} style={{ fontSize: 12, padding: '6px 12px' }}>
                        Edit
                      </button>
                      <button className="btn-primary" onClick={() => openDetailsModal(row)} style={{ fontSize: 12, padding: '6px 12px' }}>
                        Check Full Details
                      </button>
                    </>
                  )}
                  {activeTab === 'Processing' && (
                    <>
                      <button className="btn-icon" onClick={() => openDetailsModal(row)} title="View details">
                        <Icons.Eye />
                      </button>
                      <button className="btn-outline" onClick={() => openDetailsModal(row)} style={{ fontSize: 12, padding: '6px 12px' }}>
                        {row.approved ? 'Download Report' : 'View Details'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderTop: '1px solid #e5e9ee', background: '#fafaf7' }}>
          <div style={{ fontSize: 13, color: '#888780' }}>
            {filteredData.length === 0
              ? 'No samples'
              : `Showing ${startItem} to ${endItem} of ${filteredData.length} samples`}
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <button
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              style={{ width: 30, height: 30, borderRadius: 6, background: '#fff', border: '1px solid #d3d1c7', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icons.ChevronLeft />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                style={{
                  width: 30, height: 30, borderRadius: 6,
                  background: safePage === pg ? ACCENT : '#fff',
                  border: `1px solid ${safePage === pg ? ACCENT : '#d3d1c7'}`,
                  color: safePage === pg ? '#fff' : '#1a1a1a',
                  fontWeight: safePage === pg ? 700 : 400,
                  cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {pg}
              </button>
            ))}
            <button
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              style={{ width: 30, height: 30, borderRadius: 6, background: '#fff', border: '1px solid #d3d1c7', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icons.ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}

      {/* Process Sample (Pending → Collected) */}
      <ProcessSampleModal
        isOpen={processModal.open}
        testData={processModal.testData}
        form={processForm}
        setForm={setProcessForm}
        saving={saving}
        onClose={() => setProcessModal({ open: false, testData: null })}
        onConfirm={confirmProcess}
      />

      {/* Finalize / Upload Result (Collected → Processing) */}
      <StatusUpdateModal
        isOpen={uploadModal.open}
        mode="upload"
        testData={uploadModal.testData}
        currentStatus="Collected"
        nextStatus="Completed"
        form={uploadForm}
        setForm={setUploadForm}
        saving={saving}
        onClose={() => { setUploadModal({ open: false, testData: null }); setUploadForm(emptyForm); }}
        onConfirm={confirmUpload}
        accent={ACCENT}
      />

      {/* Full Details */}
      {detailsModal.open && (
        <TestDetailsModal
          test={detailsModal.testData}
          loading={detailsModal.loading}
          onClose={() => setDetailsModal({ open: false, testData: null, loading: false })}
          accent={ACCENT}
        />
      )}
    </div>
  );
}
