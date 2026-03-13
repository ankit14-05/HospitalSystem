// src/routes/department.routes.js
// Table: Departments, HospitalSetup, Users (HeadDoctor)
const router = require('express').Router();
const { getPool }               = require('../config/database');
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/departments
// Public within the hospital — used by appointment booking dropdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('HospitalId', req.query.hospitalId || 1)
      .query(`
        SELECT
          d.Id,
          d.Name,
          d.Code,
          d.Description,
          d.FloorNo,
          d.RoomRange,
          d.PhoneExt,
          d.IsActive,
          d.Status,
          u.FirstName + ' ' + u.LastName AS HeadDoctorName,
          u.Id                            AS HeadDoctorUserId
        FROM  dbo.Departments d
        LEFT JOIN dbo.Users u ON u.Id = d.HeadDoctorId
        WHERE d.HospitalId = @HospitalId
          AND d.IsActive   = 1
          AND d.Status     = 'active'
        ORDER BY d.Name ASC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/departments/:id  — single department with doctor list
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const pool = await getPool();

    // Department details
    const deptRes = await pool.request()
      .input('Id', req.params.id)
      .query(`
        SELECT
          d.Id, d.Name, d.Code, d.Description,
          d.FloorNo, d.RoomRange, d.PhoneExt,
          d.IsActive, d.Status, d.CreatedAt,
          u.FirstName + ' ' + u.LastName AS HeadDoctorName
        FROM  dbo.Departments d
        LEFT JOIN dbo.Users u ON u.Id = d.HeadDoctorId
        WHERE d.Id = @Id
      `);

    if (!deptRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Doctors in this department
    const docRes = await pool.request()
      .input('DeptId', req.params.id)
      .query(`
        SELECT
          u.Id,
          u.FirstName + ' ' + u.LastName  AS DoctorName,
          u.ProfilePhotoUrl,
          dp.ConsultationFee,
          dp.ExperienceYears,
          dp.IsAvailable,
          sp.Name AS Specialization,
          q.Code  AS Qualification
        FROM  dbo.DoctorProfiles dp
        JOIN  dbo.Users          u  ON u.Id  = dp.UserId
        LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
        LEFT JOIN dbo.Qualifications  q  ON q.Id  = dp.QualificationId
        WHERE dp.DepartmentId    = @DeptId
          AND dp.ApprovalStatus  = 'approved'
          AND u.IsActive         = 1
          AND u.DeletedAt        IS NULL
        ORDER BY u.FirstName ASC
      `);

    res.json({
      success: true,
      data: { ...deptRes.recordset[0], doctors: docRes.recordset }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/departments  — admin/superadmin only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const {
        hospitalId, name, code, headDoctorId,
        description, floorNo, roomRange, phoneExt
      } = req.body;

      if (!hospitalId || !name) {
        return res.status(400).json({ success: false, message: 'hospitalId and name are required' });
      }

      const pool   = await getPool();
      const result = await pool.request()
        .input('HospitalId',   hospitalId)
        .input('Name',         name.trim())
        .input('Code',         code         || null)
        .input('HeadDoctorId', headDoctorId || null)
        .input('Description',  description  || null)
        .input('FloorNo',      floorNo      || null)
        .input('RoomRange',    roomRange    || null)
        .input('PhoneExt',     phoneExt     || null)
        .input('CreatedBy',    req.user.id)
        .query(`
          INSERT INTO dbo.Departments
            (HospitalId, Name, Code, HeadDoctorId, Description, FloorNo, RoomRange, PhoneExt, CreatedBy)
          OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.CreatedAt
          VALUES
            (@HospitalId, @Name, @Code, @HeadDoctorId, @Description, @FloorNo, @RoomRange, @PhoneExt, @CreatedBy);
        `);

      res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/departments/:id  — admin/superadmin only
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const {
        name, code, headDoctorId, description,
        floorNo, roomRange, phoneExt, isActive, status
      } = req.body;

      const pool = await getPool();
      await pool.request()
        .input('Id',           req.params.id)
        .input('Name',         name         ?? null)
        .input('Code',         code         ?? null)
        .input('HeadDoctorId', headDoctorId ?? null)
        .input('Description',  description  ?? null)
        .input('FloorNo',      floorNo      ?? null)
        .input('RoomRange',    roomRange    ?? null)
        .input('PhoneExt',     phoneExt     ?? null)
        .input('IsActive',     isActive     ?? null)
        .input('Status',       status       ?? null)
        .input('UpdatedBy',    req.user.id)
        .query(`
          UPDATE dbo.Departments SET
            Name         = COALESCE(@Name,         Name),
            Code         = COALESCE(@Code,         Code),
            HeadDoctorId = COALESCE(@HeadDoctorId, HeadDoctorId),
            Description  = COALESCE(@Description,  Description),
            FloorNo      = COALESCE(@FloorNo,      FloorNo),
            RoomRange    = COALESCE(@RoomRange,    RoomRange),
            PhoneExt     = COALESCE(@PhoneExt,     PhoneExt),
            IsActive     = COALESCE(@IsActive,     IsActive),
            Status       = COALESCE(@Status,       Status),
            UpdatedBy    = @UpdatedBy,
            UpdatedAt    = SYSUTCDATETIME()
          WHERE Id = @Id;
        `);

      res.json({ success: true, message: 'Department updated' });
    } catch (err) { next(err); }
  }
);

module.exports = router;