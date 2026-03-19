// src/controllers/appointment.controller.js
// HTTP layer — calls service, fires emails + notifications asynchronously

const { validationResult } = require('express-validator');
const apptService  = require('../services/appointment.service');
const notifService = require('../services/notificationService');
const emailService = require('../services/appointmentEmailservice');
const AppError = require('../utils/AppError');
const { APPOINTMENT_DESK_ROLES } = require('../constants/roles');

// ── Import apiResponse safely ─────────────────────────────────────────────────
const apiResponse = require('../utils/apiResponse');
const sendSuccess = typeof apiResponse.success === 'function'
  ? apiResponse.success
  : (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const sendError = typeof apiResponse.error === 'function'
  ? apiResponse.error
  : (res, message, status = 500) => res.status(status).json({ success: false, message });

const STAFF_APPOINTMENT_ROLES = new Set(APPOINTMENT_DESK_ROLES);

const resolveDoctorProfileIdByUser = async (userId) => {
  const { getPool } = require('../config/database');
  const pool = await getPool();
  const result = await pool.request()
    .input('UserId', parseInt(userId, 10))
    .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

  return result.recordset[0]?.Id || null;
};

const assertAppointmentAccess = async (req, appointmentId) => {
  if (Number.isNaN(appointmentId)) {
    throw new AppError('Invalid appointment ID', 400);
  }

  const appt = await apptService.getAppointmentById(appointmentId, req.user.hospitalId);
  if (!appt) {
    throw new AppError('Appointment not found', 404);
  }

  const { role, id: userId } = req.user;

  if (STAFF_APPOINTMENT_ROLES.has(role)) {
    return appt;
  }

  if (role === 'doctor') {
    if (appt.DoctorUserId !== userId) {
      throw new AppError('Access denied to this appointment', 403);
    }
    return appt;
  }

  if (role === 'patient') {
    if (appt.PatientUserId !== userId) {
      throw new AppError('Access denied to this appointment', 403);
    }
    return appt;
  }

  throw new AppError('Access denied to this appointment', 403);
};

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
      if (PatientEmail) {
        emailService.sendTokenConfirmation({
          to: PatientEmail, patientName, doctorName, date, time,
          token: TokenNumber, appointmentNo,
          specialization: appt.DoctorSpecialization || appt.Specialization,
          department: DepartmentName, visitType: VisitType,
          reason: Reason, fee: appt.ConsultationFee,
        }).catch(console.error);
      }
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
    if (type === 'missed') {
      await notifService.notifyMissed(notifBase);
      if (PatientEmail) {
        emailService.sendMissedPatient({
          to: PatientEmail,
          patientName,
          doctorName,
          date,
          time,
          appointmentNo,
        }).catch(console.error);
      }
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
        .input('UserId', parseInt(userId))
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

    return sendSuccess(
      res,
      {
        appointmentId: result.id,
        appointmentNo: result.appointmentNo,
        token: result.token,
        status: result.status || 'Scheduled',
      },
      'Appointment booked successfully',
      201,
    );
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments — List (admin/doctor/receptionist)
// ─────────────────────────────────────────────────────────────────────────────
exports.list = async (req, res) => {
  const { hospitalId, id: userId, role } = req.user;
  const {
    status,
    date,
    patientId,
    doctorId,
    departmentId,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  try {
    let filterDoctorId  = doctorId  ? parseInt(doctorId)  : null;
    let filterPatientId = patientId ? parseInt(patientId) : null;

    if (role === 'doctor') {
      filterDoctorId = await resolveDoctorProfileIdByUser(userId);
    }

    const result = await apptService.listAppointments({
      hospitalId,
      patientId: filterPatientId,
      doctorId:  filterDoctorId,
      departmentId: departmentId ? parseInt(departmentId, 10) : null,
      status,
      date,
      search,
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
// GET /appointments/my-queue?date=YYYY-MM-DD
// Doctor's OPD queue for a given day
// ─────────────────────────────────────────────────────────────────────────────
exports.myQueue = async (req, res) => {
  const { id: userId } = req.user;
  const queueDate = req.query.date || new Date().toISOString().slice(0, 10);

  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();

    // Resolve UserId → DoctorProfiles.Id
    const docRes = await pool.request()
      .input('UserId', parseInt(userId))
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      return sendError(res, 'Doctor profile not found', 404);
    }
    const doctorProfileId = docRes.recordset[0].Id;

    const queueResult = await pool.request()
      .input('DoctorId',  doctorProfileId)
      .input('QueueDate', queueDate)
      .query(`
        SELECT
          q.Id, q.TokenNumber, q.QueueStatus AS Status, q.Priority,
          q.PatientName, q.Notes, q.CalledAt, q.ServedAt,
          q.WaitMinutes, q.CreatedAt, q.PatientId,
          pp.FirstName + ' ' + pp.LastName AS PatientFullName,
          pp.FirstName, pp.LastName,
          pp.UHID, pp.Phone AS PatientPhone,
          pp.BloodGroup, pp.Gender, pp.DateOfBirth,
          DATEDIFF(YEAR, pp.DateOfBirth, GETDATE()) AS Age,
          a.Id AS AppointmentId, a.AppointmentNo, a.Reason, a.VisitType,
          CONVERT(VARCHAR(8), a.AppointmentTime, 108) AS AppointmentTime,
          (
            SELECT COUNT(*)
            FROM dbo.Prescriptions rx
            WHERE rx.AppointmentId = a.Id
          ) AS PrescriptionCount,
          (
            SELECT TOP 1 rx.Id
            FROM dbo.Prescriptions rx
            WHERE rx.AppointmentId = a.Id
            ORDER BY rx.CreatedAt DESC, rx.Id DESC
          ) AS LatestPrescriptionId,
          (
            SELECT COUNT(*)
            FROM dbo.LabOrders lo
            WHERE lo.AppointmentId = a.Id
          ) AS LabOrderCount,
          (
            SELECT TOP 1 lo.Id
            FROM dbo.LabOrders lo
            WHERE lo.AppointmentId = a.Id
            ORDER BY lo.CreatedAt DESC, lo.Id DESC
          ) AS LatestLabOrderId
        FROM dbo.OpdQueue q
        LEFT JOIN dbo.PatientProfiles pp ON pp.Id = q.PatientId
        LEFT JOIN dbo.Appointments    a  ON a.Id  = q.AppointmentId
        WHERE q.DoctorId  = @DoctorId
          AND q.QueueDate = @QueueDate
        ORDER BY q.TokenNumber ASC
      `);

    // If OpdQueue is empty, fall back to today's scheduled appointments
    let rows = queueResult.recordset;
    if (!rows.length) {
      const apptResult = await pool.request()
        .input('DoctorId', doctorProfileId)
        .input('Date',     queueDate)
        .query(`
          SELECT
            a.Id, a.TokenNumber, a.Status AS QueueStatus, a.Status,
            a.Priority, a.Reason, a.VisitType,
            CONVERT(VARCHAR(8), a.AppointmentTime, 108) AS AppointmentTime,
            a.Id AS AppointmentId, a.AppointmentNo, a.Notes,
            (
              SELECT COUNT(*)
              FROM dbo.Prescriptions rx
              WHERE rx.AppointmentId = a.Id
            ) AS PrescriptionCount,
            (
              SELECT TOP 1 rx.Id
              FROM dbo.Prescriptions rx
              WHERE rx.AppointmentId = a.Id
              ORDER BY rx.CreatedAt DESC, rx.Id DESC
            ) AS LatestPrescriptionId,
            (
              SELECT COUNT(*)
              FROM dbo.LabOrders lo
              WHERE lo.AppointmentId = a.Id
            ) AS LabOrderCount,
            (
              SELECT TOP 1 lo.Id
              FROM dbo.LabOrders lo
              WHERE lo.AppointmentId = a.Id
              ORDER BY lo.CreatedAt DESC, lo.Id DESC
            ) AS LatestLabOrderId,
            pp.Id AS PatientId,
            pp.FirstName + ' ' + pp.LastName AS PatientName,
            pp.FirstName + ' ' + pp.LastName AS PatientFullName,
            pp.FirstName, pp.LastName,
            pp.UHID, pp.Phone AS PatientPhone,
            pp.BloodGroup, pp.Gender, pp.DateOfBirth,
            DATEDIFF(YEAR, pp.DateOfBirth, GETDATE()) AS Age
          FROM dbo.Appointments a
          JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
          WHERE a.DoctorId        = @DoctorId
            AND a.AppointmentDate = @Date
            AND a.Status NOT IN ('Cancelled', 'NoShow')
          ORDER BY a.AppointmentTime ASC
        `);
      rows = apptResult.recordset;
    }

    return sendSuccess(res, { data: rows });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/pending-requests
// Doctor's upcoming scheduled appointments (pending action)
// ─────────────────────────────────────────────────────────────────────────────
exports.pendingRequests = async (req, res) => {
  const { id: userId } = req.user;

  try {
    const { getPool } = require('../config/database');
    const pool = await getPool();

    const docRes = await pool.request()
      .input('UserId', parseInt(userId))
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      return sendError(res, 'Doctor profile not found', 404);
    }
    const doctorProfileId = docRes.recordset[0].Id;

    const result = await pool.request()
      .input('DoctorId', doctorProfileId)
      .query(`
        SELECT
          a.Id, a.AppointmentNo, a.AppointmentDate, a.AppointmentTime,
          a.VisitType, a.Status, a.Priority, a.Reason, a.CreatedAt,
          (
            SELECT COUNT(*)
            FROM dbo.Prescriptions rx
            WHERE rx.AppointmentId = a.Id
          ) AS PrescriptionCount,
          (
            SELECT TOP 1 rx.Id
            FROM dbo.Prescriptions rx
            WHERE rx.AppointmentId = a.Id
            ORDER BY rx.CreatedAt DESC, rx.Id DESC
          ) AS LatestPrescriptionId,
          (
            SELECT COUNT(*)
            FROM dbo.LabOrders lo
            WHERE lo.AppointmentId = a.Id
          ) AS LabOrderCount,
          (
            SELECT TOP 1 lo.Id
            FROM dbo.LabOrders lo
            WHERE lo.AppointmentId = a.Id
            ORDER BY lo.CreatedAt DESC, lo.Id DESC
          ) AS LatestLabOrderId,
          pp.Id   AS PatientId,
          pp.FirstName + ' ' + pp.LastName AS PatientName,
          pp.UHID, pp.Phone AS PatientPhone,
          pp.Gender, pp.DateOfBirth, pp.BloodGroup
        FROM dbo.Appointments a
        JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
        WHERE a.DoctorId = @DoctorId
          AND a.Status IN ('Scheduled', 'Confirmed', 'Rescheduled')
          AND a.AppointmentDate >= CAST(GETDATE() AS DATE)
        ORDER BY a.AppointmentDate ASC, a.AppointmentTime ASC
      `);

    return sendSuccess(res, { data: result.recordset });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/slots?doctorId=X&date=YYYY-MM-DD
// Available time slots for a doctor on a given date
// ─────────────────────────────────────────────────────────────────────────────
exports.getSlots = async (req, res) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return sendError(res, 'doctorId and date query params are required', 400);
  }

  try {
    const hospitalId = req.user?.hospitalId || req.headers['x-hospital-id'] || req.query.hospitalId || null;
    const result = await apptService.getDoctorSlots({
      doctorId: parseInt(doctorId, 10),
      date,
      hospitalId,
      includeUnavailable: true,
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

exports.filters = async (req, res) => {
  try {
    let doctorId = null;

    if (req.user.role === 'doctor') {
      doctorId = await resolveDoctorProfileIdByUser(req.user.id);
    }

    const data = await apptService.getAppointmentFilters({
      hospitalId: req.user.hospitalId,
      doctorId,
    });

    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/:id — Get single appointment
// ─────────────────────────────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const appt = await assertAppointmentAccess(req, id);
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
  const appointmentId = parseInt(req.params.id, 10);

  try {
    await assertAppointmentAccess(req, appointmentId);

    const appt = await apptService.updateAppointmentStatus({
      id: appointmentId, hospitalId, status, cancelReason, updatedBy,
    });

    if (status === 'Cancelled') fireNotificationsAndEmails('cancelled', appt);
    if (status === 'Completed') fireNotificationsAndEmails('completed', appt);
    if (status === 'NoShow') fireNotificationsAndEmails('missed', appt);
    if (status === 'Confirmed') {
      const full = await apptService.getAppointmentById(appointmentId, hospitalId);
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
  const appointmentId = parseInt(req.params.id, 10);

  try {
    await assertAppointmentAccess(req, appointmentId);

    const appt = await apptService.updateAppointmentStatus({
      id: appointmentId, hospitalId, status: 'Cancelled', cancelReason, updatedBy,
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
  const appointmentId = parseInt(req.params.id, 10);

  try {
    await assertAppointmentAccess(req, appointmentId);

    const appt = await apptService.rescheduleAppointment({
      id: appointmentId, hospitalId, newDate, newTime, updatedBy,
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
    let doctorId = null;

    if (req.user.role === 'doctor') {
      const { getPool } = require('../config/database');
      const pool = await getPool();
      const r = await pool.request()
        .input('UserId', parseInt(req.user.id, 10))
        .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);
      doctorId = r.recordset[0]?.Id || null;
    }

    const data = await apptService.getStats(req.user.hospitalId, { doctorId });
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /appointments/:id/complete — Doctor completes appointment with notes
// ─────────────────────────────────────────────────────────────────────────────
exports.callIn = async (req, res) => {
  const appointmentId = parseInt(req.params.id, 10);

  try {
    const appt = await assertAppointmentAccess(req, appointmentId);
    const { getPool, sql } = require('../config/database');
    const pool = await getPool();

    await pool.request()
      .input('HospitalId', sql.BigInt, appt.HospitalId)
      .input('DoctorId', sql.BigInt, appt.DoctorId)
      .input('AppointmentId', sql.BigInt, appt.Id)
      .input('QueueDate', sql.Date, appt.AppointmentDate)
      .input('TokenNumber', sql.SmallInt, appt.TokenNumber || 0)
      .input('PatientId', sql.BigInt, appt.PatientId)
      .input('PatientName', sql.NVarChar, `${appt.PatientFirstName || ''} ${appt.PatientLastName || ''}`.trim())
      .input('Priority', sql.NVarChar, appt.Priority || 'Normal')
      .input('Notes', sql.NVarChar, appt.Reason || appt.Notes || null)
      .query(`
        UPDATE dbo.OpdQueue
        SET QueueStatus = 'serving',
            CalledAt = COALESCE(CalledAt, SYSUTCDATETIME()),
            WaitMinutes = CASE
              WHEN CreatedAt IS NULL THEN WaitMinutes
              ELSE DATEDIFF(MINUTE, CreatedAt, SYSUTCDATETIME())
            END,
            UpdatedAt = SYSUTCDATETIME()
        WHERE AppointmentId = @AppointmentId
          AND HospitalId = @HospitalId;

        IF @@ROWCOUNT = 0
        BEGIN
          INSERT INTO dbo.OpdQueue
            (HospitalId, DoctorId, AppointmentId, QueueDate, TokenNumber, PatientId, PatientName, QueueStatus, CalledAt, WaitMinutes, Priority, Notes, CreatedAt, UpdatedAt)
          VALUES
            (@HospitalId, @DoctorId, @AppointmentId, @QueueDate, @TokenNumber, @PatientId, @PatientName, 'serving', SYSUTCDATETIME(), 0, @Priority, @Notes, SYSUTCDATETIME(), SYSUTCDATETIME());
        END
      `);

    return sendSuccess(res, { message: 'Patient called in successfully' });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

const getAppointmentColumnSet = async (pool) => {
  const result = await pool.request().query(`
    SELECT name
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Appointments')
      AND name IN ('PrimaryDiagnosis', 'FollowUpDate', 'FollowUpNotes')
  `);

  return new Set(result.recordset.map((row) => row.name));
};

const hasAppointmentConsultationTable = async (pool) => {
  const result = await pool.request().query(`
    SELECT OBJECT_ID('dbo.AppointmentConsultations', 'U') AS TableId
  `);

  return Boolean(result.recordset[0]?.TableId);
};

const buildCompletionNotes = ({
  existingNotes,
  consultationNotes,
  diagnosis,
  followUpDate,
  followUpNotes,
  hasPrimaryDiagnosis,
  hasFollowUpDate,
  hasFollowUpNotes,
  hasConsultationTable,
}) => {
  const sections = [];
  const addSection = (value) => {
    const text = String(value || '').trim();
    if (text && !sections.includes(text)) {
      sections.push(text);
    }
  };

  addSection(existingNotes);
  addSection(consultationNotes);

  if (!hasPrimaryDiagnosis && !hasConsultationTable) {
    addSection(diagnosis ? `Diagnosis: ${diagnosis}` : '');
  }

  if ((!hasFollowUpDate || !hasFollowUpNotes) && !hasConsultationTable && (followUpDate || followUpNotes)) {
    const followUpSummary = [
      followUpDate ? `Date: ${followUpDate}` : null,
      followUpNotes ? `Notes: ${String(followUpNotes).trim()}` : null,
    ].filter(Boolean).join(' | ');

    addSection(followUpSummary ? `Follow-up: ${followUpSummary}` : '');
  }

  return sections.join('\n\n') || null;
};

exports.completeAppointment = async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    const { hospitalId, role } = req.user;
    const {
      consultationNotes,  // doctor's notes
      diagnosis,          // primary diagnosis
      followUpDate,       // optional follow-up
      followUpNotes,      // follow-up instructions
      vitals,             // { bp, heartRate, temp, weight, spo2 }
    } = req.body;

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const appointment = await assertAppointmentAccess(req, appointmentId);
    const appointmentColumns = await getAppointmentColumnSet(pool);
    const hasConsultationTable = await hasAppointmentConsultationTable(pool);
    const hasPrimaryDiagnosis = appointmentColumns.has('PrimaryDiagnosis');
    const hasFollowUpDate = appointmentColumns.has('FollowUpDate');
    const hasFollowUpNotes = appointmentColumns.has('FollowUpNotes');
    const mergedNotes = buildCompletionNotes({
      existingNotes: appointment.Notes,
      consultationNotes,
      diagnosis,
      followUpDate,
      followUpNotes,
      hasPrimaryDiagnosis,
      hasFollowUpDate,
      hasFollowUpNotes,
      hasConsultationTable,
    });

    const setClauses = [
      `Status = 'Completed'`,
      'Notes = @Notes',
      'UpdatedAt = GETUTCDATE()',
    ];

    if (hasPrimaryDiagnosis) {
      setClauses.push('PrimaryDiagnosis = @PrimaryDiagnosis');
    }
    if (hasFollowUpDate) {
      setClauses.push('FollowUpDate = @FollowUpDate');
    }
    if (hasFollowUpNotes) {
      setClauses.push('FollowUpNotes = @FollowUpNotes');
    }

    const updateRequest = pool.request()
      .input('Id', sql.BigInt, appointmentId)
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('Notes', sql.NVarChar(sql.MAX), mergedNotes)
      .input('PrimaryDiagnosis', sql.NVarChar(sql.MAX), diagnosis || null)
      .input('FollowUpDate', sql.Date, followUpDate || null)
      .input('FollowUpNotes', sql.NVarChar(sql.MAX), followUpNotes || null);

    const whereClauses = ['Id = @Id', 'HospitalId = @HospitalId'];
    if (role === 'doctor') {
      updateRequest.input('DoctorId', sql.BigInt, appointment.DoctorId);
      whereClauses.push('DoctorId = @DoctorId');
    }

    const r = await updateRequest.query(`
      UPDATE dbo.Appointments
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.Id, INSERTED.AppointmentNo, INSERTED.Status,
             INSERTED.PatientId, INSERTED.DoctorId, INSERTED.HospitalId,
             INSERTED.AppointmentDate, INSERTED.AppointmentTime, INSERTED.TokenNumber
      WHERE ${whereClauses.join(' AND ')}
    `);

    if (!r.recordset.length) return sendError(res, 'Appointment not found or unauthorized', 404);

    const appt = r.recordset[0];

    if (hasConsultationTable) {
      const vitalsJson = vitals && typeof vitals === 'object' && Object.keys(vitals).length
        ? JSON.stringify(vitals)
        : null;

      await pool.request()
        .input('AppointmentId', sql.BigInt, appt.Id)
        .input('HospitalId', sql.BigInt, appt.HospitalId)
        .input('PatientId', sql.BigInt, appt.PatientId)
        .input('DoctorId', sql.BigInt, appt.DoctorId)
        .input('PrimaryDiagnosis', sql.NVarChar(sql.MAX), diagnosis || null)
        .input('ConsultationNotes', sql.NVarChar(sql.MAX), consultationNotes || null)
        .input('FollowUpDate', sql.Date, followUpDate || null)
        .input('FollowUpNotes', sql.NVarChar(sql.MAX), followUpNotes || null)
        .input('VitalsJson', sql.NVarChar(sql.MAX), vitalsJson)
        .input('UpdatedBy', sql.BigInt, req.user.id)
        .query(`
          IF EXISTS (SELECT 1 FROM dbo.AppointmentConsultations WHERE AppointmentId = @AppointmentId)
          BEGIN
            UPDATE dbo.AppointmentConsultations
            SET PrimaryDiagnosis = @PrimaryDiagnosis,
                ConsultationNotes = @ConsultationNotes,
                FollowUpDate = @FollowUpDate,
                FollowUpNotes = @FollowUpNotes,
                VitalsJson = @VitalsJson,
                CompletedAt = SYSUTCDATETIME(),
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UpdatedBy
            WHERE AppointmentId = @AppointmentId
          END
          ELSE
          BEGIN
            INSERT INTO dbo.AppointmentConsultations
              (HospitalId, AppointmentId, PatientId, DoctorId, PrimaryDiagnosis, ConsultationNotes, FollowUpDate, FollowUpNotes, VitalsJson, CompletedAt, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy)
            VALUES
              (@HospitalId, @AppointmentId, @PatientId, @DoctorId, @PrimaryDiagnosis, @ConsultationNotes, @FollowUpDate, @FollowUpNotes, @VitalsJson, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME(), @UpdatedBy, @UpdatedBy)
          END
        `);
    }

    await pool.request()
      .input('HospitalId', appt.HospitalId)
      .input('DoctorId', appt.DoctorId)
      .input('Date', appt.AppointmentDate)
      .input('Time', String(appt.AppointmentTime || '').slice(0, 5))
      .input('AppointmentId', appt.Id)
      .input('TokenNumber', appt.TokenNumber)
      .query(`
        UPDATE dbo.AppointmentSlots
        SET AppointmentId = @AppointmentId,
            TokenNumber = @TokenNumber,
            Status = 'Completed',
            UpdatedAt = SYSUTCDATETIME()
        WHERE DoctorId = @DoctorId
          AND SlotDate = @Date
          AND CONVERT(VARCHAR(5), StartTime, 108) = @Time
          AND HospitalId = @HospitalId
      `);

    await pool.request()
      .input('AppointmentId', appt.Id)
      .input('HospitalId', appt.HospitalId)
      .query(`
        UPDATE dbo.OpdQueue
        SET QueueStatus = 'served',
            ServedAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME()
        WHERE AppointmentId = @AppointmentId
          AND HospitalId = @HospitalId
          AND QueueStatus IN ('waiting', 'called', 'serving')
      `);

    // If follow-up date provided, create a follow-up appointment record note
    // (Actual booking done by receptionist — we just add to notes)

    // Fetch full appt for notifications
    const full = await apptService.getAppointmentById(appointmentId, hospitalId);
    if (full) fireNotificationsAndEmails('completed', full);

    return sendSuccess(res, {
      appointmentId:  appt.Id,
      appointmentNo:  appt.AppointmentNo,
      status:         'Completed',
      followUpDate:   followUpDate || null,
      followUpNotes:  followUpNotes || null,
    }, 'Appointment completed successfully');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /appointments/send-doctor-schedule — Send Doctor Daily Schedule Email
// ─────────────────────────────────────────────────────────────────────────────
exports.sendDailyScheduleEmail = async (req, res) => {
  try {
    const { doctorId, date } = req.body;
    if (!doctorId || !date) return sendError(res, 'doctorId and date are required', 400);

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();

    // 1. Get Doctor Profile
    const docRes = await pool.request()
      .input('DoctorId', parseInt(doctorId))
      .query(`
        SELECT
          dp.Id,
          dp.UserId,
          dp.HospitalId,
          u.FirstName,
          u.LastName,
          u.Email
        FROM dbo.DoctorProfiles dp
        JOIN dbo.Users u ON u.Id = dp.UserId
        WHERE dp.Id = @DoctorId
      `);
    
    if (!docRes.recordset.length) return sendError(res, 'Doctor not found', 404);
    const doctor = docRes.recordset[0];
    if (!doctor.Email) return sendError(res, 'Doctor does not have an email address configured.', 400);

    // 2. Get Appointments for the given date
    const apptsRes = await pool.request()
      .input('DoctorId', parseInt(doctorId))
      .input('Date', date)
      .query(`
        SELECT a.AppointmentTime, a.VisitType, a.TokenNumber, 
               pp.FirstName + ' ' + pp.LastName AS PatientName
        FROM dbo.Appointments a
        LEFT JOIN dbo.PatientProfiles pp ON a.PatientId = pp.Id
        WHERE a.DoctorId = @DoctorId 
          AND a.AppointmentDate = @Date
          AND a.Status NOT IN ('Cancelled', 'NoShow')
        ORDER BY a.AppointmentTime ASC
      `);

    const doctorName = `${doctor.FirstName} ${doctor.LastName}`.trim();
    
    // 3. Send Email
    await emailService.sendDoctorDailyScheduleEmail({
      to: doctor.Email,
      doctorName,
      date,
      appointments: apptsRes.recordset,
    });

    await notifService.createNotification({
      hospitalId: doctor.HospitalId || req.user.hospitalId,
      userId: doctor.UserId || null,
      notifType: 'reminder',
      title: 'Daily OPD schedule emailed',
      body: `Your schedule for ${date} has been shared by the OPD desk.`,
      link: '/doctor/schedule',
      dataJson: {
        doctorId: doctor.Id,
        date,
        totalAppointments: apptsRes.recordset.length,
      },
    });

    return sendSuccess(res, { message: `Schedule email sent to Dr. ${doctor.LastName}` });
  } catch (err) {
    console.error('Error sending schedule email:', err);
    return sendError(res, 'Failed to send schedule email', 500);
  }
};
