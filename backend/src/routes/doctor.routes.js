// src/routes/doctor.routes.js
// Tables: dbo.DoctorProfiles, dbo.Users, dbo.Specializations, dbo.Departments
// Auth: GET list is public (needed for appointment booking).
//       Profile detail requires auth.

const router  = require('express').Router();
const { authenticate: protect } = require('../middleware/auth.middleware');
const { getPool }               = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors
// Query params:
//   ?departmentId=X   — filter by department
//   ?isActive=1       — only active/available doctors
//   ?specializationId=X
//   ?search=keyword   — search by name
// Used by: Schedule Appointment modal Step 2 (Select Doctor)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const {
      departmentId,
      isActive,
      specializationId,
      search,
      hospitalId = 1,
    } = req.query;

    const request = pool.request().input('hospitalId', hospitalId);

    let whereClause = `
      WHERE dp.ApprovalStatus = 'approved'
        AND u.IsActive        = 1
        AND u.DeletedAt       IS NULL
        AND u.HospitalId      = @hospitalId
    `;

    if (departmentId) {
      request.input('departmentId', departmentId);
      whereClause += ` AND dp.DepartmentId = @departmentId`;
    }

    if (isActive === '1' || isActive === 'true') {
      whereClause += ` AND dp.IsAvailable = 1`;
    }

    if (specializationId) {
      request.input('specializationId', specializationId);
      whereClause += ` AND dp.SpecializationId = @specializationId`;
    }

    if (search) {
      request.input('search', `%${search}%`);
      whereClause += ` AND (u.FirstName LIKE @search OR u.LastName LIKE @search OR CONCAT(u.FirstName,' ',u.LastName) LIKE @search)`;
    }

    const result = await request.query(`
      SELECT
        u.Id                 AS UserId,
        dp.Id                AS DoctorId,
        u.FirstName,
        u.LastName,
        CONCAT(u.FirstName, ' ', u.LastName) AS FullName,
        u.ProfilePhotoUrl,
        u.Email,
        u.Phone,

        -- Professional
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

        -- Department & Specialization
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
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/:id
// Full doctor profile by DoctorProfiles.Id or Users.Id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('id', req.params.id)
      .query(`
        SELECT
          u.Id                 AS UserId,
          dp.Id                AS DoctorId,
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
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/doctors/:id/slots
// Get available appointment slots for a doctor on a given date.
// Query: ?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/slots', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param is required (YYYY-MM-DD)' });
    }

    const pool = await getPool();

    // Get doctor's availability window
    const docResult = await pool.request()
      .input('id', req.params.id)
      .query(`
        SELECT
          dp.AvailableFrom,
          dp.AvailableTo,
          dp.AvailableDays,
          dp.MaxDailyPatients
        FROM dbo.DoctorProfiles dp
        WHERE dp.Id = @id AND dp.ApprovalStatus = 'approved'
      `);

    if (!docResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const doc = docResult.recordset[0];

    // Check day of week availability
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayOfWeek = dayNames[new Date(date).getDay()];
    const availDays = doc.AvailableDays ? doc.AvailableDays.split(',').map(d => d.trim()) : [];

    if (availDays.length && !availDays.includes(dayOfWeek)) {
      return res.json({
        success: true,
        available: false,
        message: `Doctor is not available on ${dayOfWeek}`,
        slots: [],
      });
    }

    // Get already booked slots for that date
    const bookedResult = await pool.request()
      .input('doctorId', req.params.id)
      .input('date',     date)
      .query(`
        SELECT AppointmentTime
        FROM dbo.Appointments
        WHERE DoctorId        = @doctorId
          AND AppointmentDate = @date
          AND Status NOT IN ('Cancelled', 'NoShow')
      `);

    const bookedTimes = new Set(
      bookedResult.recordset.map(r => r.AppointmentTime?.toString().slice(0, 5))
    );

    // Generate 30-minute slots between AvailableFrom and AvailableTo
    const slots = [];
    if (doc.AvailableFrom && doc.AvailableTo) {
      const [fromH, fromM] = doc.AvailableFrom.toString().slice(0, 5).split(':').map(Number);
      const [toH,   toM  ] = doc.AvailableTo.toString().slice(0, 5).split(':').map(Number);

      let h = fromH, m = fromM;
      while (h < toH || (h === toH && m < toM)) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slots.push({
          time:      timeStr,
          available: !bookedTimes.has(timeStr),
        });
        m += 30;
        if (m >= 60) { h += 1; m -= 60; }
      }
    }

    res.json({
      success: true,
      available: true,
      date,
      totalSlots:     slots.length,
      availableSlots: slots.filter(s => s.available).length,
      bookedSlots:    slots.filter(s => !s.available).length,
      slots,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;