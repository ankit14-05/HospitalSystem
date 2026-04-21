import React from 'react';

export default function TestDetailsModal({ test, onClose, accent = '#0f766e' }) {
  if (!test) return null;

  const priorityTone = test.priority === 'High'
    ? { background: '#fee2e2', color: '#dc2626' }
    : test.priority === 'Medium'
      ? { background: '#fef3c7', color: '#b45309' }
      : { background: '#e5f3ef', color: accent };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(17, 24, 39, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 650,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f8fafc',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>Lab Test Full Details</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Order ID: {test.id || 'LAB-XXXX'}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: 8,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>Patient Information</h3>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: '#64748b', display: 'inline-block', width: 80 }}>Name:</span> <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{test.patientName || 'Unknown Patient'}</span></div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: '#64748b', display: 'inline-block', width: 80 }}>UHID/ID:</span> <span style={{ fontSize: 14, color: '#334155' }}>{test.uhid || test.patientId || 'N/A'}</span></div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: '#64748b', display: 'inline-block', width: 80 }}>Location:</span> <span style={{ fontSize: 14, color: '#334155' }}>{test.place || 'Indoor'} - {test.roomNo || test.location || 'Collection Desk'}</span></div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>Test Information</h3>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: '#64748b', display: 'inline-block', width: 80 }}>Test Type:</span> <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{test.testType || test.testName || 'Standard Test'}</span></div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#64748b', display: 'inline-block', width: 80 }}>Priority:</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 12,
                  ...priorityTone,
                }}>
                  {test.priority || 'Normal'}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: '#64748b', display: 'inline-block', width: 80 }}>Date:</span> <span style={{ fontSize: 14, color: '#334155' }}>{test.date || test.assignedDate || test.orderedAt || 'Today'}</span></div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{
              background: '#f1f5f9',
              padding: '10px 16px',
              borderBottom: '1px solid #e2e8f0',
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
            }}>
              Doctor&apos;s Criteria And Suggestions
            </div>
            <div style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#64748b', fontWeight: 500 }}>Criteria for this test:</h4>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#0f172a', lineHeight: 1.5 }}>
                {test.criteria || 'Standard lab protocol should be followed. Please adhere to fasting requirements if applicable.'}
              </p>

              <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#64748b', fontWeight: 500 }}>Additional Details:</h4>
              <div style={{
                background: '#f0fdf4',
                borderLeft: `3px solid ${accent}`,
                padding: 12,
                borderRadius: '0 8px 8px 0',
                fontSize: 14,
                color: '#134e4a',
                lineHeight: 1.5,
              }}>
                {test.additionalDetails || 'No additional handling note has been shared for this test yet.'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: '#fff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
