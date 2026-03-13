// src/routes/appointment.routes.js
const router       = require('express').Router();
const ctrl         = require('../controllers/appointment.controller');
const v            = require('../validators/appointment.validator');
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// ── Notifications (any authenticated user) ───────────────────────────────────
router.get   ('/notifications',          ctrl.getNotifications);
router.patch ('/notifications/read-all', ctrl.markAllRead);
router.patch ('/notifications/:id/read', ctrl.markOneRead);

// ── Appointment stats ─────────────────────────────────────────────────────────
router.get('/stats', authorize('admin', 'superadmin', 'doctor', 'receptionist'), ctrl.stats);

// ── My appointments (patient / doctor view) ───────────────────────────────────
router.get('/my', ctrl.myAppointments);

// ── Book ─────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('admin', 'superadmin', 'receptionist', 'patient'),
  v.bookAppointment,
  ctrl.book
);

// ── List (admin / receptionist / doctor) ─────────────────────────────────────
router.get('/',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse'),
  ctrl.list
);

// ── Get one ───────────────────────────────────────────────────────────────────
router.get('/:id', ctrl.getOne);

// ── Update status (confirm / complete / no-show) ─────────────────────────────
router.patch('/:id/status',
  authorize('admin', 'superadmin', 'receptionist', 'doctor', 'nurse'),
  v.updateStatus,
  ctrl.updateStatus
);

// ── Cancel ────────────────────────────────────────────────────────────────────
router.patch('/:id/cancel', ctrl.cancel);     // patient, doctor, admin, receptionist

// ── Reschedule ────────────────────────────────────────────────────────────────
router.patch('/:id/reschedule',
  v.reschedule,
  ctrl.reschedule
);

module.exports = router;