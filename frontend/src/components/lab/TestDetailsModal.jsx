import React from "react";
import { Icon } from "../emr/shared";

export default function TestDetailsModal({ test, onClose }) {
  if (!test) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(17, 24, 39, 0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      padding: "20px"
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 650,
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
        overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh"
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a", fontWeight: 700 }}>Lab Test Full Details</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Order ID: {test.id || "LAB-XXXX"}</p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 8,
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s"
          }} onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"} onMouseOut={e => e.currentTarget.style.background = "none"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Patient Info */}
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Patient Information</h3>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Name:</span> <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{test.patientName || "Unknown Patient"}</span></div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>UHID/ID:</span> <span style={{ fontSize: 14, color: "#334155" }}>{test.uhid || "N/A"}</span></div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Location:</span> <span style={{ fontSize: 14, color: "#334155" }}>{test.place || "Indoor"} - Room {test.roomNo || "101"}</span></div>
            </div>

            {/* Test Info */}
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Test Information</h3>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Test Type:</span> <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{test.testType || test.testName || "Standard Test"}</span></div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Priority:</span> 
                <span style={{ 
                  fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 12, 
                  background: test.priority === "Urgent" ? "#fee2e2" : "#f1f5f9", 
                  color: test.priority === "Urgent" ? "#ef4444" : "#475569" 
                }}>
                  {test.priority || "Normal"}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Date:</span> <span style={{ fontSize: 14, color: "#334155" }}>{test.date || test.assignedDate || "Today"}</span></div>
            </div>
          </div>

          {/* Doctor's Suggestion / Criteria */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "#f1f5f9", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon.Prescription /> Doctor's Criteria & Suggestions
            </div>
            <div style={{ padding: "16px" }}>
              <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b", fontWeight: 500 }}>Criteria for this test:</h4>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>
                {test.criteria || "Standard lab protocol should be followed. Please adhere to fast requirements if applicable."}
              </p>

              <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b", fontWeight: 500 }}>Additional Details:</h4>
              <div style={{ background: "#fffbeb", borderLeft: "3px solid #f59e0b", padding: "12px", borderRadius: "0 8px 8px 0", fontSize: 14, color: "#92400e", lineHeight: 1.5 }}>
                {test.additionalDetails || "Patient may be slightly uncooperative due to anxiety. Please handle with care. Double check sample volume."}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 20px",
            fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
