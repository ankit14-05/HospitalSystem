// src/services/appointment.service.js
// Core appointment business logic — DB queries, token gen, conflict checks

const { getPool: getDb, sql } = require('../config/database');
const AppError = require('../utils/AppError');

// ── Generate appointment number: APT-YYYYMMDD-XXXXX ──────────────────────────
const generateAppointmentNo = () => {
  const d   = new Date();
  const ymd = d.getFullYear().toString()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `APT-${ymd}-${rand}`;
};

// ── Next token number for a doctor on a given date ───────────────────────────
const getNextToken = async (pool, doctorId, date) => {
  const r = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date',     sql.Date,   date)
    .query(`
      SELECT ISNULL(MAX(TokenNumber), 0) + 1 AS NextToken
      FROM dbo.Appointments
      WHERE DoctorId = @DoctorId
        AND AppointmentDate = @Date
        AND Status NOT IN ('Cancelled')
    `);
  return r.recordset[0]?.NextToken || 1;
};

// ── Check for time-slot conflict for the doctor ──────────────────────────────
const checkConflict = async (pool, { doctorId, date, time, excludeId = null }) => {
  const r = await pool.request()
    .input('DoctorId', sql.BigInt,  doctorId)
    .input('Date',     sql.Date,    date)
    .input('Time',     sql.NVarChar, time)
    .input('ExcludeId', sql.BigInt, excludeId)
    .query(`
      SELECT COUNT(*) AS cnt
      FROM dbo.Appointments
      WHERE DoctorId        = @DoctorId
        AND AppointmentDate = @Date
        AND AppointmentTime = @Time
        AND Status NOT IN ('Cancelled', 'NoShow')
        AND (@ExcludeId IS NULL OR Id <> @ExcludeId)
    `);
  return (r.recordset[0]?.cnt || 0) > 0;
};

