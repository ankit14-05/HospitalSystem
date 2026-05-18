// ═══════════════════════════════════════════════════════════════════════
// MOCK DATA FOR RBAC ACCESS CONTROL UI (Plain JS — no TypeScript types)
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_PERMISSIONS = [
  { id: 'p1', name: 'patient.record.view', resource: 'patient', action: 'view', displayName: 'View Patient Records', description: 'View patient medical records', category: 'Patient Records', isDangerous: false },
  { id: 'p2', name: 'patient.record.create', resource: 'patient', action: 'create', displayName: 'Create Patient Records', description: 'Create new patient records', category: 'Patient Records', isDangerous: false },
  { id: 'p3', name: 'patient.record.edit', resource: 'patient', action: 'edit', displayName: 'Edit Patient Records', description: 'Edit existing patient records', category: 'Patient Records', isDangerous: true },
  { id: 'p4', name: 'patient.record.delete', resource: 'patient', action: 'delete', displayName: 'Delete Patient Records', description: 'Delete patient records', category: 'Patient Records', isDangerous: true },
  { id: 'p5', name: 'prescription.view', resource: 'prescription', action: 'view', displayName: 'View Prescriptions', description: 'View prescriptions', category: 'Prescriptions', isDangerous: false },
  { id: 'p6', name: 'prescription.create', resource: 'prescription', action: 'create', displayName: 'Create Prescriptions', description: 'Create new prescriptions', category: 'Prescriptions', isDangerous: false },
  { id: 'p7', name: 'prescription.approve', resource: 'prescription', action: 'approve', displayName: 'Approve Prescriptions', description: 'Approve pending prescriptions', category: 'Prescriptions', isDangerous: true },
  { id: 'p8', name: 'billing.view', resource: 'billing', action: 'view', displayName: 'View Billing', description: 'View billing records', category: 'Billing', isDangerous: false },
  { id: 'p9', name: 'billing.create', resource: 'billing', action: 'create', displayName: 'Create Bills', description: 'Create new billing records', category: 'Billing', isDangerous: false },
  { id: 'p10', name: 'billing.edit', resource: 'billing', action: 'edit', displayName: 'Edit Billing', description: 'Edit billing records', category: 'Billing', isDangerous: true },
  { id: 'p11', name: 'billing.approve', resource: 'billing', action: 'approve', displayName: 'Approve Bills', description: 'Approve billing records', category: 'Billing', isDangerous: true },
  { id: 'p12', name: 'user.manage', resource: 'user', action: 'manage', displayName: 'Manage Users', description: 'Create, edit, delete users', category: 'Admin', isDangerous: true },
  { id: 'p13', name: 'role.manage', resource: 'role', action: 'manage', displayName: 'Manage Roles', description: 'Create, edit, delete roles and permissions', category: 'Admin', isDangerous: true },
  { id: 'p14', name: 'report.view', resource: 'report', action: 'view', displayName: 'View Reports', description: 'View analytical reports', category: 'Reports', isDangerous: false },
  { id: 'p15', name: 'report.export', resource: 'report', action: 'export', displayName: 'Export Reports', description: 'Export reports to file', category: 'Reports', isDangerous: false },
  { id: 'p16', name: 'department.manage', resource: 'department', action: 'manage', displayName: 'Manage Departments', description: 'Create, edit, delete departments', category: 'Admin', isDangerous: false },
  { id: 'p17', name: 'audit.view', resource: 'audit', action: 'view', displayName: 'View Audit Logs', description: 'View system audit logs', category: 'Admin', isDangerous: false },
  { id: 'p18', name: 'emergency.access', resource: 'emergency', action: 'access', displayName: 'Emergency Access', description: 'Break-glass emergency access', category: 'Emergency', isDangerous: true },
  { id: 'p19', name: 'lab.order', resource: 'lab', action: 'order', displayName: 'Order Lab Tests', description: 'Order laboratory tests', category: 'Laboratory', isDangerous: false },
  { id: 'p20', name: 'lab.view', resource: 'lab', action: 'view', displayName: 'View Lab Results', description: 'View laboratory results', category: 'Laboratory', isDangerous: false },
  { id: 'p21', name: 'schedule.manage', resource: 'schedule', action: 'manage', displayName: 'Manage Schedules', description: 'Manage doctor schedules', category: 'Scheduling', isDangerous: false },
  { id: 'p22', name: 'appointment.create', resource: 'appointment', action: 'create', displayName: 'Create Appointments', description: 'Create appointments', category: 'Scheduling', isDangerous: false },
]

