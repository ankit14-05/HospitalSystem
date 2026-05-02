import React, { useState } from 'react'
import { Card, CardContent, Badge, Button, Input, Label, Checkbox } from './shared/UiComponents'
import { Select, SelectItem } from './shared/UiComponents'
import { FormModal, DetailModal, ConfirmDialog } from './shared/Modals'
import { DataTable } from './shared/DataTable'
import { Copy, Plus, Eye, Layers, Trash2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { CATEGORY_COLORS, CATEGORY_LABELS } from './mockData'

export function RoleTemplates({ templates, roles, users, onTemplatesChange }) {
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('clinical')
  const [selectedRoleIds, setSelectedRoleIds] = useState([])
  const [applyUserIds, setApplyUserIds] = useState([])

  const resetForm = () => { setFormName(''); setFormDisplayName(''); setFormDescription(''); setFormCategory('clinical'); setSelectedRoleIds([]) }
  const getRoleById = (id) => roles.find(r => r.id === id)

  const handleCreate = () => { resetForm(); setShowCreate(true) }

  const handleSave = () => {
    if (!formName.trim() || !formDisplayName.trim()) { toast.error('Name and display name are required'); return }
    if (selectedRoleIds.length === 0) { toast.error('Select at least one role'); return }
    setSaving(true)
    try {
      const newTemplate = { id: Date.now().toString(), name: formName.trim(), displayName: formDisplayName.trim(), description: formDescription.trim(), category: formCategory, isSystem: false, roleIds: selectedRoleIds }
      onTemplatesChange([...templates, newTemplate]); toast.success('Template created successfully'); setShowCreate(false); resetForm()
    } catch { toast.error('Failed to create template') } finally { setSaving(false) }
  }

  const handleViewDetail = (t) => { setSelectedTemplate(t); setShowDetail(true) }
  const handleApplyTemplate = (t) => { setSelectedTemplate(t); setApplyUserIds([]); setShowApply(true) }

  const handleApply = () => {
    if (applyUserIds.length === 0) { toast.error('Select at least one user'); return }
    setSaving(true)
    try { toast.success(`Template applied to ${applyUserIds.length} user(s)`); setShowApply(false); setApplyUserIds([]) } catch { toast.error('Failed to apply template') } finally { setSaving(false) }
  }

  const handleDeleteClick = (t) => { if (t.isSystem) return; setSelectedTemplate(t); setShowDelete(true) }
  const handleDeleteConfirm = () => {
    if (!selectedTemplate) return; setSaving(true)
    try { onTemplatesChange(templates.filter(t => t.id !== selectedTemplate.id)); toast.success('Template deleted successfully'); setShowDelete(false); setSelectedTemplate(null) } catch { toast.error('Failed to delete template') } finally { setSaving(false) }
  }

  const columns = [
    { key: 'displayName', header: 'Template', sortable: true, render: (t) => (<div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Copy className="h-4 w-4 text-slate-500" /></div><div><p className="font-semibold text-slate-800">{t.displayName}</p><p className="text-xs text-slate-500">{t.name}</p></div></div>) },
    { key: 'category', header: 'Category', render: (t) => <Badge variant="secondary" className={`${CATEGORY_COLORS[t.category] || ''} font-medium`}>{CATEGORY_LABELS[t.category] || t.category}</Badge> },
    { key: 'roleIds', header: 'Bundled Roles', render: (t) => { const templateRoles = t.roleIds.map(id => getRoleById(id)).filter(Boolean); return (<div className="flex flex-wrap gap-1">{templateRoles.map(role => <Badge key={role.id} variant="outline" className="text-[10px] font-medium" style={{ borderColor: role.colorCode, color: role.colorCode }}>{role.displayName}</Badge>)}</div>) } },
    { key: 'isSystem', header: 'Type', render: (t) => t.isSystem ? <Badge className="text-[10px] bg-slate-100 text-slate-600 font-medium">System</Badge> : <Badge variant="outline" className="text-[10px] border-slate-200 font-medium">Custom</Badge> },
    { key: 'actions', header: 'Actions', render: (t) => (<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleViewDetail(t)}>View</Button><Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleApplyTemplate(t)}>Apply</Button><Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(t)} disabled={t.isSystem}>Delete</Button></div>) },
  ]

  const activeRoles = roles.filter(r => r.isActive)
  const activeUsers = users.filter(u => u.isActive)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold text-slate-900">Role Templates</h3><p className="text-sm text-slate-500">Pre-defined role bundles for quick user setup</p></div><Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"><Plus className="h-4 w-4 mr-2" /> Create Template</Button></div>
      <Card className="border-0 shadow-sm"><CardContent className="p-6"><DataTable data={templates} columns={columns} searchPlaceholder="Search templates..." searchKeys={['name', 'displayName']} onRowClick={(item) => handleViewDetail(item)} /></CardContent></Card>

      {/* Create Template Modal */}
      <FormModal open={showCreate} onOpenChange={setShowCreate} title="Create Role Template" description="Create a new template bundling multiple roles" icon={<Layers className="h-5 w-5" />} maxWidth="max-w-2xl"
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving} className="border-slate-200">Cancel</Button><Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">{saving ? 'Creating...' : 'Create Template'}</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-sm font-medium">Name *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. clinical_bundle" className="border-slate-200" /></div>
            <div className="space-y-2"><Label className="text-sm font-medium">Display Name *</Label><Input value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} placeholder="e.g. Clinical Bundle" className="border-slate-200" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-sm font-medium">Category</Label><Select value={formCategory} onValueChange={setFormCategory}>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</Select></div></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Description</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Template description..." className="border-slate-200" /></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Bundled Roles</Label><div className="grid grid-cols-2 gap-2">{activeRoles.map(role => { const checked = selectedRoleIds.includes(role.id); return (<label key={role.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer transition-all duration-150 ${checked ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}><Checkbox checked={checked} onCheckedChange={(val) => { if (val) setSelectedRoleIds([...selectedRoleIds, role.id]); else setSelectedRoleIds(selectedRoleIds.filter(id => id !== role.id)) }} /><div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.colorCode || '#6b7280' }} /><span className="font-medium">{role.displayName}</span></label>) })}</div></div>
        </div>
      </FormModal>

      {/* Detail Modal */}
      <DetailModal open={showDetail} onOpenChange={setShowDetail} title={selectedTemplate?.displayName || 'Template'} subtitle="Template details and bundled roles" icon={<Copy className="h-5 w-5" />}>
        {selectedTemplate && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Name</span><p className="font-semibold text-slate-800 mt-0.5">{selectedTemplate.name}</p></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Category</span><p className="mt-0.5"><Badge variant="secondary" className={CATEGORY_COLORS[selectedTemplate.category] || ''}>{CATEGORY_LABELS[selectedTemplate.category] || selectedTemplate.category}</Badge></p></div>
            </div>
            {selectedTemplate.description && <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Description</span><p className="text-sm text-slate-700 mt-0.5">{selectedTemplate.description}</p></div>}
            <div><h4 className="font-semibold text-sm text-slate-700 mb-3">Bundled Roles</h4><div className="flex flex-wrap gap-2">{selectedTemplate.roleIds.map(roleId => { const role = getRoleById(roleId); if (!role) return null; return <Badge key={role.id} variant="outline" className="font-medium border-slate-200 py-1 px-3" style={{ borderColor: role.colorCode, color: role.colorCode }}><Shield className="h-3 w-3 mr-1" />{role.displayName}</Badge> })}</div></div>
          </div>
        )}
      </DetailModal>

      {/* Apply Template Modal */}
      <FormModal open={showApply} onOpenChange={setShowApply} title={`Apply: ${selectedTemplate?.displayName || ''}`} description="Select users to apply this template to" icon={<Layers className="h-5 w-5" />} maxWidth="max-w-xl"
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowApply(false)} disabled={saving} className="border-slate-200">Cancel</Button><Button onClick={handleApply} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">{saving ? 'Applying...' : `Apply to ${applyUserIds.length} User(s)`}</Button></div>}>
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm"><p className="font-semibold text-emerald-800">Roles to be assigned:</p><div className="flex flex-wrap gap-1.5 mt-2">{selectedTemplate?.roleIds.map(roleId => { const role = getRoleById(roleId); if (!role) return null; return <Badge key={role.id} variant="outline" className="text-[10px] font-medium border-emerald-200" style={{ borderColor: role.colorCode, color: role.colorCode }}>{role.displayName}</Badge> })}</div></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Select Users</Label><div className="max-h-64 overflow-y-auto space-y-2 pr-1">{activeUsers.map(user => { const checked = applyUserIds.includes(user.id); return (<label key={user.id} className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm cursor-pointer transition-all duration-150 ${checked ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}><Checkbox checked={checked} onCheckedChange={(val) => { if (val) setApplyUserIds([...applyUserIds, user.id]); else setApplyUserIds(applyUserIds.filter(id => id !== user.id)) }} /><div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</div><span className="font-medium text-slate-700">{user.firstName} {user.lastName}</span><span className="text-xs text-slate-500 ml-auto">{user.email}</span></label>) })}</div></div>
        </div>
      </FormModal>

      <ConfirmDialog open={showDelete} onOpenChange={setShowDelete} title="Delete Template" description={`Are you sure you want to delete "${selectedTemplate?.displayName || ''}"? This action cannot be undone.`} onConfirm={handleDeleteConfirm} variant="destructive" loading={saving} />
    </div>
  )
}
