import React, { useState } from 'react'
import { Button, Card, CardContent, Badge, Separator } from '../../components/rbac/shared/UiComponents'
import { Cross, Shield, Users, Building2, Stethoscope, ArrowRightLeft, AlertTriangle, FileText, ScrollText, Key, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

import {
  MOCK_ROLES, MOCK_PERMISSIONS, MOCK_USERS, MOCK_DEPARTMENTS,
  MOCK_ACCESS_LOGS, MOCK_EMERGENCY_REQUESTS, MOCK_DELEGATIONS,
  MOCK_PATIENT_ASSIGNMENTS, MOCK_TEMPLATES,
  CATEGORY_COLORS, CATEGORY_LABELS,
} from '../../components/rbac/mockData'

import { RoleManagement } from '../../components/rbac/RoleManagement'
import { UserManagement } from '../../components/rbac/UserManagement'
import { DepartmentManagement } from '../../components/rbac/DepartmentManagement'
import { PatientAssignments } from '../../components/rbac/PatientAssignments'
import { EmergencyAccess } from '../../components/rbac/EmergencyAccess'
import { RoleDelegation } from '../../components/rbac/RoleDelegation'
import { RoleTemplates } from '../../components/rbac/RoleTemplates'
import { AccessAudit } from '../../components/rbac/AccessAudit'

const TAB_CONFIG = [
  { id: 'roles', label: 'Role Matrix', icon: Shield },
  { id: 'users', label: 'User Roles', icon: Users },
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'patients', label: 'Patients', icon: Stethoscope },
  { id: 'delegations', label: 'Delegations', icon: ArrowRightLeft },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'audit', label: 'Audit', icon: ScrollText },
]

export default function AccessControlPage() {
  const [activeTab, setActiveTab] = useState('roles')

  // ── State for all data ──────────────────────────────────────────
  const [roles, setRoles] = useState([...MOCK_ROLES])
  const [permissions] = useState([...MOCK_PERMISSIONS])
  const [users, setUsers] = useState([...MOCK_USERS])
  const [departments, setDepartments] = useState([...MOCK_DEPARTMENTS])
  const [accessLogs] = useState([...MOCK_ACCESS_LOGS])
  const [emergencyRequests, setEmergencyRequests] = useState([...MOCK_EMERGENCY_REQUESTS])
  const [delegations, setDelegations] = useState([...MOCK_DELEGATIONS])
  const [assignments, setAssignments] = useState([...MOCK_PATIENT_ASSIGNMENTS])
  const [templates, setTemplates] = useState([...MOCK_TEMPLATES])

  // ── Refresh handler (resets to mock data) ─────────────────────
  const handleRefresh = () => {
    setRoles([...MOCK_ROLES])
    setUsers([...MOCK_USERS])
    setDepartments([...MOCK_DEPARTMENTS])
    setEmergencyRequests([...MOCK_EMERGENCY_REQUESTS])
    setDelegations([...MOCK_DELEGATIONS])
    setAssignments([...MOCK_PATIENT_ASSIGNMENTS])
    setTemplates([...MOCK_TEMPLATES])
    toast.success('Data refreshed')
  }

  // ── Stats ──────────────────────────────────────────────────────
  const activeUsers = users.filter(u => u.isActive).length
  const deniedLogs = accessLogs.filter(l => l.denied).length

  const statsCards = [
    { label: 'Active Roles', value: roles.filter(r => r.isActive).length, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Permissions', value: permissions.length, icon: Key, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Active Users', value: activeUsers, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Denied Access', value: deniedLogs, icon: ScrollText, color: 'text-rose-600', bg: 'bg-rose-50' },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'roles':
        return <RoleManagement roles={roles} permissions={permissions} onRolesChange={setRoles} />
      case 'users':
        return <UserManagement users={users} roles={roles} departments={departments} permissions={permissions} onUsersChange={setUsers} />
      case 'departments':
        return <DepartmentManagement departments={departments} users={users} roles={roles} onDepartmentsChange={setDepartments} />
      case 'patients':
        return <PatientAssignments assignments={assignments} users={users} departments={departments} onAssignmentsChange={setAssignments} />
      case 'delegations':
        return <RoleDelegation delegations={delegations} users={users} roles={roles} onDelegationsChange={setDelegations} />
      case 'emergency':
        return <EmergencyAccess emergencyRequests={emergencyRequests} users={users} onEmergencyChange={setEmergencyRequests} />
      case 'templates':
        return <RoleTemplates templates={templates} roles={roles} users={users} onTemplatesChange={setTemplates} />
      case 'audit':
        return <AccessAudit accessLogs={accessLogs} users={users} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-sm">
                  <Cross className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="text-emerald-600 font-medium">HMS</span>
                    <span>/</span>
                    <span>Super Admin</span>
                    <span>/</span>
                    <span className="text-slate-900 font-medium">Access Control</span>
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">Access Control</h1>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 gap-2 self-start sm:self-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {statsCards.map((stat) => {
                const Icon = stat.icon
                return (
                  <Card key={stat.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Tab Navigation + Content */}
            <div>
              {/* Tab Bar */}
              <div className="bg-white rounded-t-xl border border-b-0 border-slate-200 shadow-sm overflow-x-auto">
                <div className="flex items-stretch">
                  {TAB_CONFIG.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap flex-shrink-0
                          ${isActive
                            ? 'border-emerald-600 text-emerald-700 bg-transparent'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                          }
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tab Content Area */}
              <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm" key={activeTab}>
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <footer className="border-t border-slate-200 bg-white mt-auto">
          <div className="px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-600">Hospital RBAC Access Control System</span>
            <span className="text-slate-400">&copy; 2025 Hospital Management System</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
