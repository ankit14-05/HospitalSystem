// src/services/auth.service.js
// OTP table  : dbo.OtpTokens
// SMS via    : Fast2SMS (fast2sms.com) — set FAST2SMS_API_KEY in .env
// Cleanup strategy:
//   • DELETE row immediately after successful password reset
//   • DELETE row immediately when detected as expired
//   • DELETE all previous rows for same user+purpose before inserting a new OTP
//   • DELETE row when max attempts exceeded

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { query, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const { sendOtpEmail, sendOtpSms, sendPasswordChangedEmail } = require('./emailService');

// ── JWT helpers ───────────────────────────────────────────────────────────────
const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

// ── OTP helpers ───────────────────────────────────────────────────────────────
const generateOtp = () => {
  const len = parseInt(process.env.OTP_LENGTH) || 6;
  return Array.from(crypto.randomBytes(len))
    .map(b => b % 10)
    .join('');
};

const OTP_EXPIRES_MINUTES = () => parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;
const OTP_MAX_ATTEMPTS    = parseInt(process.env.OTP_MAX_ATTEMPTS) || 5;

// ── OTP row deletions ─────────────────────────────────────────────────────────
const deleteOtpById = async (id) => {
  await query(
    `DELETE FROM dbo.OtpTokens WHERE Id = @id`,
    { id: { type: sql.BigInt, value: id } }
  );
};

const deletePendingOtps = async (userId, purpose) => {
  await query(
    `DELETE FROM dbo.OtpTokens
     WHERE UserId = @uid AND Purpose = @purpose`,
    {
      uid:     { type: sql.BigInt,       value: userId },
      purpose: { type: sql.NVarChar(30), value: purpose },
    }
  );
};

// ── Resolve identifier → user row ─────────────────────────────────────────────
const findUserByIdentifier = async (identifier) => {
  const clean = identifier.trim().toLowerCase();
  const result = await query(
    `SELECT u.Id, u.HospitalId, u.Username, u.Email, u.Phone,
            u.PasswordHash, u.Role, u.FirstName, u.LastName,
            u.IsActive, u.Is2FaEnabled,
            u.FailedLoginCount,
            u.LockedUntil,
            u.DepartmentId, u.Designation,
            u.ProfilePhotoUrl, u.LastLoginAt, u.IsEmailVerified,
            h.Name AS HospitalName
     FROM dbo.Users u
     LEFT JOIN dbo.HospitalSetup h ON h.Id = u.HospitalId
     WHERE u.DeletedAt IS NULL
       AND (
             LOWER(u.Email)    = @id   OR
             LOWER(u.Username) = @id   OR
             u.Phone           = @phone
           )`,
    {
      id:    { type: sql.NVarChar(255), value: clean },
      phone: { type: sql.NVarChar(20),  value: identifier.replace(/\D/g, '') },
    }
  );
  return result.recordset[0] || null;
};

// ── Mask helpers ──────────────────────────────────────────────────────────────
const maskEmail = (email) => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '');
  return `${clean.slice(0, 2)}${'*'.repeat(Math.max(clean.length - 4, 3))}${clean.slice(-2)}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
const login = async ({ identifier, password, ipAddress, userAgent, deviceInfo }) => {
  const user = await findUserByIdentifier(identifier);
  if (!user) throw new AppError('Invalid credentials.', 401);

  if (user.LockedUntil && new Date(user.LockedUntil) > new Date()) {
    const mins = Math.ceil((new Date(user.LockedUntil) - Date.now()) / 60000);
    throw new AppError(`Account locked. Try again in ${mins} minute(s).`, 423);
  }

  if (!user.IsActive)
    throw new AppError('Account is inactive. Contact administrator.', 403);

  const valid = await bcrypt.compare(password, user.PasswordHash);
  if (!valid) {
    const newFailed   = (user.FailedLoginCount || 0) + 1;
    const maxAttempts = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5;
    const lockoutMins = parseInt(process.env.LOCKOUT_MINUTES) || 30;
    const lockedUntil = newFailed >= maxAttempts
      ? new Date(Date.now() + lockoutMins * 60 * 1000)
      : null;

    await query(
      `UPDATE dbo.Users
       SET FailedLoginCount = @f,
           LockedUntil = ${lockedUntil ? '@lock' : 'NULL'}
       WHERE Id = @id`,
      {
        f:  { type: sql.SmallInt, value: newFailed },
        ...(lockedUntil && { lock: { type: sql.DateTime2, value: lockedUntil } }),
        id: { type: sql.BigInt,   value: user.Id },
      }
    );

    if (lockedUntil)
      throw new AppError(`Too many failed attempts. Account locked for ${lockoutMins} minutes.`, 423);
    throw new AppError('Invalid credentials.', 401);
  }

  await query(
    `UPDATE dbo.Users
     SET FailedLoginCount = 0,
         LockedUntil      = NULL,
         LastLoginAt      = SYSUTCDATETIME(),
         LastLoginIp      = @ip,
         LastLoginDevice  = @dev,
         LoginCount       = LoginCount + 1
     WHERE Id = @id`,
    {
      ip:  { type: sql.NVarChar(50),  value: ipAddress || null },
      dev: { type: sql.NVarChar(500), value: deviceInfo || userAgent || null },
      id:  { type: sql.BigInt,        value: user.Id },
    }
  );

  const tokenPayload = {
    userId:     user.Id,
    role:       user.Role,
    hospitalId: user.HospitalId,
    username:   user.Username,
  };

  const accessToken  = signAccess(tokenPayload);
  const refreshToken = signRefresh(tokenPayload);

  // Create AuthSessions row required by auth.middleware.js
  const tokenHash       = crypto.createHash('sha256').update(accessToken).digest('hex');
  const sessionExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await query(
    `INSERT INTO dbo.AuthSessions (UserId, TokenHash, DeviceInfo, IpAddress, IsActive, ExpiresAt)
     VALUES (@uid, @hash, @dev, @ip, 1, @exp)`,
    {
      uid:  { type: sql.BigInt,            value: user.Id },
      hash: { type: sql.NVarChar(sql.MAX), value: tokenHash },
      dev:  { type: sql.NVarChar(500),     value: deviceInfo || userAgent || null },
      ip:   { type: sql.NVarChar(50),      value: ipAddress || null },
      exp:  { type: sql.DateTime2,         value: sessionExpiresAt },
    }
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id:           user.Id,
      username:     user.Username,
      email:        user.Email,
      phone:        user.Phone,
      role:         user.Role,
      firstName:    user.FirstName,
      lastName:     user.LastName,
      hospitalId:   user.HospitalId,
      hospitalName: user.HospitalName,
      designation:  user.Designation,
      departmentId: user.DepartmentId,
      photoUrl:     user.ProfilePhotoUrl,
      lastLoginAt:  user.LastLoginAt,
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════
const logout = async () => true; // JWT stateless; cookie cleared by controller

// ═══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// Supports both email OTP and phone SMS OTP via Fast2SMS
// contactType: 'email' → sends email OTP
// contactType: 'phone' → sends SMS OTP via Fast2SMS
// ═══════════════════════════════════════════════════════════════════════════════
const forgotPassword = async ({ identifier, contactType = 'email', ipAddress }) => {
  const user = await findUserByIdentifier(identifier);

  // User not found — show real error (no enumeration protection per user request)
  if (!user) throw new AppError('No account found with this email or phone number.', 404);

  if (contactType === 'email' && !user.Email)
    throw new AppError('No email address linked to this account.', 400);
  if (contactType === 'phone' && !user.Phone)
    throw new AppError('No phone number linked to this account.', 400);

  const otp       = generateOtp();
  const expMin    = OTP_EXPIRES_MINUTES();
  const expiresAt = new Date(Date.now() + expMin * 60 * 1000);
  const otpHash   = await bcrypt.hash(otp, 8);
  const contact   = contactType === 'phone' ? user.Phone : user.Email;

  // Remove any previous OTPs for this user+purpose
  await deletePendingOtps(user.Id, 'forgot_password');

  await query(
    `INSERT INTO dbo.OtpTokens
       (UserId, Contact, ContactType, Purpose,
        OtpHash, Attempts, MaxAttempts, IsVerified, ExpiresAt, IpAddress)
     VALUES
       (@uid, @contact, @ctype, 'forgot_password',
        @hash, 0, @maxAtt, 0, @exp, @ip)`,
    {
      uid:     { type: sql.BigInt,            value: user.Id },
      contact: { type: sql.NVarChar(255),     value: contact },
      ctype:   { type: sql.NVarChar(10),      value: contactType },
      hash:    { type: sql.NVarChar(sql.MAX), value: otpHash },
      maxAtt:  { type: sql.SmallInt,          value: OTP_MAX_ATTEMPTS },
      exp:     { type: sql.DateTime2,         value: expiresAt },
      ip:      { type: sql.NVarChar(50),      value: ipAddress || null },
    }
  );

  // ── Send OTP via appropriate channel ────────────────────────────────────────
  if (contactType === 'phone') {
    await sendOtpSms({ phone: user.Phone, otp });
    console.log(`📱 SMS OTP sent → ${user.Phone} (userId: ${user.Id})`);
    return {
      maskedContact:    maskPhone(user.Phone),
      contactType:      'phone',
      expiresInMinutes: expMin,
    };
  } else {
    await sendOtpEmail({
      to:             user.Email,
      name:           user.FirstName,
      otp,
      expiresMinutes: expMin,
      purpose:        'password reset',
    });
    console.log(`📧 Email OTP sent → ${user.Email} (userId: ${user.Id})`);
    return {
      maskedContact:    maskEmail(user.Email),
      maskedEmail:      maskEmail(user.Email),   // kept for frontend backward compat
      contactType:      'email',
      expiresInMinutes: expMin,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY OTP
// Works for both email and phone OTPs — contact field is the email or phone
// Expired  → DELETE row, throw
// Wrong    → increment Attempts; if max hit DELETE row, throw
// Correct  → set IsVerified = 1, keep row (reset-password will delete it)
// ═══════════════════════════════════════════════════════════════════════════════
const verifyOtp = async ({ contact, otp, purpose = 'forgot_password' }) => {
  const clean = contact.trim().toLowerCase();

  const result = await query(
    `SELECT TOP 1
            o.Id, o.OtpHash, o.ExpiresAt,
            o.Attempts, o.MaxAttempts, o.IsVerified, o.UserId
     FROM dbo.OtpTokens o
     WHERE (LOWER(o.Contact) = @contact OR o.Contact = @phone)
       AND o.Purpose = @purpose
     ORDER BY o.CreatedAt DESC`,
    {
      contact: { type: sql.NVarChar(255), value: clean },
      phone:   { type: sql.NVarChar(20),  value: contact.replace(/\D/g, '') },
      purpose: { type: sql.NVarChar(30),  value: purpose },
    }
  );

  const rec = result.recordset[0];
  if (!rec) throw new AppError('No active OTP found. Please request a new one.', 400);

  if (new Date(rec.ExpiresAt) < new Date()) {
    await deleteOtpById(rec.Id);
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  if (rec.IsVerified) return { verified: true };

  if (rec.Attempts >= rec.MaxAttempts) {
    await deleteOtpById(rec.Id);
    throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429);
  }

  const valid = await bcrypt.compare(otp.trim(), rec.OtpHash);
  if (!valid) {
    const newAttempts = rec.Attempts + 1;
    const remaining   = rec.MaxAttempts - newAttempts;

    if (remaining <= 0) {
      await deleteOtpById(rec.Id);
      throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429);
    }

    await query(
      `UPDATE dbo.OtpTokens SET Attempts = @a WHERE Id = @id`,
      {
        a:  { type: sql.SmallInt, value: newAttempts },
        id: { type: sql.BigInt,   value: rec.Id },
      }
    );
    throw new AppError(`Incorrect OTP. ${remaining} attempt(s) remaining.`, 400);
  }

  await query(
    `UPDATE dbo.OtpTokens
     SET IsVerified = 1, VerifiedAt = SYSUTCDATETIME()
     WHERE Id = @id`,
    { id: { type: sql.BigInt, value: rec.Id } }
  );

  return { verified: true };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════
const resetPassword = async ({ identifier, otp, newPassword }) => {
  const user = await findUserByIdentifier(identifier);
  if (!user) throw new AppError('Account not found.', 404);

  const result = await query(
    `SELECT TOP 1
            o.Id, o.OtpHash, o.ExpiresAt,
            o.Attempts, o.MaxAttempts, o.IsVerified
     FROM dbo.OtpTokens o
     WHERE o.UserId  = @uid
       AND o.Purpose = 'forgot_password'
     ORDER BY o.CreatedAt DESC`,
    { uid: { type: sql.BigInt, value: user.Id } }
  );

  const rec = result.recordset[0];
  if (!rec) throw new AppError('No active OTP found. Please request a new one.', 400);

  if (new Date(rec.ExpiresAt) < new Date()) {
    await deleteOtpById(rec.Id);
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  const valid = await bcrypt.compare(otp.trim(), rec.OtpHash);
  if (!valid) {
    const newAttempts = rec.Attempts + 1;
    const remaining   = rec.MaxAttempts - newAttempts;

    if (remaining <= 0) {
      await deleteOtpById(rec.Id);
      throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429);
    }

    await query(
      `UPDATE dbo.OtpTokens SET Attempts = @a WHERE Id = @id`,
      {
        a:  { type: sql.SmallInt, value: newAttempts },
        id: { type: sql.BigInt,   value: rec.Id },
      }
    );
    throw new AppError(`Incorrect OTP. ${remaining} attempt(s) remaining.`, 400);
  }

  const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 10);

  await query(
    `UPDATE dbo.Users
     SET PasswordHash      = @hash,
         PasswordChangedAt = SYSUTCDATETIME(),
         FailedLoginCount  = 0,
         LockedUntil       = NULL
     WHERE Id = @id`,
    {
      hash: { type: sql.NVarChar(sql.MAX), value: hash },
      id:   { type: sql.BigInt,            value: user.Id },
    }
  );

  await deleteOtpById(rec.Id);

  if (user.Email) {
    sendPasswordChangedEmail({ to: user.Email, name: user.FirstName })
      .catch(err => console.error('Confirmation email failed:', err.message));
  }

  return true;
};

module.exports = { login, logout, forgotPassword, verifyOtp, resetPassword };