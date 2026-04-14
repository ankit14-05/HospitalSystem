import { useState } from "react";
import { Icon, S } from "./shared";

const DOCUMENTS = [
  { name: "CBC_Report_Feb2026.pdf",        type: "PDF",  size: "1.2 MB", date: "22 Feb 2026", category: "Lab Report",   icon: "📄", iconBg: "#fef2f2", iconColor: "#dc2626" },
  { name: "Chest_XRay_Feb2026.jpg",        type: "IMG",  size: "3.4 MB", date: "12 Feb 2026", category: "Radiology",    icon: "🖼️", iconBg: "#eff6ff", iconColor: "#1d4ed8" },
  { name: "Prescription_Jenkins_Oct23.pdf",type: "PDF",  size: "0.5 MB", date: "24 Oct 2023", category: "Prescription", icon: "📄", iconBg: "#fef2f2", iconColor: "#dc2626" },
  { name: "Lipid_Profile_Feb2026.pdf",     type: "PDF",  size: "0.8 MB", date: "20 Feb 2026", category: "Lab Report",   icon: "📄", iconBg: "#fef2f2", iconColor: "#dc2626" },
  { name: "ECG_Report_Jan2026.pdf",        type: "PDF",  size: "2.1 MB", date: "05 Jan 2026", category: "Cardiology",   icon: "📄", iconBg: "#fef2f2", iconColor: "#dc2626" },
  { name: "Dermatology_Photos.zip",        type: "ZIP",  size: "5.6 MB", date: "15 Jan 2026", category: "Dermatology",  icon: "🗜️", iconBg: "#f5f3ff", iconColor: "#7c3aed" },
  { name: "Diabetes_Monitoring_Chart.xlsx",type: "XLS",  size: "0.3 MB", date: "10 Jan 2026", category: "Endocrinology",icon: "📊", iconBg: "#f0fdf4", iconColor: "#166534" },
  { name: "MRI_Brain_Dec2025.dcm",         type: "DICOM",size: "18.2 MB",date: "15 Dec 2025", category: "Radiology",    icon: "🔬", iconBg: "#eff6ff", iconColor: "#1d4ed8" },
];

const CATEGORIES = ["All","Lab Report","Prescription","Radiology","Cardiology","Dermatology","Endocrinology"];
const PER_PAGE = 5;

export default function UploadedDocuments() {
  const [cat, setCat] = useState("All");
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);

  const filtered = cat === "All" ? DOCUMENTS : DOCUMENTS.filter(d => d.category === cat);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const rows = filtered.slice(start, start + PER_PAGE);

  const TypeBadge = ({ type }) => {
    const colors = { PDF: ["#fef2f2","#991b1b"], IMG: ["#eff6ff","#1e40af"], ZIP: ["#f5f3ff","#6d28d9"], XLS: ["#f0fdf4","#166534"], DICOM: ["#f0f9ff","#0369a1"] };
    const [bg, color] = colors[type] || ["#f3f4f6","#374151"];
    return <span style={{ background: bg, color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>{type}</span>;
  };

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Uploaded Documents</h2>
        <button style={S.btn.primary}><Icon.Plus /> Upload Document</button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); }}
        style={{ border: `2px dashed ${dragging ? "#1a56db" : "#d1d5db"}`, borderRadius: 10, padding: "24px", textAlign: "center", marginBottom: 20, background: dragging ? "#eff6ff" : "#f9fafb", transition: "all 0.15s", cursor: "pointer" }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Drag & drop files here, or <span style={{ color: "#1a56db", fontWeight: 600, cursor: "pointer" }}>browse</span></div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>PDF, JPEG, PNG, DICOM, ZIP up to 20MB</div>
      </div>

      {/* Category filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => { setCat(c); setPage(1); }} style={{
            background: cat === c ? "#1a56db" : "transparent",
            color: cat === c ? "#fff" : "#6b7280",
            border: cat === c ? "1px solid #1a56db" : "1px solid #e5e7eb",
            borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: cat === c ? 600 : 400,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          }}>{c}</button>
        ))}
      </div>

      {/* Document list */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["DOCUMENT","TYPE","SIZE","DATE UPLOADED","CATEGORY","ACTIONS"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textAlign: "left", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((doc, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: doc.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{doc.icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{doc.name}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}><TypeBadge type={doc.type} /></td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{doc.size}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{doc.date}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: "#f3f4f6", color: "#374151", fontSize: 12, padding: "3px 10px", borderRadius: 6 }}>{doc.category}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#1a56db", padding: 2 }} title="View"><Icon.Eye /></button>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#1a56db", padding: 2 }} title="Download"><Icon.Download /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Showing {start + 1}-{Math.min(start + PER_PAGE, filtered.length)} of {filtered.length} documents</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[...Array(totalPages)].map((_, pi) => (
            <button key={pi} onClick={() => setPage(pi + 1)} style={{
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              background: page === pi + 1 ? "#1a56db" : "transparent",
              color: page === pi + 1 ? "#fff" : "#374151",
              border: "1px solid " + (page === pi + 1 ? "#1a56db" : "#d1d5db"),
              borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
            }}>{pi + 1}</button>
          ))}
        </div>
      </div>
    </div>
  );
}