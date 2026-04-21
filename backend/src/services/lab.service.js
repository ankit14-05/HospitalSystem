const fs = require('fs');
const path = require('path');
const { query, withTransaction, sql } = require('../config/database');

const DEFAULT_EXTERNAL_LABS = [
  { Id: 1, Name: 'Apollo Diagnostics', Type: 'External' },
  { Id: 2, Name: 'SRL Diagnostics', Type: 'External' },
  { Id: 3, Name: 'Dr Lal PathLabs', Type: 'External' },
  { Id: 4, Name: 'Metropolis', Type: 'External' },
  { Id: 5, Name: 'Thyrocare', Type: 'External' },
];

const MANAGEMENT_INSTALL_MESSAGE = 'Lab management tables are not installed yet. Run backend/sql/hms_main_lab_extension.sql first.';

const nullableSelection = (enabled, expression, alias, sqlType = 'NVARCHAR(500)') => (
  enabled ? `${expression} AS ${alias}` : `CAST(NULL AS ${sqlType}) AS ${alias}`
);

const buildIdClause = (ids, prefix, params, type = sql.BigInt) => ids.map((id, index) => {
  const key = `${prefix}${index}`;
  params[key] = { type, value: id };
  return `@${key}`;
}).join(', ');

const generateOrderNumber = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `LAB-${datePart}-${rand}`;
};

const toPriority = (tests = []) => {
  const values = tests.map((item) => String(item?.priority || item?.Priority || 'Routine').toUpperCase());
  if (values.includes('STAT')) return 'STAT';
  if (values.includes('URGENT')) return 'Urgent';
  return 'Routine';
};

const getLabSchema = async () => {
  const result = await query(`
    SELECT
      CASE WHEN OBJECT_ID('dbo.Labs', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabs,
      CASE WHEN OBJECT_ID('dbo.LabRooms', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabRooms,
      CASE WHEN OBJECT_ID('dbo.LabAutofillRules', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabAutofillRules,
      CASE WHEN OBJECT_ID('dbo.LabTechnicianProfiles', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabTechnicianProfiles,
      CASE WHEN OBJECT_ID('dbo.LabTechnicianRoomAssignments', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabTechnicianRoomAssignments,
      CASE WHEN OBJECT_ID('dbo.LabInchargeProfiles', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabInchargeProfiles,
      CASE WHEN OBJECT_ID('dbo.LabResultAttachments', 'U') IS NULL THEN 0 ELSE 1 END AS HasLabResultAttachments,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'WorkflowStage') IS NULL THEN 0 ELSE 1 END AS HasWorkflowStage,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'SampleId') IS NULL THEN 0 ELSE 1 END AS HasSampleId,
      CASE WHEN COL_LENGTH('dbo.LabOrders', 'RejectionReason') IS NULL THEN 0 ELSE 1 END AS HasRejectionReason,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'CriteriaText') IS NULL THEN 0 ELSE 1 END AS HasCriteriaText,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'AdditionalDetails') IS NULL THEN 0 ELSE 1 END AS HasAdditionalDetails,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'RoomId') IS NULL THEN 0 ELSE 1 END AS HasRoomId,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'LabId') IS NULL THEN 0 ELSE 1 END AS HasLabId,
      CASE WHEN COL_LENGTH('dbo.LabOrderItems', 'LabType') IS NULL THEN 0 ELSE 1 END AS HasLabType
  `);

  const row = result.recordset?.[0] || {};
  return {
    hasLabs: Boolean(row.HasLabs),
    hasLabRooms: Boolean(row.HasLabRooms),
    hasLabAutofillRules: Boolean(row.HasLabAutofillRules),
    hasLabTechnicianProfiles: Boolean(row.HasLabTechnicianProfiles),
    hasLabTechnicianRoomAssignments: Boolean(row.HasLabTechnicianRoomAssignments),
    hasLabInchargeProfiles: Boolean(row.HasLabInchargeProfiles),
    hasLabResultAttachments: Boolean(row.HasLabResultAttachments),
    hasWorkflowStage: Boolean(row.HasWorkflowStage),
    hasSampleId: Boolean(row.HasSampleId),
    hasRejectionReason: Boolean(row.HasRejectionReason),
    hasCriteriaText: Boolean(row.HasCriteriaText),
    hasAdditionalDetails: Boolean(row.HasAdditionalDetails),
    hasRoomId: Boolean(row.HasRoomId),
    hasLabId: Boolean(row.HasLabId),
    hasLabType: Boolean(row.HasLabType),
  };
};

const requireManagementTable = (enabled) => {
  if (!enabled) {
    const error = new Error(MANAGEMENT_INSTALL_MESSAGE);
    error.statusCode = 400;
    throw error;
  }
};

const attachTestNames = async (orders = []) => {
  if (!orders.length) return orders;

  const ids = orders.map((order) => Number(order.Id || order.id)).filter(Number.isFinite);
  if (!ids.length) return orders;

  const params = {};
  const inClause = buildIdClause(ids, 'OrderId', params);
  const result = await query(`
    SELECT li.LabOrderId, lt.Name AS TestName
    FROM dbo.LabOrderItems li
    JOIN dbo.LabTests lt ON lt.Id = li.TestId
    WHERE li.LabOrderId IN (${inClause})
    ORDER BY li.LabOrderId, lt.Name
  `, params);

  const testMap = result.recordset.reduce((acc, row) => {
    if (!acc.has(row.LabOrderId)) acc.set(row.LabOrderId, []);
    acc.get(row.LabOrderId).push(row.TestName);
    return acc;
  }, new Map());

  return orders.map((order) => {
    const tests = testMap.get(order.Id || order.id) || [];
    return {
      ...order,
      TestNames: tests.join(', '),
      tests: tests.map((name) => ({ TestName: name, Name: name })),
    };
  });
};

const ensureDefaultLab = async (hospitalId) => {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabs);

  const existing = await query(`
    SELECT TOP 1 Id
    FROM dbo.Labs
    WHERE IsActive = 1
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId OR HospitalId IS NULL)
    ORDER BY Id
  `, {
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
  });

  if (existing.recordset[0]?.Id) {
    return existing.recordset[0].Id;
  }

  const inserted = await query(`
    INSERT INTO dbo.Labs (HospitalId, Name, Type, IsActive, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES (@HospitalId, @Name, @Type, 1, SYSUTCDATETIME(), SYSUTCDATETIME())
  `, {
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
    Name: { type: sql.NVarChar(200), value: 'Central Diagnostics' },
    Type: { type: sql.NVarChar(50), value: 'Internal' },
  });

  return inserted.recordset[0]?.Id || null;
};

