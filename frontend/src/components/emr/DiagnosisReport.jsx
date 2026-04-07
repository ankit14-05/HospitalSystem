import { useState } from "react";
import { Icon, S } from "./shared";

const DIAGNOSES = [
  {
    title: "Hypertension - Stage 1",
    severity: "Severe", severityBg: "#fee2e2", severityColor: "#991b1b",
    doctor: "Dr. Sharma", specialty: "Cardiology", date: "Diagnosed: 15 Feb 2026",
    status: "Controlled with medication",
    borderColor: "#0d9488",
  },
  {
    title: "Type 2 Diabetes",
    severity: "Moderate", severityBg: "#fef9c3", severityColor: "#854d0e",
    doctor: "Dr. Mehta", specialty: "Endocrinology", date: "Diagnosed: 10 Jan 2026",
    status: "Diet controlled, monitoring required",
    borderColor: "#0d9488",
  },
  {
    title: "Mild Anxiety Disorder",
    severity: "Mild", severityBg: "#eff6ff", severityColor: "#1d4ed8",
    doctor: "Dr. Verma", specialty: null, date: "Diagnosed: Aug 2025",
    status: "Under treatment - improving",
    borderColor: "#0d9488",
  },
];

const FILTER_OPTIONS = ["All", "Severe", "Moderate", "Mild"];

export default function DiagnosisReport() {
  const [filter, setFilter] = useState("All");
  const [showFilter, setShowFilter] = useState(false);

  const filtered = filter === "All" ? DIAGNOSES : DIAGNOSES.filter(d => d.severity === filter);

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Diagnosis Reports</h2>
        <div style={{ position: "relative" }}>
          <button style={S.btn.outline} onClick={() => setShowFilter(v => !v)}>
            <Icon.Filter /> Filter by Type <Icon.ChevronDown />
          </button>
          {showFilter && (
            <div style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, minWidth: 140, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              {FILTER_OPTIONS.map(opt => (
                <div key={opt} onClick={() => { setFilter(opt); setShowFilter(false); }}
                  style={{ padding: "9px 16px", fontSize: 13, cursor: "pointer", color: filter === opt ? "#1a56db" : "#374151", fontWeight: filter === opt ? 600 : 400, background: filter === opt ? "#eff6ff" : "transparent" }}>
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filtered.map((d, i) => (
          <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", borderLeft: `4px solid ${d.borderColor}` }}>
            <div style={{ padding: "16px 18px" }}>
              {/* Title row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{d.title}</span>
                <span style={{ ...S.pill(d.severityBg, d.severityColor) }}>{d.severity}</span>
              </div>
              {/* Doctor row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                </svg>
                <span>
                  {d.doctor}{d.specialty ? ` · ${d.specialty}` : ""} · {d.date}
                </span>
              </div>
              {/* Status + actions */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                  <div style={{ color: "#16a34a" }}><Icon.CheckCircle /></div>
                  {d.status}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.btn.outline}>View Full Report</button>
                  <button style={S.btn.teal}><Icon.Download /> Download PDF</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}