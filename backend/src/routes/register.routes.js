// src/routes/register.routes.js
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const multer  = require('multer');
const { query, sql } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');
const { success, created } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const { sendOtpEmail, sendEmail } = require('../services/emailService');

// ── Multer: memory storage ────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg','image/jpg','image/png','application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(`File type ${file.mimetype} not allowed.`, 400), false);
  },
});

const handleV = (req) => {
  const e = validationResult(req);
  if (!e.isEmpty()) {
    console.error('❌ Validation errors:', JSON.stringify(e.array(), null, 2));
    throw new AppError('Validation failed', 422, e.array());
  }
};

const parseDate = (value, fieldName = 'Date', { mustBePast = false, mustBeFuture = false } = {}) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new AppError(`Invalid ${fieldName}.`, 400);
  const now = new Date();
  if (mustBePast   && d >= now) throw new AppError(`${fieldName} must be in the past.`, 400);
  if (mustBeFuture && d <= now) throw new AppError(`${fieldName} must be a future date.`, 400);
  return d;
};

const formatTime = (t) => {
  if (!t) return undefined;
  const parts = t.trim().split(':');
  if (parts.length < 2) return undefined;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  if (isNaN(h) || isNaN(m) || isNaN(s)) return undefined;
  const d = new Date();
  d.setHours(h, m, s, 0);
  return d;
};

// ── Phone sanitiser — strips non-digits, rejects leading 0 ───────────────────
const sanitizePhone = (raw = '') => {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0')) throw new AppError('Phone number cannot start with 0.', 400);
  return digits;
};

// ── OTP helpers ───────────────────────────────────────────────────────────────
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;
const OTP_MAX_ATTEMPTS    = parseInt(process.env.OTP_MAX_ATTEMPTS) || 5;

const generateOtp = () => {
  const len = parseInt(process.env.OTP_LENGTH) || 6;
  return Array.from(crypto.randomBytes(len)).map(b => b % 10).join('');
};

// ── Patient ID generator: PT-XXXX/xxxx-XXXX/xxxx ─────────────────────────────
const CHARSET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARSET_LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

const randSegment = (charset, len) =>
  Array.from(crypto.randomBytes(len))
    .map(b => charset[b % charset.length])
    .join('');

const generatePatientId = () => {
  const seg1 = randSegment(CHARSET_UPPER, 4);
  const seg2 = randSegment(CHARSET_LOWER, 4);
  const seg3 = randSegment(CHARSET_UPPER, 4);
  const seg4 = randSegment(CHARSET_LOWER, 4);
  return `PT-${seg1}/${seg2}-${seg3}/${seg4}`;
};

const generateUniquePatientId = async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pid = generatePatientId();
    const exists = await query(
      `SELECT Id FROM dbo.PatientProfiles WHERE UHID = @pid`,
      { pid: { type: sql.NVarChar(30), value: pid } }
    );
    if (!exists.recordset.length) return pid;
    console.warn(`Patient ID collision on attempt ${attempt + 1}: ${pid} — retrying...`);
  }
  throw new AppError('Failed to generate a unique Patient ID. Please try again.', 500);
};

// ── Doctor ID generator: DT-1234 (4 digits, 0000–9999 = 10,000 combinations) ──
// Format: DT-1234  — simple, numeric, easy to read/communicate verbally
// Zero-padded so DT-0042 is valid. Supports up to 9999 doctors per hospital.
const generateDoctorId = () => {
  // Use crypto random bytes to get an unbiased number in [0, 9999]
  const num = crypto.randomInt(0, 10000); // 0–9999 inclusive
  return `DT-${String(num).padStart(4, '0')}`;
};

const generateUniqueDoctorId = async () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const did = generateDoctorId();
    const exists = await query(
      `SELECT Id FROM dbo.DoctorProfiles WHERE DoctorId = @did`,
      { did: { type: sql.NVarChar(30), value: did } }
    );
    if (!exists.recordset.length) return did;
    console.warn(`Doctor ID collision on attempt ${attempt + 1}: ${did} — retrying...`);
  }
  throw new AppError('Failed to generate a unique Doctor ID. Please try again.', 500);
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Doctor: Application Received ─────────────────────────────────────────────
const sendDoctorSubmissionEmail = async ({ to, name, username }) => {
  const subject = 'Registration Submitted — Pending Admin Review | MediCore HMS';
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
  <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#0ea5e9 100%);padding:36px 40px;text-align:center;">
    <span style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;">MediCore HMS</span>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:1px;text-transform:uppercase;">Doctor Registration</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:64px;height:64px;background:#fef9c3;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;border:3px solid #fde047;font-size:28px;">⏳</div>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;text-align:center;">Application Received!</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#64748b;text-align:center;line-height:1.7;">
      Hi <strong style="color:#1e293b;">Dr. ${name}</strong>, your registration has been submitted and is pending admin review.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Login Username</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#1e293b;font-family:'Courier New',monospace;">${username}</p>
    </div>
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;font-weight:600;">What happens next?</p>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:#92400e;line-height:1.8;">
        <li>An administrator will review your credentials</li>
        <li>You'll receive an email once a decision is made</li>
        <li>Typical review time: <strong>1–2 business days</strong></li>
      </ul>
    </div>
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
      Please do not attempt to log in until you receive an approval email.<br/>
      If you have questions, contact your hospital administrator.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} MediCore HMS · Automated message, do not reply.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return sendEmail({
    to, subject, html,
    text: `Hi Dr. ${name}, your doctor registration has been submitted and is pending admin review.\n\nUsername: ${username}\n\nYou will receive a decision email within 1–2 business days.\n\n© ${new Date().getFullYear()} MediCore HMS`,
  });
};

// ── Doctor: Approved ──────────────────────────────────────────────────────────
const sendDoctorApprovalEmail = async ({ to, name, username, doctorId }) => {
  const subject = '🎉 Registration Approved — Welcome to MediCore HMS';
  const loginUrl = process.env.APP_URL || 'http://localhost:3000';
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
  <tr><td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:36px 40px;text-align:center;">
    <span style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;">MediCore HMS</span>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:1px;text-transform:uppercase;">Doctor Portal</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:64px;height:64px;background:#d1fae5;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;border:3px solid #6ee7b7;font-size:28px;">✓</div>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;text-align:center;">You're Approved!</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#64748b;text-align:center;line-height:1.7;">
      Welcome aboard, <strong style="color:#1e293b;">Dr. ${name}</strong>! Your account is now active.
    </p>

    <!-- Doctor ID highlight box -->
    <div style="background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:2px solid #c7d2fe;border-radius:16px;padding:28px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6366f1;letter-spacing:2px;text-transform:uppercase;">Your Doctor ID</p>
      <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:6px;color:#4338ca;font-family:'Courier New',monospace;">${doctorId}</p>
      <p style="margin:10px 0 0;font-size:12px;color:#818cf8;">Use this ID for all hospital records, prescriptions &amp; communications</p>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Login Username</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;font-family:'Courier New',monospace;">${username}</p>
    </div>

    <div style="text-align:center;">
      <a href="${loginUrl}/login"
        style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:white;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
        Go to Doctor Portal →
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} MediCore HMS · Automated message, do not reply.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return sendEmail({
    to, subject, html,
    text: `Congratulations Dr. ${name}! Your registration has been approved.\n\nDoctor ID : ${doctorId}\nUsername  : ${username}\n\nLogin at: ${loginUrl}/login\n\n© ${new Date().getFullYear()} MediCore HMS`,
  });
};