// ═══════════════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_ROLES = [
  { id: 'r1', name: 'super_admin', displayName: 'Super Admin', category: 'administrative', description: 'Full system access with all permissions', colorCode: '#dc2626', icon: 'Crown', sortOrder: 1, isActive: true, isSystem: true, permissions: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11','p12','p13','p14','p15','p16','p17','p18','p19','p20','p21','p22'] },
  { id: 'r2', name: 'doctor', displayName: 'Doctor', category: 'clinical', description: 'Clinical staff with patient care access', colorCode: '#059669', icon: 'Stethoscope', sortOrder: 2, isActive: true, isSystem: true, permissions: ['p1','p2','p3','p5','p6','p7','p14','p19','p20','p22'] },
  { id: 'r3', name: 'nurse', displayName: 'Nurse', category: 'clinical', description: 'Nursing staff with patient interaction access', colorCode: '#0891b2', icon: 'Heart', sortOrder: 3, isActive: true, isSystem: true, permissions: ['p1','p2','p5','p6','p19','p20','p22'] },
  { id: 'r4', name: 'receptionist', displayName: 'Receptionist', category: 'patient_facing', description: 'Front desk with appointment and basic patient access', colorCode: '#d97706', icon: 'Phone', sortOrder: 4, isActive: true, isSystem: true, permissions: ['p1','p2','p22','p14'] },
  { id: 'r5', name: 'pharmacist', displayName: 'Pharmacist', category: 'clinical', description: 'Pharmacy staff with prescription management', colorCode: '#7c3aed', icon: 'Pill', sortOrder: 5, isActive: true, isSystem: true, permissions: ['p5','p6','p7','p1','p14'] },
  { id: 'r6', name: 'billing_staff', displayName: 'Billing Staff', category: 'administrative', description: 'Billing and finance department', colorCode: '#ea580c', icon: 'Receipt', sortOrder: 6, isActive: true, isSystem: true, permissions: ['p8','p9','p10','p11','p1','p14'] },
  { id: 'r7', name: 'lab_tech', displayName: 'Lab Technician', category: 'support', description: 'Laboratory staff with test management', colorCode: '#0d9488', icon: 'Microscope', sortOrder: 7, isActive: true, isSystem: true, permissions: ['p19','p20','p1','p14'] },
  { id: 'r8', name: 'hr_manager', displayName: 'HR Manager', category: 'administrative', description: 'Human resources management', colorCode: '#be185d', icon: 'UserCog', sortOrder: 8, isActive: true, isSystem: true, permissions: ['p12','p14','p15','p17'] },
  { id: 'r9', name: 'department_head', displayName: 'Department Head', category: 'administrative', description: 'Department management and oversight', colorCode: '#4338ca', icon: 'Building', sortOrder: 9, isActive: true, isSystem: false, permissions: ['p1','p2','p3','p5','p14','p16','p17','p21'] },
  { id: 'r10', name: 'intern', displayName: 'Intern', category: 'clinical', description: 'Temporary clinical access with restrictions', colorCode: '#6b7280', icon: 'GraduationCap', sortOrder: 10, isActive: false, isSystem: false, permissions: ['p1','p5','p20'] },
]

// ═══════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_DEPARTMENTS = [
  { id: 'd1', name: 'Cardiology', code: 'CARD', description: 'Heart and cardiovascular care', floor: '4th Floor', isActive: true },
  { id: 'd2', name: 'Neurology', code: 'NEUR', description: 'Brain and nervous system care', floor: '3rd Floor', isActive: true },
  { id: 'd3', name: 'Orthopedics', code: 'ORTH', description: 'Bone and joint care', floor: '2nd Floor', isActive: true },
  { id: 'd4', name: 'Pediatrics', code: 'PEDS', description: 'Child healthcare department', floor: '5th Floor', isActive: true },
  { id: 'd5', name: 'Emergency Medicine', code: 'EMER', description: 'Emergency and trauma care', floor: 'Ground Floor', isActive: true },
  { id: 'd6', name: 'Oncology', code: 'ONCO', description: 'Cancer treatment and research', floor: '6th Floor', isActive: true },
  { id: 'd7', name: 'Radiology', code: 'RAD', description: 'Medical imaging department', floor: '1st Floor', isActive: true },
  { id: 'd8', name: 'Pharmacy', code: 'PHARM', description: 'Medication dispensing and management', floor: 'Ground Floor', isActive: false },
]

