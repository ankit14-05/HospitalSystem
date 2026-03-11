// src/services/emailService.js
// Nodemailer SMTP email service + Fast2SMS for phone OTP
//
// Required .env vars:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL
//   FAST2SMS_API_KEY  ← sign up at fast2sms.com → Dev API → copy key

const nodemailer = require('nodemailer');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ── SMTP transporter (lazy singleton) ────────────────────────────────────────
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
  return _transporter;
};

const verifyConnection = async () => {
  try {
    await getTransporter().verify();
    console.log('✅ SMTP connection verified');
  } catch (err) {
    console.error('❌ SMTP connection failed:', err.message);
  }
};

const sendEmail = async ({ to, subject, html, text }) => {
  const from = `"${process.env.SMTP_FROM_NAME || 'MediCore HMS'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`;
  const info = await getTransporter().sendMail({ from, to, subject, html, text });
  console.log(`📧 Email sent to ${to} — MessageId: ${info.messageId}`);
  return info;
};

// ═══════════════════════════════════════════════════════════════════════════════
// FAST2SMS — Send OTP via SMS
//
// Setup steps:
//   1. Go to https://www.fast2sms.com → Sign Up (free)
//   2. Dashboard → Dev API → copy your API key
//   3. Add to .env:  FAST2SMS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   4. Free plan gives ₹50 credit ≈ 200–300 SMS to Indian numbers
//
// The 'otp' route auto-uses Fast2SMS default OTP template:
//   "Your OTP is {otp}. Valid for 10 minutes. -Fast2SMS"
// No DLT registration required for dev/testing.
// ═══════════════════════════════════════════════════════════════════════════════
const sendOtpSms = async ({ phone, otp }) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) throw new Error('FAST2SMS_API_KEY not configured in .env');

  // Fast2SMS needs a clean 10-digit Indian number (no +91 prefix)
  const cleanPhone = String(phone).replace(/\D/g, '').replace(/^91/, '').slice(-10);
  if (cleanPhone.length !== 10) {
    throw new Error(`Invalid Indian phone number: "${phone}" → cleaned to "${cleanPhone}"`);
  }

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      'authorization': apiKey,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      route:            'q',      // OTP route — free, no DLT needed
      variables_values: otp,        // injected as {otp} in template
      numbers:          cleanPhone,
    }),
  });

  const data = await res.json();

  if (!data.return) {
    console.error('❌ Fast2SMS error response:', JSON.stringify(data));
    throw new Error(data.message || 'SMS delivery failed via Fast2SMS');
  }

  console.log(`📱 SMS OTP sent → ${cleanPhone} (request_id: ${data.request_id})`);
  return data;
};

// ── OTP Email Template ────────────────────────────────────────────────────────
const sendOtpEmail = async ({ to, name, otp, expiresMinutes = 10, purpose = 'password reset' }) => {
  const subject = `Your OTP for ${purpose} — MediCore HMS`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>OTP Verification</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                <span style="color:white;font-size:18px;font-weight:900;">M</span>
              </div>
              <span style="color:white;font-size:18px;font-weight:700;letter-spacing:-0.3px;">MediCore HMS</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Verification Code</p>
            <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">
              Hi ${name || 'there'}, use the OTP below to ${purpose}.
              It expires in <strong>${expiresMinutes} minutes</strong>.
            </p>

            <!-- OTP Box -->
            <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">Your OTP</p>
              <p style="margin:0;font-size:42px;font-weight:900;letter-spacing:16px;color:#4f46e5;font-family:'Courier New',monospace;">${otp}</p>
            </div>

            <!-- Warning -->
            <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:28px;">
              <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.5;">
                <strong>⚠️ Never share this OTP.</strong> MediCore HMS staff will never ask for your OTP.
                If you didn't request this, ignore this email.
              </p>
            </div>

            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
              This code will expire at <strong>${new Date(Date.now() + expiresMinutes * 60 * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</strong>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              © ${new Date().getFullYear()} MediCore HMS · This is an automated message, do not reply.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `
MediCore HMS — Verification Code

Hi ${name || 'there'},

Your OTP for ${purpose} is: ${otp}

This code expires in ${expiresMinutes} minutes.

Never share this OTP with anyone.
If you didn't request this, please ignore this email.

© ${new Date().getFullYear()} MediCore HMS
`.trim();

  return sendEmail({ to, subject, html, text });
};

// ── Password Changed Confirmation Email ───────────────────────────────────────
const sendPasswordChangedEmail = async ({ to, name }) => {
  const subject = 'Password Changed Successfully — MediCore HMS';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
            <span style="color:white;font-size:18px;font-weight:700;">MediCore HMS</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <div style="width:56px;height:56px;background:#d1fae5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
              <span style="font-size:28px;">✓</span>
            </div>
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;text-align:center;">Password Changed</p>
            <p style="margin:0 0 24px;font-size:14px;color:#64748b;text-align:center;line-height:1.6;">
              Hi ${name || 'there'}, your MediCore HMS password was successfully changed.
            </p>
            <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;">
              <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.5;">
                <strong>Wasn't you?</strong> Contact your hospital administrator immediately.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} MediCore HMS</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to, subject, html,
    text: `Hi ${name || 'there'}, your MediCore HMS password was changed successfully. If this wasn't you, contact your administrator.`,
  });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendOtpSms,
  sendPasswordChangedEmail,
  verifyConnection,
};