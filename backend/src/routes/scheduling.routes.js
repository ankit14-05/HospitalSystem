// src/routes/scheduling.routes.js
const express  = require('express');
const router   = express.Router();
const { query, sql } = require('../config/database');   // same pattern as auth.middleware.js
const { authenticate, authorize } = require('../middleware/auth.middleware');
const AppError = require('../utils/AppError');

// ── Helper ────────────────────────────────────────────────────────────────────
const ok = (res, data, meta) =>
  res.json({ success: true, data, ...(meta && { meta }) });

// All scheduling routes require an authenticated admin or superadmin
router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

// ════════════════════════════════════════════════════════════════════════════
// OPD ROOMS
// ════════════════════════════════════════════════════════════════════════════

router.get('/rooms', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT r.*, d.Name AS DepartmentName
       FROM dbo.OpdRooms r
       JOIN dbo.Departments d ON d.Id = r.DepartmentId
       WHERE r.HospitalId = @HospitalId AND r.IsActive = 1
       ORDER BY r.RoomNumber`,
      { HospitalId: { type: sql.BigInt, value: req.user.hospitalId } }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

router.post('/rooms', async (req, res, next) => {
  try {
    const { DepartmentId, RoomNumber, RoomName, Floor, Notes } = req.body;
    if (!DepartmentId || !RoomNumber)
      throw new AppError('DepartmentId and RoomNumber are required.', 400);
    const result = await query(
      `INSERT INTO dbo.OpdRooms
         (HospitalId, DepartmentId, RoomNumber, RoomName, Floor, Notes, CreatedBy)
       OUTPUT INSERTED.*
       VALUES (@HospitalId,@DepartmentId,@RoomNumber,@RoomName,@Floor,@Notes,@CreatedBy)`,
      {
        HospitalId:   { type: sql.BigInt,        value: req.user.hospitalId },
        DepartmentId: { type: sql.BigInt,        value: DepartmentId },
        RoomNumber:   { type: sql.NVarChar(20),  value: RoomNumber },
        RoomName:     { type: sql.NVarChar(100), value: RoomName || null },
        Floor:        { type: sql.NVarChar(20),  value: Floor    || null },
        Notes:        { type: sql.NVarChar(500), value: Notes    || null },
        CreatedBy:    { type: sql.BigInt,        value: req.user.id },
      }
    );
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.patch('/rooms/:id', async (req, res, next) => {
  try {
    const { RoomName, Floor, Notes, IsActive } = req.body;
    const result = await query(
      `UPDATE dbo.OpdRooms
       SET RoomName=@RoomName, Floor=@Floor, Notes=@Notes,
           IsActive=@IsActive, UpdatedAt=GETUTCDATE()
       OUTPUT INSERTED.*
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:         { type: sql.BigInt,        value: req.params.id },
        HospitalId: { type: sql.BigInt,        value: req.user.hospitalId },
        RoomName:   { type: sql.NVarChar(100), value: RoomName ?? null },
        Floor:      { type: sql.NVarChar(20),  value: Floor    ?? null },
        Notes:      { type: sql.NVarChar(500), value: Notes    ?? null },
        IsActive:   { type: sql.Bit,           value: IsActive ?? 1 },
      }
    );
    if (!result.recordset.length) throw new AppError('Room not found.', 404);
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// DOCTOR SCHEDULES
// ════════════════════════════════════════════════════════════════════════════

