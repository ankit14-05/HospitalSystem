import React, { useState, useEffect } from "react";
import { Icon, S } from "./shared";
import api from "../../services/api";
import toast from "react-hot-toast";

const CATEGORIES = ["All","Lab Report","Prescription","Radiology","Cardiology","Dermatology","Endocrinology"];
const PER_PAGE = 5;

export default function UploadedDocuments({ patientId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!patientId) return;

    const fetchDocs = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patientId}/documents`);
        setDocuments(res.data?.data || res.data || []);
      } catch (err) {
        toast.error("Failed to load documents");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [patientId]);

  const filtered = cat === "All" ? documents : documents.filter(d => d.Category === cat);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const rows = filtered.slice(start, start + PER_PAGE);

  const TypeBadge = ({ type }) => {
    const colors = { PDF: ["#fef2f2","#991b1b"], IMG: ["#eff6ff","#1e40af"], ZIP: ["#f5f3ff","#6d28d9"], XLS: ["#f0fdf4","#166534"], DICOM: ["#f0f9ff","#0369a1"] };
    const cleanType = (type || '').toUpperCase().replace('.', '');
    const [bg, color] = colors[cleanType] || ["#f3f4f6","#374151"];
    return <span style={{ background: bg, color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>{cleanType}</span>;
  };

  const getDocIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) return "📄";
    if (t.includes('jpg') || t.includes('png') || t.includes('jpeg')) return "🖼️";
    if (t.includes('zip') || t.includes('rar')) return "🗜️";
    if (t.includes('xls') || t.includes('xlsx')) return "📊";
    return "📁";
  };

  if (loading && documents.length === 0) {
    return (
      <div style={{ ...S.card, marginTop: 20, textAlign: 'center', padding: '40px' }}>
        <div className="spinner w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Loading documents...</p>
      </div>
    );
  }

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
        style={{ border: `2px dashed ${dragging ? "#4f46e5" : "#d1d5db"}`, borderRadius: 10, padding: "24px", textAlign: "center", marginBottom: 20, background: dragging ? "#f5f3ff" : "#f9fafb", transition: "all 0.15s", cursor: "pointer" }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Drag & drop files here, or <span style={{ color: "#4f46e5", fontWeight: 600, cursor: "pointer" }}>browse</span></div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>PDF, JPEG, PNG, DICOM, ZIP up to 20MB</div>
      </div>

      {/* Category filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => { setCat(c); setPage(1); }} style={{
            background: cat === c ? "#4f46e5" : "transparent",
            color: cat === c ? "#fff" : "#6b7280",
            border: cat === c ? "1px solid #4f46e5" : "1px solid #e5e7eb",
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: "24px", textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No documents found.</td>
              </tr>
            ) : (
              rows.map((doc, i) => (
                <tr key={doc.Id || i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {getDocIcon(doc.FileType)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{doc.FileName}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}><TypeBadge type={doc.FileType} /></td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{(doc.FileSize / (1024*1024)).toFixed(2)} MB</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{new Date(doc.CreatedAt).toLocaleDateString()}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "#f3f4f6", color: "#374151", fontSize: 12, padding: "3px 10px", borderRadius: 6 }}>{doc.Category || 'General'}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#4f46e5", padding: 2 }} title="View"><Icon.Eye /></button>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#4f46e5", padding: 2 }} title="Download"><Icon.Download /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Showing {start + 1}-{Math.min(start + PER_PAGE, filtered.length)} of {filtered.length} docs</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[...Array(totalPages)].map((_, pi) => (
              <button key={pi} onClick={() => setPage(pi + 1)} style={{
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                background: page === pi + 1 ? "#4f46e5" : "transparent",
                color: page === pi + 1 ? "#fff" : "#374151",
                border: "1px solid " + (page === pi + 1 ? "#4f46e5" : "#d1d5db"),
                borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              }}>{pi + 1}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}