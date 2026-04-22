// src/controllers/emr.controller.js
const { validationResult } = require('express-validator');
const emrService = require('../services/emr.service');
const path = require('path');
const fs   = require('fs');

function validationFail(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  return null;
}

function parsePatientId(req) {
  return Number(req.params.patientId);
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/emr/:patientId/summary
// ─────────────────────────────────────────────────────────────
exports.getSummary = async (req, res, next) => {
  try {
    const data = await emrService.getEMRSummary(parsePatientId(req), req.user.hospitalId);
    if (!data) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// MEDICAL HISTORY
// ─────────────────────────────────────────────────────────────
exports.getMedicalHistory = async (req, res, next) => {
  try {
    const data = await emrService.getMedicalHistory(parsePatientId(req), req.user.hospitalId);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.addMedicalHistory = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const id = await emrService.addMedicalHistory(
      parsePatientId(req), req.user.hospitalId, req.body, req.user.id
    );
    res.status(201).json({ success: true, message: 'Medical history added', id });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// DIAGNOSES
// ─────────────────────────────────────────────────────────────
exports.getDiagnoses = async (req, res, next) => {
  try {
    const data = await emrService.getDiagnoses(parsePatientId(req), req.user.hospitalId);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.addDiagnosis = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const id = await emrService.addDiagnosis(
      parsePatientId(req), req.user.hospitalId, req.body, req.user.id
    );
    res.status(201).json({ success: true, message: 'Diagnosis added', id });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// CLINICAL NOTES
// ─────────────────────────────────────────────────────────────
exports.getClinicalNotes = async (req, res, next) => {
  try {
    const data = await emrService.getClinicalNotes(parsePatientId(req), req.user.hospitalId);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.addClinicalNote = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const id = await emrService.addClinicalNote(
      parsePatientId(req), req.user.hospitalId, req.body, req.user.id
    );
    res.status(201).json({ success: true, message: 'Clinical note added', id });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// ALLERGIES
// ─────────────────────────────────────────────────────────────
exports.getAllergies = async (req, res, next) => {
  try {
    const data = await emrService.getAllergies(parsePatientId(req), req.user.hospitalId);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.addAllergy = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const id = await emrService.addAllergy(
      parsePatientId(req), req.user.hospitalId, req.body, req.user.id
    );
    res.status(201).json({ success: true, message: 'Allergy added', id });
  } catch (err) { next(err); }
};

exports.updateAllergy = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const updated = await emrService.updateAllergy(
      Number(req.params.id), parsePatientId(req), req.body
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Allergy not found' });
    res.json({ success: true, message: 'Allergy updated' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// MEDICATION HISTORY
// ─────────────────────────────────────────────────────────────
exports.getMedicationHistory = async (req, res, next) => {
  try {
    const data = await emrService.getMedicationHistory(parsePatientId(req), req.user.hospitalId);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.addMedicationHistory = async (req, res, next) => {
  if (validationFail(req, res)) return;
  try {
    const id = await emrService.addMedicationHistory(
      parsePatientId(req), req.user.hospitalId, req.body, req.user.id
    );
    res.status(201).json({ success: true, message: 'Medication history added', id });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// PRESCRIPTIONS (read-only from existing table)
// ─────────────────────────────────────────────────────────────
exports.getPrescriptions = async (req, res, next) => {
  try {
    const data = await emrService.getPrescriptions(parsePatientId(req), req.user.hospitalId);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────
exports.getDocuments = async (req, res, next) => {
  try {
    const data = await emrService.getDocuments(parsePatientId(req), req.user.hospitalId);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

// POST /api/v1/emr/:patientId/documents  (multipart/form-data via multer)
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileData = {
      documentType: req.body.documentType || 'Other',
      fileName:     req.file.originalname,
      filePath:     req.file.path,
      fileSize:     req.file.size,
      mimeType:     req.file.mimetype,
      description:  req.body.description || null,
    };

    const id = await emrService.addDocument(
      parsePatientId(req), req.user.hospitalId, fileData, req.user.id
    );
    res.status(201).json({ success: true, message: 'Document uploaded', id });
  } catch (err) { next(err); }
};

exports.deleteDocument = async (req, res, next) => {
  try {
    const deleted = await emrService.deleteDocument(
      Number(req.params.id), parsePatientId(req)
    );
    if (!deleted) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, message: 'Document removed' });
  } catch (err) { next(err); }
};
