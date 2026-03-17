// src/services/appointment.service.js
// Core appointment business logic — DB queries, token gen, conflict checks

const { getPool: getDb, sql } = require('../config/database');
const AppError = require('../utils/AppError');

const OPEN_SLOT_STATUSES = new Set(['', 'available', 'open', 'free', 'unbooked']);

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

const normalizeTime = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const match = value.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : value.slice(0, 5);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }
  const text = String(value);
  const match = text.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : text.slice(0, 5);
};

const normalizeDateValue = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text.slice(0, 10);
};

const toMinutes = (value) => {
  const time = normalizeTime(value);
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const isPastSlotTime = (date, time, now = new Date()) => {
  const slotDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(slotDate.getTime())) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (slotDate < today) return true;
  if (slotDate > today) return false;

  return toMinutes(time) <= (now.getHours() * 60) + now.getMinutes();
};

const resolveHospitalId = (hospitalId) => {
  const parsed = parseInt(hospitalId, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getDoctorProfile = async (pool, { doctorId, hospitalId = null }) => {
  const resolvedHospitalId = resolveHospitalId(hospitalId);
  const request = pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('HospitalId', sql.BigInt, resolvedHospitalId);

  const result = await request.query(`
    SELECT TOP 1
      dp.Id,
      dp.HospitalId,
      dp.DepartmentId,
      dp.MaxDailyPatients,
      dp.IsAvailable,
      dp.ApprovalStatus,
      dp.AvailableDays,
      CONVERT(VARCHAR(8), dp.AvailableFrom, 108) AS AvailableFrom,
      CONVERT(VARCHAR(8), dp.AvailableTo,   108) AS AvailableTo,
      ud.FirstName,
      ud.LastName,
      ud.Email,
      ud.Id AS UserId
    FROM dbo.DoctorProfiles dp
    JOIN dbo.Users ud ON ud.Id = dp.UserId
    WHERE (dp.Id = @DoctorId OR ud.Id = @DoctorId)
      AND ud.DeletedAt IS NULL
      AND (@HospitalId IS NULL OR dp.HospitalId = @HospitalId OR ud.HospitalId = @HospitalId)
    ORDER BY CASE WHEN dp.Id = @DoctorId THEN 0 ELSE 1 END
  `);

  return result.recordset[0] || null;
};

const getBookedAppointmentsByTime = async (pool, { doctorId, date, excludeAppointmentId = null }) => {
  const result = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date', sql.Date, date)
    .input('ExcludeAppointmentId', sql.BigInt, excludeAppointmentId)
    .query(`
      SELECT Id, AppointmentTime, Status
      FROM dbo.Appointments
      WHERE DoctorId        = @DoctorId
        AND AppointmentDate = @Date
        AND Status NOT IN ('Cancelled', 'NoShow')
        AND (@ExcludeAppointmentId IS NULL OR Id <> @ExcludeAppointmentId)
    `);

  return new Map(
    result.recordset.map((row) => [normalizeTime(row.AppointmentTime), row])
  );
};

const getPatientConflictAtTime = async (pool, { patientId, date, time, excludeAppointmentId = null }) => {
  const normalizedTime = normalizeTime(time);
  if (!normalizedTime) return null;

  const result = await pool.request()
    .input('PatientId', sql.BigInt, patientId)
    .input('Date', sql.Date, date)
    .input('Time', sql.NVarChar, normalizedTime)
    .input('ExcludeAppointmentId', sql.BigInt, excludeAppointmentId)
    .query(`
      SELECT TOP 1
        Id,
        DoctorId,
        Status
      FROM dbo.Appointments
      WHERE PatientId = @PatientId
        AND AppointmentDate = @Date
        AND COALESCE(
          LEFT(CONVERT(VARCHAR(8), TRY_CONVERT(time, AppointmentTime), 108), 5),
          LEFT(CONVERT(VARCHAR(16), AppointmentTime), 5)
        ) = @Time
        AND Status NOT IN ('Cancelled', 'NoShow', 'Completed')
        AND (@ExcludeAppointmentId IS NULL OR Id <> @ExcludeAppointmentId)
    `);

  return result.recordset[0] || null;
};

const syncGeneratedSlotRow = async (pool, {
  hospitalId = null,
  doctorId,
  date,
  time,
  appointmentId = null,
  tokenNumber = null,
  status = null,
}) => {
  const normalizedTime = normalizeTime(time);
  if (!doctorId || !date || !normalizedTime) return;

  await pool.request()
    .input('HospitalId', sql.BigInt, resolveHospitalId(hospitalId))
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date', sql.Date, normalizeDateValue(date))
    .input('Time', sql.NVarChar, normalizedTime)
    .input('AppointmentId', sql.BigInt, appointmentId)
    .input('TokenNumber', sql.SmallInt, tokenNumber)
    .input('Status', sql.NVarChar, status)
    .query(`
      UPDATE dbo.AppointmentSlots
      SET AppointmentId = @AppointmentId,
          TokenNumber = @TokenNumber,
          Status = COALESCE(@Status, Status),
          UpdatedAt = SYSUTCDATETIME()
      WHERE DoctorId = @DoctorId
        AND SlotDate = @Date
        AND CONVERT(VARCHAR(5), StartTime, 108) = @Time
        AND (@HospitalId IS NULL OR HospitalId = @HospitalId)
    `);
};

const buildDerivedSlots = (segments, { date, bookedAppointmentsByTime }) => {
  const slots = [];

  for (const segment of segments) {
    let current = toMinutes(segment.startTime);
    const end = toMinutes(segment.endTime);
    const duration = Number(segment.slotDurationMins) || 30;

    if (!current || !end || duration <= 0 || end <= current) continue;

    while (current < end) {
      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const bookedAppointment = bookedAppointmentsByTime.get(time);
      const past = isPastSlotTime(date, time);
      const available = !bookedAppointment && !past;

      slots.push({
        time,
        endTime: segment.endTime ? normalizeTime(segment.endTime) : '',
        available,
        isBooked: !available,
        blockedReason: null,
        status: bookedAppointment ? (bookedAppointment.Status || 'Booked') : (past ? 'Passed' : 'Available'),
        source: segment.source,
      });

      current += duration;
    }
  }

  return slots;
};

const getGeneratedSlotRows = async (pool, { doctorId, date, hospitalId = null, excludeAppointmentId = null }) => {
  const resolvedHospitalId = resolveHospitalId(hospitalId);
  const result = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date', sql.Date, date)
    .input('HospitalId', sql.BigInt, resolvedHospitalId)
    .query(`
      SELECT
        s.Id,
        CONVERT(VARCHAR(8), s.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), s.EndTime,   108) AS EndTime,
        s.Status,
        s.AppointmentId,
        s.TokenNumber,
        s.BlockedReason,
        linkedAppt.Status AS LinkedAppointmentStatus
      FROM dbo.AppointmentSlots s
      LEFT JOIN dbo.Appointments linkedAppt ON linkedAppt.Id = s.AppointmentId
      WHERE s.DoctorId = @DoctorId
        AND s.SlotDate = @Date
        AND (@HospitalId IS NULL OR s.HospitalId = @HospitalId)
      ORDER BY s.StartTime
    `);

  return result.recordset;
};

const getScheduleSegments = async (pool, { doctor, date }) => {
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();

  const scheduleResult = await pool.request()
    .input('DoctorId', sql.BigInt, doctor.Id)
    .input('DayOfWeek', sql.TinyInt, dayOfWeek)
    .input('Date', sql.Date, date)
    .query(`
      SELECT
        CONVERT(VARCHAR(8), StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), EndTime,   108) AS EndTime,
        SlotDurationMins
      FROM dbo.DoctorSchedules
      WHERE DoctorId   = @DoctorId
        AND DayOfWeek  = @DayOfWeek
        AND IsActive   = 1
        AND EffectiveFrom <= @Date
        AND (EffectiveTo IS NULL OR EffectiveTo >= @Date)
      ORDER BY StartTime
    `);

  if (scheduleResult.recordset.length) {
    return scheduleResult.recordset.map((row) => ({
      startTime: row.StartTime,
      endTime: row.EndTime,
      slotDurationMins: row.SlotDurationMins || 30,
      source: 'DoctorSchedules',
    }));
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const availableDays = doctor.AvailableDays
    ? doctor.AvailableDays.split(',').map((day) => day.trim()).filter(Boolean)
    : [];

  if (availableDays.length && !availableDays.includes(dayNames[dayOfWeek])) {
    return [];
  }

  if (!doctor.AvailableFrom || !doctor.AvailableTo) {
    return [];
  }

  return [{
    startTime: doctor.AvailableFrom,
    endTime: doctor.AvailableTo,
    slotDurationMins: 30,
    source: 'DoctorProfile',
  }];
};

const getDoctorSlots = async ({
  doctorId,
  date,
  hospitalId = null,
  includeUnavailable = true,
  excludeAppointmentId = null,
}) => {
  const pool = await getDb();
  const doctor = await getDoctorProfile(pool, { doctorId, hospitalId });

  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  const bookedAppointmentsByTime = await getBookedAppointmentsByTime(pool, {
    doctorId: doctor.Id,
    date,
    excludeAppointmentId,
  });

  const generatedSlotRows = await getGeneratedSlotRows(pool, {
    doctorId: doctor.Id,
    date,
    hospitalId: doctor.HospitalId,
    excludeAppointmentId,
  });

  let allSlots = [];

  if (generatedSlotRows.length) {
    allSlots = generatedSlotRows.map((row) => {
      const time = normalizeTime(row.StartTime);
      const bookedAppointment = bookedAppointmentsByTime.get(time);
      const slotStatus = (row.Status || '').trim().toLowerCase();
      const linkedAppointmentStatus = (row.LinkedAppointmentStatus || '').trim().toLowerCase();
      const blockedBySlotStatus = !OPEN_SLOT_STATUSES.has(slotStatus);
      const occupiedByLinkedAppointment =
        row.AppointmentId != null &&
        row.AppointmentId !== excludeAppointmentId &&
        !['cancelled', 'noshow', 'completed', 'rescheduled'].includes(linkedAppointmentStatus);
      const occupiedBySlot = occupiedByLinkedAppointment ||
        (row.AppointmentId == null && row.TokenNumber != null);
      const past = isPastSlotTime(date, time);
      const available = !blockedBySlotStatus && !occupiedBySlot && !bookedAppointment && !past;

      return {
        id: row.Id,
        time,
        endTime: normalizeTime(row.EndTime),
        available,
        isBooked: !available,
        blockedReason: row.BlockedReason || null,
        status: row.Status || (bookedAppointment ? bookedAppointment.Status : (past ? 'Passed' : 'Available')),
        source: 'AppointmentSlots',
      };
    });
  } else {
    const scheduleSegments = await getScheduleSegments(pool, { doctor, date });
    allSlots = buildDerivedSlots(scheduleSegments, { date, bookedAppointmentsByTime });
  }

  const visibleSlots = includeUnavailable ? allSlots : allSlots.filter((slot) => slot.available);

  return {
    doctorId: doctor.Id,
    date,
    totalSlots: allSlots.length,
    availableSlots: allSlots.filter((slot) => slot.available).length,
    bookedSlots: allSlots.filter((slot) => !slot.available).length,
    available: allSlots.some((slot) => slot.available),
    slots: visibleSlots,
  };
};

const ensureBookableSlot = async ({
  doctorId,
  hospitalId = null,
  date,
  time,
  excludeAppointmentId = null,
}) => {
  const normalizedTime = normalizeTime(time);
  if (!normalizedTime) {
    throw new AppError('Invalid appointment time', 400);
  }

  if (isPastSlotTime(date, normalizedTime)) {
    throw new AppError('Selected time slot has already passed', 400);
  }

  const slotData = await getDoctorSlots({
    doctorId,
    date,
    hospitalId,
    includeUnavailable: true,
    excludeAppointmentId,
  });

  const exactSlot = slotData.slots.find((slot) => slot.time === normalizedTime);
  if (!exactSlot) {
    throw new AppError('Selected time slot is not available for this doctor', 400);
  }

  if (!exactSlot.available) {
    throw new AppError('This time slot is already booked or unavailable', 409);
  }

  return { slot: exactSlot, slotData };
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
  const normalizedAppointmentTime = normalizeTime(appointmentTime);

  // 1. Verify doctor exists & belongs to hospital
  const doctor = await getDoctorProfile(pool, { doctorId, hospitalId });
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

  // 3. Validate that the requested slot exists and is still bookable
  await ensureBookableSlot({
    doctorId: doctor.Id,
    hospitalId,
    date: appointmentDate,
    time: normalizedAppointmentTime,
  });

  const patientConflict = await getPatientConflictAtTime(pool, {
    patientId: patient.Id,
    date: appointmentDate,
    time: normalizedAppointmentTime,
  });
  if (patientConflict) {
    throw new AppError('You already have an appointment scheduled at this time', 409);
  }

  // 4. Check daily patient limit
  if (doctor.MaxDailyPatients) {
    const countR = await pool.request()
      .input('DoctorId', sql.BigInt, doctor.Id)
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
  const token         = await getNextToken(pool, doctor.Id, appointmentDate);
  const appointmentNo = generateAppointmentNo();
  const deptId        = departmentId || doctor.DepartmentId;

  // 6. Insert appointment
  const insertR = await pool.request()
    .input('HospitalId',      sql.BigInt,   hospitalId)
    .input('PatientId',       sql.BigInt,   patientId)
    .input('DoctorId',        sql.BigInt,   doctor.Id)
    .input('DepartmentId',    sql.BigInt,   deptId   || null)
    .input('AppointmentNo',   sql.NVarChar, appointmentNo)
    .input('AppointmentDate', sql.Date,     appointmentDate)
    .input('AppointmentTime', sql.NVarChar, normalizedAppointmentTime)
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

  await syncGeneratedSlotRow(pool, {
    hospitalId,
    doctorId: doctor.Id,
    date: appointmentDate,
    time: normalizedAppointmentTime,
    appointmentId: newId,
    tokenNumber: token,
    status: 'Booked',
  });

  return {
    id:            newId,
    appointmentNo,
    token,
    appointmentDate,
    appointmentTime: normalizedAppointmentTime,
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

  const isCancelled = status === 'Cancelled';
  await syncGeneratedSlotRow(pool, {
    hospitalId,
    doctorId: appt.DoctorId,
    date: appt.AppointmentDate,
    time: appt.AppointmentTime,
    appointmentId: isCancelled ? null : id,
    tokenNumber: isCancelled ? null : appt.TokenNumber,
    status: isCancelled ? 'Available' : status,
  });

  return { ...appt, Status: status, CancelReason: cancelReason };
};

// ─────────────────────────────────────────────────────────────────────────────
// RESCHEDULE
// ─────────────────────────────────────────────────────────────────────────────
const rescheduleAppointment = async ({ id, hospitalId, newDate, newTime, updatedBy }) => {
  const pool = await getDb();
  const appt = await getAppointmentById(id, hospitalId);
  const normalizedNewTime = normalizeTime(newTime);
  if (!appt) throw new AppError('Appointment not found', 404);

  if (['Cancelled', 'Completed'].includes(appt.Status)) {
    throw new AppError(`Cannot reschedule a ${appt.Status} appointment`, 400);
  }

  await ensureBookableSlot({
    doctorId: appt.DoctorId,
    hospitalId,
    date: newDate,
    time: normalizedNewTime,
    excludeAppointmentId: id,
  });

  const patientConflict = await getPatientConflictAtTime(pool, {
    patientId: appt.PatientId,
    date: newDate,
    time: normalizedNewTime,
    excludeAppointmentId: id,
  });
  if (patientConflict) {
    throw new AppError('You already have an appointment scheduled at this time', 409);
  }

  const newToken = await getNextToken(pool, appt.DoctorId, newDate);
  const oldDate = normalizeDateValue(appt.AppointmentDate);
  const oldTime = normalizeTime(appt.AppointmentTime);

  await pool.request()
    .input('Id',          sql.BigInt,  id)
    .input('NewDate',     sql.Date,    newDate)
    .input('NewTime',     sql.NVarChar, normalizedNewTime)
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

  if (oldDate !== normalizeDateValue(newDate) || oldTime !== normalizedNewTime) {
    await syncGeneratedSlotRow(pool, {
      hospitalId,
      doctorId: appt.DoctorId,
      date: oldDate,
      time: oldTime,
      appointmentId: null,
      tokenNumber: null,
      status: 'Available',
    });
  }

  await syncGeneratedSlotRow(pool, {
    hospitalId,
    doctorId: appt.DoctorId,
    date: newDate,
    time: normalizedNewTime,
    appointmentId: id,
    tokenNumber: newToken,
    status: 'Booked',
  });

  return {
    ...appt,
    OldDate:          oldDate,
    OldTime:          oldTime,
    AppointmentDate:  newDate,
    AppointmentTime:  normalizedNewTime,
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
const getStats = async (hospitalId, { doctorId = null } = {}) => {
  const pool = await getDb();
  const today = new Date().toISOString().split('T')[0];

  const r = await pool.request()
    .input('HospitalId', sql.BigInt,  hospitalId)
    .input('DoctorId',   sql.BigInt,  doctorId)
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
        AND (@DoctorId IS NULL OR DoctorId = @DoctorId)
    `);

  return r.recordset[0];
};

module.exports = {
  bookAppointment,
  getDoctorSlots,
  getAppointmentById,
  updateAppointmentStatus,
  rescheduleAppointment,
  listAppointments,
  getMyAppointments,
  getStats,
};
