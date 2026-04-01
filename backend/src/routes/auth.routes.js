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

// Auth rate limiting is disabled by default (no request cap) per project requirement.
const isRateLimitEnabled = (value, defaultValue = false) => {
  if (value == null || value === '') return defaultValue;
  return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase());
};

const getAuthAttemptKey = (req) => {
  const identifier = String(
    req.body?.identifier ||
    req.body?.email ||
    req.body?.username ||
    req.body?.userName ||
    'anonymous'
  ).trim().toLowerCase();

  const forwardedIp = String(req.headers['x-real-ip'] || '').trim();
  const socketIp = String(req.socket?.remoteAddress || req.connection?.remoteAddress || '').trim();
  const sourceIp = forwardedIp || socketIp || 'unknown';

  return `${sourceIp}:${identifier}`;
};

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  keyGenerator: getAuthAttemptKey,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authRateLimitChain = isRateLimitEnabled(process.env.ENABLE_AUTH_RATE_LIMIT, false)
  ? [authLimiter]
  : [];

router.post('/login', ...authRateLimitChain, loginValidator, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', ...authRateLimitChain, forgotPasswordValidator, authController.forgotPassword);
router.post('/reset-password', ...authRateLimitChain, resetPasswordValidator, authController.resetPassword);
router.post('/verify-otp', ...authRateLimitChain, verifyOtpValidator, authController.verifyOtp);
router.get('/me', authenticate, authController.me);

module.exports = router;
