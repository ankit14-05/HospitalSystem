import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { authAPI, resetAuthExpiredHandling, setAuthExpiredSuppressed } from '../services/api';
import { ROLE_LABELS } from '../config/roles';

const AuthContext = createContext(null);

const parseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

const extractAuthUser = (payload) => {
  if (!payload) return null;
  if (payload.user) return payload.user;
  if (payload.data?.user) return payload.data.user;
  if (payload.data) return payload.data;
  return payload;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => parseStoredUser());
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const persistUser = useCallback((nextUser) => {
    if (!nextUser) {
      localStorage.removeItem('user');
      localStorage.removeItem('hospitalId');
      setUser(null);
      return null;
    }

    localStorage.setItem('user', JSON.stringify(nextUser));
    if (nextUser.hospitalId) {
      localStorage.setItem('hospitalId', nextUser.hospitalId);
    } else {
      localStorage.removeItem('hospitalId');
    }
    setUser(nextUser);
    return nextUser;
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('hospitalId');
    setUser(null);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const response = await authAPI.me();
    const nextUser = extractAuthUser(response);
    resetAuthExpiredHandling();
    return persistUser(nextUser);
  }, [persistUser]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      setInitialized(true);
      return;
    }

    refreshCurrentUser()
      .catch(() => clearAuth())
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, [clearAuth, refreshCurrentUser]);

  useEffect(() => {
    const handler = () => {
      clearAuth();
      toast.error('Session expired. Please log in again.', { id: 'auth-expired' });
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [clearAuth]);

  const login = useCallback(async (identifier, password) => {
    resetAuthExpiredHandling();
    const response = await authAPI.login({ identifier, password });
    const payload = response?.data || response;
    const nextUser = extractAuthUser(payload);
    const accessToken = payload?.accessToken || response?.accessToken;

    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    }

    resetAuthExpiredHandling();
    return persistUser(nextUser);
  }, [persistUser]);

  const logout = useCallback(async () => {
    setAuthExpiredSuppressed(true);
    try {
      await authAPI.logout();
    } catch {}
    clearAuth();
    toast.dismiss('auth-expired');
    toast.success('Logged out successfully.');
  }, [clearAuth]);

  const switchPatientProfile = useCallback(async (patientId) => {
    await authAPI.switchPatientProfile({ patientId });
    const nextUser = await refreshCurrentUser();
    toast.success('Patient profile switched successfully.');
    return nextUser;
  }, [refreshCurrentUser]);

  const addFamilyMember = useCallback(async (payload) => {
    await authAPI.addFamilyMember(payload);
    const nextUser = await refreshCurrentUser();
    toast.success('Patient profile added successfully.');
    return nextUser;
  }, [refreshCurrentUser]);

  const hasRole = useCallback((...roles) => {
    return Boolean(user && roles.includes(user.role));
  }, [user]);

  const isAdmin = useCallback(() => hasRole('superadmin', 'admin'), [hasRole]);

  const patientProfiles = useMemo(() => user?.patientProfiles || [], [user]);
  const activePatientProfile = user?.activePatientProfile || null;
  const familyAccessEnabled = Boolean(user?.familyAccessEnabled);

  const value = {
    user,
    loading,
    initialized,
    login,
    logout,
    clearAuth,
    refreshCurrentUser,
    switchPatientProfile,
    addFamilyMember,
    hasRole,
    isAdmin,
    patientProfiles,
    activePatientProfile,
    familyAccessEnabled,
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
