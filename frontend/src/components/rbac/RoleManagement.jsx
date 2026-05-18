import React, { useState, useMemo } from 'react'
import { Card, CardContent, Badge, Button, Input, Label, Switch, Checkbox, Separator } from './shared/UiComponents'
import { Select, SelectItem } from './shared/UiComponents'
import { FormModal, DetailModal } from './shared/Modals'
import { DataTable } from './shared/DataTable'
import {
  Shield, Plus, Eye, Pencil, CheckCircle2, XCircle,
  ShieldCheck, Users, AlertTriangle, Stethoscope, Heart,
  Phone, Pill, Receipt, Microscope, UserCog, Building,
  GraduationCap, Crown, Search, Key,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { CATEGORY_COLORS, CATEGORY_LABELS } from './mockData'

// ── Icon map for role icons ──────────────────────────────────────────
const ICON_MAP = {
  Crown, Stethoscope, Heart, Phone, Pill, Receipt,
  Microscope, UserCog, Building, GraduationCap, Shield,
}

function RoleIcon({ icon, colorCode }) {
  const IconComp = ICON_MAP[icon] || Shield
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: colorCode + '18' }}
    >
      <IconComp className="h-4 w-4" style={{ color: colorCode }} />
    </div>
  )
}

// ── Hardcoded user counts per role for demo ──────────────────────────
const HARDCODED_USER_COUNTS = {
  r1: 1, r2: 4, r3: 1, r4: 1, r5: 1,
  r6: 1, r7: 2, r8: 1, r9: 3, r10: 1,
}

