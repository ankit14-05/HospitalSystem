import React, { useRef } from 'react';
import toast from 'react-hot-toast';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ACCENT = '#0f766e';

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const isAllowedFile = (file) => {
  const type = String(file?.type || '').toLowerCase();
  return type.includes('pdf') || type.startsWith('video/') || type.startsWith('image/');
};

const getFileIcon = (file) => {
  const type = String(file?.type || '').toLowerCase();
  if (type.includes('pdf')) return { bg: '#fee2e2', color: '#b91c1c', label: 'PDF' };
  if (type.startsWith('video/')) return { bg: '#ffedd5', color: '#c2410c', label: 'VID' };
  if (type.startsWith('image/')) return { bg: '#d1fae5', color: '#065f46', label: 'IMG' };
  return { bg: '#f1f5f9', color: '#475569', label: 'FILE' };
};

export default function StatusUpdateModal({
  isOpen,
  onClose,
  currentStatus,
  nextStatus,
  testData,
  mode = 'collect',
  form = {},
  setForm = () => {},
  saving = false,
  onConfirm,
  accent = ACCENT,
}) {
  const inputRef = useRef(null);

  if (!isOpen) return null;

  const attachments = Array.isArray(form.attachments) ? form.attachments : [];
  const isUpload = mode === 'upload';

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileSelection = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    const invalidTypeCount = selectedFiles.filter((file) => !isAllowedFile(file)).length;
    const oversizedCount = selectedFiles.filter((file) => file.size > MAX_ATTACHMENT_BYTES).length;

    if (invalidTypeCount) toast.error('Only PDF, image, and video files are allowed.');
    if (oversizedCount) toast.error('Each attachment must be 25 MB or smaller.');

    const validFiles = selectedFiles
      .filter((file) => isAllowedFile(file) && file.size <= MAX_ATTACHMENT_BYTES)
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
      }));

    setForm((prev) => ({
      ...prev,
      attachments: [...(Array.isArray(prev.attachments) ? prev.attachments : []), ...validFiles],
    }));

    event.target.value = '';
  };

  const removeAttachment = (attachmentId) => {
    setForm((prev) => ({
      ...prev,
      attachments: (Array.isArray(prev.attachments) ? prev.attachments : []).filter((item) => item.id !== attachmentId),
    }));
  };

  /* ── Upload / Finalize modal (screenshot 4) ─────────────────── */
  if (isUpload) {
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: 20,
      }}>
        <div style={{
          width: '100%', maxWidth: 580,
          maxHeight: '92vh', overflowY: 'auto',
          background: '#fff', borderRadius: 18,
          border: '1px solid #e5e7eb',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
        }}>
          {/* Header */}
          <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#0f172a' }}>Finalize Sample &amp; Upload Results</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#64748b', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>
            {/* Row 1: Sample ID + Date of Sample Collection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Sample ID</label>
                <input
                  readOnly
                  value={testData?.sampleId || 'SMP-XXXX'}
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #dbe1e8', background: '#f8fafc', color: '#334155', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Date of Sample Collection</label>
                <input
                  readOnly
                  value={testData?.collectedDate || testData?.assignedDate || '—'}
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #dbe1e8', background: '#f8fafc', color: '#334155', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Row 2: Current Status + Date of Result */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Current Status</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value="Completed"
                    readOnly
                    style={{ width: '100%', padding: '10px 30px 10px 13px', borderRadius: 9, border: `1px solid ${accent}`, background: '#fff', color: '#0f172a', fontSize: 13, appearance: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="Completed">Completed</option>
                  </select>
                  <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 4l4 4 4-4" /></svg>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Date of Result</label>
                <input
                  type="date"
                  value={form.resultDate || today}
                  onChange={(e) => updateForm('resultDate', e.target.value)}
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Result fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Result Value</label>
                <input
                  value={form.resultValue || ''}
                  onChange={(e) => updateForm('resultValue', e.target.value)}
                  placeholder="e.g. 13.2"
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Unit</label>
                <input
                  value={form.resultUnit || ''}
                  onChange={(e) => updateForm('resultUnit', e.target.value)}
                  placeholder="mg/dL"
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Normal Range</label>
                <input
                  value={form.normalRange || ''}
                  onChange={(e) => updateForm('normalRange', e.target.value)}
                  placeholder="4.0 – 5.6"
                  style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Abnormal flag */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(form.isAbnormal)}
                onChange={(e) => updateForm('isAbnormal', e.target.checked)}
                style={{ width: 15, height: 15, accentColor: accent }}
              />
              Mark this result as abnormal
            </label>

            {/* Remarks */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>Remarks</label>
              <textarea
                value={form.remarks || ''}
                onChange={(e) => updateForm('remarks', e.target.value)}
                rows={2}
                placeholder="Interpretation / report summary"
                style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Attachments */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Attachments</label>
                {attachments.length > 0 && (
                  <span style={{ background: '#0f766e', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '2px 8px' }}>
                    {attachments.length}
                  </span>
                )}
              </div>

              {/* Drop zone */}
              <div
                onClick={() => inputRef.current?.click()}
                style={{
                  border: '2px dashed #d1d5db', borderRadius: 12, padding: '24px 18px',
                  textAlign: 'center', cursor: 'pointer', background: '#f9fafb',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 8px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 3 }}>Drop files to upload</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>PDF, PNG or JPG (Max 25MB)</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,video/*,image/*"
                  multiple
                  onChange={handleFileSelection}
                  style={{ display: 'none' }}
                />
              </div>

              {/* File list */}
              {attachments.length > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {attachments.map((entry) => {
                    const chip = getFileIcon(entry.file);
                    return (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: chip.bg, color: chip.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                          {chip.label}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.file.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{formatBytes(entry.file.size)}</div>
                        </div>
                        <button
                          onClick={() => removeAttachment(entry.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}
                          title="Remove"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '0 24px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={saving}
              style={{ padding: '10px 28px', borderRadius: 9, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.75 : 1 }}
            >
              {saving ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Collect Sample modal (original mode = 'collect') ───────── */
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 580,
        maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 18,
        border: '1px solid #e5e7eb',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
      }}>
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Collect Sample</h2>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: '#64748b' }}>
              {testData?.testType || 'Lab Test'} for {testData?.patientName || 'Patient'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#64748b', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Order ID</label>
              <input readOnly value={testData?.id || 'LAB-XXXX'} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #dbe1e8', background: '#f8fafc', color: '#334155', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Next Status</label>
              <input readOnly value={nextStatus || 'Processing'} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${accent}`, background: '#fff', color: '#0f172a', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Barcode Value</label>
              <input
                value={form.barcodeValue || ''}
                onChange={(e) => updateForm('barcodeValue', e.target.value)}
                placeholder="Scan or enter barcode"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Collection Location</label>
              <input
                value={form.collectionLocation || ''}
                onChange={(e) => updateForm('collectionLocation', e.target.value)}
                placeholder="Collection desk / room"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Technician Note</label>
            <textarea
              value={form.technicianNote || ''}
              onChange={(e) => updateForm('technicianNote', e.target.value)}
              rows={4}
              placeholder="Add any handling note for the next stage"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #dbe1e8', background: '#fff', color: '#0f172a', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={saving} style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.75 : 1 }}>
            {saving ? 'Saving...' : 'Move to Processing'}
          </button>
        </div>
      </div>
    </div>
  );
}
