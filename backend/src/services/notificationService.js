// src/services/notificationService.js
// Creates in-app notifications stored in dbo.Notifications

const { getDb } = require('../config/database');

/**
 * Create a notification for a single user.
 * @param {object} params
 */
const createNotification = async ({
  hospitalId,
  userId,
  notifType,   // 'appointment' | 'lab_result' | 'prescription' | 'billing' | 'system' | 'alert' | 'reminder'
  title,
  body,
  link = null,
  dataJson = null,
}) => {
  try {
    const pool = await getDb();
    await pool.request()
      .input('HospitalId', hospitalId || null)
      .input('UserId',     userId)
      .input('NotifType',  notifType)
      .input('Title',      title)
      .input('Body',       body   || null)
      .input('Link',       link   || null)
      .input('DataJson',   dataJson ? JSON.stringify(dataJson) : null)
      .query(`
        INSERT INTO dbo.Notifications
          (HospitalId, UserId, NotifType, Title, Body, Link, DataJson)
        VALUES
          (@HospitalId, @UserId, @NotifType, @Title, @Body, @Link, @DataJson)
      `);
  } catch (err) {
    // Notifications are non-critical — log but don't crash the request
    console.error('⚠️  createNotification failed:', err.message);
  }
};

/**
 * Create notifications for multiple users at once.
 */
const createBulkNotifications = async (notifications) => {
  await Promise.allSettled(notifications.map(n => createNotification(n)));
};

/**
 * Mark one notification as read.
 */
const markRead = async (notificationId, userId) => {
  const pool = await getDb();
  await pool.request()
    .input('Id',     notificationId)
    .input('UserId', userId)
    .query(`
      UPDATE dbo.Notifications
      SET IsRead = 1, ReadAt = SYSUTCDATETIME()
      WHERE Id = @Id AND UserId = @UserId
    `);
};

/**
 * Mark all notifications for a user as read.
 */
const markAllRead = async (userId) => {
  const pool = await getDb();
  await pool.request()
    .input('UserId', userId)
    .query(`
      UPDATE dbo.Notifications
      SET IsRead = 1, ReadAt = SYSUTCDATETIME()
      WHERE UserId = @UserId AND IsRead = 0
    `);
};

/**
 * Get unread count for a user.
 */
const getUnreadCount = async (userId) => {
  const pool = await getDb();
  const r = await pool.request()
    .input('UserId', userId)
    .query(`SELECT COUNT(*) AS cnt FROM dbo.Notifications WHERE UserId = @UserId AND IsRead = 0`);
  return r.recordset[0]?.cnt || 0;
};

/**
 * Get paginated notifications for a user.
 */
const getUserNotifications = async (userId, page = 1, limit = 20) => {
  const pool   = await getDb();
  const offset = (page - 1) * limit;
  const r = await pool.request()
    .input('UserId', userId)
    .input('Limit',  limit)
    .input('Offset', offset)
    .query(`
      SELECT Id, NotifType, Title, Body, Link, DataJson, IsRead, ReadAt, CreatedAt
      FROM dbo.Notifications
      WHERE UserId = @UserId
      ORDER BY CreatedAt DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `);
  return r.recordset;
};

// ── Appointment-specific helpers ─────────────────────────────────────────────

const apptNotif = async ({ hospitalId, patientUserId, doctorUserId, title, body, link, appointmentNo }) => {
  await createBulkNotifications([
    { hospitalId, userId: patientUserId, notifType: 'appointment', title, body, link, dataJson: { appointmentNo } },
    doctorUserId
      ? { hospitalId, userId: doctorUserId, notifType: 'appointment', title: `[Doctor] ${title}`, body, link, dataJson: { appointmentNo } }
      : null,
  ].filter(Boolean));
};

const notifyBooked = (params) => apptNotif({
  ...params,
  title: `✅ Appointment Confirmed`,
  body:  `Your appointment on ${params.date} at ${params.time} with Dr. ${params.doctorName} is confirmed. Token: #${params.token || '—'}`,
  link:  '/appointments',
});

const notifyCancelled = (params) => apptNotif({
  ...params,
  title: `❌ Appointment Cancelled`,
  body:  `Appointment on ${params.date} at ${params.time} has been cancelled. ${params.cancelReason ? 'Reason: ' + params.cancelReason : ''}`,
  link:  '/appointments',
});

const notifyRescheduled = (params) => apptNotif({
  ...params,
  title: `🔄 Appointment Rescheduled`,
  body:  `Your appointment has been moved from ${params.oldDate} ${params.oldTime} to ${params.newDate} ${params.newTime}`,
  link:  '/appointments',
});

const notifyCompleted = (params) => apptNotif({
  ...params,
  title: `💚 Visit Completed`,
  body:  `Your consultation with Dr. ${params.doctorName} on ${params.date} is completed. Check your portal for prescriptions.`,
  link:  '/appointments',
});

const notifyMissed = (params) => createNotification({
  hospitalId: params.hospitalId,
  userId: params.patientUserId,
  notifType: 'appointment',
  title: 'Missed appointment',
  body: `You missed your appointment with Dr. ${params.doctorName} on ${params.date} at ${params.time}. Please book another available slot.`,
  link: '/appointments/book',
  dataJson: { appointmentNo: params.appointmentNo },
});

const notifyReminder = (params) => createNotification({
  hospitalId:  params.hospitalId,
  userId:      params.patientUserId,
  notifType:   'reminder',
  title:       `⏰ Appointment Reminder — Tomorrow`,
  body:        `You have an appointment with Dr. ${params.doctorName} tomorrow (${params.date}) at ${params.time}`,
  link:        '/appointments',
  dataJson:    { appointmentNo: params.appointmentNo },
});

module.exports = {
  createNotification,
  createBulkNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  getUserNotifications,
  notifyBooked,
  notifyCancelled,
  notifyRescheduled,
  notifyCompleted,
  notifyMissed,
  notifyReminder,
};
