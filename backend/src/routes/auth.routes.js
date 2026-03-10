// src/routes/auth.routes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const {
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyOtpValidator,
} = require('../validators/auth.validator');

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', authLimiter, loginValidator, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, authController.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidator, authController.resetPassword);
router.post('/verify-otp', authLimiter, verifyOtpValidator, authController.verifyOtp);
router.get('/me', authenticate, authController.me);

module.exports = router;
