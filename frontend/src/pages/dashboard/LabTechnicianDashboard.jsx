import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import StatusUpdateModal from "../../components/lab/StatusUpdateModal";
import TestDetailsModal from "../../components/lab/TestDetailsModal";
import toast from "react-hot-toast";

// ── Constants & Mock Data ───────────────────────────────────────────────────
const ROWS_PER_PAGE = 5;

const PRIORITY_CONFIG = {
  High: { label: "High", bg: "#FCEBEB", color: "#E24B4A", border: "#F09595" },
  Normal: { label: "Normal", bg: "#EAF3DE", color: "#3B6D11", border: "#BDDC9A" },
  Medium: { label: "Medium", bg: "#FAEEDA", color: "#854F0B", border: "#FAC775" },
  Low: { label: "Low", bg: "#E6F1FB", color: "#185FA5", border: "#A1C9F2" },
};

const AVATAR_PALETTE = [
  { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#EAF3DE", color: "#27500A" },
  { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#FAECE7", color: "#712B13" },
  { bg: "#E1F5EE", color: "#085041" },
];

const TEST_TYPES = [
  "Complete Blood Count", "Lipid Profile", "HbA1c / Glucose",
  "Thyroid Function Test", "Liver Function Test", "Urinalysis",
];

// Real data will be fetched via API

// ── Helpers ────────────────────────────────────────────────────────────────
function getInitials(name) {
  return name.split(" ").filter(Boolean).map(p => p[0].toUpperCase()).slice(0, 2).join("");
}

function getAvatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ── UI Components ──────────────────────────────────────────────────────────
const Icons = {
  Microscope: (props) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" {...props}><path d="M7 3l2 3-2 2-2-3z" /><path d="M9 6l2 3" /><path d="M3 15h12" /><path d="M9 10v5" /><path d="M6 15a3 3 0 0 1 3-3" /></svg>,
  Clipboard: (props) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" {...props}><rect x="4" y="3" width="10" height="12" rx="1.5" /><path d="M7 3a2 2 0 0 1 4 0" /><path d="M7 9h4M7 12h2" /></svg>,
  Check: (props) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" {...props}><circle cx="9" cy="9" r="6" /><path d="M6 9l2.5 2.5L12 6.5" /></svg>,
  Refresh: (props) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" {...props}><path d="M9 3a6 6 0 1 1-4.24 1.76" /><path d="M9 3v3M9 3l2 2" /></svg>,
  Search: (props) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5l3 3" /></svg>,
  Calendar: (props) => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}><rect x="1" y="2" width="14" height="13" rx="2" /><path d="M1 6h14M5 1v2M11 1v2" /></svg>,
  ChevronDown: (props) => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}><path d="M2 3.5l3 3 3-3" /></svg>,
  ChevronLeft: (props) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}><path d="M9 2L4 7l5 5" /></svg>,
  ChevronRight: (props) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...props}><path d="M5 2l5 5-5 5" /></svg>,
  Eye: (props) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  History: (props) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>,
};

