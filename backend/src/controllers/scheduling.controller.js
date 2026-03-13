// backend/src/controllers/scheduling.controller.js
const { pool, sql } = require('../config/database');
const ApiResponse   = require('../utils/apiResponse');
const AppError      = require('../utils/AppError');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const getHospitalId = req => req.user?.hospitalId || req.user?.HospitalId;

// ─────────────────────────────────────────────────────────────────────────────
// OPD ROOMS
// ─────────────────────────────────────────────────────────────────────────────
exports.getRooms = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const db = await pool.connect();
    const result = await db.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT r.*, d.Name AS DepartmentName
        FROM dbo.OpdRooms r
        JOIN dbo.Departments d ON d.Id = r.DepartmentId
        WHERE r.HospitalId = @HospitalId AND r.IsActive = 1
        ORDER BY r.RoomNumber
      `);
    return res.json(ApiResponse.success(result.recordset, 'Rooms fetched'));
  } catch (err) { next(err); }
};

exports.createRoom = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { DepartmentId, RoomNumber, RoomName, Floor, Notes } = req.body;
    if (!DepartmentId || !RoomNumber) throw new AppError('DepartmentId and RoomNumber required', 400);
    const db = await pool.connect();
    const r = await db.request()
      .input('HospitalId',   sql.BigInt,      hospitalId)
      .input('DepartmentId', sql.BigInt,      DepartmentId)
      .input('RoomNumber',   sql.NVarChar(20), RoomNumber)
      .input('RoomName',     sql.NVarChar(100),RoomName  || null)
      .input('Floor',        sql.NVarChar(20), Floor     || null)
      .input('Notes',        sql.NVarChar(500),Notes     || null)
      .input('CreatedBy',    sql.BigInt,      req.user?.id || null)
      .query(`
        INSERT INTO dbo.OpdRooms (HospitalId,DepartmentId,RoomNumber,RoomName,Floor,Notes,CreatedBy)
        OUTPUT INSERTED.*
        VALUES (@HospitalId,@DepartmentId,@RoomNumber,@RoomName,@Floor,@Notes,@CreatedBy)
      `);
    return res.status(201).json(ApiResponse.success(r.recordset[0], 'Room created'));
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR SCHEDULES
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoctorSchedules = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const db = await pool.connect();
    const result = await db.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`SELECT * FROM dbo.V_DoctorScheduleSummary WHERE HospitalId = @HospitalId ORDER BY DayOfWeek, StartTime`);
    return res.json(ApiResponse.success(result.recordset, 'Doctor schedules fetched'));
  } catch (err) { next(err); }
};

exports.createDoctorSchedule = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { DoctorId, OpdRoomId, DayOfWeek, StartTime, EndTime,
            SlotDurationMins, VisitType, EffectiveFrom, EffectiveTo, Notes } = req.body;
    if (!DoctorId || DayOfWeek === undefined || !StartTime || !EndTime)
      throw new AppError('DoctorId, DayOfWeek, StartTime and EndTime are required', 400);
    const db = await pool.connect();
    const r = await db.request()
      .input('HospitalId',       sql.BigInt,       hospitalId)
      .input('DoctorId',         sql.BigInt,       DoctorId)
      .input('OpdRoomId',        sql.BigInt,       OpdRoomId        || null)
      .input('DayOfWeek',        sql.TinyInt,      Number(DayOfWeek))
      .input('StartTime',        sql.NVarChar(10), StartTime)
      .input('EndTime',          sql.NVarChar(10), EndTime)
      .input('SlotDurationMins', sql.SmallInt,     Number(SlotDurationMins) || 15)
      .input('VisitType',        sql.NVarChar(20), VisitType        || 'opd')
      .input('EffectiveFrom',    sql.Date,         EffectiveFrom    || new Date())
      .input('EffectiveTo',      sql.Date,         EffectiveTo      || null)
      .input('Notes',            sql.NVarChar(500),Notes            || null)
      .input('CreatedBy',        sql.BigInt,       req.user?.id     || null)
      .query(`
        INSERT INTO dbo.DoctorSchedules
          (HospitalId,DoctorId,OpdRoomId,DayOfWeek,StartTime,EndTime,
           SlotDurationMins,VisitType,EffectiveFrom,EffectiveTo,Notes,CreatedBy)
        OUTPUT INSERTED.*
        VALUES
          (@HospitalId,@DoctorId,@OpdRoomId,@DayOfWeek,@StartTime,@EndTime,
           @SlotDurationMins,@VisitType,@EffectiveFrom,@EffectiveTo,@Notes,@CreatedBy)
      `);
    return res.status(201).json(ApiResponse.success(r.recordset[0], 'Doctor schedule created'));
  } catch (err) { next(err); }
};

exports.updateDoctorSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalId(req);
    const { OpdRoomId, DayOfWeek, StartTime, EndTime,
            SlotDurationMins, VisitType, EffectiveFrom, EffectiveTo, Notes, IsActive } = req.body;
    const db = await pool.connect();
    const r = await db.request()
      .input('Id',               sql.BigInt,       id)
      .input('HospitalId',       sql.BigInt,       hospitalId)
      .input('OpdRoomId',        sql.BigInt,       OpdRoomId        || null)
      .input('DayOfWeek',        sql.TinyInt,      Number(DayOfWeek))
      .input('StartTime',        sql.NVarChar(10), StartTime)
      .input('EndTime',          sql.NVarChar(10), EndTime)
      .input('SlotDurationMins', sql.SmallInt,     Number(SlotDurationMins) || 15)
      .input('VisitType',        sql.NVarChar(20), VisitType        || 'opd')
      .input('EffectiveFrom',    sql.Date,         EffectiveFrom    || new Date())
      .input('EffectiveTo',      sql.Date,         EffectiveTo      || null)
      .input('Notes',            sql.NVarChar(500),Notes            || null)
      .input('IsActive',         sql.Bit,          IsActive !== undefined ? IsActive : 1)
      .input('UpdatedBy',        sql.BigInt,       req.user?.id     || null)
      .query(`
        UPDATE dbo.DoctorSchedules
        SET OpdRoomId=@OpdRoomId, DayOfWeek=@DayOfWeek, StartTime=@StartTime,
            EndTime=@EndTime, SlotDurationMins=@SlotDurationMins, VisitType=@VisitType,
            EffectiveFrom=@EffectiveFrom, EffectiveTo=@EffectiveTo, Notes=@Notes,
            IsActive=@IsActive, UpdatedBy=@UpdatedBy, UpdatedAt=GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE Id=@Id AND HospitalId=@HospitalId
      `);
    if (!r.recordset.length) throw new AppError('Schedule not found', 404);
    return res.json(ApiResponse.success(r.recordset[0], 'Doctor schedule updated'));
  } catch (err) { next(err); }
};

exports.deleteDoctorSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalId(req);
    const db = await pool.connect();
    await db.request()
      .input('Id',         sql.BigInt, id)
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`UPDATE dbo.DoctorSchedules SET IsActive=0, UpdatedAt=GETUTCDATE() WHERE Id=@Id AND HospitalId=@HospitalId`);
    return res.json(ApiResponse.success(null, 'Doctor schedule deleted'));
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF SHIFTS
// ─────────────────────────────────────────────────────────────────────────────
exports.getStaffShifts = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const db = await pool.connect();
    const result = await db.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT ss.*,
          u.FirstName + ' ' + u.LastName AS StaffName,
          u.FirstName, u.LastName,
          sp.Role, sp.DepartmentId,
          d.Name AS DepartmentName
        FROM dbo.StaffSchedules ss
        JOIN dbo.StaffProfiles sp ON sp.Id  = ss.StaffId
        JOIN dbo.Users u          ON u.Id   = sp.UserId
        LEFT JOIN dbo.Departments d ON d.Id = sp.DepartmentId
        WHERE ss.HospitalId = @HospitalId AND ss.IsActive = 1
        ORDER BY ss.DayOfWeek, ss.StartTime
      `);
    return res.json(ApiResponse.success(result.recordset, 'Staff shifts fetched'));
  } catch (err) { next(err); }
};

