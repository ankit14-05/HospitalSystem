// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, sql } = require('../config/database');
const { authenticate, authorize, hospitalScope } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');
const { success, created, paginated } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const { DB_ALLOWED_ROLES, normalizeRole } = require('../constants/roles');

const handleV = (req) => {
  const e = validationResult(req);
  if (!e.isEmpty()) throw new AppError('Validation failed', 422, e.array());
};

const createUserValidators = [
  body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
  body('username').trim().isLength({ min: 3, max: 80 }).withMessage('Username must be 3–80 chars')
    .matches(/^\S+$/).withMessage('Username cannot have spaces'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password needs uppercase, lowercase, and number'),
  body('role').custom((value) => DB_ALLOWED_ROLES.includes(normalizeRole(value)))
    .withMessage('Invalid role'),
  body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name required'),
  body('lastName').trim().isLength({ min: 1, max: 100 }).withMessage('Last name required'),
  body('gender').optional().isIn(['Male','Female','Other','PreferNot']).withMessage('Invalid gender'),
];

// ── GET /users — list (admin+)
router.get('/',
  authenticate,
  authorize('superadmin', 'admin', 'auditor'),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const role = normalizeRole(req.query.role || '');
      const search = req.query.search || '';
      const hospitalId = req.user.role === 'superadmin'
        ? (parseInt(req.query.hospitalId) || null)
        : req.user.hospitalId;

      const countRes = await query(
        `SELECT COUNT(*) AS total FROM dbo.Users
         WHERE DeletedAt IS NULL
           AND (@hid IS NULL OR HospitalId = @hid)
           AND (@role = '' OR Role = @role)
           AND (@s = '' OR FirstName LIKE '%' + @s + '%' OR LastName LIKE '%' + @s + '%' OR Email LIKE '%' + @s + '%')`,
        {
          hid:  { type: sql.BigInt,        value: hospitalId },
          role: { type: sql.NVarChar(30),  value: role },
          s:    { type: sql.NVarChar(255), value: search },
        }
      );

      const rows = await query(
        `SELECT u.Id, u.HospitalId, u.Username, u.Email, u.Phone, u.Role,
                u.FirstName, u.LastName, u.Gender, u.IsActive, u.LastLoginAt,
                u.CreatedAt, u.EmployeeId, u.Designation,
                d.Name AS DepartmentName, h.Name AS HospitalName
         FROM dbo.Users u
         LEFT JOIN dbo.Departments d ON d.Id = u.DepartmentId
         LEFT JOIN dbo.HospitalSetup h ON h.Id = u.HospitalId
         WHERE u.DeletedAt IS NULL
           AND (@hid IS NULL OR u.HospitalId = @hid)
           AND (@role = '' OR u.Role = @role)
           AND (@s = '' OR u.FirstName LIKE '%' + @s + '%' OR u.LastName LIKE '%' + @s + '%' OR u.Email LIKE '%' + @s + '%')
         ORDER BY u.CreatedAt DESC
         OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
        {
          hid:  { type: sql.BigInt,        value: hospitalId },
          role: { type: sql.NVarChar(30),  value: role },
          s:    { type: sql.NVarChar(255), value: search },
          off:  { type: sql.Int,           value: offset },
          lim:  { type: sql.Int,           value: limit },
        }
      );

      paginated(res, rows.recordset, countRes.recordset[0].total, page, limit);
    } catch (err) { next(err); }
  }
);

// ── POST /users — create user
// FIX: dbo.Users has trigger TR_Users_UpdatedAt which conflicts with OUTPUT without INTO.
//      Use OUTPUT INTO @tmp table instead.
router.post('/',
  authenticate,
  authorize('superadmin', 'admin'),
  createUserValidators,
  async (req, res, next) => {
    try {
      handleV(req);
      const {
        hospitalId, username, email, phone, phoneCountryCode, password,
        role, departmentId, firstName, lastName, gender, dateOfBirth,
        designation, employeeId,
      } = req.body;

      const dup = await query(
        `SELECT Id FROM dbo.Users WHERE Username = @u`,
        { u: { type: sql.NVarChar(80), value: username.trim() } }
      );
      if (dup.recordset.length) throw new AppError('Username already taken.', 409);

      const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, rounds);

      // OUTPUT INTO @tmp avoids trigger conflict
      const result = await query(
        `DECLARE @tmp TABLE (Id bigint, Username nvarchar(80), Role nvarchar(30));
         INSERT INTO dbo.Users (
           HospitalId, Username, Email, Phone, PhoneCountryCode, PasswordHash,
           Role, DepartmentId, FirstName, LastName, Gender, DateOfBirth,
           Designation, EmployeeId, CreatedBy, MustChangePassword
         )
         OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.Role INTO @tmp
         VALUES (
           @hid, @uname, @email, @phone, @pcc, @hash,
           @role, @did, @fname, @lname, @gender, @dob,
           @desig, @empid, @cb, 0
         );
         SELECT * FROM @tmp;`,
        {
          hid:    { type: sql.BigInt,            value: parseInt(hospitalId) },
          uname:  { type: sql.NVarChar(80),      value: username.trim() },
          email:  { type: sql.NVarChar(255),     value: email || null },
          phone:  { type: sql.NVarChar(20),      value: phone || null },
          pcc:    { type: sql.NVarChar(10),       value: phoneCountryCode || '+91' },
          hash:   { type: sql.NVarChar(sql.MAX), value: passwordHash },
          role:   { type: sql.NVarChar(30),      value: normalizeRole(role) },
          did:    { type: sql.BigInt,            value: departmentId || null },
          fname:  { type: sql.NVarChar(100),     value: firstName.trim() },
          lname:  { type: sql.NVarChar(100),     value: lastName.trim() },
          gender: { type: sql.NVarChar(20),      value: gender || null },
          dob:    { type: sql.Date,              value: dateOfBirth || null },
          desig:  { type: sql.NVarChar(150),     value: designation || null },
          empid:  { type: sql.NVarChar(60),      value: employeeId || null },
          cb:     { type: sql.BigInt,            value: req.user.userId },
        }
      );

      created(res, result.recordset[0], 'User created successfully.');
    } catch (err) { next(err); }
  }
);

// ── PATCH /users/:id/toggle-active
// FIX: Use SELECT before/after instead of OUTPUT clause to avoid trigger conflict.
router.patch('/:id/toggle-active',
  authenticate,
  authorize('superadmin', 'admin'),
  async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);

      // Get current state first
      const current = await query(
        `SELECT Id, IsActive FROM dbo.Users WHERE Id = @id AND DeletedAt IS NULL`,
        { id: { type: sql.BigInt, value: userId } }
      );
      if (!current.recordset.length) throw new AppError('User not found.', 404);

      const newState = current.recordset[0].IsActive ? 0 : 1;

      // Update without OUTPUT clause (avoids trigger conflict)
      await query(
        `UPDATE dbo.Users SET IsActive = @active, UpdatedBy = @ub WHERE Id = @id AND DeletedAt IS NULL`,
        {
          active: { type: sql.Bit,    value: newState },
          ub:     { type: sql.BigInt, value: req.user.userId },
          id:     { type: sql.BigInt, value: userId },
        }
      );

      success(res, { Id: userId, IsActive: newState },
        `User ${newState ? 'activated' : 'deactivated'}.`);
    } catch (err) { next(err); }
  }
);

// ── PATCH /users/:id/change-password
router.patch('/:id/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Min 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Needs uppercase, lowercase, number'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);
      const targetId = parseInt(req.params.id);
      if (req.user.userId !== targetId && !['superadmin','admin'].includes(req.user.role)) {
        throw new AppError('Forbidden.', 403);
      }

      const userRes = await query(
        `SELECT PasswordHash FROM dbo.Users WHERE Id = @id AND DeletedAt IS NULL`,
        { id: { type: sql.BigInt, value: targetId } }
      );
      if (!userRes.recordset.length) throw new AppError('User not found.', 404);

      const isMatch = await bcrypt.compare(req.body.currentPassword, userRes.recordset[0].PasswordHash);
      if (!isMatch && req.user.userId === targetId) throw new AppError('Current password is incorrect.', 400);

      const hash = await bcrypt.hash(req.body.newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
      await query(
        `UPDATE dbo.Users SET PasswordHash = @h, PasswordChangedAt = SYSUTCDATETIME(),
         MustChangePassword = 0, FailedLoginCount = 0 WHERE Id = @id`,
        {
          h:  { type: sql.NVarChar(sql.MAX), value: hash },
          id: { type: sql.BigInt,            value: targetId },
        }
      );

      success(res, {}, 'Password updated successfully.');
    } catch (err) { next(err); }
  }
);

module.exports = router;
