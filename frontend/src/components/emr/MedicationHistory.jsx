import React, { useState, useEffect } from "react";
import { Icon, S, Pagination } from "./shared";
import api from "../../services/api";
import toast from "react-hot-toast";

const PER_PAGE = 10;
const COLS = ["Medication","Dosage","Frequency","Start Date","Prescribing Doctor","Status"];

export default function MedicationHistory({ patientId }) {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("Current");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!patientId) return;

    const fetchMeds = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patientId}/medication-history`);
        setMedications(res.data?.data || res.data || []);
      } catch (err) {
        toast.error("Failed to load medication history");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMeds();
  }, [patientId]);

  const filtered = medications.filter(m => {
    const isPast = ['Discontinued', 'Completed', 'Expired'].includes(m.Status);
    return subTab === "Current" ? !isPast : isPast;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const rows = filtered.slice(start, start + PER_PAGE);

  if (loading && medications.length === 0) {
    return (
      <div style={{ ...S.card, marginTop: 20, textAlign: 'center', padding: '40px' }}>
        <div className="spinner w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Loading medication records...</p>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔗</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Medication History</h2>
        </div>
        <button style={S.btn.outline}><Icon.Export /> Export List</button>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
        {["Current","Past"].map(t => (
          <button key={t} onClick={() => { setSubTab(t); setPage(1); }} style={{
            background: "none", border: "none", borderBottom: subTab === t ? "2px solid #4f46e5" : "2px solid transparent",
            color: subTab === t ? "#4f46e5" : "#6b7280", fontWeight: subTab === t ? 600 : 400,
            fontSize: 14, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {COLS.map(col => (
                <th key={col} style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "left", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: "24px", textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No medication records found.</td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const isPast = ['Discontinued', 'Completed', 'Expired'].includes(r.Status);
                const statusColor = r.Status === 'Active' ? "#16a34a" : isPast ? "#6b7280" : "#d97706";
                const statusBg = r.Status === 'Active' ? "#f0fdf4" : isPast ? "#f3f4f6" : "#fffbeb";
                
                return (
                  <tr key={r.Id || i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "13px 16px", fontSize: 14, color: "#111827", fontWeight: 500 }}>{r.MedicineName}</td>
                    <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{r.Dosage}</td>
                    <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{r.Frequency}</td>
                    <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{new Date(r.StartDate).toLocaleDateString()}</td>
                    <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{r.DoctorName || 'System'}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", background: statusBg, borderRadius: 20, padding: "4px 12px", width: "fit-content", gap: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: statusColor }}>
                          {r.Status}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={filtered.length} perPage={PER_PAGE} onChange={p => { setPage(p); }} />
      )}
    </div>
  );
}