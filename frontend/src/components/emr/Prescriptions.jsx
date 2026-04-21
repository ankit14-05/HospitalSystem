import React, { useState, useEffect } from "react";
import { Icon, S, Pagination, DoctorAvatar } from "./shared";
import api from "../../services/api";
import toast from "react-hot-toast";

const PER_PAGE = 4;

export default function Prescriptions({ patientId }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!patientId) return;

    const fetchPrescriptions = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patientId}/prescriptions`, {
          params: { page, limit: PER_PAGE }
        });
        const data = res.data?.data || res.data || [];
        setPrescriptions(data);
        setTotal(res.data?.total || data.length);
      } catch (err) {
        toast.error("Failed to load prescriptions");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptions();
  }, [patientId, page]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const DOT = (color) => <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", marginRight: 5 }} />;

  if (loading && prescriptions.length === 0) {
    return (
      <div style={{ ...S.card, marginTop: 20, textAlign: 'center', padding: '40px' }}>
        <div className="spinner w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Loading prescriptions...</p>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Prescription History</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Manage and track patient medication records</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn.outline}><Icon.Filter /> Filter</button>
          <button style={S.btn.primary}><Icon.Plus /> Issue Prescription</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["DATE ISSUED","DOCTOR","MEDICATIONS","STATUS","ACTIONS"].map(h => (
                <th key={h} style={{ padding: "11px 16px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textAlign: "left", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prescriptions.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: "24px", textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No prescriptions found.</td>
              </tr>
            ) : (
              prescriptions.map((r, i) => {
                const isActive = r.Status === 'Active';
                const statusColor = isActive ? "#16a34a" : r.Status === 'Refill Required' ? "#d97706" : "#dc2626";
                const statusBg = isActive ? "#f0fdf4" : r.Status === 'Refill Required' ? "#fffbeb" : "#fef2f2";

                return (
                  <tr key={r.Id || i} style={{ borderBottom: i < prescriptions.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "14px 16px", fontSize: 14, color: "#374151" }}>{new Date(r.CreatedAt).toLocaleDateString()}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <DoctorAvatar name={r.DoctorName || 'Doc'} size={34} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{r.DoctorName}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{r.Specialty || 'Clinical Staff'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{r.MedicineName}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{r.Dosage} · {r.Frequency} · {r.Duration}</div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", background: statusBg, borderRadius: 20, padding: "4px 10px", width: "fit-content" }}>
                        {DOT(statusColor)}
                        <span style={{ fontSize: 13, fontWeight: 500, color: statusColor }}>{r.Status}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#4f46e5", padding: 4 }}>
                        <Icon.Download />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} perPage={PER_PAGE} onChange={setPage} />
    </div>
  );
}