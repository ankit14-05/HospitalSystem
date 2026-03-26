const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const { resolveActivePatientContext } = require('../services/patientAccess.service');

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new AppError('No authentication token provided.', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Session expired. Please log in again.', 401);
      }
      throw new AppError('Invalid token. Please log in again.', 401);
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionResult = await query(
      `SELECT s.Id, s.IsActive, s.ExpiresAt, u.IsActive AS UserActive, u.DeletedAt
       FROM dbo.AuthSessions s
       JOIN dbo.Users u ON u.Id = s.UserId
       WHERE s.UserId = @userId
         AND s.TokenHash = @tokenHash
         AND s.IsActive = 1
         AND s.ExpiresAt > SYSUTCDATETIME()`,
      {
        userId: { type: sql.BigInt, value: decoded.userId },
        tokenHash: { type: sql.NVarChar(sql.MAX), value: tokenHash },
      }
    );

    if (!sessionResult.recordset.length) {
      throw new AppError('Session not found or expired. Please log in again.', 401);
    }

    const session = sessionResult.recordset[0];
    if (!session.UserActive || session.DeletedAt) {
      throw new AppError('Your account has been deactivated.', 403);
    }

    req.user = decoded;
    req.user.id = decoded.userId;
    req.sessionId = session.Id;

    if (decoded.role === 'patient') {
      const patientContext = await resolveActivePatientContext({
        userId: decoded.userId,
        hospitalId: decoded.hospitalId,
        sessionId: session.Id,
        preferredPatientId: decoded.activePatientId || null,
      });
      req.user.activePatientId = patientContext.activeProfile?.patientId || null;
      req.user.familyAccessEnabled = patientContext.familyAccessEnabled;
      req.user.hasMultiplePatientProfiles = patientContext.hasMultipleProfiles;
    }

    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated.', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Access denied. Required role(s): ${roles.join(', ')}`, 403));
    }
    return next();
  };
};

const hospitalScope = (req, res, next) => {
  if (req.user.role === 'superadmin') return next();
  const hospitalId = parseInt(req.headers['x-hospital-id'] || req.params.hospitalId || req.body.hospitalId, 10);
  if (!hospitalId || hospitalId !== req.user.hospitalId) {
    return next(new AppError('Access denied to this hospital resource.', 403));
  }
  return next();
};

module.exports = { authenticate, authorize, hospitalScope };
