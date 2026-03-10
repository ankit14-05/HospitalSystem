// src/validators/auth.validator.js
const { body } = require('express-validator');

const loginValidator = [
  body('identifier').trim().notEmpty().withMessage('Email, phone, or username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidator = [
  body('identifier').trim().notEmpty().withMessage('Email or phone is required'),
  body('contactType')
    .optional()
    .isIn(['email', 'phone'])
    .withMessage('contactType must be email or phone'),
];

const verifyOtpValidator = [
  body('contact').trim().notEmpty().withMessage('Email or phone is required'),
  body('otp')
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  body('purpose')
    .optional()
    .isIn(['forgot_password', 'password_reset', 'email_verify', 'phone_verify'])
    .withMessage('Invalid purpose'),
];

const resetPasswordValidator = [
  body('identifier').trim().notEmpty().withMessage('Email or phone is required'),
  body('otp')
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password needs uppercase, lowercase and number'),
];

module.exports = {
  loginValidator,
  forgotPasswordValidator,
  verifyOtpValidator,
  resetPasswordValidator,
};