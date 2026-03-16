// src/routes/scheduling.routes.js  (merged doctor-schedule routes here)
// NOTE: Original file header was doctor-schedule.routes.js
// Doctor-facing scheduling endpoints — authenticated doctor only.
// Covers: schedule blocks (OPD, surgery, ward round, etc.), leaves, today view.
//
// Mount in server.js as:
//   app.use('/api/v1/doctors', require('./routes/doctor-schedule.routes'));
//
// This file adds:
//   GET    /doctors/my-schedule           — get own schedule blocks
//   POST   /doctors/my-schedule           — create a block
//   PUT    /doctors/my-schedule/:id       — update a block
//   DELETE /doctors/my-schedule/:id       — soft-delete a block
//   GET    /doctors/my-leaves             — get own leave requests
//   POST   /doctors/my-leaves             — submit leave request
//   GET    /doctors/today-schedule        — today's blocks + appointments

const express  = require('express');
const router   = express.Router();
const { query, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const AppError = require('../utils/AppError');
const dsCtrl   = require('../controllers/doctorSchedule.controller');

// All routes require authenticated doctor (or admin who can proxy)
router.use(authenticate);

const ok = (res, data, message) =>
  res.json({ success: true, data, ...(message && { message }) });

// ─── Helper: resolve DoctorProfiles.Id from req.user.id ──────────────────────
const getDoctorProfileId = async (userId) => {
  const r = await query(
    `SELECT Id, HospitalId FROM dbo.DoctorProfiles WHERE UserId = @UserId`,
    { UserId: { type: sql.BigInt, value: parseInt(userId) } }
  );
  if (!r.recordset.length) throw new AppError('Doctor profile not found.', 404);
  return r.recordset[0];
};

// ═════════════════════════════════════════════════════════════════════════════
// DOCTOR SCHEDULE BLOCKS
// Table: DoctorScheduleBlocks (see CREATE TABLE below in comments)
//
// CREATE TABLE dbo.DoctorScheduleBlocks (
//   Id               BIGINT IDENTITY PRIMARY KEY,
//   DoctorId         BIGINT NOT NULL REFERENCES dbo.DoctorProfiles(Id),
//   HospitalId       BIGINT NOT NULL,
//   BlockType        NVARCHAR(20)  NOT NULL DEFAULT 'opd',
//     -- 'opd','surgery','ward_round','teleconsult','emergency','teaching','break','on_call'
//   DayOfWeek        TINYINT NOT NULL,  -- 0=Sun … 6=Sat
//   StartTime        NVARCHAR(8)  NOT NULL,
//   EndTime          NVARCHAR(8)  NOT NULL,
//   Title            NVARCHAR(200) NULL,
//   Location         NVARCHAR(200) NULL,
//   Notes            NVARCHAR(MAX) NULL,
//   SlotDurationMins SMALLINT NULL,
//   MaxPatients      SMALLINT NULL,
//   PatientCount     SMALLINT NULL,
//   Recurrence       NVARCHAR(20) NOT NULL DEFAULT 'weekly',
//     -- 'none','daily','weekly','weekdays'
//   EffectiveFrom    DATE NOT NULL DEFAULT GETUTCDATE(),
//   EffectiveTo      DATE NULL,
//   IsActive         BIT NOT NULL DEFAULT 1,
//   CreatedAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
//   UpdatedAt        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
//   CreatedBy        BIGINT NULL
// );
// ═════════════════════════════════════════════════════════════════════════════

// GET /my-schedule — doctor views their admin-assigned schedule (DoctorSchedules table)
// NOTE: overrides the old DoctorScheduleBlocks version above
router.get('/my-schedule', authorize('doctor','admin','superadmin'), (...args) => dsCtrl.getMySchedule(...args));

// POST /doctors/my-schedule
router.post('/my-schedule', authorize('doctor','admin','superadmin'), async (req, res, next) => {
  try {
    const { Id: doctorId, HospitalId: hospitalId } = await getDoctorProfileId(req.user.id);

    const {
      BlockType, DayOfWeek, StartTime, EndTime,
      Title, Location, Notes,
      SlotDurationMins, MaxPatients, PatientCount,
      Recurrence, EffectiveFrom, EffectiveTo,
    } = req.body;

    if (DayOfWeek === undefined || !StartTime || !EndTime)
      throw new AppError('DayOfWeek, StartTime and EndTime are required.', 400);

    // Overlap check within same day
    const overlap = await query(
      `SELECT Id FROM dbo.DoctorScheduleBlocks
       WHERE DoctorId  = @DoctorId
         AND DayOfWeek = @DayOfWeek
         AND IsActive  = 1
         AND StartTime < @EndTime
         AND EndTime   > @StartTime`,
      {
        DoctorId:  { type: sql.BigInt,      value: doctorId },
        DayOfWeek: { type: sql.TinyInt,     value: Number(DayOfWeek) },
        StartTime: { type: sql.NVarChar(8), value: StartTime },
        EndTime:   { type: sql.NVarChar(8), value: EndTime },
      }
    );
    if (overlap.recordset.length) {
      throw new AppError('This time block overlaps with an existing schedule entry.', 409);
    }

    const result = await query(
      `INSERT INTO dbo.DoctorScheduleBlocks
         (DoctorId, HospitalId, BlockType, DayOfWeek, StartTime, EndTime,
          Title, Location, Notes, SlotDurationMins, MaxPatients, PatientCount,
          Recurrence, EffectiveFrom, EffectiveTo, CreatedBy)
       OUTPUT INSERTED.*
       VALUES
         (@DoctorId, @HospitalId, @BlockType, @DayOfWeek, @StartTime, @EndTime,
          @Title, @Location, @Notes, @SlotDurationMins, @MaxPatients, @PatientCount,
          @Recurrence, @EffectiveFrom, @EffectiveTo, @CreatedBy)`,
      {
        DoctorId:        { type: sql.BigInt,         value: doctorId },
        HospitalId:      { type: sql.BigInt,         value: hospitalId },
        BlockType:       { type: sql.NVarChar(20),   value: BlockType       || 'opd' },
        DayOfWeek:       { type: sql.TinyInt,        value: Number(DayOfWeek) },
        StartTime:       { type: sql.NVarChar(8),    value: StartTime },
        EndTime:         { type: sql.NVarChar(8),    value: EndTime },
        Title:           { type: sql.NVarChar(200),  value: Title           || null },
        Location:        { type: sql.NVarChar(200),  value: Location        || null },
        Notes:           { type: sql.NVarChar(sql.MAX), value: Notes         || null },
        SlotDurationMins:{ type: sql.SmallInt,       value: SlotDurationMins ? parseInt(SlotDurationMins) : null },
        MaxPatients:     { type: sql.SmallInt,       value: MaxPatients     ? parseInt(MaxPatients)     : null },
        PatientCount:    { type: sql.SmallInt,       value: PatientCount    ? parseInt(PatientCount)    : null },
        Recurrence:      { type: sql.NVarChar(20),   value: Recurrence      || 'weekly' },
        EffectiveFrom:   { type: sql.Date,           value: EffectiveFrom   || new Date() },
        EffectiveTo:     { type: sql.Date,           value: EffectiveTo     || null },
        CreatedBy:       { type: sql.BigInt,         value: parseInt(req.user.id) },
      }
    );
    ok(res, result.recordset[0], 'Schedule block created.');
  } catch (err) { next(err); }
});

// PUT /doctors/my-schedule/:id
router.put('/my-schedule/:id', authorize('doctor','admin','superadmin'), async (req, res, next) => {
  try {
    const { Id: doctorId } = await getDoctorProfileId(req.user.id);
    const blockId = parseInt(req.params.id);

    const {
      BlockType, DayOfWeek, StartTime, EndTime,
      Title, Location, Notes,
      SlotDurationMins, MaxPatients, PatientCount,
      Recurrence, EffectiveFrom, EffectiveTo, IsActive,
    } = req.body;

    // Overlap check (excluding self)
    if (StartTime && EndTime) {
      const overlap = await query(
        `SELECT Id FROM dbo.DoctorScheduleBlocks
         WHERE DoctorId  = @DoctorId
           AND DayOfWeek = @DayOfWeek
           AND IsActive  = 1
           AND Id        <> @BlockId
           AND StartTime  < @EndTime
           AND EndTime    > @StartTime`,
        {
          DoctorId:  { type: sql.BigInt,      value: doctorId },
          DayOfWeek: { type: sql.TinyInt,     value: Number(DayOfWeek) },
          BlockId:   { type: sql.BigInt,      value: blockId },
          StartTime: { type: sql.NVarChar(8), value: StartTime },
          EndTime:   { type: sql.NVarChar(8), value: EndTime },
        }
      );
      if (overlap.recordset.length)
        throw new AppError('This time block overlaps with another schedule entry.', 409);
    }

    const result = await query(
      `UPDATE dbo.DoctorScheduleBlocks
       SET BlockType        = @BlockType,
           DayOfWeek        = @DayOfWeek,
           StartTime        = @StartTime,
           EndTime          = @EndTime,
           Title            = @Title,
           Location         = @Location,
           Notes            = @Notes,
           SlotDurationMins = @SlotDurationMins,
           MaxPatients      = @MaxPatients,
           PatientCount     = @PatientCount,
           Recurrence       = @Recurrence,
           EffectiveFrom    = @EffectiveFrom,
           EffectiveTo      = @EffectiveTo,
           IsActive         = @IsActive,
           UpdatedAt        = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE Id = @BlockId AND DoctorId = @DoctorId`,
      {
        BlockId:         { type: sql.BigInt,          value: blockId },
        DoctorId:        { type: sql.BigInt,          value: doctorId },
        BlockType:       { type: sql.NVarChar(20),    value: BlockType        || 'opd' },
        DayOfWeek:       { type: sql.TinyInt,         value: Number(DayOfWeek) },
        StartTime:       { type: sql.NVarChar(8),     value: StartTime },
        EndTime:         { type: sql.NVarChar(8),     value: EndTime },
        Title:           { type: sql.NVarChar(200),   value: Title            || null },
        Location:        { type: sql.NVarChar(200),   value: Location         || null },
        Notes:           { type: sql.NVarChar(sql.MAX), value: Notes           || null },
        SlotDurationMins:{ type: sql.SmallInt,        value: SlotDurationMins ? parseInt(SlotDurationMins) : null },
        MaxPatients:     { type: sql.SmallInt,        value: MaxPatients      ? parseInt(MaxPatients)      : null },
        PatientCount:    { type: sql.SmallInt,        value: PatientCount     ? parseInt(PatientCount)     : null },
        Recurrence:      { type: sql.NVarChar(20),    value: Recurrence       || 'weekly' },
        EffectiveFrom:   { type: sql.Date,            value: EffectiveFrom    || new Date() },
        EffectiveTo:     { type: sql.Date,            value: EffectiveTo      || null },
        IsActive:        { type: sql.Bit,             value: IsActive !== undefined ? IsActive : 1 },
      }
    );
    if (!result.recordset.length) throw new AppError('Block not found or not owned by you.', 404);
    ok(res, result.recordset[0], 'Schedule block updated.');
  } catch (err) { next(err); }
});

// DELETE /doctors/my-schedule/:id  (soft delete)
router.delete('/my-schedule/:id', authorize('doctor','admin','superadmin'), async (req, res, next) => {
  try {
    const { Id: doctorId } = await getDoctorProfileId(req.user.id);
    const blockId = parseInt(req.params.id);

    await query(
      `UPDATE dbo.DoctorScheduleBlocks
       SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
       WHERE Id = @BlockId AND DoctorId = @DoctorId`,
      {
        BlockId:  { type: sql.BigInt, value: blockId },
        DoctorId: { type: sql.BigInt, value: doctorId },
      }
    );
    ok(res, { deleted: true });
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// DOCTOR LEAVES (self-service)
// ═════════════════════════════════════════════════════════════════════════════

// GET /doctors/my-leaves
router.get('/my-leaves', authorize('doctor','admin','superadmin'), async (req, res, next) => {
  try {
    const { Id: doctorId } = await getDoctorProfileId(req.user.id);
    const { status } = req.query;

    const result = await query(
      `SELECT * FROM dbo.DoctorLeaves
       WHERE DoctorId = @DoctorId
         AND (@Status IS NULL OR Status = @Status)
       ORDER BY LeaveDate DESC`,
      {
        DoctorId: { type: sql.BigInt,       value: doctorId },
        Status:   { type: sql.NVarChar(20), value: status || null },
      }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

// POST /doctors/my-leaves
router.post('/my-leaves', authorize('doctor','admin','superadmin'), async (req, res, next) => {
  try {
    const { Id: doctorId, HospitalId: hospitalId } = await getDoctorProfileId(req.user.id);

    const { LeaveDate, EndDate, LeaveType, StartTime, EndTime, Reason, IsEmergency } = req.body;
    if (!LeaveDate || !Reason?.trim())
      throw new AppError('LeaveDate and Reason are required.', 400);

    // If multi-day leave, create one row per date
    const start = new Date(LeaveDate);
    const end   = EndDate ? new Date(EndDate) : new Date(LeaveDate);
    const inserted = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const r = await query(
        `INSERT INTO dbo.DoctorLeaves
           (HospitalId, DoctorId, LeaveDate, LeaveType, StartTime, EndTime,
            Reason, Status, CreatedBy)
         OUTPUT INSERTED.*
         VALUES
           (@HospitalId, @DoctorId, @LeaveDate, @LeaveType, @StartTime, @EndTime,
            @Reason, 'pending', @CreatedBy)`,
        {
          HospitalId: { type: sql.BigInt,        value: hospitalId },
          DoctorId:   { type: sql.BigInt,        value: doctorId },
          LeaveDate:  { type: sql.Date,          value: dateStr },
          LeaveType:  { type: sql.NVarChar(30),  value: LeaveType  || 'full_day' },
          StartTime:  { type: sql.NVarChar(8),   value: StartTime  || null },
          EndTime:    { type: sql.NVarChar(8),   value: EndTime    || null },
          Reason:     { type: sql.NVarChar(500), value: Reason.trim() },
          CreatedBy:  { type: sql.BigInt,        value: parseInt(req.user.id) },
        }
      );
      inserted.push(r.recordset[0]);
    }

    ok(res, inserted.length === 1 ? inserted[0] : inserted, 'Leave request submitted successfully.');
  } catch (err) { next(err); }
});

// ═════════════════════════════════════════════════════════════════════════════
// TODAY'S COMBINED VIEW
// GET /doctors/today-schedule
// Returns: schedule blocks for today + today's appointments
// ═════════════════════════════════════════════════════════════════════════════
router.get('/today-schedule', authorize('doctor','admin','superadmin'), async (req, res, next) => {
  try {
    const { Id: doctorId, HospitalId: hospitalId } = await getDoctorProfileId(req.user.id);
    const todayDow  = new Date().getDay();
    const todayDate = new Date().toISOString().slice(0, 10);

    const [blocksRes, apptsRes] = await Promise.all([
      query(
        `SELECT * FROM dbo.DoctorScheduleBlocks
         WHERE DoctorId  = @DoctorId
           AND DayOfWeek = @DayOfWeek
           AND IsActive  = 1
           AND EffectiveFrom <= @Today
           AND (EffectiveTo IS NULL OR EffectiveTo >= @Today)
         ORDER BY StartTime`,
        {
          DoctorId:  { type: sql.BigInt,   value: doctorId },
          DayOfWeek: { type: sql.TinyInt,  value: todayDow },
          Today:     { type: sql.Date,     value: todayDate },
        }
      ),
      query(
        `SELECT
           a.Id, a.AppointmentNo, a.AppointmentDate, a.AppointmentTime,
           a.VisitType, a.Status, a.Priority, a.Reason, a.TokenNumber,
           pp.FirstName + ' ' + pp.LastName AS PatientName,
           pp.UHID, pp.Phone AS PatientPhone, pp.Gender, pp.DateOfBirth,
           pp.BloodGroup
         FROM dbo.Appointments a
         JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
         WHERE a.DoctorId        = @DoctorId
           AND a.AppointmentDate = @Today
           AND a.Status NOT IN ('Cancelled','NoShow')
         ORDER BY a.AppointmentTime`,
        {
          DoctorId: { type: sql.BigInt, value: doctorId },
          Today:    { type: sql.Date,   value: todayDate },
        }
      ),
    ]);

    ok(res, {
      date:         todayDate,
      dayOfWeek:    todayDow,
      blocks:       blocksRes.recordset,
      appointments: apptsRes.recordset,
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN-ASSIGNED DOCTOR SCHEDULES (uses DoctorSchedules table)
// ═══════════════════════════════════════════════════════════════════════
// Admin routes — manage any doctor's schedule
router.get('/doctor-schedules',        authenticate, authorize('admin','superadmin','auditor'), dsCtrl.getAllDoctorSchedules);
router.get('/doctor-schedules/:id',    authenticate, authorize('admin','superadmin','auditor'), dsCtrl.getDoctorScheduleById);
router.post('/doctor-schedules',       authenticate, authorize('admin','superadmin'),           dsCtrl.createDoctorSchedule);
router.put('/doctor-schedules/:id',    authenticate, authorize('admin','superadmin'),           dsCtrl.updateDoctorSchedule);
router.delete('/doctor-schedules/:id', authenticate, authorize('admin','superadmin'),           dsCtrl.deleteDoctorSchedule);

// Doctors list for dropdown (admin only)
router.get('/doctors-list',            authenticate, authorize('admin','superadmin','auditor'), dsCtrl.getDoctorsList);


module.exports = router;