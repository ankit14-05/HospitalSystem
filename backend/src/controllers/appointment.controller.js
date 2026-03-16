// src/controllers/appointment.controller.js
// HTTP layer — calls service, fires emails + notifications asynchronously

const { validationResult } = require('express-validator');
const apptService  = require('../services/appointment.service');
const notifService = require('../services/notificationService');
const emailService = require('../services/appointmentEmailservice');

// ── Import apiResponse safely ─────────────────────────────────────────────────
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
        .input('UserId', parseInt(userId))
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

    const result = await pool.request()
      .input('DoctorId',  doctorProfileId)
      .input('QueueDate', queueDate)
      .query(`
        SELECT
          q.Id, q.TokenNumber, q.QueueStatus, q.Priority,
          q.PatientName, q.Notes, q.CalledAt, q.ServedAt,
          q.WaitMinutes, q.CreatedAt,
          pp.FirstName + ' ' + pp.LastName AS PatientFullName,
          pp.UHID, pp.Phone AS PatientPhone,
          pp.BloodGroup, pp.Gender,
          a.AppointmentNo, a.Reason, a.VisitType
        FROM dbo.OpdQueue q
        LEFT JOIN dbo.PatientProfiles pp ON pp.Id = q.PatientId
        LEFT JOIN dbo.Appointments    a  ON a.Id  = q.AppointmentId
        WHERE q.DoctorId  = @DoctorId
          AND q.QueueDate = @QueueDate
        ORDER BY q.TokenNumber ASC
      `);

    return sendSuccess(res, { data: result.recordset });
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
          pp.FirstName + ' ' + pp.LastName AS PatientName,
          pp.UHID, pp.Phone AS PatientPhone,
          pp.Gender, pp.DateOfBirth, pp.BloodGroup
        FROM dbo.Appointments a
        JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
        WHERE a.DoctorId = @DoctorId
          AND a.Status   = 'Scheduled'
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
    const { getPool } = require('../config/database');
    const pool = await getPool();
    const id   = parseInt(doctorId);

    // Get doctor availability — DoctorProfiles.Id (not UserId)
    const docResult = await pool.request()
      .input('DoctorId', id)
      .query(`
        SELECT dp.AvailableFrom, dp.AvailableTo, dp.AvailableDays, dp.MaxDailyPatients
        FROM dbo.DoctorProfiles dp
        WHERE dp.Id = @DoctorId
          AND dp.ApprovalStatus = 'approved'
      `);

    if (!docResult.recordset.length) {
      return sendError(res, 'Doctor not found', 404);
    }

    const doc       = docResult.recordset[0];
    const dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayOfWeek = dayNames[new Date(date).getDay()];
    const availDays = doc.AvailableDays
      ? doc.AvailableDays.split(',').map(d => d.trim())
      : [];

    if (availDays.length && !availDays.includes(dayOfWeek)) {
      return res.json({
        success:   true,
        available: false,
        message:   `Doctor is not available on ${dayOfWeek}`,
        slots:     [],
      });
    }

    // Get already booked times for that date
    const bookedResult = await pool.request()
      .input('DoctorId', id)
      .input('Date',     date)
      .query(`
        SELECT AppointmentTime
        FROM dbo.Appointments
        WHERE DoctorId        = @DoctorId
          AND AppointmentDate = @Date
          AND Status NOT IN ('Cancelled', 'NoShow')
      `);

    const bookedTimes = new Set(
      bookedResult.recordset.map(r => r.AppointmentTime?.toString().slice(0, 5))
    );

    // Generate 30-min slots between AvailableFrom → AvailableTo
    const slots = [];
    if (doc.AvailableFrom && doc.AvailableTo) {
      const [fromH, fromM] = doc.AvailableFrom.toString().slice(0, 5).split(':').map(Number);
      const [toH,   toM  ] = doc.AvailableTo.toString().slice(0, 5).split(':').map(Number);

      let h = fromH, m = fromM;
      while (h < toH || (h === toH && m < toM)) {
        const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        slots.push({ time: timeStr, available: !bookedTimes.has(timeStr) });
        m += 30;
        if (m >= 60) { h += 1; m -= 60; }
      }
    }

    return res.json({
      success:        true,
      available:      true,
      date,
      totalSlots:     slots.length,
      availableSlots: slots.filter(s =>  s.available).length,
      bookedSlots:    slots.filter(s => !s.available).length,
      slots,
    });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/:id — Get single appointment
// ─────────────────────────────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 'Invalid appointment ID', 400);

    const appt = await apptService.getAppointmentById(id, req.user.hospitalId);
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
      id: parseInt(req.params.id), hospitalId, status, cancelReason, updatedBy,
    });

    if (status === 'Cancelled') fireNotificationsAndEmails('cancelled', appt);
    if (status === 'Completed') fireNotificationsAndEmails('completed', appt);
    if (status === 'Confirmed') {
      const full = await apptService.getAppointmentById(parseInt(req.params.id), hospitalId);
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
      id: parseInt(req.params.id), hospitalId, status: 'Cancelled', cancelReason, updatedBy,
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
      id: parseInt(req.params.id), hospitalId, newDate, newTime, updatedBy,
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