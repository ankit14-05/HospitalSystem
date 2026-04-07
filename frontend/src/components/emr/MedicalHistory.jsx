import { Icon, S } from "./shared";

const HISTORY = [
  { year: 2026, entries: [
    { month: "Feb", day: 20, title: "Cardiology Consultation", desc: "Dr. Sharma - Routine checkup, ECG performed", tag: "CONSULTATION", tagBg: "#dbeafe", tagColor: "#1e40af", active: true },
    { month: "Feb", day: 10, title: "Lab Tests Completed", desc: "Blood work and lipid profile - All results normal", tag: "LAB WORK", tagBg: "#f3f4f6", tagColor: "#374151", active: false },
  ]},
  { year: 2025, entries: [
    { month: "Dec", day: 15, title: "Annual Health Checkup", desc: "General examination by Dr. Mehta - No issues found", tag: "CHECKUP", tagBg: "#f3f4f6", tagColor: "#374151", active: false },
    { month: "Aug", day: 22, title: "Dermatology Visit", desc: "Skin consultation - Prescribed topical treatment", tag: "DERMATOLOGY", tagBg: "#dbeafe", tagColor: "#1e40af", active: false },
  ]},
];

export default function MedicalHistory() {
  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Medical History</h2>
        <button style={S.btn.outline}><Icon.Export /> Export Timeline</button>
      </div>

      {HISTORY.map(group => (
        <div key={group.year} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 16, paddingLeft: 80 }}>{group.year}</div>
          {group.entries.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 12 }}>
              {/* Date bubble */}
              <div style={{ width: 80, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 4 }}>
                <div style={{
                  background: e.active ? "#1a56db" : "#f3f4f6",
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
      ))}
    </div>
  );
}