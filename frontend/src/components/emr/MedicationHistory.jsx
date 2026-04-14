import { useState } from "react";
import { Icon, S, Pagination } from "./shared";

const CURRENT_MEDS = [
  { name: "Metoprolol",   dosage: "50mg",  freq: "Once daily (morning)", start: "Jan 2026", doctor: "Dr. Sharma", status: "Active",        statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { name: "Aspirin",      dosage: "75mg",  freq: "Once daily",           start: "Jan 2026", doctor: "Dr. Sharma", status: "Active",        statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { name: "Atorvastatin", dosage: "10mg",  freq: "At bedtime",           start: "Dec 2025", doctor: "Dr. Sharma", status: "Active",        statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { name: "Metformin",    dosage: "500mg", freq: "Twice daily",          start: "Oct 2025", doctor: "Dr. Mehta",  status: "Active",        statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { name: "Omeprazole",   dosage: "20mg",  freq: "Before breakfast",     start: "Nov 2025", doctor: "Dr. Verma",  status: "Discontinued",  statusColor: "#6b7280", statusBg: "#f3f4f6" },
  { name: "Lisinopril",   dosage: "10mg",  freq: "Morning",              start: "Sep 2025", doctor: "Dr. Sharma", status: "Active",        statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { name: "Gabapentin",   dosage: "300mg", freq: "As needed",            start: "Aug 2025", doctor: "Dr. Rodriguez", status: "Active",     statusColor: "#16a34a", statusBg: "#f0fdf4" },
];

const PAST_MEDS = [
  { name: "Amoxicillin",  dosage: "500mg", freq: "Three times daily",    start: "Mar 2024", doctor: "Dr. Verma",  status: "Completed",     statusColor: "#1a56db", statusBg: "#eff6ff" },
  { name: "Ibuprofen",    dosage: "400mg", freq: "As needed",            start: "Jan 2024", doctor: "Dr. Mehta",  status: "Completed",     statusColor: "#1a56db", statusBg: "#eff6ff" },
  { name: "Prednisone",   dosage: "10mg",  freq: "Once daily",           start: "Nov 2023", doctor: "Dr. Sharma", status: "Completed",     statusColor: "#1a56db", statusBg: "#eff6ff" },
  { name: "Azithromycin", dosage: "250mg", freq: "Once daily",           start: "Aug 2023", doctor: "Dr. Patel",  status: "Completed",     statusColor: "#1a56db", statusBg: "#eff6ff" },
  { name: "Ciprofloxacin",dosage: "500mg", freq: "Twice daily",          start: "Jun 2023", doctor: "Dr. Verma",  status: "Completed",     statusColor: "#1a56db", statusBg: "#eff6ff" },
];

const PER_PAGE = 5;
const COLS = ["Medication","Dosage","Frequency","Start Date","Prescribing Doctor","Status"];

export default function MedicationHistory() {
  const [subTab, setSubTab] = useState("Current");
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const data = subTab === "Current" ? CURRENT_MEDS : PAST_MEDS;
  const totalPages = Math.ceil(data.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const rows = data.slice(start, start + PER_PAGE);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔗</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Medication History</h2>
        </div>
        <button style={S.btn.outline}><Icon.Export /> Export List</button>
      </div>

      {/* Sub-tabs: Current / Past */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
        {["Current","Past"].map(t => (
          <button key={t} onClick={() => { setSubTab(t); setPage(1); }} style={{
            background: "none", border: "none", borderBottom: subTab === t ? "2px solid #1a56db" : "2px solid transparent",
            color: subTab === t ? "#1a56db" : "#6b7280", fontWeight: subTab === t ? 600 : 400,
            fontSize: 14, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit",
          }}>{t}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {COLS.map(col => (
                <th key={col} onClick={() => handleSort(col)} style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "left", borderBottom: "1px solid #e5e7eb", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {col} <Icon.Sort />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "13px 16px", fontSize: 14, color: "#111827", fontWeight: 500 }}>{r.name}</td>
                <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{r.dosage}</td>
                <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{r.freq}</td>
                <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{r.start}</td>
                <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151" }}>{r.doctor}</td>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", background: r.statusBg, borderRadius: 20, padding: "4px 12px", width: "fit-content", gap: 5 }}>
                    {r.status === "Active" && (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="6" fill={r.statusColor} />
                        <path d="M4 6.5l2 2L9 4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                    {r.status === "Discontinued" && (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="6" fill="#9ca3af" />
                        <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                    {r.status === "Completed" && (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="6" fill={r.statusColor} />
                        <path d="M4 6.5l2 2L9 4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 500, color: r.statusColor, textDecoration: r.status === "Discontinued" ? "line-through" : "none" }}>
                      {r.status}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={data.length} perPage={PER_PAGE} onChange={p => { setPage(p); }} showGoTo={true} />
    </div>
  );
}