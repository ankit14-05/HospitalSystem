import React, { useState } from 'react'
import { Card, CardContent, Badge, Button, Input, Label, Textarea } from './shared/UiComponents'
import { FormModal, ConfirmDialog } from './shared/Modals'
import { AlertTriangle, Shield, CheckCircle2, XCircle, Clock, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS = { pending_review: 'bg-amber-100 text-amber-700 border-amber-200', approved: 'bg-emerald-100 text-emerald-700 border-emerald-200', denied: 'bg-red-100 text-red-700 border-red-200', revoked: 'bg-slate-100 text-slate-600 border-slate-200' }
const STATUS_LABELS = { pending_review: 'Pending Review', approved: 'Approved', denied: 'Denied', revoked: 'Revoked' }

function getUserName(users, userId) { const user = users.find(u => u.id === userId); return user ? `${user.firstName} ${user.lastName}` : 'Unknown User' }
function getUserInitials(users, userId) { const user = users.find(u => u.id === userId); return user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : '??' }
function formatDateTime(dateStr) { return new Date(dateStr).toLocaleString() }

export function EmergencyAccess({ emergencyRequests, users, onEmergencyChange }) {
  const [activeTab, setActiveTab] = useState('active')
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [approveTargetId, setApproveTargetId] = useState(null)
  const [denyModalOpen, setDenyModalOpen] = useState(false)
  const [denyTargetId, setDenyTargetId] = useState(null)
  const [denyReason, setDenyReason] = useState('')
  const [revokeModalOpen, setRevokeModalOpen] = useState(false)
  const [revokeTargetId, setRevokeTargetId] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [newForm, setNewForm] = useState({ userId: '', patientId: '', resource: '', resourceId: '', reason: '', expiresAt: '' })
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)

  const activeRequests = emergencyRequests.filter(r => r.status === 'pending_review' || r.status === 'approved')
  const reviewHistory = emergencyRequests.filter(r => r.status === 'denied' || r.status === 'revoked' || (r.status === 'approved' && !!r.reviewNotes))

  const handleApproveClick = (id) => { setApproveTargetId(id); setApproveDialogOpen(true) }
  const handleApproveConfirm = () => {
    if (!approveTargetId) return
    const updated = emergencyRequests.map(r => r.id === approveTargetId ? { ...r, status: 'approved', reviewedBy: 'u1', reviewedAt: new Date().toISOString(), reviewNotes: 'Approved by administrator' } : r)
    onEmergencyChange(updated); toast.success('Emergency access request approved'); setApproveDialogOpen(false); setApproveTargetId(null)
  }

  const handleDenyClick = (id) => { setDenyTargetId(id); setDenyReason(''); setDenyModalOpen(true) }
  const handleDenyConfirm = () => {
    if (!denyTargetId) return; if (!denyReason.trim()) { toast.error('Please provide a reason for denial'); return }
    const updated = emergencyRequests.map(r => r.id === denyTargetId ? { ...r, status: 'denied', reviewedBy: 'u1', reviewedAt: new Date().toISOString(), reviewNotes: denyReason.trim() } : r)
    onEmergencyChange(updated); toast.success('Emergency access request denied'); setDenyModalOpen(false); setDenyTargetId(null); setDenyReason('')
  }

  const handleRevokeClick = (id) => { setRevokeTargetId(id); setRevokeReason(''); setRevokeModalOpen(true) }
  const handleRevokeConfirm = () => {
    if (!revokeTargetId) return; if (!revokeReason.trim()) { toast.error('Please provide a reason for revocation'); return }
    const updated = emergencyRequests.map(r => r.id === revokeTargetId ? { ...r, status: 'revoked', reviewedBy: 'u1', reviewedAt: new Date().toISOString(), reviewNotes: revokeReason.trim() } : r)
    onEmergencyChange(updated); toast.success('Emergency access has been revoked'); setRevokeModalOpen(false); setRevokeTargetId(null); setRevokeReason('')
  }

  const handleNewRequest = () => { setNewForm({ userId: '', patientId: '', resource: '', resourceId: '', reason: '', expiresAt: '' }); setNewRequestOpen(true) }
  const handleNewRequestSubmit = () => {
    if (!newForm.userId || !newForm.patientId || !newForm.resource || !newForm.resourceId || !newForm.reason || !newForm.expiresAt) { toast.error('All fields are required'); return }
    const newRequest = { id: Date.now().toString(), userId: newForm.userId, patientId: newForm.patientId, resource: newForm.resource, resourceId: newForm.resourceId, reason: newForm.reason.trim(), status: 'pending_review', accessedAt: new Date().toISOString(), expiresAt: new Date(newForm.expiresAt).toISOString(), reviewedBy: null, reviewedAt: null, reviewNotes: null }
    onEmergencyChange([newRequest, ...emergencyRequests]); toast.success('Emergency access request submitted'); setNewRequestOpen(false); setActiveTab('active')
  }

  const handleViewDetail = (request) => { setDetailTarget(request); setDetailModalOpen(true) }

  const renderStatusBadge = (status) => <Badge className={`text-[10px] font-medium border ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{STATUS_LABELS[status] || status}</Badge>
  const renderAvatar = (userId) => <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{getUserInitials(users, userId)}</div>

  const renderActiveCard = (request) => (
    <Card key={request.id} className="border-0 shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">{renderAvatar(request.userId)}<span className="font-semibold text-slate-800 truncate">{getUserName(users, request.userId)}</span>{renderStatusBadge(request.status)}</div>
          <div className="space-y-1 text-sm ml-11">
            <p className="text-slate-600"><span className="text-slate-500">Resource: </span><span className="font-mono font-medium">{request.resource}</span><span className="text-slate-500"> ({request.resourceId})</span></p>
            <p className="text-slate-600"><span className="text-slate-500">Patient: </span><span className="font-mono">{request.patientId}</span></p>
            <p className="text-slate-600"><span className="text-slate-500">Reason: </span>{request.reason}</p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />Requested: {formatDateTime(request.accessedAt)}</span><span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Expires: {formatDateTime(request.expiresAt)}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleViewDetail(request)}>View</Button>
          {request.status === 'pending_review' && (<><Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleApproveClick(request.id)}>Approve</Button><Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDenyClick(request.id)}>Deny</Button></>)}
          {request.status === 'approved' && <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRevokeClick(request.id)}>Revoke</Button>}
        </div>
      </div>
    </CardContent></Card>
  )

  const renderHistoryCard = (request) => {
    const reviewerName = request.reviewedBy ? getUserName(users, request.reviewedBy) : 'N/A'
    return (<Card key={request.id} className="border-0 shadow-sm hover:shadow-md transition-shadow"><CardContent className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">{renderAvatar(request.userId)}<span className="font-semibold text-slate-800 truncate">{getUserName(users, request.userId)}</span>{renderStatusBadge(request.status)}</div>
          <div className="space-y-1 text-sm ml-11">
            <p className="text-slate-600"><span className="text-slate-500">Resource: </span><span className="font-mono font-medium">{request.resource}</span><span className="text-slate-500"> ({request.resourceId})</span></p>
            <p className="text-slate-600"><span className="text-slate-500">Patient: </span><span className="font-mono">{request.patientId}</span></p>
            <p className="text-slate-600"><span className="text-slate-500">Reason: </span>{request.reason}</p>
            {request.reviewNotes && <p className="text-slate-600"><span className="text-slate-500">Review Notes: </span>{request.reviewNotes}</p>}
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />Requested: {formatDateTime(request.accessedAt)}</span>{request.reviewedAt && <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Reviewed: {formatDateTime(request.reviewedAt)}</span>}</div>
            <p className="text-xs text-slate-500 mt-1"><span className="font-medium">Reviewed by: </span>{reviewerName}</p>
          </div>
        </div>
        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}><Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleViewDetail(request)}>View</Button></div>
      </div>
    </CardContent></Card>)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold text-slate-900">Emergency Access</h3><p className="text-sm text-slate-500">Manage and review emergency break-glass access requests</p></div><Button onClick={handleNewRequest} className="bg-red-600 hover:bg-red-700 text-white shadow-sm"><AlertTriangle className="h-4 w-4 mr-2" /> Request Emergency Access</Button></div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-800'}`} onClick={() => setActiveTab('active')}>Active Requests<Badge variant="secondary" className="ml-1.5 text-[10px] bg-amber-100 text-amber-700">{activeRequests.length}</Badge></button>
          <button className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-800'}`} onClick={() => setActiveTab('history')}>Review History<Badge variant="secondary" className="ml-1.5 text-[10px] bg-slate-200 text-slate-600">{reviewHistory.length}</Badge></button>
        </div>
        {activeTab === 'active' ? (<div className="space-y-3">{activeRequests.length === 0 ? (<Card className="border-0 shadow-sm"><CardContent className="py-16 text-center"><Shield className="h-12 w-12 mx-auto text-slate-300 mb-3" /><p className="text-slate-500 font-medium">No active emergency access requests</p></CardContent></Card>) : activeRequests.map(renderActiveCard)}</div>) : (<div className="space-y-3">{reviewHistory.length === 0 ? (<Card className="border-0 shadow-sm"><CardContent className="py-16 text-center"><CheckCircle2 className="h-12 w-12 mx-auto text-slate-300 mb-3" /><p className="text-slate-500 font-medium">No review history yet</p></CardContent></Card>) : reviewHistory.map(renderHistoryCard)}</div>)}
      </div>

      {/* Approve Confirm */}
      <ConfirmDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen} title="Approve Emergency Access" description="Are you sure you want to approve this emergency access request? This will grant the user immediate access to the requested resource until the expiry time." onConfirm={handleApproveConfirm} variant="default" />

      {/* Deny Modal */}
      <FormModal open={denyModalOpen} onOpenChange={setDenyModalOpen} title="Deny Emergency Access" description="Please provide a reason for denying this emergency access request." icon={<XCircle className="h-5 w-5 text-red-600" />}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setDenyModalOpen(false)} className="border-slate-200">Cancel</Button><Button onClick={handleDenyConfirm} className="bg-red-600 hover:bg-red-700 text-white">Deny Request</Button></div>}>
        <div className="space-y-4">
          {denyTargetId && <div className="bg-slate-50 rounded-lg p-3 text-sm"><p className="text-slate-500">Request from <span className="font-semibold text-slate-700">{getUserName(users, emergencyRequests.find(r => r.id === denyTargetId)?.userId || '')}</span></p><p className="text-slate-500 mt-1">Resource: <span className="font-mono font-medium text-slate-700">{emergencyRequests.find(r => r.id === denyTargetId)?.resource}</span></p></div>}
          <div className="space-y-2"><Label className="text-sm font-medium">Reason for Denial *</Label><Textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} placeholder="Explain why this emergency access request is being denied..." className="border-slate-200 min-h-[100px]" /></div>
        </div>
      </FormModal>

      {/* Revoke Modal */}
      <FormModal open={revokeModalOpen} onOpenChange={setRevokeModalOpen} title="Revoke Emergency Access" description="Please provide a reason for revoking this approved emergency access." icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setRevokeModalOpen(false)} className="border-slate-200">Cancel</Button><Button onClick={handleRevokeConfirm} className="bg-red-600 hover:bg-red-700 text-white">Revoke Access</Button></div>}>
        <div className="space-y-4">
          {revokeTargetId && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm"><p className="text-amber-800 font-semibold">Warning: Revoking Access</p><p className="text-amber-700 mt-1">This will immediately remove emergency access for <span className="font-semibold">{getUserName(users, emergencyRequests.find(r => r.id === revokeTargetId)?.userId || '')}</span></p></div>}
          <div className="space-y-2"><Label className="text-sm font-medium">Reason for Revocation *</Label><Textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="Explain why this emergency access is being revoked..." className="border-slate-200 min-h-[100px]" /></div>
        </div>
      </FormModal>

      {/* New Request Modal */}
      <FormModal open={newRequestOpen} onOpenChange={setNewRequestOpen} title="Request Emergency Access" description="Create a new emergency break-glass access request. All requests are logged and require administrator review." icon={<AlertTriangle className="h-5 w-5 text-red-600" />} maxWidth="max-w-lg"
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setNewRequestOpen(false)} className="border-slate-200">Cancel</Button><Button onClick={handleNewRequestSubmit} className="bg-red-600 hover:bg-red-700 text-white">Submit Request</Button></div>}>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3"><AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" /><div><p className="font-semibold">Emergency Access Warning</p><p className="text-xs mt-1">Emergency access requests are logged and require justification. All requests are reviewed by administrators. Misuse of emergency access may result in disciplinary action.</p></div></div>
          <div className="space-y-2"><Label className="text-sm font-medium">User *</Label><select className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" value={newForm.userId} onChange={e => setNewForm(prev => ({ ...prev, userId: e.target.value }))}><option value="">Select user</option>{users.filter(u => u.isActive).map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Patient ID *</Label><Input value={newForm.patientId} onChange={e => setNewForm(prev => ({ ...prev, patientId: e.target.value }))} placeholder="e.g., pat-001" className="border-slate-200" /></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Resource *</Label><Input value={newForm.resource} onChange={e => setNewForm(prev => ({ ...prev, resource: e.target.value }))} placeholder="e.g., patient_record, prescription, billing" className="border-slate-200" /></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Resource ID *</Label><Input value={newForm.resourceId} onChange={e => setNewForm(prev => ({ ...prev, resourceId: e.target.value }))} placeholder="e.g., pat-001, rx-089, bill-112" className="border-slate-200" /></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Reason *</Label><Textarea value={newForm.reason} onChange={e => setNewForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="Describe the emergency situation requiring access..." className="border-slate-200 min-h-[100px]" /></div>
          <div className="space-y-2"><Label className="text-sm font-medium">Expires At *</Label><Input type="datetime-local" value={newForm.expiresAt} onChange={e => setNewForm(prev => ({ ...prev, expiresAt: e.target.value }))} className="border-slate-200" /></div>
        </div>
      </FormModal>

      {/* Detail View Modal */}
      <FormModal open={detailModalOpen} onOpenChange={setDetailModalOpen} title="Emergency Access Details" description={`Request ID: ${detailTarget?.id || ''}`} icon={<Eye className="h-5 w-5 text-slate-600" />} maxWidth="max-w-lg"
        footer={<Button variant="outline" onClick={() => setDetailModalOpen(false)} className="border-slate-200">Close</Button>}>
        {detailTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">{renderAvatar(detailTarget.userId)}<div><p className="font-semibold text-slate-800">{getUserName(users, detailTarget.userId)}</p><p className="text-xs text-slate-500">{detailTarget.userId}</p></div><div className="ml-auto">{renderStatusBadge(detailTarget.status)}</div></div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Patient ID</p><p className="font-mono text-slate-700 mt-0.5">{detailTarget.patientId}</p></div>
              <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Resource</p><p className="font-mono text-slate-700 mt-0.5">{detailTarget.resource}</p></div>
              <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Resource ID</p><p className="font-mono text-slate-700 mt-0.5">{detailTarget.resourceId}</p></div>
              <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Requested At</p><p className="text-slate-700 mt-0.5">{formatDateTime(detailTarget.accessedAt)}</p></div>
              <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Expires At</p><p className="text-slate-700 mt-0.5">{formatDateTime(detailTarget.expiresAt)}</p></div>
              {detailTarget.reviewedBy && <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Reviewed By</p><p className="text-slate-700 mt-0.5">{getUserName(users, detailTarget.reviewedBy)}</p></div>}
              {detailTarget.reviewedAt && <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Reviewed At</p><p className="text-slate-700 mt-0.5">{formatDateTime(detailTarget.reviewedAt)}</p></div>}
            </div>
            <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Reason</p><p className="text-slate-700 mt-0.5 text-sm">{detailTarget.reason}</p></div>
            {detailTarget.reviewNotes && <div><p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Review Notes</p><p className="text-slate-700 mt-0.5 text-sm">{detailTarget.reviewNotes}</p></div>}
          </div>
        )}
      </FormModal>
    </div>
  )
}
