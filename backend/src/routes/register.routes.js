// src/routes/register.routes.js
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const multer  = require('multer');
const { query, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');
const { success, created } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

// ── Multer: memory storage ────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg','image/jpg','image/png','application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(`File type ${file.mimetype} not allowed.`, 400), false);
  },
});

const handleV = (req) => {
  const e = validationResult(req);
  if (!e.isEmpty()) {
    console.error('❌ Validation errors:', JSON.stringify(e.array(), null, 2));
    throw new AppError('Validation failed', 422, e.array());
  }
};

const parseDate = (value, fieldName = 'Date', { mustBePast = false, mustBeFuture = false } = {}) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new AppError(`Invalid ${fieldName}.`, 400);
  const now = new Date();
  if (mustBePast   && d >= now) throw new AppError(`${fieldName} must be in the past.`, 400);
  if (mustBeFuture && d <= now) throw new AppError(`${fieldName} must be a future date.`, 400);
  return d;
};

const formatTime = (t) => {
  if (!t) return undefined;
  const parts = t.trim().split(':');
  if (parts.length < 2) return undefined;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  if (isNaN(h) || isNaN(m) || isNaN(s)) return undefined;
  const d = new Date();
  d.setHours(h, m, s, 0);
  return d;
};

// ── GET /register/hospital-info?hospitalId=1 ─────────────────────────────────
router.get('/hospital-info', async (req, res, next) => {
  try {
    const hospitalId = parseInt(req.query.hospitalId) || 1;
    const result = await query(
      `SELECT h.Id, h.Name, h.ShortName, h.LogoUrl, h.PrimaryColor, h.SecondaryColor,
              h.Email, h.Phone, h.Website, h.City, h.Status,
              h.Street1, h.Street2, h.PincodeText,
              h.EmergencyNumber, h.AmbulanceNumber,
              h.Accreditations, h.Specialities, h.BedCapacity, h.EstablishedYear,
              d.Name AS DistrictName, s.Name AS StateName, c.Name AS CountryName
       FROM dbo.HospitalSetup h
       LEFT JOIN dbo.Districts d ON d.Id = h.DistrictId
       LEFT JOIN dbo.States   s  ON s.Id = h.StateId
       LEFT JOIN dbo.Countries c ON c.Id = h.CountryId
       WHERE h.Id = @id AND h.DeletedAt IS NULL AND h.Status = 'active'`,
      { id: { type: sql.BigInt, value: hospitalId } }
    );
    if (!result.recordset.length) {
      return success(res, { name: 'MediCore HMS', primaryColor: '#6d28d9' });
    }
    success(res, result.recordset[0]);
  } catch (err) { next(err); }
});