// ── Fetch full appointment with doctor, patient, dept info ───────────────────
const getAppointmentById = async (id, hospitalId = null) => {
  const pool = await getDb();
  const r = await pool.request()
    .input('Id',         sql.BigInt, id)
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT
        a.Id, a.HospitalId, a.AppointmentNo, a.AppointmentDate, a.AppointmentTime,
        a.EndTime, a.VisitType, a.Status, a.Priority, a.Reason, a.Notes,
        a.TokenNumber, a.CancelReason, a.CancelledAt, a.FollowUpOf,

        -- Patient
        pp.Id         AS PatientId,
        pp.UHID,
        pp.FirstName  AS PatientFirstName,
        pp.LastName   AS PatientLastName,
        pp.Phone      AS PatientPhone,
        up.Email      AS PatientEmail,
        up.Id         AS PatientUserId,

        -- Doctor
        dp.Id         AS DoctorId,
        dp.ConsultationFee,
        dp.ExperienceYears,
        ud.FirstName  AS DoctorFirstName,
        ud.LastName   AS DoctorLastName,
        ud.Email      AS DoctorEmail,
        ud.Id         AS DoctorUserId,

        -- Department
        d.Id          AS DepartmentId,
        d.Name        AS DepartmentName,

        a.CreatedAt, a.UpdatedAt
      FROM dbo.Appointments a
      JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
      LEFT JOIN dbo.Users up      ON up.Id = pp.UserId
      JOIN dbo.DoctorProfiles dp  ON dp.Id = a.DoctorId
      JOIN dbo.Users ud           ON ud.Id = dp.UserId
      LEFT JOIN dbo.Departments d ON d.Id  = a.DepartmentId
      WHERE a.Id = @Id
        AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
    `);
  return r.recordset[0] || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOK APPOINTMENT
// ─────────────────────────────────────────────────────────────────────────────
const bookAppointment = async ({ hospitalId, patientId, doctorId, departmentId, appointmentDate, appointmentTime, visitType = 'OPD', reason, priority = 'Normal', bookedByUserId, bookedByRole }) => {
  const pool = await getDb();

  // 1. Verify doctor exists & belongs to hospital
  const docR = await pool.request()
    .input('DoctorId',   sql.BigInt, doctorId)
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT dp.Id, dp.DepartmentId, dp.MaxDailyPatients, dp.IsAvailable,
             dp.ApprovalStatus, ud.FirstName, ud.LastName, ud.Email, ud.Id AS UserId
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users ud ON ud.Id = dp.UserId
      WHERE dp.Id = @DoctorId AND dp.HospitalId = @HospitalId AND ud.DeletedAt IS NULL
    `);

  const doctor = docR.recordset[0];
  if (!doctor) throw new AppError('Doctor not found in this hospital', 404);
  if (!doctor.IsAvailable)         throw new AppError('Doctor is currently unavailable', 400);
  if (doctor.ApprovalStatus !== 'approved') throw new AppError('Doctor account is not approved yet', 400);

  // 2. Verify patient exists & belongs to hospital
  const patR = await pool.request()
    .input('PatientId',  sql.BigInt, patientId)
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT pp.Id, pp.FirstName, pp.LastName, pp.Phone, pp.UserId,
             u.Email
      FROM dbo.PatientProfiles pp
      LEFT JOIN dbo.Users u ON u.Id = pp.UserId
      WHERE pp.Id = @PatientId AND pp.HospitalId = @HospitalId AND pp.DeletedAt IS NULL
    `);

  const patient = patR.recordset[0];
  if (!patient) throw new AppError('Patient not found in this hospital', 404);

  // 3. Check time conflict
  const conflict = await checkConflict(pool, { doctorId, date: appointmentDate, time: appointmentTime });
  if (conflict) throw new AppError('This time slot is already booked for the doctor', 409);

  // 4. Check daily patient limit
  if (doctor.MaxDailyPatients) {
    const countR = await pool.request()
      .input('DoctorId', sql.BigInt, doctorId)
      .input('Date',     sql.Date,   appointmentDate)
      .query(`
        SELECT COUNT(*) AS cnt FROM dbo.Appointments
        WHERE DoctorId = @DoctorId AND AppointmentDate = @Date
          AND Status NOT IN ('Cancelled','NoShow')
      `);
    if ((countR.recordset[0]?.cnt || 0) >= doctor.MaxDailyPatients) {
      throw new AppError(`Doctor has reached max daily patient limit (${doctor.MaxDailyPatients})`, 400);
    }
  }

  // 5. Get next token
  const token         = await getNextToken(pool, doctorId, appointmentDate);
  const appointmentNo = generateAppointmentNo();
  const deptId        = departmentId || doctor.DepartmentId;

  // 6. Insert appointment
  const insertR = await pool.request()
    .input('HospitalId',      sql.BigInt,   hospitalId)
    .input('PatientId',       sql.BigInt,   patientId)
    .input('DoctorId',        sql.BigInt,   doctorId)
    .input('DepartmentId',    sql.BigInt,   deptId   || null)
    .input('AppointmentNo',   sql.NVarChar, appointmentNo)
    .input('AppointmentDate', sql.Date,     appointmentDate)
    .input('AppointmentTime', sql.NVarChar, appointmentTime)
    .input('VisitType',       sql.NVarChar, visitType)
    .input('Status',          sql.NVarChar, 'Scheduled')
    .input('Priority',        sql.NVarChar, priority)
    .input('Reason',          sql.NVarChar, reason     || null)
    .input('TokenNumber',     sql.SmallInt, token)
    .input('BookedByUserId',  sql.BigInt,   bookedByUserId || null)
    .input('BookedByRole',    sql.NVarChar, bookedByRole   || null)
    .input('CreatedBy',       sql.BigInt,   bookedByUserId || null)
    .query(`
      INSERT INTO dbo.Appointments
        (HospitalId, PatientId, DoctorId, DepartmentId, AppointmentNo, AppointmentDate,
         AppointmentTime, VisitType, Status, Priority, Reason, TokenNumber,
         BookedByUserId, BookedByRole, CreatedBy)
      VALUES
        (@HospitalId, @PatientId, @DoctorId, @DepartmentId, @AppointmentNo, @AppointmentDate,
         @AppointmentTime, @VisitType, @Status, @Priority, @Reason, @TokenNumber,
         @BookedByUserId, @BookedByRole, @CreatedBy);
      SELECT SCOPE_IDENTITY() AS NewId;
    `);

  const newId = insertR.recordset[0]?.NewId;

  return {
    id:            newId,
    appointmentNo,
    token,
    appointmentDate,
    appointmentTime,
    visitType,
    status:        'Scheduled',
    doctor:  { id: doctor.UserId, name: `${doctor.FirstName} ${doctor.LastName}`, email: doctor.Email },
    patient: { id: patient.UserId, name: `${patient.FirstName} ${patient.LastName}`, email: patient.Email, phone: patient.Phone },
    departmentId: deptId,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STATUS (confirm / cancel / complete / no-show)
// ─────────────────────────────────────────────────────────────────────────────
const updateAppointmentStatus = async ({ id, hospitalId, status, cancelReason, updatedBy }) => {
  const pool  = await getDb();
  const appt  = await getAppointmentById(id, hospitalId);
  if (!appt) throw new AppError('Appointment not found', 404);

  // Guard state transitions
  const terminal = ['Cancelled', 'Completed'];
  if (terminal.includes(appt.Status)) {
    throw new AppError(`Cannot update a ${appt.Status} appointment`, 400);
  }

  await pool.request()
    .input('Id',           sql.BigInt,   id)
    .input('Status',       sql.NVarChar, status)
    .input('CancelReason', sql.NVarChar, cancelReason || null)
    .input('CancelledBy',  sql.BigInt,   status === 'Cancelled' ? updatedBy : null)
    .input('CancelledAt',  sql.DateTime2, status === 'Cancelled' ? new Date() : null)
    .input('UpdatedBy',    sql.BigInt,   updatedBy)
    .query(`
      UPDATE dbo.Appointments
      SET Status       = @Status,
          CancelReason = @CancelReason,
          CancelledBy  = @CancelledBy,
          CancelledAt  = @CancelledAt,
          UpdatedBy    = @UpdatedBy,
          UpdatedAt    = SYSUTCDATETIME()
      WHERE Id = @Id
    `);

  return { ...appt, Status: status, CancelReason: cancelReason };
};

// ─────────────────────────────────────────────────────────────────────────────
// RESCHEDULE
// ─────────────────────────────────────────────────────────────────────────────
const rescheduleAppointment = async ({ id, hospitalId, newDate, newTime, updatedBy }) => {
  const pool = await getDb();
  const appt = await getAppointmentById(id, hospitalId);
  if (!appt) throw new AppError('Appointment not found', 404);

  if (['Cancelled', 'Completed'].includes(appt.Status)) {
    throw new AppError(`Cannot reschedule a ${appt.Status} appointment`, 400);
  }

  // Check conflict on new slot
  const conflict = await checkConflict(pool, { doctorId: appt.DoctorId, date: newDate, time: newTime, excludeId: id });
  if (conflict) throw new AppError('New time slot is already booked for this doctor', 409);

  const newToken = await getNextToken(pool, appt.DoctorId, newDate);

  await pool.request()
    .input('Id',          sql.BigInt,  id)
    .input('NewDate',     sql.Date,    newDate)
    .input('NewTime',     sql.NVarChar, newTime)
    .input('NewToken',    sql.SmallInt, newToken)
    .input('UpdatedBy',   sql.BigInt,  updatedBy)
    .query(`
      UPDATE dbo.Appointments
      SET AppointmentDate  = @NewDate,
          AppointmentTime  = @NewTime,
          TokenNumber      = @NewToken,
          Status           = 'Rescheduled',
          FollowUpOf       = Id,
          UpdatedBy        = @UpdatedBy,
          UpdatedAt        = SYSUTCDATETIME()
      WHERE Id = @Id
    `);

  return {
    ...appt,
    OldDate:          appt.AppointmentDate,
    OldTime:          appt.AppointmentTime,
    AppointmentDate:  newDate,
    AppointmentTime:  newTime,
    TokenNumber:      newToken,
    Status:           'Rescheduled',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST — with filters, pagination
// ─────────────────────────────────────────────────────────────────────────────
const listAppointments = async ({ hospitalId, patientId, doctorId, status, date, page = 1, limit = 20 }) => {
  const pool   = await getDb();
  const offset = (page - 1) * limit;

  const r = await pool.request()
    .input('HospitalId', sql.BigInt,   hospitalId)
    .input('PatientId',  sql.BigInt,   patientId  || null)
    .input('DoctorId',   sql.BigInt,   doctorId   || null)
    .input('Status',     sql.NVarChar, status     || null)
    .input('Date',       sql.Date,     date       || null)
    .input('Limit',      sql.Int,      limit)
    .input('Offset',     sql.Int,      offset)
    .query(`
      SELECT
        a.Id, a.AppointmentNo, a.AppointmentDate, a.AppointmentTime,
        a.VisitType, a.Status, a.Priority, a.TokenNumber, a.Reason,
        a.CancelReason, a.CreatedAt,
        pp.Id   AS PatientId,
        pp.UHID, pp.FirstName AS PatientFirstName, pp.LastName AS PatientLastName, pp.Phone AS PatientPhone,
        ud.FirstName AS DoctorFirstName, ud.LastName AS DoctorLastName,
        dp.Id   AS DoctorProfileId,
        dept.Name AS DepartmentName,
        dp.ConsultationFee
      FROM dbo.Appointments a
      JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
      JOIN dbo.DoctorProfiles dp  ON dp.Id = a.DoctorId
      JOIN dbo.Users ud           ON ud.Id = dp.UserId
      LEFT JOIN dbo.Departments dept ON dept.Id = a.DepartmentId
      WHERE a.HospitalId = @HospitalId
        AND (@PatientId IS NULL OR a.PatientId = @PatientId)
        AND (@DoctorId  IS NULL OR a.DoctorId  = @DoctorId)
        AND (@Status    IS NULL OR a.Status    = @Status)
        AND (@Date      IS NULL OR a.AppointmentDate = @Date)
      ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `);

  const countR = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('PatientId',  sql.BigInt, patientId  || null)
    .input('DoctorId',   sql.BigInt, doctorId   || null)
    .input('Status',     sql.NVarChar, status   || null)
    .input('Date',       sql.Date,   date       || null)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.Appointments a
      WHERE a.HospitalId = @HospitalId
        AND (@PatientId IS NULL OR a.PatientId = @PatientId)
        AND (@DoctorId  IS NULL OR a.DoctorId  = @DoctorId)
        AND (@Status    IS NULL OR a.Status    = @Status)
        AND (@Date      IS NULL OR a.AppointmentDate = @Date)
    `);

  return {
    data:  r.recordset,
    total: countR.recordset[0]?.total || 0,
    page,
    limit,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MY APPOINTMENTS (for logged-in patient or doctor)
// ─────────────────────────────────────────────────────────────────────────────
const getMyAppointments = async ({ userId, role, hospitalId }) => {
  const pool = await getDb();

  let profileId = null;

  if (role === 'patient') {
    const r = await pool.request()
      .input('UserId', sql.BigInt, userId)
      .query(`SELECT Id FROM dbo.PatientProfiles WHERE UserId = @UserId AND DeletedAt IS NULL`);
    profileId = r.recordset[0]?.Id;
    if (!profileId) return [];
  } else if (role === 'doctor') {
    const r = await pool.request()
      .input('UserId', sql.BigInt, userId)
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);
    profileId = r.recordset[0]?.Id;
    if (!profileId) return [];
  }

  const { data } = await listAppointments({
    hospitalId,
    patientId: role === 'patient' ? profileId : null,
    doctorId:  role === 'doctor'  ? profileId : null,
  });

  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────────────────────
const getStats = async (hospitalId) => {
  const pool = await getDb();
  const today = new Date().toISOString().split('T')[0];

  const r = await pool.request()
    .input('HospitalId', sql.BigInt,  hospitalId)
    .input('Today',      sql.Date,    today)
    .query(`
      SELECT
        COUNT(*)                                                                              AS Total,
        SUM(CASE WHEN Status = 'Scheduled'  THEN 1 ELSE 0 END)                               AS Scheduled,
        SUM(CASE WHEN Status = 'Confirmed'  THEN 1 ELSE 0 END)                               AS Confirmed,
        SUM(CASE WHEN Status = 'Completed'  THEN 1 ELSE 0 END)                               AS Completed,
        SUM(CASE WHEN Status = 'Cancelled'  THEN 1 ELSE 0 END)                               AS Cancelled,
        SUM(CASE WHEN Status = 'NoShow'     THEN 1 ELSE 0 END)                               AS NoShow,
        SUM(CASE WHEN AppointmentDate = @Today AND Status NOT IN ('Cancelled') THEN 1 ELSE 0 END) AS TodayTotal
      FROM dbo.Appointments
      WHERE HospitalId = @HospitalId
    `);

  return r.recordset[0];
};

module.exports = {
  bookAppointment,
  getAppointmentById,
  updateAppointmentStatus,
  rescheduleAppointment,
  listAppointments,
  getMyAppointments,
  getStats,
};