exports.createStaffShift = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { StaffId, DayOfWeek, ShiftType, StartTime, EndTime,
            BreakStartTime, BreakEndTime, EffectiveFrom, EffectiveTo, Notes } = req.body;
    if (!StaffId || DayOfWeek === undefined || !StartTime || !EndTime)
      throw new AppError('StaffId, DayOfWeek, StartTime and EndTime are required', 400);
    const db = await pool.connect();
    const r = await db.request()
      .input('HospitalId',     sql.BigInt,       hospitalId)
      .input('StaffId',        sql.BigInt,       StaffId)
      .input('DayOfWeek',      sql.TinyInt,      Number(DayOfWeek))
      .input('ShiftType',      sql.NVarChar(20), ShiftType       || 'morning')
      .input('StartTime',      sql.NVarChar(10), StartTime)
      .input('EndTime',        sql.NVarChar(10), EndTime)
      .input('BreakStartTime', sql.NVarChar(10), BreakStartTime  || null)
      .input('BreakEndTime',   sql.NVarChar(10), BreakEndTime    || null)
      .input('EffectiveFrom',  sql.Date,         EffectiveFrom   || new Date())
      .input('EffectiveTo',    sql.Date,         EffectiveTo     || null)
      .input('Notes',          sql.NVarChar(500),Notes           || null)
      .input('CreatedBy',      sql.BigInt,       req.user?.id    || null)
      .query(`
        INSERT INTO dbo.StaffSchedules
          (HospitalId,StaffId,DayOfWeek,ShiftType,StartTime,EndTime,
           BreakStartTime,BreakEndTime,EffectiveFrom,EffectiveTo,Notes,CreatedBy)
        OUTPUT INSERTED.*
        VALUES
          (@HospitalId,@StaffId,@DayOfWeek,@ShiftType,@StartTime,@EndTime,
           @BreakStartTime,@BreakEndTime,@EffectiveFrom,@EffectiveTo,@Notes,@CreatedBy)
      `);
    return res.status(201).json(ApiResponse.success(r.recordset[0], 'Staff shift created'));
  } catch (err) { next(err); }
};

