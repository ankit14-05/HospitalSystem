import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import TestDetailsModal from '../../components/lab/TestDetailsModal';
import SignatureSettings from '../../components/lab/SignatureSettings';

const ACCENT = '#0f766e';
const ROWS_PER_PAGE = 8;

/* ── SVG Icons ──────────────────────────────────────────────────── */
const Icons = {
  Shield:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  FileCheck:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>,
  Clock:       () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  CheckCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>,
  XCircle:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>,
  Eye:         () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  PenTool:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
  Search:      () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>,
  ChevLeft:    () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 2L4 7l5 5"/></svg>,
  ChevRight:   () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 2l5 5-5 5"/></svg>,
  Refresh:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

/* ── Metric Card ────────────────────────────────────────────────── */
function MetricCard({ label, value, icon, iconBg, iconColor, valueColor, loading }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e9ee', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 160 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12.5, color: '#8a95a3', marginBottom: 3 }}>{label}</div>
        {loading
          ? <div style={{ width: 44, height: 26, background: '#e8ede8', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
          : <div style={{ fontSize: 28, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value ?? '—'}</div>
        }
      </div>
    </div>
  );
}

/* ── Reject Modal ───────────────────────────────────────────────── */
function RejectModal({ open, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('');

  useEffect(() => { if (!open) setReason(''); }, [open]);

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Reject Lab Result</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>This will send the result back to the Lab Technician for revision.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#64748b', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Reason for Rejection <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Describe what needs to be corrected..."
            autoFocus
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#0f172a', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            onFocus={(e) => { e.target.style.borderColor = '#ef4444'; }}
            onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
          />
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm(reason)}
            style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: !reason.trim() ? '#fca5a5' : '#ef4444', color: '#fff', fontSize: 14, fontWeight: 700, cursor: !reason.trim() || loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Rejecting...' : 'Reject Result'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Approve Confirmation Modal ─────────────────────────────────── */
function ApproveModal({ open, order, onClose, onConfirm, loading }) {
  if (!open || !order) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Confirm Digital Signature</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>This will digitally sign and approve the lab result, sending it to the doctor for final review.</p>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#065f46', fontWeight: 600, marginBottom: 8 }}>Result Preview</div>
            <div style={{ fontSize: 13, color: '#374151' }}><strong>Order:</strong> {order.OrderNumber}</div>
            <div style={{ fontSize: 13, color: '#374151' }}><strong>Patient:</strong> {order.PatientName} ({order.UHID})</div>
            <div style={{ fontSize: 13, color: '#374151' }}><strong>Tests:</strong> {order.TestNames}</div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#92400e' }}>
            ⚠️ This action cannot be undone. The result will be marked as verified and signed.
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Icons.CheckCircle />
            {loading ? 'Signing...' : 'Approve & Sign'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Dashboard
═══════════════════════════════════════════════════════════════════ */
export default function LabInchargeDashboard() {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [currentPage,   setCurrentPage]   = useState(1);
  const [activeTab,     setActiveTab]     = useState('approvals');
  const [processingId,  setProcessingId]  = useState(null);

  // Modals
  const [detailsModal, setDetailsModal] = useState({ open: false, testData: null });
  const [rejectModal,  setRejectModal]  = useState({ open: false, orderId: null });
  const [approveModal, setApproveModal] = useState({ open: false, order: null });

  /* ── Load pending approvals ────────────────────────────────────── */
  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/lab/pending-approvals');
      setPendingOrders(res.success ? (res.orders || []) : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  /* ── Approve ───────────────────────────────────────────────────── */
  const handleApprove = async () => {
    const orderId = approveModal.order?.Id;
    if (!orderId) return;
    try {
      setProcessingId(orderId);
      toast.loading('Digitally signing & approving...', { id: `approve-${orderId}` });
      const res = await api.post(`/lab/orders/${orderId}/approve`);
      if (res.success) {
        toast.success(res.message, { id: `approve-${orderId}` });
        setApproveModal({ open: false, order: null });
        setDetailsModal({ open: false, testData: null });
        fetchPending();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Approval failed', { id: `approve-${orderId}` });
    } finally {
      setProcessingId(null);
    }
  };

  /* ── Reject ────────────────────────────────────────────────────── */
  const handleReject = async (reason) => {
    const orderId = rejectModal.orderId;
    if (!orderId || !reason?.trim()) return;
    try {
      setProcessingId(orderId);
      toast.loading('Rejecting result...', { id: `reject-${orderId}` });
      const res = await api.post(`/lab/orders/${orderId}/reject`, { reason });
      if (res.success) {
        toast.success(res.message, { id: `reject-${orderId}` });
        setRejectModal({ open: false, orderId: null });
        setDetailsModal({ open: false, testData: null });
        fetchPending();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Rejection failed', { id: `reject-${orderId}` });
    } finally {
      setProcessingId(null);
    }
  };

  /* ── View Details ──────────────────────────────────────────────── */
  const handleViewDetails = async (orderId) => {
    try {
      toast.loading('Loading report...', { id: 'viewD' });
      const res = await api.get(`/lab/orders/${orderId}`);
      if (res.success) {
        setDetailsModal({ open: true, testData: res.data });
        toast.success('Loaded', { id: 'viewD' });
      }
    } catch (err) {
      toast.error('Error loading details', { id: 'viewD' });
    }
  };

  /* ── Filter ────────────────────────────────────────────────────── */
  const filteredData = pendingOrders.filter((o) => {
    const q = searchQuery.toLowerCase();
    return (
      String(o.OrderNumber || '').toLowerCase().includes(q) ||
      String(o.PatientName || '').toLowerCase().includes(q) ||
      String(o.UHID       || '').toLowerCase().includes(q) ||
      String(o.TestNames  || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
  const pageData   = filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: '#f4f6f8', minHeight: '100vh', padding: '24px 28px', color: '#1a1a1a' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* ── Stat Cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <MetricCard label="Total Pending"    value={pendingOrders.length} icon={<Icons.FileCheck />} iconBg="#f0fdf4" iconColor={ACCENT}  valueColor="#1a1a1a" loading={loading} />
        <MetricCard label="Urgent"           value={pendingOrders.filter((o) => o.Priority === 'STAT').length} icon={<Icons.XCircle />}    iconBg="#fef2f2" iconColor="#dc2626" valueColor="#dc2626" loading={loading} />
        <MetricCard label="Scheduled Today"  value={pendingOrders.filter((o) => o.ReportedAt && new Date(o.ReportedAt).toDateString() === new Date().toDateString()).length} icon={<Icons.Clock />}     iconBg="#eff6ff" iconColor="#2563eb" valueColor="#2563eb" loading={loading} />
        <MetricCard label="Overdue"          value={pendingOrders.filter((o) => o.ReportedAt && (Date.now() - new Date(o.ReportedAt).getTime()) > 24 * 60 * 60 * 1000).length} icon={<Icons.Clock />}     iconBg="#fff7ed" iconColor="#d97706" valueColor="#d97706" loading={loading} />
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 3, background: '#eeede8', padding: 4, borderRadius: 12, width: 'fit-content', marginBottom: 20 }}>
        {[
          { key: 'approvals', label: 'Pending Approvals', Icon: Icons.FileCheck },
          { key: 'settings',  label: 'Signature Settings', Icon: Icons.PenTool },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 20px', borderRadius: 9, border: 'none',
              background: activeTab === key ? '#fff' : 'transparent',
              fontSize: 13, fontWeight: activeTab === key ? 700 : 500,
              color: activeTab === key ? '#1a1a1a' : '#5f5e5a',
              boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
              cursor: 'pointer', transition: 'all 0.18s',
            }}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'approvals' ? (
        <div style={{ background: '#fff', border: '1px solid #e5e9ee', borderRadius: 16, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid #f0efe9', background: '#fafaf7' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#b4b2a9' }}><Icons.Search /></span>
              <input
                type="text"
                placeholder="Search by Order ID, Patient, or Test..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #d3d1c7', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={fetchPending} style={{ display: 'flex', align: 'center', gap: 7, padding: '8px 14px', border: '1px solid #d3d1c7', borderRadius: 8, background: '#fff', fontSize: 13, color: '#5f5e5a', cursor: 'pointer' }}>
              <Icons.Refresh /> Refresh
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  {['Order Details', 'Patient', 'Tests', 'Uploaded On', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 20px', fontSize: 11, fontWeight: 700, color: '#7c8898', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#888780', fontSize: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      Loading pending approvals...
                    </div>
                  </td></tr>
                ) : pageData.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#888780', fontSize: 14 }}>
                    No results pending approval.
                  </td></tr>
                ) : (
                  pageData.map((order) => (
                    <tr key={order.Id} style={{ borderBottom: '1px solid #f0efe9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { if (e.currentTarget) e.currentTarget.style.background = '#f8f9fb'; }}
                      onMouseLeave={(e) => { if (e.currentTarget) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{order.OrderNumber}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: order.Priority === 'STAT' ? '#ef4444' : '#94a3b8', display: 'inline-block' }} />
                          <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>{order.Priority} Priority</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{order.PatientName}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{order.UHID}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 13, color: '#4a5568', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.TestNames}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                          {order.ReportedAt ? new Date(order.ReportedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                          {order.ReportedAt ? new Date(order.ReportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* View */}
                          <button
                            onClick={() => handleViewDetails(order.Id)}
                            style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            title="View Report"
                          >
                            <Icons.Eye />
                          </button>
                          {/* Approve */}
                          <button
                            disabled={processingId === order.Id}
                            onClick={() => setApproveModal({ open: true, order })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', borderRadius: 8, border: 'none',
                              background: processingId === order.Id ? '#d1d5db' : ACCENT,
                              color: '#fff', fontSize: 13, fontWeight: 700,
                              cursor: processingId === order.Id ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Icons.CheckCircle /> Approve Result
                          </button>
                          {/* Reject */}
                          <button
                            disabled={processingId === order.Id}
                            onClick={() => setRejectModal({ open: true, orderId: order.Id })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', borderRadius: 8,
                              border: '1.5px solid #fca5a5',
                              background: '#fff', color: '#dc2626',
                              fontSize: 13, fontWeight: 700,
                              cursor: processingId === order.Id ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                              opacity: processingId === order.Id ? 0.5 : 1,
                            }}
                          >
                            <Icons.XCircle /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '13px 20px', background: '#fafaf7', borderTop: '1px solid #e5e9ee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: '#888780' }}>Page {currentPage} of {totalPages}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ width: 30, height: 30, borderRadius: 6, background: '#fff', border: '1px solid #d3d1c7', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icons.ChevLeft />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ width: 30, height: 30, borderRadius: 6, background: '#fff', border: '1px solid #d3d1c7', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icons.ChevRight />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <SignatureSettings />
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {detailsModal.open && (
        <TestDetailsModal
          test={detailsModal.testData}
          onClose={() => setDetailsModal({ open: false, testData: null })}
          onApprove={() => setApproveModal({ open: true, order: approveModal.order || detailsModal.testData })}
          onReject={() => setRejectModal({ open: true, orderId: detailsModal.testData?.Id || detailsModal.testData?.id })}
          accent={ACCENT}
        />
      )}

      <RejectModal
        open={rejectModal.open}
        loading={processingId === rejectModal.orderId}
        onClose={() => setRejectModal({ open: false, orderId: null })}
        onConfirm={handleReject}
      />

      <ApproveModal
        open={approveModal.open}
        order={approveModal.order}
        loading={processingId === approveModal.order?.Id}
        onClose={() => setApproveModal({ open: false, order: null })}
        onConfirm={handleApprove}
      />
    </div>
  );
}