// ── Doctor: Rejected ──────────────────────────────────────────────────────────
const sendDoctorRejectionEmail = async ({ to, name, reason }) => {
  const subject = 'Registration Update — MediCore HMS';
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
  <tr><td style="background:linear-gradient(135deg,#dc2626 0%,#ef4444 100%);padding:36px 40px;text-align:center;">
    <span style="color:white;font-size:20px;font-weight:800;">MediCore HMS</span>
  </td></tr>
  <tr><td style="padding:40px;">
    <div style="text-align:center;margin-bottom:24px;font-size:40px;">❌</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;text-align:center;">Application Not Approved</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;text-align:center;line-height:1.7;">
      Hi <strong>Dr. ${name}</strong>, after reviewing your application we are unable to approve your registration at this time.
    </p>
    ${reason ? `
    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;">Reason</p>
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">${reason}</p>
    </div>` : ''}
    <p style="margin:0;font-size:13px;color:#64748b;text-align:center;line-height:1.7;">
      If you believe this is an error or wish to reapply with updated credentials,<br/>please contact your hospital administrator.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} MediCore HMS</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return sendEmail({
    to, subject, html,
    text: `Hi Dr. ${name}, your doctor registration was not approved.${reason ? `\n\nReason: ${reason}` : ''}\n\nPlease contact your hospital administrator for further details.`,
  });
};

// ── Doctor: Deferred / On Hold ────────────────────────────────────────────────
const sendDoctorDeferredEmail = async ({ to, name }) => {
  const subject = 'Registration On Hold — MediCore HMS';
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
  <tr><td style="background:linear-gradient(135deg,#d97706 0%,#f59e0b 100%);padding:36px 40px;text-align:center;">
    <span style="color:white;font-size:20px;font-weight:800;">MediCore HMS</span>
  </td></tr>
  <tr><td style="padding:40px;">
    <div style="text-align:center;margin-bottom:24px;font-size:40px;">⏸️</div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;text-align:center;">Application On Hold</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;text-align:center;line-height:1.7;">
      Hi <strong>Dr. ${name}</strong>, your registration is currently on hold pending additional review or documentation.
    </p>
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        An administrator may reach out to you for additional information. Please watch your email and keep your contact details up to date.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;text-align:center;">Expected resolution time: <strong>2–5 business days</strong></p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} MediCore HMS</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return sendEmail({
    to, subject, html,
    text: `Hi Dr. ${name}, your doctor registration application is currently on hold pending additional review. An administrator may contact you for further information.`,
  });
};

