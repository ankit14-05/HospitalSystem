import React from 'react';

export default function StatusUpdateModal({
  isOpen,
  onClose,
  currentStatus,
  nextStatus,
  testData,
  mode,
  form,
  setForm,
  saving,
  onConfirm,
  accent = '#0f766e',
}) {
  if (!isOpen) return null;

  const isUpload = mode === 'upload' || nextStatus === 'Completed';
  const title = isUpload ? 'Finalize Sample & Upload Results' : 'Process Sample';
  const displayId = testData?.sampleId || testData?.id || '#SMP-XXXX';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(17, 24, 39, 0.4)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        width: '100%',
        maxWidth: isUpload ? 560 : 500,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111827', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Sample ID</label>
            <input readOnly value={displayId} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{isUpload ? 'Date of Result' : 'Date of Sample Collection'}</label>
            <input
              readOnly
              value={isUpload ? (testData?.resultDate || 'Will stamp on submit') : (testData?.collectedDate || 'Will stamp on submit')}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontSize: 13, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Current Status</label>
            <input readOnly value={`${currentStatus} → ${nextStatus}`} style={{ width: '100%', padding: '10px 14px', border: `1px solid ${accent}`, borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none' }} />
          </div>
          {!isUpload ? (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Collection Location</label>
              <input
                value={form.collectionLocation}
                onChange={(event) => setForm((current) => ({ ...current, collectionLocation: event.target.value }))}
                placeholder="Ward, OPD, collection desk"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none' }}
              />
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Result Unit</label>
              <input
                value={form.resultUnit}
                onChange={(event) => setForm((current) => ({ ...current, resultUnit: event.target.value }))}
                placeholder="g/dL"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none' }}
              />
            </div>
          )}
        </div>

        {!isUpload ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Barcode Value</label>
              <input
                value={form.barcodeValue}
                onChange={(event) => setForm((current) => ({ ...current, barcodeValue: event.target.value }))}
                placeholder="Optional barcode / accession code"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Technician Note</label>
              <textarea
                rows={4}
                value={form.technicianNote}
                onChange={(event) => setForm((current) => ({ ...current, technicianNote: event.target.value }))}
                placeholder="Sample condition, label note, or dispatch comment"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none', resize: 'vertical' }}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Result Value</label>
                <input
                  value={form.resultValue}
                  onChange={(event) => setForm((current) => ({ ...current, resultValue: event.target.value }))}
                  placeholder="12.4"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Reference Range</label>
                <input
                  value={form.normalRange}
                  onChange={(event) => setForm((current) => ({ ...current, normalRange: event.target.value }))}
                  placeholder="13.0 - 17.0"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Remarks</label>
              <textarea
                rows={3}
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                placeholder="Interpretation note or quality check remark"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Technician Note</label>
              <textarea
                rows={3}
                value={form.technicianNote}
                onChange={(event) => setForm((current) => ({ ...current, technicianNote: event.target.value }))}
                placeholder="Internal processing note"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', fontSize: 13, outline: 'none', resize: 'vertical' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontSize: 13, fontWeight: 600, color: '#374151' }}>
              <input
                type="checkbox"
                checked={form.isAbnormal}
                onChange={(event) => setForm((current) => ({ ...current, isAbnormal: event.target.checked }))}
              />
              Mark as abnormal finding
            </label>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Attachments</span>
                <span style={{ fontSize: 11, fontWeight: 700, background: '#ecfeff', padding: '2px 8px', borderRadius: 10, color: accent }}>Backend ready for report files</span>
              </div>
              <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: '#f8fafc' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#64748b' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Drop files to upload</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>PDF, PNG or JPG (attachment API is ready when file upload is added)</div>
              </div>
            </div>
          </>
        )}

        <button
          onClick={onConfirm}
          disabled={saving}
          style={{
            width: '100%',
            background: accent,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.2)',
          }}
        >
          {saving ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
