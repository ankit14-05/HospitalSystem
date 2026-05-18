// src/routes/prescription.routes.js
// Tables: Prescriptions, PrescriptionItems, Medicines, PatientProfiles,
//         DoctorProfiles, Users, Appointments, DoctorPrescriptionSignatures
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts, PageSizes } = require('pdf-lib');
const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool, sql, withTransaction } = require('../config/database');
const { requireActivePatientProfile } = require('../services/patientAccess.service');

router.use(protect);

const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const SIGNATURE_PREFS = new Set(['Stamp', 'NewPage', 'TextOnly']);
const PDF_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/prescriptions');
const SIGNATURE_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/prescriptions/signatures');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(PDF_UPLOAD_DIR);
ensureDir(SIGNATURE_UPLOAD_DIR);

const signatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(SIGNATURE_UPLOAD_DIR);
    cb(null, SIGNATURE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `doc-sign-${uniqueSuffix}${ext}`);
  },
});

const signatureUpload = multer({
  storage: signatureStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = /^image\/(png|jpeg|jpg|webp)$/i.test(file.mimetype || '');
    if (!isImage) {
      return cb(new Error('Only image files are allowed for signature upload'));
    }
    return cb(null, true);
  },
});

const toInt = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
};

const trimOrNull = (value) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const safeParseJson = (value, fallback = {}) => {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch {
    return fallback;
  }
};

const normalizeVitalsJson = (vitalsJson) => {
  const vitals = safeParseJson(vitalsJson, {});
  if (!vitals || typeof vitals !== 'object') return {};

  const bpFromObj = vitals.bp || vitals.BP || null;
  const systolic = vitals.bloodPressureSystolic || vitals.systolic || vitals.sbp || vitals.BloodPressureSystolic;
  const diastolic = vitals.bloodPressureDiastolic || vitals.diastolic || vitals.dbp || vitals.BloodPressureDiastolic;
  const normalizedBp = bpFromObj || (systolic && diastolic ? `${systolic}/${diastolic} mmHg` : null);

  return {
    bp: trimOrNull(normalizedBp),
    pulse: trimOrNull(vitals.pulse || vitals.heartRate || vitals.HeartRate),
    spo2: trimOrNull(vitals.spo2 || vitals.oxygenSaturation || vitals.OxygenSaturation),
    fallRisk: trimOrNull(vitals.fallRisk || vitals.fall_risk || vitals.fallrisk),
    temperature: trimOrNull(vitals.temp || vitals.temperature || vitals.Temperature),
    weight: trimOrNull(vitals.weight || vitals.Weight),
  };
};

const formatAgeFromDob = (dobValue) => {
  if (!dobValue) return null;
  const dob = new Date(dobValue);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years >= 0) parts.push(`${years} year(s)`);
  if (months >= 0) parts.push(`${months} month(s)`);
  if (days >= 0) parts.push(`${days} day(s)`);
  return parts.join(' ');
};

const resolveUploadAbsPath = (relativeUploadPath) => {
  if (!relativeUploadPath) return null;
  const clean = String(relativeUploadPath).replace(/^\/+/, '');
  return path.resolve(__dirname, '../..', clean);
};

const makeRxNumber = (versionNo = 1) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(10000 + Math.random() * 90000);
  return versionNo > 1 ? `RX-${today}-${random}-V${versionNo}` : `RX-${today}-${random}`;
};

const normalizeItem = (item = {}, index = 0) => {
  const medicineName = trimOrNull(item.medicineName || item.drugName || item.name);
  if (!medicineName) return null;

  const daysRaw = trimOrNull(item.days);
  const durationRaw = trimOrNull(item.duration);

  return {
    rowNo: index + 1,
    medicineId: item.medicineId ? toInt(item.medicineId) : null,
    medicineName,
    genericName: trimOrNull(item.genericName || item.generic),
    dosage: trimOrNull(item.dosage || item.dose),
    frequency: trimOrNull(item.frequency || item.schedule),
    duration: durationRaw || (daysRaw ? `${daysRaw} day(s)` : null),
    quantity: item.quantity != null && item.quantity !== '' ? toInt(item.quantity) : null,
    route: trimOrNull(item.route) || 'Oral',
    instructions: trimOrNull(item.instructions || item.instruction || item.notes),
    days: daysRaw,
    schedule: trimOrNull(item.schedule || item.frequency),
    instruction: trimOrNull(item.instruction || item.instructions),
  };
};

const normalizeItems = (items = [], legacyDrugs = []) => {
  const source = Array.isArray(items) && items.length
    ? items
    : (Array.isArray(legacyDrugs) ? legacyDrugs : []);

  return source
    .map((item, index) => normalizeItem(item, index))
    .filter(Boolean);
};

