import { useState, useRef } from "react";
import { Icon, S, DoctorAvatar } from "./shared";

const NOTES = [
  {
    title: "Cardiology Follow-up",
    doctor: "Dr. Sharma", date: "20 Feb 2026",
    content: "Patient reports improved energy levels. Blood pressure stable at 120/80 mmHg. Heart rate regular. Continue current medication regimen - Metoprolol 50mg and Aspirin 75mg. Next follow-up scheduled in 3 months.",
    tags: ["Cardiology", "Follow-up"],
    expanded: false,
  },
  {
    title: "General Checkup",
    doctor: "Dr. Verma", date: "05 Feb 2026",
    content: "Routine examination completed. All vitals within normal range. Weight stable. Recommended annual blood work and lipid profile. Patient advised to maintain current diet and exercise routine.",
    tags: ["General", "Routine"],
    expanded: true,
  },
  {
    title: "Dermatology Consultation",
    doctor: "Dr. Patel", date: "15 Jan 2026",
    content: "Patient presented with a skin rash on the left forearm. Prescribed topical cream for 2 weeks. Follow up if symptoms persist or worsen. No signs of systemic involvement.",
    tags: ["Dermatology", "Consultation"],
    expanded: false,
  },
  {
    title: "Endocrinology Review",
    doctor: "Dr. Mehta", date: "10 Jan 2026",
    content: "HbA1c improved to 7.1%. Continue current metformin dosage. Patient educated on carbohydrate counting and portion control. Next review in 3 months.",
    tags: ["Endocrinology", "Review"],
    expanded: false,
  },
  {
    title: "Neurology Consultation",
    doctor: "Dr. Elena Rodriguez", date: "05 Dec 2025",
    content: "Patient reports occasional mild headaches. No focal neurological deficit on examination. MRI Brain not indicated at this stage. Advised stress management techniques and adequate sleep.",
    tags: ["Neurology", "Consultation"],
    expanded: false,
  },
];

const DOCTORS = ["All Doctors", "Dr. Sharma", "Dr. Verma", "Dr. Patel", "Dr. Mehta", "Dr. Elena Rodriguez"];

export default function ClinicalNotes() {
  const [expanded, setExpanded] = useState({ 1: true });
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState("All Doctors");
  const [showDocFilter, setShowDocFilter] = useState(false);
  const debounce = useRef(null);

  const handleSearch = (val) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setSearch(val.trim().toLowerCase()), 300);
  };

  const filtered = NOTES.filter(n => {
    const matchSearch = !search || n.title.toLowerCase().includes(search) || n.content.toLowerCase().includes(search) || n.doctor.toLowerCase().includes(search);
    const matchDoc = docFilter === "All Doctors" || n.doctor === docFilter;
    return matchSearch && matchDoc;
  });

  const truncate = (text, len = 120) => text.length > len ? text.slice(0, len) + "..." : text;

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Clinical Reports</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}><Icon.Search /></span>
            <input
              placeholder="Search reports..." onChange={e => handleSearch(e.target.value)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 12px 7px 32px", fontSize: 13, width: 220, fontFamily: "inherit", color: "#374151", outline: "none" }}
            />
          </div>
          {/* Filter by Doctor */}
          <div style={{ position: "relative" }}>
            <button style={S.btn.outline} onClick={() => setShowDocFilter(v => !v)}>
              Filter by Doctor <Icon.ChevronDown />
            </button>
            {showDocFilter && (
              <div style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, zIndex: 10, minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                {DOCTORS.map(d => (
                  <div key={d} onClick={() => { setDocFilter(d); setShowDocFilter(false); }}
                    style={{ padding: "9px 16px", fontSize: 13, cursor: "pointer", color: docFilter === d ? "#1a56db" : "#374151", fontWeight: docFilter === d ? 600 : 400, background: docFilter === d ? "#eff6ff" : "transparent" }}>
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
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", borderLeft: "4px solid #0d9488" }}>
              <div style={{ padding: "14px 18px" }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{note.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <DoctorAvatar name={note.doctor} size={26} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{note.doctor}</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>|</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{note.date}</span>
                    <button onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 0 }}>
                      {isExpanded ? <Icon.ChevronUp /> : <Icon.ChevronDown />}
                    </button>
                  </div>
                </div>
                {/* Content */}
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "0 0 10px" }}>
                  {isExpanded ? note.content : (
                    <>
                      {truncate(note.content)}
                      {note.content.length > 120 && (
                        <span onClick={() => setExpanded(p => ({ ...p, [i]: true }))}
                          style={{ color: "#1a56db", cursor: "pointer", marginLeft: 4 }}>Read more</span>
                      )}
                    </>
                  )}
                </p>
                {/* Tags */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {note.tags.map(tag => (
                    <span key={tag} style={{ background: "#f3f4f6", color: "#374151", fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid #e5e7eb" }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}