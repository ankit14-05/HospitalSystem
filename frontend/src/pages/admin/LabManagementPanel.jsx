import React, { useState, useEffect } from 'react';
import { Microscope, Plus, Trash2, Building, Layers, FlaskConical } from 'lucide-react';
import api from '../../services/api';

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
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 8, color: "inherit", fontSize: 16 }}>×</button>
    </div>
  );
}

export default function LabManagementPanel() {
  const [activeTab, setActiveTab] = useState('rooms');
  const [toast, setToast] = useState(null);
  
  // Data State
  const [rooms, setRooms] = useState([]);
  const [rules, setRules] = useState([]);
  const [labs, setLabs] = useState([]); 
  const [tests, setTests] = useState([]); // Full tests list

  
  // Selected Data (For forms)
  const [testCategories, setTestCategories] = useState([]);
  
  // UI Filter State
  const [roomFilter, setRoomFilter] = useState('All');

  // Forms State
  const [roomForm, setRoomForm] = useState({ roomNo: '' });
  const [testForm, setTestForm] = useState({ name: '' });
  const [ruleForm, setRuleForm] = useState({ 
    testCategory: '', 
    place: 'Indoor', 
    roomId: '', 
    labId: '' 
  });
  
  // Load initial data
  useEffect(() => {
    fetchRooms();
    fetchRules();
    fetchTestCategories();
    fetchLabs();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRooms = async () => {
    try {
      const res = await api.get('/lab/rooms');
      if (res.success) setRooms(res.data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load rooms", "error");
    }
  };

  const fetchRules = async () => {
    try {
      const res = await api.get('/lab/autofill-rules');
      if (res.success) setRules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLabs = async () => {
    try {
      const res = await api.get('/lab/labs');
      if (res.success) setLabs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTestCategories = async () => {
    try {
      const res = await api.get('/lab/tests');
      if (res.success) {
        setTests(res.data);
        // Extract unique categories
        const cats = [...new Set(res.data.map(t => t.Category).filter(Boolean))];
        setTestCategories(cats.sort());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Handlers ---

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!roomForm.roomNo) return;
    try {
      const res = await api.post('/lab/rooms', {
        labId: 1, // Hardcoded global lab id for this demonstration
        roomNo: roomForm.roomNo
      });
      if (res.success) {
        showToast("Room added successfully");
        setRoomForm({ roomNo: '' });
        fetchRooms();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add room", "error");
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!window.confirm("Are you sure you want to delete this room?")) return;
    try {
      const res = await api.delete(`/lab/rooms/${id}`);
      if (res.success) {
        showToast("Room deleted successfully");
        fetchRooms();
        fetchRules(); // Because rules mapped to this room might be broken
      }
    } catch (err) {
      showToast("Failed to delete room", "error");
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.testCategory || !ruleForm.place) return;
    if (ruleForm.place === 'Indoor' && !ruleForm.roomId) return;
    try {
      const res = await api.post('/lab/autofill-rules', ruleForm);
      if (res.success) {
        showToast("Autofill rule saved successfully");
        setRuleForm({ testCategory: '', place: 'Indoor', roomId: '', labId: '' });
        fetchRules();
        fetchRooms(); // Refresh room status
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save rule", "error");
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this autofill rule?")) return;
    try {
      const res = await api.delete(`/lab/autofill-rules/${id}`);
      if (res.success) {
        showToast("Rule deleted successfully");
        fetchRules();
        fetchRooms();
      }
    } catch (err) {
      showToast("Failed to delete rule", "error");
    }
  };

  const handleAddTest = async (e) => {
    e.preventDefault();
    if (!testForm.name) return;
    try {
      const res = await api.post('/lab/tests', { name: testForm.name });
      if (res.success) {
        showToast("Lab test added successfully");
        setTestForm({ name: '' });
        fetchTestCategories(); // Refresh the list
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add test", "error");
    }
  };

  const handleDeleteTest = async (id) => {
    if (!window.confirm("Are you sure you want to delete this lab test?")) return;
    try {
      const res = await api.delete(`/lab/tests/${id}`);
      if (res.success) {
        showToast("Lab test deleted successfully");
        fetchTestCategories();
      }
    } catch (err) {
      showToast("Failed to delete test", "error");
    }
  };

  // --- UI Components ---
  
  const renderTabBtn = (id, label, Icon) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          background: isActive ? '#fff' : 'transparent',
          color: isActive ? '#0d1f0d' : '#607060',
          border: 'none', borderBottom: isActive ? '2px solid #0f6e56' : '2px solid transparent',
          fontWeight: isActive ? 600 : 500, cursor: 'pointer', transition: '0.2s', fontSize: 14
        }}
      >
        <Icon size={16} />
        {label}
      </button>
    );
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0f2f0", minHeight: "100%", padding: "32px 24px" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        input, select {
          padding: 10px 14px; border-radius: 8px; border: 1px solid #dde3dd;
          background: #f7f8f7; font-size: 14px; color: #1a2e1a; outline: none; transition: 0.2s;
        }
        input:focus, select:focus { border-color: #1d9e75; background: #fff; }
        .btn-submit {
          padding: 10px 16px; border-radius: 8px; background: #0f6e56; color: #fff;
          border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s;
          display: flex; alignItems: center; gap: 6px;
        }
        .btn-submit:hover { background: #085041; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 16px; border-bottom: 2px solid #e4ebe4; color: #607060; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 14px 16px; border-bottom: 1px solid #f0f2f0; color: #1a2e1a; font-size: 14px; }
        tr:hover td { background: #fafcfa; }
        .btn-del {
          background: none; border: none; color: #e24b4a; cursor: pointer;
          padding: 6px; border-radius: 6px; transition: 0.15s;
        }
        .btn-del:hover { background: #fcebeb; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#e1f5ee', padding: 12, borderRadius: 12, color: '#0f6e56' }}>
          <Microscope size={24} />
        </div>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, color: "#0d1f0d" }}>Lab Management</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#607060" }}>Manage clinical rooms and dynamic autofill heuristics.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #dde3dd', marginBottom: 24 }}>
        {renderTabBtn('rooms', 'Room Settings', Building)}
        {renderTabBtn('autofill', 'Autofill Rules', Layers)}
        {renderTabBtn('tests', 'Lab Tests', FlaskConical)}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e4ebe4', overflow: 'hidden' }}>
        
        {/* ROOMS TAB */}
        {activeTab === 'rooms' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#0d1f0d' }}>Add New Room</h2>
            <form onSubmit={handleAddRoom} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 32 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#3a4a3a', fontWeight: 500 }}>Room Number</label>
                <input style={{ width: '100%' }} required placeholder="e.g. 104A" value={roomForm.roomNo} onChange={e => setRoomForm({ ...roomForm, roomNo: e.target.value })} />
              </div>
              <button type="submit" className="btn-submit"><Plus size={16} /> Add Room</button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, paddingBottom: 16, borderTop: '1px solid #f0f2f0' }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#0d1f0d' }}>Active Clinical Rooms</h2>
              <select 
                style={{ width: 'auto', padding: '6px 12px', fontSize: 13, borderRadius: 6 }}
                value={roomFilter} 
                onChange={e => setRoomFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Alloted">Alloted Only</option>
                <option value="Not-Alloted">Not-alloted Only</option>
              </select>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Room No</th>
                  <th>Status</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rooms
                  .filter(r => {
                    if (roomFilter === 'All') return true;
                    if (roomFilter === 'Alloted') return r.Status === 'Alloted';
                    if (roomFilter === 'Not-Alloted') return r.Status !== 'Alloted';
                    return true;
                  })
                  .map(r => (
                  <tr key={r.Id}>
                    <td style={{ fontWeight: 600 }}>{r.RoomNo}</td>
                    <td>
                      <span style={{ 
                        background: r.Status === 'Alloted' ? '#e1f5ee' : '#f0f2f0',
                        color: r.Status === 'Alloted' ? '#0f6e56' : '#607060',
                        padding: '4px 10px', 
                        borderRadius: 20, 
                        fontSize: 12, 
                        fontWeight: 600 
                      }}>
                        {r.Status === 'Alloted' ? 'Alloted' : 'Not-alloted'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-del" onClick={() => handleDeleteRoom(r.Id)} title="Delete Room">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: '#a0aba0' }}>No rooms configured</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* AUTOFILL TAB */}
        {activeTab === 'autofill' && (
          <div style={{ padding: 24 }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, marginBottom: 24, border: '1px solid #e2e8f0', fontSize: 13, color: '#475569' }}>
              <strong>How it works:</strong> When a doctor selects a test from the mapped category, the system will automatically pre-select the designated Room in the dropdown.
            </div>

            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#0d1f0d' }}>Create Suggestion Rule</h2>
            <form onSubmit={handleAddRule} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 150px', gap: 16, alignItems: 'flex-end', marginBottom: 32 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#3a4a3a', fontWeight: 500 }}>Lab Test</label>
                <select style={{ width: '100%' }} required value={ruleForm.testCategory} onChange={e => setRuleForm({ ...ruleForm, testCategory: e.target.value })}>
                  <option value="">Select Lab Test...</option>
                  {tests.map(t => <option key={t.Id} value={t.Name}>{t.Name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#3a4a3a', fontWeight: 500 }}>Place</label>
                <select style={{ width: '100%' }} required value={ruleForm.place} onChange={e => setRuleForm({ ...ruleForm, place: e.target.value, roomId: '', labId: '' })}>
                  <option value="Indoor">Indoor (Clinic/Room)</option>
                  <option value="Outdoor">Outdoor (External Lab)</option>
                </select>
              </div>
              
              {ruleForm.place === 'Indoor' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#3a4a3a', fontWeight: 500 }}>Target Room</label>
                  <select style={{ width: '100%' }} required value={ruleForm.roomId} onChange={e => setRuleForm({ ...ruleForm, roomId: e.target.value })}>
                    <option value="">Select Room...</option>
                    {rooms.filter(r => r.Status !== 'Alloted').map(r => (
                      <option key={r.Id} value={r.Id}>{r.RoomNo}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#3a4a3a', fontWeight: 500 }}>External Lab (Optional)</label>
                  <select style={{ width: '100%' }} value={ruleForm.labId} onChange={e => setRuleForm({ ...ruleForm, labId: e.target.value })}>
                    <option value="">None / Manual</option>
                    {labs.map(l => (
                      <option key={l.Id} value={l.Id}>{l.Name} ({l.Type})</option>
                    ))}
                  </select>
                </div>
              )}
              
              <button type="submit" className="btn-submit"><Plus size={16} /> Save Rule</button>
            </form>

            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#0d1f0d', paddingTop: 24, borderTop: '1px solid #f0f2f0' }}>Configured Autofill Rules</h2>
            <table>
              <thead>
                <tr>
                  <th>Lab Test</th>
                  <th>Type</th>
                  <th>Autofill Target</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.Id}>
                    <td style={{ fontWeight: 500 }}>{r.TestCategory}</td>
                    <td>
                      <span style={{ 
                        background: r.Place === 'Indoor' ? '#f0f9ff' : '#fff7ed',
                        color: r.Place === 'Indoor' ? '#0369a1' : '#9a3412',
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase'
                      }}>
                        {r.Place}
                      </span>
                    </td>
                    <td>
                      {r.Place === 'Indoor' ? (
                        <span style={{ background: '#e1f5ee', color: '#0f6e56', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          Room: {r.RoomNo}
                        </span>
                      ) : (
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          Lab: {r.LabName || 'Manual Selection'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-del" onClick={() => handleDeleteRule(r.Id)} title="Delete Rule">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: '#a0aba0' }}>No autofill rules established</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* LAB TESTS TAB */}
        {activeTab === 'tests' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#0d1f0d' }}>Add New Lab Test</h2>
            <form onSubmit={handleAddTest} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 32 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#3a4a3a', fontWeight: 500 }}>Test Name (Auto-Capitalized)</label>
                <input 
                  style={{ width: '100%', textTransform: 'uppercase' }} 
                  required 
                  placeholder="e.g. LIVER FUNCTION TEST" 
                  value={testForm.name} 
                  onChange={e => setTestForm({ ...testForm, name: e.target.value.toUpperCase() })} 
                />
              </div>
              <button type="submit" className="btn-submit"><Plus size={16} /> Add Test</button>
            </form>

            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#0d1f0d', paddingTop: 24, borderTop: '1px solid #f0f2f0' }}>Configured Lab Tests</h2>
            <table>
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tests.map(t => (
                  <tr key={t.Id}>
                    <td style={{ fontWeight: 600 }}>{t.Name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-del" onClick={() => handleDeleteTest(t.Id)} title="Delete Test">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {tests.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', color: '#a0aba0' }}>No tests configured</td></tr>}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