const resolveDoctorContext = async (req, pool, requestedDoctorId = null) => {
  if (req.user.role === 'doctor') {
    const docRes = await pool.request()
      .input('UserId', sql.BigInt, toInt(req.user.id))
      .query(`SELECT TOP 1 Id, HospitalId, UserId FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

    if (!docRes.recordset.length) {
      throw Object.assign(new Error('Doctor profile not found'), { status: 400 });
    }
    return docRes.recordset[0];
  }

  if (!ADMIN_ROLES.has(req.user.role)) {
    throw Object.assign(new Error('Unauthorized role for prescription operation'), { status: 403 });
  }

  const normalizedDoctorId = toInt(requestedDoctorId);
  if (!normalizedDoctorId) {
    throw Object.assign(new Error('doctorId is required for admin/superadmin actions'), { status: 400 });
  }

  const docRes = await pool.request()
    .input('DoctorId', sql.BigInt, normalizedDoctorId)
    .query(`SELECT TOP 1 Id, HospitalId, UserId FROM dbo.DoctorProfiles WHERE Id = @DoctorId`);

  if (!docRes.recordset.length) {
    throw Object.assign(new Error('Doctor profile not found for requested doctorId'), { status: 404 });
  }

  return docRes.recordset[0];
};

const resolveDoctorProfileIdByUser = async (pool, userId) => {
  const docRes = await pool.request()
    .input('UserId', sql.BigInt, toInt(userId))
    .query(`SELECT TOP 1 Id FROM dbo.DoctorProfiles WHERE UserId = @UserId`);

  return docRes.recordset[0]?.Id || null;
};

const getSignatureSettings = async (pool, userId) => {
  const res = await pool.request()
    .input('UserId', sql.BigInt, toInt(userId))
    .query(`
      SELECT TOP 1
        UserId,
        SignatureImagePath,
        SignatureText,
        SignaturePreference,
        CreatedAt,
        UpdatedAt
      FROM dbo.DoctorPrescriptionSignatures
      WHERE UserId = @UserId
    `);

  if (!res.recordset.length) {
    return {
      UserId: toInt(userId),
      SignatureImagePath: null,
      SignatureText: null,
      SignaturePreference: 'Stamp',
    };
  }

  return res.recordset[0];
};

const upsertSignatureSettings = async (pool, { userId, signatureText, signaturePreference, signatureImagePath }) => {
  await pool.request()
    .input('UserId', sql.BigInt, toInt(userId))
    .input('SignatureText', sql.NVarChar(200), trimOrNull(signatureText))
    .input('SignaturePreference', sql.NVarChar(20), SIGNATURE_PREFS.has(signaturePreference) ? signaturePreference : 'Stamp')
    .input('SignatureImagePath', sql.NVarChar(sql.MAX), trimOrNull(signatureImagePath))
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.DoctorPrescriptionSignatures WHERE UserId = @UserId)
      BEGIN
        UPDATE dbo.DoctorPrescriptionSignatures
        SET SignatureText = @SignatureText,
            SignaturePreference = @SignaturePreference,
            SignatureImagePath = ISNULL(@SignatureImagePath, SignatureImagePath),
            UpdatedAt = SYSUTCDATETIME()
        WHERE UserId = @UserId
      END
      ELSE
      BEGIN
        INSERT INTO dbo.DoctorPrescriptionSignatures
          (UserId, SignatureText, SignaturePreference, SignatureImagePath)
        VALUES
          (@UserId, @SignatureText, @SignaturePreference, @SignatureImagePath)
      END
    `);

  return getSignatureSettings(pool, userId);
};

const fetchPrescriptionItems = async (pool, prescriptionId) => {
  const itemsRes = await pool.request()
    .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
    .query(`
      SELECT
        rxi.Id,
        rxi.MedicineId,
        rxi.MedicineName,
        rxi.Dosage,
        rxi.Frequency,
        rxi.Duration,
        rxi.Quantity,
        rxi.Route,
        rxi.Instructions,
        rxi.IsDispensed,
        rxi.DispensedAt,
        m.GenericName,
        m.BrandName,
        m.DosageForm,
        m.Strength
      FROM dbo.PrescriptionItems rxi
      LEFT JOIN dbo.Medicines m ON m.Id = rxi.MedicineId
      WHERE rxi.PrescriptionId = @PrescriptionId
      ORDER BY rxi.Id ASC
    `);

  return itemsRes.recordset;
};

const fetchVersionHistory = async (pool, prescriptionId) => {
  const versionRes = await pool.request()
    .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
    .query(`
      ;WITH Ancestors AS (
        SELECT Id, ParentPrescriptionId
        FROM dbo.Prescriptions
        WHERE Id = @PrescriptionId
        UNION ALL
        SELECT p.Id, p.ParentPrescriptionId
        FROM dbo.Prescriptions p
        INNER JOIN Ancestors a ON p.Id = a.ParentPrescriptionId
      ),
      RootNode AS (
        SELECT TOP 1 Id AS RootId
        FROM Ancestors
        WHERE ParentPrescriptionId IS NULL
        ORDER BY Id ASC
      ),
      VersionTree AS (
        SELECT
          p.Id,
          p.ParentPrescriptionId,
          p.RxNumber,
          p.VersionNo,
          p.IsFinalized,
          p.FinalizedAt,
          p.CreatedAt,
          p.ArchivedPdfPath,
          p.Status
        FROM dbo.Prescriptions p
        WHERE p.Id = (SELECT RootId FROM RootNode)
        UNION ALL
        SELECT
          c.Id,
          c.ParentPrescriptionId,
          c.RxNumber,
          c.VersionNo,
          c.IsFinalized,
          c.FinalizedAt,
          c.CreatedAt,
          c.ArchivedPdfPath,
          c.Status
        FROM dbo.Prescriptions c
        INNER JOIN VersionTree vt ON c.ParentPrescriptionId = vt.Id
      )
      SELECT
        Id,
        ParentPrescriptionId,
        RxNumber,
        VersionNo,
        IsFinalized,
        FinalizedAt,
        CreatedAt,
        ArchivedPdfPath,
        Status
      FROM VersionTree
      ORDER BY VersionNo ASC, CreatedAt ASC
      OPTION (MAXRECURSION 100)
    `);

  return versionRes.recordset;
};

const fetchPrescriptionHeader = async (pool, prescriptionId) => {
  const request = pool.request().input('PrescriptionId', sql.BigInt, toInt(prescriptionId));

  const baseQueryWithConsultation = `
    SELECT
      rx.Id,
      rx.HospitalId,
      rx.PatientId,
      rx.DoctorId,
      rx.AppointmentId,
      rx.AdmissionId,
      rx.RxNumber,
      rx.RxDate,
      rx.Status,
      rx.Diagnosis,
      rx.Notes,
      rx.ValidUntil,
      rx.CreatedAt,
      rx.UpdatedAt,
      rx.VersionNo,
      rx.ParentPrescriptionId,
      rx.IsFinalized,
      rx.FinalizedAt,
      rx.FinalizedBy,
      rx.PayloadJson,
      rx.ArchivedPdfPath,
      rx.ArchivedPdfAt,
      rx.ArchivedPdfBy,

      p.FirstName + ' ' + p.LastName AS PatientName,
      p.FirstName,
      p.LastName,
      p.UHID,
      p.DateOfBirth,
      p.Gender,
      p.BloodGroup,
      p.Phone AS PatientPhone,
      p.KnownAllergies,
      p.UserId AS PatientUserId,

      dp.UserId AS DoctorUserId,
      u.FirstName + ' ' + u.LastName AS DoctorName,
      u.FirstName AS DoctorFirstName,
      u.LastName AS DoctorLastName,
      u.Email AS DoctorEmail,
      u.Phone AS DoctorPhone,
      u.Designation AS DoctorDesignation,
      dp.LicenseNumber,
      dp.DoctorId AS DoctorCode,
      dp.LanguagesSpoken,

      dep.Name AS DepartmentName,
      sp.Name AS Specialization,
      q.Code AS Qualification,
      q.FullName AS QualificationFull,

      hosp.Name AS HospitalName,
      hosp.ShortName AS HospitalShortName,
      hosp.LogoUrl,
      hosp.Phone AS HospitalPhone,
      hosp.Email AS HospitalEmail,
      hosp.Website AS HospitalWebsite,
      hosp.PrimaryColor,
      hosp.SecondaryColor,
      ISNULL(hosp.Street1, '') +
        CASE WHEN hosp.Street2 IS NOT NULL THEN ', ' + hosp.Street2 ELSE '' END +
        CASE WHEN hosp.City IS NOT NULL THEN ', ' + hosp.City ELSE '' END +
        CASE WHEN hosp.PincodeText IS NOT NULL THEN ' - ' + hosp.PincodeText ELSE '' END
      AS HospitalAddress,

      a.AppointmentNo,
      a.AppointmentDate,
      CONVERT(VARCHAR(5), TRY_CONVERT(time, a.AppointmentTime), 108) AS AppointmentTime,
      ac.VitalsJson AS ConsultationVitalsJson

    FROM dbo.Prescriptions rx
    JOIN dbo.PatientProfiles p ON p.Id = rx.PatientId
    JOIN dbo.DoctorProfiles dp ON dp.Id = rx.DoctorId
    JOIN dbo.Users u ON u.Id = dp.UserId
    LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
    LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
    LEFT JOIN dbo.Qualifications q ON q.Id = dp.QualificationId
    LEFT JOIN dbo.HospitalSetup hosp ON hosp.Id = rx.HospitalId
    LEFT JOIN dbo.Appointments a ON a.Id = rx.AppointmentId
    LEFT JOIN dbo.AppointmentConsultations ac ON ac.AppointmentId = rx.AppointmentId
    WHERE rx.Id = @PrescriptionId
  `;

  try {
    const withConsultation = await request.query(baseQueryWithConsultation);
    if (withConsultation.recordset.length) return withConsultation.recordset[0];
    return null;
  } catch {
    const fallback = await pool.request()
      .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
      .query(`
        SELECT
          rx.Id,
          rx.HospitalId,
          rx.PatientId,
          rx.DoctorId,
          rx.AppointmentId,
          rx.AdmissionId,
          rx.RxNumber,
          rx.RxDate,
          rx.Status,
          rx.Diagnosis,
          rx.Notes,
          rx.ValidUntil,
          rx.CreatedAt,
          rx.UpdatedAt,
          rx.VersionNo,
          rx.ParentPrescriptionId,
          rx.IsFinalized,
          rx.FinalizedAt,
          rx.FinalizedBy,
          rx.PayloadJson,
          rx.ArchivedPdfPath,
          rx.ArchivedPdfAt,
          rx.ArchivedPdfBy,

          p.FirstName + ' ' + p.LastName AS PatientName,
          p.FirstName,
          p.LastName,
          p.UHID,
          p.DateOfBirth,
          p.Gender,
          p.BloodGroup,
          p.Phone AS PatientPhone,
          p.KnownAllergies,
          p.UserId AS PatientUserId,

          dp.UserId AS DoctorUserId,
          u.FirstName + ' ' + u.LastName AS DoctorName,
          u.FirstName AS DoctorFirstName,
          u.LastName AS DoctorLastName,
          u.Email AS DoctorEmail,
          u.Phone AS DoctorPhone,
          u.Designation AS DoctorDesignation,
          dp.LicenseNumber,
          dp.DoctorId AS DoctorCode,
          dp.LanguagesSpoken,

          dep.Name AS DepartmentName,
          sp.Name AS Specialization,
          q.Code AS Qualification,
          q.FullName AS QualificationFull,

          hosp.Name AS HospitalName,
          hosp.ShortName AS HospitalShortName,
          hosp.LogoUrl,
          hosp.Phone AS HospitalPhone,
          hosp.Email AS HospitalEmail,
          hosp.Website AS HospitalWebsite,
          hosp.PrimaryColor,
          hosp.SecondaryColor,
          ISNULL(hosp.Street1, '') +
            CASE WHEN hosp.Street2 IS NOT NULL THEN ', ' + hosp.Street2 ELSE '' END +
            CASE WHEN hosp.City IS NOT NULL THEN ', ' + hosp.City ELSE '' END +
            CASE WHEN hosp.PincodeText IS NOT NULL THEN ' - ' + hosp.PincodeText ELSE '' END
          AS HospitalAddress,

          a.AppointmentNo,
          a.AppointmentDate,
          CONVERT(VARCHAR(5), TRY_CONVERT(time, a.AppointmentTime), 108) AS AppointmentTime,
          CAST(NULL AS NVARCHAR(MAX)) AS ConsultationVitalsJson

        FROM dbo.Prescriptions rx
        JOIN dbo.PatientProfiles p ON p.Id = rx.PatientId
        JOIN dbo.DoctorProfiles dp ON dp.Id = rx.DoctorId
        JOIN dbo.Users u ON u.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
        LEFT JOIN dbo.Qualifications q ON q.Id = dp.QualificationId
        LEFT JOIN dbo.HospitalSetup hosp ON hosp.Id = rx.HospitalId
        LEFT JOIN dbo.Appointments a ON a.Id = rx.AppointmentId
        WHERE rx.Id = @PrescriptionId
      `);

    return fallback.recordset[0] || null;
  }
};

const assertPrescriptionAccess = async (req, pool, prescriptionId, { write = false } = {}) => {
  const rx = await fetchPrescriptionHeader(pool, prescriptionId);
  if (!rx) {
    throw Object.assign(new Error('Prescription not found'), { status: 404 });
  }

  const role = req.user.role;

  if (ADMIN_ROLES.has(role)) {
    return rx;
  }

  if (role === 'doctor') {
    const doctorProfileId = await resolveDoctorProfileIdByUser(pool, req.user.id);
    const normalizedRxDoctorId = toInt(rx.DoctorId);
    const normalizedMyProfileId = toInt(doctorProfileId);

    if (!normalizedMyProfileId) {
      throw Object.assign(new Error('Doctor profile not found'), { status: 403 });
    }

    console.log(`[DEBUG] Access Check: RxDoctorId=${normalizedRxDoctorId}, MyProfileId=${normalizedMyProfileId}, IsFinalized=${rx.IsFinalized}, MyHospital=${req.user.hospitalId}, RxHospital=${rx.HospitalId}`);

    // Owner always has access
    if (normalizedRxDoctorId === normalizedMyProfileId) {
      return rx;
    }

    // Non-owner:
    if (write) {
      throw Object.assign(new Error('Access denied: Only the prescribing doctor can modify this draft'), { status: 403 });
    }

    // Read access for other doctors: allow if finalized or from same hospital
    if (rx.IsFinalized || toInt(rx.HospitalId) === toInt(req.user.hospitalId)) {
      return rx;
    }

    console.log('[DEBUG] Access Denied: Finalized check failed');
    throw Object.assign(new Error('Access denied for this prescription'), { status: 403 });
  }

  if (role === 'patient') {
    if (write) {
      throw Object.assign(new Error('Patients cannot modify prescriptions'), { status: 403 });
    }

    const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
    if (toInt(rx.PatientId) !== toInt(activeProfile.patientId)) {
      throw Object.assign(new Error('Access denied for this prescription'), { status: 403 });
    }

    if (!rx.IsFinalized) {
      throw Object.assign(new Error('Draft prescriptions are not accessible to patients'), { status: 403 });
    }

    return rx;
  }

  throw Object.assign(new Error('Access denied for this prescription'), { status: 403 });
};

const buildPayloadObject = ({ body, normalizedItems, fallbackDiagnosis, fallbackNotes, fallbackValidUntil }) => {
  const header = body?.header && typeof body.header === 'object' ? body.header : {};
  const vitals = body?.vitals && typeof body.vitals === 'object' ? body.vitals : {};
  const sections = body?.sections && typeof body.sections === 'object' ? body.sections : {};
  const labValues = body?.labValues && typeof body.labValues === 'object' ? body.labValues : {};
  const followUp = body?.followUp && typeof body.followUp === 'object' ? body.followUp : {};

  return {
    header,
    vitals,
    sections,
    medicineNotes: trimOrNull(body?.medicineNotes),
    labValues,
    followUp,
    labTests: body?.labTests || [],
    items: normalizedItems.map((item) => ({
      medicineName: item.medicineName,
      genericName: item.genericName,
      dosage: item.dosage,
      schedule: item.schedule || item.frequency,
      instruction: item.instruction || item.instructions,
      route: item.route,
      days: item.days,
      quantity: item.quantity,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.instructions,
    })),
    legacy: {
      diagnosis: trimOrNull(fallbackDiagnosis),
      notes: trimOrNull(fallbackNotes),
      validUntil: trimOrNull(fallbackValidUntil),
    },
    meta: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
    },
  };
};

