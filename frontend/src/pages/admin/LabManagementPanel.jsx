import React, { useState, useEffect } from 'react';
import { Microscope, Plus, Trash2, Building, Layers, FlaskConical, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function LabManagementPanel() {
  const [activeTab, setActiveTab] = useState('rooms');
  
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
  
  // Delete Modal State
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type }

  // Load initial data
  useEffect(() => {
    fetchRooms();
    fetchRules();
    fetchTestCategories();
    fetchLabs();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/lab/rooms');
      if (res.success) setRooms(res.data);
    } catch (err) {
      toast.error("Failed to load rooms");
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
        toast.success("Room added successfully");
        setRoomForm({ roomNo: '' });
        fetchRooms();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add room");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    
    try {
      if (type === 'room') {
        const res = await api.delete(`/lab/rooms/${id}`);
        if (res.success) {
          toast.success("Room deleted successfully");
          fetchRooms();
          fetchRules(); // Refresh rules that might be broken
        }
      } else if (type === 'rule') {
        const res = await api.delete(`/lab/autofill-rules/${id}`);
        if (res.success) {
          toast.success("Rule deleted successfully");
          fetchRules();
          fetchRooms();
        }
      } else if (type === 'test') {
        const res = await api.delete(`/lab/tests/${id}`);
        if (res.success) {
          toast.success("Lab test deleted successfully");
          fetchTestCategories();
        }
      }
    } catch (err) {
      toast.error(`Failed to delete ${type}`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.testCategory || !ruleForm.place) return;
    if (ruleForm.place === 'Indoor' && !ruleForm.roomId) return;
    try {
      const res = await api.post('/lab/autofill-rules', ruleForm);
      if (res.success) {
        toast.success("Autofill rule saved successfully");
        setRuleForm({ testCategory: '', place: 'Indoor', roomId: '', labId: '' });
        fetchRules();
        fetchRooms(); // Refresh room status
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save rule");
    }
  };

  const handleAddTest = async (e) => {
    e.preventDefault();
    if (!testForm.name) return;
    try {
      const res = await api.post('/lab/tests', { name: testForm.name });
      if (res.success) {
        toast.success("Lab test added successfully");
        setTestForm({ name: '' });
        fetchTestCategories(); // Refresh the list
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add test");
    }
  };

  // --- UI Components ---
  const renderTabBtn = (id, label, Icon) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-5 py-3 font-medium transition-all text-sm border-b-2
          ${isActive 
            ? 'text-teal-900 border-teal-600 bg-white' 
            : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'}`}
      >
        <Icon size={16} className={isActive ? 'text-teal-600' : 'text-slate-400'} />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-full p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 shadow-sm shadow-teal-100">
          <Microscope size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Lab Management</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage clinical rooms and dynamic autofill heuristics.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 mb-6 px-2">
        {renderTabBtn('rooms', 'Room Settings', Building)}
        {renderTabBtn('autofill', 'Autofill Rules', Layers)}
        {renderTabBtn('tests', 'Lab Tests', FlaskConical)}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* ROOMS TAB */}
        {activeTab === 'rooms' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Add New Room</h2>
            <form onSubmit={handleAddRoom} className="flex gap-4 items-end mb-8 max-w-2xl">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Room Number</label>
                <input 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm" 
                  required 
                  placeholder="e.g. 104A" 
                  value={roomForm.roomNo} 
                  onChange={e => setRoomForm({ ...roomForm, roomNo: e.target.value })} 
                />
              </div>
              <button type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors shadow-sm shadow-teal-200">
                <Plus size={16} /> Add Room
              </button>
            </form>

            <div className="flex justify-between items-center py-4 border-t border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Active Clinical Rooms</h2>
              <select 
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                value={roomFilter} 
                onChange={e => setRoomFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Alloted">Alloted Only</option>
                <option value="Not-Alloted">Not-alloted Only</option>
              </select>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Room No</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rooms
                    .filter(r => {
                      if (roomFilter === 'All') return true;
                      if (roomFilter === 'Alloted') return r.Status === 'Alloted';
                      if (roomFilter === 'Not-Alloted') return r.Status !== 'Alloted';
                      return true;
                    })
                    .map(r => (
                    <tr key={r.Id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{r.RoomNo}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                          r.Status === 'Alloted' 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {r.Status === 'Alloted' ? 'Alloted' : 'Not-alloted'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => setDeleteConfirm({ id: r.Id, type: 'room' })} 
                          title="Delete Room"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rooms.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center text-slate-400 font-medium">No rooms configured</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUTOFILL TAB */}
        {activeTab === 'autofill' && (
          <div className="p-6">
            <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-200 text-sm text-slate-600 flex items-start gap-3">
              <AlertTriangle size={18} className="text-teal-600 flex-shrink-0 mt-0.5" />
              <p><strong>How it works:</strong> When a doctor selects a test from the mapped category, the system will automatically pre-select the designated Room in the dropdown.</p>
            </div>

            <h2 className="text-lg font-bold text-slate-800 mb-4">Create Suggestion Rule</h2>
            <form onSubmit={handleAddRule} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end mb-8">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Lab Test</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm appearance-none" 
                  required 
                  value={ruleForm.testCategory} 
                  onChange={e => setRuleForm({ ...ruleForm, testCategory: e.target.value })}
                >
                  <option value="">Select Lab Test...</option>
                  {tests.map(t => <option key={t.Id} value={t.Name}>{t.Name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Place</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm appearance-none" 
                  required 
                  value={ruleForm.place} 
                  onChange={e => setRuleForm({ ...ruleForm, place: e.target.value, roomId: '', labId: '' })}
                >
                  <option value="Indoor">Indoor (Clinic)</option>
                  <option value="Outdoor">Outdoor (External)</option>
                </select>
              </div>
              
              {ruleForm.place === 'Indoor' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Target Room</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm appearance-none" 
                    required 
                    value={ruleForm.roomId} 
                    onChange={e => setRuleForm({ ...ruleForm, roomId: e.target.value })}
                  >
                    <option value="">Select Room...</option>
                    {rooms.map(r => (
                      <option key={r.Id} value={r.Id}>{r.RoomNo}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">External Lab</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm appearance-none" 
                    value={ruleForm.labId} 
                    onChange={e => setRuleForm({ ...ruleForm, labId: e.target.value })}
                  >
                    <option value="">None / Manual</option>
                    {labs.map(l => (
                      <option key={l.Id} value={l.Id}>{l.Name} ({l.Type})</option>
                    ))}
                  </select>
                </div>
              )}
              
              <button type="submit" className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors shadow-sm shadow-teal-200 w-full h-11">
                <Plus size={16} /> Save
              </button>
            </form>

            <h2 className="text-lg font-bold text-slate-800 mb-4 pt-6 border-t border-slate-100">Configured Autofill Rules</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Lab Test</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Autofill Target</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rules.map(r => (
                    <tr key={r.Id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">{r.TestCategory}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                          r.Place === 'Indoor' ? 'bg-sky-50 text-sky-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {r.Place}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {r.Place === 'Indoor' ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold tracking-wide bg-emerald-50 text-emerald-700">
                            Room: {r.RoomNo}
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold tracking-wide bg-amber-50 text-amber-700">
                            Lab: {r.LabName || 'Manual Selection'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" 
                          onClick={() => setDeleteConfirm({ id: r.Id, type: 'rule' })} 
                          title="Delete Rule"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">No autofill rules established</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LAB TESTS TAB */}
        {activeTab === 'tests' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Add New Lab Test</h2>
            <form onSubmit={handleAddTest} className="flex gap-4 items-end mb-8 max-w-2xl">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Test Name (Auto-Capitalized)</label>
                <input 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm uppercase" 
                  required 
                  placeholder="e.g. LIVER FUNCTION TEST" 
                  value={testForm.name} 
                  onChange={e => setTestForm({ ...testForm, name: e.target.value.toUpperCase() })} 
                />
              </div>
              <button type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors shadow-sm shadow-teal-200">
                <Plus size={16} /> Add Test
              </button>
            </form>

            <h2 className="text-lg font-bold text-slate-800 mb-4 pt-6 border-t border-slate-100">Configured Lab Tests</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-100 max-w-3xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">Test Name</th>
                    <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tests.map(t => (
                    <tr key={t.Id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{t.Name}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" 
                          onClick={() => setDeleteConfirm({ id: t.Id, type: 'test' })} 
                          title="Delete Test"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tests.length === 0 && (
                    <tr>
                      <td colSpan="2" className="px-6 py-12 text-center text-slate-400 font-medium">No tests configured</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Confirm Deletion</h3>
              <p className="text-slate-500 text-sm">
                Are you sure you want to delete this {deleteConfirm.type}? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)} 
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete {deleteConfirm.type}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
