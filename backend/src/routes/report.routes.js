const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool, sql, withTransaction } = require('../config/database');
const { requireActivePatientProfile } = require('../services/patientAccess.service');
const labService = require('../services/lab.service');

const LAB_OPERATOR_ROLES = ['nurse', 'labtech', 'lab_technician', 'Lab Technician', 'Lab Assistant', 'admin', 'superadmin'];
const LAB_HEAD_ROLES = ['lab_incharge', 'labincharge', 'Lab Incharge', 'admin', 'superadmin'];
const REPORT_VIEW_ROLES = ['patient', 'doctor', 'nurse', 'labtech', 'lab_technician', 'lab_incharge', 'labincharge', 'Lab Incharge', 'admin', 'superadmin', 'auditor'];
const REVIEW_ROLES = ['doctor', 'admin', 'superadmin'];
const REPORT_SCHEMA_CACHE_TTL_MS = 60 * 1000;
const reportSchemaCache = {
  loadedAt: 0,
  value: null,
};

router.use(protect);

const parseInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePriority = (value = 'Routine') => {
  const normalized = String(value || 'Routine').trim().toLowerCase();
  if (normalized === 'stat') return 'STAT';
  if (normalized === 'urgent') return 'Urgent';
  return 'Routine';
};

const normalizeBoolean = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return null;
};

const parseJsonArray = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ATTACHMENT_STORAGE_ROOT = path.resolve(__dirname, '../../uploads/lab');
const ATTACHMENT_CATEGORIES = new Set(['ReportPdf', 'Image', 'Audio', 'Video', 'Worksheet']);
const ATTACHMENT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const sqlNullable = (condition, expression, sqlType) => (
  condition ? expression : `CAST(NULL AS ${sqlType})`
);
const getLabOrderItemOrderBy = (schema, alias = 'loi') => (
  schema?.labOrderItems?.DisplaySequence ? `${alias}.DisplaySequence, ${alias}.Id` : `${alias}.Id`
);

const sanitizeFileName = (value) => {
  const cleaned = String(value || 'attachment').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return cleaned || 'attachment';
};

const normalizeAttachmentCategory = (value, contentType = '') => {
  const normalized = String(value || '').trim();
  if (ATTACHMENT_CATEGORIES.has(normalized)) return normalized;

  const mime = String(contentType || '').toLowerCase();
  if (mime.includes('pdf')) return 'ReportPdf';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Video';
  return 'Worksheet';
};

const decodeBase64Content = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.includes(',') ? raw.split(',').pop() : raw;
  return Buffer.from(normalized, 'base64');
};

const normalizeAttachmentInput = (attachment = {}) => ({
  fileCategory: attachment.fileCategory || attachment.FileCategory || null,
  fileName: attachment.fileName || attachment.FileName || null,
  storagePath: attachment.storagePath || attachment.StoragePath || null,
  contentType: attachment.contentType || attachment.ContentType || null,
  fileSizeBytes: parseInteger(attachment.fileSizeBytes || attachment.FileSizeBytes),
  isPrimary: Boolean(attachment.isPrimary || attachment.IsPrimary),
  contentBase64: attachment.contentBase64 || attachment.ContentBase64 || attachment.fileData || attachment.FileData || null,
});

const isApprovedForClinicalReview = (order = {}, schema = null) => {
  const workflowStage = String(order.WorkflowStage || order.workflowStage || '').trim().toLowerCase();

  if (order.VerifiedAt || order.verifiedAt) return true;
  if (!schema?.labOrders?.WorkflowStage) return false;

  return ['doctorreview', 'reviewed', 'released'].includes(workflowStage);
};

const isReleasedToPatient = (order = {}, schema = null) => {
  const workflowStage = String(order.WorkflowStage || order.workflowStage || '').trim().toLowerCase();

  if (schema?.labOrders?.ReleasedToPatientAt && (order.ReleasedToPatientAt || order.releasedToPatientAt)) {
    return true;
  }

  return workflowStage === 'released';
};

const getPatientVisibleOrderPredicate = (schema, alias = 'lo') => {
  if (schema?.labOrders?.ReleasedToPatientAt) {
    return schema?.labOrders?.WorkflowStage
      ? `(${alias}.ReleasedToPatientAt IS NOT NULL OR ${alias}.WorkflowStage = 'Released')`
      : `${alias}.ReleasedToPatientAt IS NOT NULL`;
  }

  if (schema?.labOrders?.WorkflowStage) {
    return `${alias}.WorkflowStage = 'Released'`;
  }

  return `${alias}.VerifiedAt IS NOT NULL`;
};

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ATTACHMENT_UPLOAD_MAX_BYTES,
    files: 6,
  },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const allowed = mime.includes('pdf') || mime.startsWith('video/') || mime.startsWith('image/');
    if (!allowed) {
      return cb(new Error('Only PDF, image, and video files are allowed for lab attachments'));
    }
    return cb(null, true);
  },
});

const persistAttachmentDescriptor = async ({ labOrderId, attachment }) => {
  const normalized = normalizeAttachmentInput(attachment);
  if (!normalized.fileName) return null;

  if (normalized.storagePath) {
    return {
      ...normalized,
      fileCategory: normalizeAttachmentCategory(normalized.fileCategory, normalized.contentType),
    };
  }

  if (!normalized.contentBase64) return null;

  const fileBuffer = decodeBase64Content(normalized.contentBase64);
  if (!fileBuffer?.length) return null;

  const safeFileName = sanitizeFileName(normalized.fileName);
  const fileToken = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const storedFileName = `${fileToken}-${safeFileName}`;
  const orderFolder = path.join(ATTACHMENT_STORAGE_ROOT, String(labOrderId));
  await fs.mkdir(orderFolder, { recursive: true });
  await fs.writeFile(path.join(orderFolder, storedFileName), fileBuffer);

  return {
    ...normalized,
    fileCategory: normalizeAttachmentCategory(normalized.fileCategory, normalized.contentType),
    storagePath: `/uploads/lab/${labOrderId}/${storedFileName}`,
    fileSizeBytes: normalized.fileSizeBytes || fileBuffer.length,
  };
};

const persistUploadedFile = async ({ labOrderId, file, isPrimary = false }) => {
  if (!file?.buffer?.length || !file.originalname) return null;

  const safeFileName = sanitizeFileName(file.originalname);
  const fileToken = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const storedFileName = `${fileToken}-${safeFileName}`;
  const orderFolder = path.join(ATTACHMENT_STORAGE_ROOT, String(labOrderId));
  await fs.mkdir(orderFolder, { recursive: true });
  await fs.writeFile(path.join(orderFolder, storedFileName), file.buffer);

  return {
    fileCategory: normalizeAttachmentCategory(null, file.mimetype),
    fileName: file.originalname,
    storagePath: `/uploads/lab/${labOrderId}/${storedFileName}`,
    contentType: file.mimetype || null,
    fileSizeBytes: file.size || file.buffer.length,
    isPrimary,
  };
};

const insertAttachmentRecord = async ({
  requestFactory,
  labOrderId,
  labOrderItemId = null,
  actorUserId,
  attachment,
}) => {
  if (!attachment?.fileName || !attachment?.storagePath) return null;

  const request = requestFactory();

  await request
    .input('LabOrderId', sql.BigInt, parseInteger(labOrderId))
    .input('LabOrderItemId', sql.BigInt, parseInteger(labOrderItemId))
    .input('FileCategory', sql.NVarChar(20), attachment.fileCategory)
    .input('FileName', sql.NVarChar(260), attachment.fileName)
    .input('StoragePath', sql.NVarChar(700), attachment.storagePath)
    .input('ContentType', sql.NVarChar(120), attachment.contentType)
    .input('FileSizeBytes', sql.BigInt, attachment.fileSizeBytes)
    .input('IsPrimary', sql.Bit, Boolean(attachment.isPrimary))
    .input('UploadedByUserId', sql.BigInt, parseInteger(actorUserId))
    .query(`
      INSERT INTO dbo.LabResultAttachments
        (LabOrderId, LabOrderItemId, FileCategory, FileName, StoragePath, ContentType, FileSizeBytes, IsPrimary, UploadedByUserId)
      VALUES
        (@LabOrderId, @LabOrderItemId, @FileCategory, @FileName, @StoragePath, @ContentType, @FileSizeBytes, @IsPrimary, @UploadedByUserId)
    `);

  return attachment;
};

const getReportSchema = async (pool = null) => {
  const now = Date.now();
  if (reportSchemaCache.value && (now - reportSchemaCache.loadedAt) < REPORT_SCHEMA_CACHE_TTL_MS) {
    return reportSchemaCache.value;
  }

  const activePool = pool || await getPool();
  const schemaResult = await activePool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID('dbo.LabSamples', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabSamples,
      CASE WHEN OBJECT_ID('dbo.LabOrderStatusHistory', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabOrderStatusHistory,
      CASE WHEN OBJECT_ID('dbo.LabResultAttachments', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabResultAttachments,
      CASE WHEN OBJECT_ID('dbo.EmrLabReportReviews', 'U') IS NULL THEN 0 ELSE 1 END AS HasEmrLabReportReviews,
      CASE WHEN OBJECT_ID('dbo.EmrClinicalNotes', 'U') IS NULL THEN 0 ELSE 1 END AS HasEmrClinicalNotes,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'WorkflowStage') IS NULL THEN 0 ELSE 1 END AS HasLabOrdersWorkflowStage,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'ClinicalIndication') IS NULL THEN 0 ELSE 1 END AS HasLabOrdersClinicalIndication,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'DoctorInstructions') IS NULL THEN 0 ELSE 1 END AS HasLabOrdersDoctorInstructions,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'ReleasedToPatientAt') IS NULL THEN 0 ELSE 1 END AS HasLabOrdersReleasedToPatientAt,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'ReleasedToPatientBy') IS NULL THEN 0 ELSE 1 END AS HasLabOrdersReleasedToPatientBy,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'UpdatedBy') IS NULL THEN 0 ELSE 1 END AS HasLabOrdersUpdatedBy,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'CriteriaText') IS NULL THEN 0 ELSE 1 END AS HasLabOrderItemsCriteriaText,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'AdditionalDetails') IS NULL THEN 0 ELSE 1 END AS HasLabOrderItemsAdditionalDetails,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'TechnicianNotes') IS NULL THEN 0 ELSE 1 END AS HasLabOrderItemsTechnicianNotes,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'DisplaySequence') IS NULL THEN 0 ELSE 1 END AS HasLabOrderItemsDisplaySequence,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'UpdatedAt') IS NULL THEN 0 ELSE 1 END AS HasLabOrderItemsUpdatedAt
  `);

  const row = schemaResult.recordset?.[0] || {};
  const schema = {
    hasLabSamples: Boolean(row.HasLabSamples),
    hasLabOrderStatusHistory: Boolean(row.HasLabOrderStatusHistory),
    hasLabResultAttachments: Boolean(row.HasLabResultAttachments),
    hasEmrLabReportReviews: Boolean(row.HasEmrLabReportReviews),
    hasEmrClinicalNotes: Boolean(row.HasEmrClinicalNotes),
    labOrders: {
      WorkflowStage: Boolean(row.HasLabOrdersWorkflowStage),
      ClinicalIndication: Boolean(row.HasLabOrdersClinicalIndication),
      DoctorInstructions: Boolean(row.HasLabOrdersDoctorInstructions),
      ReleasedToPatientAt: Boolean(row.HasLabOrdersReleasedToPatientAt),
      ReleasedToPatientBy: Boolean(row.HasLabOrdersReleasedToPatientBy),
      UpdatedBy: Boolean(row.HasLabOrdersUpdatedBy),
    },
    labOrderItems: {
      CriteriaText: Boolean(row.HasLabOrderItemsCriteriaText),
      AdditionalDetails: Boolean(row.HasLabOrderItemsAdditionalDetails),
      TechnicianNotes: Boolean(row.HasLabOrderItemsTechnicianNotes),
      DisplaySequence: Boolean(row.HasLabOrderItemsDisplaySequence),
      UpdatedAt: Boolean(row.HasLabOrderItemsUpdatedAt),
    },
  };

  reportSchemaCache.loadedAt = now;
  reportSchemaCache.value = schema;
  return schema;
};

const persistAttachmentRecords = async ({
  requestFactory,
  labOrderId,
  labOrderItemId = null,
  actorUserId,
  attachments = [],
  schema = null,
}) => {
  const effectiveSchema = schema || await getReportSchema();
  if (!effectiveSchema.hasLabResultAttachments || !attachments.length) {
    return [];
  }

  const records = [];

  for (const attachment of attachments) {
    const persisted = await persistAttachmentDescriptor({ labOrderId, attachment });
    if (!persisted?.fileName || !persisted?.storagePath) continue;
    await insertAttachmentRecord({
      requestFactory,
      labOrderId,
      labOrderItemId,
      actorUserId,
      attachment: persisted,
    });
    records.push(persisted);
  }

  return records;
};

const buildOrderTestsJson = (schema, orderAlias = 'lo', patientAlias = 'p') => `
  (
    SELECT
      loi.Id,
      lt.Id AS TestId,
      lt.Name AS TestName,
      lt.Category,
      lt.Unit,
      loi.ResultValue,
      loi.ResultUnit,
      COALESCE(
        loi.NormalRange,
        CASE
          WHEN ${patientAlias}.Gender = 'Female' THEN lt.NormalRangeFemale
          WHEN ${patientAlias}.Gender = 'Male' THEN lt.NormalRangeMale
          ELSE COALESCE(lt.NormalRangeChild, lt.NormalRangeMale, lt.NormalRangeFemale)
        END
      ) AS NormalRange,
      loi.IsAbnormal,
      loi.Remarks,
      loi.Status AS ItemStatus
    FROM dbo.LabOrderItems loi
    JOIN dbo.LabTests lt ON lt.Id = loi.TestId
    WHERE loi.LabOrderId = ${orderAlias}.Id
    ORDER BY ${getLabOrderItemOrderBy(schema, 'loi')}
    FOR JSON PATH
  ) AS Tests
