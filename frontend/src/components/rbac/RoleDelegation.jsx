import React, { useState } from 'react'
import { Card, CardContent, Badge, Button, Label, Textarea, Input } from './shared/UiComponents'
import { Select, SelectItem } from './shared/UiComponents'
import { FormModal, DetailModal, ConfirmDialog } from './shared/Modals'
import { DataTable } from './shared/DataTable'
import { ArrowRightLeft, Plus, Eye, UserCircle, ShieldOff, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS = { active: 'bg-emerald-100 text-emerald-700', revoked: 'bg-red-100 text-red-700', expired: 'bg-slate-100 text-slate-500' }
const STATUS_DOTS = { active: 'bg-emerald-500', revoked: 'bg-red-500', expired: 'bg-slate-400' }

function getUserById(users, id) { return users.find(u => u.id === id) }
function getRoleById(roles, id) { return roles.find(r => r.id === id) }
function formatDate(dateStr) { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
function formatDuration(from, until) { return `${formatDate(from)} – ${formatDate(until)}` }

export function RoleDelegation({ delegations, users, roles, onDelegationsChange }) {
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showRevoke, setShowRevoke] = useState(false)
  const [selectedDelegation, setSelectedDelegation] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [formFromUser, setFormFromUser] = useState('')
  const [formToUser, setFormToUser] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formValidFrom, setFormValidFrom] = useState('')
  const [formValidUntil, setFormValidUntil] = useState('')

  const activeUsers = users.filter(u => u.isActive)
  const activeRoles = roles.filter(r => r.isActive)

  const handleCreateOpen = () => { setFormFromUser(''); setFormToUser(''); setFormRole(''); setFormReason(''); setFormValidFrom(new Date().toISOString().slice(0, 16)); setFormValidUntil(''); setShowCreate(true) }

  const handleSave = () => {
    if (!formFromUser || !formToUser || !formRole || !formReason || !formValidFrom || !formValidUntil) { toast.error('All fields are required'); return }
    if (formFromUser === formToUser) { toast.error('Cannot delegate to the same user'); return }
    if (new Date(formValidUntil) <= new Date(formValidFrom)) { toast.error('Valid Until must be after Valid From'); return }
    const newDelegation = { id: Date.now().toString(), fromUserId: formFromUser, toUserId: formToUser, roleId: formRole, reason: formReason, validFrom: new Date(formValidFrom).toISOString(), validUntil: new Date(formValidUntil).toISOString(), status: 'active', revokedAt: null, revokeReason: null }
    onDelegationsChange([...delegations, newDelegation]); toast.success('Delegation created successfully'); setShowCreate(false)
  }

  const handleViewDetail = (d) => { setSelectedDelegation(d); setShowDetail(true) }
  const handleRevokeOpen = (d) => { setSelectedDelegation(d); setRevokeReason(''); setShowRevoke(true) }

  const handleRevokeConfirm = () => {
    if (!selectedDelegation) return; if (!revokeReason.trim()) { toast.error('Revoke reason is required'); return }
    setSaving(true)
    setTimeout(() => {
      const updated = delegations.map(d => d.id === selectedDelegation.id ? { ...d, status: 'revoked', revokedAt: new Date().toISOString(), revokeReason: revokeReason.trim() } : d)
      onDelegationsChange(updated); toast.success('Delegation revoked successfully'); setShowRevoke(false); setSaving(false)
    }, 300)
  }

  const columns = [
    { key: 'fromUser', header: 'From User', render: (d) => { const from = getUserById(users, d.fromUserId); return from ? (<div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{from.firstName.charAt(0)}{from.lastName.charAt(0)}</div><span className="font-medium text-slate-700 whitespace-nowrap">{from.firstName} {from.lastName}</span></div>) : <span className="text-slate-500">Unknown</span> } },
    { key: 'arrow', header: '', className: 'w-10', render: () => <ArrowRightLeft className="h-4 w-4 text-emerald-500 mx-auto" /> },
    { key: 'toUser', header: 'To User', render: (d) => { const to = getUserById(users, d.toUserId); return to ? (<div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{to.firstName.charAt(0)}{to.lastName.charAt(0)}</div><span className="font-medium text-slate-700 whitespace-nowrap">{to.firstName} {to.lastName}</span></div>) : <span className="text-slate-500">Unknown</span> } },
    { key: 'role', header: 'Role', render: (d) => { const role = getRoleById(roles, d.roleId); return role ? <Badge variant="outline" className="font-medium border-slate-200 whitespace-nowrap" style={{ borderColor: role.colorCode, color: role.colorCode }}>{role.displayName}</Badge> : <span className="text-slate-500">Unknown</span> } },
    { key: 'duration', header: 'Duration', render: (d) => <span className="text-xs text-slate-600 whitespace-nowrap">{formatDuration(d.validFrom, d.validUntil)}</span> },
    { key: 'status', header: 'Status', render: (d) => (<div className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[d.status] || 'bg-slate-400'}`} /><Badge className={`text-[10px] font-medium capitalize ${STATUS_COLORS[d.status] || ''}`}>{d.status}</Badge></div>) },
    { key: 'actions', header: 'Actions', className: 'w-32', render: (d) => (<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleViewDetail(d)}>View</Button>{d.status === 'active' && <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRevokeOpen(d)}>Revoke</Button>}</div>) },
  ]

  const detailFromUser = selectedDelegation ? getUserById(users, selectedDelegation.fromUserId) : null
  const detailToUser = selectedDelegation ? getUserById(users, selectedDelegation.toUserId) : null
  const detailRole = selectedDelegation ? getRoleById(roles, selectedDelegation.roleId) : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold text-slate-900">Role Delegation</h3><p className="text-sm text-slate-500">Manage role delegations between users</p></div><Button onClick={handleCreateOpen} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"><Plus className="h-4 w-4 mr-2" /> Create Delegation</Button></div>
      <Card className="border-0 shadow-sm"><CardContent className="p-6"><DataTable data={delegations} columns={columns} searchKeys={['reason']} searchPlaceholder="Search delegations..." emptyMessage="No delegations found" emptyIcon={<ArrowRightLeft className="h-10 w-10 text-slate-300" />} /></CardContent></Card>

      {/* Create Modal */}
      <FormModal open={showCreate} onOpenChange={setShowCreate} title="Create Role Delegation" description="Delegate a role from one user to another temporarily" icon={<ArrowRightLeft className="h-5 w-5" />}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-200">Cancel</Button><Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">Create Delegation</Button></div>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label className="text-sm font-medium">From User *</Label><Select value={formFromUser} onValueChange={setFormFromUser}><SelectItem value="">Select delegating user</SelectItem>{activeUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</Select></div>
          <div className="flex justify-center"><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><ArrowRightLeft className="h-4 w-4 text-emerald-500" /></div></div>
          <div className="space-y-2"><Label className="text-sm font-medium">To User *</Label><Select value={formToUser} onValueChange={setFormToUser}><SelectItem value="">Select receiving user</SelectItem>{activeUsers.filter(u => u.id !== formFromUser).map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</Select></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Role *</Label><Select value={formRole} onValueChange={setFormRole}><SelectItem value="">Select role to delegate</SelectItem>{activeRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>)}</Select></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Reason *</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} placeholder="Why is this delegation needed?" className="border-slate-200 min-h-[80px] resize-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-sm font-medium">Valid From *</Label><Input type="datetime-local" value={formValidFrom} onChange={e => setFormValidFrom(e.target.value)} className="border-slate-200" /></div>
            <div className="space-y-2"><Label className="text-sm font-medium">Valid Until *</Label><Input type="datetime-local" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} className="border-slate-200" /></div>
          </div>
        </div>
      </FormModal>

      {/* Detail Modal */}
      <DetailModal open={showDetail} onOpenChange={setShowDetail} title="Delegation Details" subtitle="View full delegation information" icon={<ArrowRightLeft className="h-5 w-5" />}>
        {selectedDelegation && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
              <div className="flex-1"><p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">From User</p>{detailFromUser ? (<div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{detailFromUser.firstName.charAt(0)}{detailFromUser.lastName.charAt(0)}</div><div><p className="font-semibold text-slate-800">{detailFromUser.firstName} {detailFromUser.lastName}</p><p className="text-xs text-slate-500">{detailFromUser.email}</p></div></div>) : <p className="text-slate-500">Unknown User</p>}</div>
              <ArrowRightLeft className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 text-right"><p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">To User</p>{detailToUser ? (<div className="flex items-center gap-2 justify-end"><div><p className="font-semibold text-slate-800">{detailToUser.firstName} {detailToUser.lastName}</p><p className="text-xs text-slate-500">{detailToUser.email}</p></div><div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{detailToUser.firstName.charAt(0)}{detailToUser.lastName.charAt(0)}</div></div>) : <p className="text-slate-500">Unknown User</p>}</div>
            </div>
            <div className="space-y-2"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Delegated Role</p>{detailRole ? <Badge variant="outline" className="font-medium text-sm px-3 py-1 border-slate-200" style={{ borderColor: detailRole.colorCode, color: detailRole.colorCode }}>{detailRole.displayName}</Badge> : <p className="text-slate-500">Unknown Role</p>}</div>
            <div className="space-y-2"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Duration</p><div className="grid grid-cols-2 gap-4"><div className="p-3 rounded-lg bg-slate-50"><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Valid From</p><p className="text-sm font-medium text-slate-700">{formatDate(selectedDelegation.validFrom)}</p></div><div className="p-3 rounded-lg bg-slate-50"><p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Valid Until</p><p className="text-sm font-medium text-slate-700">{formatDate(selectedDelegation.validUntil)}</p></div></div></div>
            <div className="space-y-2"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Reason</p><p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{selectedDelegation.reason}</p></div>
            <div className="space-y-2"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Status</p><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${STATUS_DOTS[selectedDelegation.status] || 'bg-slate-400'}`} /><Badge className={`text-xs font-medium capitalize ${STATUS_COLORS[selectedDelegation.status] || ''}`}>{selectedDelegation.status}</Badge></div></div>
            {selectedDelegation.status === 'revoked' && (<div className="space-y-3 p-4 rounded-xl bg-red-50 border border-red-100"><p className="text-xs text-red-600 font-medium uppercase tracking-wider">Revoke Information</p>{selectedDelegation.revokedAt && <div className="flex items-center gap-2"><span className="text-xs text-red-500">Revoked at:</span><span className="text-sm font-medium text-red-700">{formatDate(selectedDelegation.revokedAt)}</span></div>}{selectedDelegation.revokeReason && <div><span className="text-xs text-red-500">Reason:</span><p className="text-sm text-red-700 mt-1">{selectedDelegation.revokeReason}</p></div>}</div>)}
          </div>
        )}
      </DetailModal>

      {/* Revoke Modal */}
      <FormModal open={showRevoke} onOpenChange={setShowRevoke} title="Revoke Delegation" description="Are you sure you want to revoke this delegation? This action cannot be undone." icon={<Shield className="h-5 w-5" />} maxWidth="max-w-md"
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowRevoke(false)} disabled={saving} className="border-slate-200">Cancel</Button><Button onClick={handleRevokeConfirm} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">{saving ? 'Revoking...' : 'Revoke Delegation'}</Button></div>}>
        {selectedDelegation && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 text-sm space-y-1">
              <p className="text-slate-600"><span className="text-slate-500">From:</span> {(() => { const u = getUserById(users, selectedDelegation.fromUserId); return u ? `${u.firstName} ${u.lastName}` : 'Unknown' })()}</p>
              <p className="text-slate-600"><span className="text-slate-500">To:</span> {(() => { const u = getUserById(users, selectedDelegation.toUserId); return u ? `${u.firstName} ${u.lastName}` : 'Unknown' })()}</p>
              <p className="text-slate-600"><span className="text-slate-500">Role:</span> {(() => { const r = getRoleById(roles, selectedDelegation.roleId); return r ? r.displayName : 'Unknown' })()}</p>
            </div>
            <div className="space-y-2"><Label className="text-sm font-medium">Revoke Reason *</Label><Textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="Provide a reason for revoking this delegation..." className="border-slate-200 min-h-[80px] resize-none" /></div>
          </div>
        )}
      </FormModal>
    </div>
  )
}