exports.updateStaffShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalId(req);
    const { DayOfWeek, ShiftType, StartTime, EndTime,
            BreakStartTime, BreakEndTime, EffectiveFrom, EffectiveTo, Notes, IsActive } = req.body;
    const db = await pool.connect();
    const r = await db.request()
      .input('Id',             sql.BigInt,       id)
      .input('HospitalId',     sql.BigInt,       hospitalId)
      .input('DayOfWeek',      sql.TinyInt,      Number(DayOfWeek))
      .input('ShiftType',      sql.NVarChar(20), ShiftType       || 'morning')
      .input('StartTime',      sql.NVarChar(10), StartTime)
      .input('EndTime',        sql.NVarChar(10), EndTime)
      .input('BreakStartTime', sql.NVarChar(10), BreakStartTime  || null)
      .input('BreakEndTime',   sql.NVarChar(10), BreakEndTime    || null)
      .input('EffectiveFrom',  sql.Date,         EffectiveFrom   || new Date())
      .input('EffectiveTo',    sql.Date,         EffectiveTo     || null)
      .input('Notes',          sql.NVarChar(500),Notes           || null)
      .input('IsActive',       sql.Bit,          IsActive !== undefined ? IsActive : 1)
      .input('UpdatedBy',      sql.BigInt,       req.user?.id    || null)
      .query(`
        UPDATE dbo.StaffSchedules
        SET DayOfWeek=@DayOfWeek, ShiftType=@ShiftType, StartTime=@StartTime,
            EndTime=@EndTime, BreakStartTime=@BreakStartTime, BreakEndTime=@BreakEndTime,
            EffectiveFrom=@EffectiveFrom, EffectiveTo=@EffectiveTo, Notes=@Notes,
            IsActive=@IsActive, UpdatedBy=@UpdatedBy, UpdatedAt=GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE Id=@Id AND HospitalId=@HospitalId
      `);
    if (!r.recordset.length) throw new AppError('Shift not found', 404);
    return res.json(ApiResponse.success(r.recordset[0], 'Staff shift updated'));
  } catch (err) { next(err); }
};

