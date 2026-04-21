// src/routes/appointment.routes.js
const router       = require('express').Router();
const ctrl         = require('../controllers/appointment.controller');
const v            = require('../validators/appointment.validator');
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const LAB_APPOINTMENT_VIEW_ROLES = ['labtech', 'lab_technician', 'lab_incharge', 'labincharge', 'Lab Incharge'];

// All routes require authentication
router.use(protect);

// ── Notifications (any authenticated user) ────────────────────────────────────
router.get   ('/notifications',          ctrl.getNotifications);
router.patch ('/notifications/read-all', ctrl.markAllRead);
router.patch ('/notifications/:id/read', ctrl.markOneRead);

// ── Appointment stats ─────────────────────────────────────────────────────────
router.get('/stats',
  authorize('admin', 'superadmin', 'doctor', 'receptionist', 'opdmanager', 'opd_manager', ...LAB_APPOINTMENT_VIEW_ROLES),
  ctrl.stats
);

// ── My appointments (patient / doctor view) ───────────────────────────────────
router.get('/filters',
  authorize('admin', 'superadmin', 'doctor', 'receptionist', 'nurse', 'opdmanager', 'opd_manager', ...LAB_APPOINTMENT_VIEW_ROLES),
  ctrl.filters
);

router.get('/my', ctrl.myAppointments);

// ── Doctor: today's OPD queue ─────────────────────────────────────────────────
// GET /appointments/my-queue?date=YYYY-MM-DD
router.get('/my-queue',
  authorize('doctor'),
  ctrl.myQueue
);

// ── Doctor: pending appointment requests ─────────────────────────────────────
// GET /appointments/pending-requests
router.get('/pending-requests',
  authorize('doctor'),
  ctrl.pendingRequests
);

// ── Available slots for a doctor on a date ───────────────────────────────────
// GET /appointments/slots?doctorId=X&date=YYYY-MM-DD
router.get('/slots', ctrl.getSlots);

// ── Send daily schedule to doctor (OPD Manager / Admin) ─────────────────────
router.post('/send-doctor-schedule',
  authorize('admin', 'superadmin', 'opdmanager', 'opd_manager'),
  ctrl.sendDailyScheduleEmail
);

// ── Book ──────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('admin', 'superadmin', 'receptionist', 'patient', 'opdmanager', 'opd_manager'),
  v.bookAppointment,
  ctrl.book
);

// ── List (admin / receptionist / doctor / opdmanager) ────────────────────────
router.get('/',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse', 'opdmanager', 'opd_manager', ...LAB_APPOINTMENT_VIEW_ROLES),
  ctrl.list
);

// ── Get one — MUST be after all named routes to avoid swallowing them ─────────
router.get('/:id',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse', 'patient', 'opdmanager', 'opd_manager', ...LAB_APPOINTMENT_VIEW_ROLES),
  ctrl.getOne
);

// ── Update status (confirm / complete / no-show) ─────────────────────────────
router.patch('/:id/status',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse', 'opdmanager', 'opd_manager'),
  v.updateStatus,
  ctrl.updateStatus
);

// ── Complete with notes ───────────────────────────────────────────────────────
router.patch('/:id/complete',
  authorize('doctor', 'admin', 'superadmin'),
  ctrl.completeAppointment
);

// ── Doctor queue: call patient in ─────────────────────────────────────────────
router.patch('/:id/call',
  authorize('doctor', 'admin', 'superadmin'),
  ctrl.callIn
);

// ── Cancel ────────────────────────────────────────────────────────────────────
router.patch('/:id/cancel',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse', 'patient', 'opdmanager', 'opd_manager'),
  ctrl.cancel
);

// ── Reschedule ────────────────────────────────────────────────────────────────
router.patch('/:id/reschedule',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse', 'patient', 'opdmanager', 'opd_manager'),
  v.reschedule,
  ctrl.reschedule
);

module.exports = router;
