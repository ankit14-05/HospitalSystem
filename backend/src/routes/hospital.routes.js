// src/routes/hospital.routes.js
const express = require('express');
const router = express.Router();
const { query, sql, withTransaction } = require('../config/database');
const { authenticate, authorize, hospitalScope } = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const { success, created, paginated } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

// ─── Validators ────────────────────────────────────────────────────────────
const hospitalValidators = [
  body('name').trim().isLength({ min: 3, max: 300 }).withMessage('Hospital name must be 3–300 characters'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('gstin').optional().trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[A-Z0-9]{1}$/)
    .withMessage('Invalid GSTIN format'),
  body('pan').optional().trim()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Invalid PAN format'),
  body('planType').optional().isIn(['basic', 'standard', 'enterprise'])
    .withMessage('Plan must be basic, standard, or enterprise'),
  body('timeFormat').optional().isIn(['12h', '24h']).withMessage('Invalid time format'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('maxUsers').optional().isInt({ min: 1 }).withMessage('maxUsers must be a positive integer'),
  body('bedCapacity').optional().isInt({ min: 1 }).withMessage('Bed capacity must be positive'),
];

// ── GET /hospitals — list (superadmin only)
router.get('/',
  authenticate,
  authorize('superadmin'),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      const countRes = await query(
        `SELECT COUNT(*) AS total FROM dbo.HospitalSetup
         WHERE DeletedAt IS NULL AND (@s = '' OR Name LIKE '%' + @s + '%')`,
        { s: { type: sql.NVarChar(300), value: search } }
      );
      const total = countRes.recordset[0].total;

      const rows = await query(
        `SELECT Id, UniqueCode, Name, ShortName, RegistrationNumber,
                Email, Phone, City, Status, PlanType, MaxUsers, BedCapacity,
                IsDemo, ActivatedAt, CreatedAt, LogoUrl
         FROM dbo.HospitalSetup
         WHERE DeletedAt IS NULL AND (@s = '' OR Name LIKE '%' + @s + '%')
         ORDER BY CreatedAt DESC
         OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
        {
          s:   { type: sql.NVarChar(300), value: search },
          off: { type: sql.Int, value: offset },
          lim: { type: sql.Int, value: limit },
        }
      );

      paginated(res, rows.recordset, total, page, limit);
    } catch (err) { next(err); }
  }
);

// ── GET /hospitals/:id
router.get('/:id',
  authenticate,
  hospitalScope,
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT h.*,
                d.Name AS DistrictName, s.Name AS StateName, c.Name AS CountryName,
                p.Pincode AS PincodeValue, p.AreaName AS PincodeArea
         FROM dbo.HospitalSetup h
         LEFT JOIN dbo.Districts d ON d.Id = h.DistrictId
         LEFT JOIN dbo.States s    ON s.Id = h.StateId
         LEFT JOIN dbo.Countries c ON c.Id = h.CountryId
         LEFT JOIN dbo.Pincodes p  ON p.Id = h.PincodeId
         WHERE h.Id = @id AND h.DeletedAt IS NULL`,
        { id: { type: sql.BigInt, value: parseInt(req.params.id) } }
      );
      if (!result.recordset.length) throw new AppError('Hospital not found.', 404);
      success(res, result.recordset[0]);
    } catch (err) { next(err); }
  }
);

