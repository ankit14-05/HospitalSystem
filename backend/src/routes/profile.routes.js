const router = require('express').Router();
const controller = require('../controllers/profile.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/me', controller.getMyProfile);
router.put('/me', controller.updateMyProfile);

module.exports = router;
