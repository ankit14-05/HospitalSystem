// backend/src/controllers/doctorSchedule.controller.js
const { query, sql } = require('../config/database');
const ApiResponse     = require('../utils/apiResponse');
const AppError        = require('../utils/AppError');

const getHospitalId = req => req.user?.hospitalId || req.user?.HospitalId || 1; // fallback to hospital 1
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// SQL Server: compute slot count from two TIME columns
// DATEDIFF(MINUTE, '00:00', time_col) gives minutes-since-midnight safely
const SLOT_CALC = `
  CASE WHEN ds.SlotDurationMins > 0
    THEN CAST(
      (DATEDIFF(MINUTE, CAST('00:00' AS TIME), ds.EndTime)
       - DATEDIFF(MINUTE, CAST('00:00' AS TIME), ds.StartTime))
      / ds.SlotDurationMins
    AS SMALLINT)
    ELSE NULL
  END
`;

const DAY_NAME_CASE = `
  CASE ds.DayOfWeek
    WHEN 0 THEN 'Sunday'    WHEN 1 THEN 'Monday'   WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END
`;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/scheduling/doctor-schedules
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllDoctorSchedules = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { doctorId, dayOfWeek, isActive } = req.query;

    let where = 'WHERE ds.HospitalId = @HospitalId';
    const params = { HospitalId: { type: sql.BigInt, value: parseInt(hospitalId) } };

    if (doctorId  !== undefined) { params.DoctorId  = { type: sql.BigInt,  value: parseInt(doctorId) };          where += ' AND ds.DoctorId  = @DoctorId';  }
    if (dayOfWeek !== undefined) { params.DayOfWeek = { type: sql.TinyInt, value: Number(dayOfWeek) };            where += ' AND ds.DayOfWeek = @DayOfWeek'; }
    if (isActive  !== undefined) { params.IsActive  = { type: sql.Bit,     value: isActive === 'true' ? 1 : 0 }; where += ' AND ds.IsActive  = @IsActive';  }
    else { where += ' AND ds.IsActive = 1'; }

    const result = await query(`
      SELECT
        ds.Id, ds.HospitalId, ds.DoctorId, ds.OpdRoomId, ds.DayOfWeek,
        CONVERT(VARCHAR(8), ds.StartTime, 108)   AS StartTime,
        CONVERT(VARCHAR(8), ds.EndTime,   108)   AS EndTime,
        ds.SlotDurationMins, ds.MaxSlots, ds.VisitType,
        ds.EffectiveFrom, ds.EffectiveTo, ds.IsActive, ds.Notes,
        ds.CreatedBy, ds.CreatedAt, ds.UpdatedAt,
        u.FirstName + ' ' + u.LastName   AS DoctorName,
        u.FirstName, u.LastName,
        d.Name                           AS DepartmentName,
        sp.Name                          AS SpecializationName,
        r2.RoomNumber, r2.RoomName,
        ${DAY_NAME_CASE}                 AS DayName,
        ${SLOT_CALC}                     AS ComputedMaxSlots,
        cb.FirstName + ' ' + cb.LastName AS CreatedByName
      FROM dbo.DoctorSchedules ds
      JOIN  dbo.DoctorProfiles   dp  ON dp.Id    = ds.DoctorId
      JOIN  dbo.Users            u   ON u.Id     = dp.UserId
      LEFT JOIN dbo.Departments  d   ON d.Id     = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id  = dp.SpecializationId
      LEFT JOIN dbo.OpdRooms     r2  ON r2.Id    = ds.OpdRoomId
      LEFT JOIN dbo.Users        cb  ON cb.Id    = ds.CreatedBy
      ${where}
      ORDER BY ds.DayOfWeek, ds.StartTime
    `, params);

    return ApiResponse.success(res, result.recordset, 'Doctor schedules fetched');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/scheduling/doctor-schedules/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoctorScheduleById = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ds.*,
        CONVERT(VARCHAR(8), ds.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), ds.EndTime,   108) AS EndTime,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        d.Name AS DepartmentName, r.RoomNumber, r.RoomName
      FROM dbo.DoctorSchedules ds
      JOIN  dbo.DoctorProfiles dp ON dp.Id = ds.DoctorId
      JOIN  dbo.Users u           ON u.Id  = dp.UserId
      LEFT JOIN dbo.Departments d  ON d.Id = dp.DepartmentId
      LEFT JOIN dbo.OpdRooms    r  ON r.Id  = ds.OpdRoomId
      WHERE ds.Id = @Id AND ds.HospitalId = @HospitalId
    `, {
      Id:         { type: sql.BigInt, value: parseInt(req.params.id) },
      HospitalId: { type: sql.BigInt, value: parseInt(getHospitalId(req)) },
    });
    if (!result.recordset.length) throw new AppError('Schedule not found', 404);
    return ApiResponse.success(res, result.recordset[0], 'Schedule fetched');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/scheduling/doctor-schedules
// ─────────────────────────────────────────────────────────────────────────────
exports.createDoctorSchedule = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const {
      DoctorId, OpdRoomId, DayOfWeek, StartTime, EndTime,
      SlotDurationMins, MaxSlots, VisitType,
      EffectiveFrom, EffectiveTo, Notes,
    } = req.body;

    if (!DoctorId || DayOfWeek === undefined || !StartTime || !EndTime)
      throw new AppError('DoctorId, DayOfWeek, StartTime and EndTime are required', 400);

    if (StartTime >= EndTime)
      throw new AppError('End time must be after start time', 400);

    // Overlap check
    const overlap = await query(`
      SELECT Id FROM dbo.DoctorSchedules
      WHERE DoctorId  = @DoctorId
        AND DayOfWeek = @DayOfWeek
        AND IsActive  = 1
        AND CONVERT(VARCHAR(8), StartTime, 108) < @EndTime
        AND CONVERT(VARCHAR(8), EndTime,   108) > @StartTime
    `, {
      DoctorId:  { type: sql.BigInt,       value: parseInt(DoctorId) },
      DayOfWeek: { type: sql.TinyInt,      value: Number(DayOfWeek) },
      StartTime: { type: sql.NVarChar(10), value: StartTime },
      EndTime:   { type: sql.NVarChar(10), value: EndTime },
    });
    if (overlap.recordset.length)
      throw new AppError(`Schedule overlaps with an existing block on ${DAYS[Number(DayOfWeek)]}`, 409);

    const r = await query(`
      INSERT INTO dbo.DoctorSchedules
        (HospitalId, DoctorId, OpdRoomId, DayOfWeek, StartTime, EndTime,
         SlotDurationMins, MaxSlots, VisitType, EffectiveFrom, EffectiveTo, Notes, CreatedBy)
      OUTPUT
        INSERTED.Id, INSERTED.HospitalId, INSERTED.DoctorId, INSERTED.OpdRoomId,
        INSERTED.DayOfWeek, INSERTED.SlotDurationMins, INSERTED.MaxSlots,
        INSERTED.VisitType, INSERTED.EffectiveFrom, INSERTED.EffectiveTo,
        INSERTED.Notes, INSERTED.IsActive, INSERTED.CreatedBy, INSERTED.CreatedAt,
        CONVERT(VARCHAR(8), INSERTED.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), INSERTED.EndTime,   108) AS EndTime
      VALUES
        (@HospitalId, @DoctorId, @OpdRoomId, @DayOfWeek, @StartTime, @EndTime,
         @SlotDurationMins, @MaxSlots, @VisitType, @EffectiveFrom, @EffectiveTo, @Notes, @CreatedBy)
    `, {
      HospitalId:       { type: sql.BigInt,        value: parseInt(hospitalId) },
      DoctorId:         { type: sql.BigInt,        value: parseInt(DoctorId) },
      OpdRoomId:        { type: sql.BigInt,        value: OpdRoomId ? parseInt(OpdRoomId) : null },
      DayOfWeek:        { type: sql.TinyInt,       value: Number(DayOfWeek) },
      StartTime:        { type: sql.NVarChar(10),  value: StartTime },
      EndTime:          { type: sql.NVarChar(10),  value: EndTime },
      SlotDurationMins: { type: sql.SmallInt,      value: Number(SlotDurationMins) || 15 },
      MaxSlots:         { type: sql.SmallInt,      value: MaxSlots ? Number(MaxSlots) : null },
      VisitType:        { type: sql.NVarChar(20),  value: VisitType || 'opd' },
      EffectiveFrom:    { type: sql.Date,          value: EffectiveFrom || new Date() },
      EffectiveTo:      { type: sql.Date,          value: EffectiveTo || null },
      Notes:            { type: sql.NVarChar(500), value: Notes || null },
      CreatedBy:        { type: sql.BigInt,        value: parseInt(req.user?.id) },
    });

    return ApiResponse.created(res, r.recordset[0], 'Doctor schedule created successfully');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/scheduling/doctor-schedules/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.updateDoctorSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalId(req);
    const {
      OpdRoomId, DayOfWeek, StartTime, EndTime,
      SlotDurationMins, MaxSlots, VisitType,
      EffectiveFrom, EffectiveTo, Notes, IsActive,
    } = req.body;

    if (StartTime && EndTime && StartTime >= EndTime)
      throw new AppError('End time must be after start time', 400);

    // Overlap check (excluding self)
    if (StartTime && EndTime && DayOfWeek !== undefined) {
      const sch = await query(
        `SELECT DoctorId FROM dbo.DoctorSchedules WHERE Id = @Id`,
        { Id: { type: sql.BigInt, value: parseInt(id) } }
      );
      if (sch.recordset.length) {
        const overlap = await query(`
          SELECT Id FROM dbo.DoctorSchedules
          WHERE DoctorId  = @DoctorId
            AND DayOfWeek = @DayOfWeek
            AND IsActive  = 1
            AND Id        <> @ExcludeId
            AND CONVERT(VARCHAR(8), StartTime, 108) < @EndTime
            AND CONVERT(VARCHAR(8), EndTime,   108) > @StartTime
        `, {
          DoctorId:  { type: sql.BigInt,       value: sch.recordset[0].DoctorId },
          DayOfWeek: { type: sql.TinyInt,      value: Number(DayOfWeek) },
          ExcludeId: { type: sql.BigInt,       value: parseInt(id) },
          StartTime: { type: sql.NVarChar(10), value: StartTime },
          EndTime:   { type: sql.NVarChar(10), value: EndTime },
        });
        if (overlap.recordset.length)
          throw new AppError(`Updated schedule overlaps with an existing block on ${DAYS[Number(DayOfWeek)]}`, 409);
      }
    }

    const r = await query(`
      UPDATE dbo.DoctorSchedules
      SET
        OpdRoomId        = @OpdRoomId,
        DayOfWeek        = @DayOfWeek,
        StartTime        = @StartTime,
        EndTime          = @EndTime,
        SlotDurationMins = @SlotDurationMins,
        MaxSlots         = @MaxSlots,
        VisitType        = @VisitType,
        EffectiveFrom    = @EffectiveFrom,
        EffectiveTo      = @EffectiveTo,
        Notes            = @Notes,
        IsActive         = @IsActive,
        UpdatedBy        = @UpdatedBy,
        UpdatedAt        = GETUTCDATE()
      OUTPUT
        INSERTED.Id, INSERTED.HospitalId, INSERTED.DoctorId, INSERTED.OpdRoomId,
        INSERTED.DayOfWeek, INSERTED.SlotDurationMins, INSERTED.MaxSlots,
        INSERTED.VisitType, INSERTED.EffectiveFrom, INSERTED.EffectiveTo,
        INSERTED.Notes, INSERTED.IsActive, INSERTED.UpdatedAt,
        CONVERT(VARCHAR(8), INSERTED.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), INSERTED.EndTime,   108) AS EndTime
      WHERE Id = @Id AND HospitalId = @HospitalId
    `, {
      Id:               { type: sql.BigInt,        value: parseInt(id) },
      HospitalId:       { type: sql.BigInt,        value: parseInt(hospitalId) },
      OpdRoomId:        { type: sql.BigInt,        value: OpdRoomId ? parseInt(OpdRoomId) : null },
      DayOfWeek:        { type: sql.TinyInt,       value: Number(DayOfWeek) },
      StartTime:        { type: sql.NVarChar(10),  value: StartTime },
      EndTime:          { type: sql.NVarChar(10),  value: EndTime },
      SlotDurationMins: { type: sql.SmallInt,      value: Number(SlotDurationMins) || 15 },
      MaxSlots:         { type: sql.SmallInt,      value: MaxSlots ? Number(MaxSlots) : null },
      VisitType:        { type: sql.NVarChar(20),  value: VisitType || 'opd' },
      EffectiveFrom:    { type: sql.Date,          value: EffectiveFrom || new Date() },
      EffectiveTo:      { type: sql.Date,          value: EffectiveTo || null },
      Notes:            { type: sql.NVarChar(500), value: Notes || null },
      IsActive:         { type: sql.Bit,           value: IsActive !== undefined ? IsActive : 1 },
      UpdatedBy:        { type: sql.BigInt,        value: parseInt(req.user?.id) },
    });

    if (!r.recordset.length) throw new AppError('Schedule not found', 404);
    return ApiResponse.success(res, r.recordset[0], 'Doctor schedule updated');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/scheduling/doctor-schedules/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteDoctorSchedule = async (req, res, next) => {
  try {
    await query(`
      UPDATE dbo.DoctorSchedules
      SET IsActive = 0, UpdatedBy = @UpdatedBy, UpdatedAt = GETUTCDATE()
      WHERE Id = @Id AND HospitalId = @HospitalId
    `, {
      Id:         { type: sql.BigInt, value: parseInt(req.params.id) },
      HospitalId: { type: sql.BigInt, value: parseInt(getHospitalId(req)) },
      UpdatedBy:  { type: sql.BigInt, value: parseInt(req.user?.id) },
    });
    return ApiResponse.success(res, null, 'Doctor schedule removed');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/scheduling/my-schedule  (doctor reads own schedule)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMySchedule = async (req, res, next) => {
  try {
    // Find profile without approval filter so pending doctors also see schedule
    const profileRes = await query(
      `SELECT TOP 1 Id, HospitalId FROM dbo.DoctorProfiles WHERE UserId = @UserId ORDER BY Id DESC`,
      { UserId: { type: sql.BigInt, value: parseInt(req.user.id) } }
    );
    if (!profileRes.recordset.length) {
      const t = new Date();
      return ApiResponse.success(res, { schedules: [], todayAppointments: [], todayDow: t.getDay(), todayDate: t.toISOString().slice(0,10) }, 'No profile');
    }
    const { Id: doctorId, HospitalId: hospitalId } = profileRes.recordset[0];
    const todayDow = new Date().getDay();
    const todayStr = new Date().toISOString().slice(0, 10);

    const [schedResult, apptResult] = await Promise.all([
      query(`
        SELECT
          ds.Id, ds.DoctorId, ds.OpdRoomId, ds.DayOfWeek,
          CONVERT(VARCHAR(8), ds.StartTime, 108) AS StartTime,
          CONVERT(VARCHAR(8), ds.EndTime,   108) AS EndTime,
          ds.SlotDurationMins, ds.MaxSlots, ds.VisitType,
          ds.EffectiveFrom, ds.EffectiveTo, ds.Notes, ds.IsActive,
          r.RoomNumber, r.RoomName,
          d.Name AS DepartmentName,
          ${DAY_NAME_CASE} AS DayName,
          ${SLOT_CALC}     AS ComputedMaxSlots,
          cb.FirstName + ' ' + cb.LastName AS AssignedByName
        FROM dbo.DoctorSchedules ds
        LEFT JOIN dbo.OpdRooms    r  ON r.Id  = ds.OpdRoomId
        LEFT JOIN dbo.Departments d  ON d.Id  = (
          SELECT DepartmentId FROM dbo.DoctorProfiles WHERE Id = @DoctorId
        )
        LEFT JOIN dbo.Users cb ON cb.Id = ds.CreatedBy
        WHERE ds.DoctorId   = @DoctorId
          AND ds.HospitalId = @HospitalId
          AND ds.IsActive   = 1
        ORDER BY ds.DayOfWeek, ds.StartTime
      `, {
        DoctorId:   { type: sql.BigInt, value: doctorId },
        HospitalId: { type: sql.BigInt, value: hospitalId },
      }),

      query(`
        SELECT
          a.Id, a.AppointmentNo,
          CONVERT(VARCHAR(8), a.AppointmentTime, 108) AS AppointmentTime,
          CONVERT(VARCHAR(8), a.EndTime,         108) AS EndTime,
          a.VisitType, a.Status, a.Priority, a.Reason, a.TokenNumber,
          pp.FirstName + ' ' + pp.LastName AS PatientName,
          pp.UHID, pp.Phone AS PatientPhone, pp.Gender, pp.DateOfBirth, pp.BloodGroup
        FROM dbo.Appointments a
        JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
        WHERE a.DoctorId        = @DoctorId
          AND a.AppointmentDate = @Today
          AND a.Status NOT IN ('Cancelled','NoShow')
        ORDER BY a.AppointmentTime
      `, {
        DoctorId: { type: sql.BigInt, value: doctorId },
        Today:    { type: sql.Date,   value: todayStr },
      }),
    ]);

    return ApiResponse.success(res, {
      schedules:         schedResult.recordset,
      todayAppointments: apptResult.recordset,
      todayDow,
      todayDate: todayStr,
    }, 'Your schedule fetched');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/scheduling/doctors-list
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoctorsList = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        dp.Id AS DoctorProfileId,
        u.Id  AS UserId,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        u.FirstName, u.LastName,
        d.Name  AS DepartmentName,
        sp.Name AS Specialization,
        dp.ConsultationFee, dp.IsAvailable, dp.ApprovalStatus
      FROM dbo.DoctorProfiles dp
      JOIN  dbo.Users u            ON u.Id   = dp.UserId
      LEFT JOIN dbo.Departments d  ON d.Id   = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
      WHERE dp.HospitalId     = @HospitalId
        AND u.IsActive        = 1
        AND dp.ApprovalStatus IN ('approved', 'pending')  -- include pending so admin can assign schedules
      ORDER BY u.FirstName, u.LastName
    `, {
      HospitalId: { type: sql.BigInt, value: parseInt(getHospitalId(req)) },
    });
    return ApiResponse.success(res, result.recordset, 'Doctors list fetched');
  } catch (err) { next(err); }
};