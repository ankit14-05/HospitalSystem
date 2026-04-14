import { useState } from "react";
import { Icon, S } from "./shared";

const LAB_ICON_COLORS = ["#dbeafe","#ede9fe","#dcfce7","#fce7f3","#ffedd5","#f0fdf4"];

const ALL_LABS = [
  { icon: "🔬", iconBg: "#dbeafe", name: "Complete Blood Count (CBC)",  orderedBy: "Dr. Sharma", date: "22 Feb 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "📊", iconBg: "#ede9fe", name: "Lipid Profile Panel",          orderedBy: "Dr. Mehra",  date: "20 Feb 2026", status: "Pending",   statusColor: "#d97706", statusBg: "#fffbeb" },
  { icon: "💧", iconBg: "#dcfce7", name: "Glucose Tolerance Test",       orderedBy: "Dr. Sharma", date: "15 Feb 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "🫁", iconBg: "#fce7f3", name: "Chest X-Ray PA View",          orderedBy: "Dr. Iyer",   date: "12 Feb 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "🧫", iconBg: "#ffedd5", name: "Urine Culture",                orderedBy: "Dr. Verma",  date: "08 Feb 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "🧪", iconBg: "#dbeafe", name: "Thyroid Function Test (TFT)",  orderedBy: "Dr. Mehta",  date: "01 Feb 2026", status: "Pending",   statusColor: "#d97706", statusBg: "#fffbeb" },
  { icon: "🔬", iconBg: "#ede9fe", name: "HbA1c Test",                   orderedBy: "Dr. Sharma", date: "25 Jan 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "📊", iconBg: "#dcfce7", name: "Kidney Function Test",         orderedBy: "Dr. Iyer",   date: "18 Jan 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "💧", iconBg: "#fce7f3", name: "Liver Function Test",          orderedBy: "Dr. Mehta",  date: "10 Jan 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "🫁", iconBg: "#ffedd5", name: "ECG - Electrocardiogram",      orderedBy: "Dr. Sharma", date: "05 Jan 2026", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "🧫", iconBg: "#dbeafe", name: "Vitamin D Test",               orderedBy: "Dr. Verma",  date: "28 Dec 2025", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { icon: "🧪", iconBg: "#ede9fe", name: "Iron Studies Panel",           orderedBy: "Dr. Mehta",  date: "20 Dec 2025", status: "Completed", statusColor: "#16a34a", statusBg: "#f0fdf4" },
];

const PER_PAGE = 4;
const DOT = (color) => <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", marginRight: 5 }} />;

export default function LabReports() {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(ALL_LABS.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const rows = ALL_LABS.slice(start, start + PER_PAGE);

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Laboratory Records</h2>
          <span style={{ background: "#dbeafe", color: "#1e40af", fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 20 }}>{ALL_LABS.length} Results</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btn.outline}><Icon.Plus /> Request New Test</button>
          <button style={S.btn.outline}><Icon.Print /> Print Reports</button>
          <button style={S.btn.outline}><Icon.Calendar /> Select Date <Icon.ChevronDown /></button>
          <button style={S.btn.outline}><Icon.Location /> Place Type <Icon.ChevronDown /></button>
          <button style={S.btn.outline}><Icon.Filter /> Report Type <Icon.ChevronDown /></button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["TEST NAME","ORDERED BY","SAMPLE DATE","STATUS","ACTION"].map(h => (
                <th key={h} style={{ padding: "11px 16px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textAlign: "left", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: r.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{r.name}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 16px", fontSize: 14, color: "#374151" }}>{r.orderedBy}</td>
                <td style={{ padding: "14px 16px", fontSize: 14, color: "#374151" }}>{r.date}</td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", background: r.statusBg, borderRadius: 20, padding: "4px 10px", width: "fit-content" }}>
                    {DOT(r.statusColor)}
                    <span style={{ fontSize: 13, fontWeight: 500, color: r.statusColor }}>{r.status}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#1a56db", padding: 2 }}><Icon.Video /></button>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#1a56db", padding: 2 }}><Icon.Eye /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination - Previous/Next style */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12 }}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Showing {start + 1} to {Math.min(start + PER_PAGE, ALL_LABS.length)} of {ALL_LABS.length} lab results</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ ...S.btn.outline, opacity: page <= 1 ? 0.4 : 1 }}>
            Previous
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ ...S.btn.outline, opacity: page >= totalPages ? 0.4 : 1 }}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}