// ── Patient: Registration Confirmed ──────────────────────────────────────────
const sendRegistrationConfirmationEmail = async ({ to, name, patientId, username }) => {
  const subject = 'Welcome to MediCore HMS — Registration Confirmed';
  const loginUrl = process.env.APP_URL || 'http://localhost:3000';
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#0ea5e9 100%);padding:36px 40px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:14px;padding:10px 18px;margin-bottom:14px;">
              <span style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;">MediCore HMS</span>
            </div>
            <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:0.5px;">PATIENT PORTAL</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <div style="text-align:center;margin-bottom:28px;">
              <div style="width:64px;height:64px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;border:3px solid #6ee7b7;">
                <span style="font-size:28px;">✓</span>
              </div>
            </div>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-0.5px;">Registration Successful!</h1>
            <p style="margin:0 0 32px;font-size:14px;color:#64748b;text-align:center;line-height:1.7;">
              Welcome, <strong style="color:#1e293b;">${name}</strong>! Your patient account has been created successfully.
            </p>
            <div style="background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:2px solid #c7d2fe;border-radius:16px;padding:24px;text-align:center;margin-bottom:20px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366f1;letter-spacing:2px;text-transform:uppercase;">Your Patient ID</p>
              <p style="margin:0;font-size:28px;font-weight:900;letter-spacing:4px;color:#4338ca;font-family:'Courier New',monospace;">${patientId}</p>
              <p style="margin:8px 0 0;font-size:12px;color:#818cf8;">Present this ID at every hospital visit</p>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Login Username</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;font-family:'Courier New',monospace;">${username}</p>
            </div>
            <div style="text-align:center;">
              <a href="${loginUrl}/login"
                style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
                Go to Patient Portal →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              © ${new Date().getFullYear()} MediCore HMS · Automated message, please do not reply.<br/>
              If you didn't register, please contact us immediately.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `
Welcome to MediCore HMS, ${name}!

Your registration is confirmed.

Patient ID : ${patientId}
Username   : ${username}

Please keep your Patient ID safe — you'll need it at every hospital visit.

Log in at: ${loginUrl}/login

© ${new Date().getFullYear()} MediCore HMS
`.trim();

  return sendEmail({ to, subject, html, text });
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /register/hospital-info?hospitalId=1
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/hospital-info', async (req, res, next) => {
  try {
    const hospitalId = parseInt(req.query.hospitalId) || 1;
    const result = await query(
      `SELECT h.Id, h.Name, h.ShortName, h.LogoUrl, h.PrimaryColor, h.SecondaryColor,
              h.Email, h.Phone, h.Website, h.City, h.Status,
              h.Street1, h.Street2, h.PincodeText,
              h.EmergencyNumber, h.AmbulanceNumber,
              h.Accreditations, h.Specialities, h.BedCapacity, h.EstablishedYear,
              d.Name AS DistrictName, s.Name AS StateName, c.Name AS CountryName
       FROM dbo.HospitalSetup h
       LEFT JOIN dbo.Districts d ON d.Id = h.DistrictId
       LEFT JOIN dbo.States   s  ON s.Id = h.StateId
       LEFT JOIN dbo.Countries c ON c.Id = h.CountryId
       WHERE h.Id = @id AND h.DeletedAt IS NULL AND h.Status = 'active'`,
      { id: { type: sql.BigInt, value: hospitalId } }
    );
    if (!result.recordset.length) return success(res, { name: 'MediCore HMS', primaryColor: '#6d28d9' });
    success(res, result.recordset[0]);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /register/send-email-otp
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/send-email-otp', [
  body('email').isEmail().withMessage('Valid email required'),
], async (req, res, next) => {
  try {
    handleV(req);
    const email = req.body.email.trim().toLowerCase();

    const dupCheck = await query(
      `SELECT Id FROM dbo.Users WHERE LOWER(Email) = @e AND DeletedAt IS NULL`,
      { e: { type: sql.NVarChar(255), value: email } }
    );
    if (dupCheck.recordset.length) throw new AppError('This email is already registered.', 409);

    await query(
      `DELETE FROM dbo.OtpTokens WHERE Contact = @contact AND Purpose = @purpose`,
      {
        contact: { type: sql.NVarChar(255), value: email },
        purpose: { type: sql.NVarChar(30),  value: 'email_verify_registration' },
      }
    );

    const otp       = generateOtp();
    const otpHash   = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO dbo.OtpTokens
         (UserId, Contact, ContactType, Purpose, OtpHash, Attempts, MaxAttempts, IsVerified, ExpiresAt, IpAddress)
       VALUES
         (NULL, @contact, 'email', @purpose, @hash, 0, @maxAtt, 0, @exp, @ip)`,
      {
        contact: { type: sql.NVarChar(255),     value: email },
        purpose: { type: sql.NVarChar(30),      value: 'email_verify_registration' },
        hash:    { type: sql.NVarChar(sql.MAX), value: otpHash },
        maxAtt:  { type: sql.SmallInt,          value: OTP_MAX_ATTEMPTS },
        exp:     { type: sql.DateTime2,         value: expiresAt },
        ip:      { type: sql.NVarChar(50),      value: req.ip || null },
      }
    );

    await sendOtpEmail({
      to:             email,
      name:           'Patient',
      otp,
      expiresMinutes: OTP_EXPIRES_MINUTES,
      purpose:        'email verification',
    });

    console.log(`📧 Registration OTP sent → ${email}`);
    success(res, { expiresInMinutes: OTP_EXPIRES_MINUTES }, 'OTP sent successfully.');
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /register/verify-email-otp
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/verify-email-otp', [
  body('email').isEmail().withMessage('Valid email required'),
  body('otp').isLength({ min:6, max:6 }).withMessage('OTP must be 6 digits'),
], async (req, res, next) => {
  try {
    handleV(req);
    const email = req.body.email.trim().toLowerCase();
    const otp   = req.body.otp.trim();

    const result = await query(
      `SELECT TOP 1 Id, OtpHash, ExpiresAt, Attempts, MaxAttempts, IsVerified
       FROM dbo.OtpTokens
       WHERE LOWER(Contact) = @contact AND Purpose = @purpose
       ORDER BY CreatedAt DESC`,
      {
        contact: { type: sql.NVarChar(255), value: email },
        purpose: { type: sql.NVarChar(30),  value: 'email_verify_registration' },
      }
    );

    const rec = result.recordset[0];
    if (!rec) throw new AppError('No active OTP found. Please request a new one.', 400);

    if (rec.IsVerified) return success(res, { verified: true }, 'Email already verified.');

    if (new Date(rec.ExpiresAt) < new Date()) {
      await query(`DELETE FROM dbo.OtpTokens WHERE Id = @id`, { id: { type: sql.BigInt, value: rec.Id } });
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    if (rec.Attempts >= rec.MaxAttempts) {
      await query(`DELETE FROM dbo.OtpTokens WHERE Id = @id`, { id: { type: sql.BigInt, value: rec.Id } });
      throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429);
    }

    const valid = await bcrypt.compare(otp, rec.OtpHash);
    if (!valid) {
      const newAttempts = rec.Attempts + 1;
      const remaining   = rec.MaxAttempts - newAttempts;
      if (remaining <= 0) {
        await query(`DELETE FROM dbo.OtpTokens WHERE Id = @id`, { id: { type: sql.BigInt, value: rec.Id } });
        throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429);
      }
      await query(
        `UPDATE dbo.OtpTokens SET Attempts = @a WHERE Id = @id`,
        { a: { type: sql.SmallInt, value: newAttempts }, id: { type: sql.BigInt, value: rec.Id } }
      );
      throw new AppError(`Incorrect OTP. ${remaining} attempt(s) remaining.`, 400);
    }

    await query(
      `UPDATE dbo.OtpTokens SET IsVerified = 1, VerifiedAt = SYSUTCDATETIME() WHERE Id = @id`,
      { id: { type: sql.BigInt, value: rec.Id } }
    );

    success(res, { verified: true }, 'Email verified successfully.');
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /register/patient
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/patient', [
  body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
  body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name required'),
  body('lastName').trim().isLength({ min: 1, max: 100 }).withMessage('Last name required'),
  body('phone').trim().notEmpty().withMessage('Phone number required')
    .custom(v => { if (/^0/.test(v.replace(/\D/g,''))) throw new Error('Phone cannot start with 0'); return true; }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('gender').optional({ checkFalsy: true }).isIn(['Male', 'Female', 'Other', 'PreferNot']),
  body('dateOfBirth').optional({ checkFalsy: true }).isDate().withMessage('Invalid date of birth'),
  body('bloodGroup').optional({ checkFalsy: true }).isIn(['A+','A-','B+','B-','AB+','AB-','O+','O-']),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password needs uppercase, lowercase and number'),
], async (req, res, next) => {
  try {
    handleV(req);

    const {
      hospitalId, firstName, lastName, phoneCountryCode,
      email, gender, dateOfBirth, password, bloodGroup,
      maritalStatus, religion, occupation, fatherName, husbandName,
      dateOfArrival,
      street1, street2, city,
      countryName, stateName, pincodeText,
      emergencyName, emergencyRelation, emergencyPhone,
      knownAllergies, chronicConditions,
      pastSurgery, pastSurgeryDetails, additionalNotes,
      insuranceProvider, insurancePolicyNo, insuranceValidUntil,
      idType, idNumber,
      username: reqUsername,
    } = req.body;

    // ── sanitise phone — strips non-digits, rejects leading 0 ─────────────
    const phone = sanitizePhone(req.body.phone);

    const dobValue = parseDate(dateOfBirth, 'Date of birth', { mustBePast: true });
    const hid      = parseInt(hospitalId);

    let insExpDate = null;
    if (insuranceValidUntil) {
      const parsed = new Date(insuranceValidUntil);
      if (!isNaN(parsed.getTime())) insExpDate = parsed;
    }

    // ── Verify email OTP ───────────────────────────────────────────────────
    if (email) {
      const otpCheck = await query(
        `SELECT TOP 1 Id FROM dbo.OtpTokens
         WHERE LOWER(Contact) = LOWER(@e) AND Purpose = @purpose AND IsVerified = 1 AND ExpiresAt > SYSUTCDATETIME()`,
        {
          e:       { type: sql.NVarChar(255), value: email.trim().toLowerCase() },
          purpose: { type: sql.NVarChar(30),  value: 'email_verify_registration' },
        }
      );
      if (!otpCheck.recordset.length) {
        throw new AppError('Email address has not been verified. Please verify your email before registering.', 400);
      }
    }

    // ── Duplicate checks ───────────────────────────────────────────────────
    const dupPhone = await query(
      `SELECT Id FROM dbo.Users WHERE Phone = @p AND DeletedAt IS NULL`,
      { p: { type: sql.NVarChar(20), value: phone } }
    );
    if (dupPhone.recordset.length) throw new AppError('A user with this phone number already exists.', 409);

    if (email) {
      const dupEmail = await query(
        `SELECT Id FROM dbo.Users WHERE LOWER(Email) = LOWER(@e) AND DeletedAt IS NULL`,
        { e: { type: sql.NVarChar(255), value: email } }
      );
      if (dupEmail.recordset.length) throw new AppError('An account with this email already exists.', 409);
    }

    const username = (reqUsername || '').trim().toLowerCase() ||
      `pat_${phone.slice(-8)}_${Date.now().toString().slice(-4)}`;

    const dupUser = await query(
      `SELECT Id FROM dbo.Users WHERE Username = @u AND DeletedAt IS NULL`,
      { u: { type: sql.NVarChar(80), value: username } }
    );
    if (dupUser.recordset.length) throw new AppError('Username already taken. Please choose another.', 409);

    const patientId = await generateUniquePatientId();
    const hash      = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    const userRes = await query(
      `INSERT INTO dbo.Users
         (HospitalId, Username, Email, Phone, PhoneCountryCode, PasswordHash, Role,
          FirstName, LastName, Gender, DateOfBirth, IsActive, CreatedBy)
       OUTPUT INSERTED.Id
       VALUES
         (@hid, @uname, @email, @phone, @pcc, @hash, 'patient',
          @fname, @lname, @gender, @dob, 1, NULL)`,
      {
        hid:    { type: sql.BigInt,            value: hid },
        uname:  { type: sql.NVarChar(80),      value: username },
        email:  { type: sql.NVarChar(255),     value: email || null },
        phone:  { type: sql.NVarChar(20),      value: phone },
        pcc:    { type: sql.NVarChar(10),      value: phoneCountryCode || '+91' },
        hash:   { type: sql.NVarChar(sql.MAX), value: hash },
        fname:  { type: sql.NVarChar(100),     value: firstName.trim() },
        lname:  { type: sql.NVarChar(100),     value: lastName.trim() },
        gender: { type: sql.NVarChar(20),      value: gender || null },
        dob:    { type: sql.Date,              value: dobValue },
      }
    );
    const userId = userRes.recordset[0].Id;

    let aadhaar = null, pan = null, passportNo = null, voterId = null;
    if (idType && idNumber) {
      const num = idNumber.trim().toUpperCase();
      if      (idType === 'Aadhar Card') aadhaar    = num.replace(/\D/g,'').slice(0,12);
      else if (idType === 'PAN Card')    pan        = num.slice(0,10);
      else if (idType === 'Passport')    passportNo = num.slice(0,30);
      else if (idType === 'Voter ID')    voterId    = num.slice(0,30);
    }

    await query(
      `INSERT INTO dbo.PatientProfiles
         (UserId, HospitalId, UHID,
          FirstName, LastName, Gender, DateOfBirth, AgeYears,
          BloodGroup, Phone, PhoneCountryCode, Email,
          Street1, City, PincodeText,
          EmergencyName, EmergencyRelation, EmergencyPhone,
          CreatedBy)
       VALUES
         (@uid, @hid, @uhid,
          @fname, @lname, @gender, @dob, @age,
          @bg, @phone, @pcc, @email,
          @s1, @city, @ptext,
          @ename, @erel, @ephone,
          @uid)`,
      {
        uid:    { type: sql.BigInt,        value: userId },
        hid:    { type: sql.BigInt,        value: hid },
        uhid:   { type: sql.NVarChar(30),  value: patientId },
        fname:  { type: sql.NVarChar(100), value: firstName.trim() },
        lname:  { type: sql.NVarChar(100), value: lastName.trim() },
        gender: { type: sql.NVarChar(20),  value: gender || null },
        dob:    { type: sql.Date,          value: dobValue },
        age:    { type: sql.SmallInt,      value: dobValue ? (new Date().getFullYear() - dobValue.getFullYear()) : null },
        bg:     { type: sql.NVarChar(5),   value: bloodGroup || null },
        phone:  { type: sql.NVarChar(20),  value: phone },
        pcc:    { type: sql.NVarChar(10),  value: phoneCountryCode || '+91' },
        email:  { type: sql.NVarChar(255), value: email || null },
        s1:     { type: sql.NVarChar(255), value: street1 || null },
        city:   { type: sql.NVarChar(100), value: city || null },
        ptext:  { type: sql.NVarChar(20),  value: pincodeText || null },
        ename:  { type: sql.NVarChar(200), value: emergencyName || null },
        erel:   { type: sql.NVarChar(80),  value: emergencyRelation != null ? String(emergencyRelation) : null },
        ephone: { type: sql.NVarChar(20),  value: emergencyPhone || null },
      }
    );

    const chronicFull =
      chronicConditions
        ? `${chronicConditions}${pastSurgery==='yes'&&pastSurgeryDetails?`\nPast Surgery: ${pastSurgeryDetails}`:''}`
        : pastSurgery==='yes'&&pastSurgeryDetails ? `Past Surgery: ${pastSurgeryDetails}` : null;

    const updateParams = {
      uid:        { type: sql.BigInt,            value: userId },
      s2:         { type: sql.NVarChar(255),     value: street2 || null },
      marital:    { type: sql.NVarChar(20),      value: maritalStatus || null },
      religion:   { type: sql.NVarChar(80),      value: religion || null },
      occupation: { type: sql.NVarChar(150),     value: occupation || null },
      aadhaar:    { type: sql.NVarChar(12),      value: aadhaar },
      pan:        { type: sql.NVarChar(10),      value: pan },
      passportNo: { type: sql.NVarChar(30),      value: passportNo },
      voterId:    { type: sql.NVarChar(30),      value: voterId },
      allergies:  { type: sql.NVarChar(sql.MAX), value: knownAllergies || null },
      chronic:    { type: sql.NVarChar(sql.MAX), value: chronicFull },
      insProv:    { type: sql.NVarChar(200),     value: insuranceProvider || null },
      insPol:     { type: sql.NVarChar(100),     value: insurancePolicyNo || null },
      photoUrl:   { type: sql.NVarChar(500),     value: req.photoUrl || null },
    };
    if (insExpDate) updateParams.insExp = { type: sql.Date, value: insExpDate };

    await query(
      `UPDATE dbo.PatientProfiles SET
         Street2             = @s2,
         MaritalStatus       = @marital,
         Religion            = @religion,
         Occupation          = @occupation,
         Aadhaar             = @aadhaar,
         PAN                 = @pan,
         PassportNo          = @passportNo,
         VoterId             = @voterId,
         KnownAllergies      = @allergies,
         ChronicConditions   = @chronic,
         InsuranceProvider   = @insProv,
         InsurancePolicyNo   = @insPol,
         InsuranceValidUntil = ${insExpDate ? '@insExp' : 'NULL'},
         PhotoUrl            = @photoUrl
       WHERE UserId = @uid`,
      updateParams
    );

    if (email) {
      query(
        `DELETE FROM dbo.OtpTokens WHERE LOWER(Contact) = LOWER(@e) AND Purpose = @purpose`,
        {
          e:       { type: sql.NVarChar(255), value: email.trim().toLowerCase() },
          purpose: { type: sql.NVarChar(30),  value: 'email_verify_registration' },
        }
      ).catch(err => console.error('OTP cleanup failed (non-fatal):', err.message));
    }

    if (email) {
      sendRegistrationConfirmationEmail({ to: email, name: firstName.trim(), patientId, username })
        .catch(err => console.error('Registration confirmation email failed (non-fatal):', err.message));
    }

    console.log(`✅ Patient registered: ${username} | PatientId: ${patientId} | UserId: ${userId}`);
    created(res, { username, patientId }, 'Patient registered successfully. A confirmation email has been sent.');
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /register/doctor
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/doctor',
  upload.any(),
  [
    body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('phone').trim().notEmpty().withMessage('Phone required')
      .custom(v => { if (/^0/.test(v.replace(/\D/g,''))) throw new Error('Phone cannot start with 0'); return true; }),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password needs uppercase, lowercase and number'),
    body('licenseNumber').trim().notEmpty().withMessage('License number required'),
    body('specializationId').isInt({ min: 1 }).withMessage('Specialization required'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);

      const {
        hospitalId, firstName, lastName, email, phoneCountryCode, altPhone,
        password, username: reqUsername,
        gender, dateOfBirth, bloodGroup, nationality, maritalStatus,
        religion, occupation, motherTongue, designation,
        specializationId, qualificationId, medicalCouncilId, departmentId,
        licenseNumber, licenseExpiry, experienceYears,
        consultationFee, followUpFee, emergencyFee, maxDailyPatients,
        languagesSpoken, availableDays, availableFrom, availableTo,
        bio, awards, publications,
        aadhaar, pan, passportNo, voterId, abhaNumber,
        street1, street2, city, countryId, stateId, pincode,
      } = req.body;

      // ── sanitise phone ───────────────────────────────────────────────────
      const phone = sanitizePhone(req.body.phone);

      const dobValue    = parseDate(dateOfBirth,   'Date of birth',  { mustBePast: true });
      const licExpValue = parseDate(licenseExpiry, 'License expiry', { mustBeFuture: true });
      if (!licExpValue) throw new AppError('License expiry date is required.', 400);
      const hid = parseInt(hospitalId);

      // ── FIX 6: Verify email OTP was completed before doctor registration ──────
      const otpCheck = await query(
        `SELECT TOP 1 Id FROM dbo.OtpTokens
         WHERE LOWER(Contact) = LOWER(@e) AND Purpose = @purpose AND IsVerified = 1 AND ExpiresAt > SYSUTCDATETIME()`,
        {
          e:       { type: sql.NVarChar(255), value: email.trim().toLowerCase() },
          purpose: { type: sql.NVarChar(30),  value: 'email_verify_registration' },
        }
      );
      if (!otpCheck.recordset.length) {
        throw new AppError('Email address has not been verified. Please verify your email with the OTP before submitting.', 400);
      }

      const dupEmail = await query(
        `SELECT Id FROM dbo.Users WHERE LOWER(Email) = LOWER(@e) AND DeletedAt IS NULL`,
        { e: { type: sql.NVarChar(255), value: email } }
      );
      if (dupEmail.recordset.length) throw new AppError('An account with this email already exists.', 409);

      const dupPhone = await query(
        `SELECT Id FROM dbo.Users WHERE Phone = @p AND DeletedAt IS NULL`,
        { p: { type: sql.NVarChar(20), value: phone } }
      );
      if (dupPhone.recordset.length) throw new AppError('An account with this phone number already exists.', 409);

      const username = (reqUsername || '').trim().toLowerCase() ||
        `dr_${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'')}_${Date.now().toString().slice(-4)}`;

      const dupUser = await query(
        `SELECT Id FROM dbo.Users WHERE Username = @u AND DeletedAt IS NULL`,
        { u: { type: sql.NVarChar(80), value: username } }
      );
      if (dupUser.recordset.length) throw new AppError('Username already taken. Please choose another.', 409);

      const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

      const safeCountryId = countryId && Number(countryId) > 0 ? parseInt(countryId) : null;
      const safeStateId   = stateId   && Number(stateId) > 0   ? parseInt(stateId)   : null;

      const userRes = await query(
        `INSERT INTO dbo.Users
           (HospitalId, Username, Email, Phone, PhoneCountryCode, AltPhone,
            PasswordHash, Role, FirstName, LastName, Gender, DateOfBirth,
            IsActive, DepartmentId, Designation, CreatedBy)
         OUTPUT INSERTED.Id
         VALUES
           (@hid, @uname, @email, @phone, @pcc, @alt,
            @hash, 'doctor', @fname, @lname, @gender, @dob,
            0, @did, @desig, NULL)`,
        {
          hid:    { type: sql.BigInt,            value: hid },
          uname:  { type: sql.NVarChar(80),      value: username },
          email:  { type: sql.NVarChar(255),     value: email },
          phone:  { type: sql.NVarChar(20),      value: phone },
          pcc:    { type: sql.NVarChar(10),      value: phoneCountryCode || '+91' },
          alt:    { type: sql.NVarChar(20),      value: altPhone || null },
          hash:   { type: sql.NVarChar(sql.MAX), value: hash },
          fname:  { type: sql.NVarChar(100),     value: firstName.trim() },
          lname:  { type: sql.NVarChar(100),     value: lastName.trim() },
          gender: { type: sql.NVarChar(20),      value: gender || null },
          dob:    { type: sql.Date,              value: dobValue },
          did:    { type: sql.BigInt,            value: departmentId || null },
          desig:  { type: sql.NVarChar(150),     value: designation || null },
        }
      );
      const userId = userRes.recordset[0].Id;

      const cleanAadhaar = aadhaar ? aadhaar.replace(/\D/g,'').slice(0,12) : null;
      const cleanPan     = pan     ? pan.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10) : null;
      const fromValue    = formatTime(availableFrom);
      const toValue      = formatTime(availableTo);

      await query(
        `INSERT INTO dbo.DoctorProfiles
           (UserId, HospitalId, DepartmentId, SpecializationId, QualificationId,
            MedicalCouncilId, LicenseNumber, LicenseExpiry, ExperienceYears,
            ConsultationFee, FollowUpFee, EmergencyFee, MaxDailyPatients,
            LanguagesSpoken, AvailableDays, AvailableFrom, AvailableTo,
            Bio, Awards, Publications,
            BloodGroup, Nationality, AltPhone, Aadhaar, PAN,
            Street1, Street2, City, CountryId, StateId, PincodeText,
            ApprovalStatus, CreatedBy)
         VALUES
           (@uid, @hid, @did, @spec, @qual,
            @council, @lic, @licexp, @exp,
            @fee, @followfee, @emergfee, @maxpat,
            @langs, @days, @from, @to,
            @bio, @awards, @pubs,
            @blood, @nation, @alt, @aadhaar, @pan,
            @s1, @s2, @city, @cid, @sid, @ptext,
            'pending', NULL)`,
        {
          uid:       { type: sql.BigInt,            value: userId },
          hid:       { type: sql.BigInt,            value: hid },
          did:       { type: sql.BigInt,            value: departmentId || null },
          spec:      { type: sql.Int,               value: parseInt(specializationId) },
          qual:      { type: sql.Int,               value: qualificationId || null },
          council:   { type: sql.Int,               value: medicalCouncilId || null },
          lic:       { type: sql.NVarChar(100),     value: licenseNumber.trim() },
          licexp:    { type: sql.Date,              value: licExpValue },
          exp:       { type: sql.SmallInt,          value: experienceYears ? parseInt(experienceYears) : null },
          fee:       { type: sql.Decimal(10,2),     value: consultationFee ? parseFloat(consultationFee) : null },
          followfee: { type: sql.Decimal(10,2),     value: followUpFee ? parseFloat(followUpFee) : null },
          emergfee:  { type: sql.Decimal(10,2),     value: emergencyFee ? parseFloat(emergencyFee) : null },
          maxpat:    { type: sql.SmallInt,          value: maxDailyPatients ? parseInt(maxDailyPatients) : null },
          langs:     { type: sql.NVarChar(300),     value: languagesSpoken || null },
          days:      { type: sql.NVarChar(100),     value: availableDays || null },
          ...(fromValue!==undefined?{from:{type:sql.Time,value:fromValue}}:{from:{type:sql.NVarChar(10),value:null}}),
          ...(toValue!==undefined  ?{to:  {type:sql.Time,value:toValue  }}:{to:  {type:sql.NVarChar(10),value:null}}),
          bio:       { type: sql.NVarChar(sql.MAX), value: bio || null },
          awards:    { type: sql.NVarChar(sql.MAX), value: awards || null },
          pubs:      { type: sql.NVarChar(sql.MAX), value: publications || null },
          blood:     { type: sql.NVarChar(5),       value: bloodGroup || null },
          nation:    { type: sql.NVarChar(80),      value: nationality || 'Indian' },
          alt:       { type: sql.NVarChar(20),      value: altPhone || null },
          aadhaar:   { type: sql.NVarChar(12),      value: cleanAadhaar },
          pan:       { type: sql.NVarChar(10),      value: cleanPan },
          s1:        { type: sql.NVarChar(255),     value: street1 || null },
          s2:        { type: sql.NVarChar(255),     value: street2 || null },
          city:      { type: sql.NVarChar(100),     value: city || null },
          cid:       { type: sql.Int,               value: safeCountryId },
          sid:       { type: sql.Int,               value: safeStateId },
          ptext:     { type: sql.NVarChar(20),      value: pincode || null },
        }
      );

      if (req.files?.length) console.log(`📎 ${req.files.length} file(s) received for doctor ${userId}`);

      // ── Send "pending review" email immediately after registration ──────────
      sendDoctorSubmissionEmail({ to: email, name: firstName.trim(), username })
        .catch(err => console.error('Doctor submission email failed (non-fatal):', err.message));

      console.log(`✅ Doctor registered: ${username} | UserId: ${userId} | Status: pending`);
      created(res, { username }, 'Doctor registration submitted. Awaiting admin approval.');
    } catch (err) { next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /register/staff
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/staff',
  upload.any(),
  [
    body('hospitalId').isInt({ min: 1 }).withMessage('Hospital ID required'),
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('phone').trim().notEmpty().withMessage('Phone required')
      .custom(v => { if (/^0/.test(v.replace(/\D/g,''))) throw new Error('Phone cannot start with 0'); return true; }),
    body('role').trim().notEmpty().withMessage('Role required'),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password needs uppercase, lowercase and number'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);
      const {
        hospitalId, firstName, lastName, email, phoneCountryCode, altPhone,
        password, username: reqUsername,
        gender, dateOfBirth, bloodGroup, nationality, maritalStatus,
        religion, motherTongue,
        role, departmentId, employeeId, joiningDate, shiftType, qualification,
        contractType, reportingManager,
        workStartTime, workEndTime, weeklyOff,
        emergencyName, emergencyRelation, emergencyPhone,
        aadhaar, pan, passportNo, voterId, abhaNumber,
        street1, street2, city, countryId, stateId, pincode,
        languagesSpoken, previousEmployer, experienceYears,
        bankAccountNo, ifscCode, knownAllergies, bloodDonor,
      } = req.body;

      const phone = sanitizePhone(req.body.phone);

      const hid      = parseInt(hospitalId);
      const dobValue  = parseDate(dateOfBirth, 'Date of birth', { mustBePast: true });
      const joinValue = parseDate(joiningDate, 'Joining date');

      // Verify email OTP was completed before staff registration
      const staffOtpCheck = await query(
        `SELECT TOP 1 Id FROM dbo.OtpTokens
         WHERE LOWER(Contact) = LOWER(@e) AND Purpose = @purpose AND IsVerified = 1 AND ExpiresAt > SYSUTCDATETIME()`,
        {
          e:       { type: sql.NVarChar(255), value: email.trim().toLowerCase() },
          purpose: { type: sql.NVarChar(30),  value: 'email_verify_registration' },
        }
      );
      if (!staffOtpCheck.recordset.length) {
        throw new AppError('Email address has not been verified. Please verify your email with the OTP before submitting.', 400);
      }

      const dupEmail = await query(`SELECT Id FROM dbo.Users WHERE LOWER(Email) = LOWER(@e) AND DeletedAt IS NULL`,{ e:{type:sql.NVarChar(255),value:email}});
      if (dupEmail.recordset.length) throw new AppError('An account with this email already exists.', 409);

      const dupPhone = await query(`SELECT Id FROM dbo.Users WHERE Phone = @p AND DeletedAt IS NULL`,{ p:{type:sql.NVarChar(20),value:phone}});
      if (dupPhone.recordset.length) throw new AppError('An account with this phone number already exists.', 409);

      const username = (reqUsername||'').trim().toLowerCase() ||
        `${role.replace(/[^a-z]/g,'').slice(0,4)}_${phone.slice(-8)}_${Date.now().toString().slice(-4)}`;

      const dupUser = await query(`SELECT Id FROM dbo.Users WHERE Username = @u AND DeletedAt IS NULL`,{ u:{type:sql.NVarChar(80),value:username}});
      if (dupUser.recordset.length) throw new AppError('Username already taken.', 409);

      const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS)||10);
      const safeCountryId = countryId&&Number(countryId)>0?parseInt(countryId):null;
      const safeStateId   = stateId&&Number(stateId)>0?parseInt(stateId):null;

      const userRes = await query(
        `INSERT INTO dbo.Users (HospitalId,Username,Email,Phone,PhoneCountryCode,AltPhone,PasswordHash,Role,FirstName,LastName,Gender,DateOfBirth,IsActive,DepartmentId,EmployeeId,CreatedBy)
         OUTPUT INSERTED.Id VALUES (@hid,@uname,@email,@phone,@pcc,@alt,@hash,@role,@fname,@lname,@gender,@dob,0,@did,@empid,NULL)`,
        {hid:{type:sql.BigInt,value:hid},uname:{type:sql.NVarChar(80),value:username},email:{type:sql.NVarChar(255),value:email},phone:{type:sql.NVarChar(20),value:phone},pcc:{type:sql.NVarChar(10),value:phoneCountryCode||'+91'},alt:{type:sql.NVarChar(20),value:altPhone||null},hash:{type:sql.NVarChar(sql.MAX),value:hash},role:{type:sql.NVarChar(30),value:role.trim()},fname:{type:sql.NVarChar(100),value:firstName.trim()},lname:{type:sql.NVarChar(100),value:lastName.trim()},gender:{type:sql.NVarChar(20),value:gender||null},dob:{type:sql.Date,value:dobValue},did:{type:sql.BigInt,value:departmentId||null},empid:{type:sql.NVarChar(60),value:employeeId||null}}
      );
      const userId = userRes.recordset[0].Id;

      const cleanAadhaar = aadhaar?aadhaar.replace(/\D/g,'').slice(0,12):null;
      const cleanPan     = pan?pan.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10):null;
      const fromValue    = formatTime(workStartTime);
      const toValue      = formatTime(workEndTime);

      await query(
        `INSERT INTO dbo.StaffProfiles (UserId,HospitalId,DepartmentId,EmployeeId,Shift,JoiningDate,ContractType,ReportingManager,WorkStartTime,WorkEndTime,WeeklyOff,BloodGroup,Nationality,AltPhone,Aadhaar,PAN,PassportNo,VoterId,AbhaNumber,Street1,Street2,City,CountryId,StateId,PincodeText,Qualification,LanguagesSpoken,PreviousEmployer,ExperienceYears,BankAccountNo,IfscCode,KnownAllergies,BloodDonor,MaritalStatus,Religion,MotherTongue,EmergencyName,EmergencyRelation,EmergencyPhone,ApprovalStatus,CreatedBy)
         VALUES (@uid,@hid,@did,@empid,@shift,@join,@contract,@manager,@wstart,@wend,@weekoff,@blood,@nation,@alt,@aadhaar,@pan,@passport,@voter,@abha,@s1,@s2,@city,@cid,@sid,@ptext,@qual,@langs,@prevEmp,@exp,@bank,@ifsc,@allergies,@donor,@marital,@religion,@tongue,@ename,@erel,@ephone,'pending',NULL)`,
        {uid:{type:sql.BigInt,value:userId},hid:{type:sql.BigInt,value:hid},did:{type:sql.BigInt,value:departmentId||null},empid:{type:sql.NVarChar(60),value:employeeId||null},shift:{type:sql.NVarChar(20),value:shiftType||null},join:{type:sql.Date,value:joinValue},contract:{type:sql.NVarChar(30),value:contractType||null},manager:{type:sql.NVarChar(150),value:reportingManager||null},...(fromValue!==undefined?{wstart:{type:sql.Time,value:fromValue}}:{wstart:{type:sql.NVarChar(10),value:null}}),...(toValue!==undefined?{wend:{type:sql.Time,value:toValue}}:{wend:{type:sql.NVarChar(10),value:null}}),weekoff:{type:sql.NVarChar(100),value:weeklyOff||null},blood:{type:sql.NVarChar(5),value:bloodGroup||null},nation:{type:sql.NVarChar(80),value:nationality||'Indian'},alt:{type:sql.NVarChar(20),value:altPhone||null},aadhaar:{type:sql.NVarChar(12),value:cleanAadhaar},pan:{type:sql.NVarChar(10),value:cleanPan},passport:{type:sql.NVarChar(30),value:passportNo||null},voter:{type:sql.NVarChar(30),value:voterId||null},abha:{type:sql.NVarChar(30),value:abhaNumber||null},s1:{type:sql.NVarChar(255),value:street1||null},s2:{type:sql.NVarChar(255),value:street2||null},city:{type:sql.NVarChar(100),value:city||null},cid:{type:sql.Int,value:safeCountryId},sid:{type:sql.Int,value:safeStateId},ptext:{type:sql.NVarChar(20),value:pincode||null},qual:{type:sql.NVarChar(200),value:qualification||null},langs:{type:sql.NVarChar(300),value:languagesSpoken||null},prevEmp:{type:sql.NVarChar(200),value:previousEmployer||null},exp:{type:sql.SmallInt,value:experienceYears?parseInt(experienceYears):null},bank:{type:sql.NVarChar(30),value:bankAccountNo||null},ifsc:{type:sql.NVarChar(15),value:ifscCode||null},allergies:{type:sql.NVarChar(sql.MAX),value:knownAllergies||null},donor:{type:sql.NVarChar(10),value:bloodDonor||null},marital:{type:sql.NVarChar(20),value:maritalStatus||null},religion:{type:sql.NVarChar(80),value:religion||null},tongue:{type:sql.NVarChar(80),value:motherTongue||null},ename:{type:sql.NVarChar(200),value:emergencyName||null},erel:{type:sql.NVarChar(80),value:emergencyRelation||null},ephone:{type:sql.NVarChar(20),value:emergencyPhone||null}}
      );

      if (req.files?.length) console.log(`📎 ${req.files.length} file(s) for staff ${userId}`);
      created(res, { username }, 'Staff registration submitted. Awaiting admin approval.');
    } catch (err) { next(err); }
  }
);

