// src/routes/geo.routes.js
const express = require('express');
const router = express.Router();
const { query, execute, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { body, param, query: qv } = require('express-validator');
const { validationResult } = require('express-validator');
const { success, paginated } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

// ── Countries ──────────────────────────────────────────────────────────────
router.get('/countries', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT Id, Name, Iso2, Iso3, PhoneCode, CurrencyCode, FlagEmoji
       FROM dbo.Countries WHERE (IsActive = 1 OR IsActive IS NULL) ORDER BY SortOrder, Name`
    );
    success(res, result.recordset);
  } catch (err) { next(err); }
});

// ── States by Country ──────────────────────────────────────────────────────
router.get('/countries/:countryId/states', [
  param('countryId').isInt({ min: 1 }).withMessage('Invalid country ID'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());

    const result = await query(
      `SELECT Id, Name, Code FROM dbo.States
       WHERE CountryId = @cid AND (IsActive = 1 OR IsActive IS NULL) ORDER BY Name`,
      { cid: { type: sql.Int, value: parseInt(req.params.countryId) } }
    );
    success(res, result.recordset);
  } catch (err) { next(err); }
});

// ── Districts by State ─────────────────────────────────────────────────────
router.get('/states/:stateId/districts', [
  param('stateId').isInt({ min: 1 }).withMessage('Invalid state ID'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());

    const result = await query(
      `SELECT Id, Name, Headquarter, IsCustom
       FROM dbo.Districts
       WHERE StateId = @sid AND (IsActive = 1 OR IsActive IS NULL) ORDER BY Name`,
      { sid: { type: sql.Int, value: parseInt(req.params.stateId) } }
    );
    success(res, result.recordset);
  } catch (err) { next(err); }
});

// ── Pincodes by District ───────────────────────────────────────────────────
router.get('/districts/:districtId/pincodes', [
  param('districtId').isInt({ min: 1 }).withMessage('Invalid district ID'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());

    const result = await query(
      `SELECT Id, Pincode, AreaName, City, IsCustom
       FROM dbo.Pincodes
       WHERE DistrictId = @did AND (IsActive = 1 OR IsActive IS NULL) ORDER BY Pincode`,
      { did: { type: sql.Int, value: parseInt(req.params.districtId) } }
    );
    success(res, result.recordset);
  } catch (err) { next(err); }
});

// ── Pincode search ─────────────────────────────────────────────────────────
router.get('/pincodes/search', [
  qv('q').trim().notEmpty().withMessage('Search query required').isLength({ min: 3 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());

    const result = await query(
      `SELECT TOP 20 p.Id, p.Pincode, p.AreaName, p.City,
              d.Name AS District, s.Name AS State
       FROM dbo.Pincodes p
       JOIN dbo.Districts d ON d.Id = p.DistrictId
       JOIN dbo.States s    ON s.Id = d.StateId
       WHERE p.Pincode LIKE @q + '%' AND (p.IsActive = 1 OR p.IsActive IS NULL)
       ORDER BY p.Pincode`,
      { q: { type: sql.NVarChar(20), value: req.query.q.trim() } }
    );
    success(res, result.recordset);
  } catch (err) { next(err); }
});

// ── Add Custom District (public for self-registration) ─────────────────────
router.post('/districts/custom', [
    body('stateId').isInt({ min: 1 }).withMessage('Valid state ID required'),
    body('name').trim().isLength({ min: 2, max: 120 }).withMessage('District name must be 2–120 characters'),
    body('headquarter').optional().trim().isLength({ max: 120 }),
    body('customNote').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());
      const { stateId, name, headquarter, customNote } = req.body;
      // Check for existing
      const existing = await query(
        `SELECT Id FROM dbo.Districts WHERE StateId = @sid AND Name = @name`,
        { sid: { type: sql.Int, value: parseInt(stateId) }, name: { type: sql.NVarChar(120), value: name.trim() } }
      );
      if (existing.recordset.length) {
        return success(res, { id: existing.recordset[0].Id, name: name.trim(), isCustom: false }, 'District already exists', 200);
      }
      const result = await query(
        `INSERT INTO dbo.Districts (StateId, Name, Headquarter, IsCustom, IsActive, CustomNote)
         OUTPUT INSERTED.Id
         VALUES (@sid, @name, @hq, 1, 1, @note)`,
        {
          sid:  { type: sql.Int, value: parseInt(stateId) },
          name: { type: sql.NVarChar(120), value: name.trim() },
          hq:   { type: sql.NVarChar(120), value: headquarter || null },
          note: { type: sql.NVarChar(500), value: customNote || null },
        }
      );
      success(res, { id: result.recordset[0].Id, name: name.trim(), isCustom: true }, 'Custom district added successfully.', 201);
    } catch (err) { next(err); }
  }
);

// ── Add Custom Pincode (public for self-registration) ──────────────────────
router.post('/pincodes/custom', [
    body('districtId').isInt({ min: 1 }).withMessage('Valid district ID required'),
    body('pincode').trim().isLength({ min: 4, max: 20 }).withMessage('Pincode must be 4–20 characters'),
    body('areaName').optional().trim().isLength({ max: 150 }),
    body('city').optional().trim().isLength({ max: 100 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 422, errors.array());
      const { districtId, pincode, areaName, city } = req.body;
      // Check for existing
      const existing = await query(
        `SELECT Id FROM dbo.Pincodes WHERE DistrictId = @did AND Pincode = @pin`,
        { did: { type: sql.Int, value: parseInt(districtId) }, pin: { type: sql.NVarChar(20), value: pincode.trim() } }
      );
      if (existing.recordset.length) {
        return success(res, { id: existing.recordset[0].Id, pincode: pincode.trim(), isCustom: false }, 'Pincode already exists', 200);
      }
      const result = await query(
        `INSERT INTO dbo.Pincodes (DistrictId, Pincode, AreaName, City, IsCustom, IsActive)
         OUTPUT INSERTED.Id
         VALUES (@did, @pin, @area, @city, 1, 1)`,
        {
          did:  { type: sql.Int, value: parseInt(districtId) },
          pin:  { type: sql.NVarChar(20), value: pincode.trim() },
          area: { type: sql.NVarChar(150), value: areaName || null },
          city: { type: sql.NVarChar(100), value: city || null },
        }
      );
      success(res, { id: result.recordset[0].Id, pincode: pincode.trim(), isCustom: true }, 'Custom pincode added successfully.', 201);
    } catch (err) { next(err); }
  }
);

// ── Lookup Values by Category ──────────────────────────────────────────────
router.get('/lookup/:category', [
  param('category').trim().notEmpty().withMessage('Category key required'),
], async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ValueKey, DisplayLabel, SortOrder
       FROM dbo.LookupValues
       WHERE CategoryKey = @cat AND IsActive = 1
       ORDER BY SortOrder`,
      { cat: { type: sql.NVarChar(80), value: req.params.category } }
    );
    success(res, result.recordset);
  } catch (err) { next(err); }
});

module.exports = router;