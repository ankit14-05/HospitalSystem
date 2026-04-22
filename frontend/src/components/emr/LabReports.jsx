import React, { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";

/* ─── Icons ──────────────────────────────────────────────────────────────── */
const IconFlask    = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6M9 3v7l-4.5 8.5A1 1 0 005.4 20h13.2a1 1 0 00.9-1.5L15 10V3"/></svg>;
const IconClock    = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>;
const IconSpinner  = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 11-6.3-8.6" strokeLinecap="round"/></svg>;
const IconCheck    = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>;
const IconEye      = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconDownload = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconSearch   = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>;
const IconPrev     = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>;
const IconNext     = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>;
const IconX        = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconFile     = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

/* ─── Constants ───────────────────────────────────────────────────────────── */
const PER_PAGE = 5;

const PRIORITY_BADGE = {
  Normal: { bg: "#dcfce7", color: "#16a34a" },
  Urgent: { bg: "#fee2e2", color: "#dc2626" },
  STAT:   { bg: "#fef3c7", color: "#d97706" },
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date)) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    }) + ", " + date.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).toLowerCase();
  } catch { return "—"; }
}

function initials(name = "") {
  return name.trim().split(/\s+/).map(n => n[0] || "").slice(0, 2).join("").toUpperCase() || "?";
}