// ═══════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_USERS = [
  { id: 'u1', email: 'admin@hospital.com', firstName: 'Rajesh', lastName: 'Sharma', phone: '+91-9876543210', designation: 'System Administrator', gender: 'male', isActive: true, primaryRoleId: 'r1', roleIds: ['r1'], departmentIds: ['d1'], userPermissions: [] },
  { id: 'u2', email: 'priya.doctor@hospital.com', firstName: 'Priya', lastName: 'Patel', phone: '+91-9876543211', designation: 'Senior Cardiologist', gender: 'female', isActive: true, primaryRoleId: 'r2', roleIds: ['r2', 'r9'], departmentIds: ['d1'], userPermissions: [] },
  { id: 'u3', email: 'amit.nurse@hospital.com', firstName: 'Amit', lastName: 'Kumar', phone: '+91-9876543212', designation: 'Head Nurse', gender: 'male', isActive: true, primaryRoleId: 'r3', roleIds: ['r3'], departmentIds: ['d5'], userPermissions: [{ permissionId: 'p3', granted: true, reason: 'Emergency chart edits' }] },
  { id: 'u4', email: 'sneha.reception@hospital.com', firstName: 'Sneha', lastName: 'Gupta', phone: '+91-9876543213', designation: 'Front Desk Lead', gender: 'female', isActive: true, primaryRoleId: 'r4', roleIds: ['r4'], departmentIds: ['d5'], userPermissions: [] },
  { id: 'u5', email: 'vikram.pharma@hospital.com', firstName: 'Vikram', lastName: 'Singh', phone: '+91-9876543214', designation: 'Chief Pharmacist', gender: 'male', isActive: true, primaryRoleId: 'r5', roleIds: ['r5'], departmentIds: ['d8'], userPermissions: [] },
  { id: 'u6', email: 'anita.billing@hospital.com', firstName: 'Anita', lastName: 'Desai', phone: '+91-9876543215', designation: 'Billing Manager', gender: 'female', isActive: true, primaryRoleId: 'r6', roleIds: ['r6'], departmentIds: ['d1'], userPermissions: [] },
  { id: 'u7', email: 'rohit.lab@hospital.com', firstName: 'Rohit', lastName: 'Mehta', phone: '+91-9876543216', designation: 'Lab Supervisor', gender: 'male', isActive: true, primaryRoleId: 'r7', roleIds: ['r7'], departmentIds: ['d7'], userPermissions: [] },
  { id: 'u8', email: 'kavita.hr@hospital.com', firstName: 'Kavita', lastName: 'Joshi', phone: '+91-9876543217', designation: 'HR Director', gender: 'female', isActive: true, primaryRoleId: 'r8', roleIds: ['r8'], departmentIds: ['d2'], userPermissions: [] },
  { id: 'u9', email: 'deepak.neuro@hospital.com', firstName: 'Deepak', lastName: 'Reddy', phone: '+91-9876543218', designation: 'Neurologist', gender: 'male', isActive: true, primaryRoleId: 'r2', roleIds: ['r2', 'r9'], departmentIds: ['d2'], userPermissions: [{ permissionId: 'p18', granted: true, reason: 'Emergency department coverage' }] },
  { id: 'u10', email: 'meera.peds@hospital.com', firstName: 'Meera', lastName: 'Nair', phone: '+91-9876543219', designation: 'Pediatrician', gender: 'female', isActive: true, primaryRoleId: 'r2', roleIds: ['r2'], departmentIds: ['d4'], userPermissions: [] },
  { id: 'u11', email: 'suresh.ortho@hospital.com', firstName: 'Suresh', lastName: 'Rao', phone: '+91-9876543220', designation: 'Orthopedic Surgeon', gender: 'male', isActive: true, primaryRoleId: 'r2', roleIds: ['r2', 'r9'], departmentIds: ['d3'], userPermissions: [] },
  { id: 'u12', email: 'nisha.intern@hospital.com', firstName: 'Nisha', lastName: 'Verma', phone: '+91-9876543221', designation: 'Medical Intern', gender: 'female', isActive: false, primaryRoleId: 'r10', roleIds: ['r10'], departmentIds: ['d1'], userPermissions: [] },
  { id: 'u13', email: 'arjun.onco@hospital.com', firstName: 'Arjun', lastName: 'Malhotra', phone: '+91-9876543222', designation: 'Oncologist', gender: 'male', isActive: true, primaryRoleId: 'r2', roleIds: ['r2'], departmentIds: ['d6'], userPermissions: [] },
  { id: 'u14', email: 'pooja.rad@hospital.com', firstName: 'Pooja', lastName: 'Iyer', phone: '+91-9876543223', designation: 'Radiologist', gender: 'female', isActive: true, primaryRoleId: 'r7', roleIds: ['r7'], departmentIds: ['d7'], userPermissions: [] },
  { id: 'u15', email: 'manish.emergency@hospital.com', firstName: 'Manish', lastName: 'Chopra', phone: '+91-9876543224', designation: 'ER Doctor', gender: 'male', isActive: true, primaryRoleId: 'r2', roleIds: ['r2'], departmentIds: ['d5'], userPermissions: [] },
]

