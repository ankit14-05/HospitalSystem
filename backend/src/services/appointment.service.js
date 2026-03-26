// src/services/appointment.service.js
// Core appointment business logic — DB queries, token gen, conflict checks

const { getPool: getDb, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const { getSchemaState } = require('./schedule.service');
const { requireActivePatientProfile } = require('./patientAccess.service');

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

const getSlotIdentityKey = ({ slotSessionId = null, assignmentId = null, time = '' }) =>
  `${slotSessionId ?? ''}|${assignmentId ?? ''}|${normalizeTime(time)}`;

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
  assignmentId = null,
  slotSessionId = null,
  appointmentId = null,
  tokenNumber = null,
  status = null,
}) => {
  const normalizedTime = normalizeTime(time);
  if (!doctorId || !date || !normalizedTime) return;

  const updateResult = await pool.request()
    .input('HospitalId', sql.BigInt, resolveHospitalId(hospitalId))
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date', sql.Date, normalizeDateValue(date))
    .input('Time', sql.NVarChar, normalizedTime)
    .input('AssignmentId', sql.BigInt, assignmentId)
    .input('SlotSessionId', sql.BigInt, slotSessionId)
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
        AND (@AssignmentId IS NULL OR AssignmentId = @AssignmentId)
        AND (@SlotSessionId IS NULL OR SlotSessionId = @SlotSessionId)
        AND (@HospitalId IS NULL OR HospitalId = @HospitalId)
    `);

  const updatedExistingRow = Array.isArray(updateResult.rowsAffected)
    ? updateResult.rowsAffected.some((count) => Number(count) > 0)
    : false;

  if (updatedExistingRow) {
    return;
  }

  const sessionResult = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date', sql.Date, normalizeDateValue(date))
    .input('Time', sql.NVarChar, normalizedTime)
    .input('HospitalId', sql.BigInt, resolveHospitalId(hospitalId))
    .query(`
      SELECT TOP 1
        s.Id AS SlotSessionId,
        s.AssignmentId,
        s.OpdRoomId,
        s.SlotDurationMins
      FROM dbo.OpdSlotSessions s
      WHERE s.DoctorId = @DoctorId
        AND s.SessionDate = @Date
        AND s.Status <> 'Cancelled'
        AND CONVERT(VARCHAR(5), s.StartTime, 108) <= @Time
        AND CONVERT(VARCHAR(5), s.EndTime, 108) > @Time
        AND (@HospitalId IS NULL OR s.HospitalId = @HospitalId)
      ORDER BY s.StartTime
    `);

  const session = sessionResult.recordset[0];
  let resolvedAssignmentId = assignmentId ?? session?.AssignmentId ?? null;
  let resolvedSlotSessionId = slotSessionId ?? session?.SlotSessionId ?? null;
  let opdRoomId = session?.OpdRoomId || null;
  let slotDurationMins = Number(session?.SlotDurationMins) || 15;

  if (!session && (resolvedAssignmentId == null || resolvedSlotSessionId == null)) {
    const assignmentResult = await pool.request()
      .input('DoctorId', sql.BigInt, doctorId)
      .input('Date', sql.Date, normalizeDateValue(date))
      .input('Time', sql.NVarChar, normalizedTime)
      .input('HospitalId', sql.BigInt, resolveHospitalId(hospitalId))
      .query(`
        SELECT TOP 1
          a.Id AS AssignmentId,
          a.OpdRoomId,
          a.SlotDurationMins
        FROM dbo.DoctorScheduleAssignments a
        JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = a.ActivityTypeId
        WHERE a.DoctorId = @DoctorId
          AND a.AssignmentDate = @Date
          AND a.Status IN ('Active', 'Published')
          AND a.BookingEnabled = 1
          AND atp.AllowsOpdSlots = 1
          AND CONVERT(VARCHAR(5), a.StartTime, 108) <= @Time
          AND CONVERT(VARCHAR(5), a.EndTime, 108) > @Time
          AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        ORDER BY a.StartTime
      `);

    const assignment = assignmentResult.recordset[0];
    if (!assignment) {
      return;
    }

    resolvedAssignmentId = resolvedAssignmentId ?? assignment.AssignmentId;
    opdRoomId = assignment.OpdRoomId || null;
    slotDurationMins = Number(assignment.SlotDurationMins) || 15;
  }

  const slotStartMinutes = toMinutes(normalizedTime);
  const slotEndMinutes = slotStartMinutes + slotDurationMins;
  const slotEndTime = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

  await pool.request()
    .input('HospitalId', sql.BigInt, resolveHospitalId(hospitalId))
    .input('DoctorId', sql.BigInt, doctorId)
    .input('AssignmentId', sql.BigInt, resolvedAssignmentId)
    .input('SlotSessionId', sql.BigInt, resolvedSlotSessionId)
    .input('OpdRoomId', sql.BigInt, opdRoomId)
    .input('SlotDate', sql.Date, normalizeDateValue(date))
    .input('StartTime', sql.NVarChar, normalizedTime)
    .input('EndTime', sql.NVarChar, slotEndTime)
    .input('VisitType', sql.NVarChar, 'opd')
    .input('Status', sql.NVarChar, status || 'Available')
    .input('AppointmentId', sql.BigInt, appointmentId)
    .input('TokenNumber', sql.SmallInt, tokenNumber)
    .query(`
      INSERT INTO dbo.AppointmentSlots
        (HospitalId, DoctorId, ScheduleId, AssignmentId, SlotSessionId, OpdRoomId, SlotDate,
         StartTime, EndTime, VisitType, Status, AppointmentId, TokenNumber, IsWalkIn, BlockedReason, CreatedAt, UpdatedAt)
      VALUES
        (@HospitalId, @DoctorId, NULL, @AssignmentId, @SlotSessionId, @OpdRoomId, @SlotDate,
         @StartTime, @EndTime, @VisitType, @Status, @AppointmentId, @TokenNumber, 0, NULL, SYSUTCDATETIME(), SYSUTCDATETIME())
    `);
};

const buildDerivedSlots = (segments, { date, bookedAppointmentsByTime }) => {
  const slots = [];

  for (const segment of segments) {
    let current = toMinutes(segment.startTime);
    const end = toMinutes(segment.endTime);
    const duration = Number(segment.slotDurationMins) || 30;
    const limit = Number(segment.maxSlots) || 0;
    let count = 0;

    if (!current || !end || duration <= 0 || end <= current) continue;

    while (current < end) {
      if (limit && count >= limit) break;

      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const slotEndMinutes = current + duration;
      if (slotEndMinutes > end) break;
      const endTime = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;
      const bookedAppointment = bookedAppointmentsByTime.get(time);
      const past = isPastSlotTime(date, time);
      const available = !bookedAppointment && !past;

      slots.push({
        time,
        endTime,
        available,
        isBooked: !available,
        blockedReason: null,
        status: bookedAppointment ? (bookedAppointment.Status || 'Booked') : (past ? 'Passed' : 'Available'),
        source: segment.source,
        assignmentId: segment.assignmentId ?? null,
        slotSessionId: segment.slotSessionId ?? null,
      });

      current += duration;
      count += 1;
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
        s.AssignmentId,
        s.SlotSessionId,
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

const getPublishedOpdSessions = async (pool, { doctorId, date, hospitalId = null }) => {
  const schema = await getSchemaState(pool);
  if (!schema.hasAdvancedScheduling) {
    return [];
  }

  const resolvedHospitalId = resolveHospitalId(hospitalId);
  const result = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date', sql.Date, date)
    .input('HospitalId', sql.BigInt, resolvedHospitalId)
    .query(`
      SELECT
        s.Id,
        s.AssignmentId,
        CONVERT(VARCHAR(5), s.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), s.EndTime, 108) AS EndTime,
        s.SlotDurationMins,
        s.TotalSlots
      FROM dbo.OpdSlotSessions s
      WHERE s.DoctorId = @DoctorId
        AND s.SessionDate = @Date
        AND s.Status IN ('Draft', 'Published')
        AND (@HospitalId IS NULL OR s.HospitalId = @HospitalId)
      ORDER BY s.StartTime
    `);

  return result.recordset;
};

const getAdvancedAssignmentsForDate = async (pool, { doctorId, date, hospitalId = null }) => {
  const schema = await getSchemaState(pool);
  if (!schema.hasAdvancedScheduling) {
    return [];
  }

  const resolvedHospitalId = resolveHospitalId(hospitalId);
  const result = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Date', sql.Date, date)
    .input('HospitalId', sql.BigInt, resolvedHospitalId)
    .query(`
      SELECT
        a.Id,
        a.BookingEnabled,
        atp.AllowsOpdSlots,
        a.SlotDurationMins,
        a.MaxSlots,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime
      FROM dbo.DoctorScheduleAssignments a
      JOIN dbo.DoctorScheduleActivityTypes atp ON atp.Id = a.ActivityTypeId
      WHERE a.DoctorId = @DoctorId
        AND a.AssignmentDate = @Date
        AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
        AND a.Status IN ('Active', 'Published')
      ORDER BY a.StartTime
    `);

  return result.recordset;
};

const getAppointmentSchemaInfo = async (pool) => {
  const [columnResult, consultationTableResult] = await Promise.all([
    pool.request().query(`
      SELECT name
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.Appointments')
        AND name IN ('PrimaryDiagnosis', 'FollowUpDate', 'FollowUpNotes')
    `),
    pool.request().query(`
      SELECT OBJECT_ID('dbo.AppointmentConsultations', 'U') AS TableId
    `),
  ]);

  return {
    appointmentColumns: new Set(columnResult.recordset.map((row) => row.name)),
    hasConsultationTable: Boolean(consultationTableResult.recordset[0]?.TableId),
  };
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

const buildPublishedSessionSlots = (sessions, { date, bookedAppointmentsByTime }) => {
  const slots = [];

  for (const session of sessions) {
    let current = toMinutes(session.StartTime);
    const end = toMinutes(session.EndTime);
    const duration = Number(session.SlotDurationMins) || 15;
    const limit = Number(session.TotalSlots) || 0;
    let count = 0;

    if (!current || !end || duration <= 0 || end <= current) continue;

    while (current < end) {
      if (limit && count >= limit) break;

      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const slotEndMinutes = current + duration;
      if (slotEndMinutes > end) break;
      const endTime = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;
      const bookedAppointment = bookedAppointmentsByTime.get(time);
      const past = isPastSlotTime(date, time);
      const available = !bookedAppointment && !past;

      slots.push({
        time,
        endTime,
        available,
        isBooked: !available,
        blockedReason: null,
        status: bookedAppointment ? (bookedAppointment.Status || 'Booked') : (past ? 'Passed' : 'Available'),
        source: 'OpdSlotSessions',
        assignmentId: session.AssignmentId,
        slotSessionId: session.Id,
      });

      current += duration;
      count += 1;
    }
  }

  return slots;
};

const buildGeneratedSlotState = (row, { date, bookedAppointmentsByTime, excludeAppointmentId = null }) => {
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
    assignmentId: row.AssignmentId ?? null,
    slotSessionId: row.SlotSessionId ?? null,
  };
};

const overlayGeneratedSlotState = (baseSlots, generatedSlotRows, {
  date,
  bookedAppointmentsByTime,
  excludeAppointmentId = null,
}) => {
  const generatedStates = generatedSlotRows.map((row) =>
    buildGeneratedSlotState(row, { date, bookedAppointmentsByTime, excludeAppointmentId })
  );

  if (!baseSlots.length) {
    return generatedStates;
  }

  const indexedStates = generatedStates.map((state, index) => ({ ...state, index }));
  const statesByIdentity = new Map();
  const statesByTime = new Map();

  for (const state of indexedStates) {
    if (state.slotSessionId != null || state.assignmentId != null) {
      statesByIdentity.set(getSlotIdentityKey(state), state);
    }

    if (!statesByTime.has(state.time)) {
      statesByTime.set(state.time, []);
    }
    statesByTime.get(state.time).push(state);
  }

  const matchedStateIndexes = new Set();

  const mergedSlots = baseSlots.map((slot) => {
    let matchedState = statesByIdentity.get(getSlotIdentityKey(slot));

    if (!matchedState) {
      const timeBucket = statesByTime.get(slot.time) || [];
      matchedState = timeBucket.find((candidate) => !matchedStateIndexes.has(candidate.index)) || null;
    }

    if (!matchedState) {
      return slot;
    }

    matchedStateIndexes.add(matchedState.index);

    return {
      ...slot,
      id: matchedState.id,
      endTime: matchedState.endTime || slot.endTime,
      available: matchedState.available,
      isBooked: matchedState.isBooked,
      blockedReason: matchedState.blockedReason,
      status: matchedState.status,
      assignmentId: matchedState.assignmentId ?? slot.assignmentId ?? null,
      slotSessionId: matchedState.slotSessionId ?? slot.slotSessionId ?? null,
      source: matchedState.source || slot.source,
    };
  });

  const unmatchedGeneratedStates = indexedStates
    .filter((state) => !matchedStateIndexes.has(state.index))
    .map(({ index, ...state }) => state);

  return [...mergedSlots, ...unmatchedGeneratedStates]
    .sort((left, right) => toMinutes(left.time) - toMinutes(right.time));
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
  const publishedSessions = await getPublishedOpdSessions(pool, {
    doctorId: doctor.Id,
    date,
    hospitalId: doctor.HospitalId,
  });
  const advancedAssignments = await getAdvancedAssignmentsForDate(pool, {
    doctorId: doctor.Id,
    date,
    hospitalId: doctor.HospitalId,
  });

  let baseSlots = [];

  if (publishedSessions.length) {
    baseSlots = buildPublishedSessionSlots(publishedSessions, { date, bookedAppointmentsByTime });
  } else if (advancedAssignments.length) {
    const bookableAssignments = advancedAssignments.filter(
      (assignment) => assignment.AllowsOpdSlots && assignment.BookingEnabled
    );

    const assignmentSegments = bookableAssignments.map((assignment) => ({
      startTime: assignment.StartTime,
      endTime: assignment.EndTime,
      slotDurationMins: assignment.SlotDurationMins || 15,
      maxSlots: assignment.MaxSlots || null,
      source: 'DoctorScheduleAssignments',
      assignmentId: assignment.Id,
    }));

    baseSlots = buildDerivedSlots(assignmentSegments, { date, bookedAppointmentsByTime });
  } else {
    const scheduleSegments = await getScheduleSegments(pool, { doctor, date });
    baseSlots = buildDerivedSlots(scheduleSegments, { date, bookedAppointmentsByTime });
  }

  const allSlots = overlayGeneratedSlotState(baseSlots, generatedSlotRows, {
    date,
    bookedAppointmentsByTime,
    excludeAppointmentId,
  });

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
  const schema = await getAppointmentSchemaInfo(pool);
  const hasPrimaryDiagnosisColumn = schema.appointmentColumns.has('PrimaryDiagnosis');
  const hasFollowUpDateColumn = schema.appointmentColumns.has('FollowUpDate');
  const hasFollowUpNotesColumn = schema.appointmentColumns.has('FollowUpNotes');

  const consultationJoin = schema.hasConsultationTable
    ? 'LEFT JOIN dbo.AppointmentConsultations ac ON ac.AppointmentId = a.Id'
    : '';

  const diagnosisSelect = hasPrimaryDiagnosisColumn && schema.hasConsultationTable
    ? 'COALESCE(ac.PrimaryDiagnosis, a.PrimaryDiagnosis) AS PrimaryDiagnosis,'
    : hasPrimaryDiagnosisColumn
      ? 'a.PrimaryDiagnosis AS PrimaryDiagnosis,'
      : schema.hasConsultationTable
        ? 'ac.PrimaryDiagnosis AS PrimaryDiagnosis,'
        : 'CAST(NULL AS NVARCHAR(MAX)) AS PrimaryDiagnosis,';

  const followUpDateSelect = hasFollowUpDateColumn && schema.hasConsultationTable
    ? 'COALESCE(ac.FollowUpDate, a.FollowUpDate) AS FollowUpDate,'
    : hasFollowUpDateColumn
      ? 'a.FollowUpDate AS FollowUpDate,'
      : schema.hasConsultationTable
        ? 'ac.FollowUpDate AS FollowUpDate,'
        : 'CAST(NULL AS DATE) AS FollowUpDate,';

  const followUpNotesSelect = hasFollowUpNotesColumn && schema.hasConsultationTable
    ? 'COALESCE(ac.FollowUpNotes, a.FollowUpNotes) AS FollowUpNotes,'
    : hasFollowUpNotesColumn
      ? 'a.FollowUpNotes AS FollowUpNotes,'
      : schema.hasConsultationTable
        ? 'ac.FollowUpNotes AS FollowUpNotes,'
        : 'CAST(NULL AS NVARCHAR(MAX)) AS FollowUpNotes,';

  const consultationNotesSelect = schema.hasConsultationTable
    ? 'ac.ConsultationNotes AS ConsultationNotes, ac.CompletedAt AS ConsultationCompletedAt, ac.VitalsJson AS ConsultationVitalsJson,'
    : 'CAST(NULL AS NVARCHAR(MAX)) AS ConsultationNotes, CAST(NULL AS DATETIME2(0)) AS ConsultationCompletedAt, CAST(NULL AS NVARCHAR(MAX)) AS ConsultationVitalsJson,';

  const r = await pool.request()
    .input('Id',         sql.BigInt, id)
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT
        a.Id, a.HospitalId, a.AppointmentNo, a.AppointmentDate,
        CONVERT(VARCHAR(5), TRY_CONVERT(time, a.AppointmentTime), 108) AS AppointmentTime,
        CONVERT(VARCHAR(5), TRY_CONVERT(time, a.EndTime), 108) AS EndTime,
        a.VisitType, a.Status, a.Priority, a.Reason, a.Notes,
        a.TokenNumber, a.CancelReason, a.CancelledAt, a.FollowUpOf,
        ${diagnosisSelect}
        ${followUpDateSelect}
        ${followUpNotesSelect}
        ${consultationNotesSelect}
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
      ${consultationJoin}
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
  const { slot: bookableSlot } = await ensureBookableSlot({
    doctorId: doctor.Id,
    hospitalId,
    date: appointmentDate,
    time: normalizedAppointmentTime,
  });
  const normalizedEndTime = normalizeTime(bookableSlot?.endTime || bookableSlot?.EndTime || '');

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
    .input('EndTime',         sql.NVarChar, normalizedEndTime || null)
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
         AppointmentTime, EndTime, VisitType, Status, Priority, Reason, TokenNumber,
         BookedByUserId, BookedByRole, CreatedBy)
      VALUES
        (@HospitalId, @PatientId, @DoctorId, @DepartmentId, @AppointmentNo, @AppointmentDate,
         @AppointmentTime, @EndTime, @VisitType, @Status, @Priority, @Reason, @TokenNumber,
         @BookedByUserId, @BookedByRole, @CreatedBy);
      SELECT SCOPE_IDENTITY() AS NewId;
    `);

  const newId = insertR.recordset[0]?.NewId;

  await syncGeneratedSlotRow(pool, {
    hospitalId,
    doctorId: doctor.Id,
    date: appointmentDate,
    time: normalizedAppointmentTime,
    assignmentId: bookableSlot?.assignmentId ?? null,
    slotSessionId: bookableSlot?.slotSessionId ?? null,
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
    endTime: normalizedEndTime || null,
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

  const releasesSlot = ['Cancelled', 'NoShow'].includes(status);
  await syncGeneratedSlotRow(pool, {
    hospitalId,
    doctorId: appt.DoctorId,
    date: appt.AppointmentDate,
    time: appt.AppointmentTime,
    appointmentId: releasesSlot ? null : id,
    tokenNumber: releasesSlot ? null : appt.TokenNumber,
    status: releasesSlot ? 'Available' : status,
  });

  if (status === 'Cancelled' || status === 'NoShow') {
    await pool.request()
      .input('AppointmentId', sql.BigInt, id)
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('QueueStatus', sql.NVarChar, status === 'NoShow' ? 'skipped' : 'cancelled')
      .query(`
        UPDATE dbo.OpdQueue
        SET QueueStatus = @QueueStatus,
            UpdatedAt = SYSUTCDATETIME()
        WHERE AppointmentId = @AppointmentId
          AND HospitalId = @HospitalId
          AND QueueStatus IN ('waiting', 'called', 'serving')
      `);
  }

  if (status === 'Completed') {
    await pool.request()
      .input('AppointmentId', sql.BigInt, id)
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        UPDATE dbo.OpdQueue
        SET QueueStatus = 'served',
            ServedAt = COALESCE(ServedAt, SYSUTCDATETIME()),
            UpdatedAt = SYSUTCDATETIME()
        WHERE AppointmentId = @AppointmentId
          AND HospitalId = @HospitalId
          AND QueueStatus IN ('waiting', 'called', 'serving')
      `);
  }

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

  const { slot: bookableSlot } = await ensureBookableSlot({
    doctorId: appt.DoctorId,
    hospitalId,
    date: newDate,
    time: normalizedNewTime,
    excludeAppointmentId: id,
  });
  const normalizedNewEndTime = normalizeTime(bookableSlot?.endTime || bookableSlot?.EndTime || appt.EndTime || '');

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
    .input('NewEndTime',  sql.NVarChar, normalizedNewEndTime || null)
    .input('NewToken',    sql.SmallInt, newToken)
    .input('UpdatedBy',   sql.BigInt,  updatedBy)
    .query(`
      UPDATE dbo.Appointments
      SET AppointmentDate  = @NewDate,
          AppointmentTime  = @NewTime,
          EndTime          = @NewEndTime,
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
    assignmentId: bookableSlot?.assignmentId ?? null,
    slotSessionId: bookableSlot?.slotSessionId ?? null,
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
    EndTime:          normalizedNewEndTime || appt.EndTime || null,
    TokenNumber:      newToken,
    Status:           'Rescheduled',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST — with filters, pagination
// ─────────────────────────────────────────────────────────────────────────────
const listAppointments = async ({
  hospitalId,
  patientId,
  doctorId,
  departmentId,
  status,
  date,
  search,
  page = 1,
  limit = 20,
}) => {
  const pool   = await getDb();
  const offset = (page - 1) * limit;
  const searchText = search ? `%${String(search).trim()}%` : null;

  const r = await pool.request()
    .input('HospitalId', sql.BigInt,   hospitalId)
    .input('PatientId',  sql.BigInt,   patientId  || null)
    .input('DoctorId',   sql.BigInt,   doctorId   || null)
    .input('DepartmentId', sql.BigInt, departmentId || null)
    .input('Status',     sql.NVarChar, status     || null)
    .input('Date',       sql.Date,     date       || null)
    .input('Search',     sql.NVarChar, searchText)
    .input('Limit',      sql.Int,      limit)
    .input('Offset',     sql.Int,      offset)
    .query(`
      SELECT
        a.Id, a.AppointmentNo, a.AppointmentDate,
        CONVERT(VARCHAR(5), TRY_CONVERT(time, a.AppointmentTime), 108) AS AppointmentTime,
        CONVERT(VARCHAR(5), TRY_CONVERT(time, a.EndTime), 108) AS EndTime,
        a.VisitType, a.Status, a.Priority, a.TokenNumber, a.Reason,
        a.CancelReason, a.CreatedAt,
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
        pp.UHID, pp.FirstName AS PatientFirstName, pp.LastName AS PatientLastName, pp.Phone AS PatientPhone,
        pp.UserId AS PatientUserId,
        ud.FirstName AS DoctorFirstName, ud.LastName AS DoctorLastName,
        ud.Id AS DoctorUserId,
        dp.Id   AS DoctorProfileId,
        dept.Id AS DepartmentId,
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
        AND (@DepartmentId IS NULL OR a.DepartmentId = @DepartmentId OR dp.DepartmentId = @DepartmentId)
        AND (@Status    IS NULL OR a.Status    = @Status)
        AND (@Date      IS NULL OR a.AppointmentDate = @Date)
        AND (
          @Search IS NULL
          OR a.AppointmentNo LIKE @Search
          OR pp.UHID LIKE @Search
          OR pp.Phone LIKE @Search
          OR pp.FirstName LIKE @Search
          OR pp.LastName LIKE @Search
          OR CONCAT(pp.FirstName, ' ', pp.LastName) LIKE @Search
          OR ud.FirstName LIKE @Search
          OR ud.LastName LIKE @Search
          OR CONCAT(ud.FirstName, ' ', ud.LastName) LIKE @Search
          OR dept.Name LIKE @Search
        )
      ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `);

  const countR = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('PatientId',  sql.BigInt, patientId  || null)
    .input('DoctorId',   sql.BigInt, doctorId   || null)
    .input('DepartmentId', sql.BigInt, departmentId || null)
    .input('Status',     sql.NVarChar, status   || null)
    .input('Date',       sql.Date,   date       || null)
    .input('Search',     sql.NVarChar, searchText)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.Appointments a
      JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
      JOIN dbo.DoctorProfiles dp  ON dp.Id = a.DoctorId
      JOIN dbo.Users ud           ON ud.Id = dp.UserId
      LEFT JOIN dbo.Departments dept ON dept.Id = a.DepartmentId
      WHERE a.HospitalId = @HospitalId
        AND (@PatientId IS NULL OR a.PatientId = @PatientId)
        AND (@DoctorId  IS NULL OR a.DoctorId  = @DoctorId)
        AND (@DepartmentId IS NULL OR a.DepartmentId = @DepartmentId OR dp.DepartmentId = @DepartmentId)
        AND (@Status    IS NULL OR a.Status    = @Status)
        AND (@Date      IS NULL OR a.AppointmentDate = @Date)
        AND (
          @Search IS NULL
          OR a.AppointmentNo LIKE @Search
          OR pp.UHID LIKE @Search
          OR pp.Phone LIKE @Search
          OR pp.FirstName LIKE @Search
          OR pp.LastName LIKE @Search
          OR CONCAT(pp.FirstName, ' ', pp.LastName) LIKE @Search
          OR ud.FirstName LIKE @Search
          OR ud.LastName LIKE @Search
          OR CONCAT(ud.FirstName, ' ', ud.LastName) LIKE @Search
          OR dept.Name LIKE @Search
        )
    `);

  return {
    data:  r.recordset,
    total: countR.recordset[0]?.total || 0,
    page,
    limit,
  };
};

const getAppointmentFilters = async ({ hospitalId, doctorId = null }) => {
  const pool = await getDb();

  const doctorRequest = pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .input('DoctorId', sql.BigInt, doctorId);

  const doctorsResult = await doctorRequest.query(`
    SELECT
      dp.Id AS DoctorId,
      dp.Id AS DoctorProfileId,
      dp.DepartmentId,
      dep.Name AS DepartmentName,
      u.FirstName,
      u.LastName,
      CONCAT(u.FirstName, ' ', u.LastName) AS DoctorName
    FROM dbo.DoctorProfiles dp
    JOIN dbo.Users u ON u.Id = dp.UserId
    LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
    WHERE dp.HospitalId = @HospitalId
      AND dp.ApprovalStatus = 'approved'
      AND u.DeletedAt IS NULL
      AND (@DoctorId IS NULL OR dp.Id = @DoctorId)
    ORDER BY u.FirstName, u.LastName
  `);

  const departmentsResult = await pool.request()
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT Id AS DepartmentId, Name AS DepartmentName
      FROM dbo.Departments
      WHERE HospitalId = @HospitalId
        AND IsActive = 1
      ORDER BY Name
    `);

  return {
    doctors: doctorsResult.recordset,
    departments: departmentsResult.recordset,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MY APPOINTMENTS (for logged-in patient or doctor)
// ─────────────────────────────────────────────────────────────────────────────
const getMyAppointments = async ({ userId, role, hospitalId, activePatientId = null, sessionId = null }) => {
  const pool = await getDb();

  let profileId = null;

  if (role === 'patient') {
    const activeProfile = await requireActivePatientProfile(
      {
        id: userId,
        userId,
        hospitalId,
        activePatientId,
      },
      sessionId,
      pool
    );
    profileId = activeProfile.patientId;
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
  getAppointmentFilters,
  getMyAppointments,
  getStats,
};
