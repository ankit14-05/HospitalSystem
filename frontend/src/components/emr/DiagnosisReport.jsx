import React, { useState, useEffect } from "react";
import { Icon, S } from "./shared";
import api from "../../services/api";
import toast from "react-hot-toast";

const FILTER_OPTIONS = ["All", "Severe", "Moderate", "Mild"];

export default function DiagnosisReport({ patientId }) {
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (!patientId) return;

    const fetchDiagnoses = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patientId}/diagnoses`);
        setDiagnoses(res.data?.data || res.data || []);
      } catch (err) {
        toast.error("Failed to load diagnoses");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiagnoses();
  }, [patientId]);

  const filtered = filter === "All" ? diagnoses : diagnoses.filter(d => d.Severity === filter);

  if (loading) {
    return (
      <div style={{ ...S.card, marginTop: 20, textAlign: 'center', padding: '40px' }}>
        <div className="spinner w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Loading reports...</p>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Diagnosis Reports</h2>
        <div style={{ position: "relative" }}>
          <button style={S.btn.outline} onClick={() => setShowFilter(v => !v)}>
            <Icon.Filter /> Filter by Severity <Icon.ChevronDown />
          </button>
          {showFilter && (
            <div style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, minWidth: 140, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              {FILTER_OPTIONS.map(opt => (
                <div key={opt} onClick={() => { setFilter(opt); setShowFilter(false); }}
                  style={{ padding: "9px 16px", fontSize: 13, cursor: "pointer", color: filter === opt ? "#4f46e5" : "#374151", fontWeight: filter === opt ? 600 : 400, background: filter === opt ? "#f5f3ff" : "transparent" }}>
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: 14 }}>
            No diagnoses found matching the filter.
          </div>
        ) : (
          filtered.map((d, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", borderLeft: `4px solid ${d.Severity === 'Severe' ? '#ef4444' : d.Severity === 'Moderate' ? '#f59e0b' : '#3b82f6'}` }}>
              <div style={{ padding: "16px 18px" }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{d.DiagnosisName}</span>
                  <span style={{ 
                    ...S.pill(
                      d.Severity === 'Severe' ? '#fee2e2' : d.Severity === 'Moderate' ? '#fef9c3' : '#eff6ff', 
                      d.Severity === 'Severe' ? '#991b1b' : d.Severity === 'Moderate' ? '#854d0e' : '#1d4ed8'
                    ) 
                  }}>{d.Severity || 'Unknown'}</span>
                </div>
                {/* Doctor row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  </svg>
                  <span>
                    {d.DoctorName || 'System'} · {d.DiagnosisType || 'Primary'} · {new Date(d.DiagnosedDate).toLocaleDateString()}
                  </span>
                </div>
                {/* Status + actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                    <div style={{ color: d.Status === 'Active' ? "#ef4444" : "#16a34a" }}><Icon.CheckCircle /></div>
                    {d.Status}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={S.btn.outline}>View Full Report</button>
                    <button style={S.btn.teal}><Icon.Download /> Download PDF</button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}