// ── Approval routes ───────────────────────────────────────────────────────────
router.get('/pending-staff', authenticate, authorize('superadmin','admin'), async (req,res,next)=>{
  try {
    const statusFilter=req.query.status||'pending';
    const hospitalId=req.user.role==='superadmin'?(parseInt(req.query.hospitalId)||null):req.user.hospitalId;
    const result=await query(`SELECT sp.Id,sp.UserId,sp.ApprovalStatus AS Status,sp.EmployeeId,sp.Shift,sp.JoiningDate,sp.ContractType,sp.ReportingManager,sp.Qualification,sp.ExperienceYears,sp.LanguagesSpoken,sp.BloodGroup,sp.Nationality,sp.Street1,sp.Street2,sp.City,sp.PincodeText AS Pincode,sp.RejectionReason,sp.ApprovedAt AS ReviewedAt,sp.CreatedAt,u.FirstName,u.LastName,u.Email,u.Phone,u.AltPhone,u.Gender,u.DateOfBirth,u.Role,u.Username,dep.Name AS DepartmentName,co.Name AS CountryName,st.Name AS StateName FROM dbo.StaffProfiles sp JOIN dbo.Users u ON u.Id=sp.UserId LEFT JOIN dbo.Departments dep ON dep.Id=sp.DepartmentId LEFT JOIN dbo.Countries co ON co.Id=sp.CountryId LEFT JOIN dbo.States st ON st.Id=sp.StateId WHERE (@status='all' OR sp.ApprovalStatus=@status) AND (@hid IS NULL OR sp.HospitalId=@hid) ORDER BY sp.CreatedAt DESC`,{status:{type:sql.NVarChar(20),value:statusFilter},hid:{type:sql.BigInt,value:hospitalId}});
    success(res,result.recordset);
  } catch(err){next(err);}
});