const ensureTechnicianProfile = async (userId) => {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabTechnicianProfiles);

  const existing = await query(`
    SELECT TOP 1 Id, RoomId
    FROM dbo.LabTechnicianProfiles
    WHERE UserId = @UserId
  `, {
    UserId: { type: sql.BigInt, value: userId },
  });

  if (existing.recordset[0]) {
    return existing.recordset[0];
  }

  const inserted = await query(`
    INSERT INTO dbo.LabTechnicianProfiles (UserId, RoomId, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id, INSERTED.RoomId
    VALUES (@UserId, NULL, SYSUTCDATETIME(), SYSUTCDATETIME())
  `, {
    UserId: { type: sql.BigInt, value: userId },
  });

  return inserted.recordset[0];
};

async function getLabTests({ search, category, active = true } = {}) {
  let sqlText = `
    SELECT Id, Name, ShortName, Category, Unit, Price, TurnaroundHrs, RequiresFasting, SampleType, Instructions, IsActive
    FROM dbo.LabTests
    WHERE 1 = 1
  `;
  const params = {};

  if (active !== undefined) {
    sqlText += ' AND IsActive = @IsActive';
    params.IsActive = { type: sql.Bit, value: active ? 1 : 0 };
  }
  if (category) {
    sqlText += ' AND Category = @Category';
    params.Category = { type: sql.NVarChar(100), value: category };
  }
  if (search) {
    sqlText += ' AND (Name LIKE @Search OR ShortName LIKE @Search OR Category LIKE @Search)';
    params.Search = { type: sql.NVarChar(255), value: `%${search}%` };
  }

  sqlText += ' ORDER BY Category, Name';
  const result = await query(sqlText, params);
  return result.recordset;
}

async function addLabTest({ name, createdBy }) {
  const result = await query(`
    INSERT INTO dbo.LabTests (Name, Category, RequiresFasting, IsActive, CreatedAt, UpdatedAt, CreatedBy)
    VALUES (@Name, @Category, 0, 1, SYSUTCDATETIME(), SYSUTCDATETIME(), @CreatedBy)
  `, {
    Name: { type: sql.NVarChar(200), value: name },
    Category: { type: sql.NVarChar(100), value: name },
    CreatedBy: { type: sql.BigInt, value: createdBy || null },
  });
  return result.rowsAffected[0] > 0;
}

async function removeLabTest(id) {
  const result = await query(`
    UPDATE dbo.LabTests
    SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @Id
  `, {
    Id: { type: sql.BigInt, value: id },
  });
  return result.rowsAffected[0] > 0;
}

async function getLabs(hospitalId = null) {
  const schema = await getLabSchema();
  if (!schema.hasLabs) return DEFAULT_EXTERNAL_LABS;

  const result = await query(`
    SELECT Id, Name, Type, Address, ContactPhone
    FROM dbo.Labs
    WHERE IsActive = 1
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId OR HospitalId IS NULL)
    ORDER BY Name
  `, {
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
  });

  return result.recordset;
}

async function getAvailableLabRooms(hospitalId = null) {
  const schema = await getLabSchema();
  if (!schema.hasLabRooms) return [];

  const roomTypeSelect = schema.hasLabs
    ? "COALESCE(lr.RoomType, l.Name, 'Lab Room')"
    : "COALESCE(lr.RoomType, 'Lab Room')";
  const labJoin = schema.hasLabs ? 'LEFT JOIN dbo.Labs l ON l.Id = lr.LabId' : '';
  const allotmentCheck = schema.hasLabAutofillRules
    ? `CASE WHEN EXISTS(SELECT 1 FROM dbo.LabAutofillRules ar WHERE ar.RoomId = lr.Id AND ar.IsActive = 1) THEN 'Alloted' ELSE 'Not-Alloted' END`
    : "'Not-Alloted'";

  const result = await query(`
    SELECT
      lr.Id,
      lr.RoomNo,
      ${roomTypeSelect} AS RoomType,
      ${allotmentCheck} AS Status
    FROM dbo.LabRooms lr
    ${labJoin}
    WHERE lr.IsActive = 1
      AND (@HospitalId IS NULL OR lr.HospitalId = @HospitalId OR lr.HospitalId IS NULL)
    ORDER BY lr.RoomNo
  `, {
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
  });

  return result.recordset;
}

async function addLabRoom({ labId, roomNo, hospitalId }) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabRooms);

  const finalLabId = labId || (schema.hasLabs ? await ensureDefaultLab(hospitalId) : null);
  const result = await query(`
    INSERT INTO dbo.LabRooms (HospitalId, LabId, RoomNo, RoomType, IsActive, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES (@HospitalId, @LabId, @RoomNo, @RoomType, 1, SYSUTCDATETIME(), SYSUTCDATETIME())
  `, {
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
    LabId: { type: sql.BigInt, value: finalLabId || null },
    RoomNo: { type: sql.NVarChar(30), value: roomNo },
    RoomType: { type: sql.NVarChar(100), value: 'Lab Room' },
  });
  return result.recordset[0] || null;
}

async function removeLabRoom(roomId) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabRooms);

  const result = await query(`
    UPDATE dbo.LabRooms
    SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @RoomId
  `, {
    RoomId: { type: sql.BigInt, value: roomId },
  });

  return result.rowsAffected[0] > 0;
}

async function getLabAutofillRules() {
  const schema = await getLabSchema();
  if (!schema.hasLabAutofillRules) return [];

  const labJoin = schema.hasLabs ? 'LEFT JOIN dbo.Labs l ON l.Id = ar.LabId' : '';
  const roomJoin = schema.hasLabRooms ? 'LEFT JOIN dbo.LabRooms r ON r.Id = ar.RoomId' : '';

  const result = await query(`
    SELECT
      ar.Id,
      ar.TestCategory,
      ar.Place,
      ar.RoomId,
      ar.LabId,
      ${schema.hasLabRooms ? 'r.RoomNo' : 'CAST(NULL AS NVARCHAR(30)) AS RoomNo'},
      ${schema.hasLabs ? 'l.Name' : 'CAST(NULL AS NVARCHAR(200)) AS LabName'}
    FROM dbo.LabAutofillRules ar
    ${roomJoin}
    ${labJoin}
    WHERE ar.IsActive = 1
    ORDER BY ar.TestCategory
  `);

  return result.recordset;
}