// ── POST /hospitals — create new hospital (superadmin only)
router.post('/',
  authenticate,
  authorize('superadmin'),
  hospitalValidators,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());

      const {
        name, shortName, registrationNumber, gstin, pan, tan,
        email, phone, altPhone, website, fax, emergencyNumber, ambulanceNumber,
        street1, street2, city, districtId, stateId, countryId, pincodeId, pincodeText,
        latitude, longitude, logoUrl, faviconUrl, primaryColor, secondaryColor,
        timezone, currencyCode, dateFormat, timeFormat, fiscalYearStart, language,
        bedCapacity, establishedYear, accreditations, specialities, modulesEnabled,
        licenseKey, licenseValidUntil, planType, maxUsers, status, isDemo,
      } = req.body;

      const result = await query(
        `INSERT INTO dbo.HospitalSetup (
           Name, ShortName, RegistrationNumber, GSTIN, PAN, TAN,
           Email, Phone, AltPhone, Website, Fax, EmergencyNumber, AmbulanceNumber,
           Street1, Street2, City, DistrictId, StateId, CountryId, PincodeId, PincodeText,
           Latitude, Longitude, LogoUrl, FaviconUrl, PrimaryColor, SecondaryColor,
           Timezone, CurrencyCode, DateFormat, TimeFormat, FiscalYearStart, Language,
           BedCapacity, EstablishedYear, Accreditations, Specialities, ModulesEnabled,
           LicenseKey, LicenseValidUntil, PlanType, MaxUsers, Status, IsDemo,
           CreatedBy, CreatedByName, CreatedByRole, CreatedByIp
         )
         OUTPUT INSERTED.Id, INSERTED.UniqueCode
         VALUES (
           @name, @sname, @reg, @gstin, @pan, @tan,
           @email, @phone, @alt, @web, @fax, @emg, @amb,
           @s1, @s2, @city, @did, @sid, @cid, @pid, @ptext,
           @lat, @lon, @logo, @fav, @pc, @sc,
           @tz, @cc, @df, @tf, @fy, @lang,
           @beds, @year, @acc, @spec, @mods,
           @lkey, @lval, @plan, @maxu, @status, @demo,
           @cb, @cbn, @cbr, @cbip
         )`,
        {
          name:   { type: sql.NVarChar(300), value: name.trim() },
          sname:  { type: sql.NVarChar(100), value: shortName || null },
          reg:    { type: sql.NVarChar(100), value: registrationNumber || null },
          gstin:  { type: sql.NVarChar(20),  value: gstin || null },
          pan:    { type: sql.NVarChar(10),  value: pan || null },
          tan:    { type: sql.NVarChar(10),  value: tan || null },
          email:  { type: sql.NVarChar(255), value: email || null },
          phone:  { type: sql.NVarChar(20),  value: phone || null },
          alt:    { type: sql.NVarChar(20),  value: altPhone || null },
          web:    { type: sql.NVarChar(255), value: website || null },
          fax:    { type: sql.NVarChar(20),  value: fax || null },
          emg:    { type: sql.NVarChar(20),  value: emergencyNumber || null },
          amb:    { type: sql.NVarChar(20),  value: ambulanceNumber || null },
          s1:     { type: sql.NVarChar(255), value: street1 || null },
          s2:     { type: sql.NVarChar(255), value: street2 || null },
          city:   { type: sql.NVarChar(100), value: city || null },
          did:    { type: sql.Int,           value: districtId || null },
          sid:    { type: sql.Int,           value: stateId || null },
          cid:    { type: sql.Int,           value: countryId || 1 },
          pid:    { type: sql.Int,           value: pincodeId || null },
          ptext:  { type: sql.NVarChar(20),  value: pincodeText || null },
          lat:    { type: sql.Decimal(10,7), value: latitude || null },
          lon:    { type: sql.Decimal(10,7), value: longitude || null },
          logo:   { type: sql.NVarChar(500), value: logoUrl || null },
          fav:    { type: sql.NVarChar(500), value: faviconUrl || null },
          pc:     { type: sql.NVarChar(10),  value: primaryColor || '#6d28d9' },
          sc:     { type: sql.NVarChar(10),  value: secondaryColor || '#1d4ed8' },
          tz:     { type: sql.NVarChar(80),  value: timezone || 'Asia/Kolkata' },
          cc:     { type: sql.NVarChar(10),  value: currencyCode || 'INR' },
          df:     { type: sql.NVarChar(30),  value: dateFormat || 'DD/MM/YYYY' },
          tf:     { type: sql.NVarChar(10),  value: timeFormat || '12h' },
          fy:     { type: sql.NVarChar(5),   value: fiscalYearStart || '04-01' },
          lang:   { type: sql.NVarChar(20),  value: language || 'en' },
          beds:   { type: sql.Int,           value: bedCapacity || null },
          year:   { type: sql.SmallInt,      value: establishedYear || null },
          acc:    { type: sql.NVarChar(500), value: accreditations || null },
          spec:   { type: sql.NVarChar(1000),value: specialities || null },
          mods:   { type: sql.NVarChar(500), value: modulesEnabled || null },
          lkey:   { type: sql.NVarChar(255), value: licenseKey || null },
          lval:   { type: sql.Date,          value: licenseValidUntil || null },
          plan:   { type: sql.NVarChar(50),  value: planType || 'standard' },
          maxu:   { type: sql.Int,           value: maxUsers || 50 },
          status: { type: sql.NVarChar(20),  value: status || 'active' },
          demo:   { type: sql.Bit,           value: isDemo ? 1 : 0 },
          cb:     { type: sql.BigInt,        value: req.user.userId },
          cbn:    { type: sql.NVarChar(200), value: req.user.fullName || null },
          cbr:    { type: sql.NVarChar(50),  value: req.user.role },
          cbip:   { type: sql.NVarChar(50),  value: req.ip },
        }
      );

      created(res, result.recordset[0], 'Hospital created successfully.');
    } catch (err) { next(err); }
  }
);