exports.deleteStaffShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalId(req);
    const db = await pool.connect();
    await db.request()
      .input('Id',         sql.BigInt, id)
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`UPDATE dbo.StaffSchedules SET IsActive=0, UpdatedAt=GETUTCDATE() WHERE Id=@Id AND HospitalId=@HospitalId`);
    return res.json(ApiResponse.success(null, 'Staff shift deleted'));
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR LEAVES
// ─────────────────────────────────────────────────────────────────────────────
exports.getDoctorLeaves = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { status } = req.query;
    const db = await pool.connect();
    const req2 = db.request().input('HospitalId', sql.BigInt, hospitalId);
    let where = 'WHERE dl.HospitalId = @HospitalId';
    if (status) { req2.input('Status', sql.NVarChar(20), status); where += ' AND dl.Status = @Status'; }
    const result = await req2.query(`
      SELECT dl.*,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        u.FirstName, u.LastName
      FROM dbo.DoctorLeaves dl
      JOIN dbo.DoctorProfiles dp ON dp.Id = dl.DoctorId
      JOIN dbo.Users u           ON u.Id  = dp.UserId
      ${where}
      ORDER BY dl.LeaveDate DESC
    `);
    return res.json(ApiResponse.success(result.recordset, 'Doctor leaves fetched'));
  } catch (err) { next(err); }
};

exports.createDoctorLeave = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { DoctorId, LeaveDate, LeaveType, StartTime, EndTime, Reason } = req.body;
    if (!DoctorId || !LeaveDate) throw new AppError('DoctorId and LeaveDate required', 400);
    const db = await pool.connect();
    const r = await db.request()
      .input('HospitalId', sql.BigInt,       hospitalId)
      .input('DoctorId',   sql.BigInt,       DoctorId)
      .input('LeaveDate',  sql.Date,         LeaveDate)
      .input('LeaveType',  sql.NVarChar(30), LeaveType   || 'full_day')
      .input('StartTime',  sql.NVarChar(10), StartTime   || null)
      .input('EndTime',    sql.NVarChar(10), EndTime     || null)
      .input('Reason',     sql.NVarChar(500),Reason      || null)
      .input('CreatedBy',  sql.BigInt,       req.user?.id|| null)
      .query(`
        INSERT INTO dbo.DoctorLeaves (HospitalId,DoctorId,LeaveDate,LeaveType,StartTime,EndTime,Reason,CreatedBy)
        OUTPUT INSERTED.*
        VALUES (@HospitalId,@DoctorId,@LeaveDate,@LeaveType,@StartTime,@EndTime,@Reason,@CreatedBy)
      `);
    return res.status(201).json(ApiResponse.success(r.recordset[0], 'Doctor leave created'));
  } catch (err) { next(err); }
};

