const ROLE_ALIASES = {
  'lab technician': 'labtech',
  lab_technician: 'labtech',
  'opd manager': 'opdmanager',
  opd_manager: 'opdmanager',
  'lab incharge': 'lab_incharge',
  lab_incharge: 'lab_incharge',
};

const normalizeRole = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_ALIASES[raw] || raw;
};

const STAFF_PROFILE_ROLES = [
  'nurse',
  'receptionist',
  'pharmacist',
  'labtech',
  'lab_technician',
  'lab_incharge',
  'ward_boy',
  'housekeeping',
  'security',
  'admin_staff',
  'opdmanager',
  'opd_manager',
];

const ADMIN_ROLES = ['superadmin', 'admin', 'auditor'];

const APPOINTMENT_DESK_ROLES = [
  'admin',
  'superadmin',
  'receptionist',
  'nurse',
  'opdmanager',
  'opd_manager',
];

const DB_ALLOWED_ROLES = [
  'superadmin',
  'admin',
  'doctor',
  'nurse',
  'receptionist',
  'pharmacist',
  'labtech',
  'lab_technician',
  'lab_incharge',
  'patient',
  'auditor',
  'ward_boy',
  'housekeeping',
  'security',
  'admin_staff',
  'opdmanager',
  'opd_manager',
];

module.exports = {
  ADMIN_ROLES,
  APPOINTMENT_DESK_ROLES,
  DB_ALLOWED_ROLES,
  STAFF_PROFILE_ROLES,
  normalizeRole,
};
