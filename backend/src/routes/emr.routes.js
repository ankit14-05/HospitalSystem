// src/routes/emr.routes.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const ctrl    = require('../controllers/emr.controller');
const {
  addMedicalHistoryRules,
  addDiagnosisRules,
  addClinicalNoteRules,
  addAllergyRules,
  updateAllergyRules,
  addMedicationHistoryRules,
} = require('../validators/emr.validator');

// All routes require authentication
router.use(protect);

// ── File Upload (Documents tab) ───────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/emr-documents');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
    const ext  = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('Only images, PDF and Office documents are allowed'));
  },
});

// ── Roles ─────────────────────────────────────────────────────────────────────
const CLINICAL_ROLES = ['superadmin', 'admin', 'doctor', 'nurse', 'auditor', 'opdmanager', 'opd_manager', 'patient'];
const WRITE_ROLES    = ['superadmin', 'admin', 'doctor', 'nurse'];
const ALL_ROLES      = [...CLINICAL_ROLES, 'receptionist', 'labtech', 'lab_technician',
                        'Lab Technician', 'Lab Assistant'];

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// GET /api/v1/emr/:patientId/summary
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/summary',
  authorize(...ALL_ROLES),
  ctrl.getSummary,
);

// ─────────────────────────────────────────────────────────────────────────────
// MEDICAL HISTORY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/medical-history',
  authorize(...ALL_ROLES),
  ctrl.getMedicalHistory,
);
router.post('/:patientId/medical-history',
  authorize(...WRITE_ROLES),
  addMedicalHistoryRules,
  ctrl.addMedicalHistory,
);

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/diagnoses',
  authorize(...ALL_ROLES),
  ctrl.getDiagnoses,
);
router.post('/:patientId/diagnoses',
  authorize(...WRITE_ROLES),
  addDiagnosisRules,
  ctrl.addDiagnosis,
);

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL NOTES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/clinical-notes',
  authorize(...CLINICAL_ROLES),
  ctrl.getClinicalNotes,
);
router.post('/:patientId/clinical-notes',
  authorize(...WRITE_ROLES),
  addClinicalNoteRules,
  ctrl.addClinicalNote,
);

// ─────────────────────────────────────────────────────────────────────────────
// ALLERGIES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/allergies',
  authorize(...ALL_ROLES),
  ctrl.getAllergies,
);
router.post('/:patientId/allergies',
  authorize(...WRITE_ROLES),
  addAllergyRules,
  ctrl.addAllergy,
);
router.put('/:patientId/allergies/:id',
  authorize(...WRITE_ROLES),
  updateAllergyRules,
  ctrl.updateAllergy,
);

// ─────────────────────────────────────────────────────────────────────────────
// MEDICATION HISTORY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/medication-history',
  authorize(...ALL_ROLES),
  ctrl.getMedicationHistory,
);
router.post('/:patientId/medication-history',
  authorize(...WRITE_ROLES),
  addMedicationHistoryRules,
  ctrl.addMedicationHistory,
);

// ─────────────────────────────────────────────────────────────────────────────
// PRESCRIPTIONS (read-only proxy onto existing Prescriptions table)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/prescriptions',
  authorize(...ALL_ROLES),
  ctrl.getPrescriptions,
);

// ─────────────────────────────────────────────────────────────────────────────
// LAB REPORTS (convenience — proxies to lab service)
// GET /api/v1/emr/:patientId/lab-reports
// ─────────────────────────────────────────────────────────────────────────────
const labService = require('../services/lab.service');
router.get('/:patientId/lab-reports', authorize(...ALL_ROLES), async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    // hospitalId may be null for patient accounts — pass whatever we have
    const hospitalId = req.user.hospitalId || null;
    const result = await labService.getPatientLabResults(
      Number(req.params.patientId),
      hospitalId,
      { page: Number(page), limit: Number(limit) },
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:patientId/documents',
  authorize(...ALL_ROLES),
  ctrl.getDocuments,
);
router.post('/:patientId/documents',
  authorize(...WRITE_ROLES, 'patient'),
  upload.single('file'),
  ctrl.uploadDocument,
);
router.delete('/:patientId/documents/:id',
  authorize(...WRITE_ROLES, 'patient'),
  ctrl.deleteDocument,
);

module.exports = router;