// ── POST /register/patient ────────────────────────────────────────────────────
router.post('/patient', [
  body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
  body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name required'),
  body('lastName').trim().isLength({ min: 1, max: 100 }).withMessage('Last name required'),
  body('phone').trim().notEmpty().withMessage('Phone number required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('gender').optional({ checkFalsy: true }).isIn(['Male', 'Female', 'Other', 'PreferNot']),
  body('dateOfBirth').optional({ checkFalsy: true }).isDate().withMessage('Invalid date of birth'),
  body('bloodGroup').optional({ checkFalsy: true }).isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-']),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password needs uppercase, lowercase and number'),
], async (req, res, next) => {
  try {
    handleV(req);

    const {
      hospitalId, firstName, lastName, phone, phoneCountryCode,
      email, gender, dateOfBirth, password, bloodGroup,
      maritalStatus, religion, occupation, fatherName, husbandName,
      dateOfArrival,
      street1, street2, city,
      countryId, stateId, districtId, pincodeId, pincodeText,
      emergencyName, emergencyRelation, emergencyPhone,
      knownAllergies, chronicConditions,
      pastSurgery, pastSurgeryDetails, additionalNotes,
      insuranceProvider, insurancePolicyNo, insuranceValidUntil,
      idType, idNumber,
      username: reqUsername,
    } = req.body;

    const dobValue    = parseDate(dateOfBirth,        'Date of birth',         { mustBePast: true });
    const insExpValue = parseDate(insuranceValidUntil, 'Insurance expiry date', { mustBeFuture: true });
    const hid = parseInt(hospitalId);

    const dupPhone = await query(
      `SELECT Id FROM dbo.Users WHERE Phone = @p AND DeletedAt IS NULL`,
      { p: { type: sql.NVarChar(20), value: phone } }
    );
    if (dupPhone.recordset.length) throw new AppError('A user with this phone number already exists.', 409);

    if (email) {
      const dupEmail = await query(
        `SELECT Id FROM dbo.Users WHERE LOWER(Email) = LOWER(@e) AND DeletedAt IS NULL`,
        { e: { type: sql.NVarChar(255), value: email } }
      );
      if (dupEmail.recordset.length) throw new AppError('An account with this email already exists.', 409);
    }

    const username = (reqUsername || '').trim().toLowerCase() ||
      `pat_${phone.replace(/\D/g, '').slice(-8)}_${Date.now().toString().slice(-4)}`;

    const dupUser = await query(
      `SELECT Id FROM dbo.Users WHERE Username = @u AND DeletedAt IS NULL`,
      { u: { type: sql.NVarChar(80), value: username } }
    );
    if (dupUser.recordset.length) throw new AppError('Username already taken. Please choose another.', 409);

    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    const userRes = await query(
      `INSERT INTO dbo.Users
         (HospitalId, Username, Email, Phone, PhoneCountryCode, PasswordHash, Role,
          FirstName, LastName, Gender, DateOfBirth, IsActive, CreatedBy)
       OUTPUT INSERTED.Id
       VALUES
         (@hid, @uname, @email, @phone, @pcc, @hash, 'patient',
          @fname, @lname, @gender, @dob, 1, NULL)`,
      {
        hid:    { type: sql.BigInt,            value: hid },
        uname:  { type: sql.NVarChar(80),      value: username },
        email:  { type: sql.NVarChar(255),     value: email || null },
        phone:  { type: sql.NVarChar(20),      value: phone },
        pcc:    { type: sql.NVarChar(10),      value: phoneCountryCode || '+91' },
        hash:   { type: sql.NVarChar(sql.MAX), value: hash },
        fname:  { type: sql.NVarChar(100),     value: firstName.trim() },
        lname:  { type: sql.NVarChar(100),     value: lastName.trim() },
        gender: { type: sql.NVarChar(20),      value: gender || null },
        dob:    { type: sql.Date,              value: dobValue },
      }
    );
    const userId = userRes.recordset[0].Id;

    let aadhaar = null, pan = null, passportNo = null, voterId = null;
    if (idType && idNumber) {
      const num = idNumber.trim().toUpperCase();
      if      (idType === 'Aadhar Card') aadhaar    = num.replace(/\D/g, '').slice(0, 12);
      else if (idType === 'PAN Card')    pan        = num.slice(0, 10);
      else if (idType === 'Passport')    passportNo = num.slice(0, 30);
      else if (idType === 'Voter ID')    voterId    = num.slice(0, 30);
    }

    const safeCountryId  = countryId  && Number(countryId) > 0  ? parseInt(countryId)  : null;
    const safeStateId    = stateId    && Number(stateId) > 0    ? parseInt(stateId)    : null;
    const safeDistrictId = districtId && Number(districtId) > 0 ? parseInt(districtId) : null;
    const safePincodeId  = pincodeId  && Number(pincodeId) > 0  ? parseInt(pincodeId)  : null;

    await query(
      `INSERT INTO dbo.PatientProfiles
         (UserId, HospitalId, FirstName, LastName, Gender, DateOfBirth,
          BloodGroup, Phone, PhoneCountryCode, Email,
          Street1, City, DistrictId, StateId, CountryId, PincodeId, PincodeText,
          EmergencyName, EmergencyRelation, EmergencyPhone, CreatedBy)
       VALUES
         (@uid, @hid, @fname, @lname, @gender, @dob,
          @bg, @phone, @pcc, @email,
          @s1, @city, @did, @sid, @cid, @pid, @ptext,
          @ename, @erel, @ephone, @uid)`,
      {
        uid:    { type: sql.BigInt,        value: userId },
        hid:    { type: sql.BigInt,        value: hid },
        fname:  { type: sql.NVarChar(100), value: firstName.trim() },
        lname:  { type: sql.NVarChar(100), value: lastName.trim() },
        gender: { type: sql.NVarChar(20),  value: gender || null },
        dob:    { type: sql.Date,          value: dobValue },
        bg:     { type: sql.NVarChar(5),   value: bloodGroup || null },
        phone:  { type: sql.NVarChar(20),  value: phone },
        pcc:    { type: sql.NVarChar(10),  value: phoneCountryCode || '+91' },
        email:  { type: sql.NVarChar(255), value: email || null },
        s1:     { type: sql.NVarChar(255), value: street1 || null },
        city:   { type: sql.NVarChar(100), value: city || null },
        did:    { type: sql.Int,           value: safeDistrictId },
        sid:    { type: sql.Int,           value: safeStateId },
        cid:    { type: sql.Int,           value: safeCountryId },
        pid:    { type: sql.Int,           value: safePincodeId },
        ptext:  { type: sql.NVarChar(20),  value: pincodeText || null },
        ename:  { type: sql.NVarChar(200), value: emergencyName || null },
        erel:   { type: sql.NVarChar(80),  value: emergencyRelation || null },
        ephone: { type: sql.NVarChar(20),  value: emergencyPhone || null },
      }
    );

    await query(
      `UPDATE dbo.PatientProfiles SET
         Street2             = @s2,
         MaritalStatus       = @marital,
         Religion            = @religion,
         Occupation          = @occupation,
         Aadhaar             = @aadhaar,
         PAN                 = @pan,
         PassportNo          = @passportNo,
         VoterId             = @voterId,
         KnownAllergies      = @allergies,
         ChronicConditions   = @chronic,
         InsuranceProvider   = @insProv,
         InsurancePolicyNo   = @insPol,
         InsuranceValidUntil = @insExp
       WHERE UserId = @uid`,
      {
        uid:        { type: sql.BigInt,            value: userId },
        s2:         { type: sql.NVarChar(255),     value: street2 || null },
        marital:    { type: sql.NVarChar(20),      value: maritalStatus || null },
        religion:   { type: sql.NVarChar(80),      value: religion || null },
        occupation: { type: sql.NVarChar(150),     value: occupation || null },
        aadhaar:    { type: sql.NVarChar(12),      value: aadhaar },
        pan:        { type: sql.NVarChar(10),      value: pan },
        passportNo: { type: sql.NVarChar(30),      value: passportNo },
        voterId:    { type: sql.NVarChar(30),      value: voterId },
        allergies:  { type: sql.NVarChar(sql.MAX), value: knownAllergies || null },
        chronic:    { type: sql.NVarChar(sql.MAX), value:
                       chronicConditions
                         ? `${chronicConditions}${pastSurgery === 'yes' && pastSurgeryDetails ? `\nPast Surgery: ${pastSurgeryDetails}` : ''}`
                         : pastSurgery === 'yes' && pastSurgeryDetails
                           ? `Past Surgery: ${pastSurgeryDetails}`
                           : null },
        insProv:    { type: sql.NVarChar(200),     value: insuranceProvider || null },
        insPol:     { type: sql.NVarChar(100),     value: insurancePolicyNo || null },
        insExp:     { type: sql.NVarChar(20),      value: insuranceValidUntil || null },
      }
    );

    created(res, { username }, 'Patient registered successfully. You can now log in.');
  } catch (err) { next(err); }
});

