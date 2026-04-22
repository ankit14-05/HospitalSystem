// src/validators/emr.validator.js
const { body, param } = require('express-validator');

// ── Medical History ────────────────────────────────────────────────────────────
const addMedicalHistoryRules = [
  param('patientId').isInt({ gt: 0 }).withMessage('patientId must be a positive integer'),
  body('conditionName')
    .notEmpty().withMessage('conditionName is required')
    .isLength({ max: 200 }).withMessage('conditionName max 200 chars'),
  body('icd10Code').optional().isLength({ max: 20 }),
  body('diagnosedDate').optional().isISO8601().withMessage('diagnosedDate must be a valid date'),
  body('status')
    .optional()
    .isIn(['Active', 'Resolved', 'Chronic']).withMessage("status must be Active | Resolved | Chronic"),
  body('notes').optional().isLength({ max: 5000 }),
];

// ── Diagnoses ──────────────────────────────────────────────────────────────────
const addDiagnosisRules = [
  param('patientId').isInt({ gt: 0 }),
  body('diagnosisName')
    .notEmpty().withMessage('diagnosisName is required')
    .isLength({ max: 300 }),
  body('icd10Code').optional().isLength({ max: 20 }),
  body('diagnosisType')
    .optional()
    .isIn(['Primary', 'Secondary', 'Differential']),
  body('severity').optional().isIn(['Mild', 'Moderate', 'Severe']),
  body('diagnosedDate')
    .notEmpty().withMessage('diagnosedDate is required')
    .isISO8601().withMessage('diagnosedDate must be a valid date'),
  body('status')
    .optional()
    .isIn(['Active', 'Resolved', 'Chronic', 'Under Observation']),
  body('notes').optional().isLength({ max: 5000 }),
  body('appointmentId').optional().isInt({ gt: 0 }),
];

// ── Clinical Notes ─────────────────────────────────────────────────────────────
const addClinicalNoteRules = [
  param('patientId').isInt({ gt: 0 }),
  body('noteType')
    .optional()
    .isIn(['SOAP', 'General', 'Referral', 'Discharge']),
  body('subjective').optional().isLength({ max: 5000 }),
  body('objective').optional().isLength({ max: 5000 }),
  body('assessment').optional().isLength({ max: 5000 }),
  body('plan').optional().isLength({ max: 5000 }),
  body('freeText').optional().isLength({ max: 5000 }),
  body('appointmentId').optional().isInt({ gt: 0 }),
];

// ── Allergies ──────────────────────────────────────────────────────────────────
const addAllergyRules = [
  param('patientId').isInt({ gt: 0 }),
  body('allergenName')
    .notEmpty().withMessage('allergenName is required')
    .isLength({ max: 200 }),
  body('allergyType')
    .optional()
    .isIn(['Drug', 'Food', 'Environmental', 'Other']),
  body('severity')
    .optional()
    .isIn(['Mild', 'Moderate', 'Severe', 'Life-threatening']),
  body('reaction').optional().isLength({ max: 500 }),
  body('onsetDate').optional().isISO8601(),
  body('notes').optional().isLength({ max: 2000 }),
];

const updateAllergyRules = [
  param('id').isInt({ gt: 0 }),
  body('isActive').optional().isBoolean(),
  body('severity')
    .optional()
    .isIn(['Mild', 'Moderate', 'Severe', 'Life-threatening']),
  body('reaction').optional().isLength({ max: 500 }),
  body('notes').optional().isLength({ max: 2000 }),
];

// ── Medication History ─────────────────────────────────────────────────────────
const addMedicationHistoryRules = [
  param('patientId').isInt({ gt: 0 }),
  body('medicineName')
    .notEmpty().withMessage('medicineName is required')
    .isLength({ max: 200 }),
  body('genericName').optional().isLength({ max: 200 }),
  body('dosage').optional().isLength({ max: 100 }),
  body('frequency').optional().isLength({ max: 100 }),
  body('route').optional().isLength({ max: 80 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('reason').optional().isLength({ max: 500 }),
  body('status').optional().isIn(['Active', 'Discontinued', 'Completed']),
  body('notes').optional().isLength({ max: 2000 }),
];

module.exports = {
  addMedicalHistoryRules,
  addDiagnosisRules,
  addClinicalNoteRules,
  addAllergyRules,
  updateAllergyRules,
  addMedicationHistoryRules,
};
