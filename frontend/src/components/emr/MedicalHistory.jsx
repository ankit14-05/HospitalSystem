import React, { useState, useEffect } from "react";
import { Icon, S } from "./shared";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function MedicalHistory({ patientId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patientId}/medical-history`);
        const data = res.data?.data || res.data || [];
        
        // Group by year
        const grouped = data.reduce((acc, entry) => {
          const date = new Date(entry.DiagnosedDate || entry.CreatedAt);
          const year = date.getFullYear();
          const monthStr = date.toLocaleString('default', { month: 'short' });
          const day = date.getDate();

          if (!acc[year]) acc[year] = [];
          acc[year].push({
            month: monthStr,
            day: day,
            title: entry.ConditionName,
            desc: `${entry.EnteredByName || 'Unknown'} - ${entry.Notes || 'No notes'}`,
            tag: entry.Status || 'Active',
            tagBg: entry.Status === 'Resolved' ? '#f3f4f6' : '#dbeafe',
            tagColor: entry.Status === 'Resolved' ? '#374151' : '#1e40af',
            active: entry.Status === 'Active'
          });
          return acc;
        }, {});

        const result = Object.keys(grouped)
          .sort((a, b) => b - a)
          .map(year => ({
            year: parseInt(year),
            entries: grouped[year]
          }));

        setHistory(result);
      } catch (err) {
        toast.error("Failed to load medical history");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [patientId]);

  if (loading) {
    return (
      <div style={{ ...S.card, marginTop: 20, textAlign: 'center', padding: '40px' }}>
        <div className="spinner w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Loading history...</p>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Medical History</h2>
        <button style={S.btn.outline}><Icon.Export /> Export Timeline</button>
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: 14 }}>
          No medical history found for this patient.
        </div>
      ) : (
        history.map(group => (
          <div key={group.year} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 16, paddingLeft: 80 }}>{group.year}</div>
            {group.entries.map((e, j) => (
              <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 12 }}>
                {/* Date bubble */}
                <div style={{ width: 80, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 4 }}>
                  <div style={{
                    background: e.active ? "#4f46e5" : "#f3f4f6",
                    color: e.active ? "#fff" : "#6b7280",
                    borderRadius: 8, padding: "5px 8px", textAlign: "center",
                    minWidth: 44, border: e.active ? "none" : "1px solid #e5e7eb",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{e.month}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{e.day}</div>
                  </div>
                </div>
                {/* Entry card */}
                <div style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111827", marginBottom: 4 }}>{e.title}</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{e.desc}</div>
                  </div>
                  <span style={{ ...S.badge(e.tagBg, e.tagColor), marginLeft: 16, whiteSpace: "nowrap" }}>{e.tag}</span>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}