// ── POST /register/doctor ─────────────────────────────────────────────────────
router.post('/doctor',
  upload.any(),
  [
    body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('phone').trim().notEmpty().withMessage('Phone required'),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password needs uppercase, lowercase and number'),
    body('licenseNumber').trim().notEmpty().withMessage('License number required'),
    body('specializationId').isInt({ min: 1 }).withMessage('Specialization required'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);

      const {
        hospitalId, firstName, lastName, email, phone, phoneCountryCode, altPhone,
        password, username: reqUsername,
        gender, dateOfBirth, bloodGroup, nationality, maritalStatus,
        religion, occupation, motherTongue, designation,
        specializationId, qualificationId, medicalCouncilId, departmentId,
        licenseNumber, licenseExpiry, experienceYears,
        consultationFee, followUpFee, emergencyFee, maxDailyPatients,
        languagesSpoken, availableDays, availableFrom, availableTo,
        bio, awards, publications,
        aadhaar, pan, passportNo, voterId, abhaNumber,
        street1, street2, city, countryId, stateId, pincode,
      } = req.body;

      const dobValue    = parseDate(dateOfBirth,   'Date of birth',  { mustBePast: true });
      const licExpValue = parseDate(licenseExpiry, 'License expiry', { mustBeFuture: true });
      if (!licExpValue) throw new AppError('License expiry date is required.', 400);
      const hid = parseInt(hospitalId);

      const dupEmail = await query(
        `SELECT Id FROM dbo.Users WHERE LOWER(Email) = LOWER(@e) AND DeletedAt IS NULL`,
        { e: { type: sql.NVarChar(255), value: email } }
      );
      if (dupEmail.recordset.length) throw new AppError('An account with this email already exists.', 409);

      const dupPhone = await query(
        `SELECT Id FROM dbo.Users WHERE Phone = @p AND DeletedAt IS NULL`,
        { p: { type: sql.NVarChar(20), value: phone } }
      );
      if (dupPhone.recordset.length) throw new AppError('An account with this phone number already exists.', 409);

      const username = (reqUsername || '').trim().toLowerCase() ||
        `dr_${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-4)}`;

      const dupUser = await query(
        `SELECT Id FROM dbo.Users WHERE Username = @u AND DeletedAt IS NULL`,
        { u: { type: sql.NVarChar(80), value: username } }
      );
      if (dupUser.recordset.length) throw new AppError('Username already taken. Please choose another.', 409);

      const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

      const safeCountryId = countryId && Number(countryId) > 0 ? parseInt(countryId) : null;
      const safeStateId   = stateId   && Number(stateId) > 0   ? parseInt(stateId)   : null;

      const userRes = await query(
        `INSERT INTO dbo.Users
           (HospitalId, Username, Email, Phone, PhoneCountryCode, AltPhone,
            PasswordHash, Role, FirstName, LastName, Gender, DateOfBirth,
            IsActive, DepartmentId, Designation, CreatedBy)
         OUTPUT INSERTED.Id
         VALUES
           (@hid, @uname, @email, @phone, @pcc, @alt,
            @hash, 'doctor', @fname, @lname, @gender, @dob,
            0, @did, @desig, NULL)`,
        {
          hid:    { type: sql.BigInt,            value: hid },
          uname:  { type: sql.NVarChar(80),      value: username },
          email:  { type: sql.NVarChar(255),     value: email },
          phone:  { type: sql.NVarChar(20),      value: phone },
          pcc:    { type: sql.NVarChar(10),      value: phoneCountryCode || '+91' },
          alt:    { type: sql.NVarChar(20),      value: altPhone || null },
          hash:   { type: sql.NVarChar(sql.MAX), value: hash },
          fname:  { type: sql.NVarChar(100),     value: firstName.trim() },
          lname:  { type: sql.NVarChar(100),     value: lastName.trim() },
          gender: { type: sql.NVarChar(20),      value: gender || null },
          dob:    { type: sql.Date,              value: dobValue },
          did:    { type: sql.BigInt,            value: departmentId || null },
          desig:  { type: sql.NVarChar(150),     value: designation || null },
        }
      );
      const userId = userRes.recordset[0].Id;

      const cleanAadhaar = aadhaar ? aadhaar.replace(/\D/g, '').slice(0, 12) : null;
      const cleanPan     = pan     ? pan.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : null;

      const fromValue = formatTime(availableFrom);
      const toValue   = formatTime(availableTo);

      await query(
        `INSERT INTO dbo.DoctorProfiles
           (UserId, HospitalId, DepartmentId, SpecializationId, QualificationId,
            MedicalCouncilId, LicenseNumber, LicenseExpiry, ExperienceYears,
            ConsultationFee, FollowUpFee, EmergencyFee, MaxDailyPatients,
            LanguagesSpoken, AvailableDays, AvailableFrom, AvailableTo,
            Bio, Awards, Publications,
            BloodGroup, Nationality, AltPhone,
            Aadhaar, PAN,
            Street1, Street2, City, CountryId, StateId, PincodeText,
            ApprovalStatus, CreatedBy)
         VALUES
           (@uid, @hid, @did, @spec, @qual,
            @council, @lic, @licexp, @exp,
            @fee, @followfee, @emergfee, @maxpat,
            @langs, @days, @from, @to,
            @bio, @awards, @pubs,
            @blood, @nation, @alt,
            @aadhaar, @pan,
            @s1, @s2, @city, @cid, @sid, @ptext,
            'pending', NULL)`,
        {
          uid:       { type: sql.BigInt,            value: userId },
          hid:       { type: sql.BigInt,            value: hid },
          did:       { type: sql.BigInt,            value: departmentId || null },
          spec:      { type: sql.Int,               value: parseInt(specializationId) },
          qual:      { type: sql.Int,               value: qualificationId || null },
          council:   { type: sql.Int,               value: medicalCouncilId || null },
          lic:       { type: sql.NVarChar(100),     value: licenseNumber.trim() },
          licexp:    { type: sql.Date,              value: licExpValue },
          exp:       { type: sql.SmallInt,          value: experienceYears ? parseInt(experienceYears) : null },
          fee:       { type: sql.Decimal(10, 2),    value: consultationFee ? parseFloat(consultationFee) : null },
          followfee: { type: sql.Decimal(10, 2),    value: followUpFee ? parseFloat(followUpFee) : null },
          emergfee:  { type: sql.Decimal(10, 2),    value: emergencyFee ? parseFloat(emergencyFee) : null },
          maxpat:    { type: sql.SmallInt,          value: maxDailyPatients ? parseInt(maxDailyPatients) : null },
          langs:     { type: sql.NVarChar(300),     value: languagesSpoken || null },
          days:      { type: sql.NVarChar(100),     value: availableDays || null },
          ...(fromValue !== undefined
            ? { from: { type: sql.Time,         value: fromValue } }
            : { from: { type: sql.NVarChar(10), value: null     } }),
          ...(toValue !== undefined
            ? { to:   { type: sql.Time,         value: toValue  } }
            : { to:   { type: sql.NVarChar(10), value: null     } }),
          bio:       { type: sql.NVarChar(sql.MAX), value: bio || null },
          awards:    { type: sql.NVarChar(sql.MAX), value: awards || null },
          pubs:      { type: sql.NVarChar(sql.MAX), value: publications || null },
          blood:     { type: sql.NVarChar(5),       value: bloodGroup || null },
          nation:    { type: sql.NVarChar(80),      value: nationality || 'Indian' },
          alt:       { type: sql.NVarChar(20),      value: altPhone || null },
          aadhaar:   { type: sql.NVarChar(12),      value: cleanAadhaar },
          pan:       { type: sql.NVarChar(10),      value: cleanPan },
          s1:        { type: sql.NVarChar(255),     value: street1 || null },
          s2:        { type: sql.NVarChar(255),     value: street2 || null },
          city:      { type: sql.NVarChar(100),     value: city || null },
          cid:       { type: sql.Int,               value: safeCountryId },
          sid:       { type: sql.Int,               value: safeStateId },
          ptext:     { type: sql.NVarChar(20),      value: pincode || null },
        }
      );

      if (req.files && req.files.length > 0) {
        console.log(`📎 ${req.files.length} file(s) received for doctor ${userId} — storage integration pending`);
      }

      created(res, { username }, 'Doctor registration submitted. Awaiting admin approval.');
    } catch (err) { next(err); }
  }
);

