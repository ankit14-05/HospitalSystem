import React, { useState, useMemo } from 'react'
import { Card, CardContent, Badge, Button, Input, Label, Switch, Checkbox, Separator } from './shared/UiComponents'
import { Select, SelectItem } from './shared/UiComponents'
import { FormModal, DetailModal } from './shared/Modals'
import { DataTable } from './shared/DataTable'
import {
  UserPlus, Eye, Pencil, Shield, Users, Mail, Phone,
  Briefcase, ToggleLeft, X, AlertCircle, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { CATEGORY_COLORS } from './mockData'

function getInitials(firstName, lastName) {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase()
}

function getRoleById(roles, id) {
  if (!id) return undefined
  return roles.find(r => r.id === id)
}

function getDeptById(departments, id) {
  return departments.find(d => d.id === id)
}

export function UserManagement({ users, roles, departments, permissions, onUsersChange }) {
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formDesignation, setFormDesignation] = useState('')
  const [formGender, setFormGender] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formPrimaryRoleId, setFormPrimaryRoleId] = useState('')
  const [formRoleIds, setFormRoleIds] = useState([])
  const [formDepartmentIds, setFormDepartmentIds] = useState([])
  const [permOverrides, setPermOverrides] = useState({})

  const resetForm = () => {
    setFormFirstName(''); setFormLastName(''); setFormEmail(''); setFormPhone('')
    setFormDesignation(''); setFormGender(''); setFormIsActive(true)
    setFormPrimaryRoleId(''); setFormRoleIds([]); setFormDepartmentIds([])
  }

  const populateForm = (user) => {
    setFormFirstName(user.firstName); setFormLastName(user.lastName)
    setFormEmail(user.email); setFormPhone(user.phone)
    setFormDesignation(user.designation); setFormGender(user.gender)
    setFormIsActive(user.isActive); setFormPrimaryRoleId(user.primaryRoleId || '')
    setFormRoleIds([...user.roleIds]); setFormDepartmentIds([...user.departmentIds])
  }

  const handleAddUser = () => { resetForm(); setIsEditing(false); setShowForm(true) }

  const handleEditUser = (user) => { populateForm(user); setIsEditing(true); setSelectedUser(user); setShowForm(true) }

  const handleViewDetail = (user) => {
    setSelectedUser(user)
    const map = {}
    user.userPermissions.forEach(up => { map[up.permissionId] = { granted: up.granted, reason: up.reason || '' } })
    setPermOverrides(map)
    setShowDetail(true)
  }

  const handleSaveUser = () => {
    if (!formEmail.trim() || !formFirstName.trim() || !formLastName.trim()) {
      toast.error('First name, last name, and email are required'); return
    }
    if (isEditing && selectedUser) {
      const updated = users.map(u => u.id === selectedUser.id ? {
        ...u, firstName: formFirstName.trim(), lastName: formLastName.trim(),
        email: formEmail.trim(), phone: formPhone.trim(), designation: formDesignation.trim(),
        gender: formGender, isActive: formIsActive, primaryRoleId: formPrimaryRoleId || null,
        roleIds: formRoleIds, departmentIds: formDepartmentIds,
      } : u)
      onUsersChange(updated); toast.success('User updated successfully')
    } else {
      const newUser = {
        id: Date.now().toString(), firstName: formFirstName.trim(), lastName: formLastName.trim(),
        email: formEmail.trim(), phone: formPhone.trim(), designation: formDesignation.trim(),
        gender: formGender, isActive: formIsActive, primaryRoleId: formPrimaryRoleId || null,
        roleIds: formRoleIds, departmentIds: formDepartmentIds, userPermissions: [],
      }
      onUsersChange([...users, newUser]); toast.success('User created successfully')
    }
    setShowForm(false); setSelectedUser(null)
  }

  const handleToggleActive = (user) => {
    const updated = users.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u)
    onUsersChange(updated); setSelectedUser({ ...user, isActive: !user.isActive })
    toast.success(user.isActive ? 'User deactivated' : 'User activated')
  }

  const handleRemoveRole = (user, roleId) => {
    const newRoleIds = user.roleIds.filter(id => id !== roleId)
    const newPrimaryRoleId = user.primaryRoleId === roleId ? (newRoleIds.length > 0 ? newRoleIds[0] : null) : user.primaryRoleId
    const updated = users.map(u => u.id === user.id ? { ...u, roleIds: newRoleIds, primaryRoleId: newPrimaryRoleId } : u)
    onUsersChange(updated); setSelectedUser({ ...user, roleIds: newRoleIds, primaryRoleId: newPrimaryRoleId })
    const role = getRoleById(roles, roleId); toast.success(`Removed role "${role?.displayName || roleId}"`)
  }

  const handlePermOverrideChange = (permissionId, granted) => {
    setPermOverrides(prev => {
      const current = prev[permissionId]
      if (granted === null) { const next = { ...prev }; delete next[permissionId]; return next }
      return { ...prev, [permissionId]: { granted, reason: current?.reason || '' } }
    })
  }

  const handlePermReasonChange = (permissionId, reason) => {
    setPermOverrides(prev => ({ ...prev, [permissionId]: { ...prev[permissionId], reason } }))
  }

  const handleSavePermOverrides = () => {
    if (!selectedUser) return
    const newUserPermissions = Object.entries(permOverrides)
      .filter(([, val]) => val.granted !== null)
      .map(([permissionId, val]) => ({ permissionId, granted: val.granted, reason: val.reason || undefined }))
    const updated = users.map(u => u.id === selectedUser.id ? { ...u, userPermissions: newUserPermissions } : u)
    onUsersChange(updated); setSelectedUser({ ...selectedUser, userPermissions: newUserPermissions })
    toast.success('Permission overrides saved')
  }

  const columns = useMemo(() => [
    { key: 'name', header: 'User', sortable: true, render: (user) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">{getInitials(user.firstName, user.lastName)}</div>
        <div><p className="font-semibold text-slate-800">{user.firstName} {user.lastName}</p><p className="text-xs text-slate-500">{user.email}</p></div>
      </div>
    )},
    { key: 'primaryRole', header: 'Primary Role', sortable: true, render: (user) => {
      const role = getRoleById(roles, user.primaryRoleId)
      return role ? <Badge variant="secondary" className="font-medium" style={{ backgroundColor: role.colorCode + '18', color: role.colorCode }}>{role.displayName}</Badge> : <span className="text-slate-500 text-sm">None</span>
    }},
    { key: 'departments', header: 'Departments', render: (user) => {
      const depts = user.departmentIds.map(id => getDeptById(departments, id)).filter(Boolean)
      return depts.length > 0 ? <div className="flex flex-wrap gap-1">{depts.map(d => <Badge key={d.id} variant="outline" className="text-[10px] border-slate-200">{d.name}</Badge>)}</div> : <span className="text-slate-500 text-sm">None</span>
    }},
    { key: 'status', header: 'Status', render: (user) => (
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
        <span className={`text-sm font-medium ${user.isActive ? 'text-emerald-600' : 'text-red-600'}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
      </div>
    )},
    { key: 'actions', header: '', render: (user) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100" onClick={() => handleViewDetail(user)}><Eye className="h-4 w-4 text-slate-500" /></Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-emerald-50" onClick={() => handleEditUser(user)}><Pencil className="h-4 w-4 text-emerald-600" /></Button>
      </div>
    )},
  ], [roles, departments])

  const permCategories = useMemo(() => { const cats = [...new Set(permissions.map(p => p.category))]; return cats.sort() }, [permissions])
  const permsByCategory = useMemo(() => {
    const map = {}; permCategories.forEach(cat => { map[cat] = permissions.filter(p => p.category === cat) }); return map
  }, [permissions, permCategories])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-slate-900">Users &amp; Roles</h3><p className="text-sm text-slate-500">Manage users, their roles, and permission overrides</p></div>
        <Button onClick={handleAddUser} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"><UserPlus className="h-4 w-4 mr-2" /> Add User</Button>
      </div>
      <Card className="border-0 shadow-sm"><CardContent className="p-6"><DataTable data={users} columns={columns} searchPlaceholder="Search users by name or email..." searchKeys={['firstName', 'lastName', 'email']} onRowClick={handleViewDetail} /></CardContent></Card>

      {/* Add/Edit Form Modal */}
      <FormModal open={showForm} onOpenChange={setShowForm} title={isEditing ? 'Edit User' : 'Add New User'} description={isEditing ? 'Update user information and assignments' : 'Create a new user account in the system'} icon={<UserPlus className="h-5 w-5" />} maxWidth="max-w-2xl"
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowForm(false)} className="border-slate-200">Cancel</Button><Button onClick={handleSaveUser} className="bg-emerald-600 hover:bg-emerald-700 text-white">{isEditing ? 'Save Changes' : 'Create User'}</Button></div>}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-sm font-medium">First Name <span className="text-red-500">*</span></Label><Input value={formFirstName} onChange={e => setFormFirstName(e.target.value)} placeholder="Rajesh" className="border-slate-200" /></div>
            <div className="space-y-2"><Label className="text-sm font-medium">Last Name <span className="text-red-500">*</span></Label><Input value={formLastName} onChange={e => setFormLastName(e.target.value)} placeholder="Sharma" className="border-slate-200" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-sm font-medium">Email <span className="text-red-500">*</span></Label><Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="rajesh@hospital.com" className="border-slate-200" /></div>
            <div className="space-y-2"><Label className="text-sm font-medium">Phone</Label><Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+91-9876543210" className="border-slate-200" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-sm font-medium">Designation</Label><Input value={formDesignation} onChange={e => setFormDesignation(e.target.value)} placeholder="Senior Cardiologist" className="border-slate-200" /></div>
            <div className="space-y-2"><Label className="text-sm font-medium">Gender</Label><Select value={formGender} onValueChange={setFormGender}><SelectItem value="">Select gender</SelectItem><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-sm font-medium">Active Status</Label><div className="flex items-center gap-3 h-10"><Switch checked={formIsActive} onCheckedChange={setFormIsActive} /><span className={`text-sm font-medium ${formIsActive ? 'text-emerald-600' : 'text-red-500'}`}>{formIsActive ? 'Active' : 'Inactive'}</span></div></div>
            <div className="space-y-2"><Label className="text-sm font-medium">Primary Role</Label><Select value={formPrimaryRoleId} onValueChange={setFormPrimaryRoleId}><SelectItem value="">Select primary role</SelectItem>{roles.filter(r => r.isActive).map(r => <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>)}</Select></div>
          </div>
          <Separator />
          <div className="space-y-2"><Label className="text-sm font-medium">Assigned Roles</Label><div className="grid grid-cols-2 gap-2">{roles.filter(r => r.isActive).map(role => { const checked = formRoleIds.includes(role.id); return (<label key={role.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer transition-all duration-150 ${checked ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}><Checkbox checked={checked} onCheckedChange={val => { if (val) setFormRoleIds([...formRoleIds, role.id]); else setFormRoleIds(formRoleIds.filter(id => id !== role.id)) }} /><div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.colorCode }} /><span className="font-medium">{role.displayName}</span></label>) })}</div></div>
          <Separator />
          <div className="space-y-2"><Label className="text-sm font-medium">Departments</Label><div className="grid grid-cols-2 gap-2">{departments.filter(d => d.isActive).map(dept => { const checked = formDepartmentIds.includes(dept.id); return (<label key={dept.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer transition-all duration-150 ${checked ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}><Checkbox checked={checked} onCheckedChange={val => { if (val) setFormDepartmentIds([...formDepartmentIds, dept.id]); else setFormDepartmentIds(formDepartmentIds.filter(id => id !== dept.id)) }} /><span className="font-medium">{dept.name}</span></label>) })}</div></div>
        </div>
      </FormModal>

      {/* User Detail Modal */}
      <DetailModal open={showDetail} onOpenChange={setShowDetail} title={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : 'User Details'} subtitle="User profile, roles, departments, and permission overrides" icon={<Users className="h-5 w-5" />} maxWidth="max-w-3xl">
        {selectedUser && (
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-600" />User Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Email</span><p className="font-semibold text-slate-800 text-sm mt-0.5">{selectedUser.email}</p></div>
                <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Phone</span><p className="font-semibold text-slate-800 text-sm mt-0.5">{selectedUser.phone || 'N/A'}</p></div>
                <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Designation</span><p className="font-semibold text-slate-800 text-sm mt-0.5">{selectedUser.designation || 'N/A'}</p></div>
                <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Primary Role</span><div className="mt-0.5">{(() => { const role = getRoleById(roles, selectedUser.primaryRoleId); return role ? <Badge variant="secondary" className="font-medium text-xs" style={{ backgroundColor: role.colorCode + '18', color: role.colorCode }}>{role.displayName}</Badge> : <span className="text-sm text-slate-500">None</span> })()}</div></div>
                <div className="p-3 rounded-lg bg-slate-50"><span className="text-xs text-slate-500 font-medium">Status</span><div className="mt-1 flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${selectedUser.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} /><span className={`text-sm font-medium ${selectedUser.isActive ? 'text-emerald-600' : 'text-red-600'}`}>{selectedUser.isActive ? 'Active' : 'Inactive'}</span></div></div>
                <div className="p-3 rounded-lg bg-slate-50 flex items-center justify-between"><div><span className="text-xs text-slate-500 font-medium">Toggle Status</span><p className="text-xs text-slate-500 mt-0.5">Activate / deactivate this user</p></div><Switch checked={selectedUser.isActive} onCheckedChange={() => handleToggleActive(selectedUser)} /></div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-600" />Assigned Roles<Badge variant="secondary" className="text-[10px] bg-slate-100">{selectedUser.roleIds.length}</Badge></h4>
              {selectedUser.roleIds.length > 0 ? (<div className="flex flex-wrap gap-2">{selectedUser.roleIds.map(roleId => { const role = getRoleById(roles, roleId); if (!role) return null; return (<div key={roleId} className="flex items-center gap-1.5 group"><Badge variant="outline" className="font-medium border-slate-300 pr-1.5" style={{ borderColor: role.colorCode + '60', color: role.colorCode }}><div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: role.colorCode }} />{role.displayName}<button type="button" onClick={() => handleRemoveRole(selectedUser, roleId)} className="ml-1.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button></Badge></div>) })}</div>) : (<div className="py-3 text-center text-slate-500 text-sm">No roles assigned</div>)}
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2"><Briefcase className="h-4 w-4 text-emerald-600" />Departments<Badge variant="secondary" className="text-[10px] bg-slate-100">{selectedUser.departmentIds.length}</Badge></h4>
              {selectedUser.departmentIds.length > 0 ? (<div className="flex flex-wrap gap-2">{selectedUser.departmentIds.map(deptId => { const dept = getDeptById(departments, deptId); if (!dept) return null; return <Badge key={deptId} variant="secondary" className="bg-slate-100 text-slate-700">{dept.name}<span className="ml-1 text-slate-500 text-[10px]">({dept.code})</span></Badge> })}</div>) : (<div className="py-3 text-center text-slate-500 text-sm">No departments assigned</div>)}
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2"><ToggleLeft className="h-4 w-4 text-emerald-600" />Individual Permission Overrides (ABAC)</h4>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm mb-4"><AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" /><div><p className="font-semibold text-amber-800">Permission Override Rules</p><p className="text-amber-700 text-xs mt-0.5"><strong>Grant</strong> adds access beyond role-based permissions. <strong>Deny</strong> explicitly blocks access even if a role would grant it. <strong>Not Set</strong> falls back to role-based access only.</p></div></div>
              <div className="space-y-5">
                {permCategories.map(cat => { const catPerms = permsByCategory[cat] || []; return (<div key={cat}><h5 className="font-semibold text-xs text-slate-600 mb-2 flex items-center gap-2 uppercase tracking-wider"><div className="w-2 h-2 rounded-full bg-amber-500" />{cat}<Badge variant="secondary" className="text-[10px] bg-slate-100">{catPerms.length}</Badge></h5><div className="space-y-2">{catPerms.map(perm => { const override = permOverrides[perm.id]; const granted = override?.granted ?? null; const reason = override?.reason ?? ''; return (<div key={perm.id} className={`p-3 rounded-lg border transition-all duration-150 ${granted === true ? 'bg-emerald-50 border-emerald-200' : granted === false ? 'bg-red-50 border-red-200' : 'border-slate-200 hover:border-slate-300'}`}><div className="flex items-center gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-medium text-sm text-slate-800">{perm.displayName}</span>{perm.isDangerous && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Danger</Badge>}</div><p className="text-xs text-slate-500 font-mono">{perm.name}</p></div><div className="flex items-center gap-1 flex-shrink-0"><button type="button" onClick={() => handlePermOverrideChange(perm.id, null)} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${granted === null ? 'bg-slate-200 text-slate-700 shadow-sm' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Not Set</button><button type="button" onClick={() => handlePermOverrideChange(perm.id, true)} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${granted === true ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Grant</button><button type="button" onClick={() => handlePermOverrideChange(perm.id, false)} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${granted === false ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Deny</button></div></div>{granted !== null && (<div className="mt-2"><Input placeholder="Reason for this override..." value={reason} onChange={e => handlePermReasonChange(perm.id, e.target.value)} className="h-8 text-xs border-slate-200" /></div>)}</div>) })}</div></div>) })}
              </div>
              <div className="flex justify-end mt-4"><Button onClick={handleSavePermOverrides} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle2 className="h-4 w-4 mr-2" />Save Permission Overrides</Button></div>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
