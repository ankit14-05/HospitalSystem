// src/routes/prescription.routes.js
// Tables: Prescriptions, PrescriptionItems, Medicines, PatientProfiles,
//         DoctorProfiles, Users, Appointments
const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool, sql, withTransaction }    = require('../config/database');
const { requireActivePatientProfile }      = require('../services/patientAccess.service');

router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: fetch prescriptions written by the logged-in doctor
// ─────────────────────────────────────────────────────────────────────────────
const getDoctorPrescriptions = async (userId, limit, offset) => {
  const pool = await getPool();

  const docRes = await pool.request()
    .input('UserId', parseInt(userId))
    .query(`SELECT Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

  if (!docRes.recordset.length) return null;

  const doctorId = docRes.recordset[0].Id;

  const result = await pool.request()
    .input('DoctorId', doctorId)
    .input('Limit',    limit)
    .input('Offset',   offset)
    .query(`
      SELECT
        rx.Id, rx.RxNumber, rx.RxDate, rx.Status,
        rx.Diagnosis, rx.Notes, rx.ValidUntil, rx.CreatedAt,
        p.FirstName + ' ' + p.LastName AS PatientName,
        p.UHID, p.Phone AS PatientPhone,
        a.AppointmentNo, a.AppointmentDate,
        (
          SELECT
            rxi.Id, rxi.MedicineName, rxi.Dosage,
            rxi.Frequency, rxi.Duration, rxi.Quantity,
            rxi.Route, rxi.Instructions, rxi.IsDispensed
          FROM dbo.PrescriptionItems rxi
          WHERE rxi.PrescriptionId = rx.Id
          FOR JSON PATH
        ) AS Items
      FROM  dbo.Prescriptions    rx
      JOIN  dbo.PatientProfiles  p  ON p.Id = rx.PatientId
      LEFT JOIN dbo.Appointments a  ON a.Id = rx.AppointmentId
      WHERE rx.DoctorId = @DoctorId
      ORDER BY rx.RxDate DESC, rx.CreatedAt DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

      SELECT COUNT(*) AS Total
      FROM dbo.Prescriptions
      WHERE DoctorId = @DoctorId;
    `);

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/issued
// Doctor dashboard shorthand — must be declared BEFORE /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/issued', async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const offset = (page - 1) * limit;

    const result = await getDoctorPrescriptions(req.user.id, limit, offset);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const prescriptions = result.recordsets[0].map(row => ({
      ...row,
      Items: row.Items ? JSON.parse(row.Items) : []
    }));
    const total = result.recordsets[1]?.[0]?.Total || 0;

    res.json({
      success: true,
      data: prescriptions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/my
// Patient: own prescriptions | Doctor: prescriptions they wrote
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const role   = req.user.role;
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const offset = (page - 1) * limit;

    let result;

    if (role === 'patient') {
      const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
      const patientId = activeProfile.patientId;

      result = await pool.request()
        .input('PatientId', patientId)
        .input('Limit',     limit)
        .input('Offset',    offset)
        .query(`
          SELECT
            rx.Id, rx.RxNumber, rx.RxDate, rx.Status,
            rx.Diagnosis, rx.Notes, rx.ValidUntil, rx.CreatedAt,
            u.FirstName  + ' ' + u.LastName  AS DoctorName,
            dp.ConsultationFee,
            sp.Name AS Specialization,
            a.AppointmentNo, a.AppointmentDate,
            (
              SELECT
                rxi.Id, rxi.MedicineName, rxi.Dosage,
                rxi.Frequency, rxi.Duration, rxi.Quantity,
                rxi.Route, rxi.Instructions, rxi.IsDispensed
              FROM dbo.PrescriptionItems rxi
              WHERE rxi.PrescriptionId = rx.Id
              FOR JSON PATH
            ) AS Items
          FROM  dbo.Prescriptions   rx
          JOIN  dbo.DoctorProfiles  dp ON dp.Id = rx.DoctorId
          JOIN  dbo.Users           u  ON u.Id  = dp.UserId
          LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
          LEFT JOIN dbo.Appointments    a  ON a.Id  = rx.AppointmentId
          WHERE rx.PatientId = @PatientId
          ORDER BY rx.RxDate DESC, rx.CreatedAt DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

          SELECT COUNT(*) AS Total
          FROM dbo.Prescriptions
          WHERE PatientId = @PatientId;
        `);
    } else {
      result = await getDoctorPrescriptions(req.user.id, limit, offset);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      }
    }

    const prescriptions = result.recordsets[0].map(row => ({
      ...row,
      Items: row.Items ? JSON.parse(row.Items) : []
    }));
    const total = result.recordsets[1]?.[0]?.Total || 0;

    res.json({
      success: true,
      data: prescriptions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/:id  — single prescription with items
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('Id', parseInt(req.params.id))
      .query(`
        SELECT
          rx.Id, rx.RxNumber, rx.RxDate, rx.Status,
          rx.Diagnosis, rx.Notes, rx.ValidUntil, rx.CreatedAt,
          p.FirstName  + ' ' + p.LastName   AS PatientName,
          p.UHID, p.DateOfBirth, p.Gender, p.BloodGroup,
          u.FirstName  + ' ' + u.LastName   AS DoctorName,
          dp.LicenseNumber,
          sp.Name AS Specialization,
          q.Code  AS Qualification,
          hosp.Name  AS HospitalName,
          hosp.Phone AS HospitalPhone,
          ISNULL(hosp.Street1, '') +
            CASE WHEN hosp.Street2     IS NOT NULL THEN ', ' + hosp.Street2     ELSE '' END +
            CASE WHEN hosp.City        IS NOT NULL THEN ', ' + hosp.City        ELSE '' END +
            CASE WHEN hosp.PincodeText IS NOT NULL THEN ' - ' + hosp.PincodeText ELSE '' END
            AS HospitalAddress,
          a.AppointmentNo, a.AppointmentDate
        FROM  dbo.Prescriptions   rx
        JOIN  dbo.PatientProfiles  p    ON p.Id   = rx.PatientId
        JOIN  dbo.DoctorProfiles   dp   ON dp.Id  = rx.DoctorId
        JOIN  dbo.Users            u    ON u.Id   = dp.UserId
        LEFT JOIN dbo.Specializations sp   ON sp.Id  = dp.SpecializationId
        LEFT JOIN dbo.Qualifications  q    ON q.Id   = dp.QualificationId
        LEFT JOIN dbo.Appointments    a    ON a.Id   = rx.AppointmentId
        LEFT JOIN dbo.HospitalSetup   hosp ON hosp.Id = rx.HospitalId
        WHERE rx.Id = @Id;
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const itemsRes = await pool.request()
      .input('PrescriptionId', parseInt(req.params.id))
      .query(`
        SELECT
          rxi.Id, rxi.MedicineName, rxi.Dosage, rxi.Frequency,
          rxi.Duration, rxi.Quantity, rxi.Route,
          rxi.Instructions, rxi.IsDispensed, rxi.DispensedAt,
          m.GenericName, m.BrandName, m.DosageForm, m.Strength
        FROM  dbo.PrescriptionItems rxi
        LEFT JOIN dbo.Medicines m ON m.Id = rxi.MedicineId
        WHERE rxi.PrescriptionId = @PrescriptionId
      `);

    res.json({
      success: true,
      data: { ...result.recordset[0], items: itemsRes.recordset }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/prescriptions  — doctor creates prescription
// ─────────────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const {
        patientId, appointmentId, admissionId,
        diagnosis, notes, validUntil, items = []
      } = req.body;

      if (!patientId || !items.length) {
        return res.status(400).json({ success: false, message: 'patientId and at least one item are required' });
      }

      const pool = await getPool();

      const docRes = await pool.request()
        .input('UserId', parseInt(req.user.id))
        .query(`SELECT Id, HospitalId FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

      if (!docRes.recordset.length) {
        return res.status(400).json({ success: false, message: 'Doctor profile not found' });
      }
      const { Id: doctorId, HospitalId: hospitalId } = docRes.recordset[0];

      const normalizedPatientId = parseInt(patientId, 10);
      const normalizedAppointmentId = appointmentId ? parseInt(appointmentId, 10) : null;
      const normalizedAdmissionId = admissionId ? parseInt(admissionId, 10) : null;
      const createdBy = parseInt(req.user.id, 10);
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const result = await withTransaction(async (transaction) => {
        const request = () => new sql.Request(transaction);

        let existingPrescription = null;
        if (normalizedAppointmentId) {
          const existingRes = await request()
            .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
            .input('PatientId', sql.BigInt, normalizedPatientId)
            .input('DoctorId', sql.BigInt, doctorId)
            .query(`
              SELECT TOP 1 Id, RxNumber
              FROM dbo.Prescriptions
              WHERE AppointmentId = @AppointmentId
                AND PatientId = @PatientId
                AND DoctorId = @DoctorId
              ORDER BY CreatedAt DESC, Id DESC
            `);

          existingPrescription = existingRes.recordset[0] || null;
        }

        let prescriptionId = existingPrescription?.Id || null;
        let rxNumber = existingPrescription?.RxNumber || null;

        if (existingPrescription) {
          await request()
            .input('Id', sql.BigInt, prescriptionId)
            .input('AdmissionId', sql.BigInt, normalizedAdmissionId)
            .input('Diagnosis', sql.NVarChar(sql.MAX), diagnosis || null)
            .input('Notes', sql.NVarChar(sql.MAX), notes || null)
            .input('ValidUntil', sql.Date, validUntil || null)
            .input('UpdatedBy', sql.BigInt, createdBy)
            .query(`
              UPDATE dbo.Prescriptions
              SET AdmissionId = COALESCE(@AdmissionId, AdmissionId),
                  Diagnosis = @Diagnosis,
                  Notes = @Notes,
                  ValidUntil = @ValidUntil,
                  UpdatedBy = @UpdatedBy,
                  UpdatedAt = SYSUTCDATETIME()
              WHERE Id = @Id
            `);

          await request()
            .input('PrescriptionId', sql.BigInt, prescriptionId)
            .query(`
              DELETE FROM dbo.PrescriptionItems
              WHERE PrescriptionId = @PrescriptionId
            `);
        } else {
          rxNumber = `RX-${today}-${Math.floor(10000 + Math.random() * 90000)}`;

          const rxRes = await request()
            .input('HospitalId', sql.BigInt, hospitalId)
            .input('PatientId', sql.BigInt, normalizedPatientId)
            .input('DoctorId', sql.BigInt, doctorId)
            .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
            .input('AdmissionId', sql.BigInt, normalizedAdmissionId)
            .input('RxNumber', sql.NVarChar(50), rxNumber)
            .input('Diagnosis', sql.NVarChar(sql.MAX), diagnosis || null)
            .input('Notes', sql.NVarChar(sql.MAX), notes || null)
            .input('ValidUntil', sql.Date, validUntil || null)
            .input('CreatedBy', sql.BigInt, createdBy)
            .query(`
              INSERT INTO dbo.Prescriptions
                (HospitalId, PatientId, DoctorId, AppointmentId, AdmissionId,
                 RxNumber, Diagnosis, Notes, ValidUntil, CreatedBy)
              OUTPUT INSERTED.Id, INSERTED.RxNumber
              VALUES
                (@HospitalId, @PatientId, @DoctorId, @AppointmentId, @AdmissionId,
                 @RxNumber, @Diagnosis, @Notes, @ValidUntil, @CreatedBy);
            `);

          prescriptionId = rxRes.recordset[0].Id;
          rxNumber = rxRes.recordset[0].RxNumber;
        }

        for (const item of items) {
          await request()
            .input('PrescriptionId', sql.BigInt, prescriptionId)
            .input('MedicineId', item.medicineId ? parseInt(item.medicineId, 10) : null)
            .input('MedicineName', sql.NVarChar(255), item.medicineName || null)
            .input('Dosage', sql.NVarChar(100), item.dosage || null)
            .input('Frequency', sql.NVarChar(100), item.frequency || null)
            .input('Duration', sql.NVarChar(100), item.duration || null)
            .input('Quantity', sql.Int, item.quantity ? parseInt(item.quantity, 10) : null)
            .input('Route', sql.NVarChar(50), item.route || null)
            .input('Instructions', sql.NVarChar(sql.MAX), item.instructions || null)
            .query(`
              INSERT INTO dbo.PrescriptionItems
                (PrescriptionId, MedicineId, MedicineName, Dosage,
                 Frequency, Duration, Quantity, Route, Instructions)
              VALUES
                (@PrescriptionId, @MedicineId, @MedicineName, @Dosage,
                 @Frequency, @Duration, @Quantity, @Route, @Instructions);
            `);
        }

        return {
          prescriptionId,
          rxNumber,
          updated: Boolean(existingPrescription),
        };
      });

      res.status(result.updated ? 200 : 201).json({
        success: true,
        message: result.updated ? 'Prescription updated' : 'Prescription created',
        data: { id: result.prescriptionId, rxNumber: result.rxNumber, updated: result.updated }
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
