import { useState } from "react";
import { Icon, S, Pagination, DoctorAvatar } from "./shared";

const ALL_PRESCRIPTIONS = [
  { date: "Oct 24, 2023", doctor: "Dr. Sarah Jenkins",   specialty: "Cardiology",        specialtyBg: "#dbeafe", specialtyColor: "#1e40af", med: "Atorvastatin",  dose: "20mg · Oral · Nightly",     status: "Active",          statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { date: "Oct 12, 2023", doctor: "Dr. Michael Chen",    specialty: "Internal Medicine",  specialtyBg: "#f3f4f6", specialtyColor: "#374151", med: "Metformin",     dose: "500mg · Oral · Twice Daily",status: "Refill Required", statusColor: "#d97706", statusBg: "#fffbeb" },
  { date: "Sep 05, 2023", doctor: "Dr. Elena Rodriguez", specialty: "Neurology",          specialtyBg: "#ede9fe", specialtyColor: "#6d28d9", med: "Gabapentin",    dose: "300mg · Oral · As Needed",  status: "Expired",         statusColor: "#dc2626", statusBg: "#fef2f2" },
  { date: "Aug 20, 2023", doctor: "Dr. Sarah Jenkins",   specialty: "Cardiology",        specialtyBg: "#dbeafe", specialtyColor: "#1e40af", med: "Lisinopril",    dose: "10mg · Oral · Morning",     status: "Active",          statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { date: "Jul 14, 2023", doctor: "Dr. Michael Chen",    specialty: "Internal Medicine",  specialtyBg: "#f3f4f6", specialtyColor: "#374151", med: "Metformin",     dose: "500mg · Oral · Evening",    status: "Active",          statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { date: "Jun 01, 2023", doctor: "Dr. Verma",           specialty: "General",            specialtyBg: "#dcfce7", specialtyColor: "#166534", med: "Omeprazole",   dose: "20mg · Before Breakfast",   status: "Expired",         statusColor: "#dc2626", statusBg: "#fef2f2" },
  { date: "May 20, 2023", doctor: "Dr. Elena Rodriguez", specialty: "Neurology",          specialtyBg: "#ede9fe", specialtyColor: "#6d28d9", med: "Pregabalin",   dose: "75mg · Oral · Nightly",     status: "Active",          statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { date: "Apr 10, 2023", doctor: "Dr. Sharma",          specialty: "Cardiology",        specialtyBg: "#dbeafe", specialtyColor: "#1e40af", med: "Aspirin",       dose: "75mg · Once Daily",         status: "Active",          statusColor: "#16a34a", statusBg: "#f0fdf4" },
  { date: "Mar 05, 2023", doctor: "Dr. Mehta",           specialty: "Endocrinology",      specialtyBg: "#fce7f3", specialtyColor: "#9d174d", med: "Glimepiride",  dose: "2mg · With Breakfast",      status: "Refill Required", statusColor: "#d97706", statusBg: "#fffbeb" },
  { date: "Feb 18, 2023", doctor: "Dr. Sarah Jenkins",   specialty: "Cardiology",        specialtyBg: "#dbeafe", specialtyColor: "#1e40af", med: "Bisoprolol",    dose: "5mg · Morning",             status: "Expired",         statusColor: "#dc2626", statusBg: "#fef2f2" },
  { date: "Jan 30, 2023", doctor: "Dr. Verma",           specialty: "General",            specialtyBg: "#dcfce7", specialtyColor: "#166534", med: "Paracetamol",  dose: "500mg · As Needed",         status: "Expired",         statusColor: "#dc2626", statusBg: "#fef2f2" },
  { date: "Jan 05, 2023", doctor: "Dr. Sharma",          specialty: "Cardiology",        specialtyBg: "#dbeafe", specialtyColor: "#1e40af", med: "Amlodipine",    dose: "5mg · Once Daily",          status: "Active",          statusColor: "#16a34a", statusBg: "#f0fdf4" },
];

const PER_PAGE = 4;

export default function Prescriptions() {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(ALL_PRESCRIPTIONS.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const rows = ALL_PRESCRIPTIONS.slice(start, start + PER_PAGE);

  const DOT = (color) => <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", marginRight: 5 }} />;

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Prescription History</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Manage and track patient medication records</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn.outline}><Icon.Filter /> Filter</button>
          <button style={S.btn.primary}><Icon.Prescription /> Issue Prescription</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["DATE ISSUED","DOCTOR","SPECIALTY","MEDICATIONS","STATUS","ACTIONS"].map(h => (
                <th key={h} style={{ padding: "11px 16px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textAlign: "left", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "14px 16px", fontSize: 14, color: "#374151" }}>{r.date}</td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <DoctorAvatar name={r.doctor} size={34} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{r.doctor}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ ...S.pill(r.specialtyBg, r.specialtyColor), fontSize: 12 }}>{r.specialty}</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{r.med}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{r.dose}</div>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", background: r.statusBg, borderRadius: 20, padding: "4px 10px", width: "fit-content" }}>
                    {DOT(r.statusColor)}
                    <span style={{ fontSize: 13, fontWeight: 500, color: r.statusColor }}>{r.status}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "#1a56db", padding: 4 }}>
                    <Icon.Download />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={ALL_PRESCRIPTIONS.length} perPage={PER_PAGE} onChange={setPage} />
    </div>
  );
}