async function addLabAutofillRule({ testCategory, place, roomId, labId, createdBy }) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabAutofillRules);

  const existing = await query(`
    SELECT TOP 1 Id
    FROM dbo.LabAutofillRules
    WHERE TestCategory = @TestCategory
  `, {
    TestCategory: { type: sql.NVarChar(200), value: testCategory },
  });

  if (existing.recordset[0]?.Id) {
    const updated = await query(`
      UPDATE dbo.LabAutofillRules
      SET Place = @Place,
          RoomId = @RoomId,
          LabId = @LabId,
          IsActive = 1,
          UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @Id
    `, {
      Id: { type: sql.BigInt, value: existing.recordset[0].Id },
      Place: { type: sql.NVarChar(20), value: place },
      RoomId: { type: sql.BigInt, value: roomId || null },
      LabId: { type: sql.BigInt, value: labId || null },
    });
    return updated.rowsAffected[0] > 0;
  }

  const inserted = await query(`
    INSERT INTO dbo.LabAutofillRules (TestCategory, Place, RoomId, LabId, CreatedBy, IsActive, CreatedAt, UpdatedAt)
    VALUES (@TestCategory, @Place, @RoomId, @LabId, @CreatedBy, 1, SYSUTCDATETIME(), SYSUTCDATETIME())
  `, {
    TestCategory: { type: sql.NVarChar(200), value: testCategory },
    Place: { type: sql.NVarChar(20), value: place },
    RoomId: { type: sql.BigInt, value: roomId || null },
    LabId: { type: sql.BigInt, value: labId || null },
    CreatedBy: { type: sql.BigInt, value: createdBy || null },
  });
  return inserted.rowsAffected[0] > 0;
}

async function removeLabAutofillRule(id) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabAutofillRules);

  const result = await query(`
    DELETE FROM dbo.LabAutofillRules
    WHERE Id = @Id
  `, {
    Id: { type: sql.BigInt, value: id },
  });

  return result.rowsAffected[0] > 0;
}

async function assignTechnicianToRoom({ userId, roomId, assignedBy, assignmentType = 'Formal Transfer', notes = null, status = 'Pending', hospitalId = null }) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabTechnicianProfiles && schema.hasLabTechnicianRoomAssignments);

  const profile = await ensureTechnicianProfile(userId);

  if (status === 'Pending') {
    const pending = await query(`
      SELECT TOP 1 Id
      FROM dbo.LabTechnicianRoomAssignments
      WHERE TechnicianId = @TechnicianId
        AND Status = 'Pending'
    `, {
      TechnicianId: { type: sql.BigInt, value: profile.Id },
    });

    if (pending.recordset[0]) {
      throw new Error('A transfer request is already pending approval');
    }
  }

  if (status === 'Active') {
    await query(`
      UPDATE dbo.LabTechnicianRoomAssignments
      SET Status = 'Historical', UpdatedAt = SYSUTCDATETIME()
      WHERE TechnicianId = @TechnicianId
        AND Status = 'Active'
    `, {
      TechnicianId: { type: sql.BigInt, value: profile.Id },
    });

    await query(`
      UPDATE dbo.LabTechnicianProfiles
      SET RoomId = @RoomId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @TechnicianId
    `, {
      RoomId: { type: sql.BigInt, value: roomId },
      TechnicianId: { type: sql.BigInt, value: profile.Id },
    });
  }

  const inserted = await query(`
    INSERT INTO dbo.LabTechnicianRoomAssignments
      (TechnicianId, RoomId, AssignedBy, Status, AssignmentType, Notes, AssignedAt, CreatedAt, UpdatedAt)
    OUTPUT INSERTED.Id
    VALUES
      (@TechnicianId, @RoomId, @AssignedBy, @Status, @AssignmentType, @Notes, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME())
  `, {
    TechnicianId: { type: sql.BigInt, value: profile.Id },
    RoomId: { type: sql.BigInt, value: roomId },
    AssignedBy: { type: sql.BigInt, value: assignedBy || null },
    Status: { type: sql.NVarChar(20), value: status },
    AssignmentType: { type: sql.NVarChar(50), value: assignmentType },
    Notes: { type: sql.NVarChar(sql.MAX), value: notes || null },
  });

  return { success: true, assignmentId: inserted.recordset[0]?.Id || null, hospitalId };
}

async function getTechnicianAssignment(userId) {
  const schema = await getLabSchema();
  if (!schema.hasLabTechnicianProfiles) return null;

  const labJoin = schema.hasLabs ? 'LEFT JOIN dbo.Labs l ON l.Id = lr.LabId' : '';

  const result = await query(`
    SELECT TOP 1
      tp.RoomId,
      lr.RoomNo,
      ${schema.hasLabRooms ? nullableSelection(true, "COALESCE(lr.RoomType, l.Name, 'Lab Room')", 'RoomType') : "CAST(NULL AS NVARCHAR(100)) AS RoomType"}
    FROM dbo.LabTechnicianProfiles tp
    LEFT JOIN dbo.LabRooms lr ON lr.Id = tp.RoomId
    ${labJoin}
    WHERE tp.UserId = @UserId
  `, {
    UserId: { type: sql.BigInt, value: userId },
  });

  return result.recordset[0] || null;
}

async function getTransferHistory(userId) {
  const schema = await getLabSchema();
  if (!schema.hasLabTechnicianProfiles || !schema.hasLabTechnicianRoomAssignments) return [];

  const labJoin = schema.hasLabs ? 'LEFT JOIN dbo.Labs l ON l.Id = lr.LabId' : '';

  const result = await query(`
    SELECT
      tra.Id,
      tra.AssignedAt,
      tra.AssignmentType,
      tra.Notes,
      tra.Status,
      lr.RoomNo,
      ${schema.hasLabRooms ? nullableSelection(true, "COALESCE(lr.RoomType, l.Name, 'Lab Room')", 'RoomType') : "CAST(NULL AS NVARCHAR(100)) AS RoomType"},
      adminUser.FirstName + ' ' + adminUser.LastName AS AssignedByAdmin
    FROM dbo.LabTechnicianRoomAssignments tra
    JOIN dbo.LabTechnicianProfiles tp ON tp.Id = tra.TechnicianId
    LEFT JOIN dbo.LabRooms lr ON lr.Id = tra.RoomId
    ${labJoin}
    LEFT JOIN dbo.Users adminUser ON adminUser.Id = tra.AssignedBy
    WHERE tp.UserId = @UserId
    ORDER BY tra.AssignedAt DESC
  `, {
    UserId: { type: sql.BigInt, value: userId },
  });

  return result.recordset;
}

