// src/hooks/useHospitalBranding.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useHospitalBranding(hospitalId) {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading]   = useState(true);
  const resolvedHospitalId = hospitalId || localStorage.getItem('hospitalId') || 1;

  useEffect(() => {
    setLoading(true);
    api.get(`/register/hospital-info?hospitalId=${resolvedHospitalId}`)
      .then((response) => {
        const payload = response?.data || response;
        setBranding(payload?.data || payload);
      })
      .catch(() => setBranding({ name: 'MediCore HMS', primaryColor: '#6d28d9' }))
      .finally(() => setLoading(false));
  }, [resolvedHospitalId]);

  return { branding, loading };
}