function MetricCard({ label, value, iconBg, Icon, valueColor, loading }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0dfd8", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 200 }}>
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon />
      </div>
      <div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 2 }}>{label}</div>
        {loading ? (
          <div style={{ width: 48, height: 28, background: "#e8ede8", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
        ) : (
          <div style={{ fontSize: 26, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard Component ───────────────────────────────────────────────
export default function LabTechnicianDashboard() {
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState("Pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const debounceRef = useRef(null);

  const [labOrders, setLabOrders] = useState({ Pending: [], Processing: [], "Pending Approval": [], Completed: [] });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [transferHistory, setTransferHistory] = useState({ open: false, data: [] });

  // Modal State
  const [modal, setModal] = useState({ open: false, currentStatus: "", nextStatus: "", testData: null });

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.get(`/lab/orders?limit=100&date=${selectedDate}`);
      if (data.success && data.orders) {
        const sorted = { Pending: [], Processing: [], "Pending Approval": [], Completed: [] };
        // Map backend schema to UI format
        data.orders.forEach(order => {
          // Normalize status
          let stat = 'Pending';
          if (order.Status === 'Processing') stat = 'Processing';
          else if (order.Status === 'Pending Approval') stat = 'Pending Approval';
          else if (order.Status === 'Completed') stat = 'Completed';

          const mapped = {
            id: order.OrderNumber,
            patientName: order.PatientName,
            patientId: order.UHID,
            testType: order.TestName || "Lab Test",
            priority: order.Priority === 'STAT' ? 'High' : order.Priority === 'Urgent' ? 'Medium' : 'Normal',
            sampleId: order.SampleId || `SMP-${order.Id}`,
            collectedDate: new Date(order.OrderDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', hour12: true }),
            resultDate: order.ReportedAt ? new Date(order.ReportedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', hour12: true }) : "-",
            status: stat,
            raw: order
          };
          if (sorted[stat]) {
            sorted[stat].push(mapped);
          }
        });
        setLabOrders(sorted);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load lab queue: ${err.message || err.response?.data?.message || err}`);
    } finally {
      setMetricsLoading(false);
    }
  }, [selectedDate]);

  const fetchRoomsInfo = useCallback(async () => {
    try {
      const [assignRes, roomsRes] = await Promise.all([
        api.get('/lab/my-assignment'),
        api.get('/lab/rooms')
      ]);
      if (assignRes.success) setCurrentAssignment(assignRes.data);
      if (roomsRes.success) setAvailableRooms(roomsRes.data);
    } catch (err) {
      console.error("Error fetching room info:", err);
    }
  }, []);

  const fetchTransferHistory = useCallback(async () => {
    try {
      const res = await api.get('/lab/my-transfers');
      if (res.success) setTransferHistory(prev => ({ ...prev, data: res.data }));
    } catch (err) {
      console.error("Error fetching transfers:", err);
    }
  }, []);

  const handleRoomChange = async (roomId) => {
    try {
      const res = await api.post('/lab/assign-room', { roomId });
      if (res.success) {
        toast.success(res.message || "Room change requested");
        fetchRoomsInfo();
        fetchTransferHistory();
      }
    } catch (err) {
      console.error("Error changing room:", err);
      toast.error(err.message || "Failed to request room change");
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRoomsInfo();
    fetchTransferHistory();
  }, [fetchOrders, fetchRoomsInfo, fetchTransferHistory]);

  const handleSearch = useCallback((val) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
  }, []);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery("");
    const searchInput = document.getElementById("lab-search-input");
    if (searchInput) searchInput.value = "";
  };

  // Data Filtering & Pagination
  const [detailsModal, setDetailsModal] = useState({ open: false, testData: null });

  const samples = searchQuery 
    ? [...labOrders.Pending, ...labOrders.Processing, ...labOrders.Completed]
    : (labOrders[activeTab] || []);
  
  const filteredData = searchQuery
    ? samples.filter(s => {
      const q = searchQuery.toLowerCase();
      return (
        (s.id || '').toLowerCase().includes(q) ||
        (s.raw?.Id?.toString() || '').includes(q) ||
        (s.patientName || '').toLowerCase().includes(q) ||
        (s.patientId || '').toLowerCase().includes(q) ||
        (s.testType || '').toLowerCase().includes(q) ||
        (s.sampleId || '').toLowerCase().includes(q)
      );
    })
    : samples;

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ROWS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * ROWS_PER_PAGE;
  const pageData = filteredData.slice(startIdx, startIdx + ROWS_PER_PAGE);
  const startItem = filteredData.length === 0 ? 0 : startIdx + 1;
  const endItem = Math.min(startIdx + ROWS_PER_PAGE, filteredData.length);

  // Actions
  const handleActionClick = async (test) => {
    let nextStatus = "";
    let fetchedSampleId = "";

    if (activeTab === "Pending") {
      nextStatus = "Processing";
      try {
        const res = await api.get('/lab/next-sample-id');
        if (res.success) fetchedSampleId = res.sampleId;
      } catch (err) {
        console.error("Failed to fetch next sample ID", err);
      }
    } else if (activeTab === "Processing") {
      nextStatus = "Pending Approval";
    }

    if (nextStatus) {
      setModal({
        open: true,
        currentStatus: activeTab,
        nextStatus,
        testData: {
          id: test.raw.Id,
          humanId: test.id,
          test: test.testType,
          patient: test.patientName,
          uhid: test.patientId,
          sampleId: fetchedSampleId || test.raw.SampleId
        }
      });
    }
  };

  const handleViewDetails = async (row, autoDownload = false) => {
    try {
      toast.loading("Fetching details...", { id: "viewDetails" });
      const res = await api.get(`/lab/orders/${row.raw.Id}`);
      if (res.success) {
        setDetailsModal({ open: true, testData: res.data });
        toast.success("Details loaded", { id: "viewDetails" });

        // Direct Download Logic: If autoDownload is requested and attachments exist
        if (autoDownload && res.data.attachments?.length > 0) {
          const firstFile = res.data.attachments[0];
          const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
          window.open(`${baseUrl}${firstFile.FilePath}`, "_blank");
        }
      } else {
        throw new Error("Failed to fetch details");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading details", { id: "viewDetails" });
    }
  };

  const confirmStatusUpdate = async () => {
    try {
      const orderId = modal.testData?.id;
      if (!orderId) throw new Error("Missing Order ID");

      toast.loading(`Updating status to ${modal.nextStatus}...`, { id: "statusUpdate" });

      const res = await api.patch(`/lab/orders/${orderId}/status`, {
        status: modal.nextStatus,
        sampleId: modal.testData?.sampleId
      });

      if (res.success) {
        toast.success(`Success! Order moved to ${modal.nextStatus}`, { id: "statusUpdate" });
        setModal({ ...modal, open: false });
        fetchOrders();
      } else {
        throw new Error(res.message || "Update failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error! ${err.message || "Failed to update status"}`, { id: "statusUpdate" });
    }
  };

  // Table Configuration Based on Tab
  const getTableConfig = () => {
    if (activeTab === "Pending") {
      return {
        headers: ["Test ID", "Patient", "Test Type", "Priority", "Assigned Date", "Actions"],
        widths: ["110px", "200px", "200px", "90px", "1fr", "180px"]
      };
    } else if (activeTab === "Processing") {
      return {
        headers: ["Test ID", "Patient", "Test Type", "Sample ID", "Collection Time", "Actions"],
        widths: ["110px", "200px", "200px", "170px", "1fr", "180px"]
      };
    } else {
      return {
        headers: ["Test ID", "Patient", "Test Type", "Sample ID", "Sent for Approval", "Actions"],
        widths: ["110px", "200px", "200px", "170px", "1fr", "180px"]
      };
    }
  };

  const { headers, widths } = getTableConfig();
  const gridTemplate = widths.join(" ");

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#f5f4f0", minHeight: "100vh", padding: "24px 28px", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .tab-btn:hover:not(.tab-active) { background: #eeede8 !important; }
        .row-hover:hover { background: #f8f7f3; }
        .action-btn { background: #0f6e56; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; }
        .action-btn:hover { background: #0a4f3e; }
        .view-btn { background: #fff; color: #1a1a1a; border: 1px solid #d3d1c7; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: 0.2s; white-space: nowrap; }
        .view-btn:hover { background: #eeede8; }
      `}</style>

      {/* Current Room Session */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#475569" }}>
            <Icons.Microscope style={{ stroke: "#475569" }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7 }}>Current Station</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select 
                  value={currentAssignment?.RoomId || ""} 
                  onChange={(e) => handleRoomChange(e.target.value)}
                  disabled={transferHistory.data.length > 0 && transferHistory.data[0].Status === 'Pending'}
                  style={{ 
                    border: "none", 
                    background: "transparent", 
                    fontSize: 13, 
                    fontWeight: 600, 
                    color: "#1e293b", 
                    outline: "none",
                    cursor: transferHistory.data.length > 0 && transferHistory.data[0].Status === 'Pending' ? "not-allowed" : "pointer",
                    padding: 0,
                    margin: 0,
                    opacity: transferHistory.data.length > 0 && transferHistory.data[0].Status === 'Pending' ? 0.6 : 1
                  }}
                >
                  <option value="" disabled>Select Room</option>
                  {availableRooms.map(r => (
                    <option key={r.Id} value={r.Id}>{r.RoomNo} - {r.RoomType}</option>
                  ))}
                </select>
                {transferHistory.data.length > 0 && transferHistory.data[0].Status === 'Pending' && (
                  <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>
                    PENDING APPROVAL
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={() => { fetchTransferHistory(); setTransferHistory(prev => ({ ...prev, open: true })); }}
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px", display: "flex", alignItems: "center", cursor: "pointer", color: "#64748b" }}
            title="Transfer History"
          >
            <Icons.History />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <MetricCard label="Total Samples" value={labOrders.Pending.length + labOrders.Processing.length + (labOrders['Pending Approval']?.length || 0) + labOrders.Completed.length} iconBg="#0D1F0D" Icon={Icons.Microscope} valueColor="#1a1a1a" loading={metricsLoading} />
        <MetricCard label="Pending Collection" value={labOrders.Pending.length} iconBg="#BA7517" Icon={Icons.Clipboard} valueColor="#BA7517" loading={metricsLoading} />
        <MetricCard label="In Processing" value={labOrders.Processing.length} iconBg="#185FA5" Icon={Icons.Refresh} valueColor="#185FA5" loading={metricsLoading} />
        <MetricCard label="Sent for Approval" value={labOrders['Pending Approval']?.length || 0} iconBg="#6d28d9" Icon={Icons.Check} valueColor="#6d28d9" loading={metricsLoading} />
        <MetricCard label="Completed Today" value={labOrders.Completed.length} iconBg="#0f6e56" Icon={Icons.Check} valueColor="#0f6e56" loading={metricsLoading} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e0dfd8", borderRadius: 16, overflow: "hidden" }}>

        {/* Controls Bar */}
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid #f0efe9", flexWrap: "wrap", background: "#fafaf7" }}>

          <div style={{ display: "flex", gap: 4, background: "#eeede8", padding: 4, borderRadius: 10 }}>
            {["Pending", "Processing", "Pending Approval", "Completed"].map((tab) => (
              <button
                key={tab}
                className={`tab-btn${activeTab === tab ? " tab-active" : ""}`}
                onClick={() => handleTabClick(tab)}
                style={{
                  background: activeTab === tab ? "#fff" : "transparent",
                  border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer",
                  fontSize: 13, fontWeight: activeTab === tab ? 600 : 500,
                  color: activeTab === tab ? "#1a1a1a" : "#5f5e5a",
                  boxShadow: activeTab === tab ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.2s"
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#fff", border: "1px solid #d3d1c7", borderRadius: 8, fontSize: 13, color: "#1a1a1a", minWidth: 150 }}>
            <Icons.Calendar style={{ color: "#64748b" }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                fontSize: 13,
                fontFamily: "inherit",
                color: "inherit",
                background: "transparent",
                width: "100%",
                cursor: "pointer"
              }}
            />
          </div>

          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#b4b2a9" }}><Icons.Search /></span>
            <input
              id="lab-search-input"
              type="text"
              placeholder="Search by ID, name, or test..."
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 36px", border: "1px solid #d3d1c7", borderRadius: 8, fontSize: 13, outline: "none" }}
            />
          </div>

        </div>

        {/* Table View */}
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, padding: "12px 20px", borderBottom: "1px solid #e0dfd8", background: "#fff", gap: 12 }}>
            {headers.map((h, i) => <div key={i} style={{ fontSize: 12, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>)}
          </div>

          {pageData.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#888780", fontSize: 14 }}>
              No records found.
            </div>
          ) : (
            pageData.map((row) => {
              const av = getAvatarColor(row.patientName);
              const pc = PRIORITY_CONFIG[row.priority] || PRIORITY_CONFIG.Normal;

              return (
                <div key={row.id} className="row-hover" style={{ display: "grid", gridTemplateColumns: gridTemplate, padding: "12px 20px", borderBottom: "1px solid #f0efe9", alignItems: "center", gap: 12, transition: "background 0.2s" }}>

                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{row.id}</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {getInitials(row.patientName)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.patientName}</div>
                      <div style={{ fontSize: 11, color: "#888780" }}>{row.patientId}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: "#5f5e5a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.testType}</div>

                  {row.status === "Pending" && (
                    <div><span style={{ background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{pc.label}</span></div>
                  )}
                  
                  {row.status !== "Pending" && (
                    <div style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500 }}>{row.sampleId}</div>
                  )}

                  {row.status === "Pending" ? (
                    <div style={{ fontSize: 13, color: "#5f5e5a" }}>{row.collectedDate}</div>
                  ) : row.status === "Processing" ? (
                    <div style={{ fontSize: 13, color: "#5f5e5a" }}>{row.collectedDate}</div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#5f5e5a" }}>{row.resultDate}</div>
                  )}

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => handleViewDetails(row)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "6px" }} title="View Details">
                      <Icons.Eye />
                    </button>
                    {row.status === "Pending" && <button className="action-btn" onClick={() => handleActionClick(row)}>Collect Sample</button>}
                    {row.status === "Processing" && <button className="action-btn" style={{ background: "#185FA5" }} onClick={() => handleActionClick(row)}>Upload Result</button>}
                    {row.status === "Completed" && <button className="view-btn" onClick={() => handleViewDetails(row, true)}>Download Result</button>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid #e0dfd8", background: "#fafaf7" }}>
          <div style={{ fontSize: 13, color: "#888780" }}>Showing {startItem} to {endItem} of {filteredData.length} entries</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: "6px 10px", borderRadius: 6, background: "#fff", border: "1px solid #d3d1c7", cursor: safePage <= 1 ? "not-allowed" : "pointer", opacity: safePage <= 1 ? 0.5 : 1 }}>
              <Icons.ChevronLeft />
            </button>
            <span style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{safePage} / {totalPages}</span>
            <button disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: "6px 10px", borderRadius: 6, background: "#fff", border: "1px solid #d3d1c7", cursor: safePage >= totalPages ? "not-allowed" : "pointer", opacity: safePage >= totalPages ? 0.5 : 1 }}>
              <Icons.ChevronRight />
            </button>
          </div>
        </div>

      </div>

      {detailsModal.open && (
        <TestDetailsModal test={detailsModal.testData} onClose={() => setDetailsModal({ open: false, testData: null })} />
      )}

      <StatusUpdateModal
        isOpen={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        currentStatus={modal.currentStatus}
        nextStatus={modal.nextStatus}
        testData={modal.testData}
        onConfirm={confirmStatusUpdate}
      />

      {transferHistory.open && (
        <TransferHistoryModal 
          data={transferHistory.data} 
          onClose={() => setTransferHistory(prev => ({ ...prev, open: false }))} 
        />
      )}
    </div>
  );
}

function TransferHistoryModal({ data, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0efe9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>Transfer & Duty History</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#5f5e5a" }}>Historical room assignments and formal transfers</p>
          </div>
          <button onClick={onClose} style={{ background: "#f5f4f0", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#888780" }}>✕</button>
        </div>
        
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {data.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#888780" }}>No transfer history found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {data.map((item, idx) => (
                <div key={item.Id} style={{ display: "flex", gap: 16, position: "relative" }}>
                  {idx !== data.length - 1 && <div style={{ position: "absolute", left: 15, top: 32, bottom: -16, width: 2, background: "#f0efe9" }} />}
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: item.Status === 'Active' ? "#ebf5f1" : "#f5f4f0", color: item.Status === 'Active' ? "#0f6e56" : "#888780", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, zIndex: 1 }}>
                    {data.length - idx}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{item.RoomNo} ({item.RoomType})</span>
                      <span style={{ fontSize: 12, color: "#888780" }}>{new Date(item.AssignedAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: item.Status === 'Active' ? "#ebf5f1" : "#f1f1f1", color: item.Status === 'Active' ? "#0f6e56" : "#666", fontWeight: 600, textTransform: "uppercase" }}>
                        {item.AssignmentType || 'Shift Duty'}
                      </span>
                      {item.Status === 'Active' && <span style={{ fontSize: 11, color: "#0f6e56", fontWeight: 500 }}>• Currently Active</span>}
                    </div>
                    {item.Notes && <p style={{ margin: 0, fontSize: 12, color: "#5f5e5a", fontStyle: "italic", background: "#fafafa", padding: "8px 12px", borderRadius: 6, border: "1px solid #f0f0f0" }}>"{item.Notes}"</p>}
                    <div style={{ marginTop: 6, fontSize: 11, color: "#b4b2a9" }}>Assigned by {item.AssignedByAdmin}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ padding: "16px 24px", borderTop: "1px solid #f0efe9", display: "flex", justifyContent: "flex-end" }}>
          <button className="view-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
