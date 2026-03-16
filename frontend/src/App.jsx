// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import AppLayout       from './components/layouts/AppLayout';
import DashboardLayout from "./components/layouts/DashboardLayout";

// Auth pages
import LoginPage          from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Register pages
import PatientRegisterPage from './pages/register/PatientRegisterPage';
import DoctorRegisterPage  from './pages/register/DoctorRegisterPage';
import StaffRegisterPage   from './pages/register/StaffRegisterPage';

// Dashboards
import AdminDashboard   from './pages/dashboard/AdminDashboard';
import DoctorDashboard  from './pages/dashboard/DoctorDashboard';
import StaffDashboard   from './pages/dashboard/StaffDashboard';
import PatientDashboard from './pages/dashboard/PatientDashboard';

// Admin panels
import DoctorApprovalPanel from './pages/admin/DoctorApprovalPanel';
import StaffApprovalPanel  from './pages/admin/StaffApprovalPanel';

// Scheduling
import SchedulingDashboard  from './pages/scheduling/SchedulingDashboard';
import AdminScheduleManager from './pages/scheduling/AdminScheduleManager';
import DoctorSchedulePage   from './pages/scheduling/DoctorSchedulePage';

// Setup pages
import HospitalSetupPage from './pages/setup/HospitalSetupPage';
import UsersPage         from './pages/setup/UsersPage';
import GeoSetupPage      from './pages/setup/GeoSetupPage';
import NotFoundPage      from './pages/NotFoundPage';

// Appointments
import AppointmentsPage     from './pages/appointments/AppointmentsPage';
import BookAppointmentPage  from './pages/appointments/BookAppointmentPage';

// ── Shared role map ───────────────────────────────────────────────────────────
const ROLE_ROUTES = {
  superadmin:   'admin',
  admin:        'admin',
  auditor:      'admin',
  doctor:       'doctor',
  nurse:        'staff',
  receptionist: 'staff',
  pharmacist:   'staff',
  labtech:      'staff',
  patient:      'patient',
};

const getDashboard = (role) => `/dashboard/${ROLE_ROUTES[role] || 'admin'}`;

// ── Guards ────────────────────────────────────────────────────────────────────

/** Shows a spinner while auth is resolving, then enforces login. */
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner w-8 h-8" />
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * Protects a route by role.
 * If the user's role is not in `roles`, they are sent to THEIR OWN dashboard
 * instead of always being dumped on /dashboard/admin.
 */
function RequireRole({ children, roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) {
    return <Navigate to={getDashboard(user?.role)} replace />;
  }
  return children;
}

/**
 * Redirects already-authenticated users away from public pages (login, register)
 * to their correct dashboard.
 */
function RedirectIfAuth({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return children;
  return <Navigate to={getDashboard(user?.role)} replace />;
}

/**
 * Smart root redirect — sends each role to their own dashboard.
 * Replaces the old hardcoded <Navigate to="/dashboard/admin" />.
 */
function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={getDashboard(user?.role)} replace />;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif' },
          }}
        />
        <Routes>

          {/* ── Public auth routes ── */}
          <Route path="/login"           element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
          <Route path="/forgot-password" element={<RedirectIfAuth><ForgotPasswordPage /></RedirectIfAuth>} />

          {/* ── Public registration routes ── */}
          <Route path="/register/patient" element={<RedirectIfAuth><PatientRegisterPage /></RedirectIfAuth>} />
          <Route path="/register/doctor"  element={<RedirectIfAuth><DoctorRegisterPage /></RedirectIfAuth>} />
          <Route path="/register/staff"   element={<RedirectIfAuth><StaffRegisterPage /></RedirectIfAuth>} />

          {/* ── Protected routes — DashboardLayout (sidebar + topbar) ── */}
          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            {/* Root redirect — role-aware, no longer hardcoded to admin */}
            <Route index    element={<RootRedirect />} />
            <Route path="/" element={<RootRedirect />} />

            {/* ── Dashboards — each guarded by allowed roles ── */}
            <Route
              path="dashboard/admin"
              element={
                <RequireRole roles={['superadmin', 'admin', 'auditor']}>
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/doctor"
              element={
                <RequireRole roles={['doctor']}>
                  <DoctorDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/staff"
              element={
                <RequireRole roles={['nurse', 'receptionist', 'pharmacist', 'labtech']}>
                  <StaffDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/patient"
              element={
                <RequireRole roles={['patient']}>
                  <PatientDashboard />
                </RequireRole>
              }
            />

            {/* ── Admin panels ── */}
            <Route
              path="admin/doctor-approvals"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <DoctorApprovalPanel />
                </RequireRole>
              }
            />
            <Route
              path="admin/staff-approvals"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <StaffApprovalPanel />
                </RequireRole>
              }
            />

            {/* ── Scheduling ── */}
            <Route
              path="admin/scheduling"
              element={
                <RequireRole roles={['superadmin', 'admin', 'auditor']}>
                  <SchedulingDashboard />
                </RequireRole>
              }
            />
            <Route
              path="admin/schedule-manager"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <AdminScheduleManager />
                </RequireRole>
              }
            />
            <Route
              path="doctor/schedule"
              element={
                <RequireRole roles={['doctor']}>
                  <DoctorSchedulePage />
                </RequireRole>
              }
            />

            {/* ── Appointments ── */}
            <Route
              path="appointments"
              element={
                <RequireRole roles={['superadmin', 'admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'labtech', 'patient', 'auditor']}>
                  <AppointmentsPage />
                </RequireRole>
              }
            />
            <Route
              path="appointments/book"
              element={
                <RequireRole roles={['patient']}>
                  <BookAppointmentPage />
                </RequireRole>
              }
            />
            <Route
              path="admin/appointments"
              element={
                <RequireRole roles={['superadmin', 'admin', 'auditor']}>
                  <AppointmentsPage />
                </RequireRole>
              }
            />

            {/* ── Setup — admin / superadmin only ── */}
            <Route
              path="setup/hospital"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <HospitalSetupPage />
                </RequireRole>
              }
            />
            <Route
              path="setup/users"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <UsersPage />
                </RequireRole>
              }
            />
            <Route
              path="setup/geography"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <GeoSetupPage />
                </RequireRole>
              }
            />
          </Route>

          {/* ── Fallback ── */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}