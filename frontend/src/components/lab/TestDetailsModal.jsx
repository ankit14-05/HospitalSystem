import React from "react";
import { Icon } from "../emr/shared";

export default function TestDetailsModal({ test, onClose, onApprove, onReject }) {
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
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Order ID: {test.OrderNumber || test.Id || "LAB-XXXX"}</p>
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
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Name:</span> <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{test.PatientName || "Unknown Patient"}</span></div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>UHID/ID:</span> <span style={{ fontSize: 14, color: "#334155" }}>{test.UHID || "N/A"}</span></div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Location:</span> <span style={{ fontSize: 14, color: "#334155" }}>{test.PlaceType || "Indoor"} - {test.RoomNo ? `Room ${test.RoomNo}` : "OPD"}</span></div>
            </div>

            {/* Test Info */}
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Test Information</h3>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Test Type:</span> <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{test.TestName || test.testType || "Standard Test"}</span></div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Priority:</span> 
                <span style={{ 
                  fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 12, 
                  background: test.Priority === "Urgent" || test.Priority === "STAT" ? "#fee2e2" : "#f1f5f9", 
                  color: test.Priority === "Urgent" || test.Priority === "STAT" ? "#ef4444" : "#475569" 
                }}>
                  {test.Priority || "Normal"}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}><span style={{ fontSize: 13, color: "#64748b", display: "inline-block", width: 80 }}>Date:</span> <span style={{ fontSize: 14, color: "#334155" }}>{test.OrderDate ? new Date(test.OrderDate).toLocaleDateString() : "Today"}</span></div>
            </div>
          </div>
          
          {/* Structured Lab Results */}
          {test.items && test.items.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.FileText /> Structured Lab Results
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Test Parameter</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Result Value</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Normal Range</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody style={{ color: "#334155" }}>
                    {test.items.map((item, index) => (
                      <tr key={item.Id || index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a" }}>
                          {item.TestName}
                          {item.IsAbnormal && (
                            <span style={{ marginLeft: 8, padding: "2px 6px", background: "#fee2e2", color: "#ef4444", fontSize: 10, fontWeight: 700, borderRadius: 4, uppercase: "uppercase" }}>High / Abnormal</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: item.IsAbnormal ? 700 : 500, color: item.IsAbnormal ? "#ef4444" : "#0f172a" }}>
                          {item.ResultValue || "--"} <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>{item.ResultUnit || item.Unit || ""}</span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>
                          {item.NormalRange || "--"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#64748b", fontStyle: item.Remarks ? "normal" : "italic" }}>
                          {item.Remarks || "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Laboratory Results & Attachments */}
          {(test.Status === "Completed" || test.Status === "Pending Approval" || test.Status === "Processing") && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ background: "#f0fdf4", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.CheckCircle /> Laboratory Results & Documents
              </div>
              <div style={{ padding: "16px" }}>
                {!test.attachments || test.attachments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "12px", background: "#f8fafc", borderRadius: 8, fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
                    No digital attachments uploaded for this report.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {test.attachments.map((file) => (
                      <div key={file.Id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #eef2f6", padding: "10px 14px", borderRadius: 10, background: "#fcfcfc" }}>
                        <div style={{ 
                          width: 36, height: 36, borderRadius: 8, 
                          background: file.FileType?.includes('pdf') ? "#e0f2fe" : "#ffedd5", 
                          color: file.FileType?.includes('pdf') ? "#0284c7" : "#c2410c", 
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 
                        }}>
                          {file.FileName?.split('.').pop().toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{file.FileName}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{(file.FileSize / 1024).toFixed(1)} KB • Uploaded {new Date(file.UploadedAt).toLocaleDateString()}</div>
                        </div>
                        <a 
                          href={import.meta.env.VITE_API_URL 
                            ? `${import.meta.env.VITE_API_URL}${file.FilePath.startsWith('/') ? '' : '/'}${file.FilePath}` 
                            : `http://localhost:5000${file.FilePath.startsWith('/') ? '' : '/'}${file.FilePath}`
                          }
                          target="_blank" 
                          rel="noopener noreferrer"
                          title="Download/View File"
                          style={{ background: "#0d9488", color: "#fff", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                        >
                          <Icon.Download size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason (if any) */}
          {test.RejectionReason && (
            <div style={{ background: "#fff", border: "1px solid #fee2e2", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ background: "#fef2f2", padding: "10px 16px", borderBottom: "1px solid #fee2e2", fontSize: 13, fontWeight: 600, color: "#991b1b", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Alert size={14} /> Rejection Feedback
              </div>
              <div style={{ padding: "16px", fontSize: 14, color: "#7f1d1d", fontWeight: 500, lineHeight: 1.5 }}>
                {test.RejectionReason}
              </div>
            </div>
          )}

          {/* Doctor's Suggestion / Criteria */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "#f1f5f9", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon.Prescription /> Doctor's Criteria & Suggestions
            </div>
            <div style={{ padding: "16px" }}>
              <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b", fontWeight: 500 }}>Criteria for this test:</h4>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>
                {test.Criteria || "Standard lab protocol should be followed. Please adhere to fast requirements if applicable."}
              </p>

              <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b", fontWeight: 500 }}>Additional Details:</h4>
              <div style={{ background: "#fffbeb", borderLeft: "3px solid #f59e0b", padding: "12px", borderRadius: "0 8px 8px 0", fontSize: 14, color: "#92400e", lineHeight: 1.5 }}>
                {test.AdditionalDetails || test.Notes || "Standard lab protocol followed."}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {onReject && (
              <button 
                onClick={() => onReject(test.Id || test.raw?.Id)}
                style={{
                  background: "#fff", color: "#ef4444", border: "1px solid #fee2e2", borderRadius: 8, padding: "8px 20px",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}
                onMouseOver={e => e.currentTarget.style.background = "#fef2f2"}
                onMouseOut={e => e.currentTarget.style.background = "#ffffff"}
              >
                Reject Result
              </button>
            )}
            {onApprove && (
              <button 
                onClick={() => onApprove(test.Id || test.raw?.Id)}
                style={{
                  background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(13, 148, 136, 0.2)",
                  transition: "all 0.2s"
                }}
                onMouseOver={e => e.currentTarget.style.background = "#0f766e"}
                onMouseOut={e => e.currentTarget.style.background = "#0d9488"}
              >
                Approve & Sign
              </button>
            )}
            <button onClick={onClose} style={{
              background: "#64748b", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px",
              fontSize: 14, fontWeight: 600, cursor: "pointer"
            }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
