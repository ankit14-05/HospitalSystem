import React, { useState, useEffect } from "react";
import { Icon, S } from "./shared";
import api from "../../services/api";
import toast from "react-hot-toast";

function AllergyCard({ item }) {
  const isCritical = item.Severity === 'Severe' || item.IsCritical;
  const bg = isCritical ? "#fef2f2" : item.Severity === 'Moderate' ? "#fffbeb" : "#eff6ff";
  const border = isCritical ? "#fecaca" : item.Severity === 'Moderate' ? "#fde68a" : "#bfdbfe";
  const severityBg = isCritical ? "#dc2626" : item.Severity === 'Moderate' ? "#f97316" : "#3b82f6";

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{item.AllergyName}</div>
        {isCritical && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#dc2626", fontWeight: 500 }}>
            <Icon.Alert size={13} /> Critical allergy
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ background: severityBg, color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>{item.Severity}</span>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{item.Reaction || 'No reaction notes'}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  if (React.Children.count(children) === 0) return null;
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

export default function AllergyInfo({ patientId }) {
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;

    const fetchAllergies = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/emr/${patientId}/allergies`);
        setAllergies(res.data?.data || res.data || []);
      } catch (err) {
        toast.error("Failed to load allergies");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllergies();
  }, [patientId]);

  const drugAllergies = allergies.filter(a => (a.Category || a.AllergyType)?.toLowerCase() === 'drug');
  const foodAllergies = allergies.filter(a => (a.Category || a.AllergyType)?.toLowerCase() === 'food');
  const envAllergies = allergies.filter(a => !['drug', 'food'].includes((a.Category || a.AllergyType)?.toLowerCase()));

  if (loading) {
    return (
      <div style={{ ...S.card, marginTop: 20, textAlign: 'center', padding: '40px' }}>
        <div className="spinner w-6 h-6 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p style={{ marginTop: 12, color: '#6b7280', fontSize: 13 }}>Loading allergies...</p>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Allergy Records</h2>
          <div style={{ color: "#dc2626" }}><Icon.Alert size={18} /></div>
        </div>
        <button style={S.btn.outline}><Icon.Plus /> Report New Allergy</button>
      </div>

      {/* Warning banner */}
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626", borderRadius: 8, padding: "12px 16px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ color: "#dc2626", marginTop: 1, flexShrink: 0 }}><Icon.Alert size={16} /></div>
        <span style={{ fontSize: 13, color: "#991b1b", fontWeight: 500 }}>
          Critical: Always inform healthcare providers about allergies before any treatment or medication.
        </span>
      </div>

      {allergies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: 14 }}>
          No allergy records found for this patient.
        </div>
      ) : (
        <>
          <Section title="Drug Allergies" icon="💊">
            {drugAllergies.map((a, i) => <AllergyCard key={i} item={a} />)}
          </Section>

          <Section title="Food Allergies" icon="🍎">
            {foodAllergies.map((a, i) => <AllergyCard key={i} item={a} />)}
          </Section>

          <Section title="Environmental & Other" icon="🍃">
            {envAllergies.map((a, i) => <AllergyCard key={i} item={a} />)}
          </Section>
        </>
      )}
    </div>
  );
}