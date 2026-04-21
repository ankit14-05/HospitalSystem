import React from "react";
import { Icon } from "../emr/shared";
import { buildServerFileUrl } from "../../utils/fileUrls";

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const getAttachmentTone = (attachment = {}) => {
  const type = String(attachment.ContentType || attachment.contentType || '').toLowerCase();
  if (type.includes('pdf'))       return { bg: '#fee2e2', color: '#b91c1c', label: 'PDF' };
  if (type.startsWith('video/'))  return { bg: '#ffedd5', color: '#c2410c', label: 'VID' };
  if (type.startsWith('image/'))  return { bg: '#d1fae5', color: '#065f46', label: 'IMG' };
  return { bg: '#f1f5f9', color: '#475569', label: 'FILE' };
};

const InfoRow = ({ label, value }) => (
  <div style={{ marginBottom: 8, display: 'flex', gap: 0 }}>
    <span style={{ fontSize: 13, color: '#64748b', display: 'inline-block', minWidth: 90 }}>{label}:</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{value || '—'}</span>
  </div>
);

export default function TestDetailsModal({ test, loading = false, onClose, onApprove, onReject, accent = '#0f766e' }) {
  if (!test) return null;

  const isApproved = Boolean(test.VerifiedAt || test.verifiedAt);
  const hasAttachments = Array.isArray(test.attachments) && test.attachments.length > 0;

  const handleDownloadAll = () => {
    if (!hasAttachments) return;
    test.attachments.forEach((att) => {
      const url = att.url || buildServerFileUrl(att.StoragePath || att.storagePath);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = att.FileName || att.fileName || 'attachment';
        a.target = '_blank';
        a.click();
      }
    });
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(17, 24, 39, 0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1100, padding: "20px",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680,
        boxShadow: "0 20px 40px rgba(0,0,0,0.14)",
        overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "92vh",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, color: "#0f172a", fontWeight: 700 }}>Lab Test Full Details</h2>
              {isApproved && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#d1fae5', color: '#065f46',
                  border: '1px solid #6ee7b7',
                  padding: '3px 10px', borderRadius: 100,
                  fontSize: 11.5, fontWeight: 700,
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  Digitally Signed
                </span>
              )}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>Order ID: {test.id || test.OrderNumber || "LAB-XXXX"}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 8, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "none"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>Loading report details...</div>
          ) : (
            <>
              {/* Patient + Test Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>Patient Information</h3>
                  <InfoRow label="Name"     value={test.patientName}       />
                  <InfoRow label="UHID/ID"  value={test.uhid}              />
                  <InfoRow label="Location" value={`${test.place || 'Indoor'} – ${test.roomNo || 'Collection Desk'}`} />
                </div>
                <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>Test Information</h3>
                  <InfoRow label="Test"     value={test.testType || test.testName} />
                  <InfoRow label="Priority" value={test.priority}          />
                  <InfoRow label="Date"     value={test.assignedDate || test.date} />
                </div>
              </div>

              {/* Digital Signature block (when approved) */}
              {isApproved && (
                <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <path d="M9 12l2 2 4-4"/>
                    </svg>
                    VERIFIED &amp; DIGITALLY SIGNED
                  </div>
                  <div style={{ fontSize: 12.5, color: '#374151' }}>
                    Approved on {new Date(test.VerifiedAt || test.verifiedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}

              {/* Doctor's Criteria */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ background: "#f1f5f9", padding: "9px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 12.5, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon.Prescription /> Doctor's Criteria &amp; Suggestions
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 4 }}>Criteria:</div>
                  <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#0f172a", lineHeight: 1.5 }}>
                    {test.criteria || "Standard lab protocol should be followed."}
                  </p>
                  <div style={{ background: "#fffbeb", borderLeft: "3px solid #f59e0b", padding: "10px 12px", borderRadius: "0 8px 8px 0", fontSize: 13.5, color: "#92400e", lineHeight: 1.5 }}>
                    {test.additionalDetails || "No additional notes."}
                  </div>
                </div>
              </div>

              {/* Report Files */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "9px 16px", borderBottom: "1px solid #e2e8f0", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#475569" }}>Uploaded Report Files</span>
                  {hasAttachments && (
                    <span style={{ background: '#0f766e', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '1px 8px' }}>
                      {test.attachments.length}
                    </span>
                  )}
                </div>
                <div style={{ padding: 14 }}>
                  {hasAttachments ? (
                    <div style={{ display: 'grid', gap: 9 }}>
                      {test.attachments.map((att, idx) => {
                        const tone   = getAttachmentTone(att);
                        const fileUrl = att.url || buildServerFileUrl(att.StoragePath || att.storagePath);
                        return (
                          <div key={att.Id || att.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 13px', background: '#fff' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: tone.bg, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                              {tone.label}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {att.FileName || att.fileName || 'Attachment'}
                              </div>
                              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                {formatBytes(att.FileSizeBytes || att.fileSizeBytes || 0)}
                              </div>
                            </div>
                            {fileUrl && (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={att.FileName || att.fileName}
                                style={{ fontSize: 13, fontWeight: 700, color: accent, textDecoration: 'none', padding: '5px 10px', border: `1px solid ${accent}`, borderRadius: 7, whiteSpace: 'nowrap' }}
                              >
                                Download
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>No uploaded files found for this report yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Lab Incharge action buttons (optional) */}
            {onApprove && !isApproved && (
              <button
                onClick={onApprove}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Approve &amp; Sign
              </button>
            )}
            {onReject && !isApproved && (
              <button
                onClick={onReject}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Reject
              </button>
            )}
            {/* Download all for approved results */}
            {isApproved && hasAttachments && (
              <button
                onClick={handleDownloadAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${accent}`, background: '#fff', color: accent, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Report
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            style={{ background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
