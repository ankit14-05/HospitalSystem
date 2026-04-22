import React from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorEmrLabWorkspace from '../../components/emr/DoctorEmrLabWorkspace';

export default function NursingLabBookingPage() {
  const navigate = useNavigate();

  return (
    <DoctorEmrLabWorkspace
      queue={[]}
      requests={[]}
      doctorName="Nursing Station"
      onViewPatient={(patientId) => navigate(`/patient/emr/${patientId}`)}
    />
  );
}
