// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';

// Auth pages
import LoginPage          from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';

// Register pages
import PatientRegisterPage from './pages/register/PatientRegisterPage';
import DoctorRegisterPage  from './pages/register/DoctorRegisterPage';
import StaffRegisterPage   from './pages/register/StaffRegisterPage';

// Dashboards
import AdminDashboard   from './pages/dashboard/AdminDashboard';
import DoctorDashboard  from './pages/dashboard/DoctorDashboard';
import StaffDashboard   from './pages/dashboard/StaffDashboard';
import PatientDashboard from './pages/dashboard/PatientDashboard';

//Panel
import DoctorApprovalPanel from './pages/admin/DoctorApprovalPanel';
import StaffApprovalPanel from './pages/admin/StaffApprovalPanel';

// Setup pages
import HospitalSetupPage from './pages/setup/HospitalSetupPage';
import UsersPage         from './pages/setup/UsersPage';
import GeoSetupPage      from './pages/setup/GeoSetupPage';
import NotFoundPage      from './pages/NotFoundPage';


// ── Guards ───────────────────────────────────────
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner w-8 h-8" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RequireRole({ children, roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/dashboard/admin" replace />;
  return children;
}

function RedirectIfAuth({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return children;
  const routes = { superadmin:'admin', admin:'admin', doctor:'doctor', nurse:'staff', receptionist:'staff', pharmacist:'staff', labtech:'staff', patient:'patient', auditor:'admin' };
  return <Navigate to={`/dashboard/${routes[user?.role] || 'admin'}`} replace />;
}

// ── App ───────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif' } }} />
        <Routes>
          {/* Public auth routes */}
          <Route path="/login"           element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
          <Route path="/forgot-password" element={<RedirectIfAuth><ForgotPasswordPage /></RedirectIfAuth>} />
          <Route path="/reset-password"  element={<RedirectIfAuth><ResetPasswordPage /></RedirectIfAuth>} />

          {/* Public registration routes */}
          <Route path="/register/patient" element={<RedirectIfAuth><PatientRegisterPage /></RedirectIfAuth>} />
          <Route path="/register/doctor"  element={<RedirectIfAuth><DoctorRegisterPage /></RedirectIfAuth>} />
          <Route path="/register/staff"   element={<RedirectIfAuth><StaffRegisterPage /></RedirectIfAuth>} />

          {/* Protected app routes */}
          <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
            {/* Root redirect */}
            <Route index element={<Navigate to="/dashboard/admin" replace />} />

            {/* Dashboards */}
            <Route path="dashboard/admin"   element={<AdminDashboard />} />
            <Route path="dashboard/doctor"  element={<DoctorDashboard />} />
            <Route path="dashboard/staff"   element={<StaffDashboard />} />
            <Route path="dashboard/patient" element={<PatientDashboard />} />
            <Route path="/admin/doctor-approvals" element={<DoctorApprovalPanel />} />
            <Route path="/admin/staff-approvals" element={<StaffApprovalPanel />} />



            {/* Setup */}
            <Route path="setup/hospital"   element={<RequireRole roles={['superadmin','admin']}><HospitalSetupPage /></RequireRole>} />
            <Route path="setup/users"      element={<RequireRole roles={['superadmin','admin']}><UsersPage /></RequireRole>} />
            <Route path="setup/geography"  element={<RequireRole roles={['superadmin','admin']}><GeoSetupPage /></RequireRole>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}