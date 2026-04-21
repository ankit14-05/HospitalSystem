import React from 'react';

const ACCENT = '#0f766e';

export default function ProcessSampleModal({
  isOpen,
  onClose,
  testData,
  form = {},
  setForm = () => {},
  saving = false,
  onConfirm,
}) {
  if (!isOpen) return null;

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: '#fff', borderRadius: 18,
        border: '1px solid #e5e7eb',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Process Sample</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, color: '#64748b', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'grid', gap: 18 }}>
          {/* Sample ID */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Sample ID
            </label>
            <input
              readOnly
              value={testData?.sampleId || 'SMP-XXXX'}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1px solid #dbe1e8', background: '#f8fafc',
                color: '#334155', fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date of Sample Collection */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Date of Sample Collection
            </label>
            <div style={{ position: 'relative' }}>
              <svg
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}
                width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              >
                <rect x="1" y="2" width="14" height="13" rx="2" />
                <path d="M1 6h14M5 1v2M11 1v2" />
              </svg>
              <input
                type="date"
                value={form.collectionDate || today}
                onChange={(e) => updateForm('collectionDate', e.target.value)}
                style={{
                  width: '100%', padding: '11px 14px 11px 36px', borderRadius: 10,
                  border: '1px solid #dbe1e8', background: '#fff',
                  color: '#0f172a', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Current Status */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Current Status
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={form.nextStatus || 'Processing'}
                onChange={(e) => updateForm('nextStatus', e.target.value)}
                style={{
                  width: '100%', padding: '11px 36px 11px 14px', borderRadius: 10,
                  border: '1px solid #dbe1e8', background: '#fff',
                  color: '#0f172a', fontSize: 14, appearance: 'none',
                  boxSizing: 'border-box', cursor: 'pointer',
                }}
              >
                <option value="Processing">Processing</option>
              </select>
              <svg
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}
                width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <path d="M2 4l4 4 4-4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'stretch' }}>
          <button
            onClick={onConfirm}
            disabled={saving}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.75 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {saving ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