const buildPrintModel = async (pool, prescriptionId) => {
  const rx = await fetchPrescriptionHeader(pool, prescriptionId);
  if (!rx) {
    throw Object.assign(new Error('Prescription not found'), { status: 404 });
  }

  const items = await fetchPrescriptionItems(pool, prescriptionId);
  const versions = await fetchVersionHistory(pool, prescriptionId);
  const signature = await getSignatureSettings(pool, rx.DoctorUserId);

  const payload = safeParseJson(rx.PayloadJson, {});
  const payloadHeader = payload.header && typeof payload.header === 'object' ? payload.header : {};
  const payloadVitals = payload.vitals && typeof payload.vitals === 'object' ? payload.vitals : {};
  const payloadSections = payload.sections && typeof payload.sections === 'object' ? payload.sections : {};
  const payloadLabValues = payload.labValues && typeof payload.labValues === 'object' ? payload.labValues : {};
  const payloadFollowUp = payload.followUp && typeof payload.followUp === 'object' ? payload.followUp : {};
  const consultationVitals = normalizeVitalsJson(rx.ConsultationVitalsJson);

  const mappedItems = (Array.isArray(payload.items) && payload.items.length ? payload.items : items).map((item, index) => {
    const normalized = normalizeItem(item, index);
    if (!normalized) {
      return {
        sno: index + 1,
        medicineName: trimOrNull(item.MedicineName || item.medicineName) || '-',
        genericName: trimOrNull(item.GenericName || item.genericName) || null,
        schedule: trimOrNull(item.schedule || item.frequency || item.Frequency) || '-',
        instruction: trimOrNull(item.instruction || item.instructions || item.Instructions) || '-',
        route: trimOrNull(item.route || item.Route) || 'Oral',
        days: trimOrNull(item.days || item.Duration || item.duration) || '-',
        dosage: trimOrNull(item.dosage || item.Dosage) || null,
        quantity: item.quantity ?? item.Quantity ?? null,
      };
    }

    return {
      sno: normalized.rowNo,
      medicineName: normalized.medicineName,
      genericName: normalized.genericName,
      schedule: normalized.schedule || normalized.frequency || '-',
      instruction: normalized.instruction || normalized.instructions || '-',
      route: normalized.route || 'Oral',
      days: normalized.days || normalized.duration || '-',
      dosage: normalized.dosage,
      quantity: normalized.quantity,
    };
  });

  const ageText = payloadHeader.ageSex || formatAgeFromDob(rx.DateOfBirth) || null;
  const sexText = trimOrNull(payloadHeader.sex || rx.Gender);
  const ageSex = payloadHeader.ageSex || [ageText, sexText].filter(Boolean).join(' / ');

  const fallbackDiagnosis = trimOrNull(rx.Diagnosis);
  const fallbackNotes = trimOrNull(rx.Notes);

  return {
    id: rx.Id,
    rxNumber: rx.RxNumber,
    status: rx.Status,
    versionNo: rx.VersionNo || 1,
    parentPrescriptionId: rx.ParentPrescriptionId,
    isFinalized: Boolean(rx.IsFinalized),
    finalizedAt: rx.FinalizedAt,
    archivedPdfPath: rx.ArchivedPdfPath,
    createdAt: rx.CreatedAt,
    validUntil: rx.ValidUntil,
    appointmentId: rx.AppointmentId,
    appointmentNo: rx.AppointmentNo,
    appointmentDate: rx.AppointmentDate,
    appointmentTime: rx.AppointmentTime,

    hospital: {
      id: rx.HospitalId,
      name: payloadHeader.hospitalName || rx.HospitalName,
      shortName: rx.HospitalShortName,
      logoUrl: payloadHeader.hospitalLogoUrl || rx.LogoUrl,
      phone: rx.HospitalPhone,
      email: rx.HospitalEmail,
      website: rx.HospitalWebsite,
      address: rx.HospitalAddress,
      primaryColor: rx.PrimaryColor,
      secondaryColor: rx.SecondaryColor,
    },

    patient: {
      id: rx.PatientId,
      name: payloadHeader.patientName || rx.PatientName,
      firstName: rx.FirstName,
      lastName: rx.LastName,
      ageSex,
      maxId: payloadHeader.maxId || rx.UHID,
      bloodGroup: rx.BloodGroup,
      phone: rx.PatientPhone,
      gender: rx.Gender,
      dateOfBirth: rx.DateOfBirth,
      allergy: payloadHeader.allergy || payloadSections.allergy || rx.KnownAllergies || 'No Known Allergy',
    },

    doctor: {
      id: rx.DoctorId,
      userId: rx.DoctorUserId,
      name: payloadHeader.doctorName || rx.DoctorName,
      code: rx.DoctorCode,
      department: payloadHeader.department || rx.DepartmentName,
      speciality: payloadHeader.speciality || rx.Specialization,
      qualification: rx.QualificationFull || rx.Qualification,
      registrationNo: rx.LicenseNumber,
      designation: rx.DoctorDesignation,
      languages: rx.LanguagesSpoken,
      signature: {
        text: signature.SignatureText || rx.DoctorName,
        imagePath: signature.SignatureImagePath,
        preference: SIGNATURE_PREFS.has(signature.SignaturePreference) ? signature.SignaturePreference : 'Stamp',
      },
    },

    header: {
      location: payloadHeader.location || rx.HospitalName,
      referredBy: payloadHeader.referredBy || 'SELF',
      invoiceNo: payloadHeader.invoiceNo || rx.RxNumber,
      dateLabel: payloadHeader.date || (rx.RxDate ? new Date(rx.RxDate).toLocaleString('en-IN') : new Date(rx.CreatedAt).toLocaleString('en-IN')),
      pageLabel: payloadHeader.pageLabel || 'Page 1 of 1',
    },

    vitals: {
      bp: trimOrNull(payloadVitals.bp) || consultationVitals.bp,
      pulse: trimOrNull(payloadVitals.pulse) || consultationVitals.pulse,
      spo2: trimOrNull(payloadVitals.spo2) || consultationVitals.spo2,
      fallRisk: trimOrNull(payloadVitals.fallRisk) || consultationVitals.fallRisk || '0',
      temperature: trimOrNull(payloadVitals.temperature) || consultationVitals.temperature,
      weight: trimOrNull(payloadVitals.weight) || consultationVitals.weight,
    },

    sections: {
      chiefComplaints: trimOrNull(payloadSections.chiefComplaints),
      historyPresentIllness: trimOrNull(payloadSections.historyPresentIllness || payloadSections.hopi),
      pastHistory: trimOrNull(payloadSections.pastHistory),
      clinicalNotes: trimOrNull(payloadSections.clinicalNotes) || fallbackNotes,
      procedure: trimOrNull(payloadSections.procedure),
      diagnosis: trimOrNull(payloadSections.diagnosis || payloadSections.diagnosisSidebar) || fallbackDiagnosis,
      medicineAdvised: trimOrNull(payloadSections.medicineAdvised || payload.medicineNotes),
      notes: fallbackNotes,
    },

    labValues: {
      inr: trimOrNull(payloadLabValues.inr),
      salb: trimOrNull(payloadLabValues.salb),
      albuminNote: trimOrNull(payloadLabValues.albuminNote),
      other: trimOrNull(payloadLabValues.other),
    },

    followUp: {
      instructions: trimOrNull(payloadFollowUp.instructions || payload.followUpText),
      when: trimOrNull(payloadFollowUp.when || rx.ValidUntil),
    },

    items: mappedItems,
    labTests: Array.isArray(payload.labTests) ? payload.labTests : [],
    versionHistory: versions,
    payload,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL NOTE TYPES (canonical set)
// ─────────────────────────────────────────────────────────────────────────────
const CLINICAL_NOTE_TYPES = [
  { key: 'allergy',              type: 'Allergy' },
  { key: 'chiefComplaints',      type: 'ChiefComplaint' },
  { key: 'historyPresentIllness',type: 'HOPI' },
  { key: 'pastHistory',          type: 'PastHistory' },
  { key: 'clinicalNotes',        type: 'ClinicalNotes' },
  { key: 'procedure',            type: 'Procedure' },
];

/**
 * Delete existing notes for a prescription then re-insert non-empty ones.
 * Must be called inside a transaction — pass the `request` factory.
 */
const upsertClinicalNotes = async (requestFn, prescriptionId, sections = {}, allergy = null) => {
  await requestFn()
    .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
    .query('DELETE FROM dbo.PrescriptionClinicalNotes WHERE PrescriptionId = @PrescriptionId');

  const source = { allergy, ...sections };

  for (const { key, type } of CLINICAL_NOTE_TYPES) {
    const content = trimOrNull(source[key]);
    if (!content) continue;
    await requestFn()
      .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
      .input('NoteType',       sql.NVarChar(50),   type)
      .input('NoteContent',    sql.NVarChar(sql.MAX), content)
      .query(`
        INSERT INTO dbo.PrescriptionClinicalNotes (PrescriptionId, NoteType, NoteContent)
        VALUES (@PrescriptionId, @NoteType, @NoteContent)
      `);
  }
};

/**
 * Delete existing lab orders for a prescription then re-insert.
 * Must be called inside a transaction — pass the `request` factory.
 */
const upsertLabOrders = async (requestFn, prescriptionId, labTests = []) => {
  await requestFn()
    .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
    .query('DELETE FROM dbo.PrescriptionLabOrders WHERE PrescriptionId = @PrescriptionId');

  for (const test of labTests) {
    const testName = trimOrNull(test.testName || test.TestName);
    if (!testName) continue;
    await requestFn()
      .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
      .input('TestId',   sql.BigInt,        test.testId ? toInt(test.testId) : null)
      .input('TestName', sql.NVarChar(200),  testName)
      .input('Criteria', sql.NVarChar(500),  trimOrNull(test.criteria || test.Criteria))
      .input('Details',  sql.NVarChar(sql.MAX), trimOrNull(test.details || test.Details))
      .input('Priority', sql.NVarChar(20),   ['Urgent','STAT'].includes(test.priority) ? test.priority : 'Routine')
      .query(`
        INSERT INTO dbo.PrescriptionLabOrders
          (PrescriptionId, TestId, TestName, Criteria, Details, Priority)
        VALUES
          (@PrescriptionId, @TestId, @TestName, @Criteria, @Details, @Priority)
      `);
  }
};

/**
 * Fetch clinical notes and lab orders from the new normalized tables.
 */
const fetchNormalizedClinicalData = async (pool, prescriptionId) => {
  const notesRes = await pool.request()
    .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
    .query(`
      SELECT NoteType, NoteContent
      FROM dbo.PrescriptionClinicalNotes
      WHERE PrescriptionId = @PrescriptionId
      ORDER BY Id ASC
    `);

  const labRes = await pool.request()
    .input('PrescriptionId', sql.BigInt, toInt(prescriptionId))
    .query(`
      SELECT Id, TestId, TestName, Criteria, Details, Status, Priority, CreatedAt
      FROM dbo.PrescriptionLabOrders
      WHERE PrescriptionId = @PrescriptionId
      ORDER BY Id ASC
    `);

  // Convert notes array to a key-value map for easy consumption
  const noteMap = {};
  for (const row of notesRes.recordset) {
    noteMap[row.NoteType] = row.NoteContent;
  }

  return {
    clinicalNotes: noteMap,
    labOrders: labRes.recordset,
  };
};

const drawWrappedText = ({ page, text, x, y, maxWidth, lineHeight = 12, font, size = 10, color = rgb(0, 0, 0) }) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return y;

  let currentLine = '';
  let cursorY = y;

  const drawLine = (line) => {
    if (!line) return;
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  };

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && currentLine) {
      drawLine(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });

  drawLine(currentLine);
  return cursorY;
};

