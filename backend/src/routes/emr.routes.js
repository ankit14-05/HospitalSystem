const router = require('express').Router();
const { authenticate: protect, authorize } = require('../middleware/auth.middleware');
const { getPool, sql, withTransaction } = require('../config/database');
const { requireActivePatientProfile } = require('../services/patientAccess.service');
const {
  parseInteger,
  normalizeBoolean,
  resolveHospitalId,
  getDoctorProfileByUserId,
  getPatientProfile,
  getEmrSchemaInfo,
  getPatientEmrSummary,
  ensureEncounterAccess,
} = require('../services/emr.service');

const VIEW_ROLES = ['patient', 'doctor', 'nurse', 'admin', 'superadmin'];
const EDIT_ROLES = ['doctor', 'admin', 'superadmin'];

router.use(protect);

const sendUnavailableSchemaResponse = (
  res,
  message = 'EMR encounter tables are not available in this database yet.'
) => res.status(409).json({ success: false, message });

const resolveEditorDoctorId = async (req, pool) => {
  if (req.user.role !== 'doctor') {
    return parseInteger(req.body.doctorId || req.body.doctorProfileId);
  }

  const profile = await getDoctorProfileByUserId(pool, req.user.id);
  return profile?.Id || null;
};

const ensurePatientViewerAccess = async (req, pool, patientId) => {
  if (req.user.role !== 'patient') return true;
  const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
  return parseInteger(activeProfile.patientId) === parseInteger(patientId);
};

