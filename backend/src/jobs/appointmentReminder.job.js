// src/jobs/appointmentReminder.job.js
// Run this daily at 8 AM (cron: '0 8 * * *') using node-cron
// Sends reminder emails + notifications to patients with appointments tomorrow

const cron = require('node-cron');
const { getDb, sql } = require('../config/database');
const notifService = require('../services/notificationService');
const emailService = require('../services/appointmentEmailservice');

const sendTomorrowReminders = async () => {
  console.log('🔔 Running appointment reminder job…');

  try {
    const pool = await getDb();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const r = await pool.request()
      .input('Date', sql.Date, tomorrowStr)
      .query(`
        SELECT
          a.Id, a.HospitalId, a.AppointmentNo, a.AppointmentDate, a.AppointmentTime,
          a.TokenNumber,
          pp.FirstName AS PatientFirstName, pp.LastName AS PatientLastName,
          up.Email AS PatientEmail, up.Id AS PatientUserId,
          ud.FirstName AS DoctorFirstName, ud.LastName AS DoctorLastName,
          dept.Name AS DepartmentName
        FROM dbo.Appointments a
        JOIN dbo.PatientProfiles pp ON pp.Id = a.PatientId
        LEFT JOIN dbo.Users up      ON up.Id = pp.UserId
        JOIN dbo.DoctorProfiles dp  ON dp.Id = a.DoctorId
        JOIN dbo.Users ud           ON ud.Id = dp.UserId
        LEFT JOIN dbo.Departments dept ON dept.Id = a.DepartmentId
        WHERE a.AppointmentDate = @Date
          AND a.Status IN ('Scheduled', 'Confirmed')
      `);

    const appointments = r.recordset;
    console.log(`📅 Found ${appointments.length} appointments for tomorrow (${tomorrowStr})`);

    for (const appt of appointments) {
      const date = new Date(appt.AppointmentDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });

      // In-app notification
      if (appt.PatientUserId) {
        await notifService.notifyReminder({
          hospitalId:    appt.HospitalId,
          patientUserId: appt.PatientUserId,
          doctorName:    `${appt.DoctorFirstName} ${appt.DoctorLastName}`,
          date,
          time:          appt.AppointmentTime,
          appointmentNo: appt.AppointmentNo,
        });
      }

      // Email
      if (appt.PatientEmail) {
        emailService.sendReminderPatient({
          to:            appt.PatientEmail,
          patientName:   `${appt.PatientFirstName} ${appt.PatientLastName}`,
          doctorName:    `${appt.DoctorFirstName} ${appt.DoctorLastName}`,
          date,
          time:          appt.AppointmentTime,
          department:    appt.DepartmentName,
          token:         appt.TokenNumber,
          appointmentNo: appt.AppointmentNo,
        }).catch(e => console.error(`  ❌ Email failed for appt ${appt.Id}:`, e.message));
      }
    }

    console.log(`✅ Reminder job completed for ${appointments.length} appointments`);
  } catch (err) {
    console.error('❌ Reminder job failed:', err.message);
  }
};

// Schedule: every day at 8:00 AM
const scheduleReminderJob = () => {
  cron.schedule('0 8 * * *', sendTomorrowReminders, {
    timezone: 'Asia/Kolkata',
  });
  console.log('📅 Appointment reminder job scheduled (daily 8 AM IST)');
};

module.exports = { scheduleReminderJob, sendTomorrowReminders };