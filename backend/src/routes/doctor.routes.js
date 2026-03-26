// src/routes/doctor.routes.js
// Tables: dbo.DoctorProfiles, dbo.Users, dbo.Specializations, dbo.Departments

const router  = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool }                          = require('../config/database');
const apptService                          = require('../services/appointment.service');

const resolveHospitalId = (req) => {
  const raw = req.query.hospitalId || req.headers['x-hospital-id'] || req.user?.hospitalId || req.user?.HospitalId || 1;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/profile  — logged-in doctor's own profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', protect, authorize('doctor'), async (req, res, next) => {
  try {
    const pool   = await getPool();
    const userId = parseInt(req.user.id);

    const result = await pool.request()
      .input('UserId', userId)
      .query(`
        SELECT
          u.Id                 AS UserId,
          dp.Id                AS DoctorProfileId,
          dp.DoctorId,
          u.FirstName,
          u.LastName,
          CONCAT(u.FirstName, ' ', u.LastName) AS FullName,
          u.ProfilePhotoUrl,
          u.Email,
          u.Phone,
          u.Gender,
          u.DateOfBirth,
          u.Designation,

          dp.ConsultationFee,
          dp.FollowUpFee,
          dp.EmergencyFee,
          dp.ExperienceYears,
          dp.LicenseNumber,
          dp.LicenseExpiry,
          dp.LanguagesSpoken,
          dp.AvailableDays,
          dp.AvailableFrom,
          dp.AvailableTo,
          dp.MaxDailyPatients,
          dp.IsAvailable,
          dp.Bio,
          dp.Awards,
          dp.Publications,
          dp.BloodGroup,
          dp.Nationality,
          dp.ApprovalStatus,

          dep.Id   AS DepartmentId,
          dep.Name AS DepartmentName,
          dep.FloorNo,
          dep.PhoneExt AS DepartmentExt,

          sp.Id    AS SpecializationId,
          sp.Name  AS Specialization,

          q.Code     AS Qualification,
          q.FullName AS QualificationFull,

          mc.Name      AS MedicalCouncil,
          mc.ShortName AS MedicalCouncilShort
        FROM dbo.DoctorProfiles dp
        JOIN dbo.Users           u   ON u.Id   = dp.UserId
        LEFT JOIN dbo.Departments    dep ON dep.Id = dp.DepartmentId
        LEFT JOIN dbo.Specializations sp  ON sp.Id  = dp.SpecializationId
        LEFT JOIN dbo.Qualifications  q   ON q.Id   = dp.QualificationId
        LEFT JOIN dbo.MedicalCouncils mc  ON mc.Id  = dp.MedicalCouncilId
        WHERE dp.UserId = @UserId
          AND u.DeletedAt IS NULL
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/schedule  — logged-in doctor's own schedule
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schedule', protect, authorize('doctor'), async (req, res, next) => {
  try {
    const pool   = await getPool();
    const userId = parseInt(req.user.id);

    // First get DoctorProfiles.Id from UserId
    const docRes = await pool.request()
      .input('UserId', userId)
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const doctorProfileId = docRes.recordset[0].Id;

    const result = await pool.request()
      .input('DoctorId', doctorProfileId)
      .query(`
        SELECT
          ds.Id, ds.DayOfWeek, ds.StartTime, ds.EndTime,
          ds.SlotDurationMins, ds.VisitType, ds.EffectiveFrom,
          ds.EffectiveTo, ds.IsActive, ds.Notes, ds.MaxSlots,
          r.RoomNumber, r.RoomName, r.Floor
        FROM dbo.DoctorSchedules ds
        LEFT JOIN dbo.OpdRooms r ON r.Id = ds.OpdRoomId
        WHERE ds.DoctorId = @DoctorId
          AND ds.IsActive = 1
        ORDER BY ds.DayOfWeek, ds.StartTime
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/weekly-stats  — logged-in doctor's weekly stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/weekly-stats', protect, authorize('doctor'), async (req, res, next) => {
  try {
    const pool   = await getPool();
    const userId = parseInt(req.user.id);

    const docRes = await pool.request()
      .input('UserId', userId)
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const doctorProfileId = docRes.recordset[0].Id;

    const result = await pool.request()
      .input('DoctorId', doctorProfileId)
      .query(`
        SELECT
          COUNT(*)                                              AS TotalThisWeek,
          SUM(CASE WHEN Status = 'Completed'  THEN 1 ELSE 0 END) AS Completed,
          SUM(CASE WHEN Status = 'Scheduled'  THEN 1 ELSE 0 END) AS Scheduled,
          SUM(CASE WHEN Status = 'Cancelled'  THEN 1 ELSE 0 END) AS Cancelled,
          SUM(CASE WHEN Status = 'NoShow'     THEN 1 ELSE 0 END) AS NoShow,
          SUM(CASE WHEN Status = 'Confirmed'  THEN 1 ELSE 0 END) AS Confirmed
        FROM dbo.Appointments
        WHERE DoctorId        = @DoctorId
          AND AppointmentDate >= CAST(DATEADD(DAY, -DATEPART(WEEKDAY, GETDATE()) + 1, GETDATE()) AS DATE)
          AND AppointmentDate <= CAST(DATEADD(DAY,  7 - DATEPART(WEEKDAY, GETDATE()),  GETDATE()) AS DATE);
      `);

    // Today's count
    const todayRes = await pool.request()
      .input('DoctorId', doctorProfileId)
      .query(`
        SELECT COUNT(*) AS TodayTotal
        FROM dbo.Appointments
        WHERE DoctorId        = @DoctorId
          AND AppointmentDate = CAST(GETDATE() AS DATE)
          AND Status NOT IN ('Cancelled', 'NoShow')
      `);

    res.json({
      success: true,
      data: {
        ...result.recordset[0],
        TodayTotal: todayRes.recordset[0].TodayTotal,
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/my-queue?date=YYYY-MM-DD  — doctor's OPD queue for a day
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-queue', protect, authorize('doctor'), async (req, res, next) => {
  try {
    const pool      = await getPool();
    const userId    = parseInt(req.user.id);
    const queueDate = req.query.date || new Date().toISOString().slice(0, 10);

    const docRes = await pool.request()
      .input('UserId', userId)
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const doctorProfileId = docRes.recordset[0].Id;

    const result = await pool.request()
      .input('DoctorId',  doctorProfileId)
      .input('QueueDate', queueDate)
      .query(`
        SELECT
          q.Id, q.TokenNumber, q.QueueStatus, q.Priority,
          q.PatientName, q.Notes, q.CalledAt, q.ServedAt, q.WaitMinutes,
          q.CreatedAt,
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

    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/pending-requests  — appointment requests for this doctor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending-requests', protect, authorize('doctor'), async (req, res, next) => {
  try {
    const pool   = await getPool();
    const userId = parseInt(req.user.id);

    const docRes = await pool.request()
      .input('UserId', userId)
      .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const doctorProfileId = docRes.recordset[0].Id;

    const result = await pool.request()
      .input('DoctorId', doctorProfileId)
      .query(`
        SELECT
          a.Id, a.AppointmentNo, a.AppointmentDate,
          CONVERT(VARCHAR(5), TRY_CONVERT(time, a.AppointmentTime), 108) AS AppointmentTime,
          CONVERT(VARCHAR(5), TRY_CONVERT(time, a.EndTime), 108) AS EndTime,
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

    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors  — public list (used for appointment booking)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const {
      departmentId,
      isActive,
      specializationId,
      search,
      status,
      limit = 200,
    } = req.query;
    const hospitalId = resolveHospitalId(req);

    const request = pool.request()
      .input('hospitalId', parseInt(hospitalId));

    let whereClause = `
      WHERE u.DeletedAt  IS NULL
        AND u.HospitalId = @hospitalId
        AND dp.Id > 0
    `;

    // Allow filtering by approval status (admin uses ?status=approved)
    if (status) {
      request.input('status', status);
      whereClause += ` AND dp.ApprovalStatus = @status`;
    } else {
      whereClause += ` AND dp.ApprovalStatus = 'approved' AND u.IsActive = 1`;
    }

    if (departmentId) {
      request.input('departmentId', parseInt(departmentId));
      whereClause += ` AND dp.DepartmentId = @departmentId`;
    }

    if (isActive === '1' || isActive === 'true') {
      whereClause += ` AND dp.IsAvailable = 1`;
    }

    if (specializationId) {
      request.input('specializationId', parseInt(specializationId));
      whereClause += ` AND dp.SpecializationId = @specializationId`;
    }

    if (search) {
      request.input('search', `%${search}%`);
      whereClause += ` AND (u.FirstName LIKE @search OR u.LastName LIKE @search OR CONCAT(u.FirstName,' ',u.LastName) LIKE @search)`;
    }

    request.input('limit', parseInt(limit));

    const result = await request.query(`
      SELECT TOP (@limit)
        u.Id                 AS UserId,
        dp.Id                AS DoctorId,
        dp.DoctorId          AS DoctorCode,
        u.FirstName,
        u.LastName,
        CONCAT(u.FirstName, ' ', u.LastName) AS FullName,
        u.ProfilePhotoUrl,
        u.Email,
        u.Phone,
        dp.ConsultationFee,
        dp.FollowUpFee,
        dp.EmergencyFee,
        dp.ExperienceYears,
        dp.LicenseNumber,
        dp.LanguagesSpoken,
        dp.AvailableDays,
        dp.AvailableFrom,
        dp.AvailableTo,
        dp.MaxDailyPatients,
        dp.IsAvailable,
        dp.Bio,
        dp.ApprovalStatus,
        dep.Id   AS DepartmentId,
        dep.Name AS DepartmentName,
        sp.Id    AS SpecializationId,
        sp.Name  AS Specialization,
        q.Code   AS Qualification,
        q.FullName AS QualificationFull
      FROM dbo.DoctorProfiles dp
      JOIN dbo.Users           u   ON u.Id   = dp.UserId
      LEFT JOIN dbo.Departments    dep ON dep.Id = dp.DepartmentId
      LEFT JOIN dbo.Specializations sp  ON sp.Id  = dp.SpecializationId
      LEFT JOIN dbo.Qualifications  q   ON q.Id   = dp.QualificationId
      ${whereClause}
      ORDER BY u.FirstName ASC, u.LastName ASC
    `);

    res.json({ success: true, total: result.recordset.length, data: result.recordset });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/:id  — full profile by DoctorProfiles.Id or Users.Id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const id     = parseInt(req.params.id);

    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT
          u.Id                 AS UserId,
          dp.Id                AS DoctorId,
          dp.DoctorId          AS DoctorCode,
          u.FirstName,
          u.LastName,
          CONCAT(u.FirstName, ' ', u.LastName) AS FullName,
          u.ProfilePhotoUrl,
          u.Email,
          u.Phone,
          u.Gender,
          u.DateOfBirth,
          dp.ConsultationFee,
          dp.FollowUpFee,
          dp.EmergencyFee,
          dp.ExperienceYears,
          dp.LicenseNumber,
          dp.LicenseExpiry,
          dp.LanguagesSpoken,
          dp.AvailableDays,
          dp.AvailableFrom,
          dp.AvailableTo,
          dp.MaxDailyPatients,
          dp.IsAvailable,
          dp.Bio,
          dp.Awards,
          dp.Publications,
          dp.BloodGroup,
          dp.Nationality,
          dep.Id   AS DepartmentId,
          dep.Name AS DepartmentName,
          dep.FloorNo,
          dep.PhoneExt AS DepartmentExt,
          sp.Id    AS SpecializationId,
          sp.Name  AS Specialization,
          q.Code     AS Qualification,
          q.FullName AS QualificationFull,
          q.Category AS QualificationCategory,
          mc.Name      AS MedicalCouncil,
          mc.ShortName AS MedicalCouncilShort
        FROM dbo.DoctorProfiles dp
        JOIN dbo.Users           u   ON u.Id   = dp.UserId
        LEFT JOIN dbo.Departments    dep ON dep.Id = dp.DepartmentId
        LEFT JOIN dbo.Specializations sp  ON sp.Id  = dp.SpecializationId
        LEFT JOIN dbo.Qualifications  q   ON q.Id   = dp.QualificationId
        LEFT JOIN dbo.MedicalCouncils mc  ON mc.Id  = dp.MedicalCouncilId
        WHERE (dp.Id = @id OR u.Id = @id)
          AND dp.ApprovalStatus = 'approved'
          AND u.DeletedAt       IS NULL
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/:id/slots  — available slots for a doctor on a date
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/slots', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param is required (YYYY-MM-DD)' });
    }

    const includeUnavailable = req.query.includeUnavailable === '1' || req.query.includeUnavailable === 'true';
    const result = await apptService.getDoctorSlots({
      doctorId: parseInt(req.params.id, 10),
      date,
      hospitalId: resolveHospitalId(req),
      includeUnavailable,
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
