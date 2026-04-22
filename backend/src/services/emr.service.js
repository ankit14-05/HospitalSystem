// src/services/emr.service.js
const { query, sql } = require('../config/database');

// ─────────────────────────────────────────────────────────────
// EMR SUMMARY (vitals from PatientProfiles)
// ─────────────────────────────────────────────────────────────
async function getEMRSummary(patientId, hospitalId) {
  const q = `
    SELECT
      p.Id, p.UHID, p.FirstName, p.LastName, p.Gender,
      p.DateOfBirth,
      DATEDIFF(YEAR, p.DateOfBirth, GETDATE()) -
        CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.DateOfBirth, GETDATE()), p.DateOfBirth) > GETDATE() THEN 1 ELSE 0 END AS Age,
      p.BloodGroup, p.Phone, p.Email,
      p.KnownAllergies, p.ChronicConditions, p.CurrentMedications,
      p.InsuranceProvider, p.InsurancePolicyNo, p.InsuranceValidUntil,
      (SELECT COUNT(*) FROM dbo.EMRMedicalHistory  mh WHERE mh.PatientId = p.Id AND mh.DeletedAt IS NULL)             AS MedicalHistoryCount,
      (SELECT COUNT(*) FROM dbo.EMRDiagnoses        d  WHERE d.PatientId  = p.Id AND d.DeletedAt  IS NULL)             AS DiagnosesCount,
      (SELECT COUNT(*) FROM dbo.EMRAllergies         a  WHERE a.PatientId  = p.Id AND a.IsActive = 1)                  AS ActiveAllergyCount,
      (SELECT COUNT(*) FROM dbo.LabOrders            lo WHERE lo.PatientId = p.Id AND lo.HospitalId = p.HospitalId)    AS LabOrderCount,
      (SELECT COUNT(*) FROM dbo.Prescriptions        rx WHERE rx.PatientId = p.Id AND rx.HospitalId = p.HospitalId)    AS PrescriptionCount
    FROM dbo.PatientProfiles p
    WHERE p.Id = @patientId AND p.HospitalId = @hospitalId AND p.DeletedAt IS NULL
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  return result.recordset[0] || null;
}

// ─────────────────────────────────────────────────────────────
// MEDICAL HISTORY
// ─────────────────────────────────────────────────────────────
async function getMedicalHistory(patientId, hospitalId) {
  const q = `
    SELECT
      mh.Id, mh.ConditionName, mh.ICD10Code, mh.DiagnosedDate,
      mh.Status, mh.Notes, mh.CreatedAt, mh.UpdatedAt,
      u.FirstName + ' ' + u.LastName AS EnteredByName
    FROM dbo.EMRMedicalHistory mh
    LEFT JOIN dbo.Users u ON u.Id = mh.EnteredBy
    WHERE mh.PatientId = @patientId AND mh.HospitalId = @hospitalId
      AND mh.DeletedAt IS NULL
    ORDER BY mh.DiagnosedDate DESC, mh.CreatedAt DESC
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  return result.recordset;
}

async function addMedicalHistory(patientId, hospitalId, data, enteredBy) {
  const q = `
    INSERT INTO dbo.EMRMedicalHistory
      (PatientId, HospitalId, ConditionName, ICD10Code, DiagnosedDate, Status, Notes, EnteredBy, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES
      (@patientId, @hospitalId, @conditionName, @icd10Code, @diagnosedDate, @status, @notes, @enteredBy, GETUTCDATE(), GETUTCDATE())
  `;
  const result = await query(q, {
    patientId:     { type: sql.BigInt,       value: patientId },
    hospitalId:    { type: sql.BigInt,       value: hospitalId },
    conditionName: { type: sql.NVarChar(200),value: data.conditionName },
    icd10Code:     { type: sql.NVarChar(20), value: data.icd10Code    || null },
    diagnosedDate: { type: sql.Date,         value: data.diagnosedDate || null },
    status:        { type: sql.NVarChar(20), value: data.status        || 'Active' },
    notes:         { type: sql.NVarChar(sql.MAX), value: data.notes   || null },
    enteredBy:     { type: sql.BigInt,       value: enteredBy },
  });
  return result.recordset[0].Id;
}

