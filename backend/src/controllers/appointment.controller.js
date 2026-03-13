// src/controllers/appointment.controller.js
// HTTP layer — calls service, fires emails + notifications asynchronously

const { validationResult } = require('express-validator');
const apptService  = require('../services/appointment.service');
const notifService = require('../services/notificationService');
const emailService = require('../services/appointmentEmailservice');

// ── Import apiResponse safely ─────────────────────────────────────────────────
// Handles both export shapes:
//   { success, error }        — named exports
//   module.exports = { ... }  — default object
const apiResponse = require('../utils/apiResponse');
const sendSuccess = typeof apiResponse.success === 'function'
  ? apiResponse.success
  : (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const sendError = typeof apiResponse.error === 'function'
  ? apiResponse.error
  : (res, message, status = 500) => res.status(status).json({ success: false, message });

// ── Helper: fire all notifications + emails in background ────────────────────
const fireNotificationsAndEmails = async (type, appt, extra = {}) => {
  const {
    HospitalId, AppointmentNo, AppointmentDate, AppointmentTime, VisitType,
    TokenNumber, Reason, DepartmentName, CancelReason,
    PatientFirstName, PatientLastName, PatientEmail, PatientUserId,
    DoctorFirstName,  DoctorLastName,  DoctorEmail,  DoctorUserId,
  } = appt;

  const patientName   = `${PatientFirstName} ${PatientLastName}`.trim();
  const doctorName    = `${DoctorFirstName}  ${DoctorLastName}`.trim();
  const date          = new Date(AppointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time          = AppointmentTime;
  const appointmentNo = AppointmentNo;

  const notifBase = {
    hospitalId:    HospitalId,
    patientUserId: PatientUserId,
    doctorUserId:  DoctorUserId,
    date, time, doctorName, appointmentNo,
    token:         TokenNumber,
  };

  try {
    if (type === 'booked') {
      await notifService.notifyBooked(notifBase);
      if (PatientEmail) emailService.sendBookingConfirmedPatient({ to: PatientEmail, patientName, doctorName, date, time, department: DepartmentName, visitType: VisitType, token: TokenNumber, reason: Reason, appointmentNo }).catch(console.error);
      if (DoctorEmail)  emailService.sendBookingConfirmedDoctor ({ to: DoctorEmail,  doctorName,  patientName, date, time, department: DepartmentName, visitType: VisitType, token: TokenNumber, reason: Reason, appointmentNo }).catch(console.error);
    }

    if (type === 'cancelled') {
      await notifService.notifyCancelled({ ...notifBase, cancelReason: CancelReason });
      if (PatientEmail) emailService.sendCancelledPatient({ to: PatientEmail, patientName, doctorName, date, time, cancelReason: CancelReason, appointmentNo }).catch(console.error);
      if (DoctorEmail)  emailService.sendCancelledDoctor ({ to: DoctorEmail,  doctorName,  patientName, date, time, cancelReason: CancelReason, appointmentNo }).catch(console.error);
    }

    if (type === 'rescheduled') {
      const { oldDate, oldTime, newDate, newTime } = extra;
      await notifService.notifyRescheduled({ ...notifBase, oldDate, oldTime, newDate, newTime });
      if (PatientEmail) emailService.sendRescheduledPatient({ to: PatientEmail, patientName, doctorName, oldDate, oldTime, newDate, newTime, appointmentNo }).catch(console.error);
      if (DoctorEmail)  emailService.sendRescheduledDoctor ({ to: DoctorEmail,  doctorName,  patientName, oldDate, oldTime, newDate, newTime, appointmentNo }).catch(console.error);
    }

    if (type === 'completed') {
      await notifService.notifyCompleted(notifBase);
      if (PatientEmail) emailService.sendCompletedPatient({ to: PatientEmail, patientName, doctorName, date, appointmentNo }).catch(console.error);
    }
  } catch (notifErr) {
    console.error('⚠️  Notification/email error:', notifErr.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /appointments — Book new appointment
// ─────────────────────────────────────────────────────────────────────────────
exports.book = async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return sendError(res, errs.array()[0].msg, 422);

  const { doctorId, departmentId, appointmentDate, appointmentTime, visitType, reason, priority, patientId: bodyPatientId } = req.body;
  const { hospitalId, id: userId, role } = req.user;

  try {
    let patientId = bodyPatientId;

    if (role === 'patient') {
      const { getPool } = require('../config/database');
      const pool = await getPool();
      const r = await pool.request()
        .input('UserId', userId)
        .query(`SELECT Id FROM dbo.PatientProfiles WHERE UserId = @UserId AND DeletedAt IS NULL`);
      patientId = r.recordset[0]?.Id;
      if (!patientId) return sendError(res, 'Patient profile not found for this user', 404);
    }

    if (!patientId) return sendError(res, 'patientId is required', 422);

    const result = await apptService.bookAppointment({
      hospitalId, patientId, doctorId, departmentId,
      appointmentDate, appointmentTime,
      visitType:      visitType || 'OPD',
      reason, priority,
      bookedByUserId: userId,
      bookedByRole:   role,
    });

    const appt = await apptService.getAppointmentById(result.id, hospitalId);
    if (appt) fireNotificationsAndEmails('booked', appt);

    return sendSuccess(res, {
      message:       'Appointment booked successfully',
      appointmentId: result.id,
      appointmentNo: result.appointmentNo,
      token:         result.token,
      status:        'Scheduled',
    }, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments — List (admin/doctor/receptionist)
// ─────────────────────────────────────────────────────────────────────────────
exports.list = async (req, res) => {
  const { hospitalId, id: userId, role } = req.user;
  const { status, date, patientId, doctorId, page = 1, limit = 20 } = req.query;

  try {
    let filterDoctorId  = doctorId  ? parseInt(doctorId)  : null;
    let filterPatientId = patientId ? parseInt(patientId) : null;

    if (role === 'doctor') {
      const { getPool } = require('../config/database');
      const pool = await getPool();
      const r = await pool.request()
        .input('UserId', userId)
        .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);
      filterDoctorId = r.recordset[0]?.Id || -1;
    }

    const result = await apptService.listAppointments({
      hospitalId,
      patientId: filterPatientId,
      doctorId:  filterDoctorId,
      status, date,
      page:  parseInt(page),
      limit: parseInt(limit),
    });

    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/my — Logged-in patient or doctor
// ─────────────────────────────────────────────────────────────────────────────
exports.myAppointments = async (req, res) => {
  const { id: userId, role, hospitalId } = req.user;
  try {
    const data = await apptService.getMyAppointments({ userId, role, hospitalId });
    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/:id — Get single appointment
// ─────────────────────────────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const appt = await apptService.getAppointmentById(req.params.id, req.user.hospitalId);
    if (!appt) return sendError(res, 'Appointment not found', 404);
    return sendSuccess(res, appt);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /appointments/:id/status — Update status
// ─────────────────────────────────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return sendError(res, errs.array()[0].msg, 422);

  const { status, cancelReason } = req.body;
  const { id: updatedBy, hospitalId } = req.user;

  try {
    const appt = await apptService.updateAppointmentStatus({
      id: req.params.id, hospitalId, status, cancelReason, updatedBy,
    });

    if (status === 'Cancelled') fireNotificationsAndEmails('cancelled', appt);
    if (status === 'Completed') fireNotificationsAndEmails('completed', appt);
    if (status === 'Confirmed') {
      const full = await apptService.getAppointmentById(req.params.id, hospitalId);
      if (full) fireNotificationsAndEmails('booked', full);
    }

    return sendSuccess(res, { message: `Appointment ${status.toLowerCase()} successfully`, status });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /appointments/:id/cancel — Cancel shorthand
// ─────────────────────────────────────────────────────────────────────────────
exports.cancel = async (req, res) => {
  const { cancelReason } = req.body;
  const { id: updatedBy, hospitalId } = req.user;

  try {
    const appt = await apptService.updateAppointmentStatus({
      id: req.params.id, hospitalId, status: 'Cancelled', cancelReason, updatedBy,
    });
    fireNotificationsAndEmails('cancelled', appt);
    return sendSuccess(res, { message: 'Appointment cancelled' });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /appointments/:id/reschedule
// ─────────────────────────────────────────────────────────────────────────────
exports.reschedule = async (req, res) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return sendError(res, errs.array()[0].msg, 422);

  const { appointmentDate: newDate, appointmentTime: newTime } = req.body;
  const { id: updatedBy, hospitalId } = req.user;

  try {
    const appt = await apptService.rescheduleAppointment({
      id: req.params.id, hospitalId, newDate, newTime, updatedBy,
    });

    fireNotificationsAndEmails('rescheduled', appt, {
      oldDate: new Date(appt.OldDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      oldTime: appt.OldTime,
      newDate: new Date(newDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      newTime,
    });

    return sendSuccess(res, { message: 'Appointment rescheduled', newDate, newTime });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.stats = async (req, res) => {
  try {
    const data = await apptService.getStats(req.user.hospitalId);
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications — User's notifications
// ─────────────────────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  const { id: userId } = req.user;
  const { page = 1, limit = 20 } = req.query;
  try {
    const data   = await notifService.getUserNotifications(userId, parseInt(page), parseInt(limit));
    const unread = await notifService.getUnreadCount(userId);
    return sendSuccess(res, { data, unread });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /notifications/read-all
// ─────────────────────────────────────────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  try {
    await notifService.markAllRead(req.user.id);
    return sendSuccess(res, { message: 'All notifications marked as read' });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /notifications/:id/read
// ─────────────────────────────────────────────────────────────────────────────
exports.markOneRead = async (req, res) => {
  try {
    await notifService.markRead(req.params.id, req.user.id);
    return sendSuccess(res, { message: 'Notification marked as read' });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};