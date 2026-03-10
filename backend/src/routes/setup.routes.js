// src/routes/setup.routes.js
// Master setup tables: Specializations, Qualifications, MedicalCouncils, Services, Medicines
const express = require('express');
const router = express.Router();
const { query, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const { success, created } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

const handleV = (req) => {
  const e = validationResult(req);
  if (!e.isEmpty()) throw new AppError('Validation failed', 422, e.array());
};

// ── Specializations ────────────────────────────────────────────────────────
router.get('/specializations', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT Id, Name, DepartmentHint, IsActive FROM dbo.Specializations WHERE IsActive = 1 ORDER BY Name`
    );
    success(res, r.recordset);
  } catch (e) { next(e); }
});

router.post('/specializations',
  authenticate, authorize('superadmin', 'admin'),
  [body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Name required (2–150 chars)')],
  async (req, res, next) => {
    try {
      handleV(req);
      const r = await query(
        `INSERT INTO dbo.Specializations (Name, DepartmentHint, CreatedBy)
         OUTPUT INSERTED.Id, INSERTED.Name
         VALUES (@name, @hint, @cb)`,
        {
          name: { type: sql.NVarChar(150), value: req.body.name.trim() },
          hint: { type: sql.NVarChar(150), value: req.body.departmentHint || null },
          cb:   { type: sql.BigInt,        value: req.user.userId },
        }
      );
      created(res, r.recordset[0], 'Specialization added.');
    } catch (e) { next(e); }
  }
);

// ── Qualifications ─────────────────────────────────────────────────────────
router.get('/qualifications', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT Id, Code, FullName, Category FROM dbo.Qualifications WHERE IsActive = 1 ORDER BY Code`
    );
    success(res, r.recordset);
  } catch (e) { next(e); }
});

router.post('/qualifications',
  authenticate, authorize('superadmin', 'admin'),
  [
    body('code').trim().isLength({ min: 2, max: 30 }).withMessage('Code required'),
    body('fullName').trim().isLength({ min: 2, max: 200 }).withMessage('Full name required'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);
      const r = await query(
        `INSERT INTO dbo.Qualifications (Code, FullName, Category, CreatedBy)
         OUTPUT INSERTED.Id, INSERTED.Code, INSERTED.FullName
         VALUES (@code, @full, @cat, @cb)`,
        {
          code: { type: sql.NVarChar(30),  value: req.body.code.trim().toUpperCase() },
          full: { type: sql.NVarChar(200), value: req.body.fullName.trim() },
          cat:  { type: sql.NVarChar(80),  value: req.body.category || null },
          cb:   { type: sql.BigInt,        value: req.user.userId },
        }
      );
      created(res, r.recordset[0], 'Qualification added.');
    } catch (e) { next(e); }
  }
);

// ── Medical Councils ───────────────────────────────────────────────────────
router.get('/medical-councils', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT mc.Id, mc.Name, mc.ShortName, s.Name AS StateName, c.Name AS CountryName
       FROM dbo.MedicalCouncils mc
       LEFT JOIN dbo.States s ON s.Id = mc.StateId
       LEFT JOIN dbo.Countries c ON c.Id = mc.CountryId
       WHERE mc.IsActive = 1 ORDER BY mc.Name`
    );
    success(res, r.recordset);
  } catch (e) { next(e); }
});

// ── Services ───────────────────────────────────────────────────────────────
router.get('/services', authenticate, async (req, res, next) => {
  try {
    const hospitalId = req.query.hospitalId || req.user.hospitalId;
    const r = await query(
      `SELECT s.Id, s.Name, s.Code, s.Category, s.Price, s.GstPercent, s.IsActive,
              d.Name AS DepartmentName
       FROM dbo.Services s
       LEFT JOIN dbo.Departments d ON d.Id = s.DepartmentId
       WHERE s.HospitalId = @hid AND s.IsActive = 1 ORDER BY s.Category, s.Name`,
      { hid: { type: sql.BigInt, value: parseInt(hospitalId) } }
    );
    success(res, r.recordset);
  } catch (e) { next(e); }
});

router.post('/services',
  authenticate, authorize('superadmin', 'admin'),
  [
    body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
    body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Service name required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be >= 0'),
    body('gstPercent').optional().isFloat({ min: 0, max: 100 }),
  ],
  async (req, res, next) => {
    try {
      handleV(req);
      const { hospitalId, departmentId, name, code, category, price, gstPercent, description } = req.body;
      const r = await query(
        `INSERT INTO dbo.Services (HospitalId, DepartmentId, Name, Code, Category, Price, GstPercent, Description, CreatedBy)
         OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Price
         VALUES (@hid, @did, @name, @code, @cat, @price, @gst, @desc, @cb)`,
        {
          hid:   { type: sql.BigInt,        value: parseInt(hospitalId) },
          did:   { type: sql.BigInt,        value: departmentId || null },
          name:  { type: sql.NVarChar(200), value: name.trim() },
          code:  { type: sql.NVarChar(50),  value: code || null },
          cat:   { type: sql.NVarChar(100), value: category || null },
          price: { type: sql.Decimal(10,2), value: parseFloat(price) },
          gst:   { type: sql.Decimal(5,2),  value: parseFloat(gstPercent || 0) },
          desc:  { type: sql.NVarChar(sql.MAX), value: description || null },
          cb:    { type: sql.BigInt,        value: req.user.userId },
        }
      );
      created(res, r.recordset[0], 'Service created.');
    } catch (e) { next(e); }
  }
);

// ── Medicines ──────────────────────────────────────────────────────────────
router.get('/medicines', authenticate, async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const r = await query(
      `SELECT TOP 50 Id, Name, GenericName, BrandName, Category, DosageForm, Strength, Unit, IsScheduleH
       FROM dbo.Medicines
       WHERE IsActive = 1 AND (@s = '' OR Name LIKE '%' + @s + '%' OR GenericName LIKE '%' + @s + '%')
       ORDER BY Name`,
      { s: { type: sql.NVarChar(200), value: search } }
    );
    success(res, r.recordset);
  } catch (e) { next(e); }
});

// ── ICD Codes ──────────────────────────────────────────────────────────────
router.get('/icd-codes', authenticate, async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const r = await query(
      `SELECT TOP 30 Id, Code, Description, Category
       FROM dbo.IcdCodes
       WHERE IsActive = 1 AND (@s = '' OR Code LIKE @s + '%' OR Description LIKE '%' + @s + '%')
       ORDER BY Code`,
      { s: { type: sql.NVarChar(100), value: search } }
    );
    success(res, r.recordset);
  } catch (e) { next(e); }
});

// ── Lab Tests ──────────────────────────────────────────────────────────────
router.get('/lab-tests', authenticate, async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const r = await query(
      `SELECT TOP 50 Id, Name, ShortName, Category, Unit, Price, TurnaroundHrs, RequiresFasting, SampleType
       FROM dbo.LabTests
       WHERE IsActive = 1 AND (@s = '' OR Name LIKE '%' + @s + '%')
       ORDER BY Name`,
      { s: { type: sql.NVarChar(200), value: search } }
    );
    success(res, r.recordset);
  } catch (e) { next(e); }
});

module.exports = router;