async function getPendingAssignments() {
  const schema = await getLabSchema();
  if (!schema.hasLabTechnicianProfiles || !schema.hasLabTechnicianRoomAssignments) return [];

  const labJoin = schema.hasLabs ? 'LEFT JOIN dbo.Labs l ON l.Id = lr.LabId' : '';

  const result = await query(`
    SELECT
      tra.Id,
      tra.AssignedAt,
      tra.AssignmentType,
      tra.Notes,
      u.FirstName + ' ' + u.LastName AS TechnicianName,
      lr.RoomNo,
      ${schema.hasLabRooms ? nullableSelection(true, "COALESCE(lr.RoomType, l.Name, 'Lab Room')", 'RoomType') : "CAST(NULL AS NVARCHAR(100)) AS RoomType"}
    FROM dbo.LabTechnicianRoomAssignments tra
    JOIN dbo.LabTechnicianProfiles tp ON tp.Id = tra.TechnicianId
    JOIN dbo.Users u ON u.Id = tp.UserId
    LEFT JOIN dbo.LabRooms lr ON lr.Id = tra.RoomId
    ${labJoin}
    WHERE tra.Status = 'Pending'
    ORDER BY tra.AssignedAt ASC
  `);

  return result.recordset;
}

async function approveRoomAssignment(assignmentId, adminId) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabTechnicianProfiles && schema.hasLabTechnicianRoomAssignments);

  return withTransaction(async (transaction) => {
    const pending = await new sql.Request(transaction)
      .input('AssignmentId', sql.BigInt, assignmentId)
      .query(`
        SELECT TOP 1 TechnicianId, RoomId
        FROM dbo.LabTechnicianRoomAssignments
        WHERE Id = @AssignmentId
          AND Status = 'Pending'
      `);

    const assignment = pending.recordset[0];
    if (!assignment) {
      throw new Error('Pending assignment not found');
    }

    await new sql.Request(transaction)
      .input('TechnicianId', sql.BigInt, assignment.TechnicianId)
      .query(`
        UPDATE dbo.LabTechnicianRoomAssignments
        SET Status = 'Historical', UpdatedAt = SYSUTCDATETIME()
        WHERE TechnicianId = @TechnicianId
          AND Status = 'Active'
      `);

    await new sql.Request(transaction)
      .input('AssignmentId', sql.BigInt, assignmentId)
      .input('AdminId', sql.BigInt, adminId)
      .query(`
        UPDATE dbo.LabTechnicianRoomAssignments
        SET Status = 'Active',
            AssignedBy = @AdminId,
            AssignedAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @AssignmentId
      `);

    await new sql.Request(transaction)
      .input('TechnicianId', sql.BigInt, assignment.TechnicianId)
      .input('RoomId', sql.BigInt, assignment.RoomId)
      .query(`
        UPDATE dbo.LabTechnicianProfiles
        SET RoomId = @RoomId, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @TechnicianId
      `);

    return true;
  });
}

async function rejectRoomAssignment(assignmentId, adminId) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabTechnicianRoomAssignments);

  await query(`
    UPDATE dbo.LabTechnicianRoomAssignments
    SET Status = 'Rejected',
        AssignedBy = @AdminId,
        AssignedAt = SYSUTCDATETIME(),
        UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @AssignmentId
      AND Status = 'Pending'
  `, {
    AssignmentId: { type: sql.BigInt, value: assignmentId },
    AdminId: { type: sql.BigInt, value: adminId },
  });

  return true;
}

async function getSignatureSettings(userId) {
  const schema = await getLabSchema();
  if (!schema.hasLabInchargeProfiles) {
    return {
      UserId: userId,
      SignaturePreference: 'NewPage',
      SignatureText: null,
      SignatureImagePath: null,
    };
  }

  const result = await query(`
    SELECT TOP 1 *
    FROM dbo.LabInchargeProfiles
    WHERE UserId = @UserId
  `, {
    UserId: { type: sql.BigInt, value: userId },
  });

  return result.recordset[0] || {
    UserId: userId,
    SignaturePreference: 'NewPage',
    SignatureText: null,
    SignatureImagePath: null,
  };
}

async function updateSignatureSettings({ userId, signatureText, signaturePreference, signatureImagePath }) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabInchargeProfiles);

  const existing = await query(`
    SELECT TOP 1 Id
    FROM dbo.LabInchargeProfiles
    WHERE UserId = @UserId
  `, {
    UserId: { type: sql.BigInt, value: userId },
  });

  if (existing.recordset[0]?.Id) {
    await query(`
      UPDATE dbo.LabInchargeProfiles
      SET SignatureText = @SignatureText,
          SignaturePreference = @SignaturePreference,
          SignatureImagePath = COALESCE(@SignatureImagePath, SignatureImagePath),
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserId = @UserId
    `, {
      UserId: { type: sql.BigInt, value: userId },
      SignatureText: { type: sql.NVarChar(200), value: signatureText || null },
      SignaturePreference: { type: sql.NVarChar(20), value: signaturePreference || 'NewPage' },
      SignatureImagePath: { type: sql.NVarChar(1000), value: signatureImagePath || null },
    });
    return true;
  }

  await query(`
    INSERT INTO dbo.LabInchargeProfiles
      (UserId, SignatureText, SignaturePreference, SignatureImagePath, CreatedAt, UpdatedAt)
    VALUES
      (@UserId, @SignatureText, @SignaturePreference, @SignatureImagePath, SYSUTCDATETIME(), SYSUTCDATETIME())
  `, {
    UserId: { type: sql.BigInt, value: userId },
    SignatureText: { type: sql.NVarChar(200), value: signatureText || null },
    SignaturePreference: { type: sql.NVarChar(20), value: signaturePreference || 'NewPage' },
    SignatureImagePath: { type: sql.NVarChar(1000), value: signatureImagePath || null },
  });
  return true;
}