const generatePrescriptionPdf = async (printModel) => {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage(PageSizes.A4);
  const pageWidth = page.getWidth();
  const marginX = 36;
  const rightEdge = pageWidth - marginX;
  let y = page.getHeight() - 40;

  const ensurePageSpace = (minY = 50) => {
    if (y > minY) return;
    page = pdfDoc.addPage(PageSizes.A4);
    y = page.getHeight() - 40;
  };

  const writeLine = (label, value = '', options = {}) => {
    ensurePageSpace();
    const font = options.bold ? bold : regular;
    const size = options.size || 10;
    const text = label ? `${label}${value ? ` ${value}` : ''}` : String(value || '');
    page.drawText(text.slice(0, 130), {
      x: marginX,
      y,
      size,
      font,
      color: options.color || rgb(0.05, 0.1, 0.2),
    });
    y -= options.lineHeight || 14;
  };

  writeLine(printModel.hospital?.name || 'Hospital', '', { bold: true, size: 16, lineHeight: 18 });
  writeLine(`Prescription ${printModel.rxNumber || ''}`, '', { bold: true, size: 12 });
  writeLine('');

  writeLine(`Patient: ${printModel.patient?.name || '-'}`);
  writeLine(`Age / Sex: ${printModel.patient?.ageSex || '-'}`);
  writeLine(`Patient ID: ${printModel.patient?.maxId || '-'}`);
  writeLine(`Doctor: ${printModel.doctor?.name || '-'}`);
  writeLine(`Department: ${printModel.doctor?.department || '-'}`);
  writeLine(`Speciality: ${printModel.doctor?.speciality || '-'}`);
  writeLine(`Date: ${printModel.header?.dateLabel || '-'}`);
  writeLine(`Location: ${printModel.header?.location || '-'}`);
  writeLine('');

  writeLine('Vitals', '', { bold: true });
  writeLine(`BP: ${printModel.vitals?.bp || '-'} | Pulse: ${printModel.vitals?.pulse || '-'} | SPO2: ${printModel.vitals?.spo2 || '-'} | Fall Risk: ${printModel.vitals?.fallRisk || '0'}`);
  writeLine('');

  const sections = [
    ['Allergy', printModel.patient?.allergy],
    ['Chief Complaints', printModel.sections?.chiefComplaints],
    ['History of Present Illness', printModel.sections?.historyPresentIllness],
    ['Past History', printModel.sections?.pastHistory],
    ['Clinical Notes', printModel.sections?.clinicalNotes],
    ['Procedure', printModel.sections?.procedure],
    ['Diagnosis', printModel.sections?.diagnosis],
    ['Medicine Advised', printModel.sections?.medicineAdvised],
  ];

  sections.forEach(([label, text]) => {
    if (!trimOrNull(text)) return;
    ensurePageSpace(90);
    page.drawText(label, {
      x: marginX,
      y,
      size: 10,
      font: bold,
      color: rgb(0.05, 0.1, 0.2),
    });
    y -= 12;
    y = drawWrappedText({
      page,
      text,
      x: marginX,
      y,
      maxWidth: rightEdge - marginX,
      font: regular,
      size: 9,
      lineHeight: 11,
      color: rgb(0.12, 0.17, 0.24),
    });
    y -= 6;
  });

  ensurePageSpace(120);
  page.drawText('Medicines', {
    x: marginX,
    y,
    size: 11,
    font: bold,
    color: rgb(0.05, 0.1, 0.2),
  });
  y -= 14;

  page.drawText('S.No', { x: marginX, y, size: 9, font: bold });
  page.drawText('Medicine', { x: marginX + 35, y, size: 9, font: bold });
  page.drawText('Schedule', { x: marginX + 235, y, size: 9, font: bold });
  page.drawText('Instruction', { x: marginX + 330, y, size: 9, font: bold });
  page.drawText('Route', { x: marginX + 425, y, size: 9, font: bold });
  y -= 12;

  (printModel.items || []).forEach((item, idx) => {
    ensurePageSpace(70);
    page.drawText(String(item.sno || idx + 1), { x: marginX, y, size: 8, font: regular });
    page.drawText(String(item.medicineName || '-').slice(0, 40), { x: marginX + 35, y, size: 8, font: regular });
    page.drawText(String(item.schedule || '-').slice(0, 16), { x: marginX + 235, y, size: 8, font: regular });
    page.drawText(String(item.instruction || '-').slice(0, 14), { x: marginX + 330, y, size: 8, font: regular });
    page.drawText(String(item.route || '-').slice(0, 8), { x: marginX + 425, y, size: 8, font: regular });
    y -= 11;
  });

  y -= 8;
  writeLine(`INR: ${printModel.labValues?.inr || '-'} | SALb: ${printModel.labValues?.salb || '-'}`);
  if (trimOrNull(printModel.labValues?.albuminNote)) {
    writeLine(`Albumin: ${printModel.labValues.albuminNote}`);
  }
  if (trimOrNull(printModel.followUp?.instructions)) {
    writeLine(`Follow-up: ${printModel.followUp.instructions}`);
  }

  ensurePageSpace(80);
  y -= 10;
  page.drawLine({
    start: { x: marginX + 320, y },
    end: { x: rightEdge, y },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 14;
  page.drawText(printModel.doctor?.signature?.text || printModel.doctor?.name || 'Doctor', {
    x: marginX + 320,
    y,
    size: 10,
    font: bold,
  });
  y -= 12;
  page.drawText(`${printModel.doctor?.qualification || ''} ${printModel.doctor?.speciality || ''}`.trim().slice(0, 56), {
    x: marginX + 320,
    y,
    size: 8,
    font: regular,
  });
  y -= 10;
  page.drawText(`Reg No: ${printModel.doctor?.registrationNo || '-'}`.slice(0, 56), {
    x: marginX + 320,
    y,
    size: 8,
    font: regular,
  });

  return pdfDoc.save();
};

const getDoctorPrescriptions = async (userId, limit, offset) => {
  const pool = await getPool();
  const doctorId = await resolveDoctorProfileIdByUser(pool, userId);
  if (!doctorId) return null;

  const result = await pool.request()
    .input('DoctorId', sql.BigInt, doctorId)
    .input('Limit', sql.Int, limit)
    .input('Offset', sql.Int, offset)
    .query(`
      SELECT
        rx.Id,
        rx.RxNumber,
        rx.RxDate,
        rx.Status,
        rx.Diagnosis,
        rx.Notes,
        rx.ValidUntil,
        rx.CreatedAt,
        rx.VersionNo,
        rx.ParentPrescriptionId,
        rx.IsFinalized,
        rx.FinalizedAt,
        rx.ArchivedPdfPath,
        p.FirstName + ' ' + p.LastName AS PatientName,
        p.UHID,
        p.Phone AS PatientPhone,
        a.AppointmentNo,
        a.AppointmentDate,
        (
          SELECT
            rxi.Id,
            rxi.MedicineName,
            rxi.Dosage,
            rxi.Frequency,
            rxi.Duration,
            rxi.Quantity,
            rxi.Route,
            rxi.Instructions,
            rxi.IsDispensed
          FROM dbo.PrescriptionItems rxi
          WHERE rxi.PrescriptionId = rx.Id
          FOR JSON PATH
        ) AS Items
      FROM dbo.Prescriptions rx
      JOIN dbo.PatientProfiles p ON p.Id = rx.PatientId
      LEFT JOIN dbo.Appointments a ON a.Id = rx.AppointmentId
      WHERE rx.DoctorId = @DoctorId
      ORDER BY rx.RxDate DESC, rx.CreatedAt DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

      SELECT COUNT(*) AS Total
      FROM dbo.Prescriptions
      WHERE DoctorId = @DoctorId;
    `);

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/issued
// ─────────────────────────────────────────────────────────────────────────────
router.get('/issued', async (req, res, next) => {
  try {
    const limit = Math.min(toInt(req.query.limit) || 20, 100);
    const page = Math.max(toInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const result = await getDoctorPrescriptions(req.user.id, limit, offset);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    const prescriptions = result.recordsets[0].map((row) => ({
      ...row,
      IsFinalized: Boolean(row.IsFinalized),
      Items: row.Items ? JSON.parse(row.Items) : [],
    }));

    const total = result.recordsets[1]?.[0]?.Total || 0;

    return res.json({
      success: true,
      data: prescriptions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/my
// Patient: finalized own prescriptions | Doctor: prescriptions they wrote
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', async (req, res, next) => {
  try {
    const pool = await getPool();
    const role = req.user.role;
    const limit = Math.min(toInt(req.query.limit) || 20, 100);
    const page = Math.max(toInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let result;

    if (role === 'patient') {
      const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
      const patientId = toInt(activeProfile.patientId);

      result = await pool.request()
        .input('PatientId', sql.BigInt, patientId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT
            rx.Id,
            rx.RxNumber,
            rx.RxDate,
            rx.Status,
            rx.Diagnosis,
            rx.Notes,
            rx.ValidUntil,
            rx.CreatedAt,
            rx.VersionNo,
            rx.ParentPrescriptionId,
            rx.IsFinalized,
            rx.FinalizedAt,
            rx.ArchivedPdfPath,
            u.FirstName + ' ' + u.LastName AS DoctorName,
            dp.ConsultationFee,
            sp.Name AS Specialization,
            a.AppointmentNo,
            a.AppointmentDate,
            (
              SELECT
                rxi.Id,
                rxi.MedicineName,
                rxi.Dosage,
                rxi.Frequency,
                rxi.Duration,
                rxi.Quantity,
                rxi.Route,
                rxi.Instructions,
                rxi.IsDispensed
              FROM dbo.PrescriptionItems rxi
              WHERE rxi.PrescriptionId = rx.Id
              FOR JSON PATH
            ) AS Items
          FROM dbo.Prescriptions rx
          JOIN dbo.DoctorProfiles dp ON dp.Id = rx.DoctorId
          JOIN dbo.Users u ON u.Id = dp.UserId
          LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
          LEFT JOIN dbo.Appointments a ON a.Id = rx.AppointmentId
          WHERE rx.PatientId = @PatientId
            AND rx.IsFinalized = 1
          ORDER BY rx.RxDate DESC, rx.CreatedAt DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

          SELECT COUNT(*) AS Total
          FROM dbo.Prescriptions
          WHERE PatientId = @PatientId
            AND IsFinalized = 1;
        `);
    } else {
      result = await getDoctorPrescriptions(req.user.id, limit, offset);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      }
    }

    const prescriptions = result.recordsets[0].map((row) => ({
      ...row,
      IsFinalized: Boolean(row.IsFinalized),
      Items: row.Items ? JSON.parse(row.Items) : [],
    }));

    const total = result.recordsets[1]?.[0]?.Total || 0;

    return res.json({
      success: true,
      data: prescriptions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/signature-settings
// ─────────────────────────────────────────────────────────────────────────────
router.get('/signature-settings', authorize('doctor', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    const pool = await getPool();

    let targetUserId = toInt(req.user.id);
    if (ADMIN_ROLES.has(req.user.role) && toInt(req.query.userId)) {
      targetUserId = toInt(req.query.userId);
    }

    const settings = await getSignatureSettings(pool, targetUserId);
    return res.json({ success: true, data: settings });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/prescriptions/signature-settings
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/signature-settings',
  authorize('doctor', 'admin', 'superadmin'),
  (req, res, next) => {
    signatureUpload.single('signatureImage')(req, res, (uploadErr) => {
      if (uploadErr) {
        return res.status(400).json({ success: false, message: uploadErr.message || 'Invalid signature upload' });
      }
      return next();
    });
  },
  async (req, res, next) => {
    try {
      const pool = await getPool();

      let targetUserId = toInt(req.user.id);
      if (ADMIN_ROLES.has(req.user.role) && toInt(req.body.userId)) {
        targetUserId = toInt(req.body.userId);
      }

      const signaturePreference = trimOrNull(req.body.signaturePreference) || 'Stamp';
      const signatureText = trimOrNull(req.body.signatureText);
      const signatureImagePath = req.file ? `/uploads/prescriptions/signatures/${req.file.filename}` : null;

      const saved = await upsertSignatureSettings(pool, {
        userId: targetUserId,
        signatureText,
        signaturePreference,
        signatureImagePath,
      });

      return res.json({ success: true, message: 'Signature settings updated', data: saved });
    } catch (err) {
      return next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/:id/print-model
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/print-model', async (req, res, next) => {
  try {
    const prescriptionId = toInt(req.params.id);
    const pool = await getPool();

    await assertPrescriptionAccess(req, pool, prescriptionId, { write: false });
    const model = await buildPrintModel(pool, prescriptionId);

    return res.json({ success: true, data: model });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/:id/versions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/versions', async (req, res, next) => {
  try {
    const prescriptionId = toInt(req.params.id);
    const pool = await getPool();

    await assertPrescriptionAccess(req, pool, prescriptionId, { write: false });
    const versionHistory = await fetchVersionHistory(pool, prescriptionId);

    return res.json({ success: true, data: versionHistory });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/prescriptions/:id/finalize
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/finalize', authorize('doctor', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    const prescriptionId = toInt(req.params.id);
    const pool = await getPool();
    const existing = await assertPrescriptionAccess(req, pool, prescriptionId, { write: true });

    if (existing.IsFinalized) {
      return res.json({
        success: true,
        message: 'Prescription already finalized',
        data: { id: existing.Id, isFinalized: true, finalizedAt: existing.FinalizedAt },
      });
    }

    await pool.request()
      .input('Id', sql.BigInt, prescriptionId)
      .input('FinalizedBy', sql.BigInt, toInt(req.user.id))
      .query(`
        UPDATE dbo.Prescriptions
        SET IsFinalized = 1,
            FinalizedAt = SYSUTCDATETIME(),
            FinalizedBy = @FinalizedBy,
            UpdatedBy = @FinalizedBy,
            UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @Id
      `);

    return res.json({
      success: true,
      message: 'Prescription finalized',
      data: { id: prescriptionId, isFinalized: true },
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/prescriptions/:id/amend
// Creates next version as a draft linked to parent
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/amend', authorize('doctor', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    const sourceId = toInt(req.params.id);
    const pool = await getPool();
    const source = await assertPrescriptionAccess(req, pool, sourceId, { write: true });

    if (!source.IsFinalized) {
      return res.status(400).json({ success: false, message: 'Only finalized prescriptions can be amended' });
    }

    const normalizedItems = normalizeItems(req.body.items, req.body.drugs);
    const labTests = Array.isArray(req.body.labTests) ? req.body.labTests.filter(t => t.testName) : [];
    const sourceItems = await fetchPrescriptionItems(pool, sourceId);

    const hasItems = normalizedItems.length || sourceItems.length;

    const finalItems = normalizedItems.length
      ? normalizedItems
      : sourceItems.map((item, index) => normalizeItem(item, index)).filter(Boolean);

    const amendmentReason = trimOrNull(req.body.reason);
    const diagnosis = trimOrNull(req.body.diagnosis) || trimOrNull(source.Diagnosis);
    const notes = trimOrNull(req.body.notes) || trimOrNull(source.Notes);
    const validUntil = req.body.validUntil || source.ValidUntil || null;

    const payload = buildPayloadObject({
      body: req.body,
      normalizedItems: finalItems,
      fallbackDiagnosis: diagnosis,
      fallbackNotes: notes,
      fallbackValidUntil: validUntil,
    });

    if (amendmentReason) {
      payload.meta = {
        ...(payload.meta || {}),
        amendmentReason,
        amendedFromPrescriptionId: sourceId,
      };
    }

    const createdBy = toInt(req.user.id);

    const result = await withTransaction(async (transaction) => {
      const request = () => new sql.Request(transaction);

      const nextVersionNo = (toInt(source.VersionNo) || 1) + 1;
      const rxNumber = makeRxNumber(nextVersionNo);

      const insertRes = await request()
        .input('HospitalId', sql.BigInt, toInt(source.HospitalId))
        .input('PatientId', sql.BigInt, toInt(source.PatientId))
        .input('DoctorId', sql.BigInt, toInt(source.DoctorId))
        .input('AppointmentId', sql.BigInt, toInt(source.AppointmentId))
        .input('AdmissionId', sql.BigInt, toInt(source.AdmissionId))
        .input('ParentPrescriptionId', sql.BigInt, sourceId)
        .input('VersionNo', sql.Int, nextVersionNo)
        .input('RxNumber', sql.NVarChar(50), rxNumber)
        .input('Diagnosis', sql.NVarChar(sql.MAX), diagnosis)
        .input('Notes', sql.NVarChar(sql.MAX), notes)
        .input('ValidUntil', sql.Date, validUntil || null)
        .input('PayloadJson', sql.NVarChar(sql.MAX), JSON.stringify(payload))
        .input('CreatedBy', sql.BigInt, createdBy)
        .query(`
          INSERT INTO dbo.Prescriptions
            (HospitalId, PatientId, DoctorId, AppointmentId, AdmissionId,
             ParentPrescriptionId, VersionNo, IsFinalized,
             RxNumber, Diagnosis, Notes, ValidUntil, PayloadJson, CreatedBy)
          OUTPUT INSERTED.Id, INSERTED.RxNumber, INSERTED.VersionNo
          VALUES
            (@HospitalId, @PatientId, @DoctorId, @AppointmentId, @AdmissionId,
             @ParentPrescriptionId, @VersionNo, 0,
             @RxNumber, @Diagnosis, @Notes, @ValidUntil, @PayloadJson, @CreatedBy)
        `);

      const newPrescriptionId = insertRes.recordset[0].Id;

      for (const item of finalItems) {
        await request()
          .input('PrescriptionId', sql.BigInt, newPrescriptionId)
          .input('MedicineId', sql.BigInt, item.medicineId)
          .input('MedicineName', sql.NVarChar(255), item.medicineName)
          .input('Dosage', sql.NVarChar(100), item.dosage)
          .input('Frequency', sql.NVarChar(100), item.frequency)
          .input('Duration', sql.NVarChar(100), item.duration)
          .input('Quantity', sql.Int, item.quantity)
          .input('Route', sql.NVarChar(50), item.route)
          .input('Instructions', sql.NVarChar(sql.MAX), item.instructions)
          .query(`
            INSERT INTO dbo.PrescriptionItems
              (PrescriptionId, MedicineId, MedicineName, Dosage,
               Frequency, Duration, Quantity, Route, Instructions)
            VALUES
              (@PrescriptionId, @MedicineId, @MedicineName, @Dosage,
               @Frequency, @Duration, @Quantity, @Route, @Instructions)
          `);
      }

      // ── Write to new normalized tables (within the same transaction) ──
      const amendPayloadSections = payload.sections && typeof payload.sections === 'object' ? payload.sections : {};
      const amendAllergy  = payload.header?.allergy || amendPayloadSections.allergy || null;
      await upsertClinicalNotes(request, newPrescriptionId, amendPayloadSections, amendAllergy);
      await upsertLabOrders(request, newPrescriptionId, labTests);

      return {
        id: newPrescriptionId,
        rxNumber: insertRes.recordset[0].RxNumber,
        versionNo: insertRes.recordset[0].VersionNo,
      };
    });

    return res.status(201).json({
      success: true,
      message: 'Prescription amendment draft created',
      data: {
        id: result.id,
        rxNumber: result.rxNumber,
        versionNo: result.versionNo,
        parentPrescriptionId: sourceId,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/prescriptions/:id/archive
// Stores server-generated PDF path for finalized versions
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/archive', authorize('doctor', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    const prescriptionId = toInt(req.params.id);
    const pool = await getPool();
    const existing = await assertPrescriptionAccess(req, pool, prescriptionId, { write: true });

    if (!existing.IsFinalized) {
      return res.status(400).json({ success: false, message: 'Only finalized prescriptions can be archived' });
    }

    const model = await buildPrintModel(pool, prescriptionId);
    const pdfBytes = await generatePrescriptionPdf(model);

    ensureDir(PDF_UPLOAD_DIR);
    const fileName = `rx-${prescriptionId}-v${model.versionNo || 1}.pdf`;
    const absPath = path.join(PDF_UPLOAD_DIR, fileName);
    fs.writeFileSync(absPath, Buffer.from(pdfBytes));

    const relativePath = `/uploads/prescriptions/${fileName}`;

    await pool.request()
      .input('Id', sql.BigInt, prescriptionId)
      .input('ArchivedPdfPath', sql.NVarChar(1000), relativePath)
      .input('ArchivedPdfBy', sql.BigInt, toInt(req.user.id))
      .query(`
        UPDATE dbo.Prescriptions
        SET ArchivedPdfPath = @ArchivedPdfPath,
            ArchivedPdfAt = SYSUTCDATETIME(),
            ArchivedPdfBy = @ArchivedPdfBy,
            UpdatedBy = @ArchivedPdfBy,
            UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @Id
      `);

    return res.json({
      success: true,
      message: 'Prescription archived successfully',
      data: { id: prescriptionId, archivedPdfPath: relativePath },
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/:id/pdf
// Finalized prescriptions only
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const prescriptionId = toInt(req.params.id);
    const pool = await getPool();
    const existing = await assertPrescriptionAccess(req, pool, prescriptionId, { write: false });

    if (!existing.IsFinalized) {
      return res.status(400).json({ success: false, message: 'Prescription is not finalized yet' });
    }

    if (existing.ArchivedPdfPath) {
      const archivedAbsPath = resolveUploadAbsPath(existing.ArchivedPdfPath);
      if (archivedAbsPath && fs.existsSync(archivedAbsPath)) {
        return res.sendFile(archivedAbsPath);
      }
    }

    const model = await buildPrintModel(pool, prescriptionId);
    const pdfBytes = await generatePrescriptionPdf(model);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${(model.rxNumber || `RX-${prescriptionId}`).replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/prescriptions/:id  — single prescription with items
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const prescriptionId = toInt(req.params.id);
    const pool = await getPool();

    const rx = await assertPrescriptionAccess(req, pool, prescriptionId, { write: false });
    const items = await fetchPrescriptionItems(pool, prescriptionId);
    const versionHistory = await fetchVersionHistory(pool, prescriptionId);
    const { clinicalNotes, labOrders } = await fetchNormalizedClinicalData(pool, prescriptionId);

    return res.json({
      success: true,
      data: {
        ...rx,
        IsFinalized: Boolean(rx.IsFinalized),
        items,
        versionHistory,
        // Normalized structured data from new tables
        normalizedClinicalNotes: clinicalNotes,
        normalizedLabOrders: labOrders,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/prescriptions
// Creates/updates draft and supports finalize mode
// Legacy-safe inputs still supported
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authorize('doctor', 'admin', 'superadmin'), async (req, res, next) => {
  try {
    console.log('[DEBUG] POST /prescriptions Body:', JSON.stringify(req.body, null, 2));
    const {
      patientId,
      appointmentId,
      admissionId,
      diagnosis,
      notes,
      validUntil,
      items = [],
      drugs = [],
      mode,
      doctorId,
    } = req.body;

    const normalizedPatientId = toInt(patientId);
    if (!normalizedPatientId) {
      return res.status(400).json({ success: false, message: 'patientId is required' });
    }

    const normalizedItems = normalizeItems(items, drugs);
    const labTests = Array.isArray(req.body.labTests) ? req.body.labTests.filter(t => t.testName) : [];


    const requestedMode = String(mode || '').trim().toLowerCase();
    const saveMode = requestedMode === 'draft' ? 'draft' : 'finalize';

    const normalizedAppointmentId = toInt(appointmentId);
    const normalizedAdmissionId = toInt(admissionId);

    const pool = await getPool();
    const doctorContext = await resolveDoctorContext(req, pool, doctorId);
    const doctorProfileId = toInt(doctorContext.Id);
    const hospitalId = toInt(doctorContext.HospitalId) || toInt(req.user.hospitalId);
    const actingUserId = toInt(req.user.id);

    const cleanDiagnosis = trimOrNull(diagnosis);
    const cleanNotes = trimOrNull(notes);
    const normalizedValidUntil = validUntil || null;

    const payload = buildPayloadObject({
      body: req.body,
      normalizedItems,
      fallbackDiagnosis: cleanDiagnosis,
      fallbackNotes: cleanNotes,
      fallbackValidUntil: normalizedValidUntil,
    });

    const payloadJson = JSON.stringify(payload);

    const result = await withTransaction(async (transaction) => {
      const request = () => new sql.Request(transaction);

      let latestForAppointment = null;
      if (normalizedAppointmentId) {
        const latestRes = await request()
          .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
          .input('PatientId', sql.BigInt, normalizedPatientId)
          .input('DoctorId', sql.BigInt, doctorProfileId)
          .query(`
            SELECT TOP 1
              Id,
              RxNumber,
              VersionNo,
              IsFinalized,
              ParentPrescriptionId
            FROM dbo.Prescriptions
            WHERE AppointmentId = @AppointmentId
              AND PatientId = @PatientId
              AND DoctorId = @DoctorId
            ORDER BY VersionNo DESC, CreatedAt DESC, Id DESC
          `);

        latestForAppointment = latestRes.recordset[0] || null;
      }

      let prescriptionId = null;
      let rxNumber = null;
      let versionNo = 1;
      let parentPrescriptionId = null;
      let updated = false;

      if (latestForAppointment && !latestForAppointment.IsFinalized) {
        prescriptionId = toInt(latestForAppointment.Id);
        rxNumber = latestForAppointment.RxNumber;
        versionNo = toInt(latestForAppointment.VersionNo) || 1;
        updated = true;

        console.log(`[DEBUG] Updating Prescription ID ${prescriptionId}: Diagnosis="${cleanDiagnosis}", IsFinalized=${saveMode === 'finalize'}`);
        await request()
          .input('Id', sql.BigInt, prescriptionId)
          .input('AdmissionId', sql.BigInt, normalizedAdmissionId)
          .input('Diagnosis', sql.NVarChar(sql.MAX), cleanDiagnosis)
          .input('Notes', sql.NVarChar(sql.MAX), cleanNotes)
          .input('ValidUntil', sql.Date, normalizedValidUntil)
          .input('PayloadJson', sql.NVarChar(sql.MAX), payloadJson)
          .input('IsFinalized', sql.Bit, saveMode === 'finalize' ? 1 : 0)
          .input('FinalizedBy', sql.BigInt, saveMode === 'finalize' ? actingUserId : null)
          .input('UpdatedBy', sql.BigInt, actingUserId)
          .query(`
            UPDATE dbo.Prescriptions
            SET AdmissionId = COALESCE(@AdmissionId, AdmissionId),
                Diagnosis = @Diagnosis,
                Notes = @Notes,
                ValidUntil = @ValidUntil,
                PayloadJson = @PayloadJson,
                IsFinalized = @IsFinalized,
                FinalizedAt = CASE WHEN @IsFinalized = 1 THEN SYSUTCDATETIME() ELSE NULL END,
                FinalizedBy = CASE WHEN @IsFinalized = 1 THEN @FinalizedBy ELSE NULL END,
                UpdatedBy = @UpdatedBy,
                UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @Id
          `);

        await request()
          .input('PrescriptionId', sql.BigInt, prescriptionId)
          .query(`DELETE FROM dbo.PrescriptionItems WHERE PrescriptionId = @PrescriptionId`);
      } else {
        if (latestForAppointment) {
          parentPrescriptionId = toInt(latestForAppointment.Id);
          versionNo = (toInt(latestForAppointment.VersionNo) || 1) + 1;
        }

        rxNumber = makeRxNumber(versionNo);

        console.log(`[DEBUG] Inserting New Prescription: Diagnosis="${cleanDiagnosis}", IsFinalized=${saveMode === 'finalize'}`);
        const insertRes = await request()
          .input('HospitalId', sql.BigInt, hospitalId)
          .input('PatientId', sql.BigInt, normalizedPatientId)
          .input('DoctorId', sql.BigInt, doctorProfileId)
          .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
          .input('AdmissionId', sql.BigInt, normalizedAdmissionId)
          .input('ParentPrescriptionId', sql.BigInt, parentPrescriptionId)
          .input('VersionNo', sql.Int, versionNo)
          .input('IsFinalized', sql.Bit, saveMode === 'finalize' ? 1 : 0)
          .input('FinalizedBy', sql.BigInt, saveMode === 'finalize' ? actingUserId : null)
          .input('RxNumber', sql.NVarChar(50), rxNumber)
          .input('Diagnosis', sql.NVarChar(sql.MAX), cleanDiagnosis)
          .input('Notes', sql.NVarChar(sql.MAX), cleanNotes)
          .input('ValidUntil', sql.Date, normalizedValidUntil)
          .input('PayloadJson', sql.NVarChar(sql.MAX), payloadJson)
          .input('CreatedBy', sql.BigInt, actingUserId)
          .query(`
            INSERT INTO dbo.Prescriptions
              (HospitalId, PatientId, DoctorId, AppointmentId, AdmissionId,
               ParentPrescriptionId, VersionNo, IsFinalized, FinalizedAt, FinalizedBy,
               RxNumber, Diagnosis, Notes, ValidUntil, PayloadJson, CreatedBy)
            OUTPUT INSERTED.Id, INSERTED.RxNumber, INSERTED.VersionNo
            VALUES
              (@HospitalId, @PatientId, @DoctorId, @AppointmentId, @AdmissionId,
               @ParentPrescriptionId, @VersionNo, @IsFinalized,
               CASE WHEN @IsFinalized = 1 THEN SYSUTCDATETIME() ELSE NULL END,
               CASE WHEN @IsFinalized = 1 THEN @FinalizedBy ELSE NULL END,
               @RxNumber, @Diagnosis, @Notes, @ValidUntil, @PayloadJson, @CreatedBy)
          `);

        prescriptionId = insertRes.recordset[0].Id;
        rxNumber = insertRes.recordset[0].RxNumber;
        versionNo = insertRes.recordset[0].VersionNo;
      }

      for (const item of normalizedItems) {
        await request()
          .input('PrescriptionId', sql.BigInt, prescriptionId)
          .input('MedicineId', sql.BigInt, item.medicineId)
          .input('MedicineName', sql.NVarChar(255), item.medicineName)
          .input('Dosage', sql.NVarChar(100), item.dosage)
          .input('Frequency', sql.NVarChar(100), item.frequency)
          .input('Duration', sql.NVarChar(100), item.duration)
          .input('Quantity', sql.Int, item.quantity)
          .input('Route', sql.NVarChar(50), item.route)
          .input('Instructions', sql.NVarChar(sql.MAX), item.instructions)
          .query(`
            INSERT INTO dbo.PrescriptionItems
              (PrescriptionId, MedicineId, MedicineName, Dosage,
               Frequency, Duration, Quantity, Route, Instructions)
            VALUES
              (@PrescriptionId, @MedicineId, @MedicineName, @Dosage,
               @Frequency, @Duration, @Quantity, @Route, @Instructions)
          `);
      }

      // ── Write to new normalized tables (within the same transaction) ──
      const payloadSections = payload.sections && typeof payload.sections === 'object' ? payload.sections : {};
      const payloadAllergy  = payload.header?.allergy || payloadSections.allergy || null;
      await upsertClinicalNotes(request, prescriptionId, payloadSections, payloadAllergy);
      await upsertLabOrders(request, prescriptionId, labTests);

      return {
        prescriptionId,
        rxNumber,
        versionNo,
        updated,
        isFinalized: saveMode === 'finalize',
      };
    });

    return res.status(result.updated ? 200 : 201).json({
      success: true,
      message: saveMode === 'draft'
        ? (result.updated ? 'Prescription draft updated' : 'Prescription draft created')
        : (result.updated ? 'Prescription finalized' : 'Prescription created and finalized'),
      data: {
        id: result.prescriptionId,
        rxNumber: result.rxNumber,
        versionNo: result.versionNo,
        updated: result.updated,
        isFinalized: result.isFinalized,
      },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