exports.updateDoctorLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalId(req);
    const { status, rejectionReason } = req.body;
    const db = await pool.connect();
    const r = await db.request()
      .input('Id',               sql.BigInt,        id)
      .input('HospitalId',       sql.BigInt,        hospitalId)
      .input('Status',           sql.NVarChar(20),  status)
      .input('RejectionReason',  sql.NVarChar(500), rejectionReason || null)
      .input('ApprovedBy',       sql.BigInt,        req.user?.id    || null)
      .query(`
        UPDATE dbo.DoctorLeaves
        SET Status=@Status, RejectionReason=@RejectionReason,
            ApprovedBy=CASE WHEN @Status='approved' THEN @ApprovedBy ELSE ApprovedBy END,
            ApprovedAt=CASE WHEN @Status='approved' THEN GETUTCDATE() ELSE ApprovedAt END,
            UpdatedAt=GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE Id=@Id AND HospitalId=@HospitalId
      `);
    if (!r.recordset.length) throw new AppError('Leave not found', 404);
    return res.json(ApiResponse.success(r.recordset[0], `Leave ${status}`));
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAFF LEAVES
// ─────────────────────────────────────────────────────────────────────────────
exports.getStaffLeaves = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { status } = req.query;
    const db = await pool.connect();
    const req2 = db.request().input('HospitalId', sql.BigInt, hospitalId);
    let where = 'WHERE sl.HospitalId = @HospitalId';
    if (status) { req2.input('Status', sql.NVarChar(20), status); where += ' AND sl.Status = @Status'; }
    const result = await req2.query(`
      SELECT sl.*,
        u.FirstName + ' ' + u.LastName AS StaffName,
        u.FirstName, u.LastName,
        sp.Role
      FROM dbo.StaffLeaves sl
      JOIN dbo.StaffProfiles sp ON sp.Id = sl.StaffId
      JOIN dbo.Users u          ON u.Id  = sp.UserId
      ${where}
      ORDER BY sl.LeaveDate DESC
    `);
    return res.json(ApiResponse.success(result.recordset, 'Staff leaves fetched'));
  } catch (err) { next(err); }
};

exports.createStaffLeave = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { StaffId, LeaveDate, LeaveType, StartTime, EndTime, Reason } = req.body;
    if (!StaffId || !LeaveDate) throw new AppError('StaffId and LeaveDate required', 400);
    const db = await pool.connect();
    const r = await db.request()
      .input('HospitalId', sql.BigInt,       hospitalId)
      .input('StaffId',    sql.BigInt,       StaffId)
      .input('LeaveDate',  sql.Date,         LeaveDate)
      .input('LeaveType',  sql.NVarChar(30), LeaveType   || 'full_day')
      .input('StartTime',  sql.NVarChar(10), StartTime   || null)
      .input('EndTime',    sql.NVarChar(10), EndTime     || null)
      .input('Reason',     sql.NVarChar(500),Reason      || null)
      .input('CreatedBy',  sql.BigInt,       req.user?.id|| null)
      .query(`
        INSERT INTO dbo.StaffLeaves (HospitalId,StaffId,LeaveDate,LeaveType,StartTime,EndTime,Reason,CreatedBy)
        OUTPUT INSERTED.*
        VALUES (@HospitalId,@StaffId,@LeaveDate,@LeaveType,@StartTime,@EndTime,@Reason,@CreatedBy)
      `);
    return res.status(201).json(ApiResponse.success(r.recordset[0], 'Staff leave created'));
  } catch (err) { next(err); }
};