async function generateSampleId() {
  const schema = await getLabSchema();
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const prefix = `#smp-${day}/${month}/${year}-`;

  const result = await query(schema.hasSampleId ? `
    SELECT COUNT(*) AS TotalCount
    FROM dbo.LabOrders
    WHERE SampleId LIKE @Prefix + '%'
  ` : `
    SELECT COUNT(*) AS TotalCount
    FROM dbo.LabOrders
    WHERE CAST(OrderDate AS DATE) = CAST(SYSUTCDATETIME() AS DATE)
  `, schema.hasSampleId ? {
    Prefix: { type: sql.NVarChar(30), value: prefix },
  } : {});

  const nextSeq = String((result.recordset[0]?.TotalCount || 0) + 1).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

async function createLabOrder({ hospitalId, patientId, orderedBy, appointmentId, notes, tests = [] }) {
  const schema = await getLabSchema();

  return withTransaction(async (transaction) => {
    const orderNumber = generateOrderNumber();
    const orderColumns = ['HospitalId', 'PatientId', 'OrderedBy', 'AppointmentId', 'OrderNumber', 'OrderDate', 'Status', 'Priority', 'Notes', 'CreatedAt', 'UpdatedAt', 'CreatedBy'];
    const orderValues = ['@HospitalId', '@PatientId', '@OrderedBy', '@AppointmentId', '@OrderNumber', 'SYSUTCDATETIME()', '@Status', '@Priority', '@Notes', 'SYSUTCDATETIME()', 'SYSUTCDATETIME()', '@CreatedBy'];

    if (schema.hasWorkflowStage) {
      orderColumns.push('WorkflowStage');
      orderValues.push('@WorkflowStage');
    }

    const orderRequest = new sql.Request(transaction)
      .input('HospitalId', sql.BigInt, hospitalId)
      .input('PatientId', sql.BigInt, patientId)
      .input('OrderedBy', sql.BigInt, orderedBy || null)
      .input('AppointmentId', sql.BigInt, appointmentId || null)
      .input('OrderNumber', sql.NVarChar(30), orderNumber)
      .input('Status', sql.NVarChar(20), 'Pending')
      .input('Priority', sql.NVarChar(20), toPriority(tests))
      .input('Notes', sql.NVarChar(sql.MAX), notes || null)
      .input('CreatedBy', sql.BigInt, orderedBy || null);

    if (schema.hasWorkflowStage) {
      orderRequest.input('WorkflowStage', sql.NVarChar(30), 'Ordered');
    }

    const orderResult = await orderRequest.query(`
      INSERT INTO dbo.LabOrders (${orderColumns.join(', ')})
      OUTPUT INSERTED.Id
      VALUES (${orderValues.join(', ')})
    `);

    const labOrderId = orderResult.recordset[0]?.Id;

    for (const test of tests) {
      const itemColumns = ['LabOrderId', 'TestId', 'Status'];
      const itemValues = ['@LabOrderId', '@TestId', '@Status'];
      const itemRequest = new sql.Request(transaction)
        .input('LabOrderId', sql.BigInt, labOrderId)
        .input('TestId', sql.BigInt, Number(test.testId || test.TestId || test.id))
        .input('Status', sql.NVarChar(20), 'Pending');

      if (schema.hasCriteriaText) {
        itemColumns.push('CriteriaText');
        itemValues.push('@CriteriaText');
        itemRequest.input('CriteriaText', sql.NVarChar(500), test.criteria || test.Criteria || null);
      }
      if (schema.hasAdditionalDetails) {
        itemColumns.push('AdditionalDetails');
        itemValues.push('@AdditionalDetails');
        itemRequest.input('AdditionalDetails', sql.NVarChar(1000), test.additionalDetails || test.AdditionalDetails || null);
      }
      if (schema.hasRoomId) {
        itemColumns.push('RoomId');
        itemValues.push('@RoomId');
        itemRequest.input('RoomId', sql.BigInt, test.roomId || null);
      }
      if (schema.hasLabId) {
        itemColumns.push('LabId');
        itemValues.push('@LabId');
        itemRequest.input('LabId', sql.BigInt, test.labId || null);
      }
      if (schema.hasLabType) {
        itemColumns.push('LabType');
        itemValues.push('@LabType');
        itemRequest.input('LabType', sql.NVarChar(20), test.place || test.placeType || test.LabType || 'Indoor');
      }

      await itemRequest.query(`
        INSERT INTO dbo.LabOrderItems (${itemColumns.join(', ')})
        VALUES (${itemValues.join(', ')})
      `);
    }

    return { labOrderId, orderNumber };
  });
}

async function getLabOrders({ hospitalId, patientId, orderedBy, status, priority, date, page = 1, limit = 20 } = {}) {
  const schema = await getLabSchema();
  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const where = ['1 = 1'];
  const params = {
    OffsetRows: { type: sql.Int, value: offset },
    FetchRows: { type: sql.Int, value: Number(limit) || 20 },
  };

  if (hospitalId) {
    where.push('lo.HospitalId = @HospitalId');
    params.HospitalId = { type: sql.BigInt, value: hospitalId };
  }
  if (patientId) {
    where.push('lo.PatientId = @PatientId');
    params.PatientId = { type: sql.BigInt, value: patientId };
  }
  if (orderedBy) {
    where.push('lo.OrderedBy = @OrderedBy');
    params.OrderedBy = { type: sql.BigInt, value: orderedBy };
  }
  if (status) {
    where.push('lo.Status = @Status');
    params.Status = { type: sql.NVarChar(20), value: status };
  }
  if (priority) {
    where.push('lo.Priority = @Priority');
    params.Priority = { type: sql.NVarChar(20), value: priority };
  }
  if (date) {
    where.push('CAST(lo.OrderDate AS DATE) = @OrderDate');
    params.OrderDate = { type: sql.Date, value: date };
  }

  const whereSql = where.join(' AND ');
  const listResult = await query(`
    SELECT
      lo.Id,
      lo.OrderNumber,
      lo.OrderDate,
      lo.Status,
      lo.Priority,
      lo.ReportedAt,
      lo.VerifiedAt,
      ${nullableSelection(schema.hasWorkflowStage, 'lo.WorkflowStage', 'WorkflowStage', 'NVARCHAR(30)')},
      p.UHID,
      p.FirstName + ' ' + p.LastName AS PatientName,
      u.FirstName + ' ' + u.LastName AS DoctorName
    FROM dbo.LabOrders lo
    JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
    LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
    LEFT JOIN dbo.Users u ON u.Id = dp.UserId
    WHERE ${whereSql}
    ORDER BY lo.OrderDate DESC
    OFFSET @OffsetRows ROWS FETCH NEXT @FetchRows ROWS ONLY
  `, params);

  const countResult = await query(`
    SELECT COUNT(*) AS TotalCount
    FROM dbo.LabOrders lo
    WHERE ${whereSql}
  `, Object.fromEntries(Object.entries(params).filter(([key]) => !['OffsetRows', 'FetchRows'].includes(key))));

  const orders = await attachTestNames(listResult.recordset);
  return {
    orders,
    total: countResult.recordset[0]?.TotalCount || 0,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  };
}

async function getLabAttachments(labOrderId) {
  const schema = await getLabSchema();
  if (!schema.hasLabResultAttachments) return [];

  const result = await query(`
    SELECT
      Id,
      FileName,
      StoragePath,
      ContentType,
      FileSizeBytes,
      UploadedAt
    FROM dbo.LabResultAttachments
    WHERE LabOrderId = @LabOrderId
    ORDER BY UploadedAt DESC
  `, {
    LabOrderId: { type: sql.BigInt, value: labOrderId },
  });

  return result.recordset;
}

async function addLabAttachment({ labOrderId, fileName, filePath, fileType, fileSize, uploadedBy }) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabResultAttachments);

  const result = await query(`
    INSERT INTO dbo.LabResultAttachments
      (LabOrderId, LabOrderItemId, FileCategory, FileName, StoragePath, ContentType, FileSizeBytes, IsPrimary, UploadedByUserId)
    VALUES
      (@LabOrderId, NULL, @FileCategory, @FileName, @StoragePath, @ContentType, @FileSizeBytes, 0, @UploadedByUserId)
  `, {
    LabOrderId: { type: sql.BigInt, value: labOrderId },
    FileCategory: { type: sql.NVarChar(50), value: 'LabReport' },
    FileName: { type: sql.NVarChar(255), value: fileName },
    StoragePath: { type: sql.NVarChar(1000), value: filePath },
    ContentType: { type: sql.NVarChar(100), value: fileType || 'application/octet-stream' },
    FileSizeBytes: { type: sql.BigInt, value: fileSize || 0 },
    UploadedByUserId: { type: sql.BigInt, value: uploadedBy || null },
  });

  return result.rowsAffected[0] > 0;
}

