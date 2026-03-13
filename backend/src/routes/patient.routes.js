// src/routes/patient.routes.js
const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool }                          = require('../config/database');

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
    const result = await searchPatients(pool, search, limit);
    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
});

// ── 2. GET /profile  ──────────────────────────────────────────────────────────
router.get('/profile', async (req, res, next) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('UserId', req.user.id)
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
        WHERE p.UserId    = @UserId
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
    const result = await pool.request()
      .input('UserId',              req.user.id)
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
        WHERE UserId    = @UserId
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

    const patRes = await pool.request()
      .input('UserId', req.user.id)
      .query(`
        SELECT Id FROM dbo.PatientProfiles
        WHERE UserId = @UserId AND DeletedAt IS NULL
      `);

    if (!patRes.recordset.length) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const patientId = patRes.recordset[0].Id;

    const result = await pool.request()
      .input('PatientId', patientId)
      .query(`
        SELECT TOP 10
          a.Id              AS AppointmentId,
          a.AppointmentNo,
          a.AppointmentDate,
          a.AppointmentTime,
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

module.exports = router;