import React, { useState, useMemo } from 'react'
import { Card, CardContent, Badge, Button, Input, Label } from './shared/UiComponents'
import { Select, SelectItem } from './shared/UiComponents'
import { DetailModal } from './shared/Modals'
import { DataTable } from './shared/DataTable'
import { ScrollText, Eye, Filter, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { ACCESS_TYPE_COLORS } from './mockData'

export function AccessAudit({ accessLogs, users }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAccessType, setFilterAccessType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showDetail, setShowDetail] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)

  const getUserName = (userId) => { const user = users.find(u => u.id === userId); return user ? `${user.firstName} ${user.lastName}` : 'Unknown User' }
  const getUserInitials = (userId) => { const user = users.find(u => u.id === userId); if (!user) return '??'; return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` }

  const filteredLogs = useMemo(() => {
    return accessLogs.filter(log => {
      if (searchQuery.trim()) { const query = searchQuery.toLowerCase(); const matchesAction = log.action.toLowerCase().includes(query); const matchesResource = log.resource.toLowerCase().includes(query); if (!matchesAction && !matchesResource) return false }
      if (filterAccessType !== 'all' && log.accessType !== filterAccessType) return false
      if (filterStatus === 'granted' && log.denied) return false
      if (filterStatus === 'denied' && !log.denied) return false
      return true
    })
  }, [accessLogs, searchQuery, filterAccessType, filterStatus])

  const handleViewDetail = (log) => { setSelectedLog(log); setShowDetail(true) }
  const handleExport = () => { toast.success('Audit log export started (placeholder)') }

  const columns = [
    { key: 'user', header: 'User', sortable: true, render: (log) => { const name = getUserName(log.userId); const initials = getUserInitials(log.userId); return (<div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{initials}</div><span className="font-medium text-slate-700">{name}</span></div>) } },
    { key: 'action', header: 'Action', sortable: true, className: 'font-mono', render: (log) => <span className="text-sm font-mono text-slate-600">{log.action}</span> },
    { key: 'resource', header: 'Resource', render: (log) => <span className="text-sm text-slate-700">{log.resource}</span> },
    { key: 'accessType', header: 'Access Type', render: (log) => <Badge className={`text-[10px] font-medium ${ACCESS_TYPE_COLORS[log.accessType] || 'bg-gray-100 text-gray-700'}`}>{log.accessType}</Badge> },
    { key: 'status', header: 'Status', render: (log) => log.denied ? (<div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-sm font-medium text-red-600">Denied</span></div>) : (<div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-sm font-medium text-emerald-600">Granted</span></div>) },
    { key: 'createdAt', header: 'Time', sortable: true, render: (log) => <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</span> },
    { key: 'actions', header: '', render: (log) => (<Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); handleViewDetail(log) }}><Eye className="h-4 w-4 text-slate-500" /></Button>) },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold text-slate-900">Access Audit</h3><p className="text-sm text-slate-500">Review and search access logs</p></div><Button variant="outline" onClick={handleExport} className="border-slate-200"><ScrollText className="h-4 w-4 mr-2" /> Export</Button></div>

      {/* Filters */}
      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3"><Filter className="h-4 w-4 text-slate-500" /><Label className="text-sm font-medium text-slate-700">Filters</Label></div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search by action or resource..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 bg-white border-slate-200" /></div>
          <Select value={filterAccessType} onValueChange={setFilterAccessType}><SelectItem value="all">All Access Types</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="emergency">Emergency</SelectItem><SelectItem value="delegated">Delegated</SelectItem></Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}><SelectItem value="all">All Status</SelectItem><SelectItem value="granted">Granted</SelectItem><SelectItem value="denied">Denied</SelectItem></Select>
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm"><CardContent className="p-6"><DataTable data={filteredLogs} columns={columns} pageSize={10} onRowClick={(item) => handleViewDetail(item)} emptyMessage="No access logs found" emptyIcon={<ScrollText className="h-10 w-10 text-slate-300" />} /></CardContent></Card>

      {/* Detail Modal */}
      <DetailModal open={showDetail} onOpenChange={setShowDetail} title="Access Log Detail" subtitle="Detailed information about this access event" icon={<ScrollText className="h-5 w-5" />}>
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">User</span><p className="font-semibold text-slate-800 mt-0.5">{getUserName(selectedLog.userId)}</p></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Action</span><p className="font-mono text-sm font-semibold text-slate-800 mt-0.5">{selectedLog.action}</p></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Resource</span><p className="font-semibold text-slate-800 mt-0.5">{selectedLog.resource}</p></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Resource ID</span><p className="font-mono text-sm font-semibold text-slate-800 mt-0.5">{selectedLog.resourceId}</p></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Access Type</span><div className="mt-0.5"><Badge className={`text-[10px] font-medium ${ACCESS_TYPE_COLORS[selectedLog.accessType] || 'bg-gray-100 text-gray-700'}`}>{selectedLog.accessType}</Badge></div></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Status</span><div className="mt-0.5">{selectedLog.denied ? (<div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="font-medium text-red-600">Denied</span></div>) : (<div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="font-medium text-emerald-600">Granted</span></div>)}</div></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">IP Address</span><p className="font-mono text-sm font-semibold text-slate-800 mt-0.5">{selectedLog.ipAddress}</p></div>
              <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Time</span><p className="text-sm font-semibold text-slate-800 mt-0.5">{new Date(selectedLog.createdAt).toLocaleString()}</p></div>
            </div>
            {selectedLog.justification && selectedLog.justification.trim() !== '' && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200"><span className="text-xs text-amber-600 font-medium">Justification</span><p className="text-sm text-amber-700 mt-0.5">{selectedLog.justification}</p></div>}
            {selectedLog.denied && selectedLog.denialReason && selectedLog.denialReason.trim() !== '' && <div className="p-3 rounded-lg bg-red-50 border border-red-200"><span className="text-xs text-red-600 font-medium">Denial Reason</span><p className="text-sm text-red-700 mt-0.5">{selectedLog.denialReason}</p></div>}
          </div>
        )}
      </DetailModal>
    </div>
  )
}
