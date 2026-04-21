import React, { useState, useEffect, useRef } from "react";
import { Icon, S, DoctorAvatar } from "./shared";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function ClinicalNotes({ patientId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState("All Doctors");
  const [showDocFilter, setShowDocFilter] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (!patientId) return;

    const fetchNotes = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patientId}/clinical-notes`);
        const data = res.data?.data || res.data || [];
        setNotes(data);
      } catch (err) {
        toast.error("Failed to load clinical notes");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [patientId]);

  const doctors = ["All Doctors", ...new Set(notes.map(n => n.EnteredByName))];

  const handleSearch = (val) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setSearch(val.trim().toLowerCase()), 300);
  };

  const filtered = notes.filter(n => {
    const matchSearch = !search || n.Title.toLowerCase().includes(search) || n.Notes.toLowerCase().includes(search) || n.EnteredByName.toLowerCase().includes(search);
    const matchDoc = docFilter === "All Doctors" || n.EnteredByName === docFilter;
    return matchSearch && matchDoc;
  });

  const truncate = (text, len = 120) => text.length > len ? text.slice(0, len) + "..." : text;

  if (loading) {
    return (
      <div style={{ ...S.card, marginTop: 20, textAlign: 'center', padding: '40px' }}>
        <div className="spinner w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Loading reports...</p>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Clinical Reports</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}><Icon.Search /></span>
            <input
              placeholder="Search reports..." onChange={e => handleSearch(e.target.value)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 12px 7px 32px", fontSize: 13, width: 220, fontFamily: "inherit", color: "#374151", outline: "none" }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <button style={S.btn.outline} onClick={() => setShowDocFilter(v => !v)}>
              Filter by Doctor <Icon.ChevronDown />
            </button>
            {showDocFilter && (
              <div style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                {doctors.map(d => (
                  <div key={d} onClick={() => { setDocFilter(d); setShowDocFilter(false); }}
                    style={{ padding: "9px 16px", fontSize: 13, cursor: "pointer", color: docFilter === d ? "#4f46e5" : "#374151", fontWeight: docFilter === d ? 600 : 400, background: docFilter === d ? "#f5f3ff" : "transparent" }}>
                    {d}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af", fontSize: 14 }}>No notes found.</div>
        ) : filtered.map((note, i) => {
          const isExpanded = !!expanded[i];
          return (
            <div key={note.Id || i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", borderLeft: "4px solid #0d9488" }}>
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{note.Title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <DoctorAvatar name={note.EnteredByName} size={26} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{note.EnteredByName}</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>|</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{new Date(note.DateNote).toLocaleDateString()}</span>
                    <button onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 0 }}>
                      {isExpanded ? <Icon.ChevronUp /> : <Icon.ChevronDown />}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "0 0 10px" }}>
                  {isExpanded ? note.Notes : (
                    <>
                      {truncate(note.Notes)}
                      {note.Notes.length > 120 && (
                        <span onClick={() => setExpanded(p => ({ ...p, [i]: true }))}
                          style={{ color: "#4f46e5", cursor: "pointer", marginLeft: 4 }}>Read more</span>
                      )}
                    </>
                  )}
                </p>
                {note.Tags && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {note.Tags.split(',').map(tag => (
                      <span key={tag} style={{ background: "#f3f4f6", color: "#374151", fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid #e5e7eb" }}>{tag.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}