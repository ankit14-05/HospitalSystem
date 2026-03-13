// src/middleware/auth.middleware.js
const jwt    = require('jsonwebtoken');
const { query, sql } = require('../config/database');
const AppError = require('../utils/AppError');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) throw new AppError('No authentication token provided.', 401);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new AppError('Session expired. Please log in again.', 401);
      throw new AppError('Invalid token. Please log in again.', 401);
    }

    const sessionResult = await query(
      `SELECT s.Id, s.IsActive, s.ExpiresAt, u.IsActive AS UserActive, u.DeletedAt
       FROM dbo.AuthSessions s
       JOIN dbo.Users u ON u.Id = s.UserId
       WHERE s.UserId = @userId AND s.IsActive = 1 AND s.ExpiresAt > SYSUTCDATETIME()`,
      { userId: { type: sql.BigInt, value: decoded.userId } }
    );

    if (!sessionResult.recordset.length) {
      throw new AppError('Session not found or expired. Please log in again.', 401);
    }

    const session = sessionResult.recordset[0];
    if (!session.UserActive || session.DeletedAt) {
      throw new AppError('Your account has been deactivated.', 403);
    }

    req.user         = decoded;
    req.user.id      = decoded.userId;   // ← THE FIX: normalise userId → id
    req.sessionId    = session.Id;
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Not authenticated.', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Access denied. Required role(s): ${roles.join(', ')}`, 403));
    }
    next();
  };
};

const hospitalScope = (req, res, next) => {
  if (req.user.role === 'superadmin') return next();
  const hospitalId = parseInt(req.headers['x-hospital-id'] || req.params.hospitalId || req.body.hospitalId);
  if (!hospitalId || hospitalId !== req.user.hospitalId) {
    return next(new AppError('Access denied to this hospital resource.', 403));
  }
  next();
};

module.exports = { authenticate, authorize, hospitalScope };