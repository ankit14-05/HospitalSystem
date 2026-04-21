import React from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorEmrLabWorkspace from '../../components/emr/DoctorEmrLabWorkspace';
import { useAuth } from '../../context/AuthContext';

const resolveDoctorDisplayName = (user = {}) => {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  if (!fullName) return 'Doctor';
  return fullName.startsWith('Dr.') ? fullName : `Dr. ${fullName}`;
};

export default function LabBookingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <DoctorEmrLabWorkspace
      queue={[]}
      requests={[]}
      doctorName={resolveDoctorDisplayName(user)}
      onViewPatient={(patientId) => {
        if (!patientId) return;
        navigate(`/patient/emr/${patientId}`);
      }}
    />
  );
}
