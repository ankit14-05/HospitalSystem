import React, { useState, useRef, useEffect } from "react";
import { Icon } from "../emr/shared";
import api from "../../services/api";

export default function StatusUpdateModal({ isOpen, onClose, currentStatus, nextStatus, testData, onConfirm }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => {
      // Prevent duplicate files from accumulating in the UI list
      const newFiles = files.filter(f => !prev.some(p => p.name === f.name && p.size === f.size));
      return [...prev, ...newFiles];
    });
    // Reset input value so the same file can be selected again if removed
    if (e.target) e.target.value = "";
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Clear modal state safely whenever it closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setUploading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine Titles
  const isProcess = currentStatus === "Pending";
  const isUpload = nextStatus === "Completed" || nextStatus === "Pending Approval";
  const title = isProcess ? "Process Sample" : "Finalize Sample & Submit for Approval";
  
  // Safe extraction of IDs
  const displayId = (currentStatus === "Pending" && !testData?.sampleId) 
    ? "System Generated" 
    : (testData?.sampleId || testData?.id || "#SMP-XXXX");

  const now = new Date();
  const dateStr = now.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  const handleSubmit = async () => {
    if (isUpload && selectedFiles.length === 0) {
      if (!window.confirm("No files selected. Submit anyway?")) return;
    }

    try {
      setUploading(true);
      console.log("[StatusUpdateModal] Starting submission...", { isUpload, selectedFilesCount: selectedFiles.length });
      
      // If uploading results, send files first
      if (isUpload && selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file, idx) => {
          console.log(`[StatusUpdateModal] Appending file ${idx}: ${file.name} (${file.size} bytes)`);
          formData.append("files", file);
        });

        const uploadRes = await api.post(`/lab/orders/${testData.id}/attachments`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        console.log("[StatusUpdateModal] Upload Response:", uploadRes);
        if (!uploadRes.success) throw new Error("File upload failed on server");
      }

      await onConfirm();
      onClose();
    } catch (err) {
      console.error("[StatusUpdateModal] Error during submission:", err);
      alert(`Submission failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileExt = (name) => name.split('.').pop().toUpperCase();

  const FileCard = ({ file, index }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #eef2f6", padding: "12px", borderRadius: 12, background: "#fff", marginBottom: 8 }}>
      <div style={{ 
        width: 40, height: 40, borderRadius: 8, 
        background: file.type.includes('pdf') ? "#e0f2fe" : "#ffedd5", 
        color: file.type.includes('pdf') ? "#0284c7" : "#c2410c", 
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 
      }}>
        {getFileExt(file.name)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{file.name}</div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{formatSize(file.size)} • Just now</div>
      </div>
      <button onClick={() => removeFile(index)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>
        <Icon.Trash size={16} />
      </button>
    </div>
  );

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(17, 24, 39, 0.4)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      padding: "20px"
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "100%", maxWidth: 500,
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
        padding: "24px 32px", display: "flex", flexDirection: "column"
      }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#111827", fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        {/* Top Info Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Sample ID</label>
            <input readOnly value={displayId} style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", color: "#6b7280", fontSize: 13, outline: "none" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Date of Sample Collection</label>
            <input readOnly value={dateStr} style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", color: "#6b7280", fontSize: 13, outline: "none" }} />
          </div>
        </div>

        {/* Current Status & Result Date Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Current Status</label>
            <div style={{ position: "relative" }}>
              <input readOnly value={nextStatus} style={{ width: "100%", padding: "10px 14px", border: "1px solid #0d9488", borderRadius: 8, background: "#fff", color: "#111827", fontSize: 13, outline: "none" }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }}><Icon.ChevronDown /></span>
            </div>
          </div>
          
          {isUpload && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Date of Result</label>
              <div style={{ position: "relative" }}>
                <input readOnly value={dateStr} style={{ width: "100%", padding: "10px 14px 10px 34px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", color: "#111827", fontSize: 13, outline: "none" }} />
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Attachments Section */}
        {isUpload && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Attachments</span>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#f1f5f9", padding: "2px 8px", borderRadius: 10, color: "#475569" }}>
                {selectedFiles.length}
              </span>
            </div>
            
            <input 
              type="file" 
              multiple 
              style={{ display: "none" }} 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg,.mp4,.mov,.avi"
            />

            <div 
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileChange({ target: { files: e.dataTransfer.files } });
              }}
              style={{ border: "2px dashed #e2e8f0", borderRadius: 12, padding: "24px", textAlign: "center", background: "#f8fafc", marginBottom: 12, cursor: "pointer" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#64748b" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
                {uploading ? "Uploading..." : "Drop files to upload"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>PDF, PNG, JPG or Video (Max 50MB)</div>
            </div>

            <div style={{ maxHeight: 150, overflowY: "auto", paddingRight: 4 }}>
              {selectedFiles.map((file, idx) => (
                <FileCard key={idx} file={file} index={idx} />
              ))}
            </div>
          </div>
        )}

        {/* Submits */}
        <button 
          onClick={handleSubmit} 
          disabled={uploading}
          style={{
            width: "100%", background: "#0d9488", color: "#fff", border: "none", borderRadius: 8,
            padding: "12px", fontSize: 14, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer", 
            boxShadow: "0 4px 6px -1px rgba(13, 148, 136, 0.2)",
            opacity: uploading ? 0.7 : 1
          }}
        >
          {uploading ? "Submitting..." : (isUpload ? "Submit for Approval" : "Update Status")}
        </button>

      </div>
    </div>
  );
}
