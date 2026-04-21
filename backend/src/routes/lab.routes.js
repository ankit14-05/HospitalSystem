const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/lab.controller');
const {
  createLabOrderRules,
  updateOrderStatusRules,
  enterResultRules,
} = require('../validators/lab.validator');
const upload = require('../middleware/upload.middleware');

const signatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(__dirname, '../../uploads/lab/signatures');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `sig-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const signatureUpload = multer({ storage: signatureStorage });

router.use(protect);

const CLINICAL_ROLES = ['superadmin', 'admin', 'doctor', 'nurse', 'auditor', 'opdmanager', 'opd_manager'];
const LAB_TECH_ROLES = ['superadmin', 'admin', 'labtech', 'lab_technician', 'Lab Technician', 'Lab Assistant'];
const LAB_INCHARGE_ROLES = ['superadmin', 'admin', 'lab_incharge', 'labincharge', 'Lab Incharge'];
const PATIENT_ACCESS = [...CLINICAL_ROLES, ...LAB_TECH_ROLES, ...LAB_INCHARGE_ROLES, 'patient', 'receptionist'];

router.get('/tests', authorize(...PATIENT_ACCESS), ctrl.getLabTests);
router.post('/tests', authorize(...CLINICAL_ROLES), ctrl.createLabTest);
router.delete('/tests/:id', authorize(...CLINICAL_ROLES), ctrl.deleteLabTest);
router.get('/labs', authorize(...PATIENT_ACCESS), ctrl.getLabs);

router.get('/orders', authorize(...CLINICAL_ROLES, ...LAB_TECH_ROLES), ctrl.getLabOrders);
router.get('/next-sample-id', authorize(...LAB_TECH_ROLES), ctrl.getNextSampleId);
router.post('/orders',
  authorize('superadmin', 'admin', 'doctor', 'nurse', 'receptionist', 'opdmanager', 'opd_manager'),
  createLabOrderRules,
  ctrl.createLabOrder);
router.get('/orders/patient/:patientId', authorize(...PATIENT_ACCESS), ctrl.getPatientOrders);
router.get('/orders/:orderId', authorize(...CLINICAL_ROLES, ...LAB_TECH_ROLES, ...LAB_INCHARGE_ROLES), ctrl.getLabOrderById);
router.patch('/orders/:orderId/status', authorize(...LAB_TECH_ROLES), updateOrderStatusRules, ctrl.updateOrderStatus);
router.patch('/orders/:orderId/items/:itemId/result', authorize(...LAB_TECH_ROLES), enterResultRules, ctrl.enterTestResult);
router.get('/results/:patientId', authorize(...PATIENT_ACCESS), ctrl.getPatientLabResults);
router.post('/orders/:orderId/attachments', authorize(...LAB_TECH_ROLES), upload.array('files', 10), ctrl.uploadAttachments);
router.delete('/attachments/:id', authorize(...LAB_TECH_ROLES), ctrl.deleteAttachment);

router.get('/rooms', authorize(...LAB_TECH_ROLES, ...CLINICAL_ROLES, ...LAB_INCHARGE_ROLES), ctrl.getLabRooms);
router.get('/my-assignment', authorize(...LAB_TECH_ROLES), ctrl.getMyAssignment);
router.get('/my-transfers', authorize(...LAB_TECH_ROLES), ctrl.getMyTransfers);
router.get('/pending-transfers', authorize('superadmin', 'admin'), ctrl.getPending);
router.post('/approve-transfer', authorize('superadmin', 'admin'), ctrl.approveTransfer);
router.post('/reject-transfer', authorize('superadmin', 'admin'), ctrl.rejectTransfer);
router.post('/assign-room', authorize('superadmin', 'admin', 'labtech', 'lab_technician'), ctrl.changeRoom);
router.post('/rooms', authorize('superadmin', 'admin'), ctrl.createRoom);
router.delete('/rooms/:id', authorize('superadmin', 'admin'), ctrl.deleteRoom);

router.get('/autofill-rules', authorize(...CLINICAL_ROLES, ...LAB_TECH_ROLES, ...LAB_INCHARGE_ROLES), ctrl.getLabAutofillRules);
router.post('/autofill-rules', authorize('superadmin', 'admin'), ctrl.createLabAutofillRule);
router.delete('/autofill-rules/:id', authorize('superadmin', 'admin'), ctrl.deleteLabAutofillRule);

router.get('/pending-approvals', authorize(...LAB_INCHARGE_ROLES), ctrl.getPendingApprovals);
router.post('/orders/:id/approve', authorize(...LAB_INCHARGE_ROLES), ctrl.approveLabOrder);
router.post('/orders/:id/reject', authorize(...LAB_INCHARGE_ROLES), ctrl.rejectLabOrder);

router.get('/signature-settings', authorize(...LAB_INCHARGE_ROLES), ctrl.getSignatureSettings);
router.post('/signature-settings', authorize(...LAB_INCHARGE_ROLES), signatureUpload.single('signatureImage'), ctrl.updateSignatureSettings);

module.exports = router;