// ═══════════════════════════════════════════════════════════════════════
// ACCESS LOGS
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_ACCESS_LOGS = [
  { id: 'l1', userId: 'u2', action: 'access_patient_record', resource: 'patient_record', resourceId: 'pat-001', accessType: 'normal', ipAddress: '192.168.1.45', justification: '', denied: false, denialReason: '', createdAt: '2025-05-02T09:15:00Z' },
  { id: 'l2', userId: 'u9', action: 'emergency_override', resource: 'patient_record', resourceId: 'pat-047', accessType: 'emergency', ipAddress: '192.168.1.78', justification: 'Patient unconscious, needed full medical history', denied: false, denialReason: '', createdAt: '2025-05-02T08:42:00Z' },
  { id: 'l3', userId: 'u4', action: 'access_patient_record', resource: 'patient_record', resourceId: 'pat-023', accessType: 'normal', ipAddress: '192.168.1.102', justification: '', denied: true, denialReason: 'Insufficient permissions for detailed records', createdAt: '2025-05-02T08:30:00Z' },
  { id: 'l4', userId: 'u6', action: 'create_billing_record', resource: 'billing', resourceId: 'bill-112', accessType: 'normal', ipAddress: '192.168.1.88', justification: '', denied: false, denialReason: '', createdAt: '2025-05-02T07:55:00Z' },
  { id: 'l5', userId: 'u3', action: 'edit_patient_record', resource: 'patient_record', resourceId: 'pat-015', accessType: 'delegated', ipAddress: '192.168.1.55', justification: 'Delegated by Dr. Priya Patel', denied: false, denialReason: '', createdAt: '2025-05-01T22:10:00Z' },
  { id: 'l6', userId: 'u5', action: 'approve_prescription', resource: 'prescription', resourceId: 'rx-089', accessType: 'normal', ipAddress: '192.168.1.66', justification: '', denied: false, denialReason: '', createdAt: '2025-05-01T20:30:00Z' },
  { id: 'l7', userId: 'u12', action: 'access_patient_record', resource: 'patient_record', resourceId: 'pat-067', accessType: 'normal', ipAddress: '192.168.1.200', justification: '', denied: true, denialReason: 'Intern role is inactive', createdAt: '2025-05-01T18:45:00Z' },
  { id: 'l8', userId: 'u1', action: 'manage_roles', resource: 'role', resourceId: 'r10', accessType: 'normal', ipAddress: '192.168.1.10', justification: 'Deactivated intern role', denied: false, denialReason: '', createdAt: '2025-05-01T16:20:00Z' },
  { id: 'l9', userId: 'u7', action: 'view_lab_results', resource: 'lab', resourceId: 'lab-334', accessType: 'normal', ipAddress: '192.168.1.77', justification: '', denied: false, denialReason: '', createdAt: '2025-05-01T14:55:00Z' },
  { id: 'l10', userId: 'u15', action: 'emergency_override', resource: 'patient_record', resourceId: 'pat-091', accessType: 'emergency', ipAddress: '192.168.1.99', justification: 'Trauma patient - immediate access required', denied: false, denialReason: '', createdAt: '2025-05-01T12:05:00Z' },
  { id: 'l11', userId: 'u2', action: 'create_prescription', resource: 'prescription', resourceId: 'rx-102', accessType: 'normal', ipAddress: '192.168.1.45', justification: '', denied: false, denialReason: '', createdAt: '2025-05-01T10:30:00Z' },
  { id: 'l12', userId: 'u8', action: 'manage_users', resource: 'user', resourceId: 'u12', accessType: 'normal', ipAddress: '192.168.1.30', justification: '', denied: false, denialReason: '', createdAt: '2025-04-30T16:45:00Z' },
]