// ── POST /register/staff ──────────────────────────────────────────────────────
// PUBLIC — no authentication required (mirrors /register/doctor).
// Creates User (IsActive=0) + StaffProfiles (ApprovalStatus='pending').
// Admin approves via PATCH /register/approve-staff/:id to activate the account.
router.post('/staff',
  upload.any(),
  [
    body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('phone').trim().notEmpty().withMessage('Phone required'),
    body('role').trim().notEmpty().withMessage('Role required'),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password needs uppercase, lowercase and number'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);

      const {
        hospitalId, firstName, lastName, email, phone, phoneCountryCode, altPhone,
        password, username: reqUsername,
        gender, dateOfBirth, bloodGroup, nationality, maritalStatus,
        religion, motherTongue,
        role, departmentId, employeeId, joiningDate, shiftType, qualification,
        contractType, reportingManager,
        workStartTime, workEndTime, weeklyOff,
        emergencyName, emergencyRelation, emergencyPhone,
        aadhaar, pan, passportNo, voterId, abhaNumber,
        street1, street2, city, countryId, stateId, pincode,
        languagesSpoken, previousEmployer, experienceYears,
        bankAccountNo, ifscCode, knownAllergies, bloodDonor,
      } = req.body;

      const hid       = parseInt(hospitalId);
      const dobValue  = parseDate(dateOfBirth, 'Date of birth', { mustBePast: true });
      const joinValue = parseDate(joiningDate, 'Joining date');

      const dupEmail = await query(
        `SELECT Id FROM dbo.Users WHERE LOWER(Email) = LOWER(@e) AND DeletedAt IS NULL`,
        { e: { type: sql.NVarChar(255), value: email } }
      );
      if (dupEmail.recordset.length) throw new AppError('An account with this email already exists.', 409);

      const dupPhone = await query(
        `SELECT Id FROM dbo.Users WHERE Phone = @p AND DeletedAt IS NULL`,
        { p: { type: sql.NVarChar(20), value: phone } }
      );
      if (dupPhone.recordset.length) throw new AppError('An account with this phone number already exists.', 409);

      const username = (reqUsername || '').trim().toLowerCase() ||
        `${role.replace(/[^a-z]/g,'').slice(0,4)}_${phone.replace(/\D/g,'').slice(-8)}_${Date.now().toString().slice(-4)}`;

      const dupUser = await query(
        `SELECT Id FROM dbo.Users WHERE Username = @u AND DeletedAt IS NULL`,
        { u: { type: sql.NVarChar(80), value: username } }
      );
      if (dupUser.recordset.length) throw new AppError('Username already taken.', 409);

      const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

      const safeCountryId = countryId && Number(countryId) > 0 ? parseInt(countryId) : null;
      const safeStateId   = stateId   && Number(stateId) > 0   ? parseInt(stateId)   : null;

      // ── Insert User (IsActive=0, pending admin approval) ──────────────────
      const userRes = await query(
        `INSERT INTO dbo.Users
           (HospitalId, Username, Email, Phone, PhoneCountryCode, AltPhone,
            PasswordHash, Role, FirstName, LastName, Gender, DateOfBirth,
            IsActive, DepartmentId, EmployeeId, CreatedBy)
         OUTPUT INSERTED.Id
         VALUES
           (@hid, @uname, @email, @phone, @pcc, @alt,
            @hash, @role, @fname, @lname, @gender, @dob,
            0, @did, @empid, NULL)`,
        {
          hid:    { type: sql.BigInt,            value: hid },
          uname:  { type: sql.NVarChar(80),      value: username },
          email:  { type: sql.NVarChar(255),     value: email },
          phone:  { type: sql.NVarChar(20),      value: phone },
          pcc:    { type: sql.NVarChar(10),      value: phoneCountryCode || '+91' },
          alt:    { type: sql.NVarChar(20),      value: altPhone || null },
          hash:   { type: sql.NVarChar(sql.MAX), value: hash },
          role:   { type: sql.NVarChar(30),      value: role.trim() },
          fname:  { type: sql.NVarChar(100),     value: firstName.trim() },
          lname:  { type: sql.NVarChar(100),     value: lastName.trim() },
          gender: { type: sql.NVarChar(20),      value: gender || null },
          dob:    { type: sql.Date,              value: dobValue },
          did:    { type: sql.BigInt,            value: departmentId || null },
          empid:  { type: sql.NVarChar(60),      value: employeeId || null },
        }
      );
      const userId = userRes.recordset[0].Id;

      const cleanAadhaar = aadhaar ? aadhaar.replace(/\D/g,'').slice(0,12) : null;
      const cleanPan     = pan     ? pan.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10) : null;
      const fromValue    = formatTime(workStartTime);
      const toValue      = formatTime(workEndTime);

      // ── Insert StaffProfiles (ApprovalStatus='pending') ───────────────────
      await query(
        `INSERT INTO dbo.StaffProfiles
           (UserId, HospitalId, DepartmentId, EmployeeId,
            Shift, JoiningDate, ContractType, ReportingManager,
            WorkStartTime, WorkEndTime, WeeklyOff,
            BloodGroup, Nationality, AltPhone,
            Aadhaar, PAN, PassportNo, VoterId, AbhaNumber,
            Street1, Street2, City, CountryId, StateId, PincodeText,
            Qualification, LanguagesSpoken, PreviousEmployer, ExperienceYears,
            BankAccountNo, IfscCode, KnownAllergies, BloodDonor,
            MaritalStatus, Religion, MotherTongue,
            EmergencyName, EmergencyRelation, EmergencyPhone,
            ApprovalStatus, CreatedBy)
         VALUES
           (@uid, @hid, @did, @empid,
            @shift, @join, @contract, @manager,
            @wstart, @wend, @weekoff,
            @blood, @nation, @alt,
            @aadhaar, @pan, @passport, @voter, @abha,
            @s1, @s2, @city, @cid, @sid, @ptext,
            @qual, @langs, @prevEmp, @exp,
            @bank, @ifsc, @allergies, @donor,
            @marital, @religion, @tongue,
            @ename, @erel, @ephone,
            'pending', NULL)`,
        {
          uid:      { type: sql.BigInt,            value: userId },
          hid:      { type: sql.BigInt,            value: hid },
          did:      { type: sql.BigInt,            value: departmentId || null },
          empid:    { type: sql.NVarChar(60),      value: employeeId || null },
          shift:    { type: sql.NVarChar(20),      value: shiftType || null },
          join:     { type: sql.Date,              value: joinValue },
          contract: { type: sql.NVarChar(30),      value: contractType || null },
          manager:  { type: sql.NVarChar(150),     value: reportingManager || null },
          ...(fromValue !== undefined
            ? { wstart: { type: sql.Time,         value: fromValue } }
            : { wstart: { type: sql.NVarChar(10), value: null     } }),
          ...(toValue !== undefined
            ? { wend:   { type: sql.Time,         value: toValue  } }
            : { wend:   { type: sql.NVarChar(10), value: null     } }),
          weekoff:  { type: sql.NVarChar(100),     value: weeklyOff || null },
          blood:    { type: sql.NVarChar(5),       value: bloodGroup || null },
          nation:   { type: sql.NVarChar(80),      value: nationality || 'Indian' },
          alt:      { type: sql.NVarChar(20),      value: altPhone || null },
          aadhaar:  { type: sql.NVarChar(12),      value: cleanAadhaar },
          pan:      { type: sql.NVarChar(10),      value: cleanPan },
          passport: { type: sql.NVarChar(30),      value: passportNo || null },
          voter:    { type: sql.NVarChar(30),      value: voterId || null },
          abha:     { type: sql.NVarChar(30),      value: abhaNumber || null },
          s1:       { type: sql.NVarChar(255),     value: street1 || null },
          s2:       { type: sql.NVarChar(255),     value: street2 || null },
          city:     { type: sql.NVarChar(100),     value: city || null },
          cid:      { type: sql.Int,               value: safeCountryId },
          sid:      { type: sql.Int,               value: safeStateId },
          ptext:    { type: sql.NVarChar(20),      value: pincode || null },
          qual:     { type: sql.NVarChar(200),     value: qualification || null },
          langs:    { type: sql.NVarChar(300),     value: languagesSpoken || null },
          prevEmp:  { type: sql.NVarChar(200),     value: previousEmployer || null },
          exp:      { type: sql.SmallInt,          value: experienceYears ? parseInt(experienceYears) : null },
          bank:     { type: sql.NVarChar(30),      value: bankAccountNo || null },
          ifsc:     { type: sql.NVarChar(15),      value: ifscCode || null },
          allergies:{ type: sql.NVarChar(sql.MAX), value: knownAllergies || null },
          donor:    { type: sql.NVarChar(10),      value: bloodDonor || null },
          marital:  { type: sql.NVarChar(20),      value: maritalStatus || null },
          religion: { type: sql.NVarChar(80),      value: religion || null },
          tongue:   { type: sql.NVarChar(80),      value: motherTongue || null },
          ename:    { type: sql.NVarChar(200),     value: emergencyName || null },
          erel:     { type: sql.NVarChar(80),      value: emergencyRelation || null },
          ephone:   { type: sql.NVarChar(20),      value: emergencyPhone || null },
        }
      );

      if (req.files && req.files.length > 0) {
        console.log(`📎 ${req.files.length} file(s) received for staff ${userId} — storage pending`);
      }

      created(res, { username }, 'Staff registration submitted. Awaiting admin approval.');
    } catch (err) { next(err); }
  }
);

