const router = require('express').Router();
const controller = require('../controllers/profile.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/patient-profiles', authorize('patient'), controller.listPatientProfiles);
router.post('/patient-profiles/switch', authorize('patient'), controller.switchPatientProfile);
router.post('/patient-profiles', authorize('patient'), controller.addFamilyMember);
router.get('/me', controller.getMyProfile);
router.put('/me', controller.updateMyProfile);

module.exports = router;