router.get('/doctor-schedules', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM dbo.V_DoctorScheduleSummary
       WHERE HospitalId = @HospitalId
       ORDER BY DayOfWeek, StartTime`,
      { HospitalId: { type: sql.BigInt, value: req.user.hospitalId } }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

router.post('/doctor-schedules', async (req, res, next) => {
  try {
    const { DoctorId, OpdRoomId, DayOfWeek, StartTime, EndTime,
            SlotDurationMins, VisitType, EffectiveFrom, EffectiveTo, Notes } = req.body;
    if (!DoctorId || DayOfWeek === undefined || !StartTime || !EndTime || !EffectiveFrom)
      throw new AppError('DoctorId, DayOfWeek, StartTime, EndTime, EffectiveFrom are required.', 400);
    const result = await query(
      `INSERT INTO dbo.DoctorSchedules
         (HospitalId,DoctorId,OpdRoomId,DayOfWeek,StartTime,EndTime,
          SlotDurationMins,VisitType,EffectiveFrom,EffectiveTo,Notes,CreatedBy)
       OUTPUT INSERTED.*
       VALUES
         (@HospitalId,@DoctorId,@OpdRoomId,@DayOfWeek,@StartTime,@EndTime,
          @SlotDurationMins,@VisitType,@EffectiveFrom,@EffectiveTo,@Notes,@CreatedBy)`,
      {
        HospitalId:       { type: sql.BigInt,        value: req.user.hospitalId },
        DoctorId:         { type: sql.BigInt,        value: DoctorId },
        OpdRoomId:        { type: sql.BigInt,        value: OpdRoomId        || null },
        DayOfWeek:        { type: sql.TinyInt,       value: DayOfWeek },
        StartTime:        { type: sql.NVarChar(8),   value: StartTime },
        EndTime:          { type: sql.NVarChar(8),   value: EndTime },
        SlotDurationMins: { type: sql.SmallInt,      value: SlotDurationMins || 15 },
        VisitType:        { type: sql.NVarChar(20),  value: VisitType        || 'opd' },
        EffectiveFrom:    { type: sql.Date,          value: EffectiveFrom },
        EffectiveTo:      { type: sql.Date,          value: EffectiveTo      || null },
        Notes:            { type: sql.NVarChar(500), value: Notes            || null },
        CreatedBy:        { type: sql.BigInt,        value: req.user.id },
      }
    );
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.patch('/doctor-schedules/:id', async (req, res, next) => {
  try {
    const { OpdRoomId, StartTime, EndTime, SlotDurationMins,
            VisitType, EffectiveTo, IsActive, Notes } = req.body;
    const result = await query(
      `UPDATE dbo.DoctorSchedules
       SET OpdRoomId=@OpdRoomId, StartTime=@StartTime, EndTime=@EndTime,
           SlotDurationMins=@SlotDurationMins, VisitType=@VisitType,
           EffectiveTo=@EffectiveTo, IsActive=@IsActive,
           Notes=@Notes, UpdatedAt=GETUTCDATE(), UpdatedBy=@UpdatedBy
       OUTPUT INSERTED.*
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:               { type: sql.BigInt,        value: req.params.id },
        HospitalId:       { type: sql.BigInt,        value: req.user.hospitalId },
        OpdRoomId:        { type: sql.BigInt,        value: OpdRoomId        ?? null },
        StartTime:        { type: sql.NVarChar(8),   value: StartTime },
        EndTime:          { type: sql.NVarChar(8),   value: EndTime },
        SlotDurationMins: { type: sql.SmallInt,      value: SlotDurationMins || 15 },
        VisitType:        { type: sql.NVarChar(20),  value: VisitType        || 'opd' },
        EffectiveTo:      { type: sql.Date,          value: EffectiveTo      ?? null },
        IsActive:         { type: sql.Bit,           value: IsActive         ?? 1 },
        Notes:            { type: sql.NVarChar(500), value: Notes            ?? null },
        UpdatedBy:        { type: sql.BigInt,        value: req.user.id },
      }
    );
    if (!result.recordset.length) throw new AppError('Schedule not found.', 404);
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.delete('/doctor-schedules/:id', async (req, res, next) => {
  try {
    await query(
      `UPDATE dbo.DoctorSchedules SET IsActive=0, UpdatedAt=GETUTCDATE(), UpdatedBy=@UpdatedBy
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:         { type: sql.BigInt, value: req.params.id },
        HospitalId: { type: sql.BigInt, value: req.user.hospitalId },
        UpdatedBy:  { type: sql.BigInt, value: req.user.id },
      }
    );
    ok(res, { deleted: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// STAFF SHIFTS
// ════════════════════════════════════════════════════════════════════════════

router.get('/staff-shifts', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ss.*, u.FirstName + ' ' + u.LastName AS StaffName,
              sp.Role, dep.Name AS DepartmentName
       FROM dbo.StaffSchedules ss
       JOIN dbo.StaffProfiles sp     ON sp.Id  = ss.StaffId
       JOIN dbo.Users u              ON u.Id   = sp.UserId
       LEFT JOIN dbo.Departments dep ON dep.Id = sp.DepartmentId
       WHERE ss.HospitalId = @HospitalId AND ss.IsActive = 1
       ORDER BY ss.DayOfWeek, ss.StartTime`,
      { HospitalId: { type: sql.BigInt, value: req.user.hospitalId } }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

router.post('/staff-shifts', async (req, res, next) => {
  try {
    const { StaffId, DayOfWeek, ShiftType, StartTime, EndTime,
            BreakStartTime, BreakEndTime, EffectiveFrom, EffectiveTo, Notes } = req.body;
    if (!StaffId || DayOfWeek === undefined || !StartTime || !EndTime || !EffectiveFrom)
      throw new AppError('StaffId, DayOfWeek, StartTime, EndTime, EffectiveFrom are required.', 400);
    const result = await query(
      `INSERT INTO dbo.StaffSchedules
         (HospitalId,StaffId,DayOfWeek,ShiftType,StartTime,EndTime,
          BreakStartTime,BreakEndTime,EffectiveFrom,EffectiveTo,Notes,CreatedBy)
       OUTPUT INSERTED.*
       VALUES
         (@HospitalId,@StaffId,@DayOfWeek,@ShiftType,@StartTime,@EndTime,
          @BreakStartTime,@BreakEndTime,@EffectiveFrom,@EffectiveTo,@Notes,@CreatedBy)`,
      {
        HospitalId:     { type: sql.BigInt,        value: req.user.hospitalId },
        StaffId:        { type: sql.BigInt,        value: StaffId },
        DayOfWeek:      { type: sql.TinyInt,       value: DayOfWeek },
        ShiftType:      { type: sql.NVarChar(20),  value: ShiftType      || 'morning' },
        StartTime:      { type: sql.NVarChar(8),   value: StartTime },
        EndTime:        { type: sql.NVarChar(8),   value: EndTime },
        BreakStartTime: { type: sql.NVarChar(8),   value: BreakStartTime || null },
        BreakEndTime:   { type: sql.NVarChar(8),   value: BreakEndTime   || null },
        EffectiveFrom:  { type: sql.Date,          value: EffectiveFrom },
        EffectiveTo:    { type: sql.Date,          value: EffectiveTo    || null },
        Notes:          { type: sql.NVarChar(500), value: Notes          || null },
        CreatedBy:      { type: sql.BigInt,        value: req.user.id },
      }
    );
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.patch('/staff-shifts/:id', async (req, res, next) => {
  try {
    const { ShiftType, StartTime, EndTime, BreakStartTime,
            BreakEndTime, EffectiveTo, IsActive, Notes } = req.body;
    const result = await query(
      `UPDATE dbo.StaffSchedules
       SET ShiftType=@ShiftType, StartTime=@StartTime, EndTime=@EndTime,
           BreakStartTime=@BreakStartTime, BreakEndTime=@BreakEndTime,
           EffectiveTo=@EffectiveTo, IsActive=@IsActive,
           Notes=@Notes, UpdatedAt=GETUTCDATE(), UpdatedBy=@UpdatedBy
       OUTPUT INSERTED.*
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:             { type: sql.BigInt,        value: req.params.id },
        HospitalId:     { type: sql.BigInt,        value: req.user.hospitalId },
        ShiftType:      { type: sql.NVarChar(20),  value: ShiftType      || 'morning' },
        StartTime:      { type: sql.NVarChar(8),   value: StartTime },
        EndTime:        { type: sql.NVarChar(8),   value: EndTime },
        BreakStartTime: { type: sql.NVarChar(8),   value: BreakStartTime ?? null },
        BreakEndTime:   { type: sql.NVarChar(8),   value: BreakEndTime   ?? null },
        EffectiveTo:    { type: sql.Date,          value: EffectiveTo    ?? null },
        IsActive:       { type: sql.Bit,           value: IsActive       ?? 1 },
        Notes:          { type: sql.NVarChar(500), value: Notes          ?? null },
        UpdatedBy:      { type: sql.BigInt,        value: req.user.id },
      }
    );
    if (!result.recordset.length) throw new AppError('Staff shift not found.', 404);
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.delete('/staff-shifts/:id', async (req, res, next) => {
  try {
    await query(
      `UPDATE dbo.StaffSchedules SET IsActive=0, UpdatedAt=GETUTCDATE(), UpdatedBy=@UpdatedBy
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:         { type: sql.BigInt, value: req.params.id },
        HospitalId: { type: sql.BigInt, value: req.user.hospitalId },
        UpdatedBy:  { type: sql.BigInt, value: req.user.id },
      }
    );
    ok(res, { deleted: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// APPOINTMENT SLOTS
// ════════════════════════════════════════════════════════════════════════════

// IMPORTANT: /slots/today/summary must come before /slots/:id routes
router.get('/slots/today/summary', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM dbo.V_TodaySlotSummary
       WHERE HospitalId = @HospitalId ORDER BY DoctorName`,
      { HospitalId: { type: sql.BigInt, value: req.user.hospitalId } }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

router.get('/slots', async (req, res, next) => {
  try {
    const { doctorId, date, status } = req.query;
    const result = await query(
      `SELECT s.*, u.FirstName + ' ' + u.LastName AS DoctorName, r.RoomNumber
       FROM dbo.AppointmentSlots s
       JOIN dbo.DoctorProfiles dp ON dp.Id = s.DoctorId
       JOIN dbo.Users u           ON u.Id  = dp.UserId
       LEFT JOIN dbo.OpdRooms r   ON r.Id  = s.OpdRoomId
       WHERE s.HospitalId = @HospitalId
         AND s.SlotDate   = @SlotDate
         AND (@DoctorId   IS NULL OR s.DoctorId = @DoctorId)
         AND (@Status     IS NULL OR s.Status   = @Status)
       ORDER BY s.StartTime`,
      {
        HospitalId: { type: sql.BigInt,       value: req.user.hospitalId },
        SlotDate:   { type: sql.Date,         value: date     || new Date().toISOString().split('T')[0] },
        DoctorId:   { type: sql.BigInt,       value: doctorId || null },
        Status:     { type: sql.NVarChar(20), value: status   || null },
      }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

router.post('/slots/generate', async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate)
      throw new AppError('fromDate and toDate are required.', 400);
    await query(
      `EXEC dbo.sp_GenerateDoctorSlots @HospitalId=@HospitalId, @FromDate=@FromDate, @ToDate=@ToDate`,
      {
        HospitalId: { type: sql.BigInt, value: req.user.hospitalId },
        FromDate:   { type: sql.Date,   value: fromDate },
        ToDate:     { type: sql.Date,   value: toDate },
      }
    );
    ok(res, { generated: true, fromDate, toDate });
  } catch (err) { next(err); }
});

router.patch('/slots/:id/block', async (req, res, next) => {
  try {
    const { blocked, reason } = req.body;
    const result = await query(
      `UPDATE dbo.AppointmentSlots
       SET Status=@Status, BlockedReason=@BlockedReason, UpdatedAt=GETUTCDATE()
       OUTPUT INSERTED.*
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:            { type: sql.BigInt,        value: req.params.id },
        HospitalId:    { type: sql.BigInt,        value: req.user.hospitalId },
        Status:        { type: sql.NVarChar(20),  value: blocked ? 'blocked' : 'available' },
        BlockedReason: { type: sql.NVarChar(200), value: reason  || null },
      }
    );
    if (!result.recordset.length) throw new AppError('Slot not found.', 404);
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// LEAVES  (combined doctor + staff)
// ════════════════════════════════════════════════════════════════════════════

router.get('/leaves', async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const hospId = req.user.hospitalId;

    const [doctorRes, staffRes] = await Promise.all([
      (!type || type === 'doctor') ? query(
        `SELECT dl.Id, dl.DoctorId AS PersonId, 'doctor' AS Type,
                u.FirstName + ' ' + u.LastName AS Name,
                dl.LeaveDate, dl.LeaveType, dl.Reason, dl.Status, dl.CreatedAt
         FROM dbo.DoctorLeaves dl
         JOIN dbo.DoctorProfiles dp ON dp.Id = dl.DoctorId
         JOIN dbo.Users u           ON u.Id  = dp.UserId
         WHERE dl.HospitalId = @HospitalId
           AND (@Status IS NULL OR dl.Status = @Status)
         ORDER BY dl.LeaveDate`,
        {
          HospitalId: { type: sql.BigInt,       value: hospId },
          Status:     { type: sql.NVarChar(20), value: status || null },
        }
      ) : Promise.resolve({ recordset: [] }),

      (!type || type === 'staff') ? query(
        `SELECT sl.Id, sl.StaffId AS PersonId, 'staff' AS Type,
                u.FirstName + ' ' + u.LastName AS Name,
                sl.LeaveDate, sl.LeaveType, sl.Reason, sl.Status, sl.CreatedAt
         FROM dbo.StaffLeaves sl
         JOIN dbo.StaffProfiles sp ON sp.Id = sl.StaffId
         JOIN dbo.Users u          ON u.Id  = sp.UserId
         WHERE sl.HospitalId = @HospitalId
           AND (@Status IS NULL OR sl.Status = @Status)
         ORDER BY sl.LeaveDate`,
        {
          HospitalId: { type: sql.BigInt,       value: hospId },
          Status:     { type: sql.NVarChar(20), value: status || null },
        }
      ) : Promise.resolve({ recordset: [] }),
    ]);

    const combined = [
      ...doctorRes.recordset,
      ...staffRes.recordset,
    ].sort((a, b) => new Date(a.LeaveDate) - new Date(b.LeaveDate));

    ok(res, combined);
  } catch (err) { next(err); }
});

router.post('/doctor-leaves', async (req, res, next) => {
  try {
    const { DoctorId, LeaveDate, LeaveType, StartTime, EndTime, Reason } = req.body;
    if (!DoctorId || !LeaveDate)
      throw new AppError('DoctorId and LeaveDate are required.', 400);
    const result = await query(
      `INSERT INTO dbo.DoctorLeaves
         (HospitalId,DoctorId,LeaveDate,LeaveType,StartTime,EndTime,Reason,CreatedBy)
       OUTPUT INSERTED.*
       VALUES (@HospitalId,@DoctorId,@LeaveDate,@LeaveType,@StartTime,@EndTime,@Reason,@CreatedBy)`,
      {
        HospitalId: { type: sql.BigInt,        value: req.user.hospitalId },
        DoctorId:   { type: sql.BigInt,        value: DoctorId },
        LeaveDate:  { type: sql.Date,          value: LeaveDate },
        LeaveType:  { type: sql.NVarChar(30),  value: LeaveType || 'full_day' },
        StartTime:  { type: sql.NVarChar(8),   value: StartTime || null },
        EndTime:    { type: sql.NVarChar(8),   value: EndTime   || null },
        Reason:     { type: sql.NVarChar(500), value: Reason    || null },
        CreatedBy:  { type: sql.BigInt,        value: req.user.id },
      }
    );
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.patch('/doctor-leaves/:id', async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status))
      throw new AppError('status must be "approved" or "rejected".', 400);

    const result = await query(
      `UPDATE dbo.DoctorLeaves
       SET Status=@Status, RejectionReason=@RejectionReason, ApprovedBy=@ApprovedBy,
           ApprovedAt=CASE WHEN @Status='approved' THEN GETUTCDATE() ELSE NULL END,
           UpdatedAt=GETUTCDATE()
       OUTPUT INSERTED.*
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:              { type: sql.BigInt,        value: req.params.id },
        HospitalId:      { type: sql.BigInt,        value: req.user.hospitalId },
        Status:          { type: sql.NVarChar(20),  value: status },
        RejectionReason: { type: sql.NVarChar(500), value: rejectionReason || null },
        ApprovedBy:      { type: sql.BigInt,        value: req.user.id },
      }
    );
    if (!result.recordset.length) throw new AppError('Leave record not found.', 404);

    // Auto-block available slots when leave is approved
    if (status === 'approved') {
      const leave = result.recordset[0];
      await query(
        `UPDATE dbo.AppointmentSlots
         SET Status='on_leave', BlockedReason='Doctor on approved leave', UpdatedAt=GETUTCDATE()
         WHERE DoctorId=@DoctorId AND SlotDate=@LeaveDate AND Status='available'`,
        {
          DoctorId:  { type: sql.BigInt, value: leave.DoctorId },
          LeaveDate: { type: sql.Date,   value: leave.LeaveDate },
        }
      );
    }
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.post('/staff-leaves', async (req, res, next) => {
  try {
    const { StaffId, LeaveDate, LeaveType, StartTime, EndTime, Reason } = req.body;
    if (!StaffId || !LeaveDate)
      throw new AppError('StaffId and LeaveDate are required.', 400);
    const result = await query(
      `INSERT INTO dbo.StaffLeaves
         (HospitalId,StaffId,LeaveDate,LeaveType,StartTime,EndTime,Reason,CreatedBy)
       OUTPUT INSERTED.*
       VALUES (@HospitalId,@StaffId,@LeaveDate,@LeaveType,@StartTime,@EndTime,@Reason,@CreatedBy)`,
      {
        HospitalId: { type: sql.BigInt,        value: req.user.hospitalId },
        StaffId:    { type: sql.BigInt,        value: StaffId },
        LeaveDate:  { type: sql.Date,          value: LeaveDate },
        LeaveType:  { type: sql.NVarChar(30),  value: LeaveType || 'full_day' },
        StartTime:  { type: sql.NVarChar(8),   value: StartTime || null },
        EndTime:    { type: sql.NVarChar(8),   value: EndTime   || null },
        Reason:     { type: sql.NVarChar(500), value: Reason    || null },
        CreatedBy:  { type: sql.BigInt,        value: req.user.id },
      }
    );
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.patch('/staff-leaves/:id', async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status))
      throw new AppError('status must be "approved" or "rejected".', 400);
    const result = await query(
      `UPDATE dbo.StaffLeaves
       SET Status=@Status, RejectionReason=@RejectionReason, ApprovedBy=@ApprovedBy,
           ApprovedAt=CASE WHEN @Status='approved' THEN GETUTCDATE() ELSE NULL END,
           UpdatedAt=GETUTCDATE()
       OUTPUT INSERTED.*
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:              { type: sql.BigInt,        value: req.params.id },
        HospitalId:      { type: sql.BigInt,        value: req.user.hospitalId },
        Status:          { type: sql.NVarChar(20),  value: status },
        RejectionReason: { type: sql.NVarChar(500), value: rejectionReason || null },
        ApprovedBy:      { type: sql.BigInt,        value: req.user.id },
      }
    );
    if (!result.recordset.length) throw new AppError('Leave record not found.', 404);
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// OPD QUEUE
// NOTE: /queue/today MUST be defined before /queue/:id to avoid route clash
// ════════════════════════════════════════════════════════════════════════════

router.get('/queue/today', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT q.*,
              u.FirstName + ' ' + u.LastName AS DoctorName,
              ISNULL(q.PatientName, pp.FirstName + ' ' + pp.LastName) AS PatientDisplayName
       FROM dbo.OpdQueue q
       JOIN dbo.DoctorProfiles dp       ON dp.Id = q.DoctorId
       JOIN dbo.Users u                 ON u.Id  = dp.UserId
       LEFT JOIN dbo.PatientProfiles pp ON pp.Id = q.PatientId
       WHERE q.HospitalId  = @HospitalId
         AND q.QueueDate   = CAST(GETUTCDATE() AS DATE)
         AND q.QueueStatus NOT IN ('served','cancelled')
       ORDER BY
         CASE q.Priority WHEN 'urgent' THEN 1 WHEN 'vip' THEN 2 ELSE 3 END,
         q.TokenNumber`,
      { HospitalId: { type: sql.BigInt, value: req.user.hospitalId } }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

router.get('/queue', async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    const result = await query(
      `SELECT q.*,
              u.FirstName + ' ' + u.LastName AS DoctorName,
              ISNULL(q.PatientName, pp.FirstName + ' ' + pp.LastName) AS PatientDisplayName
       FROM dbo.OpdQueue q
       JOIN dbo.DoctorProfiles dp       ON dp.Id = q.DoctorId
       JOIN dbo.Users u                 ON u.Id  = dp.UserId
       LEFT JOIN dbo.PatientProfiles pp ON pp.Id = q.PatientId
       WHERE q.HospitalId = @HospitalId
         AND q.QueueDate  = @QueueDate
         AND (@DoctorId   IS NULL OR q.DoctorId = @DoctorId)
       ORDER BY q.TokenNumber`,
      {
        HospitalId: { type: sql.BigInt, value: req.user.hospitalId },
        QueueDate:  { type: sql.Date,   value: date     || new Date().toISOString().split('T')[0] },
        DoctorId:   { type: sql.BigInt, value: doctorId || null },
      }
    );
    ok(res, result.recordset);
  } catch (err) { next(err); }
});

router.post('/queue', async (req, res, next) => {
  try {
    const { DoctorId, AppointmentId, SlotId, PatientId, PatientName, Priority, Notes } = req.body;
    if (!DoctorId) throw new AppError('DoctorId is required.', 400);

    const queueDate = new Date().toISOString().split('T')[0];

    const tokenRes = await query(
      `SELECT ISNULL(MAX(TokenNumber), 0) + 1 AS NextToken
       FROM dbo.OpdQueue WHERE DoctorId=@DoctorId AND QueueDate=@QueueDate`,
      {
        DoctorId:  { type: sql.BigInt, value: DoctorId },
        QueueDate: { type: sql.Date,   value: queueDate },
      }
    );
    const tokenNumber = tokenRes.recordset[0].NextToken;

    const result = await query(
      `INSERT INTO dbo.OpdQueue
         (HospitalId,DoctorId,AppointmentId,SlotId,QueueDate,
          TokenNumber,PatientId,PatientName,Priority,Notes)
       OUTPUT INSERTED.*
       VALUES
         (@HospitalId,@DoctorId,@AppointmentId,@SlotId,@QueueDate,
          @TokenNumber,@PatientId,@PatientName,@Priority,@Notes)`,
      {
        HospitalId:    { type: sql.BigInt,        value: req.user.hospitalId },
        DoctorId:      { type: sql.BigInt,        value: DoctorId },
        AppointmentId: { type: sql.BigInt,        value: AppointmentId || null },
        SlotId:        { type: sql.BigInt,        value: SlotId        || null },
        QueueDate:     { type: sql.Date,          value: queueDate },
        TokenNumber:   { type: sql.SmallInt,      value: tokenNumber },
        PatientId:     { type: sql.BigInt,        value: PatientId     || null },
        PatientName:   { type: sql.NVarChar(200), value: PatientName   || null },
        Priority:      { type: sql.NVarChar(20),  value: Priority      || 'normal' },
        Notes:         { type: sql.NVarChar(500), value: Notes         || null },
      }
    );
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

router.patch('/queue/:id/status', async (req, res, next) => {
  try {
    const { queueStatus } = req.body;
    const valid = ['waiting','called','serving','served','skipped','cancelled'];
    if (!valid.includes(queueStatus))
      throw new AppError(`queueStatus must be one of: ${valid.join(', ')}`, 400);

    const result = await query(
      `UPDATE dbo.OpdQueue
       SET QueueStatus = @QueueStatus,
           CalledAt    = CASE WHEN @QueueStatus='called'  THEN GETUTCDATE() ELSE CalledAt  END,
           ServedAt    = CASE WHEN @QueueStatus='served'  THEN GETUTCDATE() ELSE ServedAt  END,
           WaitMinutes = CASE WHEN @QueueStatus='served'
                              THEN DATEDIFF(MINUTE, CreatedAt, GETUTCDATE())
                              ELSE WaitMinutes END,
           UpdatedAt   = GETUTCDATE()
       OUTPUT INSERTED.*
       WHERE Id=@Id AND HospitalId=@HospitalId`,
      {
        Id:          { type: sql.BigInt,       value: req.params.id },
        HospitalId:  { type: sql.BigInt,       value: req.user.hospitalId },
        QueueStatus: { type: sql.NVarChar(20), value: queueStatus },
      }
    );
    if (!result.recordset.length) throw new AppError('Queue entry not found.', 404);
    ok(res, result.recordset[0]);
  } catch (err) { next(err); }
});

module.exports = router;