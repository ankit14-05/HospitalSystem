import React, { useState, useMemo } from 'react'
import { Card, CardContent, Badge, Button, Input, Label } from './shared/UiComponents'
import { Select, SelectItem } from './shared/UiComponents'
import { FormModal, DetailModal, ConfirmDialog } from './shared/Modals'
import { DataTable } from './shared/DataTable'
import { Stethoscope, Plus, Users, UserCircle, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

function getDoctorName(users, doctorId) { const doctor = users.find(u => u.id === doctorId); return doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Unknown' }
function getDepartmentName(departments, departmentId) { const dept = departments.find(d => d.id === departmentId); return dept ? dept.name : 'Unknown' }
function getDepartmentCode(departments, departmentId) { const dept = departments.find(d => d.id === departmentId); return dept ? dept.code : 'N/A' }

export function PatientAssignments({ assignments, users, departments, onAssignmentsChange }) {
  const [showAssign, setShowAssign] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showToggleActive, setShowToggleActive] = useState(false)
  const [showUnassign, setShowUnassign] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)

  const [formPatientName, setFormPatientName] = useState('')
  const [formPatientId, setFormPatientId] = useState('')
  const [formDoctorId, setFormDoctorId] = useState('')
  const [formDepartmentId, setFormDepartmentId] = useState('')
  const [reassignDoctorId, setReassignDoctorId] = useState('')

  const doctors = useMemo(() => users.filter(u => u.isActive && u.roleIds.includes('r2')), [users])
  const activeDepartments = useMemo(() => departments.filter(d => d.isActive), [departments])

  const generatePatientId = () => { const num = Math.floor(Math.random() * 900) + 100; return `pat-${num}` }

  const handleOpenAssign = () => { setFormPatientName(''); setFormPatientId(generatePatientId()); setFormDoctorId(''); setFormDepartmentId(''); setShowAssign(true) }

  const handleSaveAssign = () => {
    if (!formPatientName.trim()) { toast.error('Patient name is required'); return }
    if (!formDoctorId) { toast.error('Please select a doctor'); return }
    if (!formDepartmentId) { toast.error('Please select a department'); return }
    setSaving(true)
    try {
      const newAssignment = { id: Date.now().toString(), patientId: formPatientId, patientName: formPatientName.trim(), doctorId: formDoctorId, departmentId: formDepartmentId, assignedBy: null, assignedAt: new Date().toISOString(), isActive: true }
      onAssignmentsChange([...assignments, newAssignment]); toast.success(`Patient ${formPatientName} assigned successfully`); setShowAssign(false)
    } catch { toast.error('Failed to assign patient') } finally { setSaving(false) }
  }

  const handleViewDetail = (a) => { setSelectedAssignment(a); setShowDetail(true) }
  const handleOpenReassign = (a) => { setSelectedAssignment(a); setReassignDoctorId(a.doctorId); setShowReassign(true) }

  const handleSaveReassign = () => {
    if (!selectedAssignment) return
    if (!reassignDoctorId) { toast.error('Please select a doctor'); return }
    if (reassignDoctorId === selectedAssignment.doctorId) { toast.error('Please select a different doctor'); return }
    setSaving(true)
    try { const updated = assignments.map(a => a.id === selectedAssignment.id ? { ...a, doctorId: reassignDoctorId } : a); onAssignmentsChange(updated); toast.success(`Patient reassigned to ${getDoctorName(users, reassignDoctorId)}`); setShowReassign(false) } catch { toast.error('Failed to reassign patient') } finally { setSaving(false) }
  }

  const handleOpenToggleActive = (a) => { setSelectedAssignment(a); setShowToggleActive(true) }
  const handleToggleActive = () => {
    if (!selectedAssignment) return; setSaving(true)
    try { const updated = assignments.map(a => a.id === selectedAssignment.id ? { ...a, isActive: !a.isActive } : a); onAssignmentsChange(updated); toast.success(`Assignment ${selectedAssignment.isActive ? 'deactivated' : 'activated'} successfully`); setShowToggleActive(false) } catch { toast.error('Failed to update assignment status') } finally { setSaving(false) }
  }

  const handleOpenUnassign = (a) => { setSelectedAssignment(a); setShowUnassign(true) }
  const handleUnassign = () => {
    if (!selectedAssignment) return; setSaving(true)
    try { const updated = assignments.map(a => a.id === selectedAssignment.id ? { ...a, isActive: false } : a); onAssignmentsChange(updated); toast.success(`Patient ${selectedAssignment.patientName} unassigned`); setShowUnassign(false) } catch { toast.error('Failed to unassign patient') } finally { setSaving(false) }
  }

  const columns = [
    { key: 'patient', header: 'Patient', render: (a) => (<div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{a.patientName.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}</div><div><p className="font-medium text-slate-700 text-sm">{a.patientName}</p><p className="text-[11px] text-slate-500">{a.patientId}</p></div></div>) },
    { key: 'doctor', header: 'Doctor', render: (a) => { const doctor = users.find(u => u.id === a.doctorId); return doctor ? (<div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{doctor.firstName.charAt(0)}{doctor.lastName.charAt(0)}</div><span className="font-medium text-slate-700 text-sm">{doctor.firstName} {doctor.lastName}</span></div>) : <span className="text-slate-500 text-sm">Unknown</span> } },
    { key: 'department', header: 'Department', render: (a) => { const dept = departments.find(d => d.id === a.departmentId); return dept ? <Badge variant="outline" className="text-[10px] font-medium border-slate-200">{dept.name}</Badge> : <span className="text-slate-500 text-sm">N/A</span> } },
    { key: 'assignedAt', header: 'Assigned Date', sortable: true, render: (a) => <span className="text-xs text-slate-600">{new Date(a.assignedAt).toLocaleDateString()}</span> },
    { key: 'status', header: 'Status', render: (a) => (<div className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${a.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} /><Badge className={`text-[10px] font-medium ${a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{a.isActive ? 'Active' : 'Inactive'}</Badge></div>) },
    { key: 'actions', header: 'Actions', render: (a) => (<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleViewDetail(a)}>View</Button>{a.isActive && <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => handleOpenReassign(a)}>Reassign</Button>}<Button size="sm" variant="ghost" className={`h-8 px-2 ${a.isActive ? 'text-slate-600 hover:text-slate-700 hover:bg-slate-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`} onClick={() => handleOpenToggleActive(a)}>{a.isActive ? 'Deactivate' : 'Activate'}</Button>{a.isActive && <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleOpenUnassign(a)}>Unassign</Button>}</div>) },
  ]

  const activeCount = assignments.filter(a => a.isActive).length
  const inactiveCount = assignments.filter(a => !a.isActive).length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold text-slate-900">Patient Assignments</h3><p className="text-sm text-slate-500">Manage doctor-patient assignments and tracking</p></div><Button onClick={handleOpenAssign} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"><Plus className="h-4 w-4 mr-2" /> Assign Patient</Button></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0"><Users className="h-5 w-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-slate-900">{assignments.length}</p><p className="text-xs text-slate-500">Total Assignments</p></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0"><Stethoscope className="h-5 w-5 text-teal-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{activeCount}</p><p className="text-xs text-slate-500">Active</p></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0"><UserCircle className="h-5 w-5 text-gray-500" /></div><div><p className="text-2xl font-bold text-gray-500">{inactiveCount}</p><p className="text-xs text-slate-500">Inactive</p></div></CardContent></Card>
      </div>
      <Card className="border-0 shadow-sm"><CardContent className="p-6"><DataTable data={assignments} columns={columns} searchPlaceholder="Search by patient name..." searchKeys={['patientName']} emptyMessage="No patient assignments found" emptyIcon={<Stethoscope className="h-10 w-10 text-slate-300" />} /></CardContent></Card>

      {/* Assign Modal */}
      <FormModal open={showAssign} onOpenChange={setShowAssign} title="Assign Patient to Doctor" description="Create a new doctor-patient assignment" icon={<Stethoscope className="h-5 w-5" />}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowAssign(false)} disabled={saving} className="border-slate-200">Cancel</Button><Button onClick={handleSaveAssign} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">{saving ? 'Assigning...' : 'Assign Patient'}</Button></div>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label className="text-sm font-medium">Patient Name *</Label><Input value={formPatientName} onChange={e => setFormPatientName(e.target.value)} placeholder="Enter patient name" className="border-slate-200" /></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Patient ID</Label><Input value={formPatientId} onChange={e => setFormPatientId(e.target.value)} placeholder="Auto-generated" className="border-slate-200 bg-slate-50" readOnly /><p className="text-[11px] text-slate-500">Auto-generated patient identifier</p></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Doctor *</Label><Select value={formDoctorId} onValueChange={setFormDoctorId}>{doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName} — {d.designation}</SelectItem>)}</Select></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Department *</Label><Select value={formDepartmentId} onValueChange={setFormDepartmentId}>{activeDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>)}</Select></div>
        </div>
      </FormModal>

      {/* Detail Modal */}
      {selectedAssignment && (<DetailModal open={showDetail} onOpenChange={setShowDetail} title="Patient Assignment Details" subtitle={`${selectedAssignment.patientId} — ${selectedAssignment.patientName}`} icon={<Stethoscope className="h-5 w-5" />}>
        <div className="space-y-6">
          <div><h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Patient Information</h4><div className="grid grid-cols-2 gap-4"><div className="bg-slate-50 rounded-lg p-3"><p className="text-[11px] text-slate-500 mb-1">Name</p><p className="text-sm font-medium text-slate-800">{selectedAssignment.patientName}</p></div><div className="bg-slate-50 rounded-lg p-3"><p className="text-[11px] text-slate-500 mb-1">Patient ID</p><p className="text-sm font-medium text-slate-800">{selectedAssignment.patientId}</p></div></div></div>
          <div><h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Assigned Doctor</h4><div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(() => { const doc = users.find(u => u.id === selectedAssignment.doctorId); return doc ? `${doc.firstName.charAt(0)}${doc.lastName.charAt(0)}` : '??' })()}</div><div><p className="text-sm font-medium text-slate-800">{getDoctorName(users, selectedAssignment.doctorId)}</p><p className="text-[11px] text-slate-500">{selectedAssignment.doctorId}</p></div></div></div>
          <div><h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Department</h4><div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Building2 className="h-5 w-5 text-slate-600" /></div><div><p className="text-sm font-medium text-slate-800">{getDepartmentName(departments, selectedAssignment.departmentId)}</p><p className="text-[11px] text-slate-500">{getDepartmentCode(departments, selectedAssignment.departmentId)}</p></div></div></div>
          <div><h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Assignment Details</h4><div className="grid grid-cols-2 gap-4"><div className="bg-slate-50 rounded-lg p-3"><p className="text-[11px] text-slate-500 mb-1">Assigned Date</p><p className="text-sm font-medium text-slate-800">{new Date(selectedAssignment.assignedAt).toLocaleDateString()}</p></div><div className="bg-slate-50 rounded-lg p-3"><p className="text-[11px] text-slate-500 mb-1">Status</p><div className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${selectedAssignment.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} /><Badge className={`text-[10px] font-medium ${selectedAssignment.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{selectedAssignment.isActive ? 'Active' : 'Inactive'}</Badge></div></div></div></div>
        </div>
      </DetailModal>)}

      {/* Reassign Modal */}
      {selectedAssignment && (<FormModal open={showReassign} onOpenChange={setShowReassign} title="Reassign Patient" description={`Reassign ${selectedAssignment.patientName} to a different doctor`} icon={<Stethoscope className="h-5 w-5" />}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowReassign(false)} disabled={saving} className="border-slate-200">Cancel</Button><Button onClick={handleSaveReassign} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">{saving ? 'Reassigning...' : 'Reassign'}</Button></div>}>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3"><p className="text-[11px] text-slate-500 mb-1">Current Doctor</p><p className="text-sm font-medium text-slate-800">{getDoctorName(users, selectedAssignment.doctorId)}</p></div>
          <div className="flex justify-center"><span className="text-slate-400 text-xs">↓</span></div>
          <div className="space-y-2"><Label className="text-sm font-medium">New Doctor *</Label><Select value={reassignDoctorId} onValueChange={setReassignDoctorId}>{doctors.map(d => <SelectItem key={d.id} value={d.id} disabled={d.id === selectedAssignment.doctorId}>{d.firstName} {d.lastName} — {d.designation}</SelectItem>)}</Select></div>
        </div>
      </FormModal>)}

      {selectedAssignment && <ConfirmDialog open={showToggleActive} onOpenChange={setShowToggleActive} title={selectedAssignment.isActive ? 'Deactivate Assignment' : 'Activate Assignment'} description={selectedAssignment.isActive ? `Are you sure you want to deactivate the assignment for ${selectedAssignment.patientName}?` : `Are you sure you want to reactivate the assignment for ${selectedAssignment.patientName}?`} onConfirm={handleToggleActive} variant={selectedAssignment.isActive ? 'destructive' : 'default'} loading={saving} />}
      {selectedAssignment && <ConfirmDialog open={showUnassign} onOpenChange={setShowUnassign} title="Unassign Patient" description={`Are you sure you want to unassign ${selectedAssignment.patientName} from ${getDoctorName(users, selectedAssignment.doctorId)}?`} onConfirm={handleUnassign} variant="destructive" loading={saving} />}
    </div>
  )
}
