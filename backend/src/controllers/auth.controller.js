// src/controllers/auth.controller.js
const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const { success } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

const handleValidation = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 422, errors.array());
  }
};

/**
 * POST /auth/login
 */
const login = async (req, res, next) => {
  try {
    handleValidation(req);
    const { identifier, password } = req.body;
    const result = await authService.login({
      identifier,
      password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceInfo: req.headers['x-device-info'],
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    success(res, { accessToken: result.accessToken, user: result.user }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/logout
 */
const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.userId, req.sessionId);
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    success(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    handleValidation(req);
    const { identifier, contactType } = req.body;
    const result = await authService.forgotPassword({
      identifier,
      contactType: contactType || 'email',
      ipAddress: req.ip,
    });
    success(res, result, 'OTP sent successfully. Check your email/phone.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    handleValidation(req);
    const { identifier, otp, newPassword } = req.body;
    await authService.resetPassword({ identifier, otp, newPassword });
    success(res, {}, 'Password reset successfully. Please login with your new password.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/verify-otp
 */
const verifyOtp = async (req, res, next) => {
  try {
    handleValidation(req);
    const { contact, otp, purpose } = req.body;
    const result = await authService.verifyOtp({ contact, otp, purpose });
    success(res, result, 'OTP verified successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/me — get current user profile
 */
const me = async (req, res, next) => {
  try {
    const { query, sql } = require('../config/database');
    const userRes = await query(
      `SELECT u.Id, u.HospitalId, u.Username, u.Email, u.Phone, u.Role,
              u.FirstName, u.LastName, u.Gender, u.DateOfBirth,
              u.ProfilePhotoUrl, u.IsActive, u.Is2FaEnabled,
              u.IsEmailVerified, u.IsPhoneVerified, u.LastLoginAt,
              u.Designation, u.DepartmentId, d.Name AS DepartmentName,
              h.Name AS HospitalName, h.LogoUrl AS HospitalLogo
       FROM dbo.Users u
       LEFT JOIN dbo.Departments d ON d.Id = u.DepartmentId
       LEFT JOIN dbo.HospitalSetup h ON h.Id = u.HospitalId
       WHERE u.Id = @id AND u.DeletedAt IS NULL`,
      { id: { type: sql.BigInt, value: req.user.userId } }
    );
    if (!userRes.recordset.length) throw new AppError('User not found.', 404);
    success(res, userRes.recordset[0], 'Profile retrieved.');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, logout, forgotPassword, resetPassword, verifyOtp, me };
