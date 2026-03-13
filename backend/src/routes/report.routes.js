// src/routes/report.routes.js
// Tables: LabOrders, LabOrderItems, LabTests, PatientProfiles,
//         DoctorProfiles, Users, Appointments
const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool }                          = require('../config/database');

router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/my
// Patient sees their own lab reports | Doctor sees reports they ordered
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', async (req, res, next) => {
  try {
    const pool  = await getPool();
    const role  = req.user.role;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const offset = (page - 1) * limit;

    let result;

    if (role === 'patient') {
      const patRes = await pool.request()
        .input('UserId', req.user.id)
        .query(`SELECT Id FROM dbo.PatientProfiles WHERE UserId = @UserId AND DeletedAt IS NULL`);

      if (!patRes.recordset.length) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      const patientId = patRes.recordset[0].Id;

      result = await pool.request()
        .input('PatientId', patientId)
        .input('Limit',     limit)
        .input('Offset',    offset)
        .query(`
          SELECT
            lo.Id, lo.OrderNumber, lo.OrderDate, lo.Status,
            lo.Priority, lo.Notes, lo.CollectedAt, lo.ReportedAt,
            lo.VerifiedAt, lo.CreatedAt,
            u.FirstName + ' ' + u.LastName AS OrderedByName,
            a.AppointmentNo, a.AppointmentDate,
            (
              SELECT
                loi.Id,
                lt.Name  AS TestName,
                lt.Unit,
                loi.ResultValue, loi.ResultUnit,
                loi.NormalRange, loi.IsAbnormal, loi.Remarks,
                loi.Status AS ItemStatus
              FROM dbo.LabOrderItems loi
              JOIN dbo.LabTests      lt  ON lt.Id = loi.TestId
              WHERE loi.LabOrderId = lo.Id
              FOR JSON PATH
            ) AS Tests
          FROM  dbo.LabOrders       lo
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
          LEFT JOIN dbo.Users          u  ON u.Id  = dp.UserId
          LEFT JOIN dbo.Appointments   a  ON a.Id  = lo.AppointmentId
          WHERE lo.PatientId = @PatientId
          ORDER BY lo.OrderDate DESC, lo.CreatedAt DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

          SELECT COUNT(*) AS Total FROM dbo.LabOrders WHERE PatientId = @PatientId;
        `);
    } else {
      // Doctor sees orders they placed
      const docRes = await pool.request()
        .input('UserId', req.user.id)
        .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

      if (!docRes.recordset.length) {
        return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      }
      const doctorId = docRes.recordset[0].Id;

      result = await pool.request()
        .input('DoctorId', doctorId)
        .input('Limit',    limit)
        .input('Offset',   offset)
        .query(`
          SELECT
            lo.Id, lo.OrderNumber, lo.OrderDate, lo.Status,
            lo.Priority, lo.Notes, lo.CollectedAt, lo.ReportedAt,
            lo.VerifiedAt, lo.CreatedAt,
            p.FirstName + ' ' + p.LastName AS PatientName,
            p.UHID,
            a.AppointmentNo, a.AppointmentDate,
            (
              SELECT
                loi.Id,
                lt.Name  AS TestName,
                lt.Unit,
                loi.ResultValue, loi.ResultUnit,
                loi.NormalRange, loi.IsAbnormal, loi.Remarks,
                loi.Status AS ItemStatus
              FROM dbo.LabOrderItems loi
              JOIN dbo.LabTests      lt  ON lt.Id = loi.TestId
              WHERE loi.LabOrderId = lo.Id
              FOR JSON PATH
            ) AS Tests
          FROM  dbo.LabOrders       lo
          JOIN  dbo.PatientProfiles  p  ON p.Id = lo.PatientId
          LEFT JOIN dbo.Appointments a  ON a.Id = lo.AppointmentId
          WHERE lo.OrderedBy = @DoctorId
          ORDER BY lo.OrderDate DESC, lo.CreatedAt DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

          SELECT COUNT(*) AS Total FROM dbo.LabOrders WHERE OrderedBy = @DoctorId;
        `);
    }

    const reports = result.recordsets[0].map(row => ({
      ...row,
      Tests: row.Tests ? JSON.parse(row.Tests) : []
    }));
    const total = result.recordsets[1]?.[0]?.Total || 0;

    res.json({
      success: true,
      data: reports,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/reports/:id  — single lab order with all test results
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const pool = await getPool();

    const orderRes = await pool.request()
      .input('Id', req.params.id)
      .query(`
        SELECT
          lo.Id, lo.OrderNumber, lo.OrderDate, lo.Status,
          lo.Priority, lo.Notes, lo.CollectedAt, lo.ReportedAt,
          lo.VerifiedAt, lo.CreatedAt,
          p.FirstName + ' ' + p.LastName AS PatientName,
          p.UHID, p.DateOfBirth, p.Gender, p.BloodGroup,
          u.FirstName + ' ' + u.LastName AS OrderedByName,
          dp.LicenseNumber,
          sp.Name  AS Specialization,
          hosp.Name AS HospitalName,
          hosp.Phone AS HospitalPhone
        FROM  dbo.LabOrders        lo
        JOIN  dbo.PatientProfiles   p    ON p.Id   = lo.PatientId
        LEFT JOIN dbo.DoctorProfiles dp  ON dp.Id  = lo.OrderedBy
        LEFT JOIN dbo.Users          u   ON u.Id   = dp.UserId
        LEFT JOIN dbo.Specializations sp ON sp.Id  = dp.SpecializationId
        LEFT JOIN dbo.HospitalSetup  hosp ON hosp.Id = lo.HospitalId
        WHERE lo.Id = @Id
      `);

    if (!orderRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const itemsRes = await pool.request()
      .input('LabOrderId', req.params.id)
      .query(`
        SELECT
          loi.Id, lt.Name AS TestName, lt.Category,
          lt.Unit, lt.NormalRangeMale, lt.NormalRangeFemale,
          lt.SampleType, lt.RequiresFasting,
          loi.ResultValue, loi.ResultUnit,
          loi.NormalRange, loi.IsAbnormal,
          loi.Remarks, loi.Status
        FROM  dbo.LabOrderItems loi
        JOIN  dbo.LabTests      lt  ON lt.Id = loi.TestId
        WHERE loi.LabOrderId = @LabOrderId
      `);

    res.json({
      success: true,
      data: { ...orderRes.recordset[0], tests: itemsRes.recordset }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/reports  — doctor / labtech creates lab order
// ─────────────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('doctor', 'labtech', 'admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const {
        patientId, appointmentId, admissionId,
        priority = 'Routine', notes, tests = []
      } = req.body;

      if (!patientId || !tests.length) {
        return res.status(400).json({ success: false, message: 'patientId and at least one test are required' });
      }

      const pool = await getPool();

      // Get doctor profile & hospitalId
      const docRes = await pool.request()
        .input('UserId', req.user.id)
        .query(`SELECT Id, HospitalId FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

      if (!docRes.recordset.length) {
        return res.status(400).json({ success: false, message: 'Doctor profile not found' });
      }
      const { Id: doctorId, HospitalId: hospitalId } = docRes.recordset[0];

      // Generate OrderNumber: LAB-YYYYMMDD-{random5}
      const today    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const orderNo  = `LAB-${today}-${Math.floor(10000 + Math.random() * 90000)}`;

      const orderRes = await pool.request()
        .input('HospitalId',    hospitalId)
        .input('PatientId',     patientId)
        .input('OrderedBy',     doctorId)
        .input('AppointmentId', appointmentId || null)
        .input('AdmissionId',   admissionId   || null)
        .input('OrderNumber',   orderNo)
        .input('Priority',      priority)
        .input('Notes',         notes         || null)
        .input('CreatedBy',     req.user.id)
        .query(`
          INSERT INTO dbo.LabOrders
            (HospitalId, PatientId, OrderedBy, AppointmentId, AdmissionId,
             OrderNumber, Priority, Notes, CreatedBy)
          OUTPUT INSERTED.Id
          VALUES
            (@HospitalId, @PatientId, @OrderedBy, @AppointmentId, @AdmissionId,
             @OrderNumber, @Priority, @Notes, @CreatedBy);
        `);

      const labOrderId = orderRes.recordset[0].Id;

      for (const test of tests) {
        await pool.request()
          .input('LabOrderId', labOrderId)
          .input('TestId',     test.testId)
          .query(`
            INSERT INTO dbo.LabOrderItems (LabOrderId, TestId)
            VALUES (@LabOrderId, @TestId);
          `);
      }

      res.status(201).json({
        success: true,
        message: 'Lab order created',
        data: { id: labOrderId, orderNumber: orderNo }
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/reports/:id/results  — labtech enters results
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/results',
  authorize('labtech', 'admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const { items = [], status } = req.body;
      const pool = await getPool();

      for (const item of items) {
        await pool.request()
          .input('Id',          item.id)
          .input('ResultValue', item.resultValue ?? null)
          .input('ResultUnit',  item.resultUnit  ?? null)
          .input('NormalRange', item.normalRange ?? null)
          .input('IsAbnormal',  item.isAbnormal  ?? null)
          .input('Remarks',     item.remarks     ?? null)
          .input('Status',      item.status || 'Completed')
          .query(`
            UPDATE dbo.LabOrderItems SET
              ResultValue = COALESCE(@ResultValue, ResultValue),
              ResultUnit  = COALESCE(@ResultUnit,  ResultUnit),
              NormalRange = COALESCE(@NormalRange, NormalRange),
              IsAbnormal  = COALESCE(@IsAbnormal,  IsAbnormal),
              Remarks     = COALESCE(@Remarks,     Remarks),
              Status      = @Status
            WHERE Id = @Id;
          `);
      }

      if (status) {
        await pool.request()
          .input('Id',         req.params.id)
          .input('Status',     status)
          .input('ReportedBy', req.user.id)
          .query(`
            UPDATE dbo.LabOrders SET
              Status     = @Status,
              ReportedAt = SYSUTCDATETIME(),
              ReportedBy = @ReportedBy,
              UpdatedAt  = SYSUTCDATETIME()
            WHERE Id = @Id;
          `);
      }

      res.json({ success: true, message: 'Results updated' });
    } catch (err) { next(err); }
  }
);

module.exports = router;