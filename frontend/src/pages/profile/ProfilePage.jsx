import React, { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ProfileSummaryCard from '../../components/profile/ProfileSummaryCard';
import ProfileFieldGroup from '../../components/profile/ProfileFieldGroup';
import { ROLE_LABELS } from '../../config/roles';

const COMMON_OPTIONS = {
  gender: ['Male', 'Female', 'Other', 'PreferNot'],
  bloodGroup: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
};

const PROFILE_SECTIONS = {
  admin: [
    {
      title: 'Account Details',
      description: 'Core identity and communication information for your login.',
      fields: [
        { key: 'firstName', label: 'First name' },
        { key: 'lastName', label: 'Last name' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'gender', label: 'Gender', type: 'select', options: COMMON_OPTIONS.gender },
        { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
        { key: 'designation', label: 'Designation' },
        { key: 'username', label: 'Username', readOnly: true },
        { key: 'role', label: 'Role', readOnly: true },
        { key: 'hospitalName', label: 'Hospital', readOnly: true },
      ],
    },
    {
      title: 'Notification Preferences',
      description: 'Choose how you want the system to reach you.',
      fields: [
        { key: 'notifyEmail', label: 'Email notifications', type: 'checkbox', checkboxLabel: 'Receive email notifications' },
        { key: 'notifySms', label: 'SMS notifications', type: 'checkbox', checkboxLabel: 'Receive SMS notifications' },
        { key: 'notifyPush', label: 'Push notifications', type: 'checkbox', checkboxLabel: 'Receive in-app notifications' },
      ],
    },
  ],
  patient: [
    {
      title: 'Personal Details',
      description: 'These details appear on your patient profile and appointment records.',
      fields: [
        { key: 'firstName', label: 'First name' },
        { key: 'lastName', label: 'Last name' },
        { key: 'uhid', label: 'UHID', readOnly: true },
        { key: 'gender', label: 'Gender', type: 'select', options: COMMON_OPTIONS.gender },
        { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
        { key: 'bloodGroup', label: 'Blood group', type: 'select', options: COMMON_OPTIONS.bloodGroup },
        { key: 'nationality', label: 'Nationality' },
        { key: 'maritalStatus', label: 'Marital status' },
        { key: 'occupation', label: 'Occupation' },
        { key: 'motherTongue', label: 'Mother tongue' },
      ],
    },
    {
      title: 'Contact and Address',
      description: 'Keep your contact and emergency details up to date.',
      fields: [
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'altPhone', label: 'Alternate phone', type: 'tel' },
        { key: 'street1', label: 'Address line 1' },
        { key: 'street2', label: 'Address line 2' },
        { key: 'city', label: 'City' },
        { key: 'pincodeText', label: 'Pincode' },
        { key: 'emergencyName', label: 'Emergency contact name' },
        { key: 'emergencyRelation', label: 'Emergency relation' },
        { key: 'emergencyPhone', label: 'Emergency phone', type: 'tel' },
      ],
    },
    {
      title: 'Medical and Insurance',
      description: 'Clinical context is editable here; identifiers stay protected.',
      fields: [
        { key: 'knownAllergies', label: 'Known allergies', type: 'textarea', fullWidth: true },
        { key: 'chronicConditions', label: 'Chronic conditions', type: 'textarea', fullWidth: true },
        { key: 'currentMedications', label: 'Current medications', type: 'textarea', fullWidth: true },
        { key: 'insuranceProvider', label: 'Insurance provider' },
        { key: 'insurancePolicyNo', label: 'Insurance policy number' },
        { key: 'insuranceValidUntil', label: 'Insurance valid until', type: 'date' },
      ],
    },
    {
      title: 'Notification Preferences',
      description: 'Choose how appointment and billing updates reach you.',
      fields: [
        { key: 'notifyEmail', label: 'Email notifications', type: 'checkbox', checkboxLabel: 'Receive email notifications' },
        { key: 'notifySms', label: 'SMS notifications', type: 'checkbox', checkboxLabel: 'Receive SMS notifications' },
        { key: 'notifyPush', label: 'Push notifications', type: 'checkbox', checkboxLabel: 'Receive in-app notifications' },
      ],
    },
  ],
  doctor: [
    {
      title: 'Professional Overview',
      description: 'Core identifiers and hospital assignments stay read only here.',
      fields: [
        { key: 'firstName', label: 'First name' },
        { key: 'lastName', label: 'Last name' },
        { key: 'doctorCode', label: 'Doctor ID', readOnly: true },
        { key: 'departmentName', label: 'Department', readOnly: true },
        { key: 'specialization', label: 'Specialization', readOnly: true },
        { key: 'qualificationName', label: 'Qualification', readOnly: true },
        { key: 'medicalCouncilName', label: 'Medical council', readOnly: true },
        { key: 'approvalStatus', label: 'Approval status', readOnly: true },
        { key: 'designation', label: 'Designation' },
      ],
    },
    {
      title: 'Contact and Clinic Profile',
      description: 'Editable information shown to patients and staff.',
      fields: [
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'altPhone', label: 'Alternate phone', type: 'tel' },
        { key: 'gender', label: 'Gender', type: 'select', options: COMMON_OPTIONS.gender },
        { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
        { key: 'bloodGroup', label: 'Blood group', type: 'select', options: COMMON_OPTIONS.bloodGroup },
        { key: 'nationality', label: 'Nationality' },
        { key: 'languagesSpoken', label: 'Languages spoken' },
        { key: 'bio', label: 'Professional bio', type: 'textarea', fullWidth: true },
        { key: 'street1', label: 'Address line 1' },
        { key: 'street2', label: 'Address line 2' },
        { key: 'city', label: 'City' },
        { key: 'pincodeText', label: 'Pincode' },
      ],
    },
    {
      title: 'Scheduling and Fees',
      description: 'These operational fields are visible here but managed centrally.',
      fields: [
        { key: 'consultationFee', label: 'Consultation fee', readOnly: true },
        { key: 'followUpFee', label: 'Follow-up fee', readOnly: true },
        { key: 'emergencyFee', label: 'Emergency fee', readOnly: true },
        { key: 'experienceYears', label: 'Experience', readOnly: true },
        { key: 'licenseNumber', label: 'License number', readOnly: true },
        { key: 'licenseExpiry', label: 'License expiry', readOnly: true },
        { key: 'availableDays', label: 'Available days', readOnly: true },
        { key: 'availableFrom', label: 'Available from', readOnly: true },
        { key: 'availableTo', label: 'Available to', readOnly: true },
        { key: 'maxDailyPatients', label: 'Max daily patients', readOnly: true },
      ],
    },
    {
      title: 'Notification Preferences',
      description: 'Choose how patient and schedule updates reach you.',
      fields: [
        { key: 'notifyEmail', label: 'Email notifications', type: 'checkbox', checkboxLabel: 'Receive email notifications' },
        { key: 'notifySms', label: 'SMS notifications', type: 'checkbox', checkboxLabel: 'Receive SMS notifications' },
        { key: 'notifyPush', label: 'Push notifications', type: 'checkbox', checkboxLabel: 'Receive in-app notifications' },
      ],
    },
  ],
  staff: [
    {
      title: 'Employment Details',
      description: 'Operational assignments stay locked while personal details remain editable.',
      fields: [
        { key: 'firstName', label: 'First name' },
        { key: 'lastName', label: 'Last name' },
        { key: 'employeeId', label: 'Employee ID', readOnly: true },
        { key: 'role', label: 'Role', readOnly: true },
        { key: 'departmentName', label: 'Department', readOnly: true },
        { key: 'shift', label: 'Shift', readOnly: true },
        { key: 'joiningDate', label: 'Joining date', readOnly: true },
        { key: 'contractType', label: 'Contract type', readOnly: true },
        { key: 'designation', label: 'Designation' },
        { key: 'qualification', label: 'Qualification' },
        { key: 'experienceYears', label: 'Experience years', type: 'number' },
      ],
    },
    {
      title: 'Contact and Address',
      description: 'Personal contact details for daily operations and emergencies.',
      fields: [
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'altPhone', label: 'Alternate phone', type: 'tel' },
        { key: 'gender', label: 'Gender', type: 'select', options: COMMON_OPTIONS.gender },
        { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
        { key: 'bloodGroup', label: 'Blood group', type: 'select', options: COMMON_OPTIONS.bloodGroup },
        { key: 'nationality', label: 'Nationality' },
        { key: 'languagesSpoken', label: 'Languages spoken' },
        { key: 'street1', label: 'Address line 1' },
        { key: 'street2', label: 'Address line 2' },
        { key: 'city', label: 'City' },
        { key: 'pincodeText', label: 'Pincode' },
      ],
    },
    {
      title: 'Emergency and Health Context',
      description: 'Important emergency and allergy information for internal teams.',
      fields: [
        { key: 'emergencyName', label: 'Emergency contact name' },
        { key: 'emergencyRelation', label: 'Emergency relation' },
        { key: 'emergencyPhone', label: 'Emergency phone', type: 'tel' },
        { key: 'knownAllergies', label: 'Known allergies', type: 'textarea', fullWidth: true },
        { key: 'maritalStatus', label: 'Marital status' },
        { key: 'religion', label: 'Religion' },
        { key: 'motherTongue', label: 'Mother tongue' },
      ],
    },
    {
      title: 'Notification Preferences',
      description: 'Choose how duty, shift, and schedule notifications reach you.',
      fields: [
        { key: 'notifyEmail', label: 'Email notifications', type: 'checkbox', checkboxLabel: 'Receive email notifications' },
        { key: 'notifySms', label: 'SMS notifications', type: 'checkbox', checkboxLabel: 'Receive SMS notifications' },
        { key: 'notifyPush', label: 'Push notifications', type: 'checkbox', checkboxLabel: 'Receive in-app notifications' },
      ],
    },
  ],
};

const normalizeForm = (data = {}) => {
  const next = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      next[key] = typeof value === 'boolean' ? value : '';
      return;
    }
    if (typeof value === 'boolean') {
      next[key] = value;
      return;
    }
    if (key.toLowerCase().includes('date') && String(value).includes('T')) {
      next[key] = String(value).split('T')[0];
      return;
    }
    next[key] = value;
  });
  return next;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [payload, setPayload] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get('/profile/me');
      const nextPayload = response?.data || response;
      setPayload(nextPayload);
      setForm(normalizeForm(nextPayload?.data || {}));
    } catch (error) {
      toast.error(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const editableSet = useMemo(
    () => new Set(payload?.editableFields || []),
    [payload]
  );

  const profileType = payload?.profileType || 'admin';
  const sections = PROFILE_SECTIONS[profileType] || PROFILE_SECTIONS.admin;
  const roleLabel = ROLE_LABELS[payload?.role || user?.role] || 'User';

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {};
      editableSet.forEach((field) => {
        body[field] = form[field];
      });

      const response = await api.put('/profile/me', body);
      const nextPayload = response?.data || response;
      setPayload(nextPayload);
      setForm(normalizeForm(nextPayload?.data || {}));
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Real account and role details from the backend, with read-only protection where needed.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadProfile}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {loading && !payload ? (
        <div className="space-y-4">
          <div className="h-52 rounded-3xl bg-slate-100 animate-pulse" />
          <div className="h-64 rounded-3xl bg-slate-100 animate-pulse" />
          <div className="h-64 rounded-3xl bg-slate-100 animate-pulse" />
        </div>
      ) : payload?.data ? (
        <>
          <ProfileSummaryCard profile={payload.data} roleLabel={roleLabel} onEdit={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          {sections.map((section) => (
            <ProfileFieldGroup
              key={section.title}
              title={section.title}
              description={section.description}
              fields={section.fields}
              form={form}
              editableSet={editableSet}
              onChange={handleChange}
            />
          ))}
        </>
      ) : (
        <div className="card">
          <div className="card-body py-16 text-center text-slate-400">
            Profile details are not available for this account yet.
          </div>
        </div>
      )}
    </div>
  );
}