// ── GET /register/pending-staff ───────────────────────────────────────────────
router.get('/pending-staff',
  authenticate,
  authorize('superadmin', 'admin'),
  async (req, res, next) => {
    try {
      const statusFilter = req.query.status || 'pending';
      const hospitalId = req.user.role === 'superadmin'
        ? (parseInt(req.query.hospitalId) || null)
        : req.user.hospitalId;

      const result = await query(
        `SELECT
           sp.Id, sp.UserId, sp.ApprovalStatus AS Status,
           sp.EmployeeId, sp.Shift, sp.JoiningDate, sp.ContractType,
           sp.ReportingManager, sp.Qualification, sp.ExperienceYears,
           sp.LanguagesSpoken, sp.BloodGroup, sp.Nationality,
           sp.Street1, sp.Street2, sp.City, sp.PincodeText AS Pincode,
           sp.RejectionReason, sp.ApprovedAt AS ReviewedAt,
           sp.CreatedAt,
           u.FirstName, u.LastName, u.Email, u.Phone, u.AltPhone,
           u.Gender, u.DateOfBirth, u.Role, u.Username,
           dep.Name AS DepartmentName,
           co.Name  AS CountryName,
           st.Name  AS StateName
         FROM dbo.StaffProfiles sp
         JOIN dbo.Users u ON u.Id = sp.UserId
         LEFT JOIN dbo.Departments dep ON dep.Id = sp.DepartmentId
         LEFT JOIN dbo.Countries   co  ON co.Id  = sp.CountryId
         LEFT JOIN dbo.States      st  ON st.Id  = sp.StateId
         WHERE (@status = 'all' OR sp.ApprovalStatus = @status)
           AND (@hid IS NULL OR sp.HospitalId = @hid)
         ORDER BY sp.CreatedAt DESC`,
        {
          status: { type: sql.NVarChar(20), value: statusFilter },
          hid:    { type: sql.BigInt,       value: hospitalId },
        }
      );
      success(res, result.recordset);
    } catch (err) { next(err); }
  }
);

