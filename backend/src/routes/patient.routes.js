// src/routes/patient.routes.js
const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool }                          = require('../config/database');
const { requireActivePatientProfile }      = require('../services/patientAccess.service');

router.use(protect);

const searchPatients = async (pool, search, limit) => {
  return pool.request()
    .input('Search', `%${search}%`)
    .input('Limit',  limit)
    .query(`
      SELECT TOP (@Limit)
        p.Id, p.UHID,
        p.FirstName, p.LastName,
        p.FirstName + ' ' + p.LastName AS FullName,
        p.Phone, p.Email,
        p.Gender, p.DateOfBirth,
        p.BloodGroup, p.PhotoUrl
      FROM dbo.PatientProfiles p
      WHERE p.DeletedAt IS NULL
        AND (
          p.FirstName                          LIKE @Search OR
          p.LastName                           LIKE @Search OR
          CONCAT(p.FirstName, ' ', p.LastName) LIKE @Search OR
          p.UHID                               LIKE @Search OR
          p.Phone                              LIKE @Search OR
          p.Email                              LIKE @Search
        )
      ORDER BY p.FirstName ASC, p.LastName ASC
    `);
};

// ── 1. GET /search  ───────────────────────────────────────────────────────────
router.get('/search', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const search = req.query.q || req.query.search || '';
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    console.log(`[DEBUG] /patients/search - Query: "${search}", Limit: ${limit}`);
    
    const result = await searchPatients(pool, search, limit);
    console.log(`[DEBUG] /patients/search - Found ${result.recordset?.length || 0} rows`);
    console.log(result.recordset);
    
    res.json({ success: true, data: result.recordset });
  } catch (err) { 
    console.error(`[DEBUG] /patients/search API Error:`, err);
    next(err); 
  }
});

