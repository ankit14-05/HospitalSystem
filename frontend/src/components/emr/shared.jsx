import React from 'react';

// ── Icons ────────────────────────────────────────────────────────
export const Icon = {
  Plus: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 1v12M1 7h12"/></svg>,
  Export: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 7.5v4a1 1 0 001 1h7a1 1 0 001-1v-4M7 9.5v-8M4.5 4L7 1.5 9.5 4"/></svg>,
  ChevronDown: () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 4.5l3 3 3-3"/></svg>,
  ChevronUp: () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 7.5l3-3 3 3"/></svg>,
  ChevronLeft: () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7.5 2.5L4 6l3.5 3.5"/></svg>,
  ChevronRight: () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>,
  Sort: () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 5l3-3 3 3M9 7l-3 3-3-3"/></svg>,
  Print: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3.5 4.5v-3h7v3M3.5 9.5H2a1 1 0 01-1-1v-3h12v3a1 1 0 01-1 1h-1.5M4.5 7h5v5h-5v-5z"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 7c2-3 4-4 6-4s4 1 6 4-4 4-6 4-4-1-6-4z"/><circle cx="7" cy="7" r="2"/></svg>,
  Download: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 1.5v8M4 6.5l3 3 3-3M2.5 11.5h9"/></svg>,
  Video: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1.5" y="3.5" width="8" height="7" rx="1.5"/><path d="M9.5 6l3-2v6l-3-2"/></svg>,
  Calendar: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2.5" width="10" height="9" rx="1.5"/><path d="M2 5.5h10M4 1.5v2M10 1.5v2"/></svg>,
  Location: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 12s4.5-3.5 4.5-7A4.5 4.5 0 002.5 5C2.5 8.5 7 12 7 12z"/><circle cx="7" cy="5" r="1.5"/></svg>,
  Filter: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2.5h10l-4 4.5v4.5L6 10V7L2 2.5z"/></svg>,
  CheckCircle: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M4.5 7l2 2 3-3.5"/></svg>,
  Alert: ({size = 14}) => <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="6"/><path d="M7 4v3M7 10h.01"/></svg>,
  Prescription: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="1.5" width="8" height="11" rx="1"/><path d="M5 4.5h4M5 7.5h2"/></svg>,
  FileText: () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 1.5H3a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V4.5L9 1.5z"/><path d="M9 1.5V4.5h3M4 7.5h6M4 10.5h6"/></svg>,
  Trash: ({size = 14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeJoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>,
};

// ── Styles (S Object) ───────────────────────────────────────────────────
export const S = {
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "20px 24px"
  },
  btn: {
    primary: {
      background: "#1a56db", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
      fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
      gap: 6, fontFamily: "inherit"
    },
    outline: {
      background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 16px",
      fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center",
      gap: 6, fontFamily: "inherit"
    },
    teal: {
      background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
      fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
      gap: 6, fontFamily: "inherit"
    }
  },
  pill: (bg, color) => ({
    background: bg,
    color: color,
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600
  }),
  badge: (bg, color) => ({
    background: bg,
    color: color,
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5
  })
};


// ── Utilities (DoctorAvatar & Pagination) ─────────────────────────────────

const DOCTOR_COLORS = [
  { bg: "#fef2f2", color: "#ef4444" }, { bg: "#fff7ed", color: "#f97316" }, 
  { bg: "#fefce8", color: "#eab308" }, { bg: "#f0fdf4", color: "#22c55e" }, 
  { bg: "#ecfeff", color: "#06b6d4" }, { bg: "#eff6ff", color: "#3b82f6" },
  { bg: "#f5f3ff", color: "#8b5cf6" }, { bg: "#fdf2f8", color: "#ec4899" }
];

export function DoctorAvatar({ name, size = 32 }) {
  if (!name) return null;
  const initials = name.replace("Dr. ", "").split(" ").filter(w => w.length > 0).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % DOCTOR_COLORS.length;
  }
  const theme = DOCTOR_COLORS[Math.abs(h) % DOCTOR_COLORS.length];
  
  return (
    <div style={{ 
      width: size, height: size, borderRadius: "50%", 
      background: theme.bg, color: theme.color, 
      display: "flex", alignItems: "center", justifyContent: "center", 
      fontSize: size * 0.45, fontWeight: 700, flexShrink: 0 
    }}>
      {initials}
    </div>
  );
}

export function Pagination({ page, totalPages, total, perPage, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid #e5e7eb", flexWrap: "wrap", gap: 10 }}>
      {total !== undefined && perPage !== undefined ? (
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} entries
        </span>
      ) : <span />}
      
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button 
          onClick={() => onChange(Math.max(1, page - 1))} 
          disabled={page <= 1} 
          style={{ ...S.btn.outline, padding: "6px 10px", opacity: page <= 1 ? 0.5 : 1 }}
        >
          <Icon.ChevronLeft />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{page} / {totalPages}</span>
        <button 
          onClick={() => onChange(Math.min(totalPages, page + 1))} 
          disabled={page >= totalPages} 
          style={{ ...S.btn.outline, padding: "6px 10px", opacity: page >= totalPages ? 0.5 : 1 }}
        >
          <Icon.ChevronRight />
        </button>
      </div>
    </div>
  );
}