// ── GET /register/pending-doctors ────────────────────────────────────────────
router.get('/pending-doctors',
  authenticate,
  authorize('superadmin', 'admin'),
  async (req, res, next) => {
    try {
      const statusFilter = req.query.status || 'pending';
      const hospitalId = req.user.role === 'superadmin'
        ? (parseInt(req.query.hospitalId) || null)
        : req.user.hospitalId;

      const result = await query(
        `SELECT
           dp.Id, dp.UserId, dp.ApprovalStatus AS Status,
           dp.LicenseNumber, dp.LicenseExpiry, dp.ExperienceYears,
           dp.ConsultationFee, dp.FollowUpFee, dp.EmergencyFee,
           dp.MaxDailyPatients, dp.AvailableDays, dp.AvailableFrom, dp.AvailableTo,
           dp.LanguagesSpoken, dp.Bio, dp.Awards, dp.Publications,
           dp.BloodGroup, dp.Nationality,
           dp.Aadhaar, dp.PAN, dp.PassportNo, dp.VoterId, dp.AbhaNumber,
           dp.Street1, dp.Street2, dp.City, dp.PincodeText AS Pincode,
           dp.RejectionReason, dp.ApprovedAt AS ReviewedAt,
           dp.CreatedAt,
           u.FirstName, u.LastName, u.Email, u.Phone, u.AltPhone,
           u.Gender, u.DateOfBirth, u.Designation, u.Username,
           sp.Name  AS SpecializationName,
           q.Code   AS QualificationCode,
           q.FullName AS QualificationName,
           dep.Name AS DepartmentName,
           mc.Name  AS MedicalCouncilName,
           co.Name  AS CountryName,
           st.Name  AS StateName
         FROM dbo.DoctorProfiles dp
         JOIN dbo.Users u ON u.Id = dp.UserId
         LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
         LEFT JOIN dbo.Qualifications   q  ON q.Id  = dp.QualificationId
         LEFT JOIN dbo.Departments     dep ON dep.Id = dp.DepartmentId
         LEFT JOIN dbo.MedicalCouncils  mc ON mc.Id  = dp.MedicalCouncilId
         LEFT JOIN dbo.Countries        co ON co.Id  = dp.CountryId
         LEFT JOIN dbo.States           st ON st.Id  = dp.StateId
         WHERE (@status = 'all' OR dp.ApprovalStatus = @status)
           AND (@hid IS NULL OR dp.HospitalId = @hid)
         ORDER BY dp.CreatedAt DESC`,
        {
          status: { type: sql.NVarChar(20), value: statusFilter },
          hid:    { type: sql.BigInt,       value: hospitalId },
        }
      );
      success(res, result.recordset);
    } catch (err) { next(err); }
  }
);

