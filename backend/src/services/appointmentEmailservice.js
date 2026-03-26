// src/services/appointmentEmailService.js
// All appointment-related email notifications (patient + doctor)

const { sendEmail } = require('./emailService');

const BRAND = 'MediCore HMS';
const PURPLE = '#4f46e5';
const GREEN  = '#059669';
const RED    = '#dc2626';
const ORANGE = '#d97706';

// ── Shared layout wrapper ─────────────────────────────────────────────────────
const layout = (content, accentColor = PURPLE) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,${accentColor} 0%,#7c3aed 100%);padding:28px 40px;text-align:center;">
            <span style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;">🏥 ${BRAND}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">${content}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              © ${new Date().getFullYear()} ${BRAND} · Automated notification — do not reply
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Appointment detail card ───────────────────────────────────────────────────
const apptCard = ({ doctorName, patientName, date, time, department, visitType, token, reason }) => `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;margin:20px 0;">
  <tr>
    <td colspan="2" style="background:#4f46e510;padding:12px 20px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0;font-size:11px;font-weight:700;color:#6366f1;letter-spacing:2px;text-transform:uppercase;">Appointment Details</p>
    </td>
  </tr>
  ${[
    ['👨‍⚕️ Doctor',      `Dr. ${doctorName}`],
    ['🧑 Patient',      patientName],
    ['📅 Date',         date],
    ['🕐 Time',         time],
    ['🏥 Department',   department || '—'],
    ['📋 Visit Type',   visitType  || 'OPD'],
    token ? ['🎫 Token No.',    `#${token}`] : null,
    reason ? ['📝 Reason',       reason] : null,
  ].filter(Boolean).map(([k, v]) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 20px;font-size:13px;color:#64748b;width:40%;font-weight:500;">${k}</td>
      <td style="padding:10px 20px;font-size:13px;color:#0f172a;font-weight:600;">${v}</td>
    </tr>`).join('')}
</table>`;

// ─────────────────────────────────────────────────────────────────────────────
// 1. BOOKING CONFIRMED — Patient
// ─────────────────────────────────────────────────────────────────────────────
const sendBookingConfirmedPatient = async ({ to, patientName, doctorName, date, time, department, visitType, token, reason, appointmentNo }) => {
  const subject = `✅ Appointment Confirmed — ${date} at ${time} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Appointment Confirmed!</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Hi <strong>${patientName}</strong>, your appointment has been successfully booked.
      Please arrive <strong>15 minutes early</strong> with your ID and insurance documents.
    </p>
    ${apptCard({ doctorName, patientName, date, time, department, visitType, token, reason })}
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
        📌 Appointment No: <strong>${appointmentNo}</strong><br/>
        Please carry this reference number to the hospital.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Need to reschedule or cancel? Login to your patient portal or contact reception.</p>
  `;

  return sendEmail({ to, subject, html: layout(body, GREEN) });
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. BOOKING CONFIRMED — Doctor
// ─────────────────────────────────────────────────────────────────────────────
const sendBookingConfirmedDoctor = async ({ to, doctorName, patientName, date, time, department, visitType, token, reason, appointmentNo }) => {
  const subject = `📅 New Appointment — ${patientName} on ${date} at ${time} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">New Appointment Scheduled</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Dear <strong>Dr. ${doctorName}</strong>, a new appointment has been booked with you.
    </p>
    ${apptCard({ doctorName, patientName, date, time, department, visitType, token, reason })}
    <p style="margin:0;font-size:13px;color:#94a3b8;">Ref: <strong>${appointmentNo}</strong> · Log in to your doctor portal to view full patient details.</p>
  `;

  return sendEmail({ to, subject, html: layout(body, PURPLE) });
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. APPOINTMENT CANCELLED — Patient
// ─────────────────────────────────────────────────────────────────────────────
const sendCancelledPatient = async ({ to, patientName, doctorName, date, time, cancelReason, appointmentNo }) => {
  const subject = `❌ Appointment Cancelled — ${date} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Appointment Cancelled</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Hi <strong>${patientName}</strong>, your appointment with <strong>Dr. ${doctorName}</strong> on
      <strong>${date} at ${time}</strong> has been cancelled.
    </p>
    ${cancelReason ? `
    <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6;">
        <strong>Reason:</strong> ${cancelReason}
      </p>
    </div>` : ''}
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Ref: <strong>${appointmentNo}</strong></p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">You can book a new appointment from the patient portal anytime.</p>
  `;

  return sendEmail({ to, subject, html: layout(body, RED) });
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. APPOINTMENT CANCELLED — Doctor
// ─────────────────────────────────────────────────────────────────────────────
const sendCancelledDoctor = async ({ to, doctorName, patientName, date, time, cancelReason, appointmentNo }) => {
  const subject = `❌ Appointment Cancelled — ${patientName} on ${date} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Appointment Cancelled</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Dear <strong>Dr. ${doctorName}</strong>, the following appointment has been cancelled.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin:0 0 20px;">
      ${[
        ['Patient', patientName],
        ['Date', date],
        ['Time', time],
        ['Ref No.', appointmentNo],
        cancelReason ? ['Reason', cancelReason] : null,
      ].filter(Boolean).map(([k, v]) => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 20px;font-size:13px;color:#64748b;width:35%;">${k}</td>
          <td style="padding:10px 20px;font-size:13px;color:#0f172a;font-weight:600;">${v}</td>
        </tr>`).join('')}
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Your schedule has been updated accordingly.</p>
  `;

  return sendEmail({ to, subject, html: layout(body, RED) });
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. APPOINTMENT RESCHEDULED — Patient
// ─────────────────────────────────────────────────────────────────────────────
const sendRescheduledPatient = async ({ to, patientName, doctorName, oldDate, oldTime, newDate, newTime, appointmentNo }) => {
  const subject = `🔄 Appointment Rescheduled — Now ${newDate} at ${newTime} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Appointment Rescheduled</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Hi <strong>${patientName}</strong>, your appointment with <strong>Dr. ${doctorName}</strong> has been rescheduled.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="width:48%;vertical-align:top;">
          <div style="background:#fff7ed;border-radius:12px;padding:16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#d97706;letter-spacing:1.5px;text-transform:uppercase;">Old Schedule</p>
            <p style="margin:0;font-size:16px;font-weight:800;color:#9a3412;">${oldDate}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#9a3412;">${oldTime}</p>
          </div>
        </td>
        <td style="width:4%;text-align:center;vertical-align:middle;font-size:20px;">→</td>
        <td style="width:48%;vertical-align:top;">
          <div style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#16a34a;letter-spacing:1.5px;text-transform:uppercase;">New Schedule</p>
            <p style="margin:0;font-size:16px;font-weight:800;color:#166534;">${newDate}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#166534;">${newTime}</p>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Ref: <strong>${appointmentNo}</strong></p>
  `;

  return sendEmail({ to, subject, html: layout(body, ORANGE) });
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. APPOINTMENT RESCHEDULED — Doctor
// ─────────────────────────────────────────────────────────────────────────────
const sendRescheduledDoctor = async ({ to, doctorName, patientName, oldDate, oldTime, newDate, newTime, appointmentNo }) => {
  const subject = `🔄 Appointment Rescheduled — ${patientName} now ${newDate} at ${newTime} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Appointment Rescheduled</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Dear <strong>Dr. ${doctorName}</strong>, the following appointment has been rescheduled.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="width:48%;vertical-align:top;">
          <div style="background:#fff7ed;border-radius:12px;padding:16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#d97706;letter-spacing:1.5px;text-transform:uppercase;">Old</p>
            <p style="margin:0;font-size:15px;font-weight:800;color:#9a3412;">${oldDate} ${oldTime}</p>
          </div>
        </td>
        <td style="width:4%;text-align:center;vertical-align:middle;font-size:20px;">→</td>
        <td style="width:48%;vertical-align:top;">
          <div style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#16a34a;letter-spacing:1.5px;text-transform:uppercase;">New</p>
            <p style="margin:0;font-size:15px;font-weight:800;color:#166534;">${newDate} ${newTime}</p>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Patient: <strong>${patientName}</strong></p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Ref: <strong>${appointmentNo}</strong></p>
  `;

  return sendEmail({ to, subject, html: layout(body, ORANGE) });
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. APPOINTMENT REMINDER — Patient (send 24h before)
// ─────────────────────────────────────────────────────────────────────────────
const sendReminderPatient = async ({ to, patientName, doctorName, date, time, department, token, appointmentNo }) => {
  const subject = `⏰ Reminder: Appointment Tomorrow — ${date} at ${time} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Appointment Reminder</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Hi <strong>${patientName}</strong>, this is a reminder for your appointment <strong>tomorrow</strong>.
      Please ensure you arrive 15 minutes early.
    </p>
    ${apptCard({ doctorName, patientName, date, time, department, token })}
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 16px;">
      <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
        📋 <strong>What to bring:</strong> Government ID, Insurance card, Previous prescriptions, Test reports
      </p>
    </div>
  `;

  return sendEmail({ to, subject, html: layout(body, '#3b82f6') });
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. APPOINTMENT COMPLETED — Patient
// ─────────────────────────────────────────────────────────────────────────────
const sendCompletedPatient = async ({ to, patientName, doctorName, date, appointmentNo }) => {
  const subject = `✅ Visit Summary — ${date} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Visit Completed</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Hi <strong>${patientName}</strong>, your consultation with <strong>Dr. ${doctorName}</strong> on
      <strong>${date}</strong> has been marked as completed. We hope you're feeling better!
    </p>
    <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin:0 0 20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:32px;">💚</p>
      <p style="margin:0;font-size:14px;color:#166534;font-weight:600;">Thank you for visiting ${BRAND}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#4ade80;">Ref: ${appointmentNo}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Your prescription and reports (if any) are available in your patient portal.
      Please follow your doctor's instructions carefully.
    </p>
  `;

  return sendEmail({ to, subject, html: layout(body, GREEN) });
};

const sendMissedPatient = async ({ to, patientName, doctorName, date, time, appointmentNo }) => {
  const subject = `Missed appointment — ${date} at ${time} | ${BRAND}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Appointment missed</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Hi <strong>${patientName}</strong>, our OPD desk marked your appointment with
      <strong>Dr. ${doctorName}</strong> on <strong>${date} at ${time}</strong> as missed.
    </p>
    <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6;">
        Please log in and choose another available slot if you still need the consultation.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Reference: <strong>${appointmentNo}</strong></p>
  `;

  return sendEmail({ to, subject, html: layout(body, ORANGE) });
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. DAILY SCHEDULE — Doctor
// ─────────────────────────────────────────────────────────────────────────────
const sendDoctorDailyScheduleEmail = async ({ to, doctorName, date, appointments = [] }) => {
  const subject = `📅 Your OPD Schedule for Today — ${date} | ${BRAND}`;
  
  const appointmentsHtml = appointments.length === 0 
    ? '<p style="font-size:14px;color:#64748b;font-style:italic;">You have no scheduled appointments for today yet.</p>'
    : `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr style="background:#f8fafc;">
          <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Time</th>
          <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Patient</th>
          <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Token</th>
          <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Type</th>
        </tr>
        ${appointments.map((a, i) => `
          <tr style="${i % 2 === 0 ? 'background:#ffffff;' : 'background:#f8fafc;'}">
            <td style="padding:10px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0;">${String(a.AppointmentTime || '--').slice(0,5)}${a.EndTime ? ` - ${String(a.EndTime).slice(0,5)}` : ''}</td>
            <td style="padding:10px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0;">${a.PatientName || 'Unnamed'}</td>
            <td style="padding:10px;font-size:13px;color:#3b82f6;font-family:monospace;border-bottom:1px solid #e2e8f0;">#${a.TokenNumber || '--'}</td>
            <td style="padding:10px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">${a.VisitType}</td>
          </tr>
        `).join('')}
      </table>`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a;">Today's OPD Schedule</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
      Good morning <strong>Dr. ${doctorName}</strong>, here is your OPD schedule for <strong>${date}</strong>.
      <br/>Total Appointments: <span style="font-weight:700;color:#4f46e5;">${appointments.length}</span>
    </p>
    ${appointmentsHtml}
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Log in to the portal to manage your queue and view detailed patient records.</p>
  `;

  return sendEmail({ to, subject, html: layout(body, PURPLE) });
};

module.exports = {
  sendBookingConfirmedPatient,
  sendBookingConfirmedDoctor,
  sendCancelledPatient,
  sendCancelledDoctor,
  sendRescheduledPatient,
  sendRescheduledDoctor,
  sendReminderPatient,
  sendCompletedPatient,
};
// ─────────────────────────────────────────────────────────────────────────────
// 9. TOKEN CONFIRMATION — Patient (detailed, professional)
// ─────────────────────────────────────────────────────────────────────────────
const sendTokenConfirmation = async ({
  to, patientName, doctorName, specialization, department,
  date, time, token, appointmentNo, visitType, reason, fee,
  hospitalName = BRAND,
}) => {
  const subject = `🎫 Token #${token} Confirmed — ${date} at ${time} | ${hospitalName}`;

  const body = `
    <p style="margin:0 0 4px;font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">
      Appointment Confirmed! 🎉
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.7;">
      Hello <strong>${patientName}</strong>, your appointment has been booked successfully.
      Your details are below.
    </p>

    <!-- Token highlight -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:linear-gradient(135deg,#0d9488,#0891b2);border-radius:16px;padding:28px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;">Your Token Number</p>
          <p style="margin:0;font-size:64px;font-weight:900;color:#ffffff;line-height:1;font-family:Georgia,serif;">${token}</p>
          <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.6);font-family:monospace;">Ref: ${appointmentNo}</p>
        </td>
      </tr>
    </table>

    <!-- Appointment details table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin:0 0 24px;">
      <tr>
        <td colspan="2" style="background:#0d948808;padding:12px 20px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;font-weight:700;color:#0d9488;letter-spacing:2px;text-transform:uppercase;">Appointment Details</p>
        </td>
      </tr>
      ${[
        ['👨‍⚕️ Doctor',     `Dr. ${doctorName}`],
        ['🔬 Specialization', specialization || 'Specialist'],
        department ? ['🏥 Department',  department] : null,
        ['📅 Date',          date],
        ['⏰ Time',           time],
        visitType ? ['🩺 Visit Type',   visitType] : null,
        reason    ? ['📋 Reason',       reason]    : null,
        fee       ? ['💰 Fee',          `₹${fee}`] : null,
      ].filter(Boolean).map(([label, val], i) => `
        <tr style="${i % 2 === 0 ? '' : 'background:#f1f5f9;'}">
          <td style="padding:11px 20px;font-size:12px;color:#64748b;width:40%;">${label}</td>
          <td style="padding:11px 20px;font-size:13px;font-weight:600;color:#1e293b;">${val}</td>
        </tr>
      `).join('')}
    </table>

    <!-- What to bring -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;margin:0 0 20px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1e40af;">📋 What to bring</p>
          <table cellpadding="0" cellspacing="0">
            ${['Government-issued ID (Aadhaar / PAN / Passport)', 'Insurance card or health policy document', 'Previous prescriptions or medical records', 'Any recent test reports or scans'].map(item => `
            <tr>
              <td style="padding:3px 0;font-size:12px;color:#3b82f6;">✓&nbsp;</td>
              <td style="padding:3px 0;font-size:12px;color:#1e3a8a;">${item}</td>
            </tr>`).join('')}
          </table>
        </td>
      </tr>
    </table>

    <!-- Reminder -->
    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 10px 10px 0;padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;line-height:1.6;">
        ⏰ <strong>Reminder:</strong> Please arrive at least <strong>15 minutes early</strong> to complete registration formalities.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
      Need to cancel or reschedule? Log in to your patient portal or contact the hospital reception.
    </p>
  `;

  return sendEmail({ to, subject, html: layout(body, '#0d9488') });
};

module.exports = {
  sendBookingConfirmedPatient,
  sendBookingConfirmedDoctor,
  sendCancelledPatient,
  sendCancelledDoctor,
  sendRescheduledPatient,
  sendRescheduledDoctor,
  sendReminderPatient,
  sendCompletedPatient,
  sendMissedPatient,
  sendTokenConfirmation,
  sendDoctorDailyScheduleEmail,
};