router.get('/pending-doctors', authenticate, authorize('superadmin','admin'), async (req,res,next)=>{
  try {
    const statusFilter=req.query.status||'pending';
    const hospitalId=req.user.role==='superadmin'?(parseInt(req.query.hospitalId)||null):req.user.hospitalId;
    // DoctorId is NOT selected here — it's only assigned on approval. Avoids crash if migration not yet run.
    const result=await query(`SELECT dp.Id,dp.UserId,dp.ApprovalStatus AS Status,dp.LicenseNumber,dp.LicenseExpiry,dp.ExperienceYears,dp.ConsultationFee,dp.FollowUpFee,dp.EmergencyFee,dp.MaxDailyPatients,dp.AvailableDays,dp.AvailableFrom,dp.AvailableTo,dp.LanguagesSpoken,dp.Bio,dp.Awards,dp.Publications,dp.BloodGroup,dp.Nationality,dp.Aadhaar,dp.PAN,dp.PassportNo,dp.VoterId,dp.AbhaNumber,dp.Street1,dp.Street2,dp.City,dp.PincodeText AS Pincode,dp.RejectionReason,dp.ApprovedAt AS ReviewedAt,dp.CreatedAt,u.FirstName,u.LastName,u.Email,u.Phone,u.AltPhone,u.Gender,u.DateOfBirth,u.Designation,u.Username,sp.Name AS SpecializationName,q.Code AS QualificationCode,q.FullName AS QualificationName,dep.Name AS DepartmentName,mc.Name AS MedicalCouncilName,co.Name AS CountryName,st.Name AS StateName FROM dbo.DoctorProfiles dp JOIN dbo.Users u ON u.Id=dp.UserId LEFT JOIN dbo.Specializations sp ON sp.Id=dp.SpecializationId LEFT JOIN dbo.Qualifications q ON q.Id=dp.QualificationId LEFT JOIN dbo.Departments dep ON dep.Id=dp.DepartmentId LEFT JOIN dbo.MedicalCouncils mc ON mc.Id=dp.MedicalCouncilId LEFT JOIN dbo.Countries co ON co.Id=dp.CountryId LEFT JOIN dbo.States st ON st.Id=dp.StateId WHERE (@status='all' OR dp.ApprovalStatus=@status) AND (@hid IS NULL OR dp.HospitalId=@hid) ORDER BY dp.CreatedAt DESC`,{status:{type:sql.NVarChar(20),value:statusFilter},hid:{type:sql.BigInt,value:hospitalId}});
    success(res,result.recordset);
  } catch(err){next(err);}
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /register/approve-doctor/:id
// Generates DT-1234 (4-digit zero-padded) on approval, stores it, emails it
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/approve-doctor/:id', authenticate, authorize('superadmin','admin'),
  [
    body('action').isIn(['approved','rejected','deferred']).withMessage('Invalid action'),
    body('rejectionReason').if(body('action').equals('rejected')).notEmpty().withMessage('Rejection reason required'),
  ],
  async (req, res, next) => {
    try {
      handleV(req);
      const { action, rejectionReason } = req.body;
      const doctorProfileId = parseInt(req.params.id);

      // ── Run add_doctorid_migration.sql before approving any doctor ──────────
      // DoctorId column is added by migration; SELECT uses COL_LENGTH guard so
      // query doesn't crash if migration was somehow skipped.
      const drRes = await query(
        `SELECT dp.Id, dp.UserId,
                CASE WHEN COL_LENGTH('dbo.DoctorProfiles','DoctorId') IS NOT NULL
                     THEN dp.DoctorId ELSE NULL END AS DoctorId,
                u.Email, u.FirstName, u.LastName, u.Username
         FROM dbo.DoctorProfiles dp
         JOIN dbo.Users u ON u.Id = dp.UserId
         WHERE dp.Id = @id`,
        { id: { type: sql.BigInt, value: doctorProfileId } }
      );
      const dr = drRes.recordset[0];
      if (!dr) throw new AppError('Doctor profile not found.', 404);

      if (action === 'approved') {
        // Generate DT-1234 format Doctor ID if not already assigned
        let doctorId = dr.DoctorId;
        if (!doctorId) {
          doctorId = await generateUniqueDoctorId();
        }

        await query(
          `UPDATE dbo.DoctorProfiles
           SET ApprovalStatus  = 'approved',
               ApprovedBy      = @by,
               ApprovedAt      = SYSUTCDATETIME(),
               RejectionReason = NULL,
               DoctorId        = @did
           WHERE Id = @id`,
          {
            by:  { type: sql.BigInt,       value: req.user.userId },
            did: { type: sql.NVarChar(30), value: doctorId },
            id:  { type: sql.BigInt,       value: doctorProfileId },
          }
        );

        // Activate the user account
        await query(
          `UPDATE dbo.Users SET IsActive = 1 WHERE Id = @uid`,
          { uid: { type: sql.BigInt, value: dr.UserId } }
        );

        // Send approval email with Doctor ID
        if (dr.Email) {
          sendDoctorApprovalEmail({
            to: dr.Email, name: dr.FirstName, username: dr.Username, doctorId,
          }).catch(err => console.error('Doctor approval email failed (non-fatal):', err.message));
        }

        console.log(`✅ Doctor approved: ${dr.Username} | DoctorId: ${doctorId}`);
        return success(res, { doctorId }, 'Doctor approved successfully.');
      }

      // Rejected or deferred
      await query(
        `UPDATE dbo.DoctorProfiles
         SET ApprovalStatus  = @status,
             ApprovedBy      = @by,
             ApprovedAt      = SYSUTCDATETIME(),
             RejectionReason = @reason
         WHERE Id = @id`,
        {
          status: { type: sql.NVarChar(20),  value: action },
          by:     { type: sql.BigInt,         value: req.user.userId },
          reason: { type: sql.NVarChar(1000), value: rejectionReason || null },
          id:     { type: sql.BigInt,         value: doctorProfileId },
        }
      );

      if (dr.Email) {
        if (action === 'rejected') {
          sendDoctorRejectionEmail({ to: dr.Email, name: dr.FirstName, reason: rejectionReason })
            .catch(err => console.error('Doctor rejection email failed (non-fatal):', err.message));
        } else if (action === 'deferred') {
          sendDoctorDeferredEmail({ to: dr.Email, name: dr.FirstName })
            .catch(err => console.error('Doctor deferred email failed (non-fatal):', err.message));
        }
      }

      console.log(`📋 Doctor ${action}: ${dr.Username}`);
      success(res, {}, `Doctor ${action} successfully.`);
    } catch (err) { next(err); }
  }
);

router.patch('/approve-staff/:id', authenticate, authorize('superadmin','admin'),
  [body('action').isIn(['approved','rejected']).withMessage('Invalid action'),body('rejectionReason').if(body('action').equals('rejected')).notEmpty().withMessage('Rejection reason required')],
  async(req,res,next)=>{
    try{handleV(req);const{action,rejectionReason}=req.body;const staffProfileId=parseInt(req.params.id);
      await query(`UPDATE dbo.StaffProfiles SET ApprovalStatus=@status,ApprovedBy=@by,ApprovedAt=SYSUTCDATETIME(),RejectionReason=@reason WHERE Id=@id`,{status:{type:sql.NVarChar(20),value:action},by:{type:sql.BigInt,value:req.user.userId},reason:{type:sql.NVarChar(1000),value:rejectionReason||null},id:{type:sql.BigInt,value:staffProfileId}});
      if(action==='approved')await query(`UPDATE dbo.Users SET IsActive=1 WHERE Id=(SELECT UserId FROM dbo.StaffProfiles WHERE Id=@id)`,{id:{type:sql.BigInt,value:staffProfileId}});
      success(res,{},`Staff member ${action} successfully.`);
    }catch(err){next(err);}
  }
);

// ── Check routes ──────────────────────────────────────────────────────────────
router.get('/check-email', async(req,res,next)=>{
  try{const email=(req.query.email||'').trim().toLowerCase();if(!email||!email.includes('@'))return success(res,{available:true});
    const result=await query(`SELECT Id FROM dbo.Users WHERE LOWER(Email)=@e AND DeletedAt IS NULL`,{e:{type:sql.NVarChar(255),value:email}});
    success(res,{available:result.recordset.length===0});
  }catch(err){next(err);}
});

router.get('/check-username', async(req,res,next)=>{
  try{const username=(req.query.username||'').trim().toLowerCase();if(!username||username.length<3)return success(res,{available:false,message:'Too short'});
    const result=await query(`SELECT Id FROM dbo.Users WHERE Username=@u AND DeletedAt IS NULL`,{u:{type:sql.NVarChar(80),value:username}});
    success(res,{available:result.recordset.length===0});
  }catch(err){next(err);}
});

router.get('/check-phone', async(req,res,next)=>{
  try{
    const raw=(req.query.phone||'').replace(/\D/g,'');
    if(!raw||raw.length<7) return success(res,{available:false});
    // Block leading 0 on check as well
    if(raw.startsWith('0')) return success(res,{available:false,message:'Phone cannot start with 0'});
    const result=await query(`SELECT Id FROM dbo.Users WHERE Phone=@p AND DeletedAt IS NULL`,{p:{type:sql.NVarChar(20),value:raw}});
    success(res,{available:result.recordset.length===0});
  }catch(err){next(err);}
});

module.exports = router;