// ── PATCH /register/approve-doctor/:id ───────────────────────────────────────
router.patch('/approve-doctor/:id',
  authenticate,
  authorize('superadmin', 'admin'),
  [
    body('action').isIn(['approved', 'rejected', 'deferred']).withMessage('Invalid action'),
    body('rejectionReason').if(body('action').equals('rejected'))
      .notEmpty().withMessage('Rejection reason required when rejecting'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);
      const { action, rejectionReason } = req.body;
      const doctorProfileId = parseInt(req.params.id);

      await query(
        `UPDATE dbo.DoctorProfiles
         SET ApprovalStatus  = @status,
             ApprovedBy      = @by,
             ApprovedAt      = SYSUTCDATETIME(),
             RejectionReason = @reason
         WHERE Id = @id`,
        {
          status: { type: sql.NVarChar(20),   value: action },
          by:     { type: sql.BigInt,         value: req.user.userId },
          reason: { type: sql.NVarChar(1000), value: rejectionReason || null },
          id:     { type: sql.BigInt,         value: doctorProfileId },
        }
      );

      if (action === 'approved') {
        await query(
          `UPDATE dbo.Users SET IsActive = 1
           WHERE Id = (SELECT UserId FROM dbo.DoctorProfiles WHERE Id = @id)`,
          { id: { type: sql.BigInt, value: doctorProfileId } }
        );
      }

      success(res, {}, `Doctor ${action} successfully.`);
    } catch (err) { next(err); }
  }
);