const getEncounterDetailPayload = async ({
  pool,
  encounterId,
  hospitalId,
  includePrivateNotes,
}) => {
  const schema = await getEmrSchemaInfo(pool);
  if (!schema.hasEncounterTable) return null;

  const workflowStageSelect = schema.hasLabOrderWorkflowStage
    ? 'lo.WorkflowStage'
    : 'CAST(NULL AS NVARCHAR(30))';
  const encounterResult = await pool.request()
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
        e.CreatedAt,
        e.UpdatedAt,
        docUser.FirstName + ' ' + docUser.LastName AS DoctorName,
        dep.Name AS DepartmentName,
        p.FirstName + ' ' + p.LastName AS PatientName,
        p.UHID
      FROM dbo.EmrEncounters e
      JOIN dbo.PatientProfiles p ON p.Id = e.PatientId
      LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = e.DoctorId
      LEFT JOIN dbo.Users docUser ON docUser.Id = dp.UserId
      LEFT JOIN dbo.Departments dep ON dep.Id = dp.DepartmentId
      WHERE e.Id = @EncounterId
        AND (@HospitalId IS NULL OR e.HospitalId = @HospitalId)
    `);

  const encounter = encounterResult.recordset[0] || null;
  if (!encounter) return null;

  const diagnosesResult = schema.hasDiagnosisTable
    ? await pool.request()
      .input('EncounterId', sql.BigInt, parseInteger(encounterId))
      .query(`
        SELECT
          dr.Id,
          dr.EncounterId,
          dr.PatientId,
          dr.DiagnosisName,
          dr.ICDCode,
          dr.DiagnosisType,
          dr.Severity,
          dr.IsPrimary,
          dr.RecordedAt,
          recUser.FirstName + ' ' + recUser.LastName AS RecordedByName
        FROM dbo.EmrDiagnosisRecords dr
        LEFT JOIN dbo.Users recUser ON recUser.Id = dr.RecordedByUserId
        WHERE dr.EncounterId = @EncounterId
        ORDER BY dr.RecordedAt DESC, dr.Id DESC
      `)
    : { recordset: [] };

  const notesResult = schema.hasClinicalNotesTable
    ? await pool.request()
      .input('EncounterId', sql.BigInt, parseInteger(encounterId))
      .input('IncludePrivateNotes', sql.Bit, Boolean(includePrivateNotes))
      .query(`
        SELECT
          note.Id,
          note.EncounterId,
          note.NoteType,
          note.NoteText,
          note.IsPatientVisible,
          note.LinkedLabOrderId,
          lo.OrderNumber,
          note.RecordedAt,
          recUser.FirstName + ' ' + recUser.LastName AS RecordedByName
        FROM dbo.EmrClinicalNotes note
        LEFT JOIN dbo.Users recUser ON recUser.Id = note.RecordedByUserId
        LEFT JOIN dbo.LabOrders lo ON lo.Id = note.LinkedLabOrderId
        WHERE note.EncounterId = @EncounterId
          AND (@IncludePrivateNotes = 1 OR note.IsPatientVisible = 1)
        ORDER BY note.RecordedAt DESC, note.Id DESC
      `)
    : { recordset: [] };

  const labOrdersWhere = schema.hasLabReviewTable
    ? `
        WHERE lo.AppointmentId = @AppointmentId
           OR EXISTS (
             SELECT 1
             FROM dbo.EmrLabReportReviews rev
             WHERE rev.LabOrderId = lo.Id
               AND rev.EncounterId = @EncounterId
           )
      `
    : `
        WHERE lo.AppointmentId = @AppointmentId
      `;

  const labOrdersResult = await pool.request()
    .input('EncounterId', sql.BigInt, parseInteger(encounterId))
    .input('AppointmentId', sql.BigInt, parseInteger(encounter.AppointmentId))
    .query(`
      SELECT DISTINCT
        lo.Id,
        lo.OrderNumber,
        lo.OrderDate,
        lo.Status,
        lo.Priority,
        ${workflowStageSelect} AS WorkflowStage
      FROM dbo.LabOrders lo
      ${labOrdersWhere}
      ORDER BY lo.OrderDate DESC, lo.Id DESC
    `);

  return {
    ...encounter,
    diagnoses: diagnosesResult.recordset || [],
    notes: notesResult.recordset || [],
    labOrders: labOrdersResult.recordset || [],
  };
};

router.get('/my',
  authorize('patient'),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const hospitalId = resolveHospitalId(req);
      const activeProfile = await requireActivePatientProfile(req.user, req.sessionId, pool);
      const summary = await getPatientEmrSummary({
        pool,
        hospitalId,
        patientId: activeProfile.patientId,
        includePrivateNotes: false,
      });

      if (!summary) {
        return res.status(404).json({ success: false, message: 'Patient EMR not found' });
      }

      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/patients/:patientId',
  authorize('doctor', 'nurse', 'admin', 'superadmin'),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const hospitalId = resolveHospitalId(req);
      const patientId = parseInteger(req.params.patientId);

      if (!patientId) {
        return res.status(400).json({ success: false, message: 'A valid patientId is required' });
      }

      const summary = await getPatientEmrSummary({
        pool,
        hospitalId,
        patientId,
        includePrivateNotes: true,
      });

      if (!summary) {
        return res.status(404).json({ success: false, message: 'Patient EMR not found' });
      }

      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/encounters/:encounterId',
  authorize(...VIEW_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getEmrSchemaInfo(pool);
      if (!schema.hasEncounterTable) {
        return sendUnavailableSchemaResponse(res);
      }
      const hospitalId = resolveHospitalId(req);
      const encounterId = parseInteger(req.params.encounterId);
      const encounter = await ensureEncounterAccess({
        pool,
        encounterId,
        hospitalId,
        actorRole: req.user.role,
        actorUserId: req.user.id,
        allowPatientViewer: true,
      });

      if (!encounter) {
        return res.status(404).json({ success: false, message: 'Encounter not found' });
      }

      const hasPatientAccess = await ensurePatientViewerAccess(req, pool, encounter.PatientId);
      if (!hasPatientAccess) {
        return res.status(403).json({ success: false, message: 'Access denied to this encounter' });
      }

      const detail = await getEncounterDetailPayload({
        pool,
        encounterId,
        hospitalId,
        includePrivateNotes: req.user.role !== 'patient',
      });

      res.json({ success: true, data: detail });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/encounters',
  authorize(...EDIT_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getEmrSchemaInfo(pool);
      if (!schema.hasEncounterTable) {
        return sendUnavailableSchemaResponse(res);
      }
      const hospitalId = resolveHospitalId(req);
      const actorUserId = parseInteger(req.user.id);
      const {
        patientId,
        appointmentId = null,
        doctorId = null,
        encounterType = 'OPD',
        encounterDate = null,
        chiefComplaint = null,
        provisionalDiagnosis = null,
        encounterStatus = 'Open',
        followUpAdvice = null,
        diagnoses = [],
        notes = [],
      } = req.body || {};

      const normalizedPatientId = parseInteger(patientId);
      const normalizedAppointmentId = parseInteger(appointmentId);
      let effectiveDoctorId = await resolveEditorDoctorId(
        { ...req, body: { ...req.body, doctorId } },
        pool
      );
      const normalizedDiagnoses = Array.isArray(diagnoses) ? diagnoses : [];
      const normalizedNotes = Array.isArray(notes) ? notes : [];

      if (!normalizedPatientId) {
        return res.status(400).json({ success: false, message: 'patientId is required' });
      }

      const patient = await getPatientProfile({
        pool,
        hospitalId,
        patientId: normalizedPatientId,
      });

      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found in this hospital' });
      }

      const result = await withTransaction(async (transaction) => {
        const request = () => new sql.Request(transaction);
        let existingEncounter = null;

        if (normalizedAppointmentId) {
          const appointmentResult = await request()
            .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
            .input('PatientId', sql.BigInt, normalizedPatientId)
            .input('HospitalId', sql.BigInt, hospitalId)
            .query(`
              SELECT TOP 1
                a.Id,
                a.PatientId,
                a.DoctorId,
                a.AppointmentDate
              FROM dbo.Appointments a
              WHERE a.Id = @AppointmentId
                AND a.PatientId = @PatientId
                AND (@HospitalId IS NULL OR a.HospitalId = @HospitalId)
            `);

          if (!appointmentResult.recordset.length) {
            throw Object.assign(new Error('Appointment not found for this patient'), { statusCode: 404 });
          }

          const appointment = appointmentResult.recordset[0];
          effectiveDoctorId = effectiveDoctorId || parseInteger(appointment.DoctorId);

          if (req.user.role === 'doctor' && parseInteger(appointment.DoctorId) !== parseInteger(effectiveDoctorId)) {
            throw Object.assign(new Error('This appointment belongs to another doctor'), { statusCode: 403 });
          }

          existingEncounter = await request()
            .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
            .input('HospitalId', sql.BigInt, hospitalId)
            .query(`
              SELECT TOP 1 Id, DoctorId
              FROM dbo.EmrEncounters
              WHERE AppointmentId = @AppointmentId
                AND (@HospitalId IS NULL OR HospitalId = @HospitalId)
            `)
            .then((response) => response.recordset[0] || null);

          if (req.user.role === 'doctor' && existingEncounter && parseInteger(existingEncounter.DoctorId) !== parseInteger(effectiveDoctorId)) {
            throw Object.assign(new Error('This encounter belongs to another doctor'), { statusCode: 403 });
          }
        }

        if (!effectiveDoctorId) {
          throw Object.assign(new Error('Doctor context is required for this encounter'), { statusCode: 400 });
        }

        let encounterId = existingEncounter?.Id || null;

        if (encounterId) {
          await request()
            .input('EncounterId', sql.BigInt, encounterId)
            .input('EncounterType', sql.NVarChar(30), encounterType)
            .input('EncounterDate', sql.DateTime2(0), encounterDate || new Date())
            .input('ChiefComplaint', sql.NVarChar(500), chiefComplaint)
            .input('ProvisionalDiagnosis', sql.NVarChar(1000), provisionalDiagnosis)
            .input('EncounterStatus', sql.NVarChar(20), encounterStatus)
            .input('FollowUpAdvice', sql.NVarChar(1000), followUpAdvice)
            .input('UpdatedBy', sql.BigInt, actorUserId)
            .query(`
              UPDATE dbo.EmrEncounters
              SET
                EncounterType = COALESCE(@EncounterType, EncounterType),
                EncounterDate = COALESCE(@EncounterDate, EncounterDate),
                ChiefComplaint = COALESCE(@ChiefComplaint, ChiefComplaint),
                ProvisionalDiagnosis = COALESCE(@ProvisionalDiagnosis, ProvisionalDiagnosis),
                EncounterStatus = COALESCE(@EncounterStatus, EncounterStatus),
                FollowUpAdvice = COALESCE(@FollowUpAdvice, FollowUpAdvice),
                UpdatedBy = @UpdatedBy,
                UpdatedAt = SYSUTCDATETIME()
              WHERE Id = @EncounterId
            `);
        } else {
          const insertResult = await request()
            .input('HospitalId', sql.BigInt, hospitalId)
            .input('AppointmentId', sql.BigInt, normalizedAppointmentId)
            .input('PatientId', sql.BigInt, normalizedPatientId)
            .input('DoctorId', sql.BigInt, effectiveDoctorId)
            .input('EncounterType', sql.NVarChar(30), encounterType)
            .input('EncounterDate', sql.DateTime2(0), encounterDate || new Date())
            .input('ChiefComplaint', sql.NVarChar(500), chiefComplaint)
            .input('ProvisionalDiagnosis', sql.NVarChar(1000), provisionalDiagnosis)
            .input('EncounterStatus', sql.NVarChar(20), encounterStatus)
            .input('FollowUpAdvice', sql.NVarChar(1000), followUpAdvice)
            .input('CreatedBy', sql.BigInt, actorUserId)
            .query(`
              INSERT INTO dbo.EmrEncounters
                (HospitalId, AppointmentId, PatientId, DoctorId, EncounterType, EncounterDate,
                 ChiefComplaint, ProvisionalDiagnosis, EncounterStatus, FollowUpAdvice,
                 CreatedBy, UpdatedBy)
              OUTPUT INSERTED.Id
              VALUES
                (@HospitalId, @AppointmentId, @PatientId, @DoctorId, @EncounterType, @EncounterDate,
                 @ChiefComplaint, @ProvisionalDiagnosis, @EncounterStatus, @FollowUpAdvice,
                 @CreatedBy, @CreatedBy)
            `);

          encounterId = insertResult.recordset[0].Id;
        }

        if (schema.hasDiagnosisTable) {
          for (const diagnosisEntry of normalizedDiagnoses) {
            const diagnosisName = String(
              diagnosisEntry.diagnosisName ||
              diagnosisEntry.DiagnosisName ||
              ''
            ).trim();

            if (!diagnosisName) continue;

            const isPrimary = Boolean(normalizeBoolean(diagnosisEntry.isPrimary ?? diagnosisEntry.IsPrimary));
            if (isPrimary) {
              await request()
                .input('EncounterId', sql.BigInt, encounterId)
                .query(`
                  UPDATE dbo.EmrDiagnosisRecords
                  SET IsPrimary = 0
                  WHERE EncounterId = @EncounterId
                    AND IsPrimary = 1
                `);
            }

            await request()
              .input('EncounterId', sql.BigInt, encounterId)
              .input('PatientId', sql.BigInt, normalizedPatientId)
              .input('DiagnosisName', sql.NVarChar(255), diagnosisName)
              .input('ICDCode', sql.NVarChar(20), diagnosisEntry.icdCode || diagnosisEntry.ICDCode || null)
              .input('DiagnosisType', sql.NVarChar(20), diagnosisEntry.diagnosisType || diagnosisEntry.DiagnosisType || 'Provisional')
              .input('Severity', sql.NVarChar(20), diagnosisEntry.severity || diagnosisEntry.Severity || null)
              .input('IsPrimary', sql.Bit, isPrimary)
              .input('RecordedByUserId', sql.BigInt, actorUserId)
              .query(`
                IF NOT EXISTS (
                  SELECT 1
                  FROM dbo.EmrDiagnosisRecords
                  WHERE EncounterId = @EncounterId
                    AND DiagnosisName = @DiagnosisName
                    AND ISNULL(ICDCode, '') = ISNULL(@ICDCode, '')
                    AND DiagnosisType = @DiagnosisType
                )
                BEGIN
                  INSERT INTO dbo.EmrDiagnosisRecords
                    (EncounterId, PatientId, DiagnosisName, ICDCode, DiagnosisType, Severity, IsPrimary, RecordedByUserId)
                  VALUES
                    (@EncounterId, @PatientId, @DiagnosisName, @ICDCode, @DiagnosisType, @Severity, @IsPrimary, @RecordedByUserId)
                END
              `);
          }
        }

        if (schema.hasClinicalNotesTable) {
          for (const noteEntry of normalizedNotes) {
            const noteText = String(noteEntry.noteText || noteEntry.NoteText || '').trim();
            if (!noteText) continue;

            await request()
              .input('EncounterId', sql.BigInt, encounterId)
              .input('NoteType', sql.NVarChar(30), noteEntry.noteType || noteEntry.NoteType || 'Clinical')
              .input('NoteText', sql.NVarChar(sql.MAX), noteText)
              .input('IsPatientVisible', sql.Bit, Boolean(normalizeBoolean(noteEntry.isPatientVisible ?? noteEntry.IsPatientVisible)))
              .input('LinkedLabOrderId', sql.BigInt, parseInteger(noteEntry.linkedLabOrderId || noteEntry.LinkedLabOrderId))
              .input('RecordedByUserId', sql.BigInt, actorUserId)
              .query(`
                IF NOT EXISTS (
                  SELECT 1
                  FROM dbo.EmrClinicalNotes
                  WHERE EncounterId = @EncounterId
                    AND NoteType = @NoteType
                    AND NoteText = @NoteText
                )
                BEGIN
                  INSERT INTO dbo.EmrClinicalNotes
                    (EncounterId, NoteType, NoteText, IsPatientVisible, LinkedLabOrderId, RecordedByUserId)
                  VALUES
                    (@EncounterId, @NoteType, @NoteText, @IsPatientVisible, @LinkedLabOrderId, @RecordedByUserId)
                END
              `);
          }
        }

        return encounterId;
      });

      const payload = await getEncounterDetailPayload({
        pool,
        encounterId: result,
        hospitalId,
        includePrivateNotes: true,
      });

      res.status(201).json({
        success: true,
        message: 'Encounter saved successfully',
        data: payload,
      });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
);

router.patch('/encounters/:encounterId',
  authorize(...EDIT_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getEmrSchemaInfo(pool);
      if (!schema.hasEncounterTable) {
        return sendUnavailableSchemaResponse(res);
      }
      const hospitalId = resolveHospitalId(req);
      const encounterId = parseInteger(req.params.encounterId);
      const actorUserId = parseInteger(req.user.id);
      const context = await ensureEncounterAccess({
        pool,
        encounterId,
        hospitalId,
        actorRole: req.user.role,
        actorUserId,
        allowPatientViewer: false,
      });

      if (!context) {
        return res.status(404).json({ success: false, message: 'Encounter not found' });
      }

      const {
        encounterType = null,
        encounterDate = null,
        chiefComplaint = null,
        provisionalDiagnosis = null,
        encounterStatus = null,
        followUpAdvice = null,
      } = req.body || {};

      await pool.request()
        .input('EncounterId', sql.BigInt, encounterId)
        .input('EncounterType', sql.NVarChar(30), encounterType)
        .input('EncounterDate', sql.DateTime2(0), encounterDate || null)
        .input('ChiefComplaint', sql.NVarChar(500), chiefComplaint)
        .input('ProvisionalDiagnosis', sql.NVarChar(1000), provisionalDiagnosis)
        .input('EncounterStatus', sql.NVarChar(20), encounterStatus)
        .input('FollowUpAdvice', sql.NVarChar(1000), followUpAdvice)
        .input('UpdatedBy', sql.BigInt, actorUserId)
        .query(`
          UPDATE dbo.EmrEncounters
          SET
            EncounterType = COALESCE(@EncounterType, EncounterType),
            EncounterDate = COALESCE(@EncounterDate, EncounterDate),
            ChiefComplaint = COALESCE(@ChiefComplaint, ChiefComplaint),
            ProvisionalDiagnosis = COALESCE(@ProvisionalDiagnosis, ProvisionalDiagnosis),
            EncounterStatus = COALESCE(@EncounterStatus, EncounterStatus),
            FollowUpAdvice = COALESCE(@FollowUpAdvice, FollowUpAdvice),
            UpdatedBy = @UpdatedBy,
            UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @EncounterId
        `);

      const payload = await getEncounterDetailPayload({
        pool,
        encounterId,
        hospitalId,
        includePrivateNotes: true,
      });

      res.json({
        success: true,
        message: 'Encounter updated successfully',
        data: payload,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/encounters/:encounterId/diagnoses',
  authorize(...EDIT_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getEmrSchemaInfo(pool);
      if (!schema.hasEncounterTable || !schema.hasDiagnosisTable) {
        return sendUnavailableSchemaResponse(res, 'EMR diagnosis tables are not available in this database yet.');
      }
      const hospitalId = resolveHospitalId(req);
      const encounterId = parseInteger(req.params.encounterId);
      const actorUserId = parseInteger(req.user.id);
      const context = await ensureEncounterAccess({
        pool,
        encounterId,
        hospitalId,
        actorRole: req.user.role,
        actorUserId,
        allowPatientViewer: false,
      });

      if (!context) {
        return res.status(404).json({ success: false, message: 'Encounter not found' });
      }

      const diagnosisName = String(req.body?.diagnosisName || '').trim();
      if (!diagnosisName) {
        return res.status(400).json({ success: false, message: 'diagnosisName is required' });
      }

      const isPrimary = Boolean(normalizeBoolean(req.body?.isPrimary));
      if (isPrimary) {
        await pool.request()
          .input('EncounterId', sql.BigInt, encounterId)
          .query(`
            UPDATE dbo.EmrDiagnosisRecords
            SET IsPrimary = 0
            WHERE EncounterId = @EncounterId
              AND IsPrimary = 1
          `);
      }

      const result = await pool.request()
        .input('EncounterId', sql.BigInt, encounterId)
        .input('PatientId', sql.BigInt, parseInteger(context.PatientId))
        .input('DiagnosisName', sql.NVarChar(255), diagnosisName)
        .input('ICDCode', sql.NVarChar(20), req.body?.icdCode || null)
        .input('DiagnosisType', sql.NVarChar(20), req.body?.diagnosisType || 'Provisional')
        .input('Severity', sql.NVarChar(20), req.body?.severity || null)
        .input('IsPrimary', sql.Bit, isPrimary)
        .input('RecordedByUserId', sql.BigInt, actorUserId)
        .query(`
          INSERT INTO dbo.EmrDiagnosisRecords
            (EncounterId, PatientId, DiagnosisName, ICDCode, DiagnosisType, Severity, IsPrimary, RecordedByUserId)
          OUTPUT INSERTED.*
          VALUES
            (@EncounterId, @PatientId, @DiagnosisName, @ICDCode, @DiagnosisType, @Severity, @IsPrimary, @RecordedByUserId)
        `);

      res.status(201).json({
        success: true,
        message: 'Diagnosis added successfully',
        data: result.recordset[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/diagnoses/:diagnosisId',
  authorize(...EDIT_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getEmrSchemaInfo(pool);
      if (!schema.hasEncounterTable || !schema.hasDiagnosisTable) {
        return sendUnavailableSchemaResponse(res, 'EMR diagnosis tables are not available in this database yet.');
      }
      const hospitalId = resolveHospitalId(req);
      const actorUserId = parseInteger(req.user.id);
      const diagnosisId = parseInteger(req.params.diagnosisId);

      const result = await pool.request()
        .input('DiagnosisId', sql.BigInt, diagnosisId)
        .input('HospitalId', sql.BigInt, hospitalId)
        .query(`
          SELECT TOP 1
            dr.Id,
            dr.EncounterId,
            e.PatientId,
            dp.UserId AS DoctorUserId
          FROM dbo.EmrDiagnosisRecords dr
          JOIN dbo.EmrEncounters e ON e.Id = dr.EncounterId
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = e.DoctorId
          WHERE dr.Id = @DiagnosisId
            AND (@HospitalId IS NULL OR e.HospitalId = @HospitalId)
        `);

      const context = result.recordset[0] || null;
      if (!context) {
        return res.status(404).json({ success: false, message: 'Diagnosis record not found' });
      }

      if (req.user.role === 'doctor' && parseInteger(context.DoctorUserId) !== actorUserId) {
        return res.status(403).json({ success: false, message: 'Access denied to this diagnosis record' });
      }

      const isPrimary = normalizeBoolean(req.body?.isPrimary);
      if (isPrimary === true) {
        await pool.request()
          .input('EncounterId', sql.BigInt, parseInteger(context.EncounterId))
          .query(`
            UPDATE dbo.EmrDiagnosisRecords
            SET IsPrimary = 0
            WHERE EncounterId = @EncounterId
              AND IsPrimary = 1
          `);
      }

      await pool.request()
        .input('DiagnosisId', sql.BigInt, diagnosisId)
        .input('DiagnosisName', sql.NVarChar(255), req.body?.diagnosisName || null)
        .input('ICDCode', sql.NVarChar(20), req.body?.icdCode || null)
        .input('DiagnosisType', sql.NVarChar(20), req.body?.diagnosisType || null)
        .input('Severity', sql.NVarChar(20), req.body?.severity || null)
        .input('IsPrimary', sql.Bit, isPrimary)
        .input('RecordedByUserId', sql.BigInt, actorUserId)
        .query(`
          UPDATE dbo.EmrDiagnosisRecords
          SET
            DiagnosisName = COALESCE(@DiagnosisName, DiagnosisName),
            ICDCode = COALESCE(@ICDCode, ICDCode),
            DiagnosisType = COALESCE(@DiagnosisType, DiagnosisType),
            Severity = COALESCE(@Severity, Severity),
            IsPrimary = COALESCE(@IsPrimary, IsPrimary),
            RecordedByUserId = @RecordedByUserId,
            RecordedAt = SYSUTCDATETIME()
          WHERE Id = @DiagnosisId
        `);

      res.json({
        success: true,
        message: 'Diagnosis updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/encounters/:encounterId/notes',
  authorize(...EDIT_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getEmrSchemaInfo(pool);
      if (!schema.hasEncounterTable || !schema.hasClinicalNotesTable) {
        return sendUnavailableSchemaResponse(res, 'EMR clinical note tables are not available in this database yet.');
      }
      const hospitalId = resolveHospitalId(req);
      const encounterId = parseInteger(req.params.encounterId);
      const actorUserId = parseInteger(req.user.id);
      const context = await ensureEncounterAccess({
        pool,
        encounterId,
        hospitalId,
        actorRole: req.user.role,
        actorUserId,
        allowPatientViewer: false,
      });

      if (!context) {
        return res.status(404).json({ success: false, message: 'Encounter not found' });
      }

      const noteText = String(req.body?.noteText || '').trim();
      if (!noteText) {
        return res.status(400).json({ success: false, message: 'noteText is required' });
      }

      const result = await pool.request()
        .input('EncounterId', sql.BigInt, encounterId)
        .input('NoteType', sql.NVarChar(30), req.body?.noteType || 'Clinical')
        .input('NoteText', sql.NVarChar(sql.MAX), noteText)
        .input('IsPatientVisible', sql.Bit, Boolean(normalizeBoolean(req.body?.isPatientVisible)))
        .input('LinkedLabOrderId', sql.BigInt, parseInteger(req.body?.linkedLabOrderId))
        .input('RecordedByUserId', sql.BigInt, actorUserId)
        .query(`
          INSERT INTO dbo.EmrClinicalNotes
            (EncounterId, NoteType, NoteText, IsPatientVisible, LinkedLabOrderId, RecordedByUserId)
          OUTPUT INSERTED.*
          VALUES
            (@EncounterId, @NoteType, @NoteText, @IsPatientVisible, @LinkedLabOrderId, @RecordedByUserId)
        `);

      res.status(201).json({
        success: true,
        message: 'Clinical note added successfully',
        data: result.recordset[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/notes/:noteId',
  authorize(...EDIT_ROLES),
  async (req, res, next) => {
    try {
      const pool = await getPool();
      const schema = await getEmrSchemaInfo(pool);
      if (!schema.hasEncounterTable || !schema.hasClinicalNotesTable) {
        return sendUnavailableSchemaResponse(res, 'EMR clinical note tables are not available in this database yet.');
      }
      const hospitalId = resolveHospitalId(req);
      const actorUserId = parseInteger(req.user.id);
      const noteId = parseInteger(req.params.noteId);

      const result = await pool.request()
        .input('NoteId', sql.BigInt, noteId)
        .input('HospitalId', sql.BigInt, hospitalId)
        .query(`
          SELECT TOP 1
            note.Id,
            note.EncounterId,
            dp.UserId AS DoctorUserId
          FROM dbo.EmrClinicalNotes note
          JOIN dbo.EmrEncounters e ON e.Id = note.EncounterId
          LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = e.DoctorId
          WHERE note.Id = @NoteId
            AND (@HospitalId IS NULL OR e.HospitalId = @HospitalId)
        `);

      const context = result.recordset[0] || null;
      if (!context) {
        return res.status(404).json({ success: false, message: 'Clinical note not found' });
      }

      if (req.user.role === 'doctor' && parseInteger(context.DoctorUserId) !== actorUserId) {
        return res.status(403).json({ success: false, message: 'Access denied to this clinical note' });
      }

      await pool.request()
        .input('NoteId', sql.BigInt, noteId)
        .input('NoteType', sql.NVarChar(30), req.body?.noteType || null)
        .input('NoteText', sql.NVarChar(sql.MAX), req.body?.noteText || null)
        .input('IsPatientVisible', sql.Bit, normalizeBoolean(req.body?.isPatientVisible))
        .input('LinkedLabOrderId', sql.BigInt, parseInteger(req.body?.linkedLabOrderId))
        .query(`
          UPDATE dbo.EmrClinicalNotes
          SET
            NoteType = COALESCE(@NoteType, NoteType),
            NoteText = COALESCE(@NoteText, NoteText),
            IsPatientVisible = COALESCE(@IsPatientVisible, IsPatientVisible),
            LinkedLabOrderId = COALESCE(@LinkedLabOrderId, LinkedLabOrderId),
            RecordedAt = SYSUTCDATETIME()
          WHERE Id = @NoteId
        `);

      res.json({
        success: true,
        message: 'Clinical note updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