// ─────────────────────────────────────────────────────────────
// DIAGNOSES
// ─────────────────────────────────────────────────────────────
async function getDiagnoses(patientId, hospitalId) {
  const q = `
    SELECT
      d.Id, d.DiagnosisName, d.ICD10Code, d.DiagnosisType, d.Severity,
      d.DiagnosedDate, d.Status, d.Notes, d.AppointmentId, d.CreatedAt,
      u.FirstName + ' ' + u.LastName AS DoctorName
    FROM dbo.EMRDiagnoses d
    LEFT JOIN dbo.Users u ON u.Id = d.DoctorId
    WHERE d.PatientId = @patientId AND d.HospitalId = @hospitalId
      AND d.DeletedAt IS NULL
    ORDER BY d.DiagnosedDate DESC, d.CreatedAt DESC
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  return result.recordset;
}

async function addDiagnosis(patientId, hospitalId, data, doctorId) {
  const q = `
    INSERT INTO dbo.EMRDiagnoses
      (PatientId, HospitalId, DoctorId, AppointmentId, DiagnosisName, ICD10Code,
       DiagnosisType, Severity, DiagnosedDate, Status, Notes, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES
      (@patientId, @hospitalId, @doctorId, @appointmentId, @diagnosisName, @icd10Code,
       @diagnosisType, @severity, @diagnosedDate, @status, @notes, GETUTCDATE(), GETUTCDATE())
  `;
  const result = await query(q, {
    patientId:     { type: sql.BigInt,        value: patientId },
    hospitalId:    { type: sql.BigInt,        value: hospitalId },
    doctorId:      { type: sql.BigInt,        value: doctorId },
    appointmentId: { type: sql.BigInt,        value: data.appointmentId || null },
    diagnosisName: { type: sql.NVarChar(300), value: data.diagnosisName },
    icd10Code:     { type: sql.NVarChar(20),  value: data.icd10Code     || null },
    diagnosisType: { type: sql.NVarChar(20),  value: data.diagnosisType || 'Primary' },
    severity:      { type: sql.NVarChar(20),  value: data.severity      || null },
    diagnosedDate: { type: sql.Date,          value: data.diagnosedDate },
    status:        { type: sql.NVarChar(30),  value: data.status        || 'Active' },
    notes:         { type: sql.NVarChar(sql.MAX), value: data.notes     || null },
  });
  return result.recordset[0].Id;
}

// ─────────────────────────────────────────────────────────────
// CLINICAL NOTES
// ─────────────────────────────────────────────────────────────
async function getClinicalNotes(patientId, hospitalId) {
  const q = `
    SELECT
      n.[Id], n.[NoteType], n.[Subjective], n.[Objective], n.[Assessment],
      n.[Plan], n.[FreeText], n.[AppointmentId], n.[CreatedAt], n.[UpdatedAt],
      u.FirstName + ' ' + u.LastName AS DoctorName
    FROM dbo.EMRClinicalNotes n
    LEFT JOIN dbo.Users u ON u.Id = n.DoctorId
    WHERE n.PatientId = @patientId AND n.HospitalId = @hospitalId
      AND n.DeletedAt IS NULL
    ORDER BY n.CreatedAt DESC
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  return result.recordset;
}

async function addClinicalNote(patientId, hospitalId, data, doctorId) {
  const q = `
    INSERT INTO dbo.EMRClinicalNotes
      (PatientId, HospitalId, DoctorId, AppointmentId, NoteType,
       Subjective, Objective, Assessment, [Plan], FreeText, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES
      (@patientId, @hospitalId, @doctorId, @appointmentId, @noteType,
       @subjective, @objective, @assessment, @plan, @freeText, GETUTCDATE(), GETUTCDATE())
  `;
  const result = await query(q, {
    patientId:     { type: sql.BigInt,       value: patientId },
    hospitalId:    { type: sql.BigInt,       value: hospitalId },
    doctorId:      { type: sql.BigInt,       value: doctorId },
    appointmentId: { type: sql.BigInt,       value: data.appointmentId || null },
    noteType:      { type: sql.NVarChar(20), value: data.noteType      || 'General' },
    subjective:    { type: sql.NVarChar(sql.MAX), value: data.subjective  || null },
    objective:     { type: sql.NVarChar(sql.MAX), value: data.objective   || null },
    assessment:    { type: sql.NVarChar(sql.MAX), value: data.assessment  || null },
    plan:          { type: sql.NVarChar(sql.MAX), value: data.plan        || null },
    freeText:      { type: sql.NVarChar(sql.MAX), value: data.freeText    || null },
  });
  return result.recordset[0].Id;
}

// ─────────────────────────────────────────────────────────────
// ALLERGIES
// ─────────────────────────────────────────────────────────────
async function getAllergies(patientId, hospitalId) {
  const q = `
    SELECT
      a.Id, a.AllergenName, a.AllergyType, a.Severity, a.Reaction,
      a.OnsetDate, a.IsActive, a.Notes, a.CreatedAt, a.UpdatedAt,
      u.FirstName + ' ' + u.LastName AS EnteredByName
    FROM dbo.EMRAllergies a
    LEFT JOIN dbo.Users u ON u.Id = a.EnteredBy
    WHERE a.PatientId = @patientId AND a.HospitalId = @hospitalId
    ORDER BY a.IsActive DESC, a.Severity DESC, a.CreatedAt DESC
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  return result.recordset;
}

async function addAllergy(patientId, hospitalId, data, enteredBy) {
  const q = `
    INSERT INTO dbo.EMRAllergies
      (PatientId, HospitalId, AllergenName, AllergyType, Severity,
       Reaction, OnsetDate, IsActive, Notes, EnteredBy, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES
      (@patientId, @hospitalId, @allergenName, @allergyType, @severity,
       @reaction, @onsetDate, 1, @notes, @enteredBy, GETUTCDATE(), GETUTCDATE())
  `;
  const result = await query(q, {
    patientId:   { type: sql.BigInt,        value: patientId },
    hospitalId:  { type: sql.BigInt,        value: hospitalId },
    allergenName:{ type: sql.NVarChar(200), value: data.allergenName },
    allergyType: { type: sql.NVarChar(30),  value: data.allergyType  || 'Drug' },
    severity:    { type: sql.NVarChar(30),  value: data.severity     || 'Mild' },
    reaction:    { type: sql.NVarChar(500), value: data.reaction     || null },
    onsetDate:   { type: sql.Date,          value: data.onsetDate    || null },
    notes:       { type: sql.NVarChar(sql.MAX), value: data.notes    || null },
    enteredBy:   { type: sql.BigInt,        value: enteredBy },
  });
  return result.recordset[0].Id;
}

async function updateAllergy(allergyId, patientId, data) {
  const q = `
    UPDATE dbo.EMRAllergies
    SET IsActive    = COALESCE(@isActive, IsActive),
        Severity    = COALESCE(@severity, Severity),
        Reaction    = COALESCE(@reaction, Reaction),
        Notes       = COALESCE(@notes, Notes),
        UpdatedAt   = GETUTCDATE()
    WHERE Id = @allergyId AND PatientId = @patientId
  `;
  const result = await query(q, {
    allergyId: { type: sql.BigInt,        value: allergyId },
    patientId: { type: sql.BigInt,        value: patientId },
    isActive:  { type: sql.Bit,           value: data.isActive ?? null },
    severity:  { type: sql.NVarChar(30),  value: data.severity  || null },
    reaction:  { type: sql.NVarChar(500), value: data.reaction  || null },
    notes:     { type: sql.NVarChar(sql.MAX), value: data.notes || null },
  });
  return result.rowsAffected[0] > 0;
}

// ─────────────────────────────────────────────────────────────
// MEDICATION HISTORY
// ─────────────────────────────────────────────────────────────
async function getMedicationHistory(patientId, hospitalId) {
  const q = `
    SELECT
      m.Id, m.MedicineName, m.GenericName, m.Dosage, m.Frequency,
      m.Route, m.StartDate, m.EndDate, m.Reason, m.Status, m.Notes, m.CreatedAt,
      u.FirstName + ' ' + u.LastName AS PrescribedByName
    FROM dbo.EMRMedicationHistory m
    LEFT JOIN dbo.Users u ON u.Id = m.PrescribedBy
    WHERE m.PatientId = @patientId AND m.HospitalId = @hospitalId
      AND m.DeletedAt IS NULL
    ORDER BY m.StartDate DESC, m.CreatedAt DESC
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  return result.recordset;
}

async function addMedicationHistory(patientId, hospitalId, data, prescribedBy) {
  const q = `
    INSERT INTO dbo.EMRMedicationHistory
      (PatientId, HospitalId, MedicineName, GenericName, Dosage, Frequency,
       Route, StartDate, EndDate, PrescribedBy, Reason, Status, Notes, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES
      (@patientId, @hospitalId, @medicineName, @genericName, @dosage, @frequency,
       @route, @startDate, @endDate, @prescribedBy, @reason, @status, @notes, GETUTCDATE(), GETUTCDATE())
  `;
  const result = await query(q, {
    patientId:    { type: sql.BigInt,        value: patientId },
    hospitalId:   { type: sql.BigInt,        value: hospitalId },
    medicineName: { type: sql.NVarChar(200), value: data.medicineName },
    genericName:  { type: sql.NVarChar(200), value: data.genericName  || null },
    dosage:       { type: sql.NVarChar(100), value: data.dosage       || null },
    frequency:    { type: sql.NVarChar(100), value: data.frequency    || null },
    route:        { type: sql.NVarChar(80),  value: data.route        || null },
    startDate:    { type: sql.Date,          value: data.startDate    || null },
    endDate:      { type: sql.Date,          value: data.endDate      || null },
    prescribedBy: { type: sql.BigInt,        value: prescribedBy },
    reason:       { type: sql.NVarChar(500), value: data.reason       || null },
    status:       { type: sql.NVarChar(20),  value: data.status       || 'Active' },
    notes:        { type: sql.NVarChar(sql.MAX), value: data.notes    || null },
  });
  return result.recordset[0].Id;
}

// ─────────────────────────────────────────────────────────────
// PRESCRIPTIONS (read from existing Prescriptions table)
// ─────────────────────────────────────────────────────────────
async function getPrescriptions(patientId, hospitalId) {
  const q = `
    SELECT
      rx.Id, rx.RxNumber, rx.RxDate, rx.Status, rx.Diagnosis,
      rx.Notes, rx.ValidUntil, rx.CreatedAt,
      u.FirstName + ' ' + u.LastName AS DoctorName,
      (
        SELECT pi.Id, pi.MedicineId, m.Name AS MedicineName, pi.Dosage,
               pi.Frequency, pi.Duration, pi.Route, pi.Instructions
        FROM dbo.PrescriptionItems pi
        LEFT JOIN dbo.Medicines m ON m.Id = pi.MedicineId
        WHERE pi.PrescriptionId = rx.Id
        FOR JSON PATH
      ) AS Items
    FROM dbo.Prescriptions rx
    LEFT JOIN dbo.Users u ON u.Id = rx.DoctorId
    WHERE rx.PatientId = @patientId AND rx.HospitalId = @hospitalId
    ORDER BY rx.RxDate DESC
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  // Parse nested JSON items
  return result.recordset.map(r => ({
    ...r,
    Items: r.Items ? JSON.parse(r.Items) : [],
  }));
}

// ─────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────
async function getDocuments(patientId, hospitalId) {
  const q = `
    SELECT
      d.Id, d.DocumentType, d.FileName, d.FilePath, d.FileSize,
      d.MimeType, d.Description, d.UploadedAt, d.IsActive,
      u.FirstName + ' ' + u.LastName AS UploadedByName
    FROM dbo.EMRDocuments d
    LEFT JOIN dbo.Users u ON u.Id = d.UploaderUserId
    WHERE d.PatientId = @patientId AND d.HospitalId = @hospitalId AND d.IsActive = 1
    ORDER BY d.UploadedAt DESC
  `;
  const result = await query(q, {
    patientId:  { type: sql.BigInt, value: patientId },
    hospitalId: { type: sql.BigInt, value: hospitalId },
  });
  return result.recordset;
}

async function addDocument(patientId, hospitalId, fileData, uploaderUserId) {
  const q = `
    INSERT INTO dbo.EMRDocuments
      (PatientId, HospitalId, UploaderUserId, DocumentType, FileName, FilePath,
       FileSize, MimeType, Description, UploadedAt, IsActive)
    OUTPUT INSERTED.Id
    VALUES
      (@patientId, @hospitalId, @uploaderUserId, @documentType, @fileName, @filePath,
       @fileSize, @mimeType, @description, GETUTCDATE(), 1)
  `;
  const result = await query(q, {
    patientId:      { type: sql.BigInt,         value: patientId },
    hospitalId:     { type: sql.BigInt,         value: hospitalId },
    uploaderUserId: { type: sql.BigInt,         value: uploaderUserId },
    documentType:   { type: sql.NVarChar(50),   value: fileData.documentType || 'Other' },
    fileName:       { type: sql.NVarChar(300),  value: fileData.fileName },
    filePath:       { type: sql.NVarChar(1000), value: fileData.filePath },
    fileSize:       { type: sql.BigInt,         value: fileData.fileSize     || null },
    mimeType:       { type: sql.NVarChar(100),  value: fileData.mimeType     || null },
    description:    { type: sql.NVarChar(500),  value: fileData.description  || null },
  });
  return result.recordset[0].Id;
}

async function deleteDocument(documentId, patientId) {
  const q = `
    UPDATE dbo.EMRDocuments
    SET IsActive = 0
    WHERE Id = @documentId AND PatientId = @patientId
  `;
  const result = await query(q, {
    documentId: { type: sql.BigInt, value: documentId },
    patientId:  { type: sql.BigInt, value: patientId },
  });
  return result.rowsAffected[0] > 0;
}

module.exports = {
  getEMRSummary,
  getMedicalHistory, addMedicalHistory,
  getDiagnoses,      addDiagnosis,
  getClinicalNotes,  addClinicalNote,
  getAllergies,       addAllergy,       updateAllergy,
  getMedicationHistory, addMedicationHistory,
  getPrescriptions,
  getDocuments,      addDocument,      deleteDocument,
};
