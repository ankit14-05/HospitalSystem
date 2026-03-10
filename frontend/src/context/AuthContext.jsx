// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const ROLE_LABELS = {
  superadmin:    'Super Admin',
  admin:         'Hospital Admin',
  doctor:        'Doctor',
  nurse:         'Nurse / Staff',
  receptionist:  'Receptionist',
  pharmacist:    'Pharmacist',
  labtech:       'Lab Technician',
  patient:       'Patient',
  auditor:       'Auditor',
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Verify token on app load
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && !user) {
      authAPI.me()
        .then(res => setUser(res.data))
        .catch(() => clearAuth())
        .finally(() => { setLoading(false); setInitialized(true); });
    } else {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  // Listen for auth:expired events from axios interceptor
  useEffect(() => {
    const handler = () => {
      clearAuth();
      toast.error('Session expired. Please log in again.');
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('hospitalId');
    setUser(null);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await authAPI.login({ identifier, password });
    const { accessToken, user: userData } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.hospitalId) localStorage.setItem('hospitalId', userData.hospitalId);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch {}
    clearAuth();
    toast.success('Logged out successfully.');
  }, [clearAuth]);

  const hasRole = useCallback((...roles) => {
    return user && roles.includes(user.role);
  }, [user]);

  const isAdmin = useCallback(() => hasRole('superadmin', 'admin'), [hasRole]);

  const value = {
    user,
    loading,
    initialized,
    login,
    logout,
    clearAuth,
    hasRole,
    isAdmin,
    isAuthenticated: !!user,
    roleLabel: user ? (ROLE_LABELS[user.role] || user.role) : '',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export { ROLE_LABELS };
