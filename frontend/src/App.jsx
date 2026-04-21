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
import ConsultationPage from './pages/dashboard/ConsultationPage';
import NurseDashboard   from './pages/dashboard/NurseDashboard';
import ReceptionistDashboard from './pages/dashboard/ReceptionistDashboard';
import PharmacistDashboard   from './pages/dashboard/PharmacistDashboard';
import LabTechnicianDashboard from './pages/dashboard/LabTechnicianDashboard';
import LabInchargeDashboard from './pages/dashboard/LabInchargeDashboard';
import WardBoyDashboard       from './pages/dashboard/WardBoyDashboard';
import HousekeepingDashboard  from './pages/dashboard/HousekeepingDashboard';
import SecurityDashboard      from './pages/dashboard/SecurityDashboard';
import AdminStaffDashboard    from './pages/dashboard/AdminStaffDashboard';
import PatientDashboard from './pages/dashboard/PatientDashboard';
import OPDManagerDashboard from './pages/dashboard/OPDManagerDashboard';

// Admin panels
import DoctorApprovalPanel from './pages/admin/DoctorApprovalPanel';
import StaffApprovalPanel  from './pages/admin/StaffApprovalPanel';
import LabApprovalPanel    from './pages/admin/LabApprovalPanel';
import LabManagementPanel  from './pages/admin/LabManagementPanel';
import PeopleDirectoryPage from './pages/admin/PeopleDirectoryPage';
import AdminDepartments    from './pages/dashboard/AdminDepartments';
import AdminReports        from './pages/dashboard/AdminReports';
import AdminSettings       from './pages/dashboard/AdminSettings';

// Scheduling
import AdminScheduleManager from './pages/scheduling/AdminScheduleManager';
import DoctorSchedulePage   from './pages/scheduling/DoctorSchedulePage';
import DoctorScheduleEditorPage from './pages/scheduling/DoctorScheduleEditorPage';

// Setup pages
import HospitalSetupPage from './pages/setup/HospitalSetupPage';
import UsersPage         from './pages/setup/UsersPage';
import GeoSetupPage      from './pages/setup/GeoSetupPage';
import NotFoundPage      from './pages/NotFoundPage';

// Appointments
import AppointmentsPage     from './pages/appointments/AppointmentsPage';
import BookAppointmentPage  from './pages/appointments/BookAppointmentPage';

// Profiles
import ProfilePage from './pages/profile/ProfilePage';
import PatientProfilesPage from './pages/profile/PatientProfilesPage';
import AddFamilyMemberPage from './pages/profile/AddFamilyMemberPage';
import { APPOINTMENT_DESK_ROLES, STAFF_ROLES, getDashboardPath } from './config/roles';
import LabBookingPage from './pages/doctor/LabBookingPage';
import EMRPage from './pages/patient/EMRPage';

import SecuritySettings from './pages/dashboard/SecuritySettings';

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
    return <Navigate to={getDashboardPath(user?.role)} replace />;
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
  return <Navigate to={getDashboardPath(user?.role)} replace />;
}

/**
 * Smart root redirect — sends each role to their own dashboard.
 * Replaces the old hardcoded <Navigate to="/dashboard/admin" />.
 */
function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={getDashboardPath(user?.role)} replace />;
}

function LegacyStaffDashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={getDashboardPath(user?.role)} replace />;
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

          {/* ── Custom Fullscreen Routes ── */}
          <Route
            path="/patient/profiles"
            element={
              <RequireAuth>
                <RequireRole roles={['patient']}>
                  <PatientProfilesPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/patient/family/add"
            element={
              <RequireAuth>
                <RequireRole roles={['patient']}>
                  <AddFamilyMemberPage />
                </RequireRole>
              </RequireAuth>
            }
          />

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
              path="dashboard/doctor/consult/:appointmentId"
              element={
                <RequireRole roles={['doctor']}>
                  <ConsultationPage />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/nurse"
              element={
                <RequireRole roles={['nurse']}>
                  <NurseDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/receptionist"
              element={
                <RequireRole roles={['receptionist']}>
                  <ReceptionistDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/pharmacist"
              element={
                <RequireRole roles={['pharmacist']}>
                  <PharmacistDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/labtech"
              element={
                <RequireRole roles={['labtech', 'lab_technician']}>
                  <LabTechnicianDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/labincharge"
              element={
                <RequireRole roles={['lab_incharge', 'labincharge', 'Lab Incharge']}>
                  <LabInchargeDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/staff"
              element={
                <RequireRole roles={STAFF_ROLES}>
                  <LegacyStaffDashboardRedirect />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/wardboy"
              element={
                <RequireRole roles={['ward_boy']}>
                  <WardBoyDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/housekeeping"
              element={
                <RequireRole roles={['housekeeping']}>
                  <HousekeepingDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/security"
              element={
                <RequireRole roles={['security']}>
                  <SecurityDashboard />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/adminstaff"
              element={
                <RequireRole roles={['admin_staff']}>
                  <AdminStaffDashboard />
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
            <Route
              path="doctor/lab-booking"
              element={
                <RequireRole roles={['doctor']}>
                  <LabBookingPage />
                </RequireRole>
              }
            />
            <Route
              path="patient/emr/:patientId?"
              element={
                <RequireRole roles={['patient', 'doctor', 'admin', 'superadmin']}>
                  <EMRPage />
                </RequireRole>
              }
            />
            <Route
              path="lab/approvals"
              element={
                <RequireRole roles={['lab_incharge', 'labincharge', 'Lab Incharge']}>
                  <LabInchargeDashboard />
                </RequireRole>
              }
            />


            <Route
              path="dashboard/opd"
              element={
                <RequireRole roles={['opdmanager', 'opd_manager']}>
                  <OPDManagerDashboard />
                </RequireRole>
              }
            />

            {/* ── Admin panels ── */}
            <Route
              path="admin/people"
              element={
                <RequireRole roles={['superadmin', 'admin', 'auditor']}>
                  <PeopleDirectoryPage />
                </RequireRole>
              }
            />
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
            <Route
              path="admin/lab-approvals"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <LabApprovalPanel />
                </RequireRole>
              }
            />
            <Route
              path="admin/lab-management"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <LabManagementPanel />
                </RequireRole>
              }
            />
            
            <Route
              path="admin/departments"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <AdminDepartments />
                </RequireRole>
              }
            />
            <Route
              path="admin/reports"
              element={
                <RequireRole roles={['superadmin', 'admin', 'auditor']}>
                  <AdminReports />
                </RequireRole>
              }
            />
            <Route
              path="admin/settings"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <AdminSettings />
                </RequireRole>
              }
            />

            {/* ── Scheduling ── */}
            <Route
              path="admin/scheduling"
              element={
                <RequireRole roles={['superadmin', 'admin', 'auditor']}>
                  <Navigate to="/admin/schedule-manager" replace />
                </RequireRole>
              }
            />
            <Route
              path="admin/schedule-manager"
              element={
                <RequireRole roles={['superadmin', 'admin', 'opdmanager', 'opd_manager']}>
                  <AdminScheduleManager />
                </RequireRole>
              }
            />
            <Route
              path="admin/schedule-manager/new"
              element={
                <RequireRole roles={['superadmin', 'admin', 'opdmanager', 'opd_manager']}>
                  <DoctorScheduleEditorPage />
                </RequireRole>
              }
            />
            <Route
              path="admin/schedule-manager/:id/edit"
              element={
                <RequireRole roles={['superadmin', 'admin']}>
                  <DoctorScheduleEditorPage />
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
                <RequireRole roles={['superadmin', 'admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'labtech', 'lab_technician', 'lab_incharge', 'labincharge', 'Lab Incharge', 'patient', 'auditor', 'opdmanager', 'opd_manager']}>
                  <AppointmentsPage />
                </RequireRole>
              }
            />
            <Route
              path="appointments/book"
              element={
                <RequireRole roles={['patient', ...APPOINTMENT_DESK_ROLES]}>
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

            {/* ── Profiles ── */}
            <Route path="superadmin/profile" element={<RequireRole roles={['superadmin']}><ProfilePage /></RequireRole>} />
            <Route path="admin/profile"      element={<RequireRole roles={['admin', 'auditor']}><ProfilePage /></RequireRole>} />
            <Route path="doctor/profile"     element={<RequireRole roles={['doctor']}><ProfilePage /></RequireRole>} />
            <Route path="staff/profile"      element={<RequireRole roles={STAFF_ROLES}><ProfilePage /></RequireRole>} />
            <Route path="patient/profile"    element={<RequireRole roles={['patient']}><ProfilePage /></RequireRole>} />

            {/* ── Security ── */}
            <Route path="superadmin/security" element={<RequireRole roles={['superadmin']}><SecuritySettings /></RequireRole>} />
            <Route path="admin/security"      element={<RequireRole roles={['admin', 'auditor']}><SecuritySettings /></RequireRole>} />
            <Route path="doctor/security"     element={<RequireRole roles={['doctor']}><SecuritySettings /></RequireRole>} />
            <Route path="staff/security"      element={<RequireRole roles={STAFF_ROLES}><SecuritySettings /></RequireRole>} />
            <Route path="patient/security"    element={<RequireRole roles={['patient']}><SecuritySettings /></RequireRole>} />

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