`;

const toPagedResponse = (result, page, limit) => {
  const rows = Array.isArray(result.recordsets?.[0]) ? result.recordsets[0] : [];
  const total = result.recordsets?.[1]?.[0]?.Total || 0;

  return {
    rows: rows.map((row) => ({
      ...row,
      Tests: parseJsonArray(row.Tests),
    })),
    meta: {
      total,
      page,
      limit,
      pages: limit ? Math.ceil(total / limit) : 1,
    },
  };
};

const resolveHospitalId = (req) => {
  if (req.user.role === 'superadmin') {
    return parseInteger(req.query.hospitalId || req.body.hospitalId);
  }

  return parseInteger(req.user.hospitalId || req.headers['x-hospital-id']);
};

const addHospitalInput = (request, hospitalId) => {
  request.input('HospitalId', sql.BigInt, hospitalId);
  return request;
};

const generateOrderNumber = () => {
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return `LAB-${dateStamp}-${suffix}`;
};

const generateSampleCode = (itemId) => {
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SMP-${dateStamp}-${String(itemId).padStart(5, '0')}`;
};

const getTransactionRequest = (transaction) => new sql.Request(transaction);

const getDoctorProfile = async (pool, userId) => {
  const result = await pool.request()
    .input('UserId', sql.BigInt, parseInteger(userId))
    .query(`
      SELECT TOP 1 Id, HospitalId, DepartmentId
      FROM dbo.DoctorProfiles
      WHERE UserId = @UserId
    `);

  return result.recordset[0] || null;
};

const getCompletedAppointmentForDoctor = async ({
  pool,
  appointmentId,
  patientId,
  doctorId,
  hospitalId = null,
}) => {
  if (!appointmentId || !patientId || !doctorId) return null;

  const result = await pool.request()
    .input('AppointmentId', sql.BigInt, parseInteger(appointmentId))
    .input('PatientId', sql.BigInt, parseInteger(patientId))
    .input('DoctorId', sql.BigInt, parseInteger(doctorId))
    .input('HospitalId', sql.BigInt, parseInteger(hospitalId))
    .query(`
      SELECT TOP 1
        a.Id,
        a.Status,
        a.PatientId,
        a.DoctorId,
        a.HospitalId,
        a.AppointmentDate
      FROM dbo.Appointments a
      WHERE a.Id = @AppointmentId
        AND a.PatientId = @PatientId
        AND a.DoctorId = @DoctorId
        AND a.Status = 'Completed'
        AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
    `);

  return result.recordset[0] || null;
};

const getScopedOrderWhereClause = (alias = 'lo') => `
  (@HospitalId IS NULL OR ${alias}.HospitalId = @HospitalId)
`;

