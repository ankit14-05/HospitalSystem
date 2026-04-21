import { useState, useCallback, useEffect } from "react";
import api from "../../services/api";

const LAB_OPTIONS = ["Apollo Diagnostics", "SRL Diagnostics", "Dr Lal PathLabs", "Metropolis", "Thyrocare"];

const initialForm = {
  testId: "",
  priority: "Routine",
  place: "Indoor",
  roomNo: "",
  labName: "",
  criteria: "",
  additionalDetails: "",
};

function Badge({ type }) {
  const styles = {
    Routine: { background: "#e6f9f0", color: "#0f6e56", border: "1px solid #9fe1cb" },
    Urgent: { background: "#faeeda", color: "#854f0b", border: "1px solid #fac775" },
    STAT: { background: "#fcebeb", color: "#a32d2d", border: "1px solid #f09595" },
  };
  return (
    <span style={{ ...styles[type], fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {type}
    </span>
  );
}

function Toast({ message, type, onClose }) {
  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 1000,
      background: type === "error" ? "#fcebeb" : "#e6f9f0",
      border: `1px solid ${type === "error" ? "#f09595" : "#9fe1cb"}`,
      color: type === "error" ? "#a32d2d" : "#0f6e56",
      borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 500,
      display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      animation: "slideIn 0.2s ease"
    }}>
      <span>{type === "error" ? "⚠" : "✓"}</span>
      {message}
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 8, color: "inherit", fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  );
}

