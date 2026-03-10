// src/hooks/useHospitalBranding.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useHospitalBranding(hospitalId = 1) {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get(`/register/hospital-info?hospitalId=${hospitalId}`)
      .then(r => setBranding(r.data.data))
      .catch(() => setBranding({ name: 'MediCore HMS', primaryColor: '#6d28d9' }))
      .finally(() => setLoading(false));
  }, [hospitalId]);

  return { branding, loading };
}
