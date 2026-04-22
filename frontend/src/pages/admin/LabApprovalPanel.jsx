import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Check, X, FlaskConical, User, Clock, MapPin } from 'lucide-react';

export default function LabApprovalPanel() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lab/pending-transfers');
      if (res.success) setPending(res.data);
    } catch (err) {
      toast.error("Failed to fetch pending transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (assignmentId, action) => {
    try {
      if (action === 'approve') {
        const res = await api.post('/lab/approve-transfer', { assignmentId });
        if (res.success) toast.success("Transfer approved");
      } else {
        const res = await api.post('/lab/reject-transfer', { assignmentId });
        if (res.success) toast.success("Transfer rejected");
      }
      fetchPending();
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ background: '#6d28d9', color: '#fff', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(109, 40, 217, 0.2)' }}>
          <FlaskConical size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1a1a1a', margin: 0 }}>Lab Transfer Approvals</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Review and confirm staff movements across laboratory stations</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #6d28d9', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : pending.length === 0 ? (
        <div style={{ background: '#fff', padding: '80px 40px', borderRadius: '24px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'inline-flex', background: '#f8fafc', padding: '24px', borderRadius: '50%', marginBottom: '20px' }}>
            <Check size={48} color="#94a3b8" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>Queue is Clear</h2>
          <p style={{ color: '#64748b', marginTop: '8px' }}>There are no pending lab technician transfer requests at this time.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
          {pending.map(item => (
            <div key={item.Id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', background: '#ede9fe', color: '#6d28d9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{item.TechnicianName}</h3>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{item.AssignmentType}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>Pending</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '14px' }}>
                    <MapPin size={16} />
                    <span>Requested Station: <strong>{item.RoomNo} - {item.RoomType}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '14px' }}>
                    <Clock size={16} />
                    <span>Requested At: {new Date(item.AssignedAt).toLocaleString()}</span>
                  </div>
                  {item.Notes && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', fontSize: '13px', color: '#64748b', border: '1px solid #f1f5f9' }}>
                      <strong>Note:</strong> {item.Notes}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button 
                    onClick={() => handleAction(item.Id, 'approve')}
                    style={{ flex: 1, background: '#6d28d9', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <Check size={18} /> Approve Transfer
                  </button>
                  <button 
                    onClick={() => handleAction(item.Id, 'reject')}
                    style={{ background: '#fff', color: '#ef4444', border: '1px solid #fee2e2', padding: '12px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                    title="Reject"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