export default function BookLabTest() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [tests, setTests] = useState([]);
  const [toast, setToast] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [testDropdownOptions, setTestDropdownOptions] = useState([]);

  const [labRooms, setLabRooms] = useState([]);
  const [autofillRules, setAutofillRules] = useState([]);
  const [externalLabs, setExternalLabs] = useState([]);

  useEffect(() => {
    // Fetch Tests
    api.get("/lab/tests")
      .then(res => {
        if (res.success) {
          setTestDropdownOptions(res.data);
        }
      })
      .catch(err => console.error("Could not fetch test options:", err));

    // Fetch Rooms
    api.get("/lab/rooms")
      .then(res => {
        if (res.success) {
          setLabRooms(res.data);
        }
      })
      .catch(err => console.error("Could not fetch lab rooms:", err));
      
    // Fetch Autofill Rules
    api.get("/lab/autofill-rules")
      .then(res => {
        if (res.success) setAutofillRules(res.data);
      })
      .catch(err => console.error("Could not fetch autofill rules:", err));

    // Fetch External Labs
    api.get("/lab/labs")
      .then(res => {
        if (res.success) setExternalLabs(res.data);
      })
      .catch(err => console.error("Could not fetch external labs:", err));
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length >= 3) {
      setIsSearching(true);
      try {
        const res = await api.get(`/patients/search?q=${encodeURIComponent(val.trim())}`);
        console.log("Search API Response:", res);
        if (res.success) {
          const formatted = (res.data || []).map(p => ({
            id: p.UHID || p.Id?.toString() || "Unknown",
            patientId: p.Id,
            name: p.FullName || `${p.FirstName || ''} ${p.LastName || ''}`.trim() || 'No Name',
            phone: p.Phone || ""
          }));
          console.log("Formatted options:", formatted);
          setSearchResults(formatted);
        }
      } catch (err) {
        console.error("Search failed:", err);
        showToast("Search API failed: " + (err.response?.data?.message || err.message), "error");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchQuery(patient.id);
    setSearchResults([]);
  };

  // Helper to map test category to room based on DB rules
  const getAutoRoom = (testId, rules) => {
    const selTest = testDropdownOptions.find(t => t.Id.toString() === testId);
    if (!selTest || !rules) return null;
    return rules.find(r => r.TestCategory === selTest.Category) || null;
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      
      if (field === "testId") {
        const rule = getAutoRoom(value, autofillRules);
        if (rule) {
          next.place = rule.Place;
          next.roomNo = rule.RoomNo || "";
          next.labName = rule.LabName || "";
        }
      }

      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const errs = {};
    if (!form.testId) errs.testId = "Test type is required.";
    if (!form.priority) errs.priority = "Priority is required.";
    if (!form.place) errs.place = "Place is required.";
    if (form.place === "Indoor" && !form.roomNo) {
      errs.roomNo = "Please select a clinical room.";
    }
    if (form.place === "Outdoor" && !form.labName) errs.labName = "Lab name is required for Outdoor.";
    if (form.criteria.length > 150) errs.criteria = "Max 150 characters.";
    if (form.additionalDetails.length > 500) errs.additionalDetails = "Max 500 characters.";
    return errs;
  };

  const handleAddTest = () => {
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (tests.some((t) => t.testId === form.testId)) {
      showToast("This test is already added.", "error");
      return;
    }
    const selTest = testDropdownOptions.find(t => t.Id.toString() === form.testId);
    setTests((prev) => [...prev, { ...form, id: Date.now(), testName: selTest?.Name || "Unknown Test" }]);
    setForm(initialForm);
    setErrors({});
    showToast(`${selTest?.Name} added successfully.`);
  };

  const handleDeleteTest = (id) => {
    setTests((prev) => prev.filter((t) => t.id !== id));
  };

  const handleConfirmBooking = async () => {
    if (!selectedPatient) {
      showToast("Please select a patient first.", "error");
      return;
    }
    if (tests.length === 0) {
      showToast("Add at least one test to confirm booking.", "error");
      return;
    }
    
    const payload = {
      patientId: selectedPatient.patientId,
      tests: tests.map(t => ({ 
        testId: Number(t.testId),
        priority: t.priority,
        placeType: t.place,
        roomNo: t.roomNo || null,
        externalLabName: t.labName || null,
        criteria: t.criteria || null,
        additionalDetails: t.additionalDetails || null
      }))
    };

    try {
      const res = await api.post("/lab/orders", payload);
      if (res.success) {
        setSubmitted(true);
        showToast("Booking confirmed successfully!");
        setTests([]);
        setSelectedPatient(null);
        setSearchQuery("");
      }
    } catch (error) {
      console.error(error);
      let msg = error.message || "Failed to confirm booking.";
      if (error.errors && Array.isArray(error.errors)) {
        msg = error.errors.map(e => e.msg || e.message).join(", ");
      }
      showToast(msg, "error");
    }
  };

  const handleSaveDraft = () => {
    if (!selectedPatient) {
      showToast("Please select a patient before saving draft.", "error");
      return;
    }
    showToast("Draft saved successfully.");
  };

  const isAddDisabled =
    !form.testId ||
    !form.priority ||
    !form.place ||
    (form.place === "Indoor" && !form.roomNo.trim()) ||
    (form.place === "Outdoor" && !form.labName);

  const isConfirmDisabled = !selectedPatient || tests.length === 0;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#f0f2f0", minHeight: "100vh", padding: "32px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        input, select, textarea { font-family: inherit; }
        .field-error { border-color: #e24b4a !important; }
        .blt-input {
          width: 100%; padding: 10px 14px; border-radius: 8px;
          border: 1.5px solid #dde3dd; background: #f7f8f7;
          font-size: 14px; color: #1a2e1a; outline: none; transition: border 0.15s;
        }
        .blt-input:focus { border-color: #1d9e75; background: #fff; }
        .blt-input::placeholder { color: #a0aba0; }
        .blt-select {
          width: 100%; padding: 10px 14px; border-radius: 8px;
          border: 1.5px solid #dde3dd; background: #f7f8f7;
          font-size: 14px; color: #1a2e1a; outline: none; cursor: pointer;
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center;
          transition: border 0.15s;
        }
        .blt-select:focus { border-color: #1d9e75; background-color: #fff; }
        .blt-select:disabled { opacity: 0.5; cursor: not-allowed; }
        .err-msg { color: #a32d2d; font-size: 12px; margin-top: 4px; }
        .btn-add {
          width: 100%; padding: 13px; border-radius: 10px;
          background: #0f6e56; color: #fff; border: none;
          font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s;
        }
        .btn-add:hover:not(:disabled) { background: #085041; }
        .btn-add:active:not(:disabled) { transform: scale(0.99); }
        .btn-add:disabled { background: #9ab8b0; cursor: not-allowed; }
        .btn-draft {
          padding: 12px 24px; border-radius: 10px; background: #fff;
          border: 1.5px solid #c0ccc0; font-size: 14px; font-weight: 500;
          color: #444; cursor: pointer; transition: background 0.15s;
        }
        .btn-draft:hover { background: #f0f2f0; }
        .btn-confirm {
          padding: 12px 28px; border-radius: 10px;
          background: #0f6e56; color: #fff; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s;
        }
        .btn-confirm:hover:not(:disabled) { background: #085041; }
        .btn-confirm:disabled { background: #9ab8b0; cursor: not-allowed; }
        .patient-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #fff; border: 1.5px solid #dde3dd; border-radius: 8px;
          z-index: 100; box-shadow: 0 4px 16px rgba(0,0,0,0.08); overflow: hidden;
        }
        .patient-item {
          padding: 10px 14px; cursor: pointer; font-size: 14px;
          border-bottom: 1px solid #f0f2f0; transition: background 0.1s;
          display: flex; justify-content: space-between; align-items: center;
        }
        .patient-item:last-child { border-bottom: none; }
        .patient-item:hover { background: #e1f5ee; }
        .test-row { display: flex; align-items: center; padding: 14px 16px; border-bottom: 1px solid #f0f2f0; transition: background 0.1s; }
        .test-row:last-child { border-bottom: none; }
        .test-row:hover { background: #fafcfa; }
        .del-btn { background: none; border: none; cursor: pointer; color: #e24b4a; font-size: 16px; padding: 4px 8px; border-radius: 6px; transition: background 0.1s; }
        .del-btn:hover { background: #fcebeb; }
        label { font-size: 13px; font-weight: 500; color: #3a4a3a; display: block; margin-bottom: 6px; }
        .char-count { font-size: 11px; color: #a0aba0; text-align: right; margin-top: 3px; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {submitted && (
        <div style={{
          background: "#e1f5ee", border: "1.5px solid #5dcaa5", borderRadius: 12,
          padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12
        }}>
          <span style={{ fontSize: 20, color: "#0f6e56" }}>✓</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "#085041", fontSize: 15 }}>Booking Confirmed!</p>
            <p style={{ margin: 0, color: "#0f6e56", fontSize: 13 }}>
              {tests.length} test{tests.length > 1 ? "s" : ""} booked for {selectedPatient?.name} ({selectedPatient?.id})
            </p>
          </div>
        </div>
      )}

      <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, color: "#0d1f0d", letterSpacing: "-0.5px" }}>Book Lab Test</h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#607060" }}>Schedule a diagnostic procedure by selecting the patient, test parameters, and a convenient clinical time slot.</p>

      {/* Patient Search Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ position: "relative" }}>
          <input
            className="blt-input"
            placeholder="Search by ID, Number"
            value={searchQuery}
            onChange={handleSearchChange}
            style={{ background: "#fff", border: "1.5px solid #dde3dd" }}
          />
          {searchQuery.length >= 3 && (
            <div className="patient-dropdown">
              {isSearching ? (
                <div style={{ padding: "12px", fontSize: 13, color: "#607060", textAlign: "center" }}>Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((p) => (
                  <div key={p.id} className="patient-item" onClick={() => handleSelectPatient(p)}>
                    <span style={{ fontWeight: 500, color: "#1a2e1a" }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: "#607060" }}>{p.id} · {p.phone}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: "12px", fontSize: 13, color: "#a32d2d", textAlign: "center" }}>No patients found for "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>
        <input
          className="blt-input"
          placeholder="Patient id"
          value={selectedPatient?.id || ""}
          readOnly
          style={{ background: selectedPatient ? "#fff" : "#f0f2f0", cursor: "not-allowed" }}
        />
        <input
          className="blt-input"
          placeholder="Patient name"
          value={selectedPatient?.name || ""}
          readOnly
          style={{ background: selectedPatient ? "#fff" : "#f0f2f0", cursor: "not-allowed" }}
        />
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Left — Test Form */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e4ebe4" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 600, color: "#0d1f0d" }}>Test Type and Details</h2>

          {/* Test Type */}
          <div style={{ marginBottom: 16 }}>
            <label>Test Type</label>
            <select className={`blt-select${errors.testId ? " field-error" : ""}`} value={form.testId || ""} onChange={(e) => handleFormChange("testId", e.target.value)}>
              <option value="">Select Test Type</option>
              {testDropdownOptions.map((t) => <option key={t.Id} value={t.Id}>{t.Name}</option>)}
            </select>
            {errors.testId && <p className="err-msg">{errors.testId}</p>}
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 16 }}>
            <label>Priority</label>
            <select className={`blt-select${errors.priority ? " field-error" : ""}`} value={form.priority} onChange={(e) => handleFormChange("priority", e.target.value)}>
              <option value="Routine">Routine</option>
              <option value="Urgent">Urgent</option>
              <option value="STAT">STAT</option>
            </select>
          </div>

          {/* Place + Room/Lab */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label>Place</label>
              <select className={`blt-select${errors.place ? " field-error" : ""}`} value={form.place} onChange={(e) => handleFormChange("place", e.target.value)}>
                <option value="">Select Place</option>
                <option value="Indoor">Indoor (Rooms)</option>
                <option value="Outdoor">Outdoor (External)</option>
              </select>
            </div>
            <div>
              {form.place === "Indoor" ? (
                <>
                  <label>Room No</label>
                  <select
                    className={`blt-select${errors.roomNo ? " field-error" : ""}`}
                    value={form.roomNo}
                    onChange={(e) => handleFormChange("roomNo", e.target.value)}
                  >
                    <option value="">Select Room</option>
                    {labRooms.filter(r => r.IsActive !== false).map((r) => (
                      <option key={r.Id} value={r.RoomNo}>
                        Room: {r.RoomNo}
                      </option>
                    ))}
                  </select>
                  {errors.roomNo && <p className="err-msg">{errors.roomNo}</p>}
                </>
              ) : (
                <>
                  <label>Lab Name</label>
                  <select className={`blt-select${errors.labName ? " field-error" : ""}`} value={form.labName} onChange={(e) => handleFormChange("labName", e.target.value)}>
                    <option value="">Select Lab</option>
                    {externalLabs.map((l) => (
                      <option key={l.Id} value={l.Name}>{l.Name} ({l.Type})</option>
                    ))}
                  </select>
                  {errors.labName && <p className="err-msg">{errors.labName}</p>}
                </>
              )}
            </div>
          </div>

          {/* Criteria */}
          <div style={{ marginBottom: 16 }}>
            <label>Criteria for each test</label>
            <input
              className={`blt-input${errors.criteria ? " field-error" : ""}`}
              placeholder="Enter criteria"
              value={form.criteria}
              onChange={(e) => handleFormChange("criteria", e.target.value)}
              maxLength={160}
            />
            <div className="char-count">{form.criteria.length}/150</div>
            {errors.criteria && <p className="err-msg">{errors.criteria}</p>}
          </div>

          {/* Additional Details */}
          <div style={{ marginBottom: 24 }}>
            <label>Additional details</label>
            <textarea
              className={`blt-input${errors.additionalDetails ? " field-error" : ""}`}
              placeholder="Add any extra information..."
              value={form.additionalDetails}
              onChange={(e) => handleFormChange("additionalDetails", e.target.value)}
              rows={4}
              maxLength={510}
              style={{ resize: "vertical", minHeight: 90 }}
            />
            <div className="char-count">{form.additionalDetails.length}/500</div>
            {errors.additionalDetails && <p className="err-msg">{errors.additionalDetails}</p>}
          </div>

          <button className="btn-add" disabled={isAddDisabled} onClick={handleAddTest}>
            + Add Test
          </button>
        </div>

        {/* Right — Tests List */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e4ebe4", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f2f0" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#0d1f0d" }}>Total Tests</h2>
            {tests.length > 0 && (
              <span style={{ background: "#0f6e56", color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>
                {tests.length} Test{tests.length > 1 ? "s" : ""} Added
              </span>
            )}
          </div>

          {tests.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#a0aba0", padding: 32, gap: 8 }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="6" width="24" height="30" rx="3" stroke="#c0ccc0" strokeWidth="1.5"/>
                <line x1="13" y1="14" x2="27" y2="14" stroke="#c0ccc0" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="13" y1="20" x2="27" y2="20" stroke="#c0ccc0" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="13" y1="26" x2="21" y2="26" stroke="#c0ccc0" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p style={{ margin: 0, fontSize: 14 }}>No tests added yet</p>
              <p style={{ margin: 0, fontSize: 12 }}>Fill the form and click "+ Add Test"</p>
            </div>
          ) : (
            <>
              <div style={{ padding: "0 24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "3fr 1.2fr 1fr 0.5fr", padding: "12px 0", borderBottom: "1.5px solid #e4ebe4" }}>
                  {["Test Type", "Priority", "Place", ""].map((h, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#607060", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {tests.map((t) => (
                  <div key={t.id} className="test-row" style={{ padding: "12px 24px", display: "grid", gridTemplateColumns: "3fr 1.2fr 1fr 0.5fr", alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: "#1a2e1a", fontWeight: 500 }}>{t.testName}</span>
                    <Badge type={t.priority} />
                    <span style={{ fontSize: 13, color: "#607060" }}>{t.place}</span>
                    <button className="del-btn" onClick={() => handleDeleteTest(t.id)} title="Remove test">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M5.5 6v4.5M8.5 6v4.5M3 3.5l.7 7.7a1 1 0 001 .8h4.6a1 1 0 001-.8L11 3.5" stroke="#e24b4a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f2f0", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button className="btn-draft" onClick={handleSaveDraft}>Save as Draft</button>
            <button className="btn-confirm" disabled={isConfirmDisabled} onClick={handleConfirmBooking}>
              Confirm Booking
            </button>
          </div>
        </div>

      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "#a0aba0", textAlign: "center" }}>
        Search patients above (try "PT", "1001", or "Priya") · Indoor requires Room No · Outside requires Lab Name
      </p>
    </div>
  );
}