// ═══════════════════════════════════════════════════════════════════════
// EMERGENCY REQUESTS
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_EMERGENCY_REQUESTS = [
  { id: 'e1', userId: 'u9', patientId: 'pat-047', resource: 'patient_record', resourceId: 'pat-047', reason: 'Patient unconscious in ER, needed full medical history for treatment', status: 'approved', accessedAt: '2025-05-02T08:42:00Z', expiresAt: '2025-05-02T20:42:00Z', reviewedBy: 'u1', reviewedAt: '2025-05-02T08:50:00Z', reviewNotes: 'Valid emergency situation' },
  { id: 'e2', userId: 'u15', patientId: 'pat-091', resource: 'patient_record', resourceId: 'pat-091', reason: 'Trauma patient - immediate access required for blood type and allergies', status: 'approved', accessedAt: '2025-05-01T12:05:00Z', expiresAt: '2025-05-02T00:05:00Z', reviewedBy: 'u1', reviewedAt: '2025-05-01T12:15:00Z', reviewNotes: 'Approved - critical emergency' },
  { id: 'e3', userId: 'u3', patientId: 'pat-033', resource: 'patient_record', resourceId: 'pat-033', reason: 'Need to view allergy information for incoming patient', status: 'pending_review', accessedAt: '2025-05-02T10:15:00Z', expiresAt: '2025-05-02T22:15:00Z', reviewedBy: null, reviewedAt: null, reviewNotes: null },
  { id: 'e4', userId: 'u4', patientId: 'pat-055', resource: 'billing', resourceId: 'bill-200', reason: 'Urgent billing correction needed for insurance claim deadline', status: 'pending_review', accessedAt: '2025-05-02T11:00:00Z', expiresAt: '2025-05-02T23:00:00Z', reviewedBy: null, reviewedAt: null, reviewNotes: null },
  { id: 'e5', userId: 'u12', patientId: 'pat-067', resource: 'patient_record', resourceId: 'pat-067', reason: 'Wanted to check patient records', status: 'denied', accessedAt: '2025-04-30T14:00:00Z', expiresAt: '2025-05-01T02:00:00Z', reviewedBy: 'u1', reviewedAt: '2025-04-30T14:10:00Z', reviewNotes: 'Not a valid emergency - intern should follow standard procedure' },
  { id: 'e6', userId: 'u2', patientId: 'pat-078', resource: 'prescription', resourceId: 'rx-200', reason: 'Need to prescribe emergency medication for cardiac arrest patient', status: 'revoked', accessedAt: '2025-04-29T16:30:00Z', expiresAt: '2025-04-30T04:30:00Z', reviewedBy: 'u1', reviewedAt: '2025-04-29T16:40:00Z', reviewNotes: 'Originally approved, revoked after situation stabilized' },
]

// ═══════════════════════════════════════════════════════════════════════
// DELEGATIONS
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_DELEGATIONS = [
  { id: 'del1', fromUserId: 'u2', toUserId: 'u3', roleId: 'r2', reason: 'On-call night shift coverage', validFrom: '2025-05-01T20:00:00Z', validUntil: '2025-05-02T08:00:00Z', status: 'expired', revokedAt: null, revokeReason: null },
  { id: 'del2', fromUserId: 'u11', toUserId: 'u3', roleId: 'r2', reason: 'Surgery coverage during conference', validFrom: '2025-05-02T09:00:00Z', validUntil: '2025-05-03T09:00:00Z', status: 'active', revokedAt: null, revokeReason: null },
  { id: 'del3', fromUserId: 'u6', toUserId: 'u4', roleId: 'r6', reason: 'Billing coverage during vacation', validFrom: '2025-05-03T00:00:00Z', validUntil: '2025-05-10T00:00:00Z', status: 'active', revokedAt: null, revokeReason: null },
  { id: 'del4', fromUserId: 'u9', toUserId: 'u10', roleId: 'r2', reason: 'Patient handover during shift change', validFrom: '2025-05-01T14:00:00Z', validUntil: '2025-05-01T14:30:00Z', status: 'revoked', revokedAt: '2025-05-01T14:15:00Z', revokeReason: 'Handover completed early' },
  { id: 'del5', fromUserId: 'u1', toUserId: 'u8', roleId: 'r1', reason: 'Admin coverage during off-site meeting', validFrom: '2025-05-04T10:00:00Z', validUntil: '2025-05-04T16:00:00Z', status: 'active', revokedAt: null, revokeReason: null },
]

