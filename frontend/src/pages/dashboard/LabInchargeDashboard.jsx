import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import TestDetailsModal from "../../components/lab/TestDetailsModal";
import toast from "react-hot-toast";
import { 
  FileCheck, Clock, CheckCircle2, Eye, 
  Search, Calendar, ChevronLeft, ChevronRight,
  ShieldCheck, AlertCircle, PenTool
} from "lucide-react";
import SignatureSettings from "../../components/lab/SignatureSettings";


const ROWS_PER_PAGE = 8;

export default function LabInchargeDashboard() {
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailsModal, setDetailsModal] = useState({ open: false, testData: null });
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState("approvals");


  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/lab/pending-approvals");
      if (res.success) {
        setPendingOrders(res.orders || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleReject = async (orderId) => {
    const reason = window.prompt("Please enter the reason for rejection:");
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    try {
      setProcessingId(orderId);
      toast.loading("Rejecting result...", { id: `reject-${orderId}` });
      
      const res = await api.post(`/lab/orders/${orderId}/reject`, { reason });
      
      if (res.success) {
        toast.success(res.message, { id: `reject-${orderId}` });
        setDetailsModal({ open: false, testData: null });
        fetchPendingApprovals();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Rejection failed", { id: `reject-${orderId}` });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (orderId) => {
    if (!window.confirm("Are you sure you want to approve this lab result? This will digitally sign the document.")) return;
    
    try {
      setProcessingId(orderId);
      toast.loading("Digitally signing & approving...", { id: `approve-${orderId}` });
      
      const res = await api.post(`/lab/orders/${orderId}/approve`);
      
      if (res.success) {
        toast.success(res.message, { id: `approve-${orderId}` });
        setDetailsModal({ open: false, testData: null });
        fetchPendingApprovals();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Approval failed", { id: `approve-${orderId}` });
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDetails = async (orderId) => {
    try {
      toast.loading("Loading report details...", { id: "viewDetails" });
      const res = await api.get(`/lab/orders/${orderId}`);
      if (res.success) {
        setDetailsModal({ open: true, testData: res.data });
        toast.success("Details loaded", { id: "viewDetails" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading details", { id: "viewDetails" });
    }
  };

  const filteredData = pendingOrders.filter(order => {
    const q = searchQuery.toLowerCase();
    return (
      order.OrderNumber.toLowerCase().includes(q) ||
      order.PatientName.toLowerCase().includes(q) ||
      order.UHID.toLowerCase().includes(q) ||
      order.TestNames.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
  const pageData = filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50/50">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <ShieldCheck className="text-teal-600" size={28} />
            Lab Test Approvals
          </h1>
          <p className="text-slate-500 mt-1">Review and digitally sign laboratory results uploaded by technicians.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Review</p>
              <p className="text-lg font-bold text-slate-900">{pendingOrders.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 mb-6 bg-slate-100 p-1.5 rounded-[20px] w-fit">
        <button
          onClick={() => setActiveTab("approvals")}
          className={`
            px-6 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2
            ${activeTab === "approvals" 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            }
          `}
        >
          <FileCheck size={18} />
          Pending Approvals
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`
            px-6 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2
            ${activeTab === "settings" 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            }
          `}
        >
          <PenTool size={18} />
          Signature Settings
        </button>
      </div>

      {activeTab === "approvals" ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search by Order ID, Patient, or Test..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchPendingApprovals}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all border border-slate-200 flex items-center gap-2"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Order Details</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Patient</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tests</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Uploaded On</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-slate-400 font-medium">Loading pending approvals...</p>
                    </div>
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3 opacity-60">
                      <FileCheck size={48} className="text-slate-200" />
                      <p className="text-sm font-medium">All clear! No results pending approval.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageData.map((order) => (
                  <tr key={order.Id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-900 text-sm">{order.OrderNumber}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${order.Priority === 'STAT' ? 'bg-red-500' : 'bg-slate-300'}`}></span>
                        {order.Priority} Priority
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-800 text-sm">{order.PatientName}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">{order.UHID}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm text-slate-600 line-clamp-2 max-w-[250px] font-medium">{order.TestNames}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm text-slate-700 font-bold">
                        {new Date(order.ReportedAt).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                        {new Date(order.ReportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleViewDetails(order.Id)}
                          className="p-2.5 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all"
                          title="View Report"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleApprove(order.Id)}
                          disabled={processingId === order.Id}
                          className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all
                            ${processingId === order.Id 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-900/10'
                            }
                          `}
                        >
                          <CheckCircle2 size={16} />
                          Approve Result
                        </button>
                        <button 
                          onClick={() => handleReject(order.Id)}
                          disabled={processingId === order.Id}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <AlertCircle size={16} />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Sidebar-style */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
          </div>
      ) : (
        <SignatureSettings />
      )}


      {detailsModal.open && (
        <TestDetailsModal 
          test={detailsModal.testData} 
          onClose={() => setDetailsModal({ open: false, testData: null })} 
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