const AVATAR_COLORS = ["#4f46e5","#0891b2","#059669","#d97706","#7c3aed","#db2777"];
function Avatar({ name = "" }) {
  const c = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", background: c,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>{initials(name)}</div>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ Icon, iconBg, label, value }) {
  return (
    <div style={{
      flex: 1, minWidth: 130, background: "#fff",
      border: "1px solid #e5e7eb", borderRadius: 12,
      padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: "50%", background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0,
      }}><Icon /></div>
      <div>
        <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}

/* ─── View Modal ─────────────────────────────────────────────────────────── */
function ViewModal({ order, allRows, onClose }) {
  const [attachments, setAttachments] = useState([]);
  const [loadingAttach, setLoadingAttach] = useState(true);
  const [downloading, setDownloading] = useState(null);

  // Get all items for this order
  const items = allRows.filter(r => r.OrderId === order.OrderId);

  useEffect(() => {
    api.get(`/lab/orders/${order.OrderId}/attachments`)
      .then(res => setAttachments(res?.data || []))
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttach(false));
  }, [order.OrderId]);

  const handleDownload = async (att) => {
    try {
      setDownloading(att.Id);
      const url = att.FilePath; // Now proxied by Vite
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = att.FileName || 'lab_result';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
    } catch (e) {
      toast.error('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const PRIO = {
    Normal: { bg: "#dcfce7", color: "#16a34a" },
    Urgent: { bg: "#fee2e2", color: "#dc2626" },
    STAT:   { bg: "#fef3c7", color: "#d97706" },
  };
  const pColor = PRIO[order.Priority] || PRIO.Normal;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Lab Order Details</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{order.OrderNumber}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4 }}><IconX /></button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Meta info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[{ label: "Ordered By", value: order.DoctorName || "—" },
              { label: "Status", value: order.Status },
              { label: "Priority", value: <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: pColor.bg, color: pColor.color }}>{order.Priority}</span> },
              { label: "Ordered At", value: fmtDate(order.OrderDate) },
              { label: "Completed At", value: fmtDate(order.CompletedAt) },
              { label: "Sample ID", value: order.SampleId || "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "#111827" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tests */}
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Tests Ordered</h3>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>{["Test Name","Category","Result","Unit","Normal Range","Status"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.ItemId} style={{ borderTop: i > 0 ? "1px solid #f3f4f6" : "none", background: item.IsAbnormal ? "#fef2f2" : "transparent" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{item.TestName}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>{item.Category || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: item.IsAbnormal ? "#dc2626" : "#111827", fontWeight: item.IsAbnormal ? 700 : 400 }}>{item.ResultValue || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>{item.ResultUnit || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>{item.NormalRange || "—"}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 11, fontWeight: 600, color: item.ItemStatus === 'Completed' ? "#16a34a" : "#d97706" }}>{item.ItemStatus || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attachments */}
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Result Files</h3>
          {loadingAttach ? <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading attachments...</p>
          : attachments.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 13, background: "#f9fafb", padding: 14, borderRadius: 8, textAlign: "center" }}>No files uploaded for this order.</p>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {attachments.map(att => (
                <div key={att.Id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafafa" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#6366f1" }}><IconFile /></span>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{att.FileName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{att.FileType} · {att.FileSize ? Math.round(att.FileSize / 1024) + ' KB' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(att)}
                    disabled={downloading === att.Id}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, border: "1px solid #6366f1", background: downloading === att.Id ? "#e0e7ff" : "#fff", color: "#6366f1", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <IconDownload /> {downloading === att.Id ? 'Downloading...' : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function LabReports({ patientId }) {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("All");  // Default to All
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [fetchError, setFetchError] = useState(null);
  const [viewOrder, setViewOrder]   = useState(null);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setFetchError(null);

    api.get(`/emr/${patientId}/lab-reports`, { params: { page: 1, limit: 1000 } })
      .then(res => {
        const data = res?.results || res?.data?.results || res?.data || (Array.isArray(res) ? res : []);
        setRows(data);
      })
      .catch(err => {
        console.error("Lab reports fetch failed:", err);
        const msg = err.response?.data?.message || err.message || "";
        if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("connect")) {
          setFetchError("Database connection timed out. Please try again.");
        } else {
          setFetchError("Unable to load latest lab data.");
        }
        toast.error("Data fetch failed");
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  /* ── Group rows by OrderId ─────────────────────────────────────────────── */
  const orders = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.OrderId)) {
        map.set(r.OrderId, { ...r, tests: [] });
      }
      if (r.TestName) map.get(r.OrderId).tests.push(r.TestName);
    }
    return [...map.values()];
  }, [rows]);

  /* ── Stats (Counting based on individual test items, not orders) ───────── */
  const stats = useMemo(() => {
    const norm = s => (s || "").toLowerCase();
    return {
      total:      rows.length,
      pending:    rows.filter(r => norm(r.Status) === "pending" || norm(r.ItemStatus) === "pending").length,
      processing: rows.filter(r => norm(r.Status).includes("process") || norm(r.Status).includes("progress")).length,
      completed:  rows.filter(r => norm(r.Status) === "completed").length,
    };
  }, [rows]);

  /* ── Filter ───────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = orders;
    
    // Tab filtering
    if (activeTab !== "All") {
      const tabKey = activeTab.toLowerCase();
      list = list.filter(o => {
        const s = (o.Status || "").toLowerCase();
        if (tabKey === "pending") return s === "pending";
        if (tabKey === "processing") return s.includes("process") || s.includes("progress");
        if (tabKey === "completed") return s === "completed";
        return true;
      });
    }

    // Search filtering
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(o =>
        (o.OrderNumber || "").toLowerCase().includes(q) ||
        (o.tests || []).some(t => t.toLowerCase().includes(q)) ||
        (o.DoctorName || "").toLowerCase().includes(q)
      );
    }
    
    return list; // Keep original DB order (usually by date/ID)
  }, [orders, activeTab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const startEntry = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const endEntry   = Math.min(page * PER_PAGE, filtered.length);

  useEffect(() => setPage(1), [activeTab, search]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        border: "3px solid #4f46e5", borderTopColor: "transparent",
        animation: "spin 0.8s linear infinite", margin: "0 auto",
      }} />
      <p style={{ marginTop: 14, color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Fetching patient records...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ color: "#111827" }}>
      {/* Stat Bar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard Icon={IconFlask}   iconBg="#374151" label="Total Samples"    value={stats.total} />
        <StatCard Icon={IconClock}   iconBg="#d97706" label="Pending Collection" value={stats.pending} />
        <StatCard Icon={IconSpinner} iconBg="#2563eb" label="In Processing"     value={stats.processing} />
        <StatCard Icon={IconCheck}   iconBg="#059669" label="Completed Today"   value={stats.completed} />
      </div>

      {/* Main Content Card */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 3, background: "#f3f4f6", borderRadius: 9, padding: 3 }}>
            {["All", "Pending", "Processing", "Completed"].map(tab => {
              const active = activeTab === tab;
              const accent = tab === "Pending" ? "#16a34a" : tab === "Processing" ? "#2563eb" : "#111827";
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                  background: active ? "#fff" : "transparent",
                  color: active ? accent : "#6b7280",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}>{tab}</button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 14px", minWidth: 260 }}>
            <span style={{ color: "#9ca3af" }}><IconSearch /></span>
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search test ID or name..."
              style={{ border: "none", outline: "none", fontSize: 13, width: "100%", color: "#374151" }} 
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                {(activeTab === "Completed" 
                  ? ["TEST ID", "ORDERED BY", "TEST NAME", "PRIORITY", "ORDERED AT", "COMPLETED AT", "ACTIONS"]
                  : ["TEST ID", "ORDERED BY", "TEST NAME", "PRIORITY", "ORDERED AT", "ACTIONS"]
                ).map(h => (
                  <th key={h} style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textAlign: "left", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fetchError ? (
                <tr>
                  <td colSpan={7} style={{ padding: "60px 20px", textAlign: "center", color: "#dc2626" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fetchError}</p>
                    <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: "6px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", cursor: "pointer", fontSize: 12 }}>Retry Connection</button>
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                    <p style={{ margin: 0, fontSize: 14 }}>No lab records found for this patient.</p>
                  </td>
                </tr>
              ) : pageItems.map((o, idx) => {
                const prio = o.Priority || "Normal";
                const pColor = PRIORITY_BADGE[prio] || PRIORITY_BADGE.Normal;
                const isComp = (o.Status || "").toLowerCase() === "completed";
                const docName = o.DoctorName || "Unknown Doctor";

                return (
                  <tr key={o.OrderId || idx} style={{ borderBottom: "1px solid #f3f4f6", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {o.OrderNumber || `#${o.OrderId}`}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <Avatar name={docName} />
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{docName}</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{docName === "Unknown Doctor" ? "" : "Physician"}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                      {(o.tests || [o.TestName]).slice(0, 2).join(", ")}
                      {(o.tests || []).length > 2 ? <span style={{ color: "#9ca3af", fontSize: 11 }}> +{o.tests.length - 2}</span> : ""}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: pColor.bg, color: pColor.color }}>{prio}</span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
                      {fmtDate(o.OrderDate)}
                    </td>
                    {activeTab === "Completed" && (
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#000", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {fmtDate(o.CompletedAt)}
                      </td>
                    )}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                        <button
                          title="View Details"
                          onClick={() => setViewOrder(o)}
                          style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 7px", cursor: "pointer", color: "#6b7280" }}>
                          <IconEye />
                        </button>
                        {isComp && (
                          <button
                            onClick={() => setViewOrder(o)}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                            <IconDownload /> Result
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #f0f0f0", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            {filtered.length ? `Showing ${startEntry}–${endEntry} of ${filtered.length} entries` : "No entries to show"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e7eb", borderRadius: 6, cursor: page <= 1 ? "not-allowed" : "pointer", background: "#fff", opacity: page <= 1 ? 0.4 : 1 }}><IconPrev /></button>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", minWidth: 40, textAlign: "center" }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e7eb", borderRadius: 6, cursor: page >= totalPages ? "not-allowed" : "pointer", background: "#fff", opacity: page >= totalPages ? 0.4 : 1 }}><IconNext /></button>
          </div>
        </div>
      </div>
      {viewOrder && (
        <ViewModal
          order={viewOrder}
          allRows={rows}
          onClose={() => setViewOrder(null)}
        />
      )}
    </div>
  );
}