exports.updateStaffLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hospitalId = getHospitalId(req);
    const { status, rejectionReason } = req.body;
    const db = await pool.connect();
    const r = await db.request()
      .input('Id',              sql.BigInt,        id)
      .input('HospitalId',      sql.BigInt,        hospitalId)
      .input('Status',          sql.NVarChar(20),  status)
      .input('RejectionReason', sql.NVarChar(500), rejectionReason || null)
      .input('ApprovedBy',      sql.BigInt,        req.user?.id    || null)
      .query(`
        UPDATE dbo.StaffLeaves
        SET Status=@Status, RejectionReason=@RejectionReason,
            ApprovedBy=CASE WHEN @Status='approved' THEN @ApprovedBy ELSE ApprovedBy END,
            ApprovedAt=CASE WHEN @Status='approved' THEN GETUTCDATE() ELSE ApprovedAt END,
            UpdatedAt=GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE Id=@Id AND HospitalId=@HospitalId
      `);
    if (!r.recordset.length) throw new AppError('Leave not found', 404);
    return res.json(ApiResponse.success(r.recordset[0], `Leave ${status}`));
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED LEAVES ENDPOINT (used by dashboard)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllLeaves = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { status } = req.query;
    const db = await pool.connect();

    const req2 = db.request().input('HospitalId', sql.BigInt, hospitalId);
    let statusFilter = '';
    if (status) { req2.input('Status', sql.NVarChar(20), status); statusFilter = 'AND Status = @Status'; }

    const result = await req2.query(`
      SELECT dl.Id, dl.LeaveDate, dl.LeaveType, dl.Reason, dl.Status, dl.CreatedAt,
        u.FirstName + ' ' + u.LastName AS Name, 'doctor' AS Type
      FROM dbo.DoctorLeaves dl
      JOIN dbo.DoctorProfiles dp ON dp.Id = dl.DoctorId
      JOIN dbo.Users u           ON u.Id  = dp.UserId
      WHERE dl.HospitalId = @HospitalId ${statusFilter}
      UNION ALL
      SELECT sl.Id, sl.LeaveDate, sl.LeaveType, sl.Reason, sl.Status, sl.CreatedAt,
        u.FirstName + ' ' + u.LastName AS Name, 'staff' AS Type
      FROM dbo.StaffLeaves sl
      JOIN dbo.StaffProfiles sp ON sp.Id = sl.StaffId
      JOIN dbo.Users u          ON u.Id  = sp.UserId
      WHERE sl.HospitalId = @HospitalId ${statusFilter}
      ORDER BY LeaveDate DESC
    `);
    return res.json(ApiResponse.success(result.recordset, 'Leaves fetched'));
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENT SLOTS
// ─────────────────────────────────────────────────────────────────────────────
exports.getSlots = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { date, doctorId } = req.query;
    const slotDate = date || new Date().toISOString().slice(0, 10);
    const db = await pool.connect();
    const req2 = db.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('SlotDate',   sql.Date,   slotDate);
    let docFilter = '';
    if (doctorId) { req2.input('DoctorId', sql.BigInt, doctorId); docFilter = 'AND s.DoctorId = @DoctorId'; }
    const result = await req2.query(`
      SELECT s.*,
        u.FirstName + ' ' + u.LastName AS DoctorName,
        r.RoomNumber
      FROM dbo.AppointmentSlots s
      JOIN dbo.DoctorProfiles dp ON dp.Id = s.DoctorId
      JOIN dbo.Users u           ON u.Id  = dp.UserId
      LEFT JOIN dbo.OpdRooms r   ON r.Id  = s.OpdRoomId
      WHERE s.HospitalId=@HospitalId AND s.SlotDate=@SlotDate ${docFilter}
      ORDER BY s.DoctorId, s.StartTime
    `);
    return res.json(ApiResponse.success(result.recordset, 'Slots fetched'));
  } catch (err) { next(err); }
};

exports.getTodaySlotSummary = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const db = await pool.connect();
    const result = await db.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`SELECT * FROM dbo.V_TodaySlotSummary WHERE HospitalId=@HospitalId ORDER BY DoctorName`);
    return res.json(ApiResponse.success(result.recordset, 'Slot summary fetched'));
  } catch (err) { next(err); }
};

exports.generateSlots = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate) throw new AppError('fromDate and toDate required', 400);
    const db = await pool.connect();
    await db.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('FromDate',   sql.Date,   fromDate)
      .input('ToDate',     sql.Date,   toDate)
      .execute('dbo.sp_GenerateDoctorSlots');
    return res.json(ApiResponse.success(null, `Slots generated from ${fromDate} to ${toDate}`));
  } catch (err) { next(err); }
};

exports.updateSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, blockedReason } = req.body;
    const db = await pool.connect();
    const r = await db.request()
      .input('Id',            sql.BigInt,       id)
      .input('Status',        sql.NVarChar(20), status)
      .input('BlockedReason', sql.NVarChar(200),blockedReason || null)
      .query(`
        UPDATE dbo.AppointmentSlots
        SET Status=@Status, BlockedReason=@BlockedReason, UpdatedAt=GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE Id=@Id
      `);
    if (!r.recordset.length) throw new AppError('Slot not found', 404);
    return res.json(ApiResponse.success(r.recordset[0], 'Slot updated'));
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// OPD QUEUE
// ─────────────────────────────────────────────────────────────────────────────
exports.getQueue = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { date, doctorId } = req.query;
    const queueDate = date || new Date().toISOString().slice(0, 10);
    const db = await pool.connect();
    const req2 = db.request()
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('QueueDate',  sql.Date,   queueDate);
    let docFilter = '';
    if (doctorId) { req2.input('DoctorId', sql.BigInt, doctorId); docFilter = 'AND q.DoctorId = @DoctorId'; }
    const result = await req2.query(`
      SELECT q.*,
        u.FirstName + ' ' + u.LastName AS DoctorName
      FROM dbo.OpdQueue q
      JOIN dbo.DoctorProfiles dp ON dp.Id = q.DoctorId
      JOIN dbo.Users u           ON u.Id  = dp.UserId
      WHERE q.HospitalId=@HospitalId AND q.QueueDate=@QueueDate ${docFilter}
      ORDER BY q.TokenNumber
    `);
    return res.json(ApiResponse.success(result.recordset, 'Queue fetched'));
  } catch (err) { next(err); }
};