async function removeLabAttachment(attachmentId) {
  const schema = await getLabSchema();
  requireManagementTable(schema.hasLabResultAttachments);

  const existing = await query(`
    SELECT TOP 1 StoragePath
    FROM dbo.LabResultAttachments
    WHERE Id = @AttachmentId
  `, {
    AttachmentId: { type: sql.BigInt, value: attachmentId },
  });

  const result = await query(`
    DELETE FROM dbo.LabResultAttachments
    WHERE Id = @AttachmentId
  `, {
    AttachmentId: { type: sql.BigInt, value: attachmentId },
  });

  const storagePath = existing.recordset[0]?.StoragePath;
  if (storagePath) {
    const absolutePath = path.resolve(__dirname, '../..', storagePath.replace(/^\//, ''));
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  return result.rowsAffected[0] > 0;
}

async function getLabOrderById(orderId, hospitalId) {
  const schema = await getLabSchema();

  const orderResult = await query(`
    SELECT TOP 1
      lo.Id,
      lo.OrderNumber,
      lo.OrderDate,
      lo.Status,
      lo.Priority,
      lo.Notes,
      lo.ReportedAt,
      lo.VerifiedAt,
      lo.VerifiedBy,
      ${nullableSelection(schema.hasWorkflowStage, 'lo.WorkflowStage', 'WorkflowStage', 'NVARCHAR(30)')},
      p.UHID,
      p.FirstName + ' ' + p.LastName AS PatientName,
      p.Phone AS PatientPhone,
      u.FirstName + ' ' + u.LastName AS DoctorName
    FROM dbo.LabOrders lo
    JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
    LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
    LEFT JOIN dbo.Users u ON u.Id = dp.UserId
    WHERE lo.Id = @OrderId
      AND (@HospitalId IS NULL OR lo.HospitalId = @HospitalId)
  `, {
    OrderId: { type: sql.BigInt, value: orderId },
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
  });

  const header = orderResult.recordset[0];
  if (!header) return null;

  const itemResult = await query(`
    SELECT
      li.Id,
      li.LabOrderId,
      li.Status,
      li.ResultValue,
      li.ResultUnit,
      li.NormalRange,
      li.IsAbnormal,
      li.Remarks,
      lt.Name AS TestName,
      ${nullableSelection(schema.hasCriteriaText, 'li.CriteriaText', 'Criteria', 'NVARCHAR(500)')},
      ${nullableSelection(schema.hasAdditionalDetails, 'li.AdditionalDetails', 'AdditionalDetails', 'NVARCHAR(1000)')},
      ${nullableSelection(schema.hasLabType, 'li.LabType', 'Place', 'NVARCHAR(20)')},
      ${schema.hasRoomId && schema.hasLabRooms ? 'lr.RoomNo AS RoomNo' : 'CAST(NULL AS NVARCHAR(30)) AS RoomNo'}
    FROM dbo.LabOrderItems li
    JOIN dbo.LabTests lt ON lt.Id = li.TestId
    ${schema.hasRoomId && schema.hasLabRooms ? 'LEFT JOIN dbo.LabRooms lr ON lr.Id = li.RoomId' : ''}
    WHERE li.LabOrderId = @OrderId
    ORDER BY li.Id
  `, {
    OrderId: { type: sql.BigInt, value: orderId },
  });

  const attachments = await getLabAttachments(orderId);
  const items = itemResult.recordset;
  const primary = items[0] || {};

  return {
    ...header,
    id: header.Id,
    patientName: header.PatientName,
    uhid: header.UHID,
    testType: primary.TestName || null,
    testName: primary.TestName || null,
    testNames: items.map((item) => item.TestName).join(', '),
    date: header.OrderDate,
    assignedDate: header.ReportedAt || header.OrderDate,
    criteria: primary.Criteria || null,
    additionalDetails: primary.AdditionalDetails || header.Notes || null,
    place: primary.Place || 'Indoor',
    roomNo: primary.RoomNo || null,
    items,
    tests: items,
    attachments,
  };
}

async function updateOrderStatus(orderId, hospitalId, status, updatedBy, providedSampleId = null) {
  const schema = await getLabSchema();
  const clauses = ['Status = @Status', 'UpdatedAt = SYSUTCDATETIME()'];
  const params = {
    OrderId: { type: sql.BigInt, value: orderId },
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
    Status: { type: sql.NVarChar(20), value: status },
    UpdatedBy: { type: sql.BigInt, value: updatedBy || null },
  };

  let workflowStage = null;

  if (status === 'Collecting' || status === 'Processing') {
    clauses.push('CollectedAt = COALESCE(CollectedAt, SYSUTCDATETIME())');
    clauses.push('CollectedBy = COALESCE(CollectedBy, @UpdatedBy)');
    if (schema.hasSampleId) {
      params.SampleId = { type: sql.NVarChar(50), value: providedSampleId || await generateSampleId() };
      clauses.push('SampleId = COALESCE(SampleId, @SampleId)');
    }
    workflowStage = status === 'Collecting' ? 'PendingCollection' : 'Processing';
  }

  if (status === 'Completed' || status === 'Pending Approval') {
    clauses.push('ReportedAt = SYSUTCDATETIME()');
    clauses.push('ReportedBy = COALESCE(ReportedBy, @UpdatedBy)');
    params.Status = { type: sql.NVarChar(20), value: 'Completed' };
    workflowStage = 'Completed';
  }

  if (schema.hasWorkflowStage && workflowStage) {
    clauses.push('WorkflowStage = @WorkflowStage');
    params.WorkflowStage = { type: sql.NVarChar(30), value: workflowStage };
  }

  const result = await query(`
    UPDATE dbo.LabOrders
    SET ${clauses.join(', ')}
    WHERE Id = @OrderId
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId)
  `, params);

  return result.rowsAffected[0] > 0;
}

async function enterTestResult(orderId, itemId, { resultValue, resultUnit, normalRange, isAbnormal, remarks }, enteredBy) {
  const schema = await getLabSchema();

  const itemResult = await query(`
    UPDATE dbo.LabOrderItems
    SET ResultValue = @ResultValue,
        ResultUnit = @ResultUnit,
        NormalRange = @NormalRange,
        IsAbnormal = @IsAbnormal,
        Remarks = @Remarks,
        Status = 'Completed'
    WHERE Id = @ItemId
      AND LabOrderId = @OrderId
  `, {
    ResultValue: { type: sql.NVarChar(500), value: resultValue || null },
    ResultUnit: { type: sql.NVarChar(50), value: resultUnit || null },
    NormalRange: { type: sql.NVarChar(100), value: normalRange || null },
    IsAbnormal: { type: sql.Bit, value: isAbnormal === undefined ? null : isAbnormal },
    Remarks: { type: sql.NVarChar(sql.MAX), value: remarks || null },
    ItemId: { type: sql.BigInt, value: itemId },
    OrderId: { type: sql.BigInt, value: orderId },
  });

  if (!itemResult.rowsAffected[0]) return false;

  const pendingItems = await query(`
    SELECT COUNT(*) AS PendingCount
    FROM dbo.LabOrderItems
    WHERE LabOrderId = @OrderId
      AND Status <> 'Completed'
  `, {
    OrderId: { type: sql.BigInt, value: orderId },
  });

  if ((pendingItems.recordset[0]?.PendingCount || 0) === 0) {
    const clauses = [
      "Status = 'Completed'",
      'ReportedAt = SYSUTCDATETIME()',
      'ReportedBy = COALESCE(ReportedBy, @EnteredBy)',
      'UpdatedAt = SYSUTCDATETIME()',
    ];
    const params = {
      OrderId: { type: sql.BigInt, value: orderId },
      EnteredBy: { type: sql.BigInt, value: enteredBy || null },
    };

    if (schema.hasWorkflowStage) {
      clauses.push("WorkflowStage = 'Completed'");
    }

    await query(`
      UPDATE dbo.LabOrders
      SET ${clauses.join(', ')}
      WHERE Id = @OrderId
    `, params);
  }

  return true;
}

async function getPatientLabResults(patientId, hospitalId, { page = 1, limit = 20 } = {}) {
  const schema = await getLabSchema();
  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));

  const result = await query(`
    SELECT
      lo.Id AS OrderId,
      lo.OrderNumber,
      lo.OrderDate,
      lo.Priority,
      lo.Status,
      ${nullableSelection(schema.hasWorkflowStage, 'lo.WorkflowStage', 'WorkflowStage', 'NVARCHAR(30)')},
      pp.FirstName + ' ' + pp.LastName AS PatientName,
      pp.UHID AS PatientUHID,
      u.FirstName + ' ' + u.LastName AS DoctorName,
      li.Id AS ItemId,
      lt.Name AS TestName,
      li.ResultValue,
      li.ResultUnit,
      li.NormalRange,
      li.IsAbnormal,
      li.Remarks,
      li.Status AS ItemStatus
    FROM dbo.LabOrders lo
    JOIN dbo.LabOrderItems li ON li.LabOrderId = lo.Id
    JOIN dbo.LabTests lt ON lt.Id = li.TestId
    LEFT JOIN dbo.DoctorProfiles dp ON dp.Id = lo.OrderedBy
    LEFT JOIN dbo.Users u ON u.Id = dp.UserId
    LEFT JOIN dbo.PatientProfiles pp ON pp.Id = lo.PatientId
    WHERE lo.PatientId = @PatientId
      AND (@HospitalId IS NULL OR lo.HospitalId = @HospitalId)
    ORDER BY lo.OrderDate DESC, li.Id
    OFFSET @OffsetRows ROWS FETCH NEXT @FetchRows ROWS ONLY
  `, {
    PatientId: { type: sql.BigInt, value: patientId },
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
    OffsetRows: { type: sql.Int, value: offset },
    FetchRows: { type: sql.Int, value: Number(limit) || 20 },
  });

  const countResult = await query(`
    SELECT COUNT(*) AS TotalCount
    FROM dbo.LabOrderItems li
    JOIN dbo.LabOrders lo ON lo.Id = li.LabOrderId
    WHERE lo.PatientId = @PatientId
      AND (@HospitalId IS NULL OR lo.HospitalId = @HospitalId)
  `, {
    PatientId: { type: sql.BigInt, value: patientId },
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
  });

  return {
    results: result.recordset,
    total: countResult.recordset[0]?.TotalCount || 0,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  };
}

async function getPendingApprovalOrders(hospitalId) {
  const schema = await getLabSchema();
  const workflowFilter = schema.hasWorkflowStage
    ? "OR lo.WorkflowStage IN ('DoctorReview', 'Reviewed')"
    : '';

  const result = await query(`
    SELECT
      lo.Id,
      lo.OrderNumber,
      lo.Priority,
      lo.Status,
      lo.ReportedAt,
      ${nullableSelection(schema.hasWorkflowStage, 'lo.WorkflowStage', 'WorkflowStage', 'NVARCHAR(30)')},
      p.UHID,
      p.FirstName + ' ' + p.LastName AS PatientName
    FROM dbo.LabOrders lo
    JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
    WHERE lo.HospitalId = @HospitalId
      AND lo.VerifiedAt IS NULL
      AND (
        lo.ReportedAt IS NOT NULL
        OR lo.Status IN ('Completed', 'Pending Approval')
        ${workflowFilter}
      )
    ORDER BY COALESCE(lo.ReportedAt, lo.OrderDate) DESC
  `, {
    HospitalId: { type: sql.BigInt, value: hospitalId },
  });

  return attachTestNames(result.recordset);
}

async function approveLabTest(orderId, approvedByUserId, approvedByName, hospitalId) {
  const schema = await getLabSchema();
  const settings = await getSignatureSettings(approvedByUserId);
  const clauses = [
    "Status = 'Completed'",
    'VerifiedAt = SYSUTCDATETIME()',
    'VerifiedBy = @VerifiedBy',
    'UpdatedAt = SYSUTCDATETIME()',
  ];

  if (schema.hasWorkflowStage) {
    clauses.push("WorkflowStage = 'DoctorReview'");
  }
  if (schema.hasRejectionReason) {
    clauses.push('RejectionReason = NULL');
  }

  const lookup = await query(`
    SELECT TOP 1 lo.OrderNumber, p.FirstName + ' ' + p.LastName AS PatientName
    FROM dbo.LabOrders lo
    JOIN dbo.PatientProfiles p ON p.Id = lo.PatientId
    WHERE lo.Id = @OrderId
      AND lo.HospitalId = @HospitalId
  `, {
    OrderId: { type: sql.BigInt, value: orderId },
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
  });

  if (!lookup.recordset[0]) {
    throw new Error('Lab order not found');
  }

  await query(`
    UPDATE dbo.LabOrders
    SET ${clauses.join(', ')}
    WHERE Id = @OrderId
      AND (@HospitalId IS NULL OR HospitalId = @HospitalId)
  `, {
    VerifiedBy: { type: sql.BigInt, value: approvedByUserId || null },
    OrderId: { type: sql.BigInt, value: orderId },
    HospitalId: { type: sql.BigInt, value: hospitalId || null },
  });

  return {
    orderId,
    orderNumber: lookup.recordset[0].OrderNumber,
    patientName: lookup.recordset[0].PatientName,
    approvedByName,
    signatureText: settings.SignatureText || approvedByName,
    signaturePreference: settings.SignaturePreference || 'NewPage',
    signatureImagePath: settings.SignatureImagePath || null,
  };
}

async function rejectLabTest(orderId, reason, rejectedByUserId, hospitalId) {
  const schema = await getLabSchema();
  const clauses = [
    "Status = 'Processing'",
    'VerifiedAt = NULL',
    'VerifiedBy = NULL',
    'UpdatedAt = SYSUTCDATETIME()',
    'Notes = CONCAT(COALESCE(Notes, \'\'), CASE WHEN Notes IS NULL OR Notes = \'\' THEN \'\' ELSE CHAR(10) END, @ReasonNote)',
  ];

  if (schema.hasWorkflowStage) {
    clauses.push("WorkflowStage = 'Processing'");
  }
  if (schema.hasRejectionReason) {
    clauses.push('RejectionReason = @Reason');
  }

  return withTransaction(async (transaction) => {
    const orderRequest = new sql.Request(transaction);
    const orderUpdate = await orderRequest
      .input('OrderId', sql.BigInt, orderId)
      .input('HospitalId', sql.BigInt, hospitalId || null)
      .input('Reason', sql.NVarChar(1000), reason)
      .input('ReasonNote', sql.NVarChar(1100), `Rejected by lab incharge: ${reason}`)
      .query(`
        UPDATE dbo.LabOrders
        SET ${clauses.join(', ')}
        WHERE Id = @OrderId
          AND (@HospitalId IS NULL OR HospitalId = @HospitalId)
      `);

    if (!orderUpdate.rowsAffected[0]) {
      return {
        success: false,
        message: 'Lab order not found',
      };
    }

    await new sql.Request(transaction)
      .input('OrderId', sql.BigInt, orderId)
      .query(`
        UPDATE dbo.LabOrderItems
        SET
          Status = CASE WHEN Status = 'Completed' THEN 'Processing' ELSE Status END
        WHERE LabOrderId = @OrderId
      `);

    await new sql.Request(transaction)
      .input('OrderId', sql.BigInt, orderId)
      .query(`
        IF OBJECT_ID('dbo.LabSamples', 'U') IS NOT NULL
        BEGIN
          UPDATE ls
          SET SampleStatus = 'Processing'
          FROM dbo.LabSamples ls
          JOIN dbo.LabOrderItems li ON li.Id = ls.LabOrderItemId
          WHERE li.LabOrderId = @OrderId;
        END
      `);

    return {
      success: true,
      message: 'Lab result rejected and sent back to processing.',
    };
  });
}

module.exports = {
  getLabTests,
  addLabTest,
  removeLabTest,
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  generateSampleId,
  updateOrderStatus,
  enterTestResult,
  getPatientLabResults,
  addLabAttachment,
  removeLabAttachment,
  getLabAttachments,
  getAvailableLabRooms,
  assignTechnicianToRoom,
  getTechnicianAssignment,
  addLabRoom,
  removeLabRoom,
  getTransferHistory,
  approveRoomAssignment,
  rejectRoomAssignment,
  getPendingAssignments,
  getLabs,
  getLabAutofillRules,
  addLabAutofillRule,
  removeLabAutofillRule,
  getPendingApprovalOrders,
  approveLabTest,
  rejectLabTest,
  getSignatureSettings,
  updateSignatureSettings,
};