// ── PUT /hospitals/:id — update hospital
router.put('/:id',
  authenticate,
  authorize('superadmin', 'admin'),
  hospitalScope,
  hospitalValidators,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());

      const id = parseInt(req.params.id);

      // Snapshot current state for version history
      const current = await query(
        `SELECT * FROM dbo.HospitalSetup WHERE Id = @id AND DeletedAt IS NULL`,
        { id: { type: sql.BigInt, value: id } }
      );
      if (!current.recordset.length) throw new AppError('Hospital not found.', 404);

      const prev = JSON.stringify(current.recordset[0]);

      const { name, shortName, email, phone, street1, street2, city,
              districtId, stateId, countryId, pincodeId, pincodeText,
              latitude, longitude, logoUrl, primaryColor, secondaryColor,
              timezone, currencyCode, bedCapacity, status, modulesEnabled } = req.body;

      await query(
        `UPDATE dbo.HospitalSetup SET
           Name = ISNULL(@name, Name),
           ShortName = ISNULL(@sname, ShortName),
           Email = ISNULL(@email, Email),
           Phone = ISNULL(@phone, Phone),
           Street1 = ISNULL(@s1, Street1),
           Street2 = ISNULL(@s2, Street2),
           City = ISNULL(@city, City),
           DistrictId = ISNULL(@did, DistrictId),
           StateId = ISNULL(@sid, StateId),
           CountryId = ISNULL(@cid, CountryId),
           PincodeId = ISNULL(@pid, PincodeId),
           PincodeText = ISNULL(@ptext, PincodeText),
           Latitude = ISNULL(@lat, Latitude),
           Longitude = ISNULL(@lon, Longitude),
           LogoUrl = ISNULL(@logo, LogoUrl),
           PrimaryColor = ISNULL(@pc, PrimaryColor),
           SecondaryColor = ISNULL(@sc, SecondaryColor),
           Timezone = ISNULL(@tz, Timezone),
           CurrencyCode = ISNULL(@cc, CurrencyCode),
           BedCapacity = ISNULL(@beds, BedCapacity),
           Status = ISNULL(@status, Status),
           ModulesEnabled = ISNULL(@mods, ModulesEnabled),
           UpdatedBy = @ub, UpdatedByIp = @ubip,
           UpdatedByName = @ubn,
           Version = Version + 1,
           PreviousVersionJson = @prev
         WHERE Id = @id AND DeletedAt IS NULL`,
        {
          name:   { type: sql.NVarChar(300), value: name?.trim() || null },
          sname:  { type: sql.NVarChar(100), value: shortName || null },
          email:  { type: sql.NVarChar(255), value: email || null },
          phone:  { type: sql.NVarChar(20),  value: phone || null },
          s1:     { type: sql.NVarChar(255), value: street1 || null },
          s2:     { type: sql.NVarChar(255), value: street2 || null },
          city:   { type: sql.NVarChar(100), value: city || null },
          did:    { type: sql.Int,           value: districtId || null },
          sid:    { type: sql.Int,           value: stateId || null },
          cid:    { type: sql.Int,           value: countryId || null },
          pid:    { type: sql.Int,           value: pincodeId || null },
          ptext:  { type: sql.NVarChar(20),  value: pincodeText || null },
          lat:    { type: sql.Decimal(10,7), value: latitude || null },
          lon:    { type: sql.Decimal(10,7), value: longitude || null },
          logo:   { type: sql.NVarChar(500), value: logoUrl || null },
          pc:     { type: sql.NVarChar(10),  value: primaryColor || null },
          sc:     { type: sql.NVarChar(10),  value: secondaryColor || null },
          tz:     { type: sql.NVarChar(80),  value: timezone || null },
          cc:     { type: sql.NVarChar(10),  value: currencyCode || null },
          beds:   { type: sql.Int,           value: bedCapacity || null },
          status: { type: sql.NVarChar(20),  value: status || null },
          mods:   { type: sql.NVarChar(500), value: modulesEnabled || null },
          ub:     { type: sql.BigInt,        value: req.user.userId },
          ubip:   { type: sql.NVarChar(50),  value: req.ip },
          ubn:    { type: sql.NVarChar(200), value: req.user.fullName || null },
          prev:   { type: sql.NVarChar(sql.MAX), value: prev },
          id:     { type: sql.BigInt,        value: id },
        }
      );

      success(res, { id }, 'Hospital updated successfully.');
    } catch (err) { next(err); }
  }
);

