import { Icon, S } from "./shared";

const DRUG_ALLERGIES = [
  {
    name: "Penicillin",
    label: "Critical allergy",
    severity: "SEVERE - Anaphylaxis",
    severityBg: "#dc2626", severityColor: "#fff",
    confirmed: "Confirmed: 2020",
    bg: "#fef2f2", border: "#fecaca",
    critical: true,
  },
  {
    name: "Sulfa Drugs",
    label: null,
    severity: "MODERATE - Skin Rash",
    severityBg: "#f97316", severityColor: "#fff",
    confirmed: "Confirmed: 2018",
    bg: "#fffbeb", border: "#fde68a",
    critical: false,
  },
];

const FOOD_ALLERGIES = [
  {
    name: "Shellfish",
    severity: "MILD - Hives",
    severityBg: "#fef08a", severityColor: "#854d0e",
    confirmed: "Confirmed: 2019",
    bg: "#fefce8", border: "#fde68a",
  },
];

const ENV_ALLERGIES = [
  {
    name: "Dust Mites",
    severity: "MILD - Respiratory symptoms",
    severityBg: "#dbeafe", severityColor: "#1e40af",
    confirmed: "Self-reported",
    bg: "#eff6ff", border: "#bfdbfe",
  },
];

function AllergyCard({ item }) {
  return (
    <div style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{item.name}</div>
        {item.critical && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#dc2626", fontWeight: 500 }}>
            <Icon.Alert size={13} /> Critical allergy
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ background: item.severityBg, color: item.severityColor, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>{item.severity}</span>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{item.confirmed}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{title}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

export default function AllergyInfo() {
  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your Allergies</h2>
          <div style={{ color: "#dc2626" }}><Icon.Alert size={18} /></div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 1 }}>SECTION HEADER</span>
        </div>
        <button style={S.btn.outline}><Icon.Plus /> Report New Allergy</button>
      </div>

      {/* Warning banner */}
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626", borderRadius: 8, padding: "12px 16px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ color: "#dc2626", marginTop: 1, flexShrink: 0 }}><Icon.Alert size={16} /></div>
        <span style={{ fontSize: 13, color: "#991b1b", fontWeight: 500 }}>
          Critical: Always inform healthcare providers about your allergies before any treatment or medication
        </span>
      </div>

      <Section title="Drug Allergies" icon="💊">
        {DRUG_ALLERGIES.map((a, i) => <AllergyCard key={i} item={a} />)}
      </Section>

      <Section title="Food Allergies" icon="🍎">
        {FOOD_ALLERGIES.map((a, i) => <AllergyCard key={i} item={a} />)}
      </Section>

      <Section title="Environmental" icon="🍃">
        {ENV_ALLERGIES.map((a, i) => <AllergyCard key={i} item={a} />)}
      </Section>
    </div>
  );
}