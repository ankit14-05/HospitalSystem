const { sql } = require('../config/database');

const parseInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

const resolveHospitalId = (req) => {
  if (req.user?.role === 'superadmin') {
    return parseInteger(req.query?.hospitalId || req.body?.hospitalId);
  }

  return parseInteger(req.user?.hospitalId || req.headers?.['x-hospital-id']);
};

const getDoctorProfileByUserId = async (pool, userId) => {
  const result = await pool.request()
    .input('UserId', sql.BigInt, parseInteger(userId))
    .query(`
      SELECT TOP 1
        dp.Id,
        dp.HospitalId,
        dp.DepartmentId
      FROM dbo.DoctorProfiles dp
      WHERE dp.UserId = @UserId
    `);

  return result.recordset[0] || null;
};

const getEmrSchemaInfo = async (pool) => {
  const [tableResult, columnResult] = await Promise.all([
    pool.request().query(`
      SELECT
        OBJECT_ID('dbo.EmrEncounters', 'U') AS EmrEncounterTableId,
        OBJECT_ID('dbo.EmrClinicalNotes', 'U') AS EmrClinicalNotesTableId,
        OBJECT_ID('dbo.EmrDiagnosisRecords', 'U') AS EmrDiagnosisRecordsTableId,
        OBJECT_ID('dbo.AppointmentConsultations', 'U') AS AppointmentConsultationsTableId,
        OBJECT_ID('dbo.EmrLabReportReviews', 'U') AS EmrLabReportReviewsTableId,
        OBJECT_ID('dbo.LabResultAttachments', 'U') AS LabResultAttachmentsTableId
    `),
    pool.request().query(`
      SELECT name
      FROM sys.columns
      WHERE (
        object_id = OBJECT_ID('dbo.Appointments')
        AND name IN ('PrimaryDiagnosis', 'FollowUpNotes')
      ) OR (
        object_id = OBJECT_ID('dbo.LabOrders')
        AND name IN ('WorkflowStage', 'ReleasedToPatientAt')
      )
    `),
  ]);

  const tableInfo = tableResult.recordset[0] || {};

  return {
    hasEncounterTable: Boolean(tableInfo.EmrEncounterTableId),
    hasClinicalNotesTable: Boolean(tableInfo.EmrClinicalNotesTableId),
    hasDiagnosisTable: Boolean(tableInfo.EmrDiagnosisRecordsTableId),
    hasConsultationTable: Boolean(tableInfo.AppointmentConsultationsTableId),
    hasLabReviewTable: Boolean(tableInfo.EmrLabReportReviewsTableId),
    hasLabAttachmentTable: Boolean(tableInfo.LabResultAttachmentsTableId),
    hasLabOrderWorkflowStage: columnResult.recordset.some((row) => row.name === 'WorkflowStage'),
    hasLabOrderReleasedToPatientAt: columnResult.recordset.some((row) => row.name === 'ReleasedToPatientAt'),
    appointmentColumns: new Set(columnResult.recordset.map((row) => row.name)),
  };
};

