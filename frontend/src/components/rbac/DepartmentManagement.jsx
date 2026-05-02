import React, { useState } from 'react'
import { Card, CardContent, Badge, Button, Input, Label, Switch } from './shared/UiComponents'
import { FormModal, DetailModal, ConfirmDialog } from './shared/Modals'
import { DataTable } from './shared/DataTable'
import { Building2, Plus, Users, Eye, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

const emptyForm = { name: '', code: '', floor: '', description: '', isActive: true }

export function DepartmentManagement({ departments, users, roles, onDepartmentsChange }) {
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [viewingDept, setViewingDept] = useState(null)
  const [togglingDept, setTogglingDept] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const getDeptMemberCount = (deptId) => users.filter(u => u.departmentIds.includes(deptId)).length
  const getDeptMembers = (deptId) => users.filter(u => u.departmentIds.includes(deptId))
  const getRoleName = (roleId) => { if (!roleId) return 'N/A'; const role = roles.find(r => r.id === roleId); return role ? role.displayName : 'N/A' }
  const getRoleColor = (roleId) => { if (!roleId) return '#64748b'; const role = roles.find(r => r.id === roleId); return role ? role.colorCode : '#64748b' }

  const openAddModal = () => { setEditingDept(null); setForm(emptyForm); setFormOpen(true) }
  const openEditModal = (dept) => { setEditingDept(dept); setForm({ name: dept.name, code: dept.code, floor: dept.floor, description: dept.description, isActive: dept.isActive }); setFormOpen(true) }

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Department name is required'); return }
    if (!form.code.trim()) { toast.error('Department code is required'); return }
    setSaving(true)
    setTimeout(() => {
      if (editingDept) {
        const updated = departments.map(d => d.id === editingDept.id ? { ...d, name: form.name.trim(), code: form.code.trim().toUpperCase(), floor: form.floor.trim(), description: form.description.trim(), isActive: form.isActive } : d)
        onDepartmentsChange(updated); toast.success(`Department "${form.name.trim()}" updated successfully`)
      } else {
        const newDept = { id: Date.now().toString(), name: form.name.trim(), code: form.code.trim().toUpperCase(), floor: form.floor.trim(), description: form.description.trim(), isActive: form.isActive }
        onDepartmentsChange([...departments, newDept]); toast.success(`Department "${form.name.trim()}" created successfully`)
      }
      setSaving(false); setFormOpen(false)
    }, 400)
  }

  const openDetail = (dept) => { setViewingDept(dept); setDetailOpen(true) }
  const openToggleConfirm = (dept) => { setTogglingDept(dept); setConfirmOpen(true) }

  const handleToggleActive = () => {
    if (!togglingDept) return
    const updated = departments.map(d => d.id === togglingDept.id ? { ...d, isActive: !d.isActive } : d)
    onDepartmentsChange(updated)
    toast.success(`Department "${togglingDept.name}" ${togglingDept.isActive ? 'deactivated' : 'activated'} successfully`)
    setConfirmOpen(false); setTogglingDept(null)
  }

  const columns = [
    { key: 'name', header: 'Department', className: 'min-w-[220px]', render: (dept) => (
      <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><Building2 className="h-4.5 w-4.5 text-emerald-600" /></div><div><div className="font-medium text-slate-900">{dept.name}</div><div className="text-xs text-slate-500">{dept.code}</div></div></div>
    )},
    { key: 'floor', header: 'Floor', className: 'min-w-[120px]', render: (dept) => <span className="text-sm text-slate-600">{dept.floor}</span> },
    { key: 'users', header: 'Users', className: 'min-w-[80px]', render: (dept) => <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400" /><span className="text-sm font-medium text-slate-700">{getDeptMemberCount(dept.id)}</span></div> },
    { key: 'status', header: 'Status', className: 'min-w-[100px]', render: (dept) => <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full flex-shrink-0 ${dept.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} /><span className={`text-sm ${dept.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>{dept.isActive ? 'Active' : 'Inactive'}</span></div> },
    { key: 'actions', header: 'Actions', className: 'min-w-[160px]', render: (dept) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); openDetail(dept) }}><Eye className="h-4 w-4 mr-1" />View</Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); openEditModal(dept) }}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
      </div>
    )},
  ]

  const detailMembers = viewingDept ? getDeptMembers(viewingDept.id) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold text-slate-900">Department Management</h2><p className="text-sm text-slate-500 mt-1">Manage hospital departments, their details and member assignments</p></div>
        <Button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"><Plus className="h-4 w-4 mr-2" />Add Department</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Building2 className="h-5 w-5 text-emerald-600" /></div><div><div className="text-2xl font-bold text-slate-900">{departments.length}</div><div className="text-xs text-slate-500">Total Departments</div></div></div></CardContent></Card>
        <Card className="border-slate-200 shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /></div><div><div className="text-2xl font-bold text-slate-900">{departments.filter(d => d.isActive).length}</div><div className="text-xs text-slate-500">Active Departments</div></div></div></CardContent></Card>
        <Card className="border-slate-200 shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center"><Users className="h-5 w-5 text-slate-500" /></div><div><div className="text-2xl font-bold text-slate-900">{users.length}</div><div className="text-xs text-slate-500">Total Staff</div></div></div></CardContent></Card>
      </div>
      <DataTable data={departments} columns={columns} searchPlaceholder="Search departments..." searchKeys={['name', 'code']} pageSize={10} emptyMessage="No departments found" emptyIcon={<Building2 className="h-10 w-10 text-slate-300" />} />

      {/* Add/Edit Modal */}
      <FormModal open={formOpen} onOpenChange={setFormOpen} title={editingDept ? 'Edit Department' : 'Add Department'} description={editingDept ? 'Update the department information below' : 'Fill in the details to create a new department'} icon={<Building2 className="h-5 w-5" />}
        footer={<div className="flex items-center gap-2"><Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className="border-slate-200">Cancel</Button><Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">{saving ? 'Saving...' : editingDept ? 'Update Department' : 'Create Department'}</Button></div>}>
        <div className="space-y-5">
          <div className="space-y-2"><Label htmlFor="dept-name">Department Name *</Label><Input id="dept-name" placeholder="e.g., Cardiology" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="border-slate-200" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="dept-code">Department Code *</Label><Input id="dept-code" placeholder="e.g., CARD" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} className="border-slate-200 uppercase" /></div>
            <div className="space-y-2"><Label htmlFor="dept-floor">Floor</Label><Input id="dept-floor" placeholder="e.g., 4th Floor" value={form.floor} onChange={(e) => setForm(f => ({ ...f, floor: e.target.value }))} className="border-slate-200" /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="dept-desc">Description</Label><Input id="dept-desc" placeholder="Brief description of the department" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="border-slate-200" /></div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4"><div><Label className="text-sm font-medium">Active Status</Label><div className="text-xs text-slate-500 mt-0.5">{form.isActive ? 'Department is currently active' : 'Department is currently inactive'}</div></div><Switch checked={form.isActive} onCheckedChange={(checked) => setForm(f => ({ ...f, isActive: checked }))} /></div>
        </div>
      </FormModal>

      {/* Detail Modal */}
      <DetailModal open={detailOpen} onOpenChange={setDetailOpen} title={viewingDept?.name ?? 'Department Details'} subtitle={viewingDept?.code} icon={<Building2 className="h-5 w-5" />}>
        {viewingDept && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"><div className="text-xs text-slate-500 mb-1">Code</div><div className="text-sm font-semibold text-slate-900">{viewingDept.code}</div></div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"><div className="text-xs text-slate-500 mb-1">Floor</div><div className="text-sm font-semibold text-slate-900">{viewingDept.floor || '—'}</div></div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"><div className="text-xs text-slate-500 mb-1">Status</div><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full flex-shrink-0 ${viewingDept.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} /><span className={`text-sm font-medium ${viewingDept.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>{viewingDept.isActive ? 'Active' : 'Inactive'}</span></div></div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"><div className="text-xs text-slate-500 mb-1">Members</div><div className="text-sm font-semibold text-slate-900">{detailMembers.length}</div></div>
            </div>
            {viewingDept.description && <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"><div className="text-xs text-slate-500 mb-1">Description</div><div className="text-sm text-slate-700">{viewingDept.description}</div></div>}
            <div>
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-900">Department Members ({detailMembers.length})</h3></div>
              {detailMembers.length === 0 ? (<div className="text-center py-8 rounded-lg border border-dashed border-slate-200 bg-slate-50/30"><Users className="h-8 w-8 text-slate-300 mx-auto mb-2" /><div className="text-sm text-slate-500">No members assigned to this department</div></div>) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">{detailMembers.map(member => { const primaryRoleColor = getRoleColor(member.primaryRoleId); return (<div key={member.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 hover:bg-slate-50/50 transition-colors"><div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><span className="text-sm font-semibold text-emerald-700">{member.firstName[0]}{member.lastName[0]}</span></div><div className="flex-1 min-w-0"><div className="text-sm font-medium text-slate-900 truncate">{member.firstName} {member.lastName}</div><div className="text-xs text-slate-500 truncate">{member.email}</div></div><Badge className="text-xs border-0 flex-shrink-0" style={{ backgroundColor: `${primaryRoleColor}18`, color: primaryRoleColor }}>{getRoleName(member.primaryRoleId)}</Badge></div>) })}</div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" className="border-slate-200" onClick={() => { setDetailOpen(false); openEditModal(viewingDept) }}><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Department</Button>
              <Button variant="outline" size="sm" className={`border-slate-200 ${viewingDept.isActive ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`} onClick={() => { setDetailOpen(false); openToggleConfirm(viewingDept) }}>{viewingDept.isActive ? 'Deactivate' : 'Activate'}</Button>
            </div>
          </div>
        )}
      </DetailModal>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={togglingDept?.isActive ? 'Deactivate Department' : 'Activate Department'} description={togglingDept?.isActive ? `Are you sure you want to deactivate "${togglingDept.name}"? Members in this department may lose access to certain resources.` : `Are you sure you want to activate "${togglingDept?.name}"? Members will regain access to department resources.`} onConfirm={handleToggleActive} variant={togglingDept?.isActive ? 'destructive' : 'default'} />
    </div>
  )
}