// ── 2. GET /profile  ──────────────────────────────────────────────────────────
router.get('/profile', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
    const result = await pool.request()
      .input('PatientId', activeProfile.patientId)
      .query(`
        SELECT
          p.Id, p.UHID,
          p.FirstName, p.LastName, p.Gender,
          p.DateOfBirth, p.AgeYears, p.BloodGroup,
          p.Nationality, p.MaritalStatus, p.Occupation,
          p.Religion, p.MotherTongue, p.PhotoUrl,
          p.Phone, p.PhoneCountryCode, p.AltPhone, p.Email,
          p.Aadhaar, p.PAN, p.PassportNo, p.VoterId, p.AbhaNumber,
          p.Street1, p.Street2, p.City, p.PincodeText,
          p.EmergencyName, p.EmergencyRelation, p.EmergencyPhone,
          p.InsuranceProvider, p.InsurancePolicyNo, p.InsuranceValidUntil,
          p.KnownAllergies, p.ChronicConditions, p.CurrentMedications,
          p.CreatedAt, p.UpdatedAt,
          dist.Name AS DistrictName,
          st.Name   AS StateName,
          st.Code   AS StateCode,
          co.Name   AS CountryName,
          co.Iso2   AS CountryIso2
        FROM  dbo.PatientProfiles p
        LEFT JOIN dbo.Districts dist ON dist.Id = p.DistrictId
        LEFT JOIN dbo.States    st   ON st.Id   = p.StateId
        LEFT JOIN dbo.Countries co   ON co.Id   = p.CountryId
        WHERE p.Id        = @PatientId
          AND p.DeletedAt IS NULL
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) { next(err); }
});

// ── 3. PUT /profile  ──────────────────────────────────────────────────────────
router.put('/profile', async (req, res, next) => {
  try {
    const {
      firstName, lastName, gender, dateOfBirth, ageYears,
      bloodGroup, nationality, maritalStatus, occupation,
      religion, motherTongue, phone, altPhone, email,
      street1, street2, city, districtId, stateId, countryId,
      pincodeId, pincodeText, emergencyName, emergencyRelation,
      emergencyPhone, insuranceProvider, insurancePolicyNo,
      insuranceValidUntil, knownAllergies, chronicConditions,
      currentMedications
    } = req.body;

    const pool   = await getPool();
    const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
    if (!activeProfile.canUpdateProfile) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this profile' });
    }
    const result = await pool.request()
      .input('PatientId',           activeProfile.patientId)
      .input('FirstName',           firstName           ?? null)
      .input('LastName',            lastName            ?? null)
      .input('Gender',              gender              ?? null)
      .input('DateOfBirth',         dateOfBirth         ?? null)
      .input('AgeYears',            ageYears            ?? null)
      .input('BloodGroup',          bloodGroup          ?? null)
      .input('Nationality',         nationality         ?? null)
      .input('MaritalStatus',       maritalStatus       ?? null)
      .input('Occupation',          occupation          ?? null)
      .input('Religion',            religion            ?? null)
      .input('MotherTongue',        motherTongue        ?? null)
      .input('Phone',               phone               ?? null)
      .input('AltPhone',            altPhone            ?? null)
      .input('Email',               email               ?? null)
      .input('Street1',             street1             ?? null)
      .input('Street2',             street2             ?? null)
      .input('City',                city                ?? null)
      .input('DistrictId',          districtId          ?? null)
      .input('StateId',             stateId             ?? null)
      .input('CountryId',           countryId           ?? null)
      .input('PincodeId',           pincodeId           ?? null)
      .input('PincodeText',         pincodeText         ?? null)
      .input('EmergencyName',       emergencyName       ?? null)
      .input('EmergencyRelation',   emergencyRelation   ?? null)
      .input('EmergencyPhone',      emergencyPhone      ?? null)
      .input('InsuranceProvider',   insuranceProvider   ?? null)
      .input('InsurancePolicyNo',   insurancePolicyNo   ?? null)
      .input('InsuranceValidUntil', insuranceValidUntil ?? null)
      .input('KnownAllergies',      knownAllergies      ?? null)
      .input('ChronicConditions',   chronicConditions   ?? null)
      .input('CurrentMedications',  currentMedications  ?? null)
      .input('UpdatedBy',           req.user.id)
      .query(`
        UPDATE dbo.PatientProfiles SET
          FirstName           = COALESCE(@FirstName,           FirstName),
          LastName            = COALESCE(@LastName,            LastName),
          Gender              = COALESCE(@Gender,              Gender),
          DateOfBirth         = COALESCE(@DateOfBirth,         DateOfBirth),
          AgeYears            = COALESCE(@AgeYears,            AgeYears),
          BloodGroup          = COALESCE(@BloodGroup,          BloodGroup),
          Nationality         = COALESCE(@Nationality,         Nationality),
          MaritalStatus       = COALESCE(@MaritalStatus,       MaritalStatus),
          Occupation          = COALESCE(@Occupation,          Occupation),
          Religion            = COALESCE(@Religion,            Religion),
          MotherTongue        = COALESCE(@MotherTongue,        MotherTongue),
          Phone               = COALESCE(@Phone,               Phone),
          AltPhone            = COALESCE(@AltPhone,            AltPhone),
          Email               = COALESCE(@Email,               Email),
          Street1             = COALESCE(@Street1,             Street1),
          Street2             = COALESCE(@Street2,             Street2),
          City                = COALESCE(@City,                City),
          DistrictId          = COALESCE(@DistrictId,          DistrictId),
          StateId             = COALESCE(@StateId,             StateId),
          CountryId           = COALESCE(@CountryId,           CountryId),
          PincodeId           = COALESCE(@PincodeId,           PincodeId),
          PincodeText         = COALESCE(@PincodeText,         PincodeText),
          EmergencyName       = COALESCE(@EmergencyName,       EmergencyName),
          EmergencyRelation   = COALESCE(@EmergencyRelation,   EmergencyRelation),
          EmergencyPhone      = COALESCE(@EmergencyPhone,      EmergencyPhone),
          InsuranceProvider   = COALESCE(@InsuranceProvider,   InsuranceProvider),
          InsurancePolicyNo   = COALESCE(@InsurancePolicyNo,   InsurancePolicyNo),
          InsuranceValidUntil = COALESCE(@InsuranceValidUntil, InsuranceValidUntil),
          KnownAllergies      = COALESCE(@KnownAllergies,      KnownAllergies),
          ChronicConditions   = COALESCE(@ChronicConditions,   ChronicConditions),
          CurrentMedications  = COALESCE(@CurrentMedications,  CurrentMedications),
          UpdatedBy           = @UpdatedBy,
          UpdatedAt           = SYSUTCDATETIME()
        WHERE Id        = @PatientId
          AND DeletedAt IS NULL;
        SELECT @@ROWCOUNT AS Affected;
      `);

    if (!result.recordset[0]?.Affected) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) { next(err); }
});

// ── 4. GET /vitals  ───────────────────────────────────────────────────────────
router.get('/vitals', async (req, res, next) => {
  try {
    const pool = await getPool();
    const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
    const patientId = activeProfile.patientId;

    const result = await pool.request()
      .input('PatientId', patientId)
      .query(`
        SELECT TOP 10
          a.Id              AS AppointmentId,
          a.AppointmentNo,
          a.AppointmentDate,
          CONVERT(VARCHAR(5), TRY_CONVERT(time, a.AppointmentTime), 108) AS AppointmentTime,
          CONVERT(VARCHAR(5), TRY_CONVERT(time, a.EndTime), 108) AS EndTime,
          a.VisitType,
          a.Status,
          a.Notes,
          a.Reason,
          u.FirstName + ' ' + u.LastName AS DoctorName,
          dep.Name                        AS Department
        FROM  dbo.Appointments  a
        JOIN  dbo.DoctorProfiles dp  ON dp.Id = a.DoctorId
        JOIN  dbo.Users          u   ON u.Id  = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = a.DepartmentId
        WHERE a.PatientId = @PatientId
          AND a.Status    = 'Completed'
        ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

// ── 5. GET /  (list/search — admin roles only) — MUST BE LAST ─────────────────
router.get('/',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse'),
  async (req, res, next) => {
    try {
      const pool   = await getPool();
      const search = req.query.search || req.query.q || '';
      const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
      const page   = Math.max(parseInt(req.query.page)  || 1, 1);
      const offset = (page - 1) * limit;

      if (search) {
        const result = await searchPatients(pool, search, limit);
        return res.json({ success: true, data: result.recordset });
      }

      const result = await pool.request()
        .input('Limit',  limit)
        .input('Offset', offset)
        .query(`
          SELECT
            p.Id, p.UHID,
            p.FirstName, p.LastName,
            p.FirstName + ' ' + p.LastName AS FullName,
            p.Phone, p.Email,
            p.Gender, p.DateOfBirth,
            p.BloodGroup, p.PhotoUrl,
            p.CreatedAt
          FROM dbo.PatientProfiles p
          WHERE p.DeletedAt IS NULL
          ORDER BY p.CreatedAt DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

          SELECT COUNT(*) AS Total
          FROM dbo.PatientProfiles
          WHERE DeletedAt IS NULL;
        `);

      const patients = result.recordsets[0];
      const total    = result.recordsets[1]?.[0]?.Total || 0;

      res.json({
        success: true,
        data: patients,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (err) { next(err); }
  }
);

// ── GET /patients/:id  — full patient detail for doctors ─────────────────────
router.get('/:id',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse'),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const id   = parseInt(req.params.id);

      // Full profile
      const profileRes = await pool.request()
        .input('Id', id)
        .query(`
          SELECT
            p.Id, p.UHID, p.HospitalId,
            p.FirstName, p.LastName, p.FirstName + ' ' + p.LastName AS FullName,
            p.Gender, p.DateOfBirth, p.AgeYears, p.BloodGroup,
            p.Nationality, p.MaritalStatus, p.Occupation,
            p.Religion, p.MotherTongue, p.PhotoUrl,
            p.Phone, p.PhoneCountryCode, p.AltPhone, p.Email,
            p.Aadhaar, p.AbhaNumber,
            p.Street1, p.Street2, p.City, p.PincodeText,
            p.EmergencyName, p.EmergencyPhone, p.EmergencyRelation,
            p.KnownAllergies, p.ChronicConditions, p.CurrentMedications,
            p.InsuranceProvider, p.InsurancePolicyNo, p.InsuranceValidUntil,
            p.CreatedAt AS RegisteredAt,
            u.Username, u.Email AS UserEmail
          FROM dbo.PatientProfiles p
          LEFT JOIN dbo.Users u ON u.Id = p.UserId
          WHERE p.Id = @Id AND p.DeletedAt IS NULL
        `);

      if (!profileRes.recordset.length)
        return res.status(404).json({ success: false, message: 'Patient not found' });

      // Past appointments (last 20)
      const apptRes = await pool.request()
        .input('PatientId', id)
        .query(`
          SELECT TOP 20
            a.Id, a.AppointmentNo, a.AppointmentDate,
            CONVERT(VARCHAR(8), a.AppointmentTime, 108) AS AppointmentTime,
            CONVERT(VARCHAR(8), a.EndTime, 108) AS EndTime,
            a.VisitType, a.Status, a.Priority, a.Reason, a.Notes,
            a.TokenNumber, a.CancelReason,
            u.FirstName + ' ' + u.LastName AS DoctorName,
            sp.Name AS Specialization,
            d.Name  AS DepartmentName
          FROM dbo.Appointments a
          JOIN dbo.DoctorProfiles  dp ON dp.Id = a.DoctorId
          JOIN dbo.Users           u  ON u.Id  = dp.UserId
          LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
          LEFT JOIN dbo.Departments     d  ON d.Id  = a.DepartmentId
          WHERE a.PatientId = @PatientId
          ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC
        `);

      // Past prescriptions (last 10)
      const rxRes = await pool.request()
        .input('PatientId', id)
        .query(`
          SELECT TOP 10
            rx.Id, rx.RxNumber, rx.RxDate, rx.Diagnosis,
            rx.Notes, rx.Status, rx.ValidUntil,
            u.FirstName + ' ' + u.LastName AS DoctorName,
            (
              SELECT rxi.MedicineName, rxi.Dosage, rxi.Frequency, rxi.Duration, rxi.Instructions
              FROM dbo.PrescriptionItems rxi
              WHERE rxi.PrescriptionId = rx.Id
              FOR JSON PATH
            ) AS Items
          FROM dbo.Prescriptions rx
          JOIN dbo.DoctorProfiles dp ON dp.Id = rx.DoctorId
          JOIN dbo.Users          u  ON u.Id  = dp.UserId
          WHERE rx.PatientId = @PatientId
          ORDER BY rx.RxDate DESC
        `);

      // Latest vitals — table may not exist, handle gracefully
      let vitalsRes = { recordset: [] };
      try {
        vitalsRes = await pool.request()
          .input('PatientId', id)
          .query(`
            SELECT TOP 1
              v.RecordedAt, v.BloodPressureSystolic, v.BloodPressureDiastolic,
              v.HeartRate, v.Temperature, v.OxygenSaturation,
              v.Weight, v.Height, v.BMI, v.Notes
            FROM dbo.PatientVitals v
            WHERE v.PatientId = @PatientId
            ORDER BY v.RecordedAt DESC
          `);
      } catch (_) { /* vitals table may not exist */ }

      // Lab orders summary (last 5)
      const labRes = await pool.request()
        .input('PatientId', id)
        .query(`
          SELECT TOP 5
            lo.Id, lo.OrderNumber, lo.OrderDate, lo.Status, lo.Priority,
            u.FirstName + ' ' + u.LastName AS OrderedByName
          FROM dbo.LabOrders lo
          LEFT JOIN dbo.Users u ON u.Id = lo.OrderedBy
          WHERE lo.PatientId = @PatientId
          ORDER BY lo.OrderDate DESC
        `);

      const prescriptions = rxRes.recordset.map(r => ({
        ...r,
        Items: r.Items ? JSON.parse(r.Items) : [],
      }));

      res.json({
        success: true,
        data: {
          profile:       {
            ...profileRes.recordset[0],
            EmergencyContactName:  profileRes.recordset[0]?.EmergencyName,
            EmergencyContactPhone: profileRes.recordset[0]?.EmergencyPhone,
          },
          appointments:  apptRes.recordset,
          prescriptions,
          vitals:        vitalsRes.recordset[0] || null,
          labOrders:     labRes.recordset,
        },
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