const getPatientProfile = async ({ pool, hospitalId, patientId }) => {
  const result = await pool.request()
    .input('PatientId', sql.BigInt, parseInteger(patientId))
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT TOP 1
        p.Id,
        p.HospitalId,
        p.UHID,
        p.FirstName,
        p.LastName,
        p.FirstName + ' ' + p.LastName AS FullName,
        p.Gender,
        p.DateOfBirth,
        p.BloodGroup,
        p.Phone,
        p.Email,
        p.KnownAllergies,
        p.ChronicConditions,
        p.CurrentMedications,
        p.InsuranceProvider,
        p.InsurancePolicyNo,
        p.PhotoUrl
      FROM dbo.PatientProfiles p
      WHERE p.Id = @PatientId
        AND p.DeletedAt IS NULL
        AND (@HospitalId IS NULL OR p.HospitalId = @HospitalId)
    `);

  return result.recordset[0] || null;
};

const buildConsultationSourceConfig = (schema) => {
  const hasPrimaryDiagnosisColumn = schema.appointmentColumns.has('PrimaryDiagnosis');
  const hasFollowUpNotesColumn = schema.appointmentColumns.has('FollowUpNotes');

  const consultationJoin = schema.hasConsultationTable
    ? 'LEFT JOIN dbo.AppointmentConsultations ac ON ac.AppointmentId = a.Id'
    : '';

  const diagnosisExpression = schema.hasConsultationTable && hasPrimaryDiagnosisColumn
    ? 'COALESCE(ac.PrimaryDiagnosis, a.PrimaryDiagnosis)'
    : schema.hasConsultationTable
      ? 'ac.PrimaryDiagnosis'
      : hasPrimaryDiagnosisColumn
        ? 'a.PrimaryDiagnosis'
        : 'NULL';

  const consultationNotesExpression = schema.hasConsultationTable
    ? 'ac.ConsultationNotes'
    : 'NULL';

  const followUpNotesExpression = schema.hasConsultationTable && hasFollowUpNotesColumn
    ? 'COALESCE(ac.FollowUpNotes, a.FollowUpNotes)'
    : schema.hasConsultationTable
      ? 'ac.FollowUpNotes'
      : hasFollowUpNotesColumn
        ? 'a.FollowUpNotes'
        : 'NULL';

  const recordedAtExpression = schema.hasConsultationTable
    ? 'COALESCE(ac.CompletedAt, a.UpdatedAt, CAST(a.AppointmentDate AS DATETIME2(0)))'
    : 'COALESCE(a.UpdatedAt, CAST(a.AppointmentDate AS DATETIME2(0)))';

  return {
    consultationJoin,
    diagnosisExpression,
    consultationNotesExpression,
    followUpNotesExpression,
    recordedAtExpression,
    hasFallbackDiagnoses: schema.hasConsultationTable || hasPrimaryDiagnosisColumn,
    hasFallbackNotes: schema.hasConsultationTable || hasFollowUpNotesColumn,
  };
};

const sortDescendingByDate = (items, fieldNames) => {
  return [...items].sort((left, right) => {
    const leftValue = fieldNames
      .map((field) => left?.[field])
      .find(Boolean);
    const rightValue = fieldNames
      .map((field) => right?.[field])
      .find(Boolean);

    const leftTime = leftValue ? new Date(leftValue).getTime() : 0;
    const rightTime = rightValue ? new Date(rightValue).getTime() : 0;
    const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
    const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
    return safeRightTime - safeLeftTime;
  });
};

const getPatientEmrSummary = async ({
  pool,
  hospitalId,
  patientId,
  includePrivateNotes = false,
}) => {
  const schema = await getEmrSchemaInfo(pool);
  const profile = await getPatientProfile({ pool, hospitalId, patientId });

  if (!profile) return null;

  let encounters = [];
  if (schema.hasEncounterTable) {
    const result = await pool.request()
      .input('PatientId', sql.BigInt, parseInteger(patientId))
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('IncludePrivateNotes', sql.Bit, Boolean(includePrivateNotes))
      .query(`
        SELECT
          e.Id,
          e.AppointmentId,
          e.PatientId,
          e.DoctorId,
          e.EncounterType,
          e.EncounterDate,
          e.ChiefComplaint,
          e.ProvisionalDiagnosis,
          e.EncounterStatus,
          e.FollowUpAdvice,
          e.CreatedAt,
          e.UpdatedAt,
          docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
          dep.Name AS DepartmentName,
          (
            SELECT COUNT(*)
            FROM dbo.EmrDiagnosisRecords dr
            WHERE dr.EncounterId = e.Id
          ) AS DiagnosisCount,
          (
            SELECT COUNT(*)
            FROM dbo.EmrClinicalNotes note
            WHERE note.EncounterId = e.Id
              AND (@IncludePrivateNotes = 1 OR note.IsPatientVisible = 1)
          ) AS NoteCount,
          (
            SELECT COUNT(*)
            FROM dbo.LabOrders lo
            WHERE lo.PatientId = e.PatientId
              AND lo.AppointmentId = e.AppointmentId
          ) AS LabOrderCount
        FROM dbo.EmrEncounters e
        LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = e.DoctorId
        LEFT JOIN dbo.Users docUser ON docUser.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        WHERE e.PatientId = @PatientId
          AND (@HospitalId IS NULL OR e.HospitalId = @HospitalId)
        ORDER BY e.EncounterDate DESC, e.Id DESC
      `);

    encounters = result.recordset;
  }

  let diagnoses = [];
  if (schema.hasDiagnosisTable && schema.hasEncounterTable) {
    const result = await pool.request()
      .input('PatientId', sql.BigInt, parseInteger(patientId))
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT
          dr.Id,
          dr.EncounterId,
          e.AppointmentId,
          dr.PatientId,
          dr.DiagnosisName,
          dr.ICDCode,
          dr.DiagnosisType,
          dr.Severity,
          dr.IsPrimary,
          dr.RecordedAt,
          recUser.FirstName + ' ' + recUser.LastName AS RecordedByName,
          docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
          dep.Name AS DepartmentName,
          e.EncounterDate,
          CAST('EMR' AS NVARCHAR(30)) AS RecordSource
        FROM dbo.EmrDiagnosisRecords dr
        JOIN dbo.EmrEncounters e ON e.Id = dr.EncounterId
        LEFT JOIN dbo.Users recUser ON recUser.Id = dr.RecordedByUserId
        LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = e.DoctorId
        LEFT JOIN dbo.Users docUser ON docUser.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        WHERE dr.PatientId = @PatientId
          AND (@HospitalId IS NULL OR e.HospitalId = @HospitalId)
        ORDER BY dr.RecordedAt DESC, dr.Id DESC
      `);

    diagnoses = result.recordset;
  }

  const consultationConfig = buildConsultationSourceConfig(schema);
  const encounterJoin = schema.hasEncounterTable
    ? 'LEFT JOIN dbo.EmrEncounters e ON e.AppointmentId = a.Id'
    : '';
  const encounterMissingPredicate = schema.hasEncounterTable
    ? 'AND e.Id IS NULL'
    : '';
  if (consultationConfig.hasFallbackDiagnoses) {
    const result = await pool.request()
      .input('PatientId', sql.BigInt, parseInteger(patientId))
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT
          CAST(NULL AS BIGINT) AS Id,
          CAST(NULL AS BIGINT) AS EncounterId,
          a.Id AS AppointmentId,
          a.PatientId,
          ${consultationConfig.diagnosisExpression} AS DiagnosisName,
          CAST(NULL AS NVARCHAR(20)) AS ICDCode,
          CAST('Provisional' AS NVARCHAR(20)) AS DiagnosisType,
          CAST('Historical' AS NVARCHAR(20)) AS Severity,
          CAST(1 AS BIT) AS IsPrimary,
          ${consultationConfig.recordedAtExpression} AS RecordedAt,
          docUser.FirstName + ' ' + docUser.LastName AS RecordedByName,
          docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
          dep.Name AS DepartmentName,
          CAST(a.AppointmentDate AS DATETIME2(0)) AS EncounterDate,
          CAST('AppointmentConsultation' AS NVARCHAR(30)) AS RecordSource
        FROM dbo.Appointments a
        JOIN dbo.DoctorProfiles dp ON dp.Id = a.DoctorId
        JOIN dbo.Users docUser ON docUser.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        ${consultationConfig.consultationJoin}
        ${encounterJoin}
        WHERE a.PatientId = @PatientId
          AND a.Status = 'Completed'
          AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
          ${encounterMissingPredicate}
          AND NULLIF(LTRIM(RTRIM(COALESCE(${consultationConfig.diagnosisExpression}, ''))), '') IS NOT NULL
        ORDER BY RecordedAt DESC, a.Id DESC
      `);

    diagnoses = sortDescendingByDate(
      [...diagnoses, ...result.recordset],
      ['RecordedAt', 'EncounterDate']
    );
  }

  let notes = [];
  if (schema.hasClinicalNotesTable && schema.hasEncounterTable) {
    const result = await pool.request()
      .input('PatientId', sql.BigInt, parseInteger(patientId))
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('IncludePrivateNotes', sql.Bit, Boolean(includePrivateNotes))
      .query(`
        SELECT
          note.Id,
          note.EncounterId,
          e.AppointmentId,
          note.NoteType,
          note.NoteText,
          note.IsPatientVisible,
          note.LinkedLabOrderId,
          lo.OrderNumber,
          note.RecordedAt,
          recUser.FirstName + ' ' + recUser.LastName AS RecordedByName,
          docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
          dep.Name AS DepartmentName,
          CAST('EMR' AS NVARCHAR(30)) AS RecordSource
        FROM dbo.EmrClinicalNotes note
        JOIN dbo.EmrEncounters e ON e.Id = note.EncounterId
        LEFT JOIN dbo.LabOrders lo ON lo.Id = note.LinkedLabOrderId
        LEFT JOIN dbo.Users recUser ON recUser.Id = note.RecordedByUserId
        LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = e.DoctorId
        LEFT JOIN dbo.Users docUser ON docUser.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        WHERE e.PatientId = @PatientId
          AND (@HospitalId IS NULL OR e.HospitalId = @HospitalId)
          AND (@IncludePrivateNotes = 1 OR note.IsPatientVisible = 1)
        ORDER BY note.RecordedAt DESC, note.Id DESC
      `);

    notes = result.recordset;
  }

  if (schema.hasLabReviewTable) {
    const labReviewNotes = await pool.request()
      .input('PatientId', sql.BigInt, parseInteger(patientId))
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT
          CAST(NULL AS BIGINT) AS Id,
          rev.EncounterId,
          lo.AppointmentId,
          CAST('LabReview' AS NVARCHAR(30)) AS NoteType,
          rev.PatientVisibleNote AS NoteText,
          CAST(1 AS BIT) AS IsPatientVisible,
          lo.Id AS LinkedLabOrderId,
          lo.OrderNumber,
          rev.ReviewedAt AS RecordedAt,
          docUser.FirstName + ' ' + docUser.LastName AS RecordedByName,
          docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
          dep.Name AS DepartmentName,
          CAST('LabReview' AS NVARCHAR(30)) AS RecordSource
        FROM dbo.EmrLabReportReviews rev
        JOIN dbo.LabOrders lo ON lo.Id = rev.LabOrderId
        LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = rev.DoctorId
        LEFT JOIN dbo.Users docUser ON docUser.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        WHERE rev.PatientId = @PatientId
          AND (@HospitalId IS NULL OR lo.HospitalId = @HospitalId)
          AND NULLIF(LTRIM(RTRIM(COALESCE(rev.PatientVisibleNote, ''))), '') IS NOT NULL
      `);

    notes = [...notes, ...labReviewNotes.recordset];
  }

  if (consultationConfig.hasFallbackNotes) {
    const fallbackNotes = await pool.request()
      .input('PatientId', sql.BigInt, parseInteger(patientId))
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT
          CAST(NULL AS BIGINT) AS Id,
          CAST(NULL AS BIGINT) AS EncounterId,
          a.Id AS AppointmentId,
          CAST('Clinical' AS NVARCHAR(30)) AS NoteType,
          ${consultationConfig.consultationNotesExpression} AS NoteText,
          CAST(1 AS BIT) AS IsPatientVisible,
          CAST(NULL AS BIGINT) AS LinkedLabOrderId,
          CAST(NULL AS NVARCHAR(60)) AS OrderNumber,
          ${consultationConfig.recordedAtExpression} AS RecordedAt,
          docUser.FirstName + ' ' + docUser.LastName AS RecordedByName,
          docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
          dep.Name AS DepartmentName,
          CAST('AppointmentConsultation' AS NVARCHAR(30)) AS RecordSource
        FROM dbo.Appointments a
        JOIN dbo.DoctorProfiles dp ON dp.Id = a.DoctorId
        JOIN dbo.Users docUser ON docUser.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        ${consultationConfig.consultationJoin}
        ${encounterJoin}
        WHERE a.PatientId = @PatientId
          AND a.Status = 'Completed'
          AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
          ${encounterMissingPredicate}
          AND NULLIF(LTRIM(RTRIM(COALESCE(${consultationConfig.consultationNotesExpression}, ''))), '') IS NOT NULL

        UNION ALL

        SELECT
          CAST(NULL AS BIGINT) AS Id,
          CAST(NULL AS BIGINT) AS EncounterId,
          a.Id AS AppointmentId,
          CAST('FollowUp' AS NVARCHAR(30)) AS NoteType,
          ${consultationConfig.followUpNotesExpression} AS NoteText,
          CAST(1 AS BIT) AS IsPatientVisible,
          CAST(NULL AS BIGINT) AS LinkedLabOrderId,
          CAST(NULL AS NVARCHAR(60)) AS OrderNumber,
          ${consultationConfig.recordedAtExpression} AS RecordedAt,
          docUser.FirstName + ' ' + docUser.LastName AS RecordedByName,
          docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
          dep.Name AS DepartmentName,
          CAST('AppointmentConsultation' AS NVARCHAR(30)) AS RecordSource
        FROM dbo.Appointments a
        JOIN dbo.DoctorProfiles dp ON dp.Id = a.DoctorId
        JOIN dbo.Users docUser ON docUser.Id = dp.UserId
        LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
        ${consultationConfig.consultationJoin}
        ${encounterJoin}
        WHERE a.PatientId = @PatientId
          AND a.Status = 'Completed'
          AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
          ${encounterMissingPredicate}
          AND NULLIF(LTRIM(RTRIM(COALESCE(${consultationConfig.followUpNotesExpression}, ''))), '') IS NOT NULL
      `);

    notes = [...notes, ...fallbackNotes.recordset];
  }

  notes = sortDescendingByDate(notes, ['RecordedAt']);

  const patientDocumentVisibilityPredicate = includePrivateNotes
    ? ''
    : schema.hasLabOrderReleasedToPatientAt
      ? `AND (lo.ReleasedToPatientAt IS NOT NULL${schema.hasLabOrderWorkflowStage ? " OR lo.WorkflowStage = 'Released'" : ''})`
      : schema.hasLabOrderWorkflowStage
        ? "AND lo.WorkflowStage = 'Released'"
        : 'AND lo.VerifiedAt IS NOT NULL';

  const documentResult = schema.hasLabAttachmentTable
    ? await pool.request()
      .input('PatientId', sql.BigInt, parseInteger(patientId))
      .input('HospitalId', sql.BigInt, hospitalId)
      .query(`
        SELECT
          att.Id,
          att.LabOrderId,
          att.LabOrderItemId,
          att.FileCategory,
          att.FileName,
          att.StoragePath,
          att.ContentType,
          att.FileSizeBytes,
          att.IsPrimary,
          att.UploadedAt,
          lo.OrderNumber,
          lo.OrderDate,
          lo.Status AS LabOrderStatus,
          lt.Name AS TestName
        FROM dbo.LabResultAttachments att
        JOIN dbo.LabOrders lo ON lo.Id = att.LabOrderId
        LEFT JOIN dbo.LabOrderItems loi ON loi.Id = att.LabOrderItemId
        LEFT JOIN dbo.LabTests lt ON lt.Id = loi.TestId
        WHERE lo.PatientId = @PatientId
          AND (@HospitalId IS NULL OR lo.HospitalId = @HospitalId)
          ${patientDocumentVisibilityPredicate}
        ORDER BY att.UploadedAt DESC, att.Id DESC
      `)
    : { recordset: [] };

  return {
    patient: profile,
    metrics: {
      encounterCount: encounters.length,
      diagnosisCount: diagnoses.length,
      noteCount: notes.length,
      documentCount: documentResult.recordset.length,
    },
    encounters,
    diagnoses,
    notes,
    documents: documentResult.recordset,
  };
};

const ensureEncounterAccess = async ({
  pool,
  encounterId,
  hospitalId,
  actorRole,
  actorUserId,
  allowPatientViewer = true,
}) => {
  const schema = await getEmrSchemaInfo(pool);
  if (!schema.hasEncounterTable) return null;

  const result = await pool.request()
    .input('EncounterId', sql.BigInt, parseInteger(encounterId))
    .input('HospitalId', sql.BigInt, hospitalId)
    .query(`
      SELECT TOP 1
        e.Id,
        e.HospitalId,
        e.AppointmentId,
        e.PatientId,
        e.DoctorId,
        e.EncounterType,
        e.EncounterDate,
        e.ChiefComplaint,
        e.ProvisionalDiagnosis,
        e.EncounterStatus,
        e.FollowUpAdvice,
        dp.UserId AS DoctorUserId
      FROM dbo.EmrEncounters e
      LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = e.DoctorId
      WHERE e.Id = @EncounterId
        AND (@HospitalId IS NULL OR e.HospitalId = @HospitalId)
    `);

  const encounter = result.recordset[0] || null;
  if (!encounter) return null;

  if (actorRole === 'doctor' && parseInteger(encounter.DoctorUserId) !== parseInteger(actorUserId)) {
    return null;
  }

  if (!allowPatientViewer && actorRole === 'patient') {
    return null;
  }

  return encounter;
};

const upsertEncounterForAppointmentCompletion = async ({
  pool,
  hospitalId,
  appointmentId,
  patientId,
  doctorId,
  appointmentDate,
  reason = null,
  diagnosis = null,
  followUpNotes = null,
  actorUserId = null,
}) => {
  const schema = await getEmrSchemaInfo(pool);
  if (!schema.hasEncounterTable) return null;

  const result = await pool.request()
    .input('HospitalId', sql.BigInt, parseInteger(hospitalId))
    .input('AppointmentId', sql.BigInt, parseInteger(appointmentId))
    .input('PatientId', sql.BigInt, parseInteger(patientId))
    .input('DoctorId', sql.BigInt, parseInteger(doctorId))
    .input('EncounterDate', sql.DateTime2(0), appointmentDate || new Date())
    .input('ChiefComplaint', sql.NVarChar(500), reason || null)
    .input('ProvisionalDiagnosis', sql.NVarChar(1000), diagnosis || null)
    .input('FollowUpAdvice', sql.NVarChar(1000), followUpNotes || null)
    .input('ActorUserId', sql.BigInt, parseInteger(actorUserId))
    .query(`
      DECLARE @EncounterId BIGINT;

      SELECT TOP 1 @EncounterId = Id
      FROM dbo.EmrEncounters
      WHERE AppointmentId = @AppointmentId;

      IF @EncounterId IS NULL
      BEGIN
        INSERT INTO dbo.EmrEncounters
          (HospitalId, AppointmentId, PatientId, DoctorId, EncounterType, EncounterDate,
           ChiefComplaint, ProvisionalDiagnosis, EncounterStatus, FollowUpAdvice,
           CreatedBy, UpdatedBy)
        VALUES
          (@HospitalId, @AppointmentId, @PatientId, @DoctorId, 'OPD', @EncounterDate,
           @ChiefComplaint, @ProvisionalDiagnosis, 'Closed', @FollowUpAdvice,
           @ActorUserId, @ActorUserId);

        SET @EncounterId = SCOPE_IDENTITY();
      END
      ELSE
      BEGIN
        UPDATE dbo.EmrEncounters
        SET
          ChiefComplaint = COALESCE(@ChiefComplaint, ChiefComplaint),
          ProvisionalDiagnosis = COALESCE(@ProvisionalDiagnosis, ProvisionalDiagnosis),
          FollowUpAdvice = COALESCE(@FollowUpAdvice, FollowUpAdvice),
          EncounterStatus = 'Closed',
          UpdatedBy = @ActorUserId,
          UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @EncounterId;
      END

      SELECT @EncounterId AS EncounterId;
    `);

  return parseInteger(result.recordset[0]?.EncounterId);
};

const upsertEncounterPrimaryDiagnosis = async ({
  pool,
  encounterId,
  patientId,
  diagnosis,
  actorUserId,
}) => {
  const schema = await getEmrSchemaInfo(pool);
  if (!schema.hasEncounterTable || !schema.hasDiagnosisTable || !parseInteger(encounterId)) return null;

  const diagnosisText = String(diagnosis || '').trim();
  if (!diagnosisText) return null;

  await pool.request()
    .input('EncounterId', sql.BigInt, parseInteger(encounterId))
    .input('PatientId', sql.BigInt, parseInteger(patientId))
    .input('DiagnosisName', sql.NVarChar(255), diagnosisText)
    .input('ActorUserId', sql.BigInt, parseInteger(actorUserId))
    .query(`
      UPDATE dbo.EmrDiagnosisRecords
      SET IsPrimary = 0
      WHERE EncounterId = @EncounterId
        AND IsPrimary = 1;

      IF EXISTS (
        SELECT 1
        FROM dbo.EmrDiagnosisRecords
        WHERE EncounterId = @EncounterId
          AND DiagnosisName = @DiagnosisName
      )
      BEGIN
        ;WITH target AS (
          SELECT TOP 1 Id
          FROM dbo.EmrDiagnosisRecords
          WHERE EncounterId = @EncounterId
            AND DiagnosisName = @DiagnosisName
          ORDER BY Id DESC
        )
        UPDATE dbo.EmrDiagnosisRecords
        SET
          DiagnosisType = 'Confirmed',
          Severity = COALESCE(Severity, 'Moderate'),
          IsPrimary = 1,
          RecordedByUserId = @ActorUserId,
          RecordedAt = SYSUTCDATETIME()
        WHERE Id IN (SELECT Id FROM target);
      END
      ELSE
      BEGIN
        INSERT INTO dbo.EmrDiagnosisRecords
          (EncounterId, PatientId, DiagnosisName, DiagnosisType, Severity, IsPrimary, RecordedByUserId)
        VALUES
          (@EncounterId, @PatientId, @DiagnosisName, 'Confirmed', 'Moderate', 1, @ActorUserId);
      END
    `);

  return true;
};

const upsertEncounterNote = async ({
  pool,
  encounterId,
  noteType = 'Clinical',
  noteText,
  actorUserId,
  isPatientVisible = false,
}) => {
  const schema = await getEmrSchemaInfo(pool);
  if (!schema.hasEncounterTable || !schema.hasClinicalNotesTable || !parseInteger(encounterId)) return null;

  const content = String(noteText || '').trim();
  if (!content) return null;

  await pool.request()
    .input('EncounterId', sql.BigInt, parseInteger(encounterId))
    .input('NoteType', sql.NVarChar(30), noteType)
    .input('NoteText', sql.NVarChar(sql.MAX), content)
    .input('ActorUserId', sql.BigInt, parseInteger(actorUserId))
    .input('IsPatientVisible', sql.Bit, Boolean(isPatientVisible))
    .query(`
      IF EXISTS (
        SELECT 1
        FROM dbo.EmrClinicalNotes
        WHERE EncounterId = @EncounterId
          AND NoteType = @NoteType
          AND RecordedByUserId = @ActorUserId
      )
      BEGIN
        ;WITH target AS (
          SELECT TOP 1 Id
          FROM dbo.EmrClinicalNotes
          WHERE EncounterId = @EncounterId
            AND NoteType = @NoteType
            AND RecordedByUserId = @ActorUserId
          ORDER BY Id DESC
        )
        UPDATE dbo.EmrClinicalNotes
        SET
          NoteText = @NoteText,
          IsPatientVisible = @IsPatientVisible,
          RecordedAt = SYSUTCDATETIME()
        WHERE Id IN (SELECT Id FROM target);
      END
      ELSE
      BEGIN
        INSERT INTO dbo.EmrClinicalNotes
          (EncounterId, NoteType, NoteText, IsPatientVisible, RecordedByUserId)
        VALUES
          (@EncounterId, @NoteType, @NoteText, @IsPatientVisible, @ActorUserId);
      END
    `);

  return true;
};

module.exports = {
  parseInteger,
  normalizeBoolean,
  resolveHospitalId,
  getDoctorProfileByUserId,
  getEmrSchemaInfo,
  getPatientProfile,
  getPatientEmrSummary,
  ensureEncounterAccess,
  upsertEncounterForAppointmentCompletion,
  upsertEncounterPrimaryDiagnosis,
  upsertEncounterNote,
};