const CATEGORIES = ['clinical', 'administrative', 'patient_facing', 'support']

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export function RoleManagement({ roles, permissions, onRolesChange }) {
  // ── Modal state ────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null)

  // ── Form state ─────────────────────────────────────────────────────
  const [formName, setFormName] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formCategory, setFormCategory] = useState('clinical')
  const [formDescription, setFormDescription] = useState('')
  const [formColorCode, setFormColorCode] = useState('#059669')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formIcon, setFormIcon] = useState('Shield')

  // ── Detail view permission search ──────────────────────────────────
  const [permSearch, setPermSearch] = useState('')

  // ── Helpers ────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormName('')
    setFormDisplayName('')
    setFormCategory('clinical')
    setFormDescription('')
    setFormColorCode('#059669')
    setFormIsActive(true)
    setFormIcon('Shield')
  }

  const updateRole = (updated) => {
    onRolesChange(roles.map(r => (r.id === updated.id ? updated : r)))
  }

  // ── Permission lookup map ──────────────────────────────────────────
  const permissionMap = useMemo(() => {
    const m = {}
    permissions.forEach(p => { m[p.id] = p })
    return m
  }, [permissions])

  // ── Group permissions by category for detail view ──────────────────
  const permissionsByCategory = useMemo(() => {
    const groups = {}
    permissions
      .filter(p => {
        if (!permSearch) return true
        const q = permSearch.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          p.resource.toLowerCase().includes(q)
        )
      })
      .forEach(p => {
        if (!groups[p.category]) groups[p.category] = []
        groups[p.category].push(p)
      })
    return groups
  }, [permissions, permSearch])

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCreate = () => {
    resetForm()
    setSelectedRole(null)
    setShowCreate(true)
  }

  const handleEdit = (role) => {
    setSelectedRole(role)
    setFormName(role.name)
    setFormDisplayName(role.displayName)
    setFormCategory(role.category)
    setFormDescription(role.description)
    setFormColorCode(role.colorCode)
    setFormIsActive(role.isActive)
    setFormIcon(role.icon)
    setShowCreate(true)
  }

  const handleSaveRole = () => {
    if (!formName.trim() || !formDisplayName.trim()) {
      toast.error('Name and display name are required')
      return
    }

    if (selectedRole) {
      const updated = {
        ...selectedRole,
        name: formName.trim(),
        displayName: formDisplayName.trim(),
        category: formCategory,
        description: formDescription.trim(),
        colorCode: formColorCode,
        isActive: formIsActive,
        icon: formIcon,
      }
      updateRole(updated)
      toast.success(`Role "${updated.displayName}" updated`)
    } else {
      const newRole = {
        id: Date.now().toString(),
        name: formName.trim(),
        displayName: formDisplayName.trim(),
        category: formCategory,
        description: formDescription.trim(),
        colorCode: formColorCode,
        icon: formIcon,
        sortOrder: roles.length + 1,
        isActive: formIsActive,
        isSystem: false,
        permissions: [],
      }
      onRolesChange([...roles, newRole])
      toast.success(`Role "${newRole.displayName}" created`)
    }
    setShowCreate(false)
  }

  const handleViewDetail = (role) => {
    setSelectedRole(role)
    setPermSearch('')
    setShowDetail(true)
  }

  const handleToggleActive = (role, checked) => {
    const updated = { ...role, isActive: checked }
    updateRole(updated)
    setSelectedRole(updated)
    toast.success(`Role "${role.displayName}" ${checked ? 'activated' : 'deactivated'}`)
  }

  const handleTogglePermission = (role, permId, checked) => {
    const newPerms = checked
      ? [...role.permissions, permId]
      : role.permissions.filter(id => id !== permId)
    const updated = { ...role, permissions: newPerms }
    updateRole(updated)
    setSelectedRole(updated)
  }

  // ── Table columns ──────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'displayName',
      header: 'Role',
      sortable: true,
      render: (role) => (
        <div className="flex items-center gap-3">
          <RoleIcon icon={role.icon} colorCode={role.colorCode} />
          <div>
            <div className="font-semibold text-slate-800">{role.displayName}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">{role.name}</span>
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[role.category] || ''}`}
              >
                {CATEGORY_LABELS[role.category] || role.category}
              </Badge>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'users',
      header: 'Users',
      render: (role) => (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {HARDCODED_USER_COUNTS[role.id] ?? 0}
          </span>
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (role) => (
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-sm font-medium text-slate-700">{role.permissions.length}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (role) => (
        <Badge
          variant="secondary"
          className={`text-xs font-medium ${
            role.isActive
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {role.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (role) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleViewDetail(role)}>View</Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(role)} disabled={role.isSystem}>Edit</Button>
        </div>
      ),
    },
  ], [])

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Roles &amp; Permissions</h3>
          <div className="text-sm text-slate-500">Manage roles and their associated permissions</div>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" /> Create Role
        </Button>
      </div>

      {/* Roles Table */}
      <Card className="border-0 shadow-sm rounded-xl">
        <CardContent className="p-6">
          <DataTable
            data={roles}
            columns={columns}
            searchPlaceholder="Search roles..."
            searchKeys={['name', 'displayName']}
            onRowClick={handleViewDetail}
            emptyMessage="No roles found"
          />
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          CREATE / EDIT ROLE MODAL
          ════════════════════════════════════════════════════════════════ */}
      <FormModal
        open={showCreate}
        onOpenChange={setShowCreate}
        title={selectedRole ? 'Edit Role' : 'Create Role'}
        description="Configure role details and settings"
        icon={<Shield className="h-5 w-5" />}
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {selectedRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Name & Display Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Name *</Label>
              <Input
                placeholder="e.g. nurse_lead"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Display Name *</Label>
              <Input
                placeholder="e.g. Nurse Lead"
                value={formDisplayName}
                onChange={e => setFormDisplayName(e.target.value)}
                className="border-slate-200"
              />
            </div>
          </div>

          {/* Category & Icon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Icon</Label>
              <Select value={formIcon} onValueChange={setFormIcon}>
                {Object.keys(ICON_MAP).map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Description</Label>
            <Input
              placeholder="Role description..."
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              className="border-slate-200"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={formColorCode}
                onChange={e => setFormColorCode(e.target.value)}
                className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer"
              />
              <Input
                value={formColorCode}
                onChange={e => setFormColorCode(e.target.value)}
                className="flex-1 border-slate-200"
              />
            </div>
          </div>

          {/* Active Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50">
            <div>
              <Label className="text-sm font-medium text-slate-800">Active</Label>
              <div className="text-xs text-slate-500">Enable or disable this role</div>
            </div>
            <Switch
              checked={formIsActive}
              onCheckedChange={setFormIsActive}
            />
          </div>

          {/* System role warning */}
          {selectedRole?.isSystem && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2">
              <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">System Role</div>
                <div>This is a system role. Some fields may not be editable.</div>
              </div>
            </div>
          )}
        </div>
      </FormModal>

      {/* ════════════════════════════════════════════════════════════════
          ROLE DETAIL MODAL
          ════════════════════════════════════════════════════════════════ */}
      <DetailModal
        open={showDetail}
        onOpenChange={setShowDetail}
        title={selectedRole?.displayName || 'Role Detail'}
        subtitle="Role details and permission matrix"
        icon={<Shield className="h-5 w-5" />}
        maxWidth="max-w-3xl"
      >
        {selectedRole && (
          <div className="space-y-6">
            {/* ── Role Info Grid ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">Name</span>
                <div className="font-semibold text-slate-800 mt-0.5">{selectedRole.name}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">Display Name</span>
                <div className="font-semibold text-slate-800 mt-0.5">{selectedRole.displayName}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">Category</span>
                <div className="mt-0.5">
                  <Badge
                    variant="secondary"
                    className={CATEGORY_COLORS[selectedRole.category] || ''}
                  >
                    {CATEGORY_LABELS[selectedRole.category] || selectedRole.category}
                  </Badge>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">System Role</span>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {selectedRole.isSystem ? 'Yes' : 'No'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">Users</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800">
                    {HARDCODED_USER_COUNTS[selectedRole.id] ?? 0}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">Permissions</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-800">
                    {selectedRole.permissions.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedRole.description && (
              <div className="p-3 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">Description</span>
                <div className="text-sm text-slate-700 mt-0.5">{selectedRole.description}</div>
              </div>
            )}

            {/* ── Active Toggle ───────────────────────────────────────── */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedRole.isActive
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {selectedRole.isActive ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">
                    {selectedRole.isActive ? 'Active' : 'Inactive'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedRole.isActive
                      ? 'This role is currently active and can be assigned'
                      : 'This role is inactive and cannot be assigned'}
                  </div>
                </div>
              </div>
              <Switch
                checked={selectedRole.isActive}
                onCheckedChange={checked => handleToggleActive(selectedRole, checked)}
              />
            </div>

            <Separator />

            {/* ── Permission Matrix ───────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-600" />
                  <h4 className="font-semibold text-sm text-slate-800">
                    Permission Matrix
                  </h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedRole.permissions.length} / {permissions.length}
                  </Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search permissions..."
                    value={permSearch}
                    onChange={e => setPermSearch(e.target.value)}
                    className="pl-9 h-8 text-sm bg-white border-slate-200 w-52"
                  />
                </div>
              </div>

              <div className="space-y-5">
                {Object.entries(permissionsByCategory).map(([category, perms]) => {
                  const assigned = perms.filter(p => selectedRole.permissions.includes(p.id))
                  return (
                    <div key={category}>
                      {/* Category Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-semibold text-sm text-slate-700">
                            {category}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {assigned.length}/{perms.length}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            const allIds = perms.map(p => p.id)
                            const allAssigned = allIds.every(id => selectedRole.permissions.includes(id))
                            const updated = { ...selectedRole }
                            if (allAssigned) {
                              updated.permissions = selectedRole.permissions.filter(
                                id => !allIds.includes(id)
                              )
                            } else {
                              const merged = new Set([...selectedRole.permissions, ...allIds])
                              updated.permissions = [...merged]
                            }
                            updateRole(updated)
                            setSelectedRole(updated)
                            toast.success(
                              allAssigned
                                ? `Removed all ${category} permissions`
                                : `Assigned all ${category} permissions`
                            )
                          }}
                        >
                          {perms.every(p => selectedRole.permissions.includes(p.id))
                            ? 'Deselect All'
                            : 'Select All'}
                        </Button>
                      </div>

                      {/* Permission Checkboxes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {perms.map(perm => {
                          const checked = selectedRole.permissions.includes(perm.id)
                          return (
                            <label
                              key={perm.id}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer transition-all duration-150 ${
                                checked
                                  ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                                  : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={val =>
                                  handleTogglePermission(selectedRole, perm.id, !!val)
                                }
                              />
                              <span className="flex-1 font-medium text-slate-700">
                                {perm.displayName}
                              </span>
                              {perm.isDangerous && (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px] px-1.5 py-0"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  Danger
                                </Badge>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