exports.getTodayQueue = async (req, res, next) => {
  req.query.date = new Date().toISOString().slice(0, 10);
  return exports.getQueue(req, res, next);
};

exports.addToQueue = async (req, res, next) => {
  try {
    const hospitalId = getHospitalId(req);
    const { DoctorId, PatientId, PatientName, Priority, Notes, QueueDate } = req.body;
    if (!DoctorId || (!PatientId && !PatientName)) throw new AppError('DoctorId and Patient info required', 400);
    const qDate = QueueDate || new Date().toISOString().slice(0, 10);
    const db = await pool.connect();
    // Get next token number
    const tokenRes = await db.request()
      .input('DoctorId',   sql.BigInt, DoctorId)
      .input('QueueDate',  sql.Date,   qDate)
      .query(`SELECT ISNULL(MAX(TokenNumber),0)+1 AS NextToken FROM dbo.OpdQueue WHERE DoctorId=@DoctorId AND QueueDate=@QueueDate`);
    const token = tokenRes.recordset[0].NextToken;
    const r = await db.request()
      .input('HospitalId',   sql.BigInt,       hospitalId)
      .input('DoctorId',     sql.BigInt,       DoctorId)
      .input('QueueDate',    sql.Date,         qDate)
      .input('TokenNumber',  sql.SmallInt,     token)
      .input('PatientId',    sql.BigInt,       PatientId   || null)
      .input('PatientName',  sql.NVarChar(200),PatientName || null)
      .input('Priority',     sql.NVarChar(20), Priority    || 'normal')
      .input('Notes',        sql.NVarChar(500),Notes       || null)
      .query(`
        INSERT INTO dbo.OpdQueue (HospitalId,DoctorId,QueueDate,TokenNumber,PatientId,PatientName,Priority,Notes)
        OUTPUT INSERTED.*
        VALUES (@HospitalId,@DoctorId,@QueueDate,@TokenNumber,@PatientId,@PatientName,@Priority,@Notes)
      `);
    return res.status(201).json(ApiResponse.success(r.recordset[0], `Token #${token} issued`));
  } catch (err) { next(err); }
};

exports.updateQueue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { queueStatus } = req.body;
    const db = await pool.connect();
    const r = await db.request()
      .input('Id',          sql.BigInt,      id)
      .input('QueueStatus', sql.NVarChar(20),queueStatus)
      .query(`
        UPDATE dbo.OpdQueue
        SET QueueStatus=@QueueStatus,
            CalledAt  = CASE WHEN @QueueStatus='called'  AND CalledAt IS NULL  THEN GETUTCDATE() ELSE CalledAt  END,
            ServedAt  = CASE WHEN @QueueStatus='served'  AND ServedAt IS NULL  THEN GETUTCDATE() ELSE ServedAt  END,
            WaitMinutes = CASE WHEN @QueueStatus='served' AND CalledAt IS NOT NULL
                               THEN DATEDIFF(MINUTE,CalledAt,GETUTCDATE()) ELSE WaitMinutes END,
            UpdatedAt = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE Id=@Id
      `);
    if (!r.recordset.length) throw new AppError('Queue entry not found', 404);
    return res.json(ApiResponse.success(r.recordset[0], 'Queue updated'));
  } catch (err) { next(err); }
};