const getScopedItemContext = async (request, itemId, hospitalId, schema = null) => {
  const effectiveSchema = schema || await getReportSchema();
  const sampleJoin = effectiveSchema.hasLabSamples
    ? 'LEFT JOIN dbo.LabSamples ls ON ls.LabOrderItemId = loi.Id'
    : '';

  const result = await request
    .input('ItemId', sql.BigInt, parseInteger(itemId))
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT TOP 1
        loi.Id AS ItemId,
        loi.LabOrderId,
        loi.TestId,
        loi.Status AS ItemStatus,
        loi.TechnicianNotes,
        loi.ResultValue,
        loi.ResultUnit,
        loi.NormalRange,
        loi.IsAbnormal,
        loi.Remarks,
        lo.OrderNumber,
        lo.HospitalId,
        lo.PatientId,
        lo.OrderedBy,
        lo.Status AS OrderStatus,
        ${sqlNullable(effectiveSchema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage,
        lo.Priority,
        lo.CollectedAt,
        lo.ReportedAt,
        lt.Name AS TestName,
        lt.Unit AS DefaultUnit,
        lt.SampleType,
        lt.NormalRangeMale,
        lt.NormalRangeFemale,
        lt.NormalRangeChild,
        p.Gender,
        ${sqlNullable(effectiveSchema.labOrderItems.TechnicianNotes, 'loi.TechnicianNotes', 'NVARCHAR(1000)')} AS TechnicianNotes,
        ${sqlNullable(effectiveSchema.hasLabSamples, 'ls.Id', 'BIGINT')} AS SampleId,
        ${sqlNullable(effectiveSchema.hasLabSamples, 'ls.SampleCode', 'NVARCHAR(40)')} AS SampleCode,
        ${sqlNullable(effectiveSchema.hasLabSamples, 'ls.SampleStatus', 'NVARCHAR(30)')} AS SampleStatus
      FROM dbo.LabOrderItems loi
      JOIN dbo.LabOrders lo ON lo.Id = loi.LabOrderId
      JOIN dbo.LabTests lt ON lt.Id = loi.TestId
      JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
      ${sampleJoin}
      WHERE loi.Id = @ItemId
        AND (@HospitalId IS NULL OR lo.HospitalId = @HospitalId)
    `);

  return result.recordset[0] || null;
};

const getOrderAggregate = async (request, labOrderId) => {
  const result = await request
    .input('LabOrderId', sql.BigInt, parseInteger(labOrderId))
    .query(`
      SELECT
        COUNT(*) AS TotalItems,
        SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedItems,
        SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) AS RejectedItems,
        SUM(CASE WHEN Status IN ('Processing', 'SampleCollected') THEN 1 ELSE 0 END) AS ProcessingItems,
        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) AS PendingItems
      FROM dbo.LabOrderItems
      WHERE LabOrderId = @LabOrderId
    `);

  return result.recordset[0] || {
    TotalItems: 0,
    CompletedItems: 0,
    RejectedItems: 0,
    ProcessingItems: 0,
    PendingItems: 0,
  };
};

const insertStatusHistory = async (request, payload, schema = null) => {
  const effectiveSchema = schema || await getReportSchema();
  const {
    labOrderId,
    labOrderItemId = null,
    labSampleId = null,
    scope = 'Order',
    fromStatus = null,
    toStatus,
    changedByUserId = null,
    note = null,
  } = payload;

  if (!toStatus) return;
  if (fromStatus === toStatus && !note) return;
  if (!effectiveSchema.hasLabOrderStatusHistory) return;

  await request
    .input('LabOrderId', sql.BigInt, parseInteger(labOrderId))
    .input('LabOrderItemId', sql.BigInt, parseInteger(labOrderItemId))
    .input('LabSampleId', sql.BigInt, parseInteger(labSampleId))
    .input('Scope', sql.NVarChar(20), scope)
    .input('FromStatus', sql.NVarChar(30), fromStatus)
    .input('ToStatus', sql.NVarChar(30), toStatus)
    .input('ChangedByUserId', sql.BigInt, parseInteger(changedByUserId))
    .input('Note', sql.NVarChar(500), note || null)
    .query(`
      INSERT INTO dbo.LabOrderStatusHistory
        (LabOrderId, LabOrderItemId, LabSampleId, Scope, FromStatus, ToStatus, ChangedByUserId, Note)
      VALUES
        (@LabOrderId, @LabOrderItemId, @LabSampleId, @Scope, @FromStatus, @ToStatus, @ChangedByUserId, @Note)
    `);
};

const ensurePendingReview = async (request, context, schema = null) => {
  const effectiveSchema = schema || await getReportSchema();
  if (!parseInteger(context?.OrderedBy)) return;
  if (!effectiveSchema.hasEmrLabReportReviews) return;

  await request
    .input('LabOrderId', sql.BigInt, parseInteger(context.LabOrderId))
    .input('PatientId', sql.BigInt, parseInteger(context.PatientId))
    .input('DoctorId', sql.BigInt, parseInteger(context.OrderedBy))
    .query(`
      IF NOT EXISTS (
        SELECT 1
        FROM dbo.EmrLabReportReviews
        WHERE LabOrderId = @LabOrderId
          AND DoctorId = @DoctorId
      )
      BEGIN
        INSERT INTO dbo.EmrLabReportReviews
          (LabOrderId, PatientId, DoctorId, ReviewStatus)
        VALUES
          (@LabOrderId, @PatientId, @DoctorId, 'Pending');
      END
    `);
};

const resolveDefaultNormalRange = (context) => {
  if (context?.NormalRange) return context.NormalRange;

  const gender = String(context?.Gender || '').trim().toLowerCase();
  if (gender === 'female' && context?.NormalRangeFemale) return context.NormalRangeFemale;
  if (gender === 'male' && context?.NormalRangeMale) return context.NormalRangeMale;
  return context?.NormalRangeChild || context?.NormalRangeMale || context?.NormalRangeFemale || null;
};

const updateOrderStatusFromItems = async (request, context, actorUserId, options = {}, schema = null) => {
  const effectiveSchema = schema || await getReportSchema();
  const { releaseToPatient = false } = options;
  const aggregate = await getOrderAggregate(request, context.LabOrderId);

  let nextStatus = context.OrderStatus;
  let nextStage = effectiveSchema.labOrders.WorkflowStage
    ? (context.WorkflowStage || 'Ordered')
    : null;

  if (aggregate.TotalItems > 0 && (aggregate.CompletedItems + aggregate.RejectedItems) === aggregate.TotalItems) {
    nextStatus = 'Completed';
    if (effectiveSchema.labOrders.WorkflowStage) {
      nextStage = releaseToPatient ? 'Released' : 'Completed';
    }
  } else if ((aggregate.ProcessingItems + aggregate.CompletedItems) > 0) {
    nextStatus = 'Processing';
    if (effectiveSchema.labOrders.WorkflowStage) {
      nextStage = 'Processing';
    }
  } else {
    nextStatus = 'Pending';
    if (effectiveSchema.labOrders.WorkflowStage) {
      nextStage = 'Ordered';
    }
  }

  const updateAssignments = [
    'Status = @Status',
    effectiveSchema.labOrders.WorkflowStage ? 'WorkflowStage = @WorkflowStage' : null,
    `ReportedAt = CASE
          WHEN @Status = 'Completed' THEN COALESCE(ReportedAt, SYSUTCDATETIME())
          ELSE ReportedAt
        END`,
    `ReportedBy = CASE
          WHEN @Status = 'Completed' THEN COALESCE(ReportedBy, @ReportedBy)
          ELSE ReportedBy
        END`,
    effectiveSchema.labOrders.ReleasedToPatientAt
      ? `ReleasedToPatientAt = CASE
          WHEN @WorkflowStage = 'Released' THEN COALESCE(ReleasedToPatientAt, SYSUTCDATETIME())
          ELSE ReleasedToPatientAt
        END`
      : null,
    effectiveSchema.labOrders.ReleasedToPatientBy
      ? `ReleasedToPatientBy = CASE
          WHEN @WorkflowStage = 'Released' THEN COALESCE(ReleasedToPatientBy, @ReleasedToPatientBy)
          ELSE ReleasedToPatientBy
        END`
      : null,
    effectiveSchema.labOrders.UpdatedBy ? 'UpdatedBy = @UpdatedBy' : null,
    'UpdatedAt = SYSUTCDATETIME()',
  ].filter(Boolean).join(',\n        ');

  await request
    .input('LabOrderId', sql.BigInt, parseInteger(context.LabOrderId))
    .input('Status', sql.NVarChar(20), nextStatus)
    .input('WorkflowStage', sql.NVarChar(30), nextStage)
    .input('UpdatedBy', sql.BigInt, parseInteger(actorUserId))
    .input('ReportedBy', sql.BigInt, parseInteger(actorUserId))
    .input('ReleasedToPatientBy', sql.BigInt, releaseToPatient ? parseInteger(actorUserId) : null)
    .query(`
      UPDATE dbo.LabOrders
      SET
        ${updateAssignments}
      WHERE Id = @LabOrderId
    `);

  await insertStatusHistory(request, {
    labOrderId: context.LabOrderId,
    scope: 'Order',
    fromStatus: context.OrderStatus,
    toStatus: nextStatus,
    changedByUserId: actorUserId,
    note: options.historyNote || null,
  }, effectiveSchema);

  if (nextStatus === 'Completed' && ['DoctorReview', 'Released'].includes(String(nextStage || ''))) {
    await ensurePendingReview(request, context, effectiveSchema);
  }

  return { nextStatus, nextStage };
};

router.get('/my',
  authorize(...REPORT_VIEW_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const role = req.user.role;
      const limit = Math.min(parseInteger(req.query.limit) || 20, 200);
      const page = Math.max(parseInteger(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;
      const hospitalId = resolveHospitalId(req);

      if (role === 'patient') {
        const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
        const patientId = activeProfile.patientId;

        const result = await addHospitalInput(pool.request(), hospitalId)
          .input('PatientId', sql.BigInt, patientId)
          .input('Limit', sql.Int, limit)
          .input('Offset', sql.Int, offset)
          .query(`
            SELECT
              lo.Id,
              lo.OrderNumber,
              lo.OrderDate,
              lo.Status,
              lo.Priority,
              ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage,
              lo.Notes,
              lo.CollectedAt,
              lo.ReportedAt,
              lo.VerifiedAt,
              ${sqlNullable(schema.labOrders.ReleasedToPatientAt, 'lo.ReleasedToPatientAt', 'DATETIME2(0)')} AS ReleasedToPatientAt,
              lo.CreatedAt,
              u.FirstName + ' ' + u.LastName AS OrderedByName,
              a.AppointmentNo,
              a.AppointmentDate,
              ${buildOrderTestsJson(schema, 'lo', 'p')}
            FROM dbo.LabOrders lo
            JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
            LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
            LEFT JOIN dbo.Users u ON u.Id = dp.UserId
            LEFT JOIN dbo.Appointments a ON a.Id = lo.AppointmentId
            WHERE lo.PatientId = @PatientId
              AND ${getScopedOrderWhereClause('lo')}
              AND ${getPatientVisibleOrderPredicate(schema, 'lo')}
            ORDER BY lo.OrderDate DESC, lo.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

            SELECT COUNT(*) AS Total
            FROM dbo.LabOrders lo
            WHERE lo.PatientId = @PatientId
              AND ${getScopedOrderWhereClause('lo')}
              AND ${getPatientVisibleOrderPredicate(schema, 'lo')};
          `);

        const payload = toPagedResponse(result, page, limit);

        return res.json({
          success: true,
          data: payload.rows,
          pagination: payload.meta,
          meta: payload.meta,
        });
      }

      if (role === 'doctor') {
        const doctorProfile = await getDoctorProfile(pool, req.user.id);
        if (!doctorProfile) {
          return res.status(404).json({ success: false, message: 'Doctor profile not found' });
        }

        const result = await addHospitalInput(pool.request(), hospitalId || doctorProfile.HospitalId)
          .input('DoctorId', sql.BigInt, doctorProfile.Id)
          .input('Limit', sql.Int, limit)
          .input('Offset', sql.Int, offset)
          .query(`
            SELECT
              lo.Id,
              lo.OrderNumber,
              lo.OrderDate,
              lo.Status,
              lo.Priority,
              ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage,
              lo.Notes,
              lo.CollectedAt,
              lo.ReportedAt,
              lo.VerifiedAt,
              ${sqlNullable(schema.labOrders.ReleasedToPatientAt, 'lo.ReleasedToPatientAt', 'DATETIME2(0)')} AS ReleasedToPatientAt,
              lo.CreatedAt,
              p.Id AS PatientId,
              p.FirstName + ' ' + p.LastName AS PatientName,
              p.UHID,
              a.AppointmentNo,
              a.AppointmentDate,
              ${buildOrderTestsJson(schema, 'lo', 'p')}
            FROM dbo.LabOrders lo
            JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
            LEFT JOIN dbo.Appointments a ON a.Id = lo.AppointmentId
            WHERE lo.OrderedBy = @DoctorId
              AND ${getScopedOrderWhereClause('lo')}
            ORDER BY lo.OrderDate DESC, lo.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

            SELECT COUNT(*) AS Total
            FROM dbo.LabOrders lo
            WHERE lo.OrderedBy = @DoctorId
              AND ${getScopedOrderWhereClause('lo')};
          `);

        const payload = toPagedResponse(result, page, limit);

        return res.json({
          success: true,
          data: payload.rows,
          pagination: payload.meta,
          meta: payload.meta,
        });
      }

      const result = await addHospitalInput(pool.request(), hospitalId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT
            lo.Id,
            lo.OrderNumber,
            lo.OrderDate,
            lo.Status,
            lo.Priority,
            ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage,
            lo.Notes,
            lo.CollectedAt,
            lo.ReportedAt,
            lo.VerifiedAt,
            ${sqlNullable(schema.labOrders.ReleasedToPatientAt, 'lo.ReleasedToPatientAt', 'DATETIME2(0)')} AS ReleasedToPatientAt,
            lo.CreatedAt,
            p.Id AS PatientId,
            p.FirstName + ' ' + p.LastName AS PatientName,
            p.UHID,
            u.FirstName + ' ' + u.LastName AS OrderedByName,
            a.AppointmentNo,
            a.AppointmentDate,
            ${buildOrderTestsJson(schema, 'lo', 'p')}
          FROM dbo.LabOrders lo
          JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
          LEFT JOIN dbo.Users u ON u.Id = dp.UserId
          LEFT JOIN dbo.Appointments a ON a.Id = lo.AppointmentId
          WHERE ${getScopedOrderWhereClause('lo')}
          ORDER BY lo.OrderDate DESC, lo.CreatedAt DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

          SELECT COUNT(*) AS Total
          FROM dbo.LabOrders lo
          WHERE ${getScopedOrderWhereClause('lo')};
        `);

      const payload = toPagedResponse(result, page, limit);

      res.json({
        success: true,
        data: payload.rows,
        pagination: payload.meta,
        meta: payload.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/worklist',
  authorize(...LAB_OPERATOR_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const hospitalId = resolveHospitalId(req);
      const limit = Math.min(parseInteger(req.query.limit) || 100, 500);
      const page = Math.max(parseInteger(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const sampleJoin = schema.hasLabSamples
        ? 'LEFT JOIN dbo.LabSamples ls ON ls.LabOrderItemId = loi.Id'
        : '';
      const sampleSearch = schema.hasLabSamples
        ? "OR ISNULL(ls.SampleCode, '') LIKE '%' + @Search + '%'"
        : '';

      const result = await addHospitalInput(pool.request(), hospitalId)
        .input('Search', sql.NVarChar(200), search)
        .input('Status', sql.NVarChar(20), status)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT
            loi.Id AS ItemId,
            lo.Id AS LabOrderId,
            lo.OrderNumber,
            lo.OrderDate,
            lo.Status AS OrderStatus,
            lo.Priority,
            ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage,
            lo.Notes,
            ${sqlNullable(schema.labOrders.ClinicalIndication, 'lo.ClinicalIndication', 'NVARCHAR(1000)')} AS ClinicalIndication,
            ${sqlNullable(schema.labOrders.DoctorInstructions, 'lo.DoctorInstructions', 'NVARCHAR(MAX)')} AS DoctorInstructions,
            p.Id AS PatientId,
            p.UHID,
            p.FirstName + ' ' + p.LastName AS PatientName,
            dp.Id AS DoctorId,
            du.FirstName + ' ' + du.LastName AS OrderedByName,
            dep.Name AS DepartmentName,
            lt.Id AS TestId,
            lt.Name AS TestName,
            lt.Category,
            lt.Unit,
            lt.TurnaroundHrs,
            lt.SampleType,
            loi.ResultValue,
            loi.ResultUnit,
            loi.NormalRange,
            loi.IsAbnormal,
            loi.Remarks,
            loi.Status,
            lo.CollectedAt AS OrderCollectedAt,
            lo.ReportedAt,
            lo.VerifiedAt,
            ${sqlNullable(schema.labOrderItems.CriteriaText, 'loi.CriteriaText', 'NVARCHAR(500)')} AS CriteriaText,
            ${sqlNullable(schema.labOrderItems.AdditionalDetails, 'loi.AdditionalDetails', 'NVARCHAR(1000)')} AS AdditionalDetails,
            ${sqlNullable(schema.labOrderItems.TechnicianNotes, 'loi.TechnicianNotes', 'NVARCHAR(1000)')} AS TechnicianNotes,
            ${sqlNullable(schema.hasLabSamples, 'ls.Id', 'BIGINT')} AS SampleId,
            ${sqlNullable(schema.hasLabSamples, 'ls.SampleCode', 'NVARCHAR(40)')} AS SampleCode,
            ${sqlNullable(schema.hasLabSamples, 'ls.BarcodeValue', 'NVARCHAR(80)')} AS BarcodeValue,
            ${sqlNullable(schema.hasLabSamples, 'ls.CollectionLocation', 'NVARCHAR(120)')} AS CollectionLocation,
            ${sqlNullable(schema.hasLabSamples, 'ls.CollectedAt', 'DATETIME2(0)')} AS CollectedAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.ReceivedAtLabAt', 'DATETIME2(0)')} AS ReceivedAtLabAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.ProcessingStartedAt', 'DATETIME2(0)')} AS ProcessingStartedAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.ProcessingCompletedAt', 'DATETIME2(0)')} AS ProcessingCompletedAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.SampleStatus', 'NVARCHAR(30)')} AS SampleStatus
          FROM dbo.LabOrderItems loi
          JOIN dbo.LabOrders lo ON lo.Id = loi.LabOrderId
          JOIN dbo.LabTests lt ON lt.Id = loi.TestId
          JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
          LEFT JOIN dbo.Users du ON du.Id = dp.UserId
          LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
          ${sampleJoin}
          WHERE ${getScopedOrderWhereClause('lo')}
            AND (@Status = '' OR loi.Status = @Status)
            AND (
              @Search = ''
              OR lo.OrderNumber LIKE '%' + @Search + '%'
              ${sampleSearch}
              OR p.UHID LIKE '%' + @Search + '%'
              OR p.FirstName LIKE '%' + @Search + '%'
              OR p.LastName LIKE '%' + @Search + '%'
              OR lt.Name LIKE '%' + @Search + '%'
              OR ISNULL(du.FirstName + ' ' + du.LastName, '') LIKE '%' + @Search + '%'
            )
          ORDER BY
            CASE loi.Status
              WHEN 'Pending' THEN 0
              WHEN 'SampleCollected' THEN 1
              WHEN 'Processing' THEN 1
              WHEN 'Completed' THEN 2
              ELSE 3
            END,
            CASE lo.Priority
              WHEN 'STAT' THEN 0
              WHEN 'Urgent' THEN 1
              ELSE 2
            END,
            lo.OrderDate DESC,
            loi.Id DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

          SELECT COUNT(*) AS Total
          FROM dbo.LabOrderItems loi
          JOIN dbo.LabOrders lo ON lo.Id = loi.LabOrderId
          JOIN dbo.LabTests lt ON lt.Id = loi.TestId
          JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
          LEFT JOIN dbo.Users du ON du.Id = dp.UserId
          ${sampleJoin}
          WHERE ${getScopedOrderWhereClause('lo')}
            AND (@Status = '' OR loi.Status = @Status)
            AND (
              @Search = ''
              OR lo.OrderNumber LIKE '%' + @Search + '%'
              ${sampleSearch}
              OR p.UHID LIKE '%' + @Search + '%'
              OR p.FirstName LIKE '%' + @Search + '%'
              OR p.LastName LIKE '%' + @Search + '%'
              OR lt.Name LIKE '%' + @Search + '%'
              OR ISNULL(du.FirstName + ' ' + du.LastName, '') LIKE '%' + @Search + '%'
            );
        `);

      const rows = result.recordsets?.[0] || [];
      const total = result.recordsets?.[1]?.[0]?.Total || 0;

      res.json({
        success: true,
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: limit ? Math.ceil(total / limit) : 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/items/:itemId',
  authorize(...LAB_OPERATOR_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const hospitalId = resolveHospitalId(req);
      const sampleJoin = schema.hasLabSamples
        ? 'LEFT JOIN dbo.LabSamples ls ON ls.LabOrderItemId = loi.Id'
        : '';
      const historyQuery = schema.hasLabOrderStatusHistory
        ? `
          SELECT
            hist.Id,
            hist.Scope,
            hist.FromStatus,
            hist.ToStatus,
            hist.ChangedAt,
            hist.Note,
            u.FirstName + ' ' + u.LastName AS ChangedByName
          FROM dbo.LabOrderStatusHistory hist
          LEFT JOIN dbo.Users u ON u.Id = hist.ChangedByUserId
          WHERE hist.LabOrderItemId = @ItemId
             OR hist.LabOrderId = (
               SELECT LabOrderId
               FROM dbo.LabOrderItems
               WHERE Id = @ItemId
             )
          ORDER BY hist.ChangedAt DESC, hist.Id DESC;
        `
        : `
          SELECT
            CAST(NULL AS BIGINT) AS Id,
            CAST(NULL AS NVARCHAR(20)) AS Scope,
            CAST(NULL AS NVARCHAR(30)) AS FromStatus,
            CAST(NULL AS NVARCHAR(30)) AS ToStatus,
            CAST(NULL AS DATETIME2(0)) AS ChangedAt,
            CAST(NULL AS NVARCHAR(500)) AS Note,
            CAST(NULL AS NVARCHAR(201)) AS ChangedByName
          WHERE 1 = 0;
        `;
      const attachmentQuery = schema.hasLabResultAttachments
        ? `
          SELECT
            att.Id,
            att.LabOrderItemId,
            att.FileCategory,
            att.FileName,
            att.StoragePath,
            att.ContentType,
            att.FileSizeBytes,
            att.IsPrimary,
            att.UploadedAt
          FROM dbo.LabResultAttachments att
          WHERE att.LabOrderItemId = @ItemId
             OR att.LabOrderId = (
               SELECT LabOrderId
               FROM dbo.LabOrderItems
               WHERE Id = @ItemId
             )
          ORDER BY att.UploadedAt DESC, att.Id DESC;
        `
        : `
          SELECT
            CAST(NULL AS BIGINT) AS Id,
            CAST(NULL AS BIGINT) AS LabOrderItemId,
            CAST(NULL AS NVARCHAR(20)) AS FileCategory,
            CAST(NULL AS NVARCHAR(260)) AS FileName,
            CAST(NULL AS NVARCHAR(700)) AS StoragePath,
            CAST(NULL AS NVARCHAR(120)) AS ContentType,
            CAST(NULL AS BIGINT) AS FileSizeBytes,
            CAST(NULL AS BIT) AS IsPrimary,
            CAST(NULL AS DATETIME2(0)) AS UploadedAt
          WHERE 1 = 0;
        `;

      const detailResult = await addHospitalInput(pool.request(), hospitalId)
        .input('ItemId', sql.BigInt, parseInteger(req.params.itemId))
        .query(`
          SELECT TOP 1
            loi.Id AS ItemId,
            loi.LabOrderId,
            loi.Status,
            loi.ResultValue,
            loi.ResultUnit,
            loi.NormalRange,
            loi.IsAbnormal,
            loi.Remarks,
            ${sqlNullable(schema.labOrderItems.CriteriaText, 'loi.CriteriaText', 'NVARCHAR(500)')} AS CriteriaText,
            ${sqlNullable(schema.labOrderItems.AdditionalDetails, 'loi.AdditionalDetails', 'NVARCHAR(1000)')} AS AdditionalDetails,
            ${sqlNullable(schema.labOrderItems.TechnicianNotes, 'loi.TechnicianNotes', 'NVARCHAR(1000)')} AS TechnicianNotes,
            lo.OrderNumber,
            lo.OrderDate,
            lo.Priority,
            ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage,
            lo.Notes,
            ${sqlNullable(schema.labOrders.ClinicalIndication, 'lo.ClinicalIndication', 'NVARCHAR(1000)')} AS ClinicalIndication,
            ${sqlNullable(schema.labOrders.DoctorInstructions, 'lo.DoctorInstructions', 'NVARCHAR(MAX)')} AS DoctorInstructions,
            lo.CollectedAt,
            lo.ReportedAt,
            p.Id AS PatientId,
            p.UHID,
            p.FirstName + ' ' + p.LastName AS PatientName,
            p.Gender,
            dp.Id AS DoctorId,
            du.FirstName + ' ' + du.LastName AS OrderedByName,
            dep.Name AS DepartmentName,
            lt.Id AS TestId,
            lt.Name AS TestName,
            lt.Category,
            lt.Unit,
            lt.SampleType,
            lt.TurnaroundHrs,
            lt.NormalRangeMale,
            lt.NormalRangeFemale,
            lt.NormalRangeChild,
            ${sqlNullable(schema.hasLabSamples, 'ls.Id', 'BIGINT')} AS SampleId,
            ${sqlNullable(schema.hasLabSamples, 'ls.SampleCode', 'NVARCHAR(40)')} AS SampleCode,
            ${sqlNullable(schema.hasLabSamples, 'ls.BarcodeValue', 'NVARCHAR(80)')} AS BarcodeValue,
            ${sqlNullable(schema.hasLabSamples, 'ls.CollectionLocation', 'NVARCHAR(120)')} AS CollectionLocation,
            ${sqlNullable(schema.hasLabSamples, 'ls.CollectedAt', 'DATETIME2(0)')} AS SampleCollectedAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.ReceivedAtLabAt', 'DATETIME2(0)')} AS ReceivedAtLabAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.ProcessingStartedAt', 'DATETIME2(0)')} AS ProcessingStartedAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.ProcessingCompletedAt', 'DATETIME2(0)')} AS ProcessingCompletedAt,
            ${sqlNullable(schema.hasLabSamples, 'ls.SampleStatus', 'NVARCHAR(30)')} AS SampleStatus
          FROM dbo.LabOrderItems loi
          JOIN dbo.LabOrders lo ON lo.Id = loi.LabOrderId
          JOIN dbo.LabTests lt ON lt.Id = loi.TestId
          JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
          LEFT JOIN dbo.Users du ON du.Id = dp.UserId
          LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
          ${sampleJoin}
          WHERE loi.Id = @ItemId
            AND ${getScopedOrderWhereClause('lo')};

          ${historyQuery}
          ${attachmentQuery}
        `);

      if (!detailResult.recordsets?.[0]?.length) {
        return res.status(404).json({ success: false, message: 'Lab work item not found' });
      }

      const detail = detailResult.recordsets[0][0];

      res.json({
        success: true,
        data: {
          ...detail,
          history: detailResult.recordsets[1] || [],
          attachments: detailResult.recordsets[2] || [],
          tests: [
            {
              Id: detail.ItemId,
              TestId: detail.TestId,
              TestName: detail.TestName,
              ResultValue: detail.ResultValue,
              ResultUnit: detail.ResultUnit || detail.Unit,
              NormalRange: detail.NormalRange || resolveDefaultNormalRange(detail),
              IsAbnormal: detail.IsAbnormal,
              Remarks: detail.Remarks,
              Status: detail.Status,
            },
          ],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:id/attachments',
  authorize('doctor', ...LAB_OPERATOR_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const hospitalId = resolveHospitalId(req);
      const actorUserId = parseInteger(req.user.id);
      const orderId = parseInteger(req.params.id);
      const {
        labOrderItemId = null,
        attachments = [],
      } = req.body || {};

      const normalizedAttachments = Array.isArray(attachments)
        ? attachments.map(normalizeAttachmentInput)
        : [];

      if (!orderId || !normalizedAttachments.length) {
        return res.status(400).json({
          success: false,
          message: 'A valid report id and at least one attachment are required',
        });
      }

      const orderResult = await addHospitalInput(pool.request(), hospitalId)
        .input('LabOrderId', sql.BigInt, orderId)
        .query(`
          SELECT TOP 1
            lo.Id,
            lo.PatientId,
            lo.HospitalId
          FROM dbo.LabOrders lo
          WHERE lo.Id = @LabOrderId
            AND ${getScopedOrderWhereClause('lo')}
        `);

      if (!orderResult.recordset.length) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      if (labOrderItemId) {
        const itemResult = await addHospitalInput(pool.request(), hospitalId)
          .input('ItemId', sql.BigInt, parseInteger(labOrderItemId))
          .input('LabOrderId', sql.BigInt, orderId)
          .query(`
            SELECT TOP 1
              loi.Id
            FROM dbo.LabOrderItems loi
            JOIN dbo.LabOrders lo ON lo.Id = loi.LabOrderId
            WHERE loi.Id = @ItemId
              AND loi.LabOrderId = @LabOrderId
              AND ${getScopedOrderWhereClause('lo')}
          `);

        if (!itemResult.recordset.length) {
          return res.status(404).json({ success: false, message: 'Lab order item not found for this report' });
        }
      }

      const savedAttachments = await persistAttachmentRecords({
        requestFactory: () => pool.request(),
        labOrderId: orderId,
        labOrderItemId,
        actorUserId,
        attachments: normalizedAttachments,
        schema,
      });

      res.status(201).json({
        success: true,
        message: 'Attachments uploaded successfully',
        data: savedAttachments,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:id/attachments/files',
  authorize('doctor', ...LAB_OPERATOR_ROLES),
  (req, res, next) => {
    attachmentUpload.array('files', 6)(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return next(error);
    });
  },
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const hospitalId = resolveHospitalId(req);
      const actorUserId = parseInteger(req.user.id);
      const orderId = parseInteger(req.params.id);
      const labOrderItemId = parseInteger(req.body?.labOrderItemId);
      const files = Array.isArray(req.files) ? req.files : [];

      if (!orderId || !files.length) {
        return res.status(400).json({
          success: false,
          message: 'A valid report id and at least one file are required',
        });
      }

      if (!schema.hasLabResultAttachments) {
        return res.status(400).json({
          success: false,
          message: 'Lab attachment storage is not configured in the current database',
        });
      }

      const orderResult = await addHospitalInput(pool.request(), hospitalId)
        .input('LabOrderId', sql.BigInt, orderId)
        .query(`
          SELECT TOP 1 lo.Id
          FROM dbo.LabOrders lo
          WHERE lo.Id = @LabOrderId
            AND ${getScopedOrderWhereClause('lo')}
        `);

      if (!orderResult.recordset.length) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      if (labOrderItemId) {
        const itemResult = await addHospitalInput(pool.request(), hospitalId)
          .input('ItemId', sql.BigInt, labOrderItemId)
          .input('LabOrderId', sql.BigInt, orderId)
          .query(`
            SELECT TOP 1 loi.Id
            FROM dbo.LabOrderItems loi
            JOIN dbo.LabOrders lo ON lo.Id = loi.LabOrderId
            WHERE loi.Id = @ItemId
              AND loi.LabOrderId = @LabOrderId
              AND ${getScopedOrderWhereClause('lo')}
          `);

        if (!itemResult.recordset.length) {
          return res.status(404).json({ success: false, message: 'Lab order item not found for this report' });
        }
      }

      const savedAttachments = [];
      for (const [index, file] of files.entries()) {
        const persisted = await persistUploadedFile({
          labOrderId: orderId,
          file,
          isPrimary: index === 0,
        });

        if (!persisted) continue;

        await insertAttachmentRecord({
          requestFactory: () => pool.request(),
          labOrderId: orderId,
          labOrderItemId,
          actorUserId,
          attachment: persisted,
        });

        savedAttachments.push(persisted);
      }

      res.status(201).json({
        success: true,
        message: 'Files uploaded successfully',
        data: savedAttachments,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/pending-approvals',
  authorize(...LAB_HEAD_ROLES),
  async (req, res, next) => {
    try {
      const hospitalId = resolveHospitalId(req);
      const orders = await labService.getPendingApprovalOrders(hospitalId);
      res.json({ success: true, data: orders });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:id/approve',
  authorize(...LAB_HEAD_ROLES),
  async (req, res, next) => {
    try {
      const hospitalId = resolveHospitalId(req);
      const result = await labService.approveLabTest(
        parseInteger(req.params.id),
        parseInteger(req.user.id),
        `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Lab Incharge',
        hospitalId,
      );

      res.json({
        success: true,
        message: `Lab result for ${result.patientName} (${result.orderNumber}) approved and sent to doctor review.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:id/reject',
  authorize(...LAB_HEAD_ROLES),
  async (req, res, next) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      const hospitalId = resolveHospitalId(req);
      const result = await labService.rejectLabTest(
        parseInteger(req.params.id),
        reason,
        parseInteger(req.user.id),
        hospitalId,
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id',
  authorize(...REPORT_VIEW_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const hospitalId = resolveHospitalId(req);
      const orderId = parseInteger(req.params.id);
      const reviewApply = schema.hasEmrLabReportReviews
        ? `
          OUTER APPLY (
            SELECT TOP 1
              ReviewStatus,
              ReviewSummary,
              DoctorInstructions,
              PatientVisibleNote,
              RequiresFollowUp,
              ReviewedAt
            FROM dbo.EmrLabReportReviews
            WHERE LabOrderId = lo.Id
            ORDER BY UpdatedAt DESC, Id DESC
          ) rev
        `
        : '';
      const attachmentsQuery = schema.hasLabResultAttachments
        ? `
          SELECT
            att.Id,
            att.LabOrderItemId,
            att.FileCategory,
            att.FileName,
            att.StoragePath,
            att.ContentType,
            att.FileSizeBytes,
            att.IsPrimary,
            att.UploadedAt
          FROM dbo.LabResultAttachments att
          WHERE att.LabOrderId = @LabOrderId
          ORDER BY att.UploadedAt DESC, att.Id DESC;
        `
        : `
          SELECT
            CAST(NULL AS BIGINT) AS Id,
            CAST(NULL AS BIGINT) AS LabOrderItemId,
            CAST(NULL AS NVARCHAR(20)) AS FileCategory,
            CAST(NULL AS NVARCHAR(260)) AS FileName,
            CAST(NULL AS NVARCHAR(700)) AS StoragePath,
            CAST(NULL AS NVARCHAR(120)) AS ContentType,
            CAST(NULL AS BIGINT) AS FileSizeBytes,
            CAST(NULL AS BIT) AS IsPrimary,
            CAST(NULL AS DATETIME2(0)) AS UploadedAt
          WHERE 1 = 0;
        `;

      const orderRes = await addHospitalInput(pool.request(), hospitalId)
        .input('Id', sql.BigInt, orderId)
        .query(`
          SELECT TOP 1
            lo.Id,
            lo.OrderNumber,
            lo.OrderDate,
            lo.Status,
            lo.Priority,
            ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage,
            lo.Notes,
            ${sqlNullable(schema.labOrders.ClinicalIndication, 'lo.ClinicalIndication', 'NVARCHAR(1000)')} AS ClinicalIndication,
            ${sqlNullable(schema.labOrders.DoctorInstructions, 'lo.DoctorInstructions', 'NVARCHAR(MAX)')} AS DoctorInstructions,
            lo.CollectedAt,
            lo.ReportedAt,
            lo.VerifiedAt,
            lo.CreatedAt,
            ${sqlNullable(schema.labOrders.ReleasedToPatientAt, 'lo.ReleasedToPatientAt', 'DATETIME2(0)')} AS ReleasedToPatientAt,
            p.Id AS PatientId,
            p.FirstName + ' ' + p.LastName AS PatientName,
            p.UHID,
            p.DateOfBirth,
            p.Gender,
            p.BloodGroup,
            u.FirstName + ' ' + u.LastName AS OrderedByName,
            dp.LicenseNumber,
            sp.Name AS Specialization,
            hosp.Name AS HospitalName,
            hosp.Phone AS HospitalPhone,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.ReviewStatus', 'NVARCHAR(20)')} AS ReviewStatus,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.ReviewSummary', 'NVARCHAR(1000)')} AS ReviewSummary,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.DoctorInstructions', 'NVARCHAR(1000)')} AS ReviewDoctorInstructions,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.PatientVisibleNote', 'NVARCHAR(1000)')} AS PatientVisibleNote,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.RequiresFollowUp', 'BIT')} AS RequiresFollowUp,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.ReviewedAt', 'DATETIME2(0)')} AS ReviewedAt
          FROM dbo.LabOrders lo
          JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
          LEFT JOIN dbo.Users u ON u.Id = dp.UserId
          LEFT JOIN dbo.Specializations sp ON sp.Id = dp.SpecializationId
          LEFT JOIN dbo.HospitalSetup hosp ON hosp.Id = lo.HospitalId
          ${reviewApply}
          WHERE lo.Id = @Id
            AND ${getScopedOrderWhereClause('lo')}
        `);

      if (!orderRes.recordset.length) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      const order = orderRes.recordset[0];

      if (req.user.role === 'patient') {
        const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
        if (parseInteger(order.PatientId) !== parseInteger(activeProfile.patientId)) {
          return res.status(403).json({ success: false, message: 'Access denied to this report' });
        }
        if (!isReleasedToPatient(order, schema)) {
          return res.status(403).json({ success: false, message: 'This report is not yet released to the patient' });
        }
      }

      const itemsRes = await addHospitalInput(pool.request(), hospitalId)
        .input('LabOrderId', sql.BigInt, orderId)
        .query(`
          SELECT
            loi.Id,
            lt.Id AS TestId,
            lt.Name AS TestName,
            lt.Category,
            lt.Unit,
            lt.NormalRangeMale,
            lt.NormalRangeFemale,
            lt.SampleType,
            lt.RequiresFasting,
            loi.ResultValue,
            loi.ResultUnit,
            COALESCE(
              loi.NormalRange,
              CASE
                WHEN p.Gender = 'Female' THEN lt.NormalRangeFemale
                WHEN p.Gender = 'Male' THEN lt.NormalRangeMale
                ELSE COALESCE(lt.NormalRangeChild, lt.NormalRangeMale, lt.NormalRangeFemale)
              END
            ) AS NormalRange,
            loi.IsAbnormal,
            loi.Remarks,
            loi.Status
          FROM dbo.LabOrderItems loi
          JOIN dbo.LabOrders lo ON lo.Id = loi.LabOrderId
          JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
          JOIN dbo.LabTests lt ON lt.Id = loi.TestId
          WHERE loi.LabOrderId = @LabOrderId
            AND ${getScopedOrderWhereClause('lo')}
          ORDER BY ${getLabOrderItemOrderBy(schema, 'loi')};

          ${attachmentsQuery}
        `);

      res.json({
        success: true,
        data: {
          ...order,
          tests: itemsRes.recordsets[0] || [],
          attachments: itemsRes.recordsets[1] || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/',
  authorize('doctor', ...LAB_OPERATOR_ROLES),
  async (req, res, next) => {
    try {
      const {
        patientId,
        appointmentId,
        admissionId,
        orderedByDoctorId,
        priority = 'Routine',
        notes = null,
        clinicalIndication = null,
        doctorInstructions = null,
        tests = [],
      } = req.body;

      const normalizedPatientId = parseInteger(patientId);
      const normalizedAppointmentId = parseInteger(appointmentId);
      const normalizedAdmissionId = parseInteger(admissionId);
      const normalizedOrderedByDoctorId = parseInteger(orderedByDoctorId);
      const normalizedTests = Array.isArray(tests)
        ? tests
          .map((test, index) => ({
            testId: parseInteger(test.testId || test.TestId || test.id),
            criteriaText: test.criteriaText || test.criteria || null,
            additionalDetails: test.additionalDetails || null,
            displaySequence: index + 1,
          }))
          .filter((test) => test.testId)
        : [];

      if (!normalizedPatientId || !normalizedTests.length) {
        return res.status(400).json({
          success: false,
          message: 'patientId and at least one valid test are required',
        });
      }

      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const actorRole = req.user.role;
      const actorUserId = parseInteger(req.user.id);
      const hospitalId = resolveHospitalId(req);

      let doctorProfile = null;
      if (actorRole === 'doctor') {
        doctorProfile = await getDoctorProfile(pool, actorUserId);
        if (!doctorProfile) {
          return res.status(400).json({ success: false, message: 'Doctor profile not found' });
        }
      }

      const orderedBy = actorRole === 'doctor'
        ? doctorProfile.Id
        : normalizedOrderedByDoctorId;
      const effectiveHospitalId = hospitalId || doctorProfile?.HospitalId || null;

      if (!effectiveHospitalId) {
        return res.status(400).json({ success: false, message: 'Hospital context is missing for this lab order' });
      }

      if (actorRole === 'doctor') {
        if (!normalizedAppointmentId) {
          return res.status(400).json({
            success: false,
            message: 'Doctors can create lab orders only after the appointment / OPD session is completed',
          });
        }

        const completedAppointment = await getCompletedAppointmentForDoctor({
          pool,
          appointmentId: normalizedAppointmentId,
          patientId: normalizedPatientId,
          doctorId: doctorProfile.Id,
          hospitalId: effectiveHospitalId,
        });

        if (!completedAppointment) {
          return res.status(400).json({
            success: false,
            message: 'Doctors can create lab orders only after the appointment / OPD session is completed',
          });
        }
      }

      const orderUpdateAssignments = [
        'AdmissionId = COALESCE(@AdmissionId, AdmissionId)',
        'Priority = @Priority',
        'Notes = @Notes',
        schema.labOrders.ClinicalIndication ? 'ClinicalIndication = @ClinicalIndication' : null,
        schema.labOrders.DoctorInstructions ? 'DoctorInstructions = @DoctorInstructions' : null,
        schema.labOrders.UpdatedBy ? 'UpdatedBy = @UpdatedBy' : null,
        'UpdatedAt = SYSUTCDATETIME()',
      ].filter(Boolean).join(',\n                ');
      const orderInsertColumns = [
        'HospitalId',
        'PatientId',
        'OrderedBy',
        'AppointmentId',
        'AdmissionId',
        'OrderNumber',
        'Priority',
        'Notes',
      ];
      const orderInsertValues = [
        '@HospitalId',
        '@PatientId',
        '@OrderedBy',
        '@AppointmentId',
        '@AdmissionId',
        '@OrderNumber',
        '@Priority',
        '@Notes',
      ];

      if (schema.labOrders.ClinicalIndication) {
        orderInsertColumns.push('ClinicalIndication');
        orderInsertValues.push('@ClinicalIndication');
      }

      if (schema.labOrders.DoctorInstructions) {
        orderInsertColumns.push('DoctorInstructions');
        orderInsertValues.push('@DoctorInstructions');
      }

      if (schema.labOrders.WorkflowStage) {
        orderInsertColumns.push('WorkflowStage');
        orderInsertValues.push("'Ordered'");
      }

      orderInsertColumns.push('CreatedBy');
      orderInsertValues.push('@CreatedBy');

      const itemInsertColumns = ['LabOrderId', 'TestId'];
      const itemInsertValues = ['@LabOrderId', '@TestId'];

      if (schema.labOrderItems.CriteriaText) {
        itemInsertColumns.push('CriteriaText');
        itemInsertValues.push('@CriteriaText');
      }

      if (schema.labOrderItems.AdditionalDetails) {
        itemInsertColumns.push('AdditionalDetails');
        itemInsertValues.push('@AdditionalDetails');
      }

      if (schema.labOrderItems.DisplaySequence) {
        itemInsertColumns.push('DisplaySequence');
        itemInsertValues.push('@DisplaySequence');
      }

      const result = await withTransaction(async (transaction) => {
        const request = () => getTransactionRequest(transaction);
        let existingOrder = null;

        if (normalizedAppointmentId && orderedBy) {
          const existingRes = await request()
            .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
            .input('PatientId', sql.BigInt, normalizedPatientId)
            .input('DoctorId', sql.BigInt, orderedBy)
            .query(`
              SELECT TOP 1 Id, OrderNumber
              FROM dbo.LabOrders
              WHERE AppointmentId = @AppointmentId
                AND PatientId = @PatientId
                AND OrderedBy = @DoctorId
              ORDER BY CreatedAt DESC, Id DESC
            `);

          existingOrder = existingRes.recordset[0] || null;
        }

        let labOrderId = existingOrder?.Id || null;
        let orderNumber = existingOrder?.OrderNumber || null;

        if (existingOrder) {
          await request()
            .input('Id', sql.BigInt, labOrderId)
            .input('AdmissionId', sql.BigInt, normalizedAdmissionId)
            .input('Priority', sql.NVarChar(20), normalizePriority(priority))
            .input('Notes', sql.NVarChar(sql.MAX), notes)
            .input('ClinicalIndication', sql.NVarChar(1000), clinicalIndication)
            .input('DoctorInstructions', sql.NVarChar(sql.MAX), doctorInstructions)
            .input('UpdatedBy', sql.BigInt, actorUserId)
            .query(`
              UPDATE dbo.LabOrders
              SET
                ${orderUpdateAssignments}
              WHERE Id = @Id
            `);

          await request()
            .input('LabOrderId', sql.BigInt, labOrderId)
            .query(`DELETE FROM dbo.LabOrderItems WHERE LabOrderId = @LabOrderId`);
        } else {
          orderNumber = generateOrderNumber();

          const createdOrder = await request()
            .input('HospitalId', sql.BigInt, effectiveHospitalId)
            .input('PatientId', sql.BigInt, normalizedPatientId)
            .input('OrderedBy', sql.BigInt, orderedBy)
            .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
            .input('AdmissionId', sql.BigInt, normalizedAdmissionId)
            .input('OrderNumber', sql.NVarChar(30), orderNumber)
            .input('Priority', sql.NVarChar(20), normalizePriority(priority))
            .input('Notes', sql.NVarChar(sql.MAX), notes)
            .input('ClinicalIndication', sql.NVarChar(1000), clinicalIndication)
            .input('DoctorInstructions', sql.NVarChar(sql.MAX), doctorInstructions)
            .input('CreatedBy', sql.BigInt, actorUserId)
            .query(`
              INSERT INTO dbo.LabOrders
                (${orderInsertColumns.join(', ')})
              OUTPUT INSERTED.Id, INSERTED.OrderNumber
              VALUES
                (${orderInsertValues.join(', ')})
            `);

          labOrderId = createdOrder.recordset[0].Id;
          orderNumber = createdOrder.recordset[0].OrderNumber;
        }

        for (const test of normalizedTests) {
          await request()
            .input('LabOrderId', sql.BigInt, labOrderId)
            .input('TestId', sql.BigInt, test.testId)
            .input('CriteriaText', sql.NVarChar(500), test.criteriaText)
            .input('AdditionalDetails', sql.NVarChar(1000), test.additionalDetails)
            .input('DisplaySequence', sql.Int, test.displaySequence)
            .query(`
              INSERT INTO dbo.LabOrderItems
                (${itemInsertColumns.join(', ')})
              VALUES
                (${itemInsertValues.join(', ')})
            `);
        }

        await insertStatusHistory(request(), {
          labOrderId,
          scope: 'Order',
          fromStatus: existingOrder ? 'Pending' : null,
          toStatus: 'Pending',
          changedByUserId: actorUserId,
          note: existingOrder ? 'Lab order updated' : 'Lab order created',
        }, schema);

        return {
          id: labOrderId,
          orderNumber,
          updated: Boolean(existingOrder),
        };
      });

      res.status(result.updated ? 200 : 201).json({
        success: true,
        message: result.updated ? 'Lab order updated' : 'Lab order created',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/items/:itemId/collect',
  authorize(...LAB_OPERATOR_ROLES),
  async (req, res, next) => {
    try {
      const actorUserId = parseInteger(req.user.id);
      const hospitalId = resolveHospitalId(req);
      const schema = await getReportSchema();
      const { technicianNote = null, collectionLocation = null, barcodeValue = null } = req.body || {};

      const result = await withTransaction(async (transaction) => {
        const request = () => getTransactionRequest(transaction);
        const context = await getScopedItemContext(request(), req.params.itemId, hospitalId, schema);

        if (!context) {
          throw Object.assign(new Error('Lab work item not found'), { statusCode: 404 });
        }

        const sampleCode = context.SampleCode || generateSampleCode(context.ItemId);
        let sampleId = context.SampleId;

        if (schema.hasLabSamples && sampleId) {
          await request()
            .input('SampleId', sql.BigInt, sampleId)
            .input('BarcodeValue', sql.NVarChar(80), barcodeValue)
            .input('CollectionLocation', sql.NVarChar(120), collectionLocation)
            .input('TechnicianNotes', sql.NVarChar(1000), technicianNote)
            .input('CollectedByUserId', sql.BigInt, actorUserId)
            .query(`
              UPDATE dbo.LabSamples
              SET
                BarcodeValue = COALESCE(@BarcodeValue, BarcodeValue),
                CollectionLocation = COALESCE(@CollectionLocation, CollectionLocation),
                CollectedAt = COALESCE(CollectedAt, SYSUTCDATETIME()),
                CollectedByUserId = COALESCE(CollectedByUserId, @CollectedByUserId),
                ReceivedAtLabAt = COALESCE(ReceivedAtLabAt, SYSUTCDATETIME()),
                ProcessingStartedAt = COALESCE(ProcessingStartedAt, SYSUTCDATETIME()),
                SampleStatus = 'Processing',
                TechnicianNotes = @TechnicianNotes,
                UpdatedAt = SYSUTCDATETIME()
              WHERE Id = @SampleId
            `);
        } else if (schema.hasLabSamples) {
          const insertedSample = await request()
            .input('LabOrderItemId', sql.BigInt, context.ItemId)
            .input('HospitalId', sql.BigInt, context.HospitalId)
            .input('SampleCode', sql.NVarChar(40), sampleCode)
            .input('BarcodeValue', sql.NVarChar(80), barcodeValue)
            .input('SpecimenType', sql.NVarChar(80), context.SampleType)
            .input('CollectionLocation', sql.NVarChar(120), collectionLocation)
            .input('CollectedByUserId', sql.BigInt, actorUserId)
            .input('TechnicianNotes', sql.NVarChar(1000), technicianNote)
            .query(`
              INSERT INTO dbo.LabSamples
                (LabOrderItemId, HospitalId, SampleCode, BarcodeValue, SpecimenType, CollectionLocation,
                 CollectedAt, CollectedByUserId, ReceivedAtLabAt, ProcessingStartedAt, SampleStatus, TechnicianNotes)
              OUTPUT INSERTED.Id
              VALUES
                (@LabOrderItemId, @HospitalId, @SampleCode, @BarcodeValue, @SpecimenType, @CollectionLocation,
                 SYSUTCDATETIME(), @CollectedByUserId, SYSUTCDATETIME(), SYSUTCDATETIME(), 'Processing', @TechnicianNotes)
            `);

          sampleId = insertedSample.recordset[0].Id;
        }

        const itemUpdateAssignments = [
          "Status = 'Processing'",
          schema.labOrderItems.TechnicianNotes ? 'TechnicianNotes = @TechnicianNotes' : null,
          schema.labOrderItems.UpdatedAt ? 'UpdatedAt = SYSUTCDATETIME()' : null,
        ].filter(Boolean).join(',\n              ');

        await request()
          .input('ItemId', sql.BigInt, context.ItemId)
          .input('TechnicianNotes', sql.NVarChar(1000), technicianNote)
          .query(`
            UPDATE dbo.LabOrderItems
            SET
              ${itemUpdateAssignments}
            WHERE Id = @ItemId
          `);

        const orderUpdateAssignments = [
          "Status = 'Processing'",
          schema.labOrders.WorkflowStage ? "WorkflowStage = 'Processing'" : null,
          'CollectedAt = COALESCE(CollectedAt, SYSUTCDATETIME())',
          'CollectedBy = COALESCE(CollectedBy, @CollectedBy)',
          schema.labOrders.UpdatedBy ? 'UpdatedBy = @UpdatedBy' : null,
          'UpdatedAt = SYSUTCDATETIME()',
        ].filter(Boolean).join(',\n              ');

        await request()
          .input('LabOrderId', sql.BigInt, context.LabOrderId)
          .input('CollectedBy', sql.BigInt, actorUserId)
          .input('UpdatedBy', sql.BigInt, actorUserId)
          .query(`
            UPDATE dbo.LabOrders
            SET
              ${orderUpdateAssignments}
            WHERE Id = @LabOrderId
          `);

        await insertStatusHistory(request(), {
          labOrderId: context.LabOrderId,
          labOrderItemId: context.ItemId,
          scope: 'Item',
          fromStatus: context.ItemStatus,
          toStatus: 'Processing',
          changedByUserId: actorUserId,
          note: technicianNote || 'Sample collected and moved to processing',
        }, schema);

        if (schema.hasLabSamples && sampleId) {
          await insertStatusHistory(request(), {
            labOrderId: context.LabOrderId,
            labOrderItemId: context.ItemId,
            labSampleId: sampleId,
            scope: 'Sample',
            fromStatus: context.SampleStatus || 'Pending',
            toStatus: 'Processing',
            changedByUserId: actorUserId,
            note: technicianNote || 'Sample collected',
          }, schema);
        }

        await insertStatusHistory(request(), {
          labOrderId: context.LabOrderId,
          scope: 'Order',
          fromStatus: context.OrderStatus,
          toStatus: 'Processing',
          changedByUserId: actorUserId,
          note: technicianNote || 'Order moved to processing',
        }, schema);

        return {
          itemId: context.ItemId,
          labOrderId: context.LabOrderId,
          sampleId,
          sampleCode,
        };
      });

      res.json({
        success: true,
        message: 'Sample collected and moved to processing',
        data: result,
      });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
);

router.patch('/items/:itemId/result',
  authorize(...LAB_OPERATOR_ROLES),
  async (req, res, next) => {
    try {
      const actorUserId = parseInteger(req.user.id);
      const hospitalId = resolveHospitalId(req);
      const schema = await getReportSchema();
      const {
        resultValue = null,
        resultUnit = null,
        normalRange = null,
        isAbnormal = null,
        remarks = null,
        technicianNote = null,
        releaseToPatient = false,
        attachments = [],
      } = req.body || {};

      const normalizedAttachments = Array.isArray(attachments)
        ? attachments.map(normalizeAttachmentInput)
        : [];

      const result = await withTransaction(async (transaction) => {
        const request = () => getTransactionRequest(transaction);
        const context = await getScopedItemContext(request(), req.params.itemId, hospitalId, schema);

        if (!context) {
          throw Object.assign(new Error('Lab work item not found'), { statusCode: 404 });
        }

        const resolvedNormalRange = normalRange || resolveDefaultNormalRange(context);
        const itemUpdateAssignments = [
          'ResultValue = @ResultValue',
          'ResultUnit = @ResultUnit',
          'NormalRange = @NormalRange',
          'IsAbnormal = @IsAbnormal',
          'Remarks = @Remarks',
          schema.labOrderItems.TechnicianNotes ? 'TechnicianNotes = @TechnicianNotes' : null,
          "Status = 'Completed'",
          schema.labOrderItems.UpdatedAt ? 'UpdatedAt = SYSUTCDATETIME()' : null,
        ].filter(Boolean).join(',\n              ');

        await request()
          .input('ItemId', sql.BigInt, context.ItemId)
          .input('ResultValue', sql.NVarChar(500), resultValue)
          .input('ResultUnit', sql.NVarChar(50), resultUnit || context.DefaultUnit || null)
          .input('NormalRange', sql.NVarChar(100), resolvedNormalRange)
          .input('IsAbnormal', sql.Bit, normalizeBoolean(isAbnormal))
          .input('Remarks', sql.NVarChar(sql.MAX), remarks)
          .input('TechnicianNotes', sql.NVarChar(1000), technicianNote)
          .query(`
            UPDATE dbo.LabOrderItems
            SET
              ${itemUpdateAssignments}
            WHERE Id = @ItemId
          `);

        let sampleId = context.SampleId;
        if (schema.hasLabSamples && sampleId) {
          await request()
            .input('SampleId', sql.BigInt, sampleId)
            .input('TechnicianNotes', sql.NVarChar(1000), technicianNote)
            .query(`
              UPDATE dbo.LabSamples
              SET
                ProcessingCompletedAt = COALESCE(ProcessingCompletedAt, SYSUTCDATETIME()),
                ProcessingStartedAt = COALESCE(ProcessingStartedAt, SYSUTCDATETIME()),
                ReceivedAtLabAt = COALESCE(ReceivedAtLabAt, SYSUTCDATETIME()),
                SampleStatus = 'Completed',
                TechnicianNotes = @TechnicianNotes,
                UpdatedAt = SYSUTCDATETIME()
              WHERE Id = @SampleId
            `);
        } else if (schema.hasLabSamples) {
          const createdSample = await request()
            .input('LabOrderItemId', sql.BigInt, context.ItemId)
            .input('HospitalId', sql.BigInt, context.HospitalId)
            .input('SampleCode', sql.NVarChar(40), generateSampleCode(context.ItemId))
            .input('SpecimenType', sql.NVarChar(80), context.SampleType)
            .input('CollectedByUserId', sql.BigInt, actorUserId)
            .input('TechnicianNotes', sql.NVarChar(1000), technicianNote)
            .query(`
              INSERT INTO dbo.LabSamples
                (LabOrderItemId, HospitalId, SampleCode, SpecimenType, CollectedAt, CollectedByUserId,
                 ReceivedAtLabAt, ProcessingStartedAt, ProcessingCompletedAt, SampleStatus, TechnicianNotes)
              OUTPUT INSERTED.Id
              VALUES
                (@LabOrderItemId, @HospitalId, @SampleCode, @SpecimenType, SYSUTCDATETIME(), @CollectedByUserId,
                 SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME(), 'Completed', @TechnicianNotes)
            `);

          sampleId = createdSample.recordset[0].Id;
        }

        await persistAttachmentRecords({
          requestFactory: request,
          labOrderId: context.LabOrderId,
          labOrderItemId: context.ItemId,
          actorUserId,
          attachments: normalizedAttachments,
          schema,
        });

        await insertStatusHistory(request(), {
          labOrderId: context.LabOrderId,
          labOrderItemId: context.ItemId,
          scope: 'Item',
          fromStatus: context.ItemStatus,
          toStatus: 'Completed',
          changedByUserId: actorUserId,
          note: technicianNote || remarks || 'Result entered and completed',
        }, schema);

        if (schema.hasLabSamples && sampleId) {
          await insertStatusHistory(request(), {
            labOrderId: context.LabOrderId,
            labOrderItemId: context.ItemId,
            labSampleId: sampleId,
            scope: 'Sample',
            fromStatus: context.SampleStatus || 'Processing',
            toStatus: 'Completed',
            changedByUserId: actorUserId,
            note: technicianNote || 'Sample processing completed',
          }, schema);
        }

        const orderUpdate = await updateOrderStatusFromItems(request(), context, actorUserId, {
          releaseToPatient: Boolean(releaseToPatient),
          historyNote: technicianNote || 'Lab result updated',
        }, schema);

        return {
          itemId: context.ItemId,
          labOrderId: context.LabOrderId,
          sampleId,
          status: orderUpdate.nextStatus,
          workflowStage: orderUpdate.nextStage,
        };
      });

      res.json({
        success: true,
        message: 'Lab result saved successfully',
        data: result,
      });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
);

router.patch('/:id/results',
  authorize(...LAB_OPERATOR_ROLES),
  async (req, res, next) => {
    try {
      const actorUserId = parseInteger(req.user.id);
      const hospitalId = resolveHospitalId(req);
      const schema = await getReportSchema();
      const { items = [], status = null } = req.body || {};
      const normalizedItems = Array.isArray(items) ? items : [];

      if (!normalizedItems.length) {
        return res.status(400).json({ success: false, message: 'At least one item is required' });
      }

      await withTransaction(async (transaction) => {
        const request = () => getTransactionRequest(transaction);

        for (const item of normalizedItems) {
          const context = await getScopedItemContext(request(), item.id, hospitalId, schema);
          if (!context) continue;

          const itemUpdateAssignments = [
            'ResultValue = @ResultValue',
            'ResultUnit = @ResultUnit',
            'NormalRange = @NormalRange',
            'IsAbnormal = @IsAbnormal',
            'Remarks = @Remarks',
            'Status = @Status',
            schema.labOrderItems.UpdatedAt ? 'UpdatedAt = SYSUTCDATETIME()' : null,
          ].filter(Boolean).join(',\n                ');

          await request()
            .input('ItemId', sql.BigInt, context.ItemId)
            .input('ResultValue', sql.NVarChar(500), item.resultValue ?? context.ResultValue ?? null)
            .input('ResultUnit', sql.NVarChar(50), item.resultUnit ?? context.DefaultUnit ?? null)
            .input('NormalRange', sql.NVarChar(100), item.normalRange ?? resolveDefaultNormalRange(context))
            .input('IsAbnormal', sql.Bit, normalizeBoolean(item.isAbnormal))
            .input('Remarks', sql.NVarChar(sql.MAX), item.remarks ?? null)
            .input('Status', sql.NVarChar(20), item.status || 'Completed')
            .query(`
              UPDATE dbo.LabOrderItems
              SET
                ${itemUpdateAssignments}
              WHERE Id = @ItemId
            `);

          await insertStatusHistory(request(), {
            labOrderId: context.LabOrderId,
            labOrderItemId: context.ItemId,
            scope: 'Item',
            fromStatus: context.ItemStatus,
            toStatus: item.status || 'Completed',
            changedByUserId: actorUserId,
            note: item.remarks || 'Batch result update',
          }, schema);
        }

        const orderContextRes = await request()
          .input('LabOrderId', sql.BigInt, parseInteger(req.params.id))
          .input('HospitalId', sql.BigInt, hospitalId)
          .query(`
            SELECT TOP 1
              lo.Id AS LabOrderId,
              lo.PatientId,
              lo.OrderedBy,
              lo.Status AS OrderStatus,
              lo.VerifiedAt,
              ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage
            FROM dbo.LabOrders lo
            WHERE lo.Id = @LabOrderId
              AND ${getScopedOrderWhereClause('lo')}
          `);

        const orderContext = orderContextRes.recordset[0];
        if (!orderContext) return;

        if (status) {
          const orderUpdateAssignments = [
            'Status = @Status',
            schema.labOrders.WorkflowStage
              ? `WorkflowStage = CASE WHEN @Status = 'Completed' THEN 'Completed' ELSE WorkflowStage END`
              : null,
            `ReportedAt = CASE WHEN @Status = 'Completed' THEN COALESCE(ReportedAt, SYSUTCDATETIME()) ELSE ReportedAt END`,
            `ReportedBy = CASE WHEN @Status = 'Completed' THEN COALESCE(ReportedBy, @UpdatedBy) ELSE ReportedBy END`,
            schema.labOrders.UpdatedBy ? 'UpdatedBy = @UpdatedBy' : null,
            'UpdatedAt = SYSUTCDATETIME()',
          ].filter(Boolean).join(',\n                ');

          await request()
            .input('LabOrderId', sql.BigInt, orderContext.LabOrderId)
            .input('Status', sql.NVarChar(20), status)
            .input('UpdatedBy', sql.BigInt, actorUserId)
            .query(`
              UPDATE dbo.LabOrders
              SET
                ${orderUpdateAssignments}
              WHERE Id = @LabOrderId
            `);

          await insertStatusHistory(request(), {
            labOrderId: orderContext.LabOrderId,
            scope: 'Order',
            fromStatus: orderContext.OrderStatus,
            toStatus: status,
            changedByUserId: actorUserId,
            note: 'Batch order result update',
          }, schema);
        } else {
          await updateOrderStatusFromItems(request(), orderContext, actorUserId, {
            historyNote: 'Batch order result update',
          }, schema);
        }
      });

      res.json({ success: true, message: 'Results updated' });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id/review',
  authorize(...REVIEW_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const hospitalId = resolveHospitalId(req);
      const orderId = parseInteger(req.params.id);
      const reviewJoin = schema.hasEmrLabReportReviews
        ? 'LEFT JOIN dbo.EmrLabReportReviews rev ON rev.LabOrderId = lo.Id'
        : '';

      const result = await addHospitalInput(pool.request(), hospitalId)
        .input('LabOrderId', sql.BigInt, orderId)
        .query(`
          SELECT TOP 1
            lo.Id AS LabOrderId,
            lo.OrderNumber,
            lo.PatientId,
            p.FirstName + ' ' + p.LastName AS PatientName,
            p.UHID,
            lo.OrderedBy,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.Id', 'BIGINT')} AS Id,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.EncounterId', 'BIGINT')} AS EncounterId,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.ReviewStatus', 'NVARCHAR(20)')} AS ReviewStatus,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.ReviewSummary', 'NVARCHAR(1000)')} AS ReviewSummary,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.DoctorInstructions', 'NVARCHAR(1000)')} AS DoctorInstructions,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.PatientVisibleNote', 'NVARCHAR(1000)')} AS PatientVisibleNote,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.RequiresFollowUp', 'BIT')} AS RequiresFollowUp,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.ReviewedAt', 'DATETIME2(0)')} AS ReviewedAt,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.CreatedAt', 'DATETIME2(0)')} AS CreatedAt,
            ${sqlNullable(schema.hasEmrLabReportReviews, 'rev.UpdatedAt', 'DATETIME2(0)')} AS UpdatedAt
          FROM dbo.LabOrders lo
          JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
          ${reviewJoin}
          WHERE lo.Id = @LabOrderId
            AND ${getScopedOrderWhereClause('lo')}
          ORDER BY ${schema.hasEmrLabReportReviews ? 'rev.UpdatedAt DESC, rev.Id DESC' : 'lo.Id DESC'}
        `);

      if (!result.recordset.length) {
        return res.status(404).json({ success: false, message: 'Review record not found' });
      }

      res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/:id/review',
  authorize(...REVIEW_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getReportSchema(pool);
      const hospitalId = resolveHospitalId(req);
      const actorUserId = parseInteger(req.user.id);
      const orderId = parseInteger(req.params.id);
      const {
        encounterId = null,
        reviewStatus = 'Reviewed',
        reviewSummary = null,
        doctorInstructions = null,
        patientVisibleNote = null,
        requiresFollowUp = false,
        addClinicalNote = false,
      } = req.body || {};

      const doctorProfile = req.user.role === 'doctor'
        ? await getDoctorProfile(pool, actorUserId)
        : null;

      const result = await withTransaction(async (transaction) => {
        const request = () => getTransactionRequest(transaction);
        const orderRes = await request()
          .input('LabOrderId', sql.BigInt, orderId)
          .input('HospitalId', sql.BigInt, hospitalId)
          .query(`
            SELECT TOP 1
              lo.Id AS LabOrderId,
              lo.PatientId,
              lo.OrderedBy,
              lo.Status AS OrderStatus,
              ${sqlNullable(schema.labOrders.WorkflowStage, 'lo.WorkflowStage', 'NVARCHAR(30)')} AS WorkflowStage
            FROM dbo.LabOrders lo
            WHERE lo.Id = @LabOrderId
              AND ${getScopedOrderWhereClause('lo')}
          `);

        const context = orderRes.recordset[0];
        if (!context) {
          throw Object.assign(new Error('Lab order not found'), { statusCode: 404 });
        }
        if (!isApprovedForClinicalReview(context, schema)) {
          throw Object.assign(new Error('Lab incharge approval is required before doctor review'), { statusCode: 400 });
        }

        const reviewerDoctorId = doctorProfile?.Id || parseInteger(context.OrderedBy);
        if (!reviewerDoctorId) {
          throw Object.assign(new Error('Doctor context is required to save this review'), { statusCode: 400 });
        }

        let reviewId = null;
        if (schema.hasEmrLabReportReviews) {
          const reviewRes = await request()
            .input('LabOrderId', sql.BigInt, orderId)
            .input('EncounterId', sql.BigInt, parseInteger(encounterId))
            .input('PatientId', sql.BigInt, parseInteger(context.PatientId))
            .input('DoctorId', sql.BigInt, reviewerDoctorId)
            .input('ReviewStatus', sql.NVarChar(20), reviewStatus)
            .input('ReviewSummary', sql.NVarChar(1000), reviewSummary)
            .input('DoctorInstructions', sql.NVarChar(1000), doctorInstructions)
            .input('PatientVisibleNote', sql.NVarChar(1000), patientVisibleNote)
            .input('RequiresFollowUp', sql.Bit, Boolean(requiresFollowUp))
            .query(`
              IF EXISTS (
                SELECT 1
                FROM dbo.EmrLabReportReviews
                WHERE LabOrderId = @LabOrderId
                  AND DoctorId = @DoctorId
              )
              BEGIN
                UPDATE dbo.EmrLabReportReviews
                SET
                  EncounterId = COALESCE(@EncounterId, EncounterId),
                  ReviewStatus = @ReviewStatus,
                  ReviewSummary = @ReviewSummary,
                  DoctorInstructions = @DoctorInstructions,
                  PatientVisibleNote = @PatientVisibleNote,
                  RequiresFollowUp = @RequiresFollowUp,
                  ReviewedAt = SYSUTCDATETIME(),
                  UpdatedAt = SYSUTCDATETIME()
                WHERE LabOrderId = @LabOrderId
                  AND DoctorId = @DoctorId;

                SELECT TOP 1 Id
                FROM dbo.EmrLabReportReviews
                WHERE LabOrderId = @LabOrderId
                  AND DoctorId = @DoctorId
                ORDER BY UpdatedAt DESC, Id DESC;
              END
              ELSE
              BEGIN
                INSERT INTO dbo.EmrLabReportReviews
                  (LabOrderId, EncounterId, PatientId, DoctorId, ReviewStatus, ReviewSummary,
                   DoctorInstructions, PatientVisibleNote, RequiresFollowUp, ReviewedAt)
                OUTPUT INSERTED.Id
                VALUES
                  (@LabOrderId, @EncounterId, @PatientId, @DoctorId, @ReviewStatus, @ReviewSummary,
                   @DoctorInstructions, @PatientVisibleNote, @RequiresFollowUp, SYSUTCDATETIME());
              END
            `);

          reviewId = reviewRes.recordset?.[0]?.Id || null;
        }

        if (schema.hasEmrClinicalNotes && addClinicalNote && parseInteger(encounterId)) {
          const noteParts = [reviewSummary, doctorInstructions].filter(Boolean);
          if (noteParts.length) {
            await request()
              .input('EncounterId', sql.BigInt, parseInteger(encounterId))
              .input('NoteText', sql.NVarChar(sql.MAX), noteParts.join('\n\n'))
              .input('LinkedLabOrderId', sql.BigInt, orderId)
              .input('RecordedByUserId', sql.BigInt, actorUserId)
              .input('IsPatientVisible', sql.Bit, Boolean(patientVisibleNote))
              .query(`
                INSERT INTO dbo.EmrClinicalNotes
                  (EncounterId, NoteType, NoteText, IsPatientVisible, LinkedLabOrderId, RecordedByUserId)
                VALUES
                  (@EncounterId, 'LabComment', @NoteText, @IsPatientVisible, @LinkedLabOrderId, @RecordedByUserId)
              `);
          }
        }

        const workflowStage = schema.labOrders.WorkflowStage
          ? (patientVisibleNote ? 'Released' : 'DoctorReview')
          : null;
        const orderUpdateAssignments = [
          schema.labOrders.WorkflowStage ? 'WorkflowStage = @WorkflowStage' : null,
          'VerifiedAt = COALESCE(VerifiedAt, SYSUTCDATETIME())',
          'VerifiedBy = COALESCE(VerifiedBy, @UpdatedBy)',
          schema.labOrders.ReleasedToPatientAt
            ? `ReleasedToPatientAt = CASE
                WHEN @WorkflowStage = 'Released' THEN COALESCE(ReleasedToPatientAt, SYSUTCDATETIME())
                ELSE ReleasedToPatientAt
              END`
            : null,
          schema.labOrders.ReleasedToPatientBy
            ? `ReleasedToPatientBy = CASE
                WHEN @WorkflowStage = 'Released' THEN COALESCE(ReleasedToPatientBy, @UpdatedBy)
                ELSE ReleasedToPatientBy
              END`
            : null,
          schema.labOrders.UpdatedBy ? 'UpdatedBy = @UpdatedBy' : null,
          'UpdatedAt = SYSUTCDATETIME()',
        ].filter(Boolean).join(',\n              ');

        await request()
          .input('LabOrderId', sql.BigInt, orderId)
          .input('WorkflowStage', sql.NVarChar(30), workflowStage)
          .input('UpdatedBy', sql.BigInt, actorUserId)
          .query(`
            UPDATE dbo.LabOrders
            SET
              ${orderUpdateAssignments}
            WHERE Id = @LabOrderId
          `);

        await insertStatusHistory(request(), {
          labOrderId: orderId,
          scope: 'Review',
          fromStatus: context.WorkflowStage,
          toStatus: workflowStage || 'Reviewed',
          changedByUserId: actorUserId,
          note: reviewSummary || doctorInstructions || 'Lab report reviewed',
        }, schema);

        return {
          reviewId,
          workflowStage: workflowStage || 'Reviewed',
        };
      });

      res.json({
        success: true,
        message: 'Lab report review saved',
        data: result,
      });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
);

module.exports = router;