// ── PATCH /register/approve-staff/:id ────────────────────────────────────────
router.patch('/approve-staff/:id',
  authenticate,
  authorize('superadmin', 'admin'),
  [
    body('action').isIn(['approved', 'rejected']).withMessage('Invalid action'),
    body('rejectionReason').if(body('action').equals('rejected'))
      .notEmpty().withMessage('Rejection reason required when rejecting'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);
      const { action, rejectionReason } = req.body;
      const staffProfileId = parseInt(req.params.id);

      await query(
        `UPDATE dbo.StaffProfiles
         SET ApprovalStatus  = @status,
             ApprovedBy      = @by,
             ApprovedAt      = SYSUTCDATETIME(),
             RejectionReason = @reason
         WHERE Id = @id`,
        {
          status: { type: sql.NVarChar(20),   value: action },
          by:     { type: sql.BigInt,         value: req.user.userId },
          reason: { type: sql.NVarChar(1000), value: rejectionReason || null },
          id:     { type: sql.BigInt,         value: staffProfileId },
        }
      );

      if (action === 'approved') {
        await query(
          `UPDATE dbo.Users SET IsActive = 1
           WHERE Id = (SELECT UserId FROM dbo.StaffProfiles WHERE Id = @id)`,
          { id: { type: sql.BigInt, value: staffProfileId } }
        );
      }

      success(res, {}, `Staff member ${action} successfully.`);
    } catch (err) { next(err); }
  }
);

// ── GET /register/check-email ─────────────────────────────────────────────────
router.get('/check-email', async (req, res, next) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return success(res, { available: true });
    const result = await query(
      `SELECT Id FROM dbo.Users WHERE LOWER(Email) = @e AND DeletedAt IS NULL`,
      { e: { type: sql.NVarChar(255), value: email } }
    );
    success(res, { available: result.recordset.length === 0 });
  } catch (err) { next(err); }
});

// ── GET /register/check-username ──────────────────────────────────────────────
router.get('/check-username', async (req, res, next) => {
  try {
    const username = (req.query.username || '').trim().toLowerCase();
    if (!username || username.length < 3) return success(res, { available: false, message: 'Too short' });
    const result = await query(
      `SELECT Id FROM dbo.Users WHERE Username = @u AND DeletedAt IS NULL`,
      { u: { type: sql.NVarChar(80), value: username } }
    );
    success(res, { available: result.recordset.length === 0 });
  } catch (err) { next(err); }
});

// ── GET /register/check-phone ─────────────────────────────────────────────────
router.get('/check-phone', async (req, res, next) => {
  try {
    const phone = (req.query.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 7) return success(res, { available: false });
    const result = await query(
      `SELECT Id FROM dbo.Users WHERE Phone = @p AND DeletedAt IS NULL`,
      { p: { type: sql.NVarChar(20), value: phone } }
    );
    success(res, { available: result.recordset.length === 0 });
  } catch (err) { next(err); }
});

module.exports = router;