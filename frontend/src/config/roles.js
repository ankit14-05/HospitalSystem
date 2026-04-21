export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Hospital Admin',
  auditor: 'Auditor',
  doctor: 'Doctor',
  patient: 'Patient',
  nurse: 'Nurse',
  receptionist: 'Receptionist',
  pharmacist: 'Pharmacist',
  labtech: 'Lab Technician',
  lab_technician: 'Lab Technician',
  ward_boy: 'Ward Boy',
  housekeeping: 'Housekeeping',
  security: 'Security',
  admin_staff: 'Admin Staff',
  opdmanager: 'OPD Manager',
  opd_manager: 'OPD Manager',
  lab_incharge: 'Lab Incharge',
  labincharge: 'Lab Incharge',
};

export const STAFF_ROLES = [
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

export const APPOINTMENT_DESK_ROLES = [
  'superadmin',
  'admin',
  'receptionist',
  'nurse',
  'opdmanager',
  'opd_manager',
];

export const isStaffRole = (role) => STAFF_ROLES.includes(role);

export const getProfileBasePath = (role) => {
  if (role === 'superadmin') return '/superadmin';
  if (role === 'admin' || role === 'auditor') return '/admin';
  if (role === 'doctor') return '/doctor';
  if (role === 'patient') return '/patient';
  return '/staff';
};

export const getProfilePath = (role) => `${getProfileBasePath(role)}/profile`;
export const getSecurityPath = (role) => `${getProfileBasePath(role)}/security`;