// ═══════════════════════════════════════════════════════════════════════
// PATIENT ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_PATIENT_ASSIGNMENTS = [
  { id: 'pa1', patientId: 'pat-001', patientName: 'Arun Kumar', doctorId: 'u2', departmentId: 'd1', assignedBy: 'u1', assignedAt: '2025-04-20T10:00:00Z', isActive: true },
  { id: 'pa2', patientId: 'pat-002', patientName: 'Lakshmi Iyer', doctorId: 'u2', departmentId: 'd1', assignedBy: 'u1', assignedAt: '2025-04-22T14:00:00Z', isActive: true },
  { id: 'pa3', patientId: 'pat-003', patientName: 'Ravi Shankar', doctorId: 'u9', departmentId: 'd2', assignedBy: 'u1', assignedAt: '2025-04-25T09:00:00Z', isActive: true },
  { id: 'pa4', patientId: 'pat-004', patientName: 'Sunita Devi', doctorId: 'u10', departmentId: 'd4', assignedBy: 'u1', assignedAt: '2025-04-26T11:00:00Z', isActive: true },
  { id: 'pa5', patientId: 'pat-005', patientName: 'Kiran Reddy', doctorId: 'u11', departmentId: 'd3', assignedBy: 'u1', assignedAt: '2025-04-27T08:00:00Z', isActive: true },
  { id: 'pa6', patientId: 'pat-006', patientName: 'Fatima Begum', doctorId: 'u13', departmentId: 'd6', assignedBy: 'u8', assignedAt: '2025-04-28T13:00:00Z', isActive: true },
  { id: 'pa7', patientId: 'pat-007', patientName: 'Vijay Malhotra', doctorId: 'u15', departmentId: 'd5', assignedBy: 'u1', assignedAt: '2025-04-29T07:00:00Z', isActive: true },
  { id: 'pa8', patientId: 'pat-008', patientName: 'Ananya Das', doctorId: 'u2', departmentId: 'd1', assignedBy: 'u1', assignedAt: '2025-04-15T10:00:00Z', isActive: false },
  { id: 'pa9', patientId: 'pat-009', patientName: 'Pradeep Nair', doctorId: 'u9', departmentId: 'd2', assignedBy: 'u8', assignedAt: '2025-04-10T09:00:00Z', isActive: true },
  { id: 'pa10', patientId: 'pat-010', patientName: 'Geeta Patel', doctorId: 'u10', departmentId: 'd4', assignedBy: 'u1', assignedAt: '2025-04-18T11:30:00Z', isActive: true },
]

// ═══════════════════════════════════════════════════════════════════════
// ROLE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════

export const MOCK_TEMPLATES = [
  { id: 't1', name: 'clinical_bundle', displayName: 'Clinical Bundle', description: 'Full clinical access for senior medical staff', category: 'clinical', isSystem: true, roleIds: ['r2', 'r9'] },
  { id: 't2', name: 'nursing_bundle', displayName: 'Nursing Bundle', description: 'Complete nursing access with delegation rights', category: 'clinical', isSystem: true, roleIds: ['r3'] },
  { id: 't3', name: 'admin_bundle', displayName: 'Admin Bundle', description: 'Full administrative access', category: 'administrative', isSystem: true, roleIds: ['r1'] },
  { id: 't4', name: 'front_desk_bundle', displayName: 'Front Desk Bundle', description: 'Reception and scheduling access', category: 'patient_facing', isSystem: false, roleIds: ['r4'] },
  { id: 't5', name: 'finance_bundle', displayName: 'Finance Bundle', description: 'Billing and financial access', category: 'administrative', isSystem: false, roleIds: ['r6'] },
]

// ═══════════════════════════════════════════════════════════════════════
// LOOKUP HELPERS
// ═══════════════════════════════════════════════════════════════════════

export const CATEGORY_COLORS = {
  clinical: 'bg-emerald-100 text-emerald-700',
  administrative: 'bg-orange-100 text-orange-700',
  patient_facing: 'bg-purple-100 text-purple-700',
  support: 'bg-gray-100 text-gray-700',
}

export const CATEGORY_LABELS = {
  clinical: 'Clinical',
  administrative: 'Administrative',
  patient_facing: 'Patient Facing',
  support: 'Support',
}

export const ACCESS_TYPE_COLORS = {
  normal: 'bg-slate-100 text-slate-700',
  emergency: 'bg-red-100 text-red-700',
  delegated: 'bg-amber-100 text-amber-700',
}
