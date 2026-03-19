const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/admin/overview', authorize('superadmin', 'admin', 'auditor'), controller.getAdminOverview);
router.get('/opd/overview', authorize('superadmin', 'admin', 'receptionist', 'nurse', 'opdmanager', 'opd_manager'), controller.getOpdOverview);
router.get('/admin/people', authorize('superadmin', 'admin', 'auditor'), controller.getPeopleDirectory);

module.exports = router;