// ── DELETE /hospitals/:id — soft delete (superadmin only)
router.delete('/:id',
  authenticate,
  authorize('superadmin'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;

      await query(
        `UPDATE dbo.HospitalSetup
         SET DeletedAt = SYSUTCDATETIME(), DeletedBy = @by,
             DeletedByName = @name, DeletedReason = @reason, Status = 'inactive'
         WHERE Id = @id AND DeletedAt IS NULL`,
        {
          by:     { type: sql.BigInt,        value: req.user.userId },
          name:   { type: sql.NVarChar(200), value: req.user.fullName || null },
          reason: { type: sql.NVarChar(1000),value: reason || null },
          id:     { type: sql.BigInt,        value: id },
        }
      );

      success(res, {}, 'Hospital deactivated successfully.');
    } catch (err) { next(err); }
  }
);

// ── GET /hospitals/:id/setup-log — change history
router.get('/:id/setup-log',
  authenticate,
  authorize('superadmin', 'admin', 'auditor'),
  hospitalScope,
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT scl.*, u.FirstName + ' ' + u.LastName AS RequestedByName
         FROM dbo.SetupChangeLog scl
         LEFT JOIN dbo.Users u ON u.Id = scl.RequestedBy
         WHERE scl.HospitalId = @hid OR scl.RecordId = @id AND scl.TableName = 'HospitalSetup'
         ORDER BY scl.RequestedAt DESC`,
        {
          hid: { type: sql.BigInt, value: parseInt(req.params.id) },
          id:  { type: sql.BigInt, value: parseInt(req.params.id) },
        }
      );
      success(res, result.recordset);
    } catch (err) { next(err); }
  }
);

// ── GET /hospitals/:id/departments — PUBLIC (used on registration page)
router.get('/:id/departments',
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT d.Id, d.Name, d.Code, d.FloorNo, d.PhoneExt, d.IsActive, d.Status,
                u.FirstName + ' ' + u.LastName AS HeadDoctorName
         FROM dbo.Departments d
         LEFT JOIN dbo.Users u ON u.Id = d.HeadDoctorId
         WHERE d.HospitalId = @hid AND d.Status != 'deprecated'
         ORDER BY d.Name`,
        { hid: { type: sql.BigInt, value: parseInt(req.params.id) } }
      );
      success(res, result.recordset);
    } catch (err) { next(err); }
  }
);

module.exports = router;